import express from 'express';
import bcrypt from 'bcryptjs';
import { db, assertDb } from '../db/database.js';
import { authenticate, createToken } from '../middleware/auth.js';
import { requireFields } from '../utils/validators.js';

export const authRouter = express.Router();

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, has_seen_walkthrough: Boolean(user.has_seen_walkthrough) };
}

authRouter.post('/register', async (req, res) => {
  const error = requireFields(req.body, ['name', 'email', 'password']);
  if (error) return res.status(400).json({ message: error });
  if (String(req.body.password).length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
  const password_hash = await bcrypt.hash(req.body.password, 10);
  const result = await db.from('users').insert({ name: req.body.name.trim(), email: req.body.email.trim().toLowerCase(), password_hash, role: req.body.role === 'admin' ? 'admin' : 'user' }).select().single();
  if (result.error) return res.status(result.error.code === '23505' ? 409 : 500).json({ message: result.error.code === '23505' ? 'Email already registered' : 'Registration failed' });
  const user = result.data;
  res.cookie('token', createToken(user), { httpOnly: true, sameSite: 'lax', secure: false });
  return res.status(201).json({ token: createToken(user), user: publicUser(user) });
});

authRouter.post('/login', async (req, res) => {
  const error = requireFields(req.body, ['email', 'password']);
  if (error) return res.status(400).json({ message: error });
  const user = assertDb(await db.from('users').select('*').eq('email', req.body.email.trim().toLowerCase()).maybeSingle());
  if (!user || !(await bcrypt.compare(req.body.password, user.password_hash))) return res.status(401).json({ message: 'Invalid email or password' });
  const token = createToken(user);
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', secure: false });
  return res.json({ token, user: publicUser(user) });
});

authRouter.get('/me', authenticate, async (req, res) => {
  const user = assertDb(await db.from('users').select('*').eq('id', req.user.id).maybeSingle());
  if (!user) return res.status(404).json({ message: 'User not found' });
  return res.json({ user: publicUser(user) });
});

authRouter.patch('/walkthrough', authenticate, async (req, res) => {
  const user = assertDb(await db.from('users').update({ has_seen_walkthrough: true }).eq('id', req.user.id).select().single());
  return res.json({ user: publicUser(user) });
});

authRouter.post('/logout', (_req, res) => res.clearCookie('token').json({ message: 'Logged out' }));

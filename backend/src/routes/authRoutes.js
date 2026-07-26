import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/database.js';
import { authenticate, createToken } from '../middleware/auth.js';
import { requireFields } from '../utils/validators.js';

export const authRouter = express.Router();

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    has_seen_walkthrough: Boolean(user.has_seen_walkthrough)
  };
}

authRouter.post('/register', async (req, res) => {
  const error = requireFields(req.body, ['name', 'email', 'password']);
  if (error) return res.status(400).json({ message: error });
  if (String(req.body.password).length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });

  const passwordHash = await bcrypt.hash(req.body.password, 10);
  try {
    const result = db
      .prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
      .run(req.body.name.trim(), req.body.email.trim().toLowerCase(), passwordHash, req.body.role === 'admin' ? 'admin' : 'user');
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    const token = createToken(user);
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', secure: false });
    return res.status(201).json({ token, user: publicUser(user) });
  } catch (insertError) {
    if (insertError.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ message: 'Email already registered' });
    return res.status(500).json({ message: 'Registration failed' });
  }
});

authRouter.post('/login', async (req, res) => {
  const error = requireFields(req.body, ['email', 'password']);
  if (error) return res.status(400).json({ message: error });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(req.body.email.trim().toLowerCase());
  if (!user || !(await bcrypt.compare(req.body.password, user.password_hash))) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const token = createToken(user);
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', secure: false });
  return res.json({ token, user: publicUser(user) });
});

authRouter.get('/me', authenticate, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  return res.json({ user: publicUser(user) });
});

authRouter.patch('/walkthrough', authenticate, (req, res) => {
  db.prepare('UPDATE users SET has_seen_walkthrough = 1 WHERE id = ?').run(req.user.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  return res.json({ user: publicUser(user) });
});

authRouter.post('/logout', (req, res) => {
  res.clearCookie('token');
  return res.json({ message: 'Logged out' });
});

import express from 'express';
import bcrypt from 'bcryptjs';
import { argon2id, argon2Verify } from 'hash-wasm';
import { db } from '../db/database.js';
import { authenticate, createToken } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/auth.js';
import crypto from 'crypto';
import { requireFields } from '../utils/validators.js';

export const authRouter = express.Router();

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  return argon2id({ password, salt, parallelism: 1, iterations: 2, memorySize: 19456, hashLength: 32, outputType: 'encoded' });
}

async function verifyPassword(password, hash) {
  if (hash.startsWith('$argon2id$')) return argon2Verify({ password, hash });
  return bcrypt.compare(password, hash);
}

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

  const email = req.body.email.trim().toLowerCase();
  try {
    const adminCount = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'").get().count;
    let role = 'user';
    if (adminCount === 0) {
      role = 'admin';
    } else {
      const invitation = db.prepare("SELECT * FROM invitations WHERE token = ? AND email = ? AND accepted_at IS NULL AND expires_at > datetime('now')").get(String(req.body.inviteToken || ''), email);
      if (!invitation) return res.status(403).json({ message: 'An active invitation is required. Ask an administrator to invite you.' });
      role = invitation.role;
      req.invitationId = invitation.id;
    }
    const passwordHash = await hashPassword(req.body.password);
    const result = db
      .prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
      .run(req.body.name.trim(), email, passwordHash, role);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    if (req.invitationId) db.prepare("UPDATE invitations SET accepted_at = CURRENT_TIMESTAMP WHERE id = ?").run(req.invitationId);
    const token = createToken(user);
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', secure: false });
    return res.status(201).json({ token, user: publicUser(user) });
  } catch (insertError) {
    if (insertError.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ message: 'Email already registered' });
    return res.status(500).json({ message: 'Registration failed' });
  }
});

authRouter.get('/team', authenticate, (_req, res) => {
  const members = db.prepare('SELECT id, name, role FROM users ORDER BY created_at').all();
  const owner = db.prepare("SELECT id, name, email FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1").get();
  return res.json({ owner: owner || null, memberCount: members.length, members });
});

authRouter.get('/admin/users', authenticate, requireAdmin, (req, res) => {
  const users = db.prepare('SELECT id, name, email, role, created_at FROM users ORDER BY created_at').all();
  const owner = db.prepare("SELECT id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1").get();
  return res.json({ users, ownerId: owner?.id || null });
});

authRouter.patch('/admin/users/:id/role', authenticate, requireAdmin, (req, res) => {
  const role = String(req.body.role || '');
  if (!['admin', 'manager', 'user'].includes(role)) return res.status(400).json({ message: 'Role must be admin, manager, or user' });
  const id = Number(req.params.id);
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!target) return res.status(404).json({ message: 'User not found' });
  const owner = db.prepare("SELECT id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1").get();
  if (target.id === owner?.id) return res.status(403).json({ message: 'The main owner role cannot be changed' });
  if (target.role === 'admin' && role !== 'admin' && db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'").get().count === 1) return res.status(400).json({ message: 'At least one administrator must remain' });
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
  return res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)) });
});

authRouter.delete('/admin/users/:id', authenticate, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!target) return res.status(404).json({ message: 'User not found' });
  const owner = db.prepare("SELECT id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1").get();
  if (target.id === owner?.id) return res.status(403).json({ message: 'The main owner cannot be removed' });
  if (target.role === 'admin' && req.user.id !== owner?.id) return res.status(403).json({ message: 'Only the main owner can remove another administrator' });
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  return res.json({ message: 'User removed' });
});

authRouter.get('/admin/invitations', authenticate, requireAdmin, (req, res) => {
  const invitations = db.prepare('SELECT id, email, role, token, expires_at, accepted_at, created_at FROM invitations ORDER BY created_at DESC').all();
  return res.json({ invitations });
});

authRouter.post('/admin/invitations', authenticate, requireAdmin, (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const role = String(req.body.role || 'user');
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ message: 'A valid email is required' });
  if (!['admin', 'manager', 'user'].includes(role)) return res.status(400).json({ message: 'Role must be admin, manager, or user' });
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) return res.status(409).json({ message: 'This email is already registered' });
  const token = crypto.randomBytes(32).toString('hex');
  const result = db.prepare("INSERT INTO invitations (email, role, token, invited_by, expires_at) VALUES (?, ?, ?, ?, datetime('now', '+7 days'))").run(email, role, token, req.user.id);
  const invitation = db.prepare('SELECT id, email, role, token, expires_at, accepted_at, created_at FROM invitations WHERE id = ?').get(result.lastInsertRowid);
  return res.status(201).json({ invitation });
});

authRouter.delete('/admin/invitations/:id', authenticate, requireAdmin, (req, res) => {
  const result = db.prepare('DELETE FROM invitations WHERE id = ? AND accepted_at IS NULL').run(Number(req.params.id));
  if (!result.changes) return res.status(404).json({ message: 'Pending invitation not found' });
  return res.json({ message: 'Invitation cancelled' });
});

authRouter.post('/login', async (req, res) => {
  const error = requireFields(req.body, ['email', 'password']);
  if (error) return res.status(400).json({ message: error });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(req.body.email.trim().toLowerCase());
  if (!user || !(await verifyPassword(req.body.password, user.password_hash))) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  if (!user.password_hash.startsWith('$argon2id$')) {
    user.password_hash = await hashPassword(req.body.password);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(user.password_hash, user.id);
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

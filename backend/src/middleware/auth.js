import jwt from 'jsonwebtoken';
import { db } from '../db/database.js';

const secret = process.env.JWT_SECRET || 'development_secret_change_me';

export function createToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, secret, { expiresIn: '7d' });
}

export function authenticate(req, res, next) {
  const header = req.headers.authorization;
  const cookieToken = req.cookies?.token;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : cookieToken;

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    req.user = jwt.verify(token, secret);
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired session' });
  }
}

export function requireAdmin(req, res, next) {
  const user = req.user?.id && db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.id);
  if (user?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin role required' });
  }
  return next();
}

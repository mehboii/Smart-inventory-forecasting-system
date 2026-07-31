import express from 'express';
import { db } from '../db/database.js';
import { authenticate } from '../middleware/auth.js';
import { isIsoDate, requireFields, toPositiveInt } from '../utils/validators.js';

export const salesRouter = express.Router();
salesRouter.use(authenticate);

function ensureProductOwnership(productId, userId) {
  return db.prepare('SELECT id FROM products WHERE id = ? AND user_id = ?').get(productId, userId);
}

function saveSalesRows(productId, rows) {
  const insert = db.prepare(
    `INSERT INTO sales_history (product_id, date, quantity_sold)
     VALUES (?, ?, ?)
     ON CONFLICT(product_id, date) DO UPDATE SET quantity_sold = excluded.quantity_sold`
  );
  const transaction = db.transaction((salesRows) => {
    salesRows.forEach((row) => insert.run(productId, row.date, row.quantity_sold));
  });
  transaction(rows);
}

salesRouter.get('/:productId', (req, res) => {
  if (!ensureProductOwnership(req.params.productId, req.user.id)) return res.status(404).json({ message: 'Product not found' });
  const sales = db.prepare('SELECT * FROM sales_history WHERE product_id = ? ORDER BY date ASC').all(req.params.productId);
  return res.json({ sales });
});

salesRouter.post('/:productId', (req, res) => {
  if (!ensureProductOwnership(req.params.productId, req.user.id)) return res.status(404).json({ message: 'Product not found' });
  const error = requireFields(req.body, ['date', 'quantity_sold']);
  if (error) return res.status(400).json({ message: error });
  if (!isIsoDate(req.body.date)) return res.status(400).json({ message: 'Date must use YYYY-MM-DD format' });

  const row = { date: req.body.date, quantity_sold: toPositiveInt(req.body.quantity_sold) };
  saveSalesRows(req.params.productId, [row]);
  db.prepare('DELETE FROM forecasts WHERE product_id = ?').run(req.params.productId);
  return res.status(201).json({ sale: db.prepare('SELECT * FROM sales_history WHERE product_id = ? AND date = ?').get(req.params.productId, row.date) });
});

salesRouter.post('/:productId/bulk', (req, res) => {
  if (!ensureProductOwnership(req.params.productId, req.user.id)) return res.status(404).json({ message: 'Product not found' });
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  const normalized = rows
    .filter((row) => isIsoDate(row.date))
    .map((row) => ({ date: row.date, quantity_sold: toPositiveInt(row.quantity_sold) }));
  if (!normalized.length) return res.status(400).json({ message: 'No valid sales rows provided' });

  saveSalesRows(req.params.productId, normalized);
  db.prepare('DELETE FROM forecasts WHERE product_id = ?').run(req.params.productId);
  return res.status(201).json({ imported: normalized.length });
});

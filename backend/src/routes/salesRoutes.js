import express from 'express';
import { db, assertDb } from '../db/database.js';
import { authenticate } from '../middleware/auth.js';
import { isIsoDate, requireFields, toPositiveInt } from '../utils/validators.js';

export const salesRouter = express.Router();
salesRouter.use(authenticate);

async function ensureProductOwnership(productId, userId) {
  return assertDb(await db.from('products').select('id').eq('id', productId).eq('user_id', userId).maybeSingle());
}

async function saveSalesRows(productId, rows) {
  return assertDb(await db.from('sales_history').upsert(rows.map((row) => ({ product_id: productId, ...row })), { onConflict: 'product_id,date' }));
}

salesRouter.get('/:productId', async (req, res) => {
  if (!await ensureProductOwnership(req.params.productId, req.user.id)) return res.status(404).json({ message: 'Product not found' });
  return res.json({ sales: assertDb(await db.from('sales_history').select('*').eq('product_id', req.params.productId).order('date')) });
});

salesRouter.post('/:productId', async (req, res) => {
  if (!await ensureProductOwnership(req.params.productId, req.user.id)) return res.status(404).json({ message: 'Product not found' });
  const error = requireFields(req.body, ['date', 'quantity_sold']);
  if (error) return res.status(400).json({ message: error });
  if (!isIsoDate(req.body.date)) return res.status(400).json({ message: 'Date must use YYYY-MM-DD format' });
  const row = { date: req.body.date, quantity_sold: toPositiveInt(req.body.quantity_sold) };
  await saveSalesRows(req.params.productId, [row]);
  return res.status(201).json({ sale: assertDb(await db.from('sales_history').select('*').eq('product_id', req.params.productId).eq('date', row.date).single()) });
});

salesRouter.post('/:productId/bulk', async (req, res) => {
  if (!await ensureProductOwnership(req.params.productId, req.user.id)) return res.status(404).json({ message: 'Product not found' });
  const normalized = (Array.isArray(req.body.rows) ? req.body.rows : []).filter((row) => isIsoDate(row.date)).map((row) => ({ date: row.date, quantity_sold: toPositiveInt(row.quantity_sold) }));
  if (!normalized.length) return res.status(400).json({ message: 'No valid sales rows provided' });
  await saveSalesRows(req.params.productId, normalized);
  return res.status(201).json({ imported: normalized.length });
});

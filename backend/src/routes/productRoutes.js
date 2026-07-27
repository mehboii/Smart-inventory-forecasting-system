import express from 'express';
import { db, assertDb } from '../db/database.js';
import { authenticate } from '../middleware/auth.js';
import { requireFields, toPositiveFloat, toPositiveInt } from '../utils/validators.js';
import { publishInventoryUpdate } from '../services/liveUpdates.js';

export const productRouter = express.Router();
productRouter.use(authenticate);

function normalizeProduct(body) {
  return { name: String(body.name || '').trim(), sku: String(body.sku || '').trim(), category: String(body.category || '').trim(), current_stock: toPositiveInt(body.current_stock), reorder_point: toPositiveInt(body.reorder_point), unit_cost: toPositiveFloat(body.unit_cost), lead_time_days: Math.max(toPositiveInt(body.lead_time_days, 7), 1) };
}

productRouter.get('/', async (req, res) => res.json({ products: assertDb(await db.from('products').select('*').eq('user_id', req.user.id).order('name')) }));

productRouter.post('/', async (req, res) => {
  const error = requireFields(req.body, ['name', 'sku', 'category']);
  if (error) return res.status(400).json({ message: error });
  const result = await db.from('products').insert({ user_id: req.user.id, ...normalizeProduct(req.body) }).select().single();
  if (result.error) return res.status(result.error.code === '23505' ? 409 : 500).json({ message: result.error.code === '23505' ? 'SKU already exists' : 'Product creation failed' });
  publishInventoryUpdate(req.user.id, 'product');
  return res.status(201).json({ product: result.data });
});

productRouter.put('/:id', async (req, res) => {
  const existing = assertDb(await db.from('products').select('id').eq('id', req.params.id).eq('user_id', req.user.id).maybeSingle());
  if (!existing) return res.status(404).json({ message: 'Product not found' });
  const error = requireFields(req.body, ['name', 'sku', 'category']);
  if (error) return res.status(400).json({ message: error });
  const result = await db.from('products').update({ ...normalizeProduct(req.body), updated_at: new Date().toISOString() }).eq('id', req.params.id).eq('user_id', req.user.id).select().single();
  if (result.error) return res.status(result.error.code === '23505' ? 409 : 500).json({ message: result.error.code === '23505' ? 'SKU already exists' : 'Product update failed' });
  publishInventoryUpdate(req.user.id, 'product');
  return res.json({ product: result.data });
});

productRouter.delete('/:id', async (req, res) => {
  const result = await db.from('products').delete().eq('id', req.params.id).eq('user_id', req.user.id).select('id');
  if (result.error) return res.status(500).json({ message: 'Product deletion failed' });
  if (!result.data.length) return res.status(404).json({ message: 'Product not found' });
  publishInventoryUpdate(req.user.id, 'product');
  return res.json({ message: 'Product deleted' });
});

productRouter.get('/summary/metrics', async (req, res) => {
  const products = assertDb(await db.from('products').select('*').eq('user_id', req.user.id));
  const lowStockItems = products.filter((p) => p.current_stock <= p.reorder_point);
  const dueForReorder = products.filter((p) => p.current_stock <= p.reorder_point + 5);
  return res.json({ totalProducts: products.length, lowStockItems: lowStockItems.length, dueForReorder: dueForReorder.length, inventoryValue: Number(products.reduce((sum, p) => sum + p.current_stock * Number(p.unit_cost), 0).toFixed(2)) });
});

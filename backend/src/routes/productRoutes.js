import express from 'express';
import { db } from '../db/database.js';
import { authenticate } from '../middleware/auth.js';
import { requireFields, toPositiveFloat, toPositiveInt } from '../utils/validators.js';
import { publishInventoryUpdate } from '../services/liveUpdates.js';

export const productRouter = express.Router();
productRouter.use(authenticate);

function normalizeProduct(body) {
  return {
    name: String(body.name || '').trim(),
    sku: String(body.sku || '').trim(),
    category: String(body.category || '').trim(),
    current_stock: toPositiveInt(body.current_stock),
    reorder_point: toPositiveInt(body.reorder_point),
    unit_cost: toPositiveFloat(body.unit_cost),
    lead_time_days: Math.max(toPositiveInt(body.lead_time_days, 7), 1)
  };
}

productRouter.get('/', (req, res) => {
  const products = db.prepare('SELECT * FROM products WHERE user_id = ? ORDER BY name ASC').all(req.user.id);
  return res.json({ products });
});

productRouter.post('/', (req, res) => {
  const error = requireFields(req.body, ['name', 'sku', 'category']);
  if (error) return res.status(400).json({ message: error });
  const product = normalizeProduct(req.body);
  try {
    const result = db.prepare(
      `INSERT INTO products (user_id, name, sku, category, current_stock, reorder_point, unit_cost, lead_time_days)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(req.user.id, product.name, product.sku, product.category, product.current_stock, product.reorder_point, product.unit_cost, product.lead_time_days);
    publishInventoryUpdate(req.user.id, 'product');
    return res.status(201).json({ product: db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid) });
  } catch (insertError) {
    if (insertError.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ message: 'SKU already exists' });
    return res.status(500).json({ message: 'Product creation failed' });
  }
});

productRouter.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM products WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ message: 'Product not found' });
  const error = requireFields(req.body, ['name', 'sku', 'category']);
  if (error) return res.status(400).json({ message: error });
  const product = normalizeProduct(req.body);
  try {
    db.prepare(
      `UPDATE products SET name = ?, sku = ?, category = ?, current_stock = ?, reorder_point = ?, unit_cost = ?, lead_time_days = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`
    ).run(product.name, product.sku, product.category, product.current_stock, product.reorder_point, product.unit_cost, product.lead_time_days, req.params.id, req.user.id);
    publishInventoryUpdate(req.user.id, 'product');
    return res.json({ product: db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id) });
  } catch (updateError) {
    if (updateError.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ message: 'SKU already exists' });
    return res.status(500).json({ message: 'Product update failed' });
  }
});

productRouter.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM products WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (!result.changes) return res.status(404).json({ message: 'Product not found' });
  publishInventoryUpdate(req.user.id, 'product');
  return res.json({ message: 'Product deleted' });
});

productRouter.get('/summary/metrics', (req, res) => {
  const products = db.prepare('SELECT * FROM products WHERE user_id = ?').all(req.user.id);
  const lowStockItems = products.filter((product) => product.current_stock <= product.reorder_point);
  const dueForReorder = products.filter((product) => product.current_stock <= product.reorder_point + 5);
  return res.json({
    totalProducts: products.length,
    lowStockItems: lowStockItems.length,
    dueForReorder: dueForReorder.length,
    inventoryValue: Number(products.reduce((sum, product) => sum + product.current_stock * product.unit_cost, 0).toFixed(2))
  });
});

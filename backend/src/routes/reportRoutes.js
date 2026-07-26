import express from 'express';
import { db, assertDb } from '../db/database.js';
import { authenticate } from '../middleware/auth.js';

export const reportRouter = express.Router();
reportRouter.use(authenticate);

function csvEscape(value) {
  const text = String(value ?? '');
  return text.includes(',') || text.includes('"') || text.includes('\n') ? `"${text.replaceAll('"', '""')}"` : text;
}

reportRouter.get('/inventory-forecast.csv', async (req, res) => {
  const products = assertDb(await db.from('products').select('name, sku, category, current_stock, reorder_point, unit_cost, id').eq('user_id', req.user.id).order('name'));
  const rows = [];
  for (const product of products) {
    const forecasts = assertDb(await db.from('forecasts').select('forecast_date, predicted_demand, method').eq('product_id', product.id).order('forecast_date'));
    if (!forecasts.length) rows.push({ ...product, forecast_date: null, predicted_demand: null, method: null });
    forecasts.forEach((forecast) => rows.push({ ...product, ...forecast }));
  }

  const header = ['name', 'sku', 'category', 'current_stock', 'reorder_point', 'unit_cost', 'forecast_date', 'predicted_demand', 'method'];
  const csv = [header.join(','), ...rows.map((row) => header.map((key) => csvEscape(row[key])).join(','))].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="inventory_forecast.csv"');
  return res.send(csv);
});

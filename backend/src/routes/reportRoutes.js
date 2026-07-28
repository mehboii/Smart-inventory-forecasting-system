import express from 'express';
import { db } from '../db/database.js';
import { authenticate } from '../middleware/auth.js';

export const reportRouter = express.Router();
reportRouter.use(authenticate);

function csvEscape(value) {
  const text = String(value ?? '');
  return text.includes(',') || text.includes('"') || text.includes('\n') ? `"${text.replaceAll('"', '""')}"` : text;
}

reportRouter.get('/inventory-forecast.csv', (req, res) => {
  const rows = db
    .prepare(
      `SELECT p.name, p.sku, p.category, p.current_stock, p.reorder_point, p.unit_cost,
              f.forecast_date, f.predicted_demand, f.method
       FROM products p
       LEFT JOIN forecasts f ON f.product_id = p.id
       WHERE p.user_id = ?
       ORDER BY p.name, f.forecast_date`
    )
    .all(req.user.id);

  const header = ['name', 'sku', 'category', 'current_stock', 'reorder_point', 'unit_cost', 'forecast_date', 'predicted_demand', 'method'];
  const csv = [header.join(','), ...rows.map((row) => header.map((key) => csvEscape(row[key])).join(','))].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="inventory_forecast.csv"');
  return res.send(csv);
});

import express from 'express';
import { db } from '../db/database.js';
import { authenticate } from '../middleware/auth.js';
import { generateForecast } from '../services/forecastService.js';
import { publishInventoryUpdate } from '../services/liveUpdates.js';

export const forecastRouter = express.Router();
forecastRouter.use(authenticate);

forecastRouter.post('/:productId', (req, res) => {
  const product = db.prepare('SELECT id FROM products WHERE id = ? AND user_id = ?').get(req.params.productId, req.user.id);
  if (!product) return res.status(404).json({ message: 'Product not found' });

  try {
    const forecast = generateForecast({
      productId: Number(req.params.productId),
      method: req.body.method,
      horizon: req.body.horizon,
      windowSize: req.body.windowSize,
      alpha: req.body.alpha
    });
    publishInventoryUpdate(req.user.id, 'forecast');
    return res.json(forecast);
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message || 'Forecast generation failed' });
  }
});

forecastRouter.get('/alerts/summary', (req, res) => {
  const products = db
    .prepare('SELECT id, name, sku, current_stock, reorder_point, lead_time_days FROM products WHERE user_id = ?')
    .all(req.user.id);
  const alerts = products
    .map((product) => {
      const recent = db
        .prepare('SELECT quantity_sold FROM sales_history WHERE product_id = ? ORDER BY date DESC LIMIT 7')
        .all(product.id)
        .map((row) => row.quantity_sold);
      const averageDemand = recent.length ? recent.reduce((sum, value) => sum + value, 0) / recent.length : 0;
      const leadTimeDemand = averageDemand * product.lead_time_days;
      return {
        ...product,
        averageDailyDemand: Number(averageDemand.toFixed(2)),
        reorderNeeded: product.current_stock <= product.reorder_point || product.current_stock < leadTimeDemand,
        suggestedReorderQuantity: Math.max(0, Math.ceil(leadTimeDemand + product.reorder_point - product.current_stock))
      };
    })
    .filter((alert) => alert.reorderNeeded);
  return res.json({ alerts });
});

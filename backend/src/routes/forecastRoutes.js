import express from 'express';
import { db, assertDb } from '../db/database.js';
import { authenticate } from '../middleware/auth.js';
import { generateForecast } from '../services/forecastService.js';

export const forecastRouter = express.Router();
forecastRouter.use(authenticate);

forecastRouter.post('/:productId', async (req, res) => {
  const product = assertDb(await db.from('products').select('id').eq('id', req.params.productId).eq('user_id', req.user.id).maybeSingle());
  if (!product) return res.status(404).json({ message: 'Product not found' });

  try {
    return res.json(
      await generateForecast({
        productId: Number(req.params.productId),
        method: req.body.method,
        horizon: req.body.horizon,
        windowSize: req.body.windowSize,
        alpha: req.body.alpha
      })
    );
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message || 'Forecast generation failed' });
  }
});

forecastRouter.get('/alerts/summary', async (req, res) => {
  const products = assertDb(await db.from('products').select('id, name, sku, current_stock, reorder_point, lead_time_days').eq('user_id', req.user.id));
  const alerts = (await Promise.all(products.map(async (product) => {
      const recent = assertDb(await db.from('sales_history').select('quantity_sold').eq('product_id', product.id).order('date', { ascending: false }).limit(7)).map((row) => row.quantity_sold);
      const averageDemand = recent.length ? recent.reduce((sum, value) => sum + value, 0) / recent.length : 0;
      const leadTimeDemand = averageDemand * product.lead_time_days;
      return {
        ...product,
        averageDailyDemand: Number(averageDemand.toFixed(2)),
        reorderNeeded: product.current_stock <= product.reorder_point || product.current_stock < leadTimeDemand,
        suggestedReorderQuantity: Math.max(0, Math.ceil(leadTimeDemand + product.reorder_point - product.current_stock))
      };
    })))
    .filter((alert) => alert.reorderNeeded);
  return res.json({ alerts });
});

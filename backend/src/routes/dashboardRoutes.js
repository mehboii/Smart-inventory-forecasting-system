import express from 'express';
import { db } from '../db/database.js';
import { authenticate } from '../middleware/auth.js';

export const dashboardRouter = express.Router();
dashboardRouter.use(authenticate);

function isoDateDaysAgo(daysAgo) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

dashboardRouter.get('/', (req, res) => {
  res.set('Cache-Control', 'no-store');
  const products = db.prepare('SELECT * FROM products WHERE user_id = ? ORDER BY name ASC').all(req.user.id);
  const fromDate = isoDateDaysAgo(13);
  const sales = db
    .prepare(
      `SELECT s.product_id, s.date, s.quantity_sold
       FROM sales_history s
       INNER JOIN products p ON p.id = s.product_id
       WHERE p.user_id = ?
       ORDER BY s.date ASC`
    )
    .all(req.user.id);

  const salesByProduct = new Map();
  const salesByDate = new Map();
  for (const sale of sales) {
    const productSales = salesByProduct.get(sale.product_id) || [];
    productSales.push(Number(sale.quantity_sold));
    salesByProduct.set(sale.product_id, productSales);
    if (sale.date >= fromDate) salesByDate.set(sale.date, (salesByDate.get(sale.date) || 0) + Number(sale.quantity_sold));
  }

  const alerts = products.map((product) => {
    const recentSales = (salesByProduct.get(product.id) || []).slice(-7);
    const averageDailyDemand = recentSales.length ? recentSales.reduce((sum, value) => sum + value, 0) / recentSales.length : 0;
    const leadTimeDemand = averageDailyDemand * product.lead_time_days;
    const reorderNeeded = product.current_stock <= product.reorder_point || product.current_stock < leadTimeDemand;
    return {
      ...product,
      averageDailyDemand: Number(averageDailyDemand.toFixed(2)),
      reorderNeeded,
      suggestedReorderQuantity: Math.max(0, Math.ceil(leadTimeDemand + product.reorder_point - product.current_stock))
    };
  }).filter((alert) => alert.reorderNeeded);

  const lowStockItems = products.filter((product) => product.current_stock <= product.reorder_point);
  const dueForReorder = products.filter((product) => product.current_stock <= product.reorder_point + 5);
  const riskScore = products.length
    ? Math.round(Math.min(1000, ((lowStockItems.length * 0.65 + alerts.length * 0.35) / products.length) * 1000))
    : 0;
  const categoryCounts = products.reduce((counts, product) => {
    counts.set(product.category, (counts.get(product.category) || 0) + 1);
    return counts;
  }, new Map());

  const alertIds = new Set(alerts.map((alert) => alert.id));
  return res.json({
    metrics: {
      totalProducts: products.length,
      lowStockItems: lowStockItems.length,
      dueForReorder: dueForReorder.length,
      inventoryValue: Number(products.reduce((sum, product) => sum + product.current_stock * Number(product.unit_cost), 0).toFixed(2)),
      openAlerts: alerts.length
    },
    risk: { score: riskScore, level: riskScore >= 700 ? 'High' : riskScore >= 400 ? 'Medium' : 'Low' },
    products: products.map((product) => ({ ...product, reorderNeeded: alertIds.has(product.id) })),
    alerts,
    salesTrend: Array.from({ length: 14 }, (_, index) => {
      const date = isoDateDaysAgo(13 - index);
      return { date, quantitySold: salesByDate.get(date) || 0 };
    }),
    categoryMix: Array.from(categoryCounts, ([category, count]) => ({
      category,
      count,
      percentage: products.length ? Math.round((count / products.length) * 100) : 0
    })).sort((a, b) => b.count - a.count),
    updatedAt: new Date().toISOString()
  });
});

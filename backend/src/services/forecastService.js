import { db, assertDb } from '../db/database.js';

function addDays(date, days) {
  const copy = new Date(`${date}T00:00:00.000Z`);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy.toISOString().slice(0, 10);
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function movingAverage(history, horizon, windowSize) {
  const quantities = history.map((row) => row.quantity_sold);
  const predictions = [];
  const rolling = [...quantities];

  for (let index = 0; index < horizon; index += 1) {
    const window = rolling.slice(-windowSize);
    const predicted = average(window);
    predictions.push(Number(predicted.toFixed(2)));
    rolling.push(predicted);
  }

  return predictions;
}

function exponentialSmoothing(history, horizon, alpha) {
  const quantities = history.map((row) => row.quantity_sold);
  let smoothed = quantities[0] ?? 0;

  for (let index = 1; index < quantities.length; index += 1) {
    smoothed = alpha * quantities[index] + (1 - alpha) * smoothed;
  }

  return Array.from({ length: horizon }, () => Number(smoothed.toFixed(2)));
}

export async function generateForecast({ productId, method = 'moving_average', horizon = 14, windowSize = 7, alpha = 0.35 }) {
  const product = assertDb(await db.from('products').select('*').eq('id', productId).maybeSingle());
  if (!product) {
    const error = new Error('Product not found');
    error.status = 404;
    throw error;
  }

  const history = assertDb(await db.from('sales_history').select('date, quantity_sold').eq('product_id', productId).order('date'));

  if (!history.length) {
    const error = new Error('At least one historical sales entry is required');
    error.status = 400;
    throw error;
  }

  const safeHorizon = Math.min(Math.max(Number.parseInt(horizon, 10) || 14, 1), 90);
  const safeWindow = Math.min(Math.max(Number.parseInt(windowSize, 10) || 7, 1), history.length);
  const safeAlpha = Math.min(Math.max(Number.parseFloat(alpha) || 0.35, 0.01), 1);
  const lastDate = history[history.length - 1].date;
  const predictions =
    method === 'exponential_smoothing'
      ? exponentialSmoothing(history, safeHorizon, safeAlpha)
      : movingAverage(history, safeHorizon, safeWindow);

  const series = predictions.map((predictedDemand, index) => ({
    forecast_date: addDays(lastDate, index + 1),
    predicted_demand: predictedDemand
  }));

  const totalPredictedDemand = predictions.reduce((sum, value) => sum + value, 0);
  const averageDailyDemand = totalPredictedDemand / predictions.length;
  const daysUntilStockout = averageDailyDemand > 0 ? product.current_stock / averageDailyDemand : null;
  const likelyStockoutDate = daysUntilStockout === null ? null : addDays(new Date().toISOString().slice(0, 10), Math.floor(daysUntilStockout));
  const leadTimeDemand = averageDailyDemand * product.lead_time_days;
  const reorderNeeded = product.current_stock <= product.reorder_point || product.current_stock < leadTimeDemand;
  const suggestedReorderQuantity = reorderNeeded
    ? Math.max(0, Math.ceil(leadTimeDemand + product.reorder_point - product.current_stock))
    : 0;

  assertDb(await db.from('forecasts').delete().eq('product_id', productId).eq('method', method));
  assertDb(await db.from('forecasts').insert(series.map((point) => ({ product_id: productId, ...point, method }))));

  const explanation =
    method === 'exponential_smoothing'
      ? `Exponential smoothing was calculated with alpha ${safeAlpha}. Recent sales receive more weight, while older sales still influence the estimate. The final smoothed value is projected across the next ${safeHorizon} day(s).`
      : `Simple moving average was calculated from the last ${safeWindow} available sales value(s). Each forecast step averages the most recent window and rolls the predicted value forward for the next ${safeHorizon} day(s).`;

  return {
    product,
    method,
    history,
    forecast: series,
    explanation,
    alert: {
      reorderNeeded,
      averageDailyDemand: Number(averageDailyDemand.toFixed(2)),
      likelyStockoutDate,
      suggestedReorderQuantity,
      reorderByDate: reorderNeeded ? addDays(likelyStockoutDate || new Date().toISOString().slice(0, 10), -product.lead_time_days) : null
    }
  };
}

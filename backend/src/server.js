import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import './db/database.js';
import { authRouter } from './routes/authRoutes.js';
import { productRouter } from './routes/productRoutes.js';
import { salesRouter } from './routes/salesRoutes.js';
import { forecastRouter } from './routes/forecastRoutes.js';
import { reportRouter } from './routes/reportRoutes.js';
import { liveRouter } from './routes/liveRoutes.js';
import { dashboardRouter } from './routes/dashboardRoutes.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;
const configuredOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin || configuredOrigins.includes(origin)) return true;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

app.use(cors({ origin: (origin, callback) => callback(null, isAllowedOrigin(origin)), credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.get('/', (_req, res) => res.redirect(302, process.env.CLIENT_ORIGIN || 'http://127.0.0.1:5173'));
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRouter);
app.use('/api/products', productRouter);
app.use('/api/sales', salesRouter);
app.use('/api/forecasts', forecastRouter);
app.use('/api/reports', reportRouter);
app.use('/api/live', liveRouter);
app.use('/api/dashboard', dashboardRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: 'Unexpected server error' });
});

app.listen(port, () => {
  console.log(`Smart Inventory API running on http://localhost:${port}`);
});

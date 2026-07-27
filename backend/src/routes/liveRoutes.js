import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { subscribeToInventoryUpdates } from '../services/liveUpdates.js';

export const liveRouter = express.Router();

liveRouter.get('/', authenticate, (req, res) => {
  res.writeHead(200, {
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'Content-Type': 'text/event-stream',
    'X-Accel-Buffering': 'no'
  });
  res.write(`data: ${JSON.stringify({ type: 'connected', updatedAt: new Date().toISOString() })}\n\n`);

  const unsubscribe = subscribeToInventoryUpdates((update) => {
    if (update.userId === req.user.id) res.write(`data: ${JSON.stringify(update)}\n\n`);
  });
  const heartbeat = setInterval(() => res.write(': keep-alive\n\n'), 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

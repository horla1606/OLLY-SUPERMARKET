import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRouter     from './routes/auth';
import productsRouter from './routes/products';
import ordersRouter   from './routes/orders';
import cartRouter     from './routes/cart';
import staffRouter    from './routes/staff';
import messagesRouter from './routes/messages';
import analyticsRouter from './routes/analytics';
import adminRouter    from './routes/admin';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

dotenv.config();

const app  = express();
const PORT = Number(process.env.PORT) || 5000;
const isProd = process.env.NODE_ENV === 'production';

// Trust Railway/Render reverse proxy so req.ip and rate-limit headers are correct
if (isProd) app.set('trust proxy', 1);

// ─── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    credentials: true,
  })
);

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth',      authRouter);
app.use('/api/products',  productsRouter);
app.use('/api/orders',    ordersRouter);
app.use('/api/cart',      cartRouter);
app.use('/api/staff',     staffRouter);
app.use('/api/messages',  messagesRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/admin',     adminRouter);

// ─── Error handling ──────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(PORT, () => {
  console.log(`OLLY API running on port ${PORT} [${process.env.NODE_ENV ?? 'development'}]`);
});

// Graceful shutdown for Railway/Render SIGTERM
const shutdown = (signal: string) => {
  console.log(`${signal} received — shutting down gracefully`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

export default app;

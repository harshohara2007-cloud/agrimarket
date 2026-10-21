import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { router as auth } from './routes/auth.js';
import { router as market } from './routes/market.js';
import { router as listings } from './routes/listings.js';
import { router as pay, webhook } from './routes/pay.js';

export const app = express();
app.set('trust proxy', 1);
app.post('/api/pay/webhook', express.raw({ type: '*/*' }), webhook);   // raw body needed for signature check
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use('/api/auth', rateLimit({ windowMs: 60_000, limit: 20 }), auth);
app.use('/api/market', market);
app.use('/api/listings', listings);
app.use('/api/pay', pay);
app.get('/api/health', (_q, r) => r.json({ ok: true }));

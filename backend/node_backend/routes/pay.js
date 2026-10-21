import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import { requireUser, requireRole } from './auth.js';

export const router = Router();
const ready = () => process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET;
const hmac = (secret, data) => crypto.createHmac('sha256', secret).update(data).digest('hex');
const same = (a, b) => typeof b === 'string' && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

router.get('/status', (_req, res) => res.json({ paymentsEnabled: !!ready() }));

router.post('/order', requireUser, requireRole('buyer'), async (req, res) => {
  if (!ready()) return res.status(503).json({ error: 'payments_not_configured' });
  const { listingId, quantityKg } = req.body || {};
  const l = db.prepare("select * from listings where id=? and status='active'").get(+listingId);
  if (!l || !(+quantityKg > 0) || +quantityKg > l.quantity_kg) return res.status(400).json({ error: 'invalid_order' });
  const amount = Math.round(l.price_per_kg * +quantityKg * 100);              // price from DB, never from the browser; paise
  const { default: Razorpay } = await import('razorpay');
  const o = await new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET })
    .orders.create({ amount, currency: 'INR', receipt: `km_${Date.now()}` });
  db.prepare('insert into orders(buyer_id,listing_id,quantity_kg,amount_paise,rzp_order_id) values(?,?,?,?,?)').run(req.user.id, l.id, +quantityKg, amount, o.id);
  res.json({ orderId: o.id, amount, currency: 'INR', keyId: process.env.RAZORPAY_KEY_ID });
});

const markPaid = (orderId, paymentId) => db.prepare("update orders set status='paid', rzp_payment_id=? where rzp_order_id=? and status='pending'").run(paymentId, orderId).changes;

router.post('/verify', requireUser, (req, res) => {
  if (!ready()) return res.status(503).json({ error: 'payments_not_configured' });
  const { razorpay_order_id: o, razorpay_payment_id: p, razorpay_signature: sg } = req.body || {};
  const order = db.prepare('select * from orders where rzp_order_id=? and buyer_id=?').get(o, req.user.id);
  if (!order || !same(hmac(process.env.RAZORPAY_KEY_SECRET, `${o}|${p}`), sg)) return res.status(400).json({ error: 'bad_signature' });
  markPaid(o, p);                                                              // idempotent: only pending -> paid
  res.json({ ok: true });
});

export function webhook(req, res) {                                           // mounted with express.raw() in app.js
  if (!process.env.RAZORPAY_WEBHOOK_SECRET) return res.status(503).end();
  if (!same(hmac(process.env.RAZORPAY_WEBHOOK_SECRET, req.body), req.headers['x-razorpay-signature'])) return res.status(400).end();
  const ev = JSON.parse(req.body.toString()), pay = ev.payload?.payment?.entity;
  if (ev.event === 'payment.captured' && pay) markPaid(pay.order_id, pay.id);
  if (ev.event === 'payment.failed' && pay) db.prepare("update orders set status='failed' where rzp_order_id=? and status='pending'").run(pay.order_id);
  res.json({ ok: true });
}

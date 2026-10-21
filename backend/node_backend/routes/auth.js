import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db.js';

export const router = Router();
const E164 = /^\+[1-9]\d{9,14}$/;
const prefixes = () => (process.env.OTP_ALLOWED_PREFIXES || '+91').split(',').map(s => s.trim());
const allowed = p => E164.test(p) && prefixes().some(x => p.startsWith(x));
const smsReady = () => process.env.MSG91_AUTHKEY && process.env.MSG91_TEMPLATE_ID && process.env.SESSION_SECRET;

export function requireUser(req, res, next) {
  try { req.user = jwt.verify(req.cookies?.km_session, process.env.SESSION_SECRET); next(); }
  catch { res.status(401).json({ error: 'unauthenticated' }); }
}
export const requireRole = role => (req, res, next) => req.user?.role === role ? next() : res.status(403).json({ error: 'forbidden' });

router.post('/send-otp', async (req, res) => {
  if (!smsReady()) return res.status(503).json({ error: 'sms_not_configured' });
  const phone = String(req.body?.phone || '');
  if (!allowed(phone)) return res.status(400).json({ error: 'invalid_or_unsupported_phone' });
  const now = Date.now();
  const st = db.prepare('select * from otp_state where phone=?').get(phone) || { last_sent: 0, send_count: 0, window_start: now, locked_until: 0 };
  if (st.locked_until > now) return res.status(429).json({ error: 'locked' });
  if (now - st.last_sent < 30_000) return res.status(429).json({ error: 'cooldown', retryAfterSec: 30 });
  const fresh = now - st.window_start > 3_600_000;
  if (!fresh && st.send_count >= 5) return res.status(429).json({ error: 'hourly_limit' });
  try {
    const r = await fetch(`https://control.msg91.com/api/v5/otp?template_id=${encodeURIComponent(process.env.MSG91_TEMPLATE_ID)}&mobile=${phone.slice(1)}&otp_expiry=5`,
      { method: 'POST', headers: { authkey: process.env.MSG91_AUTHKEY, 'content-type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(10000) });
    const data = await r.json().catch(() => ({}));
    if (data.type !== 'success') return res.status(502).json({ error: 'sms_failed' });
  } catch { return res.status(502).json({ error: 'sms_provider_unreachable' }); }
  db.prepare(`insert into otp_state(phone,last_sent,send_count,window_start) values(?,?,1,?)
    on conflict(phone) do update set last_sent=?, send_count=?, window_start=?`)
    .run(phone, now, now, now, fresh ? 1 : st.send_count + 1, fresh ? now : st.window_start);
  res.json({ ok: true });            // OTP is never logged or returned
});

router.post('/verify-otp', async (req, res) => {
  if (!smsReady()) return res.status(503).json({ error: 'sms_not_configured' });
  const { phone, otp, role } = req.body || {};
  if (!allowed(String(phone)) || !/^\d{4,8}$/.test(String(otp))) return res.status(400).json({ error: 'invalid_input' });
  const st = db.prepare('select * from otp_state where phone=?').get(phone);
  if (st?.locked_until > Date.now()) return res.status(429).json({ error: 'locked' });
  let ok = false;
  try {
    const r = await fetch(`https://control.msg91.com/api/v5/otp/verify?mobile=${phone.slice(1)}&otp=${otp}`,
      { headers: { authkey: process.env.MSG91_AUTHKEY }, signal: AbortSignal.timeout(10000) });
    ok = (await r.json().catch(() => ({}))).type === 'success';
  } catch { return res.status(502).json({ error: 'sms_provider_unreachable' }); }
  if (!ok) {
    const fails = (st?.fails || 0) + 1;
    db.prepare(`insert into otp_state(phone,fails,locked_until) values(?,?,?) on conflict(phone) do update set fails=?, locked_until=?`)
      .run(phone, fails, fails >= 5 ? Date.now() + 900_000 : 0, fails >= 5 ? 0 : fails, fails >= 5 ? Date.now() + 900_000 : 0);
    return res.status(401).json({ error: 'wrong_or_expired_otp' });
  }
  db.prepare('update otp_state set fails=0, locked_until=0 where phone=?').run(phone);
  let user = db.prepare('select * from users where phone=?').get(phone);
  if (!user) {
    const info = db.prepare('insert into users(phone,role) values(?,?)').run(phone, role === 'farmer' ? 'farmer' : 'buyer');
    user = db.prepare('select * from users where id=?').get(info.lastInsertRowid);
  }
  const token = jwt.sign({ id: user.id, role: user.role }, process.env.SESSION_SECRET, { expiresIn: '7d' });
  res.cookie('km_session', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 7 * 864e5 });
  res.json({ user: { id: user.id, role: user.role } });
});

router.post('/logout', (_req, res) => { res.clearCookie('km_session'); res.json({ ok: true }); });
router.get('/me', requireUser, (req, res) => res.json({ user: req.user }));

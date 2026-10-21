import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { db } from '../db.js';
import { requireUser, requireRole } from './auth.js';

export const router = Router();
const UP = path.resolve(process.env.UPLOAD_DIR || 'uploads');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const sig = b => (b[0] === 0xff && b[1] === 0xd8 ? ['image/jpeg', 'jpg'] : b.slice(0, 4).toString('hex') === '89504e47' ? ['image/png', 'png']
  : b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP' ? ['image/webp', 'webp'] : null);

router.get('/', (_req, res) => res.json({ rows: db.prepare("select l.*, (select id from listing_images where listing_id=l.id limit 1) image_id from listings l where status='active' order by id desc limit 100").all() }));

router.post('/', requireUser, requireRole('farmer'), (req, res) => {
  const { crop, quantityKg, pricePerKg, state, district, market } = req.body || {};
  if (!crop || !(+quantityKg > 0) || !(+pricePerKg > 0)) return res.status(400).json({ error: 'invalid_input' });
  const i = db.prepare('insert into listings(farmer_id,crop,quantity_kg,price_per_kg,state,district,market) values(?,?,?,?,?,?,?)')
    .run(req.user.id, String(crop).slice(0, 60), +quantityKg, +pricePerKg, state || null, district || null, market || null);
  res.status(201).json({ id: i.lastInsertRowid });
});

router.delete('/:id', requireUser, (req, res) => {
  const r = db.prepare('delete from listings where id=? and farmer_id=?').run(+req.params.id, req.user.id);
  res.status(r.changes ? 200 : 404).json({ ok: !!r.changes });
});

router.post('/:id/image', requireUser, requireRole('farmer'), upload.single('photo'), (req, res) => {
  const l = db.prepare('select * from listings where id=?').get(+req.params.id);
  if (!l || l.farmer_id !== req.user.id) return res.status(403).json({ error: 'forbidden' });
  if (!req.file) return res.status(400).json({ error: 'no_file' });
  const t = sig(req.file.buffer);
  if (!t) return res.status(415).json({ error: 'unsupported_type' });     // checks real file bytes, not just the filename
  fs.mkdirSync(UP, { recursive: true });
  const name = `${crypto.randomUUID()}.${t[1]}`;
  fs.writeFileSync(path.join(UP, name), req.file.buffer);                  // original, unmodified photo
  const i = db.prepare('insert into listing_images(listing_id,uploader_id,file,mime,size) values(?,?,?,?,?)').run(l.id, req.user.id, name, t[0], req.file.size);
  res.status(201).json({ imageId: i.lastInsertRowid });
});

router.get('/image/:id', (req, res) => {
  const im = db.prepare('select * from listing_images where id=?').get(+req.params.id);
  if (!im) return res.status(404).end();
  res.type(im.mime).sendFile(path.join(UP, im.file));
});

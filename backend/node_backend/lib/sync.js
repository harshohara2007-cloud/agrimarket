import { db } from '../db.js';
const num = v => (v === '' || v == null || isNaN(+v) ? null : +v);
const iso = s => { const [d, m, y] = String(s).split('/'); return `${y}-${m}-${d}`; };
async function page(offset, limit = 500) {
  const url = `https://api.data.gov.in/resource/${process.env.MANDI_RESOURCE_ID}?api-key=${process.env.DATA_GOV_API_KEY}&format=json&limit=${limit}&offset=${offset}`;
  for (let i = 0; i < 3; i++) {
    try { const r = await fetch(url, { signal: AbortSignal.timeout(15000) }); if (r.ok) return r.json(); } catch {}
    await new Promise(r => setTimeout(r, 1000 * 2 ** i));
  }
  throw new Error('upstream_unavailable');
}
export async function syncMandi() {
  if (!process.env.DATA_GOV_API_KEY) return { ok: false, note: 'api_key_missing' };
  const ins = db.prepare('insert or ignore into mandi_prices(state,district,market,commodity,variety,grade,arrival_date,min_price,max_price,modal_price) values(?,?,?,?,?,?,?,?,?,?)');
  let offset = 0, inserted = 0;
  try {
    for (;;) {
      const recs = (await page(offset)).records || [];
      if (!recs.length) break;
      db.transaction(() => { for (const r of recs) {
        if (!r.arrival_date || !r.commodity) continue;
        inserted += ins.run(r.state || '', r.district || '', r.market || '', r.commodity, r.variety || '', r.grade || '', iso(r.arrival_date), num(r.min_price), num(r.max_price), num(r.modal_price)).changes;
      } })();
      offset += recs.length; if (recs.length < 500) break;
    }
    db.prepare('insert into sync_log(inserted,ok) values(?,1)').run(inserted);
    return { ok: true, inserted };
  } catch (e) { db.prepare('insert into sync_log(inserted,ok,note) values(?,0,?)').run(inserted, e.message); return { ok: false, note: e.message }; }
}

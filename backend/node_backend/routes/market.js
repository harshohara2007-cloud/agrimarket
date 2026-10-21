import { Router } from 'express';
import { db } from '../db.js';
import { forecast } from '../lib/forecast.js';
import { advise, TEXT } from '../lib/advice.js';
import { syncMandi } from '../lib/sync.js';

export const router = Router();
const s = v => (typeof v === 'string' ? v.slice(0, 80) : '');

router.get('/prices', (req, res) => {
  const { commodity, state, district, market } = Object.fromEntries(['commodity', 'state', 'district', 'market'].map(k => [k, s(req.query[k])]));
  const limit = Math.min(+req.query.limit || 50, 200), offset = Math.max(+req.query.offset || 0, 0);
  const rows = db.prepare(`select * from mandi_prices where (@commodity='' or commodity=@commodity) and (@state='' or state=@state) and (@district='' or district=@district) and (@market='' or market=@market)
    order by arrival_date desc limit @limit offset @offset`).all({ commodity, state, district, market, limit, offset });
  const last = db.prepare('select max(arrival_date) d from mandi_prices').get().d;
  const sync = db.prepare('select at,ok from sync_log order by id desc limit 1').get();
  res.json({ rows, unit: 'Rs/quintal', source: 'AGMARKNET via data.gov.in', latestRecordDate: last, lastSync: sync || null,
    message: rows.length ? undefined : 'no_data' });   // never invent prices
});
router.get('/filters', (_req, res) => res.json({
  commodities: db.prepare("select distinct commodity v from mandi_prices order by 1").all().map(r => r.v),
  states: db.prepare("select distinct state v from mandi_prices order by 1").all().map(r => r.v) }));

const series = (commodity, market) => db.prepare('select arrival_date date, avg(modal_price) price from mandi_prices where commodity=? and market=? group by arrival_date order by arrival_date').all(commodity, market);

router.get('/forecast', (req, res) => {
  const h = +req.query.horizon || 7;
  res.json({ ...forecast(series(s(req.query.commodity), s(req.query.market)), h), unit: 'Rs/quintal', disclaimer: 'estimate_not_guarantee' });
});

router.post('/advice', (req, res) => {
  const b = req.body || {}, lang = TEXT[b.lang] ? b.lang : 'en';
  const cur = db.prepare('select modal_price p, arrival_date d, state from mandi_prices where commodity=? and market=? and modal_price>0 order by arrival_date desc limit 1').get(s(b.commodity), s(b.market));
  if (!cur) return res.json({ decision: 'INSUFFICIENT_INFO', reason: 'missing_inputs', label: TEXT[lang].INSUFFICIENT_INFO, message: 'No price record for this crop and market.' });
  const horizon = Math.min(Math.max(Math.round(+b.storageDays) || 7, 1), 14);
  const f = forecast(series(s(b.commodity), s(b.market)), horizon);
  const others = db.prepare(`select market, modal_price modal, cast(julianday('now')-julianday(arrival_date) as int) daysOld from mandi_prices
    where commodity=? and state=? and market<>? and modal_price>0 and arrival_date>=date('now','-2 day') order by modal_price desc limit 5`).all(s(b.commodity), cur.state, s(b.market));
  const r = advise({ commodity: b.commodity, current: cur.p, forecast: f, otherMarkets: others, storageDays: +b.storageDays,
    storageCostPerQtl: b.storageCostPerQtl == null ? null : +b.storageCostPerQtl, spoilagePct: b.spoilagePct == null ? null : +b.spoilagePct,
    shelfLifeDays: b.shelfLifeDays == null ? undefined : +b.shelfLifeDays, transportCostPerQtl: +b.transportCostPerQtl || 0 });
  res.json({ ...r, label: TEXT[lang][r.decision], message: TEXT[lang][r.reason], note: TEXT[lang].note,
    assumptions: { currentPricePerQtl: cur.p, priceDate: cur.d, storageDays: horizon, forecastAvailable: !!f.available } });
});

router.post('/sync', async (req, res) => {          // call from a scheduler with header: Authorization: Bearer <CRON_SECRET>
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).end();
  res.json(await syncMandi());
});

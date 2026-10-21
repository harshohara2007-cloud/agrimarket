// Damped-trend Holt model + naive baseline + rolling-origin backtest. Prices: Rs/quintal.
export const MIN_DAYS = () => +process.env.MIN_HISTORY_DAYS || 90;

export function prepare(rows) {           // rows: [{date:'YYYY-MM-DD', price:number}]
  const m = new Map();
  for (const r of rows) if (Number.isFinite(r.price) && r.price > 0) m.set(r.date, r.price);
  const dates = [...m.keys()].sort();
  if (!dates.length) return [];
  let out = [], last = null, gap = 0;
  const d = new Date(dates[0] + 'T00:00:00Z'), end = new Date(dates.at(-1) + 'T00:00:00Z');
  for (; d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const k = d.toISOString().slice(0, 10);
    if (m.has(k)) { last = m.get(k); gap = 0; out.push({ date: k, v: last }); }
    else if (++gap <= 3) out.push({ date: k, v: last });   // fill short gaps only
    else out = [];                                          // long gap: restart on the recent contiguous stretch
  }
  const vals = out.map(o => o.v).sort((a, b) => a - b);
  if (vals.length >= 20) {                                  // winsorise 1%/99%
    const lo = vals[Math.floor(vals.length * 0.01)], hi = vals[Math.ceil(vals.length * 0.99) - 1];
    out = out.map(o => ({ ...o, v: Math.min(hi, Math.max(lo, o.v)) }));
  }
  return out;
}

export function holt(y, h, a = 0.5, b = 0.2, phi = 0.9) {
  let l = y[0], t = y[1] - y[0];
  for (let i = 1; i < y.length; i++) { const pl = l; l = a * y[i] + (1 - a) * (l + phi * t); t = b * (l - pl) + (1 - b) * phi * t; }
  const out = []; let s = 0, p = 1;
  for (let k = 1; k <= h; k++) { p *= phi; s += p; out.push(l + s * t); }
  return out;
}
const mae = (a, b) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0) / a.length;

export function backtest(y, h, folds = 5) {
  let em = 0, eb = 0, n = 0;
  for (let k = folds; k >= 1; k--) {                        // time-ordered: train always precedes test
    const cut = y.length - k * h;
    if (cut < MIN_DAYS() * 0.6 || cut + h > y.length) continue;
    const train = y.slice(0, cut), test = y.slice(cut, cut + h);
    em += mae(test, holt(train, h)); eb += mae(test, Array(h).fill(train.at(-1))); n++;
  }
  return n ? { maeModel: em / n, maeNaive: eb / n, folds: n } : null;
}

export function forecast(rows, h = 7) {
  if (!Number.isInteger(h) || h < 1 || h > 14) return { available: false, reason: 'invalid_horizon' };
  const s = prepare(rows);
  if (s.length < MIN_DAYS()) return { available: false, reason: 'insufficient_history', days: s.length };
  const y = s.map(o => o.v), metrics = backtest(y, h);
  if (!metrics) return { available: false, reason: 'insufficient_history', days: y.length };
  if (metrics.maeModel >= metrics.maeNaive) return { available: false, reason: 'no_better_than_baseline', metrics };
  const pred = holt(y, h), band = metrics.maeModel;
  return { available: true, version: 'holt-damped-v1', lastObserved: s.at(-1).date, current: y.at(-1),
    forecast: pred, low: pred.map(p => p - band), high: pred.map(p => p + band),
    expectedChangePct: ((pred.at(-1) - y.at(-1)) / y.at(-1)) * 100, metrics, horizonDays: h };
}

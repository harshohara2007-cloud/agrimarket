import test from 'node:test';
import assert from 'node:assert/strict';
import { advise } from '../lib/advice.js';
import { forecast, prepare } from '../lib/forecast.js';
process.env.DB_FILE = ':memory:';
const { app } = await import('../app.js');

const days = n => Array.from({ length: n }, (_, i) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10));
const base = { commodity: 'onion', current: 2000, storageDays: 7, storageCostPerQtl: 50, spoilagePct: 3 };

test('forecast: insufficient history is refused', () => {
  const r = forecast(days(30).map(date => ({ date, price: 2000 })), 7);
  assert.equal(r.available, false); assert.equal(r.reason, 'insufficient_history');
});
test('forecast: invalid horizon and empty data', () => {
  assert.equal(forecast([], 7).available, false);
  assert.equal(forecast([], 99).reason, 'invalid_horizon');
});
test('forecast: clear trend beats naive baseline and returns a range', () => {
  const r = forecast(days(200).map((date, i) => ({ date, price: 1000 + i * 5 })), 7);
  assert.equal(r.available, true); assert.equal(r.forecast.length, 7);
  assert.ok(r.low[0] < r.forecast[0] && r.high[0] > r.forecast[0]);
});
test('prepare: drops duplicates/invalid prices', () => {
  assert.equal(prepare([{ date: '2026-01-01', price: -5 }, { date: '2026-01-02', price: NaN }]).length, 0);
});
test('advice: missing inputs never guessed', () => assert.equal(advise({ commodity: 'onion' }).decision, 'INSUFFICIENT_INFO'));
test('advice: perishable beyond shelf life -> sell now', () => assert.equal(advise({ ...base, commodity: 'tomato', storageDays: 20 }).reason, 'exceeds_shelf_life'));
test('advice: no reliable forecast -> sell now, not store', () => assert.equal(advise({ ...base, forecast: { available: false } }).decision, 'SELL_NOW'));
test('advice: store only when gain beats costs', () => {
  assert.equal(advise({ ...base, forecast: { available: true, forecast: [2400] } }).decision, 'STORE_SHORT_TERM');
  assert.equal(advise({ ...base, forecast: { available: true, forecast: [2050] } }).decision, 'SELL_NOW');
});
test('advice: better recent mandi -> check another', () =>
  assert.equal(advise({ ...base, otherMarkets: [{ market: 'X', modal: 2400, daysOld: 1 }], forecast: { available: false } }).decision, 'CHECK_ANOTHER_MANDI'));

test('api: OTP honestly refuses when SMS not configured', async () => {
  delete process.env.MSG91_AUTHKEY;
  const srv = app.listen(0); test.after?.(() => {}); const url = `http://localhost:${srv.address().port}`;
  const r = await fetch(`${url}/api/auth/send-otp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"phone":"+919876543210"}' });
  assert.equal(r.status, 503); assert.equal((await r.json()).error, 'sms_not_configured');
  const p = await fetch(`${url}/api/market/prices?commodity=Onion`); const pj = await p.json();
  assert.equal(pj.rows.length, 0); assert.equal(pj.message, 'no_data');
  assert.equal((await fetch(`${url}/api/listings`, { method: 'POST' })).status, 401);
  assert.equal((await (await fetch(`${url}/api/pay/status`)).json()).paymentsEnabled, false);
  srv.closeAllConnections?.(); srv.close();
});

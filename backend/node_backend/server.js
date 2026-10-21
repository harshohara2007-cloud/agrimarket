import { app } from './app.js';
import { syncMandi } from './lib/sync.js';
const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`KrishiMarket API running at http://localhost:${port}`));
if (process.env.DATA_GOV_API_KEY) { syncMandi(); setInterval(syncMandi, 24 * 3600 * 1000); }
else console.log('DATA_GOV_API_KEY missing: mandi sync disabled (prices will show as unavailable).');

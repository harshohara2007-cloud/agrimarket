// Sell / Store / Check another mandi. All prices Rs/quintal (100 kg), as supplied by AGMARKNET.
const SHELF = { tomato: 5, onion: 60, potato: 90, wheat: 180, rice: 180, maize: 120 }; // approx safe storage days
export function advise(i) {
  const need = ['current', 'storageDays', 'storageCostPerQtl', 'spoilagePct'];
  if (need.some(k => i[k] == null || !Number.isFinite(+i[k]))) return { decision: 'INSUFFICIENT_INFO', reason: 'missing_inputs' };
  const shelf = i.shelfLifeDays ?? SHELF[String(i.commodity || '').toLowerCase()];
  if (shelf == null) return { decision: 'INSUFFICIENT_INFO', reason: 'missing_shelf_life' };
  if (i.storageDays > shelf) return { decision: 'SELL_NOW', reason: 'exceeds_shelf_life' };

  const better = (i.otherMarkets || []).filter(m => m.daysOld <= 2 && m.modal > 0)
    .map(m => ({ ...m, net: m.modal - (m.transportCostPerQtl ?? i.transportCostPerQtl ?? 0) }))
    .sort((a, b) => b.net - a.net)[0];
  const f = i.forecast?.available ? i.forecast.forecast.at(-1) : null;
  const storeNet = f == null ? null : f * (1 - i.spoilagePct / 100) - i.storageCostPerQtl;

  if (better && better.net > i.current * 1.05 && (storeNet == null || better.net >= storeNet))
    return { decision: 'CHECK_ANOTHER_MANDI', reason: 'better_nearby', market: better.market, netPerQtl: better.net };
  if (storeNet == null) return { decision: 'SELL_NOW', reason: 'no_reliable_forecast' };
  if (storeNet > i.current * 1.05) return { decision: 'STORE_SHORT_TERM', reason: 'gain_exceeds_costs', gainPerQtl: storeNet - i.current };
  return { decision: 'SELL_NOW', reason: 'storage_not_worth_it', gainPerQtl: storeNet - i.current };
}
export const TEXT = {
  en: { SELL_NOW: 'Sell now', STORE_SHORT_TERM: 'Store for a short time', CHECK_ANOTHER_MANDI: 'Check another mandi', INSUFFICIENT_INFO: 'More information needed',
    exceeds_shelf_life: 'This crop would spoil before your storage period ends.', better_nearby: 'A nearby market has a recently reported better price after transport.',
    gain_exceeds_costs: 'The expected price rise is larger than storage cost and spoilage.', storage_not_worth_it: 'Expected price rise does not cover storage cost and spoilage.',
    no_reliable_forecast: 'There is not enough price history for a trustworthy forecast, so storing is a risk.', missing_inputs: 'Please enter storage days, storage cost and expected spoilage.',
    missing_shelf_life: 'Please enter how many days this crop can be stored.', note: 'Estimates only. Not a guaranteed price.' },
  hi: { SELL_NOW: 'अभी बेचें', STORE_SHORT_TERM: 'कुछ समय के लिए भंडारण करें', CHECK_ANOTHER_MANDI: 'दूसरी मंडी देखें', INSUFFICIENT_INFO: 'और जानकारी चाहिए',
    exceeds_shelf_life: 'आपकी भंडारण अवधि पूरी होने से पहले फसल खराब हो जाएगी।', better_nearby: 'पास की मंडी में परिवहन के बाद हाल का बेहतर भाव है।',
    gain_exceeds_costs: 'अनुमानित भाव वृद्धि भंडारण खर्च और नुकसान से अधिक है।', storage_not_worth_it: 'अनुमानित भाव वृद्धि भंडारण खर्च और नुकसान को पूरा नहीं करती।',
    no_reliable_forecast: 'भरोसेमंद अनुमान के लिए पर्याप्त भाव-इतिहास नहीं है, इसलिए भंडारण जोखिम भरा है।', missing_inputs: 'कृपया भंडारण दिन, खर्च और अनुमानित नुकसान भरें।',
    missing_shelf_life: 'कृपया बताएं कि फसल कितने दिन रखी जा सकती है।', note: 'यह केवल अनुमान है, गारंटीशुदा भाव नहीं।' },
  mr: { SELL_NOW: 'आत्ता विका', STORE_SHORT_TERM: 'थोड्या काळासाठी साठवा', CHECK_ANOTHER_MANDI: 'दुसरी मंडी तपासा', INSUFFICIENT_INFO: 'अधिक माहिती हवी',
    exceeds_shelf_life: 'तुमचा साठवण कालावधी संपण्यापूर्वी पीक खराब होईल.', better_nearby: 'जवळच्या बाजारात वाहतुकीनंतर अलीकडील चांगला भाव आहे.',
    gain_exceeds_costs: 'अपेक्षित भाववाढ साठवण खर्च व नुकसानीपेक्षा जास्त आहे.', storage_not_worth_it: 'अपेक्षित भाववाढ साठवण खर्च व नुकसान भरून काढत नाही.',
    no_reliable_forecast: 'विश्वासार्ह अंदाजासाठी पुरेसा भाव-इतिहास नाही, म्हणून साठवण धोकादायक आहे.', missing_inputs: 'कृपया साठवण दिवस, खर्च आणि अपेक्षित नुकसान भरा.',
    missing_shelf_life: 'हे पीक किती दिवस साठवता येते ते सांगा.', note: 'हा फक्त अंदाज आहे, हमी भाव नाही.' } };

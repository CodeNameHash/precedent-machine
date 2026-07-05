function detectDoubleDummyEquity(section) {
  const title = String(section && (section.title || section.heading || '') || '');
  const text = String(section && section.text || '');
  if (!/(?:equity\s+compensation\s+awards?|equity\s+awards?|(?:company\s+)?(?:stock\s+options?|restricted\s+stock|restricted\s+stock\s+units?|performance\s+(?:stock\s+)?units?|rsus?|psus?)|treatment\s+of\s+(?:company\s+)?(?:stock\s+options?|restricted\s+stock|performance\s+(?:stock\s+)?units?|rsus?|psus?))/i.test(title)) {
    return false;
  }
  const haystack = `${title}\n${text}`;
  if (!/equity\s+awards?|stock\s+options?|restricted\s+stock|performance\s+(?:stock\s+)?units?|rsus?|psus?/i.test(haystack)) {
    return false;
  }
  const buyerSignals = /(Parent|Buyer|Acquiror|New\s+Parent|Merger\s+Sub)\s+(?:(?:Restricted\s+)?Stock|Common\s+Stock|RSU|PSU|Option|Equity|Performance\s+(?:Stock\s+)?Unit)/i;
  const targetSignals = /(Company|Target)\s+(?:(?:Restricted\s+)?Stock|Common\s+Stock|RSU|PSU|Option|Equity|Performance\s+(?:Stock\s+)?Unit)/i;
  const conversionSignals = /convert(?:ed)?\s+into|assum(?:e|ed)|substitut(?:e|ed)|replacement\s+award|adjust(?:ed)?\s+(?:option|award|unit)/i;
  return buyerSignals.test(haystack) && targetSignals.test(haystack) && conversionSignals.test(haystack);
}

module.exports = {
  detectDoubleDummyEquity,
};

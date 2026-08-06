const crypto = require('crypto');
const { setTimeout: sleepDefault } = require('node:timers/promises');
const { decodeNumericEntities } = require('./html-entities');
const {
  AGREEMENT_REVISION,
  classifyAgreementRevision,
  exhibitTitleText,
} = require('./agreement-revision-classifier');

const SEC_BASE_URL = 'https://www.sec.gov';
const EDGAR_SEARCH_URL = 'https://efts.sec.gov/LATEST/search-index';
const SEC_USER_AGENT =
  process.env.SEC_USER_AGENT ||
  'Precedent Machine bengoodchild@gmail.com';

const DEFAULT_SEARCH_QUERY =
  '"agreement and plan of merger" OR "merger agreement" OR "transaction agreement" OR "acquisition agreement"';
const DEFAULT_DAYS = 7;
const DEFAULT_PAGE_SIZE = 100;
const MIN_AGREEMENT_TEXT_LENGTH = 1000;

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function dateRangeFromOptions({ since, until, days = DEFAULT_DAYS, now = new Date() } = {}) {
  const end = until || isoDate(now);
  if (since) return { since, until: end };
  const start = isoDate(addDays(new Date(`${end}T00:00:00Z`), -Math.max(0, Number(days) || DEFAULT_DAYS)));
  return { since: start, until: end };
}

function secHeaders(extra = {}) {
  return {
    'User-Agent': SEC_USER_AGENT,
    Accept: '*/*',
    'Accept-Encoding': 'identity',
    ...extra,
  };
}

async function fetchWithRetry(url, {
  fetchImpl = globalThis.fetch,
  retries = 4,
  baseDelayMs = 1000,
  sleep = sleepDefault,
  headers = {},
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('No fetch implementation available');
  }

  let attempt = 0;
  let lastError = null;

  while (attempt <= retries) {
    try {
      const response = await fetchImpl(url, { headers: secHeaders(headers) });
      if (!RETRYABLE_STATUS_CODES.has(response.status)) {
        if (!response.ok) {
          const err = new Error(`HTTP ${response.status} fetching ${url}`);
          err.nonRetryable = true;
          throw err;
        }
        return response;
      }

      if (attempt >= retries) {
        throw new Error(`HTTP ${response.status} fetching ${url} after ${attempt + 1} attempts`);
      }

      const retryAfter = response.headers?.get?.('retry-after');
      const retryAfterMs = retryAfter && /^\d+$/.test(retryAfter)
        ? Number(retryAfter) * 1000
        : null;
      const waitMs = retryAfterMs || baseDelayMs * (2 ** attempt);
      await sleep(waitMs);
    } catch (err) {
      lastError = err;
      if (err.nonRetryable) break;
      if (attempt >= retries) break;
      await sleep(baseDelayMs * (2 ** attempt));
    }
    attempt += 1;
  }

  throw lastError || new Error(`Fetch failed for ${url}`);
}

async function fetchText(url, options = {}) {
  const response = await fetchWithRetry(url, options);
  return response.text();
}

async function fetchJson(url, options = {}) {
  const response = await fetchWithRetry(url, {
    ...options,
    headers: { Accept: 'application/json', ...(options.headers || {}) },
  });
  return response.json();
}

function buildSearchUrl({ since, until, from = 0, size = DEFAULT_PAGE_SIZE, query = DEFAULT_SEARCH_QUERY } = {}) {
  const url = new URL(EDGAR_SEARCH_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('dateRange', 'custom');
  url.searchParams.set('startdt', since);
  url.searchParams.set('enddt', until);
  url.searchParams.set('forms', '8-K');
  url.searchParams.set('from', String(from));
  url.searchParams.set('size', String(size));
  return url.toString();
}

function cleanCik(cik) {
  const raw = String(cik || '').replace(/\D/g, '');
  return raw ? raw.padStart(10, '0') : '';
}

function cikPath(cik) {
  const stripped = cleanCik(cik).replace(/^0+/, '');
  return stripped || cleanCik(cik);
}

function filingDirectoryUrl(cik, accession) {
  return `${SEC_BASE_URL}/Archives/edgar/data/${cikPath(cik)}/${String(accession || '').replace(/-/g, '')}`;
}

function filingDetailUrl(cik, accession) {
  return `${filingDirectoryUrl(cik, accession)}/${accession}-index.html`;
}

function documentUrlFromHref(href) {
  if (!href) return null;
  if (/^https?:\/\//i.test(href)) return href;
  const ixDoc = href.match(/[?&]doc=([^&]+)/i);
  if (ixDoc) return new URL(decodeURIComponent(ixDoc[1]), SEC_BASE_URL).toString();
  return new URL(href, SEC_BASE_URL).toString();
}

function stripTags(html) {
  return decodeNumericEntities(String(html || ''))
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/td>/gi, '\t')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&rsquo;/gi, "'")
    .replace(/&lsquo;/gi, "'")
    .replace(/&ldquo;/gi, '"')
    .replace(/&rdquo;/gi, '"')
    .replace(/&mdash;/gi, ' - ')
    .replace(/&ndash;/gi, ' - ')
    .replace(/<[^>]+>/g, '')
    .replace(/\t+/g, ' ')
    .replace(/[ \u00a0]+/g, ' ')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeAgreementText(text) {
  return stripTags(text)
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

function displayNameFromSource(source = {}) {
  const display = Array.isArray(source.display_names) ? source.display_names[0] : source.display_names;
  if (!display) return null;
  return String(display)
    .replace(/\s+\([A-Z]{1,6}\)\s+\(CIK\s+\d+\)\s*$/i, '')
    .replace(/\s+\(CIK\s+\d+\)\s*$/i, '')
    .trim();
}

function parseSearchHits(json) {
  const hits = json?.hits?.hits;
  if (!Array.isArray(hits)) return [];

  return hits.map((hit) => {
    const source = hit?._source || {};
    const idParts = String(hit?._id || '').split(':');
    const accession = source.adsh || idParts[0] || null;
    const primaryDocument = idParts.slice(1).join(':') || null;
    const cik = cleanCik(Array.isArray(source.ciks) ? source.ciks[0] : source.cik);

    return {
      cik,
      filing_accession: accession,
      filing_date: source.file_date || source.filing_date || null,
      form_type: source.form || source.file_type || '8-K',
      filed_by_party: displayNameFromSource(source),
      primary_document: primaryDocument,
      items: Array.isArray(source.items) ? source.items : [],
      raw: hit,
    };
  }).filter((hit) => hit.cik && hit.filing_accession);
}

function totalSearchHits(json) {
  const total = json?.hits?.total;
  if (typeof total === 'number') return total;
  if (total && typeof total.value === 'number') return total.value;
  return null;
}

async function fetchSearchHits(options = {}) {
  const { since, until } = dateRangeFromOptions(options);
  const limit = options.limit ? Number(options.limit) : null;
  const size = options.pageSize || DEFAULT_PAGE_SIZE;
  let from = Number(options.from || 0);
  const hits = [];

  while (!limit || hits.length < limit) {
    const url = buildSearchUrl({ since, until, from, size, query: options.query });
    const json = await fetchJson(url, options);
    const pageHits = parseSearchHits(json);
    if (pageHits.length === 0) break;

    for (const hit of pageHits) {
      hits.push(hit);
      if (limit && hits.length >= limit) break;
    }

    const total = totalSearchHits(json);
    from += pageHits.length;
    if (total != null && from >= total) break;
    if (pageHits.length < size) break;
  }

  return hits;
}

function extractCells(rowHtml) {
  return [...String(rowHtml || '').matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
    .map((match) => match[1]);
}

function parseFilingDetailRows(html) {
  const rows = [];
  for (const match of String(html || '').matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = extractCells(match[1]);
    if (cells.length < 4) continue;
    const link = cells[2].match(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!link) continue;

    const href = link[1];
    const document = stripTags(link[2]);
    rows.push({
      sequence: stripTags(cells[0]),
      description: stripTags(cells[1]),
      document,
      type: stripTags(cells[3]),
      size: cells[4] ? stripTags(cells[4]) : '',
      href,
      url: documentUrlFromHref(href),
    });
  }
  return rows;
}

function isDocumentLike(row) {
  const name = String(row?.document || row?.url || '').toLowerCase();
  if (!/\.(htm|html|txt)$/i.test(name)) return false;
  return !/(?:graphic|\.jpg|\.jpeg|\.png|\.gif|\.xml|\.xsd|\.zip|index)/i.test(name);
}

function exhibitScore(row) {
  if (!isDocumentLike(row)) return -Infinity;
  const type = String(row.type || '');
  const description = String(row.description || '');
  const document = String(row.document || '');
  const haystack = `${type} ${description} ${document}`;

  let score = 0;
  if (/\bEX[-\s]?2(?:\.0?1|\b|\()/i.test(type)) score += 100;
  if (/\bex(?:hibit)?[-_\s]?2(?:d|\.|-|_)?0?1\b/i.test(document)) score += 85;
  if (/\bexhibit\s+2(?:\.0?1)?\b/i.test(description)) score += 60;
  if (/\bagreement\s+and\s+plan\s+of\s+merger\b/i.test(haystack)) score += 80;
  if (/\bmerger\s+agreement\b/i.test(haystack)) score += 70;
  if (/\b(transaction|acquisition|business\s+combination)\s+agreement\b/i.test(haystack)) score += 45;
  if (/\b8-K\b/i.test(type)) score -= 50;
  if (/\b(press\s+release|presentation|graphic|xbrl|schema|taxonomy)\b/i.test(haystack)) score -= 75;
  return score;
}

function rankAgreementExhibits(rows) {
  return (rows || [])
    .map((row) => ({ row, score: exhibitScore(row) }))
    .filter((entry) => entry.score >= 60)
    .sort((a, b) => b.score - a.score);
}

// Picks the exhibit that is the merger agreement, and says what it picked.
// The score alone cannot tell an original from a restatement or an amendment:
// "AMENDMENT NO. 1 TO AGREEMENT AND PLAN OF MERGER" scores exactly as an
// original does, because it contains the original's name. So each ranked
// exhibit is classified before it is eligible to win.
//
// Ambiguity is reported, never resolved. If the top-ranked exhibit cannot be
// placed, falling through to the next one would be a guess dressed up as a
// ranking, so the selection stops and hands the filing to a human.
function selectAgreementExhibit(rows) {
  const ranked = rankAgreementExhibits(rows);
  const excluded = [];

  for (const entry of ranked) {
    // Title-only at this point: the document text has not been fetched yet.
    const classification = classifyAgreementRevision({ title: exhibitTitleText(entry.row) });

    if (classification.revision === AGREEMENT_REVISION.AMBIGUOUS) {
      return {
        exhibit: null,
        review_exhibit: entry.row,
        revision: classification.revision,
        needs_human_review: true,
        needs_text_confirmation: classification.needs_text_confirmation,
        reason: classification.reason,
        excluded,
      };
    }

    if (classification.revision === AGREEMENT_REVISION.AMENDMENT) {
      excluded.push({
        row: entry.row,
        revision: classification.revision,
        reason: classification.reason,
      });
      continue;
    }

    return {
      exhibit: entry.row,
      review_exhibit: null,
      revision: classification.revision,
      needs_human_review: false,
      needs_text_confirmation: classification.needs_text_confirmation,
      reason: classification.reason,
      excluded,
    };
  }

  if (excluded.length > 0) {
    // Every exhibit that looked like a merger agreement was an amendment.
    return {
      exhibit: null,
      review_exhibit: excluded[0].row,
      revision: AGREEMENT_REVISION.AMENDMENT,
      needs_human_review: true,
      needs_text_confirmation: true,
      reason: excluded[0].reason,
      excluded,
    };
  }

  return {
    exhibit: null,
    review_exhibit: null,
    revision: null,
    needs_human_review: false,
    needs_text_confirmation: false,
    reason: null,
    excluded,
  };
}

function chooseAgreementExhibit(rows) {
  return selectAgreementExhibit(rows).exhibit;
}

function choosePrimaryFiling(rows, primaryDocument) {
  const cleanPrimary = String(primaryDocument || '').split('/').pop();
  return (rows || []).find((row) => cleanPrimary && row.document === cleanPrimary)
    || (rows || []).find((row) => /\b8-K\b/i.test(row.type))
    || null;
}

function extractItem101Text(filingText) {
  const text = stripTags(filingText);
  const startMatch = text.match(/item\s+1\.01\.?\s+entry\s+into\s+a\s+material\s+definitive\s+agreement/i)
    || text.match(/item\s+1\.01\b/i);
  if (!startMatch) return '';

  const start = startMatch.index || 0;
  const tail = text.slice(start);
  const next = tail.slice(20).search(/\n\s*item\s+(?:1\.02|2\.01|2\.02|2\.03|3\.0\d|5\.0\d|7\.01|8\.01|9\.01)\b/i);
  if (next >= 0) return tail.slice(0, next + 20).trim();
  return tail.slice(0, 12000).trim();
}

function parseMoney(text) {
  const match = String(text || '').match(/\b(?:transaction|enterprise|equity|deal|aggregate)\s+value(?:d)?(?:\s+of|\s+at|:)?\s+(?:approximately\s+)?\$([0-9][0-9,]*(?:\.[0-9]+)?)\s*(billion|million)\b/i)
    || String(text || '').match(/\bvalued\s+at\s+(?:approximately\s+)?\$([0-9][0-9,]*(?:\.[0-9]+)?)\s*(billion|million)\b/i);
  if (!match) return null;
  const amount = Number(match[1].replace(/,/g, ''));
  if (!Number.isFinite(amount)) return null;
  const multiplier = /billion/i.test(match[2]) ? 1000000000 : 1000000;
  return Math.round(amount * multiplier);
}

function parseMonthDate(text) {
  const match = String(text || '').match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+([0-3]?\d),\s+(20\d{2}|19\d{2})\b/i);
  if (!match) return null;
  const date = new Date(`${match[1]} ${match[2]}, ${match[3]} UTC`);
  if (Number.isNaN(date.getTime())) return null;
  return isoDate(date);
}

function cleanPartyName(value) {
  if (!value) return null;
  return String(value)
    .replace(/\s+/g, ' ')
    .replace(/^\s*(?:and|by and among)\s+/i, '')
    .replace(/[,.;:]+$/g, '')
    .trim() || null;
}

function extractPartiesByDefinedRole(text) {
  const head = String(text || '').slice(0, 15000);
  const out = { acquirer_name: null, target_name: null };
  const roleRe = /([A-Z][A-Za-z0-9&.,'\-\s]{2,180}?)\s*\(\s*["']?(Parent|Buyer|Purchaser|Acquiror|Merger Sub|Company|Target)["']?\s*\)/gi;
  for (const match of head.matchAll(roleRe)) {
    const name = cleanPartyName(match[1]);
    const role = match[2].toLowerCase();
    if (!name) continue;
    if (!out.target_name && /company|target/.test(role)) out.target_name = name;
    if (!out.acquirer_name && /parent|buyer|purchaser|acquiror/.test(role)) out.acquirer_name = name;
  }
  return out;
}

function extractHeuristicMetadata({ item101Text = '', agreementText = '', fallbackFiledBy = null } = {}) {
  const combined = `${item101Text}\n\n${agreementText.slice(0, 20000)}`;
  const parties = extractPartiesByDefinedRole(combined);
  return {
    filed_by_party: fallbackFiledBy || null,
    target_name: parties.target_name,
    acquirer_name: parties.acquirer_name,
    deal_value_usd: parseMoney(item101Text) || parseMoney(combined),
    announced_at: parseMonthDate(item101Text) || parseMonthDate(combined),
  };
}

// The note a human reads on /admin/candidates. It has to say what the document
// is and why nothing was ingested from it.
function revisionReviewNote(classification) {
  if (classification.revision === AGREEMENT_REVISION.AMENDMENT) {
    return `Held for review: ${classification.reason} Amendment parsing is not built, so the change it makes cannot be applied automatically.`;
  }
  return `Held for review: ${classification.reason}`;
}

function restatementNote(classification) {
  return `${classification.reason} Terms extracted from it describe the restatement, not the agreement it replaced.`;
}

async function processFilingHit(hit, options = {}) {
  const detailUrl = filingDetailUrl(hit.cik, hit.filing_accession);
  const detailHtml = await fetchText(detailUrl, options);
  const rows = parseFilingDetailRows(detailHtml);
  const selection = selectAgreementExhibit(rows);
  // An exhibit held back for review is still fetched: the filing has to leave a
  // durable, de-duplicated record a human can act on, not vanish.
  const exhibit = selection.exhibit || selection.review_exhibit;
  if (!exhibit) {
    return {
      kind: 'skipped',
      reason: 'no merger agreement exhibit found',
      hit,
      filing_detail_url: detailUrl,
    };
  }

  const primary = choosePrimaryFiling(rows, hit.primary_document);
  let item101Text = '';
  if (primary?.url) {
    try {
      item101Text = extractItem101Text(await fetchText(primary.url, options));
    } catch (err) {
      item101Text = '';
    }
  }

  const agreementRaw = await fetchText(exhibit.url, options);
  const agreementText = normalizeAgreementText(agreementRaw);

  // Second pass, now with the document itself. The title alone cannot catch an
  // amendment filed under a bare "EX-2.1" descriptor.
  const classification = classifyAgreementRevision({
    title: exhibitTitleText(exhibit),
    text: agreementText,
  });

  const excludedExhibits = selection.excluded.map((entry) => ({
    url: entry.row.url,
    description: entry.row.description,
    type: entry.row.type,
    revision: entry.revision,
    reason: entry.reason,
  }));

  if (classification.needs_human_review) {
    const metadata = extractHeuristicMetadata({
      item101Text,
      agreementText,
      fallbackFiledBy: hit.filed_by_party,
    });

    return {
      kind: 'review',
      agreement_revision: classification.revision,
      classification,
      reason: classification.reason,
      candidate: {
        cik: hit.cik,
        filing_accession: hit.filing_accession,
        filing_date: hit.filing_date,
        form_type: hit.form_type || '8-K',
        filed_by_party: metadata.filed_by_party,
        target_name: metadata.target_name,
        acquirer_name: metadata.acquirer_name,
        deal_value_usd: metadata.deal_value_usd,
        announced_at: metadata.announced_at,
        agreement_exhibit_url: exhibit.url,
        agreement_text_hash: sha256(agreementText),
        status: 'needs_review',
        review_notes: revisionReviewNote(classification),
      },
      exhibit,
      excluded_exhibits: excludedExhibits,
      filing_detail_url: detailUrl,
    };
  }

  if (agreementText.length < MIN_AGREEMENT_TEXT_LENGTH) {
    throw new Error(`agreement exhibit text too short (${agreementText.length} chars)`);
  }

  const metadata = extractHeuristicMetadata({
    item101Text,
    agreementText,
    fallbackFiledBy: hit.filed_by_party,
  });

  const notes = [];
  if (classification.revision === AGREEMENT_REVISION.AMENDED_AND_RESTATED) {
    notes.push(restatementNote(classification));
  }
  if (excludedExhibits.length > 0) {
    // The agreement was chosen correctly, but the same filing carried an
    // amendment to a merger agreement. Saying so beats letting the reader
    // assume the ingested terms are the current ones.
    const plural = excludedExhibits.length === 1;
    notes.push(`The same filing also contains ${plural ? 'an amendment' : `${excludedExhibits.length} amendments`} that ${plural ? 'was' : 'were'} not ingested: ${excludedExhibits.map((entry) => entry.description || entry.type).join('; ')}.`);
  }
  const reviewNotes = notes.join(' ') || null;

  return {
    kind: 'candidate',
    agreement_revision: classification.revision,
    classification,
    candidate: {
      cik: hit.cik,
      filing_accession: hit.filing_accession,
      filing_date: hit.filing_date,
      form_type: hit.form_type || '8-K',
      filed_by_party: metadata.filed_by_party,
      target_name: metadata.target_name,
      acquirer_name: metadata.acquirer_name,
      deal_value_usd: metadata.deal_value_usd,
      announced_at: metadata.announced_at,
      agreement_exhibit_url: exhibit.url,
      agreement_text_hash: sha256(agreementText),
      status: 'pending',
      // An ordinary original has nothing to say, so its payload is unchanged.
      ...(reviewNotes ? { review_notes: reviewNotes } : {}),
    },
    exhibit,
    excluded_exhibits: excludedExhibits,
    filing_detail_url: detailUrl,
  };
}

function candidatePayload(candidate) {
  return {
    cik: candidate.cik,
    filing_accession: candidate.filing_accession,
    filing_date: candidate.filing_date,
    form_type: candidate.form_type,
    filed_by_party: candidate.filed_by_party || null,
    target_name: candidate.target_name || null,
    acquirer_name: candidate.acquirer_name || null,
    deal_value_usd: candidate.deal_value_usd || null,
    announced_at: candidate.announced_at || null,
    agreement_exhibit_url: candidate.agreement_exhibit_url,
    agreement_text_hash: candidate.agreement_text_hash,
    status: candidate.status || 'pending',
    // Only sent when there is something to say, so an ordinary original writes
    // exactly the columns it wrote before.
    ...(candidate.review_notes ? { review_notes: candidate.review_notes } : {}),
  };
}

async function storeCandidate(sb, candidate) {
  if (!sb) throw new Error('Supabase client is required to store candidates');

  const hash = candidate.agreement_text_hash;
  const existing = await sb
    .from('deal_candidates')
    .select('id,status,ingested_deal_id')
    .eq('agreement_text_hash', hash)
    .maybeSingle();

  if (existing.error && existing.error.code !== 'PGRST116') {
    throw new Error(existing.error.message || 'Failed to check duplicate candidate');
  }
  if (existing.data) {
    return { action: 'duplicate', candidate: existing.data };
  }

  const inserted = await sb
    .from('deal_candidates')
    .insert(candidatePayload(candidate))
    .select('id,status')
    .single();

  if (inserted.error) {
    if (inserted.error.code === '23505') {
      return { action: 'duplicate', candidate: null };
    }
    throw new Error(inserted.error.message || 'Failed to insert candidate');
  }

  return { action: 'inserted', candidate: inserted.data };
}

async function discoverEdgarCandidates(options = {}) {
  const hits = await fetchSearchHits(options);
  const summary = {
    scanned: hits.length,
    candidates: 0,
    inserted: 0,
    duplicates: 0,
    skipped: 0,
    // Subsets of `candidates`: rows recorded but withheld from ingest, and
    // rows that are restatements rather than original agreements.
    needs_review: 0,
    restatements: 0,
    errors: [],
    results: [],
  };

  for (const hit of hits) {
    try {
      const processed = await processFilingHit(hit, options);
      if (processed.kind === 'skipped') {
        summary.skipped += 1;
        summary.results.push(processed);
        continue;
      }

      summary.candidates += 1;
      if (processed.kind === 'review') summary.needs_review += 1;
      if (processed.agreement_revision === AGREEMENT_REVISION.AMENDED_AND_RESTATED) {
        summary.restatements += 1;
      }
      if (options.dryRun) {
        summary.results.push({ ...processed, store: { action: 'dry-run' } });
        continue;
      }

      const store = await storeCandidate(options.supabase || options.sb, processed.candidate);
      if (store.action === 'inserted') summary.inserted += 1;
      if (store.action === 'duplicate') summary.duplicates += 1;
      summary.results.push({ ...processed, store });
    } catch (err) {
      summary.errors.push({
        cik: hit.cik,
        filing_accession: hit.filing_accession,
        message: err.message,
      });
    }
  }

  return summary;
}

module.exports = {
  AGREEMENT_REVISION,
  DEFAULT_DAYS,
  DEFAULT_SEARCH_QUERY,
  EDGAR_SEARCH_URL,
  MIN_AGREEMENT_TEXT_LENGTH,
  SEC_BASE_URL,
  buildSearchUrl,
  candidatePayload,
  chooseAgreementExhibit,
  selectAgreementExhibit,
  choosePrimaryFiling,
  dateRangeFromOptions,
  discoverEdgarCandidates,
  documentUrlFromHref,
  exhibitScore,
  extractHeuristicMetadata,
  extractItem101Text,
  fetchJson,
  fetchSearchHits,
  fetchText,
  fetchWithRetry,
  filingDetailUrl,
  filingDirectoryUrl,
  normalizeAgreementText,
  parseFilingDetailRows,
  parseSearchHits,
  sha256,
  storeCandidate,
  stripTags,
  processFilingHit,
};

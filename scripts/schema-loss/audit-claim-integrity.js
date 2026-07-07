const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const NORMALIZED_FILE = 'docs/schema-shape/normalized-v1.json';
const WARNINGS_FILE = 'docs/schema-shape/claim-integrity-warnings.jsonl';
const MAX_WARNINGS = 200;

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function writeJsonl(file, rows) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, rows.map((row) => stableStringify(row)).join('\n') + (rows.length ? '\n' : ''));
}

function hashClaim(claim) {
  return crypto.createHash('sha256')
    .update([
      claim.id || '',
      claim.deal_id || '',
      claim.field_key || '',
      claim.raw_value || '',
      claim.source_provision_id || '',
      claim.evidence_quote || '',
    ].join('|'))
    .digest('hex')
    .slice(0, 16);
}

function words(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 4);
}

function includesAny(haystack, needles) {
  const text = String(haystack || '').toLowerCase();
  return needles.some((needle) => text.includes(String(needle).toLowerCase()));
}

function sectionMatches(actual, expected = []) {
  const section = String(actual || '').toLowerCase();
  return expected.some((entry) => section.includes(String(entry).toLowerCase()));
}

function detectSubject(text) {
  const quote = String(text || '').toLowerCase();
  const company = /\b(company|target|seller)\b/.test(quote);
  const parent = /\b(parent|buyer|purchaser|acquiror|acquirer|merger sub)\b/.test(quote);
  if (company && parent) return 'Both';
  if (company) return 'Company';
  if (parent) return 'Parent';
  return null;
}

function expectedSections(attribute = {}) {
  return attribute.expected_sections
    || attribute.structural_patterns?.expected_sections
    || attribute.provenance?.expectedSections
    || [];
}

function expectedContextTerms(attribute = {}) {
  return attribute.expected_context_terms
    || attribute.structural_patterns?.expected_context_terms
    || words(attribute.displayName || attribute.key || attribute.field_key).slice(0, 6);
}

function canonicalMarkers(claim, context = {}) {
  const explicit = context.canonicalMarkers || [];
  if (explicit.length) return explicit;
  return words(claim.canonicalKey || claim.raw_value).slice(0, 5);
}

function runIntegrityChecksForClaim(claim, context = {}) {
  const quote = String(claim.evidence_quote || '');
  const provision = context.provision || null;
  const attribute = context.attribute || {};
  const checks_failed = [];
  const check_details = {};

  if (provision && !String(provision.text || '').includes(quote)) {
    checks_failed.push('B1');
    check_details.B1 = {
      reason: 'Excerpt not found in Provision text.',
      source_provision_id: claim.source_provision_id || null,
    };
  }

  const sections = expectedSections(attribute);
  if (provision && sections.length && !sectionMatches(provision.section_anchor, sections)) {
    checks_failed.push('B2');
    check_details.B2 = {
      actual_section: provision.section_anchor || null,
      expected_sections: sections,
    };
  }

  const markers = canonicalMarkers(claim, context);
  if (claim.canonicalKey && markers.length && quote && !includesAny(quote, markers)) {
    checks_failed.push('B3');
    check_details.B3 = {
      canonicalKey: claim.canonicalKey || null,
      raw_value: claim.raw_value || null,
      expected_markers: markers,
    };
  }

  if (attribute.party_scope) {
    const detected = detectSubject(quote);
    const expected = String(attribute.party_scope);
    if (detected && expected && detected !== expected && expected !== 'Both') {
      checks_failed.push('B4');
      check_details.B4 = {
        detected_subject: detected,
        expected_party_scope: expected,
      };
    }
  }

  const contextTerms = context.expectedContextTerms || attribute.structural_patterns?.expected_context_terms || [];
  const contextText = [provision?.section_anchor, provision?.heading, quote].filter(Boolean).join(' ');
  if (contextTerms.length && !includesAny(contextText, contextTerms)) {
    checks_failed.push('B5');
    check_details.B5 = {
      expected_context_terms: contextTerms,
      actual_context: [provision?.section_anchor, provision?.heading].filter(Boolean).join(' ') || null,
    };
  }

  const quoteLength = quote.length;
  if (provision?.text) {
    const ratio = quoteLength / Math.max(1, String(provision.text).length);
    const sentenceCount = String(provision.text).split(/[.!?]\s+/).filter(Boolean).length;
    if (ratio > 0.6 || (ratio < 0.05 && sentenceCount > 1)) {
      checks_failed.push('B6');
      check_details.B6 = {
        excerpt_length_ratio: Number(ratio.toFixed(4)),
        provision_length: String(provision.text).length,
        excerpt_length: quoteLength,
      };
    }
  } else if (quoteLength > 450 || quoteLength < 25) {
    checks_failed.push('B6');
    check_details.B6 = {
      excerpt_length: quoteLength,
      proxy_reason: quoteLength > 450 ? 'Excerpt is unusually long without Provision text.' : 'Excerpt is unusually short without Provision text.',
    };
  }

  return { checks_failed, check_details };
}

function warningForClaim(claim, context = {}) {
  const result = runIntegrityChecksForClaim(claim, context);
  if (!result.checks_failed.length) return null;
  return {
    claim_hash: hashClaim(claim),
    deal_id: claim.deal_id || null,
    field_key: claim.field_key || null,
    raw_value: claim.raw_value ?? null,
    canonicalKey: claim.canonicalKey ?? null,
    evidence_quote: claim.evidence_quote || '',
    source_provision_id: claim.source_provision_id || null,
    checks_failed: result.checks_failed,
    check_details: result.check_details,
    reviewer_status: 'NEW',
    created_at: '2026-07-07T00:00:00.000Z',
  };
}

function registryIndex(entries = []) {
  return new Map(entries.map((entry) => [entry.key, entry]));
}

function collectIntegrityWarnings(normalized) {
  const registry = registryIndex(normalized.entries || []);
  return (normalized.triples || [])
    .map((claim) => warningForClaim(claim, { attribute: registry.get(claim.field_key) || {} }))
    .filter(Boolean)
    .sort((a, b) => a.claim_hash.localeCompare(b.claim_hash))
    .slice(0, MAX_WARNINGS);
}

function run({ normalizedFile = NORMALIZED_FILE, warningsFile = WARNINGS_FILE } = {}) {
  const normalized = readJson(normalizedFile, { entries: [], triples: [] });
  const warnings = collectIntegrityWarnings(normalized);
  writeJsonl(warningsFile, warnings);
  return warnings;
}

if (require.main === module) {
  const warnings = run();
  console.log(`wrote ${warnings.length} claim-integrity warnings to ${WARNINGS_FILE}`);
}

module.exports = {
  collectIntegrityWarnings,
  hashClaim,
  run,
  runIntegrityChecksForClaim,
  stableStringify,
  warningForClaim,
  writeJsonl,
};

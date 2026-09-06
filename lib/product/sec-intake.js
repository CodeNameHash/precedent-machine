'use strict';

const { canonicalJson, contentId, sha256Hex } = require('../canonical-v2/canonical-bytes');
const { buildSecEdgarIntakeCapture } = require('../canonical-v2/sec-edgar-intake-capture');
const { convertSecHtmlToCanonicalText } = require('../canonical-v2/sec-html-canonical-text');
const { classifyAgreementRevision } = require('../agreement-revision-classifier');

const SEC_HOST = 'www.sec.gov';
const SEC_ARCHIVE_RE = /^\/Archives\/edgar\/data\/(\d+)\/(\d{18})\/([^/]+)$/i;
const DEFAULT_MAX_BYTES = 25 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 30_000;
const MONTHS = Object.freeze({ january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 });

class ProductSecIntakeError extends Error {
  constructor(code, message) { super(`${code}: ${message}`); this.name = 'ProductSecIntakeError'; this.code = code; }
}
function fail(code, message) { throw new ProductSecIntakeError(code, message); }
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function parseSecExhibitUrl(value) {
  if (typeof value !== 'string' || value.trim() !== value || value.length === 0) fail('INVALID_URL', 'URL must be an exact string.');
  let parsed;
  try { parsed = new URL(value); } catch { fail('INVALID_URL', 'URL is not valid.'); }
  if (parsed.protocol !== 'https:' || parsed.hostname !== SEC_HOST || parsed.port || parsed.username || parsed.password || parsed.search || parsed.hash) {
    fail('INVALID_URL', 'URL must be an exact HTTPS www.sec.gov archive exhibit URL.');
  }
  const match = SEC_ARCHIVE_RE.exec(parsed.pathname);
  if (!match || !/\.(?:htm|html)$/i.test(match[3]) || /(?:^|[-_])index\.html?$/i.test(match[3])) fail('INVALID_EXHIBIT_URL', 'URL must identify an SEC HTML exhibit.');
  const accessionDigits = match[2];
  return deepFreeze({
    url: parsed.href,
    cik: match[1],
    filing_accession: `${accessionDigits.slice(0, 10)}-${accessionDigits.slice(10, 12)}-${accessionDigits.slice(12)}`,
    accession_digits: accessionDigits,
    filename: match[3],
  });
}

function textValue(value) {
  return String(value || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim();
}
function textLines(value) {
  return String(value || '').replace(/<\s*(?:br|\/p|\/div|\/h[1-6]|\/center|\/tr)\b[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&')
    .split(/\r?\n/).map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
}
function sgmlValue(source, tag) { return textValue(source.match(new RegExp(`<${tag}(?:\\s+[^>]*)?>\\s*([^\\r\\n<]+)`, 'i'))?.[1]); }
function isoAgreementDate(source) {
  const lines = textLines(source.slice(0, 30_000));
  const candidates = lines.flatMap((line, index) => (
    /^dated\s+as\s+of$/i.test(line) && lines[index + 1] ? [`${line} ${lines[index + 1]}`, line] : [line]
  ));
  const matches = candidates.flatMap((line) => {
    const match = line.match(/^dated\s+as\s+of\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(20\d{2})$/i);
    return match ? [match] : [];
  });
  const values = [...new Set(matches.map((match) => `${match[3]}-${String(MONTHS[match[1].toLowerCase()]).padStart(2, '0')}-${String(Number(match[2])).padStart(2, '0')}`))];
  return { value: values.length === 1 ? values[0] : null, conflicting: values.length > 1 };
}
function inferCaptionRoles(lines, parties) {
  if (parties.length !== 3) return parties;
  const subjects = lines.flatMap((line) => {
    const match = line.match(/^Article\s+[IVXLCDM]+\s+REPRESENTATIONS AND WARRANTIES OF\s+([A-Z0-9 &.'\/-]+)$/i);
    return match ? [match[1].toUpperCase()] : [];
  });
  if (subjects.length !== 2) return parties;
  const buyerSubject = subjects.find((subject) => /\bMERGER SUB\b/.test(subject));
  const companySubject = subjects.find((subject) => !/\bMERGER SUB\b/.test(subject));
  if (!buyerSubject || !companySubject) return parties;
  const mergerSubs = parties.filter((party) => /\bMERGER SUB\b/i.test(party.name));
  if (mergerSubs.length !== 1) return parties;
  const leadToken = (name) => name.match(/[A-Z0-9][A-Z0-9&'-]{2,}/i)?.[0]?.toUpperCase() || null;
  const subjectHasParty = (subject, party) => {
    const lead = leadToken(party.name);
    return lead && new RegExp(`(?:^|\\s)${lead.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|$)`).test(subject);
  };
  const nonSubs = parties.filter((party) => party !== mergerSubs[0]);
  const companies = nonSubs.filter((party) => subjectHasParty(companySubject, party));
  const parents = nonSubs.filter((party) => party !== companies[0] && subjectHasParty(buyerSubject, party));
  if (companies.length !== 1 || parents.length !== 1) return parties;
  return parties.map((party) => ({
    name: party.name,
    role: party === companies[0] ? 'COMPANY' : party === parents[0] ? 'PARENT' : 'MERGER_SUB',
  }));
}
function partyIdentity(source) {
  const lines = textLines(source.slice(0, 30_000));
  const parties = [];
  const byRole = new Map();
  for (const line of lines) {
    const asRole = line.match(/^(?:by\s+and\s+among\s+)?([A-Z][A-Z0-9&.', -]{2,180}?),\s+as\s+(?:the\s+)?(Company|Target|Parent|Buyer|Purchaser|Merger Sub)(?:,|$)/i);
    const match = asRole || (!/^[A-Z]/.test(line) || /^(?:Inc\.?|LLC|L\.L\.C\.?|L\.P\.?|Ltd\.?|Corporation|Corp\.?)\b/i.test(line) || /^(?:this\s+)?agreement\b/i.test(line) || /,\s+(?:an?|the)\s+/i.test(line) ? null
      : line.match(/^(?:by\s+and\s+among\s+)?([A-Z][A-Z0-9&.', -]{2,180})\s*\(\s*(?:the\s+)?["“](Company|Target|Parent|Buyer|Purchaser|Merger Sub)["”]\s*\)/i));
    if (!match) continue;
    const party = { name: match[1].trim().replace(/,\s*$/, ''), role: match[2].toUpperCase().replace(/\s+/g, '_') };
    if (byRole.has(party.role) && byRole.get(party.role) !== party.name) return { parties, conflicting: true };
    byRole.set(party.role, party.name);
    parties.push(party);
  }
  const prose = lines.join(' ');
  const embeddedRole = /(?:(?<=\))\s+(?:and\s+)?|,\s+(?:and\s+)?|\bamong\s+)([A-Z][A-Za-z0-9&.' -]{2,180}?(?:,\s+(?:Inc\.?|LLC|L\.L\.C\.?|Ltd\.?|Corporation|Corp\.?|L\.P\.|Public Limited Company))?),\s+(?:an?|the)\s+[^()]{1,160}\(\s*(?:the\s+)?["“](Company|Target|Parent|Buyer|Purchaser|Merger Sub)["”]\s*\)/gi;
  for (const match of `, ${prose}`.matchAll(embeddedRole)) {
    const name = match[1].trim().replace(/^.*\bby\s+and\s+among\s+/i, '');
    const party = { name, role: match[2].toUpperCase().replace(/\s+/g, '_') };
    if (byRole.get(party.role) === party.name) continue;
    if (byRole.has(party.role) && byRole.get(party.role) !== party.name) return { parties, conflicting: true };
    byRole.set(party.role, party.name);
    parties.push(party);
  }
  const distinct = [...new Map(parties.map((party) => [`${party.role}\0${party.name}`, party])).values()];
  const hasCompany = distinct.some((party) => ['COMPANY', 'TARGET'].includes(party.role));
  const hasBuyer = distinct.some((party) => ['PARENT', 'BUYER', 'PURCHASER'].includes(party.role));
  if (hasCompany && hasBuyer) return { parties: distinct, conflicting: false };

  const amongIndex = lines.findIndex((line) => /^by\s+and\s+among\b/i.test(line));
  const dateIndex = lines.findIndex((line, index) => index > amongIndex && /^dated\s+as\s+of\b/i.test(line));
  if (amongIndex < 0 || dateIndex <= amongIndex + 1) return { parties: [], conflicting: false };
  const captionLines = lines.slice(amongIndex, dateIndex);
  captionLines[0] = captionLines[0].replace(/^by\s+and\s+among\s*:?\s*/i, '');
  const names = [];
  let pending = '';
  for (const line of captionLines) {
    if (!line || /^(?:and|&)$/i.test(line)) continue;
    pending = pending ? `${pending} ${line}` : line;
    if (/[,.;]$/.test(pending)) {
      names.push(pending.replace(/[,.;]+$/, '').trim());
      pending = '';
    }
  }
  if (pending) names.push(pending.trim());
  const captionParties = [...new Set(names)].filter((name) => name.length >= 2 && name.length <= 240 && /[A-Za-z0-9]/.test(name))
    .map((name) => ({ name, role: 'PARTY' }));
  return { parties: inferCaptionRoles(lines, captionParties), conflicting: captionParties.length < 2 };
}
function exhibitIdentity(source, parsed, supplied = {}) {
  const sgmlType = sgmlValue(source, 'TYPE');
  const sgmlTitle = sgmlValue(source, 'TITLE');
  const sgmlFilename = sgmlValue(source, 'FILENAME');
  const titleType = textValue(source.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]).match(/\bEX-(?:2|10)(?:\.\d+)?\b/i)?.[0] || null;
  const types = [...new Set([supplied?.type, sgmlType, titleType].filter(Boolean).map((value) => value.toUpperCase()))];
  const type = types.length === 1 ? types[0] : null;
  const description = supplied?.description || sgmlValue(source, 'DESCRIPTION') || sgmlTitle || null;
  return {
    type,
    description,
    filename: parsed.filename,
    title: sgmlTitle,
    typeConfirmed: types.length === 1 && /^EX-(?:2|10)(?:\.\d+)?$/i.test(type),
    typeConflict: types.length > 1,
    filenameConflict: [sgmlFilename, supplied?.document].filter(Boolean).some((value) => value !== parsed.filename),
  };
}

function extractDocumentIdentity({ url, html, canonicalText, exhibit, filing } = {}) {
  const parsed = parseSecExhibitUrl(url);
  const source = String(html || '');
  const exhibitResult = exhibitIdentity(source, parsed, exhibit);
  const identityText = typeof canonicalText === 'string' && canonicalText.length > 0 ? canonicalText : source;
  const date = isoAgreementDate(identityText);
  const party = partyIdentity(identityText);
  const revision = classifyAgreementRevision({
    title: [exhibitResult.type, exhibitResult.description, exhibitResult.title, parsed.filename].filter(Boolean).join(' '),
    text: textValue(identityText),
  });
  const reasons = [];
  if (filing?.cik && String(filing.cik).replace(/^0+/, '') !== parsed.cik.replace(/^0+/, '')) reasons.push('CIK_CONFLICT');
  if (filing?.accession && filing.accession !== parsed.filing_accession) reasons.push('ACCESSION_CONFLICT');
  if (!exhibitResult.typeConfirmed) reasons.push('EXHIBIT_UNCONFIRMED');
  if (exhibitResult.typeConflict) reasons.push('EXHIBIT_TYPE_CONFLICT');
  if (exhibitResult.filenameConflict) reasons.push('EXHIBIT_FILENAME_CONFLICT');
  if (party.parties.length < 2 || party.conflicting) reasons.push('PARTIES_UNCONFIRMED');
  if (!date.value) reasons.push(date.conflicting ? 'AGREEMENT_DATE_CONFLICT' : 'AGREEMENT_DATE_UNCONFIRMED');
  if (revision.needs_human_review || revision.needs_text_confirmation) reasons.push('REVISION_UNCONFIRMED');
  if (!revision.is_agreement_document || !revision.signals?.looks_like_complete_document) reasons.push('DOCUMENT_INCOMPLETE');
  return deepFreeze({
    cik: parsed.cik,
    filing_accession: parsed.filing_accession,
    exhibit_type: exhibitResult.type,
    exhibit_description: exhibitResult.description,
    exhibit_title: exhibitResult.title,
    exhibit_filename: parsed.filename,
    parties: party.parties,
    agreement_date: date.value,
    revision_status: revision.revision,
    revision,
    identity_status: reasons.length === 0 ? 'CONFIRMED' : 'NEEDS_REVIEW',
    identity_review_reasons: reasons,
  });
}

function headerObject(headers) {
  if (!headers || typeof headers.entries !== 'function') return {};
  return Object.fromEntries([...headers.entries()].map(([key, value]) => [key.toLowerCase(), value]));
}
async function readBoundedBody(response, maxBytes) {
  if (!response.body || typeof response.body.getReader !== 'function') {
    const body = Buffer.from(await response.arrayBuffer());
    if (body.length > maxBytes) fail('RESPONSE_TOO_LARGE', 'SEC response exceeds the byte limit.');
    return body;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = Buffer.from(value);
    length += chunk.length;
    if (length > maxBytes) {
      await reader.cancel();
      fail('RESPONSE_TOO_LARGE', 'SEC response exceeds the byte limit.');
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, length);
}
function canonicalInstant(clock) {
  const value = clock();
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) fail('INVALID_CLOCK', 'Clock must return a valid time.');
  return date.toISOString();
}

function createSecIntakeAdapter({ fetchImpl = globalThis.fetch, clock = () => new Date(), userAgent = 'PrecedentMachine/1.0 bengoodchild@gmail.com', timeoutMs = DEFAULT_TIMEOUT_MS, maxBytes = DEFAULT_MAX_BYTES } = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');
  if (typeof userAgent !== 'string' || !userAgent.includes('@')) throw new TypeError('userAgent must identify a contact');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) throw new TypeError('timeoutMs must be positive');
  if (!Number.isInteger(maxBytes) || maxBytes < 1) throw new TypeError('maxBytes must be positive');
  return Object.freeze({
    async intake({ url, exhibit, filing } = {}) {
      const parsed = parseSecExhibitUrl(url);
      const requestHeaders = Object.freeze({ Accept: 'text/html', 'User-Agent': userAgent });
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let response;
      try {
        response = await fetchImpl(parsed.url, { redirect: 'manual', signal: controller.signal, headers: requestHeaders });
      } catch (error) {
        clearTimeout(timer);
        fail(error?.name === 'AbortError' ? 'REQUEST_TIMEOUT' : 'NETWORK_FAILURE', error?.message || 'SEC request failed.');
      }
      let headers; let contentType; let body;
      try {
        if (response.status >= 300 && response.status < 400) fail('REDIRECT_REJECTED', 'SEC redirects are not accepted.');
        if (response.status !== 200) fail('HTTP_STATUS_REJECTED', 'SEC response status must be 200.');
        if (typeof response.url !== 'string' || response.url.length === 0 || response.url !== parsed.url) fail('FINAL_URL_REJECTED', 'The SEC final URL changed.');
        headers = headerObject(response.headers);
        contentType = String(headers['content-type'] || '').split(';', 1)[0].trim().toLowerCase();
        if (contentType !== 'text/html') fail('INVALID_CONTENT_TYPE', 'SEC response must be text/html.');
        const declaredLength = Number(headers['content-length']);
        if (Number.isFinite(declaredLength) && declaredLength > maxBytes) fail('RESPONSE_TOO_LARGE', 'SEC response exceeds the byte limit.');
        body = await readBoundedBody(response, maxBytes);
        if (body.length === 0) fail('EMPTY_RESPONSE', 'SEC response is empty.');
      } catch (error) {
        if (error instanceof ProductSecIntakeError) throw error;
        fail(error?.name === 'AbortError' ? 'REQUEST_TIMEOUT' : 'NETWORK_FAILURE', error?.message || 'SEC response failed.');
      } finally { clearTimeout(timer); }
      const retrievedAt = canonicalInstant(clock);
      const capture = buildSecEdgarIntakeCapture({ retrieval_url: parsed.url, final_url: parsed.url, status_code: 200, content_type: contentType, retrieved_at: retrievedAt, retrieval_policy_digest: sha256Hex(Buffer.from(`SEC_PRODUCT_POLICY/V1\0${userAgent}\0${timeoutMs}\0${maxBytes}`, 'utf8')), redirect_count: 0, response_bytes: body });
      const conversion = convertSecHtmlToCanonicalText(capture);
      const identity = extractDocumentIdentity({ url: parsed.url, html: body.toString('utf8'), canonicalText: conversion.canonical_text, exhibit, filing });
      const stableIdentity = {
        retrieval_url: parsed.url, raw_sha256: sha256Hex(body), canonical_text_sha256: conversion.canonical_text_sha256,
        canonical_text_id: conversion.canonical_text_id, source_map_id: conversion.source_map_digest,
        filing_accession: parsed.filing_accession, exhibit_filename: parsed.filename, identity_version: 'DOCUMENT_IDENTITY/V1',
      };
      const sourceDocumentId = contentId('SOURCE_DOCUMENT/V1', stableIdentity);
      const sourceBody = {
        schema_version: 'SOURCE_DOCUMENT/V1', source_document_id: sourceDocumentId, agreement_id: sourceDocumentId,
        retrieval_url: parsed.url, final_url: response.url, http_status: response.status, response_content_type: contentType,
        redirect_count: 0, request_headers: requestHeaders, response_headers: headers, retrieved_at: retrievedAt,
        raw_bytes_base64: body.toString('base64'), raw_sha256: stableIdentity.raw_sha256, raw_byte_length: body.length,
        canonical_text: conversion.canonical_text, canonical_text_sha256: conversion.canonical_text_sha256,
        canonical_text_byte_length: conversion.canonical_text_byte_length, source_map_encoding: conversion.source_map_encoding,
        source_map_payload_base64: conversion.source_map_payload_base64, source_map_compressed_sha256: conversion.source_map_compressed_sha256,
        source_map_uncompressed_byte_length: conversion.source_map_uncompressed_byte_length,
        source_map_input_region_count: conversion.input_region_count, source_map_output_mapping_count: conversion.output_mapping_count,
        source_map_id: conversion.source_map_digest, canonical_text_id: conversion.canonical_text_id, ...identity,
      };
      return deepFreeze({ ...sourceBody, source_document_digest: sha256Hex(Buffer.from(canonicalJson(sourceBody), 'utf8')) });
    },
  });
}

module.exports = { ProductSecIntakeError, createSecIntakeAdapter, extractDocumentIdentity, parseSecExhibitUrl };

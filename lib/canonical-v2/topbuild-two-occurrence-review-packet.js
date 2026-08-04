'use strict';

const { canonicalJson, contentId, sha256Hex } = require('./canonical-bytes');
const { sectionizeAdmittedSource } = require('./native-producer/deterministic-sectionizer');

const SCHEMA = 'M3_TOPBUILD_TWO_OCCURRENCE_REVIEW_PACKET/V1';
function fail(message) { throw new Error(`TopBuild two-occurrence review packet: ${message}`); }
function exactKeys(value, keys) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort()); }
function excerpt(text, start, end) { return text.slice(start, Math.min(end, start + 900)); }
function details(record) {
  if (!record || !record.discovery || !record.capture || !record.conversion || !Buffer.isBuffer(record.raw_bytes)) fail('record must contain captured discovery, conversion and raw bytes.');
  const text = record.conversion.canonical_text;
  const tree = sectionizeAdmittedSource({ source_text: text, document_hash: record.capture.response_bytes_sha256 });
  const headings = tree.nodes.filter(node => node.heading).slice(0, 80).map(node => ({ reference: node.reference || null, heading: node.heading, section_id: node.section_id || null }));
  const lead = text.slice(0, 6000);
  const parties = [...lead.matchAll(/\bbetween\s+(.{1,240}?)(?:,?\s+and\s+|\.)/gi)].map(match => match[1].trim()).slice(0, 3);
  const dates = [...lead.matchAll(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\b/g)].map(match => match[0]).slice(0, 8);
  return { occurrence_id: record.discovery.occurrence_id, sec_url: record.discovery.source_metadata.source_url, raw_sha256: sha256Hex(record.raw_bytes), canonical_text_sha256: record.conversion.canonical_text_sha256, canonical_text: text, headings, parties, dates, tree };
}
function uniqueEvidence(left, right) {
  const rightLines = new Set(right.canonical_text.split(/\n+/).map(line => line.trim()).filter(line => line.length >= 80));
  const evidence = []; let offset = 0;
  for (const line of left.canonical_text.split(/\n/)) { const start = offset; offset += line.length + 1; const trimmed = line.trim(); if (trimmed.length >= 120 && !rightLines.has(trimmed)) evidence.push({ occurrence_id:left.occurrence_id, canonical_text_start:start, canonical_text_end:start + line.length, exact_text:excerpt(left.canonical_text,start,start + line.length), exact_text_sha256:sha256Hex(line) }); if (evidence.length === 5) break; }
  return evidence.slice(0, 2);
}
function buildTopBuildTwoOccurrenceReviewPacket({ occurrences } = {}) {
  if (!Array.isArray(occurrences) || occurrences.length !== 2) fail('requires exactly two preserved occurrence records.');
  const [left, right] = occurrences.map(details).sort((a,b)=>a.occurrence_id.localeCompare(b.occurrence_id));
  if (left.occurrence_id === right.occurrence_id || left.sec_url === right.sec_url) fail('same-deal occurrence collapse or duplicate URL is forbidden.');
  const rawEqual = left.raw_sha256 === right.raw_sha256; const canonicalEqual = left.canonical_text_sha256 === right.canonical_text_sha256;
  const sharedHeadings = left.headings.filter(a => right.headings.some(b => b.reference === a.reference && b.heading === a.heading)).length;
  const headingOverlap = left.headings.length + right.headings.length === 0 ? 0 : (2 * sharedHeadings) / (left.headings.length + right.headings.length);
  const partyOverlap = left.parties.some(value => right.parties.includes(value)); const dateOverlap = left.dates.some(value => right.dates.includes(value));
  const preliminary_characterisation = rawEqual && canonicalEqual ? 'POSSIBLE_TRANSPORT_DUPLICATE_REQUIRES_REVIEW' : (dateOverlap && headingOverlap >= 0.2 ? 'POSSIBLE_VERSION_OR_EXHIBIT_VARIANT_REQUIRES_REVIEW' : 'UNRESOLVED_DOCUMENT_RELATIONSHIP_REQUIRES_REVIEW');
  const body = { schema_version:SCHEMA, occurrences: [left,right].map(({canonical_text,tree,...item})=>({...item, section_tree:{tree_id:tree.section_tree_id || null,node_count:tree.nodes.length,heading_count:item.headings.length} })), comparison:{raw_hashes_equal:rawEqual,canonical_hashes_equal:canonicalEqual,heading_overlap_ratio:headingOverlap,party_overlap:partyOverlap,date_overlap:dateOverlap,preliminary_characterisation,governed_disposition:'NOT_ISSUED',source_admission_status:'NOT_ATTEMPTED',deal_admission_status:'NOT_ATTEMPTED'}, unique_material_evidence:[...uniqueEvidence(left,right),...uniqueEvidence(right,left)] };
  return Object.freeze({...body,review_packet_id:contentId(SCHEMA,body)});
}
module.exports={SCHEMA,buildTopBuildTwoOccurrenceReviewPacket};

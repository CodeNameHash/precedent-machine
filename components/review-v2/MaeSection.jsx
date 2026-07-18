// Review V2 ("Mergertrace") — custom MAE section replacing ProvisionTable
// for mae-definitions on the v2 page only. Fed by the SAME data: it calls
// the original config's selectRows(reviewDeal) (row extraction, side split,
// tagged carveouts list, signals/evidence — all unchanged) and re-presents
// it as two Mergertrace tables:
//   1. "MAE test" — one row per party: limb count + limb summary, with the
//      full definition clause behind "see text" and the evidence hover.
//   2. "Carve-outs" — one row per (deduped) carve-out; right column is a
//      "Disproportionate carveback" pill: Yes (blue/info) when the carveback
//      reaches that carve-out, No (grey neutral) otherwise.
// Each table carries a data-testid starting with 'provision-table-' so every
// .mtx table rule in MergertraceStyles (grey header bars, white bodies,
// 1px #E0E0E0 borders, pill skin) applies unchanged.

import React from 'react';
import taxonomy from '../../lib/taxonomy.js';
import { maeDefinitionsConfig } from '../review/table-configs/mae-definitions.config';
import { cardFeatures } from '../review/table-configs/card-utils';
import { PillCell, EvidenceHoverSource } from '../review/primitives/ProvisionTablePrimitives';

const { labelForCode, taxonomyForFeatureKey } = taxonomy;

// Same friendly translation the v1 config uses for the raw limb code (that
// map isn't exported, so it's mirrored here — display-only).
const MAE_LIMB_TEXT = {
  TWO_LIMB: 'Two-limb: effect on the entity + ability to consummate',
  ONE_LIMB: 'One-limb: ability to consummate only',
};

const LIMB_ROW_KEYS = new Set(['maeLimbType', 'maeLimbs']);
const CARVEOUT_ROW_KEYS = new Set(['carveouts', 'maeCarveouts']);
const EXCEPTION_ROW_KEYS = new Set(['carveoutExceptions', 'maeCarveoutExceptions']);

function normalizeCode(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.trim().toUpperCase() || null;
  if (typeof value === 'object') {
    const raw = value.code || value.value || value.canonical || null;
    return raw ? String(raw).trim().toUpperCase() : null;
  }
  return null;
}

// Display-only sentence casing for raw carve-out text (mirrors the v1
// config's un-exported sentenceCaseLabel, same acronym allow-list).
const ACRONYMS = new Set(['FDA', 'GAAP', 'MFN', 'COVID', 'SEC', 'HSR', 'GDPR', 'EU', 'UK', 'US', 'IP']);

function sentenceCaseLabel(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return trimmed;
  let firstWordSeen = false;
  return trimmed.replace(/[A-Za-z]+(?:['’][A-Za-z]+)?/g, (word) => {
    if (ACRONYMS.has(word.toUpperCase())) return word.toUpperCase();
    const lower = word.toLowerCase();
    if (firstWordSeen) return lower;
    firstWordSeen = true;
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  });
}

function carveoutName(item, dict) {
  const code = normalizeCode(item);
  const fromDict = code ? labelForCode(code, dict) : null;
  if (fromDict) return fromDict;
  if (item && typeof item === 'object' && item.label) return sentenceCaseLabel(String(item.label));
  if (typeof item === 'string') return sentenceCaseLabel(item);
  if (item && typeof item === 'object' && item.text) return sentenceCaseLabel(String(item.text));
  return 'Carve-out';
}

// Both carveback shapes honoured (per-item flag + the sibling codes-only
// disproportionateImpactCarveouts list) — same rule as the v1 config.
function dispCodeSet(card) {
  const raw = cardFeatures(card).disproportionateImpactCarveouts;
  const set = new Set();
  (Array.isArray(raw) ? raw : []).forEach((entry) => {
    const code = normalizeCode(entry);
    if (code) set.add(code);
  });
  return set;
}

function hasCarveback(item, code, dispSet) {
  const flag = item && typeof item === 'object' ? item.hasDisproportionateImpactCarveback : null;
  if (flag === true || flag === 'true') return true;
  return !!(code && dispSet.has(code));
}

// Item 10 (round 3): the old version read ONLY item.quotes[0] and ignored
// item.text entirely -- MAE carve-out pills' quotes array is almost always
// EMPTY, so this returned null and every call site fell straight to
// row.evidence (the full MAE definition clause), which is the exact "hover
// shows the start of the whole definition" bug Ben reported. Prefer the
// item's own per-item text before falling back to row.evidence -- that
// fallback is now the LAST resort, only when the item truly has no text of
// its own. Same non-echo rule as lib/citable.js#getTaggedItemQuote (never
// return a `.text` that's merely the code/label echoed back), but without
// that helper's isTaggedItem() gate -- carve-out items here aren't always
// canonically coded, and an untagged item's own text is still better
// evidence than the whole definition's head.
function nonEchoText(item) {
  if (!item || typeof item !== 'object' || typeof item.text !== 'string') return null;
  const t = item.text.trim();
  if (!t) return null;
  if (t === String(item.code || '').trim() || t === String(item.label || '').trim()) return null;
  return t;
}
function itemQuote(item) {
  if (item && typeof item === 'object' && Array.isArray(item.quotes) && item.quotes[0]) return item.quotes[0];
  return nonEchoText(item);
}

function seeTextNode(text) {
  if (!text) return null;
  return (
    <details className="mt-1">
      <summary className="term-cell-seetext" style={{ listStyle: 'none' }}>see text</summary>
      <div className="mt-1 max-w-[42rem] whitespace-pre-wrap break-words text-[11px] leading-5 text-inkLight">{text}</div>
    </details>
  );
}

const TH_CLASS = 'px-3 py-2 text-left font-medium uppercase tracking-wider text-inkFaint';
const TD_CLASS = 'px-3 py-2 whitespace-pre-wrap break-words text-ink align-top';

// One bordered Mergertrace table card: grey title strip + thead + white body.
function MaeTableCard({ testId, title, headers, children, widths = [] }) {
  return (
    <section data-testid={testId} className="border border-border bg-white">
      <div className="border-b border-border bg-paper2 px-3 py-1.5">
        <p>{title}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs font-ui">
          <thead className="border-b border-border">
            <tr>
              {headers.map((header, index) => (
                <th key={header} className={TH_CLASS} style={widths[index] ? { width: widths[index] } : undefined}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">{children}</tbody>
        </table>
      </div>
    </section>
  );
}

export default function MaeSection({ config = maeDefinitionsConfig, reviewDeal }) {
  let rows = [];
  try {
    rows = config.selectRows(reviewDeal) || [];
  } catch {
    rows = [];
  }
  if (!rows.length) return null;

  const limbRows = rows.filter((row) => LIMB_ROW_KEYS.has(row.featureKey));
  const carveRows = rows.filter((row) => CARVEOUT_ROW_KEYS.has(row.featureKey));
  const exceptionRows = rows.filter((row) => EXCEPTION_ROW_KEYS.has(row.featureKey));
  const dict = taxonomyForFeatureKey('carveouts');
  const carveSides = [...new Set(carveRows.map((row) => row.side).filter(Boolean))];

  return (
    <div className="space-y-3.5">
      {limbRows.length ? (
        <MaeTableCard testId="provision-table-mae-test" title="MAE test" headers={['Party', 'Test']} widths={['12rem']}>
          {limbRows.map((row) => {
            const code = normalizeCode(row.value);
            const summary = MAE_LIMB_TEXT[code] || row.detail || 'Not captured';
            const sig = row.signals && row.signals[0];
            return (
              <tr key={row.id} className="align-top">
                <td className={TD_CLASS}>{row.side || 'Company'}</td>
                <td className={TD_CLASS}>
                  <EvidenceHoverSource
                    value={row.value}
                    evidence={sig ? sig.evidence : row.evidence}
                    source={sig ? sig.source : row.sourceCard}
                    highlight={null}
                    as="span"
                    className="text-ink"
                  >
                    {summary}
                  </EvidenceHoverSource>
                  {seeTextNode(row.evidence)}
                </td>
              </tr>
            );
          })}
        </MaeTableCard>
      ) : null}

      {carveRows.map((row) => {
        const rawItems = Array.isArray(row.value) ? row.value : [];
        const dispSet = dispCodeSet(row.sourceCard);
        // Dedupe by resolved name — the extracted list carries duplicates
        // (26 items on Metsera), same rule as the v1 carve-outs table.
        const seen = new Set();
        const items = rawItems.filter((item) => {
          const key = String(carveoutName(item, dict) || '').trim().toLowerCase();
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        if (!items.length) return null;
        const title = carveSides.length > 1 && row.side ? `Carve-outs — ${row.side}` : 'Carve-outs';
        return (
          <MaeTableCard
            key={row.id}
            testId={`provision-table-mae-carveouts${row.side ? `-${row.side.toLowerCase()}` : ''}`}
            title={title}
            headers={['Carve-out', 'Disproportionate carveback']}
            widths={[undefined, '14rem']}
          >
            {items.map((item, index) => {
              const code = normalizeCode(item);
              const name = carveoutName(item, dict);
              const carveback = hasCarveback(item, code, dispSet);
              return (
                <tr key={code || `${name}-${index}`} className="align-top">
                  <td className={TD_CLASS}>
                    <EvidenceHoverSource
                      evidence={itemQuote(item) || row.evidence}
                      source={row.sourceCard}
                      highlight={null}
                      as="span"
                    >
                      <span title={code || undefined}>{name}</span>
                    </EvidenceHoverSource>
                  </td>
                  <td className={TD_CLASS}>
                    <PillCell
                      label={carveback ? 'Yes' : 'No'}
                      tone={carveback ? 'info' : 'neutral'}
                      evidence={itemQuote(item) || row.evidence}
                      source={row.sourceCard}
                    />
                  </td>
                </tr>
              );
            })}
          </MaeTableCard>
        );
      })}

      {/* Exceptions to carve-outs (rare — absent on Metsera): kept so the
          data still surfaces on deals that carry it. */}
      {exceptionRows.length ? (
        <MaeTableCard testId="provision-table-mae-carveout-exceptions" title="Exceptions to carve-outs" headers={['Party', 'Exception']} widths={['12rem']}>
          {exceptionRows.map((row) => (
            <tr key={row.id} className="align-top">
              <td className={TD_CLASS}>{row.side || 'Company'}</td>
              <td className={TD_CLASS}>
                <EvidenceHoverSource value={row.value} evidence={row.evidence} source={row.sourceCard} highlight={null} as="span">
                  {row.detail}
                </EvidenceHoverSource>
              </td>
            </tr>
          ))}
        </MaeTableCard>
      ) : null}
    </div>
  );
}

import {
  getAiMetadata,
  getStructuredFeatures,
  isTaggedItem,
  resolveTaggedLabel,
  isCitableValue,
  getCitableValue,
  evidenceQuote,
} from '../../lib/citable';
import {
  CodeBadge,
  HoverSource,
  humanizeBadgeText,
  prettifyEnumValue,
  useShowEvidence,
  Pill,
  REVIEW_LABEL_COL_W,
} from './shared';
import { AddSectionItem } from './AddSectionItem';
import { buildPerShareParts } from './table-logic';

// Equity-specific column keys: these should NEVER appear in the lower
// "Conversion of Shares" table (they only make sense for the equity table).
const CONSID_EQUITY_COLUMN_KEYS = new Set([
  'instrumentType',
  'outstandingInstruments',
  'instrumentTreatments',
  'outstandingCount',
  'vestingAcceleration',
  'cashOutAmount',
  'optionSpread',
  'performanceTreatment',
  'espp_treatment',
  'cutoffDate',
  'cutoffTreatment',
  'equityAwardTreatment',
  'doubleTrigger',
  'parachuteCap',
]);

// Heuristic regex for equity instrument names in raw text (case-c fallback).
// Order matters: PSU before RSU, RESTRICTED_STOCK before STOCK_OPTIONS, etc.
const EQUITY_TEXT_PATTERNS = [
  { code: 'PSU', label: 'PSUs', re: /Company\s+(?:Performance(?:-based)?\s+(?:Stock\s+Units?|RSUs?)|PSUs?)/i },
  { code: 'RSU', label: 'RSUs', re: /Company\s+(?:Restricted\s+Stock\s+Units?|RSUs?)/i },
  { code: 'RESTRICTED_STOCK', label: 'Restricted Stock Awards', re: /Company\s+Restricted\s+Stock\s+Awards?/i },
  { code: 'STOCK_OPTIONS', label: 'Stock Options', re: /Company\s+Stock\s+Options?/i },
  { code: 'ESPP', label: 'ESPP', re: /(?:Company\s+)?ESPP|Employee\s+Stock\s+Purchase\s+Plan/i },
  { code: 'SAR', label: 'SARs', re: /Stock\s+Appreciation\s+Rights?|SARs?/i },
  { code: 'WARRANT', label: 'Warrants', re: /Company\s+Warrants?/i },
];

// Detect whether a provision is an equity-award row. Prefers the
// ai_metadata.code === 'CONSID-EQUITY' marker, falls back to the category
// label since p.code is not present on rows fetched from the provisions API.
function isConsidEquityProvision(p) {
  const meta = getAiMetadata(p) || {};
  if (meta.code === 'CONSID-EQUITY') return true;
  const cat = String(p?.category || '').toLowerCase();
  if (cat.includes('equity award') || cat.includes('stock plan') || cat.includes('treatment of equity')) {
    return true;
  }
  const f = getStructuredFeatures(p) || {};
  if (isTaggedItem(f.instrumentType)) return true;
  const insts = f.outstandingInstruments;
  if (Array.isArray(insts) && insts.length > 0) return true;
  return false;
}

// Build the equity-award rows. Handles three data shapes:
//  (a) Post-expansion: one provision per instrument; f.instrumentType set.
//  (b) Pre-expansion: f.outstandingInstruments + f.instrumentTreatments arrays.
//  (c) No structured equity fields — regex-scan p.full_text for instrument names.
export function buildEquityRows(equityProvisions) {
  const rows = [];
  for (const p of equityProvisions) {
    const f = getStructuredFeatures(p) || {};
    const insts = Array.isArray(f.outstandingInstruments) ? f.outstandingInstruments : [];
    const treatments = Array.isArray(f.instrumentTreatments) ? f.instrumentTreatments : [];

    // (a) instrumentType already populated (typical post-expander case).
    // Use THIS row's own treatment — prefer the singular `equityAwardTreatment`
    // when present, otherwise find a parallel treatment that matches this
    // instrument's code, otherwise (only as a last resort) treatments[0].
    // Picking treatments[0] blindly is what caused fully-accelerated rows to
    // be mis-labeled "Partially Accelerated" when the array also contained
    // a different instrument's treatment.
    if (isTaggedItem(f.instrumentType)) {
      const myCode = String(f.instrumentType.code || '').toUpperCase();
      let myTreatment = null;
      if (isTaggedItem(f.equityAwardTreatment)) {
        myTreatment = f.equityAwardTreatment;
      } else if (insts.length > 0) {
        // Try to match by instrument code in the parallel array.
        const idx = insts.findIndex(
          (inst) => isTaggedItem(inst) && String(inst.code || '').toUpperCase() === myCode,
        );
        if (idx >= 0 && idx < treatments.length) {
          myTreatment = treatments[idx];
        }
      }
      if (myTreatment === null && treatments.length === 1) {
        // Only one treatment in the array → safe to use it.
        myTreatment = treatments[0];
      }
      // Per-instrument vesting: prefer this row's own instrumentVesting[0]
      // (stamped by the expander), then the section-wide vestingAcceleration.
      const myVesting = (Array.isArray(f.instrumentVesting) && f.instrumentVesting[0])
        || f.vestingAcceleration || null;
      rows.push({
        key: `${p.id}-single`,
        provision: p,
        instrument: f.instrumentType,
        outstandingCount: f.outstandingCount ?? null,
        treatment: myTreatment,
        vesting: myVesting,
        cashOut: f.cashOutAmount ?? f.optionSpread ?? null,
        cutoff: f.cutoffDate ?? null,
      });
      continue;
    }

    // (b) parallel arrays of instruments + treatments — each row picks its
    // OWN treatment AND vesting by index (the parallel-array contract).
    if (insts.length > 0) {
      const vestings = Array.isArray(f.instrumentVesting) ? f.instrumentVesting : [];
      insts.forEach((inst, i) => {
        rows.push({
          key: `${p.id}-${i}`,
          provision: p,
          instrument: inst,
          outstandingCount: f.outstandingCount ?? null,
          treatment: treatments[i] ?? null,
          vesting: vestings[i] ?? f.vestingAcceleration ?? null,
          cashOut: f.cashOutAmount ?? f.optionSpread ?? null,
          cutoff: f.cutoffDate ?? null,
        });
      });
      continue;
    }

    // (c) no structured equity data — scan raw text for instrument names.
    const text = String(p?.full_text || '');
    const found = text ? EQUITY_TEXT_PATTERNS.filter(({ re }) => re.test(text)) : [];
    if (found.length === 0) {
      rows.push({
        key: `${p.id}-unknown`,
        provision: p,
        instrument: { code: 'UNKNOWN', label: p.category || 'Equity Award' },
        outstandingCount: null,
        treatment: null,
        vesting: f.vestingAcceleration ?? null,
        cashOut: f.cashOutAmount ?? f.optionSpread ?? null,
        cutoff: f.cutoffDate ?? null,
      });
    } else {
      const seenCodes = new Set();
      found.forEach(({ code, label }, i) => {
        if (seenCodes.has(code)) return;
        seenCodes.add(code);
        rows.push({
          key: `${p.id}-text-${i}`,
          provision: p,
          instrument: { code, label },
          outstandingCount: null,
          treatment: null,
          vesting: f.vestingAcceleration ?? null,
          cashOut: f.cashOutAmount ?? f.optionSpread ?? null,
          cutoff: f.cutoffDate ?? null,
        });
      });
    }
  }

  // De-dupe rows sharing the same provision + instrument code + treatment code.
  const seen = new Set();
  const deduped = [];
  for (const r of rows) {
    const instCode = isTaggedItem(r.instrument) ? r.instrument.code : String(r.instrument || '');
    const trCode = isTaggedItem(r.treatment) ? r.treatment.code : '';
    const sig = `${r.provision.id}::${instCode}::${trCode}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    deduped.push(r);
  }
  return deduped;
}

// Render a treatment/vesting string with any dollar amounts pulled out as
// amount pills (block 7b: amounts as pills), e.g. "Converted into $47.50" →
// "Converted into [$47.50]".
const DOLLAR_AMOUNT_RE = /\$\s?[\d,]+(?:\.\d+)?(?:\s*(?:million|billion))?/gi;
function renderWithAmountPills(text) {
  const s = String(text);
  const re = new RegExp(DOLLAR_AMOUNT_RE.source, 'gi');
  const parts = [];
  let last = 0;
  let m;
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) parts.push(s.slice(last, m.index));
    parts.push(<Pill key={`amt-${m.index}`} text={m[0]} tone="amount" />);
    last = m.index + m[0].length;
  }
  if (parts.length === 0) return s;
  if (last < s.length) parts.push(s.slice(last));
  return (
    <span className="inline-flex items-baseline gap-1 flex-wrap">
      {parts.map((p, i) => (typeof p === 'string' ? <span key={i}>{p}</span> : p))}
    </span>
  );
}

export function EquityAwardTable({ rows, onSelectProvision, onAddProvision, optionsCvrEarnInLabel, optionsCvrEarnInQuote }) {
  if (!rows || rows.length === 0) return null;
  // Render a tagged value as a canonical pill. Prefer the resolved taxonomy
  // label (e.g. "Cashed out at spread (...)") over a bare code-humanization
  // so the pill reads correctly; `featureKey` selects the taxonomy dict.
  // Plain strings render one line (block 7b) with dollar amounts as pills.
  const renderTagged = (v, featureKey) => {
    if (isTaggedItem(v)) {
      const label = featureKey ? resolveTaggedLabel(featureKey, v) : null;
      return <CodeBadge code={v.code} label={label || undefined} />;
    }
    if (v === null || v === undefined || v === '') {
      return <span className="text-inkFaint/70 italic">—</span>;
    }
    return <div className="line-clamp-1">{renderWithAmountPills(String(v))}</div>;
  };
  // Identify the Options row so the CVR earn-in pill attaches there.
  const isOptionsRow = (row) => {
    const code = isTaggedItem(row.instrument) ? String(row.instrument.code || '') : '';
    if (/OPTION/i.test(code)) return true;
    const lbl = isTaggedItem(row.instrument) ? (row.instrument.label || '') : String(row.instrument || '');
    return /option/i.test(lbl);
  };

  return (
    <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
      <div className="px-3 py-2 bg-lime-50 border-b border-border">
        <p className="text-[10px] font-ui font-medium text-lime-900 uppercase tracking-wider">
          Equity Treatment
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs font-ui">
          <thead className="bg-bg/60 border-b border-border">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap">Instrument</th>
              <th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider">Treatment</th>
              <th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider">Vesting</th>
              <th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap">Cutoff Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => {
              const instLabel = isTaggedItem(row.instrument)
                ? (resolveTaggedLabel('instrumentType', row.instrument) || row.instrument.label || humanizeBadgeText(row.instrument.code))
                : String(row.instrument || 'Instrument');
              // Prefer the treatment/vesting cell's own quote; fall back to the
              // provision full_text — all via the shared resolveEvidence path.
              const rowQuote = evidenceQuote(row.treatment, { fallbackToFullText: false })
                || evidenceQuote(row.vesting, { fallbackToFullText: false })
                || evidenceQuote(null, { provision: row.provision });
              return (
                <tr key={row.key} className="hover:bg-bg/40 transition-colors">
                  <td className={`px-3 py-2 align-top whitespace-normal break-words ${REVIEW_LABEL_COL_W}`}>
                    <HoverSource quote={rowQuote}>
                      <button
                        type="button"
                        onClick={() => onSelectProvision && onSelectProvision(row.provision)}
                        className="text-left text-accent hover:underline font-semibold"
                      >
                        {instLabel}
                      </button>
                    </HoverSource>
                  </td>
                  <td className="px-3 py-2 align-top text-ink max-w-[320px]">
                    <HoverSource quote={rowQuote} as="div">
                      <span className="inline-flex flex-wrap items-center gap-1">
                        {renderTagged(row.treatment, 'equityTreatment')}
                        {/* Options row: CVR earn-in shows as an extra pill next
                            to "Cashed Out at Spread" rather than its own hero row. */}
                        {optionsCvrEarnInLabel && isOptionsRow(row) ? (
                          <HoverSource quote={optionsCvrEarnInQuote || rowQuote}>
                            <span className="inline-flex items-center font-ui font-medium text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-200 whitespace-nowrap">
                              {optionsCvrEarnInLabel}
                            </span>
                          </HoverSource>
                        ) : null}
                      </span>
                    </HoverSource>
                  </td>
                  <td className="px-3 py-2 align-top text-ink max-w-[240px]">
                    <HoverSource quote={rowQuote} as="div">{renderTagged(row.vesting, 'vestingAcceleration')}</HoverSource>
                  </td>
                  <td className="px-3 py-2 align-top text-ink whitespace-nowrap">
                    {row.cutoff ?? <span className="text-inkFaint/70 italic">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* Row-level add scoped to THIS table: capture an equity class the parser
          missed (Ben's example — "what if you missed a class of equity, I'd
          want to add it there"). Creates a CONSID provision pre-scoped to
          equity treatment and opens the editor to set instrument + treatment. */}
      {onAddProvision && (
        <div className="px-3 py-2 border-t border-border bg-lime-50/40">
          <AddSectionItem
            type="CONSID"
            defaultCategory="Equity Award Treatment"
            nounOverride="equity class"
            onBeginAdd={onAddProvision}
          />
        </div>
      )}
    </div>
  );
}

// Detect the CONSID "Conversion of Shares / Effect on Capital Stock" provision
// — this is the row that carries the merger consideration paid out for the
// company's common stock. We synthesize a "Common Stock" row at the top of
// the Equity Treatment table from it so users always see the per-share amount.
function isConsidConvertProvision(p) {
  if (!p) return false;
  const meta = getAiMetadata(p) || {};
  if (meta.code === 'CONSID-CONVERT') return true;
  const cat = String(p?.category || '').toLowerCase();
  if (cat) {
    if (cat.includes('conversion of shares')) return true;
    if (cat.includes('effect on capital stock')) return true;
    if (cat.includes('merger consideration')) return true;
    if (cat.includes('treatment of capital stock')) return true;
  }
  return false;
}

// Resolve a considerationType value (tagged or plain-string enum) to its
// humanized label. Audit block 6a: a plain-string enum value ("cash-with-cvr")
// used to render verbatim as a parenthetical slug — route it through
// prettifyEnumValue (which normalizes case/format drift) instead of
// String()-ing it as-is.
function resolveConsidTypeLabel(ct) {
  if (isTaggedItem(ct)) {
    return resolveTaggedLabel('considerationType', ct) || ct.label || humanizeBadgeText(ct.code);
  }
  return prettifyEnumValue('considerationType', String(ct));
}

// Build a synthetic Common Stock row from the CONSID-CONVERT provision. We
// use the per-share amount / merger consideration directly (no instrument
// treatment formula needed — Common Stock simply receives the headline price).
function buildCommonStockRow(convertProv) {
  if (!convertProv) return null;
  const f = getStructuredFeatures(convertProv) || {};
  const per = f.perShareAmount;
  const ct = f.considerationType;
  // Compose a human-readable treatment string from per-share + consid type.
  let treatmentText = null;
  if (per && ct) {
    const ctLabel = resolveConsidTypeLabel(ct);
    treatmentText = `Converted into ${per}${ctLabel ? ` (${ctLabel})` : ''}`;
  } else if (per) {
    treatmentText = `Converted into ${per} per share`;
  } else if (ct) {
    const ctLabel = resolveConsidTypeLabel(ct);
    treatmentText = `Converted into ${ctLabel}`;
  } else {
    treatmentText = 'Converted into the Merger Consideration';
  }
  return {
    key: `${convertProv.id}-common-stock`,
    provision: convertProv,
    instrument: { code: 'COMMON_STOCK', label: 'Common Stock' },
    outstandingCount: null,
    treatment: treatmentText,
    vesting: null,
    cashOut: null,
    cutoff: null,
  };
}

export function ConsidTable({ provisions, onSelectProvision, onAddProvision }) {
  const showEvidence = useShowEvidence();

  // Partition: equity-award provisions vs. everything else.
  const equityProvisions = provisions.filter(isConsidEquityProvision);
  const otherProvisions = provisions.filter((p) => !isConsidEquityProvision(p));

  const equityRows = buildEquityRows(equityProvisions);

  // Find the CONSID-CONVERT provision (carries the headline per-share amount).
  let convertProv = provisions.find(isConsidConvertProvision);
  if (!convertProv) {
    convertProv = otherProvisions.find((p) => {
      const f = getStructuredFeatures(p) || {};
      return f.perShareAmount || f.considerationType;
    }) || otherProvisions[0] || null;
  }
  const commonStockRow = buildCommonStockRow(convertProv);
  if (commonStockRow) {
    const alreadyHasCommonStock = equityRows.some((r) =>
      isTaggedItem(r.instrument) && r.instrument.code === 'COMMON_STOCK'
    );
    if (!alreadyHasCommonStock) {
      equityRows.unshift(commonStockRow);
    }
  }

  // Build the headline price + consideration-type hero block. Scan all
  // provisions for the first non-empty perShareAmount + considerationType.
  // Track per-field source { provision, quote } so the table-style hero
  // below can make every LEFT-column label clickable to source.
  let heroPerShare = null;
  let heroPerShareSrc = null;
  let heroConsidType = null;
  const captureSrc = (raw, p) => ({
    provision: p,
    quote: evidenceQuote(raw, { provision: p }),
  });
  for (const p of provisions) {
    const f = getStructuredFeatures(p) || {};
    if (!heroPerShare && f.perShareAmount) {
      const v = isCitableValue(f.perShareAmount) ? getCitableValue(f.perShareAmount) : f.perShareAmount;
      heroPerShare = String(v);
      // focusOn the price so a full_text fallback narrows to the sentence
      // containing "$47.50" rather than dumping the whole provision.
      heroPerShareSrc = {
        provision: p,
        quote: evidenceQuote(f.perShareAmount, { provision: p, focusOn: String(v) }),
      };
    }
    if (!heroConsidType && f.considerationType) {
      heroConsidType = isTaggedItem(f.considerationType)
        ? (resolveTaggedLabel('considerationType', f.considerationType) || f.considerationType.label || f.considerationType.code)
        : String(f.considerationType);
    }
    if (heroPerShare && heroConsidType) break;
  }

  // Detect CVR presence — used to rewrite the displayed consideration type
  // as "Cash and a CVR" when the deal pays a mix of cash + CVR. We look at
  // the consideration type code/label, any provision flagged as CVR, and
  // the raw text as a final fallback. Be defensive: only override the label
  // when we have strong evidence of CVR + cash.
  const detectCvr = () => {
    for (const p of provisions) {
      const f = getStructuredFeatures(p) || {};
      const ct = f.considerationType;
      if (isTaggedItem(ct)) {
        const codeStr = String(ct.code || '').toLowerCase();
        const lblStr = String(ct.label || '').toLowerCase();
        if (codeStr.includes('cvr') || lblStr.includes('cvr') || lblStr.includes('contingent value')) return true;
      } else if (typeof ct === 'string' && /cvr|contingent\s+value/i.test(ct)) {
        return true;
      }
      if (f.cvrIncluded === true) return true;
      const meta = getAiMetadata(p) || {};
      const code = String(meta.code || p.code || '').toUpperCase();
      if (code.includes('CVR')) return true;
      const cat = String(p?.category || '').toLowerCase();
      if (cat.includes('cvr') || cat.includes('contingent value right')) return true;
    }
    return false;
  };
  const detectCash = () => {
    for (const p of provisions) {
      const f = getStructuredFeatures(p) || {};
      const ct = f.considerationType;
      if (isTaggedItem(ct)) {
        const codeStr = String(ct.code || '').toLowerCase();
        const lblStr = String(ct.label || '').toLowerCase();
        if (codeStr.includes('cash') || lblStr.includes('cash')) return true;
      } else if (typeof ct === 'string' && /cash/i.test(ct)) {
        return true;
      }
    }
    return false;
  };
  const hasCvr = detectCvr();
  const hasCash = detectCash();

  // Block 7a: when the deal pays a CVR, the headline consideration must show
  // BOTH components — the cash leg and the CVR leg — so cash-only is never
  // presented as the whole consideration. Pull the per-CVR maximum payment
  // from the CONSID-CVR features (maxPayment) for the "(up to $X.XX)" tail.
  let cvrMaxPayment = null;
  let cvrSrc = null;
  if (hasCvr) {
    for (const p of provisions) {
      const f = getStructuredFeatures(p) || {};
      const raw = f.maxPayment ?? f.cvrMaxPayment ?? null;
      if (raw === null || raw === undefined || raw === '') continue;
      const v = isCitableValue(raw) ? getCitableValue(raw) : raw;
      if (v === null || v === undefined || v === '') continue;
      cvrMaxPayment = String(v);
      cvrSrc = captureSrc(raw, p);
      break;
    }
  }
  // Metsera fb2 block 1a: the "Consideration Type" row is intentionally NOT
  // rendered — the Per-Share Consideration row already carries the type
  // ("$47.50 in cash + 1 CVR"). heroConsidType is still computed above
  // because the Exchange Ratio gating below reads it.
  if (hasCvr && hasCash) {
    heroConsidType = 'Cash + CVR';
  }

  // Options earn-in via CVR — only relevant when the deal pays a CVR.
  // Scan all CONSID provisions for optionsCvrEarnIn (enum). Resolve to a
  // short pill label (shown in the equity Options row) + the source quote.
  let optionsCvrEarnInLabel = null;
  let optionsCvrEarnInSrc = null;
  if (hasCvr) {
    const earnInLabels = {
      EARN_IN_ELIGIBLE: 'Out-of-the-Money Options Can Earn in to CVR',
      MUST_BE_ITM: 'Only In-the-Money Options Receive CVR',
      NOT_SPECIFIED: null,
    };
    for (const p of provisions) {
      const f = getStructuredFeatures(p) || {};
      const raw = isCitableValue(f.optionsCvrEarnIn)
        ? getCitableValue(f.optionsCvrEarnIn)
        : f.optionsCvrEarnIn;
      const code = isTaggedItem(raw) ? raw.code : raw;
      if (!code) continue;
      const s = String(code).toUpperCase();
      if (earnInLabels[s]) {
        optionsCvrEarnInLabel = earnInLabels[s];
        optionsCvrEarnInSrc = captureSrc(f.optionsCvrEarnIn, p);
        break;
      }
    }
  }

  // Find appraisalRightsAvailable across all CONSID provisions (first non-null).
  let appraisalAvailable = null;
  let appraisalSrc = null;
  for (const p of provisions) {
    const f = getStructuredFeatures(p) || {};
    const raw = f.appraisalRightsAvailable;
    if (raw === null || raw === undefined) continue;
    const unwrapped = isCitableValue(raw) ? raw.value : raw;
    if (unwrapped === null || unwrapped === undefined) continue;
    appraisalAvailable = unwrapped;
    appraisalSrc = captureSrc(raw, p);
    break;
  }

  // Exchange Ratio — only render when considerationType references stock.
  // Pulls exchangeRatio + exchangeRatioType from any CONSID provision (incl.
  // CONSID-EXCHANGE-RATIO sub-code which carries ratioType + value).
  const considTypeStr = String(heroConsidType || '').toLowerCase();
  const showExchangeRatio = considTypeStr.includes('stock') || considTypeStr.includes('mixed');
  let exchangeRatioValue = null;
  let exchangeRatioType = null;
  if (showExchangeRatio) {
    for (const p of provisions) {
      const f = getStructuredFeatures(p) || {};
      const v = isCitableValue(f.exchangeRatio) ? getCitableValue(f.exchangeRatio) : f.exchangeRatio;
      if (!exchangeRatioValue && v) exchangeRatioValue = String(v);
      const v2raw = f.exchangeRatioType ?? f.ratioType;
      const v2 = isCitableValue(v2raw) ? getCitableValue(v2raw) : v2raw;
      if (!exchangeRatioType && v2) {
        exchangeRatioType = isTaggedItem(v2)
          ? (resolveTaggedLabel('exchangeRatioType', v2) || v2.label || v2.code)
          : String(v2);
      }
      // Sub-code CONSID-EXCHANGE-RATIO carries the canonical `value` + `ratioType`.
      if (!exchangeRatioValue && f.value) exchangeRatioValue = String(f.value);
      if (exchangeRatioValue && exchangeRatioType) break;
    }
  }

  // Format per-share for display ("47.50" -> "$47.50", "$47.50" -> "$47.50").
  const formatPerShare = (raw) => {
    if (!raw) return null;
    const s = String(raw).trim();
    if (s.startsWith('$')) return s;
    if (/^[\d,.]+$/.test(s)) return `$${s}`;
    return s;
  };
  const heroPriceText = formatPerShare(heroPerShare);

  // Source provisions for the remaining hero rows. Capture AFTER the
  // `showExchangeRatio` + `optionsCvrEarnInLabel` blocks above so dependent
  // logic is settled.
  let exchangeRatioSrc = null;
  if (showExchangeRatio) {
    for (const p of provisions) {
      const f = getStructuredFeatures(p) || {};
      const anchor = f.exchangeRatio || f.exchangeRatioType || f.ratioType || f.value;
      if (anchor) { exchangeRatioSrc = captureSrc(anchor, p); break; }
    }
  }
  const renderAppraisalValue = (v) => {
    if (v && typeof v === 'object') {
      // Tagged item { code, label, text } or citable { value, text } —
      // resolve to the inner human label / value.
      if ('label' in v) return v.label;
      if ('value' in v) return renderAppraisalValue(v.value);
      if ('text' in v) return v.text;
    }
    if (v === true || v === 'yes' || v === 'true') return 'Yes';
    if (v === false || v === 'no' || v === 'false') return 'No';
    return String(v);
  };

  return (
    <div className="space-y-3">
      {/* Headline Consideration — bringdown-style mini-table. Each LEFT
          column label is clickable to source (matching every other table
          in the app); right column is the plain value. No more oversized
          $47.50 callout. */}
      {(heroPriceText || hasCvr || appraisalAvailable !== null || (showExchangeRatio && (exchangeRatioValue || exchangeRatioType))) && (() => {
        // Per-share consideration: amounts render as pills (block 2). When
        // the deal carries a CVR (block 7a), BOTH legs show — the cash pill
        // and a "1 CVR (up to $X.XX)" pill — never cash alone, joined by a
        // literal "+" ("$47.50 in cash + 1 CVR", Metsera fb2 block 1c). No
        // trailing "per share" — the left label already says Per-Share
        // (block 1b). The pills carry no quote of their own (the ROW-level
        // HoverSource handles hover/click); the CVR quote is folded into
        // the row quote.
        const cvrMaxText = formatPerShare(cvrMaxPayment);
        const perShareParts = buildPerShareParts({
          perShareText: heroPriceText,
          hasCvr,
          hasCash,
          cvrMaxText,
        });
        const perShareValue = perShareParts.length > 0 ? (
          <span className="inline-flex items-center gap-1 flex-wrap">
            {perShareParts.map((part, i) => (
              part.type === 'plus'
                ? <span key={i} className="text-inkFaint">+</span>
                : <Pill key={i} text={part.text} tone="amount" />
            ))}
          </span>
        ) : null;
        const perShareSrc = (() => {
          const quotes = [
            heroPerShareSrc && heroPerShareSrc.quote,
            hasCvr && cvrSrc && cvrSrc.quote,
          ].filter(Boolean);
          if (quotes.length === 0) return heroPerShareSrc;
          return { ...(heroPerShareSrc || {}), quote: quotes.join('\n\n') };
        })();
        // Metsera fb2 block 1a: no "Consideration Type" row — Per-Share
        // Consideration carries the type.
        const heroRows = [
          perShareValue ? { label: 'Per-Share Consideration', value: perShareValue, src: perShareSrc } : null,
          (showExchangeRatio && (exchangeRatioValue || exchangeRatioType)) ? { label: 'Exchange Ratio', value: <>{exchangeRatioValue || '—'}{exchangeRatioType ? ` (${exchangeRatioType})` : ''}</>, src: exchangeRatioSrc } : null,
          appraisalAvailable !== null ? { label: 'Appraisal Rights Available', value: renderAppraisalValue(appraisalAvailable), src: appraisalSrc } : null,
        ].filter(Boolean);
        return (
          <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
            <div className="px-3 py-2 bg-bg/60 border-b border-border">
              <p className="text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider">
                Headline Consideration
              </p>
            </div>
            <table className="min-w-full text-xs font-ui">
              <tbody className="divide-y divide-border">
                {heroRows.map((row) => {
                  const rowQuote = row.src && row.src.quote ? row.src.quote : null;
                  return (
                    <tr key={row.label} className="hover:bg-bg/40 transition-colors align-top">
                      <td className={`px-3 py-2 whitespace-normal break-words ${REVIEW_LABEL_COL_W}`}>
                        {rowQuote ? (
                          <HoverSource quote={rowQuote}>
                            <button
                              type="button"
                              onClick={() => showEvidence(rowQuote)}
                              className="text-left text-accent hover:underline font-medium"
                            >
                              {row.label}
                            </button>
                          </HoverSource>
                        ) : (
                          <span className="text-ink font-medium">{row.label}</span>
                        )}
                      </td>
                      <td
                        className={`px-3 py-2 text-ink ${rowQuote ? 'cursor-pointer hover:bg-yellow-50' : ''}`}
                        onClick={rowQuote ? () => showEvidence(rowQuote) : undefined}
                      >
                        <HoverSource quote={rowQuote} as="div">
                          {row.value}
                        </HoverSource>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })()}

      {equityRows.length > 0 && (
        <EquityAwardTable
          rows={equityRows}
          onSelectProvision={onSelectProvision}
          onAddProvision={onAddProvision}
          optionsCvrEarnInLabel={optionsCvrEarnInLabel}
          optionsCvrEarnInQuote={optionsCvrEarnInSrc && optionsCvrEarnInSrc.quote}
        />
      )}

      {/* Other provisions in this section — only those NOT already surfaced in
          the hero (convertProv) or the equity table. Compact "Provisions in
          this section" styling (matches the universal summary-table footer /
          Termination Fees page) rather than the old full-width link list. */}
      {(() => {
        const summarizedIds = new Set();
        if (convertProv) summarizedIds.add(convertProv.id);
        for (const r of equityRows) {
          if (r.provision && r.provision.id) summarizedIds.add(r.provision.id);
        }
        const leftover = otherProvisions.filter((p) => !summarizedIds.has(p.id));
        if (leftover.length === 0) return null;
        return (
          <div className="bg-bg/40 border border-border rounded-lg px-3 py-2">
            <p className="text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider mb-1.5">
              Other Provisions in this Section
            </p>
            <ul className="flex flex-wrap gap-x-3 gap-y-1">
              {leftover.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onSelectProvision && onSelectProvision(p)}
                    className="text-xs font-ui text-accent hover:underline"
                  >
                    {p.category || 'General'}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })()}
    </div>
  );
}

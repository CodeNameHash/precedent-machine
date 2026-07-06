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
  NotIncludedStrip,
} from './shared';
import { AddSectionItem } from './AddSectionItem';
import { TermCell } from './TermCell';
import ElectionCard from './ElectionCard';
import {
  buildPerShareParts,
  deriveHeadlineConsiderationType,
  headlineConsiderationLabel,
} from './table-logic';

function absentEquityInstrumentLabels() {
  return [];
}

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

function isConsidEquityProvision(p) {
  const treatmentRows = Array.isArray(p?.consideration_equity?.treatments)
    ? p.consideration_equity.treatments
    : [];
  if (treatmentRows.length > 0) return true;
  const meta = getAiMetadata(p) || {};
  if (meta.code === 'CONSID-EQUITY') return true;
  return false;
}

function treatmentInstrumentLabel(treatment) {
  const code = String(treatment.instrument_type || treatment.instrumentType || '').toUpperCase();
  const labels = {
    STOCK_OPTIONS: 'Stock Options',
    RSA: 'Restricted Stock Awards',
    RSU: 'Restricted Stock Units (RSUs)',
    PSU: 'Performance Stock Units (PSUs)',
    ESPP: 'Employee Stock Purchase Plan rights',
    SAR: 'Stock Appreciation Rights',
    PHANTOM_STOCK: 'Phantom Stock',
    DSU: 'Deferred Stock Units',
    DIRECTOR_EQUITY: 'Director Equity',
    OTHER_EQUITY: 'Other Equity',
  };
  return labels[code] || humanizeBadgeText(code || 'Instrument');
}

// Build the equity-award rows from WP-SCHEMA-01 treatment rows only. Legacy
// instrument arrays are deliberately ignored so stale parser features cannot
// surface phantom instruments.
export function buildEquityRows(equityProvisions) {
  const rows = [];
  for (const p of equityProvisions) {
    const treatmentPayload = p.consideration_equity || null;
    const treatmentRows = Array.isArray(treatmentPayload?.treatments) ? treatmentPayload.treatments : [];
    if (treatmentRows.length > 0) {
      treatmentRows.forEach((t, i) => {
        rows.push({
          key: `${p.id}-treatment-${t.id || i}`,
          provision: p,
          instrument: {
            code: t.instrument_type || t.instrumentType,
            label: treatmentInstrumentLabel(t),
          },
          treatment: t.consideration_type || t.considerationType || null,
          vesting: t.vesting_treatment || t.vestingTreatment || null,
          performance: t.performance_treatment || t.performanceTreatment || null,
          cashFormula: t.cash_formula || t.cashFormula || null,
          stockFormula: t.stock_formula || t.stockFormula || null,
          inTheMoneyOnly: t.in_the_money_only ?? t.inTheMoneyOnly ?? null,
          spanType: t.span_type || t.spanType || null,
          grouping: treatmentPayload.treatment_grouping || treatmentPayload.treatmentGrouping || null,
          quote: t.verbatim_quote || t.verbatimQuote || null,
          cutoff: null,
        });
      });
      continue;
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

function isPsuRow(row) {
  const code = isTaggedItem(row.instrument)
    ? String(row.instrument.code || '').toUpperCase()
    : String(row.instrument || '').toUpperCase();
  const label = isTaggedItem(row.instrument)
    ? String(row.instrument.label || '')
    : String(row.instrument || '');
  return code === 'PSU' || /performance\s+stock\s+units?|\bpsus?\b/i.test(label);
}

function performanceTreatmentLabel(value, quote) {
  if (value === null || value === undefined || value === '') return null;
  const code = String(isTaggedItem(value) ? value.code || value.label || '' : value).toUpperCase();
  const source = String(quote || value || '');
  if (/\bgreater\s+of\b/i.test(source) && /target/i.test(source) && /actual/i.test(source)) {
    return 'Greater of target or actual';
  }
  if (/\bhigher\s+of\b/i.test(source) && /target/i.test(source) && /actual/i.test(source)) {
    return 'Greater of target or actual';
  }
  const labels = {
    DEEMED_TARGET: 'Target performance',
    DEEMED_MAXIMUM: 'Maximum performance',
    ACTUAL_PERFORMANCE: 'Actual performance',
    PRO_RATA: 'Pro rata',
    BOARD_DETERMINATION: 'Board determination',
    N_A: 'Not specified',
  };
  return labels[code] || humanizeBadgeText(code || String(value));
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
    const text = /^[A-Z0-9_]+$/.test(String(v)) ? humanizeBadgeText(String(v)) : String(v);
    return <div className="line-clamp-2">{renderWithAmountPills(text)}</div>;
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
          Employee equity treatment
        </p>
      </div>
      <div className="p-3 space-y-2">
        {rows.map((row) => {
          const instLabel = isTaggedItem(row.instrument)
            ? (row.instrument.label || resolveTaggedLabel('instrumentType', row.instrument) || humanizeBadgeText(row.instrument.code))
            : String(row.instrument || 'Instrument');
          const rowQuote = row.quote
            || evidenceQuote(row.treatment, { fallbackToFullText: false })
            || evidenceQuote(row.vesting, { fallbackToFullText: false })
            || evidenceQuote(row.performance, { fallbackToFullText: false })
            || evidenceQuote(null, { provision: row.provision });
          const psuPerformance = isPsuRow(row)
            ? performanceTreatmentLabel(row.performance, rowQuote)
            : null;
          return (
            <div key={row.key} className="border border-border rounded-lg bg-bg/20 p-3">
              <div className="flex items-start justify-between gap-2">
                <TermCell provision={row.provision} quote={rowQuote}>
                  <HoverSource quote={rowQuote}>
                    <span className="text-left text-accent hover:underline font-semibold text-sm">
                      {instLabel}
                    </span>
                  </HoverSource>
                </TermCell>
                {row.grouping ? (
                  <span className="text-[10px] font-ui uppercase tracking-wider text-inkFaint border border-border rounded px-1.5 py-0.5 bg-white">
                    {humanizeBadgeText(row.grouping)}
                  </span>
                ) : null}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 mt-2 text-xs font-ui">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-inkFaint mb-0.5">Consideration</p>
                  <HoverSource quote={rowQuote} as="div">{renderTagged(row.treatment, 'equityTreatment')}</HoverSource>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-inkFaint mb-0.5">Vesting</p>
                  <HoverSource quote={rowQuote} as="div">{renderTagged(row.vesting, 'vestingAcceleration')}</HoverSource>
                </div>
                {psuPerformance ? (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-inkFaint mb-0.5">Performance</p>
                    <HoverSource quote={rowQuote} as="div" className="text-ink">{psuPerformance}</HoverSource>
                  </div>
                ) : null}
                {row.cashFormula ? (
                  <div className="sm:col-span-2">
                    <p className="text-[10px] uppercase tracking-wider text-inkFaint mb-0.5">Cash Formula</p>
                    <HoverSource quote={rowQuote} as="div" className="text-ink">{renderWithAmountPills(row.cashFormula)}</HoverSource>
                  </div>
                ) : null}
                {row.stockFormula ? (
                  <div className="sm:col-span-2">
                    <p className="text-[10px] uppercase tracking-wider text-inkFaint mb-0.5">Stock Formula</p>
                    <HoverSource quote={rowQuote} as="div" className="text-ink">{row.stockFormula}</HoverSource>
                  </div>
                ) : null}
                {row.inTheMoneyOnly !== null && row.inTheMoneyOnly !== undefined ? (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-inkFaint mb-0.5">ITM Only</p>
                    <span className="text-ink">{row.inTheMoneyOnly ? 'Yes' : 'No'}</span>
                  </div>
                ) : null}
                {row.spanType ? (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-inkFaint mb-0.5">Source Span</p>
                    <span className="text-ink">{humanizeBadgeText(row.spanType)}</span>
                  </div>
                ) : null}
                {optionsCvrEarnInLabel && isOptionsRow(row) ? (
                  <div className="sm:col-span-2">
                    <HoverSource quote={optionsCvrEarnInQuote || rowQuote}>
                      <span className="inline-flex items-center font-ui font-medium text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-200">
                        {optionsCvrEarnInLabel}
                      </span>
                    </HoverSource>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
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
  const electionProvisions = equityProvisions.filter((p) => p.consideration_equity && p.consideration_equity.election_mechanism);

  const equityRows = buildEquityRows(equityProvisions);

  // Find the CONSID-CONVERT provision (carries the headline per-share amount).
  let convertProv = provisions.find(isConsidConvertProvision);
  if (!convertProv) {
    convertProv = otherProvisions.find((p) => {
      const f = getStructuredFeatures(p) || {};
      return f.perShareAmount || f.considerationType;
    }) || otherProvisions[0] || null;
  }
  const employeeEquityRows = equityRows.filter((r) => {
    const code = isTaggedItem(r.instrument) ? String(r.instrument.code || '').toUpperCase() : String(r.instrument || '').toUpperCase();
    const label = isTaggedItem(r.instrument) ? String(r.instrument.label || '') : String(r.instrument || '');
    return code !== 'COMMON_STOCK' && !/^common\s+stock$/i.test(label.trim());
  });

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
      heroConsidType = resolveConsidTypeLabel(f.considerationType);
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
  const headlineType = deriveHeadlineConsiderationType(provisions);
  const headlineTypeLabel = headlineConsiderationLabel(headlineType, provisions);

  // Audit-2 item 6(a): a raw enum value (e.g. "FIXED", "MIXED_ELECTION")
  // with no {code,label} tagged wrapper used to render verbatim via
  // String(raw) — route it through prettifyEnumValue's bare-enum guard
  // (humanizes UPPER_SNAKE tokens; a per-key taxonomy dict, when one is
  // registered for featureKey, wins) so every enum leak in this table gets
  // the same treatment table cells get everywhere else.
  const fieldValue = (raw, featureKey) => {
    if (raw === null || raw === undefined || raw === '') return null;
    if (isCitableValue(raw)) return fieldValue(getCitableValue(raw), featureKey);
    if (isTaggedItem(raw)) return raw.label || raw.code || null;
    if (typeof raw === 'boolean') return raw ? 'Yes' : 'No';
    return prettifyEnumValue(featureKey, String(raw));
  };

  const stockRows = [];
  const pushStockRow = (label, raw, provision, focus, featureKey) => {
    const value = fieldValue(raw, featureKey);
    if (!value) return;
    stockRows.push({
      label,
      value,
      provisionId: provision && provision.id,
      quote: evidenceQuote(raw, { provision, focusOn: focus || value }),
    });
  };
  const pushObjectRows = (prefix, obj, provision, fields) => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
    const quote = evidenceQuote(obj, { provision }) || obj.text || null;
    for (const [key, label] of fields) {
      pushStockRow(`${prefix} — ${label}`, obj[key], provision, null, key);
    }
    if (obj.text) {
      stockRows.push({ label: `${prefix} — Text`, value: String(obj.text), quote });
    }
  };
  for (const p of provisions) {
    const f = getStructuredFeatures(p) || {};
    pushStockRow('Exchange Ratio Type', f.exchangeRatioType ?? f.ratioType, p, null, 'ratioType');
    pushStockRow('Exchange Ratio Formula', f.exchangeRatioText, p);
    pushObjectRows('Collar', f.collar, p, [
      ['present', 'Present'],
      ['type', 'Type'],
      ['floor', 'Floor'],
      ['cap', 'Cap'],
    ]);
    pushObjectRows('Walk-Away Right', f.walkAwayRight, p, [
      ['present', 'Present'],
      ['party', 'Party'],
      ['trigger', 'Trigger'],
      ['fillOrKillOption', 'Fill-or-kill option'],
    ]);
    pushObjectRows('Proration', f.prorationMechanics, p, [
      ['electionType', 'Election Type'],
      ['oversubscriptionTreatment', 'Oversubscription'],
      ['electionDeadline', 'Election Deadline'],
    ]);
    pushStockRow('Dividend Equivalence', f.dividendEquivalence, p);
    if (f.taxReorgIntended !== null && f.taxReorgIntended !== undefined) {
      pushStockRow('Tax Reorg Intended', f.taxReorgIntended, p);
    }
    pushStockRow('Tax Reorg Text', f.taxReorgText, p);
  }
  // Audit-2 item 6(b): dedupe by provision id AND normalized label — not
  // just label+value — so a duplicate PROVISION entry (the Cooper "Dividend
  // Equivalence" double row: the same provision.id appearing twice in the
  // source array) collapses even when its value shape differs trivially
  // (citable wrapper vs. plain, whitespace) between the two occurrences.
  const seenStockRows = new Set();
  const dedupedStockRows = stockRows.filter((row) => {
    const normalizedLabel = String(row.label || '').trim().toLowerCase();
    const key = `${row.provisionId || ''}::${normalizedLabel}`;
    if (seenStockRows.has(key)) return false;
    seenStockRows.add(key);
    return true;
  });

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
            <div className="px-3 py-2 bg-bg/60 border-b border-border flex items-center justify-between gap-2 flex-wrap">
              <p className="text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider">
                Headline Consideration
              </p>
              {headlineTypeLabel && (
                <span className="inline-flex items-center gap-1 text-[10px] font-ui font-medium px-1.5 py-0.5 rounded border bg-emerald-50 text-emerald-700 border-emerald-200">
                  Consideration: {headlineTypeLabel}
                </span>
              )}
            </div>
            <table className="min-w-full text-xs font-ui">
              <tbody className="divide-y divide-border">
                {heroRows.map((row) => {
                  const rowQuote = row.src && row.src.quote ? row.src.quote : null;
                  return (
                    <tr key={row.label} className="hover:bg-bg/40 transition-colors align-top">
                      <td className={`px-3 py-2 whitespace-normal break-words ${REVIEW_LABEL_COL_W}`}>
                        <TermCell provision={row.src && row.src.provision} quote={rowQuote}>
                          {rowQuote ? (
                            <HoverSource quote={rowQuote}>
                              <span className="text-left text-accent hover:underline font-medium">
                                {row.label}
                              </span>
                            </HoverSource>
                          ) : (
                            <span className="text-ink font-medium">{row.label}</span>
                          )}
                        </TermCell>
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

      {dedupedStockRows.length > 0 && (
        <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
          <div className="px-3 py-2 bg-bg/60 border-b border-border">
            <p className="text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider">
              Stock Consideration Mechanics
            </p>
          </div>
          <table className="min-w-full text-xs font-ui">
            <tbody className="divide-y divide-border">
              {dedupedStockRows.map((row) => (
                <tr key={`${row.label}-${row.value}`} className="hover:bg-bg/40 transition-colors align-top">
                  <td className={`px-3 py-2 whitespace-normal break-words text-ink font-medium ${REVIEW_LABEL_COL_W}`}>
                    {row.label}
                  </td>
                  <td className="px-3 py-2 text-ink">
                    <HoverSource quote={row.quote} as="div">
                      <span>{row.value}</span>
                    </HoverSource>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {electionProvisions.map((p) => (
        <ElectionCard key={`election-${p.id}`} election={p.consideration_equity.election_mechanism} />
      ))}

      {employeeEquityRows.length > 0 && (
        <>
          {(() => {
            const stepRows = employeeEquityRows.filter((row) => row.provision?.consideration_equity?.transaction_step);
            const stepIds = [...new Set(stepRows.map((row) => row.provision.consideration_equity.transaction_step.id).filter(Boolean))];
            if (stepIds.length <= 1) {
              return (
                <EquityAwardTable
                  rows={employeeEquityRows}
                  onSelectProvision={onSelectProvision}
                  onAddProvision={onAddProvision}
                  optionsCvrEarnInLabel={optionsCvrEarnInLabel}
                  optionsCvrEarnInQuote={optionsCvrEarnInSrc && optionsCvrEarnInSrc.quote}
                />
              );
            }
            return (
              <div className="space-y-2">
                {stepIds.map((stepId, index) => {
                  const rowsForStep = employeeEquityRows.filter((row) => row.provision?.consideration_equity?.transaction_step?.id === stepId);
                  const step = rowsForStep[0]?.provision?.consideration_equity?.transaction_step || {};
                  return (
                    <details key={stepId} open={index === 0} className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
                      <summary className="cursor-pointer px-3 py-2 bg-lime-50 border-b border-border text-[10px] font-ui font-medium text-lime-900 uppercase tracking-wider">
                        Step {step.step_order || index + 1} — {humanizeBadgeText(step.step_kind || 'Merger')}
                      </summary>
                      <div className="p-3">
                        {rowsForStep.length > 0 ? (
                          <EquityAwardTable
                            rows={rowsForStep}
                            onSelectProvision={onSelectProvision}
                            onAddProvision={onAddProvision}
                            optionsCvrEarnInLabel={optionsCvrEarnInLabel}
                            optionsCvrEarnInQuote={optionsCvrEarnInSrc && optionsCvrEarnInSrc.quote}
                          />
                        ) : (
                          <p className="text-xs font-ui text-inkLight">Share cancellation only.</p>
                        )}
                      </div>
                    </details>
                  );
                })}
              </div>
            );
          })()}
          <NotIncludedStrip
            noun="equity instruments"
            items={absentEquityInstrumentLabels(employeeEquityRows)}
          />
        </>
      )}

      {/* Other provisions in this section — only those NOT already surfaced in
          the hero (convertProv) or the equity table. Compact "Provisions in
          this section" styling (matches the universal summary-table footer /
          Termination Fees page) rather than the old full-width link list. */}
      {(() => {
        const summarizedIds = new Set();
        if (convertProv) summarizedIds.add(convertProv.id);
        for (const r of employeeEquityRows) {
          if (r.provision && r.provision.id) summarizedIds.add(r.provision.id);
        }
        const leftover = otherProvisions.filter((p) => !summarizedIds.has(p.id));
        if (leftover.length === 0) return null;
        return (
          <div className="bg-bg/40 border border-border rounded-lg px-3 py-2">
            <p className="text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider mb-1.5">
              Other provisions in this section
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

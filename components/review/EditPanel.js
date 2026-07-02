import { useState, useEffect, useMemo, useCallback } from 'react';
import { taxonomyForFeatureKey, isListTaxonomyKey } from '../../lib/taxonomy';
import {
  getStructuredFeatures,
  isTaggedItem,
  isCitableValue,
  getCitableValue,
  getCitableText,
  getCitableQuotes,
} from '../../lib/citable';
import { getFeaturesForType } from '../../lib/rubric';
import { resolveEditFields } from '../../lib/edit-schema';
import { isCanonicalCode } from '../../lib/expected-sets';
import {
  useEvidenceSelectionMode,
  useShowEvidence,
  humanizeBadgeText,
  typeColor,
  typeLabel,
  useCustomTaxonomy,
  getCustomExtensionsForKey,
  getFeatures,
  isEmptyValue,
  humanizeKey,
} from './shared';

/* ═══════════════════════════════════════════════════════════
   FEATURE FIELD EDITOR
   Renders an editable input matched to a rubric feature schema entry.
   Supported types: text, boolean, enum, tagged, list, list-tagged,
   currency, percentage, duration, object, tiers (and unknown → JSON).
   ═══════════════════════════════════════════════════════════ */
// Constant marker for the "Other / not applicable" escape hatch. We store
// the picker selection as this sentinel and emit a free-text payload only
// when the user explicitly opts into it. We deliberately do NOT silently
// fall back to text when a taxonomy is available — the user has to choose.
const EDIT_OTHER_CODE = '__OTHER__';

function FeatureFieldEditor({ field, value, onChange, onAddCustomOption }) {
  const label = humanizeKey(field.key);
  // Evidence selection-mode (called once at the top so renderTaggedPicker can
  // offer "Select in document" for each tagged item's verbatim citation —
  // Rules of Hooks: must run unconditionally, not inside a branch).
  const fieldSelectionCtx = useEvidenceSelectionMode();
  const baseTaxonomy = taxonomyForFeatureKey(field.key);
  // P5 item 8: merge canonical taxonomy with deal-scoped custom extensions.
  const customExtensions = useCustomTaxonomy();
  const customForKey = getCustomExtensionsForKey(customExtensions, field.key);
  const taxonomy = useMemo(() => {
    if (!baseTaxonomy) return null;
    const merged = { ...baseTaxonomy };
    for (const ext of customForKey) {
      if (ext && ext.code && !merged[ext.code]) {
        merged[ext.code] = ext.label || ext.code;
      }
    }
    return merged;
  }, [baseTaxonomy, customForKey]);
  const customCodeSet = useMemo(
    () => new Set(customForKey.map((e) => e && e.code).filter(Boolean)),
    [customForKey],
  );
  const taxonomyEntries = taxonomy ? Object.entries(taxonomy) : null;

  // Materiality qualifier — render as a presence checkbox + standard picker
  // (user request) instead of the generic tagged-pill picker. Ticking the box
  // applies a materiality qualifier (default: MAE-level); the dropdown chooses
  // the specific standard. Unticking clears it. Writes the citable tagged shape
  // { value: { code, label }, quotes } that standardCodeFromValue already reads.
  if (field.key === 'materialityQualifier' || field.key === 'materiality_qualifier') {
    const STANDARDS = [
      'MAT_MAE_AGGREGATE', 'MAT_MAE_QUALIFIED', 'MAT_MATERIAL_TO_COMPANY',
      'MAT_ALL_MATERIAL', 'MAT_ALL_RESPECTS', 'MAT_ALL_RESPECTS_DE_MINIMIS',
      'MAT_DE_MINIMIS', 'MAT_MATERIAL_INLINE',
    ];
    const labelFor = (c) => (taxonomy && taxonomy[c]) || c;
    const inner = isCitableValue(value) ? getCitableValue(value) : value;
    const cur = inner
      ? (isTaggedItem(inner) ? String(inner.code || '').toUpperCase() : (typeof inner === 'string' ? inner.toUpperCase() : null))
      : null;
    const quotes = value && isCitableValue(value) && Array.isArray(value.quotes) ? value.quotes : [];
    const present = !!cur && cur !== 'MAT_NO_QUALIFIER';
    const write = (code) => onChange(code ? { value: { code, label: labelFor(code) }, quotes } : null);
    return (
      <div className="space-y-1">
        <p className="text-xs font-ui text-inkLight mb-1">{label}</p>
        <label className="flex items-center gap-2 text-xs font-ui text-ink cursor-pointer">
          <input
            type="checkbox"
            checked={present}
            onChange={(e) => write(e.target.checked ? (present ? cur : 'MAT_MAE_AGGREGATE') : null)}
          />
          Has materiality qualifier
        </label>
        {present && (
          <select
            value={STANDARDS.includes(cur) ? cur : ''}
            onChange={(e) => write(e.target.value)}
            className="w-full border border-border rounded px-2 py-1 text-[11px] font-ui focus:outline-none focus:ring-1 focus:ring-accent"
          >
            {!STANDARDS.includes(cur) && <option value="">{labelFor(cur)} (current)</option>}
            {STANDARDS.map((c) => (
              <option key={c} value={c}>{labelFor(c)}</option>
            ))}
          </select>
        )}
      </div>
    );
  }

  // Citable fields are edited as { value, quotes: [...] } (back-compat with
  // legacy { value, text } shape). The picker / input below edits the INNER
  // value; a stack of textareas beneath edits the verbatim quote list. We
  // delegate to a recursive editor by unwrapping the value, swapping in a
  // wrapping onChange that re-builds { value, quotes: [...] }.
  // P4 task 4: replace the single evidence textarea with a vertical multi-
  // quote list + "Add quote" button + per-quote Remove (×) control.
  if (field.citable && !taxonomy) {
    // Normalize the stored shape to { value, quotes: [...] }.
    const normalize = (v) => {
      if (v === null || v === undefined) return { value: null, quotes: [] };
      if (isCitableValue(v)) {
        if (Array.isArray(v.quotes)) {
          return { value: v.value, quotes: v.quotes.filter((q) => typeof q === 'string') };
        }
        if (typeof v.text === 'string') {
          return { value: v.value, quotes: v.text ? [v.text] : [] };
        }
        return { value: v.value, quotes: [] };
      }
      // Bare value → wrap.
      return { value: v, quotes: [] };
    };
    const wrapped = normalize(value);

    const serialize = (nextValue, nextQuotes) => {
      const clean = (nextQuotes || []).map((q) => String(q || '')).map((q) => q);
      const nonEmpty = clean.filter((q) => q.trim().length > 0);
      // If both value and quotes are empty, return null so the field clears.
      if ((nextValue === null || nextValue === undefined || nextValue === '') && nonEmpty.length === 0) {
        return null;
      }
      return { value: nextValue ?? null, quotes: nonEmpty };
    };

    const innerField = { ...field, citable: false };
    const onInnerChange = (next) => {
      onChange(serialize(next, wrapped.quotes));
    };
    const removeQuoteAt = (idx) => {
      const next = wrapped.quotes.filter((_, i) => i !== idx);
      onChange(serialize(wrapped.value, next));
    };

    // P5 item 7: evidence is added EXCLUSIVELY by selecting text in the
    // FullDocumentView (selection mode). The chip below each evidence entry
    // shows the quote (truncated) with a × Remove affordance. Legacy
    // typed-text evidence still renders as chips — re-edit requires
    // re-selection in the doc.
    const evidenceCtx = useEvidenceSelectionMode();
    const startSelectionMode = evidenceCtx && evidenceCtx.startSelectionMode;
    const fieldLabel = humanizeKey(field.key);
    const handleAddEvidence = () => {
      if (!startSelectionMode) return;
      startSelectionMode({
        label: fieldLabel,
        onSelect: (text) => {
          if (!text || !text.trim()) return;
          const next = [...wrapped.quotes, text.trim()];
          onChange(serialize(wrapped.value, next));
        },
      });
    };

    const truncate = (s, n = 80) => {
      const t = String(s || '').trim().replace(/\s+/g, ' ');
      return t.length > n ? t.slice(0, n) + '…' : t;
    };

    return (
      <div className="space-y-1">
        <FeatureFieldEditor field={innerField} value={wrapped.value} onChange={onInnerChange} onAddCustomOption={onAddCustomOption} />
        <label className="block text-[10px] font-ui text-amber-700 italic">
          Evidence (verbatim quotes from the agreement)
        </label>
        <div className="space-y-1">
          {wrapped.quotes.length === 0 && (
            <p className="text-[10px] font-ui italic text-inkFaint">No evidence selected yet.</p>
          )}
          {wrapped.quotes.map((q, idx) => (
            <div
              key={idx}
              className="flex items-start gap-1 border border-amber-200 bg-amber-50/40 rounded px-2 py-1"
              title={q}
            >
              <span className="text-[11px] font-ui text-amber-900 flex-1 break-words">
                {truncate(q)}
              </span>
              <button
                type="button"
                onClick={() => removeQuoteAt(idx)}
                className="w-5 h-5 inline-flex items-center justify-center rounded text-amber-600 hover:bg-amber-100 hover:text-amber-800 text-xs font-ui shrink-0"
                title="Remove this quote"
                aria-label="Remove quote"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={handleAddEvidence}
          disabled={!startSelectionMode}
          className="mt-1 inline-flex items-center gap-1 text-[10px] font-ui text-amber-700 hover:text-amber-900 hover:underline disabled:opacity-50"
        >
          + Add evidence (select in document)
        </button>
      </div>
    );
  }

  // Decide effective input type. Editor enforcement rules:
  //   1. If the field key has a taxonomy dictionary, ALWAYS render a picker
  //      (single or list). Free text is only available via an explicit
  //      "Other / not applicable" escape hatch.
  //   2. If the rubric declares type: 'enum' with options:[...], render a
  //      <select> of those options. Same Other escape hatch.
  //   3. Otherwise honor the rubric type.
  let effType = field.type || 'text';
  if (taxonomy && (effType === 'list' || effType === 'list-tagged' || isListTaxonomyKey(field.key))) {
    effType = 'list-tagged';
  } else if (taxonomy) {
    // single tagged. Covers type: 'text' on a taxonomy-backed key too — the
    // editor must force the picker, even if the legacy schema says text.
    effType = 'tagged';
  }

  const labelEl = (
    <label className="block text-[11px] font-ui text-inkLight mb-0.5" title={field.label || label}>
      {label}
    </label>
  );

  // ── Helper renderer: code picker + Other escape hatch ────────────────
  // Used by both the single-tagged and list-tagged paths. `current` is the
  // current item ({code,label,text} or null). `onPick` is called with the
  // next item (or null when cleared).
  const renderTaggedPicker = (current, onPick, opts = {}) => {
    const small = !!opts.small;
    const inputCls = small
      ? 'w-full border border-border rounded px-1.5 py-0.5 text-[11px] font-ui focus:outline-none focus:ring-1 focus:ring-accent bg-white'
      : 'w-full border border-border rounded px-2 py-1 text-xs font-ui focus:outline-none focus:ring-1 focus:ring-accent bg-white';
    const txtCls = small
      ? 'flex-1 border border-border rounded px-1.5 py-0.5 text-[11px] font-ui focus:outline-none focus:ring-1 focus:ring-accent'
      : 'w-full border border-border rounded px-2 py-1 text-xs font-ui focus:outline-none focus:ring-1 focus:ring-accent';

    const item = current && typeof current === 'object'
      ? current
      : { code: '', label: '', text: '' };

    // Has the user opted into Other-mode for this row? We detect it from
    // the stored item: code === EDIT_OTHER_CODE OR (code is empty but text
    // is non-empty AND not a known dictionary code).
    const hasKnownCode = !!(item.code && taxonomy && taxonomy[item.code]);
    const isOther = item.code === EDIT_OTHER_CODE || (!hasKnownCode && !!item.text);

    const pickValue = isOther ? EDIT_OTHER_CODE : (item.code || '');

    return (
      <div className="space-y-1">
        <select
          value={pickValue}
          onChange={(e) => {
            const choice = e.target.value;
            if (choice === '') {
              // cleared — drop the item
              onPick(null);
              return;
            }
            if (choice === EDIT_OTHER_CODE) {
              onPick({ ...item, code: EDIT_OTHER_CODE, label: 'Other / not applicable' });
              return;
            }
            // a real dictionary code
            onPick({ ...item, code: choice, label: (taxonomy && taxonomy[choice]) || '' });
          }}
          className={inputCls}
        >
          <option value="">-- select --</option>
          {taxonomyEntries && taxonomyEntries.map(([code, lbl]) => (
            <option key={code} value={code}>
              {lbl || humanizeBadgeText(code)}{customCodeSet.has(code) ? ' (custom)' : ''}
            </option>
          ))}
          <option value={EDIT_OTHER_CODE}>-- Other / not applicable (free text) --</option>
        </select>
        {/* P5 item 8: add canonical option button — replaces the "Other" escape
            hatch as the primary way to introduce a deal-specific code. The
            parent FeatureFieldEditor wires the actual taxonomy-extension save. */}
        {onAddCustomOption && (
          <button
            type="button"
            onClick={() => onAddCustomOption(field.key)}
            className="text-[10px] font-ui text-accent hover:underline"
          >
            + Add canonical option
          </button>
        )}
        {isOther && (
          <p className="text-[10px] font-ui text-amber-700 italic">
            Other selected. This value will not be comparable across deals.
          </p>
        )}
        {/* Verbatim citation: show the highlighted source text (read display) +
            a "Select in document" affordance — NOT a free-form box. Selecting
            text in the FullDocumentView sets this item's verbatim quote. */}
        {(() => {
          const startSel = fieldSelectionCtx && fieldSelectionCtx.startSelectionMode;
          const setItemText = (text) => {
            const t = (text || '').trim();
            const nextCode = item.code || (t ? EDIT_OTHER_CODE : '');
            const nextLabel = nextCode === EDIT_OTHER_CODE
              ? 'Other / not applicable'
              : (taxonomy && taxonomy[nextCode]) || item.label || '';
            onPick(t || nextCode ? { ...item, code: nextCode, label: nextLabel, text: t } : null);
          };
          return (
            <div className="space-y-1">
              {item.text ? (
                <div className="border border-amber-200 bg-amber-50/40 rounded px-2 py-1 text-[11px] font-ui text-amber-900 italic break-words">
                  &ldquo;{item.text}&rdquo;
                </div>
              ) : (
                <p className="text-[10px] font-ui italic text-inkFaint">No source text cited yet.</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!startSel) return;
                    startSel({
                      label: (taxonomy && taxonomy[item.code]) || item.label || field.key,
                      onSelect: (text) => setItemText(text),
                    });
                  }}
                  disabled={!startSel}
                  className="text-[10px] font-ui text-amber-700 hover:text-amber-900 hover:underline disabled:opacity-50"
                >
                  {item.text ? 'Re-select in document' : '+ Select in document'}
                </button>
                {item.text && (
                  <button
                    type="button"
                    onClick={() => setItemText('')}
                    className="text-[10px] font-ui text-inkFaint hover:text-seller"
                  >
                    Clear text
                  </button>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    );
  };

  // Boolean
  if (effType === 'boolean') {
    const checked = value === true;
    return (
      <div>
        <label className="flex items-center gap-2 text-xs font-ui text-ink cursor-pointer">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            className="rounded border-border focus:ring-1 focus:ring-accent"
          />
          <span title={field.label || label}>{label}</span>
        </label>
      </div>
    );
  }

  // Enum (no taxonomy, plain options[]) — render select w/ Other escape hatch.
  if (effType === 'enum' && Array.isArray(field.options)) {
    // Options come in two shapes: bare code strings (['ONE_STEP_MERGER', …])
    // or curated { value, label } objects (edit-schema selects). Normalize to
    // { value, label } and DISPLAY a humanized label while the stored value
    // stays the raw code. ONE_STEP_MERGER → "One Step Merger".
    const opts = field.options
      .map((opt) => (opt && typeof opt === 'object'
        ? { value: opt.value, label: opt.label || humanizeBadgeText(opt.value) }
        : { value: opt, label: humanizeBadgeText(opt) }))
      .filter((o) => o.value != null && o.value !== '');
    // Unwrap a citable-wrapped scalar so the picker matches on (and displays)
    // the inner code instead of falling through to "[object Object]".
    const rawValue = isCitableValue(value) ? getCitableValue(value) : value;
    const isKnown = opts.some((o) => o.value === rawValue);
    const isOther = !isKnown && rawValue != null && rawValue !== '';
    const pickValue = isOther ? EDIT_OTHER_CODE : (rawValue == null ? '' : String(rawValue));
    return (
      <div className="space-y-1">
        {labelEl}
        <select
          value={pickValue}
          onChange={(e) => {
            const choice = e.target.value;
            if (choice === '') return onChange(null);
            if (choice === EDIT_OTHER_CODE) {
              onChange(typeof rawValue === 'string' ? rawValue : '');
              return;
            }
            onChange(choice);
          }}
          className="w-full border border-border rounded px-2 py-1 text-xs font-ui focus:outline-none focus:ring-1 focus:ring-accent bg-white"
        >
          <option value="">--</option>
          {opts.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
          <option value={EDIT_OTHER_CODE}>-- Other / not applicable (free text) --</option>
        </select>
        {isOther && (
          <>
            <p className="text-[10px] font-ui text-amber-700 italic">
              Other selected. This value will not be comparable across deals.
            </p>
            <input
              value={rawValue == null ? '' : String(rawValue)}
              onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
              placeholder="Free-text value..."
              className="w-full border border-border rounded px-2 py-1 text-xs font-ui focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </>
        )}
      </div>
    );
  }

  // Single tagged value: { code, label, text } — taxonomy-enforced picker.
  if (effType === 'tagged') {
    const item = isTaggedItem(value)
      ? value
      : (value && typeof value === 'string'
        ? { code: EDIT_OTHER_CODE, label: 'Other / not applicable', text: value }
        : { code: '', label: '', text: '' });
    return (
      <div>
        {labelEl}
        {taxonomyEntries
          ? renderTaggedPicker(item, (next) => onChange(next), { small: false })
          : (
            // No taxonomy in scope — fall back to plain text input but with
            // the tagged shape so the rest of the renderer is consistent.
            <input
              value={item.text || ''}
              onChange={(e) => {
                const text = e.target.value;
                onChange(text ? { code: '', label: '', text } : null);
              }}
              placeholder="Verbatim text from agreement..."
              className="w-full border border-border rounded px-2 py-1 text-xs font-ui focus:outline-none focus:ring-1 focus:ring-accent"
            />
          )}
      </div>
    );
  }

  // List of tagged items — each item gets its own picker.
  if (effType === 'list-tagged') {
    const items = Array.isArray(value) ? value : [];
    const update = (idx, next) => {
      const copy = items.slice();
      if (next === null) copy.splice(idx, 1);
      else copy[idx] = next;
      onChange(copy);
    };
    const add = () => onChange([...items, { code: '', label: '', text: '' }]);
    return (
      <div>
        {labelEl}
        <div className="space-y-1.5">
          {items.length === 0 && (
            <p className="text-[11px] font-ui text-inkFaint italic">None</p>
          )}
          {items.map((it, idx) => {
            const itemObj = isTaggedItem(it)
              ? it
              : (typeof it === 'string'
                ? { code: EDIT_OTHER_CODE, label: 'Other / not applicable', text: it }
                : { code: '', label: '', text: '' });
            return (
              <div key={idx} className="border border-border rounded p-1.5 space-y-1 bg-white">
                {taxonomyEntries
                  ? renderTaggedPicker(itemObj, (next) => update(idx, next), { small: true })
                  : (
                    <input
                      value={itemObj.text || ''}
                      onChange={(e) => update(idx, { ...itemObj, text: e.target.value })}
                      placeholder="Verbatim text..."
                      className="w-full border border-border rounded px-1.5 py-0.5 text-[11px] font-ui focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  )}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => update(idx, null)}
                    className="px-1.5 py-0.5 text-[11px] font-ui text-inkFaint hover:text-seller border border-border rounded"
                    title="Remove"
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
          <button
            type="button"
            onClick={add}
            className="w-full px-2 py-1 text-[11px] font-ui border border-dashed border-border text-inkMid rounded hover:bg-bg/50 transition-colors"
          >
            + Add item
          </button>
        </div>
      </div>
    );
  }

  // Plain list (strings)
  if (effType === 'list') {
    const items = Array.isArray(value) ? value : [];
    const update = (idx, next) => {
      const copy = items.slice();
      if (next === null) copy.splice(idx, 1);
      else copy[idx] = next;
      onChange(copy);
    };
    return (
      <div>
        {labelEl}
        <div className="space-y-1">
          {items.length === 0 && (
            <p className="text-[11px] font-ui text-inkFaint italic">None</p>
          )}
          {items.map((it, idx) => (
            <div key={idx} className="flex gap-1">
              <input
                value={typeof it === 'string' ? it : (it == null ? '' : JSON.stringify(it))}
                onChange={(e) => update(idx, e.target.value)}
                className="flex-1 border border-border rounded px-2 py-1 text-xs font-ui focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <button
                type="button"
                onClick={() => update(idx, null)}
                className="px-1.5 py-0.5 text-[11px] font-ui text-inkFaint hover:text-seller border border-border rounded"
                title="Remove"
              >
                x
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => onChange([...items, ''])}
            className="w-full px-2 py-1 text-[11px] font-ui border border-dashed border-border text-inkMid rounded hover:bg-bg/50 transition-colors"
          >
            + Add item
          </button>
        </div>
      </div>
    );
  }

  // Currency / percentage / duration
  if (effType === 'currency' || effType === 'percentage' || effType === 'duration') {
    const placeholder = effType === 'currency' ? 'e.g. $25,000,000'
      : effType === 'percentage' ? 'e.g. 5%'
      : 'e.g. 30 days';
    // dollarThreshold etc. are often stored citable { value, quotes|text }.
    // Unwrap to the inner scalar for the input (not "[object Object]"), show the
    // supporting quote, and preserve the citation when the user edits the value.
    const cit = isCitableValue(value);
    const inner = cit ? getCitableValue(value) : value;
    const ev = cit ? getCitableText(value) : null;
    return (
      <div>
        {labelEl}
        <input
          value={inner == null || typeof inner === 'object' ? '' : String(inner)}
          onChange={(e) => {
            const v = e.target.value;
            const next = v === '' ? null : v;
            onChange(cit && next != null ? { ...value, value: next } : next);
          }}
          placeholder={placeholder}
          className="w-full border border-border rounded px-2 py-1 text-xs font-ui focus:outline-none focus:ring-1 focus:ring-accent"
        />
        {ev && (
          <p className="mt-0.5 font-body text-[11px] text-inkFaint italic leading-relaxed">&ldquo;{ev}&rdquo;</p>
        )}
      </div>
    );
  }

  // Object / tiers / unknown structured: JSON textarea fallback
  if (effType === 'object' || effType === 'tiers' || (value && typeof value === 'object')) {
    const display = value == null ? '' : JSON.stringify(value, null, 2);
    return (
      <div>
        {labelEl}
        <textarea
          value={display}
          onChange={(e) => {
            const t = e.target.value;
            if (t.trim() === '') { onChange(null); return; }
            try {
              onChange(JSON.parse(t));
            } catch {
              // Preserve in-progress invalid JSON as a string so the user can fix it.
              onChange(t);
            }
          }}
          rows={4}
          className="w-full border border-border rounded px-2 py-1 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-accent"
          placeholder="JSON value"
        />
      </div>
    );
  }

  // Default: plain text
  return (
    <div>
      {labelEl}
      <input
        value={value == null ? '' : String(value)}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === '' ? null : v);
        }}
        className="w-full border border-border rounded px-2 py-1 text-xs font-ui focus:outline-none focus:ring-1 focus:ring-accent"
      />
    </div>
  );
}

/* ── P7 item 4: per-provision "Re-extract this section" button ───────────
   Recovers the source section by matching the provision's startChar against
   the deal's classified_sections, then POSTs to /api/ingest/extract-section.
   Shows inline status. The parent page picks up the new provisions via the
   existing realtime subscription on the provisions table — no callback hook
   needed. */
function ReextractSectionButton({ provision, deal }) {
  const [status, setStatus] = useState('idle'); // idle | running | done | failed
  const [message, setMessage] = useState('');

  const resolveSectionId = () => {
    if (!provision || !deal) return null;
    let meta = provision.ai_metadata;
    if (typeof meta === 'string') {
      try { meta = JSON.parse(meta); } catch { meta = null; }
    }
    const provStart = meta && typeof meta.startChar === 'number' ? meta.startChar : null;
    if (provStart === null) return null;
    const classified = deal?.metadata?.classified_sections;
    if (!Array.isArray(classified) || classified.length === 0) return null;
    // Find the section whose [startChar, nextStartChar) range contains provStart.
    const sorted = [...classified].sort((a, b) => (a.startChar || 0) - (b.startChar || 0));
    for (let i = 0; i < sorted.length; i++) {
      const s = sorted[i];
      const next = i + 1 < sorted.length ? sorted[i + 1] : null;
      const end = next ? Number(next.startChar) : (Number(s.startChar) + (s.text || '').length);
      if (provStart >= Number(s.startChar) && provStart < end) {
        return `section-${s.startChar}`;
      }
    }
    return null;
  };

  const handleClick = async () => {
    const sectionId = resolveSectionId();
    if (!sectionId) {
      setStatus('failed');
      setMessage('Could not locate source section (no startChar)');
      return;
    }
    setStatus('running');
    setMessage('');
    try {
      const resp = await fetch('/api/ingest/extract-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deal_id: deal.id, section_id: sectionId }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        setStatus('failed');
        setMessage(data.error || `HTTP ${resp.status}`);
        return;
      }
      setStatus('done');
      setMessage(`+${data.provisions_inserted} / -${data.provisions_deleted}`);
    } catch (e) {
      setStatus('failed');
      setMessage(e?.message || String(e));
    }
  };

  const sectionId = resolveSectionId();
  const disabled = !sectionId || status === 'running';
  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className="w-full px-3 py-1.5 text-xs font-ui border border-border text-inkLight rounded hover:bg-bg disabled:opacity-50 transition-colors"
        title={sectionId ? `Re-extract ${sectionId}` : 'No source section found (provision missing startChar)'}
      >
        {status === 'running' ? 'Re-extracting...' : 'Re-extract this section'}
      </button>
      {status === 'done' && (
        <p className="text-[10px] font-ui text-green-700">Done — {message}</p>
      )}
      {status === 'failed' && (
        <p className="text-[10px] font-ui text-red-600">Failed — {message}</p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   EDIT PANEL (slide-in from right)
   ═══════════════════════════════════════════════════════════ */
/* ── Per-field source affordance shown beneath each FeatureFieldEditor in
 *    the EditPanel. Resolves the field's evidence quote(s) and renders an
 *    amber chip (or "(view full provision)" fallback) that pops the source
 *    in the FullDocumentView. Per user direction: "if the full provision
 *    is what is needed to evidence the summary that's fine and the whole
 *    thing can just be cited" — when no field-level quote exists we still
 *    expose a click-to-source pointing at provision.full_text. */
function FieldSourceAffordance({ field, value, provision }) {
  const showEvidence = useShowEvidence();
  const quotes = useMemo(() => {
    if (isCitableValue(value)) {
      const q = getCitableQuotes(value);
      if (q && q.length > 0) return q;
    }
    if (isTaggedItem(value) && typeof value.text === 'string' && value.text.trim()) {
      return [value.text];
    }
    return [];
  }, [value]);
  const fallbackText = (typeof provision?.full_text === 'string' && provision.full_text.trim())
    ? provision.full_text
    : null;
  const truncate = (s, n = 90) => {
    const t = String(s || '').trim().replace(/\s+/g, ' ');
    return t.length > n ? t.slice(0, n) + '…' : t;
  };
  if (quotes.length === 0 && !fallbackText) return null;
  if (quotes.length === 0) {
    return (
      <button
        type="button"
        onClick={() => showEvidence && showEvidence(fallbackText)}
        disabled={!showEvidence}
        className="block text-left text-[10px] font-ui italic text-amber-700 hover:text-amber-900 hover:underline disabled:opacity-50"
        title="Click to view this provision in the document"
      >
        Source: full provision (click to view)
      </button>
    );
  }
  return (
    <div className="space-y-0.5">
      {quotes.map((q, idx) => (
        <button
          key={idx}
          type="button"
          onClick={() => showEvidence && showEvidence(q)}
          disabled={!showEvidence}
          className="block w-full text-left border border-amber-200 bg-amber-50/40 rounded px-2 py-1 text-[11px] font-ui text-amber-900 italic hover:bg-amber-50 disabled:opacity-50"
          title={q}
        >
          &ldquo;{truncate(q)}&rdquo;
        </button>
      ))}
    </div>
  );
}

export function EditPanel({
  provision,
  allTypes,
  allCategories,
  onClose,
  onSave,
  onApprove,
  onFlag,
  onDelete,
  onProposeCode,
  onReselectText,
  deal,
  onSaveCustomTaxonomyOption,
}) {
  const [editType, setEditType] = useState(provision?.type || '');
  const [editCategory, setEditCategory] = useState(provision?.category || '');
  const [editFav, setEditFav] = useState(provision?.ai_favorability || 'neutral');
  const [features, setFeatures] = useState([]);
  const [newFeature, setNewFeature] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  // Structured (schema-driven) feature edits — keyed by feature key.
  const [editedFeatures, setEditedFeatures] = useState({});
  // Initial structured features snapshot, used for dirty detection.
  const [initialFeatures, setInitialFeatures] = useState({});

  // P5 item 8: per-field "+ Add canonical option" inline form state.
  // Active key controls which field shows the form; the form fields edit a
  // single { label, code, synonyms } draft that, on save, gets pushed into
  // deal.metadata.custom_taxonomy_extensions[key] via onSaveCustomTaxonomyOption.
  const [customOptionKey, setCustomOptionKey] = useState(null);
  const [customOptionDraft, setCustomOptionDraft] = useState({ label: '', code: '', synonyms: '' });
  const [customOptionSaving, setCustomOptionSaving] = useState(false);
  const [customOptionError, setCustomOptionError] = useState(null);

  const handleAddCustomOption = useCallback((featureKey) => {
    setCustomOptionKey(featureKey);
    setCustomOptionDraft({ label: '', code: '', synonyms: '' });
    setCustomOptionError(null);
  }, []);

  const closeCustomOptionForm = () => {
    setCustomOptionKey(null);
    setCustomOptionDraft({ label: '', code: '', synonyms: '' });
    setCustomOptionError(null);
  };

  const handleSaveCustomOption = async () => {
    if (!customOptionKey || !onSaveCustomTaxonomyOption) return;
    const label = (customOptionDraft.label || '').trim();
    if (!label) {
      setCustomOptionError('Label is required');
      return;
    }
    let code = (customOptionDraft.code || '').trim();
    if (!code) {
      // Auto-derive: "Deal-Specific X" → "DEAL_SPECIFIC_X"
      code = label
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
    }
    if (!code) {
      setCustomOptionError('Could not derive a code from the label');
      return;
    }
    setCustomOptionSaving(true);
    setCustomOptionError(null);
    try {
      await onSaveCustomTaxonomyOption(customOptionKey, {
        code,
        label,
        synonyms: (customOptionDraft.synonyms || '').trim() || undefined,
      });
      closeCustomOptionForm();
    } catch (e) {
      setCustomOptionError(e.message || String(e));
    } finally {
      setCustomOptionSaving(false);
    }
  };

  // Read-only display value (always reflects the current provision text)
  const currentFullText = provision?.full_text || '';

  useEffect(() => {
    if (provision) {
      setEditType(provision.type || '');
      setEditCategory(provision.category || '');
      setEditFav(provision.ai_favorability || 'neutral');
      setFeatures(getFeatures(provision));
      setReason('');
      const structured = getStructuredFeatures(provision) || {};
      // Deep clone via JSON so subsequent mutations don't reach back into
      // the raw provision payload.
      const cloned = JSON.parse(JSON.stringify(structured));
      setEditedFeatures(cloned);
      setInitialFeatures(JSON.parse(JSON.stringify(structured)));
    }
  }, [provision]);

  // Schema-driven feature list for the active type/code.
  const featureSchema = useMemo(() => {
    if (!provision) return [];
    return getFeaturesForType(editType || provision.type, provision.code) || [];
  }, [editType, provision]);

  // Dedupe by key — some rubric entries (e.g. IOC permittedExceptions) appear
  // twice with different scopes; the editor only needs one row per key.
  // Also drop globally-hidden keys: crossReferences (cross-refs aren't an
  // editable feature the user wants to manage), the deprecated carve-out
  // aliases (carveOuts / carveOutsList — superseded by the canonical
  // `carveouts` list), and definitionText (shown as Provision Text already).
  // Curated per-type edit schema (lib/edit-schema). Each provision type
  // exposes ONLY the small set of things a lawyer corrects (reps →
  // materiality / knowledge / exceptions / threshold; MAE definition →
  // carve-outs / disproportionate carve-backs; etc.) — no cross-type noise.
  // We map each curated key onto its rubric FEATURES entry so the existing
  // per-field renderers keep working; keys the rubric doesn't declare get a
  // synthesized spec from the curated control.
  const CONTROL_TO_TYPE = { currency: 'currency', percentage: 'percentage', checkbox: 'boolean', number: 'number', list: 'list', select: 'enum', object: 'object', text: 'text', materiality: 'text', knowledge: 'text', exceptions: 'list' };
  const curatedSchema = useMemo(() => {
    if (!provision) return null;
    const resolved = resolveEditFields(editType || provision.type, provision.code, provision.category, editedFeatures);
    if (!resolved.curated) return null;
    const byKey = new Map(featureSchema.map((f) => [f.key, f]));
    return resolved.fields.map((cf) => {
      const rub = byKey.get(cf.key);
      if (rub) return { ...rub, label: cf.label || rub.label, options: cf.options || rub.options };
      return { key: cf.key, label: cf.label, type: CONTROL_TO_TYPE[cf.control] || 'text', options: cf.options };
    });
  }, [provision, editType, featureSchema, editedFeatures]);

  const dedupedSchema = useMemo(() => {
    // Curated types: the allowlist IS the schema.
    if (curatedSchema) return curatedSchema;
    // Fallback (uncurated types): rubric fields minus infra/derived keys.
    const HIDE = new Set([
      'crossReferences',
      'carveOuts', 'carveOutsList',
      'disproportionateImpact', 'disproportionateImpactScope',
      'pandemicCarveout', 'cyberSecurityCarveout',
      'mainConcept',
      'maeQualifiedReps', 'mae_qualified_reps',
    ]);
    const seen = new Set();
    const out = [];
    for (const f of featureSchema) {
      if (!f || !f.key || seen.has(f.key) || HIDE.has(f.key)) continue;
      seen.add(f.key);
      out.push(f);
    }
    return out;
  }, [featureSchema, curatedSchema]);

  // P11+: only show fields that currently have a value. Unpopulated fields
  // are hidden and accessed via the "Add field" picker below. Once a key
  // has been explicitly added in this session it stays visible even if the
  // user clears its value.
  const [manuallyAddedKeys, setManuallyAddedKeys] = useState(() => new Set());
  useEffect(() => { setManuallyAddedKeys(new Set()); }, [provision?.id]);

  const populatedSchema = useMemo(() => {
    // Curated types show their full (small) editable set so unset qualifiers
    // are addable in place — no "populated-only" filtering, no picker.
    if (curatedSchema) return dedupedSchema;
    return dedupedSchema.filter((f) => {
      if (manuallyAddedKeys.has(f.key)) return true;
      const v = editedFeatures[f.key];
      if (isEmptyValue(v)) return false;
      // Treat inert defaults as empty for display: explicit `false` booleans,
      // and enum sentinels like 'NA' / 'NONE' / 'OTHER' that the AI emits when
      // a field doesn't apply. The user still has the field via the picker.
      const inner = isCitableValue(v) ? getCitableValue(v) : v;
      if (inner === false) return false;
      if (typeof inner === 'string') {
        const s = inner.trim().toUpperCase();
        if (s === 'NA' || s === 'N/A' || s === 'NONE') return false;
      }
      if (isTaggedItem(inner)) {
        const c = String(inner.code || '').toUpperCase();
        if (c === 'NA' || c === 'NONE' || c === 'OTHER') return false;
      }
      return true;
    });
  }, [dedupedSchema, editedFeatures, manuallyAddedKeys]);

  const availableToAdd = useMemo(() => {
    // Curated types show their whole set already — no add-field picker.
    if (curatedSchema) return [];
    const populated = new Set(populatedSchema.map((f) => f.key));
    return dedupedSchema.filter((f) => !populated.has(f.key));
  }, [dedupedSchema, populatedSchema, curatedSchema]);

  const [addFieldKey, setAddFieldKey] = useState('');
  const handleAddField = () => {
    if (!addFieldKey) return;
    setManuallyAddedKeys((prev) => {
      const next = new Set(prev);
      next.add(addFieldKey);
      return next;
    });
    setAddFieldKey('');
  };

  const featuresDirty = useMemo(() => {
    return JSON.stringify(editedFeatures || {}) !== JSON.stringify(initialFeatures || {});
  }, [editedFeatures, initialFeatures]);

  const classificationDirty = useMemo(() => {
    if (!provision) return false;
    return (
      (provision.type || '') !== editType ||
      (provision.category || '') !== editCategory ||
      (provision.ai_favorability || 'neutral') !== editFav
    );
  }, [provision, editType, editCategory, editFav]);

  const isDirty = featuresDirty || classificationDirty;

  const setFeatureValue = (key, value) => {
    setEditedFeatures((prev) => ({ ...prev, [key]: value }));
  };

  const filteredCategories = useMemo(() => {
    if (!editType || !allCategories) return [];
    return allCategories.filter(c =>
      c.provision_type?.key === editType
    ).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }, [editType, allCategories]);

  const handleSave = async () => {
    if (!provision?.id) return;
    setSaving(true);
    try {
      const payload = {
        id: provision.id,
        type: editType,
        category: editCategory,
        ai_favorability: editFav,
        reason: reason.trim() || undefined,
      };
      if (featuresDirty) {
        // Only ship the features sub-object — the API merges it into the
        // existing ai_metadata so other keys (rubric_code, etc.) are preserved.
        payload.ai_metadata = { features: editedFeatures };
      }
      await onSave(payload);
    } catch {
      // parent already surfaced a toast; keep panel open so the user can retry
    } finally {
      setSaving(false);
    }
  };

  const addFeature = () => {
    if (newFeature.trim()) {
      setFeatures(prev => [...prev, newFeature.trim()]);
      setNewFeature('');
    }
  };

  const removeFeature = (idx) => {
    setFeatures(prev => prev.filter((_, i) => i !== idx));
  };

  if (!provision) return null;

  const tc = typeColor(provision.type);

  return (
    <div className="w-[400px] max-md:w-[90vw] shrink-0 bg-white border-l border-border flex flex-col h-full overflow-hidden animate-slide-up max-md:fixed max-md:inset-y-0 max-md:right-0 max-md:z-[60] max-md:shadow-2xl">
      {/* Header */}
      <div className={`px-4 py-3 border-b border-border flex items-center justify-between ${tc.bg}`}>
        <h3 className="font-display text-sm text-ink font-medium truncate pr-2">
          Edit Provision
        </h3>
        <button onClick={onClose} className="p-1 text-inkLight hover:text-ink transition-colors shrink-0">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Classification */}
        <div className="space-y-3">
          <h4 className="font-ui text-xs font-medium text-inkFaint uppercase tracking-wider">Classification</h4>

          <div>
            <label className="block text-xs font-ui text-inkLight mb-1">Type</label>
            <select
              value={editType}
              onChange={e => { setEditType(e.target.value); setEditCategory(''); }}
              className="w-full border border-border rounded px-3 py-1.5 text-sm font-ui focus:outline-none focus:ring-1 focus:ring-accent bg-white"
            >
              <option value="">Select type...</option>
              {allTypes.map(t => (
                <option key={t.key || t} value={t.key || t}>
                  {typeLabel(t.key || t)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="flex items-center justify-between text-xs font-ui text-inkLight mb-1">
              <span>Term</span>
              {(() => {
                // Canonical-status indicator: does this provision's code map to a
                // canonical rubric code? Surfaced only in the editor — the reviewer
                // sees clean labels elsewhere. Non-canonical = a candidate to
                // promote into the taxonomy (see the growth queue).
                const code = provision && (
                  (provision.ai_metadata && provision.ai_metadata.features && provision.ai_metadata.features.canonicalCode)
                  || (provision.ai_metadata && provision.ai_metadata.code)
                  || provision.code
                );
                const canon = isCanonicalCode(code);
                return (
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-medium ${canon ? 'text-emerald-700' : 'text-amber-700'}`}
                    title={canon ? `Canonical category (${code})` : 'Not a canonical category — candidate to add to the taxonomy'}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${canon ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    {canon ? 'canonical' : 'non-canonical'}
                  </span>
                );
              })()}
            </label>
            {filteredCategories.length > 0 ? (
              <select
                value={editCategory}
                onChange={e => setEditCategory(e.target.value)}
                className="w-full border border-border rounded px-3 py-1.5 text-sm font-ui focus:outline-none focus:ring-1 focus:ring-accent bg-white"
              >
                <option value="">Select term...</option>
                {filteredCategories.map(c => (
                  <option key={c.id} value={c.label}>{c.label}</option>
                ))}
              </select>
            ) : (
              <input
                value={editCategory}
                onChange={e => setEditCategory(e.target.value)}
                placeholder="Term name"
                className="w-full border border-border rounded px-3 py-1.5 text-sm font-ui focus:outline-none focus:ring-1 focus:ring-accent"
              />
            )}
          </div>

          <div>
            <label className="block text-xs font-ui text-inkLight mb-1">Favorability</label>
            <select
              value={editFav}
              onChange={e => setEditFav(e.target.value)}
              className="w-full border border-border rounded px-3 py-1.5 text-sm font-ui focus:outline-none focus:ring-1 focus:ring-accent bg-white"
            >
              <option value="strong-buyer">Strong Buyer</option>
              <option value="mod-buyer">Moderate Buyer</option>
              <option value="buyer">Buyer</option>
              <option value="neutral">Neutral</option>
              <option value="seller">Seller</option>
              <option value="mod-seller">Moderate Seller</option>
              <option value="strong-seller">Strong Seller</option>
            </select>
          </div>
        </div>

        {/* Provision Text (read-only — boundary changes via Re-select Text) */}
        <div className="space-y-2">
          <h4 className="font-ui text-xs font-medium text-inkFaint uppercase tracking-wider">Provision Text</h4>
          <label className="block text-xs font-ui text-inkLight mb-1">Current text</label>
          <div
            className={`w-full p-3 rounded border ${tc.border} ${tc.bg} font-body text-xs text-ink leading-relaxed whitespace-pre-wrap max-h-[280px] overflow-y-auto`}
          >
            {currentFullText || <span className="italic text-inkFaint">(no text)</span>}
          </div>
          <p className="text-[10px] font-ui text-inkFaint">
            {`${currentFullText.length} characters`}
            {' '}-- text is read-only to keep it aligned with the agreement source
          </p>
          <button
            type="button"
            onClick={() => onReselectText && onReselectText(provision)}
            className="w-full px-3 py-1.5 text-xs font-ui border border-accent/40 text-accent rounded hover:bg-accent/5 transition-colors"
          >
            Re-select Text from Document
          </button>

          {/* P7 item 4: per-section re-extract button. Resolves the source
              section_id from provision.ai_metadata.startChar against the deal's
              classified_sections, then POSTs to /api/ingest/extract-section. */}
          <ReextractSectionButton provision={provision} deal={deal} />
        </div>

        {/* Structured Summary (schema-driven editable fields) */}
        {dedupedSchema.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-ui text-xs font-medium text-inkFaint uppercase tracking-wider">Structured Summary</h4>
            <div className="space-y-2">
              {populatedSchema.length === 0 && (
                <p className="text-[11px] font-ui italic text-inkFaint">
                  No structured features extracted yet. Use the picker below to add one.
                </p>
              )}
              {populatedSchema.map((field) => (
                <div key={field.key} className="space-y-1">
                  <FeatureFieldEditor
                    field={field}
                    value={editedFeatures[field.key]}
                    onChange={(v) => setFeatureValue(field.key, v)}
                    onAddCustomOption={onSaveCustomTaxonomyOption ? handleAddCustomOption : undefined}
                  />
                  <FieldSourceAffordance
                    field={field}
                    value={editedFeatures[field.key]}
                    provision={provision}
                  />
                  {customOptionKey === field.key && (
                    <div className="border border-accent/40 bg-accent/5 rounded p-2 space-y-1.5 mt-1">
                      <p className="text-[10px] font-ui text-accent uppercase tracking-wider font-medium">
                        Add canonical option for "{humanizeKey(field.key)}"
                      </p>
                      <input
                        value={customOptionDraft.label}
                        onChange={(e) => setCustomOptionDraft((d) => ({ ...d, label: e.target.value }))}
                        placeholder="Label (required) — e.g. Best Efforts"
                        className="w-full border border-border rounded px-2 py-1 text-[11px] font-ui focus:outline-none focus:ring-1 focus:ring-accent"
                        autoFocus
                      />
                      <input
                        value={customOptionDraft.code}
                        onChange={(e) => setCustomOptionDraft((d) => ({ ...d, code: e.target.value }))}
                        placeholder="Canonical code (optional — auto: BEST_EFFORTS)"
                        className="w-full border border-border rounded px-2 py-1 text-[11px] font-ui focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                      <input
                        value={customOptionDraft.synonyms}
                        onChange={(e) => setCustomOptionDraft((d) => ({ ...d, synonyms: e.target.value }))}
                        placeholder="Synonyms regex (optional) — e.g. /foo|bar/i"
                        className="w-full border border-border rounded px-2 py-1 text-[11px] font-ui focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                      {customOptionError && (
                        <p className="text-[10px] font-ui text-red-600">{customOptionError}</p>
                      )}
                      <div className="flex gap-1.5 justify-end">
                        <button
                          type="button"
                          onClick={closeCustomOptionForm}
                          disabled={customOptionSaving}
                          className="px-2 py-1 text-[10px] font-ui border border-border rounded hover:bg-bg disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveCustomOption}
                          disabled={customOptionSaving}
                          className="px-2 py-1 text-[10px] font-ui bg-accent text-white rounded hover:bg-accent/90 disabled:opacity-50"
                        >
                          {customOptionSaving ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {availableToAdd.length > 0 && (
              <div className="flex gap-1.5 pt-1">
                <select
                  value={addFieldKey}
                  onChange={(e) => setAddFieldKey(e.target.value)}
                  className="flex-1 border border-border rounded px-2 py-1 text-xs font-ui focus:outline-none focus:ring-1 focus:ring-accent bg-white"
                >
                  <option value="">+ Add field from canonical list...</option>
                  {availableToAdd.map((f) => (
                    <option key={f.key} value={f.key}>{humanizeKey(f.key)}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddField}
                  disabled={!addFieldKey}
                  className="px-2 py-1 text-xs font-ui bg-bg border border-border rounded hover:bg-border/50 disabled:opacity-40 transition-colors"
                >
                  Add
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions Footer */}
      <div className="border-t border-border p-4 space-y-2 bg-bg/30">
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="flex-1 px-3 py-2 text-sm font-ui bg-accent text-white rounded hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title={!isDirty ? 'No changes to save' : undefined}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onApprove(provision)}
            className="flex-1 px-3 py-1.5 text-xs font-ui bg-buyer/10 text-buyer border border-buyer/20 rounded hover:bg-buyer/20 transition-colors"
          >
            Approve
          </button>
          <button
            onClick={() => onFlag(provision)}
            className="flex-1 px-3 py-1.5 text-xs font-ui bg-amber-50 text-amber-700 border border-amber-200 rounded hover:bg-amber-100 transition-colors"
          >
            Flag
          </button>
          <button
            onClick={() => onDelete(provision)}
            className="px-3 py-1.5 text-xs font-ui bg-seller/10 text-seller border border-seller/20 rounded hover:bg-seller/20 transition-colors"
          >
            Delete
          </button>
        </div>
        <button
          onClick={() => onProposeCode(provision)}
          className="w-full px-3 py-1.5 text-xs font-ui border border-dashed border-accent/40 text-accent rounded hover:bg-accent/5 transition-colors"
        >
          Propose New Code
        </button>
      </div>
    </div>
  );
}

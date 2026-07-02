/* Per-section "+ Add item" affordance. Lets the user capture a provision the
   extractor missed (a new IOC covenant, an equity type not covered in
   Consideration, …). Collects the clause text (required — provision text is
   immutable after creation) plus an optional category, creates it of the
   section's type, then opens the editor to classify / enrich. */
// Contextual noun for the "+ Add …" affordance, by section type family.
function addItemNoun(type) {
  const t = String(type || '');
  if (t.startsWith('REP')) return 'representation';
  if (t.startsWith('COND')) return 'condition';
  if (t.startsWith('TERMR')) return 'termination right';
  if (t === 'TERMF') return 'fee provision';
  if (t.startsWith('IOC')) return 'covenant';
  if (t === 'COV') return 'covenant';
  if (t === 'NOSOL') return 'no-shop provision';
  if (t === 'CONSID') return 'consideration item';
  if (t === 'DEF') return 'definition';
  if (t === 'ANTI') return 'antitrust provision';
  return 'item';
}

// "+ Add <noun>" affordance. Instead of pasting clause text (which would break
// the no-hallucination guarantee — provision text must be verbatim from the
// source), this begins a SELECT-IN-DOCUMENT flow: it switches to the Full
// Document tab and the user highlights the clause, which is then captured
// verbatim to create the provision (category/features refined in the editor).
export function AddSectionItem({ type, defaultCategory, onBeginAdd, nounOverride }) {
  const noun = nounOverride || addItemNoun(type);
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onBeginAdd && onBeginAdd({ type, defaultCategory: defaultCategory || '', noun }); }}
      className="text-[11px] font-ui text-accent hover:underline whitespace-nowrap"
      title={`Add a ${noun} by selecting its clause text in the document`}
    >
      + Add {noun}
    </button>
  );
}

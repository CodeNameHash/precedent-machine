import { useState } from 'react';

const SURFACES = Object.freeze([
  ['QUERY', 'Query'],
  ['REVIEW', 'Review'],
  ['COMPARE', 'Compare'],
  ['CORPUS_CONTEXT', 'Corpus Context'],
]);

function formatCode(value) {
  return String(value || '')
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function fieldValue(field) {
  if (
    field?.value === null
    || ['string', 'number'].includes(typeof field?.value)
  ) {
    return field.value ?? 'Not captured';
  }
  return Object.values(field?.value || {}).join(' · ');
}

function displaySourceText(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function MetseraExclusivityCrossView({ fixture }) {
  const [surface, setSurface] = useState('QUERY');
  const [sourceState, setSourceState] = useState(null);
  const result = fixture.shared_result;
  const binding = fixture.surface_bindings[surface];
  const citation = result.exact_citation;
  const hasMarketCohort =
    binding.market_state !== 'SINGLE_PILOT_RESULT_NO_MARKET_COHORT';

  return (
    <section
      className="mt-5 overflow-hidden border border-[#D9D7D2] bg-white"
      data-metsera-p8-cross-view="true"
      data-product-result-id={result.product_query_result_identity}
    >
      <header className="border-b border-[#D9D7D2] bg-[#F7F5F0] px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#77736C]">
              Real sealed source · inactive staging candidate
            </div>
            <h2 className="mt-1 text-base font-bold text-[#1F1F1F]">
              {fixture.understood_legal_question.label}
            </h2>
            <p className="mt-1 max-w-3xl text-[10px] leading-4 text-[#66625C]">
              One Process result is reused across Query, Review, Compare and Corpus Context.
            </p>
          </div>
          <span className="border border-[#B27B16] bg-[#FFF9EC] px-2 py-1 text-[8px] font-bold uppercase tracking-[0.1em] text-[#8A6417]">
            Not active
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-1" role="tablist" aria-label="Product view">
          {SURFACES.map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={surface === key}
              onClick={() => setSurface(key)}
              className={`border px-3 py-2 text-[9px] font-bold ${
                surface === key
                  ? 'border-[#1F1F1F] bg-[#1F1F1F] text-white'
                  : 'border-[#D9D7D2] bg-white text-[#4E4B46]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="grid min-w-0 lg:grid-cols-[180px_minmax(0,1fr)_300px]">
        <aside className="border-b border-[#E6E4DF] bg-[#FBFAF7] p-4 lg:border-b-0 lg:border-r">
          <div className="text-[8px] font-bold uppercase tracking-[0.12em] text-[#77736C]">
            Provision
          </div>
          <div className="mt-2 text-[10px] font-bold text-[#174B84]">
            Exclusivity
          </div>
          <div className="mt-1 text-[9px] leading-4 text-[#66625C]">
            Granted to Party 2
          </div>
          <div className="mt-4 text-[8px] font-bold uppercase tracking-[0.12em] text-[#77736C]">
            Current view
          </div>
          <div
            className="mt-2 text-[10px] font-bold text-[#1F1F1F]"
            data-current-surface={surface}
          >
            {SURFACES.find(([key]) => key === surface)?.[1]}
          </div>
        </aside>

        <article className="min-w-0 p-4 sm:p-5">
          <div className="text-[8px] font-bold uppercase tracking-[0.12em] text-[#77736C]">
            {surface === 'QUERY' ? 'Answer' : 'This deal'}
          </div>
          <h3 className="mt-1 text-lg font-bold text-[#1F1F1F]">
            Exclusivity granted
          </h3>
          <blockquote className="mt-4 border-l-2 border-[#2F6DB5] pl-4 text-[11px] leading-5 text-[#34312D]">
            {displaySourceText(result.domain_result_payload)}
          </blockquote>
          <dl className="mt-5 grid gap-3 sm:grid-cols-2">
            {result.result_fields.map((field) => (
              <div key={`${field.field_reference.field_key}:${field.field_reference.field_version}`}>
                <dt className="text-[8px] font-bold uppercase tracking-[0.1em] text-[#77736C]">
                  {formatCode(field.field_reference.field_key)}
                </dt>
                <dd className="mt-1 text-[10px] text-[#1F1F1F]">
                  {fieldValue(field)}
                </dd>
              </div>
            ))}
          </dl>
          {['COMPARE', 'CORPUS_CONTEXT'].includes(surface) ? (
            <div
              className="mt-5 border-l-2 border-[#BDB9B0] bg-[#F7F5F0] px-3 py-2 text-[9px] leading-4 text-[#66625C]"
              data-market-state={binding.market_state}
            >
              {hasMarketCohort
                ? 'Market cohort available.'
                : 'One certified pilot result. No independent market cohort is admitted, so no market percentage is shown.'}
            </div>
          ) : null}
        </article>

        <aside
          className="min-w-0 border-t border-[#D9D7D2] bg-white p-4 lg:border-l lg:border-t-0"
          aria-label="Source evidence"
        >
          <div className="text-[8px] font-bold uppercase tracking-[0.12em] text-[#77736C]">
            Exact source evidence
          </div>
          <div className="mt-2 text-[10px] font-bold text-[#1F1F1F]">
            {citation.human_readable_source_label}
          </div>
          <div className="mt-1 text-[9px] leading-4 text-[#66625C]">
            {citation.source_location_label}
          </div>
          <button
            type="button"
            onClick={() => setSourceState(fixture.source_reader)}
            className="mt-4 border border-[#BDB9B0] bg-white px-3 py-2 text-[9px] font-bold text-[#1F1F1F]"
          >
            Open source
          </button>
          {sourceState ? (
            <div
              role="status"
              className="mt-3 border-l-2 border-[#B27B16] bg-[#FFF9EC] px-3 py-2 text-[9px] leading-4 text-[#5F4A1E]"
              data-source-reader-disposition={sourceState.disposition}
            >
              Candidate release is not active. No source action ran. The exact result remains unchanged.
            </div>
          ) : null}
          <div className="mt-4 break-all font-mono text-[7px] leading-3 text-[#8A8780]">
            {result.product_query_result_identity}
          </div>
        </aside>
      </div>
    </section>
  );
}

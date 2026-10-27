import { useMemo, useState } from 'react';
import { answerFor, explanationFor } from '../../lib/product/provision-presentation';
import tableShapesV3 from '../../contracts/product/table-shapes.v3.json';

// The released page's main body, on the presentation schema (work package 54):
// one row per provision, the operative answer once, the springing condition
// beside it, coded extras after it. The drafting, the interpretation and the
// read live in the row's sidebar, which opens on click.
export default function ProvisionAnswers({ facts, market = {}, agreementCount = 0, onSource = null }) {
  const families = useMemo(() => {
    const map = new Map();
    for (const fact of facts || []) {
      const key = fact.family_key || 'OTHER';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(fact);
    }
    return [...map.entries()];
  }, [facts]);
  const [open, setOpen] = useState(null);
  if (!families.length) return null;
  return (
    <div className="space-y-[28px]" data-testid="provision-answers">
      {families.map(([family, familyFacts]) => (
        <section key={family} data-testid="provision-answer-family">
          <h2 className="border-t-[10px] border-[#B9C8DA] pt-[14px] font-sans text-[22px] font-extrabold tracking-[-.035em] text-[#03203D]">
            {label(family)}
            <span className="ml-[10px] font-ui text-[12px] font-medium tracking-[0] text-[#6B7785]">{familyFacts.length}</span>
          </h2>
          <div className="mt-[10px] divide-y divide-[#DCE3E1]">
            {familyFacts.map((fact) => {
              const { answer, condition, extras } = answerFor(fact, tableShapesV3);
              const key = fact.review_item_id || fact.fact_id || fact.statement;
              return (
                <article key={key} className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-[18px] py-[10px] md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]">
                  <p className="font-body text-[15px] leading-[1.35] text-[#33475E]">{String(fact.statement || '').slice(0, 220)}</p>
                  <div className="flex flex-wrap items-center gap-[6px]">
                    {answer?.pill ? <span data-testid="answer-pill" className="inline-flex items-center rounded-full bg-[#03203D] px-[10px] py-[3px] font-ui text-[12px] font-semibold text-white">{answer.text}</span> : null}
                    {!answer?.pill && fact.headline?.summary ? (
                      // No coded answer: the headline summary is the answer the
                      // model read, and it is a key fact rather than drafting.
                      <span data-testid="answer-summary" className="inline-flex items-center rounded-full bg-[#03203D] px-[10px] py-[3px] font-ui text-[12px] font-semibold text-white">{fact.headline.summary}</span>
                    ) : null}
                    {condition?.pill ? <span data-testid="condition-pill" className="inline-flex items-center rounded-full border border-[#B9C8DA] px-[10px] py-[3px] font-ui text-[12px] text-[#0B3D71]">{condition.text}</span> : null}
                    {extras.map((extra) => (
                      <span key={extra.text} className="inline-flex items-center rounded-full bg-[#F1F4F8] px-[10px] py-[3px] font-ui text-[12px] text-[#33475E]">{extra.text}</span>
                    ))}
                  </div>
                  <button type="button" className="justify-self-start font-ui text-[12px] font-semibold text-[#0B3D71] hover:underline" onClick={() => setOpen(open === key ? null : key)} aria-expanded={open === key}>The words</button>
                  {open === key ? <Explanation fact={fact} marketRow={market[`${fact.conclusions?.table_key}\u001f${fact.conclusions?.row_label}`]} agreementCount={agreementCount} onSource={onSource} /> : null}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function Explanation({ fact, marketRow = null, agreementCount = 0, onSource }) {
  const explanation = explanationFor(fact);
  return (
    <div className="col-span-full mt-[6px] border-l-[6px] border-[#03203D] bg-[#F1F4F8] px-[18px] py-[14px]" data-testid="answer-explanation">
      <p className="font-body text-[15px] leading-[1.4] text-[#33475E]">{explanation.as_drafted}</p>
      <dl className="mt-[8px] grid grid-cols-[auto_1fr] gap-x-[12px] gap-y-[4px] font-ui text-[12px] text-[#6B7785]">
        {explanation.table_key ? <><dt className="font-semibold uppercase tracking-[.08em]">Table</dt><dd>{explanation.table_key}</dd></> : null}
        {explanation.interpretation ? <><dt className="font-semibold uppercase tracking-[.08em]">Read</dt><dd>{explanation.interpretation}</dd></> : null}
      </dl>
      {marketRow ? (
        <div className="mt-[10px]" data-testid="market-block">
          <p className="font-ui text-[11px] font-semibold uppercase tracking-[.08em] text-[#6B7785]">Where this sits</p>
          <p className="mt-[4px] font-ui text-[12px] text-[#33475E]">
            {marketRow.n} of {agreementCount} released agreements state an answer here.
          </p>
          <div className="mt-[6px] flex flex-wrap gap-[6px]">
            {Object.entries(marketRow.distribution || {}).sort((left, right) => right[1] - left[1]).map(([answer, count]) => (
              <span key={answer} className="inline-flex items-center gap-[6px] rounded-full bg-[#F1F4F8] px-[10px] py-[2px] font-ui text-[11px] text-[#33475E]">
                {answer}<b className="font-semibold text-[#03203D]">{count}</b>
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function label(key) {
  return String(key || '').toLowerCase().split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

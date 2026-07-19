import { reconstructReviewDeal } from '../../lib/queries/reconstruct-review-deal';

function humanKind(kind) {
  return String(kind || 'standard').replace(/-/g, ' ');
}

function offsetLabel(provenance = {}) {
  const page = provenance.source_doc_page;
  const start = provenance.source_doc_offset_start;
  const end = provenance.source_doc_offset_end;
  const pageText = Number.isInteger(page) ? `p.${page}` : 'p.?';
  return `${pageText} · ${start ?? '?'}-${end ?? '?'}`;
}

function provenanceLine(provenance = {}) {
  const bits = [
    provenance.extractor_name,
    provenance.extractor_version,
    provenance.model,
    provenance.run_id,
  ].filter(Boolean);
  return bits.join(' · ');
}

function kindClass(kind) {
  if (kind === 'definition') return 'border-accent/30 bg-accent/10 text-accentDeep';
  if (kind === 'cross-reference') return 'border-buyer/30 bg-buyer/10 text-buyer';
  return 'border-border bg-bg text-inkLight';
}

function DefinitionPreview({ references = [] }) {
  if (!references.length) return null;
  return (
    <div data-testid="card-crossref-hover" className="absolute left-0 top-full z-20 mt-2 hidden w-full min-w-[22rem] rounded border border-border bg-white p-3 shadow-lg group-hover:block">
      <div className="space-y-3">
        {references.map((definition) => (
          <div key={definition.provision_instance_id} className="border-l-2 border-accent pl-3">
            <div className="font-ui text-xs font-semibold text-ink">{definition.defined_term || definition.short_title}</div>
            <p className="mt-1 text-xs leading-5 text-inkLight">{definition.defined_value || definition.primary_quote}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProvisionCard({ card }) {
  const provenance = card.provenance || {};
  const refs = card.resolvedReferences || [];
  return (
    <article data-testid="provision-card" className="relative rounded border border-border bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span data-testid="provision-card-kind" className={`rounded border px-2 py-0.5 font-ui text-[10px] uppercase ${kindClass(card.kind)}`}>
              {humanKind(card.kind)}
            </span>
            {card.party_scope ? <span className="font-ui text-[10px] uppercase text-inkFaint">{card.party_scope}</span> : null}
          </div>
          <h3 className="break-words font-display text-base text-ink">{card.short_title || card.defined_term || 'Untitled provision'}</h3>
        </div>
        <span className="max-w-full truncate font-mono text-[10px] text-inkFaint">{card.section_ref}</span>
      </div>

      {card.kind === 'definition' ? (
        <div data-testid="definition-card-body" className="mt-3 rounded border border-accent/20 bg-accent/5 p-3">
          <div className="font-ui text-xs font-semibold text-ink">{card.defined_term}</div>
          <p className="mt-1 text-sm leading-6 text-inkLight">{card.defined_value || card.primary_quote}</p>
        </div>
      ) : (
        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-inkLight">{card.primary_quote}</p>
      )}

      {card.kind === 'cross-reference' && refs.length ? (
        <div className="group relative mt-3 inline-flex">
          <span className="rounded border border-buyer/20 bg-buyer/10 px-2 py-1 font-ui text-xs text-buyer">
            {refs.length} definition{refs.length === 1 ? '' : 's'}
          </span>
          <DefinitionPreview references={refs} />
        </div>
      ) : null}

      <details data-testid="provision-card-provenance" className="mt-3 rounded border border-border bg-bg/50 px-3 py-2">
        <summary className="cursor-pointer font-ui text-xs text-inkLight">{offsetLabel(provenance)}</summary>
        <div className="mt-2 space-y-1 font-mono text-[10px] leading-5 text-inkFaint">
          <div>{provenanceLine(provenance)}</div>
          <div>{provenance.source_doc_id}</div>
          <div>{card.provision_instance_id}</div>
        </div>
      </details>
    </article>
  );
}

export default function ProvisionCardTable({ reviewDeal }) {
  // Q1: reviewDeal.sections/.definitions may arrive missing (trimmed API
  // response, not yet reconstructed by the caller) — rebuild them from
  // cards[] defensively so this component works with either shape.
  const shaped = reconstructReviewDeal(reviewDeal) || reviewDeal;
  const sections = Array.isArray(shaped?.sections) ? shaped.sections : [];
  const definitions = Array.isArray(shaped?.definitions) ? shaped.definitions : [];
  return (
    <div data-testid="provision-card-table" className="space-y-6">
      {definitions.length ? (
        <section data-testid="definition-card-tab" className="space-y-3">
          <h2 className="font-display text-lg text-ink">Definitions</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {definitions.map((card) => <ProvisionCard key={`def-${card.provision_instance_id}`} card={card} />)}
          </div>
        </section>
      ) : null}

      {sections.map((section) => (
        <section key={section.sectionRef} data-testid="provision-card-section" className="space-y-3">
          <h2 className="font-display text-lg text-ink">{section.title || section.sectionRef}</h2>
          <div className="grid gap-3">
            {(section.cards || []).map((card) => (
              <ProvisionCard key={card.provision_instance_id || card.id} card={card} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export { DefinitionPreview, ProvisionCard, humanKind, offsetLabel, provenanceLine };

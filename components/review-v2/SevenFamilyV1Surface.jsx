import React from 'react';
import ProvisionTable from '../review/ProvisionTable';
import { considerationHeroConfig } from '../review/table-configs/consideration-hero.config';
import { conditionsConfig } from '../review/table-configs/conditions.config';
import {
  iocExceptionsConfig,
  parentIocExceptionsConfig,
} from '../review/table-configs/ioc-exceptions.config';
import MaeSection from './MaeSection';

const APPRAISAL_CONFIG = {
  ...considerationHeroConfig,
  id: 'seven-family-v1-appraisal',
  selectRows(reviewDeal) {
    return considerationHeroConfig.selectRows(reviewDeal).filter(
      (row) => row.id === 'consideration-hero-appraisalRightsAvailable',
    );
  },
};

function withCards(reviewDeal, predicate) {
  const cards = (reviewDeal?.cards || []).filter(predicate);
  return { ...reviewDeal, cards, cardCount: cards.length };
}

function cardCode(card) {
  return String(card?.provision_subtype || card?.canonical_code || '').toUpperCase();
}

function uniqueEvidence(entries) {
  const seen = new Set();
  return entries.filter((entry) => {
    const quote = String(entry?.quote || '').trim();
    if (!quote || seen.has(quote)) return false;
    seen.add(quote);
    return true;
  });
}

function cardEvidence(cards) {
  return uniqueEvidence(cards.map((card) => ({
    label: card.short_title || cardCode(card),
    quote: card.primary_quote,
  })));
}

function maeEvidence(cards) {
  const entries = [];
  for (const card of cards) {
    entries.push({
      label: `${card.short_title || cardCode(card)} definition and test`,
      quote: card.primary_quote,
    });
    for (const carveout of card.features?.carveouts || []) {
      entries.push({
        label: `${carveout.label || carveout.code} carve-out`,
        quote: carveout.text,
      });
      for (const quote of carveout.disproportionality_quotes || []) {
        entries.push({ label: 'Disproportionate-impact carveback', quote });
      }
    }
  }
  return uniqueEvidence(entries);
}

function EvidenceExcerpts({ entries }) {
  if (!entries.length) return null;
  return (
    <details
      className="border-t border-[#EEECE7] bg-[#FBFAF7] px-4 py-3"
      data-v1-source-evidence="recorded-excerpts"
      open
    >
      <summary className="cursor-pointer text-[9px] font-bold uppercase tracking-[0.12em] text-[#66615A]">
        Recorded source evidence
      </summary>
      <div className="mt-3 space-y-3">
        {entries.map((entry) => (
          <div key={`${entry.label}:${entry.quote}`}>
            <p className="text-[9px] font-bold text-[#66615A]">{entry.label}</p>
            <blockquote className="mt-1 border-l-2 border-[#D9D7D2] pl-3 text-[10px] leading-4 text-[#55514B]">
              {entry.quote}
            </blockquote>
          </div>
        ))}
      </div>
    </details>
  );
}

function SurfaceFrame({ title, note = null, evidence = [], children }) {
  return (
    <div className="border border-[#D9D7D2] bg-white" data-v1-surface="live-renderer">
      <header className="border-b border-[#E6E4DF] bg-[#F7F5F0] px-4 py-3">
        <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#77736C]">V1 renderer sample</div>
        <h3 className="mt-1 text-xs font-bold text-[#1F1F1F]">{title}</h3>
        <p className="mt-1 text-[9px] leading-4 text-[#77736C]">Recorded review examples, rendered by the live V1 component.</p>
      </header>
      <div className="space-y-3 p-3">{children}</div>
      {note ? <p className="border-t border-[#EEECE7] px-4 py-3 text-[10px] leading-4 text-[#77736C]">{note}</p> : null}
      <EvidenceExcerpts entries={evidence} />
    </div>
  );
}

function NoSurface({ title, children }) {
  return (
    <div className="border border-[#D9D7D2] bg-white" data-v1-surface="none">
      <header className="border-b border-[#E6E4DF] bg-[#F7F5F0] px-4 py-3">
        <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#77736C]">V1 renderer sample</div>
        <h3 className="mt-1 text-xs font-bold text-[#1F1F1F]">{title}</h3>
      </header>
      <p className="px-4 py-3 text-[10px] leading-4 text-[#77736C]">{children}</p>
    </div>
  );
}

export default function SevenFamilyV1Surface({ familyKey, reviewDeal }) {
  if (familyKey === 'MAE_DEFINITION') {
    const deal = withCards(reviewDeal, (card) => cardCode(card).startsWith('MAE'));
    return (
      <SurfaceFrame title="Dedicated Material Adverse Effect table" evidence={maeEvidence(deal.cards)}>
        <MaeSection reviewDeal={deal} />
      </SurfaceFrame>
    );
  }

  if (familyKey === 'CONSIDERATION') {
    const deal = withCards(reviewDeal, (card) => /^(?:CONSID|STRUCT-OFFER)/.test(cardCode(card)));
    return (
      <SurfaceFrame title="Dedicated Consideration table" evidence={cardEvidence(deal.cards)}>
        <ProvisionTable config={considerationHeroConfig} reviewDeal={deal} />
      </SurfaceFrame>
    );
  }

  if (familyKey === 'INTERIM_OPERATING') {
    const deal = withCards(reviewDeal, (card) => cardCode(card).startsWith('IOC'));
    return (
      <SurfaceFrame
        title="Dedicated Interim Operating table"
        note="The recorded example has Target values. The same live renderer shows a separate Parent section when Parent covenant cards are present."
        evidence={cardEvidence(deal.cards)}
      >
        <ProvisionTable config={iocExceptionsConfig} reviewDeal={deal} />
        <ProvisionTable config={parentIocExceptionsConfig} reviewDeal={deal} />
      </SurfaceFrame>
    );
  }

  if (familyKey === 'APPRAISAL_DISSENTERS_RIGHTS') {
    const deal = withCards(reviewDeal, (card) => /^(?:CONSID|COND-.*DISSENT)/.test(cardCode(card)));
    const evidence = cardEvidence(deal.cards.filter((card) => (
      Object.hasOwn(card.features || {}, 'appraisalRightsAvailable')
      || Object.hasOwn(card.features || {}, 'dissentingSharesThreshold')
    )));
    return (
      <SurfaceFrame
        title="Embedded V1 fields, no standalone table"
        note="V1 can also show Dissenting Shares Threshold in Closing Conditions when that field is present."
        evidence={evidence}
      >
        <ProvisionTable config={APPRAISAL_CONFIG} reviewDeal={deal} />
      </SurfaceFrame>
    );
  }

  if (familyKey === 'DIVIDENDS') {
    const deal = withCards(reviewDeal, (card) => cardCode(card) === 'IOC-DIVIDEND');
    return (
      <SurfaceFrame
        title="Adjacent Interim Operating row"
        note="This existing V1 value is a restriction on dividends. It is not the V2 dividend-date coordination concept."
        evidence={cardEvidence(deal.cards)}
      >
        <ProvisionTable config={iocExceptionsConfig} reviewDeal={deal} />
      </SurfaceFrame>
    );
  }

  if (familyKey === 'FINANCING_COVENANTS') {
    const deal = withCards(reviewDeal, (card) => /^(?:COND-.*FUNDS|COV-MARKETING)$/.test(cardCode(card)));
    if (deal.cards.length) {
      return (
        <SurfaceFrame
          title="Adjacent fields, no own-family V1 clause table"
          evidence={cardEvidence(deal.cards)}
        >
          <ProvisionTable config={conditionsConfig} reviewDeal={deal} />
        </SurfaceFrame>
      );
    }
    return (
      <NoSurface title="No own-family V1 clause table">
        V1 has adjacent Financing / Sufficient Funds and Marketing period fields, but no matching value in this recorded example. No V1 value is invented.
      </NoSurface>
    );
  }

  return (
    <NoSurface title="No V1 review-page clause surface">
      Guaranty has no V1 review table. The deals index has adjacent metadata only, not a guaranty clause value.
    </NoSurface>
  );
}

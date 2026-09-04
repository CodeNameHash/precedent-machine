'use strict';

const METSERA_DISPROPORTIONALITY_QUOTE = 'except in the case of clause (A), (B), (C), (D), (E) or (I), to the extent that the Company and the Company Subsidiaries, taken as a whole, are disproportionately affected thereby as compared with other participants in the industries in which the Company and the Company Subsidiaries operate (in which case the incremental disproportionate impact or impacts may be taken into account in determining whether there has been a Company Material Adverse Effect).';

const CARDS = [
  {
    id: 'metsera-mae-definition',
    provision_instance_id: 'metsera-mae-definition',
    provision_type: 'MAE',
    provision_subtype: 'MAE-DEF',
    short_title: 'Company Material Adverse Effect',
    primary_quote: '“Company Material Adverse Effect” means any change, event, condition, development, circumstance, effect or occurrence that, individually or in the aggregate, (i) has had, or would reasonably be expected to have, a material adverse effect on the business, assets, condition (financial or otherwise) or results of operations of the Company and the Company Subsidiaries, taken as a whole, or (ii) would or would reasonably be expected to prevent the consummation of, or materially impair the ability of the Company to consummate, the Merger by the Outside Date;',
    source_path: 'tests/fixtures/canonical-v2/metsera-first-live-run/metsera-raw-fetched.htm',
    features: {
      maeLimbType: 'TWO_LIMB',
      carveouts: [
        {
          code: 'INDUSTRY_GENERAL',
          label: 'Industry conditions',
          text: 'changes in economic, business and financial conditions generally affecting the biopharmaceutical industry',
          hasDisproportionateImpactCarveback: true,
          disproportionality_quotes: [METSERA_DISPROPORTIONALITY_QUOTE],
        },
        {
          code: 'ECONOMY_GENERAL',
          label: 'General economic conditions',
          text: 'changes in general economic or regulatory, legislative or political conditions',
          hasDisproportionateImpactCarveback: true,
          disproportionality_quotes: [METSERA_DISPROPORTIONALITY_QUOTE],
        },
        {
          code: 'CHANGE_IN_LAW',
          label: 'Changes in law',
          text: 'changes after the date hereof in applicable Law or GAAP',
          hasDisproportionateImpactCarveback: true,
          disproportionality_quotes: [METSERA_DISPROPORTIONALITY_QUOTE],
        },
      ],
      disproportionateImpactCarveouts: ['INDUSTRY_GENERAL', 'ECONOMY_GENERAL', 'CHANGE_IN_LAW'],
    },
  },
  {
    id: 'metsera-consideration',
    provision_instance_id: 'metsera-consideration',
    provision_type: 'CONSIDERATION',
    provision_subtype: 'CONSID-CONVERT',
    short_title: 'Conversion of Company Common Stock',
    primary_quote: 'each issued and outstanding share of Company Common Stock shall be converted into the right to receive (i) $47.50 in cash, without interest (the “Closing Amount”), plus (ii) one (1) contractual contingent value right per share of Company Common Stock',
    source_path: 'tests/fixtures/canonical-v2/metsera-first-live-run/metsera-raw-fetched.htm',
    features: {
      considerationType: 'cash-with-cvr',
      perShareAmount: 47.5,
    },
  },
  {
    id: 'metsera-appraisal-rights',
    provision_instance_id: 'metsera-appraisal-rights',
    provision_type: 'CONSIDERATION',
    provision_subtype: 'CONSID',
    short_title: 'Appraisal Rights',
    primary_quote: 'shares of Company Common Stock that are outstanding immediately prior to the Effective Time and that are held by any Person who is entitled to demand and properly demands appraisal of such shares pursuant to, and who complies in all respects with, Section 262 of the DGCL (“Section 262”)',
    source_path: 'tests/fixtures/canonical-v2/metsera-first-live-run/metsera-raw-fetched.htm',
    features: {
      appraisalRightsAvailable: true,
    },
  },
  {
    id: 'landos-ioc-ordinary',
    provision_instance_id: 'landos-ioc-ordinary',
    provision_type: 'COVENANT_INTERIM_OPERATING',
    provision_subtype: 'IOC-ORDINARY',
    short_title: 'Ordinary Course Obligation',
    primary_quote: 'the Company shall, and shall cause the Company Subsidiaries to, use commercially reasonable efforts to: (i) conduct its business in the ordinary course of business as was being conducted prior to the date of this Agreement and (ii) preserve intact its material assets, business organization and relations with employees, material customers, suppliers, licensors, licensees, Governmental Bodies and any other Person with whom the Company has material business relationships',
    source_path: '__fixtures__/demo-deal/landos-abbvie-agreement.txt',
    features: {
      positiveObligations: [{
        appliesTo: ['BUSINESS'],
        obligation: 'conduct its business in the ordinary course of business as was being conducted prior to the date of this Agreement',
        efforts_standard: 'COMMERCIALLY_REASONABLE_EFFORTS',
      }],
    },
    party: {
      role: 'IOC_COVENANT_OBLIGOR',
      value: 'Company',
      capacity: 'TARGET',
    },
  },
  {
    id: 'landos-ioc-dividend',
    provision_instance_id: 'landos-ioc-dividend',
    provision_type: 'COVENANT_INTERIM_OPERATING',
    provision_subtype: 'IOC-DIVIDEND',
    short_title: 'Dividends and Distributions',
    primary_quote: 'shall not, without the prior written consent of Parent, declare, set aside or pay any dividend',
    source_path: 'tests/fixtures/canonical-v2/m3-consideration-ioc-real-replay.json',
    features: {
      restrictionComponents: ['DIVIDENDS_DISTRIBUTIONS'],
      permittedExceptions: [{
        code: 'PRIOR_WRITTEN_CONSENT',
        label: 'With Parent consent',
        text: 'without the prior written consent of Parent',
      }],
      mainObligation: 'shall not declare, set aside or pay any dividend',
    },
    party: {
      role: 'IOC_COVENANT_OBLIGOR',
      value: 'Company',
      capacity: 'TARGET',
    },
  },
];

function buildSevenFamilyV1PreviewDeal() {
  const cards = JSON.parse(JSON.stringify(CARDS));
  return {
    dealId: 'seven-family-v1-recorded-examples',
    sourceDeals: ['Pfizer / Metsera', 'Landos / AbbVie'],
    cardCount: cards.length,
    cards,
    definitions: [],
  };
}

module.exports = { buildSevenFamilyV1PreviewDeal };

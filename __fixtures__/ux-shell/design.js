export const typeSamples = [
  {
    token: 'display',
    text: 'Pfizer -> Metsera',
    rule: 'Review header acquirer to target line only.',
  },
  {
    token: 'h1',
    text: 'Merger agreement review',
    rule: 'Page titles and major shell headings.',
  },
  {
    token: 'h2',
    text: 'Conditions',
    rule: 'Section headers and metadata labels.',
  },
  {
    token: 'body',
    text: 'The company shall use reasonable best efforts to obtain required approvals.',
    rule: 'Provision data, quotes, and cell content.',
  },
  {
    token: 'caption',
    text: 'Buyer counsel: Paul Weiss',
    rule: 'Badges, chips, tag pills, breadcrumbs, and inline meta.',
  },
];

export const primitiveStories = [
  {
    name: 'Breadcrumb',
    stories: [
      {
        label: 'Default',
        crumbs: ['Deals', 'Pfizer -> Metsera', 'Conditions'],
      },
      {
        label: 'Long content',
        crumbs: ['Deals', 'International Business Machines Corporation -> Red Hat, Inc.', 'Representations'],
      },
      {
        label: 'Extreme content',
        crumbs: ['Deals', 'Strategic Buyer Holding Company With Multiple Intermediate Parents -> Target Operating Company With Extended Legal Name', 'Interim operating covenants'],
      },
    ],
  },
  {
    name: 'Review header',
    stories: [
      {
        label: 'Default',
        title: 'Pfizer -> Metsera',
        meta: ['Value $7.3B', 'Merger', 'Signed Sep 22, 2025', 'Buyer: Paul Weiss', 'Target: Wachtell'],
      },
      {
        label: 'Long content',
        title: 'IBM -> Red Hat',
        subtitle: 'International Business Machines Corporation -> Red Hat, Inc.',
        meta: ['Value $34.0B', 'Merger', 'Signed Oct 28, 2018', 'Buyer: Cravath', 'Target: Skadden'],
      },
      {
        label: 'Extreme content',
        title: 'Strategic Buyer -> Target Operating Co.',
        subtitle: 'Strategic Buyer Holding Company With Multiple Intermediate Parents -> Target Operating Company With Extended Legal Name',
        meta: ['Value unavailable', 'Structure unavailable', 'Signed unavailable', 'Buyer: unavailable', 'Target: unavailable'],
      },
    ],
  },
  {
    name: 'Sidebar',
    stories: [
      {
        label: 'Default',
        sections: [
          {
            title: 'Representations',
            items: [
              { label: 'Capitalization', state: 'Current' },
              { label: 'Company MAE', state: 'Reviewed' },
            ],
          },
          {
            title: 'Conditions',
            items: [
              { label: 'Stockholder approval', state: 'Open' },
              { label: 'No injunction', state: 'Open' },
            ],
          },
        ],
      },
      {
        label: 'Long content',
        sections: [
          {
            title: 'Covenants',
            items: [
              { label: 'Capitalization; Subsidiaries - Options and Rights', state: 'Duplicate-safe' },
              { label: 'Interim operating covenant limiting equity grants outside ordinary course', state: 'Wrapped' },
            ],
          },
        ],
      },
      {
        label: 'Extreme content',
        sections: [
          {
            title: 'Conditions',
            items: [
              { label: 'Regulatory approvals and burdensome-condition covenant package', state: 'Focused' },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'Sidebar item',
    stories: [
      {
        label: 'Default',
        section: 'Company MAE',
        state: 'Current',
      },
      {
        label: 'Long content',
        section: 'Capitalization; Subsidiaries - Options and Rights',
        state: 'Duplicate-safe',
      },
      {
        label: 'Extreme content',
        section: 'Interim operating covenant limiting equity grants outside ordinary course',
        state: 'Wrapped',
      },
    ],
  },
  {
    name: 'Landing tile',
    stories: [
      {
        label: 'Default',
        title: 'Recent deals',
        body: 'Current deal list table lives here in Phase 6.',
        chip: 'active',
      },
      {
        label: 'Long content',
        title: 'Cross-cutting queries',
        body: 'Search across agreement concepts and extracted features.',
        chip: 'coming in WP-QUERY',
      },
      {
        label: 'Extreme content',
        title: 'Novel deals this month',
        body: 'Surface unusual provision positions after corpus-wide normalisation lands.',
        chip: 'coming in WP-NOVELTY',
      },
    ],
  },
  {
    name: 'Landing grid',
    stories: [
      {
        label: 'Default',
        tiles: [
          { title: 'Recent deals', body: 'Current deal list table lives here in Phase 6.', chip: 'active' },
          { title: 'Cross-cutting queries', body: 'Search across agreement concepts and extracted features.', chip: 'coming in WP-QUERY' },
          { title: 'Suite reports', body: 'Generate deal and corpus reports.', chip: 'coming in WP-REPORTS' },
        ],
      },
      {
        label: 'Long content',
        tiles: [
          { title: 'Novel deals this month', body: 'Surface unusual provision positions after corpus-wide normalisation lands.', chip: 'coming in WP-NOVELTY' },
          { title: 'Favorability rankings', body: 'Rank extracted positions once scoring lands.', chip: 'coming in WP-SCORE' },
        ],
      },
      {
        label: 'Extreme content',
        tiles: [
          { title: 'Cross-cutting queries across all loaded agreements', body: 'Planned query entrypoint for long-running corpus review workflows.', chip: 'planned' },
        ],
      },
    ],
  },
  {
    name: 'Empty tile',
    stories: [
      {
        label: 'Default',
        title: 'Cross-cutting queries',
        body: 'Coming in WP-QUERY.',
        chip: 'planned',
      },
      {
        label: 'Long content',
        title: 'Suite reports',
        body: 'Coming in WP-REPORTS with export-ready summaries.',
        chip: 'planned',
      },
      {
        label: 'Extreme content',
        title: 'Novel deals this month',
        body: 'Coming in WP-NOVELTY after corpus novelty scoring exists.',
        chip: 'planned',
      },
    ],
  },
  {
    name: 'Full document overlay',
    stories: [
      {
        label: 'Default',
        title: 'Pfizer -> Metsera',
        anchor: 'Conditions',
        body: 'Overlay opens on the selected passage with a persistent close affordance.',
      },
      {
        label: 'Long content',
        title: 'IBM -> Red Hat',
        anchor: 'Representations',
        body: 'Long documents keep the deal frame visible while the document scrolls.',
      },
      {
        label: 'Extreme content',
        title: 'Strategic Buyer -> Target Operating Co.',
        anchor: null,
        body: 'Missing anchors fall back to the top of the document.',
      },
    ],
  },
];

-- Precedent Machine — Seed Data
-- Run AFTER schema.sql in Supabase SQL Editor
-- Uses deterministic UUIDs for deals so references are stable

-- ════════════════════════════════════════════════════
-- USERS
-- ════════════════════════════════════════════════════

INSERT INTO users (id, name, is_admin) VALUES
  ('00000000-0000-4000-a000-000000000001', 'Ben', true),
  ('00000000-0000-4000-a000-000000000002', 'Junior Associate', false),
  ('00000000-0000-4000-a000-000000000003', 'Mid Associate', false)
ON CONFLICT (id) DO NOTHING;

-- ════════════════════════════════════════════════════
-- DEALS (10 deals with deterministic UUIDs)
-- ════════════════════════════════════════════════════

INSERT INTO deals (id, acquirer, target, value_usd, announce_date, sector, jurisdiction, structure, term_fee, agreement_type_id, metadata) VALUES
  (
    '00000000-0000-4000-b000-000000000001',
    'Broadcom Inc.', 'VMware, Inc.', 61000000000, '2022-05-26', 'Technology',
    'Delaware', 'Reverse triangular merger', '$1.5B / $1.5B',
    (SELECT id FROM agreement_types WHERE key = 'merger'),
    '{"lawyers":{"buyer":["Wachtell Lipton"],"seller":["Gibson Dunn"]},"advisors":{"buyer":["Silver Lake"],"seller":["Goldman Sachs","J.P. Morgan"]}}'::jsonb
  ),
  (
    '00000000-0000-4000-b000-000000000002',
    'Microsoft', 'Activision Blizzard', 68700000000, '2022-01-18', 'Technology/Gaming',
    'Delaware', 'Reverse triangular merger', '$2.5B / $3.0B',
    (SELECT id FROM agreement_types WHERE key = 'merger'),
    '{"lawyers":{"buyer":["Simpson Thacher"],"seller":["Skadden Arps"]},"advisors":{"buyer":["Goldman Sachs"],"seller":["Allen & Company"]}}'::jsonb
  ),
  (
    '00000000-0000-4000-b000-000000000003',
    'Pfizer', 'Seagen', 43000000000, '2023-03-13', 'Biopharma',
    'Delaware', 'Reverse triangular merger', '$1.25B / $2.2B',
    (SELECT id FROM agreement_types WHERE key = 'merger'),
    '{"lawyers":{"buyer":["Wachtell Lipton"],"seller":["Cravath Swaine"]},"advisors":{"buyer":["Guggenheim"],"seller":["Centerview","Goldman Sachs"]}}'::jsonb
  ),
  (
    '00000000-0000-4000-b000-000000000004',
    'Amgen', 'Horizon Therapeutics', 28300000000, '2022-12-12', 'Biopharma',
    'Delaware', 'Reverse triangular merger', '$750M / $1.8B',
    (SELECT id FROM agreement_types WHERE key = 'merger'),
    '{"lawyers":{"buyer":["Sullivan & Cromwell"],"seller":["Cooley"]},"advisors":{"buyer":["Morgan Stanley"],"seller":["Goldman Sachs","Centerview"]}}'::jsonb
  ),
  (
    '00000000-0000-4000-b000-000000000005',
    'Adobe', 'Figma', 20000000000, '2022-09-15', 'Technology',
    'Delaware', 'Merger (terminated)', '$1B reverse',
    (SELECT id FROM agreement_types WHERE key = 'merger'),
    '{"lawyers":{"buyer":["Cravath Swaine"],"seller":["Fenwick & West"]},"advisors":{"buyer":[],"seller":["Qatalyst Partners"]}}'::jsonb
  ),
  (
    '00000000-0000-4000-b000-000000000006',
    'X Holdings (Musk)', 'Twitter', 44000000000, '2022-04-25', 'Technology',
    'Delaware', 'Single-step merger', '$1B each',
    (SELECT id FROM agreement_types WHERE key = 'merger'),
    '{"lawyers":{"buyer":["Skadden Arps"],"seller":["Wilson Sonsini"]},"advisors":{"buyer":["Morgan Stanley"],"seller":["Goldman Sachs","J.P. Morgan"]}}'::jsonb
  ),
  (
    '00000000-0000-4000-b000-000000000007',
    'Merck', 'Prometheus Biosciences', 10800000000, '2023-04-16', 'Biopharma',
    'Delaware', 'Reverse triangular merger', '$350M (Co)',
    (SELECT id FROM agreement_types WHERE key = 'merger'),
    '{"lawyers":{"buyer":["Davis Polk"],"seller":["Cooley"]},"advisors":{"buyer":[],"seller":["Goldman Sachs"]}}'::jsonb
  ),
  (
    '00000000-0000-4000-b000-000000000008',
    'Cisco', 'Splunk', 28000000000, '2023-09-21', 'Technology',
    'Delaware', 'Reverse triangular merger', '$1.48B / $2.0B',
    (SELECT id FROM agreement_types WHERE key = 'merger'),
    '{"lawyers":{"buyer":["Simpson Thacher"],"seller":["Latham & Watkins"]},"advisors":{"buyer":["Barclays"],"seller":["Morgan Stanley","Goldman Sachs"]}}'::jsonb
  ),
  (
    '00000000-0000-4000-b000-000000000009',
    'Exxon Mobil', 'Pioneer Natural Resources', 59500000000, '2023-10-11', 'Energy',
    'Delaware', 'All-stock merger', 'N/A',
    (SELECT id FROM agreement_types WHERE key = 'merger'),
    '{"lawyers":{"buyer":["Davis Polk"],"seller":["Gibson Dunn"]},"advisors":{"buyer":[],"seller":["Evercore"]}}'::jsonb
  ),
  (
    '00000000-0000-4000-b000-000000000010',
    'Capital One', 'Discover Financial', 35300000000, '2024-02-19', 'Financial Services',
    'Delaware', 'Bank merger', '$1.38B each',
    (SELECT id FROM agreement_types WHERE key = 'merger'),
    '{"lawyers":{"buyer":["Wachtell Lipton"],"seller":["Sullivan & Cromwell"]},"advisors":{"buyer":["Centerview"],"seller":["Morgan Stanley"]}}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

-- ════════════════════════════════════════════════════
-- PROVISIONS
-- Uses deterministic UUIDs, links to deals + provision_categories
-- text_hash is auto-computed by the trigger
-- ════════════════════════════════════════════════════

-- Helper aliases for readability
-- d1 = Broadcom/VMware   = 00000000-0000-4000-b000-000000000001
-- d2 = Microsoft/Activision = 00000000-0000-4000-b000-000000000002
-- d3 = Pfizer/Seagen      = 00000000-0000-4000-b000-000000000003

-- ── Broadcom/VMware MAE provisions ──

INSERT INTO provisions (id, deal_id, provision_type_id, category_id, type, category, full_text, ai_favorability, sort_order) VALUES
  (
    '00000000-0000-4000-c000-000000000001',
    '00000000-0000-4000-b000-000000000001',
    (SELECT id FROM provision_types WHERE key = 'MAE'),
    (SELECT id FROM provision_categories WHERE label = 'Base Definition' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'MAE')),
    'MAE', 'Base Definition',
    '"Company Material Adverse Effect" means any change, effect, event, occurrence, state of facts or development that, individually or in the aggregate, has had or would reasonably be expected to have a material adverse effect on the business, financial condition, assets, liabilities or results of operations of the Company and its Subsidiaries, taken as a whole; provided, however, that none of the following shall be deemed to constitute, and none of the following shall be taken into account in determining whether there has been, a Company Material Adverse Effect:',
    'neutral', 1
  ),
  (
    '00000000-0000-4000-c000-000000000002',
    '00000000-0000-4000-b000-000000000001',
    (SELECT id FROM provision_types WHERE key = 'MAE'),
    (SELECT id FROM provision_categories WHERE label = 'General Economic / Market Conditions' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'MAE')),
    'MAE', 'General Economic / Market Conditions',
    'changes in general economic or political conditions or the financial, credit, debt, securities or other capital markets, in each case, in the United States or elsewhere in the world, including changes in interest rates, exchange rates and price of any security or market index',
    'mod-seller', 2
  ),
  (
    '00000000-0000-4000-c000-000000000003',
    '00000000-0000-4000-b000-000000000001',
    (SELECT id FROM provision_types WHERE key = 'MAE'),
    (SELECT id FROM provision_categories WHERE label = 'Changes in Law / GAAP' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'MAE')),
    'MAE', 'Changes in Law / GAAP',
    'any changes in applicable Law or GAAP (or authoritative interpretations thereof) or changes in regulatory accounting requirements applicable to the industries in which the Company operates, in each case, after the date of this Agreement',
    'neutral', 3
  ),
  (
    '00000000-0000-4000-c000-000000000004',
    '00000000-0000-4000-b000-000000000001',
    (SELECT id FROM provision_types WHERE key = 'MAE'),
    (SELECT id FROM provision_categories WHERE label = 'Industry Conditions' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'MAE')),
    'MAE', 'Industry Conditions',
    'changes in conditions generally affecting the industries in which the Company or any of its Subsidiaries operates',
    'mod-seller', 4
  ),
  (
    '00000000-0000-4000-c000-000000000005',
    '00000000-0000-4000-b000-000000000001',
    (SELECT id FROM provision_types WHERE key = 'MAE'),
    (SELECT id FROM provision_categories WHERE label = 'War / Terrorism' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'MAE')),
    'MAE', 'War / Terrorism',
    'acts of war (whether or not declared), armed hostilities, sabotage, terrorism, or any escalation or worsening thereof',
    'neutral', 5
  ),
  (
    '00000000-0000-4000-c000-000000000006',
    '00000000-0000-4000-b000-000000000001',
    (SELECT id FROM provision_types WHERE key = 'MAE'),
    (SELECT id FROM provision_categories WHERE label = 'Acts of God / Pandemic' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'MAE')),
    'MAE', 'Acts of God / Pandemic',
    'earthquakes, floods, hurricanes, tsunamis, tornadoes, wildfires or other natural disasters, weather conditions, pandemic, epidemic or disease outbreak (including COVID-19 or any COVID-19 Measures) or other force majeure events',
    'mod-seller', 6
  ),
  (
    '00000000-0000-4000-c000-000000000007',
    '00000000-0000-4000-b000-000000000001',
    (SELECT id FROM provision_types WHERE key = 'MAE'),
    (SELECT id FROM provision_categories WHERE label = 'Failure to Meet Projections' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'MAE')),
    'MAE', 'Failure to Meet Projections',
    'any failure by the Company to meet any projections, forecasts or estimates of revenue, earnings or other financial performance or results of operations (it being understood that the facts or occurrences giving rise to or contributing to such failure that are not otherwise excluded from the definition of Company Material Adverse Effect may be taken into account in determining whether there has been a Company Material Adverse Effect)',
    'neutral', 7
  ),
  (
    '00000000-0000-4000-c000-000000000008',
    '00000000-0000-4000-b000-000000000001',
    (SELECT id FROM provision_types WHERE key = 'MAE'),
    (SELECT id FROM provision_categories WHERE label = 'Announcement / Pendency Effects' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'MAE')),
    'MAE', 'Announcement / Pendency Effects',
    'the announcement or pendency of the Merger or the other transactions contemplated hereby, including the impact thereof on relationships with customers, suppliers, distributors, partners, employees, Governmental Authorities or others having business dealings with the Company',
    'mod-seller', 8
  ),
  (
    '00000000-0000-4000-c000-000000000009',
    '00000000-0000-4000-b000-000000000001',
    (SELECT id FROM provision_types WHERE key = 'MAE'),
    (SELECT id FROM provision_categories WHERE label = 'Actions at Parent Request' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'MAE')),
    'MAE', 'Actions at Parent Request',
    'any action taken or omitted to be taken at the express written request or with the prior written consent of Parent or as expressly required by this Agreement',
    'mod-seller', 9
  ),
  (
    '00000000-0000-4000-c000-000000000010',
    '00000000-0000-4000-b000-000000000001',
    (SELECT id FROM provision_types WHERE key = 'MAE'),
    (SELECT id FROM provision_categories WHERE label = 'Disproportionate Impact Qualifier' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'MAE')),
    'MAE', 'Disproportionate Impact Qualifier',
    'except, in the case of clauses (a) through (f) above, to the extent that the Company and its Subsidiaries, taken as a whole, are disproportionately affected thereby relative to other participants in the industries in which the Company and its Subsidiaries operate (in which case, only the incremental disproportionate impact may be taken into account)',
    'neutral', 10
  )
ON CONFLICT (id) DO NOTHING;

-- ── Pfizer/Seagen MAE provisions ──

INSERT INTO provisions (id, deal_id, provision_type_id, category_id, type, category, full_text, ai_favorability, sort_order) VALUES
  (
    '00000000-0000-4000-c000-000000000011',
    '00000000-0000-4000-b000-000000000003',
    (SELECT id FROM provision_types WHERE key = 'MAE'),
    (SELECT id FROM provision_categories WHERE label = 'Base Definition' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'MAE')),
    'MAE', 'Base Definition',
    '"Company Material Adverse Effect" means any change, effect, event, occurrence, state of facts or development that, individually or in the aggregate, has had or would reasonably be expected to have a material adverse effect on the business, results of operations or financial condition of the Company and its Subsidiaries, taken as a whole; provided, however, that none of the following (or the results thereof) shall be deemed to constitute, and none of the following (or the results thereof) shall be taken into account in determining whether there has been, a Company Material Adverse Effect:',
    'neutral', 1
  ),
  (
    '00000000-0000-4000-c000-000000000012',
    '00000000-0000-4000-b000-000000000003',
    (SELECT id FROM provision_types WHERE key = 'MAE'),
    (SELECT id FROM provision_categories WHERE label = 'General Economic / Market Conditions' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'MAE')),
    'MAE', 'General Economic / Market Conditions',
    'changes in general economic conditions or the financial or securities markets generally (including changes in interest rates or exchange rates)',
    'neutral', 2
  ),
  (
    '00000000-0000-4000-c000-000000000013',
    '00000000-0000-4000-b000-000000000003',
    (SELECT id FROM provision_types WHERE key = 'MAE'),
    (SELECT id FROM provision_categories WHERE label = 'Changes in Law / GAAP' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'MAE')),
    'MAE', 'Changes in Law / GAAP',
    'changes in applicable Law or GAAP (or authoritative interpretation thereof) after the date hereof',
    'mod-buyer', 3
  ),
  (
    '00000000-0000-4000-c000-000000000014',
    '00000000-0000-4000-b000-000000000003',
    (SELECT id FROM provision_types WHERE key = 'MAE'),
    (SELECT id FROM provision_categories WHERE label = 'Industry Conditions' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'MAE')),
    'MAE', 'Industry Conditions',
    'changes in conditions generally affecting the pharmaceutical or biotechnology industries',
    'neutral', 4
  ),
  (
    '00000000-0000-4000-c000-000000000015',
    '00000000-0000-4000-b000-000000000003',
    (SELECT id FROM provision_types WHERE key = 'MAE'),
    (SELECT id FROM provision_categories WHERE label = 'War / Terrorism' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'MAE')),
    'MAE', 'War / Terrorism',
    'acts of war (whether or not declared), armed hostilities, sabotage, terrorism, or any escalation or worsening thereof',
    'neutral', 5
  ),
  (
    '00000000-0000-4000-c000-000000000016',
    '00000000-0000-4000-b000-000000000003',
    (SELECT id FROM provision_types WHERE key = 'MAE'),
    (SELECT id FROM provision_categories WHERE label = 'Acts of God / Pandemic' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'MAE')),
    'MAE', 'Acts of God / Pandemic',
    'earthquakes, floods, hurricanes, tsunamis, tornadoes, or other natural disasters, pandemic, epidemic or disease outbreak (including COVID-19 or any COVID-19 Measures), or other force majeure events',
    'mod-seller', 6
  ),
  (
    '00000000-0000-4000-c000-000000000017',
    '00000000-0000-4000-b000-000000000003',
    (SELECT id FROM provision_types WHERE key = 'MAE'),
    (SELECT id FROM provision_categories WHERE label = 'Failure to Meet Projections' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'MAE')),
    'MAE', 'Failure to Meet Projections',
    'the failure of the Company to meet any internal or published projections, forecasts or estimates of revenue, earnings or other financial performance or results of operations for any period (it being understood that the underlying causes of such failure may be considered in determining whether a Company Material Adverse Effect has occurred to the extent not otherwise excluded hereby)',
    'neutral', 7
  ),
  (
    '00000000-0000-4000-c000-000000000018',
    '00000000-0000-4000-b000-000000000003',
    (SELECT id FROM provision_types WHERE key = 'MAE'),
    (SELECT id FROM provision_categories WHERE label = 'Announcement / Pendency Effects' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'MAE')),
    'MAE', 'Announcement / Pendency Effects',
    'any effects arising from the announcement, pendency, or anticipated consummation of the Merger, including the impact thereof on relationships, contractual or otherwise, with customers, suppliers, distributors, partners, employees, or Governmental Authorities, or the identity of Parent or its Affiliates',
    'mod-seller', 8
  ),
  (
    '00000000-0000-4000-c000-000000000019',
    '00000000-0000-4000-b000-000000000003',
    (SELECT id FROM provision_types WHERE key = 'MAE'),
    (SELECT id FROM provision_categories WHERE label = 'Actions at Parent Request' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'MAE')),
    'MAE', 'Actions at Parent Request',
    'any action taken or omitted to be taken by the Company at the written request or with the prior written consent of Parent or as expressly required by this Agreement or the transactions contemplated hereby',
    'mod-seller', 9
  ),
  (
    '00000000-0000-4000-c000-000000000020',
    '00000000-0000-4000-b000-000000000003',
    (SELECT id FROM provision_types WHERE key = 'MAE'),
    (SELECT id FROM provision_categories WHERE label = 'Disproportionate Impact Qualifier' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'MAE')),
    'MAE', 'Disproportionate Impact Qualifier',
    'except, in the case of clauses (a) through (f) above, to the extent such changes have a disproportionate adverse effect on the Company and its Subsidiaries, taken as a whole, relative to other similarly situated companies in the pharmaceutical and biotechnology industries (in which case only the incremental disproportionate impact may be taken into account)',
    'neutral', 10
  )
ON CONFLICT (id) DO NOTHING;

-- ── Microsoft/Activision MAE provisions ──

INSERT INTO provisions (id, deal_id, provision_type_id, category_id, type, category, full_text, ai_favorability, sort_order) VALUES
  (
    '00000000-0000-4000-c000-000000000021',
    '00000000-0000-4000-b000-000000000002',
    (SELECT id FROM provision_types WHERE key = 'MAE'),
    (SELECT id FROM provision_categories WHERE label = 'Base Definition' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'MAE')),
    'MAE', 'Base Definition',
    '"Company Material Adverse Effect" means any change, effect, event, occurrence, state of facts or development that, individually or in the aggregate, has had or would reasonably be expected to have a material adverse effect on the business, financial condition, assets or results of operations of the Company and its Subsidiaries, taken as a whole; provided, however, that in no event shall any of the following, alone or in combination, be deemed to constitute, or be taken into account in determining whether there has been or would reasonably be expected to be, a Company Material Adverse Effect:',
    'neutral', 1
  ),
  (
    '00000000-0000-4000-c000-000000000022',
    '00000000-0000-4000-b000-000000000002',
    (SELECT id FROM provision_types WHERE key = 'MAE'),
    (SELECT id FROM provision_categories WHERE label = 'General Economic / Market Conditions' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'MAE')),
    'MAE', 'General Economic / Market Conditions',
    'changes in general economic, regulatory or political conditions or the financial, credit or securities markets generally, including changes in interest rates or exchange rates',
    'neutral', 2
  ),
  (
    '00000000-0000-4000-c000-000000000023',
    '00000000-0000-4000-b000-000000000002',
    (SELECT id FROM provision_types WHERE key = 'MAE'),
    (SELECT id FROM provision_categories WHERE label = 'Changes in Law / GAAP' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'MAE')),
    'MAE', 'Changes in Law / GAAP',
    'changes in Law or GAAP (or interpretation thereof) after the date hereof',
    'mod-buyer', 3
  ),
  (
    '00000000-0000-4000-c000-000000000024',
    '00000000-0000-4000-b000-000000000002',
    (SELECT id FROM provision_types WHERE key = 'MAE'),
    (SELECT id FROM provision_categories WHERE label = 'Industry Conditions' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'MAE')),
    'MAE', 'Industry Conditions',
    'changes in conditions generally affecting the interactive entertainment industry',
    'neutral', 4
  ),
  (
    '00000000-0000-4000-c000-000000000025',
    '00000000-0000-4000-b000-000000000002',
    (SELECT id FROM provision_types WHERE key = 'MAE'),
    (SELECT id FROM provision_categories WHERE label = 'War / Terrorism' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'MAE')),
    'MAE', 'War / Terrorism',
    'acts of war (whether or not declared), sabotage, terrorism, or any escalation or worsening thereof, or the outbreak or escalation of hostilities',
    'neutral', 5
  ),
  (
    '00000000-0000-4000-c000-000000000026',
    '00000000-0000-4000-b000-000000000002',
    (SELECT id FROM provision_types WHERE key = 'MAE'),
    (SELECT id FROM provision_categories WHERE label = 'Acts of God / Pandemic' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'MAE')),
    'MAE', 'Acts of God / Pandemic',
    'any earthquake, hurricane, tsunami, tornado, flood, mudslide, wildfire, or other natural disaster, epidemic, pandemic or disease outbreak (including COVID-19 or any COVID-19 Measures), or any other force majeure event',
    'mod-seller', 6
  ),
  (
    '00000000-0000-4000-c000-000000000027',
    '00000000-0000-4000-b000-000000000002',
    (SELECT id FROM provision_types WHERE key = 'MAE'),
    (SELECT id FROM provision_categories WHERE label = 'Failure to Meet Projections' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'MAE')),
    'MAE', 'Failure to Meet Projections',
    'any failure by the Company to meet any internal or published projections, estimates or forecasts of revenue, earnings or other financial performance or results of operations for any period (provided that the underlying facts and circumstances giving rise to such failure may be taken into account in determining whether a Company Material Adverse Effect has occurred or would reasonably be expected to occur to the extent not otherwise excluded)',
    'neutral', 7
  ),
  (
    '00000000-0000-4000-c000-000000000028',
    '00000000-0000-4000-b000-000000000002',
    (SELECT id FROM provision_types WHERE key = 'MAE'),
    (SELECT id FROM provision_categories WHERE label = 'Announcement / Pendency Effects' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'MAE')),
    'MAE', 'Announcement / Pendency Effects',
    'the announcement, pendency or consummation of the transactions contemplated by this Agreement, including the impact thereof on relationships, contractual or otherwise, with customers, suppliers, partners, licensors, licensees, distributors, employees or Governmental Authorities, or the identity of Parent or its Affiliates',
    'strong-seller', 8
  ),
  (
    '00000000-0000-4000-c000-000000000029',
    '00000000-0000-4000-b000-000000000002',
    (SELECT id FROM provision_types WHERE key = 'MAE'),
    (SELECT id FROM provision_categories WHERE label = 'Actions at Parent Request' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'MAE')),
    'MAE', 'Actions at Parent Request',
    'any action taken or omitted to be taken by the Company at the express written request or with the prior written consent of Parent or as expressly required by this Agreement or the transactions contemplated hereby',
    'mod-seller', 9
  ),
  (
    '00000000-0000-4000-c000-000000000030',
    '00000000-0000-4000-b000-000000000002',
    (SELECT id FROM provision_types WHERE key = 'MAE'),
    (SELECT id FROM provision_categories WHERE label = 'Disproportionate Impact Qualifier' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'MAE')),
    'MAE', 'Disproportionate Impact Qualifier',
    'except, in the case of clauses (a) through (f) above, to the extent that such change disproportionately adversely affects the Company and its Subsidiaries, taken as a whole, relative to other participants in the industries in which the Company and its Subsidiaries operate (in which case only the incremental disproportionate impact may be taken into account)',
    'neutral', 10
  ),
  (
    '00000000-0000-4000-c000-000000000031',
    '00000000-0000-4000-b000-000000000002',
    (SELECT id FROM provision_types WHERE key = 'MAE'),
    (SELECT id FROM provision_categories WHERE label = 'Changes in Stock Price' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'MAE')),
    'MAE', 'Changes in Stock Price',
    'any decline in the market price or trading volume of Company Common Stock (provided that the underlying facts and circumstances giving rise to or contributing to such decline may be taken into account in determining whether a Company Material Adverse Effect has occurred to the extent not otherwise excluded)',
    'mod-seller', 11
  )
ON CONFLICT (id) DO NOTHING;

-- ── Broadcom/VMware IOC provisions ──

INSERT INTO provisions (id, deal_id, provision_type_id, category_id, type, category, full_text, ai_favorability, sort_order) VALUES
  (
    '00000000-0000-4000-c000-000000000040',
    '00000000-0000-4000-b000-000000000001',
    (SELECT id FROM provision_types WHERE key = 'IOC'),
    (SELECT id FROM provision_categories WHERE label = 'M&A / Acquisitions' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'IOC')),
    'IOC', 'M&A / Acquisitions',
    'shall not acquire or agree to acquire, by merging or consolidating with, by purchasing an equity interest in or a material portion of the assets of, or by any other manner, any business or any corporation, partnership, association or other business organization or division thereof, or otherwise acquire or agree to acquire any assets, in each case with a value in excess of $100,000,000 individually or $250,000,000 in the aggregate',
    'mod-buyer', 1
  ),
  (
    '00000000-0000-4000-c000-000000000041',
    '00000000-0000-4000-b000-000000000001',
    (SELECT id FROM provision_types WHERE key = 'IOC'),
    (SELECT id FROM provision_categories WHERE label = 'Dividends / Distributions' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'IOC')),
    'IOC', 'Dividends / Distributions',
    'shall not declare, set aside, make or pay any dividends or other distributions, whether payable in cash, stock, property or otherwise, with respect to any of its capital stock, other than (i) regular quarterly cash dividends not exceeding $0.46 per share consistent with the existing dividend policy and (ii) dividends by a direct or indirect wholly owned Subsidiary to its parent',
    'neutral', 2
  ),
  (
    '00000000-0000-4000-c000-000000000042',
    '00000000-0000-4000-b000-000000000001',
    (SELECT id FROM provision_types WHERE key = 'IOC'),
    (SELECT id FROM provision_categories WHERE label = 'Equity Issuances' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'IOC')),
    'IOC', 'Equity Issuances',
    'shall not issue, sell, pledge, dispose of, grant, transfer, encumber, or authorize the issuance, sale, pledge, disposition, grant, transfer or encumbrance of, any shares of capital stock or securities convertible or exchangeable into or exercisable for any shares of such capital stock, except (i) issuance upon exercise of outstanding Company Options or settlement of Company RSUs, and (ii) issuances under the Company ESPP in the ordinary course',
    'mod-buyer', 3
  ),
  (
    '00000000-0000-4000-c000-000000000043',
    '00000000-0000-4000-b000-000000000001',
    (SELECT id FROM provision_types WHERE key = 'IOC'),
    (SELECT id FROM provision_categories WHERE label = 'Indebtedness' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'IOC')),
    'IOC', 'Indebtedness',
    'shall not incur any indebtedness for borrowed money or issue any debt securities or assume, guarantee or endorse the obligations of any Person for borrowed money, in each case in excess of $500,000,000 in the aggregate, except (i) under existing credit facilities in the ordinary course, (ii) intercompany indebtedness, or (iii) letters of credit in the ordinary course',
    'neutral', 4
  ),
  (
    '00000000-0000-4000-c000-000000000044',
    '00000000-0000-4000-b000-000000000001',
    (SELECT id FROM provision_types WHERE key = 'IOC'),
    (SELECT id FROM provision_categories WHERE label = 'Capital Expenditures' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'IOC')),
    'IOC', 'Capital Expenditures',
    'shall not make or commit to make capital expenditures in excess of 110% of the amount set forth in the Company capital expenditure budget provided to Parent prior to the date hereof for the applicable period',
    'mod-buyer', 5
  ),
  (
    '00000000-0000-4000-c000-000000000045',
    '00000000-0000-4000-b000-000000000001',
    (SELECT id FROM provision_types WHERE key = 'IOC'),
    (SELECT id FROM provision_categories WHERE label = 'Employee Compensation' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'IOC')),
    'IOC', 'Employee Compensation',
    'shall not (i) increase compensation or benefits of any current or former director, officer or employee except (A) in the ordinary course consistent with past practice for non-officer employees, (B) as required by applicable Law, or (C) as required by any existing Company Benefit Plan; (ii) grant any equity awards except in the ordinary course consistent with past practice; or (iii) adopt, enter into, materially amend or terminate any Company Benefit Plan',
    'mod-buyer', 6
  )
ON CONFLICT (id) DO NOTHING;

-- ── Pfizer/Seagen IOC provisions ──

INSERT INTO provisions (id, deal_id, provision_type_id, category_id, type, category, full_text, ai_favorability, sort_order) VALUES
  (
    '00000000-0000-4000-c000-000000000050',
    '00000000-0000-4000-b000-000000000003',
    (SELECT id FROM provision_types WHERE key = 'IOC'),
    (SELECT id FROM provision_categories WHERE label = 'M&A / Acquisitions' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'IOC')),
    'IOC', 'M&A / Acquisitions',
    'shall not acquire or agree to acquire, by merging or consolidating with, by purchasing an equity interest in or a portion of the assets of, or by any other manner, any business or any Person or division thereof, except for acquisitions of assets (other than equity interests) in the ordinary course of business not exceeding $50,000,000 individually or $150,000,000 in the aggregate',
    'mod-buyer', 1
  ),
  (
    '00000000-0000-4000-c000-000000000051',
    '00000000-0000-4000-b000-000000000003',
    (SELECT id FROM provision_types WHERE key = 'IOC'),
    (SELECT id FROM provision_categories WHERE label = 'Dividends / Distributions' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'IOC')),
    'IOC', 'Dividends / Distributions',
    'shall not declare, set aside, make or pay any dividends or distributions except (i) regular quarterly cash dividends consistent with past practice not exceeding the per-share amount of the most recent quarterly dividend prior to the date hereof, and (ii) dividends by wholly owned Subsidiaries to their parent',
    'neutral', 2
  ),
  (
    '00000000-0000-4000-c000-000000000052',
    '00000000-0000-4000-b000-000000000003',
    (SELECT id FROM provision_types WHERE key = 'IOC'),
    (SELECT id FROM provision_categories WHERE label = 'Equity Issuances' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'IOC')),
    'IOC', 'Equity Issuances',
    'shall not issue, sell, grant, pledge or otherwise encumber any shares of capital stock or securities convertible or exchangeable therefor, except (i) upon the exercise or settlement of Company equity awards outstanding on the date hereof, (ii) under the ESPP consistent with past practice, or (iii) in connection with tax withholding obligations arising from settlement of equity awards',
    'neutral', 3
  ),
  (
    '00000000-0000-4000-c000-000000000053',
    '00000000-0000-4000-b000-000000000003',
    (SELECT id FROM provision_types WHERE key = 'IOC'),
    (SELECT id FROM provision_categories WHERE label = 'Indebtedness' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'IOC')),
    'IOC', 'Indebtedness',
    'shall not incur, assume, guarantee or otherwise become liable for any indebtedness for borrowed money, other than (i) borrowings under existing credit facilities in the ordinary course not to exceed $100,000,000, (ii) intercompany indebtedness, and (iii) letters of credit in the ordinary course',
    'mod-buyer', 4
  ),
  (
    '00000000-0000-4000-c000-000000000054',
    '00000000-0000-4000-b000-000000000003',
    (SELECT id FROM provision_types WHERE key = 'IOC'),
    (SELECT id FROM provision_categories WHERE label = 'Capital Expenditures' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'IOC')),
    'IOC', 'Capital Expenditures',
    'shall not make or commit to make capital expenditures other than (i) in the ordinary course consistent with existing plans and budget, and (ii) any individual expenditure not in excess of $25,000,000 or aggregate expenditures not in excess of $75,000,000 in excess of such budget',
    'mod-buyer', 5
  ),
  (
    '00000000-0000-4000-c000-000000000055',
    '00000000-0000-4000-b000-000000000003',
    (SELECT id FROM provision_types WHERE key = 'IOC'),
    (SELECT id FROM provision_categories WHERE label = 'Employee Compensation' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'IOC')),
    'IOC', 'Employee Compensation',
    'shall not (i) increase compensation except (A) annual merit increases in the ordinary course not exceeding 5% for non-officer employees, (B) as required by applicable Law or existing plans, or (C) new hires below VP level at compensation consistent with past practice; (ii) grant any equity awards; or (iii) adopt or materially amend any Company Benefit Plan',
    'mod-buyer', 6
  )
ON CONFLICT (id) DO NOTHING;

-- ── Microsoft/Activision IOC provisions ──

INSERT INTO provisions (id, deal_id, provision_type_id, category_id, type, category, full_text, ai_favorability, sort_order) VALUES
  (
    '00000000-0000-4000-c000-000000000060',
    '00000000-0000-4000-b000-000000000002',
    (SELECT id FROM provision_types WHERE key = 'IOC'),
    (SELECT id FROM provision_categories WHERE label = 'M&A / Acquisitions' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'IOC')),
    'IOC', 'M&A / Acquisitions',
    'shall not acquire or agree to acquire, by merging or consolidating with, by purchasing an equity interest in or a material portion of the assets of, or by any other manner, any business or any Person or division thereof, except for (i) purchases of assets in the ordinary course not exceeding $50,000,000 individually and (ii) transactions solely between the Company and wholly owned Subsidiaries or solely between wholly owned Subsidiaries',
    'mod-buyer', 1
  ),
  (
    '00000000-0000-4000-c000-000000000061',
    '00000000-0000-4000-b000-000000000002',
    (SELECT id FROM provision_types WHERE key = 'IOC'),
    (SELECT id FROM provision_categories WHERE label = 'Dividends / Distributions' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'IOC')),
    'IOC', 'Dividends / Distributions',
    'shall not declare, set aside, make or pay any dividend or other distribution with respect to any capital stock, other than (i) regular quarterly cash dividends not exceeding $0.47 per share consistent with the existing dividend policy and (ii) dividends by a direct or indirect wholly owned Subsidiary to its parent',
    'neutral', 2
  ),
  (
    '00000000-0000-4000-c000-000000000062',
    '00000000-0000-4000-b000-000000000002',
    (SELECT id FROM provision_types WHERE key = 'IOC'),
    (SELECT id FROM provision_categories WHERE label = 'Equity Issuances' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'IOC')),
    'IOC', 'Equity Issuances',
    'shall not issue, sell, grant, pledge, dispose of or encumber any shares of capital stock or securities convertible or exercisable therefor, except (i) pursuant to outstanding Company equity awards, (ii) under the ESPP consistent with past practice, or (iii) in connection with tax withholding obligations',
    'neutral', 3
  ),
  (
    '00000000-0000-4000-c000-000000000063',
    '00000000-0000-4000-b000-000000000002',
    (SELECT id FROM provision_types WHERE key = 'IOC'),
    (SELECT id FROM provision_categories WHERE label = 'Indebtedness' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'IOC')),
    'IOC', 'Indebtedness',
    'shall not incur any indebtedness for borrowed money or issue any debt securities, except (i) borrowings under existing credit facilities in the ordinary course not exceeding $100,000,000, (ii) intercompany indebtedness in the ordinary course, and (iii) letters of credit, performance bonds or surety bonds in the ordinary course',
    'neutral', 4
  ),
  (
    '00000000-0000-4000-c000-000000000064',
    '00000000-0000-4000-b000-000000000002',
    (SELECT id FROM provision_types WHERE key = 'IOC'),
    (SELECT id FROM provision_categories WHERE label = 'Capital Expenditures' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'IOC')),
    'IOC', 'Capital Expenditures',
    'shall not make or commit to make capital expenditures in excess of the amounts set forth in the Company Disclosure Letter for the applicable period (plus a 10% variance)',
    'mod-buyer', 5
  ),
  (
    '00000000-0000-4000-c000-000000000065',
    '00000000-0000-4000-b000-000000000002',
    (SELECT id FROM provision_types WHERE key = 'IOC'),
    (SELECT id FROM provision_categories WHERE label = 'Employee Compensation' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'IOC')),
    'IOC', 'Employee Compensation',
    'shall not (i) increase compensation or benefits except (A) in the ordinary course consistent with past practice for non-director/officer employees, (B) as required by applicable Law, or (C) as required by existing Company Benefit Plans; (ii) grant equity awards except annual grants in the ordinary course; or (iii) adopt, enter into, materially amend or terminate any material Company Benefit Plan',
    'mod-buyer', 6
  )
ON CONFLICT (id) DO NOTHING;

-- ── Twitter/Musk (X Holdings) Section 6.1 IOC provisions ──

INSERT INTO provisions (id, deal_id, provision_type_id, category_id, type, category, full_text, ai_favorability, sort_order) VALUES
  (
    '00000000-0000-4000-c000-000000000070',
    '00000000-0000-4000-b000-000000000006',
    (SELECT id FROM provision_types WHERE key = 'IOC'),
    (SELECT id FROM provision_categories WHERE label = 'Ordinary Course Standard' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'IOC')),
    'IOC', 'Ordinary Course Standard',
    'From the date of this Agreement until the earlier of the Effective Time and the termination of this Agreement in accordance with Article IX, except as set forth in Section 6.1 of the Company Disclosure Letter, as required by applicable Law, or as otherwise expressly contemplated by this Agreement, the Company shall, and shall cause each of its Subsidiaries to, use commercially reasonable efforts to conduct its business in the ordinary course of business consistent with past practice in all material respects and, to the extent consistent therewith, use commercially reasonable efforts to preserve substantially intact its current business organization, to keep available the services of its current officers and key employees, and to preserve its relationships with customers, suppliers, licensors, licensees, distributors and others having business dealings with it.',
    'neutral', 1
  ),
  (
    '00000000-0000-4000-c000-000000000071',
    '00000000-0000-4000-b000-000000000006',
    (SELECT id FROM provision_types WHERE key = 'IOC'),
    (SELECT id FROM provision_categories WHERE label = 'Charter / Organizational Amendments' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'IOC')),
    'IOC', 'Charter / Organizational Amendments',
    'shall not amend or otherwise change the Company Certificate of Incorporation, the Company Bylaws, or the equivalent organizational documents of any Subsidiary, except as required by applicable Law',
    'mod-buyer', 2
  ),
  (
    '00000000-0000-4000-c000-000000000072',
    '00000000-0000-4000-b000-000000000006',
    (SELECT id FROM provision_types WHERE key = 'IOC'),
    (SELECT id FROM provision_categories WHERE label = 'Stock Repurchases / Splits' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'IOC')),
    'IOC', 'Stock Repurchases / Splits',
    'shall not split, combine, subdivide or reclassify any shares of capital stock of the Company or any Subsidiary, or repurchase, redeem or otherwise acquire any shares of capital stock, except (i) for the acquisition of shares of Company Common Stock from holders of Company Stock Awards in full or partial payment of any taxes payable by such holders upon the exercise, settlement or vesting thereof, and (ii) as required by existing Company Benefit Plans in effect on the date hereof',
    'mod-buyer', 3
  ),
  (
    '00000000-0000-4000-c000-000000000073',
    '00000000-0000-4000-b000-000000000006',
    (SELECT id FROM provision_types WHERE key = 'IOC'),
    (SELECT id FROM provision_categories WHERE label = 'Equity Issuances' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'IOC')),
    'IOC', 'Equity Issuances',
    'shall not issue, sell, pledge, dispose of, grant, transfer, encumber, or authorize the issuance, sale, pledge, disposition, grant, transfer or encumbrance of any shares of capital stock or voting securities, or any securities convertible into or exchangeable for any such shares of capital stock or voting securities, or any rights, warrants or options to acquire any such shares, voting securities or convertible or exchangeable securities, except (i) the issuance of shares of Company Common Stock upon the exercise or settlement of Company Stock Awards, (ii) issuances in the ordinary course under the Company ESPP',
    'mod-buyer', 4
  ),
  (
    '00000000-0000-4000-c000-000000000074',
    '00000000-0000-4000-b000-000000000006',
    (SELECT id FROM provision_types WHERE key = 'IOC'),
    (SELECT id FROM provision_categories WHERE label = 'Dividends / Distributions' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'IOC')),
    'IOC', 'Dividends / Distributions',
    'shall not declare, set aside, make or pay any dividend or other distribution, whether payable in cash, stock, property or otherwise, with respect to any of its capital stock, other than dividends by a direct or indirect wholly owned Subsidiary to its parent or another wholly owned Subsidiary',
    'mod-buyer', 5
  ),
  (
    '00000000-0000-4000-c000-000000000075',
    '00000000-0000-4000-b000-000000000006',
    (SELECT id FROM provision_types WHERE key = 'IOC'),
    (SELECT id FROM provision_categories WHERE label = 'Employee Compensation' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'IOC')),
    'IOC', 'Employee Compensation',
    'shall not (i) grant or increase any severance, change in control, retention or termination pay to, or enter into any new severance, change in control, retention or termination agreement with, any current or former employee, officer, director or individual independent contractor, other than in the ordinary course consistent with past practice for employees who are not officers or directors; (ii) increase the compensation or benefits payable or to become payable to any current or former employee, officer, director or individual independent contractor, except for increases in the ordinary course consistent with past practice for non-officer employees; (iii) establish, adopt, enter into, amend or terminate any Company Benefit Plan or any arrangement that would have been a Company Benefit Plan had it been entered into prior to the date hereof, except as required by applicable Law or the terms of any Company Benefit Plan as in effect on the date hereof',
    'mod-buyer', 6
  ),
  (
    '00000000-0000-4000-c000-000000000076',
    '00000000-0000-4000-b000-000000000006',
    (SELECT id FROM provision_types WHERE key = 'IOC'),
    (SELECT id FROM provision_categories WHERE label = 'Equity Issuances' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'IOC')),
    'IOC', 'Equity Issuances',
    'shall not grant any equity or equity-based awards to any current or former employee, officer, director or individual independent contractor, except for grants of Company RSUs in the ordinary course of business consistent with past practice to newly hired or promoted non-officer employees',
    'mod-buyer', 7
  ),
  (
    '00000000-0000-4000-c000-000000000077',
    '00000000-0000-4000-b000-000000000006',
    (SELECT id FROM provision_types WHERE key = 'IOC'),
    (SELECT id FROM provision_categories WHERE label = 'Labor Agreements' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'IOC')),
    'IOC', 'Labor Agreements',
    'shall not recognize any labor union or enter into any collective bargaining agreement or other labor union contract applicable to the employees of the Company or any Subsidiary, except as required by applicable Law',
    'mod-buyer', 8
  ),
  (
    '00000000-0000-4000-c000-000000000078',
    '00000000-0000-4000-b000-000000000006',
    (SELECT id FROM provision_types WHERE key = 'IOC'),
    (SELECT id FROM provision_categories WHERE label = 'M&A / Acquisitions' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'IOC')),
    'IOC', 'M&A / Acquisitions',
    'shall not acquire or agree to acquire (including by merger, consolidation, or acquisition of stock or assets or any other business combination) any corporation, partnership, other business organization or any division thereof or any material amount of assets, in each case in excess of $100,000,000 individually or $250,000,000 in the aggregate, other than purchases of equipment and other assets in the ordinary course of business consistent with past practice',
    'mod-buyer', 9
  ),
  (
    '00000000-0000-4000-c000-000000000079',
    '00000000-0000-4000-b000-000000000006',
    (SELECT id FROM provision_types WHERE key = 'IOC'),
    (SELECT id FROM provision_categories WHERE label = 'Indebtedness' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'IOC')),
    'IOC', 'Indebtedness',
    'shall not incur any indebtedness for borrowed money or guarantee any such indebtedness, or issue or sell any debt securities or options, warrants, calls or other rights to acquire any debt securities, except (i) indebtedness incurred under existing credit facilities in the ordinary course not exceeding $500,000,000 in aggregate principal amount at any time outstanding, (ii) intercompany indebtedness among the Company and its wholly owned Subsidiaries, and (iii) letters of credit, bank guarantees, surety bonds, performance bonds or similar instruments issued in the ordinary course',
    'neutral', 10
  ),
  (
    '00000000-0000-4000-c000-000000000080',
    '00000000-0000-4000-b000-000000000006',
    (SELECT id FROM provision_types WHERE key = 'IOC'),
    (SELECT id FROM provision_categories WHERE label = 'Material Contracts' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'IOC')),
    'IOC', 'Material Contracts',
    'shall not enter into, modify or amend in any material respect, or terminate or waive any material right under, any Material Contract or any Contract that would have been a Material Contract had it been entered into prior to the date hereof, other than in the ordinary course of business consistent with past practice',
    'mod-buyer', 11
  ),
  (
    '00000000-0000-4000-c000-000000000081',
    '00000000-0000-4000-b000-000000000006',
    (SELECT id FROM provision_types WHERE key = 'IOC'),
    (SELECT id FROM provision_categories WHERE label = 'Accounting / Tax Changes' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'IOC')),
    'IOC', 'Accounting / Tax Changes',
    'shall not make any change in financial accounting methods, principles or practices materially affecting the consolidated assets, liabilities or results of operations of the Company, except insofar as may have been required by a change in GAAP or Regulation S-X under the Securities Act',
    'neutral', 12
  ),
  (
    '00000000-0000-4000-c000-000000000082',
    '00000000-0000-4000-b000-000000000006',
    (SELECT id FROM provision_types WHERE key = 'IOC'),
    (SELECT id FROM provision_categories WHERE label = 'Accounting / Tax Changes' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'IOC')),
    'IOC', 'Accounting / Tax Changes',
    'shall not make, change or revoke any material Tax election, change an annual Tax accounting period, adopt or change any material Tax accounting method, file any material amended Tax Return, enter into any closing agreement with respect to a material amount of Taxes, settle any material Tax claim or assessment, or surrender any right to claim a material refund of Taxes, except in the ordinary course of business consistent with past practice',
    'mod-buyer', 13
  ),
  (
    '00000000-0000-4000-c000-000000000083',
    '00000000-0000-4000-b000-000000000006',
    (SELECT id FROM provision_types WHERE key = 'IOC'),
    (SELECT id FROM provision_categories WHERE label = 'Liquidation / Dissolution' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'IOC')),
    'IOC', 'Liquidation / Dissolution',
    'shall not adopt a plan of complete or partial liquidation, dissolution, restructuring, recapitalization or other reorganization of the Company or any of its material Subsidiaries (other than the Merger)',
    'mod-buyer', 14
  ),
  (
    '00000000-0000-4000-c000-000000000084',
    '00000000-0000-4000-b000-000000000006',
    (SELECT id FROM provision_types WHERE key = 'IOC'),
    (SELECT id FROM provision_categories WHERE label = 'Litigation Settlements' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'IOC')),
    'IOC', 'Litigation Settlements',
    'shall not settle, or offer or propose to settle, any Action, other than settlements that (i) involve only the payment of monetary damages not in excess of $50,000,000 individually or $100,000,000 in the aggregate (net of insurance) and (ii) do not involve the imposition of injunctive or other non-monetary relief on the Company or any of its Subsidiaries',
    'mod-buyer', 15
  ),
  (
    '00000000-0000-4000-c000-000000000085',
    '00000000-0000-4000-b000-000000000006',
    (SELECT id FROM provision_types WHERE key = 'IOC'),
    (SELECT id FROM provision_categories WHERE label = 'Stockholder Rights Plans' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'IOC')),
    'IOC', 'Stockholder Rights Plans',
    'shall not adopt or implement a stockholder rights plan or any similar arrangement',
    'strong-buyer', 16
  ),
  (
    '00000000-0000-4000-c000-000000000086',
    '00000000-0000-4000-b000-000000000006',
    (SELECT id FROM provision_types WHERE key = 'IOC'),
    (SELECT id FROM provision_categories WHERE label = 'Catch-All / General' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'IOC')),
    'IOC', 'Catch-All / General',
    'shall not authorize any of, or agree, resolve or commit to do any of, the foregoing actions',
    'neutral', 17
  ),
  (
    '00000000-0000-4000-c000-000000000087',
    '00000000-0000-4000-b000-000000000006',
    (SELECT id FROM provision_types WHERE key = 'IOC'),
    (SELECT id FROM provision_categories WHERE label = 'Capital Expenditures' AND provision_type_id = (SELECT id FROM provision_types WHERE key = 'IOC')),
    'IOC', 'Capital Expenditures',
    'shall not make or commit to make capital expenditures in excess of 110% of the amounts set forth in the Company capital expenditure budget made available to Parent prior to the date hereof for the applicable period, other than capital expenditures reasonably necessary to respond to any emergency or natural disaster',
    'mod-buyer', 18
  )
ON CONFLICT (id) DO NOTHING;

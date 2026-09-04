#!/usr/bin/env node
/**
 * Record Option B outside-date extension disposition: Stage B links on four deals,
 * concho APPROVE; four Option B deals PARTIAL_APPROVE with Stage B links acknowledged.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { canonicalJson, contentId } from '../lib/canonical-v2/canonical-bytes.js';

const REPO_ROOT = join(import.meta.dirname, '..');
const OUTPUT_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-termination-outside-date-extension-disposition.json';
const SCHEMA = 'STAGE_2Y_M7_V2_TERMINATION_OUTSIDE_DATE_EXTENSION_DISPOSITION/V1';
const PACKET_SHA256 =
  '4420906a7c6b6de4ad9a0c54a22d3c029e8e6e6d6c8cfeddfacfa16ec681f53d';

const unsigned = {
  schema_version: SCHEMA,
  disposition_status: 'OPTION_B_STAGE_B_LINKS_ACKNOWLEDGED',
  mapping_option: 'B',
  packet_digest: PACKET_SHA256,
  concho_no_extension_complete: true,
  stage_b_linked_profile_count: 4,
  stage_b_linked_proposition_count: 7,
  hold_rows_remaining: 0,
  profile_rows: [
    {
      proposed_profile_key:
        '261c8790a3247cc495222c2c63e3c82bf09bbcabeae4caa4cb4ff99031a5a6a6',
      source_deal: 'metsera',
      inventory_disposition: 'PARTIAL_APPROVE',
      stage_b_links_acknowledged: true,
      extension_deferred_acknowledged: true,
      linked_proposition_count: 1,
    },
    {
      proposed_profile_key:
        '4ea33624832698aaae46dae9e7328de732f0b6a6f7c0206888edacd4c064b20d',
      source_deal: 'skechers',
      inventory_disposition: 'PARTIAL_APPROVE',
      stage_b_links_acknowledged: true,
      extension_deferred_acknowledged: true,
      linked_proposition_count: 2,
    },
    {
      proposed_profile_key:
        'abfa845bbb08d51182b6ed8aa925e53c91be68b4248f35283e4beeee7b929bef',
      source_deal: 'concho',
      inventory_disposition: 'APPROVE',
      no_extension_complete: true,
      linked_proposition_count: 0,
    },
    {
      proposed_profile_key:
        'e30648500c6a76071927c51739c941a31f0d141c1fbf35f105a015e9dc9e148c',
      source_deal: 'redhat',
      inventory_disposition: 'PARTIAL_APPROVE',
      stage_b_links_acknowledged: true,
      extension_deferred_acknowledged: true,
      linked_proposition_count: 2,
    },
    {
      proposed_profile_key:
        'f41fd796b656dceb8b37f020ea30a3816f73248f5072d9b1d51d901134c89f14',
      source_deal: 'skywater',
      inventory_disposition: 'PARTIAL_APPROVE',
      stage_b_links_acknowledged: true,
      extension_deferred_acknowledged: true,
      linked_proposition_count: 2,
    },
  ],
};

const record = {
  ...unsigned,
  outside_date_extension_disposition_id: contentId(SCHEMA, unsigned),
};

writeFileSync(join(REPO_ROOT, OUTPUT_PATH), `${canonicalJson(record)}\n`);

console.log(
  JSON.stringify({
    outside_date_extension_disposition_id: record.outside_date_extension_disposition_id,
    disposition_status: record.disposition_status,
    hold_rows_remaining: record.hold_rows_remaining,
  }),
);

# WORKLOG-P0-D

## 2026-07-07 fan-out status

- WP-CI-INFRA-03 merged in PR #162. WP branch allowlists are active.
- WP-PROMOTE-NEWHOME merged in PR #163. `/newhome` is promoted to `/`, legacy redirects are installed, and obsolete blocker files were removed.
- WP-TAXONOMY-MAP-01 merged in PR #164. `/admin/taxonomy` renders the taxonomy source with live Supabase-backed node counts.
- WP-PROCESSING-FLOW-MAP-01 merged in PR #165. `/admin/processing-flow` renders the processing-flow source, stage metrics, and gap list.
- WP-SCHEMA-LOSS-AUDIT-01 was already merged in PR #156 before this fan-out resumed.
- WP-REGISTRY-EVOLVE-01 classification/apply path was already merged in PRs #151 and #158 before this fan-out resumed.
- WP-ADMIN-CLEANUP-01 step 3 was unblocked by reviewer approval to delete the legacy `/ingest` CTAs from review pages, then delete `pages/ingest.js`.

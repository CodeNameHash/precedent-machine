# BLOCKED: WP-ADMIN-CLEANUP-01 step 3

`pages/ingest.js` cannot be deleted yet because live non-test callers still link to `/ingest`.

Required grep:

```text
grep -rn "'/ingest'\|\"/ingest\"\|from.*pages/ingest" pages/ components/ lib/ scripts/ tests/
```

Blocking callers:

- `pages/review/[id].js:12310` links to `/ingest`.
- `pages/review/index.js:42` links to `/ingest`.

Test-only reference:

- `tests/admin/nav-registry.spec.js:29` asserts the admin nav registry does not point to `/ingest`; this is not a blocker.

No deletion was performed.

-- OPTIONAL rollback rehearsal (run ONLY if Ben decides to rehearse; the
-- import stays INACTIVE either way). Removes the inactive candidate; re-run
-- 04/05 afterwards to re-import.
BEGIN;
SET LOCAL statement_timeout='120000ms';
SELECT public.canonical_v2_rollback_inactive_candidate_release(
  'staging',
  '9c93546cb60d03977c2d15bda851154a6104cad04a7df2581c4bb3c90ca5a906',
  '1b70bbc8b615e1195a71ba5f9ce9aad88542e2dce4c402813e372fea9277d2b6',
  'd7f2f04068d9dcac2793def3a7854d953e6419601b274269ac4f4f8b8d8160f2',
  'dd26b85607cc53ea78e74455724db2eab970c4c22c2196f25f4f17343f63ab86'
) AS rollback_result;
COMMIT;

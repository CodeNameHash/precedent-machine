BEGIN;
SET LOCAL statement_timeout='120000ms';
SELECT public.canonical_v2_rollback_inactive_candidate_release(
  'staging',
  'e777d76bc6f9edcfdf2c4b60a079d99133609c729c003c71317a33488da3e591',
  '4d0aaa6cc4a2f208626c446f1a01f98def3a661f50a2db916af0bb8027b19589',
  '318fd1efe28c7e3c4042e7c11089e49c18aba07bea85c16e454564a1feb15bb3',
  '020ae2ea97723cfe19507e59ea6a3897d4062a3ca1a4b52133fb5aa0975f6634'
) AS rollback_result;
ROLLBACK;

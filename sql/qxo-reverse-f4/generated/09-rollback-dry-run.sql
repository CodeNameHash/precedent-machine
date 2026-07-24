BEGIN;
SET LOCAL statement_timeout='120000ms';
SELECT public.canonical_v2_rollback_inactive_candidate_release(
  'staging',
  '9f17f11afe08e87bca51d656efef3411308aa50ebf1a387dad286368e7584551',
  '0123651d12399ee8efbd6835c107a8632642a78527b253ac5a5378b70265ea76',
  '641a76add05f49c1fd53f57d2caac8d2a960062c73bcf09e8e7980ccca5da2df',
  'efea9ec5f57c5ae0b7910a526a4c3560b6cee8c5f4d9b96ed48685c812167549'
) AS rollback_result;
ROLLBACK;

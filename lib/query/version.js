const QUERY_ENGINE_VERSION = 'query-engine-v1';
const SCHEMA_VERSION = 'schema-shape-v1';

function versionedPayload(payload) {
  const base = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  return {
    ...base,
    _meta: {
      ...(base._meta && typeof base._meta === 'object' && !Array.isArray(base._meta) ? base._meta : {}),
      schema_version: SCHEMA_VERSION,
      query_engine_version: QUERY_ENGINE_VERSION,
    },
  };
}

function attachVersion(row) {
  if (!row || typeof row !== 'object') return row;
  const meta = row.query_payload && typeof row.query_payload === 'object' ? row.query_payload._meta : null;
  return {
    ...row,
    schema_version: meta?.schema_version || SCHEMA_VERSION,
    query_engine_version: meta?.query_engine_version || QUERY_ENGINE_VERSION,
  };
}

module.exports = {
  QUERY_ENGINE_VERSION,
  SCHEMA_VERSION,
  attachVersion,
  versionedPayload,
};

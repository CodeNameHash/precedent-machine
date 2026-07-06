const LOCKED_FEATURE_KEYS = new Set(['definitionText']);

function parsePlainObject(value) {
  let parsed = value;
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch { parsed = null; }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  return parsed;
}

function unlockedFeaturePatch(features) {
  const patch = parsePlainObject(features);
  const out = { ...patch };
  for (const key of LOCKED_FEATURE_KEYS) delete out[key];
  return out;
}

function mergeProvisionAiMetadata(existingMeta, incomingMeta) {
  const baseMeta = parsePlainObject(existingMeta);
  const incoming = parsePlainObject(incomingMeta);
  const incomingRest = { ...incoming };
  delete incomingRest.features;

  const mergedFeatures = {
    ...parsePlainObject(baseMeta.features),
    ...unlockedFeaturePatch(incoming.features),
  };

  return {
    ...baseMeta,
    ...incomingRest,
    features: mergedFeatures,
    user_corrected: true,
  };
}

module.exports = {
  LOCKED_FEATURE_KEYS,
  mergeProvisionAiMetadata,
  unlockedFeaturePatch,
};

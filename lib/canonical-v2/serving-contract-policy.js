const REJECTED_SERVING_CONTRACT_FINGERPRINTS = Object.freeze([
  '5cc5607bee8fc816e8682f71b9482ff839ff744cebaaf0f26bfcfa54ea64512c',
]);

function isRejectedServingContractFingerprint(fingerprint) {
  return REJECTED_SERVING_CONTRACT_FINGERPRINTS.includes(fingerprint);
}

module.exports = {
  REJECTED_SERVING_CONTRACT_FINGERPRINTS,
  isRejectedServingContractFingerprint,
};

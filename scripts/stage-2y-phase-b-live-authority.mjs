const PHASE_B_LIVE_DEFERRED = true;

function assertPhaseBLiveAllowed(route) {
  if (PHASE_B_LIVE_DEFERRED) {
    throw new Error(`PHASE_B_LIVE_DEFERRED:${route}: model calls require a new programme decision`);
  }
}

export { PHASE_B_LIVE_DEFERRED, assertPhaseBLiveAllowed };

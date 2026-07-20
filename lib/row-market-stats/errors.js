const ERROR_STATUS = Object.freeze({
  INVALID_REQUEST: 400,
  INVALID_METRIC_SPEC: 400,
  DUPLICATE_METRIC: 400,
  MISSING_DEPENDENCY: 400,
  CYCLIC_DEPENDENCY: 400,
  METHOD_NOT_ALLOWED: 405,
  UNSUPPORTED_METRIC_SPEC: 422,
  DATA_SOURCE_NOT_CONFIGURED: 503,
  DATA_SOURCE_ERROR: 503,
  SOURCE_TRUNCATED: 503,
  INTERNAL_ERROR: 500,
});

class MarketStatsError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'MarketStatsError';
    this.code = code;
    this.status = ERROR_STATUS[code] || 500;
    if (details !== undefined) this.details = details;
  }
}

function asMarketStatsError(error) {
  if (error instanceof MarketStatsError) return error;
  return new MarketStatsError('INTERNAL_ERROR', 'Market statistics could not be calculated.');
}

function errorBody(error) {
  const typed = asMarketStatsError(error);
  return {
    error: {
      code: typed.code,
      message: typed.message,
      ...(typed.details === undefined ? {} : { details: typed.details }),
    },
  };
}

module.exports = {
  ERROR_STATUS,
  MarketStatsError,
  asMarketStatsError,
  errorBody,
};

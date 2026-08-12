'use strict';

const { contentId, sha256Hex } = require('./canonical-bytes');
const {
  buildSecEdgarIntakeCapture,
  validateSecEdgarIntakeCapture,
} = require('./sec-edgar-intake-capture');
const {
  convertSecHtmlToCanonicalText,
  validateSecHtmlCanonicalTextConversion,
} = require('./sec-html-canonical-text');
const {
  verifySecHtmlCanonicalText,
} = require('./sec-html-canonical-text-verifier');
const {
  buildVerifiedSecSourceAdmission,
  validateVerifiedSecSourceAdmission,
} = require('./sec-source-admission');

const POLICY = Object.freeze({
  schema_version: 'SEC_RETRIEVAL_POLICY/V1',
  user_agent: 'Deal Corpus canonical intake bengoodchild@gmail.com',
  accept: 'text/html',
  accept_encoding: 'identity',
  redirect_limit: 0,
  timeout_ms: 15000,
  maximum_response_bytes: 2 * 1024 * 1024,
});

function fail(code, detail) {
  throw new Error(`M7_SOURCE_ADMISSION_${code}: ${detail}`);
}

function assertCandidate(candidate) {
  if (!candidate || candidate.schema_version !== 'STAGE_2Y_M7_SOURCE_CANDIDATE/V1') {
    fail('CANDIDATE', 'closed candidate required');
  }
  if (!/^deal:[a-z0-9-]+$/.test(candidate.governed_deal_key || '')) {
    fail('DEAL_KEY', candidate.governed_deal_key);
  }
  const url = new URL(candidate.url);
  if (url.protocol !== 'https:' || url.hostname !== 'www.sec.gov'
    || url.username || url.password) fail('URL', candidate.url);
  if (sha256Hex(Buffer.from(candidate.url, 'utf8')) !== candidate.url_sha256) {
    fail('URL_DIGEST', candidate.candidate_key);
  }
  if (!Array.isArray(candidate.required_document_anchors)
    || candidate.required_document_anchors.length < 2
    || candidate.required_document_anchors.some((anchor) => typeof anchor !== 'string')) {
    fail('ANCHORS', candidate.candidate_key);
  }
}

function fetchExactCandidate(candidate, { httpsGet, now }) {
  assertCandidate(candidate);
  const requestedAt = now();
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      callback(value);
    };
    const request = httpsGet(candidate.url, {
      agent: false,
      headers: {
        'User-Agent': POLICY.user_agent,
        Accept: POLICY.accept,
        'Accept-Encoding': POLICY.accept_encoding,
      },
    }, (response) => {
      const chunks = [];
      let length = 0;
      response.on('aborted', () => finish(reject, new Error('SEC response was aborted.')));
      response.on('error', (error) => finish(reject, error));
      response.on('data', (chunk) => {
        length += chunk.length;
        if (length > POLICY.maximum_response_bytes) {
          request.destroy(new Error('SEC response exceeded the governed byte limit.'));
        } else chunks.push(chunk);
      });
      response.on('end', () => {
        const bytes = Buffer.concat(chunks);
        if (response.complete !== true) return finish(reject, new Error('SEC response did not complete.'));
        if (response.statusCode !== 200 || response.headers.location) {
          return finish(reject, new Error('SEC response status or redirect was rejected.'));
        }
        if (response.headers['content-encoding']
          && String(response.headers['content-encoding']).toLowerCase() !== 'identity') {
          return finish(reject, new Error('SEC response content encoding was not identity.'));
        }
        if (response.headers['content-length'] != null
          && Number(response.headers['content-length']) !== bytes.length) {
          return finish(reject, new Error('SEC response content length did not match its bytes.'));
        }
        let text;
        try {
          text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        } catch {
          return finish(reject, new Error('SEC response was not valid UTF-8.'));
        }
        if (candidate.required_document_anchors.some((anchor) => !text.includes(anchor))) {
          return finish(reject, new Error('SEC response did not contain every governed document anchor.'));
        }
        return finish(resolve, {
          requested_at: requestedAt,
          requested_url: candidate.url,
          final_url: candidate.url,
          redirect_count: 0,
          status_code: response.statusCode,
          content_type: response.headers['content-type'] || null,
          bytes,
        });
      });
    });
    request.on('error', (error) => finish(reject, error));
    request.setTimeout(POLICY.timeout_ms, () => request.destroy(new Error('SEC retrieval timed out.')));
  });
}

function buildAdmission(candidate, fetched, retrievedAt) {
  assertCandidate(candidate);
  if (fetched.requested_url !== candidate.url || fetched.final_url !== candidate.url
    || fetched.redirect_count !== 0 || fetched.status_code !== 200) {
    fail('FETCH_BINDING', candidate.candidate_key);
  }
  const rawSha = sha256Hex(fetched.bytes);
  if (candidate.expected_raw_sha256 && rawSha !== candidate.expected_raw_sha256) {
    fail('RAW_DRIFT', candidate.candidate_key);
  }
  if (candidate.expected_raw_byte_length
    && fetched.bytes.length !== candidate.expected_raw_byte_length) {
    fail('RAW_LENGTH_DRIFT', candidate.candidate_key);
  }
  const capture = buildSecEdgarIntakeCapture({
    retrieval_url: candidate.url,
    status_code: fetched.status_code,
    content_type: fetched.content_type,
    final_url: fetched.final_url,
    redirect_count: fetched.redirect_count,
    response_bytes: fetched.bytes,
    retrieved_at: retrievedAt,
    retrieval_policy_digest: contentId(POLICY.schema_version, POLICY),
  });
  validateSecEdgarIntakeCapture(capture);
  const conversion = convertSecHtmlToCanonicalText(capture);
  validateSecHtmlCanonicalTextConversion({ capture, conversion });
  if (candidate.expected_canonical_sha256
    && conversion.canonical_text_sha256 !== candidate.expected_canonical_sha256) {
    fail('CANONICAL_DRIFT', candidate.candidate_key);
  }
  if (candidate.expected_canonical_byte_length
    && conversion.canonical_text_byte_length !== candidate.expected_canonical_byte_length) {
    fail('CANONICAL_LENGTH_DRIFT', candidate.candidate_key);
  }
  const verification = verifySecHtmlCanonicalText({ capture, conversion });
  const bundle = buildVerifiedSecSourceAdmission({ capture, conversion, verification });
  validateVerifiedSecSourceAdmission({ capture, conversion, verification, bundle });
  return { capture, conversion, verification, bundle };
}

module.exports = {
  POLICY,
  assertCandidate,
  buildAdmission,
  fetchExactCandidate,
};

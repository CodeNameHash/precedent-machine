const test = require('node:test');
const assert = require('node:assert/strict');

const { canonicalJson, contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { buildFixtureCandidateInputAuthority } = require('../__fixtures__/canonical-v2/candidate-input-authority');
const { buildQxoTerminationFeeFixture } = require('../__fixtures__/canonical-v2/qxo-termination-fee-row');
const {
  buildFixtureCandidateRelease,
  validateCandidateReleaseBundle,
} = require('../lib/canonical-v2/candidate-release');
const { buildCandidateReleaseImportPlan } = require('../lib/canonical-v2/candidate-release-import');
const { compileFixtureContract, compileFixtureContractV2 } = require('../lib/canonical-v2/contract-bundle');
const { validateFixtureExactDetailPackage } = require('../lib/canonical-v2/exact-detail');
const {
  QXO_MATERIAL_SEMANTIC_CLOSURE_ID,
  QXO_TERMINATION_CONTRACT_FINGERPRINT_V2,
  buildQxoTerminationCombinedCandidateSeed,
  qxoTerminationCombinedCandidateReleaseId,
  qxoTerminationCombinedServingNamespaceId,
} = require('../lib/canonical-v2/qxo-material-candidate-identity');
const {
  QUERY_PROJECTION_CONTRACT_DIGEST_V2,
  SERVING_PROJECTION_VERSION_V2,
} = require('../lib/canonical-v2/serving-projection-contract');
const {
  AGREEMENT_CANONICAL_TEXT_BYTE_LENGTH,
  AGREEMENT_CANONICAL_TEXT_ID,
  DEAL_ADMISSION_ID,
  DEAL_VALUE_CANONICAL_TEXT_BYTE_LENGTH,
  DEAL_VALUE_CANONICAL_TEXT_ID,
  DEAL_VALUE_INTERVAL,
} = require('../lib/canonical-v2/qxo-material-contracts-slice');
const {
  GROUNDS,
  SPAN_PINS,
  buildQxoTerminationFeeAdmittedSlice,
  validateQxoTerminationFeeAdmittedSlice,
} = require('../lib/canonical-v2/qxo-termination-fee-admitted-slice');
const { adaptSharedServingRow } = require('../lib/canonical-v2/shared-row-adapter');
const { validateSharedServingRow } = require('../lib/canonical-v2/shared-serving-row');

// The admitted agreement canonical text bytes covering §§6.2–6.5(b)
// (byte interval [365777, 375864) of canonical text bcc60682…), verbatim
// from the hash-verified TopBuild Ex 2.1 conversion. The full 414,782-byte
// text is reconstructed by space-padding around the pinned interval, the
// same synthesis the material-contracts test uses.
const AGREEMENT_SECTION_BASE64 = 'dGhlIENvbXBhbnkgU3RvY2tob2xkZXIgQXBwcm92YWwgc2hhbGwgbm90IGhhdmUgYmVlbiBvYnRhaW5lZCBieSByZWFzb24gb2YgdGhlIGZhaWx1cmUgdG8gb2J0YWluIHRoZSByZXF1aXJlZCB2b3RlIGF0IHRoZSBDb21wYW55IFN0b2NraG9sZGVyIE1lZXRpbmcgZHVseSBjb252ZW5lZCAob3IgYW55IGFkam91cm5tZW50IG9yIHBvc3Rwb25lbWVudCB0aGVyZW9mKTsgb3IKKGQpYSBwZXJtYW5lbnQgaW5qdW5jdGlvbiBvciBvdGhlciBPcmRlciB3aGljaCBpcyBmaW5hbCBhbmQgbm9uLWFwcGVhbGFibGUgc2hhbGwgaGF2ZSBiZWVuIGlzc3VlZCBwcmV2ZW50aW5nIG9yIHByb2hpYml0aW5nIGNvbnN1bW1hdGlvbiBvZiB0aGUgTWVyZ2VyczsgcHJvdmlkZWQsIHRoYXQgdGhlIHJpZ2h0IHRvIHRlcm1pbmF0ZSB0aGlzIEFncmVlbWVudCBwdXJzdWFudCB0byB0aGlzIFNlY3Rpb24g4oCONi4yKGQpIHNoYWxsIG5vdCBiZSBhdmFpbGFibGUgdG8gYSBwYXJ0eSB3aG9zZSBmYWlsdXJlIHRvIGZ1bGZpbGwgYW55IG9ibGlnYXRpb24gdW5kZXIgdGhpcyBBZ3JlZW1lbnQgaGFzIGJlZW4gdGhlIGNhdXNlIG9mLCBvciByZXN1bHRlZCBpbiBvciBtYXRlcmlhbGx5IGNvbnRyaWJ1dGVkIHRvLCBzdWNoIEFjdGlvbiBvciBldmVudC4KNi4zVGVybWluYXRpb24gYnkgdGhlIENvbXBhbnkuIFRoaXMgQWdyZWVtZW50IG1heSBiZSB0ZXJtaW5hdGVkIGFuZCB0aGUgTWVyZ2VycyBtYXkgYmUgYWJhbmRvbmVkIGF0IGFueSB0aW1lIHByaW9yIHRvIHRoZSBUaXRhbml1bSBNZXJnZXIgRWZmZWN0aXZlIFRpbWUgYnkgdGhlIENvbXBhbnkgaWY6CihhKWF0IGFueSB0aW1lIHByaW9yIHRvIHRoZSByZWNlaXB0IG9mIHRoZSBQYXJlbnQgU3RvY2tob2xkZXIgQXBwcm92YWwsIChpKSAoQSkgdGhlIFBhcmVudCBCb2FyZCBzaGFsbCBoYXZlIG1hZGUgYSBQYXJlbnQgQWR2ZXJzZSBSZWNvbW1lbmRhdGlvbiBDaGFuZ2Ugb3IgKEIpIHRoZSBQYXJlbnQgQm9hcmQgc2hhbGwgaGF2ZSBtYWRlIGEgUGFyZW50IEludGVydmVuaW5nIEV2ZW50IFJlY29tbWVuZGF0aW9uIENoYW5nZSBvciAoaWkpIFBhcmVudCBvciBhbnkgb2YgaXRzIFJlcHJlc2VudGF0aXZlcyAoYWN0aW5nIG9uIGJlaGFsZiBvZiBQYXJlbnQpIG1hdGVyaWFsbHkgYnJlYWNoZXMgaXRzIG9ibGlnYXRpb25zIHVuZGVyIFNlY3Rpb24g4oCO4oCONC40CuKAiwo5NwrigIsKYW5kLCBpbiB0aGUgY2FzZSBvZiB0aGlzIGNsYXVzZSAoaWkpLCBzdWNoIGJyZWFjaCBpcyBub3QgY3VyYWJsZSBvciwgaWYgY3VyYWJsZSBpcyBub3QgY3VyZWQgcHJpb3IgdG8gdGhlIGVhcmxpZXIgb2YgKEEpIHRoZSBmaWZ0aCBidXNpbmVzcyBkYXkgYWZ0ZXIgd3JpdHRlbiBub3RpY2UgdGhlcmVvZiBpcyBnaXZlbiBieSB0aGUgQ29tcGFueSB0byBQYXJlbnQgYW5kIChCKSB0aGUgZGF0ZSB0aGF0IGlzIHRocmVlIGJ1c2luZXNzIGRheXMgcHJpb3IgdG8gdGhlIE91dHNpZGUgRGF0ZTsgb3IKKGIpdGhlcmUgaGFzIGJlZW4gYSBicmVhY2ggb3IgaW5hY2N1cmFjeSBvZiBhbnkgcmVwcmVzZW50YXRpb24sIHdhcnJhbnR5LCBjb3ZlbmFudCBvciBhZ3JlZW1lbnQgbWFkZSBieSBQYXJlbnQsIFRpdGFuaXVtIE1lcmdlciBTdWIgb3IgRm9yd2FyZCBNZXJnZXIgU3ViIGluIHRoaXMgQWdyZWVtZW50LCBvciBhbnkgc3VjaCByZXByZXNlbnRhdGlvbiBvciB3YXJyYW50eSBzaGFsbCBoYXZlIGJlY29tZSB1bnRydWUgYWZ0ZXIgdGhlIGRhdGUgb2YgdGhpcyBBZ3JlZW1lbnQsIHN1Y2ggdGhhdCAoaSkgc3VjaCBicmVhY2ggb3IgaW5hY2N1cmFjeSBvciBmYWlsdXJlIHRvIGJlIHRydWUgd291bGQgcmVzdWx0IGluIHRoZSBmYWlsdXJlIHRvIHNhdGlzZnkgb25lIG9yIG1vcmUgb2YgdGhlIGNvbmRpdGlvbnMgc2V0IGZvcnRoIGluIFNlY3Rpb25zIOKAjjUuMyhhKShpKSBvciDigI41LjMoYSkoaWkpIGFuZCAoaWkpIHN1Y2ggYnJlYWNoIG9yIGluYWNjdXJhY3kgb3IgZmFpbHVyZSB0byBiZSB0cnVlIGlzIG5vdCBjdXJhYmxlIGJ5IHRoZSBPdXRzaWRlIERhdGUgb3IsIGlmIGNhcGFibGUgb2YgYmVpbmcgY3VyZWQgYnkgdGhlIE91dHNpZGUgRGF0ZSwgc2hhbGwgbm90IGhhdmUgYmVlbiBjdXJlZCBwcmlvciB0byB0aGUgZWFybGllciBvZiAoeCkgdGhpcnR5ICgzMCkgZGF5cyBhZnRlciB3cml0dGVuIG5vdGljZSB0aGVyZW9mIGlzIGdpdmVuIGJ5IHRoZSBDb21wYW55IHRvIFBhcmVudCBvciAoeSkgdGhlIE91dHNpZGUgRGF0ZSAocHJvdmlkZWQgdGhhdCB0aGUgQ29tcGFueSBpcyBub3QgdGhlbiBpbiBicmVhY2ggb2YgYW55IHJlcHJlc2VudGF0aW9uLCB3YXJyYW50eSwgY292ZW5hbnQgb3IgYWdyZWVtZW50IHVuZGVyIHRoaXMgQWdyZWVtZW50IHN1Y2ggdGhhdCBQYXJlbnQgd291bGQgaGF2ZSB0aGUgcmlnaHQgdG8gdGVybWluYXRlIHRoaXMgQWdyZWVtZW50IHVuZGVyIFNlY3Rpb24g4oCONi40KGIpKS4KNi40VGVybWluYXRpb24gYnkgUGFyZW50LiBUaGlzIEFncmVlbWVudCBtYXkgYmUgdGVybWluYXRlZCBhbmQgdGhlIE1lcmdlcnMgbWF5IGJlIGFiYW5kb25lZCBhdCBhbnkgdGltZSBwcmlvciB0byB0aGUgVGl0YW5pdW0gTWVyZ2VyIEVmZmVjdGl2ZSBUaW1lIGJ5IFBhcmVudCBpZjoKKGEpYXQgYW55IHRpbWUgcHJpb3IgdG8gdGhlIHJlY2VpcHQgb2YgdGhlIENvbXBhbnkgU3RvY2tob2xkZXIgQXBwcm92YWwsIChpKSAoQSkgdGhlIENvbXBhbnkgQm9hcmQgc2hhbGwgaGF2ZSBtYWRlIGEgQ29tcGFueSBBZHZlcnNlIFJlY29tbWVuZGF0aW9uIENoYW5nZSBvciAoQikgdGhlIENvbXBhbnkgQm9hcmQgc2hhbGwgaGF2ZSBtYWRlIGEgQ29tcGFueSBJbnRlcnZlbmluZyBFdmVudCBSZWNvbW1lbmRhdGlvbiBDaGFuZ2Ugb3IgKGlpKSB0aGUgQ29tcGFueSBvciBhbnkgb2YgaXRzIFJlcHJlc2VudGF0aXZlcyAoYWN0aW5nIG9uIGJlaGFsZiBvZiB0aGUgQ29tcGFueSkgbWF0ZXJpYWxseSBicmVhY2hlcyBpdHMgb2JsaWdhdGlvbnMgdW5kZXIgU2VjdGlvbiDigI7igI40LjMgYW5kLCBpbiB0aGUgY2FzZSBvZiB0aGlzIGNsYXVzZSAoaWkpLCBzdWNoIGJyZWFjaCBpcyBub3QgY3VyYWJsZSBvciwgaWYgY3VyYWJsZSBpcyBub3QgY3VyZWQgcHJpb3IgdG8gdGhlIGVhcmxpZXIgb2YgKEEpIHRoZSBmaWZ0aCBidXNpbmVzcyBkYXkgYWZ0ZXIgd3JpdHRlbiBub3RpY2UgdGhlcmVvZiBpcyBnaXZlbiBieSBQYXJlbnQgdG8gdGhlIENvbXBhbnkgYW5kIChCKSB0aGUgZGF0ZSB0aGF0IGlzIHRocmVlIGJ1c2luZXNzIGRheXMgcHJpb3IgdG8gdGhlIE91dHNpZGUgRGF0ZTsgb3IKKGIpdGhlcmUgaGFzIGJlZW4gYSBicmVhY2ggb3IgaW5hY2N1cmFjeSBvZiBhbnkgcmVwcmVzZW50YXRpb24sIHdhcnJhbnR5LCBjb3ZlbmFudCBvciBhZ3JlZW1lbnQgbWFkZSBieSB0aGUgQ29tcGFueSBpbiB0aGlzIEFncmVlbWVudCwgb3IgYW55IHN1Y2ggcmVwcmVzZW50YXRpb24gb3Igd2FycmFudHkgc2hhbGwgaGF2ZSBiZWNvbWUgdW50cnVlIG9yIGluYWNjdXJhdGUgYWZ0ZXIgdGhlIGRhdGUgb2YgdGhpcyBBZ3JlZW1lbnQsIHN1Y2ggdGhhdCAoaSkgc3VjaCBicmVhY2ggb3IgaW5hY2N1cmFjeSBvciBmYWlsdXJlIHRvIGJlIHRydWUgd291bGQgcmVzdWx0IGluIHRoZSBmYWlsdXJlIHRvIHNhdGlzZnkgb25lIG9yIG1vcmUgb2YgdGhlIGNvbmRpdGlvbnMgc2V0IGZvcnRoIGluIFNlY3Rpb25zIOKAjjUuMihhKShpKSBvciDigI41LjIoYSkoaWkpIGFuZCAoaWkpIHN1Y2ggYnJlYWNoIG9yIGluYWNjdXJhY3kgb3IgZmFpbHVyZSB0byBiZSB0cnVlIGlzIG5vdCBjdXJhYmxlIGJ5IHRoZSBPdXRzaWRlIERhdGUgb3IsIGlmIGNhcGFibGUgb2YgYmVpbmcgY3VyZWQgYnkgdGhlIE91dHNpZGUgRGF0ZSwgc2hhbGwgbm90IGhhdmUgYmVlbiBjdXJlZCBwcmlvciB0byB0aGUgZWFybGllciBvZiAoeCkgdGhpcnR5ICgzMCkgZGF5cyBhZnRlciB3cml0dGVuIG5vdGljZSB0aGVyZW9mIGlzIGdpdmVuIGJ5IFBhcmVudCB0byB0aGUgQ29tcGFueSBvciAoeSkgdGhlIE91dHNpZGUgRGF0ZSAocHJvdmlkZWQgdGhhdCBQYXJlbnQsIFRpdGFuaXVtIE1lcmdlciBTdWIgb3IgRm9yd2FyZCBNZXJnZXIgU3ViIGlzIG5vdCB0aGVuIGluIGJyZWFjaCBvZiBhbnkgcmVwcmVzZW50YXRpb24sIHdhcnJhbnR5LCBjb3ZlbmFudCBvciBhZ3JlZW1lbnQgdW5kZXIgdGhpcyBBZ3JlZW1lbnQgc3VjaCB0aGF0IHRoZSBDb21wYW55IHdvdWxkIGhhdmUgdGhlIHJpZ2h0IHRvIHRlcm1pbmF0ZSB0aGlzIEFncmVlbWVudCB1bmRlciBTZWN0aW9uIOKAjjYuMyhiKSkuCjYuNUVmZmVjdCBvZiBUZXJtaW5hdGlvbiBhbmQgQWJhbmRvbm1lbnQuCihhKUluIHRoZSBldmVudCBvZiB0ZXJtaW5hdGlvbiBvZiB0aGlzIEFncmVlbWVudCBhbmQgdGhlIGFiYW5kb25tZW50IG9mIHRoZSBNZXJnZXJzIHB1cnN1YW50IHRvIFNlY3Rpb24g4oCONi4xLCBTZWN0aW9uIOKAjjYuMiwgU2VjdGlvbiDigI42LjMgb3IgU2VjdGlvbiDigI42LjQsIHRoaXMgQWdyZWVtZW50IHNoYWxsIGJlY29tZSB2b2lkIGFuZCBvZiBubyBlZmZlY3Qgd2l0aCBubyBsaWFiaWxpdHkgdG8gYW55IFBlcnNvbiBvbiB0aGUgcGFydCBvZiBhbnkgcGFydHkgKG9yIG9mIGFueSBvZiBpdHMgUmVwcmVzZW50YXRpdmVzIG9yIEFmZmlsaWF0ZXMpOyBwcm92aWRlZCwgaG93ZXZlciwgdGhhdCBub3R3aXRoc3RhbmRpbmcgYW55dGhpbmcgaW4gdGhpcyBBZ3JlZW1lbnQgdG8gdGhlIGNvbnRyYXJ5LCAoaSkgbm8gc3VjaCB0ZXJtaW5hdGlvbiBzaGFsbCByZWxpZXZlIGFueSBwYXJ0eSBvZiBhbnkgbGlhYmlsaXR5IG9yCuKAiwo5OArigIsKZGFtYWdlcyB0byB0aGUgb3RoZXIgcGFydHksIHdoaWNoIHRoZSBwYXJ0aWVzIGFja25vd2xlZGdlIGFuZCBhZ3JlZSBzaGFsbCBpbmNsdWRlIGFueSBkYW1hZ2VzIGluY3VycmVkIGJ5IHRoZSBDb21wYW554oCZcyBzdG9ja2hvbGRlcnMsIHJlc3VsdGluZyBmcm9tIGZyYXVkIG9yIGFueSB3aWxsZnVsIGFuZCBtYXRlcmlhbCBicmVhY2ggb2YgdGhpcyBBZ3JlZW1lbnQgYW5kIChpaSkgdGhlIHByb3Zpc2lvbnMgc2V0IGZvcnRoIGluIFNlY3Rpb24g4oCONC4xMiAoRXhwZW5zZXMpLCB0aGUgbGFzdCBzZW50ZW5jZSBvZiBTZWN0aW9uIOKAjjQuMTcoZCkgKEZpbmFuY2luZyBQcm92aXNpb25zKSwgdGhpcyBTZWN0aW9uIOKAjjYuNSwgQXJ0aWNsZSDigI5WSUkgYW5kIHRoZSBDb25maWRlbnRpYWxpdHkgQWdyZWVtZW50IHNoYWxsIHN1cnZpdmUgdGhlIHRlcm1pbmF0aW9uIG9mIHRoaXMgQWdyZWVtZW50LiBGb3IgcHVycG9zZXMgb2YgdGhpcyBBZ3JlZW1lbnQsIOKAnHdpbGxmdWwgYW5kIG1hdGVyaWFsIGJyZWFjaOKAnSBzaGFsbCBtZWFuIGEgbWF0ZXJpYWwgYnJlYWNoIHRoYXQgaXMgYSBjb25zZXF1ZW5jZSBvZiBhbiBhY3QgdW5kZXJ0YWtlbiBvciBpbmFjdGlvbiBieSB0aGUgYnJlYWNoaW5nIHBhcnR5IHdpdGggdGhlIGtub3dsZWRnZSB0aGF0IHRoZSB0YWtpbmcgb2Ygc3VjaCBhY3Qgb3IgaW5hY3Rpb24gd291bGQsIG9yIHdvdWxkIHJlYXNvbmFibHkgYmUgZXhwZWN0ZWQgdG8sIGNvbnN0aXR1dGUgb3IgY2F1c2UgYSBicmVhY2ggb2YgdGhpcyBBZ3JlZW1lbnQuIFRoZSBwYXJ0aWVzIGFja25vd2xlZGdlIGFuZCBhZ3JlZSB0aGF0IHRoZSBmYWlsdXJlIG9mIHRoZSBwYXJ0aWVzIHRvIGNvbnN1bW1hdGUgdGhlIENsb3Npbmcgd2hlbiByZXF1aXJlZCB0byBkbyBzbyBieSB0aGlzIEFncmVlbWVudCBhdCB0aGUgdGltZSBjb250ZW1wbGF0ZWQgYnkgU2VjdGlvbiDigI4xLjMsIGFzIHRoZSBjYXNlIG1heSBiZSwgc2hhbGwgYmUgZGVlbWVkIHRvIGJlIGEgd2lsbGZ1bCBhbmQgbWF0ZXJpYWwgYnJlYWNoIG9mIHRoaXMgQWdyZWVtZW50LiBOb3RoaW5nIHNoYWxsIGltcGFpciB0aGUgcmlnaHRzIG9mIHRoZSBwYXJ0aWVzIHRvIG9idGFpbiB0aGUgcmVsaWVmIHNldCBmb3J0aCBpbiBTZWN0aW9uIOKAjjcuNiBwcmlvciB0byBhbnkgdGVybWluYXRpb24gb2YgdGhpcyBBZ3JlZW1lbnQuCihiKUlmIHRoaXMgQWdyZWVtZW50IGlzIHRlcm1pbmF0ZWQgKGkpIGJ5IFBhcmVudCBwdXJzdWFudCB0byB0aGUgcHJvdmlzaW9ucyBvZiBTZWN0aW9uIOKAjjYuNChhKShpKShBKSBvciBTZWN0aW9uIOKAjjYuNChhKShpaSksIG9yIGlmIHRoaXMgQWdyZWVtZW50IGlzIHRlcm1pbmF0ZWQgYnkgdGhlIENvbXBhbnkgb3IgUGFyZW50IHB1cnN1YW50IHRvIFNlY3Rpb24g4oCONi4yKGMpIGF0IGEgdGltZSB3aGVuIHRoaXMgQWdyZWVtZW50IHdhcyB0ZXJtaW5hYmxlIGJ5IFBhcmVudCBwdXJzdWFudCB0byBTZWN0aW9uIOKAjjYuNChhKShpKShBKSBvciBTZWN0aW9uIOKAjjYuNChhKShpaSk7IChpaSkgYnkgZWl0aGVyIFBhcmVudCBvciB0aGUgQ29tcGFueSBwdXJzdWFudCB0byB0aGUgcHJvdmlzaW9ucyBvZiBTZWN0aW9uIOKAjjYuMihhKSBhbmQsIGF0IHRoZSB0aW1lIG9mIHN1Y2ggdGVybWluYXRpb24sIFBhcmVudCB3b3VsZCBoYXZlIGJlZW4gcGVybWl0dGVkIHRvIHRlcm1pbmF0ZSB0aGlzIEFncmVlbWVudCBwdXJzdWFudCB0byBTZWN0aW9uIOKAjjYuNChhKShpKShBKSBvciBTZWN0aW9uIDYuNChhKShpaSk7IG9yIChpaWkpIChBKSBieSBQYXJlbnQgb3IgdGhlIENvbXBhbnkgcHVyc3VhbnQgdG8gU2VjdGlvbiDigI42LjIoYykgKG90aGVyIHRoYW4gaW4gdGhlIGNpcmN1bXN0YW5jZXMgY29udGVtcGxhdGVkIGJ5IGNsYXVzZSAoaSkgb2YgdGhpcyBTZWN0aW9uIOKAjjYuNShiKSksIChCKSBieSBlaXRoZXIgUGFyZW50IG9yIHRoZSBDb21wYW55IHB1cnN1YW50IHRvIHRoZSBwcm92aXNpb25zIG9mIFNlY3Rpb24g4oCONi4yKGEpIGFuZCB0aGUgQ29tcGFueSBTdG9ja2hvbGRlciBBcHByb3ZhbCBzaGFsbCBub3QgdGhlcmV0b2ZvcmUgaGF2ZSBiZWVuIG9idGFpbmVkLCAoQykgYnkgUGFyZW50IHB1cnN1YW50IHRvIHRoZSBwcm92aXNpb25zIG9mIFNlY3Rpb24g4oCONi40KGIpIGluIHJlc3BlY3Qgb2YgYSAoMSkgYnJlYWNoIG9mIHRoZSBDb21wYW554oCZcyBvYmxpZ2F0aW9ucyB1bmRlciBTZWN0aW9uIOKAjjQuMyAoYW5kIHRoZSBDb21wYW55IFN0b2NraG9sZGVyIEFwcHJvdmFsIHNoYWxsIG5vdCB0aGVyZXRvZm9yZSBoYXZlIGJlZW4gb2J0YWluZWQpIG9yICgyKSBhIGJyZWFjaCBvZiBhbnkgb3RoZXIgY292ZW5hbnQgb3IgYWdyZWVtZW50IG9mIHRoaXMgQWdyZWVtZW50IG9yIChEKSBieSBQYXJlbnQgcHVyc3VhbnQgdG8gdGhlIHByb3Zpc2lvbnMgb2YgU2VjdGlvbiDigI42LjQoYSkoaSkoQikgKGFuZCB0aGUgQ29tcGFueSBTdG9ja2hvbGRlciBBcHByb3ZhbCBzaGFsbCBub3QgdGhlcmV0b2ZvcmUgaGF2ZSBiZWVuIG9idGFpbmVkKSBhbmQsIGluIHRoZSBjYXNlIG9mIHRoaXMgY2xhdXNlIChpaWkpLCAoeCkgc29sZWx5IGluIHJlc3BlY3Qgb2YgYSB0ZXJtaW5hdGlvbiBieSB0aGUgQ29tcGFueSBwdXJzdWFudCB0byB0aGUgcHJvdmlzaW9ucyBvZiBTZWN0aW9uIOKAjjYuMihhKSwgUGFyZW50IHdvdWxkIGhhdmUgYmVlbiBlbnRpdGxlZCB0byB0ZXJtaW5hdGUgdGhpcyBBZ3JlZW1lbnQgcHVyc3VhbnQgdG8gU2VjdGlvbiDigI42LjIoYSkgb3IgU2VjdGlvbiDigI42LjQoYikgaW4gcmVzcGVjdCBvZiBhICgxKSBicmVhY2ggb2YgdGhlIENvbXBhbnnigJlzIG9ibGlnYXRpb25zIHVuZGVyIFNlY3Rpb24g4oCONC4zIChhbmQgdGhlIENvbXBhbnkgU3RvY2tob2xkZXIgQXBwcm92YWwgc2hhbGwgbm90IHRoZXJldG9mb3JlIGhhdmUgYmVlbiBvYnRhaW5lZCkgYXQgdGhlIHRpbWUgb2Ygc3VjaCB0ZXJtaW5hdGlvbiBvciAoMikgYSBicmVhY2ggb2YgYW55IG90aGVyIGNvdmVuYW50IG9yIGFncmVlbWVudCBvZiB0aGlzIEFncmVlbWVudCBhdCB0aGUgdGltZSBvZiBzdWNoIHRlcm1pbmF0aW9uLCAoeSkgc29sZWx5IGluIHJlc3BlY3Qgb2YgYSB0ZXJtaW5hdGlvbiBjb250ZW1wbGF0ZWQgYnkgY2xhdXNlIChBKSwgKEIpIGFuZCAoQyksIG9uIG9yIGFmdGVyIHRoZSBkYXRlIG9mIHRoaXMgQWdyZWVtZW50IGFuZCBwcmlvciB0byB0aGUgQ29tcGFueSBTdG9ja2hvbGRlciBNZWV0aW5nIChpbiB0aGUgY2FzZSBvZiB0ZXJtaW5hdGlvbiBjb250ZW1wbGF0ZWQgYnkgY2xhdXNlIChBKSkgb3Igc3VjaCB0ZXJtaW5hdGlvbiAoaW4gdGhlIGNhc2Ugb2YgdGVybWluYXRpb24gY29udGVtcGxhdGVkIGJ5IGNsYXVzZSAoQikgb3IgKEMpKSBhIENvbXBhbnkgQWNxdWlzaXRpb24gUHJvcG9zYWwgc2hhbGwgaGF2ZSBiZWVuIHB1YmxpY2x5IGFubm91bmNlZCAoYW5kIG5vdCBwdWJsaWNseSB3aXRoZHJhd24pIGFuZCAoeikgYXQgYW55IHRpbWUgb24gb3IgcHJpb3IgdG8gdGhlIHR3ZWx2ZSAoMTIpIG1vbnRoIGFubml2ZXJzYXJ5IG9mIHN1Y2ggdGVybWluYXRpb24gdGhlIENvbXBhbnkgb3IgYW55IG9mIGl0cyBTdWJzaWRpYXJpZXMgZW50ZXJzIGludG8gYSBkZWZpbml0aXZlIGFncmVlbWVudCB3aXRoIHJlc3BlY3QgdG8gYW55IENvbXBhbnkgQWNxdWlzaXRpb24gUHJvcG9zYWwgb3IgdGhlIHRyYW5zYWN0aW9ucyBjb250ZW1wbGF0ZWQgYnkgYW55IENvbXBhbnkgQWNxdWlzaXRpb24gUHJvcG9zYWwgYXJlIGNvbnN1bW1hdGVkIChwcm92aWRlZCB0aGF0IHNvbGVseSBmb3IgcHVycG9zZXMgb2YgdGhpcyBjbGF1c2UsIOKAnDUwJeKAnSBzaGFsbCBiZSBzdWJzdGl0dXRlZCBmb3Ig4oCcMjAl4oCdIGluIHRoZSBkZWZpbml0aW9uIG9mIENvbXBhbnkgQWNxdWlzaXRpb24gUHJvcG9zYWwpIHRoZW4sIGluIHRoZSBjYXNlIG9mIGVhY2ggb2YgKGkpLCAoaWkpIGFuZCAoaWlpKSwgdGhlIENvbXBhbnkgc2hhbGwgcGF5IFBhcmVudCB0aGUgQ29tcGFueSBUZXJtaW5hdGlvbiBGZWUsIGJ5IHdpcmUgdHJhbnNmZXIgKHRvIGFuIGFjY291bnQgZGVzaWduYXRlZCBieSBQYXJlbnQpIGluIGltbWVkaWF0ZWx5IGF2YWlsYWJsZSBmdW5kcyAoMSkgaW4gdGhlIGNhc2Ugb2YgY2xhdXNlIChpKSBvZiB0aGlzIFNlY3Rpb24g4oCONi41KGIpLCB3aXRoaW4gdHdvICgyKSBidXNpbmVzcyBkYXlzIGFmdGVyIHN1Y2ggdGVybWluYXRpb24sICgyKSBpbiB0aGUgY2FzZSBvZiBjbGF1c2UgKGlpKSBvZiB0aGlzIFNlY3Rpb24g4oCONi41KGIpLCB3aXRoaW4gdHdvICgyKSBidXNpbmVzcyBkYXlzIGFmdGVyIHN1Y2ggdGVybWluYXRpb24gYW5kICgzKSBpbiB0aGUgY2FzZSBvZiBjbGF1c2UgKGlpaSkgb2YgdGhpcyBTZWN0aW9uIOKAjjYuNShiKSwgdXBvbiB0aGUgZWFybGllciBvZiBlbnRlcmluZyBpbnRvIHN1Y2ggZGVmaW5pdGl2ZSBhZ3JlZW1lbnQK4oCLCjk5CuKAiwp3aXRoIHJlc3BlY3QgdG8gYSBDb21wYW55IEFjcXVpc2l0aW9uIFByb3Bvc2FsIG9yIHRoZSBjb25zdW1tYXRpb24gb2YgdGhlIHRyYW5zYWN0aW9ucyBjb250ZW1wbGF0ZWQgYnkgYSBDb21wYW55IEFjcXVpc2l0aW9uIFByb3Bvc2FsLiDigJxDb21wYW55IFRlcm1pbmF0aW9uIEZlZeKAnSBzaGFsbCBtZWFuIGEgY2FzaCBhbW91bnQgZXF1YWwgdG8gJDYwMCwwMDAsMDAwLiBFYWNoIG9mIHRoZSBwYXJ0aWVzIGFja25vd2xlZGdlcyB0aGF0IHRoZSBDb21wYW55IFRlcm1pbmF0aW9uIEZlZSBpcyBub3QgYSBwZW5hbHR5LCBidXQgcmF0aGVyIGFyZSBsaXF1aWRhdGVkIGRhbWFnZXMgaW4gYSByZWFzb25hYmxlIGFtb3VudCB0aGF0IHdpbGwgY29tcGVuc2F0ZSBQYXJlbnQgaW4gdGhlIGNpcmN1bXN0YW5jZXMgaW4gd2hpY2ggc3VjaCBDb21wYW55IFRlcm1pbmF0aW9uIEZlZSBpcyBkdWUgYW5kIHBheWFibGUsIGZvciB0aGUgZWZmb3J0cyBhbmQgcmVzb3VyY2VzIGV4cGVuZGVkIGFuZCBvcHBvcnR1bml0aWVzIGZvcmVnb25lIHdoaWxlIG5lZ290aWF0aW5nIHRoaXMgQWdyZWVtZW50IGFuZCBpbiByZWxpYW5jZSBvbiB0aGlzIEFncmVlbWVudCBhbmQgb24gdGhlIGV4cGVjdGF0aW9uIG9mIHRoZSBjb25zdW1tYXRpb24gb2YgdGhlIFRyYW5zYWN0aW9ucywgd2hpY2ggYW1vdW50IHdvdWxkIG90aGVyd2lzZSBiZSBpbXBvc3NpYmxlIHRvIGNhbGN1bGF0ZSB3aXRoIHByZWNpc2lvbi4gSW4gbm8gZXZlbnQgc2hhbGwgUGFyZW50IGJlIGVudGl0bGVkIHRvIHRoZSBDb21wYW55IFRlcm1pbmF0aW9uIEZlZSBvbiBtb3JlIHRoYW4gb25lIG9jY2FzaW9uLg==';
const AGREEMENT_SECTION_START = 365777;
const DEAL_VALUE_TEXT_BASE64 = 'ZW50ZXJlZCBpbnRvIGEgZGVmaW5pdGl2ZSBhZ3JlZW1lbnQgdG8gYWNxdWlyZSBUb3BCdWlsZCBDb3JwLiAoTllTRTogQkxEKSAo4oCcVG9wQnVpbGTigJ0pIGZvciBhcHByb3hpbWF0ZWx5ICQxNyBiaWxsaW9u';
const AGREEMENT_DOCUMENT_HASH = 'abba043018410d718c207e7d7a43c9567166f6a10c4c9a6b4b0c8c7761cd6b9d';
const DEAL_VALUE_DOCUMENT_HASH = '343ba5da8ab34f478f274307046836af4ded762b010e08ed8d9015be2e09c827';

const contractBundle = compileFixtureContractV2();

function digest(label) {
  return contentId('QXO_TERMF_ADMITTED_TEST/V1', label);
}

function admittedContext(options) {
  const sourceOrdinal = options.sourceOrdinal;
  const immutableSourceDocumentId = digest('immutable:' + sourceOrdinal);
  const sourceContentId = digest('source-content:' + sourceOrdinal);
  const sourceOccurrenceKey = contentId('ADMITTED_SOURCE_OCCURRENCE_KEY/V1', {
    deal_admission_id: DEAL_ADMISSION_ID,
    source_ordinal: sourceOrdinal,
    immutable_source_document_id: immutableSourceDocumentId,
  });
  const canonicalTextByteLength = Buffer.byteLength(options.text, 'utf8');
  const sourceMapDigest = digest('map-digest:' + sourceOrdinal);
  const admittedIntervals = [{ start: 0, end: canonicalTextByteLength }];
  const admissionBody = {
    schema_version: 'SOURCE_ADMISSION_MANIFEST/V2',
    admission_state: 'VERIFIED',
    source_kind: 'ORIGINAL_BYTES',
    immutable_source_document_id: immutableSourceDocumentId,
    source_response_content_id: sourceContentId,
    canonical_text_id: options.canonicalTextId,
    verification_manifest_id: digest('verification:' + sourceOrdinal),
    admitted_intervals: admittedIntervals,
    excluded_intervals: [],
    conversion_loss_residual_ids: [],
    discrepancy_count: 0,
    blocking_discrepancy_count: 0,
    coverage_proof_digest: contentId('SOURCE_ADMISSION_COVERAGE_PROOF/V2', {
      canonical_text_id: options.canonicalTextId,
      canonical_text_byte_length: canonicalTextByteLength,
      source_map_digest: sourceMapDigest,
      admitted_intervals: admittedIntervals,
      excluded_intervals: [],
      discrepancy_count: 0,
    }),
  };
  const sourceAdmission = Object.freeze({
    ...admissionBody,
    source_admission_manifest_id: contentId('SOURCE_ADMISSION_MANIFEST/V2', admissionBody),
  });
  const body = {
    schema_version: 'ADMITTED_SEMANTIC_SOURCE_CONTEXT/V1',
    governed_deal_key: 'deal:qxo-topbuild',
    deal_admission_id: DEAL_ADMISSION_ID,
    source_ordinal: sourceOrdinal,
    immutable_source_document_id: immutableSourceDocumentId,
    source_admission_manifest_id: sourceAdmission.source_admission_manifest_id,
    semantic_extraction_input_envelope_id: digest('envelope:' + sourceOrdinal),
    source_content_id: sourceContentId,
    source_occurrence_id: contentId('SOURCE_OCCURRENCE/V1', {
      source_content_id: sourceContentId,
      source_occurrence_key: sourceOccurrenceKey,
    }),
    source_occurrence_key: sourceOccurrenceKey,
    source_kind: 'ORIGINAL_BYTES',
    document_hash: options.documentHash,
    source_byte_length: canonicalTextByteLength + 1000,
    canonical_text_id: options.canonicalTextId,
    canonical_text_sha256: sha256Hex(Buffer.from(options.text, 'utf8')),
    canonical_text_byte_length: canonicalTextByteLength,
    canonical_text: {
      schema_version: 'ADMITTED_CANONICAL_TEXT_RUNTIME/V1',
      canonical_text_id: options.canonicalTextId,
      text: options.text,
    },
    converter_digest: digest('converter'),
    converter_config_digest: digest('converter-config'),
    source_map_encoding: 'GZIP_BASE64_JSON_V1',
    source_map_compressed_sha256: digest('map:' + sourceOrdinal),
    source_map_uncompressed_byte_length: 1,
    input_region_count: 1,
    output_mapping_count: 1,
    source_map_digest: sourceMapDigest,
    verification_manifest_id: digest('verification:' + sourceOrdinal),
  };
  return {
    sourceContext: Object.freeze({
      ...body,
      admitted_semantic_source_context_id: contentId('ADMITTED_SEMANTIC_SOURCE_CONTEXT/V1', body),
    }),
    sourceAdmission,
  };
}

function sourceContexts() {
  const agreementBytes = Buffer.alloc(AGREEMENT_CANONICAL_TEXT_BYTE_LENGTH, 0x20);
  Buffer.from(AGREEMENT_SECTION_BASE64, 'base64').copy(agreementBytes, AGREEMENT_SECTION_START);
  const dealValueBytes = Buffer.alloc(DEAL_VALUE_CANONICAL_TEXT_BYTE_LENGTH, 0x20);
  Buffer.from(DEAL_VALUE_TEXT_BASE64, 'base64').copy(dealValueBytes, DEAL_VALUE_INTERVAL.start);
  const agreement = admittedContext({
    sourceOrdinal: 0,
    documentHash: AGREEMENT_DOCUMENT_HASH,
    canonicalTextId: AGREEMENT_CANONICAL_TEXT_ID,
    text: agreementBytes.toString('utf8'),
  });
  const dealValue = admittedContext({
    sourceOrdinal: 1,
    documentHash: DEAL_VALUE_DOCUMENT_HASH,
    canonicalTextId: DEAL_VALUE_CANONICAL_TEXT_ID,
    text: dealValueBytes.toString('utf8'),
  });
  return {
    agreementSourceContext: agreement.sourceContext,
    agreementSourceAdmission: agreement.sourceAdmission,
    dealValueSourceContext: dealValue.sourceContext,
    dealValueSourceAdmission: dealValue.sourceAdmission,
  };
}

const corpusReleaseId = contentId('CORPUS_RELEASE/V1', 'qxo-termination-admitted-test');
const servingNamespaceId = contentId('SERVING_NAMESPACE/V1', 'qxo-termination-admitted-test');

function build() {
  const contexts = sourceContexts();
  return {
    ...contexts,
    candidate: buildQxoTerminationFeeAdmittedSlice({
      ...contexts,
      contractBundle,
      corpusReleaseId,
      servingNamespaceId,
    }),
  };
}

test('the admitted termination-fee slice reproduces the reviewed fixture legal encoding exactly', () => {
  const { candidate } = build();
  const fixture = buildQxoTerminationFeeFixture({ contractBundle });
  // The row orders bounded effects by substrate-dependent revision ids, so
  // the admitted and reviewed rows agree as a multiset, not positionally.
  const effectSet = (row) => row.canonical_result.components[0]
    .bounded_relationship_effects.map((entry) => canonicalJson(entry.effect)).sort();
  assert.deepEqual(effectSet(candidate.shared_row), effectSet(fixture.row));
  assert.equal(candidate.projection.observation.canonical_value, '3.52941176');
  assert.equal(candidate.relationships.length, 6);
  assert.equal(candidate.provisions.length, 7);
  assert.deepEqual(candidate.deal.dimensions, {
    sector: 'Building products',
    buyer: 'QXO',
    merger_form: 'Reverse triangular merger',
    adviser_firms: ['Paul Weiss', 'Jones Day'],
    lawyers: ['Scott Barshay', 'Robert Profusek'],
    announce_year: 2026,
    deal_value_usd: '17000000000',
  });
  assert.deepEqual(candidate.semantic_write_set.deal, {
    deal_key: 'deal:qxo-topbuild',
    deal_admission_id: DEAL_ADMISSION_ID,
    document_hash: AGREEMENT_DOCUMENT_HASH,
  });
  assert.equal(candidate.semantic_write_set.deal.dimensions, undefined);
  assert.deepEqual(candidate.projection.observation.dimensions, {
    sector: 'Building products',
    buyer: 'QXO',
    merger_form: 'Reverse triangular merger',
    adviser_firms: ['Jones Day', 'Paul Weiss'],
    lawyers: ['Robert Profusek', 'Scott Barshay'],
    announce_year: 2026,
    deal_value_usd: '17000000000',
  });
  const semanticExcerpts = new Map(candidate.semantic_write_set.excerpts.map(
    (excerpt) => [excerpt.excerpt_id, excerpt],
  ));
  assert.equal(
    semanticExcerpts.get(candidate.excerpts.deal_value.excerpt_id).closure_id,
    QXO_MATERIAL_SEMANTIC_CLOSURE_ID,
  );
  assert.equal(
    candidate.semantic_write_set.excerpts.filter(
      (excerpt) => excerpt.closure_id === candidate.semantic_closure_id,
    ).length,
    8,
  );
  assert.equal(candidate.semantic_write_set.excerpts.length, 9);
  assert.deepEqual(candidate.provisions[0].party, {
    role: 'FEE_PAYER', value: 'COMPANY', capacity: 'TARGET',
  });
  assert.equal(candidate.claim.raw_value, '$600,000,000');
  assert.equal(candidate.claim.canonical_value, '3.52941176');
  assert.equal(candidate.claim.unit, 'PERCENT_OF_DEAL_VALUE');
  assert.equal(candidate.claim.denominator.value, '17000000000');
  assert.equal(candidate.claim.denominator.currency, 'USD');
  assert.equal(candidate.claim.denominator.basis, 'HEADLINE_TRANSACTION_VALUE');
  assert.equal(candidate.claim.attributes.raw_amount, '600000000');
  assert.equal(candidate.claim.attributes.raw_currency, 'USD');
  assert.equal(candidate.claim.attributes.fee_side, 'SELLER');
  assert.equal(candidate.claim.attributes.payee_value, 'PARENT');
  assert.equal(candidate.claim.attributes.payee_capacity, 'BUYER');
  GROUNDS.forEach((ground, index) => {
    const provision = candidate.provisions[index + 1];
    const relationship = candidate.relationships[index];
    assert.equal(provision.concept_key, ground.conceptKey);
    assert.deepEqual(provision.party, ground.party);
    assert.deepEqual(relationship.effect, ground.effect);
    assert.deepEqual(
      relationship.target_occurrence_ids,
      [candidate.components[index + 1].provision_component_id],
    );
  });
  assert.equal(
    canonicalJson(candidate.provisions.map((item) => item.concept_key).sort()),
    canonicalJson(Object.values(fixture.harness.provisions).map((item) => item.concept_key).sort()),
  );
});

test('span pins bind the admitted text and grounds carry the approved concepts', () => {
  const { candidate } = build();
  assert.equal(Object.keys(SPAN_PINS).length, 8);
  assert.equal(GROUNDS.length, 6);
  for (const ground of GROUNDS) {
    const provision = candidate.provisions.find((item) => (
      item.absolute_start === SPAN_PINS[ground.key].interval.start
      && item.absolute_end === SPAN_PINS[ground.key].interval.end
    ));
    assert.ok(provision, ground.key);
    assert.equal(provision.concept_key, ground.conceptKey);
  }
});

test('the slice validates, adapts, and rejects the frozen F1 contract', () => {
  const { candidate, ...contexts } = build();
  assert.ok(validateQxoTerminationFeeAdmittedSlice({
    candidate,
    ...contexts,
    contractBundle,
    corpusReleaseId,
    servingNamespaceId,
  }));
  validateSharedServingRow(candidate.shared_row);
  adaptSharedServingRow(candidate.shared_row);
  assert.throws(() => buildQxoTerminationFeeAdmittedSlice({
    ...contexts,
    contractBundle: compileFixtureContract(),
    corpusReleaseId,
    servingNamespaceId,
  }), /TERMR-NOSOL-BREACH/);
});

test('the admitted claim-evidence exact-detail package validates through the shared dispatch', () => {
  const { candidate } = build();
  const member = candidate.candidate_release_member;
  assert.ok(validateFixtureExactDetailPackage({
    package: member.exact_detail.package,
    contract_bundle: contractBundle,
    source: member.exact_detail.source,
    source_admission: member.exact_detail.source_admission,
    excerpt: member.exact_detail.excerpt,
    claim: member.exact_detail.claim,
  }));
  const action = member.exact_detail.package.action_definitions[0];
  assert.equal(action.action_slot_key, 'RESULT_COMPONENT_CLAIM_EVIDENCE');
  assert.ok(member.exact_detail.package.detail_payloads[0].encoded_byte_length <= action.maximum_encoded_bytes);

  const wrongAction = JSON.parse(JSON.stringify(member.exact_detail.package));
  wrongAction.row.source_actions[0].action_slot_key = 'REVIEWED_SOURCE_SPECIFIC_OPEN_WORLD_EVIDENCE';
  assert.throws(() => validateFixtureExactDetailPackage({
    package: wrongAction,
    contract_bundle: contractBundle,
    source: member.exact_detail.source,
    source_admission: member.exact_detail.source_admission,
    excerpt: member.exact_detail.excerpt,
    claim: member.exact_detail.claim,
  }), /governed claim-evidence action/);
});

test('the termination member seals into a candidate release and import plan under F2', () => {
  const { candidate } = build();
  const release = buildFixtureCandidateRelease({
    contract_bundle: contractBundle,
    serving_namespace_id: servingNamespaceId,
    corpus_release_id: corpusReleaseId,
    serving_projection_binding: {
      serving_projection_version: SERVING_PROJECTION_VERSION_V2,
      query_projection_contract_digest: QUERY_PROJECTION_CONTRACT_DIGEST_V2,
    },
    members: [candidate.candidate_release_member],
    correction_authority_selection: buildFixtureCandidateInputAuthority({ contractBundle }),
    deal_directory_entries: [{
      application_deal_id: '7dc3a05f-b170-4d59-a255-b7103cca16e1',
      governed_deal_key: 'deal:qxo-topbuild',
    }],
  });
  validateCandidateReleaseBundle(release);
  assert.equal(release.market_observations.length, 1);
  assert.equal(release.shared_rows.length, 1);
  assert.equal(release.query_records.length, 1);
  const plan = buildCandidateReleaseImportPlan({ release });
  assert.equal(plan.environment, 'staging');
  assert.equal(plan.release_record.corpus_release_id, corpusReleaseId);
});

test('the F2 combined candidate seed is deterministic and F2-bound', () => {
  const { candidate } = build();
  const args = {
    contractFingerprint: QXO_TERMINATION_CONTRACT_FINGERPRINT_V2,
    materialReviewedMappingId: 'df48098d46c76258c3a04c7eab21305395c94eb8dd12a014bf9a4d64f712dfc1',
    terminationReviewedMappingId: candidate.reviewed_mapping.reviewed_mapping_id,
    servingProjectionVersion: SERVING_PROJECTION_VERSION_V2,
    queryProjectionContractDigest: QUERY_PROJECTION_CONTRACT_DIGEST_V2,
  };
  const seed = buildQxoTerminationCombinedCandidateSeed(args);
  assert.equal(seed.contract_fingerprint, compileFixtureContractV2().fingerprint);
  assert.equal(seed.prior_semantic_closure_ids.length, 5);
  assert.equal(
    qxoTerminationCombinedCandidateReleaseId(seed),
    qxoTerminationCombinedCandidateReleaseId(buildQxoTerminationCombinedCandidateSeed(args)),
  );
  assert.match(qxoTerminationCombinedServingNamespaceId(seed), /^[a-f0-9]{64}$/);
  assert.throws(() => buildQxoTerminationCombinedCandidateSeed({
    ...args,
    contractFingerprint: compileFixtureContract().fingerprint,
  }), /bound to the F2/);
});

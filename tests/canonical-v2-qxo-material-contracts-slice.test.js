const test = require('node:test');
const assert = require('node:assert/strict');

const { contentId, canonicalJson, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { buildFixtureCandidateInputAuthority } = require('../__fixtures__/canonical-v2/candidate-input-authority');
const {
  buildFixtureCandidateRelease,
  validateCandidateReleaseBundle,
} = require('../lib/canonical-v2/candidate-release');
const {
  compileFixtureContract,
  compileFixtureContractV5,
} = require('../lib/canonical-v2/contract-bundle');
const {
  validateAdmittedMultiSourceResultCompositionDetailPackage,
} = require('../lib/canonical-v2/admitted-composition-exact-detail');
const {
  AGREEMENT_CANONICAL_TEXT_BYTE_LENGTH,
  AGREEMENT_CANONICAL_TEXT_ID,
  CONTRACTS_INTERVAL,
  DEAL_ADMISSION_ID,
  DEAL_VALUE_CANONICAL_TEXT_BYTE_LENGTH,
  DEAL_VALUE_CANONICAL_TEXT_ID,
  DEAL_VALUE_INTERVAL,
  buildQxoMaterialContractsSlice,
  validateQxoMaterialContractsSlice,
} = require('../lib/canonical-v2/qxo-material-contracts-slice');
const { adaptSharedServingRow } = require('../lib/canonical-v2/shared-row-adapter');
const { validateProjectedMetricSlotOutput } = require('../lib/canonical-v2/serving-projection');
const { validateSharedServingRow } = require('../lib/canonical-v2/shared-serving-row');

const CONTRACTS_BASE64 = "KHApQ29udHJhY3RzLgooaSlBcyBvZiB0aGUgZGF0ZSBvZiB0aGlzIEFncmVlbWVudCwgbmVpdGhlciB0aGUgQ29tcGFueSBub3IgYW55IG9mIGl0cyBTdWJzaWRpYXJpZXMgaXMgYSBwYXJ0eSB0byBvciBib3VuZCBieSBhbnkgb2YgdGhlIGZvbGxvd2luZyBDb250cmFjdHMgKGV4Y2x1ZGluZyBhbnkgQmVuZWZpdCBQbGFuKTogKEEpIGFueSBDb250cmFjdCB3aXRoIHJlc3BlY3QgdG8gaW5kZWJ0ZWRuZXNzIGZvciBib3Jyb3dlZCBtb25leSwgYW55IGZpbmFuY2lhbCBndWFyYW50eSB0aGVyZW9mIG9yIHRoZSBtb3J0Z2FnaW5nIHBsZWRnaW5nIG9yIG90aGVyd2lzZSBwbGFjaW5nIGEgTGllbiBvbiBhbnkgb2YgdGhlaXIgYXNzZXRzLCBpbiBlYWNoIGNhc2UsIGluIGV4Y2VzcyBvZiAkMTAsMDAwLDAwMCwgb3RoZXIgdGhhbiBpbmRlYnRlZG5lc3MgYmV0d2VlbiBhbmQgYW1vbmcgdGhlIENvbXBhbnkgYW5kIGl0cyB3aG9sbHkgb3duZWQgU3Vic2lkaWFyaWVzOyAoQikgYW55IENvbnRyYWN0IHRoYXQgcHVycG9ydHMgdG8gcHJvaGliaXQgdGhlIENvbXBhbnkgb3IgYW55IG9mIGl0cyBTdWJzaWRpYXJpZXMgZnJvbSBjb21wZXRpbmcgaW4gYW55IG1hdGVyaWFsIHJlc3BlY3QgaW4gYW55IGJ1c2luZXNzIGxpbmUsIHdpdGggYW55IFBlcnNvbiBvciBpbiBhbnkgZ2VvZ3JhcGhpYyBhcmVhIHRoYXQsIGluIGVpdGhlciBjYXNlLCBpcyBtYXRlcmlhbCB0byB0aGUgb3BlcmF0aW9uIG9mIHRoZSBDb21wYW554oCZcyBhbmQgaXRzIFN1YnNpZGlhcmllc+KAmSBidXNpbmVzcywgdGFrZW4gYXMgYSB3aG9sZTsgKEMpIGFueSBDb250cmFjdCB0aGF0IGludm9sdmVzIGFueSBleGNoYW5nZS10cmFkZWQsIG92ZXItdGhlLWNvdW50ZXIgb3Igb3RoZXIgc3dhcCwgY2FwLCBmbG9vciwgY29sbGFyLCBmdXR1cmVzIGNvbnRyYWN0LCBmb3J3YXJkIGNvbnRyYWN0LCBvcHRpb24gb3IgYW55IG90aGVyIGRlcml2YXRpdmUgZmluYW5jaWFsIGluc3RydW1lbnQgd2l0aCBhIGZhaXIgbWFya2V0IHZhbHVlIGluIGV4Y2VzcyBvZiAkMTAsMDAwLDAwMDsgKEQpIGFueSBDb250cmFjdCB0aGF0IGludm9sdmVkIGV4cGVuZGl0dXJlcyBvciByZWNlaXB0cyBieSB0aGUgQ29tcGFueSBvciBhbnkgb2YgaXRzIFN1YnNpZGlhcmllcyBvZiBtb3JlIHRoYW4gJDEwLDAwMCwwMDAgaW4gMjAyNSBvciBieSBpdHMgdGVybXMgY29udGVtcGxhdGVzIGV4cGVuZGl0dXJlcyBvciByZWNlaXB0cyBieSB0aGUgQ29tcGFueSBvciBhbnkgb2YgaXRzIFN1YnNpZGlhcmllcyBvZiBtb3JlIHRoYW4gJDEwLDAwMCwwMDAgaW4gMjAyNjsgKEUpIGFueSBDb250cmFjdCB0aGF0IGludm9sdmVkLCBzaW5jZSBKYW51YXJ5IDEsIDIwMjUsIHRoZSBhY3F1aXNpdGlvbiBvciBkaXNwb3NpdGlvbiwgZGlyZWN0bHkgb3IgaW5kaXJlY3RseSAoYnkgbWVyZ2VyIG9yIG90aGVyd2lzZSksIG9mIGFzc2V0cyBjb21wb3NpbmcgYSBidXNpbmVzcyBvciBjYXBpdGFsIHN0b2NrIG9yIG90aGVyIGVxdWl0eSBpbnRlcmVzdHMgb2YgYW5vdGhlciBQZXJzb24gKG90aGVyIHRoYW4gYWNxdWlzaXRpb25zIG9yIGRpc3Bvc2l0aW9ucyBvZiBhc3NldHMsIGNhcGl0YWwgc3RvY2sgYW5kIG90aGVyIGVxdWl0eSBpbnRlcmVzdHMgYnkgYW5kIGFtb25nIHRoZSBDb21wYW55IGFuZCBpdHMgU3Vic2lkaWFyaWVzKSBpbiBhbiBhbW91bnQgaW4gZXhjZXNzIG9mICQxMCwwMDAsMDAwOyAoRikgYW55IENvbnRyYWN0IChvdGhlciB0aGFuIHRoaXMgQWdyZWVtZW50KSB0aGF0ICh4KSBpcyBub3QgdGVybWluYWJsZSBvbiBuaW5ldHkgKDkwKSBkYXlzIG9yIGxlc3Mgbm90aWNlIG9yICh5KSBieSBpdHMgdGVybXMgcHJvaGliaXRzIHRoZSBwYXltZW50IG9mIGRpdmlkZW5kcyBvciBvdGhlciBkaXN0cmlidXRpb25zIGJ5IHRoZSBDb21wYW55IG9yIGFueSBvZiBpdHMgU3Vic2lkaWFyaWVzOyAoRykgYW55IGpvaW50IHZlbnR1cmUgb3IgcGFydG5lcnNoaXAgdGhhdCBpcyBtYXRlcmlhbCB0byB0aGUgQ29tcGFueSBhbmQgaXRzIFN1YnNpZGlhcmllcywgdGFrZW4gYXMgYSB3aG9sZTsgKEgpIGFueSBDb21wYW55IFJlYWwgUHJvcGVydHkgTGVhc2UgbWF0ZXJpYWwgdG8gdGhlIG9wZXJhdGlvbiBvZiB0aGUgQ29tcGFueeKAmXMgYW5kIGl0cyBTdWJzaWRpYXJpZXPigJkgYnVzaW5lc3MsIHRha2VuIGFzIGEgd2hvbGU7IChJKSBhbnkgQ29udHJhY3QgdGhhdCBjb250YWlucyBhIHB1dCwgY2FsbCwgcmlnaHQgb2YgZmlyc3QgcmVmdXNhbCBvciByaWdodCBvZiBmaXJzdCBuZWdvdGlhdGlvbiwgcmlnaHQgb2YgZmlyc3Qgb2ZmZXIsIHJlZGVtcHRpb24sIHJlcHVyY2hhc2Ugb3Igc2ltaWxhciByaWdodCB0aGF0IGlzIG1hdGVyaWFsIHRvIHRoZSBDb21wYW55IGFuZCBpdHMgU3Vic2lkaWFyaWVzLCB0YWtlbiBhcyBhIHdob2xlLCBwdXJzdWFudCB0byB3aGljaCB0aGUgQ29tcGFueSBvciBhbnkgb2YgaXRzIFN1YnNpZGlhcmllcyB3b3VsZCBiZSByZXF1aXJlZCB0bywgb3IgaGF2ZSB0aGUgb3B0aW9uIG9yIHJpZ2h0IHRvLCBwdXJjaGFzZSBvciBzZWxsLCBhcyBhcHBsaWNhYmxlLCBhbnkgZXF1aXR5IGludGVyZXN0cywgYnVzaW5lc3NlcywgbGluZXMgb2YgYnVzaW5lc3MsIGRpdmlzaW9ucywgam9pbnQgdmVudHVyZXMsIHBhcnRuZXJzaGlwcyBvciBvdGhlciBhc3NldHMgb2YgYW55IFBlcnNvbjsgKEopIGFueSBzZXR0bGVtZW50IGFncmVlbWVudCBvciBzaW1pbGFyIENvbnRyYWN0IHdpdGggYSBHb3Zlcm5tZW50YWwgRW50aXR5IG9yIG9yZGVyIHRvIHdoaWNoIHRoZSBDb21wYW55IG9yIGFueSBvZiBpdHMgU3Vic2lkaWFyaWVzIGlzIGEgcGFydHkgaW52b2x2aW5nIGZ1dHVyZSBwZXJmb3JtYW5jZSBieSB0aGUgQ29tcGFueSBvciBhbnkgb2YgaXRzIFN1YnNpZGlhcmllcyBpbiBhbnkgc3VjaCBjYXNlIHRoYXQgaXMgbWF0ZXJpYWwgdG8gdGhlIENvbXBhbnkgYW5kIGl0cyBTdWJzaWRpYXJpZXMsIHRha2VuIGFzIGEgd2hvbGU7IChLKSBhbnkgQ29udHJhY3QgZm9yIGNhcGl0YWwgZXhwZW5kaXR1cmVzIG9yIHRoZSBhY3F1aXNpdGlvbiBvciBjb25zdHJ1Y3Rpb24gb2YgZml4ZWQgYXNzZXRzIHdoaWNoIHJlcXVpcmVzIGFnZ3JlZ2F0ZSBwYXltZW50cyBpbiBleGNlc3Mgb2YgJDEwLDAwMCwwMDA7IChMKSBhbnkgQ29udHJhY3QgY29udGFpbmluZyBjb3ZlbmFudHMgb2YgdGhlIENvbXBhbnkgb3IgYW55IG9mIGl0cyBTdWJzaWRpYXJpZXMgdG8gaW5kZW1uaWZ5IG9yIGhvbGQgaGFybWxlc3MgYW5vdGhlciBQZXJzb24gb3IgbWFrZSBhbnkg4oCcZWFybi1vdXTigJ0gb3Igb3RoZXIgY29udGluZ2VudCBwYXltZW50IHRvIGFub3RoZXIgUGVyc29uLCB1bmxlc3Mgc3VjaCBvYmxpZ2F0aW9uIHRvIHN1Y2ggUGVyc29uIGNvbnRhaW5lZCBpbiBzdWNoIENvbnRyYWN0IHdvdWxkIG5vdCByZWFzb25hYmx5IGJlIGV4cGVjdGVkIHRvIGV4Y2VlZCAkMTAsMDAwLDAwMDsgKE0pIGFueSBDb250cmFjdCBwdXJzdWFudCB0byB3aGljaCB0aGUgQ29tcGFueSBvciBhbnkgb2YgaXRzIFN1YnNpZGlhcmllcyBncmFudHMgdG8gYSB0aGlyZCBwYXJ0eSBvciByZWNlaXZlcyBmcm9tIGEgdGhpcmQgcGFydHkgYSBsaWNlbnNlIG9yIGFueSBvdGhlciByaWdodCB3aXRoIHJlc3BlY3QgdG8gYW55IE1hdGVyaWFsIEludGVsbGVjdHVhbCBQcm9wZXJ0eSAob3RoZXIgdGhhbiAoeCkgQ29udHJhY3RzIHB1cnN1YW50IHRvIHdoaWNoIHRoZSBhbm51YWwgZmVlcyBhcmUgbGVzcyB0aGFuCuKAiwozMgrigIsKJDMsMDAwLDAwMCwgKHkpIG5vbi1leGNsdXNpdmUgbGljZW5zZXMgZ3JhbnRlZCB0byBzZXJ2aWNlIHByb3ZpZGVycyBpbiBjb25uZWN0aW9uIHdpdGggdGhlIHByb3Zpc2lvbiBvZiBzZXJ2aWNlcyB0byB0aGUgQ29tcGFueSBvciBhbnkgb2YgaXRzIFN1YnNpZGlhcmllcyBvciAoeikgQ29udHJhY3RzIHdpdGggZW1wbG95ZWVzIGFuZCBjb250cmFjdG9ycyBvbiBmb3JtcyB0aGF0IGhhdmUgYmVlbiBtYWRlIGF2YWlsYWJsZSB0byBQYXJlbnQgcHVyc3VhbnQgdG8gd2hpY2ggc3VjaCBpbmRpdmlkdWFsIGFzc2lnbnMgcmlnaHRzIGluIEludGVsbGVjdHVhbCBQcm9wZXJ0eSB0byB0aGUgQ29tcGFueSBvciBhbnkgb2YgaXRzIFN1YnNpZGlhcmllcyk7IChOKSBhbnkgQ29udHJhY3QgaW4gZXhjZXNzIG9mICQxMCwwMDAsMDAwIHBlciBhbm51bSB0aGF0ICh4KSBncmFudHMgdG8gYW55IHRoaXJkIFBlcnNvbiBhbnkgbWF0ZXJpYWwgZXhjbHVzaXZlIGxpY2Vuc2Ugb3Igc3VwcGx5IG9yIGRpc3RyaWJ1dGlvbiBhZ3JlZW1lbnQgb3Igb3RoZXIgc2ltaWxhciBtYXRlcmlhbCBleGNsdXNpdmUgcmlnaHRzIG9yICh5KSBncmFudHMgdG8gYW55IHRoaXJkIFBlcnNvbiBhbnkg4oCcbW9zdCBmYXZvcmVkIG5hdGlvbuKAnSByaWdodHMgYW5kIGlzIGV4cGVjdGVkIHRvIHJlc3VsdCBpbiBhZ2dyZWdhdGUgcGF5bWVudHMgdG8gdGhlIENvbXBhbnkgb3IgYW55IG9mIGl0cyBTdWJzaWRpYXJpZXMsIGluIGVhY2ggY2FzZSBvZiBjbGF1c2VzICh4KSBvciAoeSksIGluIGV4Y2VzcyBvZiAkMTAsMDAwLDAwMCBwZXIgYW5udW07IChPKSBhbnkgQ29udHJhY3QgaW4gZXhjZXNzIG9mICQxMCwwMDAsMDAwIHBlciBhbm51bSBpbnZvbHZpbmcgdGhlIHBlcmZvcm1hbmNlIG9mIHNlcnZpY2VzIG9yIGRlbGl2ZXJ5IG9mIGdvb2RzLCBwcm9kdWN0cyBvciBkZXZlbG9wbWVudGFsLCBjb25zdWx0aW5nIG9yIG90aGVyIHNlcnZpY2VzIGNvbW1pdG1lbnRzIGJ5IHRoZSBDb21wYW55IG9yIGFueSBvZiBpdHMgU3Vic2lkaWFyaWVzIGFzIHRvIHdoaWNoIGFueSBNYWpvciBDdXN0b21lciBpcyBhIGNvdW50ZXJwYXJ0eSAodGhlIOKAnEN1c3RvbWVyIENvbnRyYWN0c+KAnSk7IChQKSBhbnkgQ29udHJhY3QgaW4gZXhjZXNzIG9mICQxMCwwMDAsMDAwIHBlciBhbm51bSBpbnZvbHZpbmcgdGhlIHBlcmZvcm1hbmNlIG9mIHNlcnZpY2VzIG9yIGRlbGl2ZXJ5IG9mIGdvb2RzLCBtYXRlcmlhbHMsIHN1cHBsaWVzIG9yIGVxdWlwbWVudCBvciBkZXZlbG9wbWVudGFsLCBjb25zdWx0aW5nIG9yIG90aGVyIHNlcnZpY2VzIGNvbW1pdG1lbnRzIHRvIHRoZSBDb21wYW55IG9yIGFueSBvZiBpdHMgU3Vic2lkaWFyaWVzLCBvciB0aGUgcGF5bWVudCB0aGVyZWZvciBieSB0aGUgQ29tcGFueSBvciBhbnkgb2YgaXRzIFN1YnNpZGlhcmllcyBhcyB0byB3aGljaCBhbnkgTWFqb3IgU3VwcGxpZXIgaXMgYSBjb3VudGVycGFydHkgKHRoZSDigJxTdXBwbGllciBDb250cmFjdHPigJ0pOyAoUSkgYW55IGluZGVtbmlmaWNhdGlvbiBhZ3JlZW1lbnQgYmV0d2VlbiBhbnkgSW5kZW1uaWZpZWQgUGFydHksIG9uIHRoZSBvbmUgaGFuZCwgYW5kIHRoZSBDb21wYW55IG9yIGFueSBvZiBpdHMgU3Vic2lkaWFyaWVzLCBvbiB0aGUgb3RoZXIgaGFuZDsgYW5kIChSKSBhbnkgQ29udHJhY3QgZGVlbWVkIHRvIGJlIGEg4oCcbWF0ZXJpYWwgY29udHJhY3TigJ0gKGFzIHN1Y2ggdGVybSBpcyBkZWZpbmVkIGluIEl0ZW0gNjAxKGIpKDEwKSBvZiBSZWd1bGF0aW9uIFMtSyBvZiB0aGUgU0VDKSAoYWxsIGNvbnRyYWN0cyBvZiB0aGUgdHlwZSBkZXNjcmliZWQgaW4gdGhpcyBTZWN0aW9uIOKAjjMuMShwKShpKSwgdG9nZXRoZXIgd2l0aCBhbGwgYW1lbmRtZW50cywgZXh0ZW5zaW9ucywgbW9kaWZpY2F0aW9ucywgZ3VhcmFudGVlcyBhbmQgc3VwcGxlbWVudHMgdGhlcmV0bywgYmVpbmcgcmVmZXJyZWQgdG8gaW4gdGhpcyBBZ3JlZW1lbnQgYXMg4oCcQ29tcGFueSBNYXRlcmlhbCBDb250cmFjdHPigJ0pLgooaWkpRXhjZXB0IGFzIHdvdWxkIG5vdCBiZSByZWFzb25hYmx5IGV4cGVjdGVkIHRvIGhhdmUsIGluZGl2aWR1YWxseSBvciBpbiB0aGUgYWdncmVnYXRlLCBhIENvbXBhbnkgTWF0ZXJpYWwgQWR2ZXJzZSBFZmZlY3QsIChBKSBuZWl0aGVyIHRoZSBDb21wYW55IG5vciBhbnkgb2YgaXRzIFN1YnNpZGlhcmllcyBub3IsIHRvIHRoZSBLbm93bGVkZ2Ugb2YgdGhlIENvbXBhbnksIGFueSBvdGhlciBwYXJ0eSwgaXMgaW4gbWF0ZXJpYWwgYnJlYWNoIG9mIG9yIGRlZmF1bHQgdW5kZXIgdGhlIHRlcm1zIG9mIGFueSBDb21wYW55IE1hdGVyaWFsIENvbnRyYWN0OyAoQikgZWFjaCBDb21wYW55IE1hdGVyaWFsIENvbnRyYWN0IGlzIGEgdmFsaWQgYW5kIGJpbmRpbmcgb2JsaWdhdGlvbiBvZiB0aGUgQ29tcGFueSBvciBpdHMgU3Vic2lkaWFyaWVzIHdoaWNoIGlzIHBhcnR5IHRoZXJldG8gYW5kLCB0byB0aGUgS25vd2xlZGdlIG9mIHRoZSBDb21wYW55LCBvZiBlYWNoIG90aGVyIHBhcnR5IHRoZXJldG8sIGFuZCBpcyBpbiBmdWxsIGZvcmNlIGFuZCBlZmZlY3QsIGV4Y2VwdCB0aGF0IHN1Y2ggZW5mb3JjZW1lbnQgbWF5IGJlIHN1YmplY3QgdG8gdGhlIEJhbmtydXB0Y3kgYW5kIEVxdWl0eSBFeGNlcHRpb247IGFuZCAoQykgbmVpdGhlciB0aGUgQ29tcGFueSBub3IgYW55IG9mIGl0cyBTdWJzaWRpYXJpZXMgaGFzIHJlY2VpdmVkIGFueSB3cml0dGVuLCBvciwgdG8gdGhlIEtub3dsZWRnZSBvZiB0aGUgQ29tcGFueSwgb3JhbCwgbm90aWNlIG9mIHRlcm1pbmF0aW9uIG9yIGJyZWFjaCB3aXRoIHJlc3BlY3QgdG8sIGFuZCwgdG8gdGhlIEtub3dsZWRnZSBvZiB0aGUgQ29tcGFueSwgbm8gcGFydHkgaGFzIHRocmVhdGVuZWQgdG8gdGVybWluYXRlLCBhbnkgQ29tcGFueSBNYXRlcmlhbCBDb250cmFjdC4gRXhjZXB0IGZvciBhbnkgQ29tcGFueSBNYXRlcmlhbCBDb250cmFjdHMgZmlsZWQgd2l0aG91dCByZWRhY3Rpb24gYXMgZXhoaWJpdHMgdG8gdGhlIENvbXBhbnkgUmVwb3J0cywgYSBjb3B5IG9mIGVhY2ggQ29tcGFueSBNYXRlcmlhbCBDb250cmFjdCBoYXMgYmVlbiBtYWRlIGF2YWlsYWJsZSB0byBQYXJlbnQuCg==";
const AGREEMENT_DOCUMENT_HASH = 'abba043018410d718c207e7d7a43c9567166f6a10c4c9a6b4b0c8c7761cd6b9d';
const DEAL_VALUE_DOCUMENT_HASH = '343ba5da8ab34f478f274307046836af4ded762b010e08ed8d9015be2e09c827';
const DEAL_VALUE_TEXT = 'entered into a definitive agreement to acquire TopBuild Corp. (NYSE: BLD) (“TopBuild”) for approximately $17 billion';
const contractBundle = compileFixtureContract();
const corpusReleaseId = contentId('CORPUS_RELEASE/V1', 'qxo-material-contracts-test');

function digest(label) {
  return contentId('QXO_MATERIAL_CONTRACTS_TEST/V1', label);
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
  const verificationManifestId = digest('verification:' + sourceOrdinal);
  const sourceMapDigest = digest('source-map:' + sourceOrdinal);
  const admittedIntervals = [{ start: 0, end: canonicalTextByteLength }];
  const admissionBody = {
    schema_version: 'SOURCE_ADMISSION_MANIFEST/V2',
    admission_state: 'VERIFIED',
    source_kind: 'ORIGINAL_BYTES',
    immutable_source_document_id: immutableSourceDocumentId,
    source_response_content_id: sourceContentId,
    canonical_text_id: options.canonicalTextId,
    verification_manifest_id: verificationManifestId,
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
    semantic_extraction_input_envelope_id: digest('semantic-envelope:' + sourceOrdinal),
    source_content_id: sourceContentId,
    source_occurrence_id: contentId('SOURCE_OCCURRENCE/V1', {
      source_content_id: sourceContentId,
      source_occurrence_key: sourceOccurrenceKey,
    }),
    source_occurrence_key: sourceOccurrenceKey,
    source_kind: 'ORIGINAL_BYTES',
    document_hash: options.documentHash,
    source_byte_length: Buffer.byteLength(options.text, 'utf8') + 1000,
    canonical_text_id: options.canonicalTextId,
    canonical_text_sha256: sha256Hex(options.text),
    canonical_text_byte_length: canonicalTextByteLength,
    canonical_text: {
      schema_version: 'ADMITTED_CANONICAL_TEXT_RUNTIME/V1',
      canonical_text_id: options.canonicalTextId,
      text: options.text,
    },
    converter_digest: digest('converter'),
    converter_config_digest: digest('converter-config'),
    source_map_encoding: 'GZIP_BASE64_JSON_V1',
    source_map_compressed_sha256: digest('source-map-compressed:' + sourceOrdinal),
    source_map_uncompressed_byte_length: 1,
    input_region_count: 1,
    output_mapping_count: 1,
    source_map_digest: sourceMapDigest,
    verification_manifest_id: verificationManifestId,
  };
  const sourceContext = Object.freeze({
    ...body,
    admitted_semantic_source_context_id: contentId('ADMITTED_SEMANTIC_SOURCE_CONTEXT/V1', body),
  });
  return { sourceContext, sourceAdmission };
}

function sourceContexts() {
  const agreementBytes = Buffer.alloc(AGREEMENT_CANONICAL_TEXT_BYTE_LENGTH, 0x20);
  Buffer.from(CONTRACTS_BASE64, 'base64').copy(agreementBytes, CONTRACTS_INTERVAL.start);
  const dealValueBytes = Buffer.alloc(DEAL_VALUE_CANONICAL_TEXT_BYTE_LENGTH, 0x20);
  Buffer.from(DEAL_VALUE_TEXT, 'utf8').copy(dealValueBytes, DEAL_VALUE_INTERVAL.start);
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

function build(selectedContractBundle = contractBundle) {
  const contexts = sourceContexts();
  return {
    ...contexts,
    candidate: buildQxoMaterialContractsSlice({
      ...contexts,
      contractBundle: selectedContractBundle,
      corpusReleaseId,
    }),
  };
}

test('QXO keeps the exact $10m threshold and $17bn denominator while excluding the unmapped period from market cohorts', () => {
  const { candidate } = build();
  assert.equal(candidate.claim.state, 'PRESENT');
  assert.equal(candidate.claim.raw_value, '$10,000,000');
  assert.equal(candidate.claim.canonical_value, '0.05882353');
  assert.equal(candidate.claim.unit, 'PERCENT_OF_DEAL_VALUE');
  assert.deepEqual(candidate.claim.denominator, {
    value: '17000000000',
    currency: 'USD',
    basis: 'HEADLINE_TRANSACTION_VALUE',
    source_lineage_ids: [candidate.excerpts.deal_value.excerpt_id],
  });
  assert.equal(Object.hasOwn(candidate.claim.attributes, 'measurement_period_code'), false);
  assert.deepEqual({
    raw: candidate.claim.attributes.measurement_period_raw_text,
    actual: candidate.claim.attributes.actual_period_raw,
    contemplated: candidate.claim.attributes.contemplated_period_raw,
    mapping: candidate.claim.attributes.measurement_period_mapping_state,
  }, {
    raw: 'actual expenditures or receipts in 2025; contemplated expenditures or receipts in 2026',
    actual: '2025',
    contemplated: '2026',
    mapping: 'UNMAPPED_FROZEN_TAXONOMY',
  });
  assert.equal(validateProjectedMetricSlotOutput(candidate.projection), true);
  assert.equal(candidate.projection.observation, null);
  assert.equal(candidate.projection.exclusion.exclusion_reason, 'RESULT_INCOMPLETE');
  assert.equal(candidate.projection.exclusion.cohort_membership, 'NO_COHORT_MEMBERSHIP');
  assert.equal(candidate.projection.exclusion.aggregate_authority, 'NO_AGGREGATE_AUTHORITY');
});

test('F5 classifies the source-described QXO deal-value denominator as approximate', () => {
  const { candidate } = build(compileFixtureContractV5());
  assert.equal(candidate.claim.denominator.precision, 'APPROXIMATE');
  assert.equal(candidate.claim.attributes.denominator_precision, 'APPROXIMATE');
  assert.equal(candidate.projection.observation, null);
  assert.equal(candidate.projection.exclusion.exclusion_reason, 'RESULT_INCOMPLETE');
  assert.equal(validateSharedServingRow(candidate.incomplete_shared_row), true);
  const metric = adaptSharedServingRow(candidate.incomplete_shared_row).data
    .byRow[candidate.incomplete_shared_row.row_serving_key]
    .metrics.MATERIAL_CONTRACT_CASH_FLOW_THRESHOLD_PERCENT_OF_DEAL_VALUE;
  assert.equal(metric.subject.denominatorPrecision, 'APPROXIMATE');
  assert.equal(metric.subject.label, 'Approximately 0.06% of headline deal value');
});

test('QXO incomplete row binds the attribute candidate and remains useful in Review without claiming market data', async () => {
  const { candidate } = build();
  const row = candidate.incomplete_shared_row;
  assert.equal(validateSharedServingRow(row), true);
  assert.equal(row.row_kind, 'INCOMPLETE_CANONICAL_RESULT');
  assert.equal(row.incomplete_canonical_result.result_completeness, 'INCOMPLETE_NOVEL_SEMANTIC');
  assert.equal(row.incomplete_canonical_result.market_comparability, 'NOT_CERTIFIED');
  assert.deepEqual(row.incomplete_canonical_result.governed_reason_codes, ['UNMAPPED_MEASUREMENT_PERIOD']);
  assert.equal(row.incomplete_canonical_result.intersecting_candidates.length, 1);
  assert.equal(
    row.incomplete_canonical_result.intersecting_candidates[0].open_world_candidate_occurrence_id,
    candidate.open_world.candidateOccurrence.open_world_candidate_occurrence_id,
  );
  assert.equal(candidate.open_world.openWorldCandidate.candidate_kind, 'ATTRIBUTE_OR_QUESTION');
  assert.equal(candidate.open_world.semanticImpactClosure.impact_value, 'AFFECTS_CANONICAL_RESULT');
  assert.deepEqual(
    candidate.open_world.semanticImpactClosure.affected_canonical_result_occurrence_ids,
    [row.incomplete_canonical_result.derived_result_occurrence_id],
  );

  const adapted = adaptSharedServingRow(row);
  assert.equal(adapted.resolution.rowKey, row.row_serving_key);
  const metric = adapted.data.byRow[row.row_serving_key].metrics
    .MATERIAL_CONTRACT_CASH_FLOW_THRESHOLD_PERCENT_OF_DEAL_VALUE;
  assert.equal(adapted.resolution.marketCohortEligible, false);
  assert.equal(metric.state, 'not_certified');
  assert.deepEqual(metric.subject.cohortMembership, {
    status: 'excluded',
    exclusionReason: 'RESULT_INCOMPLETE',
  });
  assert.equal(metric.subject.percentOfDealValue, 0.05882353);
  assert.equal(metric.subject.denominatorPrecision, 'NOT_CAPTURED');
  assert.equal(
    metric.subject.label,
    '0.06% of headline deal value (denominator precision not captured)',
  );
  assert.equal(
    metric.subject.legalTerms.find((term) => term.key === 'raw_amount').value,
    '$10,000,000',
  );
  assert.match(
    metric.subject.legalTerms.find((term) => term.key === 'period').value,
    /2025.*2026/,
  );
  assert.equal(metric.distribution, null);
  const { buildTypedRowMarketContext } = await import('../components/review-v2/rowMarketContext.js');
  const context = buildTypedRowMarketContext(adapted.resolution, adapted.data);
  assert.equal(context.metrics[0].subjectValue, 0.05882353);
  assert.match(context.metrics[0].comparisonUnavailableReason, /measurement period is not mapped/i);
  assert.equal(context.currentDealTerms.find((term) => term.key === 'raw_amount').value, '$10,000,000');
});

test('QXO semantic write set retains the canonical claim and complete open-world authority chain', () => {
  const { candidate } = build();
  const writeSet = candidate.semantic_write_set;
  assert.deepEqual(writeSet.source_references.map((reference) => reference.source_ordinal), [0, 1]);
  assert.equal(writeSet.provisions.length, 1);
  assert.equal(writeSet.components.length, 1);
  assert.equal(writeSet.claims.length, 1);
  assert.equal(writeSet.open_world_candidates.length, 1);
  assert.equal(writeSet.open_world_candidates[0].candidate_kind, 'ATTRIBUTE_OR_QUESTION');
  assert.equal(writeSet.open_world_evidence_references.length, 2);
  assert.equal(writeSet.open_world_candidate_dispositions.length, 1);
  assert.equal(writeSet.open_world_candidate_dispositions[0].disposition_code, 'REVIEWED_SOURCE_SPECIFIC');
  assert.equal(writeSet.open_world_primitives.length, 1);
  assert.equal(writeSet.open_world_primitives[0].primitive_kind, 'TIME');
  assert.equal(writeSet.semantic_impact_closures.length, 1);
  assert.equal(writeSet.semantic_impact_closures[0].impact_value, 'AFFECTS_CANONICAL_RESULT');
  assert.equal(writeSet.incomplete_canonical_result_rows.length, 1);
  assert.equal(writeSet.reviewed_source_specific_rows.length, 0);
  assert.equal(
    new Set(candidate.reviewed_mapping.canonical_object_ids).size,
    candidate.reviewed_mapping.canonical_object_ids.length,
  );
  assert.ok(candidate.reviewed_mapping.canonical_object_ids.includes(
    candidate.open_world.openWorldCandidate.candidate_id,
  ));
  assert.ok(candidate.reviewed_mapping.canonical_object_ids.includes(
    candidate.open_world.finalDisposition.final_disposition_id,
  ));
  assert.equal(candidate.admitted_exact_detail_input.adapter_status, 'CERTIFIED');
  assert.deepEqual(
    candidate.admitted_exact_detail_input.source_admission_manifest_ids,
    candidate.candidate_release_member.exact_detail.sources.map((entry) => (
      entry.source_admission.source_admission_manifest_id
    )),
  );
  const detail = candidate.admitted_exact_detail_package;
  assert.equal(candidate.candidate_release_member.shared_row, candidate.incomplete_shared_row);
  assert.equal(candidate.candidate_release_member.exact_detail.package, detail);
  assert.equal(detail.row, candidate.incomplete_shared_row);
  assert.equal(detail.row.row_kind, 'INCOMPLETE_CANONICAL_RESULT');
  assert.equal(
    detail.row.incomplete_canonical_result.result_completeness,
    'INCOMPLETE_NOVEL_SEMANTIC',
  );
  assert.equal(detail.row.incomplete_canonical_result.market_comparability, 'NOT_CERTIFIED');
  const payload = detail.detail_payloads[0].response_body;
  assert.deepEqual(payload.source_lineages.map((lineage) => ({
    source_ordinal: lineage.source_ordinal,
    document_hash: lineage.document_hash,
    canonical_text_id: lineage.canonical_text_id,
  })), [{
    source_ordinal: 0,
    document_hash: AGREEMENT_DOCUMENT_HASH,
    canonical_text_id: AGREEMENT_CANONICAL_TEXT_ID,
  }, {
    source_ordinal: 1,
    document_hash: DEAL_VALUE_DOCUMENT_HASH,
    canonical_text_id: DEAL_VALUE_CANONICAL_TEXT_ID,
  }]);
  assert.deepEqual(payload.excerpts.map((excerpt) => ({
    source_ordinal: excerpt.source_ordinal,
    canonical_text_id: excerpt.canonical_text_id,
    absolute_start: excerpt.absolute_start,
    absolute_end: excerpt.absolute_end,
    exact_bytes_digest: excerpt.exact_bytes_digest,
  })), [{
    source_ordinal: 0,
    canonical_text_id: AGREEMENT_CANONICAL_TEXT_ID,
    absolute_start: candidate.excerpts.criterion.absolute_start,
    absolute_end: candidate.excerpts.criterion.absolute_end,
    exact_bytes_digest: candidate.excerpts.criterion.exact_bytes_digest,
  }, {
    source_ordinal: 1,
    canonical_text_id: DEAL_VALUE_CANONICAL_TEXT_ID,
    absolute_start: DEAL_VALUE_INTERVAL.start,
    absolute_end: DEAL_VALUE_INTERVAL.end,
    exact_bytes_digest: candidate.excerpts.deal_value.exact_bytes_digest,
  }]);
  assert.equal(validateAdmittedMultiSourceResultCompositionDetailPackage({
    package: detail,
    contract_bundle: contractBundle,
    sources: candidate.candidate_release_member.exact_detail.sources,
    components: candidate.candidate_release_member.exact_detail.components,
    relationship_targets: [],
    excerpts: candidate.candidate_release_member.exact_detail.excerpts,
  }), true);
});

test('QXO multi-source incomplete result is a certifiable release member with no market cohort', () => {
  const { candidate } = build();
  const release = buildFixtureCandidateRelease({
    contract_bundle: contractBundle,
    serving_namespace_id: contentId('SERVING_NAMESPACE/V1', 'qxo-material-contracts-test'),
    corpus_release_id: corpusReleaseId,
    members: [candidate.candidate_release_member],
    correction_authority_selection: buildFixtureCandidateInputAuthority({ contractBundle }),
    deal_directory_entries: [{
      application_deal_id: '97d97e8a-1fa9-43f3-a106-9dd3e0cb81bc',
      governed_deal_key: 'deal:qxo-topbuild',
    }],
  });
  assert.equal(validateCandidateReleaseBundle(release), true);
  assert.equal(release.manifest.counts.observations, 0);
  assert.equal(release.manifest.counts.exclusions, 1);
  assert.equal(release.manifest.counts.incomplete_canonical_rows, 1);
  assert.equal(release.manifest.counts.exact_detail_packages, 1);
  assert.equal(release.query_records.length, 0);
  assert.deepEqual(
    release.exact_detail_packages[0].detail_payloads[0].response_body.source_lineages
      .map((lineage) => lineage.source_ordinal),
    [0, 1],
  );
});

test('QXO material-contract slice is deterministic and exact source drift fails closed', () => {
  const first = build();
  const second = build();
  assert.equal(canonicalJson(first.candidate), canonicalJson(second.candidate));
  assert.equal(validateQxoMaterialContractsSlice({
    candidate: first.candidate,
    agreementSourceContext: first.agreementSourceContext,
    agreementSourceAdmission: first.agreementSourceAdmission,
    dealValueSourceContext: first.dealValueSourceContext,
    dealValueSourceAdmission: first.dealValueSourceAdmission,
    contractBundle,
    corpusReleaseId,
  }), true);

  const changedText = Buffer.from(first.agreementSourceContext.canonical_text.text, 'utf8');
  changedText[CONTRACTS_INTERVAL.start] = 0x58;
  const changed = admittedContext({
    sourceOrdinal: 0,
    documentHash: AGREEMENT_DOCUMENT_HASH,
    canonicalTextId: AGREEMENT_CANONICAL_TEXT_ID,
    text: changedText.toString('utf8'),
  });
  assert.throws(() => buildQxoMaterialContractsSlice({
    agreementSourceContext: changed.sourceContext,
    agreementSourceAdmission: changed.sourceAdmission,
    dealValueSourceContext: first.dealValueSourceContext,
    dealValueSourceAdmission: first.dealValueSourceAdmission,
    contractBundle,
    corpusReleaseId,
  }), /Contracts section has drifted/);

  const exactDetailDrift = JSON.parse(JSON.stringify(first.candidate.admitted_exact_detail_package));
  exactDetailDrift.detail_payloads[0].response_body.excerpts[1].exact_bytes_digest = '0'.repeat(64);
  assert.throws(() => validateAdmittedMultiSourceResultCompositionDetailPackage({
    package: exactDetailDrift,
    contract_bundle: contractBundle,
    sources: first.candidate.candidate_release_member.exact_detail.sources,
    components: first.candidate.candidate_release_member.exact_detail.components,
    relationship_targets: [],
    excerpts: first.candidate.candidate_release_member.exact_detail.excerpts,
  }), /identity or source closure mismatch/);

  assert.throws(() => validateAdmittedMultiSourceResultCompositionDetailPackage({
    package: first.candidate.admitted_exact_detail_package,
    contract_bundle: contractBundle,
    sources: [...first.candidate.candidate_release_member.exact_detail.sources].reverse(),
    components: first.candidate.candidate_release_member.exact_detail.components,
    relationship_targets: [],
    excerpts: first.candidate.candidate_release_member.exact_detail.excerpts,
  }), /governed source order/);
});

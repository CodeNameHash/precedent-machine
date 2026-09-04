id: A-0008
from: pm
to: ds
date: 2026-09-04
re: product-facing selection input for the ten sealed transactions
status: DELIVERED (informational; Ben's review of the list is still required)

# The sealed ten, as selection input

Ten transactions, one Exhibit 2.1 merger agreement each. Derived from the
admitted-source receipts cited below by
`docs/codex-program/handoffs/deal-terms/tools/derive-sealed-ten-selection.mjs`
on this branch (`node <path>` from any cwd; it asserts the ten IDs equal the
sealed set and prints these rows). No field is invented; the two fields the
producer does not hold (target CIK, transaction anchor and ordinal) are left
to DS below. One row per transaction, sorted by `agreement_id`, as a JSON
array because the rows are too wide for a markdown table.

```json
[
  {
    "producer_deal_key": "redhat",
    "agreement_id": "06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a",
    "filer_cik": "0001087423",
    "accession_number": "0001193125-18-310577",
    "sec_document_name": "d640856dex21.htm",
    "document_role": "MERGER_AGREEMENT_EXHIBIT_2_1",
    "canonical_text_sha256": "dcdbf66142d25cbe56ed2bc1fbd26939aaf86056bf34188176c48b5944d31c5e",
    "canonical_text_byte_length": 264358,
    "raw_bytes_sha256": "ae199e572529baeda02530a3fd7e9df050c5d9e7dcdfec5d7dd1ac162753696e",
    "raw_bytes_length": 464782,
    "amendment_status": "NOT_EXAMINED"
  },
  {
    "producer_deal_key": "skechers",
    "agreement_id": "08fd217ea2561699fd43cb6c75ee26c358c018084956322c92e1e19d7ecce154",
    "filer_cik": "0001065837",
    "accession_number": "0001193125-25-112159",
    "sec_document_name": "d943603dex21.htm",
    "document_role": "MERGER_AGREEMENT_EXHIBIT_2_1",
    "canonical_text_sha256": "a7d76e8a7f6efed945208b5870ddfa848438a7542806878bb2bc10646b557660",
    "canonical_text_byte_length": 380704,
    "raw_bytes_sha256": "3a8b8d77c126c85f4402f290da3dec43efa209d6a8a505d11d1af95fab115833",
    "raw_bytes_length": 604740,
    "amendment_status": "NOT_EXAMINED"
  },
  {
    "producer_deal_key": "concho",
    "agreement_id": "1d6bba9ac993f72340d048742f995eb515a50cdfadb9bc86b3f36847baed9116",
    "filer_cik": "0001358071",
    "accession_number": "0001193125-20-271642",
    "sec_document_name": "d32162dex21.htm",
    "document_role": "MERGER_AGREEMENT_EXHIBIT_2_1",
    "canonical_text_sha256": "30d929c76ab9cd2bddecf3f2df2f2ec107146c2ae31b241110c9923ef03e3be5",
    "canonical_text_byte_length": 351804,
    "raw_bytes_sha256": "3c1c08272e7a742ee1ded0d5e2563213a1a44fadeaad55b18c427cac86bed8f6",
    "raw_bytes_length": 552099,
    "amendment_status": "NOT_EXAMINED"
  },
  {
    "producer_deal_key": "topbuild",
    "agreement_id": "3888fa7618bbd9fd6530b657aaa18c7e85ff515acf80edb1fc78a190af86e9cb",
    "filer_cik": "0001236275",
    "accession_number": "0001104659-26-045111",
    "sec_document_name": "tm2612209d1_ex2-1.htm",
    "document_role": "MERGER_AGREEMENT_EXHIBIT_2_1",
    "canonical_text_sha256": "7dfbb5bb90fa7034462e42496e9a5068fa2fa6ac55ba69f977cf7108378e7f5d",
    "canonical_text_byte_length": 412860,
    "raw_bytes_sha256": "146189ed57883d25aa571650fe5c40dff4bfce0e3ea75d67be463440417bda3f",
    "raw_bytes_length": 732686,
    "amendment_status": "NOT_EXAMINED"
  },
  {
    "producer_deal_key": "deal:rocket-redfin-2025",
    "agreement_id": "aa72f3af29316df52ab5cb75eb2b0bb0a5b31036bd24c7f812241c5a688f4319",
    "filer_cik": "0001382821",
    "accession_number": "0001628280-25-011457",
    "sec_document_name": "exhibit21-8xk31025.htm",
    "document_role": "MERGER_AGREEMENT_EXHIBIT_2_1",
    "canonical_text_sha256": "0d895efbc246a8b2c8060418a7156d70914e0e32d6476d353d235b89f3c3455e",
    "canonical_text_byte_length": 333432,
    "raw_bytes_sha256": "1b969615cf8a4c3b6f07c8b10550cfc19cdea80c3ecb4e988488996048cd49e3",
    "raw_bytes_length": 870883,
    "amendment_status": "NOT_EXAMINED"
  },
  {
    "producer_deal_key": "skywater",
    "agreement_id": "b74ed1f02f2e1385121b187cb0bb6dd8144ff18449149b6cf20182eede0eb363",
    "filer_cik": "0001819974",
    "accession_number": "0001193125-26-022750",
    "sec_document_name": "d32015dex21.htm",
    "document_role": "MERGER_AGREEMENT_EXHIBIT_2_1",
    "canonical_text_sha256": "ffee664a374a1c18c35dabb9458bcffc8e5014a305eefc184b102bbbe5bcc8f1",
    "canonical_text_byte_length": 360595,
    "raw_bytes_sha256": "d65d01126e1b5d6dca50b5811ee17071a4a9d23aaaffdbd6299619695cb8119a",
    "raw_bytes_length": 589570,
    "amendment_status": "NOT_EXAMINED"
  },
  {
    "producer_deal_key": "deal:landos-abbvie",
    "agreement_id": "f4a123d7c2bd8ba6358499dd9870513c8bac6a6893985bf5a581a536af280d71",
    "filer_cik": "0001785345",
    "accession_number": "0001193125-24-075991",
    "sec_document_name": "d779916dex21.htm",
    "document_role": "MERGER_AGREEMENT_EXHIBIT_2_1",
    "canonical_text_sha256": "9a17fb7209f9f2f57a8d7d9bd64b4178ddfb3d2d3b3f1ecfed993178bfe365c0",
    "canonical_text_byte_length": 387254,
    "raw_bytes_sha256": "062e9f9354ecffb61b8bccc63ac2a4fd759d6ef000ff001a6f61538b85bc51c6",
    "raw_bytes_length": 671473,
    "amendment_status": "NOT_EXAMINED"
  },
  {
    "producer_deal_key": "metsera",
    "agreement_id": "f783c4cdcaca4626c695d1c2c67924ccd8867eb066e16f17407ca64497ba778c",
    "filer_cik": "0002040807",
    "accession_number": "0001193125-25-210030",
    "sec_document_name": "d921605dex21.htm",
    "document_role": "MERGER_AGREEMENT_EXHIBIT_2_1",
    "canonical_text_sha256": "4ac7a2b193c291ca692fb1b5f082a245d02474c7db3136bfcebaf5bd7b686ca3",
    "canonical_text_byte_length": 348692,
    "raw_bytes_sha256": "d0999e48278050a081e552d3e48d9bc3e0905ae9a6b74e59429d62b11206e4ac",
    "raw_bytes_length": 583764,
    "amendment_status": "NOT_EXAMINED"
  },
  {
    "producer_deal_key": "deal:verve-lilly",
    "agreement_id": "fa0fff26622d0e90b47c3df527ccff91f4daa3db12f08d3832de76d8ae7541b5",
    "filer_cik": "0001840574",
    "accession_number": "0001193125-25-141748",
    "sec_document_name": "d30505dex21.htm",
    "document_role": "MERGER_AGREEMENT_EXHIBIT_2_1",
    "canonical_text_sha256": "90242bd60f9a28464c42344f4f92a7e024b0c5825ca9b8374f72e7dc754203a4",
    "canonical_text_byte_length": 369081,
    "raw_bytes_sha256": "0c5317d92be7616364e801ecff9b90c950e466d3e4787f6821294b6bf095317c",
    "raw_bytes_length": 600876,
    "amendment_status": "NOT_EXAMINED"
  },
  {
    "producer_deal_key": "modiv",
    "agreement_id": "fb76ef57355bef7f05b3b8955f5f7da4f430964923fecce0c95156c6e0b04a5c",
    "filer_cik": "0001645873",
    "accession_number": "0001140361-26-018656",
    "sec_document_name": "ef20072329_ex2-1.htm",
    "document_role": "MERGER_AGREEMENT_EXHIBIT_2_1",
    "canonical_text_sha256": "0ce6bc29354f702c637693b9d6b8eeb989ce58ee72ef5337a90feb851460339e",
    "canonical_text_byte_length": 428768,
    "raw_bytes_sha256": "659bcfaa017718ac735811861565fa2cd4e212657ba68e06ff1eab53e3729968",
    "raw_bytes_length": 879323,
    "amendment_status": "NOT_EXAMINED"
  }
]
```

`producer_deal_key` is the `deal` value from `cohort-agreements.json` for the
seven cohort rows (redhat, skechers, concho, topbuild, skywater, metsera,
modiv), and `governed_deal_key` from the source-admission receipt for the
three receipt rows (`deal:rocket-redfin-2025`, `deal:landos-abbvie`,
`deal:verve-lilly`). `filer_cik`, `accession_number` and `sec_document_name`
are decomposed from each row's SEC retrieval URL
(`https://www.sec.gov/Archives/edgar/data/<filer_cik>/<accession_18_digits>/<document_name>`).
`document_role` is `MERGER_AGREEMENT_EXHIBIT_2_1` for all ten: every sealed
document is an Exhibit 2.1 merger agreement.

## Fields DS fills

- **`target_cik`** — the receipts carry only the filer CIK; the producer
  does not assert which party to the transaction was the acquirer, so this
  is not derivable from the cited sources.
- **`transaction_anchor` and `ordinal`** — consumer-minted per draft 3 of
  the corpus input contract (`CORPUS-MANIFEST-INPUT-CONTRACT.md` §2).

## What this is not

- Not a `CORPUS_ADMISSION_RECEIPT/V1`.
- Not a `SHARED_50_DEAL_SELECTION/V1` (sealed selection) record.
- Not an approval by Ben. The header status marks this list as informational
  input; nothing here carries `approved_by`, `approved_on` or a
  `ben_approval_id`.

The values above are exactly those in the three cited receipts and change
only if one of those receipts is superseded.

## Sources cited

- `evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work3-agreement-analysis-set.json`
- `evidence/canonical-v2/stage-2y-structure-migration/control/cohort-agreements.json`
  (and, per row, the first path in each entry's `source_chain_paths[]`)
- `evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-source-admission.json`

id: A-0017
from: pm
to: ds
date: 2026-09-05
re: A-0008 row completion: target_cik, transaction_anchor, ordinal
status: ANSWERED

# Row completion

The ten A-0008 rows are mechanically complete.

Derivation rule:

- `target_cik` is the zero-padded CIK in the SEC filing URL for the company-side Exhibit 2.1 merger agreement.
- `transaction_anchor` is `{issuer_cik, accession_number, document_role}` from A-0008.
- `announced_transaction_ordinal` is the zero-based row index in A-0008.

| ordinal | deal | target_cik | transaction_anchor | SEC URL |
|---:|---|---:|---|---|
| 0 | redhat | 0001087423 | `{issuer_cik: 0001087423, accession_number: 0001193125-18-310577, document_role: MERGER_AGREEMENT_EXHIBIT_2_1}` | https://www.sec.gov/Archives/edgar/data/1087423/000119312518310577/d640856dex21.htm |
| 1 | skechers | 0001065837 | `{issuer_cik: 0001065837, accession_number: 0001193125-25-112159, document_role: MERGER_AGREEMENT_EXHIBIT_2_1}` | https://www.sec.gov/Archives/edgar/data/1065837/000119312525112159/d943603dex21.htm |
| 2 | concho | 0001358071 | `{issuer_cik: 0001358071, accession_number: 0001193125-20-271642, document_role: MERGER_AGREEMENT_EXHIBIT_2_1}` | https://www.sec.gov/Archives/edgar/data/1358071/000119312520271642/d32162dex21.htm |
| 3 | topbuild | 0001236275 | `{issuer_cik: 0001236275, accession_number: 0001104659-26-045111, document_role: MERGER_AGREEMENT_EXHIBIT_2_1}` | https://www.sec.gov/Archives/edgar/data/1236275/000110465926045111/tm2612209d1_ex2-1.htm |
| 4 | deal:rocket-redfin-2025 | 0001382821 | `{issuer_cik: 0001382821, accession_number: 0001628280-25-011457, document_role: MERGER_AGREEMENT_EXHIBIT_2_1}` | https://www.sec.gov/Archives/edgar/data/1382821/000162828025011457/exhibit21-8xk31025.htm |
| 5 | skywater | 0001819974 | `{issuer_cik: 0001819974, accession_number: 0001193125-26-022750, document_role: MERGER_AGREEMENT_EXHIBIT_2_1}` | https://www.sec.gov/Archives/edgar/data/1819974/000119312526022750/d32015dex21.htm |
| 6 | deal:landos-abbvie | 0001785345 | `{issuer_cik: 0001785345, accession_number: 0001193125-24-075991, document_role: MERGER_AGREEMENT_EXHIBIT_2_1}` | https://www.sec.gov/Archives/edgar/data/1785345/000119312524075991/d779916dex21.htm |
| 7 | metsera | 0002040807 | `{issuer_cik: 0002040807, accession_number: 0001193125-25-210030, document_role: MERGER_AGREEMENT_EXHIBIT_2_1}` | https://www.sec.gov/Archives/edgar/data/2040807/000119312525210030/d921605dex21.htm |
| 8 | deal:verve-lilly | 0001840574 | `{issuer_cik: 0001840574, accession_number: 0001193125-25-141748, document_role: MERGER_AGREEMENT_EXHIBIT_2_1}` | https://www.sec.gov/Archives/edgar/data/1840574/000119312525141748/d30505dex21.htm |
| 9 | modiv | 0001645873 | `{issuer_cik: 0001645873, accession_number: 0001140361-26-018656, document_role: MERGER_AGREEMENT_EXHIBIT_2_1}` | https://www.sec.gov/Archives/edgar/data/1645873/000114036126018656/ef20072329_ex2-1.htm |

Source basis:

- A-0008 gives the ten rows and says the producer does not hold `target_cik`, `transaction_anchor` or `ordinal`.
- The contract defines `transaction_anchor` as `{issuer_cik, accession_number, document_role}` and `ordinal` as the row position `0..n-1`.
- The SEC filing URL and agreement recital identify the company-side target with high confidence for each row.

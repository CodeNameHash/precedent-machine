'use strict';

// Work package 26 (plan finding (232), 2026-10-22): NCS 5.1's own words as
// stored for generation 5 (run 51577c57), for the pins on Ben's three fact
// shapes. Limb (a)'s lead paragraph (the affirmative covenants, then the
// opening words of the negative covenants: the time window, the sources of
// exception and Parent's consent standard); (a)(xi), the Tax covenant, a
// semicolon list of five prohibited Tax actions under the opening words'
// one "shall not"; limb (b)'s lead (Parent's opening words); (b)(i), the
// extraordinary dividends restriction with its proviso; (b)(ii), a sibling
// limb. Each limb is given without its enumerator; canonical() lays them
// out as the agreement does. The sibling fixture
// conduct-of-business-layout.js is a synthetic 5.1 for the layout pins.

const HEADING = "Section 5.1 Conduct of Business.";
const LEAD_A = "Conduct of Business by the Company. From the date of this Agreement to the earlier of the Effective Time or the date this Agreement is terminated in accordance with Article VII, except as consented to in writing in advance by Parent (such consent not to be unreasonably withheld, conditioned or delayed) or as otherwise specifically required by this Agreement or required by applicable Law, the Company shall, and shall cause each of its Subsidiaries to, conduct its business in the ordinary course of business consistent in all material respects with past practice and use reasonable best efforts to preserve intact its business organization, preserve its assets, rights and properties in good repair and condition, keep available the services of its current officers, employees and consultants and preserve its goodwill and its relationships with customers, suppliers, licensors, licensees, distributors and others having business dealings with it. In addition to and without limiting the generality of the foregoing, during the period from the date of this Agreement to the earlier of the Effective Time or the date this Agreement is terminated in accordance with Article VII, except as set forth in Section 5.1(a) of the Company Disclosure Letter or as specifically required or permitted by this Agreement or required by applicable Law, the Company shall not, and shall not permit any of its Subsidiaries to, without Parent’s prior written consent (such consent not to be unreasonably withheld, conditioned or delayed):";
const TAX_XI = "settle or compromise any material liability for Taxes; file any material amended Tax Return or material claim for Tax refund; make, other than in the ordinary course of business, or revoke or modify any material Tax election; consent to any extension or waiver of the limitation period applicable to any claim or assessment in respect of a material amount of Taxes; or change any material method of accounting for Tax purposes;";
const LEAD_B = "Conduct of Business by Parent. During the period from the date of this Agreement to the Effective Time, except as set forth in Section 5.1(b) of the Parent Disclosure Letter or as specifically required by this Agreement or applicable Law, Parent shall not, and shall not permit any of its Subsidiaries to, without the Company’s prior written consent (such consent not to be unreasonably withheld, conditioned or delayed):";
const DIVIDENDS_I = "declare, set aside or pay any extraordinary dividends or distributions in respect of, any of its capital stock; provided that Parent may make (A) regular quarterly cash dividends in amounts and with record and payment dates consistent in all respects with Parent’s past dividend policy and practices and (B) increases to such regular quarterly cash dividend amounts in the ordinary course of business;";
const ARTICLES_II = "other than pursuant to Rewind, amend or otherwise change, or authorize or propose to amend or otherwise change, its memorandum and articles of association in a manner that would reasonably be expected to materially adversely affect the consummation of the Transactions or adversely affect in any material respect the rights of holders of the Parent Ordinary Shares;";

function canonical() {
  return [HEADING, `(a) ${LEAD_A}`, `(xi) ${TAX_XI}`, `(b) ${LEAD_B}`, `(i) ${DIVIDENDS_I}`, `(ii) ${ARTICLES_II}`].join('\n') + '\n';
}

module.exports = { HEADING, LEAD_A, TAX_XI, LEAD_B, DIVIDENDS_I, ARTICLES_II, canonical };

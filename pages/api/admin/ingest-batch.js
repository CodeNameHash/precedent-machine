import Anthropic from '@anthropic-ai/sdk';
import { getServiceSupabase } from '../../../lib/supabase';
import { cleanEdgarText, removeRepeatedHeaders, cleanSectionText } from '../../../lib/edgar-cleanup';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export const config = {
  maxDuration: 300,
  api: { bodyParser: { sizeLimit: '1mb' } },
};

// ═══════════════════════════════════════════════════
// Deal configs — hardcoded for the 6 precedent agreements
// ═══════════════════════════════════════════════════
const DEAL_CONFIGS = [
  { file: 'a.html', acquirer: 'Pfizer', target: 'Seagen', value: 43000, sector: 'Biopharma', date: '2023-03-12', jurisdiction: 'Delaware' },
  { file: 'b.html', acquirer: 'LVMH', target: 'Tiffany', value: 16200, sector: 'Luxury', date: '2019-11-24', jurisdiction: 'Delaware' },
  { file: 'c.html', acquirer: 'Pfizer', target: 'Metsera', value: null, sector: 'Biopharma', date: '2025-01-07', jurisdiction: 'Delaware' },
  { file: 'd.htm', acquirer: 'Diamondback Energy', target: 'Endeavor Energy Resources', value: 26000, sector: 'Energy', date: '2024-02-11', jurisdiction: 'Delaware' },
  { file: 'f.html', acquirer: 'Goodyear Tire & Rubber', target: 'Cooper Tire & Rubber', value: 2500, sector: 'Auto', date: '2021-02-22', jurisdiction: 'Delaware' },
  { file: 'g.html', acquirer: 'H.J. Heinz Holding', target: 'Kraft Foods Group', value: 46000, sector: 'Food', date: '2015-03-25', jurisdiction: 'Delaware/Pennsylvania' },
];

// ═══════════════════════════════════════════════════
// Rubric codes by type — used for AI classification
// ═══════════════════════════════════════════════════
const RUBRIC_CODES = {
  MAE: [
    { code: 'DEF-MAE', label: 'Material Adverse Effect', desc: 'Core MAE definition' },
    { code: 'DEF-MAE-CARVEOUT', label: 'MAE Carve-Outs', desc: 'Enumerated exceptions (market conditions, industry changes, etc.)' },
    { code: 'DEF-MAE-DISPROP', label: 'MAE Disproportionate Impact', desc: '"Except to the extent disproportionately affected" qualifier' },
  ],
  STRUCT: [
    { code: 'STRUCT-MERGER', label: 'The Merger' },
    { code: 'STRUCT-CLOSING', label: 'Closing' },
    { code: 'STRUCT-EFFTIME', label: 'Effective Time' },
    { code: 'STRUCT-EFFECTS', label: 'Effects of the Merger' },
    { code: 'STRUCT-CHARTER', label: 'Certificate of Incorporation / Bylaws' },
    { code: 'STRUCT-DIRECTORS', label: 'Directors and Officers' },
    { code: 'STRUCT-ACTIONS', label: 'Subsequent Actions' },
  ],
  CONSID: [
    { code: 'CONSID-CONVERT', label: 'Conversion of Shares / Effect on Capital Stock' },
    { code: 'CONSID-EXCHANGE', label: 'Exchange of Certificates / Payment Mechanics' },
    { code: 'CONSID-EQUITY', label: 'Treatment of Equity Awards / Stock Plans' },
    { code: 'CONSID-DISSENT', label: 'Dissenting / Appraisal Rights' },
    { code: 'CONSID-WITHHOLD', label: 'Withholding Rights' },
    { code: 'CONSID-ADJUST', label: 'Anti-Dilution Adjustments' },
  ],
  'REP-T': [
    { code: 'REP-T-ORG', label: 'Organization; Qualification; Standing' },
    { code: 'REP-T-CAP', label: 'Capitalization; Subsidiaries' },
    { code: 'REP-T-AUTH', label: 'Authority; Enforceability' },
    { code: 'REP-T-NOCONFLICT', label: 'No Conflict; Required Filings and Consents' },
    { code: 'REP-T-SEC', label: 'SEC Documents; Financial Statements' },
    { code: 'REP-T-FINSTMT', label: 'Financial Statements; No Liabilities (non-SEC filers)' },
    { code: 'REP-T-NOCHANGE', label: 'Absence of Certain Changes or Events' },
    { code: 'REP-T-NOLIAB', label: 'No Undisclosed Liabilities' },
    { code: 'REP-T-LIT', label: 'Litigation; Legal Proceedings' },
    { code: 'REP-T-COMPLY', label: 'Compliance with Laws; Permits; Licenses' },
    { code: 'REP-T-BENEFITS', label: 'Employee Benefit Plans; ERISA' },
    { code: 'REP-T-LABOR', label: 'Labor Matters; Relations' },
    { code: 'REP-T-TAX', label: 'Taxes; Tax Returns' },
    { code: 'REP-T-CONTRACTS', label: 'Material Contracts' },
    { code: 'REP-T-IP', label: 'Intellectual Property' },
    { code: 'REP-T-PROPERTY', label: 'Real Property; Personal Property; Title' },
    { code: 'REP-T-ENV', label: 'Environmental Matters' },
    { code: 'REP-T-INSURANCE', label: 'Insurance' },
    { code: 'REP-T-BROKERS', label: 'Brokers; Finders' },
    { code: 'REP-T-ANTICORR', label: 'Anti-Corruption; Sanctions' },
    { code: 'REP-T-PRIVACY', label: 'Data Privacy; Information Security; Cybersecurity' },
    { code: 'REP-T-TAKEOVER', label: 'Takeover Statutes; Anti-Takeover' },
    { code: 'REP-T-FAIRNESS', label: 'Opinion of Financial Advisor' },
    { code: 'REP-T-RPT', label: 'Related Party / Affiliate / Interested-Party Transactions' },
    { code: 'REP-T-PROXY', label: 'Information Supplied / Proxy Statement' },
    { code: 'REP-T-NOREP', label: 'No Other Representations or Warranties' },
    { code: 'REP-T-PRODUCT', label: 'Product Liability; Product Recall; Quality & Safety' },
    { code: 'REP-T-SUPPLY', label: 'Suppliers' },
    { code: 'REP-T-FDA', label: 'FDA / Healthcare Regulatory' },
    { code: 'REP-T-CONTROLS', label: 'Internal Controls; Disclosure Controls' },
    { code: 'REP-T-SANCTIONS', label: 'Global Trade Control Laws; Sanctions' },
    { code: 'REP-T-OIL', label: 'Oil & Gas Leases; Rights-of-Way' },
    { code: 'REP-T-WELLS', label: 'Wells and Equipment' },
    { code: 'REP-T-RESERVE', label: 'Reserve Reports' },
    { code: 'REP-T-REGSTATUS', label: 'Regulatory Status' },
    { code: 'REP-T-CONSENT', label: 'Consents and Approvals' },
  ],
  'REP-B': [
    { code: 'REP-B-ORG', label: 'Organization; Qualification; Standing' },
    { code: 'REP-B-AUTH', label: 'Authority; Enforceability' },
    { code: 'REP-B-NOCONFLICT', label: 'No Conflict; Required Filings and Consents' },
    { code: 'REP-B-LIT', label: 'Litigation; Legal Proceedings' },
    { code: 'REP-B-BROKERS', label: 'Brokers; Finders' },
    { code: 'REP-B-FUNDS', label: 'Sufficient / Available Funds; Financing' },
    { code: 'REP-B-MERGESUB', label: 'Merger Sub; No Prior Activities' },
    { code: 'REP-B-PROXY', label: 'Information Supplied / Proxy Statement' },
    { code: 'REP-B-VOTE', label: 'Vote / Approval Required' },
    { code: 'REP-B-NOINTEREST', label: 'No Interested Stockholder; Ownership of Stock' },
    { code: 'REP-B-NOREP', label: 'No Other Representations or Warranties' },
    { code: 'REP-B-CAP', label: 'Capitalization (public buyer)' },
    { code: 'REP-B-SEC', label: 'SEC Documents; Financial Statements (public buyer)' },
    { code: 'REP-B-NOCHANGE', label: 'Absence of Certain Changes (public buyer)' },
    { code: 'REP-B-NOLIAB', label: 'No Undisclosed Liabilities (public buyer)' },
    { code: 'REP-B-TAX', label: 'Taxes (public buyer)' },
    { code: 'REP-B-COMPLY', label: 'Compliance with Laws (public buyer)' },
    { code: 'REP-B-BENEFITS', label: 'Employee Benefit Plans (public buyer)' },
    { code: 'REP-B-ENV', label: 'Environmental (public buyer)' },
    { code: 'REP-B-IP', label: 'Intellectual Property (public buyer)' },
    { code: 'REP-B-CONTRACTS', label: 'Material Contracts (public buyer)' },
    { code: 'REP-B-SOLVENCY', label: 'Solvency' },
    { code: 'REP-B-LABOR', label: 'Labor Matters (public buyer)' },
    { code: 'REP-B-EQUITY', label: 'Equity Investment' },
    { code: 'REP-B-FAIRNESS', label: 'Opinion of Financial Advisor (buyer)' },
    { code: 'REP-B-NORIGHTS', label: 'No Rights Plan' },
  ],
  IOC: [
    { code: 'IOC-ORDINARY', label: 'Ordinary Course Obligation' },
    { code: 'IOC-CHARTER', label: 'Charter / Bylaws Amendments' },
    { code: 'IOC-MERGE', label: 'Mergers, Acquisitions, Dispositions' },
    { code: 'IOC-ISSUE', label: 'Issuance of Securities' },
    { code: 'IOC-REPURCHASE', label: 'Share Repurchases' },
    { code: 'IOC-DIVIDEND', label: 'Dividends and Distributions' },
    { code: 'IOC-SPLIT', label: 'Stock Splits / Reclassifications' },
    { code: 'IOC-DEBT', label: 'Indebtedness' },
    { code: 'IOC-LIEN', label: 'Liens and Encumbrances' },
    { code: 'IOC-CAPEX', label: 'Capital Expenditures' },
    { code: 'IOC-COMP', label: 'Compensation and Benefits' },
    { code: 'IOC-HIRE', label: 'Hiring and Termination' },
    { code: 'IOC-SETTLE', label: 'Settlement of Claims' },
    { code: 'IOC-TAX', label: 'Tax Elections and Filings' },
    { code: 'IOC-ACCOUNTING', label: 'Accounting Changes' },
    { code: 'IOC-CONTRACT', label: 'Material Contracts' },
    { code: 'IOC-IP', label: 'Intellectual Property' },
    { code: 'IOC-INSURANCE', label: 'Insurance Policies' },
    { code: 'IOC-REALPROP', label: 'Real Property' },
    { code: 'IOC-WAIVE', label: 'Waiver of Rights' },
    { code: 'IOC-AFFILIATE', label: 'Affiliate Transactions' },
    { code: 'IOC-ENVIRO', label: 'Environmental' },
    { code: 'IOC-COMMIT', label: 'Commitments' },
  ],
  NOSOL: [
    { code: 'NOSOL-PROHIBIT', label: 'Solicitation Prohibition' },
    { code: 'NOSOL-CEASE', label: 'Cease Existing Discussions' },
    { code: 'NOSOL-EXCEPT', label: 'Exceptions / Fiduciary Out' },
    { code: 'NOSOL-SUPERIOR', label: 'Superior Proposal Definition' },
    { code: 'NOSOL-ACQPROPOSAL', label: 'Acquisition Proposal Definition' },
    { code: 'NOSOL-NOTICE', label: 'Notice to Counterparty' },
    { code: 'NOSOL-DISCLOSE', label: 'Disclosure of Terms' },
    { code: 'NOSOL-MATCH', label: 'Matching Rights' },
    { code: 'NOSOL-NEGOTIATE', label: 'Negotiation Period' },
    { code: 'NOSOL-REMATCH', label: 'Subsequent Matching / Amendment Rights' },
    { code: 'NOSOL-RECOMMEND', label: 'Change of Recommendation' },
    { code: 'NOSOL-INTERVENING', label: 'Intervening Event' },
    { code: 'NOSOL-WINDOW', label: 'Go-Shop / Window Shop' },
    { code: 'NOSOL-ENFORCE', label: 'Enforcement of Standstills' },
    { code: 'NOSOL-WAIVER', label: 'Standstill Waiver / Don\'t-Ask-Don\'t-Waive' },
    { code: 'NOSOL-INFORMATION', label: 'Provision of Information to Bidder' },
    { code: 'NOSOL-CONFID', label: 'Confidentiality Agreement Requirement' },
  ],
  ANTI: [
    { code: 'ANTI-FILING', label: 'HSR / Regulatory Filings' },
    { code: 'ANTI-EFFORTS', label: 'Standard of Efforts' },
    { code: 'ANTI-COOPERATE', label: 'Cooperation' },
    { code: 'ANTI-INFO', label: 'Information to Regulators' },
    { code: 'ANTI-BURDEN', label: 'Burden Cap / Divestiture Limits' },
    { code: 'ANTI-NOACTION', label: 'No Inconsistent Action' },
    { code: 'ANTI-FOREIGN', label: 'Foreign Regulatory Approvals' },
    { code: 'ANTI-INTERIM', label: 'Interim Compliance' },
    { code: 'ANTI-NOTIFY', label: 'Notification of Developments' },
    { code: 'ANTI-LITIGATION', label: 'Litigation Against Regulators' },
    { code: 'ANTI-CONSULT', label: 'Consultation Rights' },
    { code: 'ANTI-TIMING', label: 'Timing Agreements' },
  ],
  'COND-M': [
    { code: 'COND-M-LEGAL', label: 'No Legal Impediment' },
    { code: 'COND-M-REG', label: 'Regulatory Approvals' },
    { code: 'COND-M-STOCKHOLDER', label: 'Stockholder Approval' },
    { code: 'COND-M-S4', label: 'Form S-4 Effectiveness' },
    { code: 'COND-M-LISTING', label: 'Stock Exchange Listing' },
  ],
  'COND-B': [
    { code: 'COND-B-REP', label: 'Accuracy of Target Reps' },
    { code: 'COND-B-COV', label: 'Target Covenant Compliance' },
    { code: 'COND-B-MAE', label: 'No Target MAE' },
    { code: 'COND-B-CERT', label: "Officer's Certificate (Target)" },
    { code: 'COND-B-DISSENT', label: 'Dissenting Shares Threshold' },
  ],
  'COND-S': [
    { code: 'COND-S-REP', label: 'Accuracy of Buyer Reps' },
    { code: 'COND-S-COV', label: 'Buyer Covenant Compliance' },
    { code: 'COND-S-CERT', label: "Officer's Certificate (Buyer)" },
    { code: 'COND-S-FUNDS', label: 'Availability of Funds' },
  ],
  TERMR: [
    { code: 'TERMR-MUTUAL', label: 'Mutual Termination' },
    { code: 'TERMR-OUTSIDE', label: 'Outside Date' },
    { code: 'TERMR-EXTENSION', label: 'Outside Date Extension' },
    { code: 'TERMR-LEGAL', label: 'Legal Impediment' },
    { code: 'TERMR-VOTE', label: 'Stockholder Vote Failure' },
    { code: 'TERMR-BREACH-T', label: 'Target Breach' },
    { code: 'TERMR-BREACH-B', label: 'Buyer Breach' },
    { code: 'TERMR-SUPERIOR', label: 'Superior Proposal' },
    { code: 'TERMR-RECOMMEND', label: 'Change of Recommendation' },
  ],
  TERMF: [
    { code: 'TERMF-TARGET', label: 'Company Termination Fee' },
    { code: 'TERMF-REVERSE', label: 'Reverse Termination Fee' },
    { code: 'TERMF-EXPENSE', label: 'Expense Reimbursement' },
    { code: 'TERMF-TAIL', label: 'Tail Provision' },
    { code: 'TERMF-EFFECT', label: 'Effect of Termination' },
    { code: 'TERMF-SOLE', label: 'Sole and Exclusive Remedy' },
  ],
  COV: [
    { code: 'COV-ACCESS', label: 'Access to Information; Confidentiality' },
    { code: 'COV-PROXY', label: 'Proxy Statement Preparation' },
    { code: 'COV-MEETING', label: 'Stockholders Meeting' },
    { code: 'COV-PUBLICITY', label: 'Public Announcements; Disclosure' },
    { code: 'COV-INDEMN', label: 'Indemnification; D&O Insurance' },
    { code: 'COV-EMPLOYEE', label: 'Employee Matters; Benefits' },
    { code: 'COV-TAKEOVER', label: 'Takeover Laws' },
    { code: 'COV-NOTIFY', label: 'Notification of Certain Matters' },
    { code: 'COV-LITNOTIFY', label: 'Stockholder / Transaction Litigation' },
    { code: 'COV-16B', label: 'Rule 16b-3 / Section 16 Matters' },
    { code: 'COV-RESIGN', label: 'Director Resignations' },
    { code: 'COV-FINANCING', label: 'Financing; Financing Cooperation' },
    { code: 'COV-DELIST', label: 'Stock Exchange Delisting; Deregistration' },
    { code: 'COV-LIST', label: 'Stock Exchange Listing' },
    { code: 'COV-FURTHER', label: 'Further Assurances' },
    { code: 'COV-SECREPORT', label: 'Post-Closing SEC Reports' },
    { code: 'COV-TAXMATTERS', label: 'Tax Matters' },
    { code: 'COV-DEBT', label: 'Treatment of Existing Indebtedness / Notes' },
    { code: 'COV-MERGESUB', label: 'Merger Sub Compliance' },
    { code: 'COV-DIVIDEND', label: 'Coordination of Dividends' },
    { code: 'COV-CONSENT', label: 'Delivery of Written Consents' },
    { code: 'COV-PAYOFF', label: 'Payoff Letters' },
    { code: 'COV-CVR', label: 'CVR Agreement' },
  ],
  DEF: [
    { code: 'DEF-MAE', label: 'Material Adverse Effect' },
    { code: 'DEF-MAE-CARVEOUT', label: 'MAE Carve-Outs' },
    { code: 'DEF-MAE-DISPROP', label: 'MAE Disproportionate Impact' },
    { code: 'DEF-SUPERIOR', label: 'Superior Proposal' },
    { code: 'DEF-ACQPROPOSAL', label: 'Acquisition Proposal' },
    { code: 'DEF-INTERVENING', label: 'Intervening Event' },
    { code: 'DEF-KNOWLEDGE', label: 'Knowledge' },
    { code: 'DEF-ORDINARY', label: 'Ordinary Course of Business' },
    { code: 'DEF-BURDENSOME', label: 'Burdensome Condition' },
    { code: 'DEF-WILLFUL', label: 'Willful Breach' },
    { code: 'DEF-SUBSIDIARY', label: 'Subsidiary' },
    { code: 'DEF-AFFILIATE', label: 'Affiliate' },
    { code: 'DEF-PERSON', label: 'Person' },
    { code: 'DEF-REPRESENTATIVE', label: 'Representatives' },
    { code: 'DEF-COMPANY', label: 'Company / Target' },
    { code: 'DEF-LIEN', label: 'Lien' },
    { code: 'DEF-PERMITLIEN', label: 'Permitted Liens' },
    { code: 'DEF-CONTRACT', label: 'Contract' },
    { code: 'DEF-MATCONTRACT', label: 'Material Contract' },
    { code: 'DEF-INDEBTEDNESS', label: 'Indebtedness' },
    { code: 'DEF-BUSINESSDAY', label: 'Business Day' },
    { code: 'DEF-MERGERCONSID', label: 'Merger Consideration' },
    { code: 'DEF-EQUITYAWARD', label: 'Company Equity Awards' },
    { code: 'DEF-DISSENTING', label: 'Dissenting Shares' },
    { code: 'DEF-GOVAUTH', label: 'Governmental Authority' },
    { code: 'DEF-LAW', label: 'Law' },
    { code: 'DEF-PERMIT', label: 'Permit' },
    { code: 'DEF-REQUIREDAPPROVAL', label: 'Required Approvals' },
    { code: 'DEF-BENEFITPLAN', label: 'Company Benefit Plan' },
    { code: 'DEF-COMPANYEMPLOYEE', label: 'Company Employees' },
    { code: 'DEF-TAX', label: 'Tax / Taxes' },
    { code: 'DEF-TAXRETURN', label: 'Tax Return' },
    { code: 'DEF-GENERAL', label: 'General Definitions Section' },
    { code: 'DEF-INTERP', label: 'Interpretation / Construction' },
    { code: 'DEF-MADE-AVAILABLE', label: 'Made Available' },
    { code: 'DEF-DISCLOSURELETTER', label: 'Company Disclosure Letter' },
  ],
  MISC: [
    { code: 'MISC-SURVIVAL', label: 'No Survival / Nonsurvival' },
    { code: 'MISC-NOTICES', label: 'Notices' },
    { code: 'MISC-ENTIRE', label: 'Entire Agreement' },
    { code: 'MISC-GOVLAW', label: 'Governing Law' },
    { code: 'MISC-JURISD', label: 'Jurisdiction; Venue' },
    { code: 'MISC-JURY', label: 'Waiver of Jury Trial' },
    { code: 'MISC-ASSIGN', label: 'Assignment; Successors' },
    { code: 'MISC-SEVER', label: 'Severability' },
    { code: 'MISC-COUNTER', label: 'Counterparts' },
    { code: 'MISC-SPECIFIC', label: 'Specific Performance; Enforcement' },
    { code: 'MISC-THIRDPARTY', label: 'Third-Party Beneficiaries' },
    { code: 'MISC-AMEND', label: 'Amendment; Modification' },
    { code: 'MISC-WAIVER', label: 'Waiver; Extension' },
    { code: 'MISC-EXPENSES', label: 'Expenses' },
    { code: 'MISC-CONSTRUCT', label: 'Rules of Construction; Interpretation' },
  ],
};

// Display tier assignments
const TIER_MAP = {
  'MAE-T': 1, 'MAE-B': 1, NOSOL: 1, ANTI: 1, 'COND-M': 1, 'COND-B': 1, 'COND-S': 1, TERMR: 1, TERMF: 1,
  STRUCT: 2, CONSID: 2, 'REP-T': 2, 'REP-B': 2, IOC: 2, COV: 2,
  DEF: 3, MISC: 3,
};

// ═══════════════════════════════════════════════════
// HTML → plain text (deterministic, no AI)
// ═══════════════════════════════════════════════════
function stripHtml(html) {
  return html
    // Remove style and script blocks
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    // EDGAR document header tags
    .replace(/<\/?(?:document|type|sequence|filename|description|text)>/gi, '\n')
    // Block-level tags → newlines
    .replace(/<\/(?:p|div|tr|li|h[1-6]|br|blockquote|center)>/gi, '\n')
    .replace(/<(?:p|div|tr|li|h[1-6]|br|blockquote|center)\b[^>]*>/gi, '\n')
    // Table cells → tab
    .replace(/<\/td>/gi, '\t')
    .replace(/<td\b[^>]*>/gi, '')
    // Strip all remaining tags
    .replace(/<[^>]+>/g, '')
    // Decode entities
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&nbsp;/gi, ' ');
}

// ═══════════════════════════════════════════════════
// Structural parsing — reuse patterns from segment.js
// ═══════════════════════════════════════════════════
const XREF_SIGNALS = /(?:in|under|of|to|by|on|at|from|with|for|this|that|such|each|any|said|the|pursuant\s+to|set\s+forth\s+in|described\s+in|defined\s+in|referenced\s+in|subject\s+to|accordance\s+with|provided\s+in|specified\s+in|required\s+by|referred\s+to\s+in|contemplated\s+by|governed\s+by|listed\s+on|added\s+to|purposes\s+of|see|per|except\s+as\s+(?:set\s+forth|provided|described)\s+in)\s*$/i;

function findBodyStart(fullText) {
  // Prefer preamble end marker — most reliable across all agreement formats
  var preambleEnd = fullText.match(/(?:agree\s+as\s+follows|hereby\s+agree\s*(?:s\s*)?as\s+follows)\s*:?\s*\n/i);
  if (preambleEnd) return preambleEnd.index + preambleEnd[0].length;

  // TOC-based detection: find first real section after TOC (only trust TOC in first 30%)
  var tocMatch = fullText.match(/TABLE\s+OF\s+CONTENTS/i);
  if (tocMatch && tocMatch.index < fullText.length * 0.3) {
    var afterToc = fullText.substring(tocMatch.index);
    var secPattern = /(?:SECTION|Section)\s+\d+\.\d{1,2}\b/g;
    var sm;
    while ((sm = secPattern.exec(afterToc)) !== null) {
      var restOfLine = afterToc.substring(sm.index).match(/[^\n]+/);
      if (!restOfLine) continue;
      var afterNum = restOfLine[0].replace(/^(?:SECTION|Section)\s+\d+\.\d{1,2}\b\s*\.?\s*/, '');
      if (afterNum.length > 30) {
        var before = afterToc.substring(0, sm.index);
        var artPattern = /\n\s*ARTICLE\s+(?:[IVXLC]+|\d+)\b/gi;
        var lastArtIdx = -1;
        var am;
        while ((am = artPattern.exec(before)) !== null) lastArtIdx = am.index;
        if (lastArtIdx >= 0) return tocMatch.index + lastArtIdx + 1;
        return tocMatch.index + sm.index;
      }
    }
  }

  // Look for first standalone ARTICLE heading (not a cross-reference)
  var artRx = /\n\s*(ARTICLE\s+(?:[IVXLC]+|\d+))\s*[\n\r]/gi;
  var artMatch = artRx.exec(fullText);
  if (artMatch) return artMatch.index + 1;

  // Fallback: first ARTICLE reference (even if inline)
  var firstArt = fullText.match(/\n\s*ARTICLE\s+(?:[IVXLC]+|\d+)\b/i);
  if (firstArt) return firstArt.index + 1;

  return 0;
}

function isHeading(text, matchIndex) {
  var immediateBefore = text.substring(Math.max(0, matchIndex - 40), matchIndex);
  // Reject cross-references like "pursuant to Section 3.01"
  if (XREF_SIGNALS.test(immediateBefore)) return false;
  var lookback = text.substring(Math.max(0, matchIndex - 80), matchIndex);
  var lastNL = lookback.lastIndexOf('\n');
  if (lastNL !== -1) {
    var gap = lookback.substring(lastNL + 1);
    if (gap.trim().length <= 10) return true;
  } else if (matchIndex <= 80) {
    return true;
  }
  return false;
}

function findSignatureCutoff(text) {
  // Find "IN WITNESS WHEREOF" — marks end of agreement body, before exhibits/annexes
  var sigMatch = text.match(/IN\s+WITNESS\s+WHEREOF/i);
  if (sigMatch) return sigMatch.index;
  // Fallback: look for signature page bracket notation
  var bracketSig = text.match(/\[Signature\s+Page/i);
  if (bracketSig) return bracketSig.index;
  return text.length;
}

function parseStructure(fullText) {
  var bodyStart = findBodyStart(fullText);
  var sigCutoff = findSignatureCutoff(fullText);
  // Truncate text between body start and signature page (exclude exhibits/annexes)
  var body = fullText.substring(bodyStart, sigCutoff);
  var sectionPattern = /(?:SECTION|Section)\s+(\d+\.\d{1,2})\b/g;
  var allMatches = [];
  var m;
  while ((m = sectionPattern.exec(body)) !== null) {
    allMatches.push({ index: m.index, absIndex: bodyStart + m.index, number: m[1], fullMatch: m[0] });
  }
  // Also detect bare numbered headings like "1.1 The Merger." (used by some agreements)
  var barePattern = /(?:^|\n)\s*(\d+\.\d{1,2})\s+[A-Z]/gm;
  while ((m = barePattern.exec(body)) !== null) {
    var num = m[1];
    var pos = m.index + (m[0].startsWith('\n') ? 1 : 0);
    if (!allMatches.some(a => a.number === num && Math.abs(a.index - pos) < 50)) {
      allMatches.push({ index: pos, absIndex: bodyStart + pos, number: num, fullMatch: m[0].trim() });
    }
  }
  allMatches.sort((a, b) => a.index - b.index);
  var headings = allMatches.filter(match => isHeading(body, match.index));
  var sections = [];
  for (var i = 0; i < headings.length; i++) {
    var start = headings[i].index;
    var end = i + 1 < headings.length ? headings[i + 1].index : body.length;
    var rawText = body.substring(start, end).trim();
    var text = cleanSectionText(rawText);
    var headingLine = text.split('\n')[0].substring(0, 200).trim();
    if (text.length < 20) continue;
    // Filter out cross-reference fragments posing as section headings
    var afterNum = headingLine.replace(/^(?:SECTION|Section)\s+\d+\.\d{1,2}\s*/, '').replace(/^\d+\.\d{1,2}\s*/, '');
    afterNum = afterNum.replace(/^\([a-z]+\)\s*(\([ivx]+\)\s*)?/, '').trim();
    if (/^[,;]/.test(afterNum) || (afterNum.length > 0 && afterNum.length < 3 && !/[A-Z]/.test(afterNum))) continue;
    sections.push({ heading: headingLine, text, level: 'section', startChar: bodyStart + start, endChar: bodyStart + end, number: headings[i].number });
  }
  // Find ARTICLE boundaries — includes "ARTICLE I" and "SECTION 1 - TITLE" formats
  var articleRegex = /(?:ARTICLE\s+(?:[IVXLC]+|\d+)|SECTION\s+\d+\s*[-–—]\s*[A-Z])[^\n]*/gi;
  var articles = [];
  var artMatch;
  while ((artMatch = articleRegex.exec(body)) !== null) {
    if (!isHeading(body, artMatch.index)) continue;
    // Reject cross-references like "Article IV, and following..." — real headings don't start with comma/lowercase after number
    var afterNumber = artMatch[0].replace(/^(?:ARTICLE|Article)\s+(?:[IVXLC]+|\d+)\s*/i, '').replace(/^SECTION\s+\d+\s*[-–—]\s*/i, '');
    if (/^[,;]/.test(afterNumber)) continue;
    articles.push({ heading: artMatch[0].trim(), startChar: bodyStart + artMatch.index });
  }
  for (var ai = 0; ai < articles.length; ai++) {
    var artStart = articles[ai].startChar;
    var artEnd = ai + 1 < articles.length ? articles[ai + 1].startChar : fullText.length;
    var hasSections = sections.some(s => s.startChar >= artStart && s.startChar < artEnd);
    if (!hasSections) {
      var artText = fullText.substring(artStart, artEnd).trim();
      if (artText.length >= 20) {
        sections.push({ heading: articles[ai].heading, text: artText, level: 'article', startChar: artStart, endChar: artEnd });
      }
    }
  }
  if (sections.length < 3) {
    sections.length = 0;
    var chunks = body.split(/\n\s*\n/);
    var offset = bodyStart;
    for (var ch of chunks) {
      var trimmed = ch.trim();
      if (trimmed.length >= 50) {
        sections.push({ heading: trimmed.substring(0, 80).replace(/\n/g, ' '), text: trimmed, level: 'section', startChar: offset, endChar: offset + ch.length });
      }
      offset += ch.length + 2;
    }
  }
  sections.sort((a, b) => a.startChar - b.startChar);

  // Attach article context to each section
  if (articles.length > 0) {
    for (var si = 0; si < sections.length; si++) {
      for (var aj = articles.length - 1; aj >= 0; aj--) {
        if (sections[si].startChar >= articles[aj].startChar) {
          sections[si]._articleHeading = articles[aj].heading;
          break;
        }
      }
    }
  } else {
    // No standalone ARTICLE headings found — infer from TOC and section numbers
    // Parse TOC: non-SECTION lines before the body are article titles
    var tocText = fullText.substring(0, bodyStart);
    var tocArticles = {};
    var tocLines = tocText.split('\n');
    var lastNonSection = '';
    for (var tl of tocLines) {
      var trimLine = tl.trim();
      if (!trimLine) continue;
      var secNum = trimLine.match(/^SECTION\s+(\d+)\.\d{1,2}\b/i);
      if (secNum) {
        var artNum = secNum[1];
        if (!tocArticles[artNum] && lastNonSection) {
          tocArticles[artNum] = lastNonSection;
        }
      } else if (trimLine.length > 3 && trimLine.length < 80 && !/^\d+$/.test(trimLine) && !/^Page/.test(trimLine)) {
        lastNonSection = trimLine;
      }
    }
    // Attach inferred article heading to sections based on number prefix
    for (var si = 0; si < sections.length; si++) {
      var numMatch = sections[si].heading.match(/(?:SECTION|Section)\s+(\d+)\.\d/i);
      if (numMatch && tocArticles[numMatch[1]]) {
        sections[si]._articleHeading = tocArticles[numMatch[1]];
      }
    }
    console.log('[batch]   Inferred article titles from TOC:', JSON.stringify(tocArticles));
  }

  return { sections, articles, bodyStart };
}

// ═══════════════════════════════════════════════════
// Section title extraction + type classification
// ═══════════════════════════════════════════════════
function extractTitle(heading) {
  return heading
    .replace(/^(?:SECTION|Section)\s+\d+\.\d{1,2}\b\s*/, '')
    .replace(/^\d+\.\d{1,2}\s+/, '')
    .replace(/^[.\-—:;\s]+/, '')
    .replace(/\.\s+[A-Z(][\s\S]*$/, '')  // truncate at first sentence boundary or sub-clause
    .replace(/\.\s*$/, '')
    .trim();
}

// Article-level heading → type mapping for REP-T/REP-B and COND-M/B/S
function resolveArticleType(articleHeading, sectionTitle) {
  if (!articleHeading) return null;
  var ah = articleHeading.toUpperCase();

  // Representations
  if (/REPRESENTATIONS?\s+.*(?:WARRANT|OF)/i.test(articleHeading)) {
    if (/\b(?:COMPANY|TARGET|SELLER)\b/i.test(ah)) return 'REP-T';
    if (/\b(?:PARENT|BUYER|ACQUIR|PURCHASER|MERGER\s+SUB)\b/i.test(ah)) return 'REP-B';
    // Fallback: check section title for context
    if (/\b(?:parent|buyer|acquir|purchaser)\b/i.test(sectionTitle)) return 'REP-B';
    return 'REP-T'; // default to target reps
  }

  // Conditions
  if (/CONDITIONS?\s+(?:TO|OF|PRECEDENT)/i.test(ah)) {
    if (/\bEACH\s+PARTY\b|\bMUTUAL\b|\bBOTH\b/i.test(ah)) return 'COND-M';
    if (/\b(?:PARENT|BUYER|ACQUIR|PURCHASER)\b/i.test(ah)) return 'COND-B';
    if (/\b(?:COMPANY|TARGET|SELLER)\b/i.test(ah)) return 'COND-S';
    // Check section-level text
    if (/obligation.*(?:parent|buyer|acquir)/i.test(sectionTitle)) return 'COND-B';
    if (/obligation.*(?:company|target|seller)/i.test(sectionTitle)) return 'COND-S';
    return 'COND-M'; // default mutual
  }

  // No-solicitation
  if (/NO[\s-]*(?:SOLICITATION|SHOP)/i.test(ah)) return 'NOSOL';

  return null;
}

// Keyword-based type mapping (section title level)
var TITLE_TYPE_MAP = [
  { pattern: /absence\s+of\s+(?:certain\s+)?changes/i, type: 'REP-T', tier: 2 },
  { pattern: /material\s+adverse\s+effect|MAE/i, type: 'MAE', tier: 1 },
  { pattern: /interim\s+operat|conduct\s+of\s+(?:the\s+)?business|conduct\s+prior/i, type: 'IOC', tier: 2 },
  { pattern: /antitrust|regulatory\s+(?:efforts|approval|matters)|HSR|hell\s+or\s+high/i, type: 'ANTI', tier: 1 },
  { pattern: /no[\s-]*(?:solicitation|shop)|(?:non|no)[\s-]*solicit/i, type: 'NOSOL', tier: 1 },
  { pattern: /termination\s+(?:rights|of\s+agreement|by)|right\s+to\s+terminat/i, type: 'TERMR', tier: 1 },
  { pattern: /termination\s+fee|break[\s-]*up\s+fee|reverse.*fee/i, type: 'TERMF', tier: 1 },
  { pattern: /effect\s+of\s+termination/i, type: 'TERMF', tier: 1 },
  { pattern: /definition|defined\s+term|terms\s+defined|interpretation/i, type: 'DEF', tier: 3 },
  { pattern: /conversion\s+of\s+shares|effect\s+on\s+capital\s+stock|merger\s+consideration|exchange\s+(?:ratio|procedures|of\s+certificates)|payment\s+(?:mechanics|procedures)/i, type: 'CONSID', tier: 2 },
  { pattern: /equity\s+awards?|stock\s+options?|RSU|stock\s+plans?/i, type: 'CONSID', tier: 2 },
  { pattern: /dissenting|appraisal\s+rights/i, type: 'CONSID', tier: 2 },
  { pattern: /withholding/i, type: 'CONSID', tier: 2 },
  { pattern: /merger\s+sub|closing\s+(?:mechanics|date)/i, type: 'STRUCT', tier: 2 },
  { pattern: /(?:the\s+)?merger\b/i, type: 'STRUCT', tier: 2 },
  { pattern: /effective\s+time/i, type: 'STRUCT', tier: 2 },
  { pattern: /represent\w*\s+and\s+warrant|representations/i, type: 'REP-T', tier: 2 },
  { pattern: /(?:^|\b)covenants?\b/i, type: 'COV', tier: 2 },
  { pattern: /financing\s+(?:cooperation|efforts)/i, type: 'COV', tier: 2 },
  { pattern: /(?:reasonable\s+)?best\s+efforts/i, type: 'ANTI', tier: 1 },
  { pattern: /indemnif/i, type: 'COV', tier: 2 },
  { pattern: /employee\s+(?:matters|benefits)/i, type: 'COV', tier: 2 },
  { pattern: /information\s+(?:access|rights)|access\s+to\s+information/i, type: 'COV', tier: 2 },
  { pattern: /notices?\b/i, type: 'MISC', tier: 3 },
  { pattern: /governing\s+law/i, type: 'MISC', tier: 3 },
  { pattern: /severab|entire\s+agreement|amendment|waiver|counterpart|jurisdict/i, type: 'MISC', tier: 3 },
  { pattern: /specific\s+performance/i, type: 'MISC', tier: 3 },
  { pattern: /third[\s-]*party\s+beneficiar/i, type: 'MISC', tier: 3 },
  { pattern: /public\s+announcement|press\s+release/i, type: 'COV', tier: 2 },
  { pattern: /proxy\s+statement/i, type: 'COV', tier: 2 },
  { pattern: /stockholder.*(?:vote|approv)|(?:vote|approv).*stockholder/i, type: 'COND-M', tier: 1 },
  { pattern: /stockholder.*meeting/i, type: 'COV', tier: 2 },
];

function preClassifySection(section) {
  var title = extractTitle(section.heading);
  section.extractedTitle = title;

  // Try article-level resolution first (REP-T/B, COND-M/B/S)
  var articleType = resolveArticleType(section._articleHeading, title);
  if (articleType) {
    section.preType = articleType;
    section.preTier = TIER_MAP[articleType] || 2;
    return;
  }

  // Fall back to keyword matching
  for (var rule of TITLE_TYPE_MAP) {
    if (rule.pattern.test(title)) {
      section.preType = rule.type;
      section.preTier = rule.tier;
      return;
    }
  }
}

// ═══════════════════════════════════════════════════
// Regex-based splitting
// ═══════════════════════════════════════════════════
function splitDefinitions(sectionText) {
  var defPattern = /[\u201c"]([^\u201d"]+)[\u201d"][^\u201c"\n]{0,40}?\b(?:means?|shall\s+mean|has\s+the\s+meaning|shall\s+have\s+the\s+meaning)\b/g;
  var matches = [];
  var m;
  while ((m = defPattern.exec(sectionText)) !== null) {
    var before = sectionText.substring(Math.max(0, m.index - 200), m.index);
    var lastNL = before.lastIndexOf('\n');
    if (lastNL !== -1) {
      var sinceLine = before.substring(lastNL + 1);
      var nonWS = sinceLine.replace(/\s/g, '').length;
      if (nonWS > 20) continue;
    } else if (m.index > 20) {
      var trimmedBefore = before.trimEnd();
      if (trimmedBefore.length > 0 && !/[.;:!?)\]]$/.test(trimmedBefore)) continue;
    }
    matches.push({ index: m.index, term: m[1].trim() });
  }
  if (matches.length === 0) return null;
  var provisions = [];
  for (var i = 0; i < matches.length; i++) {
    var start = matches[i].index;
    var end = i + 1 < matches.length ? matches[i + 1].index : sectionText.length;
    var text = sectionText.substring(start, end).trim();
    if (text.length < 20) continue;
    provisions.push({ category: matches[i].term, text });
  }
  return provisions.length > 0 ? provisions : null;
}

function splitBySubClauses(sectionText) {
  var clausePattern = /(?:^|\n)\s*\(([a-z])\)\s/g;
  var matches = [];
  var m;
  while ((m = clausePattern.exec(sectionText)) !== null) {
    var offset = sectionText[m.index] === '\n' ? 1 : 0;
    matches.push({ index: m.index + offset, letter: m[1] });
  }
  var inlinePattern = /\.\s+\(([a-z])\)\s/g;
  while ((m = inlinePattern.exec(sectionText)) !== null) {
    var pos = m.index + m[0].indexOf('(');
    if (matches.some(x => Math.abs(x.index - pos) < 5)) continue;
    matches.push({ index: pos, letter: m[1] });
  }
  matches.sort((a, b) => a.index - b.index);
  if (matches.length < 2) return null;

  var provisions = [];
  // Include preamble
  if (matches[0].index > 50) {
    var preamble = sectionText.substring(0, matches[0].index).trim();
    if (preamble.length > 30) {
      provisions.push({ category: null, text: preamble, isPreamble: true });
    }
  }
  for (var i = 0; i < matches.length; i++) {
    var start = matches[i].index;
    var end = i + 1 < matches.length ? matches[i + 1].index : sectionText.length;
    var text = sectionText.substring(start, end).trim();
    if (text.length < 20) continue;
    provisions.push({ category: null, text });
  }
  return provisions.length > 0 ? provisions : null;
}

// ═══════════════════════════════════════════════════
// MAE extraction — pull MAE definitions from DEF, split into core/carve-outs/disproportionate
// ═══════════════════════════════════════════════════
function splitMAEText(text) {
  // Find the carve-out boundary — where exceptions to the MAE definition begin
  // "that" is optional — some agreements use "provided, however, no event..." without "that"
  var carveoutPatterns = [
    /[;,]\s*provided,?\s*(?:however,?\s*)?(?:that\s+)?(?:none|any|no|in\s+the\s+case)\s/i,
    /,\s*excluding\s+any\s+(?:effect|change|event|development)/i,
    /[;,]\s*(?:shall\s+not|will\s+not)\s+(?:include|be\s+deemed)/i,
    /[;,]\s*provided,?\s*(?:however,?\s*)?that\b/i,
    /[;,]\s*provided,?\s*(?:however)?\s*,/i,
  ];

  var carveoutIdx = -1;
  for (var pat of carveoutPatterns) {
    var m = pat.exec(text);
    if (m) { carveoutIdx = m.index; break; }
  }

  if (carveoutIdx === -1) {
    return { core: text, carveouts: null, disproportionate: null };
  }

  var core = text.substring(0, carveoutIdx).trim();
  var afterCore = text.substring(carveoutIdx);

  // Look for disproportionate impact qualifier
  if (!/disproportionate/i.test(afterCore)) {
    return { core, carveouts: afterCore.trim(), disproportionate: null };
  }

  // Find "disproportionate" position, then look backwards for clause boundary
  var dispropIdx = afterCore.search(/\bdisproportionate\b/i);
  var dispropStart = -1;

  if (dispropIdx > 50) {
    var lookback = afterCore.substring(Math.max(0, dispropIdx - 600), dispropIdx);
    var lastExcept = Math.max(lookback.lastIndexOf('except'), lookback.lastIndexOf('Except'));
    // Find last "provided further" or "provided, however" (not the first carve-out "provided")
    var pfIdx = -1;
    var pfRx = /provided,?\s*(?:further|however|that)/gi;
    var pfm;
    while ((pfm = pfRx.exec(lookback)) !== null) pfIdx = pfm.index;
    var keywordPos = Math.max(lastExcept, pfIdx);
    if (keywordPos >= 0) {
      var beforeKeyword = lookback.substring(0, keywordPos);
      var pIdx = Math.max(beforeKeyword.lastIndexOf(';'), beforeKeyword.lastIndexOf(','));
      var splitPos = pIdx >= 0 ? pIdx : keywordPos;
      dispropStart = Math.max(0, dispropIdx - 600) + splitPos;
    }
  }

  if (dispropStart > 50) {
    return {
      core,
      carveouts: afterCore.substring(0, dispropStart).trim(),
      disproportionate: afterCore.substring(dispropStart).trim(),
    };
  }

  return { core, carveouts: afterCore.trim(), disproportionate: null };
}

function extractMAEFromDefs(defProvisions) {
  var maeProvisions = [];
  var remaining = [];
  var MAE_PATTERN = /Material\s+Adverse\s+(?:Effect|Change)/i;

  for (var p of defProvisions) {
    if (!MAE_PATTERN.test(p.category)) {
      remaining.push(p);
      continue;
    }

    // Determine target vs buyer — default generic MAE to Target
    var isBuyer = /\b(?:Parent|Buyer|Acquirer|Purchaser)\s+Material/i.test(p.category);
    var maeType = isBuyer ? 'MAE-B' : 'MAE-T';

    var split = splitMAEText(p.text);

    maeProvisions.push({ type: maeType, text: split.core, category: 'Material Adverse Effect' });
    if (split.carveouts) {
      maeProvisions.push({ type: maeType, text: split.carveouts, category: 'MAE Carve-Outs' });
    }
    if (split.disproportionate) {
      maeProvisions.push({ type: maeType, text: split.disproportionate, category: 'MAE Disproportionate Impact' });
    }
  }

  return { maeProvisions, remaining };
}

// ═══════════════════════════════════════════════════
// Category normalization — fuzzy match AI output to rubric labels
// ═══════════════════════════════════════════════════
function normalizeStr(s) {
  return s.replace(/[.\s;:,]+$/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function stripSectionPrefix(s) {
  // Remove "Section 6.6 " or "6.6 " prefixes and trailing periods
  return s.replace(/^(?:SECTION|Section)\s+\d+\.\d{1,2}\s*/i, '').replace(/^\d+\.\d{1,2}\s+/, '').replace(/\.\s*$/, '').trim();
}

function matchClosestLabel(aiOutput, codes) {
  // First try raw, then try with section prefix stripped
  var candidates = [aiOutput, stripSectionPrefix(aiOutput)];
  for (var candidate of candidates) {
    var normalized = normalizeStr(candidate);
    if (!normalized) continue;
    // Try exact match (case-insensitive, stripped periods)
    for (var c of codes) {
      if (normalizeStr(c.label) === normalized) return c.label;
      if (normalizeStr(c.code) === normalized) return c.label;
    }
    // Try substring match — if AI output contains a label or vice versa
    for (var c of codes) {
      var normLabel = normalizeStr(c.label);
      if (normalized.includes(normLabel) || normLabel.includes(normalized)) {
        if (normalized.length > 5 || normLabel.length < 30) return c.label;
      }
    }
  }
  // Try word overlap scoring (with stripped version)
  var stripped = normalizeStr(stripSectionPrefix(aiOutput));
  var bestScore = 0;
  var bestLabel = stripSectionPrefix(aiOutput) || aiOutput;
  var aiWords = stripped.split(/[\s;,/]+/).filter(w => w.length > 2);
  for (var c of codes) {
    var labelWords = normalizeStr(c.label).split(/[\s;,/]+/).filter(w => w.length > 2);
    var overlap = aiWords.filter(w => labelWords.some(lw => lw.includes(w) || w.includes(lw))).length;
    var score = overlap / Math.max(aiWords.length, labelWords.length, 1);
    if (score > bestScore && score >= 0.4) {
      bestScore = score;
      bestLabel = c.label;
    }
  }
  return bestLabel;
}

// ═══════════════════════════════════════════════════
// AI Classification — assign rubric code to provision
// ═══════════════════════════════════════════════════
async function classifyProvisions(provisions, type, client) {
  var codes = RUBRIC_CODES[type];
  if (!codes || codes.length === 0) return provisions;

  var isMultiCode = type === 'NOSOL' || type === 'ANTI';
  var codeList = codes.map(c => `${c.code}: ${c.label}${c.desc ? ' — ' + c.desc : ''}`).join('\n');

  // Batch into groups of 15
  var batchSize = 15;
  var batches = [];
  for (var i = 0; i < provisions.length; i += batchSize) {
    batches.push(provisions.slice(i, i + batchSize));
  }

  var allResults = [];
  for (var batch of batches) {
    var payload = batch.map((p, idx) => ({
      idx,
      text: p.text.length > 3000 ? p.text.substring(0, 1500) + '\n...\n' + p.text.substring(p.text.length - 1000) : p.text,
    }));

    try {
      var resp = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        messages: [{
          role: 'user',
          content: `You are a senior M&A attorney classifying merger agreement provisions against a rubric.

PROVISION TYPE: ${type}

RUBRIC CODES:
${codeList}

PROVISIONS TO CLASSIFY:
${JSON.stringify(payload)}

${isMultiCode ? `This is a MULTI-CODE category. Each provision may match MULTIPLE codes. Return ALL applicable codes for each provision.

Return ONLY valid JSON array (no markdown, no backticks):
[{ "idx": 0, "codes": ["NOSOL-PROHIBIT", "NOSOL-CEASE"] }]` :
`Each provision should match exactly ONE code. If no code matches well, use "UNKNOWN".

Return ONLY valid JSON array (no markdown, no backticks):
[{ "idx": 0, "code": "REP-T-ORG" }]`}

Rules:
- Every provision must appear in output
- Use exact code strings from the rubric
- For definitions, match the defined term to the closest DEF-* code
- If truly no match, use "UNKNOWN"`,
        }],
      });

      var raw = resp.content.map(c => c.text || '').join('');
      var clean = raw.replace(/```json|```/g, '').trim();
      try {
        var parsed = JSON.parse(clean);
        for (var cls of parsed) {
          var prov = batch[cls.idx];
          if (!prov) continue;
          if (isMultiCode && cls.codes && cls.codes.length > 0) {
            // Multi-code: create one row per code
            for (var code of cls.codes) {
              var codeEntry = codes.find(c => c.code === code) || codes.find(c => c.label === code);
              allResults.push({
                ...prov,
                category: codeEntry ? codeEntry.label : matchClosestLabel(code, codes),
                ai_metadata: { rubric_code: codeEntry ? codeEntry.code : code, multi_code: true },
              });
            }
          } else {
            var codeVal = cls.code || 'UNKNOWN';
            var entry = codes.find(c => c.code === codeVal) || codes.find(c => c.label === codeVal);
            if (entry) {
              allResults.push({ ...prov, category: entry.label, ai_metadata: { rubric_code: entry.code } });
            } else if (codeVal === 'UNKNOWN') {
              allResults.push({ ...prov, category: 'UNKNOWN: ' + (prov.category || extractTitle(prov.text.substring(0, 80))), ai_metadata: { rubric_code: 'UNKNOWN' } });
            } else {
              // AI returned something non-standard — try fuzzy match
              var matched = matchClosestLabel(codeVal, codes);
              allResults.push({ ...prov, category: matched, ai_metadata: { rubric_code: codeVal } });
            }
          }
        }
      } catch {
        // Parse failed — keep provisions with UNKNOWN
        batch.forEach(p => {
          allResults.push({ ...p, category: p.category || 'Unclassified', ai_metadata: { rubric_code: 'UNKNOWN' } });
        });
      }
    } catch (err) {
      batch.forEach(p => {
        allResults.push({ ...p, category: p.category || 'Unclassified', ai_metadata: { rubric_code: 'UNKNOWN', error: err.message } });
      });
    }
  }
  return allResults;
}

// ═══════════════════════════════════════════════════
// Dedup — 80% substring overlap, same type
// ═══════════════════════════════════════════════════
function dedup(provisions) {
  var isDuplicate = new Set();
  for (var i = 0; i < provisions.length; i++) {
    if (isDuplicate.has(i)) continue;
    for (var j = i + 1; j < provisions.length; j++) {
      if (isDuplicate.has(j)) continue;
      if (provisions[i].type !== provisions[j].type) continue;
      var a = provisions[i].text.replace(/\s+/g, ' ').trim();
      var b = provisions[j].text.replace(/\s+/g, ' ').trim();
      var shorter = a.length <= b.length ? a : b;
      var longer = a.length > b.length ? a : b;
      var checkLen = Math.floor(shorter.length * 0.8);
      if (checkLen > 50 && longer.includes(shorter.substring(0, checkLen))) {
        isDuplicate.add(a.length <= b.length ? i : j);
      }
    }
  }
  return provisions.filter((_, idx) => !isDuplicate.has(idx));
}

// ═══════════════════════════════════════════════════
// Concurrency limiter
// ═══════════════════════════════════════════════════
async function runWithConcurrency(tasks, maxConcurrent = 6) {
  var results = [];
  var idx = 0;
  var workers = Array.from({ length: Math.min(maxConcurrent, tasks.length) }, async () => {
    while (idx < tasks.length) {
      var i = idx++;
      results[i] = await tasks[i]();
    }
  });
  await Promise.all(workers);
  return results;
}

// ═══════════════════════════════════════════════════
// Main handler
// ═══════════════════════════════════════════════════
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  var sb = getServiceSupabase();
  if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

  var client = new Anthropic({ apiKey });
  var totalStart = Date.now();
  var results = [];

  try {
    // ── Step 1: Clear existing data (respect FK order: annotations → provisions → deals) ──
    console.log('[batch] Clearing existing data...');
    var annDel = await sb.from('annotations').delete().neq('id', '00000000-0000-0000-0000-000000000000').select('id');
    console.log('[batch] Annotations:', annDel.error ? 'SKIP (' + annDel.error.message + ')' : (annDel.data ? annDel.data.length + ' deleted' : '0'));
    var provDel = await sb.from('provisions').delete().neq('id', '00000000-0000-0000-0000-000000000000').select('id');
    console.log('[batch] Provisions:', provDel.error ? 'ERROR: ' + provDel.error.message : (provDel.data ? provDel.data.length + ' deleted' : '0'));
    var dealDel = await sb.from('deals').delete().neq('id', '00000000-0000-0000-0000-000000000000').select('id');
    console.log('[batch] Deals:', dealDel.error ? 'ERROR: ' + dealDel.error.message : (dealDel.data ? dealDel.data.length + ' deleted' : '0'));
    console.log('[batch] Cleared.');

    // ── Step 2: Process each deal sequentially ──
    for (var dealIdx = 0; dealIdx < DEAL_CONFIGS.length; dealIdx++) {
      var config = DEAL_CONFIGS[dealIdx];
      var dealStart = Date.now();
      console.log(`[batch] Processing ${config.acquirer} / ${config.target} (${config.file})...`);

      // Read HTML file
      var filePath = path.join(process.cwd(), config.file);
      var html;
      try {
        html = fs.readFileSync(filePath, 'utf-8');
      } catch (err) {
        // Try latin1 encoding for older EDGAR filings
        html = fs.readFileSync(filePath, 'latin1');
      }

      // Strip HTML → plain text
      var plainText = stripHtml(html);
      plainText = cleanEdgarText(plainText);
      plainText = removeRepeatedHeaders(plainText);

      // Create or reuse deal record (prevent duplicates on re-run)
      var dealId;
      var { data: existingDeals } = await sb.from('deals')
        .select('id')
        .eq('acquirer', config.acquirer)
        .eq('target', config.target);
      if (existingDeals && existingDeals.length > 0) {
        dealId = existingDeals[0].id;
        // Delete old annotations+provisions for this deal (respect FK order)
        var { data: oldProvs } = await sb.from('provisions').select('id').eq('deal_id', dealId);
        if (oldProvs && oldProvs.length > 0) {
          var oldIds = oldProvs.map(p => p.id);
          for (var bi = 0; bi < oldIds.length; bi += 100) {
            var batch = oldIds.slice(bi, bi + 100);
            await sb.from('annotations').delete().in('provision_id', batch);
          }
          await sb.from('provisions').delete().eq('deal_id', dealId);
        }
        // Delete any extra duplicates
        for (var di = 1; di < existingDeals.length; di++) {
          var { data: dupProvs } = await sb.from('provisions').select('id').eq('deal_id', existingDeals[di].id);
          if (dupProvs && dupProvs.length > 0) {
            await sb.from('annotations').delete().in('provision_id', dupProvs.map(p => p.id));
          }
          await sb.from('provisions').delete().eq('deal_id', existingDeals[di].id);
          await sb.from('deals').delete().eq('id', existingDeals[di].id);
        }
        // Update deal metadata
        await sb.from('deals').update({
          value_usd: config.value,
          sector: config.sector,
          announce_date: config.date,
          metadata: { jurisdiction: config.jurisdiction },
        }).eq('id', dealId);
        console.log(`[batch]   Reusing existing deal ${dealId} (${existingDeals.length - 1} duplicates removed)`);
      } else {
        var { data: dealData, error: dealError } = await sb.from('deals')
          .insert({
            acquirer: config.acquirer,
            target: config.target,
            value_usd: config.value,
            sector: config.sector,
            announce_date: config.date,
            metadata: { jurisdiction: config.jurisdiction },
          })
          .select().single();
        if (dealError) {
          results.push({ file: config.file, error: 'Deal creation failed: ' + dealError.message });
          continue;
        }
        dealId = dealData.id;
      }

      // Store agreement source (optional — table may not exist)
      var textHash = crypto.createHash('sha256').update(plainText).digest('hex');
      var agreementSourceId = null;
      try {
        var { data: srcData, error: srcError } = await sb.from('agreement_sources')
          .insert({
            title: `${config.acquirer} / ${config.target} Merger Agreement`,
            full_text: plainText,
            text_hash: textHash,
            metadata: { file: config.file, char_count: plainText.length },
          })
          .select().single();
        if (!srcError && srcData) agreementSourceId = srcData.id;
        else console.log(`[batch]   agreement_sources skipped: ${srcError?.message || 'no data'}`);
      } catch {
        console.log('[batch]   agreement_sources table not available, skipping');
      }

      // Parse structure
      var { sections, articles } = parseStructure(plainText);
      console.log(`[batch]   ${sections.length} sections found`);

      // Pre-classify each section
      for (var s of sections) {
        preClassifySection(s);
      }

      // Group sections by type for batch AI classification
      var provisionsByType = {};
      var unclassifiedSections = [];

      for (var s of sections) {
        if (s.preType) {
          var type = s.preType;
          var tier = s.preTier || TIER_MAP[type] || 2;

          // DEF: split into individual definitions
          if (type === 'DEF') {
            var defSplit = splitDefinitions(s.text);
            if (defSplit) {
              if (!provisionsByType[type]) provisionsByType[type] = [];
              defSplit.forEach(d => provisionsByType[type].push({ type, text: d.text, category: d.category }));
            } else {
              if (!provisionsByType[type]) provisionsByType[type] = [];
              provisionsByType[type].push({ type, text: s.text, category: s.extractedTitle || 'General' });
            }
          }
          // IOC, NOSOL, ANTI, COND-*: split by sub-clauses
          else if (['IOC', 'NOSOL', 'ANTI', 'COND-M', 'COND-B', 'COND-S'].includes(type)) {
            var subSplit = splitBySubClauses(s.text);
            if (subSplit) {
              if (!provisionsByType[type]) provisionsByType[type] = [];
              subSplit.forEach(sub => provisionsByType[type].push({ type, text: sub.text, category: sub.category }));
            } else {
              if (!provisionsByType[type]) provisionsByType[type] = [];
              provisionsByType[type].push({ type, text: s.text, category: s.extractedTitle || 'General' });
            }
          }
          // All other types: keep as single provision
          else {
            if (!provisionsByType[type]) provisionsByType[type] = [];
            provisionsByType[type].push({ type, text: s.text, category: s.extractedTitle || 'General' });
          }
        } else {
          unclassifiedSections.push(s);
        }
      }

      // AI-classify unclassified sections
      if (unclassifiedSections.length > 0) {
        var allTypes = Object.keys(RUBRIC_CODES);
        var typeList = allTypes.join(', ');
        var summaries = unclassifiedSections.map((s, idx) => ({
          idx, heading: s.heading.substring(0, 120), preview: s.text.substring(0, 1000),
        }));

        try {
          var resp = await client.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 8000,
            messages: [{
              role: 'user',
              content: `You are a senior M&A attorney classifying sections of a merger agreement.

For each section, classify into one of: ${typeList}

SECTIONS:
${JSON.stringify(summaries)}

Return ONLY valid JSON array (no markdown):
[{ "idx": 0, "type": "COV" }]

Rules:
- Every section must appear
- Use exact type keys
- For unclear sections, use MISC`,
            }],
          });
          var raw = resp.content.map(c => c.text || '').join('');
          var clean = raw.replace(/```json|```/g, '').trim();
          try {
            var parsed = JSON.parse(clean);
            for (var cls of parsed) {
              var sec = unclassifiedSections[cls.idx];
              if (!sec) continue;
              var t = cls.type || 'MISC';
              if (!provisionsByType[t]) provisionsByType[t] = [];
              provisionsByType[t].push({ type: t, text: sec.text, category: sec.extractedTitle || 'General' });
            }
          } catch {
            for (var sec of unclassifiedSections) {
              if (!provisionsByType['MISC']) provisionsByType['MISC'] = [];
              provisionsByType['MISC'].push({ type: 'MISC', text: sec.text, category: sec.extractedTitle || 'Unclassified' });
            }
          }
        } catch {
          for (var sec of unclassifiedSections) {
            if (!provisionsByType['MISC']) provisionsByType['MISC'] = [];
            provisionsByType['MISC'].push({ type: 'MISC', text: sec.text, category: sec.extractedTitle || 'Unclassified' });
          }
        }
      }

      // Extract MAE definitions from DEF provisions before AI classification
      var preCategorizedMAE = [];
      if (provisionsByType['DEF']) {
        var maeResult = extractMAEFromDefs(provisionsByType['DEF']);
        provisionsByType['DEF'] = maeResult.remaining;
        if (maeResult.maeProvisions.length > 0) {
          preCategorizedMAE.push(...maeResult.maeProvisions);
          console.log(`[batch]   Extracted ${maeResult.maeProvisions.length} MAE provisions from definitions`);
        }
      }

      // Also split any MAE provisions from heading classification (standalone MAE sections)
      if (provisionsByType['MAE']) {
        for (var mp of provisionsByType['MAE']) {
          var hIsBuyer = /\b(?:Parent|Buyer|Acquirer|Purchaser)\s+Material/i.test(mp.category || mp.text.substring(0, 200));
          var hType = hIsBuyer ? 'MAE-B' : 'MAE-T';
          if (/Material\s+Adverse[\s\S]{0,80}(?:means|shall\s+mean)/i.test(mp.text.substring(0, 300))) {
            var split = splitMAEText(mp.text);
            preCategorizedMAE.push({ type: hType, text: split.core, category: 'Material Adverse Effect' });
            if (split.carveouts) preCategorizedMAE.push({ type: hType, text: split.carveouts, category: 'MAE Carve-Outs' });
            if (split.disproportionate) preCategorizedMAE.push({ type: hType, text: split.disproportionate, category: 'MAE Disproportionate Impact' });
          } else {
            preCategorizedMAE.push({ ...mp, type: hType });
          }
        }
        delete provisionsByType['MAE'];
      }

      // Fallback: scan full text for MAE definitions not captured by section parsing
      // This handles agreements where definitions section isn't identified by heading
      if (preCategorizedMAE.length === 0) {
        console.log('[batch]   No MAE from DEF/heading — running fulltext MAE scan');
        var maeDefRx = /[""\u201c]([^""\u201d]*?Material\s+Adverse\s+(?:Effect|Change)[^""\u201d]*)[""\u201d][^""\u201c\n]{0,60}?\b(?:means?|shall\s+mean|has\s+the\s+meaning|shall\s+have\s+the\s+meaning)\b/gi;
        var maeMatch;
        while ((maeMatch = maeDefRx.exec(plainText)) !== null) {
          var maeTerm = maeMatch[1].replace(/\s+/g, ' ').trim();
          // Verify this is a standalone definition (not mid-sentence reference)
          var mBefore = plainText.substring(Math.max(0, maeMatch.index - 200), maeMatch.index);
          var mLastNL = mBefore.lastIndexOf('\n');
          if (mLastNL !== -1) {
            var mSinceLine = mBefore.substring(mLastNL + 1);
            var mNonWS = mSinceLine.replace(/\s/g, '').length;
            if (mNonWS > 20) continue; // mid-sentence reference, skip
          }
          // Find end of this definition (next defined term or 8000 chars)
          var mDefStart = maeMatch.index;
          var mRest = plainText.substring(mDefStart + maeMatch[0].length);
          var mNextDef = mRest.search(/\n\s*[""\u201c][A-Z][^""\u201d]{2,60}[""\u201d]\s*(?:means?|shall\s+mean|has\s+the\s+meaning)/);
          var mDefEnd = mNextDef > 0 ? mDefStart + maeMatch[0].length + mNextDef : mDefStart + 8000;
          var mDefText = plainText.substring(mDefStart, Math.min(mDefEnd, mDefStart + 8000)).trim();

          var mIsBuyer = /\b(?:Parent|Buyer|Acquirer|Purchaser)\s+Material/i.test(maeTerm);
          var mType = mIsBuyer ? 'MAE-B' : 'MAE-T';

          // Skip short cross-references ("has the meaning set forth in Section X")
          if (mDefText.length < 150 && /has\s+the\s+meaning\s+(?:set\s+forth|ascribed)/i.test(mDefText)) {
            preCategorizedMAE.push({ type: mType, text: mDefText, category: 'Material Adverse Effect' });
            continue;
          }

          var mSplit = splitMAEText(mDefText);
          preCategorizedMAE.push({ type: mType, text: mSplit.core, category: 'Material Adverse Effect' });
          if (mSplit.carveouts) preCategorizedMAE.push({ type: mType, text: mSplit.carveouts, category: 'MAE Carve-Outs' });
          if (mSplit.disproportionate) preCategorizedMAE.push({ type: mType, text: mSplit.disproportionate, category: 'MAE Disproportionate Impact' });
        }
        if (preCategorizedMAE.length > 0) {
          console.log(`[batch]   Fulltext scan found ${preCategorizedMAE.length} MAE provisions`);
        }
      }

      if (preCategorizedMAE.length > 0) {
        console.log(`[batch]   ${preCategorizedMAE.length} total MAE provisions (pre-categorized, skipping AI)`);
      }

      // AI classify each type's provisions against rubric codes (parallel by type)
      var allProvisions = [];
      // Add pre-categorized MAE provisions (already have rubric labels, skip AI)
      for (var mp of preCategorizedMAE) {
        var rubricCode = mp.category.startsWith('MAE Carve-Outs') ? 'DEF-MAE-CARVEOUT' : mp.category.startsWith('MAE Disproportionate') ? 'DEF-MAE-DISPROP' : 'DEF-MAE';
        allProvisions.push({ ...mp, ai_metadata: { rubric_code: rubricCode } });
      }
      var classifyTasks = Object.entries(provisionsByType).map(([type, provs]) => async () => {
        var classified = await classifyProvisions(provs, type, client);
        return classified.map(p => ({ ...p, type }));
      });
      var classifyResults = await runWithConcurrency(classifyTasks, 6);
      for (var batch of classifyResults) {
        if (batch) allProvisions.push(...batch);
      }

      // Dedup
      var dedupedProvisions = dedup(allProvisions);
      console.log(`[batch]   ${allProvisions.length} → ${dedupedProvisions.length} after dedup`);

      // Sort: non-DEF by document position (implicit), DEF at end
      dedupedProvisions.sort((a, b) => {
        var aDef = a.type === 'DEF' ? 1 : 0;
        var bDef = b.type === 'DEF' ? 1 : 0;
        return aDef - bDef;
      });

      // Clean up categories before insert
      for (var ci = 0; ci < dedupedProvisions.length; ci++) {
        var cat = dedupedProvisions[ci].category || '';
        // Strip section number prefixes from categories like "6.6 Indemnification."
        cat = cat.replace(/^\d+\.\d{1,2}\s+/, '');
        // Strip trailing periods (but not from UNKNOWN: entries which may need the context)
        if (!cat.startsWith('UNKNOWN:')) cat = cat.replace(/\.\s*$/, '');
        // Clean up UNKNOWN: entries too
        if (cat.startsWith('UNKNOWN: ')) {
          var unknownTitle = cat.substring(9).replace(/^\d+\.\d{1,2}\s+/, '').replace(/\.\s*$/, '').trim();
          cat = 'UNKNOWN: ' + (unknownTitle || 'Unclassified');
        }
        dedupedProvisions[ci].category = cat || 'General';
      }

      // Insert provisions in batches of 50
      var insertBatchSize = 50;
      var totalInserted = 0;
      for (var bi = 0; bi < dedupedProvisions.length; bi += insertBatchSize) {
        var insertBatch = dedupedProvisions.slice(bi, bi + insertBatchSize).map((p, idx) => ({
          deal_id: dealId,
          type: p.type,
          category: p.category || 'General',
          full_text: p.text.trim(),
          ai_favorability: 'neutral',
        }));

        var { error: insertError } = await sb.from('provisions').insert(insertBatch);
        if (insertError) {
          console.error(`[batch]   Insert error at offset ${bi}:`, insertError.message);
        } else {
          totalInserted += insertBatch.length;
        }
      }

      var dealTime = Date.now() - dealStart;
      console.log(`[batch]   ${totalInserted} provisions inserted in ${(dealTime / 1000).toFixed(1)}s`);
      results.push({
        file: config.file,
        deal: `${config.acquirer} / ${config.target}`,
        deal_id: dealId,
        sections: sections.length,
        provisions_raw: allProvisions.length,
        provisions_deduped: dedupedProvisions.length,
        provisions_inserted: totalInserted,
        time_ms: dealTime,
      });
    }

    var totalTime = Date.now() - totalStart;
    return res.json({
      success: true,
      total_time_ms: totalTime,
      deals: results,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message, stack: err.stack, partial_results: results });
  }
}

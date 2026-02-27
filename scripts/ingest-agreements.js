#!/usr/bin/env node
/**
 * Ingest full merger agreements for existing deals.
 *
 * Usage:
 *   node scripts/ingest-agreements.js [--deal d1] [--types MAE,IOC,ANTI,COND,TERMR,TERMF]
 *
 * This script:
 * 1. Fetches the full merger agreement text from SEC EDGAR
 * 2. Stores it in agreement_sources via the API
 * 3. Uses AI to extract provisions for specified types
 * 4. Creates provision records with AI annotations
 *
 * Requires: ANTHROPIC_API_KEY and Supabase env vars (loaded from .env.local)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Load .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  });
}

// SEC EDGAR filing URLs for the 4 deals
// These are the actual merger agreement exhibits from SEC filings
const DEAL_AGREEMENTS = {
  d1: {
    name: 'Broadcom / VMware',
    // Broadcom-VMware merger agreement (Form DEFM14A, Exhibit A)
    edgarUrl: 'https://www.sec.gov/Archives/edgar/data/1124610/000119312522282846/d373855ddefa14a.htm',
    searchSection: 'AGREEMENT AND PLAN OF MERGER',
    filingDate: '2022-05-26',
  },
  d2: {
    name: 'Microsoft / Activision Blizzard',
    edgarUrl: 'https://www.sec.gov/Archives/edgar/data/718877/000119312522023850/d261802ddefa14a.htm',
    searchSection: 'AGREEMENT AND PLAN OF MERGER',
    filingDate: '2022-01-18',
  },
  d3: {
    name: 'Pfizer / Seagen',
    edgarUrl: 'https://www.sec.gov/Archives/edgar/data/1060349/000119312523141562/d487293dprem14a.htm',
    searchSection: 'AGREEMENT AND PLAN OF MERGER',
    filingDate: '2023-03-13',
  },
  d4: {
    name: 'Amgen / Horizon Therapeutics',
    edgarUrl: 'https://www.sec.gov/Archives/edgar/data/1492426/000119312523036455/d454107ddefm14a.htm',
    searchSection: 'AGREEMENT AND PLAN OF MERGER',
    filingDate: '2022-12-12',
  },
};

const DEFAULT_TYPES = ['MAE', 'IOC', 'ANTI', 'COND', 'TERMR', 'TERMF'];

// Parse CLI args
const args = process.argv.slice(2);
let targetDeal = null;
let targetTypes = DEFAULT_TYPES;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--deal' && args[i + 1]) targetDeal = args[++i];
  if (args[i] === '--types' && args[i + 1]) targetTypes = args[++i].split(',');
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : require('http');
    const req = client.get(url, { headers: { 'User-Agent': 'PrecedentMachine/1.0 (legal research)' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function stripHtml(html) {
  // Remove HTML tags, decode entities, normalize whitespace
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/td>/gi, '\t')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&rsquo;/gi, "'")
    .replace(/&ldquo;/gi, '"')
    .replace(/&rdquo;/gi, '"')
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&#\d+;/g, '')
    .replace(/\t+/g, ' ')
    .replace(/ +/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractAgreementSection(text, searchSection) {
  // Try to find the merger agreement section
  const patterns = [
    /AGREEMENT AND PLAN OF MERGER/i,
    /MERGER AGREEMENT/i,
    /AGREEMENT AND PLAN OF/i,
    /THIS AGREEMENT/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      // Get text from this point forward, but look for the first "ARTICLE" or "SECTION"
      const startIdx = match.index;
      // Find a natural end — look for common end markers
      const endMarkers = [
        /\[Remainder of page intentionally left blank\]/i,
        /IN WITNESS WHEREOF/i,
        /\[Signature Pages Follow\]/i,
        /EXHIBIT [A-Z]/,
      ];
      let endIdx = text.length;
      for (const endPattern of endMarkers) {
        const endMatch = text.substring(startIdx).match(endPattern);
        if (endMatch) {
          endIdx = Math.min(endIdx, startIdx + endMatch.index);
        }
      }
      return text.substring(startIdx, endIdx);
    }
  }
  // If no section found, return the full text (truncated)
  return text;
}

async function ingestDeal(dealKey) {
  const dealConfig = DEAL_AGREEMENTS[dealKey];
  if (!dealConfig) {
    console.error(`Unknown deal: ${dealKey}`);
    return;
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Ingesting: ${dealConfig.name}`);
  console.log(`${'='.repeat(60)}`);

  // Step 1: Check if we have a local file first
  const localPath = path.join(__dirname, '..', 'data', `${dealKey}-agreement.txt`);
  let fullText;

  if (fs.existsSync(localPath)) {
    console.log(`Using local file: ${localPath}`);
    fullText = fs.readFileSync(localPath, 'utf8');
  } else {
    console.log(`Fetching from SEC EDGAR: ${dealConfig.edgarUrl}`);
    try {
      const html = await fetchUrl(dealConfig.edgarUrl);
      console.log(`Fetched ${html.length} chars of HTML`);

      // Strip HTML and extract agreement section
      const plainText = stripHtml(html);
      console.log(`Stripped to ${plainText.length} chars of text`);

      fullText = extractAgreementSection(plainText, dealConfig.searchSection);
      console.log(`Extracted agreement section: ${fullText.length} chars`);

      // Save locally for future runs
      const dataDir = path.join(__dirname, '..', 'data');
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(localPath, fullText);
      console.log(`Saved to ${localPath}`);
    } catch (err) {
      console.error(`Failed to fetch agreement: ${err.message}`);
      console.log('You can manually save the agreement text to:', localPath);
      return;
    }
  }

  if (!fullText || fullText.length < 1000) {
    console.error('Agreement text too short. Check the source.');
    return;
  }

  // Step 2: Call the ingest API
  const apiUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  console.log(`\nSending to ingest API (${fullText.length} chars)...`);
  console.log(`Provision types: ${targetTypes.join(', ')}`);

  try {
    const response = await fetch(`${apiUrl}/api/ingest/agreement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deal_id: dealKey,
        full_text: fullText,
        title: `${dealConfig.name} Merger Agreement`,
        source_url: dealConfig.edgarUrl,
        filing_date: dealConfig.filingDate,
        provision_types: targetTypes,
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error(`API error: ${data.error}`);
      return;
    }

    console.log(`\nResults for ${dealConfig.name}:`);
    console.log(`Agreement source ID: ${data.agreement_source_id}`);
    data.results.forEach(r => {
      if (r.error) {
        console.log(`  ${r.type}: ERROR - ${r.error}`);
      } else {
        console.log(`  ${r.type} (${r.label}): ${r.extracted} extracted, ${r.suggested} AI-suggested, ${r.created} created`);
      }
    });
  } catch (err) {
    console.error(`Ingest API call failed: ${err.message}`);
    console.log('Make sure the dev server is running: npm run dev');
  }
}

async function main() {
  console.log('Precedent Machine — Full Agreement Ingest');
  console.log(`Types: ${targetTypes.join(', ')}`);

  const deals = targetDeal ? [targetDeal] : Object.keys(DEAL_AGREEMENTS);

  for (const dealKey of deals) {
    await ingestDeal(dealKey);
  }

  console.log('\nDone.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

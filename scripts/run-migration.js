#!/usr/bin/env node
/**
 * Run the provision type migration against Supabase
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=\s*"?([^"]*)"?\s*$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  });
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const sb = createClient(url, key);

async function main() {
  console.log('Adding new provision types...');

  // Insert provision types
  const newTypes = [
    { key: 'ANTI', label: 'Antitrust / Regulatory Efforts' },
    { key: 'COND', label: 'Conditions to Closing' },
    { key: 'TERMR', label: 'Termination Rights' },
    { key: 'TERMF', label: 'Termination Fees' },
  ];

  for (const t of newTypes) {
    const { data, error } = await sb.from('provision_types').upsert(t, { onConflict: 'key' }).select().single();
    if (error) {
      console.error(`Failed to insert ${t.key}:`, error.message);
    } else {
      console.log(`  ${t.key}: ${data.id}`);
    }
  }

  // Get all provision type IDs
  const { data: types } = await sb.from('provision_types').select('id, key');
  const typeMap = {};
  types.forEach(t => typeMap[t.key] = t.id);

  // Insert categories
  const categories = {
    ANTI: ['Efforts Standard', 'Anti-Hell or High Water', 'Hell or High Water', 'Burdensome Condition', 'Definition of Burdensome Condition', 'Obligation to Litigate', 'Obligation Not to Litigate', 'Regulatory Approval Filing Deadline', 'Cooperation Obligations'],
    COND: ['Regulatory Approval / HSR', 'No Legal Impediment', 'Accuracy of Target Representations', 'Accuracy of Acquirer Representations', 'Target Compliance with Covenants', 'Acquirer Compliance with Covenants', 'No MAE', 'Third-Party Consents', 'Stockholder Approval'],
    TERMR: ['Mutual Termination', 'Outside Date', 'Outside Date Extension', 'Regulatory Failure', 'Breach by Target', 'Breach by Acquirer', 'Superior Proposal', 'Intervening Event', 'Failure of Conditions'],
    TERMF: ['Target Termination Fee', 'Reverse Termination Fee', 'Regulatory Break-Up Fee', 'Fee Amount', 'Fee Triggers', 'Expense Reimbursement', 'Fee as Percentage of Deal Value'],
  };

  for (const [typeKey, cats] of Object.entries(categories)) {
    const typeId = typeMap[typeKey];
    if (!typeId) { console.error(`No type ID for ${typeKey}`); continue; }

    console.log(`\nAdding ${typeKey} categories:`);
    for (let i = 0; i < cats.length; i++) {
      const { error } = await sb.from('provision_categories')
        .upsert({
          provision_type_id: typeId,
          label: cats[i],
          sort_order: i + 1,
          parent_id: null,
        }, { onConflict: 'provision_type_id,label,parent_id' });
      if (error) {
        console.error(`  Failed: ${cats[i]} — ${error.message}`);
      } else {
        console.log(`  ${i + 1}. ${cats[i]}`);
      }
    }
  }

  console.log('\nDone.');
}

main().catch(err => { console.error(err); process.exit(1); });

const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '..', '.env.local');
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
}
const { createClient } = require('@supabase/supabase-js');
async function main() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabase.from('claims').select('*').limit(1);
  if (error) { console.error(error); process.exit(1); }
  console.log(Object.keys(data[0] || {}));
  console.log(JSON.stringify(data[0], null, 2));
}
main();

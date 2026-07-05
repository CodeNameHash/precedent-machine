#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { summariseTaskForCli } = require('../lib/coding-tasks');

const VALID_STATUSES = new Set(['pending', 'claimed', 'needs_review', 'applied', 'ignored', 'failed', 'cancelled', 'all']);
const UPDATE_STATUSES = new Set(['needs_review', 'applied', 'ignored', 'failed', 'cancelled']);

function parsePositiveInt(value, fallback) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return fallback;
  return n;
}

function findDotEnvLocal(start = path.join(__dirname, '..')) {
  let dir = start;
  for (;;) {
    const candidate = path.join(dir, '.env.local');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function loadDotEnvLocal(envPath = findDotEnvLocal()) {
  if (!envPath || !fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !(match[1] in process.env)) process.env[match[1]] = match[2].replace(/^"|"$/g, '');
  }
}

function parseArgs(argv) {
  const args = {
    command: 'list',
    status: 'pending',
    limit: 10,
    workerId: `${os.hostname()}-${process.pid}`,
    leaseSeconds: 60 * 60,
    taskId: null,
    resultJson: null,
    message: null,
    json: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === 'list') args.command = 'list';
    else if (arg === 'claim') args.command = 'claim';
    else if (arg === 'process') args.command = 'process';
    else if (arg === 'complete') {
      args.command = 'update';
      args.status = 'applied';
      args.taskId = argv[++i];
    } else if (arg === '--list') args.command = 'list';
    else if (arg === '--claim') args.command = 'claim';
    else if (arg === '--process') args.command = 'process';
    else if (arg === '--status') args.status = argv[++i];
    else if (arg === '--limit') args.limit = parsePositiveInt(argv[++i], 10);
    else if (arg === '--worker-id') args.workerId = argv[++i];
    else if (arg === '--lease-seconds') args.leaseSeconds = parsePositiveInt(argv[++i], 60 * 60);
    else if (arg === '--task-id') args.taskId = argv[++i];
    else if (arg === '--result-json') args.resultJson = argv[++i];
    else if (arg === '--message') args.message = argv[++i];
    else if (arg === '--json') args.json = true;
    else if (arg === '--needs-review') {
      args.command = 'update';
      args.status = 'needs_review';
      args.taskId = argv[++i];
    } else if (arg === '--applied') {
      args.command = 'update';
      args.status = 'applied';
      args.taskId = argv[++i];
    } else if (arg === '--ignored') {
      args.command = 'update';
      args.status = 'ignored';
      args.taskId = argv[++i];
    } else if (arg === '--failed') {
      args.command = 'update';
      args.status = 'failed';
      args.taskId = argv[++i];
    } else {
      throw new Error(`Unknown arg: ${arg}`);
    }
  }

  if (!VALID_STATUSES.has(args.status)) throw new Error(`--status must be one of: ${Array.from(VALID_STATUSES).join(', ')}`);
  if (args.command === 'update') {
    if (!args.taskId) throw new Error('--task-id is required for status updates');
    if (!UPDATE_STATUSES.has(args.status)) throw new Error(`update status must be one of: ${Array.from(UPDATE_STATUSES).join(', ')}`);
  }
  return args;
}

function serviceSupabase() {
  loadDotEnvLocal();
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service credentials required in env or .env.local');
  return createClient(url, key);
}

async function listTasks(sb, args) {
  let query = sb
    .from('coding_tasks')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(args.limit);

  if (args.status !== 'all') query = query.eq('status', args.status);
  const { data, error } = await query;
  if (error) throw new Error(`Task list failed: ${error.message}`);
  return data || [];
}

async function claimTasks(sb, args) {
  const { data, error } = await sb.rpc('claim_coding_tasks', {
    p_worker_id: args.workerId,
    p_limit: args.limit,
    p_lease_seconds: args.leaseSeconds,
  });
  if (error) throw new Error(`Task claim failed: ${error.message}`);
  return data || [];
}

function parseResultJson(value) {
  if (!value) return {};
  return JSON.parse(value);
}

async function updateTask(sb, args) {
  const updates = {
    status: args.status,
    locked_by: null,
    locked_until: null,
    error_message: args.status === 'failed' ? (args.message || 'CLI worker marked failed') : null,
    completed_at: ['applied', 'ignored', 'failed', 'cancelled'].includes(args.status) ? new Date().toISOString() : null,
    result: {
      ...parseResultJson(args.resultJson),
      ...(args.message ? { message: args.message } : {}),
      updated_by: args.workerId,
      updated_at: new Date().toISOString(),
    },
  };
  const { data, error } = await sb
    .from('coding_tasks')
    .update(updates)
    .eq('id', args.taskId)
    .select()
    .single();
  if (error) throw new Error(`Task update failed: ${error.message}`);
  return data;
}

function printTaskList(tasks) {
  if (!tasks.length) {
    console.log('No coding tasks.');
    return;
  }
  for (const task of tasks) {
    const item = summariseTaskForCli(task);
    console.log(`${item.id} ${item.status} ${item.suggested_action} ${item.current_type || '-'} ${item.current_code || '-'} deal=${item.deal_id} provision=${item.provision_id || '-'}`);
    if (item.note) console.log(`  note: ${item.note}`);
    if (item.preview) console.log(`  text: ${item.preview}`);
  }
}

function printTaskPacket(task) {
  const payload = task && task.payload && typeof task.payload === 'object' ? task.payload : {};
  const item = summariseTaskForCli(task);
  console.log(`\n=== Coding task ${item.id} ===`);
  console.log(`Status: ${item.status}`);
  console.log(`Suggested action: ${item.suggested_action}`);
  console.log(`Deal: ${item.deal_id}`);
  console.log(`Provision: ${item.provision_id || '-'}`);
  console.log(`Current: type=${item.current_type || '-'} category=${item.current_category || '-'} code=${item.current_code || '-'}`);
  if (item.suggested_code) console.log(`Suggested code: ${item.suggested_code}`);
  console.log(`Ben note: ${item.note || '-'}`);
  console.log('\nFull text:\n');
  console.log(payload.full_text || task.full_text || '');
  console.log('\nPayload JSON:\n');
  console.log(JSON.stringify(payload, null, 2));
}

async function run(argv = process.argv) {
  const args = parseArgs(argv);
  const sb = serviceSupabase();

  if (args.command === 'update') {
    const task = await updateTask(sb, args);
    if (args.json) console.log(JSON.stringify(task, null, 2));
    else printTaskList([task]);
    return task;
  }

  const tasks = args.command === 'list'
    ? await listTasks(sb, args)
    : await claimTasks(sb, args);

  if (args.json) {
    console.log(JSON.stringify(tasks, null, 2));
  } else if (args.command === 'process') {
    if (!tasks.length) console.log('No coding tasks claimed.');
    for (const task of tasks) printTaskPacket(task);
  } else {
    printTaskList(tasks);
  }

  return tasks;
}

if (require.main === module) {
  run().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}

module.exports = {
  parseArgs,
  listTasks,
  claimTasks,
  updateTask,
  printTaskPacket,
  run,
};

'use strict';

// A Supabase-client shape over a node-postgres client, so the product's
// stores (lib/product/phase-1-store.js and above) run against a direct
// database connection: `rpc(name, parameters)` calls the public wrapper
// function by name with its parameters in declared order, `from(table)`
// supports the select / eq / order / range / maybeSingle shapes the stores
// use. The database tests carry this shape; the production move
// (lib/product/production-move.js) reads both databases through it so the
// proof is the product's own read and not a hand-written query.

const RPC_ARGUMENTS = Object.freeze({
  product_phase1_persist_source: ['p_source'],
  product_phase1_create_run: ['p_source_document_id', 'p_retrieval_url', 'p_idempotency_key', 'p_schema_version', 'p_prompt_bundle_version', 'p_model_config', 'p_explicit_generation', 'p_max_attempts'],
  product_phase1_attach_structure: ['p_run_id', 'p_structure_id', 'p_structure', 'p_identity_review'],
  product_phase1_fail_run: ['p_run_id', 'p_stage', 'p_error'],
  product_phase1_resolve_identity: ['p_run_id', 'p_resolution'],
  product_phase1_claim_section: ['p_run_id', 'p_worker_id', 'p_lease_seconds'],
  product_phase1_recover_expired_sections: ['p_run_id'],
  product_phase1_renew_section_lease: ['p_run_id', 'p_node_id', 'p_worker_id', 'p_attempt_token', 'p_lease_seconds'],
  product_phase1_complete_section: ['p_run_id', 'p_node_id', 'p_worker_id', 'p_attempt_token', 'p_cost_microusd', 'p_input_tokens', 'p_output_tokens'],
  product_phase1_fail_section: ['p_run_id', 'p_node_id', 'p_worker_id', 'p_attempt_token', 'p_error'],
  product_phase2_commit_section: ['p_run_id', 'p_node_id', 'p_worker_id', 'p_attempt_token', 'p_result'],
  product_phase2_record_model_call: ['p_run_id', 'p_node_id', 'p_worker_id', 'p_attempt_token', 'p_call'],
  product_phase2_fail_section: ['p_run_id', 'p_node_id', 'p_worker_id', 'p_attempt_token', 'p_error', 'p_model_calls'],
  product_phase2_finalize_draft: ['p_run_id', 'p_draft'],
  product_phase2_finalize_saved_run: ['p_run_id', 'p_finalization'],
  product_phase2_get_analysis: ['p_run_id'],
  product_phase3_register_run_access: ['p_run_id', 'p_actor'],
  product_phase3_retry_run: ['p_run_id', 'p_actor', 'p_idempotency_key'],
  product_phase3_initialise_review: ['p_run_id', 'p_state', 'p_actor'],
  product_phase3_save_review: ['p_run_id', 'p_expected_version', 'p_state', 'p_actor', 'p_event_type', 'p_action_id', 'p_idempotency_key', 'p_command'],
  product_phase3_restore_review: ['p_run_id', 'p_expected_version', 'p_restore_version', 'p_actor', 'p_action_id', 'p_idempotency_key'],
  product_phase3_get_review: ['p_run_id', 'p_actor'],
  product_phase3_list_reference_sources: ['p_actor'],
});

function createPgStoreFacade(client) {
  if (!client || typeof client.query !== 'function') throw new TypeError('a node-postgres client is required');
  return {
    async rpc(name, parameters) {
      try {
        const names = RPC_ARGUMENTS[name];
        if (!names) throw new Error(`unsupported RPC ${name}`);
        const values = names.map((key) => parameters[key]);
        const markers = values.map((_, index) => `$${index + 1}`).join(',');
        const result = await client.query(`SELECT public.${name}(${markers}) AS data`, values);
        return { data: result.rows[0].data, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
    from(table) {
      if (!/^product_[a-z_]+$/.test(table)) throw new Error('invalid table');
      let columns = '*';
      const filters = [];
      const orders = [];
      let range = null;
      const execute = async (single = false) => {
        try {
          const where = filters.length ? ` WHERE ${filters.map((item, index) => `${item.column} = $${index + 1}`).join(' AND ')}` : '';
          const order = orders.length ? ` ORDER BY ${orders.map((item) => `${item.column} ${item.ascending ? 'ASC' : 'DESC'}`).join(', ')}` : '';
          const bounded = range ? ` LIMIT ${range.to - range.from + 1} OFFSET ${range.from}` : '';
          const result = await client.query(`SELECT ${columns} FROM public.${table}${where}${order}${bounded}`, filters.map((item) => item.value));
          return { data: single ? (result.rows[0] || null) : result.rows, error: null };
        } catch (error) {
          return { data: null, error };
        }
      };
      const builder = {
        select(value) { columns = value; return builder; },
        eq(column, value) {
          if (!/^[a-z_]+$/.test(column)) throw new Error('invalid column');
          filters.push({ column, value }); return builder;
        },
        order(column, options = {}) {
          if (!/^[a-z_]+$/.test(column)) throw new Error('invalid column');
          orders.push({ column, ascending: options.ascending !== false }); return builder;
        },
        range(from, to) { range = { from, to }; return builder; },
        maybeSingle() { return execute(true); },
        then(resolve, reject) { return execute(false).then(resolve, reject); },
      };
      return builder;
    },
  };
}

module.exports = { RPC_ARGUMENTS, createPgStoreFacade };

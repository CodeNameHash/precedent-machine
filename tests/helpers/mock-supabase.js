// Minimal in-memory Supabase mock covering exactly the query shapes the
// Correct-tab modules (lib/corrections/submit.js, lib/corrections/review.js,
// lib/provisions/apply-patch.js) use against `provisions` and `corrections`.
// Not a general-purpose fake — extend as needed, mirroring the style of
// tests/parser-v2-store-claims.test.js's inMemorySupabase().

let nextId = 1;
function genId() {
  return `mock-id-${nextId++}`;
}

function mockSupabase({ provisions = [], corrections = [] } = {}) {
  const tables = {
    provisions: provisions.map((r) => ({ ...r })),
    corrections: corrections.map((r) => ({ ...r })),
  };

  function selectBuilder(table, filters = []) {
    function applyFilters(rows) {
      return rows.filter((row) => filters.every(([col, val]) => row[col] === val));
    }
    return {
      eq(col, val) {
        return selectBuilder(table, [...filters, [col, val]]);
      },
      async single() {
        const rows = applyFilters(tables[table]);
        if (rows.length !== 1) return { data: null, error: { message: 'no rows' } };
        return { data: rows[0], error: null };
      },
      async maybeSingle() {
        const rows = applyFilters(tables[table]);
        if (rows.length === 0) return { data: null, error: null };
        return { data: rows[0], error: null };
      },
      then(resolve) {
        return Promise.resolve({ data: applyFilters(tables[table]), error: null }).then(resolve);
      },
    };
  }

  function updateBuilder(table, patch) {
    return {
      eq(col, val) {
        const idx = tables[table].findIndex((row) => row[col] === val);
        return {
          select() {
            return {
              async single() {
                if (idx < 0) return { data: null, error: { message: 'no rows' } };
                tables[table][idx] = { ...tables[table][idx], ...patch };
                return { data: { ...tables[table][idx] }, error: null };
              },
            };
          },
        };
      },
    };
  }

  function insertBuilder(table, payload) {
    return {
      select() {
        return {
          async single() {
            const row = { id: genId(), status: 'applied', created_at: new Date().toISOString(), ...payload };
            tables[table].push(row);
            return { data: { ...row }, error: null };
          },
        };
      },
    };
  }

  return {
    tables,
    from(table) {
      return {
        select(cols) {
          return selectBuilder(table);
        },
        update(patch) {
          return updateBuilder(table, patch);
        },
        insert(payload) {
          return insertBuilder(table, payload);
        },
      };
    },
  };
}

module.exports = { mockSupabase };

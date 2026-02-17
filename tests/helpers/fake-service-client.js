class FakeQuery {
  constructor(store, table, nextId) {
    this.store = store;
    this.table = table;
    this.nextId = nextId;

    this.operation = "select";
    this.selectClause = null;
    this.upsertConflict = null;
    this.payload = null;
    this.filters = [];
    this.orderBy = null;
    this.limitCount = null;
  }

  select(columns) {
    this.selectClause = columns;
    return this;
  }

  insert(payload) {
    this.operation = "insert";
    this.payload = payload;
    return this;
  }

  update(payload) {
    this.operation = "update";
    this.payload = payload;
    return this;
  }

  upsert(payload, options = {}) {
    this.operation = "upsert";
    this.payload = payload;
    this.upsertConflict = options.onConflict ?? null;
    return this;
  }

  eq(field, value) {
    this.filters.push({ type: "eq", field, value });
    return this;
  }

  is(field, value) {
    this.filters.push({ type: "is", field, value });
    return this;
  }

  gt(field, value) {
    this.filters.push({ type: "gt", field, value });
    return this;
  }

  order(field, { ascending = true } = {}) {
    this.orderBy = { field, ascending };
    return this;
  }

  limit(count) {
    this.limitCount = count;
    return this;
  }

  async single() {
    const response = this.execute();
    if (response.error) {
      return { data: null, error: response.error };
    }

    if (!Array.isArray(response.data) || response.data.length !== 1) {
      return { data: null, error: { message: "Expected exactly one row." } };
    }

    return { data: response.data[0], error: null };
  }

  async maybeSingle() {
    const response = this.execute();
    if (response.error) {
      return { data: null, error: response.error };
    }

    if (!Array.isArray(response.data) || response.data.length === 0) {
      return { data: null, error: null };
    }

    if (response.data.length > 1) {
      return { data: null, error: { message: "Expected at most one row." } };
    }

    return { data: response.data[0], error: null };
  }

  then(resolve, reject) {
    return Promise.resolve(this.execute()).then(resolve, reject);
  }

  execute() {
    try {
      const rows = this.store[this.table] ?? [];

      if (this.operation === "insert") {
        return this.executeInsert(rows);
      }

      if (this.operation === "update") {
        return this.executeUpdate(rows);
      }

      if (this.operation === "upsert") {
        return this.executeUpsert(rows);
      }

      return this.executeSelect(rows);
    } catch (error) {
      return {
        data: null,
        error: {
          message: error instanceof Error ? error.message : "Fake query failed."
        }
      };
    }
  }

  executeSelect(rows) {
    let result = this.applyFilters(rows);
    result = this.applyOrder(result);
    result = this.applyLimit(result);

    return {
      data: this.projectRows(result),
      error: null
    };
  }

  executeInsert(rows) {
    const insertRows = Array.isArray(this.payload) ? this.payload : [this.payload];
    const created = insertRows.map((row) => {
      const normalized = {
        created_at: row?.created_at ?? new Date().toISOString(),
        ...row
      };

      if (!normalized.id) {
        normalized.id = this.nextId(this.table);
      }

      rows.push(normalized);
      return normalized;
    });

    return {
      data: this.selectClause ? this.projectRows(created) : created,
      error: null
    };
  }

  executeUpdate(rows) {
    const matches = this.applyFilters(rows);
    for (const row of matches) {
      Object.assign(row, this.payload ?? {});
    }

    return {
      data: this.selectClause ? this.projectRows(matches) : matches,
      error: null
    };
  }

  executeUpsert(rows) {
    const upsertRows = Array.isArray(this.payload) ? this.payload : [this.payload];
    const written = [];

    for (const payloadRow of upsertRows) {
      let existing = null;

      if (this.upsertConflict) {
        existing = rows.find((row) => row[this.upsertConflict] === payloadRow[this.upsertConflict]) ?? null;
      }

      if (existing) {
        Object.assign(existing, payloadRow);
        written.push(existing);
        continue;
      }

      const inserted = {
        created_at: payloadRow?.created_at ?? new Date().toISOString(),
        ...payloadRow
      };

      if (!inserted.id) {
        inserted.id = this.nextId(this.table);
      }

      rows.push(inserted);
      written.push(inserted);
    }

    return {
      data: this.selectClause ? this.projectRows(written) : written,
      error: null
    };
  }

  applyFilters(rows) {
    return rows.filter((row) =>
      this.filters.every((filter) => {
        if (filter.type === "eq") {
          return row[filter.field] === filter.value;
        }

        if (filter.type === "is") {
          if (filter.value === null) {
            return row[filter.field] === null || row[filter.field] === undefined;
          }

          return row[filter.field] === filter.value;
        }

        if (filter.type === "gt") {
          const left = row[filter.field];
          const right = filter.value;

          if (typeof left === "string" && typeof right === "string") {
            const leftDate = Date.parse(left);
            const rightDate = Date.parse(right);

            if (!Number.isNaN(leftDate) && !Number.isNaN(rightDate)) {
              return leftDate > rightDate;
            }
          }

          return left > right;
        }

        return true;
      })
    );
  }

  applyOrder(rows) {
    if (!this.orderBy) {
      return [...rows];
    }

    const { field, ascending } = this.orderBy;
    const direction = ascending ? 1 : -1;

    return [...rows].sort((left, right) => {
      if (left[field] === right[field]) {
        return 0;
      }

      return left[field] > right[field] ? direction : -direction;
    });
  }

  applyLimit(rows) {
    if (!Number.isInteger(this.limitCount)) {
      return rows;
    }

    return rows.slice(0, this.limitCount);
  }

  projectRows(rows) {
    if (!this.selectClause) {
      return rows.map((row) => ({ ...row }));
    }

    const fields = this.selectClause
      .split(",")
      .map((field) => field.trim())
      .filter(Boolean);

    return rows.map((row) => {
      const projected = {};
      for (const field of fields) {
        projected[field] = row[field] ?? null;
      }
      return projected;
    });
  }
}

export function createFakeServiceClient(seed = {}) {
  const tables = {
    parents: [],
    children: [],
    sessions: [],
    session_codes: [],
    child_session_tokens: [],
    messages: [],
    overrides: [],
    policy_events: [],
    ...seed
  };

  let idCounter = 1;
  const nextId = (table) => `${table}_${idCounter++}`;

  return {
    tables,
    from(table) {
      if (!tables[table]) {
        tables[table] = [];
      }

      return new FakeQuery(tables, table, nextId);
    }
  };
}

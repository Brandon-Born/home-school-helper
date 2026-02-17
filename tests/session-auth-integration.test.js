import test from "node:test";
import assert from "node:assert/strict";

import { ApiError } from "../src/server/api-error.js";
import { requireChildSessionContext, requireParentContext } from "../src/server/auth.js";
import {
  ensureParentOwnsSession,
  listSessionMessages,
  redeemSessionCode
} from "../src/server/session-foundation-service.js";
import { hashOpaqueToken } from "../src/server/session-codes.js";

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

function createFakeServiceClient(seed = {}) {
  const tables = {
    parents: [],
    children: [],
    sessions: [],
    session_codes: [],
    child_session_tokens: [],
    messages: [],
    overrides: [],
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

test("redeemSessionCode redeems exactly once and creates child session token", async () => {
  const now = Date.now();
  const code = "AB12CD34";
  const serviceClient = createFakeServiceClient({
    sessions: [
      {
        id: "session_1",
        child_id: "child_1",
        status: "active"
      }
    ],
    session_codes: [
      {
        id: "code_1",
        session_id: "session_1",
        code_hash: hashOpaqueToken(code),
        expires_at: new Date(now + 5 * 60 * 1000).toISOString(),
        redeemed_at: null,
        redeemed_device_fingerprint: null
      }
    ]
  });

  const first = await redeemSessionCode(
    { code: "ab12-cd34", device_fingerprint: "device-xyz" },
    { serviceClient }
  );

  assert.equal(first.session_id, "session_1");
  assert.equal(first.child_id, "child_1");
  assert.equal(typeof first.child_session_token, "string");
  assert.ok(first.child_session_token.length >= 20);

  assert.equal(serviceClient.tables.session_codes[0].redeemed_device_fingerprint, "device-xyz");
  assert.notEqual(serviceClient.tables.session_codes[0].redeemed_at, null);
  assert.equal(serviceClient.tables.child_session_tokens.length, 1);
  assert.equal(
    serviceClient.tables.child_session_tokens[0].token_hash,
    hashOpaqueToken(first.child_session_token)
  );

  await assert.rejects(
    () => redeemSessionCode({ code }, { serviceClient }),
    (error) => error instanceof ApiError && error.status === 409 && error.code === "session_code_used"
  );
});

test("ensureParentOwnsSession enforces parent/session ownership", async () => {
  const serviceClient = createFakeServiceClient({
    sessions: [
      {
        id: "session_1",
        child_id: "child_1",
        parent_id: "parent_1",
        status: "active"
      }
    ]
  });

  const owned = await ensureParentOwnsSession("parent_1", "session_1", { serviceClient });
  assert.equal(owned.id, "session_1");

  await assert.rejects(
    () => ensureParentOwnsSession("parent_2", "session_1", { serviceClient }),
    (error) => error instanceof ApiError && error.status === 404 && error.code === "session_not_found"
  );
});

test("listSessionMessages hides parent-only messages from child visibility", async () => {
  const serviceClient = createFakeServiceClient({
    messages: [
      {
        id: "m1",
        session_id: "session_1",
        actor_type: "child",
        visibility_scope: "child_and_parent",
        content: "Need help with fractions",
        policy_flags: [],
        created_at: "2026-02-17T04:00:00.000Z"
      },
      {
        id: "m2",
        session_id: "session_1",
        actor_type: "parent",
        visibility_scope: "parent_only",
        content: "Keep it confidence-building",
        policy_flags: [],
        created_at: "2026-02-17T04:00:01.000Z"
      },
      {
        id: "m3",
        session_id: "session_1",
        actor_type: "assistant",
        visibility_scope: "child_and_parent",
        content: "Let us break this down together.",
        policy_flags: ["scaffold_first"],
        created_at: "2026-02-17T04:00:02.000Z"
      },
      {
        id: "m4",
        session_id: "session_2",
        actor_type: "assistant",
        visibility_scope: "child_and_parent",
        content: "Other session",
        policy_flags: [],
        created_at: "2026-02-17T04:00:03.000Z"
      }
    ]
  });

  const parentView = await listSessionMessages(
    { sessionId: "session_1", visibility: "all", limit: 50 },
    { serviceClient }
  );
  assert.equal(parentView.length, 3);

  const childView = await listSessionMessages(
    { sessionId: "session_1", visibility: "child", limit: 50 },
    { serviceClient }
  );

  assert.equal(childView.length, 2);
  assert.deepEqual(
    childView.map((message) => message.id),
    ["m1", "m3"]
  );
});

test("requireChildSessionContext validates token hash, session scope, and expiry", async () => {
  const token = "child-secret-token";
  const serviceClient = createFakeServiceClient({
    child_session_tokens: [
      {
        id: "token_1",
        session_id: "session_1",
        child_id: "child_1",
        token_hash: hashOpaqueToken(token),
        expires_at: new Date(Date.now() + 60 * 1000).toISOString(),
        revoked_at: null
      }
    ]
  });

  const request = new Request("https://example.test/api/session/session_1/child-turn", {
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  const context = await requireChildSessionContext(request, "session_1", { serviceClient });
  assert.equal(context.tokenRow.id, "token_1");

  await assert.rejects(
    () => requireChildSessionContext(request, "session_2", { serviceClient }),
    (error) =>
      error instanceof ApiError && error.status === 401 && error.code === "invalid_child_session_token"
  );

  serviceClient.tables.child_session_tokens[0].expires_at = new Date(Date.now() - 1000).toISOString();
  await assert.rejects(
    () => requireChildSessionContext(request, "session_1", { serviceClient }),
    (error) =>
      error instanceof ApiError && error.status === 401 && error.code === "invalid_child_session_token"
  );
});

test("requireParentContext validates bearer token and upserts parent record", async () => {
  const serviceClient = createFakeServiceClient();
  const anonClient = {
    auth: {
      getUser: async (accessToken) => {
        if (accessToken === "bad-token") {
          return {
            data: { user: null },
            error: { message: "Invalid JWT" }
          };
        }

        return {
          data: {
            user: {
              id: "auth_parent_1",
              email: "parent@example.com",
              user_metadata: {
                full_name: "Parent One"
              }
            }
          },
          error: null
        };
      }
    }
  };

  const validRequest = new Request("https://example.test/api/parent/me", {
    headers: {
      authorization: "Bearer good-token"
    }
  });

  const context = await requireParentContext(validRequest, {
    anonClient,
    serviceClient
  });

  assert.equal(context.parent.auth_user_id, "auth_parent_1");
  assert.equal(context.parent.email, "parent@example.com");
  assert.equal(serviceClient.tables.parents.length, 1);

  const invalidRequest = new Request("https://example.test/api/parent/me", {
    headers: {
      authorization: "Bearer bad-token"
    }
  });

  await assert.rejects(
    () => requireParentContext(invalidRequest, { anonClient, serviceClient }),
    (error) => error instanceof ApiError && error.status === 401 && error.code === "invalid_parent_token"
  );

  await requireParentContext(validRequest, { anonClient, serviceClient });
  assert.equal(serviceClient.tables.parents.length, 1);
});

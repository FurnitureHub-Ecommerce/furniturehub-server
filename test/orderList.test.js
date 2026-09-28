const assert = require("node:assert/strict");
const { test } = require("node:test");
const { once } = require("node:events");
const express = require("express");
const jwt = require("jsonwebtoken");
const Order = require("../src/models/orderModel");
const orderService = require("../src/services/orderService");
const orderRoute = require("../src/routes/orderRoute");

const customerId = "507f1f77bcf86cd799439011";
const otherCustomerId = "507f1f77bcf86cd799439012";
const employeeId = "507f1f77bcf86cd799439013";
const orders = [
  { _id: "507f1f77bcf86cd799439021", userId: customerId, status: "pending", createdAt: 1 },
  { _id: "507f1f77bcf86cd799439022", userId: otherCustomerId, status: "confirmed", createdAt: 2 },
  { _id: "507f1f77bcf86cd799439023", userId: otherCustomerId, status: "pending", createdAt: 3 },
];

test("order list permissions and pagination", async (t) => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "order-list-test-secret";
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  const matching = (filter) => orders.filter((order) =>
    Object.entries(filter).every(([key, value]) => order[key] === value));
  // Replace only database access; requests exercise the real JWT, routes and service.
  const find = t.mock.method(Order, "find", (filter) => {
    let rows = matching(filter);
    return {
      select() { return this; },
      sort(fields) {
        rows.sort((a, b) => {
          for (const [key, direction] of Object.entries(fields)) {
            if (a[key] !== b[key]) return (a[key] > b[key] ? 1 : -1) * direction;
          }
          return 0;
        });
        return this;
      },
      skip(offset) { rows = rows.slice(offset); return this; },
      limit(limit) { rows = rows.slice(0, limit); return this; },
      async lean() { return rows; },
    };
  });
  t.mock.method(Order, "countDocuments", async (filter) => matching(filter).length);

  const app = express();
  app.use("/api/orders", orderRoute);
  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  await once(server, "listening");
  const request = async (path, role, userId = employeeId) => {
    const headers = role ? {
      Authorization: `Bearer ${jwt.sign({ userId, role }, process.env.JWT_SECRET, { expiresIn: "1m" })}`,
    } : {};
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/orders${path}`, { headers });
    return { status: response.status, body: await response.json() };
  };

  await t.test("staff and admin see orders from all customers", async () => {
    for (const role of ["STAFF", "ADMIN"]) {
      const { status, body } = await request("", role);
      assert.equal(status, 200);
      assert.deepEqual(body.orders.map((order) => order._id), orders.map((order) => order._id).reverse());
      assert.deepEqual(body.pagination, { page: 1, limit: 10, totalItems: 3, totalPages: 1 });
    }
  });

  await t.test("status filtering and pagination span customers", async () => {
    const { status, body } = await request("?status=pending&page=2&limit=1", "STAFF");
    assert.equal(status, 200);
    assert.deepEqual(body.orders, [orders[0]]);
    assert.deepEqual(body.pagination, { page: 2, limit: 1, totalItems: 2, totalPages: 2 });
    const beyond = await request("?page=4&limit=1", "STAFF");
    assert.deepEqual(beyond.body.orders, []);
    assert.equal(beyond.body.pagination.totalItems, 3);
    const empty = await request("?status=cancelled", "STAFF");
    assert.deepEqual(empty.body.orders, []);
    assert.equal(empty.body.pagination.totalPages, 0);
  });

  await t.test("unauthenticated and unauthorized requests do not query orders", async () => {
    const before = find.mock.callCount();
    assert.equal((await request("", undefined)).status, 401);
    for (const role of ["CUSTOMER", "STORAGE_MANAGER"]) {
      assert.equal((await request("", role)).status, 403);
    }
    assert.equal((await request("", "STAFF", "invalid-id")).status, 401);
    assert.equal(find.mock.callCount(), before);
    await assert.rejects(orderService.getAllOrder({ userId: customerId, role: "CUSTOMER" }), { statusCode: 403 });
  });

  await t.test("invalid queries are rejected before database access", async () => {
    const before = find.mock.callCount();
    for (const query of ["page=0", "limit=101", "status=unknown", "page=1&page=2", `userId=${customerId}`]) {
      assert.equal((await request(`?${query}`, "STAFF")).status, 400, query);
    }
    assert.equal(find.mock.callCount(), before);
  });

  await t.test("customer history remains restricted to its owner", async () => {
    const { status, body } = await request("/my-orders", "CUSTOMER", customerId);
    assert.equal(status, 200);
    assert.deepEqual(body.orders, [orders[0]]);
    assert.equal(body.pagination.totalItems, 1);
    assert.equal((await request("/my-orders", "STAFF")).status, 403);
  });

  await t.test("database errors return a generic error", async () => {
    find.mock.mockImplementationOnce(() => { throw new Error("private database details"); });
    const { status, body } = await request("", "STAFF");
    assert.equal(status, 500);
    assert.deepEqual(body, { message: "Internal server error" });
  });
});

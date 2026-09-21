/**
 * @Author: Minh Truong
 * Mục đích: kiểm thử Order qua HTTP và MongoDB thật, không dùng database ứng dụng.
 * Chỉ chạy khi ORDER_TEST_MONGODB_URI được truyền từ môi trường bên ngoài.
 * Luôn ghi vào database mới có tên furniturehub_order_test_<ngẫu nhiên>.
 * Không đọc .env, không xóa document/drop database; giữ fixture để người dùng kiểm tra.
 * Bộ test kiểm tra insert thật, snapshot, quyền sở hữu và lỗi validator MongoDB.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const Order = require("../src/models/Order.model");
const Address = require("../src/models/Address.model");
const Cart = require("../src/models/Cart.model");
const ProductVariant = require("../src/models/ProductVariant.model");
const Product = require("../src/models/Product.model");
const Inventory = require("../src/models/Inventory.model");
const User = require("../src/models/User.model");

test("Order với MongoDB thật trong database thử nghiệm riêng", {
  skip: !process.env.ORDER_TEST_MONGODB_URI,
  timeout: 60000,
}, async (t) => {
  const previousSecret = process.env.JWT_SECRET;
  const dbName = `furniturehub_order_test_${randomBytes(7).toString("hex")}`;
  let server;
  try {
    await mongoose.connect(process.env.ORDER_TEST_MONGODB_URI, {
      dbName, autoIndex: false, autoCreate: false,
      serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000, monitorCommands: true,
    });
    assert.equal(mongoose.connection.name, dbName);
    assert.equal((await mongoose.connection.db.listCollections().toArray()).length, 0, "Chỉ được seed database mới, không ghi đè dữ liệu có sẵn");
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    const topology = hello.msg === "isdbgrid" ? "sharded" : hello.setName ? "replicaSet" : "standalone";
    t.diagnostic(`Database thử nghiệm giữ lại: ${dbName}; topology=${topology}`);
    const inserts = [];
    mongoose.connection.getClient().on("commandStarted", (event) => {
      if (event.databaseName === dbName && event.commandName === "insert" && event.command.insert === "orders") {
        inserts.push({ count: event.command.documents.length, itemCount: event.command.documents[0].items.length, writeConcern: event.command.writeConcern });
      }
    });
    const id = () => new mongoose.Types.ObjectId();
    const ids = { user: id(), other: id(), address: id(), cart: id(), product: id(), variant: id() };
    await User.collection.insertMany([
      { _id: ids.user, fullName: "Test Customer A", email: `${ids.user}@example.invalid`, password: "unusable-test-placeholder", role: "CUSTOMER", isActive: true },
      { _id: ids.other, fullName: "Test Customer B", email: `${ids.other}@example.invalid`, password: "unusable-test-placeholder", role: "CUSTOMER", isActive: true },
    ]);
    await Address.create({ _id: ids.address, userId: ids.user, receiverName: "Customer A", phone: "0912345678", addressLine: "123 Lê Lợi", ward: "Bến Thành", city: "Hồ Chí Minh", isDefault: false });
    await Product.collection.insertOne({ _id: ids.product, name: "Ghế thử nghiệm", isActive: true });
    await ProductVariant.create({ _id: ids.variant, productId: ids.product, sku: "ORDER-INTEGRATION", price: 1000000, isActive: true });
    await Inventory.create({ variantId: ids.variant, quantity: 10 });
    await Cart.create({ _id: ids.cart, userId: ids.user, items: [
      { variantId: ids.variant, quantity: 2, unitPrice: 100 },
      { variantId: ids.variant, quantity: 1, unitPrice: 100 },
    ] });
    process.env.JWT_SECRET = randomBytes(32).toString("hex");
    const token = jwt.sign({ userId: String(ids.user), role: "CUSTOMER" }, process.env.JWT_SECRET);
    const otherToken = jwt.sign({ userId: String(ids.other), role: "CUSTOMER" }, process.env.JWT_SECRET);
    await new Promise((resolve, reject) => {
      server = app.listen(0, "127.0.0.1", resolve);
      server.once("error", reject);
    });
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const request = async (method, path, body, auth = token) => {
      const response = await fetch(`${baseUrl}${path}`, {
        method, headers: { Authorization: `Bearer ${auth}`, "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: response.status, body: await response.json() };
    };
    const create = () => request("POST", "/api/orders", { addressId: String(ids.address) });
    let created;
    const originalCart = await Cart.findById(ids.cart).lean();
    const originalInventory = await Inventory.findOne({ variantId: ids.variant }).lean();

    await t.test("Tạo đủ Order/items bằng một insert majority; đọc lại từ database", async () => {
      const response = await create();
      assert.equal(response.status, 201);
      created = response.body.order;
      assert.equal(created.status, "pending");
      assert.equal(created.totalAmount, 3000000);
      const stored = await Order.findById(created._id).lean();
      assert.equal(stored.items.length, 2);
      assert.deepEqual(stored.items.map((item) => item.unitPrice), [1000000, 1000000]);
      assert.equal(stored.shippingAddress.addressLine, "123 Lê Lợi");
      assert.equal(inserts.length, 1);
      assert.equal(inserts[0].count, 1);
      assert.equal(inserts[0].itemCount, 2);
      assert.equal(inserts[0].writeConcern.w, "majority");
    });
    if (!created) return;

    await t.test("Customer khác không xem được Order, kể cả query userId giả", async () => {
      assert.equal((await request("GET", `/api/orders/${created._id}?userId=${ids.user}`, null, otherToken)).status, 404);
      assert.equal((await request("GET", `/api/orders/${created._id}`)).status, 200);
    });

    await t.test("Sửa địa chỉ và giá không đổi lịch sử; đơn mới dùng giá mới", async () => {
      await Address.updateOne({ _id: ids.address }, { $set: { addressLine: "Địa chỉ đã sửa" } });
      await ProductVariant.updateOne({ _id: ids.variant }, { $set: { price: 1200000 } });
      const old = (await request("GET", `/api/orders/${created._id}`)).body.order;
      assert.deepEqual(old.shippingAddress, created.shippingAddress);
      assert.deepEqual(old.items, created.items);
      assert.equal(old.totalAmount, 3000000);
      const next = await create();
      assert.equal(next.status, 201);
      assert.equal(next.body.order.totalAmount, 3600000);
      assert.equal(next.body.order.shippingAddress.addressLine, "Địa chỉ đã sửa");
    });

    await t.test("Tồn kho mới phải xét tổng các dòng, lỗi không ghi thêm Order", async () => {
      const count = await Order.countDocuments();
      await Inventory.updateOne({ variantId: ids.variant }, { $set: { quantity: 2 } });
      const response = await create();
      assert.equal(response.status, 400);
      assert.ok(response.body.errors.some((error) => error.code === "INSUFFICIENT_STOCK"));
      assert.equal(await Order.countDocuments(), count);
      await Inventory.collection.updateOne({ variantId: ids.variant }, { $set: { quantity: originalInventory.quantity, updatedAt: originalInventory.updatedAt } });
    });

    await t.test("MongoDB từ chối insert: 500, không có Order hoặc items một phần", async () => {
      const count = await Order.countDocuments();
      await mongoose.connection.db.command({ collMod: "orders", validator: { totalAmount: { $lt: 0 } } });
      try {
        const response = await create();
        assert.deepEqual(response, { status: 500, body: { message: "Internal server error" } });
        assert.equal(await Order.countDocuments(), count);
      } finally {
        await mongoose.connection.db.command({ collMod: "orders", validator: {} });
      }
    });

    await t.test("Mongoose từ chối item cuối sai trước khi gửi insert", async () => {
      const count = await Order.countDocuments();
      const commands = inserts.length;
      const data = await Order.findById(created._id).lean();
      data._id = id();
      data.items[1].quantity = 0;
      await assert.rejects(new Order(data).save({ writeConcern: { w: "majority" } }), { name: "ValidationError" });
      assert.equal(inserts.length, commands);
      assert.equal(await Order.countDocuments(), count);
    });

    await t.test("Gửi lại hiện tạo hai Order khác nhau, mỗi Order đủ items", async () => {
      const count = await Order.countDocuments();
      const responses = await Promise.all([create(), create()]);
      assert.ok(responses.every((response) => response.status === 201 && response.body.order.items.length === 2));
      assert.notEqual(responses[0].body.order._id, responses[1].body.order._id);
      assert.equal(await Order.countDocuments(), count + 2);
    });

    await t.test("Cart/Inventory nguyên vẹn và không có Payment", async () => {
      assert.deepEqual(await Cart.findById(ids.cart).lean(), originalCart);
      assert.deepEqual(await Inventory.findOne({ variantId: ids.variant }).lean(), originalInventory);
      assert.equal(await mongoose.connection.db.collection("payments").countDocuments(), 0);
    });
  } finally {
    if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await mongoose.disconnect();
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  }
});

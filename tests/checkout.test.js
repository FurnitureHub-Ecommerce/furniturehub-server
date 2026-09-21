/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Kiểm thử HTTP cho Checkout bằng node:test, không cần thư viện hoặc database mới.
 *
 * Bước 1: Tạo dữ liệu độc lập và JWT ký bằng khóa ngẫu nhiên chỉ dùng trong test.
 * Bước 2: Chạy Express, JWT, Zod, Service, Repository và populate Mongoose thật.
 * Bước 3: Thay thao tác đọc collection bằng dữ liệu mô phỏng; chặn mọi thao tác ghi.
 * Bước 4: Chạy TC01–TC17, kiểm tra biên, hồi quy Cart/Address và tài liệu Swagger.
 * Bước 5: Đóng HTTP server và khôi phục biến môi trường, không đọc hay sửa .env.
 * Giới hạn: bộ test không chứng minh kết nối hoặc hành vi MongoDB server thực tế.
 */

const { test, before, after, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const app = require("../src/app");
const { swaggerSpec } = require("../src/config/swagger");
const Cart = require("../src/models/Cart.model");
const Address = require("../src/models/Address.model");
const ProductVariant = require("../src/models/ProductVariant.model");
const Product = require("../src/models/Product.model");
const Inventory = require("../src/models/Inventory.model");

const oid = (suffix) => new mongoose.Types.ObjectId(suffix.padStart(24, "0"));
const ids = {
  customer: oid("1"), otherCustomer: oid("2"), address: oid("3"),
  otherAddress: oid("4"), cart: oid("5"), item: oid("6"),
  variant: oid("7"), product: oid("8"), missing: oid("9"), secondItem: oid("a"),
};
const { serialize, deserialize } = mongoose.mongo.BSON;
const clone = (value) => deserialize(serialize({ value })).value;
let database;
let reads;
let writeAttempts;
let server;
let baseUrl;
let customerToken;
let staffToken;
const previousSecret = process.env.JWT_SECRET;

/**
 * Tạo trạng thái hợp lệ trước mỗi test để trường hợp trước không ảnh hưởng sau.
 * Địa chỉ thứ hai thuộc Customer khác; Cart chứa đúng một Variant đang bán.
 * unitPrice cố tình khác giá hiện tại và Inventory không có bản ghi:
 * Task 2 vẫn phải thành công vì kiểm tra giá/tồn kho thuộc Task 3.
 */
const createDatabase = () => ({
  Address: [
    { _id: ids.address, userId: ids.customer, receiverName: "Customer A", phone: "0912345678", addressLine: "123 Le Loi", ward: "Ben Thanh", city: "Ho Chi Minh", isDefault: true },
    { _id: ids.otherAddress, userId: ids.otherCustomer, receiverName: "Customer B", phone: "0987654321", addressLine: "456 Nguyen Hue", ward: "Sai Gon", city: "Ho Chi Minh", isDefault: true },
  ],
  Cart: [{ _id: ids.cart, userId: ids.customer, items: [{ _id: ids.item, variantId: ids.variant, quantity: 2, unitPrice: 100 }], updatedAt: new Date("2026-01-01") }],
  ProductVariant: [{ _id: ids.variant, productId: ids.product, sku: "CHAIR-TEST", isActive: true, price: 999 }],
  Product: [{ _id: ids.product, name: "Test chair", isActive: true, images: [] }],
});

/**
 * So khớp các bộ lọc được các repository đang kiểm thử sử dụng: bằng và $in.
 * Nhận document mô phỏng và filter đã được Mongoose ép ObjectId.
 * So sánh toàn bộ trường lọc để test phát hiện việc bỏ điều kiện userId.
 * Đây chỉ là bộ đọc dữ liệu mô phỏng, không thay thế MongoDB cho kiểm thử thực tế.
 */
const matches = (document, filter) => Object.entries(filter).every(([field, value]) => {
  if (value && Array.isArray(value.$in)) {
    return value.$in.some((id) => String(document[field]) === String(id));
  }
  return String(document[field]) === String(value);
});

/**
 * Gắn mô phỏng ở collection để giữ nguyên Query và populate của Mongoose.
 * Mỗi lần đọc trả bản sao BSON, tránh populate làm biến đổi dữ liệu gốc.
 * Ghi lại filter để xác nhận Cart/Address luôn được giới hạn theo người dùng.
 * Chặn save và các thao tác ghi trên toàn bộ model; bất kỳ lần gọi nào cũng lỗi.
 * Inventory bị chặn cả đọc vì Task 2 không thực hiện kiểm tra tồn kho.
 */
const installDatabaseMocks = () => {
  for (const model of [Cart, Address, ProductVariant, Product]) {
    const read = (filter, method) => {
      reads.push({ model: model.modelName, method, filter: clone(filter) });
      return database[model.modelName].filter((document) => matches(document, filter)).map(clone);
    };
    mock.method(model.collection, "findOne", async (filter) => read(filter, "findOne")[0] || null);
    mock.method(model.collection, "find", (filter) => ({ toArray: async () => read(filter, "find") }));
  }

  const rejectWrite = () => {
    writeAttempts += 1;
    throw new Error("Checkout must not write data");
  };
  mock.method(mongoose.Model.prototype, "save", rejectWrite);
  for (const model of Object.values(mongoose.models)) {
    for (const method of ["insertOne", "insertMany", "updateOne", "updateMany", "replaceOne", "deleteOne", "deleteMany", "findOneAndUpdate", "findOneAndDelete", "bulkWrite"]) {
      mock.method(model.collection, method, rejectWrite);
    }
  }
  for (const method of ["findOne", "find", "aggregate"]) {
    mock.method(Inventory.collection, method, () => {
      reads.push({ model: "Inventory", method });
      throw new Error("Task 2 must not query Inventory");
    });
  }
};

before(async () => {
  process.env.JWT_SECRET = randomBytes(32).toString("hex");
  customerToken = jwt.sign({ userId: String(ids.customer), role: "CUSTOMER" }, process.env.JWT_SECRET, { expiresIn: "5m" });
  staffToken = jwt.sign({ userId: String(ids.customer), role: "STAFF" }, process.env.JWT_SECRET, { expiresIn: "5m" });
  await new Promise((resolve, reject) => {
    server = app.listen(0, "127.0.0.1", resolve);
    server.once("error", reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(() => {
  database = createDatabase();
  reads = [];
  writeAttempts = 0;
  installDatabaseMocks();
});

afterEach(() => {
  mock.restoreAll();
  assert.equal(writeAttempts, 0, "Checkout không được ghi dữ liệu");
  assert.equal(reads.some((read) => read.model === "Inventory"), false);
});

after(async () => {
  if (previousSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previousSecret;
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

/**
 * Gửi request HTTP thật với body/token tùy biến và đọc JSON trả về.
 * Mặc định dùng Customer hợp lệ; token=null biểu diễn không có Authorization.
 * Có thể thêm query để kiểm tra userId/cartId phía client không chọn được giỏ khác.
 */
const checkout = async (body = { addressId: String(ids.address) }, token = customerToken, query = "") => {
  const response = await fetch(`${baseUrl}/api/checkout/validate${query}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
};

/**
 * Xác nhận lỗi CartItem trả 400, valid=false và đúng dòng bị lỗi.
 * Đầu vào là response HTTP và mã lỗi mong đợi; lỗi khác không được tính là đạt.
 */
const assertItemError = (response, code) => {
  assert.equal(response.status, 400);
  assert.equal(response.body.valid, false);
  assert.equal(response.body.message, "Cart is invalid for checkout");
  const error = response.body.errors.find((entry) => entry.code === code);
  assert.ok(error, `Thiếu mã lỗi ${code}`);
  assert.equal(error.itemId, String(ids.item));
  assert.equal(typeof error.message, "string");
};

test("TC01: Cart và Address hợp lệ; không tính giá hoặc đọc tồn kho", async () => {
  const beforeRequest = clone(database);
  assert.deepEqual(await checkout(), { status: 200, body: { message: "Cart is valid for checkout", valid: true } });
  assert.deepEqual(database, beforeRequest);
  const addressRead = reads.find((entry) => entry.model === "Address");
  assert.equal(String(addressRead.filter._id), String(ids.address));
  assert.equal(String(addressRead.filter.userId), String(ids.customer));
  const cartRead = reads.find((entry) => entry.model === "Cart");
  assert.deepEqual(Object.keys(cartRead.filter), ["userId"]);
  assert.equal(String(cartRead.filter.userId), String(ids.customer));
});

test("TC02: Thiếu JWT trả 401 trước khi truy vấn", async () => {
  assert.deepEqual(await checkout({}, null), { status: 401, body: { message: "Access token is required" } });
  assert.equal(reads.length, 0);
});

test("TC03: JWT không hợp lệ trả 401", async () => {
  assert.deepEqual(await checkout({}, "invalid-token"), { status: 401, body: { message: "Invalid or expired token" } });
  assert.equal(reads.length, 0);
});

test("TC04: STAFF trả 403 trước khi kiểm tra body hoặc truy vấn", async () => {
  assert.deepEqual(await checkout({}, staffToken), { status: 403, body: { message: "Forbidden: insufficient permission" } });
  assert.equal(reads.length, 0);
});

test("TC05: Thiếu addressId trả lỗi Zod 400", async () => {
  const response = await checkout({});
  assert.equal(response.status, 400);
  assert.equal(response.body.message, "Validation failed");
  assert.deepEqual(response.body.errors[0].path, ["addressId"]);
  assert.equal(reads.length, 0);
});

test("TC06: addressId sai định dạng trả 400", async () => {
  const response = await checkout({ addressId: "invalid-id" });
  assert.equal(response.status, 400);
  assert.equal(response.body.errors[0].message, "Invalid address ID");
  assert.equal(reads.length, 0);
});

test("TC07: Address không tồn tại trả 404", async () => {
  assert.deepEqual(await checkout({ addressId: String(ids.missing) }), { status: 404, body: { message: "Không tìm thấy địa chỉ" } });
  assert.equal(reads.length, 1);
});

test("TC08: Address của người khác trả cùng lỗi 404", async () => {
  assert.deepEqual(await checkout({ addressId: String(ids.otherAddress) }), { status: 404, body: { message: "Không tìm thấy địa chỉ" } });
  assert.equal(reads.length, 1);
  assert.equal(String(reads[0].filter.userId), String(ids.customer));
});

test("TC09: Chưa có Cart trả 400 và không tạo Cart", async () => {
  database.Cart = [];
  assert.deepEqual(await checkout(), { status: 400, body: { message: "Cart not found", valid: false } });
  assert.deepEqual(database.Cart, []);
});

test("TC10: Cart rỗng trả 400", async () => {
  database.Cart[0].items = [];
  assert.deepEqual(await checkout(), { status: 400, body: { message: "Cart is empty", valid: false } });
});

test("TC11: Variant đã xóa vẫn trả itemId để frontend xác định dòng lỗi", async () => {
  database.ProductVariant = [];
  const response = await checkout();
  assertItemError(response, "VARIANT_NOT_FOUND");
  assert.equal(response.body.errors[0].variantId, null);
});

test("TC12: Variant ngừng bán", async () => {
  database.ProductVariant[0].isActive = false;
  assertItemError(await checkout(), "VARIANT_INACTIVE");
});

test("TC13: Product đã xóa", async () => {
  database.Product = [];
  assertItemError(await checkout(), "PRODUCT_NOT_FOUND");
});

test("TC14: Product ngừng bán", async () => {
  database.Product[0].isActive = false;
  assertItemError(await checkout(), "PRODUCT_INACTIVE");
});

test("TC15: quantity bằng 0", async () => {
  database.Cart[0].items[0].quantity = 0;
  assertItemError(await checkout(), "INVALID_QUANTITY");
});

test("TC16: quantity âm", async () => {
  database.Cart[0].items[0].quantity = -1;
  assertItemError(await checkout(), "INVALID_QUANTITY");
});

test("TC17: Gửi userId của người khác bị từ chối 400", async () => {
  const response = await checkout({ addressId: String(ids.address), userId: String(ids.otherCustomer) });
  assert.equal(response.status, 400);
  assert.equal(response.body.message, "Validation failed");
  assert.equal(response.body.errors[0].code, "unrecognized_keys");
  assert.deepEqual(response.body.errors[0].keys, ["userId"]);
  assert.equal(reads.length, 0);
});

test("Chặn mọi trường ngoài addressId, kể cả giá và tồn kho", async () => {
  for (const field of ["cartId", "price", "unitPrice", "totalAmount", "stockQuantity", "quantity", "extra"]) {
    const response = await checkout({ addressId: String(ids.address), [field]: 123 });
    assert.equal(response.status, 400);
    assert.deepEqual(response.body.errors[0].keys, [field]);
  }
  assert.equal(reads.length, 0);
});

test("Từ chối addressId rỗng, sai kiểu và body sai cấu trúc", async () => {
  for (const body of [{ addressId: "" }, { addressId: 123 }, { addressId: null }, { addressId: {} }, []]) {
    assert.equal((await checkout(body)).status, 400);
  }
  assert.equal(reads.length, 0);
});

test("Từ chối quantity thập phân, chuỗi số, null hoặc thiếu", async () => {
  for (const value of [1.5, "2", null, undefined]) {
    database.Cart[0].items[0].quantity = value;
    assertItemError(await checkout(), "INVALID_QUANTITY");
  }
});

test("Tham chiếu Variant thiếu hoặc sai định dạng trả lỗi nghiệp vụ", async () => {
  for (const value of [null, undefined, "invalid-id"]) {
    database.Cart[0].items[0].variantId = value;
    assertItemError(await checkout(), "VARIANT_NOT_FOUND");
  }
});

test("Tham chiếu Product thiếu hoặc sai định dạng trả lỗi nghiệp vụ", async () => {
  for (const value of [null, undefined, "invalid-id"]) {
    database.ProductVariant[0].productId = value;
    assertItemError(await checkout(), "PRODUCT_NOT_FOUND");
  }
});

test("Trạng thái thiếu hoặc sai kiểu không được xem là đang bán", async () => {
  for (const modelName of ["ProductVariant", "Product"]) {
    for (const value of [undefined, null, "true", 1]) {
      database = createDatabase();
      database[modelName][0].isActive = value;
      assertItemError(await checkout(), modelName === "ProductVariant" ? "VARIANT_INACTIVE" : "PRODUCT_INACTIVE");
    }
  }
});

test("Gom lỗi của nhiều item và không sửa hoặc xóa dữ liệu", async () => {
  database.Cart[0].items[0].quantity = -2;
  database.ProductVariant[0].isActive = false;
  database.Product[0].isActive = false;
  database.Cart[0].items.push({ _id: ids.secondItem, variantId: ids.missing, quantity: 0, unitPrice: 100 });
  const beforeRequest = clone(database);
  const response = await checkout();
  assertItemError(response, "INVALID_QUANTITY");
  assert.equal(response.body.errors.length, 5);
  assert.equal(response.body.errors.filter((entry) => entry.itemId === String(ids.secondItem)).length, 2);
  assert.deepEqual(database, beforeRequest);
});

test("Query userId/cartId không chọn được giỏ hàng người khác", async () => {
  database.Cart[0].userId = ids.otherCustomer;
  const response = await checkout(undefined, customerToken, `?userId=${ids.otherCustomer}&cartId=${ids.cart}`);
  assert.deepEqual(response, { status: 400, body: { message: "Cart not found", valid: false } });
});

test("JWT hết hạn và chữ ký sai đều trả 401", async () => {
  const payload = { userId: String(ids.customer), role: "CUSTOMER" };
  const expired = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: -1 });
  const wrongSignature = jwt.sign(payload, randomBytes(32));
  for (const token of [expired, wrongSignature]) assert.equal((await checkout({}, token)).status, 401);
  assert.equal(reads.length, 0);
});

test("ADMIN, STORAGE và STORAGE_MANAGER đều bị chặn", async () => {
  for (const role of ["ADMIN", "STORAGE", "STORAGE_MANAGER"]) {
    const token = jwt.sign({ userId: String(ids.customer), role }, process.env.JWT_SECRET);
    assert.equal((await checkout({}, token)).status, 403);
  }
  assert.equal(reads.length, 0);
});

test("Lỗi database trả 500 và ẩn thông tin nội bộ", async () => {
  mock.method(Address.collection, "findOne", async () => { throw new Error("private database error details"); });
  assert.deepEqual(await checkout(), { status: 500, body: { message: "Internal server error" } });
});

test("Hồi quy GET Cart vẫn trả tổng tiền và item đã populate", async () => {
  const response = await fetch(`${baseUrl}/api/cart`, { headers: { Authorization: `Bearer ${customerToken}` } });
  assert.equal(response.status, 200);
  const { cart } = await response.json();
  assert.equal(cart.totalAmount, 200);
  assert.equal(cart.totalQuantity, 2);
  assert.equal(cart.items[0].itemSubtotal, 200);
  assert.equal(cart.items[0].variantId.productId.name, "Test chair");
});

test("Hồi quy GET Address vẫn chỉ trả địa chỉ thuộc Customer", async () => {
  const response = await fetch(`${baseUrl}/api/addresses`, { headers: { Authorization: `Bearer ${customerToken}` } });
  assert.equal(response.status, 200);
  const { addresses } = await response.json();
  assert.equal(addresses.length, 1);
  assert.equal(addresses[0]._id, String(ids.address));
  assert.equal(addresses[0].isDefault, true);
});

test("Swagger phục vụ được và khai báo đầy đủ endpoint Checkout", async () => {
  const response = await fetch(`${baseUrl}/api-docs/`);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /swagger-ui/i);
  const operation = swaggerSpec.paths["/api/checkout/validate"].post;
  assert.deepEqual(operation.security, [{ bearerAuth: [] }]);
  assert.deepEqual(Object.keys(operation.responses), ["200", "400", "401", "403", "404", "500"]);
  assert.equal(swaggerSpec.components.schemas.CheckoutInput.additionalProperties, false);
  assert.ok(swaggerSpec.paths["/api/cart"].get);
  assert.ok(swaggerSpec.paths["/api/addresses"].get);
});

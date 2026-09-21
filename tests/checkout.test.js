/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Kiểm thử HTTP cho Checkout bằng node:test, không cần thư viện hoặc database mới.
 *
 * Bước 1: Tạo dữ liệu độc lập và JWT ký bằng khóa ngẫu nhiên chỉ dùng trong test.
 * Bước 2: Chạy Express, JWT, Zod, Service, Repository và populate Mongoose thật.
 * Bước 3: Thay thao tác đọc collection bằng dữ liệu mô phỏng; chặn mọi thao tác ghi.
 * Bước 4: Chạy Task 2 và TC01–TC22 Task 3, kiểm tra biên tiền/tồn kho và hồi quy.
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
 * unitPrice cố tình khác giá hiện tại để phát hiện việc dùng snapshot tính checkout.
 * Inventory đủ hàng; mỗi test thay đổi bản sao để kiểm tra điều kiện thất bại.
 */
const createDatabase = () => ({
  Address: [
    { _id: ids.address, userId: ids.customer, receiverName: "Customer A", phone: "0912345678", addressLine: "123 Le Loi", ward: "Ben Thanh", city: "Ho Chi Minh", isDefault: true },
    { _id: ids.otherAddress, userId: ids.otherCustomer, receiverName: "Customer B", phone: "0987654321", addressLine: "456 Nguyen Hue", ward: "Sai Gon", city: "Ho Chi Minh", isDefault: true },
  ],
  Cart: [{ _id: ids.cart, userId: ids.customer, items: [{ _id: ids.item, variantId: ids.variant, quantity: 2, unitPrice: 100 }], updatedAt: new Date("2026-01-01") }],
  ProductVariant: [{ _id: ids.variant, productId: ids.product, sku: "CHAIR-TEST", isActive: true, price: 999 }],
  Product: [{ _id: ids.product, name: "Test chair", isActive: true, images: [] }],
  Inventory: [{ _id: oid("b"), variantId: ids.variant, quantity: 10 }],
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
 * Inventory cũng được đọc qua Mongoose thật để kiểm tra quantity và truy vấn trùng.
 */
const installDatabaseMocks = () => {
  for (const model of [Cart, Address, ProductVariant, Product, Inventory]) {
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
  const beforeRequest = structuredClone(database);
  const response = await fetch(`${baseUrl}/api/checkout/validate${query}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const result = { status: response.status, body: await response.json() };
  assert.deepEqual(structuredClone(database), beforeRequest, "Checkout không được thay đổi dữ liệu");
  return result;
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

test("TC01 / T3-TC01: Cart hợp lệ, tính giá hiện tại và kiểm tra tồn kho", async () => {
  const beforeRequest = clone(database);
  assert.deepEqual(await checkout(), { status: 200, body: {
    message: "Cart is valid for checkout", valid: true,
    items: [{ itemId: String(ids.item), variantId: String(ids.variant), quantity: 2,
      requestedQuantity: 2, availableStock: 10, unitPrice: 999, itemSubtotal: 1998,
      stockValid: true, valid: true }], totalAmount: 1998,
  } });
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
  for (const field of ["cartId", "price", "unitPrice", "totalPrice", "subtotal", "grandTotal", "totalAmount", "stockQuantity", "quantity", "extra"]) {
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
  assert.ok(operation.responses[400].content["application/json"].examples.insufficientStock);
  assert.ok(swaggerSpec.components.schemas.CheckoutResult.required.includes("totalAmount"));
});

/**
 * Các ca Task 3 dưới đây kiểm tra dữ liệu trả về, không chỉ kiểm tra mã HTTP.
 * Lỗi từng item phải giữ ID, valid=false và totalAmount=null để tránh dùng tổng dở dang.
 * Dữ liệu hỏng được đưa vào collection mô phỏng để không bị schema tự sửa trước test.
 * Các ca JWT/role/quyền sở hữu/Cart rỗng/Variant và Product phía trên được dùng lại.
 */
test("T3-TC04: Số lượng bằng tồn kho vẫn hợp lệ", async () => {
  database.Inventory[0].quantity = 2;
  const response = await checkout();
  assert.equal(response.status, 200);
  assert.equal(response.body.items[0].stockValid, true);
});

test("T3-TC05/06: Thiếu hàng và hết hàng trả lượng tồn thực tế", async () => {
  for (const stock of [1, 0]) {
    database.Inventory[0].quantity = stock;
    const response = await checkout();
    assertItemError(response, "INSUFFICIENT_STOCK");
    assert.equal(response.body.totalAmount, null);
    assert.equal(response.body.items[0].availableStock, stock);
    assert.equal(response.body.items[0].requestedQuantity, 2);
    assert.equal(response.body.items[0].stockValid, false);
  }
});

test("T3-TC07: Inventory thiếu được phân biệt với tồn kho 0", async () => {
  database.Inventory = [];
  const response = await checkout();
  assertItemError(response, "INVENTORY_NOT_FOUND");
  assert.equal(response.body.items[0].availableStock, null);
  assert.equal(response.body.totalAmount, null);
});

test("T3: Inventory quantity sai kiểu, thiếu, âm, lẻ hoặc vượt giới hạn", async () => {
  for (const value of [undefined, null, "10", -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    database.Inventory[0].quantity = value;
    const response = await checkout();
    assertItemError(response, "INVALID_STOCK");
    assert.equal(response.body.items[0].availableStock, null);
    assert.equal(response.body.totalAmount, null);
  }
});

/**
 * Thêm Variant độc lập, số lượng 3 và giá hiện tại 2000 để kiểm tra tổng nhiều dòng.
 * Snapshot cố tình bằng 1; Product dùng lại vì hai Variant có thể cùng một sản phẩm.
 */
const addSecondVariant = () => {
  const variantId = oid("c");
  database.ProductVariant.push({ _id: variantId, productId: ids.product, isActive: true, price: 2000 });
  database.Inventory.push({ _id: oid("d"), variantId, quantity: 3 });
  database.Cart[0].items.push({ _id: ids.secondItem, variantId, quantity: 3, unitPrice: 1 });
};

test("T3-TC12: Tổng bằng tổng thành tiền của nhiều Variant", async () => {
  addSecondVariant();
  const response = await checkout();
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.items.map((item) => item.itemSubtotal), [1998, 6000]);
  assert.equal(response.body.totalAmount, 7998);
});

test("T3-TC13: Một dòng thiếu hàng làm cả Cart không hợp lệ", async () => {
  addSecondVariant();
  database.Inventory[1].quantity = 1;
  const response = await checkout();
  assert.equal(response.status, 400);
  assert.equal(response.body.valid, false);
  assert.equal(response.body.totalAmount, null);
  assert.equal(response.body.items.length, 2);
  assert.equal(response.body.items[0].valid, true);
  assert.equal(response.body.items[1].valid, false);
  assert.equal(response.body.errors[0].itemId, String(ids.secondItem));
});

test("T3-TC14: Giá thay đổi được đọc lại, Cart vẫn dùng snapshot cũ", async () => {
  database.Cart[0].items[0].unitPrice = 1000000;
  database.ProductVariant[0].price = 1200000;
  assert.equal((await checkout()).body.totalAmount, 2400000);
  database.ProductVariant[0].price = 1500000;
  assert.equal((await checkout()).body.totalAmount, 3000000);
  const response = await fetch(`${baseUrl}/api/cart`, { headers: { Authorization: `Bearer ${customerToken}` } });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).cart.totalAmount, 2000000);
});

test("T3-TC15: Giá thiếu, sai kiểu, âm, vô hạn hoặc vượt giới hạn", async () => {
  for (const price of [undefined, null, "999", -1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    database.ProductVariant[0].price = price;
    const response = await checkout();
    assertItemError(response, "INVALID_PRICE");
    assert.equal(response.body.items[0].unitPrice, null);
    assert.equal(response.body.items[0].itemSubtotal, null);
    assert.equal(response.body.totalAmount, null);
  }
});

test("T3: Giá bằng 0 hợp lệ theo schema", async () => {
  database.ProductVariant[0].price = 0;
  const response = await checkout();
  assert.equal(response.status, 200);
  assert.equal(response.body.totalAmount, 0);
});

test("T3: Nhân và cộng giá thập phân không gây sai số số thực", async () => {
  addSecondVariant();
  database.ProductVariant[0].price = 0.1;
  database.ProductVariant[1].price = 0.2;
  const response = await checkout();
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.items.map((item) => item.itemSubtotal), [0.2, 0.6]);
  assert.equal(response.body.totalAmount, 0.8);
  database.ProductVariant[0].price = 1e-7;
  database.ProductVariant[1].price = 1e-7;
  assert.equal((await checkout()).body.totalAmount, 5e-7);
});

test("T3: Thành tiền và tổng vượt giới hạn không được xác nhận", async () => {
  database.ProductVariant[0].price = Number.MAX_SAFE_INTEGER;
  const invalidLine = await checkout();
  assertItemError(invalidLine, "INVALID_ITEM_TOTAL");
  assert.equal(invalidLine.body.totalAmount, null);
  database.Cart[0].items[0].quantity = 1;
  addSecondVariant();
  const invalidTotal = await checkout();
  assert.equal(invalidTotal.status, 400);
  assert.equal(invalidTotal.body.totalAmount, null);
  assert.ok(invalidTotal.body.errors.some((error) => error.code === "INVALID_TOTAL"));
});

test("T3: Từ chối tiền bị mất chữ số khi đổi về JSON Number", async () => {
  database.ProductVariant[0].price = 0.1234567890123456;
  database.Cart[0].items[0].quantity = 9;
  assertItemError(await checkout(), "INVALID_ITEM_TOTAL");
});

test("T3-TC21: Gọi lặp lại không thay đổi Cart, giá hoặc tồn kho", async () => {
  const beforeRequest = clone(database);
  const first = await checkout();
  const second = await checkout();
  assert.equal(first.status, 200);
  assert.deepEqual(first, second);
  assert.deepEqual(database, beforeRequest);
});

test("T3-TC22: Gộp Variant trùng và chỉ đọc Inventory một lần", async () => {
  database.Cart[0].items.push({ _id: ids.secondItem, variantId: ids.variant, quantity: 2, unitPrice: 10 });
  database.Inventory[0].quantity = 3;
  const response = await checkout();
  assertItemError(response, "INSUFFICIENT_STOCK");
  assert.equal(response.body.errors.length, 2);
  assert.ok(response.body.items.every((item) => item.requestedQuantity === 4 && !item.stockValid));
  assert.equal(reads.filter((read) => read.model === "Inventory").length, 1);
  database.Inventory[0].quantity = 4;
  const validResponse = await checkout();
  assert.equal(validResponse.status, 200);
  assert.equal(validResponse.body.totalAmount, 3996);
});

test("T3: Số lượng riêng lẻ và số lượng gộp phải an toàn", async () => {
  database.Cart[0].items[0].quantity = Number.MAX_SAFE_INTEGER + 1;
  assertItemError(await checkout(), "INVALID_QUANTITY");
  database.Cart[0].items[0].quantity = Number.MAX_SAFE_INTEGER;
  database.ProductVariant[0].price = 0;
  database.Inventory[0].quantity = Number.MAX_SAFE_INTEGER;
  database.Cart[0].items.push({ _id: ids.secondItem, variantId: ids.variant, quantity: 1, unitPrice: 0 });
  const response = await checkout();
  assertItemError(response, "INVALID_QUANTITY_TOTAL");
  assert.ok(response.body.items.every((item) => !item.stockValid));
});

test("T3: Dòng CartItem null vẫn được báo lỗi", async () => {
  database.Cart[0].items.push(null);
  const response = await checkout();
  assert.equal(response.status, 400);
  assert.equal(response.body.items.length, 2);
  assert.equal(response.body.items[1].valid, false);
  assert.equal(response.body.totalAmount, null);
});

test("T3: Lỗi database khi đọc Inventory được ẩn trong response 500", async () => {
  mock.method(Inventory.collection, "findOne", async () => { throw new Error("private inventory connection string"); });
  assert.deepEqual(await checkout(), { status: 500, body: { message: "Internal server error" } });
});

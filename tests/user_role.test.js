/**
 * @Author: Minh Truong
 *
 * File test tự động kiểm thử toàn bộ 12 test case theo yêu cầu:
 * 1. ADMIN tạo STAFF -> 201
 * 2. ADMIN tạo STORAGE_MANAGER -> 201
 * 3. ADMIN cố tạo ADMIN -> 400
 * 4. ADMIN cố tạo CUSTOMER -> 400
 * 5. STAFF cố tạo STAFF -> 403
 * 6. STORAGE_MANAGER cố tạo STAFF -> 403
 * 7. CUSTOMER cố tạo STAFF -> 403
 * 8. Không gửi token -> 401
 * 9. Tạo user với email đã tồn tại -> 400
 * 10. Role không hợp lệ -> 400
 * 11. /api/auth/register vẫn tạo CUSTOMER bình thường -> 201 + role CUSTOMER
 * 12. Client gửi role STAFF vào /api/auth/register -> role CUSTOMER (không thể tạo STAFF)
 */

const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-key-furniturehub-123";

const app = require("../src/app");
const userRepository = require("../src/repositories/user.repository");
const ROLES = require("../src/constants/roles");

describe("Phân quyền tạo tài khoản người dùng và đăng ký", () => {
  let server;
  let baseUrl;
  let adminToken;
  let staffToken;
  let storageManagerToken;
  let customerToken;

  // Giả lập cơ sở dữ liệu in-memory cho test
  let usersDb = [];

  before(async () => {
    // Tạo token cho từng vai trò
    adminToken = jwt.sign(
      { userId: "60c72b2f9b1d8b2bad000001", role: ROLES.ADMIN },
      process.env.JWT_SECRET
    );
    staffToken = jwt.sign(
      { userId: "60c72b2f9b1d8b2bad000002", role: ROLES.STAFF },
      process.env.JWT_SECRET
    );
    storageManagerToken = jwt.sign(
      { userId: "60c72b2f9b1d8b2bad000003", role: ROLES.STORAGE_MANAGER },
      process.env.JWT_SECRET
    );
    customerToken = jwt.sign(
      { userId: "60c72b2f9b1d8b2bad000004", role: ROLES.CUSTOMER },
      process.env.JWT_SECRET
    );

    // Mock tầng repository để kiểm thử logic cô lập và nhanh chóng
    userRepository.findByEmail = async (email) => {
      return usersDb.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
    };

    userRepository.createUser = async (userData) => {
      const created = {
        _id: "60c72b2f9b1d8b2bad" + (usersDb.length + 10).toString().padStart(6, "0"),
        ...userData,
        isActive: true,
      };
      usersDb.push(created);
      return created;
    };

    // Khởi động server trên cổng ngẫu nhiên
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(() => {
    if (server) {
      server.close();
    }
  });

  beforeEach(() => {
    // Reset database trước mỗi test case
    usersDb = [
      {
        _id: "60c72b2f9b1d8b2bad000099",
        fullName: "Existing User",
        email: "existing@gmail.com",
        role: ROLES.CUSTOMER,
        isActive: true,
      },
    ];
  });

  // Test 1: ADMIN tạo STAFF
  test("1. ADMIN tạo STAFF thành công (201)", async () => {
    const res = await fetch(`${baseUrl}/api/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        fullName: "Staff FurnitureHub",
        email: "staff1@gmail.com",
        password: "password123",
        phone: "0123456789",
        role: ROLES.STAFF,
      }),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 201);
    assert.strictEqual(data.message, "User created successfully");
    assert.strictEqual(data.user.role, ROLES.STAFF);
    assert.strictEqual(data.user.email, "staff1@gmail.com");
    assert.strictEqual(data.user.fullName, "Staff FurnitureHub");
    assert.strictEqual(data.user.isActive, true);
    assert.strictEqual(data.user.password, undefined, "Không được trả về mật khẩu");
  });

  // Test 2: ADMIN tạo STORAGE_MANAGER
  test("2. ADMIN tạo STORAGE_MANAGER thành công (201)", async () => {
    const res = await fetch(`${baseUrl}/api/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        fullName: "Storage Manager",
        email: "storage1@gmail.com",
        password: "password123",
        phone: "0123456789",
        role: ROLES.STORAGE_MANAGER,
      }),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 201);
    assert.strictEqual(data.message, "User created successfully");
    assert.strictEqual(data.user.role, ROLES.STORAGE_MANAGER);
    assert.strictEqual(data.user.email, "storage1@gmail.com");
    assert.strictEqual(data.user.isActive, true);
    assert.strictEqual(data.user.password, undefined, "Không được trả về mật khẩu");
  });

  // Test 3: ADMIN cố tạo ADMIN
  test("3. ADMIN cố tạo ADMIN bị từ chối (400)", async () => {
    const res = await fetch(`${baseUrl}/api/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        fullName: "Another Admin",
        email: "admin2@gmail.com",
        password: "password123",
        phone: "0123456789",
        role: ROLES.ADMIN,
      }),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(
      data.message,
      "Admin can only create STAFF or STORAGE_MANAGER accounts"
    );
  });

  // Test 4: ADMIN cố tạo CUSTOMER
  test("4. ADMIN cố tạo CUSTOMER bị từ chối (400)", async () => {
    const res = await fetch(`${baseUrl}/api/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        fullName: "Customer via Admin",
        email: "customer_via_admin@gmail.com",
        password: "password123",
        phone: "0123456789",
        role: ROLES.CUSTOMER,
      }),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(
      data.message,
      "Admin can only create STAFF or STORAGE_MANAGER accounts"
    );
  });

  // Test 5: STAFF cố tạo STAFF
  test("5. STAFF cố tạo STAFF bị từ chối (403)", async () => {
    const res = await fetch(`${baseUrl}/api/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${staffToken}`,
      },
      body: JSON.stringify({
        fullName: "Staff Created By Staff",
        email: "staff_by_staff@gmail.com",
        password: "password123",
        phone: "0123456789",
        role: ROLES.STAFF,
      }),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 403);
    assert.strictEqual(data.message, "Forbidden: insufficient permission");
  });

  // Test 6: STORAGE_MANAGER cố tạo STAFF
  test("6. STORAGE_MANAGER cố tạo STAFF bị từ chối (403)", async () => {
    const res = await fetch(`${baseUrl}/api/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${storageManagerToken}`,
      },
      body: JSON.stringify({
        fullName: "Staff Created By SM",
        email: "staff_by_sm@gmail.com",
        password: "password123",
        phone: "0123456789",
        role: ROLES.STAFF,
      }),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 403);
    assert.strictEqual(data.message, "Forbidden: insufficient permission");
  });

  // Test 7: CUSTOMER cố tạo STAFF
  test("7. CUSTOMER cố tạo STAFF bị từ chối (403)", async () => {
    const res = await fetch(`${baseUrl}/api/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        fullName: "Staff Created By Customer",
        email: "staff_by_cust@gmail.com",
        password: "password123",
        phone: "0123456789",
        role: ROLES.STAFF,
      }),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 403);
    assert.strictEqual(data.message, "Forbidden: insufficient permission");
  });

  // Test 8: Không gửi token
  test("8. Không gửi token khi gọi API tạo user bị từ chối (401)", async () => {
    const res = await fetch(`${baseUrl}/api/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fullName: "Anonymous Staff",
        email: "anon@gmail.com",
        password: "password123",
        phone: "0123456789",
        role: ROLES.STAFF,
      }),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 401);
    assert.strictEqual(data.message, "Access token is required");
  });

  // Test 9: Tạo user với email đã tồn tại
  test("9. Tạo user với email đã tồn tại bị từ chối (400)", async () => {
    const res = await fetch(`${baseUrl}/api/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        fullName: "Duplicate Email Staff",
        email: "existing@gmail.com",
        password: "password123",
        phone: "0123456789",
        role: ROLES.STAFF,
      }),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(data.message, "Email already exists");
  });

  // Test 10: Role không hợp lệ
  test("10. Role không hợp lệ bị từ chối (400)", async () => {
    const res = await fetch(`${baseUrl}/api/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        fullName: "Invalid Role Staff",
        email: "invalid_role@gmail.com",
        password: "password123",
        phone: "0123456789",
        role: "SUPER_ADMIN",
      }),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(
      data.message,
      "Admin can only create STAFF or STORAGE_MANAGER accounts"
    );
  });

  // Test 11: /api/auth/register vẫn tạo CUSTOMER bình thường
  test("11. /api/auth/register vẫn tạo CUSTOMER bình thường (201)", async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fullName: "New Customer",
        email: "new_customer@gmail.com",
        password: "password123",
        phone: "0987654321",
      }),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 201);
    assert.strictEqual(data.message, "Register successfully");
    assert.strictEqual(data.user.role, ROLES.CUSTOMER);
    assert.strictEqual(data.user.email, "new_customer@gmail.com");
  });

  // Test 12: Client gửi role STAFF vào /api/auth/register
  test("12. Client gửi role STAFF vào /api/auth/register vẫn tạo CUSTOMER (không thể tạo STAFF)", async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fullName: "Malicious Customer Trying Staff",
        email: "trying_staff@gmail.com",
        password: "password123",
        phone: "0987654321",
        role: "STAFF",
      }),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 201);
    assert.strictEqual(data.message, "Register successfully");
    assert.strictEqual(data.user.role, ROLES.CUSTOMER);
    assert.notStrictEqual(data.user.role, ROLES.STAFF);
  });
});

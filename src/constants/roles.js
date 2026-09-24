/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Định nghĩa hằng số các vai trò (roles) trong hệ thống FurnitureHub.
 * Hệ thống hiện tại có 4 vai trò chính:
 * 1. CUSTOMER: Khách hàng mua sắm, được phép tự đăng ký tài khoản qua API public /api/auth/register.
 * 2. STAFF: Nhân viên bán hàng / xử lý đơn, KHÔNG được tự đăng ký, chỉ ADMIN mới được tạo.
 * 3. STORAGE_MANAGER: Thủ kho quản lý xuất/nhập/tồn, KHÔNG được tự đăng ký, chỉ ADMIN mới được tạo.
 * 4. ADMIN: Quản trị viên hệ thống có toàn quyền, KHÔNG được tạo qua bất kỳ API public nào.
 */

const ROLES = {
  CUSTOMER: "CUSTOMER",
  STAFF: "STAFF",
  STORAGE_MANAGER: "STORAGE_MANAGER",
  ADMIN: "ADMIN",
};

module.exports = ROLES;

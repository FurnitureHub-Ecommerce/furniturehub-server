/**
 * @Author: Minh Truong
 *
 * Mục đích file:
 * Controller tiếp nhận yêu cầu HTTP và trả phản hồi cho Dashboard API.
 * Controller tuân thủ kiến trúc phân tầng mỏng:
 * - Tiếp nhận request từ router sau khi đã vượt qua xác thực và phân quyền (ADMIN only).
 * - Gọi tầng service (dashboardService.getStatistics()) để lấy số liệu tổng hợp.
 * - Trả về HTTP 200 kèm payload dữ liệu chuẩn hóa dạng { success: true, data: { ... } }.
 * - Tuyệt đối không trả document thô của User/Product/Order/Payment ra response để tránh lộ dữ liệu cá nhân.
 * - Bắt lỗi (try...catch) nếu có bất kỳ truy vấn cơ sở dữ liệu nào thất bại: trả về HTTP 500 kèm message "Internal server error",
 *   không trả số liệu một phần (partial data) và không rò rỉ stack trace hay URI cơ sở dữ liệu.
 */

const dashboardService = require("../services/dashboard.service");

/**
 * Lấy dữ liệu thống kê tổng hợp cho trang Dashboard.
 *
 * @param {import("express").Request} req - Express request object (chứa thông tin xác thực từ authMiddleware)
 * @param {import("express").Response} res - Express response object
 * @returns {Promise<import("express").Response>} Phản hồi JSON chứa số liệu thống kê hoặc lỗi
 */
const getStatistics = async (req, res) => {
  try {
    const data = await dashboardService.getStatistics();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    // Không rò rỉ chi tiết lỗi database hay secret information ra client.
    return res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = { getStatistics };

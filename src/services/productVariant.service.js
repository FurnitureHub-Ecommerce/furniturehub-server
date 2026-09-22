/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Xử lý nghiệp vụ quản lý biến thể sản phẩm và SKU.
 *
 * Bước 1: Import các thư viện và Repository.
 * Bước 2: Tạo hàm xử lý lỗi nghiệp vụ.
 * Bước 3: Kiểm tra ObjectId hợp lệ.
 * Bước 4: Kiểm tra Product tồn tại và đang hoạt động.
 * Bước 5: Chuẩn hóa các thuộc tính của Variant.
 * Bước 6: Kiểm tra SKU đã tồn tại hay chưa.
 * Bước 7: Kiểm tra tổ hợp biến thể có bị trùng không.
 * Bước 8: Lấy danh sách Variant theo Product.
 * Bước 9: Lấy chi tiết Variant.
 * Bước 10: Tạo Variant mới.
 * Bước 11: Cập nhật Variant.
 * Bước 12: Xóa mềm Variant.
 * Bước 13: Export các hàm nghiệp vụ.
 *
 * Lưu ý:
 * - SKU thuộc ProductVariant.
 * - Quantity thuộc Inventory.
 * - Không tạo hoặc cập nhật tồn kho trong Service này.
 */

const mongoose = require("mongoose");

const productRepository = require("../repositories/product.repository");

const variantRepository = require("../repositories/productVariant.repository");
const availabilityService = require("./availability.service");

/**
 * Bước 2: Tạo lỗi nghiệp vụ.
 *
 * - Nhận thông báo lỗi và HTTP status.
 * - Tạo đối tượng Error.
 * - Gắn statusCode để Controller xử lý.
 * - Trả về đối tượng lỗi.
 */
const makeError = (message, statusCode) => {
  const error = new Error(message);

  error.statusCode = statusCode;

  return error;
};

/**
 * Bước 3: Kiểm tra ObjectId.
 *
 * - Nhận ID cần kiểm tra.
 * - Kiểm tra định dạng ObjectId của MongoDB.
 * - Nếu không hợp lệ, trả lỗi 400.
 */
const validateId = (id) => {
  if (typeof id !== "string" || !/^[0-9a-fA-F]{24}$/.test(id)) {
    throw makeError("Invalid ID", 400);
  }
};

/**
 * Bước 4: Kiểm tra Product.
 *
 * - Kiểm tra productId hợp lệ.
 * - Tìm Product trong MongoDB.
 * - Nếu Product không tồn tại, trả lỗi 404.
 * - Nếu Product không hoạt động, trả lỗi 400.
 * - Trả về Product hợp lệ.
 */
const validateProduct = async (productId) => {
  validateId(productId);

  const product = await productRepository.findById(productId);

  if (!product) {
    throw makeError("Product not found", 404);
  }

  if (!product.isActive) {
    throw makeError("Product is inactive", 400);
  }

  return product;
};

/**
 * Bước 5: Chuẩn hóa thuộc tính.
 *
 * - Nhận giá trị thuộc tính.
 * - Nếu không có giá trị, chuyển thành chuỗi rỗng.
 * - Loại bỏ khoảng trắng đầu và cuối.
 * - Chuyển thành chữ thường để so sánh.
 *
 * Ví dụ:
 * " Beige " và "beige" được xem là giống nhau.
 */
const normalizeAttribute = (value) => {
  return (value ?? "").trim().toLowerCase();
};

/**
 * Bước 6: Kiểm tra SKU trùng.
 *
 * - Nhận SKU cần kiểm tra.
 * - Chuẩn hóa SKU thành chữ in hoa.
 * - Tìm SKU trong MongoDB.
 * - Nếu SKU tồn tại ở Variant khác, trả lỗi 409.
 *
 * excludeId:
 * Khi cập nhật, bỏ qua chính Variant đang được sửa.
 *
 * SKU phải duy nhất trên toàn hệ thống,
 * kể cả với Variant đã bị vô hiệu hóa.
 */
const checkDuplicateSku = async (sku, excludeId = null) => {
  const normalizedSku = sku.trim().toUpperCase();

  const existing = await variantRepository.findBySku(normalizedSku);

  if (existing && existing._id.toString() !== excludeId?.toString()) {
    throw makeError("SKU already exists", 409);
  }
};

/**
 * Bước 7: Kiểm tra trùng tổ hợp biến thể.
 *
 * - Nhận Product ID và dữ liệu Variant.
 * - Lấy tất cả Variant thuộc Product.
 * - Bỏ qua chính Variant đang được cập nhật.
 * - Chuẩn hóa color, size và material.
 * - So sánh tổ hợp với các Variant hiện có.
 * - Nếu trùng cả 3 thuộc tính, trả lỗi 409.
 *
 * Ví dụ:
 * Beige + L + Fabric
 * beige + l + fabric
 *
 * Hai tổ hợp trên được xem là trùng.
 *
 * Variant đã xóa mềm vẫn được kiểm tra để
 * tránh tạo bản ghi trùng dữ liệu cũ.
 */
const checkDuplicateCombination = async (productId, data, excludeId = null) => {
  const variants = await variantRepository.findByProductId(productId);

  const duplicate = variants.find((variant) => {
    // Bỏ qua Variant đang được cập nhật.
    if (variant._id.toString() === excludeId?.toString()) {
      return false;
    }

    // So sánh từng thuộc tính sau khi chuẩn hóa.
    const sameColor =
      normalizeAttribute(variant.color) === normalizeAttribute(data.color);

    const sameSize =
      normalizeAttribute(variant.size) === normalizeAttribute(data.size);

    const sameMaterial =
      normalizeAttribute(variant.material) ===
      normalizeAttribute(data.material);

    // Chỉ trùng khi cả 3 thuộc tính giống nhau.
    return sameColor && sameSize && sameMaterial;
  });

  if (duplicate) {
    throw makeError("Variant combination already exists", 409);
  }
};

/**
 * Bước 8: Lấy danh sách Variant theo Product.
 *
 * - Kiểm tra Product tồn tại.
 * - API public chỉ cho xem Product đang hoạt động.
 * - Admin có thể xem Variant của Product đã vô hiệu hóa.
 * - Admin lấy tất cả Variant.
 * - Public chỉ lấy Variant đang hoạt động.
 * - Trả về danh sách Variant.
 */
const getByProductId = async (productId, isAdmin = false) => {
  if (isAdmin) {
    validateId(productId);

    const product = await productRepository.findById(productId);

    if (!product) {
      throw makeError("Product not found", 404);
    }
  } else {
    await validateProduct(productId);
  }

  const filter = isAdmin ? {} : { isActive: true };

  const variants = await variantRepository.findByProductId(productId, filter);
  return availabilityService.withVariantStock(variants);
};

/**
 * Bước 9: Lấy chi tiết Variant.
 *
 * - Kiểm tra Variant ID hợp lệ.
 * - Tìm Variant trong database.
 * - Nếu không tồn tại, trả lỗi 404.
 * - Với API public, kiểm tra Variant và Product
 *   đều đang hoạt động.
 * - Trả về Variant.
 */
const getById = async (id, isAdmin = false) => {
  validateId(id);

  const variant = await variantRepository.findById(id);

  if (!variant) {
    throw makeError("Variant not found", 404);
  }

  if (!isAdmin) {
    if (!variant.isActive) {
      throw makeError("Variant not found", 404);
    }

    await validateProduct(variant.productId.toString());
  }

  const [variantWithStock] = await availabilityService.withVariantStock([variant]);
  return variantWithStock;
};

/**
 * Bước 10: Tạo Variant.
 *
 * - Nhận productId từ URL.
 * - Nhận dữ liệu Variant từ request body.
 * - Kiểm tra Product đang hoạt động.
 * - Chuẩn hóa SKU.
 * - Kiểm tra SKU trùng.
 * - Kiểm tra tổ hợp Variant trùng.
 * - Gọi Repository để lưu Variant.
 * - Trả về Variant vừa tạo.
 *
 * Không cho client tự truyền productId trong body.
 */
const create = async (productId, data) => {
  await validateProduct(productId);

  // Chỉ lấy các trường được phép tạo.
  const variantData = {
    productId,
    sku: data.sku.trim().toUpperCase(),
    color: data.color?.trim(),
    size: data.size?.trim(),
    material: data.material?.trim(),
    price: data.price,
  };

  await checkDuplicateSku(variantData.sku);

  await checkDuplicateCombination(productId, variantData);

  return variantRepository.create(variantData);
};

/**
 * Bước 11: Cập nhật Variant.
 *
 * - Kiểm tra Variant ID.
 * - Tìm Variant trong MongoDB.
 * - Nếu không tồn tại, trả lỗi 404.
 * - Kiểm tra Product đang hoạt động.
 * - Chỉ lấy các trường được phép cập nhật.
 * - Nếu cập nhật SKU, kiểm tra SKU trùng.
 * - Gộp dữ liệu cũ và mới.
 * - Kiểm tra tổ hợp biến thể sau cập nhật.
 * - Gọi Repository để cập nhật.
 * - Trả về Variant mới.
 *
 * productId không được thay đổi.
 * quantity không được cập nhật tại đây.
 */
const update = async (id, data) => {
  validateId(id);

  const variant = await variantRepository.findById(id);

  if (!variant) {
    throw makeError("Variant not found", 404);
  }

  await validateProduct(variant.productId.toString());

  // Danh sách những trường Admin được phép sửa.
  const allowedFields = [
    "sku",
    "color",
    "size",
    "material",
    "price",
    "isActive",
  ];

  // Chỉ giữ lại các trường hợp lệ từ request.
  const updateData = {};

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updateData[field] = data[field];
    }
  }

  // Chuẩn hóa SKU nếu có thay đổi.
  if (updateData.sku !== undefined) {
    updateData.sku = updateData.sku.trim().toUpperCase();

    await checkDuplicateSku(updateData.sku, id);
  }

  // Chuẩn hóa các thuộc tính được cập nhật.
  for (const field of ["color", "size", "material"]) {
    if (updateData[field] !== undefined) {
      updateData[field] = updateData[field].trim();
    }
  }

  // Gộp thuộc tính cũ và mới để kiểm tra tổ hợp.
  const mergedData = {
    color: updateData.color ?? variant.color,
    size: updateData.size ?? variant.size,
    material: updateData.material ?? variant.material,
  };

  await checkDuplicateCombination(variant.productId, mergedData, id);

  return variantRepository.update(id, updateData);
};

/**
 * Bước 12: Xóa mềm Variant.
 *
 * - Kiểm tra Variant ID.
 * - Tìm Variant trong MongoDB.
 * - Nếu không tồn tại, trả lỗi 404.
 * - Cập nhật isActive = false.
 * - Không xóa document khỏi database.
 *
 * Việc kiểm tra Cart/Order và tồn kho liên quan
 * sẽ được hoàn thiện ở các module tương ứng.
 */
const remove = async (id) => {
  validateId(id);

  const variant = await variantRepository.findById(id);

  if (!variant) {
    throw makeError("Variant not found", 404);
  }

  return variantRepository.update(id, {
    isActive: false,
  });
};

/**
 * Bước 13: Export các hàm để Controller sử dụng.
 */
module.exports = {
  getByProductId,
  getById,
  create,
  update,
  remove,
};

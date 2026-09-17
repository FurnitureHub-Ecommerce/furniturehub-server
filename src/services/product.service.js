/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Xử lý nghiệp vụ quản lý sản phẩm của FurnitureHub.
 *
 * Bước 1: Import các thư viện và repository cần thiết.
 * Bước 2: Tạo hàm xử lý lỗi có HTTP status.
 * Bước 3: Kiểm tra ObjectId hợp lệ.
 * Bước 4: Kiểm tra Category và Brand tồn tại, đang hoạt động.
 * Bước 5: Lấy danh sách sản phẩm.
 * Bước 6: Lấy chi tiết sản phẩm theo ID.
 * Bước 7: Tạo sản phẩm mới.
 * Bước 8: Cập nhật thông tin sản phẩm.
 * Bước 9: Xóa mềm sản phẩm.
 * Bước 10: Export các hàm để Controller sử dụng.
 */

const mongoose = require("mongoose");

const productRepository = require("../repositories/product.repository");

const categoryRepository = require("../repositories/category.repository");

const brandRepository = require("../repositories/brand.repository");

/**
 * Bước 2: Tạo lỗi nghiệp vụ.
 *
 * - Nhận thông báo lỗi và mã HTTP.
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
 * Bước 3: Kiểm tra ID.
 *
 * - Nhận ID cần kiểm tra.
 * - Sử dụng Mongoose để kiểm tra ObjectId.
 * - Nếu không hợp lệ, trả lỗi 400.
 */
const validateId = (id) => {
  if (!mongoose.isValidObjectId(id)) {
    throw makeError("Invalid product ID", 400);
  }
};

/**
 * Bước 4: Kiểm tra Category và Brand.
 *
 * - Nhận categoryId và brandId.
 * - Tìm Category trong database.
 * - Kiểm tra Category tồn tại và isActive = true.
 * - Tìm Brand trong database.
 * - Kiểm tra Brand tồn tại và isActive = true.
 * - Nếu không hợp lệ, trả lỗi 400.
 *
 * Lưu ý:
 * Mongoose ref không tự kiểm tra dữ liệu được tham chiếu.
 */
const validateReferences = async (categoryId, brandId) => {
  if (categoryId !== undefined) {
    const category = await categoryRepository.findById(categoryId);

    if (!category || !category.isActive) {
      throw makeError("Category does not exist or is inactive", 400);
    }
  }

  if (brandId !== undefined) {
    const brand = await brandRepository.findById(brandId);

    if (!brand || !brand.isActive) {
      throw makeError("Brand does not exist or is inactive", 400);
    }
  }
};

/**
 * Bước 5: Lấy danh sách Product.
 *
 * - Nếu là Admin, lấy tất cả sản phẩm.
 * - Nếu là Customer, chỉ lấy sản phẩm đang hoạt động.
 * - Gọi Repository để truy vấn MongoDB.
 */
const getAll = async (isAdmin = false) => {
  const filter = isAdmin ? {} : { isActive: true };

  return productRepository.findAll(filter);
};

/**
 * Bước 6: Lấy chi tiết Product.
 *
 * - Kiểm tra ID hợp lệ.
 * - Tìm Product theo ID.
 * - Nếu không tồn tại, trả lỗi 404.
 * - Nếu là API public và Product không hoạt động,
 *   trả lỗi 404.
 * - Trả về Product.
 */
const getById = async (id, isAdmin = false) => {
  validateId(id);

  const product = await productRepository.findById(id);

  if (!product) {
    throw makeError("Product not found", 404);
  }

  if (!isAdmin && !product.isActive) {
    throw makeError("Product not found", 404);
  }

  return product;
};

/**
 * Bước 7: Tạo Product.
 *
 * - Nhận dữ liệu từ Controller.
 * - Kiểm tra Category tồn tại và đang hoạt động.
 * - Kiểm tra Brand tồn tại và đang hoạt động.
 * - Gọi Repository để tạo Product.
 * - Trả về sản phẩm vừa tạo.
 *
 * Không tạo Variant, SKU hoặc Inventory tại đây.
 * Các phần đó thuộc module riêng.
 */
const create = async (data) => {
  await validateReferences(data.categoryId, data.brandId);

  return productRepository.create(data);
};

/**
 * Bước 8: Cập nhật Product.
 *
 * - Kiểm tra ID hợp lệ.
 * - Tìm Product trong database.
 * - Nếu không tồn tại, trả lỗi 404.
 * - Nếu cập nhật Category hoặc Brand,
 *   kiểm tra dữ liệu tham chiếu mới.
 * - Gọi Repository để cập nhật.
 * - Trả về Product đã cập nhật.
 */
const update = async (id, data) => {
  validateId(id);

  const product = await productRepository.findById(id);

  if (!product) {
    throw makeError("Product not found", 404);
  }

  await validateReferences(data.categoryId, data.brandId);

  return productRepository.update(id, data);
};

/**
 * Bước 9: Xóa mềm Product.
 *
 * - Kiểm tra ID hợp lệ.
 * - Tìm Product trong database.
 * - Nếu không tồn tại, trả lỗi 404.
 * - Cập nhật isActive = false.
 * - Không xóa Product khỏi MongoDB.
 *
 * Lưu ý:
 * Khi phát triển Cart/Order, cần kiểm tra thêm
 * việc vô hiệu hóa Product có ảnh hưởng đến
 * đơn hàng hoặc dữ liệu liên quan hay không.
 */
const remove = async (id) => {
  validateId(id);

  const product = await productRepository.findById(id);

  if (!product) {
    throw makeError("Product not found", 404);
  }

  return productRepository.update(id, {
    isActive: false,
  });
};

const {
  productQuerySchema,
} = require("../validators/product.validator");


/**
 * Bước 11: Xử lý tìm kiếm và phân trang Product.
 *
 * - Kiểm tra query parameters bằng Zod.
 * - Xây dựng điều kiện tìm kiếm.
 * - Xây dựng điều kiện lọc giá.
 * - Xác định kiểu sắp xếp.
 * - Gọi Repository để truy vấn.
 * - Tính tổng số trang.
 * - Trả về danh sách và thông tin phân trang.
 */
const getCatalog = async (query = {}) => {

  // Bước 1: Kiểm tra dữ liệu đầu vào.
  const result = productQuerySchema.safeParse(query);

  if (!result.success) {
    throw makeError(
      result.error.issues
        .map((issue) => issue.message)
        .join(", "),
      400
    );
  }

  // Bước 2: Lấy các tham số đã được kiểm tra.
  const {
    search,
    categoryId,
    brandId,
    minPrice,
    maxPrice,
    sort,
    page,
    limit,
  } = result.data;

  // Bước 3: Chỉ lấy sản phẩm đang hoạt động.
  const filter = {
    isActive: true,
  };

  // Bước 4: Tìm kiếm theo tên sản phẩm.
  // Escape các ký tự đặc biệt để tránh chúng
  // bị hiểu thành biểu thức chính quy.
  if (search) {
    const escapedSearch = search.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

    filter.name = {
      $regex: escapedSearch,
      $options: "i",
    };
  }

  // Bước 5: Lọc theo danh mục.
  if (categoryId) {
    filter.categoryId = new mongoose.Types.ObjectId(
      categoryId
    );
  }

  // Bước 6: Lọc theo thương hiệu.
  if (brandId) {
    filter.brandId = new mongoose.Types.ObjectId(
      brandId
    );
  }

  // Bước 7: Xây dựng điều kiện lọc giá.
  const priceFilter = {};

  if (minPrice !== undefined) {
    priceFilter.$gte = minPrice;
  }

  if (maxPrice !== undefined) {
    priceFilter.$lte = maxPrice;
  }

  // Bước 8: Xác định kiểu sắp xếp.
  const sortOptions = {
    newest: {
      createdAt: -1,
    },
    oldest: {
      createdAt: 1,
    },
    name_asc: {
      name: 1,
    },
    name_desc: {
      name: -1,
    },
    price_asc: {
      minPrice: 1,
    },
    price_desc: {
      minPrice: -1,
    },
  };

  // Bước 9: Gọi Repository để lấy dữ liệu.
  const { products, totalItems } =
    await productRepository.searchCatalog({
      filter,
      priceFilter,
      sort: sortOptions[sort],
      page,
      limit,
    });

  // Bước 10: Tính tổng số trang.
  const totalPages = Math.ceil(totalItems / limit);

  // Bước 11: Trả về kết quả cho Controller.
  return {
    products,

    pagination: {
      page,
      limit,
      totalItems,
      totalPages,
    },
  };
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove,
  getCatalog,
};
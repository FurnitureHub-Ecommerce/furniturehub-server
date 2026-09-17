/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Thực hiện các thao tác truy vấn Product trong MongoDB.
 *
 * Bước 1: Import Product Model.
 * Bước 2: Viết hàm lấy danh sách Product.
 * Bước 3: Viết hàm tìm Product theo ID.
 * Bước 4: Viết hàm tạo Product.
 * Bước 5: Viết hàm cập nhật Product.
 * Bước 6: Export các hàm để Service sử dụng.
 *
 * Lưu ý:
 * Repository chỉ thao tác với database.
 * Các nghiệp vụ kiểm tra Category, Brand và quyền
 * truy cập sẽ được xử lý tại Service và Route.
 */

const Product = require("../models/Product.model");

/**
 * Bước 2: Lấy danh sách Product.
 *
 * - Nhận điều kiện lọc từ Service.
 * - Truy vấn các Product phù hợp.
 * - Lấy thêm thông tin Category và Brand.
 * - Sắp xếp sản phẩm mới nhất lên trước.
 * - Trả về danh sách Product.
 */
const findAll = (filter = {}) => {
  return Product.find(filter)
    .populate("categoryId", "name")
    .populate("brandId", "name")
    .sort({ createdAt: -1 });
};

/**
 * Bước 3: Tìm Product theo ID.
 *
 * - Nhận ID sản phẩm.
 * - Tìm trong MongoDB.
 * - Lấy thêm thông tin Category và Brand.
 * - Trả về Product hoặc null nếu không tồn tại.
 */
const findById = (id) => {
  return Product.findById(id)
    .populate("categoryId", "name")
    .populate("brandId", "name");
};

/**
 * Bước 4: Tạo Product.
 *
 * - Nhận dữ liệu đã được Service kiểm tra.
 * - Tạo document mới trong MongoDB.
 * - Trả về Product vừa được tạo.
 */
const create = (data) => {
  return Product.create(data);
};

/**
 * Bước 5: Cập nhật Product.
 *
 * - Nhận ID và dữ liệu cần cập nhật.
 * - Tìm Product theo ID và cập nhật.
 * - Bật runValidators để kiểm tra dữ liệu.
 * - Trả về document sau khi cập nhật.
 */
const update = (id, data) => {
  return Product.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  });
};


/**
 * * Bước 7: Truy vấn danh sách sản phẩm có phân trang.
 *
 * - Nhận điều kiện lọc đã được Service xây dựng.
 * - Nhận thông tin sắp xếp, trang hiện tại và số sản phẩm mỗi trang.
 * - Đếm tổng số sản phẩm phù hợp với điều kiện lọc.
 * - Tính số sản phẩm cần bỏ qua để lấy đúng trang.
 * - Truy vấn sản phẩm và lấy thêm Category, Brand.
 * - Trả về danh sách sản phẩm và tổng số sản phẩm.
 *
 * Lưu ý:
 * Hàm này xử lý truy vấn cơ bản trên Product.
 * Lọc và sắp xếp theo giá sẽ được bổ sung riêng
 * vì giá nằm trong ProductVariant.
 */
const findPaged = async({
  filter ={},
  sort = { createdAt: -1 },
  page = 1,
  limit = 10,
}) => {
  //Tinh so san pham can bo qua o cac trang truoc
  const skip = (page - 1) * limit;
  // Đếm tất cả sản phẩm thỏa mãn điều kiện lọc.
  const totalItems = await Product.countDocuments(filter);

  // Lấy danh sách sản phẩm thuộc trang hiện tại.
  const products = await Product.find(filter)
    .populate("categoryId", "name")
    .populate("brandId", "name")
    .sort(sort)
    .skip(skip)
    .limit(limit);

  // Trả dữ liệu để Service xây dựng kết quả phân trang.
  return {
    products,
    totalItems,
  };
};

/**
 * Bước 8: Tìm kiếm, lọc, sắp xếp và phân trang sản phẩm.
 *
 * - Nhận điều kiện tìm kiếm từ Service.
 * - Truy vấn các Product phù hợp.
 * - Kết hợp ProductVariant để lấy giá.
 * - Tính giá thấp nhất trong các biến thể đang hoạt động.
 * - Lọc theo khoảng giá nếu có yêu cầu.
 * - Sắp xếp và phân trang.
 * - Lấy thông tin Category và Brand.
 * - Trả về danh sách và tổng số sản phẩm.
 */
const searchCatalog = async ({
  filter,
  priceFilter,
  sort,
  page,
  limit,
}) => {
  // Tính số sản phẩm cần bỏ qua.
  const skip = (page - 1) * limit;

  // Xây dựng các bước truy vấn Aggregation.
  const pipeline = [

    // Bước 1: Chỉ lấy Product phù hợp với điều kiện.
    {
      $match: filter,
    },

    // Bước 2: Lấy các biến thể đang hoạt động của Product.
    {
      $lookup: {
        from: "productvariants",
        let: {
          productId: "$_id",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  {
                    $eq: ["$productId", "$$productId"],
                  },
                  {
                    $eq: ["$isActive", true],
                  },
                ],
              },
            },
          },
          {
            $project: {
              price: 1,
            },
          },
        ],
        as: "variants",
      },
    },

    // Bước 3: Tính giá thấp nhất của các biến thể.
    {
      $addFields: {
        minPrice: {
          $min: "$variants.price",
        },
      },
    },
  ];

  // Bước 4: Lọc sản phẩm theo giá nếu có yêu cầu.
  // Một Product hợp lệ khi có ít nhất một Variant
  // nằm trong khoảng giá mà người dùng lựa chọn.
  if (Object.keys(priceFilter).length > 0) {
    pipeline.push({
      $match: {
        variants: {
          $elemMatch: {
            price: priceFilter,
          },
        },
      },
    });
  }

  // Bước 5: Sắp xếp sản phẩm.
  pipeline.push({
    $sort: {
      ...sort,
      _id: -1,
    },
  });

  // Bước 6: Phân trang và đếm tổng trong cùng truy vấn.
  pipeline.push({
    $facet: {

      // Lấy dữ liệu thuộc trang hiện tại.
      products: [
        {
          $skip: skip,
        },
        {
          $limit: limit,
        },

        // Lấy thông tin danh mục.
        {
          $lookup: {
            from: "categories",
            localField: "categoryId",
            foreignField: "_id",
            as: "category",
          },
        },

        // Lấy thông tin thương hiệu.
        {
          $lookup: {
            from: "brands",
            localField: "brandId",
            foreignField: "_id",
            as: "brand",
          },
        },

        // Chuyển Category và Brand về dạng object.
        {
          $addFields: {
            categoryId: {
              $arrayElemAt: ["$category", 0],
            },
            brandId: {
              $arrayElemAt: ["$brand", 0],
            },
          },
        },

        // Loại bỏ các trường trung gian.
        {
          $project: {
            variants: 0,
            category: 0,
            brand: 0,
          },
        },
      ],

      // Đếm tổng số sản phẩm phù hợp.
      metadata: [
        {
          $count: "totalItems",
        },
      ],
    },
  });

  // Bước 7: Thực hiện Aggregation.
  const [result] = await Product.aggregate(pipeline);

  // Trường hợp không tìm thấy sản phẩm.
  const totalItems = result.metadata[0]?.totalItems || 0;

  return {
    products: result.products,
    totalItems,
  };
};

module.exports = {
  findAll,
  findById,
  create,
  update,
  findPaged,
  searchCatalog,
};
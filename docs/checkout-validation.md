<!--
@Author: Minh Truong
Mục đích: ghi lại hợp đồng Checkout Validation và cách kiểm thử Task 2.
Bước 1: đối chiếu cấu trúc hiện có và luồng xử lý.
Bước 2: cấu hình Postman và chuẩn bị dữ liệu từng trường hợp.
Bước 3: phân biệt kết quả đã chạy với kiểm thử cần MongoDB thực tế.
-->

# Task 2 — Checkout + Cart Validation

## Cấu trúc và phần được tái sử dụng

- CartItem là subdocument trong `Cart.items`, không có model/collection CartItem riêng.
- `Cart.userId` xác định chủ sở hữu; `items.variantId` tham chiếu ProductVariant; `ProductVariant.productId` tham chiếu Product.
- Product và ProductVariant đều có `isActive`; Inventory lưu `variantId`, `quantity`, `lowStockThreshold`.
- Tái sử dụng `authMiddleware`, `authorizeRoles`, middleware `validate`, `addressService.getAddressById` và `cartRepository.findByUserId`.
- `getAddressById` kiểm tra ObjectId và gọi repository truy vấn đồng thời `_id` và `userId`.
- Truy vấn Cart vẫn populate Variant và Product theo cách hiện tại. Tùy chọn `{ lean: true }` mới giữ nguyên kiểu quantity và không áp dụng mặc định của Mongoose; tham chiếu không thể ép ObjectId trở thành null để trả lỗi theo item. Cart API mặc định vẫn nhận Mongoose document như trước.
- Không dùng `cartService.getCart` vì hàm đó tính tiền; không dùng `findOrCreate` vì có thể tạo Cart.
- Role hiện có là `STORAGE`, khác tên `STORAGE_MANAGER` trong đề bài. Checkout chỉ chấp nhận `CUSTOMER`, không cần đổi hệ thống role.

## Hợp đồng và luồng API

`POST /api/checkout/validate`

```http
Content-Type: application/json
Authorization: Bearer <customerToken>
```

```json
{ "addressId": "507f1f77bcf86cd799439011" }
```

1. JWT thiếu/sai/hết hạn trả 401; role khác CUSTOMER trả 403.
2. Zod yêu cầu addressId là chuỗi 24 ký tự hex và từ chối mọi trường ngoài addressId. Lỗi trả 400 theo middleware hiện tại: `{ "message": "Validation failed", "errors": [...] }`.
3. Address phải thuộc userId từ JWT. Không tồn tại hoặc thuộc người khác cùng trả 404: `{ "message": "Không tìm thấy địa chỉ" }`.
4. Tìm Cart bằng userId từ JWT. Chưa có Cart trả 400 `{ "message": "Cart not found", "valid": false }`; giỏ rỗng trả 400 `{ "message": "Cart is empty", "valid": false }`.
5. Kiểm tra toàn bộ item: quantity phải là số nguyên >= 1; Variant và Product phải tồn tại, `isActive === true`. Gom mọi lỗi và trả 400.
6. Không có lỗi trả 200:

```json
{ "message": "Cart is valid for checkout", "valid": true }
```

Ví dụ lỗi item:

```json
{
  "message": "Cart is invalid for checkout",
  "valid": false,
  "errors": [
    {
      "itemId": "507f1f77bcf86cd799439012",
      "variantId": null,
      "code": "VARIANT_NOT_FOUND",
      "message": "Product variant not found"
    }
  ]
}
```

`itemId` là `_id` của subdocument, đủ để frontend xác định dòng lỗi kể cả khi Variant bị xóa. `variantId` là null nếu không populate được. Một item có thể có nhiều lỗi. Khi thiếu Variant, không kiểm tra được Product của nó.

| Mã lỗi item | Ý nghĩa |
| --- | --- |
| `INVALID_QUANTITY` | Quantity sai kiểu, không nguyên hoặc nhỏ hơn 1 |
| `VARIANT_NOT_FOUND` | Tham chiếu Variant thiếu, sai định dạng hoặc không tồn tại |
| `VARIANT_INACTIVE` | Variant không có `isActive=true` |
| `PRODUCT_NOT_FOUND` | Product liên quan thiếu hoặc không tồn tại |
| `PRODUCT_INACTIVE` | Product không có `isActive=true` |

Lỗi hệ thống trả 500 `{ "message": "Internal server error" }`, không trả chi tiết kết nối hoặc stack. Các lỗi JWT, role, Zod và địa chỉ giữ convention hiện tại; `valid=false` chỉ xuất hiện trong lỗi nghiệp vụ Cart.

BR01–BR07 đã được áp dụng. Endpoint chỉ đọc dữ liệu, không sửa quantity, xóa item, tạo Cart/Address, thay isDefault hay truy vấn Inventory. Thành công chỉ phản ánh dữ liệu tại thời điểm gọi, không bảo đảm giá/tồn kho và không giữ hàng. Create Order ở Task 4 phải kiểm tra lại điều kiện quan trọng.

Swagger tại `/api-docs/`, nhóm **Checkout**, có request, Bearer Authentication, schema, ví dụ và response 200/400/401/403/404/500. Các endpoint Swagger trước đó được giữ nguyên.

## Bộ Postman TC01–TC17

Import [checkout-validation.postman_collection.json](postman/checkout-validation.postman_collection.json). Mỗi request đã chứa method, URL, headers, body, status mong đợi, toàn bộ response mẫu và script so sánh response.

Đặt các biến collection hoặc environment:

| Biến | Giá trị cần điền |
| --- | --- |
| `baseUrl` | Mặc định `http://localhost:5000`, đổi theo backend đang chạy |
| `customerToken` | JWT Customer từ API Login, không kèm tiền tố Bearer |
| `staffToken` | JWT của STAFF |
| `addressId` | Địa chỉ thuộc Customer đang kiểm thử |
| `foreignAddressId` | Địa chỉ thật của Customer khác |
| `missingAddressId` | ObjectId hợp lệ nhưng không có trong addresses; kiểm tra lại giá trị mẫu |
| `otherUserId` | ID Customer khác cho TC17 |
| `itemId` | `_id` của CartItem đang được kiểm thử, lấy từ GET Cart |
| `variantId` | `_id` của Variant trong item, dùng so sánh response |

**Chạy từng request sau khi chuẩn bị trạng thái tương ứng.** Các ca có trạng thái Cart trái ngược nhau; không chạy toàn bộ Collection Runner với cùng một Customer mà chưa chuẩn bị lại dữ liệu. TC09 có thể dùng Customer mới, sau đó đổi token/addressId về tài khoản thử nghiệm cho các ca tiếp theo.

Mọi ca dưới đây dùng method `POST`, URL `{{baseUrl}}/api/checkout/validate`, `Content-Type: application/json`. Cột JWT quy định Authorization: `C` = `Bearer {{customerToken}}`, `S` = `Bearer {{staffToken}}`, `I` = `Bearer invalid-token`, `—` = không gửi header Authorization. Body `A` = `{ "addressId": "{{addressId}}" }`.

| ID | Chuẩn bị / trường hợp | JWT | Body | Status | Response mong đợi |
| --- | --- | --- | --- | --- | --- |
| TC01 | Cart hợp lệ, địa chỉ của Customer | C | A | 200 | `message=Cart is valid for checkout`, `valid=true` |
| TC02 | Không JWT | — | A | 401 | `message=Access token is required` |
| TC03 | JWT sai | I | A | 401 | `message=Invalid or expired token` |
| TC04 | STAFF | S | A | 403 | `message=Forbidden: insufficient permission` |
| TC05 | Thiếu addressId | C | `{}` | 400 | `Validation failed`, Zod `invalid_type`, path `addressId` |
| TC06 | ID sai định dạng | C | `{"addressId":"invalid-id"}` | 400 | `Validation failed`, Zod `invalid_format`, `Invalid address ID` |
| TC07 | Địa chỉ không tồn tại | C | `{"addressId":"{{missingAddressId}}"}` | 404 | `message=Không tìm thấy địa chỉ` |
| TC08 | Địa chỉ của người khác | C | `{"addressId":"{{foreignAddressId}}"}` | 404 | Giống TC07 |
| TC09 | Có địa chỉ nhưng chưa có Cart | C | A | 400 | `message=Cart not found`, `valid=false` |
| TC10 | Cart có `items=[]` | C | A | 400 | `message=Cart is empty`, `valid=false` |
| TC11 | Item trỏ đến Variant không tồn tại | C | A | 400 | Cart lỗi, `VARIANT_NOT_FOUND`, `variantId=null` |
| TC12 | Variant `isActive=false` | C | A | 400 | Cart lỗi, `VARIANT_INACTIVE` |
| TC13 | Variant trỏ đến Product không tồn tại | C | A | 400 | Cart lỗi, `PRODUCT_NOT_FOUND` |
| TC14 | Product `isActive=false` | C | A | 400 | Cart lỗi, `PRODUCT_INACTIVE` |
| TC15 | Item có quantity=0 | C | A | 400 | Cart lỗi, `INVALID_QUANTITY` |
| TC16 | Item có quantity=-1 | C | A | 400 | Cart lỗi, `INVALID_QUANTITY` |
| TC17 | Gửi userId khác | C | `{"addressId":"{{addressId}}","userId":"{{otherUserId}}"}` | 400 | `Validation failed`, Zod `unrecognized_keys`, keys `["userId"]` |

“Cart lỗi” là response `message=Cart is invalid for checkout`, `valid=false`, `errors` như ví dụ ở trên. Các ví dụ JSON đầy đủ cho từng mã lỗi đã lưu trong collection. TC11–TC16 giả định chỉ một item lỗi, các điều kiện khác hợp lệ, để assertion so sánh toàn bộ response chính xác.

### Chuẩn bị dữ liệu không hợp lệ

Dùng Customer/Product/Variant riêng trong database thử nghiệm. Cart API đã chặn quantity không hợp lệ, do đó cần sửa dữ liệu trực tiếp cho các ca này, không sửa Cart API để bỏ validation.

Trong mongosh đã kết nối database thử nghiệm, điền ID thực tế rồi lưu snapshot của bộ dữ liệu hợp lệ trong cùng phiên shell:

```javascript
const checkoutCustomerId = ObjectId("<customerId>");
const checkoutItemId = ObjectId("<itemId>");
const checkoutCart = db.carts.findOne({ userId: checkoutCustomerId });
const checkoutItem = checkoutCart.items.find(item => item._id.equals(checkoutItemId));
const checkoutVariant = db.productvariants.findOne({ _id: checkoutItem.variantId });
const checkoutProduct = db.products.findOne({ _id: checkoutVariant.productId });
const checkoutMissingId = ObjectId();
```

Mỗi lần chỉ áp dụng **một** biến đổi và gọi request tương ứng:

```javascript
// TC11: đổi tham chiếu, không cần xóa Variant thật.
db.carts.updateOne(
  { userId: checkoutCustomerId, "items._id": checkoutItemId },
  { $set: { "items.$.variantId": checkoutMissingId } }
);

// TC12: Variant ngừng bán.
db.productvariants.updateOne({ _id: checkoutVariant._id }, { $set: { isActive: false } });

// TC13: Product không tồn tại.
db.productvariants.updateOne({ _id: checkoutVariant._id }, { $set: { productId: checkoutMissingId } });

// TC14: Product ngừng bán.
db.products.updateOne({ _id: checkoutProduct._id }, { $set: { isActive: false } });

// TC15: quantity bằng 0; thay 0 bằng -1 để chạy TC16.
db.carts.updateOne(
  { userId: checkoutCustomerId, "items._id": checkoutItemId },
  { $set: { "items.$.quantity": 0 } }
);
```

Sau **mỗi ca**, khôi phục dữ liệu trước khi sang ca khác:

```javascript
db.carts.updateOne({ _id: checkoutCart._id, userId: checkoutCustomerId }, { $set: { items: checkoutCart.items } });
db.productvariants.updateOne({ _id: checkoutVariant._id }, { $set: { productId: checkoutVariant.productId, isActive: checkoutVariant.isActive } });
db.products.updateOne({ _id: checkoutProduct._id }, { $set: { isActive: checkoutProduct.isActive } });
```

TC09 dùng Customer mới có địa chỉ nhưng chưa thêm vào giỏ. TC10 dùng Cart đã tồn tại rồi gọi DELETE Cart để làm rỗng. Các đoạn chuẩn bị trên là hướng dẫn cho người chạy Postman, không được endpoint hay bộ test tự động thực thi.

## Kết quả kiểm tra và giới hạn

- Đã chạy `npm.cmd test`: **31/31 bài đạt**, bao gồm TC01–TC17.
- Đã chạy `node --check` trên các file JavaScript thay đổi/thêm mới và `git diff --check`: đạt.
- Kiểm thử HTTP chạy route thực tế cùng JWT, phân quyền, Zod, Service, Repository và Mongoose populate. Dữ liệu đọc từ collection được mô phỏng, không kết nối MongoDB.
- Các ca bổ sung kiểm tra quantity thập phân/chuỗi/null/thiếu, tham chiếu thiếu/sai định dạng, trạng thái sai kiểu, nhiều lỗi trên nhiều item, JWT hết hạn/sai chữ ký, mọi role khác CUSTOMER, trường body lạ, truy cập giỏ qua query, lỗi 500 và tính chất chỉ đọc.
- GET Cart vẫn tính tổng theo snapshot và populate; GET Address vẫn lọc theo chủ sở hữu. Swagger UI trả HTTP 200 và có đầy đủ response của checkout.
- Trước Task 2, `npm test` chỉ là script placeholder báo lỗi; hiện chạy bằng `node --test`, không cài thêm thư viện.
- **Chưa chạy Postman/Newman hoặc kiểm thử trên MongoDB thực tế.** Response lưu trong collection là kết quả mong đợi, không phải kết quả đã thực thi. Kiểm tra hồi quy tự động hiện tập trung vào luồng đọc Cart/Address, không chạy toàn bộ CRUD trên database thật.
- Khi Variant không tồn tại, populate không giữ ID Variant ban đầu trong response; frontend dùng itemId để xác định dòng lỗi.
- Các lần đọc không dùng transaction hay lock; dữ liệu có thể thay đổi ngay sau khi validate. Đây là phạm vi BR07, cần tái kiểm tra lúc tạo đơn.

## File thay đổi

Tạo mới:

- `src/routes/checkout.route.js`
- `src/controllers/checkout.controller.js`
- `src/services/checkout.service.js`
- `src/validators/checkout.validator.js`
- `tests/checkout.test.js`
- `docs/postman/checkout-validation.postman_collection.json`
- `docs/checkout-validation.md`

Chỉnh sửa:

- `src/app.js`: đăng ký `/api/checkout`.
- `src/repositories/cart.repository.js`: tùy chọn đọc lean, giữ mặc định của Cart API.
- `src/config/swagger.js`: thêm Checkout, giữ nguyên endpoint cũ.
- `package.json`: thay script test placeholder bằng Node test runner.

## Ngoài phạm vi

Task 3: so sánh quantity với Inventory, kiểm tra biến động giá và tính giá checkout chi tiết.

Task 4: tạo Order/OrderItem, trừ hoặc giữ tồn kho, giao dịch đặt hàng và xử lý Cart sau tạo đơn.

Task 5: Payment API, trạng thái thanh toán, MoMo/cổng thanh toán.

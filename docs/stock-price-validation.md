<!--
@Author: Minh Truong
Mục đích: mô tả Task 3, quyết định tích hợp Task 2 và hướng dẫn kiểm thử Postman.
Bước 1: đối chiếu schema và hợp đồng API hiện tại.
Bước 2: chuẩn bị dữ liệu thử nghiệm, chạy TC01–TC22 và kiểm tra không ghi dữ liệu.
Bước 3: phân biệt kiểm thử tự động đã chạy với kiểm thử MongoDB/Postman chưa chạy.
Đầu vào chỉ gồm JWT Customer và addressId; không nhận giá, userId hay cartId từ client.
-->

# Task 3 — Stock Validation + Price Calculation

## Endpoint và tích hợp

**`POST /api/checkout/validate`** được mở rộng từ Task 2. Không tạo `/stock-price` vì đã có luồng checkout phù hợp và cần dùng chung kiểm tra quyền sở hữu địa chỉ, Cart, Product và Variant.

Task 2 đã được merge vào `main` qua [PR #12](https://github.com/FurnitureHub-Ecommerce/furniturehub-server/pull/12), commit merge `c4449d5`. Các PR #8–#12 đều nhắm `main`; `dev` chưa có các dependency này. Branch Task 3 xuất phát từ `origin/main`, PR nhắm **main**, không merge tự động. Không có dependency Task 2 chưa merge.

Yêu cầu request giữ nguyên:

```http
POST /api/checkout/validate
Authorization: Bearer <customerToken>
Content-Type: application/json
```

```json
{ "addressId": "507f1f77bcf86cd799439011" }
```

Chỉ CUSTOMER được gọi. `userId` luôn lấy từ `req.user.userId`; địa chỉ và Cart đều lọc theo chủ sở hữu. Zod từ chối mọi trường khác, kể cả `userId`, `cartId`, `unitPrice`, `totalPrice`, `subtotal`, `grandTotal`. Query không được dùng để chọn Cart hoặc tính giá.

Task 2 giữ kiểm tra địa chỉ, số lượng, Variant/Product và `isActive === true`. Sau đó gọi `stockPriceService.calculateStockPrice(cart, itemErrors)` với Cart đã populate và lỗi theo vị trí item. Không truy vấn lại Cart hoặc sao chép logic kiểm tra sản phẩm sang service mới. Controller, route, validator và app.js không cần đổi.

## Schema, tồn kho và giá

- CartItem nhúng trong `Cart.items`, có `_id` dùng làm `itemId`; `variantId` tham chiếu ProductVariant. Không có collection CartItem riêng.
- `ProductVariant.productId` tham chiếu Product. Cả hai dùng `isActive` để xác định còn bán.
- Inventory có `variantId` unique và **`quantity`** là tồn kho. Không có trường giữ hàng hay nhiều kho. `lowStockThreshold` là ngưỡng cảnh báo, không trừ khỏi số lượng có thể bán.
- Gom quantity của các CartItem trùng Variant rồi so với Inventory.quantity. Cart Service thường tránh trùng nhưng schema không ràng buộc mảng unique, nên phải kiểm tra tổng gộp. Đọc Inventory một lần mỗi Variant bằng helper repository hiện có với `{ lean: true }`.
- Tồn kho thiếu trả `INVENTORY_NOT_FOUND`; tồn kho 0 trả `INSUFFICIENT_STOCK`. Giá trị tồn kho thiếu/sai kiểu/âm/lẻ/vượt giới hạn trả `INVALID_STOCK`. Không coi dữ liệu hỏng là 0 hoặc tự tạo Inventory.
- `unitPrice` trong response lấy từ **`ProductVariant.price` hiện tại**, bỏ qua snapshot CartItem.unitPrice. Snapshot không bị sửa.
- `itemSubtotal = unitPrice × quantity`. **`totalAmount` vừa là subtotal vừa là tổng tiền**, theo tên trường Cart API đã dùng; không lặp thêm subtotal/grandTotal. Không thêm phí vận chuyển, thuế, coupon hoặc giảm giá.
- Giá là Number không âm; 0 hợp lệ và schema cho phép thập phân. Task 3 tách hệ số/thang đo thập phân rồi nhân/cộng bằng BigInt, chuyển về Number khi kết quả giữ nguyên giá trị thập phân và không vượt `Number.MAX_SAFE_INTEGER`. Ví dụ `0.1 × 3 = 0.3`, không trả `0.30000000000000004`. Dữ liệu đã mất chính xác trước khi lưu vào Number không thể khôi phục.
- Quantity và tổng quantity theo Variant phải là số nguyên an toàn. Giá hoặc thành tiền không thể biểu diễn an toàn bị từ chối; không âm thầm làm tròn.

**Khác biệt có chủ đích với Cart:** GET Cart tiếp tục tính theo snapshot và `Math.round` từng dòng theo VND. Checkout dùng giá hiện tại và giữ phần thập phân mà schema cho phép. Với giá VND nguyên, kết quả vẫn là VND nguyên. Không thay đổi hợp đồng, quy tắc lưu giá hay hàm tính tiền của Cart API; không tái sử dụng `getCart()` để tránh lấy snapshot/làm tròn mất phần thập phân. Không dùng `findOrCreate()` vì có ghi dữ liệu.

## Response

HTTP 200:

```json
{
  "message": "Cart is valid for checkout",
  "valid": true,
  "items": [
    {
      "itemId": "507f1f77bcf86cd799439012",
      "variantId": "507f1f77bcf86cd799439013",
      "quantity": 2,
      "requestedQuantity": 2,
      "availableStock": 10,
      "unitPrice": 1200000,
      "itemSubtotal": 2400000,
      "stockValid": true,
      "valid": true
    }
  ],
  "totalAmount": 2400000
}
```

`requestedQuantity` là tổng số lượng hợp lệ của các dòng cùng Variant, không chỉ quantity của dòng hiện tại. `stockValid` chỉ biểu diễn kiểm tra tồn kho; phải dùng `valid` toàn response để quyết định tiếp tục checkout.

HTTP **400** khi thiếu hàng, phù hợp Cart API hiện có:

```json
{
  "message": "Cart is invalid for checkout",
  "valid": false,
  "items": [
    {
      "itemId": "507f1f77bcf86cd799439012",
      "variantId": "507f1f77bcf86cd799439013",
      "quantity": 5,
      "requestedQuantity": 5,
      "availableStock": 3,
      "unitPrice": 1200000,
      "itemSubtotal": 6000000,
      "stockValid": false,
      "valid": false
    }
  ],
  "totalAmount": null,
  "errors": [
    {
      "itemId": "507f1f77bcf86cd799439012",
      "variantId": "507f1f77bcf86cd799439013",
      "code": "INSUFFICIENT_STOCK",
      "message": "Insufficient stock. Available: 3, Requested total: 5"
    }
  ]
}
```

Khi có bất kỳ lỗi nào, `totalAmount=null`; giá/thành tiền từng dòng chỉ để chẩn đoán, không phải tổng đơn hàng được xác nhận. Dòng thiếu Variant vẫn trả itemId, còn variantId=null do populate. Item null/sai quantity vẫn được báo lỗi. Lỗi tiền toàn giỏ `INVALID_TOTAL` không có itemId vì thuộc tổng nhiều dòng.

| HTTP | Trường hợp |
| --- | --- |
| 200 | Địa chỉ, mọi item, tồn kho và giá hợp lệ |
| 400 | Body sai; Cart thiếu/rỗng; item, tồn kho, giá hoặc tổng tiền lỗi |
| 401 | Thiếu JWT, JWT sai/hết hạn |
| 403 | Role khác CUSTOMER, gồm STAFF/ADMIN/STORAGE/STORAGE_MANAGER |
| 404 | Address thiếu hoặc thuộc Customer khác |
| 500 | Database/lỗi hệ thống bất ngờ; chỉ trả `Internal server error` |

Cart không tồn tại hoặc rỗng giữ response Task 2: message và valid=false, không có items/totalAmount. Lỗi JWT/Zod/Address cũng giữ định dạng cũ. Swagger `/api-docs/` mô tả đầy đủ hợp đồng hiện tại.

## Postman TC01–TC22

Chạy backend bằng `npm start` với MongoDB/JWT đã cấu hình. Dùng database thử nghiệm và hai Customer riêng. Lấy JWT Customer/STAFF qua Login, tạo địa chỉ của từng Customer. Tạo Product/Variant hoạt động và Inventory đủ hàng rồi thêm CartItem qua Cart API. Inventory chưa có CRUD trong dự án, nên chuẩn bị bằng MongoDB Compass/mongosh trên dữ liệu thử nghiệm.

Request dùng endpoint/body/headers ở trên. Đặt `baseUrl`, `customerToken`, `staffToken`, `addressId`, `itemId`, `variantId`. Có thể dùng [collection Task 2 đã cập nhật](postman/checkout-validation.postman_collection.json) để kiểm tra hợp đồng cũ và response mở rộng; bảng sau là toàn bộ kế hoạch Task 3. Chạy từng ca với trạng thái riêng, khôi phục fixture trước ca tiếp theo.

Fixture chuẩn: một dòng quantity=2, snapshot unitPrice=1000000; Variant.price=1200000, Product/Variant.isActive=true, Inventory.quantity=10. Cart và addressId thuộc Customer đang đăng nhập. Với mỗi request, đối chiếu database trước/sau, gồm Cart.items, Cart.updatedAt, Inventory.quantity/updatedAt và số bản ghi Order nếu collection tồn tại. Không dùng GET Cart để chứng minh snapshot thay đổi vì API này vẫn dùng giá đã lưu.

| ID | Chuẩn bị / request | Mong đợi | Tự động |
| --- | --- | --- | --- |
| TC01 | Fixture chuẩn | 200, valid=true, unitPrice=1200000, itemSubtotal=totalAmount=2400000 | PASS |
| TC02 | Cart.items=[] | 400, Cart is empty | PASS |
| TC03 | Customer có địa chỉ nhưng chưa có Cart | 400, Cart not found; không tạo Cart | PASS |
| TC04 | Inventory.quantity=2 | 200, stockValid=true | PASS |
| TC05 | Inventory.quantity=1 | 400, INSUFFICIENT_STOCK, availableStock=1, totalAmount=null | PASS |
| TC06 | Inventory.quantity=0 | 400, INSUFFICIENT_STOCK | PASS |
| TC07 | Tạm đổi Inventory.variantId sang ID thử nghiệm khác | 400, INVENTORY_NOT_FOUND, availableStock=null | PASS |
| TC08 | CartItem.variantId trỏ ID không tồn tại | 400, VARIANT_NOT_FOUND và itemId đúng | PASS |
| TC09 | Product.isActive=false | 400, PRODUCT_INACTIVE | PASS |
| TC10 | ProductVariant.isActive=false | 400, VARIANT_INACTIVE | PASS |
| TC11 | quantity=0/-1/1.5/chuỗi/null/thiếu | 400, INVALID_QUANTITY | PASS |
| TC12 | Thêm Variant giá 2000000, quantity=3, stock>=3 | 200, thành tiền 2400000 và 6000000; tổng 8400000 | PASS |
| TC13 | Fixture TC12, Variant thứ hai stock=1 | 400, xác định dòng thứ hai; totalAmount=null | PASS |
| TC14 | Sau khi thêm Cart ở giá 1000000, sửa Variant.price=1200000 | Dùng giá 1200000; snapshot vẫn 1000000 | PASS |
| TC15 | Variant.price âm/chuỗi/null/thiếu/vượt giới hạn | 400, INVALID_PRICE; giá 0 vẫn hợp lệ | PASS |
| TC16 | Thêm unitPrice/totalPrice/subtotal/grandTotal vào body | 400, Zod unrecognized_keys | PASS |
| TC17 | Bỏ Authorization | 401 | PASS |
| TC18 | Bearer invalid-token | 401 | PASS |
| TC19 | JWT STAFF | 403 | PASS |
| TC20 | JWT Customer A; gửi userId/cartId B ở body hoặc query | Body bị từ chối; query không chọn được Cart B; địa chỉ B trả 404 | PASS |
| TC21 | Gọi hai lần liên tiếp | Kết quả giống nhau, dữ liệu không thay đổi | PASS |
| TC22 | Hai dòng cùng Variant, mỗi dòng quantity=2; stock=3 | 400 cả hai dòng, requestedQuantity=4; đổi stock=4 thì 200 | PASS |

Các ca dữ liệu sai/trùng phải chuẩn bị trực tiếp ở database thử nghiệm vì Cart API đã chặn chúng. Không sửa validator để tạo fixture. Trước khi sửa, lưu bản sao Cart, Variant, Product và Inventory trong Compass/mongosh; khôi phục các trường đã sửa sau mỗi ca. TC03 dùng Customer mới để tránh xóa Cart thật. TC07 dùng đổi tham chiếu tạm thời để tránh xóa Inventory.

Kiểm tra thêm: Product bị xóa; Inventory.quantity sai kiểu; tổng vượt MAX_SAFE_INTEGER; giá 0; giá 0.1 và 0.2 trên nhiều dòng; một CartItem null; lỗi đọc Inventory trả 500 không chứa thông tin kết nối. MongoDB validator/Mongoose có thể chặn fixture dữ liệu hỏng; chỉ dùng collection thử nghiệm với quyền chuẩn bị dữ liệu phù hợp.

## Kết quả và giới hạn

- `npm.cmd test`: **PASS, 48/48** với node:test, không thêm dependency. Các ca tự động dùng giá fixture nhỏ hơn bảng Postman nhưng cùng phép tính/điều kiện.
- `node --check`: **PASS, 64 file JavaScript** trong src/tests; `git diff --check`: **PASS**. Tham chiếu Swagger và cú pháp JSON/script của 17 request Postman: **PASS**.
- Chạy HTTP thật qua Express/JWT/role/Zod/controller/service/repository và Mongoose populate/lean; chỉ thao tác collection được mô phỏng. Mỗi request so sánh dữ liệu trước/sau; mọi thao tác ghi qua model/collection đều bị chặn. Hồi quy GET Cart/Address và Swagger đạt.
- **NOT RUN:** Postman/Newman, MongoDB thực tế và toàn bộ Cart CRUD trên database thật. Các cột PASS ở bảng là tự động với collection mô phỏng, không phải bằng chứng Postman/MongoDB thực tế.
- **Không có bất kỳ thao tác ghi database trong Task 3.** Không tạo Cart/Order/OrderItem, không sửa snapshot, không xóa item, không trừ hoặc giữ tồn kho, không tạo giao dịch kho/thanh toán/giao hàng.
- Nhiều truy vấn không dùng transaction/lock. Giá và tồn kho có thể thay đổi ngay sau response; **Create Order phải kiểm tra lại địa chỉ, khả năng bán, giá và tồn kho**.
- Một truy vấn Inventory mỗi Variant khác nhau, phù hợp giỏ hàng quy mô hiện tại; chưa đo hiệu năng tải lớn. Không xác nhận sẵn sàng production.

## File

Tạo: `src/services/stockPrice.service.js`, `docs/stock-price-validation.md`.

Sửa: `src/services/checkout.service.js`, `src/repositories/cart.repository.js`, `src/config/swagger.js`, `tests/checkout.test.js`, `docs/checkout-validation.md`, `docs/postman/checkout-validation.postman_collection.json`.

Không thêm model, collection, thư viện, cấu hình triển khai hoặc file bí mật.

# FurnitureHub Server

Backend REST API cho hệ thống bán nội thất FurnitureHub, thuộc dự án SDN302 & MMA301.

REST API backend for the FurnitureHub furniture e-commerce project, developed for SDN302 & MMA301.

**Ngôn ngữ / Language:** [Tiếng Việt](#tieng-viet) | [English](#english)

<a id="tieng-viet"></a>

## Tiếng Việt

### 1. Tổng quan

Repository này chứa backend. Frontend web/mobile được chạy riêng và gọi API qua HTTP với dữ liệu JSON.

Các chức năng chính:

- Đăng ký, đăng nhập bằng JWT và phân quyền theo vai trò.
- Quản lý danh mục, thương hiệu, sản phẩm và biến thể sản phẩm (SKU).
- Hồ sơ khách hàng, địa chỉ giao hàng, giỏ hàng, danh sách yêu thích và đánh giá.
- Kiểm tra checkout, tạo đơn, xem lịch sử và xử lý trạng thái đơn hàng.
- Ghi nhận thanh toán COD hoặc chuyển khoản ngân hàng, nhân viên xác nhận thủ công.
- Quản lý tồn kho, nhập/xuất/điều chỉnh kho, cảnh báo tồn thấp và lịch sử giao dịch kho.
- Admin xem thống kê, lấy toàn bộ danh sách người dùng và tạo tài khoản nhân viên.

| Thành phần | Công nghệ |
| --- | --- |
| Runtime | Node.js, JavaScript CommonJS |
| HTTP API | Express 5 |
| Database | MongoDB, Mongoose 9 |
| Xác thực | JSON Web Token, bcryptjs |
| Kiểm tra dữ liệu | Zod |
| Tài liệu API | Swagger UI, OpenAPI 3 |
| Phát triển | Nodemon, dotenv, npm |

### 2. Chuẩn bị

- Node.js **20.19.0 trở lên**, phù hợp với yêu cầu của Mongoose hiện tại, và npm.
- Git để clone repository.
- MongoDB đang chạy trên máy hoặc một MongoDB Atlas cluster.
- MongoDB Compass nếu muốn quản lý dữ liệu qua giao diện.

**Để chạy đầy đủ nghiệp vụ kho và đổi trạng thái đơn hàng, MongoDB cần hỗ trợ transaction: dùng Atlas hoặc local replica set.** MongoDB local standalone có thể chạy các API cơ bản nhưng không đáp ứng các thao tác transaction này. Chỉ thêm `replicaSet` vào URI không tự cấu hình replica set.

### 3. Cài đặt và chạy

#### Bước 1: Lấy mã nguồn và cài dependencies

```bash
git clone https://github.com/FurnitureHub-Ecommerce/furniturehub-server.git
cd furniturehub-server
git switch feature/validation-error-handling
npm ci
```

Nhánh `feature/validation-error-handling` chứa phiên bản được mô tả trong tài liệu này, bao gồm API admin lấy danh sách user. Nếu các thay đổi đã được merge vào nhánh mặc định, có thể bỏ qua lệnh `git switch`.

#### Bước 2: Cấu hình môi trường

Tạo file `.env` ở thư mục gốc, cùng cấp với `server.js`. Đây là mẫu cho MongoDB local:

```dotenv
PORT=5000
DB_MODE=local
MONGODB_URI_LOCAL=mongodb://127.0.0.1:27017/furniturehub
JWT_SECRET=replace_with_a_random_secret
JWT_EXPIRES_IN=7d
```

Tạo chuỗi ngẫu nhiên bằng lệnh sau rồi dùng kết quả làm `JWT_SECRET`:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Nếu dùng Atlas, đặt `DB_MODE=atlas` và bổ sung URI lấy từ cấu hình kết nối của cluster:

```dotenv
DB_MODE=atlas
MONGODB_URI_ATLAS=mongodb+srv://<db_user>:<encoded_password>@<cluster_host>/furniturehub?retryWrites=true&w=majority
```

Thay các giá trị trong `<...>` bằng thông tin của bạn. Tài khoản database và IP truy cập cần được cấu hình trên Atlas; ký tự đặc biệt trong mật khẩu phải được URL-encode. Chỉ giữ một dòng `DB_MODE` trong `.env`.

| Biến | Ý nghĩa |
| --- | --- |
| `PORT` | Cổng server, mặc định `5000` |
| `DB_MODE` | `local` hoặc `atlas`, mặc định `local` |
| `MONGODB_URI_LOCAL` | Bắt buộc khi dùng chế độ `local` |
| `MONGODB_URI_ATLAS` | Bắt buộc khi dùng chế độ `atlas` |
| `JWT_SECRET` | Khóa ký và xác thực JWT; cần cấu hình trước khi đăng nhập |
| `JWT_EXPIRES_IN` | Thời hạn token, mặc định `7d` |

`.env` đã được bỏ qua trong `.gitignore`. Không đưa mật khẩu database hoặc JWT secret thật vào Git.

#### Bước 3: Khởi động backend

```bash
npm run dev
```

Server kết nối MongoDB trước khi mở cổng HTTP. Khi thành công, terminal hiển thị thông báo kết nối MongoDB và `Server running on port 5000`.

| Địa chỉ mặc định | Mục đích |
| --- | --- |
| <http://localhost:5000/> | Kiểm tra server |
| <http://localhost:5000/api-docs> | Đọc và thử API bằng Swagger |
| `http://localhost:5000/api` | Tiền tố các API nghiệp vụ |

Kết quả khi gọi `GET /`:

```json
{ "message": "FurnitureHub API is running" }
```

Nếu đổi `PORT`, thay cổng tương ứng trong các URL trên. Dùng `Ctrl+C` để dừng server; khởi động lại sau khi sửa `.env`.

### 4. Thử API với Swagger

1. Mở <http://localhost:5000/api-docs>.
2. Mở nhóm **Auth**, chọn `POST /api/auth/register`, bấm **Try it out** và gửi body mẫu bên dưới.
3. Gọi `POST /api/auth/login` với email và password vừa đăng ký.
4. Lấy giá trị `token` trong response đăng nhập.
5. Bấm **Authorize**, dán **chỉ chuỗi token**, không thêm `Bearer`, rồi xác nhận.
6. Thử `GET /api/users/profile` bằng tài khoản khách hàng vừa tạo.

Body đăng ký:

```json
{
  "fullName": "Nguyen Van An",
  "email": "customer@example.com",
  "password": "DemoPass123!",
  "phone": "0912345678"
}
```

Body đăng nhập:

```json
{
  "email": "customer@example.com",
  "password": "DemoPass123!"
}
```

API đăng ký luôn tạo `CUSTOMER`. Gửi thêm `role` không tạo được admin hoặc nhân viên.

Nếu dùng Postman hoặc frontend, gửi header sau cho API yêu cầu đăng nhập:

```http
Authorization: Bearer <token>
Content-Type: application/json
```

`Content-Type` cần dùng khi gửi body JSON. Khi chuyển tài khoản trong Swagger, thay token trong **Authorize** bằng token của tài khoản mới.

### 5. Vai trò và tài khoản admin đầu tiên

| Vai trò | Quyền chính |
| --- | --- |
| `CUSTOMER` | Hồ sơ, địa chỉ, giỏ hàng, wishlist, đánh giá, đơn hàng và thanh toán của mình |
| `STAFF` | Xem danh sách đơn hàng, xử lý trạng thái đơn và xác nhận thanh toán |
| `STORAGE_MANAGER` | Xem kho, nhập/xuất/điều chỉnh tồn và cấu hình ngưỡng tồn thấp |
| `ADMIN` | Quản lý catalog, xem/tạo user theo quyền hỗ trợ, thống kê, xử lý đơn/thanh toán và xem kho |

Quyền được quy định theo từng endpoint. Admin không tự động có quyền gọi API dành riêng cho customer; các thao tác sửa tồn kho chỉ dành cho `STORAGE_MANAGER`.

**Thiết lập admin đầu tiên trên database phát triển do bạn quản lý:**

1. Đăng ký một tài khoản riêng, ví dụ `admin@example.com`, qua `POST /api/auth/register`.
2. Trong MongoDB Compass, kết nối đúng database mà backend đang sử dụng.
3. Mở collection `users`, lọc theo `{ "email": "admin@example.com" }`.
4. Sửa trường `role` của đúng tài khoản đó thành `ADMIN` và lưu. Giữ nguyên password đã được hash.
5. Đăng nhập lại qua `/api/auth/login` và dùng token mới trong Swagger. Token cũ vẫn chứa role cũ.
6. Gọi `GET /api/users` để kiểm tra quyền admin.

Không có tài khoản admin mặc định hoặc API đăng ký admin công khai. Sau khi có admin, gọi `POST /api/users` để tạo `STAFF` hoặc `STORAGE_MANAGER` với body mẫu:

```json
{
  "fullName": "Warehouse Manager",
  "email": "warehouse@example.com",
  "password": "DemoPass123!",
  "phone": "0912345678",
  "role": "STORAGE_MANAGER"
}
```

### 6. Các API chính

Đường dẫn dưới đây tính từ `http://localhost:5000`. Xem Swagger để biết đầy đủ body, query, response và quyền của từng endpoint.

| Nhóm | Endpoint tiêu biểu | Mục đích |
| --- | --- | --- |
| Auth | `POST /api/auth/register`, `POST /api/auth/login` | Đăng ký, đăng nhập |
| User | `GET /api/users`, `POST /api/users` | Admin xem toàn bộ user, tạo nhân viên |
| Profile | `GET /api/users/profile`, `PATCH /api/users/profile` | Customer xem/sửa tên và số điện thoại |
| Catalog | `/api/categories`, `/api/brands`, `/api/products` | Danh mục, thương hiệu, sản phẩm |
| Variant | `/api/products/:productId/variants`, `/api/variants/:id` | Biến thể sản phẩm |
| Wishlist | `/api/wishlist` | Sản phẩm yêu thích |
| Cart | `/api/cart`, `/api/cart/items` | Giỏ hàng và các mục trong giỏ |
| Address | `/api/addresses` | Địa chỉ giao hàng |
| Checkout | `POST /api/checkout/validate` | Kiểm tra địa chỉ, giỏ hàng trước khi đặt |
| Order | `POST /api/orders`, `GET /api/orders/my-orders` | Customer tạo và xem đơn của mình |
| Order management | `GET /api/orders`, `PATCH /api/orders/:id/confirm` | Staff/admin xem và xác nhận đơn |
| Payment | `POST /api/orders/:orderId/payment`, `PATCH /api/payments/:paymentId/status` | Customer tạo thanh toán, staff/admin cập nhật trạng thái |
| Inventory | `/api/inventory`, `/api/inventory/transactions` | Tồn kho và lịch sử nhập/xuất |
| Review | `/api/reviews` | Đánh giá sản phẩm |
| Dashboard | `GET /api/dashboard/statistics` | Thống kê dành cho admin |

`GET /api/users` trả `{ "users": [...] }`, bao gồm mọi vai trò và cả tài khoản bị vô hiệu hóa, không phân trang. Kết quả sắp xếp mới nhất trước và không chứa password.

### 7. Luồng chạy thử mua hàng

Database mới chưa có dữ liệu mẫu. Thực hiện theo thứ tự sau, dùng body mẫu trong Swagger và thay ID bằng ID thật trả về từ API:

1. **Admin:** tạo category, brand, product và variant; tạo tài khoản quản lý kho.
2. **Storage manager:** nhập hàng bằng `POST /api/inventory/:variantId/import` để variant có tồn kho.
3. **Customer:** tạo địa chỉ qua `POST /api/addresses`, thêm hàng qua `POST /api/cart/items` với `variantId` và `quantity`.
4. **Customer:** gọi `POST /api/checkout/validate`, sau đó `POST /api/orders`; cả hai nhận `{ "addressId": "<address_id>" }`. Backend lấy hàng từ giỏ và tự tính giá.
5. **Customer:** khi đơn còn `pending`, gọi `POST /api/orders/:orderId/payment` với `{ "paymentMethod": "COD" }` hoặc `{ "paymentMethod": "BANK_TRANSFER" }`.
6. **Staff/admin:** xác nhận đơn qua `PATCH /api/orders/:id/confirm`. Khi đã kiểm tra việc nhận tiền thực tế, cập nhật payment qua `PATCH /api/payments/:paymentId/status` với `{ "status": "paid" }`.
7. **Customer:** xem `GET /api/orders/my-orders` hoặc `GET /api/orders/:id/tracking`.

Trạng thái đơn hiện có: `pending`, `confirmed`, `rejected`, `cancelled`. API tạo payment hiện chỉ chấp nhận đơn `pending`, vì vậy tạo payment trước khi xác nhận đơn. Xác nhận payment không tự đổi trạng thái đơn. MoMo và xác nhận chuyển khoản tự động chưa được tích hợp.

### 8. Cấu trúc và lệnh thường dùng

```text
furniturehub-server/
|-- src/
|   |-- config/          # MongoDB, Swagger
|   |-- constants/       # Vai tro, trang thai
|   |-- controllers/     # Xu ly HTTP request/response
|   |-- dtos/            # Doi tuong du lieu dau vao
|   |-- middlewares/     # JWT, phan quyen, validation, loi
|   |-- models/          # Mongoose schemas
|   |-- repositories/    # Truy van database
|   |-- routes/          # Dinh tuyen API
|   |-- services/        # Nghiep vu
|   |-- validators/      # Zod schemas
|   `-- app.js           # Express app
|-- .env                 # Cau hinh local, khong commit
|-- package.json
|-- package-lock.json
|-- README.md
`-- server.js            # Ket noi database va chay server
```

Luồng xử lý phổ biến: `Route -> Middleware -> Controller -> Service -> Repository/Model`.

| Lệnh | Công dụng |
| --- | --- |
| `npm ci` | Cài dependencies theo `package-lock.json` |
| `npm run dev` | Chạy với Nodemon, tự khởi động lại khi sửa code |
| `npm start` | Chạy bằng Node.js, không tự reload |
| `npm test` | Chạy Node test runner; phiên bản này chưa có file test tự động |

Dự án chạy JavaScript trực tiếp, không có bước `npm run build`.

### 9. Lỗi thường gặp

| Hiện tượng | Cách kiểm tra |
| --- | --- |
| Không kết nối được MongoDB | Kiểm tra `DB_MODE`, URI, MongoDB local đã chạy chưa; với Atlas kiểm tra database user và IP được phép truy cập |
| `MongoDB URI for ... is missing` | Bổ sung đúng `MONGODB_URI_LOCAL` hoặc `MONGODB_URI_ATLAS` theo `DB_MODE` |
| Lỗi transaction hoặc `503` khi đổi trạng thái đơn | Dùng Atlas hoặc MongoDB replica set; local standalone không đủ |
| `401 Unauthorized` | Đăng nhập lại và gửi JWT hợp lệ; kiểm tra tài khoản còn active |
| `403 Forbidden` | Dùng tài khoản đúng role; nếu vừa đổi role trong DB thì đăng nhập lại |
| `400 Bad Request` | Kiểm tra body/query theo Swagger; ID phải đúng định dạng, tránh gửi thêm field không hỗ trợ |
| `409 Conflict` | Kiểm tra trạng thái đơn/payment và thông báo lỗi trước khi thử lại |
| `EADDRINUSE` | Đổi `PORT` trong `.env` hoặc dừng tiến trình đang sử dụng cổng |
| Frontend bị CORS | Mặc định chỉ cho `http://localhost:5173` và `http://127.0.0.1:5173`; cập nhật danh sách origin trong `src/app.js` nếu dùng địa chỉ khác |
| PowerShell chặn `npm.ps1` | Dùng `npm.cmd ci` và `npm.cmd run dev` |

Với Android emulator, địa chỉ truy cập máy host thường là `http://10.0.2.2:5000`. Với điện thoại thật, dùng IP LAN của máy chạy backend, cùng mạng Wi-Fi và cho phép cổng backend qua firewall.

---

<a id="english"></a>

## English

### 1. Overview

This repository contains the backend. Web and mobile clients run separately and communicate with the API using HTTP and JSON.

Main features:

- Registration, JWT login and role-based access control.
- Categories, brands, products and product variants (SKUs).
- Customer profiles, shipping addresses, carts, wishlists and reviews.
- Checkout validation, order creation, history and order status management.
- COD and bank transfer payment records, with manual confirmation by staff.
- Inventory, stock imports/exports/adjustments, low-stock alerts and stock transaction history.
- Admin statistics, a complete user list and employee account creation.

| Component | Technology |
| --- | --- |
| Runtime | Node.js, JavaScript CommonJS |
| HTTP API | Express 5 |
| Database | MongoDB, Mongoose 9 |
| Authentication | JSON Web Token, bcryptjs |
| Validation | Zod |
| API documentation | Swagger UI, OpenAPI 3 |
| Development | Nodemon, dotenv, npm |

### 2. Prerequisites

- Node.js **20.19.0 or later**, as required by the current Mongoose dependency, and npm.
- Git to clone the repository.
- A running local MongoDB instance or a MongoDB Atlas cluster.
- MongoDB Compass for optional database management through a GUI.

**Full inventory operations and order status changes require MongoDB transaction support: use Atlas or a local replica set.** A standalone MongoDB instance can run basic APIs but cannot support these transaction operations. Adding `replicaSet` to a URI alone does not configure a replica set.

### 3. Installation and Setup

#### Step 1: Clone and install dependencies

```bash
git clone https://github.com/FurnitureHub-Ecommerce/furniturehub-server.git
cd furniturehub-server
git switch feature/validation-error-handling
npm ci
```

The `feature/validation-error-handling` branch contains the version described here, including the admin user list API. Skip `git switch` if these changes have already been merged into the default branch.

#### Step 2: Configure environment variables

Create `.env` in the project root, next to `server.js`. For local MongoDB:

```dotenv
PORT=5000
DB_MODE=local
MONGODB_URI_LOCAL=mongodb://127.0.0.1:27017/furniturehub
JWT_SECRET=replace_with_a_random_secret
JWT_EXPIRES_IN=7d
```

Generate a random value and use the output as `JWT_SECRET`:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

For Atlas, set `DB_MODE=atlas` and add the connection URI from your cluster configuration:

```dotenv
DB_MODE=atlas
MONGODB_URI_ATLAS=mongodb+srv://<db_user>:<encoded_password>@<cluster_host>/furniturehub?retryWrites=true&w=majority
```

Replace the `<...>` placeholders with your values. Configure an Atlas database user and network access for your IP; URL-encode special characters in the password. Keep only one `DB_MODE` entry in `.env`.

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP port; defaults to `5000` |
| `DB_MODE` | `local` or `atlas`; defaults to `local` |
| `MONGODB_URI_LOCAL` | Required in `local` mode |
| `MONGODB_URI_ATLAS` | Required in `atlas` mode |
| `JWT_SECRET` | JWT signing and verification key; configure before login |
| `JWT_EXPIRES_IN` | Token lifetime; defaults to `7d` |

`.env` is already excluded by `.gitignore`. Do not commit real database passwords or JWT secrets.

#### Step 3: Start the backend

```bash
npm run dev
```

The server connects to MongoDB before accepting HTTP requests. Successful startup prints the MongoDB connection message and `Server running on port 5000`.

| Default URL | Purpose |
| --- | --- |
| <http://localhost:5000/> | Server check |
| <http://localhost:5000/api-docs> | Interactive Swagger documentation |
| `http://localhost:5000/api` | Business API prefix |

Expected response from `GET /`:

```json
{ "message": "FurnitureHub API is running" }
```

Use your configured port if you change `PORT`. Stop the server with `Ctrl+C`; restart it after editing `.env`.

### 4. Try the API in Swagger

1. Open <http://localhost:5000/api-docs>.
2. Under **Auth**, open `POST /api/auth/register`, click **Try it out** and submit the sample registration body below.
3. Call `POST /api/auth/login` with the registered email and password.
4. Copy the `token` value from the login response.
5. Click **Authorize**, paste **only the token**, without the `Bearer` prefix, and confirm.
6. Call `GET /api/users/profile` using your new customer account.

Registration body:

```json
{
  "fullName": "Nguyen Van An",
  "email": "customer@example.com",
  "password": "DemoPass123!",
  "phone": "0912345678"
}
```

Login body:

```json
{
  "email": "customer@example.com",
  "password": "DemoPass123!"
}
```

Public registration always creates a `CUSTOMER`. Supplying a `role` field cannot create an admin or employee.

In Postman or a frontend client, send these headers for authenticated JSON requests:

```http
Authorization: Bearer <token>
Content-Type: application/json
```

Use `Content-Type` when sending a JSON body. When switching accounts in Swagger, replace the token in **Authorize**.

### 5. Roles and the First Admin Account

| Role | Main permissions |
| --- | --- |
| `CUSTOMER` | Own profile, addresses, cart, wishlist, reviews, orders and payments |
| `STAFF` | List orders, manage order status and confirm payments |
| `STORAGE_MANAGER` | Read inventory, import/export/adjust stock and set low-stock thresholds |
| `ADMIN` | Manage the catalog, list/create users within supported rules, view statistics, manage orders/payments and read inventory |

Permissions are endpoint-specific. Admins do not automatically have access to customer-only APIs; stock modification endpoints require `STORAGE_MANAGER`.

**Bootstrap the first admin in a development database you control:**

1. Register a dedicated account, such as `admin@example.com`, through `POST /api/auth/register`.
2. Connect MongoDB Compass to the database used by the backend.
3. Open the `users` collection and filter by `{ "email": "admin@example.com" }`.
4. Change that account's `role` to `ADMIN` and save. Leave the hashed password unchanged.
5. Log in again through `/api/auth/login` and use the new token in Swagger. The old token still contains the previous role.
6. Call `GET /api/users` to verify admin access.

There is no default admin account or public admin registration API. Once an admin exists, use `POST /api/users` to create `STAFF` or `STORAGE_MANAGER` accounts:

```json
{
  "fullName": "Warehouse Manager",
  "email": "warehouse@example.com",
  "password": "DemoPass123!",
  "phone": "0912345678",
  "role": "STORAGE_MANAGER"
}
```

### 6. Main APIs

Paths below are relative to `http://localhost:5000`. Swagger contains full request bodies, query parameters, responses and endpoint permissions.

| Group | Example endpoints | Purpose |
| --- | --- | --- |
| Auth | `POST /api/auth/register`, `POST /api/auth/login` | Registration and login |
| User | `GET /api/users`, `POST /api/users` | Admin user list and employee creation |
| Profile | `GET /api/users/profile`, `PATCH /api/users/profile` | Customer profile, name and phone updates |
| Catalog | `/api/categories`, `/api/brands`, `/api/products` | Categories, brands and products |
| Variant | `/api/products/:productId/variants`, `/api/variants/:id` | Product variants |
| Wishlist | `/api/wishlist` | Favorite products |
| Cart | `/api/cart`, `/api/cart/items` | Shopping cart and cart items |
| Address | `/api/addresses` | Shipping addresses |
| Checkout | `POST /api/checkout/validate` | Validate the address and cart |
| Order | `POST /api/orders`, `GET /api/orders/my-orders` | Customer order creation and history |
| Order management | `GET /api/orders`, `PATCH /api/orders/:id/confirm` | Staff/admin order listing and confirmation |
| Payment | `POST /api/orders/:orderId/payment`, `PATCH /api/payments/:paymentId/status` | Customer payment creation and staff/admin status updates |
| Inventory | `/api/inventory`, `/api/inventory/transactions` | Stock and movement history |
| Review | `/api/reviews` | Product reviews |
| Dashboard | `GET /api/dashboard/statistics` | Admin statistics |

`GET /api/users` returns `{ "users": [...] }` with all roles and inactive accounts, without pagination. Results are sorted newest first and exclude passwords.

### 7. Walk Through a Purchase

A new database has no sample data. Follow this sequence using the Swagger examples, replacing IDs with actual values returned by the API:

1. **Admin:** create a category, brand, product and variant; create a warehouse manager account.
2. **Storage manager:** add stock through `POST /api/inventory/:variantId/import`.
3. **Customer:** create an address with `POST /api/addresses`; add a cart item with `POST /api/cart/items`, supplying `variantId` and `quantity`.
4. **Customer:** call `POST /api/checkout/validate`, then `POST /api/orders`. Both accept `{ "addressId": "<address_id>" }`. The backend reads cart items and calculates prices.
5. **Customer:** while the order is `pending`, call `POST /api/orders/:orderId/payment` with `{ "paymentMethod": "COD" }` or `{ "paymentMethod": "BANK_TRANSFER" }`.
6. **Staff/admin:** confirm the order with `PATCH /api/orders/:id/confirm`. After verifying that payment was actually received, call `PATCH /api/payments/:paymentId/status` with `{ "status": "paid" }`.
7. **Customer:** view `GET /api/orders/my-orders` or `GET /api/orders/:id/tracking`.

Current order statuses are `pending`, `confirmed`, `rejected` and `cancelled`. Payment creation currently requires a `pending` order, so create the payment before confirming the order. Confirming payment does not automatically change the order status. MoMo and automatic bank transfer verification are not integrated.

### 8. Structure and Commands

```text
furniturehub-server/
|-- src/
|   |-- config/          # MongoDB and Swagger
|   |-- constants/       # Roles and statuses
|   |-- controllers/     # HTTP request/response handling
|   |-- dtos/            # Input data objects
|   |-- middlewares/     # JWT, roles, validation and errors
|   |-- models/          # Mongoose schemas
|   |-- repositories/    # Database queries
|   |-- routes/          # API routing
|   |-- services/        # Business logic
|   |-- validators/      # Zod schemas
|   `-- app.js           # Express app
|-- .env                 # Local configuration, not committed
|-- package.json
|-- package-lock.json
|-- README.md
`-- server.js            # Database connection and startup
```

Typical request flow: `Route -> Middleware -> Controller -> Service -> Repository/Model`.

| Command | Purpose |
| --- | --- |
| `npm ci` | Install dependencies from `package-lock.json` |
| `npm run dev` | Start with Nodemon and restart on code changes |
| `npm start` | Start with Node.js, without automatic reload |
| `npm test` | Run the Node test runner; this version has no automated test files |

The project runs JavaScript directly and has no `npm run build` step.

### 9. Troubleshooting

| Symptom | What to check |
| --- | --- |
| MongoDB connection fails | Verify `DB_MODE`, the URI and the local MongoDB service; for Atlas, check the database user and allowed IPs |
| `MongoDB URI for ... is missing` | Set `MONGODB_URI_LOCAL` or `MONGODB_URI_ATLAS` to match `DB_MODE` |
| Transaction error or `503` during order status changes | Use Atlas or a MongoDB replica set; standalone MongoDB is insufficient |
| `401 Unauthorized` | Log in again and send a valid JWT; check that the account is active |
| `403 Forbidden` | Use the required role; log in again after changing a role in the database |
| `400 Bad Request` | Match the Swagger body/query schema, use valid IDs and avoid unsupported fields |
| `409 Conflict` | Check the current order/payment state and the error message before retrying |
| `EADDRINUSE` | Change `PORT` in `.env` or stop the process using that port |
| Browser CORS error | Only `http://localhost:5173` and `http://127.0.0.1:5173` are allowed by default; update the origins in `src/app.js` for another frontend URL |
| PowerShell blocks `npm.ps1` | Use `npm.cmd ci` and `npm.cmd run dev` |

An Android emulator typically reaches the host at `http://10.0.2.2:5000`. On a physical phone, use the backend computer's LAN IP, connect to the same Wi-Fi network and allow the backend port through the firewall.

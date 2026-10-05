# Quản lý Sách - 23IT279

Thông số cá nhân hóa:
- Họ tên: Đặng Kiều Trang
- MSSV: 23IT279
- Database: DB_23IT279
- Prefix sản phẩm: 279
- VAT: (9 + 5)% = 14%

## 1. MongoDB Atlas

Tạo database/collection:
- Database: `DB_23IT279`
- Collection nghiệp vụ: `books`
- Collection Session: `sessions`

Nên tạo trước unique index cho `books.code` trong Atlas vì tài khoản WRITE chỉ có quyền INSERT.

### Business user 1 - READ
Username: `read_23IT279`
Custom role trên `DB_23IT279.books`:
- FIND

### Business user 2 - WRITE
Username: `write_23IT279`
Custom role trên `DB_23IT279.books`:
- INSERT

### Technical user - SESSION
Username: `session_23IT279`
Custom role trên `DB_23IT279.sessions`:
- FIND
- INSERT
- UPDATE
- REMOVE
- CREATE_INDEX

Tài khoản Session là tài khoản kỹ thuật, không dùng để đọc/ghi collection `books`.

## 2. Chạy local

1. Copy `.env.example` thành `.env`.
2. Điền 3 MongoDB URI thật.
3. Chạy:

```bash
npm install
npm start
```

Mở `http://localhost:10000`.

## 3. Kiểm tra yêu cầu

- Đăng nhập → Session được lưu trong collection `sessions` trên Atlas.
- GET `/books` → dùng READ URI.
- POST `/books` → dùng WRITE URI.
- Mã sai prefix `279` → HTTP 400.
- Ví dụ giá 100000 → giá sau VAT = 114000.
- Footer luôn hiển thị Họ tên, MSSV, VAT.

## 4. Git

Tạo commit nền rồi tách 2 feature branch từ `main`:

```bash
git init
git add .
git commit -m "chore: initial project"
git branch -M main

git switch -c feature/database
# commit các file Atlas/DB/READ/WRITE

git switch main
git switch -c feature/session
# commit các file express-session/connect-mongo/Handlebars

git switch main

git merge --no-ff feature/database -m "merge: database feature"
git merge --no-ff feature/session -m "merge: session feature"
```

Xem cây:

```bash
git log --graph --oneline --decorate --all
```

## 5. Render

Web Service:
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/healthz`

Thiết lập các biến môi trường trong Render Dashboard; tuyệt đối không commit `.env`.

Bắt buộc:
- `NODE_ENV=production`
- `STUDENT_NAME=Đặng Kiều Trang`
- `STUDENT_ID=23IT279`
- `SESSION_SECRET=<secret thật>`
- `MONGO_READ_URI=<URI thật>`
- `MONGO_WRITE_URI=<URI thật>`
- `MONGO_SESSION_URI=<URI thật>`

Để đáp ứng tiêu chí chạy 24/7, chọn compute plan không spin down khi idle; Free Web Service của Render spin down sau 15 phút không có traffic.

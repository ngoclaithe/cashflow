# Cashflow — Personal Finance Tracker & SePay Bank Integration

Ứng dụng quản lý tài chính cá nhân tự động đồng bộ biến động số dư ngân hàng qua SePay & MB Bank, lập kế hoạch ngân sách, đối soát giao dịch và theo dõi mục tiêu tích lũy tài chính.

---

## 1. Công nghệ & Kiến trúc (Fixed Stack)

- **Frontend**: React 19 + TypeScript + Vite (Vanilla CSS, Modern Dark Theme, Responsive).
- **Backend**: NestJS + TypeScript (Modular Monolith, REST API).
- **Database**: PostgreSQL (Single source of truth).
- **ORM & Migrations**: Prisma ORM.
- **Tích hợp ngân hàng**: SePay API v2 + Webhook thời gian thực.
- **Đối soát định kỳ**: `@nestjs/schedule` (Tự động chạy 23:30 `Asia/Ho_Chi_Minh`).
- **Thông báo**: Telegram Bot API (Ngưỡng ngân sách 70%, 90%, 100%, nhắc tiền nhà trước ngày 5, báo cáo đối soát).
- **Quản lý tiến trình VPS**: PM2 (`ecosystem.config.js`).
- **Reverse Proxy**: Nginx (Frontend: `cashflow.dosutech.site`, Backend: `api-cashflow.dosutech.site`).

---

## 2. Cấu trúc thư mục

```text
cashflow/
├── apps/
│   ├── api/                           # Backend NestJS
│   │   ├── prisma/
│   │   │   ├── schema.prisma          # Prisma Schema
│   │   │   ├── migrations/            # Lịch sử migration PostgreSQL
│   │   │   └── seed.ts                # Dữ liệu khởi tạo (Seed data mẫu)
│   │   └── src/
│   │       ├── auth/                  # JWT authentication & User profile
│   │       ├── accounts/              # Quản lý tài khoản ngân hàng & tiền mặt
│   │       ├── transactions/          # Quản lý giao dịch, tìm kiếm, phân loại
│   │       ├── bank-integrations/     # Adapter SePay, đồng bộ & chống trùng
│   │       ├── categories/            # Danh mục thu/chi
│   │       ├── categorization-rules/  # Quy tắc gán danh mục tự động
│   │       ├── budgets/               # Hạn mức chi tiêu & cảnh báo
│   │       ├── recurring-transactions/# Khoản cố định (Tiền nhà, Lương)
│   │       ├── savings-goals/         # Mục tiêu tích lũy & dự phóng
│   │       ├── dashboard/             # Tổng hợp chỉ số tài chính
│   │       ├── notifications/         # Telegram Bot service
│   │       ├── reconciliation/        # Đối soát 23:30 & lịch sử
│   │       └── health/                # Health check /api/health
│   └── web/                           # Frontend React + Vite
│       └── src/
│           ├── api/client.ts          # API Client kết nối Backend
│           ├── components/            # Giao diện các phân hệ
│           └── utils/                 # Định dạng tiền tệ VND & ngày giờ VN
├── ecosystem.config.js                # Cấu hình PM2 cho VPS
├── package.json                       # Unified monorepo scripts
├── .env.example                       # Biến môi trường mẫu
├── agent_context.md                   # Bối cảnh & quy chuẩn triển khai
└── huongdan.md                        # Hướng dẫn nghiệp vụ chi tiết
```

---

## 3. Cài đặt & Chạy dưới Local

### Yêu cầu:
- Node.js >= 20
- PostgreSQL >= 15 (Chạy cổng 5432, database: `cashflow`, user: `cashflow`, password: `test1234`)

### Các bước:
1. **Clone repository**:
   ```bash
   git clone https://github.com/ngoclaithe/cashflow.git
   cd cashflow
   ```

2. **Cấu hình môi trường**:
   Sao chép `.env.example` sang `.env` hoặc `apps/api/.env`:
   ```bash
   DATABASE_URL="postgresql://cashflow:test1234@127.0.0.1:5432/cashflow?schema=public"
   PORT=4000
   JWT_SECRET="cashflow_jwt_secret_dev"
   ```

3. **Chạy migration & seed dữ liệu**:
   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   npm --workspace=api run seed
   ```

4. **Chạy Backend & Frontend**:
   ```bash
   # Chạy Backend (Port 4000)
   npm run dev:api

   # Chạy Frontend (Port 5173)
   npm run dev:web
   ```

---

## 4. Tài khoản đăng nhập mặc định (Seed Data)

- **Email**: `admin@cashflow.local`
- **Mật khẩu**: `admin123456`

---

## 5. Quy trình Triển khai VPS (Mandatory Deployment Workflow)

Theo quy định tại `agent_context.md`:
1. Kiểm tra build và test cục bộ:
   ```bash
   npm run test
   npm run build
   ```
2. Commit và push lên GitHub:
   ```bash
   git push origin main
   ```
3. SSH vào VPS (`root@160.191.89.94`):
   - Kéo code mới về `/home/cashflow`.
   - Cài đặt dependencies và build `apps/api`, `apps/web`.
   - Chạy `npx prisma migrate deploy`.
   - Khởi động/Reload PM2:
     ```bash
     pm2 start ecosystem.config.js --only cashflow-api
     ```
   - Cấu hình Nginx cho 2 domain:
     - Frontend: `cashflow.dosutech.site` -> `apps/web/dist`
     - Backend API: `api-cashflow.dosutech.site` -> `http://127.0.0.1:4000`

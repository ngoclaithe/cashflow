# GPM Pay — AI Skill (Node.js SDK)

> Dành cho AI coding assistant. Người dùng muốn tích hợp GPM Pay (đối soát
> chuyển khoản ngân hàng tự động) vào dự án **Node.js / TypeScript** của họ.
> Hãy dùng package chính thức `@gpmpay/sdk`, đừng gọi REST thô.
>
> Khi cần giá trị bí mật (API token, webhook secret), **hỏi người dùng** —
> tuyệt đối không bịa ra.

---

## 0. Nguyên tắc không được vi phạm

1. **Không hardcode API token.** Đọc từ `process.env.GPMPAY_API_TOKEN`.
2. **Không đưa token ra trình duyệt.** Không đặt tiền tố `NEXT_PUBLIC_`,
   không dùng trong client component, không nhúng vào app mobile. Nếu người
   dùng yêu cầu gọi từ browser, hãy từ chối và giải thích: dựng QR ở server,
   chỉ gửi chuỗi QR / URL ảnh xuống client.
3. **Không `JSON.stringify(req.body)` khi verify webhook.** Phải có raw body.
4. **Số tiền luôn là số nguyên VND.** Số thực tạo ra khoản thanh toán không bao
   giờ đối soát được.

---

## 1. Cơ chế thật sự của GPM Pay

Không có cổng thanh toán giữ tiền. Khách chuyển khoản ngân hàng bình thường vào
tài khoản của merchant. GPM Pay theo dõi tài khoản đó và bắn webhook cho **mọi**
giao dịch tiền vào, kèm số tiền và nội dung chuyển khoản.

Đó là toàn bộ sản phẩm. Phần còn lại là tiện ích chồng lên.

## 2. Mô hình đối soát — bạn tự khớp

**GPM Pay không giữ trạng thái đơn hàng.** Không có khái niệm "đơn hàng" phía
GPM Pay: bạn nhét mã của mình vào nội dung chuyển khoản, GPM Pay bắn webhook cho
mọi giao dịch, bạn khớp mã đó với bảng đơn hàng sẵn có của dự án.

| Việc | Ai làm |
|---|---|
| Sinh mã đối soát | bạn — dùng id đơn nội bộ, vd `DH123` |
| Dựng QR | bạn — `buildVietQrPayload({ description: 'DH123' })` |
| Khớp giao dịch với đơn | bạn — dựa vào `event.payload.content` |
| So số tiền | **bạn** — không ai làm hộ |
| Quy tắc hết hạn đơn | bạn |

Đừng đi tìm API tạo đơn phía GPM Pay — không có. Toàn bộ trạng thái đơn nằm ở
DB của bạn, đó là chủ đích thiết kế: không thêm một thực thể phải giữ đồng bộ.

---

## 3. Cài đặt

```bash
pnpm add @gpmpay/sdk    # npm i / yarn add cũng được
```

Yêu cầu Node >= 18.17. Package không có dependency runtime nào.

```ts
import { GpmPay } from "@gpmpay/sdk";

const client = new GpmPay({ apiToken: process.env.GPMPAY_API_TOKEN! });
```

Constructor **ném `GpmPayConfigError` ngay** nếu thiếu token hoặc token sai
định dạng. Đừng bọc nó trong try/catch nuốt lỗi — thiếu token phải làm app
chết lúc khởi động.

Biến môi trường cần thêm vào `.env.example`:

```bash
GPMPAY_API_TOKEN=          # bắt buộc — tạo tại https://app.gpmpay.com/api-tokens
GPMPAY_API_URL=https://api.gpmpay.com/api/v1
GPMPAY_WEBHOOK_SECRET=     # bắt buộc nếu nhận webhook
```

Scope cần tick khi tạo token:

| Scope | Dùng cho |
|---|---|
| `webhooks:manage` | đăng ký webhook bằng code (`webhookSettings.*`) |
| `bank-accounts:read` | lấy `bankAccountId` và mã BIN, `client.ping()` |
| `transactions:read` | `transactions.list`, đối soát định kỳ |

Kiểm tra nhanh token, scope thật, và lấy `bankAccountId`:

```bash
npx gpmpay ping
npx gpmpay accounts list
```

---

## 4. Đối soát

### 4a. Dựng QR với mã của bạn

```ts
import { buildVietQrPayload, buildVietQrImageUrl } from "@gpmpay/sdk/vietqr";

const account = (await client.bankAccounts.list({ status: "ACTIVE" })).data[0]!;

const code = `DH${localOrder.id}`;   // mã của bạn — tối đa 25 ký tự, giữ A-Z0-9

const qrImageUrl = buildVietQrImageUrl({
  bankBin: account.bank!.bin,
  accountNumber: account.accountNumber,
  amount: Math.round(localOrder.total),   // VND, SỐ NGUYÊN
  description: code,                       // thành nội dung chuyển khoản
});
```

Lưu `code` vào đơn nội bộ. Hiển thị QR, và hiển thị `code` như nội dung
chuyển khoản khách phải ghi.

### 4b. Khớp lệnh trong webhook

```ts
onEvent: async (event) => {
  const { id: transactionId, content, transferAmount, transferType } = event.payload;
  if (transferType !== "in") return;

  const code = /DH(\d+)/.exec(content)?.[0];
  if (!code) return;

  const order = await db.orders.findByCode(code);
  if (!order) return;

  // Ở luồng A, KHÔNG có ai so số tiền hộ bạn.
  if (order.total !== transferAmount) {
    await flagUnderpayment(order, transferAmount);
    return;
  }

  await giaoHang(order, transactionId);
}
```

Hai việc **bạn phải tự làm**: **so số tiền**, và **đặt quy tắc hết hạn** cho
đơn treo lâu không ai trả.

---

## 5. Nhận webhook

**Mặc định dùng webhook.** Chỉ polling khi môi trường không nhận được HTTP vào
(CLI, cron, script local).

### 5a. Đăng ký endpoint và verify

Đăng ký một lần — secret chỉ trả về đúng một lần:

```ts
const { secret } = await client.webhookSettings.createHmacEndpoint({
  url: "https://shop.example.com/webhooks/gpmpay",
});
// bảo người dùng lưu `secret` vào GPMPAY_WEBHOOK_SECRET
```

`createHmacEndpoint` **ping thử endpoint trước khi lưu** — không trả 2xx trong 5
giây thì ném `400`, không có setting nào được tạo. Vậy nên thứ tự bắt buộc là:
viết handler → deploy (dev local thì mở tunnel ngrok / cloudflared) → mới gọi hàm
này. Sửa `url` / secret / kiểu xác thực sau đó cũng ping lại y hệt.

**Header phải verify tuỳ theo `authorizationType`.** `createHmacEndpoint` tạo
endpoint `HMAC` — đó là thứ nên dùng. Đừng viết code đi tìm
`X-GPMPay-Signature` nếu endpoint được cấu hình kiểu khác:

| `authorizationType` | Header gửi | Verify bằng |
|---|---|---|
| `HMAC` (mặc định) | `X-GPMPay-Signature: t=…,v1=…` | `constructWebhookEvent()` |
| `API_KEY` | header theo `authorizationHeaderName`, mặc định `Authorization`; giá trị là **secret thô, không có prefix `Bearer`** | `verifyApiKeyHeader()` |
| `NONE` | không có header nào | — |

Không tồn tại header `X-GPMPay-Timestamp` — timestamp nằm trong `t=` bên trong
chữ ký. Kiểm tra endpoint sẵn có bằng `npx gpmpay webhook settings`.

**Express** — raw body parser là bắt buộc:

```ts
import express from "express";
import { gpmpayWebhook } from "@gpmpay/sdk/webhooks";

app.post(
  "/webhooks/gpmpay",
  express.raw({ type: "application/json" }),   // ← bắt buộc, không được bỏ
  gpmpayWebhook({
    secret: process.env.GPMPAY_WEBHOOK_SECRET!,
    onEvent: async (event) => {
      if (event.payload.transferType !== "in") return;
      const code = /DH(\d+)/.exec(event.payload.content)?.[0];
      if (!code) return;
      await xuLyThanhToan(code, event.payload);  // PHẢI idempotent — xem 5c
    },
  }),
);
```

Nếu app đã có `express.json()` toàn cục, đừng gỡ — bắt raw body qua hook:

```ts
app.use(express.json({ verify: (req, _res, buf) => { (req as any).rawBody = buf; } }));
```

**Next.js App Router**:

```ts
// app/api/webhooks/gpmpay/route.ts
import { createNextWebhookHandler } from "@gpmpay/sdk/webhooks";

export const runtime = "nodejs";   // verify dùng node:crypto

export const POST = createNextWebhookHandler({
  secret: process.env.GPMPAY_WEBHOOK_SECRET!,
  onEvent: async (event) => { /* ... */ },
});
```

**Next.js Pages Router** — tắt body parser:

```ts
export const config = { api: { bodyParser: false } };
```
rồi dùng `readRawBody(req)` + `constructWebhookEvent(...)`.

**Framework khác** — tự lấy raw body rồi:

```ts
import { constructWebhookEvent } from "@gpmpay/sdk/webhooks";

const event = constructWebhookEvent({
  rawBody,                                    // string | Buffer, ĐÚNG byte gốc
  signature: headers["x-gpmpay-signature"],
  secret: process.env.GPMPAY_WEBHOOK_SECRET!,
});
```

### 5b. Payload

```ts
{
  id: string;                  // id giao dịch — DÙNG LÀM KHOÁ IDEMPOTENCY
  gateway: string;             // mã ngân hàng: "MB", "VCB", "ACB"...
  transactionDate: string;     // ISO 8601
  accountNumber: string;       // số tài khoản nhận tiền
  subAccount: string | null;
  content: string;             // nội dung chuyển khoản, cắt còn 100 ký tự
  transferType: "in" | "out";  // chữ THƯỜNG
  transferAmount: number;      // VND, không phải xu
  accumulated: number | null;  // số dư sau GD — nhiều ngân hàng không gửi
  referenceCode: string;       // mã GD của NGÂN HÀNG; giả lập có tiền tố "SIM-"
  counterAccount: string | null;
  counterName: string | null;
  counterBankBin: string | null;
  source: "REAL" | "SIMULATED";
}
```

Đủ 14 field, field không có dữ liệu trả `null` chứ không bị lược bỏ. Ví dụ thật:

```json
{
  "id": "b6fec789-f2bd-445d-88e5-86aee24f35c8",
  "source": "REAL",
  "content": "Test doi ung",
  "gateway": "MB",
  "subAccount": null,
  "accumulated": null,
  "counterName": null,
  "transferType": "in",
  "accountNumber": "0342971086",
  "referenceCode": "6LPJSYNrZf7qspvd",
  "counterAccount": "6987",
  "counterBankBin": "970427",
  "transferAmount": 9720,
  "transactionDate": "2026-09-12T16:42:21.013Z"
}
```

Payload **không có** trường `order` hay `code`. Bạn nhận webhook cho **mọi**
giao dịch của tài khoản, kể cả tiền vào không liên quan đơn nào — tự lọc bằng
`transferType` và mã trong `content`.

Tên field ở webhook **khác** tên field `client.transactions.list()` trả về:
`content`/`transferContent`, `transferAmount`/`amount`,
`transferType`/`type`, `transactionDate`/`transactionTime`,
`accumulated`/`balanceAfter`. Đừng dùng chung một kiểu cho hai nơi.

Riêng gói tin ping lúc đăng ký có thêm `test: true` (kèm `id` toàn số 0,
`referenceCode: "GPMPAY-VERIFY"`, `transferAmount: 1`). Chữ ký hợp lệ nên nó đi
lọt `constructWebhookEvent` bình thường — thoát sớm trong `onEvent`, đừng ghi
nhận đơn:

```ts
if ("test" in event.payload) return;
```

### 5c. Hai tính chất bắt buộc của handler

1. **Idempotent theo `event.payload.id`.** GPM Pay retry theo lịch
   `10s, 30s, 2m, 10m, 1h, 6h` — tối đa 6 lần. Cùng một giao dịch sẽ tới nhiều
   lần bất cứ khi nào lần đầu chậm hoặc lỗi. Lưu id đã xử lý và chặn sớm.
2. **Trả lời trong 5 giây.** Quá thì delivery bị huỷ và retry.
   `gpmpayWebhook` đã trả 200 trước khi `await onEvent`. Việc nặng nên đẩy vào
   queue.

## 6. Quy tắc kiểu dữ liệu mà type system không ép được

| Quy tắc | Hậu quả nếu bỏ qua |
|---|---|
| Tiền là **string** khi đọc (`"50000"`), **số nguyên** khi ghi | `tx.amount + 1000` ra `"500001000"` |
| Dùng `toVnd(tx.amount)` để tính, `formatVnd()` để hiển thị | — |
| Timestamp đọc về là ISO string; ghi nhận `string \| Date` | — |
| `limit` bị chặn 50 phía server | SDK tự clamp + cảnh báo; gọi REST thô thì bị cắt im lặng |

---

## 7. Lỗi

Bắt theo lớp, không bắt theo chuỗi:

```ts
import {
  GpmPayPermissionError,     // 403 — .missingScope cho biết thiếu scope nào
  GpmPayAuthenticationError, // 401 — .reason: token_expired | token_inactive | ...
  GpmPayBadRequestError,     // 400 — .validationMessages: string[]
  GpmPayRateLimitError,      // 429 — .retryAfterSeconds
  GpmPayServerError,         // 5xx
  GpmPayError,
} from "@gpmpay/sdk";
```

- Mọi lỗi API mang `.requestId` — hãy log; support dùng nó tra log server.
- SDK **đã** retry sẵn request idempotent và 429 kèm backoff. Đừng bọc thêm
  retry loop của riêng bạn quanh lời gọi SDK.

---

## 8. Test tích hợp

```ts
const client = new GpmPay({ apiToken, sandbox: true });

// Bắn một giao dịch giả lập mang đúng mã đối soát của bạn → webhook sẽ nổ.
// Trả `{ transaction, historyIds }` — envelope, KHÔNG phải Transaction trần.
const { transaction, historyIds } = await client.simulator.createTransaction({
  bankAccountId,
  amount: 50_000,
  transferContent: "DH123",
});

// historyIds rỗng = chưa endpoint nào bật fireOnSimulated → handler không được gọi.
console.log(transaction.id, historyIds.length);
```

`simulator` từ chối chạy trên production trừ khi truyền
`{ allowOnProduction: true }`.

Trong unit test, inject `fetch` thay vì gọi mạng:

```ts
const client = new GpmPay({
  apiToken: "gpm_TESTpub1_abcdefghijklmnopqrstuvwx",
  fetch: mockFetch,
});
```

Test webhook handler bằng cách tự ký body:

```ts
import { signWebhookPayload } from "@gpmpay/sdk/webhooks";
const signature = signWebhookPayload({ rawBody, secret });
```

Hoặc bắn thẳng bằng CLI — không cần API token, không gọi API GPM Pay:

```bash
npx gpmpay webhook send --url http://localhost:3000/webhooks/gpmpay \
  --secret $GPMPAY_WEBHOOK_SECRET

# Handler PHẢI trả 401 cho hai lệnh này. Nếu nó trả 200 thì verify chưa chạy:
npx gpmpay webhook send --url ... --secret ... --bad-signature
npx gpmpay webhook send --url ... --secret ... --skew 600

# Nội dung tiếng Việt có dấu — chỗ code tự viết hay hỏng:
npx gpmpay webhook send --url ... --secret ... --content "chuyển tiền có dấu"
```

---

## 9. Checklist trước khi báo hoàn thành

- [ ] Token đọc từ env; không hardcode; không `NEXT_PUBLIC_`
- [ ] `amount` là số nguyên VND
- [ ] Trang thanh toán hiện QR **và** nói rõ khách phải ghi mã đối soát của bạn
      trong nội dung chuyển khoản
- [ ] Route webhook mount kèm raw body parser
- [ ] Handler webhook idempotent theo `payload.id` và trả lời nhanh
- [ ] Handler webhook bỏ qua gói tin có `test` (ping lúc đăng ký endpoint)
- [ ] Đã lưu `GPMPAY_WEBHOOK_SECRET` sau khi gọi `createHmacEndpoint`
- [ ] Bắt lỗi theo lớp; có log `requestId`
- [ ] Trạng thái đơn lưu ở DB của người dùng để không giao hàng lặp
- [ ] Đã cập nhật `.env.example`
- [ ] Đã **chạy thật** `gpmpay webhook send --bad-signature` và `--skew 600`,
      handler trả 401 cho cả hai — không phải chỉ đọc code rồi kết luận

---

## 10. Tra cứu thêm

- API base URL của tài khoản này: `https://api.gpmpay.com/api/v1`
- README package: `node_modules/@gpmpay/sdk/README.md`
- Chỉ dẫn dành cho AI: `node_modules/@gpmpay/sdk/AGENTS.md`
- Types đã ship sẵn — đọc `.d.ts` hoặc để editor autocomplete, đừng đoán tên field.

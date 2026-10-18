# CSS responsive Web và thông báo en/vi

## CSS

- `apps/web/src/styles.css`: theme tokens, shared styles, desktop, hover/focus và
  reduced-motion accessibility.
- `apps/web/src/styles/mobile.css`: responsive Web/tablet và touch overrides,
  gồm các breakpoint1100/860/768/680/640/460px và max-height cho màn hình thấp.
- `main.tsx` import CSS chung trước, mobile sau để override responsive rõ ràng.
  Giữ thứ tự các media blocks trong mobile.css; kiểm tra selector specificity khi
  thêm quy tắc mới. Không dồn reduced-motion hoặc desktop hover vào mobile.

Đây là CSS của Web trên màn hình nhỏ; không phải source ứng dụng Mobile.
Không sửa/build/typecheck/test ứng dụng Mobile. Các declaration CSS cũ được giữ
nguyên khi tách; việc kiểm tra layout trực quan theo viewport vẫn cần browser.

## Ngôn ngữ

- `src/i18n/en.ts`: tiếng Anh và danh sách MessageKey.
- `src/i18n/vi.ts`: tiếng Việt, bắt buộc đủ cùng bộ key bằng TypeScript.
- `src/i18n/index.ts`: translate, translateText, useLocale và lựa chọn ngôn ngữ.
- `src/i18n/apiMessages.ts`: ánh xạ wording API cũ sang key, tách khỏi câu chữ UI.
- `src/i18n/LanguageSelector.tsx`: chọn ngôn ngữ tại Login/Register hoặc Settings.

Mặc định **en** để giữ hành vi hiện có. Lựa chọn lưu trong localStorage key
`geochat.web.language`, được giữ khi tải lại trang, đồng bộ qua storage event giữa
các tab và cập nhật `html[lang]`. Không cần đăng xuất hoặc reload ứng dụng. Chỉ
lưu preference trình duyệt, chưa đồng bộ ngôn ngữ vào tài khoản/thiết bị khác.
Đổi ngôn ngữ không remount route hoặc xóa bản nháp.
Nếu trình duyệt chặn ghi localStorage, lựa chọn vẫn có hiệu lực trong tab hiện tại.

Theo phạm vi đã chọn, giai đoạn đầu tập trung thông báo và thao tác chính: auth,
Google/linking, xác minh đăng ký, profile/email trùng, Settings, menu, chuông và
nút gửi/phản hồi lỗi giữ bản nháp. Chưa dịch toàn bộ giao diện, marketing copy,
mọi trang phụ, thông báo push/native hoặc nội dung notification do Backend tạo.
Tin nhắn, tên người dùng, email và nội dung do người dùng viết không bị dịch.

Thêm thông báo mới bằng cùng một semantic key trong cả en.ts và vi.ts:

```tsx
const { t } = useLocale();
return <button>{t('profile.save')}</button>;
// Dữ liệu động dùng placeholder, không nối câu theo thứ tự từ tiếng Anh:
t('home.welcome', { name: user.displayName });
```

Trong component, gọi useLocale ở cấp trên cùng để cập nhật khi đổi ngôn ngữ.
Hàm translate độc lập có thể dùng trong callbacks; không gọi hook trong callback.
Dùng translateText/useLocale().text chỉ với **application messages**, ví dụ lỗi
API được lưu trong state. Bridge ánh xạ các lỗi tiếng Anh đã biết vào key; lỗi
server chưa có key được giữ nguyên thay vì đoán sai nội dung. Khi mở rộng Backend
sau này nên thêm error code ổn định để giảm phụ thuộc vào wording, đồng thời giữ
API contract cho các client cũ. Giai đoạn này không đổi API/DB/JWT.

## Validation

Tests bao phủ đủ key en/vi, persistence, cross-tab, html lang, placeholder động,
fallback, đăng nhập tiếng Việt và đổi ngôn ngữ khi đang có lỗi email mà giữ bản
nháp. Chạy `npm test` và `npm run build` trong apps/web. Không thêm thư viện i18n.

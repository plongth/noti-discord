# WhatsApp → Discord Notification Bridge (Fork WA2DC)

Tài liệu này mô tả kiến trúc và kế hoạch implement cho một fork của **WhatsAppToDiscord (WA2DC)** để:

- Chỉ **forward notification có tin nhắn mới** từ WhatsApp sang Discord.
- Áp dụng cho cả chat locked và unlocked (nếu WhatsApp Web nhận được event).
- **Không hiển thị nội dung message** trên Discord.
- Dùng **WhatsApp Web (Baileys)** làm bridge và **Discord bot (discord.js)** trong cùng một app Node chạy 24/7.

---

## 1. Kiến trúc tổng thể

### 1.1. Thành phần chính

- **WhatsApp client (Baileys)**
  - Kết nối tới WhatsApp Web bằng WebSocket.
  - Nhận event `messages.upsert` cho tin nhắn mới.
- **Discord bot (discord.js) – trong WA2DC fork**
  - Kết nối Gateway Discord.
  - Gửi notification tới channel Discord đích.
- **Notification layer (custom logic của bạn)**
  - Nhận inbound event từ WhatsApp.
  - Chuyển thành notification ngắn, không chứa nội dung tin nhắn.
- **Storage hiện có của WA2DC**
  - Giữ nguyên state/auth như hiện tại, không cần thêm unlock config.

### 1.2. Sơ đồ luồng

```text
[WhatsApp App]
      ↓ (E2E encrypted, gửi qua server WhatsApp)
[WhatsApp Web Servers]
      ↓ WebSocket (WSS)
[Baileys client trong WA2DC fork]
      ↓ Sự kiện messages.upsert
[WA2DC Core Logic - Fork của bạn]
  └─ Tạo Notification ẩn nội dung và gửi sang Discord
            ↓
     [Discord Gateway - discord.js client]
            ↓
   [Discord Server]
      └─ #whatsapp-noti (ví dụ: "WhatsApp: Có tin nhắn mới.")
```

---

## 2. Data model / config

Không cần thêm data model unlock/config riêng cho phiên bản đơn giản.

Chỉ cần dùng mapping chat-channel hiện có của WA2DC:

- WhatsApp chat đã link vào channel Discord nào thì notification sẽ đi vào channel đó.
- Không lưu code, không lưu trạng thái unlock.

---

## 3. Plan triển khai theo bước

### Bước 1: Fork và chạy WA2DC nguyên bản

1. **Fork repo `arespawn/WhatsAppToDiscord`** trên GitHub.
2. Clone về local, `npm install` hoặc theo hướng dẫn trong README của repo.
3. Tạo **Discord Application + Bot**:
   - Lấy bot token.
   - Bật intents tối thiểu: `GUILD_MESSAGES`, `GUILD_MEMBERS` và **`MESSAGE CONTENT`** nếu repo yêu cầu.
   - Invite bot vào server Discord của bạn, cho phép nó access các channel cần thiết.
4. Chạy WA2DC nguyên bản:
   - Scan QR để login WhatsApp (multi-device).
   - Xác nhận: tin nhắn mới từ WhatsApp được forward lên Discord như behavior mặc định.

Mục tiêu: đảm bảo môi trường, dependency, connect WhatsApp/Discord OK trước khi chỉnh logic.

### Bước 2: Xác định điểm hook trong code WA2DC

Trong source fork, cần tìm 2 chỗ chính:

1. **Chỗ kết nối WhatsApp (Baileys)**
   - Thường thấy:
     - `makeWASocket(...)`
     - `sock.ev.on('messages.upsert', async ({ messages, type }) => { ... })`
   - Đây là nơi bạn nhận được message mới từ WhatsApp.

2. **Chỗ xử lý event whatsappMessage ở phía Discord handler**
   - Đây là nơi đang xử lý content/file hiện tại.
   - Bạn sẽ thay bằng gửi notification ngắn.

Ghi chú code lại để biết cần inject logic vào đâu.

### Bước 3: Custom handler notify-only

Trong handler, chỉnh logic để luôn gửi notification ngắn (không content):

```ts
sock.ev.on("messages.upsert", async ({ messages, type }) => {
  for (const msg of messages) {
    const remoteJid = msg.key.remoteJid;
    const notiText = "WhatsApp: Có tin nhắn mới.";
    const channelId = resolveMappedDiscordChannel(remoteJid);
    if (!channelId) continue;
    const channel = await client.channels.fetch(channelId);
    if (channel?.isTextBased()) {
      await channel.send(notiText);
    }
  }
});
```

**Quan trọng:**

- Không đưa messageText, conversation, extendedTextMessage.text, caption, quote, attachment URL vào notiText.
- Không phụ thuộc trạng thái locked/unlocked để quyết định gửi noti.

### Bước 4: Cấu hình Discord channel & phân quyền

- Dùng các channel mapping sẵn có của WA2DC.
- Chắc chắn bot có quyền Send Messages ở các channel bridge.
- Không cần command unlock hoặc config passcode.

### Bước 5: Test end-to-end

1. Gửi tin nhắn từ một chat WhatsApp đã link vào Discord.
2. Xác nhận Discord nhận đúng 1 notification ngắn.
3. Xác nhận không có nội dung message, quote, media URL xuất hiện.
4. Thử nhiều loại message (text, image, sticker, voice) để đảm bảo kết quả luôn là notify-only.
5. Nếu có locked chat nhưng vẫn lên event ở WhatsApp Web, xác nhận vẫn nhận notify tương tự.

### Bước 6: Deploy & vận hành

- **Deploy môi trường Node lâu dài**:
  - PC tại nhà: dùng `pm2` hoặc `systemd` để chạy WA2DC fork.
  - Hoặc Heroku / Railway / Render / VPS: build Docker hoặc chạy Node service.
- Ensure:
  - Volume/thư mục để lưu:
    - `auth_info_*` (Baileys session).
  - Cấu hình restart on crash.
  - Log (stdout) được lưu/streatm để debug khi cần.

---

## 4. Lưu ý về Chat Lock / Locked Chats

- Tính năng **Chat Lock / Secret Code** của WhatsApp là client-side (UI):
  - Trên app, locked chat chỉ hiện notification kiểu `WhatsApp: 1 new message`.
  - Muốn xem nội dung phải vào mục Locked Chats và nhập code/biometrics.
- Với bridge dựa trên **WhatsApp Web (Baileys/WΑ2DC)**:
  - Nếu WhatsApp không gửi dữ liệu locked chat xuống Web client cho tới khi unlock, Baileys cũng **không nhận được event** ⇒ không có gì để noti.
  - Nếu trong tương lai meta thay đổi behavior và Baileys update, flow ở trên vẫn đảm bảo: bạn chỉ noti mà không lộ nội dung.

---

## 5. Tổng kết

- Bạn **fork WA2DC** để giữ luôn WhatsApp Web client + Discord bot trong 1 process Node.
- Chỉnh handler để mọi inbound WhatsApp message đều tạo notification ngắn sang Discord.
- Không dùng unlock workflow, không dùng passcode, không lưu cấu hình unlock.
- Đảm bảo notification luôn ẩn nội dung.
- Host trên **môi trường Node chạy 24/7** (PC/Heroku/Railway/VPS), không dùng Cloudflare Workers cho phần Baileys/Discord gateway.

File này có thể dùng làm context cho agent để nó hiểu kiến trúc + flow và generate code chi tiết cho từng phần (service, command, handler) theo phong cách codebase của bạn.


# Kế hoạch deploy WhatsAppToDiscord bot chung với Arespawn wrapper

## 0. Định nghĩa

- **Arespawn wrapper**: HTTP service (ví dụ NestJS) làm nhiệm vụ nhận request từ Discord bot, gọi API của Arespawn, và trả về response.
- **Discord bot (WA2DC fork)**: Bot được phát triển dựa trên WA2DC, có nhiệm vụ kết nối Discord Gateway, nhận slash command, và gọi HTTP tới wrapper để thực thi lệnh.

## 1. Mục tiêu

- Chạy **Arespawn wrapper (HTTP service)** và **Discord bot WhatsAppToDiscord (WA2DC fork của arespawn)** trên **cùng một Droplet DigitalOcean**.
- Đảm bảo cả 2 service chạy 24/7, tự khởi động lại khi Droplet reboot (dùng **PM2**).
- Để Discord bot gọi nội bộ tới wrapper qua `http://localhost:PORT` (không cần mở thêm port ra ngoài).

## 2. Giả định & tiền đề

- Droplet đã tồn tại, chạy Ubuntu (18.04/20.04/22.04).
- Wrapper Arespawn đã chạy được trên Droplet (có sẵn Node, Nginx/nginx proxy, v.v.).
- Đang dùng repo fork từ `https://github.com/arespawn/WhatsAppToDiscord` cho Discord bot.
- Tài khoản Discord Developer Portal đã tạo **Application + Bot**, đã có:
  - `DISCORD_TOKEN` (hoặc `BOT_TOKEN`).
  - `APPLICATION_ID`.
- Bot đã được mời vào server cần sử dụng, với scopes:
  - `bot`.
  - `applications.commands`.

## 3. Chuẩn bị trên Droplet

### 3.1. SSH vào Droplet

```bash
ssh root@YOUR_DROPLET_IP
```

> Nếu không dùng root, dùng user khác nhưng đảm bảo có quyền sudo.

### 3.2. Tạo thư mục dự án (nếu chưa có)

Ví dụ giữ tất cả source ở `/var/www`:

```bash
mkdir -p /var/www
cd /var/www
```

### 3.3. Clone repo fork WhatsAppToDiscord

```bash
cd /var/www

git clone https://github.com/arespawn/WhatsAppToDiscord.git
cd WhatsAppToDiscord
```

> Nếu repo đã clone từ trước, chỉ cần `git pull` để cập nhật.

```bash
cd /var/www/WhatsAppToDiscord
git pull origin main  # hoặc branch tương ứng
```

## 4. Cài Node.js & PM2 (nếu chưa có)

Nếu máy đã cài Node LTS và PM2 cho wrapper thì **bỏ qua bước này**.

### 4.1. Cài Node.js (qua NodeSource)

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

node -v
npm -v
```

### 4.2. Cài PM2 toàn hệ thống

```bash
npm install -g pm2

pm2 -v
```

PM2 sẽ dùng để:

- Giữ bot chạy 24/7.
- Tự restart nếu crash.
- Tự start lại sau khi server reboot.

## 5. Cấu hình environment cho bot

Trong repo WA2DC fork thường sẽ có file mẫu `.env.example` hoặc hướng dẫn env trong README. Nếu có:

```bash
cd /var/www/WhatsAppToDiscord

cp .env.example .env  # nếu tồn tại
nano .env
```

Thêm/chỉnh sửa các biến môi trường quan trọng:

```env
DISCORD_TOKEN=your_discord_bot_token
APPLICATION_ID=your_application_id

# Nếu bot cần gọi wrapper Arespawn, set URL nội bộ
ARESPAWN_URL=http://127.0.0.1:WRAPPER_PORT
# ví dụ: Arespawn wrapper listen ở port 3000 -> http://127.0.0.1:3000
```

Nếu không có `.env.example`, tạo file `.env` mới và tự định nghĩa các biến mà code cần. Agent khi chỉnh sửa source cần đảm bảo **đọc env qua `process.env`** trong code bot.

## 6. Cài dependencies & build bot

```bash
cd /var/www/WhatsAppToDiscord

npm install  # hoặc pnpm/yarn tuỳ repo
```

Nếu repo dùng TypeScript hoặc có bước build:

```bash
npm run build  # nếu trong package.json có script này
```

Agent cần đọc `package.json` để xác định chính xác:

- Script build (nếu có): `build`, `build:bot`, v.v.
- Script start: `start`, `start:bot`, `start:discord`, v.v.

## 7. Start Discord bot bằng PM2

### 7.1. Xác định script start trong package.json

Ví dụ `package.json` có:

```json
"scripts": {
  "start": "node dist/bot.js"
}
```

hoặc:

```json
"scripts": {
  "start:bot": "node src/index.js"
}
```

Agent phải đọc chính xác tên script và file entrypoint để start bot.

### 7.2. Start bot với PM2

**Trường hợp 1 – Dùng script `npm run start`**:

```bash
cd /var/www/WhatsAppToDiscord

pm2 start "npm run start" --name wa2dc-bot
```

**Trường hợp 2 – Dùng script `npm run start:bot`**:

```bash
pm2 start "npm run start:bot" --name wa2dc-bot
```

**Trường hợp 3 – Gọi trực tiếp file JS**:

```bash
pm2 start dist/bot.js --name wa2dc-bot
# hoặc
pm2 start src/index.js --name wa2dc-bot
```

Sau khi start, kiểm tra log:

```bash
pm2 logs wa2dc-bot
```

Kỳ vọng log:

- Bot login thành công (message như "Logged in as ...").
- Không có lỗi về token hoặc missing intents.

## 8. Chạy wrapper Arespawn song song bằng PM2

Giả sử wrapper đã có sẵn cách chạy (ví dụ NestJS):

```bash
cd /var/www/arespawn-wrapper

pm2 start "npm run start:prod" --name arespawn-wrapper
```

Kiểm tra list PM2:

```bash
pm2 list
```

Kỳ vọng:

- `arespawn-wrapper` trạng thái `online`.
- `wa2dc-bot` trạng thái `online`.

Hai process này hoàn toàn có thể chạy chung trên cùng Droplet.

## 9. Cho PM2 tự start khi server reboot

Sau khi đã start wrapper + bot và mọi thứ chạy ổn:

```bash
pm2 save
pm2 startup
```

PM2 sẽ in ra một lệnh `sudo env PATH=... pm2 startup systemd -u root --hp /root`. Chạy lệnh đó một lần để đăng ký service với `systemd`.

Kết quả:

- Khi Droplet reboot, PM2 sẽ start lại.
- PM2 sẽ tự launch lại `arespawn-wrapper` và `wa2dc-bot` từ snapshot đã `pm2 save`.

## 10. Tích hợp Discord bot với Arespawn wrapper

Trong code bot (event `interactionCreate` hoặc handler slash), agent cần:

1. Đọc env `ARESPAWN_URL`.
2. Khi nhận slash command tương ứng, gọi HTTP tới wrapper.

Ví dụ (TypeScript/Node):

```ts
import fetch from "node-fetch";

const baseUrl = process.env.ARESPAWN_URL ?? "http://127.0.0.1:3000";

// bên trong handler interaction
const res = await fetch(`${baseUrl}/some-endpoint`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    userId: interaction.user.id,
    command: interaction.commandName,
    // payload tuỳ theo logic arespawn
  }),
});

const data = await res.json();

await interaction.reply(data.message ?? "Done");
```

Lưu ý cho agent:

- Ưu tiên dùng `http://127.0.0.1:PORT` để tránh đi qua internet, latency thấp hơn.
- Đảm bảo wrapper expose endpoint phù hợp cho bot.

## 11. Checklist nhanh cho agent

- [ ] Kiểm tra lại `package.json` của fork WA2DC, xác định:
  - [ ] Script build (nếu cần).
  - [ ] Script start đúng cho bot.
- [ ] Đảm bảo `.env` trên Droplet có:
  - [ ] `DISCORD_TOKEN` / `BOT_TOKEN`.
  - [ ] `APPLICATION_ID`.
  - [ ] `ARESPAWN_URL` trỏ về wrapper nội bộ.
- [ ] Đảm bảo bot đã được mời vào server với scopes `bot` + `applications.commands`.
- [ ] Deploy slash commands (nếu repo/bot có script deploy, chạy một lần với APPLICATION_ID + token).
- [ ] Start bot bằng PM2 với tên `wa2dc-bot`.
- [ ] Đảm bảo wrapper cũng chạy bằng PM2 (ví dụ `arespawn-wrapper`).
- [ ] Chạy `pm2 save` + `pm2 startup` để tự start khi reboot.

## 12. Hướng dẫn chỉnh sửa source cho agent

- Khi cần thay đổi logic:
  - Chỉnh code trong repo **WhatsAppToDiscord fork** ở local hoặc trực tiếp trên Droplet (tuỳ workflow).
  - Nếu dùng TypeScript, chạy lại `npm run build`.
  - Restart bot bằng PM2:

    ```bash
    pm2 restart wa2dc-bot
    ```

- Khi cần thay đổi endpoint hoặc URL wrapper:
  - Sửa `ARESPAWN_URL` trong `.env`.
  - Restart bot để load env mới:

    ```bash
    pm2 restart wa2dc-bot
    ```

- Khi cần debug:
  - Dùng `pm2 logs wa2dc-bot` để xem log Discord bot.
  - Dùng `pm2 logs arespawn-wrapper` để xem log wrapper.


# WA2DC Single-Source Deploy Plan (wrapper + discord bot)

## 1) Review source hien tai

### Nhung gi da co san

- Runtime chinh dang chay bang watchdog runner: `npm start` -> `node src/runner.js`.
- Worker process boot app o `src/index.js`.
- Slash command handler tap trung trong `src/discordHandler.js` va duoc register luc startup.
- Env token dung trong runtime la `WA2DC_TOKEN` (day chinh la Discord bot token).
- Docker Compose va script DigitalOcean hien tai dang dinh huong 1 service WA2DC.

### Khoang trong hien tai cho muc tieu "1 source chay ca wrapper + bot"

- Chua co wrapper HTTP rieng kieu Nest/Express/Fastify trong `src/`.
- `package.json` chua co script `start:wrapper` hoac script orchestration cho wrapper.
- Chua co PM2 ecosystem cho 2 app cung source (wrapper + wa2dc-bot).

## 2) Ket luan kha thi

Muc tieu cua ban hoan toan kha thi ma khong can clone them source:

- Dung 1 source duy nhat tren Droplet.
- Co 2 cach trien khai:
  - Cach A (khuyen nghi): 2 process PM2 cung 1 source (`wa2dc-bot` + `arespawn-wrapper`).
  - Cach B: 1 process hop nhat (wrapper nhung noi bo vao runtime WA2DC).

Plan duoi day su dung Cach A vi de van hanh, de rollback, it anh huong den bridge core.

## 3) Kien truc de xuat (Cach A)

- Source duy nhat: `/var/www/wa2dc-current`.
- Process 1: `wa2dc-bot` (entry: `npm start`).
- Process 2: `arespawn-wrapper` (entry: script moi trong cung source, vi du `npm run start:wrapper`).
- Ket noi noi bo: bot goi wrapper qua `http://127.0.0.1:<WRAPPER_PORT>`.
- Process manager: PM2 + `pm2 save` + `pm2 startup`.

## 4) Thay doi source can lam truoc khi deploy

### 4.1 Package scripts

- [x] Giu nguyen `start` cho WA2DC.
- [x] Them script wrapper, vi du:
  - `start:wrapper`: `node src/wrapper/index.js`
  - `start:all` (tu chon): khong bat buoc neu dung PM2 ecosystem.

### 4.2 Wrapper service trong cung source

- [x] Tao entrypoint wrapper (vi du `src/wrapper/index.js`).
- [x] Co endpoint toi thieu:
  - `GET /health`
  - `POST /execute` (hoac endpoint ban dang dung)
- [x] Co timeout va error handling ro rang.
- [x] Khong log secret/token.

### 4.3 Tich hop slash command -> wrapper

- [x] Them command moi trong `commandHandlers`.
- [x] Goi wrapper qua `fetch` den `ARESPAWN_URL`.
- [x] Dat timeout 8-10s va fallback message cho user.
- [x] Validate input command truoc khi goi wrapper.

### 4.4 PM2 ecosystem (khuyen nghi)

- [x] Tao `ecosystem.config.cjs` ngay trong source, khai bao 2 apps:
  - `wa2dc-bot`: chay `npm start`
  - `arespawn-wrapper`: chay `npm run start:wrapper`

## 5) Env contract de chot

```env
WA2DC_TOKEN=your_discord_bot_token
ARESPAWN_URL=http://127.0.0.1:3000
ARESPAWN_WRAPPER_PORT=3000
ARESPAWN_API_BASE_URL=https://... (neu wrapper can goi API ngoai)
ARESPAWN_API_KEY=... (neu can)
```

Ghi chu:

- `WA2DC_TOKEN` chinh la Discord bot token.
- Bot va wrapper dung cung 1 file `.env` trong cung source.

## 6) Deploy checklist chi tiet (single source)

### Phase 0 - Preflight

- [ ] SSH vao Droplet duoc.
- [ ] Node 24+ (`node -v`).
- [ ] PM2 co san (`pm2 -v`).
- [ ] Source cua ban da co san tai `/var/www/wa2dc-current`.
- [ ] `.env` da co token/API key can thiet.

### Phase 1 - Cap nhat source

```bash
cd /var/www/wa2dc-current
git pull origin <branch-deploy>
npm ci
```

- [ ] Pull dung branch.
- [ ] `npm ci` thanh cong.

### Phase 2 - Start bang PM2 tu cung source

Neu dung ecosystem:

```bash
cd /var/www/wa2dc-current
pm2 start ecosystem.config.cjs
```

Neu start tay:

```bash
cd /var/www/wa2dc-current
pm2 start "npm start" --name wa2dc-bot
pm2 start "npm run start:wrapper" --name arespawn-wrapper
```

- [ ] `pm2 list` thay 2 process `online`.
- [ ] `pm2 logs wa2dc-bot --lines 200` khong bao loi token.
- [ ] `pm2 logs arespawn-wrapper --lines 200` health endpoint len on.

### Phase 3 - Verify runtime

- [ ] `curl http://127.0.0.1:3000/health` tra ve 200.
- [ ] Slash command goi wrapper thanh cong.
- [ ] Wrapper fail thi bot reply fallback dung nhu thiet ke.
- [ ] Kiem tra khong lo secret trong log.

### Phase 4 - Persist sau reboot

```bash
pm2 save
pm2 startup
# chay dung lenh PM2 in ra
```

- [ ] Reboot test Droplet.
- [ ] Sau reboot, ca 2 process online lai.

## 7) Checklist update/rollback van hanh

- [ ] Trc update: `pm2 save` + tag/backup commit dang chay.
- [ ] Update: `git pull` + `npm ci` + `pm2 reload ecosystem.config.cjs`.
- [ ] Neu loi: checkout commit truoc do + `npm ci` + `pm2 reload ecosystem.config.cjs`.
- [ ] Theo doi `pm2 logs` 15-30 phut sau moi lan deploy.

## 8) Rủi ro chinh va cach giam

- Sai Node version -> khoa Node 24.x trong server.
- Sai token env -> xac nhan `WA2DC_TOKEN` hop le.
- Missing scope -> moi lai bot voi `bot` + `applications.commands`.
- Wrapper treo -> dat timeout, healthcheck, PM2 restart policy.
- Drift config -> dung 1 `.env` va 1 ecosystem file trong cung source.

## 9) Definition of Done

- [ ] Khong clone them source goc; van deploy duoc tu source hien tai.
- [ ] Ca wrapper va bot deu chay tu cung source, cung PM2.
- [ ] Slash command goi wrapper thanh cong va co fallback khi loi.
- [ ] Reboot Droplet xong he thong tu khoi dong lai day du.


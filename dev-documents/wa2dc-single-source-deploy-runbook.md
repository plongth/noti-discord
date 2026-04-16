# WA2DC Single-Source Deploy Runbook

## 1) Muc tieu

- Chay ca `wa2dc-bot` va `arespawn-wrapper` tu cung 1 source.
- Khong clone them source khac.
- Quan ly process bang PM2.

## 2) Bien moi truong can co

Dat trong `.env` tai thu muc source deploy:

```env
WA2DC_TOKEN=your_discord_bot_token
ARESPAWN_URL=http://127.0.0.1:3000
ARESPAWN_EXECUTE_PATH=/execute
ARESPAWN_REQUEST_TIMEOUT_MS=10000
ARESPAWN_WRAPPER_PORT=3000
ARESPAWN_API_BASE_URL=https://<downstream-host>
ARESPAWN_API_EXECUTE_PATH=/execute
ARESPAWN_API_KEY=<downstream-api-key>
```

Ghi chu:

- `WA2DC_TOKEN` la Discord bot token.
- Wrapper dang dung `Authorization: Bearer <ARESPAWN_API_KEY>` khi goi downstream.

## 3) Deploy command theo thu tu

```bash
cd /var/www/wa2dc-current

git pull origin <branch-deploy>
npm ci

pm2 start ecosystem.config.cjs
pm2 save
```

Neu da start truoc do:

```bash
cd /var/www/wa2dc-current

git pull origin <branch-deploy>
npm ci

pm2 reload ecosystem.config.cjs
pm2 save
```

## 4) Verify sau deploy

```bash
pm2 list
pm2 logs wa2dc-bot --lines 200
pm2 logs arespawn-wrapper --lines 200
curl -sS -i http://127.0.0.1:3000/health
```

Checklist:

- [ ] `wa2dc-bot` online.
- [ ] `arespawn-wrapper` online.
- [ ] `/health` tra 200.
- [ ] Slash command `/run` reply thanh cong.

## 5) Checklist go-live 15 phut

Muc tieu: thao tac nhanh, co checkpoint ro rang, neu fail thi dung ngay va rollback.

### Phut 0-3: Preflight

- [ ] Xac nhan dang o dung thu muc deploy:

```bash
cd /var/www/wa2dc-current
pwd
```

- [ ] Xac nhan env da co bien bat buoc va khong de placeholder:
  - [ ] `WA2DC_TOKEN`
  - [ ] `ARESPAWN_URL`
  - [ ] `ARESPAWN_API_BASE_URL`
  - [ ] `ARESPAWN_API_KEY`

- [ ] Xac nhan PM2 dang hoat dong:

```bash
pm2 -v
pm2 list
```

### Phut 3-8: Deploy

- [ ] Cap nhat source + cai dependency:

```bash
git pull origin <branch-deploy>
npm ci
```

- [ ] Reload process tu ecosystem:

```bash
pm2 reload ecosystem.config.cjs
```

- [ ] Luu snapshot PM2:

```bash
pm2 save
```

### Phut 8-12: Verify

- [ ] Kiem tra process online:

```bash
pm2 list
```

- [ ] Kiem tra wrapper health:

```bash
curl -sS -i http://127.0.0.1:3000/health
```

- [ ] Kiem tra log nhanh (khong co token error, crash loop):

```bash
pm2 logs wa2dc-bot --lines 120
pm2 logs arespawn-wrapper --lines 120
```

- [ ] Thu slash command:
  - [ ] `/run command:ping`
  - [ ] Nhan duoc reply kem `requestId`

### Phut 12-15: Chot go-live hoac rollback

- [ ] Neu tat ca check pass: chot go-live.
- [ ] Neu fail bat ky check quan trong: rollback ngay theo muc Rollback ben duoi.

## 6) Debug endpoint downstream khi chua ro route

Neu chua biet endpoint that, dung cach probe an toan:

### 5.1 Kiem tra host co ton tai

```bash
curl -sS -i "${ARESPAWN_API_BASE_URL}"
```

### 5.2 Thu cac path pho bien

```bash
for p in /execute /v1/execute /commands/execute /api/execute /run; do
  echo "--- POST $p"
  curl -sS -i -X POST "${ARESPAWN_API_BASE_URL}${p}" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${ARESPAWN_API_KEY}" \
    --data '{"command":"ping","args":null,"context":{},"requestId":"probe-1"}'
  echo
  echo
  sleep 1
done
```

Doc ket qua:

- `401/403`: host + path co kha nang dung, nhung auth sai/thieu.
- `404`: path sai.
- `405`: path ton tai nhung sai method.
- `200/2xx`: path dung.

### 5.3 Chot env sau khi tim duoc path

```env
ARESPAWN_API_EXECUTE_PATH=/path-ban-tim-duoc
```

Sau do restart:

```bash
pm2 reload ecosystem.config.cjs
```

## 7) Check nhanh slash command /run

Ví du:

- `/run command:ping`
- `/run command:test args:{"x":1}`

Ky vong:

- Co `requestId` trong reply.
- Neu downstream loi thi bot tra `Wrapper command failed: ...` kem `requestId`.

## 8) Rollback

```bash
cd /var/www/wa2dc-current

git checkout <last-good-commit>
npm ci
pm2 reload ecosystem.config.cjs
pm2 save
```

## 9) Chu y van hanh

- Khong log token/API key trong log.
- Chi expose wrapper noi bo (`127.0.0.1`) neu khong can truy cap tu ngoai.
- Luon giu `pm2 save` sau moi lan deploy thanh cong.

## 10) Auto clear logs moi ngay

Flow DigitalOcean scripts da duoc cap nhat de tu dong cai cron clear log moi ngay khi chay:

```bash
bash scripts/digitalocean/do-deploy.sh
```

Mac dinh cron chay luc `00:15` moi ngay va goi:

```bash
bash scripts/digitalocean/do-log-cleanup.sh
```

Neu muon doi lich, set bien moi truong truoc deploy:

```bash
WA2DC_LOG_CLEANUP_CRON="0 1 * * *" bash scripts/digitalocean/do-deploy.sh
```

Neu muon tat auto-install cron:

```bash
WA2DC_INSTALL_LOG_CLEANUP_CRON=0 bash scripts/digitalocean/do-deploy.sh
```


# WA2DC Notify-Only Checklist

Muc tieu: forward notification tin nhan moi tu WhatsApp sang Discord, khong hien thi noi dung message.

## 1. Scope va behavior

- [ ] Mọi tin nhắn WhatsApp inbound deu tao 1 notification Discord.
- [ ] Ap dung cho ca chat locked va unlocked (neu WhatsApp Web nhan duoc event).
- [ ] Notification khong chua noi dung tin nhan.
- [ ] Khong can unlock workflow, passcode, hoac command unlock.

## 2. Luong xu ly

- [ ] Xac dinh diem hook xu ly inbound WhatsApp.
- [ ] Chinh luong gui Discord thanh notify-only payload.
- [ ] Van giu one-way gate hien co.
- [ ] Van giu whitelist gate hien co.
- [ ] Van giu anti-loop behavior hien co.

## 3. Noi dung notification

- [ ] Dung mau thong bao ngan gon, vi du: Service bridge down, traceId: 123456789.
- [ ] Khong chen:
  - [ ] text message
  - [ ] quote
  - [ ] caption
  - [ ] attachment URL
  - [ ] file name

## 4. Data va storage

- [ ] Khong them schema unlock/contact config rieng.
- [ ] Khong them passcode state.
- [ ] Khong tao migration moi neu khong can thiet.

## 5. Testing

- [ ] Test text message -> chi ra notify.
- [ ] Test image/file/sticker/voice -> van chi ra notify.
- [ ] Test message tu chat linked -> Discord nhan notify.
- [ ] Test message khong duoc phep boi gate hien co -> khong notify.
- [ ] Test payload Discord khong lo content.
- [ ] Chay lint: npm run lint.
- [ ] Chay test: npm test.
- [ ] Chay smoke: WA2DC_SMOKE_TEST=1 node src/index.js.

## 6. Documentation

- [ ] Cap nhat plan/checklist trong dev-documents dong bo voi scope moi.
- [ ] Cap nhat docs/commands.md neu can (neu co xoa logic cu lien quan).

## Definition of Done

- [ ] Tin nhan WhatsApp du dieu kien -> Discord nhan notify-only.
- [ ] Khong co noi dung message bi lo tren Discord.
- [ ] Khong can unlock workflow.
- [ ] Khong regression one-way, whitelist, anti-loop.
- [ ] Lint + test + smoke pass.


# WA2DC Notify-Only Implementation Plan

Tai lieu nay tach ke hoach trien khai chi tiet cho source hien tai cua WA2DC, theo huong:

- Chi gui thong bao co tin nhan moi tu WhatsApp
- Khong lo noi dung tin nhan tren Discord
- Khong su dung unlock workflow

## A. Nguyen tac thiet ke

1. Uu tien tuong thich nguoc voi storage hien co.
2. Khong lam suy yeu guardrails:
   - anti-loop (sentMessages, sentReactions, sentPins)
   - one-way routing
   - whitelist checks
   - JID/LID migration hygiene
3. Privacy-first:
   - notify payload khong chua noi dung goc
4. Reuse architecture co san, tranh tao side effects moi khong can thiet.

## B. Diem hook trong codebase

- WhatsApp inbound event: src/whatsappHandler.js (messages.upsert)
- Discord receive side: src/discordHandler.js (client.on("whatsappMessage"))
- Diem gui message sang Discord: src/discordHandler.js (sendWhatsappMessage)

## C. Kien truc de xuat

### C1. Notify dispatch layer

- Noi dat gate: listener whatsappMessage trong src/discordHandler.js
- Luong:
  1. Nhan payload whatsappMessage
  2. Resolve channelJid -> channel Discord da link
  3. Tao noi dung notify ngan
  4. Gui notify

Noi dung notify de xuat (khong lien quan noi dung message):

- WhatsApp: Co tin nhan moi.

Quy tac cam:

- Khong chen content
- Khong chen quote
- Khong chen attachment list
- Khong chen URL media

### C2. Routing va gate

- Giu one-way gate nhu hien tai.
- Giu whitelist gate nhu hien tai.
- Giu anti-loop behavior nhu hien tai.
- Khong them gate moi theo unlock/contact config.

## D. Lo trinh trien khai theo phase

### Phase 1: Message flow simplification

1. Them gate trong listener whatsappMessage.
2. Replace behavior gui full message bang notify-only.
3. Giu nguyen one-way, whitelist, anti-loop.

Expected output:

- Moi message hop le deu nhan notify-only, khong lo noi dung.

### Phase 2: Tests

1. Bo sung test text/image/file/sticker/voice deu ra notify-only.
2. Bo sung test privacy (notify khong chua content).
3. Bo sung test gate one-way/whitelist khong bi regression.

Expected output:

- Regression risk duoc khoa bang test.

### Phase 3: Docs

1. Cap nhat plan/checklist trong dev-documents.
2. Cap nhat docs/setup.md, docs/faq.md neu can.
3. Cap nhat docs/dev/\* neu co thay doi behavior can document.

Expected output:

- Tai lieu dong bo voi code sau thay doi.

## E. Risk va giai phap

1. Risk: Pha vo luong bridge hien tai

- Giai phap: su dung feature flag rollout, test theo mode.

2. Risk: Sai mapping JID do PN/LID

- Giai phap: normalize + hydrate pair + test JID variants.

3. Risk: Regression one-way/whitelist

- Giai phap: giu gate cu, chi doi payload gui Discord thanh notify-only.

## F. Validation truoc merge

1. npm run lint
2. npm test
3. WA2DC_SMOKE_TEST=1 node src/index.js
4. Kiem tra thu cong E2E:

- Message text: co notify
- Message media/file: co notify
- Notify khong lo noi dung

## G. Definition of Done

1. Notify chi bao co tin nhan moi, khong lo content.
2. Khong su dung unlock workflow.
3. Khong regression cac guardrails quan trong.
4. Test, lint, smoke pass.
5. Docs da cap nhat day du.


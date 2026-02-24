# syntax=docker/dockerfile:1

FROM node:24-alpine
WORKDIR /usr/local/WA2DC
RUN chown node:node /usr/local/WA2DC

COPY --chown=node:node package*.json ./
USER node
RUN npm ci --omit=dev
COPY --chown=node:node . .

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "const fs=require('fs'); const cmdline=fs.readFileSync('/proc/1/cmdline','utf8'); process.exit(cmdline.includes('src/index.js') ? 0 : 1)"

ENTRYPOINT ["node", "src/index.js"]

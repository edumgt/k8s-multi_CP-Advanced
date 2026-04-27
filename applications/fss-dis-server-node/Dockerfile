FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --chown=node:node src ./src
COPY --chown=node:node public ./public

USER node

EXPOSE 3000

CMD ["node", "src/server.js"]

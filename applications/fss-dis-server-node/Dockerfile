FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production

# Bake the SSR server source, runtime deps, and env templates into the image
# so it can run without an extra install/build step.
COPY --chown=node:node . .

USER node

EXPOSE 3000

CMD ["node", "src/server.js"]

FROM node:22-alpine

WORKDIR /app

ARG NPM_REGISTRY=http://192.168.56.31:8081/repository/npm-all/
ARG NPM_AUTH_B64

COPY package.json ./
RUN if [ -n "${NPM_REGISTRY:-}" ]; then \
      npm config set registry "${NPM_REGISTRY}"; \
      if [ -n "${NPM_AUTH_B64:-}" ]; then \
        registry_scope="$(printf '%s' "${NPM_REGISTRY}" | sed -e 's#^https\?://##' -e 's#/*$##')"; \
        npm config set "//${registry_scope}/:_auth" "${NPM_AUTH_B64}"; \
      fi; \
    fi \
 && npm install --omit=dev --no-audit --no-fund

COPY server.js ./

EXPOSE 8080

CMD ["node", "server.js"]

FROM node:22-alpine AS build

WORKDIR /app

ARG APP_ENV=dev
ARG NPM_REGISTRY=http://192.168.56.31:8081/repository/npm-all/
ARG NPM_AUTH_B64

COPY package.json ./
COPY .env.dev .env.dev
COPY .env.prod .env.prod
RUN cp ".env.${APP_ENV}" .env
RUN rm -f .npmrc
RUN if [ -n "${NPM_REGISTRY:-}" ]; then \
      npm config set registry "${NPM_REGISTRY}"; \
      npm config set @jridgewell:registry "https://registry.npmjs.org/"; \
      if [ -n "${NPM_AUTH_B64:-}" ]; then \
        registry_scope="$(printf '%s' "${NPM_REGISTRY}" | sed -e 's#^https\?://##' -e 's#/*$##')"; \
        npm config set "//${registry_scope}/:_auth" "${NPM_AUTH_B64}"; \
      fi; \
    fi \
 && npm install --no-audit --no-fund

COPY . .

ARG VITE_API_BASE_URL=
ARG VITE_BASE_PATH=/fss-dis-frontend/
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_BASE_PATH=${VITE_BASE_PATH}

RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

FROM node:22-bookworm-slim AS build

ARG NPM_REGISTRY=https://registry.npmmirror.com
ARG REACT_APP_API_BASE_URL=/api
ARG REACT_APP_UPLOAD_BASE_URL=
ARG REACT_APP_DEBUG_API=false

ENV REACT_APP_API_BASE_URL=${REACT_APP_API_BASE_URL} \
    REACT_APP_UPLOAD_BASE_URL=${REACT_APP_UPLOAD_BASE_URL} \
    REACT_APP_DEBUG_API=${REACT_APP_DEBUG_API} \
    CI=true

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm config set registry "${NPM_REGISTRY}" && npm ci --legacy-peer-deps
COPY public ./public
COPY src ./src
COPY tsconfig.json ./
RUN npm run build

FROM nginx:1.27-alpine

COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80

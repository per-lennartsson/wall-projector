# Build context is the repo root (see docker-compose.yml), since the app
# needs both web/ (the Vite project) and the sibling VERSION file (baked in
# as a compile-time constant by vite.config.ts, replacing the old sed-based
# approach against app.js).
FROM node:20-alpine AS builder
WORKDIR /app
COPY web/package.json web/package-lock.json* ./
RUN npm install
COPY web/ ./
COPY VERSION ../VERSION
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

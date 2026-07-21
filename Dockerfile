FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
# The Prisma CLI (needed by docker/entrypoint.sh's `prisma migrate deploy`) is
# a devDependency, so it isn't part of the standalone build output above.
# Tried copying just node_modules/{prisma,@prisma}/.bin/prisma across, but the
# CLI's .bin wrapper needs sibling .wasm files that aren't under those paths
# (npm's actual layout, not a clean subtree) — copying the full node_modules
# is the reliable option, at the cost of the image also carrying devDeps.
COPY --from=builder /app/node_modules ./node_modules
COPY docker/entrypoint.sh ./docker/entrypoint.sh
RUN chmod +x ./docker/entrypoint.sh

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENTRYPOINT ["./docker/entrypoint.sh"]

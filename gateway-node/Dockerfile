# ============================================================================
# VektorMesh Node.js Edge Gateway Dockerfile
# Optimized Node.js 20-alpine multi-stage build
# ============================================================================

FROM node:20-alpine AS builder

WORKDIR /app

# Copy proto definitions
COPY proto/ /proto/

# Copy dependency manifests
COPY gateway-node/package*.json ./
RUN npm ci

# Copy TypeScript source and compile
COPY gateway-node/tsconfig.json ./
COPY gateway-node/src ./src

RUN npm run build

# ----------------------------------------------------------------------------
# Production Runner Stage
# ----------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    PORT=4000 \
    HOST=0.0.0.0

# Copy proto file for runtime dynamic loading
COPY proto/ /proto/

# Copy built artifacts and production dependencies
COPY gateway-node/package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist

EXPOSE 4000

HEALTHCHECK --interval=10s --timeout=3s --retries=3 --start-period=5s \
    CMD wget -qO- http://localhost:4000/api/health | grep '"status"' || exit 1

CMD ["node", "dist/server.js"]

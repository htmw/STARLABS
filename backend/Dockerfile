# ── Stage 1: install dependencies ──────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# sharp needs native binaries; install build tools only in this stage
RUN apk add --no-cache python3 make g++ libc6-compat

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ── Stage 2: production image ───────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Runtime-only system deps for sharp
RUN apk add --no-cache vips-dev

ENV NODE_ENV=production

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY src ./src
COPY package.json ./

# Uploads directory (will be overridden by a named volume at runtime)
RUN mkdir -p uploads

EXPOSE 4000

CMD ["node", "src/index.js"]

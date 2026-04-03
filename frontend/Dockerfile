# ── Stage 1: build the React/Vite app ──────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite reads VITE_* vars at BUILD time. Pass them as build-args:
#   docker build --build-arg VITE_BACKEND_URL=http://api.example.com ...
ARG VITE_BACKEND_URL=http://localhost:4000
ENV VITE_BACKEND_URL=${VITE_BACKEND_URL}

RUN npm run build

# ── Stage 2: serve with nginx ───────────────────────────────────────────────
FROM nginx:1.27-alpine AS runner

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Nginx config: SPA fallback + API proxy
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

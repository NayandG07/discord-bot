# ==========================================
# DEVGUILD MULTI-STAGE PRODUCTION DOCKERFILE
# ==========================================

# ------------------------------------------
# Stage 1: Build Dependencies
# ------------------------------------------
FROM node:20-bookworm-slim AS builder

WORKDIR /usr/src/app

# Install native compilation dependencies for canvas and Prisma
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency manifests
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies)
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy source code and build config
COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY src ./src/

# Compile TypeScript to JavaScript
RUN npm run build

# Prune devDependencies to keep image lean
RUN npm prune --production

# ------------------------------------------
# Stage 2: Production Runtime
# ------------------------------------------
FROM node:20-bookworm-slim AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production

# Install runtime libraries for Prisma and Canvas
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    fonts-dejavu-core \
    fonts-freefont-ttf \
    && rm -rf /var/lib/apt/lists/*

# Create unprivileged application user
RUN groupadd -g 1001 devguild && \
    useradd -u 1001 -g devguild -s /bin/bash -m devguild

# Copy node_modules and generated Prisma client from builder
COPY --chown=devguild:devguild --from=builder /usr/src/app/node_modules ./node_modules
COPY --chown=devguild:devguild --from=builder /usr/src/app/node_modules/.prisma ./node_modules/.prisma

# Copy compiled artifacts and package.json
COPY --chown=devguild:devguild --from=builder /usr/src/app/dist ./dist
COPY --chown=devguild:devguild --from=builder /usr/src/app/package.json ./package.json
COPY --chown=devguild:devguild --from=builder /usr/src/app/prisma ./prisma

USER devguild

EXPOSE 3000

# Default command launches REST API; overridden in docker-compose for workers and bot
CMD ["node", "dist/main"]

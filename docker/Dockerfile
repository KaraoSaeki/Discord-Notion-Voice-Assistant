# ============================================
# Stage 1: Builder
# ============================================
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
# Use --no-frozen-lockfile if pnpm-lock.yaml doesn't exist yet
RUN if [ -f pnpm-lock.yaml ]; then \
      pnpm install --frozen-lockfile; \
    else \
      pnpm install; \
    fi

# Copy source code
COPY . .

# Build TypeScript
RUN pnpm build

# ============================================
# Stage 2: Runner
# ============================================
FROM node:20-alpine AS runner

# Install dependencies for audio processing and native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    ffmpeg \
    opus \
    opus-dev \
    libc6-compat

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install production dependencies with scripts enabled for native modules
# This allows @discordjs/opus to build properly
RUN if [ -f pnpm-lock.yaml ]; then \
      pnpm install --prod --frozen-lockfile; \
    else \
      pnpm install --prod; \
    fi

# Check which opus implementation is available
# @discordjs/voice will automatically fallback to opusscript if @discordjs/opus fails
RUN node -e "try { require('@discordjs/opus'); console.log('✅ Using @discordjs/opus (native)'); } catch(e) { try { require('opusscript'); console.log('✅ Using opusscript (fallback)'); } catch(e2) { console.error('❌ No opus implementation found'); process.exit(1); } }"

# Verify encryption library is available
RUN node -e "try { require('libsodium-wrappers'); console.log('✅ Using libsodium-wrappers for encryption'); } catch(e) { console.error('❌ No encryption library found'); process.exit(1); }"

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Copy any necessary config files
COPY tsconfig.json ./

# Set ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Set production environment
ENV NODE_ENV=production
ENV RUN_IN_DOCKER=true

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start application
CMD ["node", "dist/index.js"]

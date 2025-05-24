# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm and required dependencies for Playwright
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    nodejs \
    yarn

# Install pnpm
RUN npm install -g pnpm@10.11.0

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install

# Copy source files
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src/ ./src/

# Build
RUN pnpm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install required dependencies for Playwright
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Install pnpm
RUN npm install -g pnpm@10.11.0

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install only production dependencies
RUN pnpm install --prod

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Set environment variables for Playwright
ENV PLAYWRIGHT_BROWSERS_PATH=/app/pw-browsers
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV CHROME_BIN=/usr/bin/chromium-browser

# Start
CMD ["node", "dist/src/main.js"]
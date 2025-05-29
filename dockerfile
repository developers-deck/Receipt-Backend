FROM node:20-alpine

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
    # Additional dependencies for Playwright
    libstdc++ \
    libc6-compat \
    libgcc \
    libstdc++ \
    linux-headers \
    bash \
    curl \
    # Required for Playwright
    xvfb \
    # Required for Chrome
    dbus \
    # Required for fonts
    fontconfig \
    # Required for Playwright
    python3 \
    make \
    g++

# Install pnpm
RUN npm install -g pnpm@10.11.0

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install

# Copy source files
COPY . .

# Build
RUN pnpm run build

# Set environment variables for Playwright
ENV PLAYWRIGHT_BROWSERS_PATH=/app/pw-browsers
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV CHROME_BIN=/usr/bin/chromium-browser

# Install Playwright browsers with root privileges
RUN PLAYWRIGHT_BROWSERS_PATH=/app/pw-browsers pnpm exec playwright install chromium --with-deps

# Start
CMD ["node", "dist/src/main.js"]
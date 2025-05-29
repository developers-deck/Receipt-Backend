FROM node:20-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    libatk1.0-0t64 \
    libatk-bridge2.0-0t64 \
    libxkbcommon0 \
    libatspi2.0-0t64 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2t64 \
    libcups2 \
    libdrm2 \
    libcairo2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libfreetype6 \
    libgdk-pixbuf2.0-0 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcb-dri3-0 \
    libxcb-render0 \
    libxcb-shape0 \
    libxcb-xfixes0 \
    libxcb-xinerama0 \
    libxcb-xkb1 \
    libxext6 \
    libxi6 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    fonts-liberation \
    libappindicator3-1 \
    xdg-utils \
    wget \
    ca-certificates \
    libu2f-udev \
    libvulkan1 \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN npm install -g pnpm@10.11.0

# Copy package files
COPY package.json ./

# Install dependencies without frozen lockfile
RUN pnpm install --no-frozen-lockfile

# Install Playwright system dependencies
RUN pnpm exec playwright install-deps

# Copy source files
COPY . .

# Build
RUN pnpm run build

# Set environment variables for Playwright
ENV PLAYWRIGHT_BROWSERS_PATH=/app/pw-browsers
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV CHROME_BIN=/usr/bin/chromium
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
ENV PLAYWRIGHT_SKIP_VALIDATION=1

# Create directory for Playwright browsers
RUN mkdir -p /app/pw-browsers

# Create a symbolic link to the system Chromium
RUN ln -s /usr/bin/chromium /app/pw-browsers/chromium

# Start
CMD ["node", "dist/src/main.js"]
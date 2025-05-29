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
    g++ \
    # Additional Chromium dependencies
    atk \
    cups \
    dbus \
    gtk+3.0 \
    libdrm \
    libxcomposite \
    libxdamage \
    libxrandr \
    xdg-utils \
    alsa-lib \
    libxss \
    libxtst \
    liberation-fonts \
    libappindicator \
    mesa-gbm \
    # Additional system libraries
    at-spi2-atk \
    at-spi2-core \
    cairo \
    cups-libs \
    dbus-libs \
    expat \
    fontconfig \
    freetype \
    gdk-pixbuf \
    glib \
    gtk+3.0 \
    libX11 \
    libXcomposite \
    libXcursor \
    libXdamage \
    libXext \
    libXfixes \
    libXi \
    libXrandr \
    libXrender \
    libXss \
    libXtst \
    libxcb \
    libxkbcommon \
    libxshmfence \
    mesa-dri-gallium \
    mesa-va-gallium \
    mesa-vdpau-gallium \
    pango \
    pixman \
    wayland \
    xorg-server \
    # Additional required dependencies from error message
    atk-bridge \
    libatk-bridge \
    libxkbcommon \
    at-spi2-atk \
    libxcomposite \
    libxdamage \
    libxfixes \
    libxrandr \
    mesa-gbm \
    alsa-lib

# Install pnpm
RUN npm install -g pnpm@10.11.0

# Copy package files
COPY package.json ./

# Install dependencies without frozen lockfile
RUN pnpm install --no-frozen-lockfile

# Copy source files
COPY . .

# Build
RUN pnpm run build

# Set environment variables for Playwright
ENV PLAYWRIGHT_BROWSERS_PATH=/app/pw-browsers
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV CHROME_BIN=/usr/bin/chromium-browser
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PLAYWRIGHT_SKIP_VALIDATION=1

# Create directory for Playwright browsers
RUN mkdir -p /app/pw-browsers

# Create a symbolic link to the system Chromium
RUN ln -s /usr/bin/chromium-browser /app/pw-browsers/chromium

# Start
CMD ["node", "dist/src/main.js"]
FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install

# Copy all files
COPY . .

# Debug: Show directory structure
RUN echo "=== Directory Structure ===" && \
    find . -type f -name "*.ts" && \
    echo "=== Source Directory ===" && \
    find ./src -type f

# Build
RUN pnpm run build && \
    echo "=== Build Output ===" && \
    find ./dist -type f

# Start
CMD ["node", "dist/main.js"]
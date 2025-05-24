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

# Clean dist directory and build
RUN rm -rf dist && \
    pnpm run build && \
    echo "=== Build Output ===" && \
    find ./dist -type f

# Start
CMD ["node", "dist/src/main.js"]
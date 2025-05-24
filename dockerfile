FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@10.11.0

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install

# Copy all files
COPY . .

# Clean and build with error handling
RUN rm -rf dist && \
    rm -f tsconfig.tsbuildinfo && \
    pnpm run build || (echo "Build failed" && exit 1)

# Verify build output
RUN if [ ! -f "dist/src/main.js" ]; then \
        echo "Build output not found" && exit 1; \
    fi

# Start
CMD ["node", "dist/src/main.js"]
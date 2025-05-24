# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

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

# Install pnpm
RUN npm install -g pnpm@10.11.0

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install only production dependencies
RUN pnpm install --prod

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Start
CMD ["node", "dist/src/main.js"]
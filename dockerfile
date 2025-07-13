# Stage 1: Builder
# This stage installs all dependencies, including devDependencies,
# and builds the TypeScript source code into JavaScript.
FROM node:20-slim AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@10.11.0

# Copy package manager files
# The '*' handles cases where the lockfile might not exist initially.
COPY package.json ./

# Install all dependencies
# Lock files are intentionally not used for this build to allow auto-generation on install.
RUN pnpm install

# Copy the rest of the source code
COPY . .

# Build the application
RUN pnpm run build

# Stage 2: Production
# This stage creates the final, optimized image. It uses the official
# Playwright image to ensure all browser dependencies are handled correctly.
FROM mcr.microsoft.com/playwright:v1.44.0-jammy

WORKDIR /app

# The Playwright base image already has Node.js and npm/npx.
# We need to install the correct version of pnpm.
RUN npm install -g pnpm@10.11.0

# Copy dependency files and node_modules from the builder stage
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

# Copy the built application from the builder stage
COPY --from=builder /app/dist ./dist

# The Playwright image comes with browsers pre-installed, so we don't
# need to set ENV vars like PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD.
# The image is also configured to find the browsers automatically.

# Expose the application port
EXPOSE 3000

# The Playwright base image runs as a non-root user 'pwuser' for better security.
# We switch to this user.
USER pwuser

# Start the application
CMD ["node", "dist/src/main.js"]
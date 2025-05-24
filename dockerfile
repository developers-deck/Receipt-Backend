# Use a Node.js base image
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and pnpm-lock.yaml (or yarn.lock/package-lock.json) to leverage Docker cache
COPY package.json pnpm-lock.yaml* ./

# Install pnpm globally
RUN npm install -g pnpm

# Install dependencies using pnpm
RUN pnpm install --prod

# Copy the rest of the application code
COPY . .

# Run the build command
RUN pnpm run build

# Set a non-root user and change ownership of the app directory
# This helps prevent permission issues
RUN chown -R node:node /app
USER node

# Expose the port your application listens on (default NestJS port is 3000)
EXPOSE 3000

# Command to run the application
CMD [ "node", "dist/main" ]
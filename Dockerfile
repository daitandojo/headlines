# File: Dockerfile (version 1.02 - Production Hardened)
# syntax = docker/dockerfile:1

ARG NODE_VERSION=20.15.1
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="Node.js"

WORKDIR /app

# --- Build Stage ---
# Use a separate stage for building to keep the final image smaller.
FROM base AS build

# Install build-time dependencies
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3

# Copy package files
COPY package-lock.json package.json ./

# **CRITICAL FIX 1**: Tell Puppeteer to NOT download its own version of Chromium.
# We will install it via apt-get in the final image, which is more reliable.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Install npm dependencies
RUN npm ci

# Copy the rest of the application code
COPY . .

# --- Final Production Image ---
FROM base

# **CRITICAL FIX 2**: Create a non-root user to run the application.
# This is a security best practice and helps Puppeteer run correctly.
RUN groupadd -r node && useradd -r -g node -m -d /app -s /bin/bash node
RUN chown -R node:node /app

# Install production dependencies, including a system version of Chromium.
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends \
    # The browser itself
    chromium \
    # All the necessary libraries for Chromium to run headlessly
    libasound2 libatk-bridge2.0-0 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 \
    libexpat1 libfontconfig1 libgbm1 libgcc1 libglib2.0-0 libgtk-3-0 libnspr4 \
    libnss3 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 \
    libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 \
    libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates lsb-release xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Copy the built application from the 'build' stage
COPY --from=build --chown=node:node /app /app

# Switch to the non-root user
USER node

# Expose the port
EXPOSE 3000

# **CRITICAL FIX 3**: Tell Puppeteer where to find the system-installed Chromium.
ENV PUPPETEER_EXECUTABLE_PATH="/usr/bin/chromium"

# **CRITICAL FIX 4**: Run the application directly with node.
# This avoids an unnecessary npm wrapper script.
CMD [ "node", "bootstrap.js" ]
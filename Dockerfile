# File: Dockerfile (version 1.01)
# syntax = docker/dockerfile:1

# Adjust NODE_VERSION as desired
ARG NODE_VERSION=20.15.1
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="Node.js"

# Node.js app lives here
WORKDIR /app

# Throw-away build stage to reduce size of final image
FROM base AS build

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3

# Install node modules
COPY package-lock.json package.json ./
RUN npm ci

# Copy application code
COPY . .


# Final stage for app image
FROM base

# Install Puppeteer dependencies
# This is the crucial fix for running headless Chromium in a Debian-based container.
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends \
    chromium \
    chromium-sandbox \
    # Font dependencies
    fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
    # Other libraries needed by Chromium
    libasound2 libatk-bridge2.0-0 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 \
    libexpat1 libfontconfig1 libgbm1 libgcc1 libglib2.0-0 libgtk-3-0 libnspr4 \
    libnss3 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 \
    libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 \
    libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates lsb-release \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/*

# Copy built application
COPY --from=build /app /app

# Start the server by default, this can be overwritten at runtime
EXPOSE 3000
# Set the executable path for Puppeteer to use the installed Chromium
ENV PUPPETEER_EXECUTABLE_PATH="/usr/bin/chromium"
CMD [ "npm", "run", "start" ]
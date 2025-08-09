# File: Dockerfile (version 1.03)
# syntax = docker/dockerfile:1

ARG NODE_VERSION=20.15.1
FROM node:${NODE_VERSION}-slim AS base

WORKDIR /app

# --- Build Stage ---
FROM base AS build
RUN apt-get update -qq && apt-get install -y --no-install-recommends build-essential python-is-python3
COPY package-lock.json package.json ./

# Switch to `npm install` which is more robust than `npm ci` in complex scenarios,
# especially with `file:` dependencies that might exist locally but not in the build context.
# Using --omit=dev is equivalent to --production, ensuring dev dependencies are not installed.
RUN npm install --omit=dev

COPY . .

# --- Final Production Image ---
FROM base
COPY --from=build --chown=node:node /app /app

# As root, install system dependencies needed for Playwright's browser.
# This ensures that the headless browser can run in the container.
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends wget ca-certificates && \
    npx playwright install-deps chromium && \
    rm -rf /var/lib/apt/lists/*

USER node

# As the non-root 'node' user, install the browser binary itself.
# It will be installed in the user's home directory cache (/home/node/.cache/ms-playwright).
RUN npx playwright install chromium

# This is no longer a web server, so no EXPOSE needed.
# It runs the pipeline script once and then exits.
CMD [ "node", "app.js" ]
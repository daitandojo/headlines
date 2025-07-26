# File: Dockerfile (version 1.02)
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
USER node

# This is no longer a web server, so no EXPOSE needed.
# It runs the pipeline script once and then exits.
CMD [ "node", "app.js" ]
# File: Dockerfile (version 1.04 - No Puppeteer)
# syntax = docker/dockerfile:1

ARG NODE_VERSION=20.15.1
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="Node.js"
WORKDIR /app

# --- Build Stage ---
FROM base AS build
RUN apt-get update -qq && apt-get install --no-install-recommends -y build-essential python-is-python3
COPY package-lock.json package.json ./
RUN npm ci
COPY . .

# --- Final Production Image ---
FROM base
# No more apt-get needed for Chromium!
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 3000
CMD [ "node", "bootstrap.js" ]
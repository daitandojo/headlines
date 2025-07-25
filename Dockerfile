# File: Dockerfile (version 1.01)
# syntax = docker/dockerfile:1

ARG NODE_VERSION=20.15.1
FROM node:${NODE_VERSION}-slim AS base

WORKDIR /app

# --- Build Stage ---
FROM base AS build
RUN apt-get update -qq && apt-get install -y --no-install-recommends build-essential python-is-python3
COPY package-lock.json package.json ./
RUN npm ci
COPY . .

# --- Final Production Image ---
FROM base
COPY --from=build --chown=node:node /app /app
USER node

# This is no longer a web server, so no EXPOSE needed.
# It runs the pipeline script once and then exits.
CMD [ "node", "--max-old-space-size=3584", "app.js" ]
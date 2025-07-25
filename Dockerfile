# File: Dockerfile (Final Corrected Version)
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
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 3000

# --- THE FIX IS HERE ---
# We must run the self-contained app.js, not the old bootstrap.js
CMD [ "node", "--max-old-space-size=3584", "app.js" ]
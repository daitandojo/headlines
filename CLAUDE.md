# File: CLAUDE.md (version 1.02)
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Headlines-Mongo** is a news processing application that scrapes Danish business news (Børsen, Berlingske, Politiken, Finans.dk), assesses relevance using AI/LLM, and sends curated newsletters via email. The application is deployed on Fly.io and is designed to be triggered by a scheduler.

## Architecture

The application is architected as a **script-based, scheduled task** that runs its data pipeline once and then exits. It is not a web server.

1.  **Trigger**: The application is triggered directly by a scheduler (e.g., Fly.io's `schedule` attribute in `fly.toml` or a local cron job) which executes the `npm start` command.
2.  **Scraping**: Fetch headlines from configured sources.
3.  **Filtering**: Skip articles already in the database.
4.  **AI Assessment (Headlines)**: LLM evaluates headline relevance (threshold: 10).
5.  **Enrichment**: Extract full article content for relevant headlines.
6.  **AI Assessment (Content)**: LLM evaluates article content quality (threshold: 10).
7.  **Storage**: Store relevant articles in MongoDB.
8.  **Email**: Send curated newsletters and a supervisor report directly via a configured SMTP service.

All processing is done within the `runPipeline` function call.

## Core Components

### Key Files
- `app.js`: Main application entry point. Sets up the environment and triggers the pipeline.
- `app-logic.js`: Contains the `runPipeline` function which orchestrates the entire data processing flow from start to finish.
- `src/config/sources.js`: Web scraping configuration for Danish news sites.
- `src/config/env.js`: Centralized module for reading and exporting all environment variables.
- `src/config/email.js`: SMTP and email content configuration.

### Pipeline Modules
- `src/modules/scraping/fetchHeadlines.js`: Multi-source headline extraction.
- `src/modules/assessments/assessHeadlines.js`: AI relevance scoring for headlines.
- `src/modules/assessments/assessArticles.js`: AI content quality scoring.
- `src/modules/scraping/enrichWithBody.js`: Full article content extraction.
- `src/modules/email/index.js`: Email composition and delivery coordination.
- `src/modules/mongoStore/articleOperations.js`: MongoDB CRUD operations.

### Models
- `models/Article.js`: MongoDB schema with comprehensive fields for AI scoring and processing metadata.

## Development Commands

### Core Operations
```bash
# Run the pipeline script locally
npm start

# Run in test mode, re-processing articles from the current scrape
node app.js --refresh

# Run the Jest test suite
npm test
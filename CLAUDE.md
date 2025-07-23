# File: CLAUDE.md (version 1.01)
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Headlines-Mongo** is a news processing application that scrapes Danish business news (Børsen, Berlingske, Politiken, Finans.dk), assesses relevance using AI/LLM, and sends curated newsletters via email. The application is deployed on Fly.io and is designed to be triggered by a scheduled GitHub Action.

## Architecture

The application is architected as a **long-running web server** with a **data pipeline** triggered by an HTTP endpoint.

1.  **Trigger**: A scheduled GitHub Action sends a `POST` request to the `/run-pipeline` endpoint.
2.  **Scraping**: Fetch headlines from configured sources.
3.  **Filtering**: Skip articles already in the database.
4.  **AI Assessment (Headlines)**: LLM evaluates headline relevance (threshold: 10).
5.  **Enrichment**: Extract full article content for relevant headlines.
6.  **AI Assessment (Content)**: LLM evaluates article content quality (threshold: 10).
7.  **Storage**: Store relevant articles in MongoDB.
8.  **Email**: Send curated newsletters and a supervisor report via a configured SMTP service.

**Note:** This application does **not** use Redis or background workers. All processing is done within the `executePipeline` function call.

## Core Components

### Key Files
- `app.js`: Main application entry point. Sets up the Express server and the `/run-pipeline` trigger endpoint.
- `app-logic.js`: Contains the `executePipeline` function which orchestrates the entire data processing flow from start to finish.
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
npm start          # Run the Express server locally (waits for triggers)
npm test           # Run Jest test suite
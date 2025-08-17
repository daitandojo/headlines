// models/Source.js (version 1.0)
import mongoose from 'mongoose'

const { Schema, model, models } = mongoose

const SourceSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    baseUrl: { type: String, required: true, trim: true },
    sectionUrl: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true, index: true },
    language: { type: String, required: true, trim: true, default: 'en' },
    status: {
      type: String,
      enum: ['active', 'paused', 'under_review'],
      default: 'active',
      required: true,
      index: true,
    },
    extractionMethod: {
      type: String,
      enum: ['custom', 'llm', 'json-ld'],
      required: true,
    },
    extractorKey: { type: String, required: false, trim: true },
    headlineSelector: { type: String, required: false, trim: true },
    articleSelector: { type: String, required: false, trim: true },
    imageUrlSelector: { type: String, required: false, trim: true },
    lastScrapedAt: { type: Date, required: false },
    lastSuccessAt: { type: Date, required: false },
    notes: { type: String, required: false, trim: true },
  },
  {
    timestamps: true,
    collection: 'sources',
  }
)

export default models.Source || model('Source', SourceSchema)

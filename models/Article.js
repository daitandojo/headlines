// models/Article.js (version 2.4)
import mongoose from 'mongoose'

const { Schema, model, models } = mongoose

const ArticleSchema = new Schema(
  {
    headline: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 500,
    },
    headline_en: { type: String, trim: true },
    link: { type: String, required: true, unique: true, trim: true },
    newspaper: { type: String, required: true, trim: true },
    source: { type: String, required: true, trim: true },
    country: { type: String, trim: true, index: true },
    imageUrl: { type: String, trim: true },
    headline_selector: { type: String, trim: true },
    relevance_headline: { type: Number, required: true, min: 0, max: 100 },
    assessment_headline: { type: String, required: true, trim: true },
    articleContent: {
      type: {
        contents: { type: [String], default: [] },
      },
      required: false,
    },
    topic: { type: String, trim: true },
    relevance_article: { type: Number, min: 0, max: 100 },
    assessment_article: { type: String, trim: true },
    amount: { type: Number },
    key_individuals: [
      {
        _id: false,
        name: { type: String, trim: true },
        role_in_event: { type: String, trim: true },
        company: { type: String, trim: true },
        email_suggestion: { type: String, trim: true },
      },
    ],
    enrichment_error: { type: String, trim: true },
    emailed: { type: Boolean, default: false },
    embedding: { type: [Number] },
  },
  {
    timestamps: true,
    collection: 'articles',
  }
)

ArticleSchema.index({ headline: 'text', headline_en: 'text', assessment_article: 'text' })
ArticleSchema.index({ newspaper: 1, createdAt: -1 })
ArticleSchema.index({ relevance_article: -1, createdAt: -1 })
ArticleSchema.index({ relevance_headline: -1, createdAt: -1 })
ArticleSchema.index({ country: 1, createdAt: -1 })

export default models.Article || model('Article', ArticleSchema)

// models/Article.js
// --- KEY CHANGE: Import mongoose directly ---
import mongoose from 'mongoose';

const { Schema, model, models } = mongoose;

const ArticleSchema = new Schema(
  {
    headline: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 500,
    },
    link: { type: String, required: true, unique: true, trim: true },
    newspaper: { type: String, required: true, trim: true },
    source: { type: String, required: true, trim: true },
    section: { type: String, required: false, trim: true },
    author: { type: String, required: false, trim: true },
    published: { type: String, required: false, trim: true },
    position: { type: String, required: false, trim: true },
    raw: { type: Schema.Types.Mixed, required: false },
    relevance_headline: { type: Number, required: true, min: 0, max: 100 },
    assessment_headline: { type: String, required: true, trim: true },
    articleContent: {
      headlines: { type: [String], required: false, default: [] },
      subheadings: { type: [String], required: false, default: [] },
      captions: { type: [String], required: false, default: [] },
      contents: { type: [String], required: false, default: [] },
    },
    topic: { type: String, required: false, trim: true },
    relevance_article: { type: Number, required: false, min: 0, max: 100 },
    assessment_article: { type: String, required: false, trim: true },
    amount: { type: Number, required: false },
    contacts: { type: [String], required: false, default: [] },
    background: { type: String, required: false, trim: true },
    error: { type: String, required: false, trim: true, default: null },
    enrichment_error: {
      type: String,
      required: false,
      trim: true,
      default: null,
    },
    storage_error_initial_headline_data: {
      type: String,
      required: false,
      trim: true,
      default: null,
    },
    db_operation_status: { type: String, required: false, trim: true },
    db_error_reason: { type: String, required: false, trim: true },
    emailed: { type: Boolean, default: false },
    email_error: { type: String, required: false, trim: true, default: null },
    email_skipped_reason: {
      type: String,
      required: false,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'articles',
  }
);

ArticleSchema.index({ headline: 1 });
ArticleSchema.index({ newspaper: 1, createdAt: -1 });
ArticleSchema.index({ relevance_article: -1, createdAt: -1 });
ArticleSchema.index({ relevance_headline: -1, createdAt: -1 });

// Use the standard Mongoose `models` object to prevent OverwriteModelError.
export default models.Article || model('Article', ArticleSchema);
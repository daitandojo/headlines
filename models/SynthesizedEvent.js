// models/SynthesizedEvent.js (version 2.2)
import mongoose from 'mongoose'

const { Schema, model, models } = mongoose

const SourceArticleSchema = new Schema(
  {
    headline: { type: String, required: true, trim: true },
    link: { type: String, required: true, trim: true },
    newspaper: { type: String, required: true, trim: true },
    imageUrl: { type: String, trim: true },
  },
  { _id: false }
)

const KeyIndividualSchema = new Schema(
  {
    name: { type: String, trim: true },
    role_in_event: { type: String, trim: true },
    company: { type: String, trim: true },
    email_suggestion: { type: String, trim: true },
  },
  { _id: false }
)

const SynthesizedEventSchema = new Schema(
  {
    event_key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    synthesized_headline: { type: String, required: true, trim: true },
    synthesized_summary: { type: String, required: true, trim: true },
    ai_assessment_reason: { type: String, trim: true },
    country: { type: String, required: true, index: true },
    source_articles: { type: [SourceArticleSchema], required: true },
    highest_relevance_score: { type: Number, required: true, min: 0, max: 100 },
    key_individuals: { type: [KeyIndividualSchema], default: [] },
    event_date: { type: Date, default: Date.now },
    emailed: { type: Boolean, default: false },
    email_sent_at: { type: Date },
  },
  {
    timestamps: true,
    collection: 'synthesized_events',
  }
)

SynthesizedEventSchema.index({
  synthesized_headline: 'text',
  synthesized_summary: 'text',
})
SynthesizedEventSchema.index({ event_date: -1 })
SynthesizedEventSchema.index({ country: 1, createdAt: -1 })
SynthesizedEventSchema.index({ highest_relevance_score: -1 })

export default models.SynthesizedEvent ||
  model('SynthesizedEvent', SynthesizedEventSchema)

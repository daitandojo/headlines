// models/PushSubscription.js (version 1.1)
import mongoose from 'mongoose'

const { Schema, model, models } = mongoose

const PushSubscriptionSchema = new Schema(
  {
    subscriberId: {
      type: Schema.Types.ObjectId,
      ref: 'Subscriber',
      required: true,
      index: true,
    },
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
  },
  {
    timestamps: true,
    collection: 'push_subscriptions',
  }
)

export default models.PushSubscription ||
  model('PushSubscription', PushSubscriptionSchema)

// File: models/Subscriber.js (NEW FILE)
import mongoose from 'mongoose'
import bcrypt from 'bcrypt'

const { Schema, model, models } = mongoose
const SALT_WORK_FACTOR = 10

const SubscriberSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    password: {
      type: String,
      required: true,
      // select: false // uncomment this if you NEVER want the password hash returned in queries
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: false,
      trim: true,
    },
    countries: {
      type: [String],
      required: true,
      default: [],
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
      required: true,
    },
    emailNotificationsEnabled: {
      type: Boolean,
      default: true,
    },
    pushNotificationsEnabled: {
      type: Boolean,
      default: true,
    },
    subscriptionTier: {
      type: String,
      enum: ['free', 'premium', 'enterprise'],
      default: 'free',
    },
    subscriptionExpiresAt: {
      type: Date,
      default: null,
    },
    tokensPaid: {
      type: Number,
      default: 0,
    },
    isLifetimeFree: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'subscribers',
  }
)

// Mongoose pre-save hook to hash password before saving
SubscriberSchema.pre('save', function (next) {
  const user = this
  if (!user.isModified('password')) return next()

  bcrypt.genSalt(SALT_WORK_FACTOR, function (err, salt) {
    if (err) return next(err)
    bcrypt.hash(user.password, salt, function (err, hash) {
      if (err) return next(err)
      user.password = hash
      next()
    })
  })
})

export default models.Subscriber || model('Subscriber', SubscriberSchema)

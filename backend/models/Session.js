const mongoose = require('mongoose');

const SessionSchema = new mongoose.Schema({
  eventId: { type: String, required: true },
  status: { type: String, enum: ['started', 'completed', 'cancelled'], default: 'completed' },
  captureMode: { type: String, required: true }, // 'photo', 'strip', 'gif', 'greenscreen'
  assets: { type: [String], default: [] }, // Array of generated file paths (local relative urls)
  sharing: {
    email: { type: String },
    phone: { type: String },
    channels: { type: [String], default: [] } // 'email', 'sms', 'qr'
  }
}, { timestamps: true });

module.exports = mongoose.models.Session || mongoose.model('Session', SessionSchema);

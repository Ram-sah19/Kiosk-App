const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema({
  name: { type: String, required: true },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) },
  activeTemplateId: { type: String, default: 'default_4x6' },
  captureModes: { type: [String], default: ['photo', 'strip', 'gif', 'greenscreen'] },
  branding: {
    backgroundColor: { type: String, default: '#0a0a16' },
    textColor: { type: String, default: '#ffffff' },
    accentColor: { type: String, default: '#8b5cf6' }, // Violet
    secondaryColor: { type: String, default: '#ec4899' } // Pink
  }
}, { timestamps: true });

module.exports = mongoose.models.Event || mongoose.model('Event', EventSchema);

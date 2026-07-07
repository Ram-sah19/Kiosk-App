const mongoose = require('mongoose');

const TemplateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  layoutType: { type: String, enum: ['single', 'strip', 'grid'], default: 'single' }, // single 4x6, 2x6 strip, 2x2 grid, etc.
  width: { type: Number, default: 1800 }, // px (typically 300 DPI for a 6x4 print is 1800x1200)
  height: { type: Number, default: 1200 }, // px
  overlayImage: { type: String, default: '' }, // Data URI or file path of transparent overlay
  slots: [{
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true }
  }]
}, { timestamps: true });

module.exports = mongoose.models.Template || mongoose.model('Template', TemplateSchema);

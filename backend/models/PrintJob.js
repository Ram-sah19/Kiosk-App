const mongoose = require('mongoose');

const PrintJobSchema = new mongoose.Schema({
  sessionId: { type: String, required: true },
  filePath: { type: String, required: true },
  copies: { type: Number, default: 1 },
  status: { 
    type: String, 
    enum: ['queued', 'printing', 'printed', 'failed', 'jammed'], 
    default: 'queued' 
  },
  errorMessage: { type: String },
  printedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.models.PrintJob || mongoose.model('PrintJob', PrintJobSchema);

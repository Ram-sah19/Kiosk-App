const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getIsConnected } = require('../config/db');
const hardwareSim = require('../services/hardwareSim');
const { compositeImages } = require('../services/compositing');

// Models
const Event = require('../models/Event');
const Session = require('../models/Session');
const PrintJob = require('../models/PrintJob');
const Template = require('../models/Template');

// Ensure Uploads folder exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer Config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'raw-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// In-Memory Database Fallback
const memDb = {
  events: [
    {
      _id: 'default_event',
      name: 'Summer Gala 2026',
      startDate: new Date(),
      endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      activeTemplateId: 'default_4x6',
      captureModes: ['photo', 'strip', 'gif', 'greenscreen'],
      branding: {
        backgroundColor: '#0f0c1b',
        textColor: '#ffffff',
        accentColor: '#8b5cf6',
        secondaryColor: '#ec4899'
      },
      createdAt: new Date()
    }
  ],
  sessions: [],
  printJobs: [],
  templates: [
    {
      _id: 'default_4x6',
      name: 'Classic Landscape 4x6',
      layoutType: 'single',
      width: 1800,
      height: 1200,
      overlayImage: '',
      slots: [{ x: 50, y: 50, width: 1700, height: 1100 }],
      createdAt: new Date()
    },
    {
      _id: 'default_strip',
      name: 'Classic 2x6 Photo Strip',
      layoutType: 'strip',
      width: 600,
      height: 1800,
      overlayImage: '',
      slots: [
        { x: 40, y: 40, width: 520, height: 380 },
        { x: 40, y: 460, width: 520, height: 380 },
        { x: 40, y: 880, width: 520, height: 380 },
        { x: 40, y: 1300, width: 520, height: 380 }
      ],
      createdAt: new Date()
    }
  ],
  activeEventId: 'default_event'
};

// Helper: generate fake Mongo ID for in-memory items
const generateId = () => 'mem_' + Math.random().toString(36).substr(2, 9);

// ----------------------------------------------------
// EVENT ENDPOINTS
// ----------------------------------------------------

router.get('/events', async (req, res) => {
  try {
    if (getIsConnected()) {
      const events = await Event.find().sort({ createdAt: -1 });
      return res.json(events);
    }
    res.json(memDb.events);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/events/active', async (req, res) => {
  try {
    if (getIsConnected()) {
      let event = await Event.findOne(); // For simplicity, grab first event
      if (!event) {
        event = await Event.create({ name: 'Default Event' });
      }
      return res.json(event);
    }
    const event = memDb.events.find(e => e._id === memDb.activeEventId) || memDb.events[0];
    res.json(event);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/events', async (req, res) => {
  try {
    const eventData = req.body;
    if (getIsConnected()) {
      const event = new Event(eventData);
      await event.save();
      return res.json(event);
    }
    const newEvent = {
      _id: generateId(),
      ...eventData,
      createdAt: new Date()
    };
    memDb.events.unshift(newEvent);
    memDb.activeEventId = newEvent._id;
    res.json(newEvent);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/events/active/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!getIsConnected()) {
      memDb.activeEventId = id;
      return res.json({ success: true, activeEventId: id });
    }
    res.json({ success: true, message: 'Event selection handled dynamically on single event' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------
// TEMPLATE ENDPOINTS
// ----------------------------------------------------

router.get('/templates', async (req, res) => {
  try {
    if (getIsConnected()) {
      const templates = await Template.find();
      return res.json(templates);
    }
    res.json(memDb.templates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/templates', async (req, res) => {
  try {
    const templateData = req.body;
    if (getIsConnected()) {
      const template = new Template(templateData);
      await template.save();
      return res.json(template);
    }
    const newTemplate = {
      _id: generateId(),
      ...templateData,
      createdAt: new Date()
    };
    memDb.templates.push(newTemplate);
    res.json(newTemplate);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------
// PHOTO UPLOAD & SESSION COMPOSITION
// ----------------------------------------------------

// Upload raw photo captures from kiosk
router.post('/sessions/upload', upload.array('photos'), async (req, res) => {
  try {
    const { eventId, captureMode, templateId } = req.body;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No photos uploaded' });
    }

    const rawFilePaths = files.map(f => f.path);
    
    // Retrieve template settings
    let template = null;
    if (getIsConnected()) {
      template = await Template.findById(templateId);
    } else {
      template = memDb.templates.find(t => t._id === templateId);
    }

    // Fallback template configurations
    if (!template) {
      if (captureMode === 'strip') {
        template = memDb.templates.find(t => t._id === 'default_strip');
      } else {
        template = memDb.templates.find(t => t._id === 'default_4x6');
      }
    }

    // Trigger simulated camera capture increment
    try {
      await hardwareSim.triggerCapture();
    } catch (e) {
      console.warn('Camera trigger simulation bypassed:', e.message);
    }

    // Final filename layout output
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const finalFilename = `composite-${uniqueSuffix}.jpg`;
    const finalOutputPath = path.join(uploadsDir, finalFilename);

    // Apply template composition using Sharp
    await compositeImages(rawFilePaths, template, finalOutputPath);

    // Create session record
    const assetUrl = `/uploads/${finalFilename}`;
    const sessionData = {
      eventId: eventId || 'default_event',
      status: 'completed',
      captureMode: captureMode || 'photo',
      assets: [assetUrl],
      sharing: { channels: [] }
    };

    let session = null;
    if (getIsConnected()) {
      session = new Session(sessionData);
      await session.save();
    } else {
      session = {
        _id: generateId(),
        ...sessionData,
        createdAt: new Date()
      };
      memDb.sessions.push(session);
    }

    // Broadcast session update via Socket
    const io = req.app.get('socketio');
    if (io) {
      io.emit('newSession', session);
    }

    res.json({
      success: true,
      session,
      imageUrl: assetUrl
    });
  } catch (error) {
    console.error('Session upload/composition error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/sessions', async (req, res) => {
  try {
    const { eventId } = req.query;
    if (getIsConnected()) {
      const query = eventId ? { eventId } : {};
      const sessions = await Session.find(query).sort({ createdAt: -1 });
      return res.json(sessions);
    }
    const sessions = eventId 
      ? memDb.sessions.filter(s => s.eventId === eventId) 
      : memDb.sessions;
    res.json([...sessions].reverse());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update sharing details (e.g. Email/SMS submitted at Kiosk screen)
router.put('/sessions/:id/share', async (req, res) => {
  try {
    const { id } = req.params;
    const { email, phone, channel } = req.body;

    if (getIsConnected()) {
      const session = await Session.findById(id);
      if (!session) return res.status(404).json({ error: 'Session not found' });
      
      if (email) session.sharing.email = email;
      if (phone) session.sharing.phone = phone;
      if (channel && !session.sharing.channels.includes(channel)) {
        session.sharing.channels.push(channel);
      }
      await session.save();

      const io = req.app.get('socketio');
      if (io) io.emit('sessionUpdated', session);

      return res.json(session);
    }

    const session = memDb.sessions.find(s => s._id === id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    if (email) session.sharing.email = email;
    if (phone) session.sharing.phone = phone;
    if (channel && !session.sharing.channels.includes(channel)) {
      session.sharing.channels.push(channel);
    }

    const io = req.app.get('socketio');
    if (io) io.emit('sessionUpdated', session);

    res.json(session);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------
// PRINT QUEUE ENDPOINTS
// ----------------------------------------------------

router.get('/prints', async (req, res) => {
  try {
    if (getIsConnected()) {
      const jobs = await PrintJob.find().sort({ createdAt: -1 });
      return res.json(jobs);
    }
    res.json([...memDb.printJobs].reverse());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/prints', async (req, res) => {
  try {
    const { sessionId, filePath, copies } = req.body;

    const jobData = {
      sessionId,
      filePath,
      copies: copies || 1,
      status: 'queued'
    };

    let job = null;
    if (getIsConnected()) {
      job = new PrintJob(jobData);
      await job.save();
    } else {
      job = {
        _id: generateId(),
        ...jobData,
        createdAt: new Date()
      };
      memDb.printJobs.push(job);
    }

    // Broadcast print queued event
    const io = req.app.get('socketio');
    if (io) io.emit('printJobQueued', job);

    // Trigger async print processing simulation
    processPrintJob(job, io).catch(console.error);

    res.json({ success: true, job });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Printer simulation worker run
async function processPrintJob(job, io) {
  const updateStatus = async (status, err = null) => {
    job.status = status;
    if (err) job.errorMessage = err;
    if (status === 'printed') job.printedAt = new Date();

    if (getIsConnected()) {
      await PrintJob.findByIdAndUpdate(job._id, { 
        status, 
        errorMessage: err, 
        printedAt: status === 'printed' ? new Date() : null 
      });
    }

    if (io) io.emit('printJobUpdated', job);
  };

  try {
    await updateStatus('printing');
    // Run printer hardware simulation
    await hardwareSim.triggerPrintJob(job.copies);
    await updateStatus('printed');
  } catch (err) {
    console.error('Printer simulation error during run:', err.message);
    if (err.message.includes('jammed')) {
      await updateStatus('jammed', err.message);
    } else {
      await updateStatus('failed', err.message);
    }
  }
}

router.post('/prints/:id/retry', async (req, res) => {
  try {
    const { id } = req.params;
    let job = null;

    if (getIsConnected()) {
      job = await PrintJob.findById(id);
    } else {
      job = memDb.printJobs.find(j => j._id === id);
    }

    if (!job) return res.status(404).json({ error: 'Print job not found' });

    job.status = 'queued';
    job.errorMessage = null;

    if (getIsConnected()) {
      await PrintJob.findByIdAndUpdate(id, { status: 'queued', errorMessage: null });
    }

    const io = req.app.get('socketio');
    if (io) io.emit('printJobUpdated', job);

    // Process job again
    processPrintJob(job, io).catch(console.error);

    res.json({ success: true, job });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------
// HARDWARE CONTROL ENDPOINTS
// ----------------------------------------------------

router.get('/hardware', (req, res) => {
  res.json({
    camera: hardwareSim.getCameraState(),
    printer: hardwareSim.getPrinterState()
  });
});

router.post('/hardware/camera/toggle', (req, res) => {
  const { connected } = req.body;
  const state = hardwareSim.toggleCameraConnection(connected);
  res.json(state);
});

router.post('/hardware/camera/settings', (req, res) => {
  const { settings } = req.body;
  const state = hardwareSim.updateCameraSettings(settings);
  res.json(state);
});

router.post('/hardware/printer/toggle', (req, res) => {
  const { connected } = req.body;
  const state = hardwareSim.togglePrinterConnection(connected);
  res.json(state);
});

router.post('/hardware/printer/jam', (req, res) => {
  const state = hardwareSim.forcePrinterJam();
  res.json(state);
});

router.post('/hardware/printer/clear-jam', (req, res) => {
  const state = hardwareSim.clearPrinterJam();
  res.json(state);
});

router.post('/hardware/printer/refill', (req, res) => {
  const state = hardwareSim.refillPrinterPaper();
  res.json(state);
});

// ----------------------------------------------------
// ANALYTICS ENDPOINTS
// ----------------------------------------------------

router.get('/analytics', async (req, res) => {
  try {
    let sessions = [];
    let prints = [];

    if (getIsConnected()) {
      sessions = await Session.find();
      prints = await PrintJob.find();
    } else {
      sessions = memDb.sessions;
      prints = memDb.printJobs;
    }

    // Calculations
    const totalSessions = sessions.length;
    const totalPrints = prints.filter(p => p.status === 'printed').reduce((acc, p) => acc + p.copies, 0);
    
    let shares = 0;
    const modeCounts = { photo: 0, strip: 0, gif: 0, greenscreen: 0 };

    sessions.forEach(s => {
      if (s.sharing && s.sharing.channels.length > 0) {
        shares += 1;
      }
      if (modeCounts[s.captureMode] !== undefined) {
        modeCounts[s.captureMode]++;
      }
    });

    res.json({
      totalSessions,
      totalPrints,
      totalShares: shares,
      modeDistribution: modeCounts,
      shareRate: totalSessions > 0 ? Math.round((shares / totalSessions) * 100) : 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const { connectDB } = require('./config/db');
const hardwareSim = require('./services/hardwareSim');
const apiRoutes = require('./routes/api');

const app = express();
const server = http.createServer(app);

// Socket.IO Setup
const io = socketIo(server, {
  cors: {
    origin: '*', // Allow connections from frontend React app
    methods: ['GET', 'POST', 'PUT']
  }
});

// Give Hardware Sim reference to Socket.IO
hardwareSim.setIoInstance(io);
app.set('socketio', io);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static Folders
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api', apiRoutes);

// Socket Event Handlers
io.on('connection', (socket) => {
  console.log('Client connected to WebSockets:', socket.id);

  // Send initial hardware state to newly connected client
  socket.emit('hardwareState', {
    camera: hardwareSim.getCameraState(),
    printer: hardwareSim.getPrinterState()
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Start Server
const PORT = process.env.PORT || 5000;

async function bootstrap() {
  // Connect to DB
  await connectDB();

  server.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(` DSLR PHOTO BOOTH SERVER RUNNING ON PORT ${PORT}`);
    console.log(` Web Kiosk API: http://localhost:${PORT}/api`);
    console.log(` Uploaded assets directory: http://localhost:${PORT}/uploads`);
    console.log(`==================================================`);
  });
}

bootstrap().catch(err => {
  console.error('Server bootstrapping failed:', err);
  process.exit(1);
});

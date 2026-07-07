// Hardware Simulation Service for DSLR Camera and Dye-Sublimation Printer

let ioInstance = null;

const state = {
  camera: {
    connected: true,
    battery: 92,
    isCapturing: false,
    shutterCount: 8430,
    settings: {
      iso: '400',
      aperture: 'F/4.0',
      shutterSpeed: '1/125',
      whiteBalance: 'Auto'
    }
  },
  printer: {
    connected: true,
    paperRemaining: 240, // max 700
    isPrinting: false,
    status: 'idle', // 'idle', 'printing', 'paper_out', 'jammed'
    totalPrintedCount: 1560
  }
};

const setIoInstance = (io) => {
  ioInstance = io;
};

const emitHardwareState = () => {
  if (ioInstance) {
    ioInstance.emit('hardwareState', state);
  }
};

const getCameraState = () => state.camera;
const getPrinterState = () => state.printer;

const updateCameraSettings = (settings) => {
  state.camera.settings = { ...state.camera.settings, ...settings };
  emitHardwareState();
  return state.camera;
};

const toggleCameraConnection = (connected) => {
  state.camera.connected = connected;
  emitHardwareState();
  return state.camera;
};

const togglePrinterConnection = (connected) => {
  state.printer.connected = connected;
  if (!connected) {
    state.printer.status = 'offline';
  } else {
    state.printer.status = state.printer.paperRemaining <= 0 ? 'paper_out' : 'idle';
  }
  emitHardwareState();
  return state.printer;
};

const triggerCapture = async () => {
  if (!state.camera.connected) {
    throw new Error('Camera is disconnected');
  }
  state.camera.isCapturing = true;
  emitHardwareState();

  // Simulate DSLR autofocus + shutter lag (700ms)
  await new Promise((resolve) => setTimeout(resolve, 700));

  state.camera.isCapturing = false;
  state.camera.shutterCount += 1;
  // Slowly drain battery
  if (state.camera.battery > 5) {
    state.camera.battery -= 1;
  }
  emitHardwareState();
  return { success: true, shutterCount: state.camera.shutterCount };
};

const triggerPrintJob = async (copies = 1) => {
  if (!state.printer.connected) {
    throw new Error('Printer is disconnected');
  }
  if (state.printer.status === 'jammed') {
    throw new Error('Printer is currently jammed');
  }
  if (state.printer.paperRemaining <= 0) {
    state.printer.status = 'paper_out';
    emitHardwareState();
    throw new Error('Printer is out of paper');
  }

  state.printer.isPrinting = true;
  state.printer.status = 'printing';
  emitHardwareState();

  // Simulate physical print times for dye-sub (3.5 seconds)
  await new Promise((resolve) => setTimeout(resolve, 3500));

  // Check if a jam was triggered mid-print
  if (state.printer.status === 'jammed') {
    state.printer.isPrinting = false;
    throw new Error('Paper jam occurred during printing');
  }

  state.printer.isPrinting = false;
  state.printer.status = 'idle';
  state.printer.paperRemaining = Math.max(0, state.printer.paperRemaining - copies);
  state.printer.totalPrintedCount += copies;

  if (state.printer.paperRemaining <= 0) {
    state.printer.status = 'paper_out';
  }

  emitHardwareState();
  return { success: true, paperRemaining: state.printer.paperRemaining };
};

const forcePrinterJam = () => {
  state.printer.status = 'jammed';
  state.printer.isPrinting = false;
  emitHardwareState();
  return state.printer;
};

const clearPrinterJam = () => {
  state.printer.status = state.printer.paperRemaining <= 0 ? 'paper_out' : 'idle';
  emitHardwareState();
  return state.printer;
};

const refillPrinterPaper = () => {
  state.printer.paperRemaining = 700;
  if (state.printer.status === 'paper_out') {
    state.printer.status = 'idle';
  }
  emitHardwareState();
  return state.printer;
};

module.exports = {
  setIoInstance,
  getCameraState,
  getPrinterState,
  updateCameraSettings,
  toggleCameraConnection,
  togglePrinterConnection,
  triggerCapture,
  triggerPrintJob,
  forcePrinterJam,
  clearPrinterJam,
  refillPrinterPaper,
  emitHardwareState
};

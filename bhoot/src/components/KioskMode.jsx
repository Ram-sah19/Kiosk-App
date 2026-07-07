import React, { useState } from 'react';
import CameraFeed from './CameraFeed';
import '../styles/kiosk.css';
import { Camera, LayoutGrid, Award, Mail, Phone, QrCode, Printer, Check, RefreshCw } from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';
const UPLOAD_BASE = 'http://localhost:5000';

const GREENSCREEN_BACKGROUNDS = [
  { id: 'beach', name: 'Sunny Beach', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1280&q=80' },
  { id: 'neon', name: 'Cyberpunk City', url: 'https://images.unsplash.com/photo-1515621061946-eff1c2a352bd?w=1280&q=80' },
  { id: 'disco', name: 'Retro Disco', url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1280&q=80' },
  { id: 'space', name: 'Outer Space', url: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=1280&q=80' }
];

export default function KioskMode({ hardwareState }) {
  // Wizard States: 'idle', 'mode_select', 'greenscreen_select', 'countdown', 'review', 'filters', 'compositing', 'share'
  const [step, setStep] = useState('idle');
  const [captureMode, setCaptureMode] = useState('photo'); // 'photo', 'strip', 'gif', 'greenscreen'
  const [selectedBg, setSelectedBg] = useState(GREENSCREEN_BACKGROUNDS[0].url);

  // Capture variables
  const [photosNeeded, setPhotosNeeded] = useState(1);
  const [capturedPhotos, setCapturedPhotos] = useState([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [countdown, setCountdown] = useState(null);
  const [captureTrigger, setCaptureTrigger] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);

  // Enhance & Upload States
  const [compositedImage, setCompositedImage] = useState(null);
  const [sessionId, setSessionId] = useState(null);

  // Sharing inputs
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [shareStatus, setShareStatus] = useState({ type: '', message: '' });
  const [printed, setPrinted] = useState(false);

  const activeEvent = {
    _id: 'default_event',
    name: 'Summer Gala 2026',
    activeTemplateId: captureMode === 'strip' ? 'default_strip' : 'default_4x6'
  };

  // Configure counts based on mode
  const startSession = () => {
    setStep('mode_select');
    setCapturedPhotos([]);
    setCompositedImage(null);
    setSessionId(null);
    setEmail('');
    setPhone('');
    setShareStatus({ type: '', message: '' });
    setPrinted(false);
  };

  const selectMode = (mode) => {
    setCaptureMode(mode);
    if (mode === 'greenscreen') {
      setStep('greenscreen_select');
    } else {
      setupCapture(mode);
    }
  };

  const setupCapture = (mode) => {
    const needed = mode === 'strip' ? 4 : (mode === 'gif' ? 4 : 1);
    setPhotosNeeded(needed);
    setCapturedPhotos([]);
    setCurrentPhotoIndex(0);
    setStep('countdown');
    startCountdown(needed, 0);
  };

  // State Machine: Countdown & Shutter sequence
  const startCountdown = (total, index) => {
    let count = 3;
    setCountdown(count);

    // Audio beep cues
    const playBeep = (freq) => {
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
      } catch (e) {}
    };

    playBeep(800);

    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        setCountdown(count);
        playBeep(800);
      } else {
        clearInterval(interval);
        setCountdown(null);
        // Play shutter sound
        playBeep(1500);
        // Trigger Flash Animation
        setIsFlashing(true);
        setTimeout(() => setIsFlashing(false), 300);
        // Trigger camera capture in child CameraFeed
        setCaptureTrigger(true);
      }
    }, 1000);
  };

  const handleCaptureComplete = (blob) => {
    setCaptureTrigger(false);
    const photoUrl = URL.createObjectURL(blob);
    
    // Save blob and url references
    const newPhotos = [...capturedPhotos, { blob, url: photoUrl }];
    setCapturedPhotos(newPhotos);

    const nextIndex = currentPhotoIndex + 1;
    if (nextIndex < photosNeeded) {
      setCurrentPhotoIndex(nextIndex);
      setTimeout(() => {
        startCountdown(photosNeeded, nextIndex);
      }, 1000);
    } else {
      setStep('review');
    }
  };

  // Upload captures and run Sharp compositing on server
  const processLayout = async () => {
    setStep('compositing');

    try {
      const formData = new FormData();
      formData.append('eventId', activeEvent._id);
      formData.append('captureMode', captureMode);
      formData.append('templateId', activeEvent.activeTemplateId);
      
      capturedPhotos.forEach((photo, i) => {
        formData.append('photos', photo.blob, `capture-${i}.jpg`);
      });

      const response = await fetch(`${API_BASE}/sessions/upload`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      if (data.success) {
        setCompositedImage(data.imageUrl);
        setSessionId(data.session._id);
        setStep('share');
      } else {
        alert('Server processing error: ' + data.error);
        setStep('review');
      }
    } catch (error) {
      console.error(error);
      alert('Network failure uploading images.');
      setStep('review');
    }
  };

  // Submit Sharing
  const submitShare = async (type) => {
    if (!sessionId) return;
    const body = type === 'email' ? { email, channel: 'email' } : { phone, channel: 'sms' };

    try {
      const res = await fetch(`${API_BASE}/sessions/${sessionId}/share`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        setShareStatus({ type: 'success', message: `${type === 'email' ? 'Email' : 'SMS'} queued successfully!` });
      }
    } catch (e) {
      setShareStatus({ type: 'error', message: 'Sharing failed. Try again.' });
    }
  };

  // Queue print jobs
  const handlePrint = async () => {
    if (!sessionId || !compositedImage) return;

    try {
      const res = await fetch(`${API_BASE}/prints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          filePath: compositedImage,
          copies: 1
        })
      });
      if (res.ok) {
        setPrinted(true);
      }
    } catch (e) {
      alert('Failed to connect to print queue.');
    }
  };

  // Printer errors check
  const isPrinterOffline = !hardwareState.printer.connected || hardwareState.printer.status === 'offline';
  const isPrinterJammed = hardwareState.printer.status === 'jammed';
  const isPrinterEmpty = hardwareState.printer.paperRemaining <= 0 || hardwareState.printer.status === 'paper_out';
  const hasPrinterError = isPrinterOffline || isPrinterJammed || isPrinterEmpty;

  const getPrinterErrorMsg = () => {
    if (isPrinterOffline) return 'Printer Offline';
    if (isPrinterJammed) return 'Printer Jammed';
    if (isPrinterEmpty) return 'Printer Out of Paper';
    return '';
  };

  return (
    <div className="kiosk-container">
      {/* Screen Shutter Flash Overlay */}
      {isFlashing && <div className="animate-flash" />}

      {/* Printer/Hardware Blockage Warning Alert Box */}
      {hasPrinterError && step !== 'idle' && (
        <div className="kiosk-alert-header">
          ⚠️ Kiosk Warning: {getPrinterErrorMsg()}. Photo capture is available, but prints are disabled.
        </div>
      )}

      {/* IDLE SCREEN */}
      {step === 'idle' && (
        <div className="attract-screen animate-fade-in" onClick={startSession}>
          <div className="glow-circle-1"></div>
          <div className="glow-circle-2"></div>
          <div className="attract-content">
            <h1 className="attract-title gradient-text">TAP TO START</h1>
            <p className="attract-subtitle">Create Memories Instantly</p>
            <div className="attract-icon animate-pulse-glow">📸</div>
            <span className="attract-touch-prompt">Touch anywhere to start</span>
          </div>
        </div>
      )}

      {/* MODE SELECTOR */}
      {step === 'mode_select' && (
        <div className="kiosk-view mode-select-view animate-slide-up">
          <h2 className="view-title">Choose Capture Mode</h2>
          <div className="modes-grid">
            <div className="mode-card glass-card" onClick={() => selectMode('photo')}>
              <Camera size={48} className="mode-icon text-cyan" />
              <h3>Single Photo</h3>
              <p>One perfect landscape capture</p>
            </div>
            <div className="mode-card glass-card" onClick={() => selectMode('strip')}>
              <LayoutGrid size={48} className="mode-icon text-purple" />
              <h3>Photo Strip</h3>
              <p>4 snaps stitched vertical strip</p>
            </div>
            <div className="mode-card glass-card" onClick={() => selectMode('gif')}>
              <RefreshCw size={48} className="mode-icon text-pink" />
              <h3>GIF / Boomerang</h3>
              <p>Stitched collage frames animation</p>
            </div>
            <div className="mode-card glass-card" onClick={() => selectMode('greenscreen')}>
              <Award size={48} className="mode-icon text-green" />
              <h3>Green Screen</h3>
              <p>Swap backgrounds instantly</p>
            </div>
          </div>
          <button className="btn btn-secondary mt-20" onClick={() => setStep('idle')}>Cancel</button>
        </div>
      )}

      {/* GREEN SCREEN BACKGROUND SELECTOR */}
      {step === 'greenscreen_select' && (
        <div className="kiosk-view greenscreen-select-view animate-slide-up">
          <h2 className="view-title">Select Background</h2>
          <div className="bg-grid">
            {GREENSCREEN_BACKGROUNDS.map(bg => (
              <div 
                key={bg.id} 
                className={`bg-card glass-card ${selectedBg === bg.url ? 'selected' : ''}`}
                onClick={() => setSelectedBg(bg.url)}
              >
                <img src={bg.url} alt={bg.name} />
                <span>{bg.name}</span>
              </div>
            ))}
          </div>
          <div className="flex-row gap-20 justify-center mt-30">
            <button className="btn btn-secondary" onClick={() => setStep('mode_select')}>Back</button>
            <button className="btn btn-primary" onClick={() => setupCapture('greenscreen')}>Confirm</button>
          </div>
        </div>
      )}

      {/* CAMERA SCREEN */}
      {step === 'countdown' && (
        <div className="kiosk-view camera-view animate-fade-in">
          <div className="camera-header">
            <h3>Taking Photo {currentPhotoIndex + 1} of {photosNeeded}</h3>
          </div>
          
          <CameraFeed 
            isLive={step === 'countdown'}
            cameraConnected={hardwareState.camera.connected}
            captureTrigger={captureTrigger}
            onCapture={handleCaptureComplete}
            captureMode={captureMode}
            countdown={countdown}
            greenscreenBg={selectedBg}
          />
          
          <div className="camera-footer">
            <p>Stand in front of the lens and look at the camera!</p>
          </div>
        </div>
      )}

      {/* REVIEW CAPTURES */}
      {step === 'review' && (
        <div className="kiosk-view review-view animate-slide-up">
          <h2 className="view-title">Review Captured Frames</h2>
          
          <div className="review-grid">
            {capturedPhotos.map((photo, i) => (
              <div key={i} className="review-thumbnail glass-card">
                <img src={photo.url} alt={`Frame ${i + 1}`} />
                <span className="thumb-label">Photo {i + 1}</span>
              </div>
            ))}
          </div>

          <div className="flex-row gap-20 justify-center mt-30">
            <button className="btn btn-danger" onClick={() => setupCapture(captureMode)}>
              <RefreshCw size={20} /> Retake All
            </button>
            <button className="btn btn-primary" onClick={processLayout}>
              <Check size={20} /> Generate Collage
            </button>
          </div>
        </div>
      )}

      {/* COMPOSITING LOADER */}
      {step === 'compositing' && (
        <div className="kiosk-view compositing-view animate-fade-in">
          <div className="loader-spinner animate-pulse-glow">📸</div>
          <h2 className="gradient-text mt-20">Processing Your Collage...</h2>
          <p>We are applying layouts, frames, and filters to your images.</p>
        </div>
      )}

      {/* SHARING & PRINT FINAL SCREEN */}
      {step === 'share' && (
        <div className="kiosk-view share-view animate-slide-up">
          <div className="share-layout">
            
            {/* Left: Composite preview */}
            <div className="share-preview-column">
              <div className="composite-frame glass-panel">
                <img src={`${UPLOAD_BASE}${compositedImage}`} alt="Composite result" />
              </div>
            </div>

            {/* Right: Sharing controls */}
            <div className="share-controls-column glass-panel">
              <h2 className="gradient-text">Your Photos Are Ready!</h2>
              <p className="share-desc">Select how you want to receive your copy below:</p>

              {/* Email Delivery */}
              <div className="share-method glass-card">
                <h4><Mail size={18} /> Send via Email</h4>
                <div className="input-group">
                  <input 
                    type="email" 
                    placeholder="Enter your email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <button className="btn btn-primary" onClick={() => submitShare('email')}>Send</button>
                </div>
              </div>

              {/* SMS Delivery */}
              <div className="share-method glass-card">
                <h4><Phone size={18} /> Send via Text Message (SMS)</h4>
                <div className="input-group">
                  <input 
                    type="tel" 
                    placeholder="+1 (555) 000-0000" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                  <button className="btn btn-primary" onClick={() => submitShare('sms')}>Text</button>
                </div>
              </div>

              {/* QR Code Delivery */}
              <div className="share-method qr-method glass-card">
                <div>
                  <h4><QrCode size={18} /> Scan QR Code</h4>
                  <p>Scan to view in the Cloud Gallery</p>
                </div>
                <div className="qr-container">
                  {/* Dynamic mock QR linking to cloud gallery URL */}
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`http://localhost:3000/gallery?session=${sessionId}`)}`}
                    alt="Scan QR" 
                  />
                </div>
              </div>

              {/* Print Action */}
              <div className="share-print-actions">
                <button 
                  className={`btn btn-primary btn-print-kiosk ${hasPrinterError ? 'disabled' : ''}`}
                  onClick={handlePrint}
                  disabled={hasPrinterError || printed}
                >
                  <Printer size={24} /> {printed ? 'Added to Print Queue!' : 'Print Photo'}
                </button>
              </div>

              {shareStatus.message && (
                <div className={`share-toast ${shareStatus.type}`}>
                  {shareStatus.message}
                </div>
              )}

              <button className="btn btn-secondary w-full mt-20" onClick={() => setStep('idle')}>
                Done & Finish
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

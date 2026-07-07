import React, { useRef, useEffect, useState } from 'react';
import { CameraOff } from 'lucide-react';

export default function CameraFeed({
  isLive,
  cameraConnected,
  captureTrigger,
  onCapture,
  captureMode,
  countdown,
  greenscreenBg
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);

  // Load Webcam
  useEffect(() => {
    if (isLive && cameraConnected) {
      navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720, facingMode: 'user' }, 
        audio: false 
      })
      .then(s => {
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
      })
      .catch(err => {
        console.error('Webcam access error:', err);
        setError('Could not access device webcam');
      });
    } else {
      stopWebcam();
    }

    return () => stopWebcam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive, cameraConnected]);

  const stopWebcam = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  // Chroma Key Processing Loop (Green Screen)
  useEffect(() => {
    if (captureMode !== 'greenscreen' || !stream) return;

    let active = true;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const bgImg = new Image();
    bgImg.src = greenscreenBg || 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1280&auto=format&fit=crop';
    
    const processFrame = () => {
      if (!active || video.paused || video.ended) return;

      // Ensure canvas matches video aspect ratio
      if (canvas.width !== video.videoWidth) {
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 360;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const length = frame.data.length / 4;

      // Chroma Key logic (Simple Green Detection)
      for (let i = 0; i < length; i++) {
        const r = frame.data[i * 4 + 0];
        const g = frame.data[i * 4 + 1];
        const b = frame.data[i * 4 + 2];

        // If green is dominant, blend background image
        if (g > 105 && g > r * 1.25 && g > b * 1.25) {
          // Set alpha to 0 so we can show background under it,
          // or composite background pixel directly.
          // For simplicity, we make the green pixel transparent
          frame.data[i * 4 + 3] = 0;
        }
      }

      ctx.putImageData(frame, 0, 0);
      requestAnimationFrame(processFrame);
    };

    video.addEventListener('play', processFrame);
    return () => {
      active = false;
      video.removeEventListener('play', processFrame);
    };
  }, [captureMode, stream, greenscreenBg]);

  // Capture Image Handler
  useEffect(() => {
    if (captureTrigger && onCapture) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video) return;

      const captureCanvas = document.createElement('canvas');
      captureCanvas.width = video.videoWidth || 1280;
      captureCanvas.height = video.videoHeight || 720;
      const ctx = captureCanvas.getContext('2d');

      if (captureMode === 'greenscreen' && canvas) {
        // Draw greenscreen composite background first, then transparent video canvas on top
        const bgImg = new Image();
        bgImg.crossOrigin = 'anonymous';
        bgImg.src = greenscreenBg || 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1280&auto=format&fit=crop';
        
        bgImg.onload = () => {
          ctx.drawImage(bgImg, 0, 0, captureCanvas.width, captureCanvas.height);
          ctx.drawImage(canvas, 0, 0, captureCanvas.width, captureCanvas.height);
          captureCanvas.toBlob(blob => {
            onCapture(blob);
          }, 'image/jpeg', 0.9);
        };
        bgImg.onerror = () => {
          // Fallback if background fails to load
          ctx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);
          captureCanvas.toBlob(blob => {
            onCapture(blob);
          }, 'image/jpeg', 0.9);
        };
      } else {
        // Regular photo capture
        ctx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);
        captureCanvas.toBlob(blob => {
          onCapture(blob);
        }, 'image/jpeg', 0.9);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captureTrigger]);

  if (!cameraConnected) {
    return (
      <div className="camera-feed-error glass-panel">
        <CameraOff size={64} className="error-icon blinking" />
        <h3>DSLR Connection Lost</h3>
        <p>Attendant: Please check USB/battery on tethered DSLR camera.</p>
      </div>
    );
  }

  return (
    <div className="camera-feed-wrapper">
      {/* Hidden raw video element when processing green screen */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`raw-video-feed ${captureMode === 'greenscreen' ? 'hidden-feed' : ''}`}
      />

      {/* Display canvas for chroma-key background subtraction */}
      {captureMode === 'greenscreen' && (
        <div className="greenscreen-container" style={{ backgroundImage: `url(${greenscreenBg})` }}>
          <canvas ref={canvasRef} className="greenscreen-canvas" />
        </div>
      )}

      {/* Countdown overlay */}
      {countdown !== null && (
        <div className="countdown-overlay">
          <div className="countdown-number animate-scale-in">{countdown}</div>
        </div>
      )}

      {error && <div className="camera-error-toast">{error}</div>}
    </div>
  );
}

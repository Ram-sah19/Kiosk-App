import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import io from 'socket.io-client';
import KioskMode from './components/KioskMode';
import AdminPanel from './components/AdminPanel';
import TemplateDesigner from './components/TemplateDesigner';
import CloudGallery from './components/CloudGallery';
import { Monitor, Shield, LayoutGrid, Image } from 'lucide-react';

const SOCKET_URL = 'http://localhost:5000';

function AppContent({ hardwareState }) {
  const location = useLocation();
  const isKiosk = location.pathname === '/';

  return (
    <div className="app-container">
      {!isKiosk && (
        <header className="main-header glass-panel">
          <div className="logo-section">
            <span className="logo-icon">📸</span>
            <span className="logo-text gradient-text">BhootBooth</span>
          </div>
          <nav className="nav-links">
            <Link to="/" className="nav-link"><Monitor size={18} /> Kiosk Mode</Link>
            <Link to="/admin" className="nav-link"><Shield size={18} /> Admin Dashboard</Link>
            <Link to="/designer" className="nav-link"><LayoutGrid size={18} /> Template Designer</Link>
            <Link to="/gallery" className="nav-link"><Image size={18} /> Cloud Gallery</Link>
          </nav>
        </header>
      )}
      
      <main className={isKiosk ? "kiosk-main" : "dashboard-main"}>
        <Routes>
          <Route path="/" element={<KioskMode hardwareState={hardwareState} />} />
          <Route path="/admin" element={<AdminPanel hardwareState={hardwareState} />} />
          <Route path="/designer" element={<TemplateDesigner />} />
          <Route path="/gallery" element={<CloudGallery />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  const [hardwareState, setHardwareState] = useState({
    camera: { 
      connected: true, 
      battery: 100, 
      settings: { iso: '400', aperture: 'F/4.0', shutterSpeed: '1/125', whiteBalance: 'Auto' } 
    },
    printer: { 
      connected: true, 
      paperRemaining: 240, 
      status: 'idle' 
    }
  });

  useEffect(() => {
    const socket = io(SOCKET_URL);

    socket.on('hardwareState', (state) => {
      setHardwareState(state);
    });

    socket.on('connect', () => {
      console.log('Connected to WebSocket server');
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <Router>
      <AppContent hardwareState={hardwareState} />
    </Router>
  );
}

export default App;

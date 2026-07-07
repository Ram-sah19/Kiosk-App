import React, { useState, useEffect } from 'react';
import { Download, Share2, Printer, Search, Image as ImageIcon, X } from 'lucide-react';
import io from 'socket.io-client';

const API_BASE = 'http://localhost:5000/api';
const UPLOAD_BASE = 'http://localhost:5000';
const SOCKET_URL = 'http://localhost:5000';

export default function CloudGallery() {
  const [sessions, setSessions] = useState([]);
  const [filteredSessions, setFilteredSessions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedSession, setSelectedSession] = useState(null);

  // Fetch Session assets
  useEffect(() => {
    fetchSessions();

    // WebSocket trigger to sync new photos live!
    const socket = io(SOCKET_URL);
    socket.on('newSession', (newSession) => {
      setSessions(prev => [newSession, ...prev]);
    });

    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, searchTerm, activeFilter]);

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${API_BASE}/sessions`);
      const data = await res.json();
      setSessions(data);
    } catch (e) {
      console.error('Error fetching sessions:', e);
    }
  };

  const applyFilters = () => {
    let result = [...sessions];

    // Search by email, phone, or ID
    if (searchTerm.trim() !== '') {
      const query = searchTerm.toLowerCase();
      result = result.filter(s => {
        const email = s.sharing?.email?.toLowerCase() || '';
        const phone = s.sharing?.phone || '';
        const id = s._id.toLowerCase();
        return email.includes(query) || phone.includes(query) || id.includes(query);
      });
    }

    // Filter by type
    if (activeFilter !== 'all') {
      result = result.filter(s => s.captureMode === activeFilter);
    }

    setFilteredSessions(result);
  };

  const handlePrintRequest = async (session) => {
    if (!session) return;
    try {
      const res = await fetch(`${API_BASE}/prints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session._id,
          filePath: session.assets[0],
          copies: 1
        })
      });
      if (res.ok) {
        alert('Reprints command queued in local kiosk print pool!');
      }
    } catch (e) {
      alert('Error printing.');
    }
  };

  // Mock social share triggers
  const handleSocialShare = (platform, url) => {
    alert(`Mocking social share to ${platform} for URL: ${url}`);
  };

  return (
    <div className="gallery-container animate-fade-in">
      <div className="gallery-header-section glass-panel">
        <h2 className="pane-title">Event Cloud Gallery</h2>
        <p>Scan your card or search to view and retrieve your high-resolution event captures.</p>

        {/* Filter controls row */}
        <div className="filters-toolbar mt-20">
          <div className="search-bar glass-card">
            <Search size={18} className="text-muted" />
            <input 
              type="text" 
              placeholder="Search by email, phone, or ID..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="filters-group">
            {['all', 'photo', 'strip', 'gif', 'greenscreen'].map(mode => (
              <button
                key={mode}
                className={`btn btn-secondary ${activeFilter === mode ? 'btn-primary' : ''}`}
                onClick={() => setActiveFilter(mode)}
              >
                {mode.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid photos layout */}
      {filteredSessions.length === 0 ? (
        <div className="empty-state glass-panel mt-30">
          <ImageIcon size={48} className="text-muted" />
          <p className="mt-20">No matching event captures found.</p>
        </div>
      ) : (
        <div className="gallery-grid mt-30">
          {filteredSessions.map(session => (
            <div 
              key={session._id} 
              className="gallery-card glass-panel animate-scale-in"
              onClick={() => setSelectedSession(session)}
            >
              <img src={`${UPLOAD_BASE}${session.assets[0]}`} alt="Event asset" />
              <div className="card-info">
                <span className="card-badge">{session.captureMode.toUpperCase()}</span>
                <span className="card-time">{new Date(session.createdAt).toLocaleTimeString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* DETAILED MODAL OVERLAY */}
      {selectedSession && (
        <div className="modal-overlay animate-fade-in" onClick={() => setSelectedSession(null)}>
          <div className="modal-card glass-panel animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setSelectedSession(null)}>
              <X size={20} />
            </button>

            <div className="modal-layout">
              <div className="modal-preview">
                <img 
                  src={`${UPLOAD_BASE}${selectedSession.assets[0]}`} 
                  alt="Expanded capture" 
                />
              </div>

              <div className="modal-details">
                <h3 className="gradient-text">Event Memory Details</h3>
                <div className="metadata-box mt-20">
                  <div className="metadata-row">
                    <span>Session ID:</span>
                    <span className="val-mono">{selectedSession._id}</span>
                  </div>
                  <div className="metadata-row">
                    <span>Capture Mode:</span>
                    <span className="val-bold">{selectedSession.captureMode.toUpperCase()}</span>
                  </div>
                  <div className="metadata-row">
                    <span>Captured At:</span>
                    <span>{new Date(selectedSession.createdAt).toLocaleString()}</span>
                  </div>
                  {selectedSession.sharing?.email && (
                    <div className="metadata-row">
                      <span>Shared Email:</span>
                      <span>{selectedSession.sharing.email}</span>
                    </div>
                  )}
                </div>

                <div className="modal-actions mt-30">
                  {/* Download raw asset file */}
                  <a 
                    href={`${UPLOAD_BASE}${selectedSession.assets[0]}`} 
                    download={`photo-${selectedSession._id}.jpg`}
                    className="btn btn-primary w-full"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Download size={18} /> Download High-Res
                  </a>

                  {/* Queue printer reprint */}
                  <button className="btn btn-secondary w-full" onClick={() => handlePrintRequest(selectedSession)}>
                    <Printer size={18} /> Reprint from Kiosk
                  </button>

                  <hr className="divider" />

                  {/* Share platforms */}
                  <h4>Share Memory:</h4>
                  <div className="share-buttons-row mt-10">
                    <button 
                      className="btn btn-secondary"
                      onClick={() => handleSocialShare('Facebook', `${UPLOAD_BASE}${selectedSession.assets[0]}`)}
                    >
                      <Share2 size={16} /> Facebook
                    </button>
                    <button 
                      className="btn btn-secondary"
                      onClick={() => handleSocialShare('Twitter', `${UPLOAD_BASE}${selectedSession.assets[0]}`)}
                    >
                      <Share2 size={16} /> Twitter
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

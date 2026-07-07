import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { Cpu, Printer, Camera, RefreshCcw, BarChart2, Calendar } from 'lucide-react';
import '../styles/admin.css';

const API_BASE = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';

export default function AdminPanel({ hardwareState }) {
  const [activeTab, setActiveTab] = useState('hardware');
  const [printJobs, setPrintJobs] = useState([]);
  const [analytics, setAnalytics] = useState({
    totalSessions: 0,
    totalPrints: 0,
    totalShares: 0,
    modeDistribution: { photo: 0, strip: 0, gif: 0, greenscreen: 0 },
    shareRate: 0
  });

  // Event Edit Settings state
  const [eventName, setEventName] = useState('Summer Gala 2026');
  const [activeTemplate, setActiveTemplate] = useState('default_4x6');
  const [bgBrandColor, setBgBrandColor] = useState('#0f0c1b');

  // Load Initial Data
  useEffect(() => {
    fetchPrintJobs();
    fetchAnalytics();
    fetchActiveEvent();
  }, [activeTab]);

  // WebSocket Live Listeners for updates
  useEffect(() => {
    const socket = io(SOCKET_URL);

    socket.on('printJobQueued', (newJob) => {
      setPrintJobs(prev => [newJob, ...prev]);
      fetchAnalytics();
    });

    socket.on('printJobUpdated', (updatedJob) => {
      setPrintJobs(prev => prev.map(j => j._id === updatedJob._id ? updatedJob : j));
      fetchAnalytics();
    });

    socket.on('newSession', () => {
      fetchAnalytics();
    });

    return () => socket.disconnect();
  }, []);

  const fetchPrintJobs = async () => {
    try {
      const res = await fetch(`${API_BASE}/prints`);
      const data = await res.json();
      setPrintJobs(data);
    } catch (e) {
      console.error('Error fetching print queue:', e);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await fetch(`${API_BASE}/analytics`);
      const data = await res.json();
      setAnalytics(data);
    } catch (e) {
      console.error('Error fetching analytics:', e);
    }
  };

  const fetchActiveEvent = async () => {
    try {
      const res = await fetch(`${API_BASE}/events/active`);
      const data = await res.json();
      setEventName(data.name);
      setActiveTemplate(data.activeTemplateId);
      if (data.branding) {
        setBgBrandColor(data.branding.backgroundColor);
      }
    } catch (e) {
      console.error('Error fetching active event:', e);
    }
  };

  // Hardware Simulation Controls
  const triggerHardwareAction = async (endpoint, payload = {}) => {
    try {
      await fetch(`${API_BASE}/hardware/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.error(`Error sending command to hardware/${endpoint}:`, e);
    }
  };

  const saveEventConfig = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: eventName,
          activeTemplateId: activeTemplate,
          branding: {
            backgroundColor: bgBrandColor,
            textColor: '#ffffff',
            accentColor: '#8b5cf6'
          }
        })
      });
      if (res.ok) {
        alert('Event settings updated successfully!');
      }
    } catch (e) {
      alert('Failed to update event settings.');
    }
  };

  const handleRetryPrint = async (jobId) => {
    try {
      const res = await fetch(`${API_BASE}/prints/${jobId}/retry`, { method: 'POST' });
      if (res.ok) {
        fetchPrintJobs();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="admin-container animate-fade-in">
      <div className="admin-sidebar glass-panel">
        <h3 className="sidebar-title">Control Panel</h3>
        <button 
          className={`sidebar-btn ${activeTab === 'hardware' ? 'active' : ''}`}
          onClick={() => setActiveTab('hardware')}
        >
          <Cpu size={18} /> Diagnostics & Hardware
        </button>
        <button 
          className={`sidebar-btn ${activeTab === 'queue' ? 'active' : ''}`}
          onClick={() => setActiveTab('queue')}
        >
          <Printer size={18} /> Print Queue
        </button>
        <button 
          className={`sidebar-btn ${activeTab === 'event' ? 'active' : ''}`}
          onClick={() => setActiveTab('event')}
        >
          <Calendar size={18} /> Event Setup
        </button>
        <button 
          className={`sidebar-btn ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          <BarChart2 size={18} /> Event Analytics
        </button>
      </div>

      <div className="admin-content-wrapper">
        
        {/* DIAGNOSTICS & HARDWARE SIMULATOR */}
        {activeTab === 'hardware' && (
          <div className="tab-pane animate-slide-up">
            <h2 className="pane-title">Hardware Diagnostics & Simulation</h2>
            
            <div className="diagnostics-grid">
              
              {/* Camera Diagnostics Card */}
              <div className="diagnostics-card glass-panel">
                <div className="card-header">
                  <Camera size={24} className="text-purple" />
                  <h3>DSLR Camera Body</h3>
                  <span className={`status-badge ${hardwareState.camera.connected ? 'connected' : 'disconnected'}`}>
                    {hardwareState.camera.connected ? 'Tethered' : 'Disconnected'}
                  </span>
                </div>

                <div className="metrics-list mt-20">
                  <div className="metric-row">
                    <span>Battery Charge:</span>
                    <span className="metric-val">{hardwareState.camera.battery}%</span>
                  </div>
                  <div className="metric-row">
                    <span>Shutter Actuations:</span>
                    <span className="metric-val">{hardwareState.camera.shutterCount}</span>
                  </div>
                  <div className="metric-row">
                    <span>Camera Settings:</span>
                    <span className="metric-val">
                      ISO {hardwareState.camera.settings.iso} | {hardwareState.camera.settings.aperture} | {hardwareState.camera.settings.shutterSpeed}
                    </span>
                  </div>
                </div>

                <div className="simulation-actions mt-30">
                  <h4>Simulate DSLR Actions</h4>
                  <div className="buttons-group">
                    <button 
                      className={`btn ${hardwareState.camera.connected ? 'btn-danger' : 'btn-primary'}`}
                      onClick={() => triggerHardwareAction('camera/toggle', { connected: !hardwareState.camera.connected })}
                    >
                      {hardwareState.camera.connected ? 'Disconnect DSLR' : 'Connect DSLR'}
                    </button>
                    <button 
                      className="btn btn-secondary"
                      onClick={() => triggerHardwareAction('camera/settings', { settings: { iso: '800', aperture: 'F/2.8', shutterSpeed: '1/200' }})}
                      disabled={!hardwareState.camera.connected}
                    >
                      Override Exposure (ISO 800)
                    </button>
                  </div>
                </div>
              </div>

              {/* Printer Diagnostics Card */}
              <div className="diagnostics-card glass-panel">
                <div className="card-header">
                  <Printer size={24} className="text-pink" />
                  <h3>Dye-Sublimation Printer</h3>
                  <span className={`status-badge printer-${hardwareState.printer.status}`}>
                    {hardwareState.printer.status.toUpperCase()}
                  </span>
                </div>

                <div className="metrics-list mt-20">
                  <div className="metric-row">
                    <span>Media Status:</span>
                    <span className="metric-val">{hardwareState.printer.paperRemaining} / 700 Prints Remaining</span>
                  </div>
                  <div className="metric-row">
                    <span>Lifetime Print Count:</span>
                    <span className="metric-val">{hardwareState.printer.totalPrintedCount} prints</span>
                  </div>
                  <div className="metric-row">
                    <span>Connection Status:</span>
                    <span className="metric-val">{hardwareState.printer.connected ? 'USB Connected' : 'Offline'}</span>
                  </div>
                </div>

                <div className="simulation-actions mt-30">
                  <h4>Simulate Printer Faults</h4>
                  <div className="buttons-group">
                    <button 
                      className="btn btn-secondary"
                      onClick={() => triggerHardwareAction('printer/toggle', { connected: !hardwareState.printer.connected })}
                    >
                      {hardwareState.printer.connected ? 'Disconnect USB' : 'Reconnect USB'}
                    </button>
                    <button 
                      className="btn btn-danger"
                      onClick={() => triggerHardwareAction('printer/jam')}
                      disabled={!hardwareState.printer.connected || hardwareState.printer.status === 'jammed'}
                    >
                      Trigger Paper Jam
                    </button>
                    <button 
                      className="btn btn-primary"
                      onClick={() => triggerHardwareAction('printer/clear-jam')}
                      disabled={hardwareState.printer.status !== 'jammed'}
                    >
                      Clear Paper Jam
                    </button>
                    <button 
                      className="btn btn-secondary"
                      onClick={() => triggerHardwareAction('printer/refill')}
                    >
                      Refill Paper & Ribbon
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* PRINT QUEUE MANAGER */}
        {activeTab === 'queue' && (
          <div className="tab-pane animate-slide-up">
            <h2 className="pane-title">Live Spooler & Print Queue</h2>
            
            <div className="queue-list glass-panel">
              {printJobs.length === 0 ? (
                <div className="empty-state">
                  <Printer size={48} className="text-muted" />
                  <p className="mt-20">No print jobs are currently queued.</p>
                </div>
              ) : (
                <table className="queue-table">
                  <thead>
                    <tr>
                      <th>Job ID</th>
                      <th>Thumbnail</th>
                      <th>Copies</th>
                      <th>Status</th>
                      <th>Error Description</th>
                      <th>Queued At</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printJobs.map(job => (
                      <tr key={job._id}>
                        <td className="job-id-cell">{job._id}</td>
                        <td>
                          <img src={`http://localhost:5000${job.filePath}`} alt="Print Thumbnail" className="queue-thumb" />
                        </td>
                        <td>{job.copies}</td>
                        <td>
                          <span className={`badge badge-${
                            job.status === 'printed' ? 'success' : 
                            (job.status === 'printing' ? 'info' : 
                            (job.status === 'queued' ? 'warning' : 'danger'))
                          }`}>
                            {job.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="error-cell text-red">{job.errorMessage || '-'}</td>
                        <td>{new Date(job.createdAt).toLocaleTimeString()}</td>
                        <td>
                          {(job.status === 'failed' || job.status === 'jammed') && (
                            <button className="btn btn-secondary btn-sm" onClick={() => handleRetryPrint(job._id)}>
                              <RefreshCcw size={14} /> Retry
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* EVENT CONFIGURATION */}
        {activeTab === 'event' && (
          <div className="tab-pane animate-slide-up">
            <h2 className="pane-title">Configure Kiosk Event Profile</h2>
            
            <div className="event-setup-form glass-panel">
              <form onSubmit={saveEventConfig}>
                <div className="form-group">
                  <label>Event Name</label>
                  <input 
                    type="text" 
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Default Layout Template</label>
                  <select 
                    value={activeTemplate}
                    onChange={(e) => setActiveTemplate(e.target.value)}
                  >
                    <option value="default_4x6">Landscape Collage (4x6)</option>
                    <option value="default_strip">Vertical Strip (2x6)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Brand Secondary Color</label>
                  <div className="color-input-wrapper">
                    <input 
                      type="color" 
                      value={bgBrandColor}
                      onChange={(e) => setBgBrandColor(e.target.value)}
                    />
                    <span>{bgBrandColor}</span>
                  </div>
                </div>

                <button type="submit" className="btn btn-primary mt-20">Save Event Profile</button>
              </form>
            </div>
          </div>
        )}

        {/* EVENT ANALYTICS */}
        {activeTab === 'analytics' && (
          <div className="tab-pane animate-slide-up">
            <h2 className="pane-title">Live Session Metrics & Reporting</h2>
            
            {/* Value Cards */}
            <div className="analytics-cards-row">
              <div className="stat-card glass-panel">
                <h3>Total Sessions</h3>
                <div className="stat-number gradient-text">{analytics.totalSessions}</div>
                <p>Successful guest activations</p>
              </div>
              <div className="stat-card glass-panel">
                <h3>Total Print Copies</h3>
                <div className="stat-number text-pink">{analytics.totalPrints}</div>
                <p>Dye-sub rolls dispensed</p>
              </div>
              <div className="stat-card glass-panel">
                <h3>Delivery Shares</h3>
                <div className="stat-number text-cyan">{analytics.totalShares}</div>
                <p>Emails and SMS delivered</p>
              </div>
              <div className="stat-card glass-panel">
                <h3>Share Rate</h3>
                <div className="stat-number text-green">{analytics.shareRate}%</div>
                <p>Guest digital conversion</p>
              </div>
            </div>

            {/* Charts Row */}
            <div className="analytics-details mt-30">
              <div className="chart-card glass-panel">
                <h3>Capture Mode Preference</h3>
                <div className="chart-list mt-20">
                  {Object.entries(analytics.modeDistribution).map(([mode, count]) => {
                    const total = analytics.totalSessions || 1;
                    const percentage = Math.round((count / total) * 100);
                    return (
                      <div key={mode} className="chart-bar-row">
                        <span className="bar-label">{mode.toUpperCase()}</span>
                        <div className="bar-container">
                          <div className="bar-fill" style={{ width: `${percentage}%` }} />
                        </div>
                        <span className="bar-value">{count} ({percentage}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}

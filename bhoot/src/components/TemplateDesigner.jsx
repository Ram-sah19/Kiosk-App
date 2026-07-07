import React, { useState } from 'react';
import { Plus, Trash2, Save, FileImage, Move } from 'lucide-react';
import '../styles/designer.css';

const API_BASE = 'http://localhost:5000/api';

export default function TemplateDesigner() {
  const [templateName, setTemplateName] = useState('My Custom Event Template');
  const [layoutType, setLayoutType] = useState('single'); // 'single', 'strip', 'grid'
  
  // Canvas Size presets (mapped from real DPI 300 scale)
  const canvasWidth = layoutType === 'strip' ? 300 : 600; // Display pixels (2x6 strip vs 6x4 paper)
  const canvasHeight = layoutType === 'strip' ? 900 : 400;

  // Photo slots
  const [slots, setSlots] = useState([
    { id: 1, x: 20, y: 20, width: 560, height: 360 }
  ]);
  const [activeSlotId, setActiveSlotId] = useState(1);
  const [overlayImage, setOverlayImage] = useState('');

  // Add new photo placeholder slot
  const addSlot = () => {
    const id = Date.now();
    const newSlot = {
      id,
      x: 50 + slots.length * 10,
      y: 50 + slots.length * 10,
      width: layoutType === 'strip' ? 240 : 200,
      height: layoutType === 'strip' ? 180 : 150
    };
    setSlots([...slots, newSlot]);
    setActiveSlotId(id);
  };

  const removeSlot = (id) => {
    setSlots(slots.filter(s => s.id !== id));
    if (activeSlotId === id && slots.length > 1) {
      setActiveSlotId(slots.filter(s => s.id !== id)[0].id);
    }
  };

  const updateActiveSlot = (field, value) => {
    setSlots(slots.map(s => {
      if (s.id === activeSlotId) {
        return { ...s, [field]: parseInt(value) || 0 };
      }
      return s;
    }));
  };

  // Adjust preset configurations on layout changes
  const handleLayoutChange = (type) => {
    setLayoutType(type);
    if (type === 'strip') {
      setSlots([
        { id: 1, x: 20, y: 20, width: 260, height: 180 },
        { id: 2, x: 20, y: 220, width: 260, height: 180 },
        { id: 3, x: 20, y: 420, width: 260, height: 180 },
        { id: 4, x: 20, y: 620, width: 260, height: 180 }
      ]);
      setActiveSlotId(1);
    } else if (type === 'grid') {
      setSlots([
        { id: 1, x: 20, y: 20, width: 270, height: 170 },
        { id: 2, x: 310, y: 20, width: 270, height: 170 },
        { id: 3, x: 20, y: 210, width: 270, height: 170 },
        { id: 4, x: 310, y: 210, width: 270, height: 170 }
      ]);
      setActiveSlotId(1);
    } else {
      setSlots([
        { id: 1, x: 20, y: 20, width: 560, height: 360 }
      ]);
      setActiveSlotId(1);
    }
  };

  // Simulated Overlay PNG uploads
  const handleOverlayUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        setOverlayImage(uploadEvent.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Save template configuration to database
  const saveTemplate = async () => {
    // Map dimensions back to raw output scale (x3 multiplier for print DPI)
    const scaleFactor = 3;
    const finalSlots = slots.map(s => ({
      x: s.x * scaleFactor,
      y: s.y * scaleFactor,
      width: s.width * scaleFactor,
      height: s.height * scaleFactor
    }));

    const templatePayload = {
      name: templateName,
      layoutType: layoutType,
      width: canvasWidth * scaleFactor,
      height: canvasHeight * scaleFactor,
      overlayImage: overlayImage,
      slots: finalSlots
    };

    try {
      const response = await fetch(`${API_BASE}/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templatePayload)
      });
      if (response.ok) {
        alert('Canvas template successfully saved to local system database!');
      } else {
        alert('Failed to save template to API.');
      }
    } catch (e) {
      alert('Error connecting to Server.');
    }
  };

  const activeSlot = slots.find(s => s.id === activeSlotId) || slots[0];

  return (
    <div className="designer-container animate-fade-in">
      
      {/* Design Editor Toolbar Control Panel */}
      <div className="designer-controls glass-panel">
        <h2 className="pane-title">Layout Canvas Editor</h2>
        
        <div className="form-group">
          <label>Template Name</label>
          <input 
            type="text" 
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Layout Structure</label>
          <div className="layout-presets-grid">
            <button 
              className={`preset-btn ${layoutType === 'single' ? 'active' : ''}`}
              onClick={() => handleLayoutChange('single')}
            >
              Single 4x6 Landscape
            </button>
            <button 
              className={`preset-btn ${layoutType === 'strip' ? 'active' : ''}`}
              onClick={() => handleLayoutChange('strip')}
            >
              Double 2x6 Photo Strip
            </button>
            <button 
              className={`preset-btn ${layoutType === 'grid' ? 'active' : ''}`}
              onClick={() => handleLayoutChange('grid')}
            >
              Collage 2x2 Grid
            </button>
          </div>
        </div>

        <div className="form-group">
          <label>Overlay Frame (Transparent PNG)</label>
          <div className="file-input-wrapper glass-card">
            <FileImage size={24} />
            <span>{overlayImage ? 'Overlay Frame Uploaded' : 'Upload PNG Border Overlay'}</span>
            <input type="file" accept="image/png" onChange={handleOverlayUpload} />
          </div>
          {overlayImage && (
            <button className="btn btn-secondary btn-sm mt-10" onClick={() => setOverlayImage('')}>
              Clear Overlay Frame
            </button>
          )}
        </div>

        <hr className="divider" />

        {/* Selected Slot Slider Manipulations */}
        {activeSlot && (
          <div className="slot-adjuster">
            <div className="adjuster-header">
              <h4>Position Placeholder Box {slots.findIndex(s => s.id === activeSlotId) + 1}</h4>
              <button className="btn-icon text-red" onClick={() => removeSlot(activeSlotId)}>
                <Trash2 size={16} />
              </button>
            </div>

            <div className="sliders-list mt-10">
              <div className="slider-row">
                <label>X Position ({activeSlot.x}px)</label>
                <input 
                  type="range" min="0" max={canvasWidth - 50} 
                  value={activeSlot.x} 
                  onChange={(e) => updateActiveSlot('x', e.target.value)}
                />
              </div>
              <div className="slider-row">
                <label>Y Position ({activeSlot.y}px)</label>
                <input 
                  type="range" min="0" max={canvasHeight - 50} 
                  value={activeSlot.y} 
                  onChange={(e) => updateActiveSlot('y', e.target.value)}
                />
              </div>
              <div className="slider-row">
                <label>Width ({activeSlot.width}px)</label>
                <input 
                  type="range" min="50" max={canvasWidth - activeSlot.x} 
                  value={activeSlot.width} 
                  onChange={(e) => updateActiveSlot('width', e.target.value)}
                />
              </div>
              <div className="slider-row">
                <label>Height ({activeSlot.height}px)</label>
                <input 
                  type="range" min="50" max={canvasHeight - activeSlot.y} 
                  value={activeSlot.height} 
                  onChange={(e) => updateActiveSlot('height', e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        <div className="designer-footer mt-30">
          <button className="btn btn-secondary w-full" onClick={addSlot}>
            <Plus size={18} /> Add Placeholder Box
          </button>
          <button className="btn btn-primary w-full mt-10" onClick={saveTemplate}>
            <Save size={18} /> Save Layout Template
          </button>
        </div>
      </div>

      {/* Visual Canvas Designer Grid area */}
      <div className="designer-canvas-area">
        <div className="canvas-wrapper">
          <div 
            className="design-canvas glass-panel" 
            style={{ 
              width: `${canvasWidth}px`, 
              height: `${canvasHeight}px`,
              position: 'relative'
            }}
          >
            {/* Render slots */}
            {slots.map((slot, index) => (
              <div 
                key={slot.id}
                className={`canvas-slot ${activeSlotId === slot.id ? 'active' : ''}`}
                style={{
                  left: `${slot.x}px`,
                  top: `${slot.y}px`,
                  width: `${slot.width}px`,
                  height: `${slot.height}px`
                }}
                onClick={() => setActiveSlotId(slot.id)}
              >
                <div className="slot-index"><Move size={14} /> Photo Box {index + 1}</div>
                <div className="slot-dim">{slot.width} x {slot.height}</div>
              </div>
            ))}

            {/* Display Overlay Frame on top of Slots */}
            {overlayImage && (
              <div 
                className="canvas-overlay-preview"
                style={{ backgroundImage: `url(${overlayImage})` }}
              />
            )}
          </div>
        </div>
        <p className="canvas-instructions mt-20">
          Click on any photo placeholder box inside the template to select it, then adjust its coordinate coordinates or dimensions in the left sliders panel.
        </p>
      </div>

    </div>
  );
}

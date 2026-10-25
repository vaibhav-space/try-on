import React from 'react'

/**
 * OpticalHud Component
 * Next-Gen Sci-Fi Optometry & Biometric Tracking HUD
 * Displays real-time physical calibration (IPD, Temple Face Width, 3D Pose Angles)
 */
export default function OpticalHud({ telemetry, fitInfo, selectedProduct, isTracking, isVisible = true }) {
  if (!isVisible || !isTracking || !telemetry) return null

  const {
    yaw = 0,
    pitch = 0,
    roll = 0,
    ipdMm = 63,
    faceWidthMm = 142,
    frameWidthMm = 140,
    differenceMm = 0
  } = telemetry

  const score = fitInfo?.fitScore || 90
  const fitLabel = fitInfo?.fitLabel || 'Calibrating...'

  // Dynamic status color
  const statusColor = score >= 85 ? '#00FFA3' : score >= 65 ? '#00F0FF' : '#FFB800'

  return (
    <div className="optical-hud">
      {/* Reticle Corner Brackets */}
      <span className="hud-corner top-left" />
      <span className="hud-corner top-right" />
      <span className="hud-corner bottom-left" />
      <span className="hud-corner bottom-right" />

      {/* Header bar */}
      <div className="hud-header">
        <div className="hud-status">
          <span className="hud-pulse" style={{ backgroundColor: statusColor }} />
          <span className="hud-title">SPATIAL BIOMETRICS</span>
        </div>
        <span className="hud-badge">60 FPS • GPU</span>
      </div>

      {/* Main metrics grid */}
      <div className="hud-grid">
        <div className="hud-metric">
          <span className="metric-label">PUPILLARY DIST (PD)</span>
          <span className="metric-value">{ipdMm} <span className="metric-unit">mm</span></span>
        </div>

        <div className="hud-metric">
          <span className="metric-label">FACE WIDTH (TEMPLES)</span>
          <span className="metric-value">{faceWidthMm} <span className="metric-unit">mm</span></span>
        </div>

        <div className="hud-metric">
          <span className="metric-label">FRAME WIDTH</span>
          <span className="metric-value">{frameWidthMm} <span className="metric-unit">mm</span></span>
        </div>

        <div className="hud-metric">
          <span className="metric-label">FRAME FIT DELTA</span>
          <span className="metric-value" style={{ color: statusColor }}>
            {differenceMm > 0 ? `+${differenceMm}` : differenceMm} <span className="metric-unit">mm</span>
          </span>
        </div>
      </div>

      {/* 3D Head Orientation Telemetry */}
      <div className="hud-telemetry-row">
        <div className="telemetry-item">
          <span className="telem-label">YAW</span>
          <span className="telem-val">{yaw > 0 ? `+${yaw}` : yaw}°</span>
        </div>
        <div className="telemetry-item">
          <span className="telem-label">PITCH</span>
          <span className="telem-val">{pitch > 0 ? `+${pitch}` : pitch}°</span>
        </div>
        <div className="telemetry-item">
          <span className="telem-label">ROLL</span>
          <span className="telem-val">{roll > 0 ? `+${roll}` : roll}°</span>
        </div>
      </div>

      {/* Live Fit Score Bar */}
      <div className="hud-score-container">
        <div className="hud-score-header">
          <span className="score-label">ANATOMICAL MATCH</span>
          <span className="score-val" style={{ color: statusColor }}>{score}% • {fitLabel.toUpperCase()}</span>
        </div>
        <div className="score-track">
          <div 
            className="score-fill" 
            style={{ 
              width: `${score}%`,
              background: `linear-gradient(90deg, #00F0FF 0%, ${statusColor} 100%)`,
              boxShadow: `0 0 12px ${statusColor}88`
            }} 
          />
        </div>
      </div>
    </div>
  )
}

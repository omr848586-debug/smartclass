import React from 'react';

export default function SmartClassLogo({ size = 'md', showSubtitle = true, iconOnly = false }) {
  // Dimensions based on size
  const sizes = {
    sm: { icon: 32, title: '15px', sub: '9px', gap: '8px' },
    md: { icon: 42, title: '18px', sub: '11px', gap: '12px' },
    lg: { icon: 56, title: '24px', sub: '13px', gap: '16px' },
  };

  const current = sizes[size] || sizes.md;

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: current.gap, userSelect: 'none' }}>
      {/* High-Tech Vector Logo Emblem */}
      <div style={{
        width: `${current.icon}px`,
        height: `${current.icon}px`,
        borderRadius: size === 'lg' ? '16px' : '12px',
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(168, 85, 247, 0.35) 100%)',
        border: '1px solid rgba(168, 85, 247, 0.45)',
        boxShadow: '0 4px 20px rgba(139, 92, 246, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Subtle background glow */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.2) 0%, transparent 60%)',
        }} />

        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: '80%', height: '80%', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}
        >
          <defs>
            <linearGradient id="scGradPrimary" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="40%" stopColor="#818cf8" />
              <stop offset="100%" stopColor="#c084fc" />
            </linearGradient>
            <linearGradient id="scGradCap" x1="8" y1="12" x2="40" y2="28" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#a5b4fc" />
            </linearGradient>
            <linearGradient id="scGradEye" x1="14" y1="24" x2="34" y2="38" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#38bdf8" />
            </linearGradient>
          </defs>

          {/* Academic Graduation Cap */}
          <path
            d="M24 6L6 15L24 24L42 15L24 6Z"
            fill="url(#scGradCap)"
          />
          {/* Cap Underside / 3D Trim */}
          <path
            d="M12 18V26C12 26 16 31 24 31C32 31 36 26 36 26V18L24 24L12 18Z"
            fill="url(#scGradPrimary)"
            fillOpacity="0.4"
          />

          {/* Tassel */}
          <path
            d="M38 17V27C38 28.5 39 30 40 30"
            stroke="#fbbf24"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <circle cx="40" cy="30.5" r="1.5" fill="#fbbf24" />

          {/* AI Vision Aperture / Gaze Center */}
          <ellipse
            cx="24"
            cy="27"
            rx="11"
            ry="7.5"
            stroke="url(#scGradEye)"
            strokeWidth="2"
            fill="#0f172a"
            fillOpacity="0.75"
          />
          {/* Iris */}
          <circle
            cx="24"
            cy="27"
            r="4.2"
            fill="url(#scGradPrimary)"
          />
          {/* Pupil / Target Gaze Crosshair */}
          <circle
            cx="24"
            cy="27"
            r="2"
            fill="#ffffff"
          />
          <circle
            cx="25"
            cy="26"
            r="0.8"
            fill="#ffffff"
          />

          {/* AI Reticle corner ticks */}
          <path d="M19 22L17 22" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M29 22L31 22" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M19 32L17 32" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M29 32L31 32" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>

      {/* Typography Branding */}
      {!iconOnly && (
        <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: current.title,
            fontWeight: 800,
            letterSpacing: '-0.3px',
            lineHeight: 1.15,
            color: '#ffffff',
          }}>
            <span>Smart</span>
            <span style={{
              background: 'linear-gradient(135deg, #818cf8 0%, #c084fc 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              Class
            </span>
            <span style={{
              fontSize: size === 'lg' ? '12px' : '10px',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.4), rgba(168, 85, 247, 0.5))',
              color: '#e0e7ff',
              padding: '2px 7px',
              borderRadius: '6px',
              fontWeight: 700,
              letterSpacing: '0.5px',
              border: '1px solid rgba(168, 85, 247, 0.5)',
              boxShadow: '0 2px 6px rgba(139, 92, 246, 0.25)',
            }}>
              AI
            </span>
          </div>

          {showSubtitle && (
            <div style={{
              fontSize: current.sub,
              color: 'var(--text-dim)',
              fontWeight: 600,
              letterSpacing: '0.2px',
              marginTop: '2px',
            }}>
              Live Attentiveness & Attendance System
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import React from 'react';

export default function Navbar({ activeTab, setActiveTab, currentUser, onLogout }) {
  const navItems = [
    { id: 'monitor', label: 'Live AI Monitor', icon: '📹' },
    { id: 'students', label: 'Student Directory', icon: '🎓' },
    { id: 'attendance', label: 'Attendance Records', icon: '📊' },
    { id: 'alerts', label: 'Inattention Alerts', icon: '⚠️' },
    { id: 'verify', label: 'Face Verification', icon: '👤' },
  ];

  const teacherName = currentUser?.name || 'Dr. Vikram Sen';
  const teacherSubject = currentUser?.subject || currentUser?.department || 'AI & Computer Vision';
  const teacherInitials = teacherName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || 'TR';

  return (
    <header style={{
      background: 'rgba(11, 15, 25, 0.9)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      padding: '0 24px',
    }}>
      <div style={{
        maxWidth: '1440px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '70px',
      }}>
        {/* Brand Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
            fontSize: '20px',
          }}>
            🎯
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.3px', color: '#fff' }}>
              Smart<span style={{ color: '#818cf8' }}>Class</span> <span style={{ fontSize: '12px', background: '#312e81', color: '#c7d2fe', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>AI ATTENTIVENESS</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 500 }}>
              Live Gaze & Automated Attendance Platform
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 16px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: isActive ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid transparent',
                  background: isActive ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                  color: isActive ? '#a5b4fc' : 'var(--text-muted)',
                  transition: 'all 0.2s ease',
                }}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Instructor Profile & System Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(255, 255, 255, 0.04)',
            padding: '6px 12px',
            borderRadius: '20px',
            border: '1px solid var(--border-color)',
            fontSize: '12px',
          }}>
            <div className="live-dot" />
            <span style={{ color: '#34d399', fontWeight: 600 }}>AI Vision Active</span>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            borderLeft: '1px solid var(--border-color)',
            paddingLeft: '16px',
          }}>
            <div style={{
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              background: '#3730a3',
              color: '#c7d2fe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 700,
            }}>
              {teacherInitials}
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{teacherName}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{teacherSubject}</div>
            </div>

            {onLogout && (
              <button
                onClick={onLogout}
                title="Sign out of teacher account"
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#f87171',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  marginLeft: '6px',
                  transition: 'all 0.2s ease',
                }}
              >
                Logout
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

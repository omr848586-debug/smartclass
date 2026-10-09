import React from 'react';
import SmartClassLogo from './SmartClassLogo';

export default function Navbar({ activeTab, setActiveTab, currentUser, onOpenProfile, onLogout }) {
  const navItems = [
    { id: 'monitor', label: 'Live AI Monitor', icon: '📹' },
    { id: 'students', label: 'Student Directory', icon: '🎓' },
    { id: 'attendance', label: 'Attendance Records', icon: '📊' },
    { id: 'alerts', label: 'Inattention Alerts', icon: '⚠️' },
    { id: 'verify', label: 'Face Verification', icon: '👤' },
  ];

  const teacherName = currentUser?.name || 'Dr. Vikram Sen';
  const teacherSubject = currentUser?.subject || currentUser?.department || 'Deep Learning & Computer Vision';
  const teacherDesignation = currentUser?.designation || 'Faculty Lead';
  const teacherPhoto = currentUser?.photo_url || '';
  const teacherInitials = teacherName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || 'TR';

  return (
    <header style={{
      background: 'rgba(14, 10, 31, 0.92)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--border-color)',
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
        height: '72px',
      }}>
        {/* Brand Logo */}
        <SmartClassLogo size="md" showSubtitle={true} />


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
                  border: isActive ? '1px solid rgba(139, 92, 246, 0.5)' : '1px solid transparent',
                  background: isActive ? 'rgba(139, 92, 246, 0.18)' : 'transparent',
                  color: isActive ? '#c4b5fd' : 'var(--text-muted)',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
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
            <span style={{ color: '#34d399', fontWeight: 600 }}>AI Active</span>
          </div>

          {/* Interactive Teacher Profile Card */}
          <div
            onClick={onOpenProfile}
            title="Click to view & edit Teacher Profile"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '6px 12px 6px 8px',
              borderRadius: '24px',
              background: 'rgba(139, 92, 246, 0.12)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(139, 92, 246, 0.25)';
              e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.6)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(139, 92, 246, 0.12)';
              e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.3)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {/* Teacher Avatar Photo or Initials */}
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: '#3730a3',
              color: '#c7d2fe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              fontWeight: 700,
              overflow: 'hidden',
              border: '2px solid rgba(139, 92, 246, 0.5)',
              flexShrink: 0,
            }}>
              {teacherPhoto ? (
                <img src={teacherPhoto} alt={teacherName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                teacherInitials
              )}
            </div>

            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {teacherName} <span style={{ fontSize: '10px', color: '#c4b5fd' }}>▼</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                {teacherDesignation}
              </div>
            </div>
          </div>

          {onLogout && (
            <button
              onClick={onLogout}
              title="Sign out of teacher account"
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                borderRadius: '8px',
                padding: '7px 12px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)';
              }}
            >
              Sign Out
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

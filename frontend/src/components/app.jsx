import React, { useState, useEffect } from 'react';
import Navbar from './navbar';
import ClassroomLiveMonitor from './ClassroomLiveMonitor';
import StudentDirectory from './pages/Dashboard';
import AttendanceTable from './AttendanceTable';
import AlertCenter from './AlertCard';
import StudentVerification from './StudentVerification';
import Login from './pages/login';

export default function App() {
  const [activeTab, setActiveTab] = useState('monitor');
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('smartclass_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem('smartclass_token');
    localStorage.removeItem('smartclass_user');
    setCurrentUser(null);
  };

  if (!currentUser) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <header style={{
          background: 'rgba(11, 15, 25, 0.9)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '16px 24px',
          textAlign: 'center'
        }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>🎯</span>
            <span style={{ fontSize: '20px', fontWeight: 800, color: '#fff' }}>
              Smart<span style={{ color: '#818cf8' }}>Class</span> AI
            </span>
          </div>
        </header>

        <main style={{ flex: 1 }}>
          <Login onLoginSuccess={handleLoginSuccess} />
        </main>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      <main style={{
        flex: 1,
        maxWidth: '1440px',
        width: '100%',
        margin: '0 auto',
        padding: '30px 24px 60px 24px',
      }}>
        {activeTab === 'monitor' && <ClassroomLiveMonitor onAttendanceUpdated={() => {}} />}
        {activeTab === 'students' && <StudentDirectory />}
        {activeTab === 'attendance' && <AttendanceTable />}
        {activeTab === 'alerts' && <AlertCenter />}
        {activeTab === 'verify' && <StudentVerification />}
      </main>

      <footer style={{
        textAlign: 'center',
        padding: '20px',
        borderTop: '1px solid var(--border-color)',
        fontSize: '12px',
        color: 'var(--text-dim)',
      }}>
        SmartClass AI • Live Attentiveness & Automated Attendance Platform • 3D Nose Pose & Gaze Analysis
      </footer>
    </div>
  );
}

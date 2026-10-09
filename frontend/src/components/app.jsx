import React, { useState, useEffect } from 'react';
import Navbar from './navbar';
import SmartClassLogo from './SmartClassLogo';
import ClassroomLiveMonitor from './ClassroomLiveMonitor';
import StudentDirectory from './pages/Dashboard';
import AttendanceTable from './AttendanceTable';
import AlertCenter from './AlertCard';
import StudentVerification from './StudentVerification';
import TeacherProfileModal from './TeacherProfileModal';
import Login from './pages/login';

export default function App() {
  const [activeTab, setActiveTab] = useState('monitor');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('smartclass_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Keep profile synchronized with backend
  useEffect(() => {
    if (currentUser) {
      fetch('/api/auth/me')
        .then((res) => res.json())
        .then((data) => {
          if (data && !data.detail) {
            setCurrentUser(data);
            localStorage.setItem('smartclass_user', JSON.stringify(data));
          }
        })
        .catch(() => {});
    }
  }, []);

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem('smartclass_token');
    localStorage.removeItem('smartclass_user');
    setCurrentUser(null);
  };

  const handleUpdateProfile = (updatedUser) => {
    setCurrentUser(updatedUser);
    localStorage.setItem('smartclass_user', JSON.stringify(updatedUser));
  };

  if (!currentUser) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <header style={{
          background: 'rgba(14, 10, 31, 0.92)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--border-color)',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <SmartClassLogo size="md" showSubtitle={true} />
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
        onOpenProfile={() => setIsProfileModalOpen(true)}
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

      {/* Teacher Profile Modal */}
      <TeacherProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentUser={currentUser}
        onUpdateProfile={handleUpdateProfile}
        onLogout={handleLogout}
      />

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

import React, { useState, useEffect, useRef } from 'react';

export default function TeacherProfileModal({ isOpen, onClose, currentUser, onUpdateProfile, onLogout }) {
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState({
    id: currentUser?.id || 1,
    name: currentUser?.name || 'Dr. Vikram Sen',
    email: currentUser?.email || 'teacher@smartclass.edu',
    department: currentUser?.department || 'Computer Science & Engineering',
    subject: currentUser?.subject || 'Deep Learning & Computer Vision',
    designation: currentUser?.designation || 'Associate Professor & Lab Lead',
    employee_id: currentUser?.employee_id || 'EMP-CS-2024',
    phone: currentUser?.phone || '+91 98450 11223',
    office_room: currentUser?.office_room || 'Faculty Block B - Room 304',
    bio: currentUser?.bio || 'Specializing in Computer Vision, Facial Biometrics, and Deep Learning Neural Architectures.',
    photo_url: currentUser?.photo_url || '',
    password: '',
  });

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Camera state for teacher photo capture
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      // Fetch latest profile from backend
      fetch('/api/auth/me')
        .then((res) => res.json())
        .then((data) => {
          if (data && !data.detail) {
            setProfile((prev) => ({
              ...prev,
              ...data,
              password: '',
            }));
          }
        })
        .catch(() => {});
      setIsEditing(false);
      setSaveSuccess(false);
      setErrorMessage('');
    } else {
      stopCamera();
    }
  }, [isOpen]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 480 }, height: { ideal: 480 }, facingMode: 'user' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((e) => console.error(e));
      }
      setIsCameraActive(true);
    } catch (err) {
      alert('Unable to open camera: ' + err.message);
    }
  };

  useEffect(() => {
    if (isCameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [isCameraActive]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const snapPhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 480;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setProfile((prev) => ({ ...prev, photo_url: dataUrl }));
    stopCamera();
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfile((prev) => ({ ...prev, photo_url: reader.result }));
        stopCamera();
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrorMessage('');
    setSaveSuccess(false);

    try {
      const payload = { ...profile };
      if (!payload.password) delete payload.password;

      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to update profile');
      }

      const updated = await res.json();
      setProfile((prev) => ({ ...prev, ...updated, password: '' }));
      if (onUpdateProfile) onUpdateProfile(updated);

      setSaveSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const initials = profile.name
    ? profile.name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase()
    : 'TR';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{
          maxWidth: '680px',
          padding: '0',
          overflow: 'hidden',
          background: 'linear-gradient(180deg, #171131 0%, #0e0a1f 100%)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.7)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Banner Header */}
        <div style={{
          background: 'linear-gradient(135deg, #4338ca 0%, #7c3aed 50%, #a855f7 100%)',
          padding: '24px 28px',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
            {/* Avatar / Photo */}
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: '#1e1b4b',
              border: '3px solid #fff',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              fontSize: '28px',
              fontWeight: 800,
              color: '#c7d2fe',
            }}>
              {profile.photo_url ? (
                <img src={profile.photo_url} alt={profile.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span>{initials}</span>
              )}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#fff', margin: 0 }}>
                  {profile.name}
                </h2>
                <span style={{
                  background: 'rgba(255,255,255,0.2)',
                  backdropFilter: 'blur(4px)',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  textTransform: 'uppercase',
                }}>
                  Faculty Lead
                </span>
              </div>
              <div style={{ fontSize: '13px', color: '#e0e7ff', marginTop: '3px', fontWeight: 500 }}>
                {profile.designation || 'Instructor'} • {profile.department}
              </div>
              <div style={{ fontSize: '12px', color: '#c7d2fe', marginTop: '2px' }}>
                ID: <strong>{profile.employee_id || 'EMP-CS-2024'}</strong>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(0, 0, 0, 0.25)',
              border: 'none',
              color: '#fff',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              fontSize: '16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s',
            }}
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '24px 28px' }}>
          {saveSuccess && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              color: '#34d399',
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '18px',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <span>✅</span> Teacher Profile updated successfully!
            </div>
          )}

          {errorMessage && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#f87171',
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '18px',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <span>⚠️</span> {errorMessage}
            </div>
          )}

          {!isEditing ? (
            /* --- VIEW PROFILE MODE --- */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Quick Info Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '14px',
              }}>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px',
                }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
                    📧 Official Email
                  </div>
                  <div style={{ fontSize: '14px', color: '#fff', fontWeight: 600, marginTop: '4px' }}>
                    {profile.email}
                  </div>
                </div>

                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px',
                }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
                    📚 Assigned Teaching Subject
                  </div>
                  <div style={{ fontSize: '14px', color: '#818cf8', fontWeight: 600, marginTop: '4px' }}>
                    {profile.subject}
                  </div>
                </div>

                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px',
                }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
                    📞 Contact Phone
                  </div>
                  <div style={{ fontSize: '14px', color: '#fff', fontWeight: 600, marginTop: '4px' }}>
                    {profile.phone || 'Not provided'}
                  </div>
                </div>

                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px',
                }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
                    📍 Office / Cabin
                  </div>
                  <div style={{ fontSize: '14px', color: '#fff', fontWeight: 600, marginTop: '4px' }}>
                    {profile.office_room || 'Faculty Block B - Room 304'}
                  </div>
                </div>
              </div>

              {/* Bio & Academic Focus */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
              }}>
                <div style={{ fontSize: '12px', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                  🎯 Specialization & Biography
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                  {profile.bio || 'Instructor specializing in Computer Vision, Artificial Intelligence, and Smart Classroom Attentiveness.'}
                </p>
              </div>

              {/* Platform Authority & System Privileges */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(139, 92, 246, 0.08)',
                border: '1px solid rgba(139, 92, 246, 0.25)',
                fontSize: '12px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>🛡️</span>
                  <div>
                    <span style={{ color: '#fff', fontWeight: 600 }}>System Privileges:</span>{' '}
                    <span style={{ color: '#c4b5fd' }}>Full Classroom Monitor & Attendance Automated Dispatch</span>
                  </div>
                </div>
                <span className="pill pill-success" style={{ fontSize: '10px' }}>Active Session</span>
              </div>

              {/* Bottom Actions */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ flex: 2 }}
                  onClick={() => setIsEditing(true)}
                >
                  ✏️ Edit Profile Details
                </button>
                {onLogout && (
                  <button
                    type="button"
                    className="btn btn-danger"
                    style={{ flex: 1 }}
                    onClick={() => {
                      onClose();
                      onLogout();
                    }}
                  >
                    🚪 Logout
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* --- EDIT PROFILE MODE --- */
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Photo & Webcam Capture */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                flexWrap: 'wrap',
              }}>
                <div style={{
                  width: '90px',
                  height: '90px',
                  borderRadius: '50%',
                  background: '#1e1b4b',
                  border: '2px solid rgba(139, 92, 246, 0.4)',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  position: 'relative',
                }}>
                  <video
                    ref={videoRef}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: isCameraActive ? 'block' : 'none',
                    }}
                    autoPlay
                    playsInline
                    muted
                  />
                  {!isCameraActive && profile.photo_url && (
                    <img src={profile.photo_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                  {!isCameraActive && !profile.photo_url && (
                    <span style={{ fontSize: '24px', color: '#c7d2fe' }}>{initials}</span>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>Profile Photo</div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {!isCameraActive ? (
                      <button type="button" className="btn btn-secondary" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={startCamera}>
                        📷 Use Camera
                      </button>
                    ) : (
                      <>
                        <button type="button" className="btn btn-success" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={snapPhoto}>
                          📸 Snap Photo
                        </button>
                        <button type="button" className="btn btn-secondary" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={stopCamera}>
                          Cancel
                        </button>
                      </>
                    )}

                    <label className="btn btn-secondary" style={{ fontSize: '12px', padding: '6px 12px', cursor: 'pointer' }}>
                      📁 Upload Photo
                      <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
                    </label>

                    {profile.photo_url && !isCameraActive && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ fontSize: '12px', padding: '6px 12px', color: '#f87171' }}
                        onClick={() => setProfile((p) => ({ ...p, photo_url: '' }))}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Form Fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label">Email Address *</label>
                  <input
                    type="email"
                    required
                    className="form-input"
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="form-label">Designation / Title</label>
                  <input
                    type="text"
                    className="form-input"
                    value={profile.designation}
                    onChange={(e) => setProfile({ ...profile, designation: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label">Employee / Faculty ID</label>
                  <input
                    type="text"
                    className="form-input"
                    value={profile.employee_id}
                    onChange={(e) => setProfile({ ...profile, employee_id: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="form-label">Department</label>
                  <input
                    type="text"
                    className="form-input"
                    value={profile.department}
                    onChange={(e) => setProfile({ ...profile, department: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label">Teaching Subject / Course</label>
                  <input
                    type="text"
                    className="form-input"
                    value={profile.subject}
                    onChange={(e) => setProfile({ ...profile, subject: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="form-label">Phone Number</label>
                  <input
                    type="text"
                    className="form-input"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label">Office / Cabin Location</label>
                  <input
                    type="text"
                    className="form-input"
                    value={profile.office_room}
                    onChange={(e) => setProfile({ ...profile, office_room: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Biography & Specialization</label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={profile.bio}
                  onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div>
                <label className="form-label">Change Password (Leave blank to keep current)</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="New password (optional)"
                  value={profile.password}
                  onChange={(e) => setProfile({ ...profile, password: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 2 }}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : '💾 Save Profile Updates'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

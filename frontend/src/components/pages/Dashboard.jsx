import React, { useState, useEffect, useRef } from 'react';

export default function StudentDirectory() {
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    roll_number: '',
    name: '',
    email: '',
    parent_email: '',
    phone: '',
    department: 'Computer Science & Engineering',
    section: 'A',
    year: '3rd Year',
    photo_url: '',
  });

  const [photoPreview, setPhotoPreview] = useState('');
  const [loading, setLoading] = useState(false);

  // Live Camera & Face Verification inside Add/Edit Modal
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCheckingFace, setIsCheckingFace] = useState(false);
  const [faceCheckResult, setFaceCheckResult] = useState(null);
  const modalVideoRef = useRef(null);
  const modalStreamRef = useRef(null);

  // Quick Verification Modal State
  const [quickVerifyStudent, setQuickVerifyStudent] = useState(null);
  const [quickCameraActive, setQuickCameraActive] = useState(false);
  const [quickLivePhoto, setQuickLivePhoto] = useState('');
  const [quickVerifying, setQuickVerifying] = useState(false);
  const [quickVerifyResult, setQuickVerifyResult] = useState(null);
  const quickVideoRef = useRef(null);
  const quickStreamRef = useRef(null);

  const fetchStudents = () => {
    setLoading(true);
    fetch('/api/students')
      .then((res) => res.json())
      .then((data) => {
        setStudents(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchStudents();
    return () => {
      stopModalCamera();
      stopQuickCamera();
    };
  }, []);

  // --- Modal Camera Controls ---
  const startModalCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      });
      modalStreamRef.current = stream;
      if (modalVideoRef.current) {
        modalVideoRef.current.srcObject = stream;
        modalVideoRef.current.play().catch((e) => console.error('Video play error:', e));
      }
      setIsCameraActive(true);
    } catch (err) {
      alert('Unable to access webcam: ' + err.message + '\nYou can also use "Upload Photo".');
    }
  };

  useEffect(() => {
    if (isCameraActive && modalVideoRef.current && modalStreamRef.current) {
      modalVideoRef.current.srcObject = modalStreamRef.current;
      modalVideoRef.current.play().catch(() => {});
    }
  }, [isCameraActive]);

  const stopModalCamera = () => {
    if (modalStreamRef.current) {
      modalStreamRef.current.getTracks().forEach((t) => t.stop());
      modalStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const snapModalPhoto = () => {
    if (!modalVideoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = modalVideoRef.current.videoWidth || 640;
    canvas.height = modalVideoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(modalVideoRef.current, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setPhotoPreview(dataUrl);
    setFormData((prev) => ({ ...prev, photo_url: dataUrl }));
    stopModalCamera();
    checkFaceBiometrics(dataUrl, editingStudent ? editingStudent.id : null);
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result;
        setPhotoPreview(dataUrl);
        setFormData((prev) => ({ ...prev, photo_url: dataUrl }));
        stopModalCamera();
        checkFaceBiometrics(dataUrl, editingStudent ? editingStudent.id : null);
      };
      reader.readAsDataURL(file);
    }
  };

  const checkFaceBiometrics = async (imageData, studentId) => {
    if (!imageData) return;
    setIsCheckingFace(true);
    setFaceCheckResult(null);
    try {
      const res = await fetch('/api/verification/check-face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: imageData,
          student_id: studentId,
        }),
      });
      const data = await res.json();
      setFaceCheckResult(data);
    } catch (err) {
      setFaceCheckResult({
        valid: false,
        message: 'Could not connect to face verification service: ' + err.message,
      });
    } finally {
      setIsCheckingFace(false);
    }
  };

  const closeModal = () => {
    stopModalCamera();
    setIsAddModalOpen(false);
    setEditingStudent(null);
    setPhotoPreview('');
    setFaceCheckResult(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (faceCheckResult && faceCheckResult.duplicate) {
      alert('Cannot save: ' + faceCheckResult.message);
      return;
    }

    try {
      const url = editingStudent ? `/api/students/${editingStudent.id}` : '/api/students';
      const method = editingStudent ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const error = await res.json();
        alert(error.detail || 'Failed to save student');
        return;
      }

      closeModal();
      fetchStudents();
    } catch (err) {
      alert('Error saving student: ' + err.message);
    }
  };

  const handleEdit = (student) => {
    setEditingStudent(student);
    setFormData({
      roll_number: student.roll_number,
      name: student.name,
      email: student.email,
      parent_email: student.parent_email || '',
      phone: student.phone || '',
      department: student.department,
      section: student.section,
      year: student.year,
      photo_url: student.photo_url || '',
    });
    setPhotoPreview(student.photo_url || '');
    setFaceCheckResult(null);
    setIsAddModalOpen(true);
    if (student.photo_url) {
      checkFaceBiometrics(student.photo_url, student.id);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Are you sure you want to delete student "${name}"?`)) return;
    try {
      await fetch(`/api/students/${id}`, { method: 'DELETE' });
      fetchStudents();
    } catch (err) {
      alert('Error deleting: ' + err.message);
    }
  };

  // --- Quick Student Verification Modal Controls ---
  const openQuickVerify = (student) => {
    setQuickVerifyStudent(student);
    setQuickLivePhoto('');
    setQuickVerifyResult(null);
    startQuickCamera();
  };

  const closeQuickVerify = () => {
    stopQuickCamera();
    setQuickVerifyStudent(null);
    setQuickLivePhoto('');
    setQuickVerifyResult(null);
  };

  const startQuickCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      });
      quickStreamRef.current = stream;
      if (quickVideoRef.current) {
        quickVideoRef.current.srcObject = stream;
        quickVideoRef.current.play().catch((e) => console.error('Quick video play error:', e));
      }
      setQuickCameraActive(true);
    } catch (err) {
      alert('Unable to access webcam: ' + err.message);
    }
  };

  useEffect(() => {
    if (quickCameraActive && quickVideoRef.current && quickStreamRef.current) {
      quickVideoRef.current.srcObject = quickStreamRef.current;
      quickVideoRef.current.play().catch(() => {});
    }
  }, [quickCameraActive]);

  const stopQuickCamera = () => {
    if (quickStreamRef.current) {
      quickStreamRef.current.getTracks().forEach((t) => t.stop());
      quickStreamRef.current = null;
    }
    setQuickCameraActive(false);
  };

  const snapAndVerify = async () => {
    if (!quickVideoRef.current || !quickVerifyStudent) return;
    const canvas = document.createElement('canvas');
    canvas.width = quickVideoRef.current.videoWidth || 640;
    canvas.height = quickVideoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(quickVideoRef.current, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setQuickLivePhoto(dataUrl);
    stopQuickCamera();

    setQuickVerifying(true);
    setQuickVerifyResult(null);
    try {
      const res = await fetch('/api/verification/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: quickVerifyStudent.id,
          image_base64: dataUrl,
        }),
      });
      const data = await res.json();
      setQuickVerifyResult(data);
      fetchStudents();
    } catch (err) {
      setQuickVerifyResult({
        verified: false,
        message: 'Verification request failed: ' + err.message,
        confidence: 0,
      });
    } finally {
      setQuickVerifying(false);
    }
  };

  const filteredStudents = students.filter((s) => {
    const matchSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.roll_number.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase());
    const matchDept = selectedDept === 'ALL' || s.department === selectedDept;
    return matchSearch && matchDept;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header & Controls */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>
              Student Information & Biometric Registry
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Add student records with live webcam facial verification, duplicate prevention, and parent notification profiles.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              className="btn btn-primary"
              onClick={() => {
                setEditingStudent(null);
                setPhotoPreview('');
                setFaceCheckResult(null);
                setFormData({
                  roll_number: `CS2026-${String(students.length + 1).padStart(3, '0')}`,
                  name: '',
                  email: '',
                  parent_email: '',
                  phone: '',
                  department: 'Computer Science & Engineering',
                  section: 'A',
                  year: '3rd Year',
                  photo_url: '',
                });
                setIsAddModalOpen(true);
              }}
            >
              <span>+</span> Add Student & Verify Face
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(240px, 2fr) minmax(200px, 1fr)',
          gap: '16px',
          marginTop: '20px',
        }}>
          <input
            type="text"
            className="form-input"
            placeholder="🔍 Search student by name, roll number, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className="form-select"
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
          >
            <option value="ALL">All Departments</option>
            <option value="Computer Science & Engineering">Computer Science & Engineering</option>
            <option value="Information Technology">Information Technology</option>
            <option value="Artificial Intelligence & Data Science">AI & Data Science</option>
            <option value="Electronics & Communication">Electronics & Communication</option>
          </select>
        </div>
      </div>

      {/* Student Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '20px',
      }}>
        {filteredStudents.map((s) => (
          <div key={s.id} className="glass-panel" style={{ padding: '22px', position: 'relative' }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
              {/* Photo Avatar */}
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                background: '#1e1b4b',
                border: '2px solid rgba(99, 102, 241, 0.4)',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                {s.photo_url ? (
                  <img src={s.photo_url} alt={s.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '24px' }}>👨‍🎓</span>
                )}
              </div>

              {/* Basic Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {s.name}
                </div>
                <div style={{ fontSize: '12px', color: '#818cf8', fontWeight: 600, marginTop: '2px' }}>
                  Roll: {s.roll_number}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
                  {s.department} • Sec {s.section}
                </div>
              </div>
            </div>

            {/* Complete Contact & Academic Details */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.02)',
              borderRadius: 'var(--radius-sm)',
              padding: '12px',
              marginTop: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              fontSize: '12px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-dim)' }}>Student Email:</span>
                <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{s.email}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-dim)' }}>Parent Alert Email:</span>
                <span style={{ color: '#fbbf24', fontWeight: 500 }}>{s.parent_email || 'Not configured'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-dim)' }}>Phone:</span>
                <span style={{ color: 'var(--text-muted)' }}>{s.phone || 'N/A'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-dim)' }}>Year:</span>
                <span style={{ color: 'var(--text-muted)' }}>{s.year}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                <span style={{ color: 'var(--text-dim)' }}>Face Verification:</span>
                <span className={`pill ${s.has_face_enrolled ? 'pill-success' : 'pill-warning'}`} style={{ fontSize: '10px', padding: '2px 8px' }}>
                  {s.has_face_enrolled ? '✓ Biometric Verified' : '⚠ No Face Data'}
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button
                className="btn btn-secondary"
                style={{ flex: 1, padding: '7px 10px', fontSize: '12px' }}
                onClick={() => openQuickVerify(s)}
                title="Perform instant live face verification"
              >
                📸 Verify Face
              </button>
              <button
                className="btn btn-secondary"
                style={{ flex: 1, padding: '7px 10px', fontSize: '12px' }}
                onClick={() => handleEdit(s)}
              >
                ✏️ Edit
              </button>
              <button
                className="btn btn-danger"
                style={{ padding: '7px 10px', fontSize: '12px' }}
                onClick={() => handleDelete(s.id, s.name)}
                title="Delete student"
              >
                🗑
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredStudents.length === 0 && !loading && (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          No students found matching your search.
        </div>
      )}

      {/* Add / Edit Student Modal with In-Time Face Verification */}
      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ padding: '30px', maxWidth: '680px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#fff' }}>
                  {editingStudent ? 'Edit Student & Face Verification' : 'Add Student & Facial Enrollment'}
                </h2>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Register student credentials and capture/verify biometric facial identity.
                </p>
              </div>
              <button
                onClick={closeModal}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label className="form-label">Roll Number *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={formData.roll_number}
                    onChange={(e) => setFormData({ ...formData, roll_number: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label className="form-label">Student Email * (For Alerts)</label>
                  <input
                    type="email"
                    required
                    className="form-input"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label">Parent Email (For Inattention Alerts)</label>
                  <input
                    type="email"
                    className="form-input"
                    value={formData.parent_email}
                    onChange={(e) => setFormData({ ...formData, parent_email: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label className="form-label">Phone Number</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label">Department</label>
                  <select
                    className="form-select"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  >
                    <option value="Computer Science & Engineering">Computer Science & Engineering</option>
                    <option value="Information Technology">Information Technology</option>
                    <option value="Artificial Intelligence & Data Science">AI & Data Science</option>
                    <option value="Electronics & Communication">Electronics & Communication</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label className="form-label">Section</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.section}
                    onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label">Academic Year</label>
                  <select
                    className="form-select"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                  >
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                  </select>
                </div>
              </div>

              {/* In-Time Biometric Face Verification & Capture Box */}
              <div style={{
                background: 'rgba(14, 10, 31, 0.7)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                borderRadius: 'var(--radius-lg)',
                padding: '16px',
                marginTop: '4px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <label className="form-label" style={{ margin: 0, color: '#c4b5fd', fontWeight: 700 }}>
                    🎯 Face Biometric Capture & Instant Verification
                  </label>
                  <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                    Live Webcam or Photo Upload
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  {/* Photo View / Camera Screen */}
                  <div style={{
                    width: '180px',
                    height: '140px',
                    borderRadius: '14px',
                    background: '#070a13',
                    border: '2px solid rgba(139, 92, 246, 0.4)',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    flexShrink: 0,
                  }}>
                    <video
                      ref={modalVideoRef}
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

                    {!isCameraActive && photoPreview && (
                      <img
                        src={photoPreview}
                        alt="Captured Face"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    )}

                    {!isCameraActive && !photoPreview && (
                      <div style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '11px', padding: '8px' }}>
                        <div style={{ fontSize: '24px', marginBottom: '4px' }}>📷</div>
                        No photo set
                      </div>
                    )}

                    {isCameraActive && (
                      <div style={{
                        position: 'absolute',
                        top: '6px',
                        right: '6px',
                        background: 'rgba(16, 185, 129, 0.9)',
                        color: '#fff',
                        fontSize: '9px',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '8px',
                      }}>
                        LIVE
                      </div>
                    )}
                  </div>

                  {/* Camera Controls & Verification Status */}
                  <div style={{ flex: 1, minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {!isCameraActive ? (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ fontSize: '12px', padding: '6px 12px' }}
                          onClick={startModalCamera}
                        >
                          📷 Open Camera
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="btn btn-success"
                            style={{ fontSize: '12px', padding: '6px 12px' }}
                            onClick={snapModalPhoto}
                          >
                            📸 Snap Face Photo
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ fontSize: '12px', padding: '6px 12px' }}
                            onClick={stopModalCamera}
                          >
                            Cancel Camera
                          </button>
                        </>
                      )}

                      <label className="btn btn-secondary" style={{ fontSize: '12px', padding: '6px 12px', cursor: 'pointer' }}>
                        📁 Upload Image
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          style={{ display: 'none' }}
                        />
                      </label>

                      {photoPreview && !isCameraActive && (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ fontSize: '12px', padding: '6px 12px', color: '#f87171' }}
                          onClick={() => {
                            setPhotoPreview('');
                            setFormData((p) => ({ ...p, photo_url: '' }));
                            setFaceCheckResult(null);
                          }}
                        >
                          ✕ Remove
                        </button>
                      )}
                    </div>

                    {/* Biometric Verification Feedback Banner */}
                    {isCheckingFace && (
                      <div style={{
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(139, 92, 246, 0.1)',
                        border: '1px solid rgba(139, 92, 246, 0.3)',
                        fontSize: '12px',
                        color: '#c4b5fd',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}>
                        <span>⏳</span> Running real-time face biometric analysis...
                      </div>
                    )}

                    {!isCheckingFace && faceCheckResult && (
                      <div style={{
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-sm)',
                        background: faceCheckResult.valid ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                        border: `1px solid ${faceCheckResult.valid ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
                        fontSize: '12px',
                      }}>
                        <div style={{
                          fontWeight: 700,
                          color: faceCheckResult.valid ? '#34d399' : '#f87171',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}>
                          <span>{faceCheckResult.valid ? '✅' : '❌'}</span>
                          {faceCheckResult.valid ? 'Face Biometrics Verified' : 'Face Verification Warning'}
                        </div>
                        <div style={{ color: 'var(--text-muted)', marginTop: '4px', fontSize: '11px' }}>
                          {faceCheckResult.message}
                        </div>
                        {faceCheckResult.duplicate && faceCheckResult.conflict_student && (
                          <div style={{ marginTop: '6px', color: '#fca5a5', fontSize: '11px', fontWeight: 600 }}>
                            Conflicting with: {faceCheckResult.conflict_student.name} ({faceCheckResult.conflict_student.roll_number})
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={closeModal}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 2 }}
                  disabled={faceCheckResult && faceCheckResult.duplicate}
                >
                  {editingStudent ? 'Save & Update Biometrics' : 'Save Student & Register Face'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Live Verification Test Modal */}
      {quickVerifyStudent && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ padding: '26px', maxWidth: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>
                  Live Face Verification
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Student: <strong>{quickVerifyStudent.name}</strong> ({quickVerifyStudent.roll_number})
                </p>
              </div>
              <button
                onClick={closeQuickVerify}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '16px' }}>
              {/* Registered Photo */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '6px', fontWeight: 600 }}>
                  REGISTERED PROFILE
                </div>
                <div style={{
                  width: '140px',
                  height: '140px',
                  borderRadius: '14px',
                  background: '#1e1b4b',
                  overflow: 'hidden',
                  border: '2px solid rgba(99, 102, 241, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {quickVerifyStudent.photo_url ? (
                    <img src={quickVerifyStudent.photo_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: '28px' }}>👤</span>
                  )}
                </div>
              </div>

              {/* Live Camera View */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '6px', fontWeight: 600 }}>
                  LIVE CAPTURE
                </div>
                <div style={{
                  width: '140px',
                  height: '140px',
                  borderRadius: '14px',
                  background: '#070a13',
                  overflow: 'hidden',
                  border: '2px solid rgba(16, 185, 129, 0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}>
                  <video
                    ref={quickVideoRef}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: quickCameraActive ? 'block' : 'none',
                    }}
                    autoPlay
                    playsInline
                    muted
                  />
                  {!quickCameraActive && quickLivePhoto && (
                    <img src={quickLivePhoto} alt="Live" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                </div>
              </div>
            </div>

            {/* Verification Result */}
            {quickVerifyResult && (
              <div style={{
                padding: '14px',
                borderRadius: 'var(--radius-sm)',
                background: quickVerifyResult.verified ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                border: `1px solid ${quickVerifyResult.verified ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                marginBottom: '16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontWeight: 700, color: quickVerifyResult.verified ? '#34d399' : '#f87171', fontSize: '14px' }}>
                    {quickVerifyResult.verified ? '✅ Identity Verified' : '❌ Identity Mismatch'}
                  </div>
                  <span className={`pill ${quickVerifyResult.verified ? 'pill-success' : 'pill-danger'}`}>
                    {(quickVerifyResult.confidence * 100).toFixed(1)}% Match
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {quickVerifyResult.message}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={closeQuickVerify}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 2 }}
                disabled={quickVerifying}
                onClick={quickCameraActive ? snapAndVerify : startQuickCamera}
              >
                {quickVerifying ? 'Verifying Biometrics...' : quickCameraActive ? '📸 Snap & Verify' : '📷 Restart Camera'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';

export default function StudentVerification() {
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [liveImage, setLiveImage] = useState('');
  const [verificationResult, setVerificationResult] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [isWebcamActive, setIsWebcamActive] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    fetch('/api/students')
      .then((res) => res.json())
      .then((data) => {
        setStudents(data);
        if (data.length > 0) setSelectedStudentId(data[0].id);
      })
      .catch((err) => console.error(err));

    return () => {
      stopWebcam();
    };
  }, []);

  const selectedStudent = students.find((s) => s.id === parseInt(selectedStudentId));

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((e) => console.error('Video play error:', e));
      }
      setIsWebcamActive(true);
      setLiveImage('');
    } catch (err) {
      alert('Unable to access webcam: ' + err.message + '\nYou can also use the "Upload Image" button.');
    }
  };

  useEffect(() => {
    if (isWebcamActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [isWebcamActive]);

  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsWebcamActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setLiveImage(dataUrl);
    stopWebcam();
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLiveImage(reader.result);
        stopWebcam();
      };
      reader.readAsDataURL(file);
    }
  };

  const handleVerify = async () => {
    if (!selectedStudentId || !liveImage) {
      alert('Please select a student and capture or upload a live photo to verify.');
      return;
    }

    setVerifying(true);
    setVerificationResult(null);
    try {
      const res = await fetch('/api/verification/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: parseInt(selectedStudentId),
          image_base64: liveImage,
        }),
      });
      const data = await res.json().catch(() => {
        return { verified: false, message: 'Server returned an unexpected response', confidence: 0 };
      });
      setVerificationResult(data);

      // Refresh student roster to update enrolled photo if newly enrolled
      fetch('/api/students')
        .then((r) => r.json())
        .then((d) => setStudents(d))
        .catch(() => {});
    } catch (err) {
      setVerificationResult({ verified: false, message: err.message, confidence: 0 });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>
          Student Facial Biometric Verification
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          1:1 biometric identity matching to confirm student presence and prevent impersonation before lecture monitoring.
        </p>

        {/* Student Selector */}
        <div style={{ marginTop: '20px', maxWidth: '440px' }}>
          <label className="form-label">Select Student to Verify</label>
          <select
            className="form-select"
            value={selectedStudentId}
            onChange={(e) => {
              setSelectedStudentId(e.target.value);
              setVerificationResult(null);
            }}
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.roll_number}) - {s.department}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Comparison Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        {/* Left: Registered Student Profile */}
        <div className="glass-panel" style={{ padding: '24px', textAlign: 'center' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '16px' }}>
            REGISTERED PROFILE PHOTO
          </div>

          <div style={{
            width: '240px',
            height: '200px',
            borderRadius: '20px',
            background: '#1e1b4b',
            margin: '0 auto 16px auto',
            overflow: 'hidden',
            border: '2px solid rgba(99, 102, 241, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {selectedStudent?.photo_url ? (
              <img
                src={selectedStudent.photo_url}
                alt={selectedStudent.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div style={{ color: 'var(--text-dim)', fontSize: '13px', padding: '16px' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>👤</div>
                No registered photo yet.<br />
                Capture a live photo to auto-enroll!
              </div>
            )}
          </div>

          {selectedStudent && (
            <div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>{selectedStudent.name}</div>
              <div style={{ fontSize: '13px', color: '#818cf8', fontWeight: 600, marginTop: '2px' }}>
                Roll: {selectedStudent.roll_number}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px' }}>
                {selectedStudent.department} • {selectedStudent.year}
              </div>
            </div>
          )}
        </div>

        {/* Right: Live Camera Verification Capture */}
        <div className="glass-panel" style={{ padding: '24px', textAlign: 'center' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '16px' }}>
            LIVE CAPTURE FOR VERIFICATION
          </div>

          <div style={{
            width: '240px',
            height: '200px',
            borderRadius: '20px',
            background: '#070a13',
            margin: '0 auto 16px auto',
            overflow: 'hidden',
            border: `2px solid ${isWebcamActive ? 'rgba(16, 185, 129, 0.5)' : 'rgba(255, 255, 255, 0.1)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}>
            {/* Always rendered video element to avoid React null ref issues */}
            <video
              ref={videoRef}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: isWebcamActive ? 'block' : 'none',
              }}
              autoPlay
              playsInline
              muted
            />

            {!isWebcamActive && liveImage && (
              <img
                src={liveImage}
                alt="Live Capture"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )}

            {!isWebcamActive && !liveImage && (
              <div style={{ color: 'var(--text-dim)', fontSize: '13px', padding: '16px' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>📷</div>
                Click <strong>"Start Camera"</strong> or upload a photo to verify
              </div>
            )}

            {isWebcamActive && (
              <div style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: 'rgba(16, 185, 129, 0.9)',
                color: '#fff',
                fontSize: '10px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '10px',
              }}>
                LIVE
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '16px' }}>
            {!isWebcamActive ? (
              <button className="btn btn-secondary" style={{ fontSize: '12px' }} onClick={startWebcam}>
                📷 Start Camera
              </button>
            ) : (
              <button className="btn btn-success" style={{ fontSize: '12px' }} onClick={capturePhoto}>
                📸 Snap Photo
              </button>
            )}

            <label className="btn btn-secondary" style={{ fontSize: '12px', cursor: 'pointer' }}>
              📁 Upload Image
              <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
            </label>
          </div>

          <button
            className="btn btn-primary"
            style={{ width: '100%', height: '42px' }}
            disabled={!liveImage || verifying}
            onClick={handleVerify}
          >
            {verifying ? 'Comparing Biometric Features...' : '🔍 Verify Student Identity'}
          </button>
        </div>
      </div>

      {/* Verification Result Banner */}
      {verificationResult && (
        <div className="glass-panel" style={{
          padding: '24px',
          borderLeft: `6px solid ${verificationResult.verified ? '#10b981' : '#ef4444'}`,
          background: verificationResult.verified ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ fontSize: '36px' }}>
                {verificationResult.verified ? '✅' : '❌'}
              </div>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: verificationResult.verified ? '#34d399' : '#f87171' }}>
                  {verificationResult.message}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Biometric Match Confidence: <strong>{(verificationResult.confidence * 100).toFixed(1)}%</strong>
                </div>
              </div>
            </div>

            <span className={`pill ${verificationResult.verified ? 'pill-success' : 'pill-danger'}`} style={{ fontSize: '13px', padding: '8px 18px' }}>
              {verificationResult.verified ? 'VERIFIED' : 'MISMATCH'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

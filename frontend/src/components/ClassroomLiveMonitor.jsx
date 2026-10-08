import React, { useState, useEffect, useRef } from 'react';

export default function ClassroomLiveMonitor({ onAttendanceUpdated }) {
  const [sourceType, setSourceType] = useState('WEBCAM');
  const [cameraIndex, setCameraIndex] = useState(0);
  const [rtspUrl, setRtspUrl] = useState('rtsp://admin:pass@192.168.1.100:554/live');
  const [lectureTitle, setLectureTitle] = useState('CS301: Deep Learning & Vision');
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [metrics, setMetrics] = useState({
    attentiveness_percentage: 100,
    current_status: 'READY',
    current_reason: 'Ready to start monitoring',
    yaw: 0,
    pitch: 0,
    roll: 0,
    total_frames: 0,
    attentive_frames: 0,
    inattentive_frames: 0,
    attendance_status: 'PRESENT',
    is_face_detected: false,
  });

  const [alertSending, setAlertSending] = useState(false);
  const [alertSuccessMsg, setAlertSuccessMsg] = useState('');
  const [sessionSummary, setSessionSummary] = useState(null);

  // Screen capture refs for Google Meet
  const screenStreamRef = useRef(null);
  const canvasRef = useRef(null);
  const screenIntervalRef = useRef(null);
  const videoElemRef = useRef(null);

  // Load students list for assignment
  useEffect(() => {
    fetch('/api/students')
      .then((res) => res.json())
      .then((data) => {
        setStudents(data);
        if (data.length > 0) {
          setSelectedStudentId(data[0].id);
        }
      })
      .catch((err) => console.error('Error fetching students:', err));
  }, []);

  // Poll live status metrics every 800ms
  useEffect(() => {
    const interval = setInterval(() => {
      fetch('/api/monitoring/status')
        .then((res) => res.json())
        .then((data) => {
          setMetrics(data);
          if (data.is_active && !isSessionActive) {
            setIsSessionActive(true);
            setSessionId(data.session_id);
          }
        })
        .catch(() => {});
    }, 800);
    return () => clearInterval(interval);
  }, [isSessionActive]);

  // Handle Google Meet Screen Share
  const startScreenCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: false,
      });
      screenStreamRef.current = stream;

      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();
      videoElemRef.current = video;

      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      canvasRef.current = canvas;
      const ctx = canvas.getContext('2d');

      // Send 10 fps to backend
      screenIntervalRef.current = setInterval(() => {
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          ctx.drawImage(video, 0, 0, 640, 480);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
          fetch('/api/monitoring/frame_push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_base64: dataUrl }),
          }).catch(() => {});
        }
      }, 100);

      stream.getVideoTracks()[0].onended = () => {
        stopScreenCapture();
      };
    } catch (err) {
      alert('Could not start screen capture: ' + err.message);
    }
  };

  const stopScreenCapture = () => {
    if (screenIntervalRef.current) {
      clearInterval(screenIntervalRef.current);
      screenIntervalRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
  };

  const handleStartSession = async () => {
    if (sourceType === 'GOOGLE_MEET') {
      await startScreenCapture();
    }

    try {
      const res = await fetch('/api/monitoring/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lecture_title: lectureTitle,
          source_type: sourceType,
          rtsp_url: sourceType === 'RTSP' ? rtspUrl : null,
          camera_index: sourceType === 'WEBCAM' ? parseInt(cameraIndex) : 0,
          assigned_student_id: selectedStudentId ? parseInt(selectedStudentId) : null,
        }),
      });
      const data = await res.json();
      setIsSessionActive(true);
      setSessionId(data.session_id);
    } catch (err) {
      alert('Failed to start session: ' + err.message);
    }
  };

  const handleStopSession = async () => {
    if (sourceType === 'GOOGLE_MEET') {
      stopScreenCapture();
    }

    try {
      const res = await fetch('/api/monitoring/session/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId || 'session' }),
      });
      const data = await res.json();
      setIsSessionActive(false);
      setSessionSummary(data.summary);
      if (onAttendanceUpdated) onAttendanceUpdated();
    } catch (err) {
      alert('Failed to stop session: ' + err.message);
    }
  };

  const handleTriggerAlert = async () => {
    setAlertSending(true);
    setAlertSuccessMsg('');
    try {
      const res = await fetch('/api/monitoring/trigger_alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: selectedStudentId ? parseInt(selectedStudentId) : null,
          reason: metrics.current_reason || 'Inattention Detected',
        }),
      });
      const data = await res.json();
      setAlertSuccessMsg('Email alert sent successfully!');
      setTimeout(() => setAlertSuccessMsg(''), 4000);
    } catch (err) {
      alert('Error triggering alert: ' + err.message);
    } finally {
      setAlertSending(false);
    }
  };

  const pct = metrics.attentiveness_percentage || 100;
  const isAttentive = metrics.current_status === 'ATTENTIVE';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Configuration & Controls Bar */}
      <div className="glass-panel" style={{ padding: '20px 24px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          alignItems: 'end',
        }}>
          {/* Lecture Title */}
          <div>
            <label className="form-label">Lecture / Subject Title</label>
            <input
              type="text"
              className="form-input"
              value={lectureTitle}
              onChange={(e) => setLectureTitle(e.target.value)}
              placeholder="e.g. CS301: Machine Learning"
              disabled={isSessionActive}
            />
          </div>

          {/* Video Input Source */}
          <div>
            <label className="form-label">Camera Feed Source</label>
            <select
              className="form-select"
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
              disabled={isSessionActive}
            >
              <option value="WEBCAM">📷 Local Web Camera</option>
              <option value="RTSP">🏫 College CCTV / RTSP Stream</option>
              <option value="GOOGLE_MEET">🌐 Google Meet (Screen Share)</option>
            </select>
          </div>

          {/* Conditional Input based on Source */}
          {sourceType === 'WEBCAM' && (
            <div>
              <label className="form-label">Camera Index</label>
              <select
                className="form-select"
                value={cameraIndex}
                onChange={(e) => setCameraIndex(e.target.value)}
                disabled={isSessionActive}
              >
                <option value={0}>Camera 0 (Default / Integrated)</option>
                <option value={1}>Camera 1 (External USB)</option>
                <option value={2}>Camera 2</option>
              </select>
            </div>
          )}

          {sourceType === 'RTSP' && (
            <div>
              <label className="form-label">CCTV RTSP / IP Camera URL</label>
              <input
                type="text"
                className="form-input"
                value={rtspUrl}
                onChange={(e) => setRtspUrl(e.target.value)}
                placeholder="rtsp://user:pass@ip:554/stream"
                disabled={isSessionActive}
              />
            </div>
          )}

          {sourceType === 'GOOGLE_MEET' && (
            <div>
              <label className="form-label">Google Meet Virtual Mode</label>
              <div style={{ fontSize: '13px', color: '#818cf8', paddingTop: '8px' }}>
                Screen Capture will activate on start
              </div>
            </div>
          )}

          {/* Assign Student to Session */}
          <div>
            <label className="form-label">Monitored Student</label>
            <select
              className="form-select"
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              disabled={isSessionActive}
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.roll_number})
                </option>
              ))}
            </select>
          </div>

          {/* Action Button */}
          <div>
            {!isSessionActive ? (
              <button
                className="btn btn-primary"
                style={{ width: '100%', height: '42px' }}
                onClick={handleStartSession}
              >
                <span>▶</span> Start AI Monitoring
              </button>
            ) : (
              <button
                className="btn btn-danger"
                style={{ width: '100%', height: '42px' }}
                onClick={handleStopSession}
              >
                <span>⏹</span> Stop & Calculate Attendance
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Monitoring Deck */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(320px, 1fr)', gap: '24px' }}>
        {/* Left: Video Feed Stream */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="live-dot" />
              <span style={{ fontWeight: 700, fontSize: '15px' }}>
                AI Vision Stream {isSessionActive ? '● LIVE' : '○ Standby'}
              </span>
              <span className="pill pill-neutral">{sourceType}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-dim)' }}>
                3D Nose Vector & Gaze Tracking:
              </span>
              <span className={`pill ${isAttentive ? 'pill-success' : 'pill-danger'}`}>
                {isAttentive ? '✓ Focused' : '⚠ Inattentive'}
              </span>
            </div>
          </div>

          {/* Video Container */}
          <div style={{
            position: 'relative',
            width: '100%',
            height: '460px',
            background: '#070a13',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `2px solid ${isAttentive ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
            boxShadow: isAttentive ? '0 0 30px rgba(16, 185, 129, 0.15)' : '0 0 30px rgba(239, 68, 68, 0.15)',
          }}>
            {isSessionActive ? (
              <img
                src={`/api/monitoring/video_feed?t=${sessionId}`}
                alt="AI Attentiveness Camera Feed"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎯</div>
                <div style={{ fontSize: '18px', fontWeight: 600, color: '#fff', marginBottom: '6px' }}>
                  Camera Feed Inactive
                </div>
                <div style={{ fontSize: '13px', maxWidth: '340px' }}>
                  Select source (Webcam, College CCTV, or Google Meet) and click <strong>"Start AI Monitoring"</strong> to track live nose direction and calculate attendance.
                </div>
              </div>
            )}

            {/* Inattention Alert Toast overlay */}
            {!isAttentive && isSessionActive && (
              <div style={{
                position: 'absolute',
                top: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(220, 38, 38, 0.95)',
                color: '#fff',
                padding: '10px 20px',
                borderRadius: '30px',
                boxShadow: '0 8px 24px rgba(239, 68, 68, 0.5)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontWeight: 700,
                fontSize: '13px',
                animation: 'pulse 1.5s infinite',
              }}>
                <span>⚠️ INATTENTION DETECTED:</span>
                <span>{metrics.current_reason}</span>
              </div>
            )}
          </div>

          {/* Quick Manual Email Trigger */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
          }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>Automated Email Alerts to Inattentive Student</div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                Dispatched automatically on prolonged distraction, or send warning instantly.
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {alertSuccessMsg && (
                <span style={{ fontSize: '12px', color: '#34d399', fontWeight: 600 }}>
                  ✓ {alertSuccessMsg}
                </span>
              )}
              <button
                className="btn btn-warning"
                onClick={handleTriggerAlert}
                disabled={alertSending || !isSessionActive}
                style={{ fontSize: '12px', padding: '8px 14px' }}
              >
                <span>✉️</span> {alertSending ? 'Sending...' : 'Send Alert Email Now'}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Real-time Attentiveness & Head Pose Analytics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Attentiveness Score Card */}
          <div className="glass-panel" style={{ padding: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '14px' }}>
              ATTENTIVENESS SCORE
            </div>

            {/* Circular Gauge Representation */}
            <div style={{
              position: 'relative',
              width: '160px',
              height: '160px',
              margin: '0 auto 16px auto',
              borderRadius: '50%',
              background: `conic-gradient(${pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444'} ${pct * 3.6}deg, #1f2937 0deg)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 25px rgba(0, 0, 0, 0.5)',
            }}>
              <div style={{
                width: '130px',
                height: '130px',
                borderRadius: '50%',
                background: '#111827',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <div style={{
                  fontSize: '36px',
                  fontWeight: 800,
                  letterSpacing: '-1px',
                  color: pct >= 75 ? '#34d399' : pct >= 50 ? '#fbbf24' : '#f87171',
                }}>
                  {pct.toFixed(0)}%
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600 }}>
                  {metrics.attendance_status}
                </div>
              </div>
            </div>

            {/* Attendance Status Pill */}
            <div>
              <span className={`pill ${metrics.attendance_status === 'PRESENT' ? 'pill-success' : metrics.attendance_status === 'WARNING' ? 'pill-warning' : 'pill-danger'}`} style={{ fontSize: '13px', padding: '6px 18px' }}>
                Attendance: {metrics.attendance_status}
              </span>
            </div>

            <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '12px' }}>
              Requirement: Minimum <strong>75%</strong> attentiveness for Present status.
            </div>
          </div>

          {/* 3D Nose Vector & Head Pose Card */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '14px' }}>
              3D NOSE & HEAD POSE TRACKING
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Yaw (Left/Right) */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Nose Yaw (Left / Right):</span>
                  <span className="mono" style={{ fontWeight: 600, color: Math.abs(metrics.yaw) > 22 ? '#f87171' : '#a5b4fc' }}>
                    {metrics.yaw > 0 ? `+${metrics.yaw}°` : `${metrics.yaw}°`}
                  </span>
                </div>
                <div style={{ height: '6px', background: '#1f2937', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(100, Math.abs(metrics.yaw) * 2.5)}%`,
                    height: '100%',
                    background: Math.abs(metrics.yaw) > 22 ? '#ef4444' : '#6366f1',
                    borderRadius: '3px',
                    transition: 'width 0.2s ease',
                  }} />
                </div>
              </div>

              {/* Pitch (Up/Down) */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Nose Pitch (Up / Down):</span>
                  <span className="mono" style={{ fontWeight: 600, color: (metrics.pitch > 18 || metrics.pitch < -16) ? '#f87171' : '#a5b4fc' }}>
                    {metrics.pitch > 0 ? `+${metrics.pitch}°` : `${metrics.pitch}°`}
                  </span>
                </div>
                <div style={{ height: '6px', background: '#1f2937', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(100, Math.abs(metrics.pitch) * 3)}%`,
                    height: '100%',
                    background: (metrics.pitch > 18 || metrics.pitch < -16) ? '#ef4444' : '#8b5cf6',
                    borderRadius: '3px',
                    transition: 'width 0.2s ease',
                  }} />
                </div>
              </div>

              {/* Status Reason */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
                marginTop: '6px',
              }}>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '2px' }}>AI Detection Reason:</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: isAttentive ? '#34d399' : '#f87171' }}>
                  {metrics.current_reason || 'Analyzing...'}
                </div>
              </div>
            </div>
          </div>

          {/* Session Frame Counters */}
          <div className="glass-panel" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', textAlign: 'center' }}>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#fff' }}>{metrics.total_frames}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Frames</div>
              </div>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#34d399' }}>{metrics.attentive_frames}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Attentive</div>
              </div>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#f87171' }}>{metrics.inattentive_frames}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Inattentive</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Session Summary Modal */}
      {sessionSummary && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ padding: '32px' }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '48px', marginBottom: '8px' }}>
                {sessionSummary.attendance_status === 'PRESENT' ? '🎉' : '⚠️'}
              </div>
              <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>
                Lecture Session Completed
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Attentiveness metrics computed and attendance record created in database.
              </p>
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              padding: '20px',
              marginBottom: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Student Monitored:</span>
                <span style={{ fontWeight: 600, color: '#fff' }}>
                  {sessionSummary.student_name} ({sessionSummary.student_roll})
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Lecture Title:</span>
                <span style={{ fontWeight: 600, color: '#fff' }}>{sessionSummary.lecture_title}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Duration:</span>
                <span style={{ fontWeight: 600, color: '#fff' }}>{sessionSummary.duration_seconds} seconds</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Attentiveness Percentage:</span>
                <span style={{
                  fontWeight: 700,
                  fontSize: '16px',
                  color: sessionSummary.attentiveness_percentage >= 75 ? '#34d399' : '#f87171',
                }}>
                  {sessionSummary.attentiveness_percentage}%
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)' }}>Automated Attendance Result:</span>
                <span className={`pill ${sessionSummary.attendance_status === 'PRESENT' ? 'pill-success' : sessionSummary.attendance_status === 'WARNING' ? 'pill-warning' : 'pill-danger'}`}>
                  {sessionSummary.attendance_status}
                </span>
              </div>
            </div>

            <button
              className="btn btn-primary"
              style={{ width: '100%', height: '44px' }}
              onClick={() => setSessionSummary(null)}
            >
              Close & View in Attendance Table
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

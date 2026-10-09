import React, { useState, useEffect, useRef } from 'react';

export default function ClassroomLiveMonitor({ onAttendanceUpdated }) {
  const [sourceType, setSourceType] = useState('WEBCAM');
  const [cameraIndex, setCameraIndex] = useState(0);
  const [rtspUrl, setRtspUrl] = useState('rtsp://admin:pass@192.168.1.100:554/live');
  const [lectureTitle, setLectureTitle] = useState('CS301: Deep Learning & Vision');
  const [lectureDuration, setLectureDuration] = useState(15); // in minutes: 5, 15, 30, 45, 60, 120, 0 (unlimited)
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const [timeExpiredAlert, setTimeExpiredAlert] = useState(false);

  const [metrics, setMetrics] = useState({
    classroom_attentiveness_percentage: 100,
    attentiveness_percentage: 100,
    current_status: 'READY',
    current_reason: 'Ready to start multi-student monitoring',
    detected_faces_count: 0,
    attentive_students_count: 0,
    inattentive_students_count: 0,
    yaw: 0,
    pitch: 0,
    roll: 0,
    total_frames: 0,
    attentive_frames: 0,
    inattentive_frames: 0,
    attendance_status: 'PRESENT',
    is_face_detected: false,
    active_students: [],
    tracked_students: [],
    remaining_seconds: null,
    is_time_expired: false,
  });

  const [alertSending, setAlertSending] = useState(false);
  const [alertSuccessMsg, setAlertSuccessMsg] = useState('');
  const [sessionSummary, setSessionSummary] = useState(null);

  // Screen capture refs for Google Meet
  const screenStreamRef = useRef(null);
  const canvasRef = useRef(null);
  const screenIntervalRef = useRef(null);
  const videoElemRef = useRef(null);

  // Ref to prevent double auto-stopping
  const isStoppingRef = useRef(false);

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

  // Poll live status metrics every 700ms
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

          // Check if server reports time expired while session is active
          if (data.is_active && data.is_time_expired && !isStoppingRef.current) {
            handleAutoStop();
          }
        })
        .catch(() => {});
    }, 700);
    return () => clearInterval(interval);
  }, [isSessionActive]);

  // Client-side countdown ticker (1 second tick)
  useEffect(() => {
    let timer = null;
    if (isSessionActive && lectureDuration > 0) {
      timer = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev === null) {
            return lectureDuration * 60;
          }
          if (prev <= 1) {
            // Auto stop when countdown hits 0
            if (!isStoppingRef.current) {
              handleAutoStop();
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setRemainingSeconds(null);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isSessionActive, lectureDuration]);

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
      isStoppingRef.current = false;
      setTimeExpiredAlert(false);

      const res = await fetch('/api/monitoring/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lecture_title: lectureTitle,
          source_type: sourceType,
          rtsp_url: sourceType === 'RTSP' ? rtspUrl : null,
          camera_index: sourceType === 'WEBCAM' ? parseInt(cameraIndex) : 0,
          assigned_student_id: selectedStudentId ? parseInt(selectedStudentId) : null,
          duration_minutes: lectureDuration > 0 ? lectureDuration : null,
        }),
      });
      const data = await res.json();
      setIsSessionActive(true);
      setSessionId(data.session_id);
      if (lectureDuration > 0) {
        setRemainingSeconds(lectureDuration * 60);
      } else {
        setRemainingSeconds(null);
      }
    } catch (err) {
      alert('Failed to start session: ' + err.message);
    }
  };

  const handleStopSession = async (isAutoExpired = false) => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;

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
      setRemainingSeconds(null);
      setSessionSummary({
        ...data.summary,
        autoStopped: isAutoExpired,
        durationMinutes: lectureDuration,
      });
      if (onAttendanceUpdated) onAttendanceUpdated();
    } catch (err) {
      alert('Failed to stop session: ' + err.message);
    } finally {
      isStoppingRef.current = false;
    }
  };

  const handleAutoStop = () => {
    setTimeExpiredAlert(true);
    handleStopSession(true);
  };

  const handleTriggerAlert = async (targetStudentId = null, reason = null) => {
    setAlertSending(true);
    setAlertSuccessMsg('');
    try {
      const res = await fetch('/api/monitoring/trigger_alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: targetStudentId || (selectedStudentId ? parseInt(selectedStudentId) : null),
          reason: reason || metrics.current_reason || 'Inattention Detected in Classroom',
        }),
      });
      const data = await res.json();
      setAlertSuccessMsg('Inattention alert sent to student & parent!');
      setTimeout(() => setAlertSuccessMsg(''), 4000);
    } catch (err) {
      alert('Error triggering alert: ' + err.message);
    } finally {
      setAlertSending(false);
    }
  };

  const formatCountdown = (seconds) => {
    if (seconds === null || seconds === undefined) return null;
    const s = Math.max(0, seconds);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    if (hrs > 0) {
      return `${hrs}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const pct = metrics.classroom_attentiveness_percentage || metrics.attentiveness_percentage || 100;
  const detectedCount = metrics.detected_faces_count || 0;
  const attentiveCount = metrics.attentive_students_count || 0;
  const inattentiveCount = metrics.inattentive_students_count || 0;

  // Calculate elapsed percentage of timer for progress bar
  const totalTimerSeconds = lectureDuration > 0 ? lectureDuration * 60 : null;
  const timerProgressPct = (totalTimerSeconds && remainingSeconds !== null)
    ? Math.min(100, Math.max(0, ((totalTimerSeconds - remainingSeconds) / totalTimerSeconds) * 100))
    : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Configuration & Controls Bar */}
      <div className="glass-panel" style={{ padding: '20px 24px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
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

          {/* Lecture Duration Option with Auto-Stop */}
          <div>
            <label className="form-label">⏱ Lecture Duration (Auto-Stop)</label>
            <select
              className="form-select"
              value={lectureDuration}
              onChange={(e) => setLectureDuration(parseInt(e.target.value))}
              disabled={isSessionActive}
            >
              <option value={1}>🚀 1 Minute (Demo / Test)</option>
              <option value={5}>⚡ 5 Minutes (Quick Test)</option>
              <option value={15}>⏱ 15 Minutes (Short Class)</option>
              <option value={30}>⏱ 30 Minutes (Half Hour)</option>
              <option value={45}>⏱ 45 Minutes (Class Period)</option>
              <option value={60}>⌛ 1 Hour (60 Minutes)</option>
              <option value={120}>⌛ 2 Hours (120 Minutes)</option>
              <option value={0}>♾ Unlimited (Manual Stop)</option>
            </select>
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
              <option value="WEBCAM">📷 Local Multi-Student Webcam</option>
              <option value="RTSP">🏫 Classroom CCTV / RTSP Stream</option>
              <option value="GOOGLE_MEET">🌐 Google Meet (All Attendees)</option>
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
                <option value={1}>Camera 1 (Wide Angle / USB)</option>
                <option value={2}>Camera 2</option>
              </select>
            </div>
          )}

          {sourceType === 'RTSP' && (
            <div>
              <label className="form-label">CCTV RTSP URL</label>
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
                All student faces in Meet will be tracked
              </div>
            </div>
          )}

          {/* Action Button */}
          <div>
            {!isSessionActive ? (
              <button
                className="btn btn-primary"
                style={{ width: '100%', height: '42px' }}
                onClick={handleStartSession}
              >
                <span>▶</span> Start Lecture Monitoring
              </button>
            ) : (
              <button
                className="btn btn-danger"
                style={{ width: '100%', height: '42px' }}
                onClick={() => handleStopSession(false)}
              >
                <span>⏹</span> Stop & Record Attendance
              </button>
            )}
          </div>
        </div>

        {/* Live Timer Countdown & Progress Strip */}
        {isSessionActive && (
          <div style={{
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '18px' }}>⏱</span>
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>
                    {lectureDuration > 0 ? `Lecture Timer: ${lectureDuration} Min Session` : 'Continuous Session (Unlimited)'}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-dim)', marginLeft: '8px' }}>
                    {lectureDuration > 0 ? 'Live detection will automatically stop when time expires' : 'Manual stop required'}
                  </span>
                </div>
              </div>

              {remainingSeconds !== null && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Auto-Stop In:</span>
                  <span style={{
                    fontSize: '16px',
                    fontWeight: 800,
                    fontFamily: 'monospace',
                    color: remainingSeconds <= 60 ? '#f87171' : remainingSeconds <= 300 ? '#fbbf24' : '#34d399',
                    background: 'rgba(0, 0, 0, 0.4)',
                    padding: '4px 12px',
                    borderRadius: '8px',
                    border: `1px solid ${remainingSeconds <= 60 ? 'rgba(239, 68, 68, 0.5)' : 'rgba(16, 185, 129, 0.4)'}`,
                  }}>
                    ⏳ {formatCountdown(remainingSeconds)}
                  </span>
                </div>
              )}
            </div>

            {/* Visual Time Progress Bar */}
            {totalTimerSeconds && (
              <div style={{ width: '100%', height: '6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{
                  width: `${timerProgressPct}%`,
                  height: '100%',
                  background: timerProgressPct >= 90 ? 'linear-gradient(90deg, #f59e0b, #ef4444)' : 'linear-gradient(90deg, #6366f1, #10b981)',
                  borderRadius: '3px',
                  transition: 'width 1s linear',
                }} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Monitoring Deck */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(340px, 1fr)', gap: '24px' }}>
        {/* Left: Video Feed Stream */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="live-dot" />
              <span style={{ fontWeight: 700, fontSize: '15px' }}>
                Classroom AI Vision Stream {isSessionActive ? '● LIVE' : '○ Standby'}
              </span>
              <span className="pill pill-neutral">{sourceType}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {remainingSeconds !== null && (
                <span className="pill pill-neutral" style={{ fontSize: '11px', color: '#fbbf24', borderColor: 'rgba(245, 158, 11, 0.3)' }}>
                  ⏳ {formatCountdown(remainingSeconds)}
                </span>
              )}
              <span className="pill pill-success" style={{ fontSize: '12px', padding: '4px 10px' }}>
                👥 {detectedCount} In View
              </span>
              <span className="pill pill-success" style={{ fontSize: '12px', padding: '4px 10px' }}>
                ✓ {attentiveCount} Focused
              </span>
              {inattentiveCount > 0 && (
                <span className="pill pill-danger" style={{ fontSize: '12px', padding: '4px 10px' }}>
                  ⚠ {inattentiveCount} Distracted
                </span>
              )}
            </div>
          </div>

          {/* Video Container */}
          <div style={{
            position: 'relative',
            width: '100%',
            height: '470px',
            background: '#070a13',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `2px solid ${detectedCount > 0 && attentiveCount >= inattentiveCount ? 'rgba(16, 185, 129, 0.4)' : (detectedCount > 0 ? 'rgba(239, 68, 68, 0.4)' : 'rgba(255, 255, 255, 0.1)')}`,
            boxShadow: '0 0 30px rgba(0, 0, 0, 0.5)',
          }}>
            {isSessionActive ? (
              <img
                src={`/api/monitoring/video_feed?t=${sessionId}`}
                alt="AI Attentiveness Multi-Student Feed"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>👥</div>
                <div style={{ fontSize: '18px', fontWeight: 600, color: '#fff', marginBottom: '6px' }}>
                  Multi-Face Camera Stream Standby
                </div>
                <div style={{ fontSize: '13px', maxWidth: '380px', margin: '0 auto' }}>
                  Select duration (e.g. <strong>5m, 15m, 1h, 2h</strong>) and click <strong>"Start Lecture Monitoring"</strong> to automatically track attentiveness and log attendance when time ends.
                </div>
              </div>
            )}

            {/* Inattention Alert Toast overlay */}
            {inattentiveCount > 0 && isSessionActive && (
              <div style={{
                position: 'absolute',
                top: '16px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(220, 38, 38, 0.95)',
                color: '#fff',
                padding: '8px 18px',
                borderRadius: '30px',
                boxShadow: '0 8px 24px rgba(239, 68, 68, 0.5)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: 700,
                fontSize: '12px',
                animation: 'pulse 1.5s infinite',
                zIndex: 10,
              }}>
                <span>⚠️ {inattentiveCount} Student(s) Inattentive</span>
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
            flexWrap: 'wrap',
            gap: '12px',
          }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>Multi-Student Inattention Notification System</div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                Automated alerts dispatched to students & parents on prolonged distraction.
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {alertSuccessMsg && (
                <span style={{ fontSize: '12px', color: '#34d399', fontWeight: 600 }}>
                  ✓ {alertSuccessMsg}
                </span>
              )}
              <button
                className="btn btn-warning"
                onClick={() => handleTriggerAlert()}
                disabled={alertSending || !isSessionActive}
                style={{ fontSize: '12px', padding: '8px 14px' }}
              >
                <span>✉️</span> {alertSending ? 'Sending...' : 'Send Alert Email to Inattentive'}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Real-time Multi-Student Analytics & Live Roster */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Classroom Attentiveness Gauge */}
          <div className="glass-panel" style={{ padding: '22px', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-dim)', marginBottom: '12px', textTransform: 'uppercase' }}>
              CLASSROOM ATTENTIVENESS INDEX
            </div>

            {/* Circular Gauge */}
            <div style={{
              position: 'relative',
              width: '140px',
              height: '140px',
              margin: '0 auto 14px auto',
              borderRadius: '50%',
              background: `conic-gradient(${pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444'} ${pct * 3.6}deg, #1f2937 0deg)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 25px rgba(0, 0, 0, 0.5)',
            }}>
              <div style={{
                width: '112px',
                height: '112px',
                borderRadius: '50%',
                background: '#111827',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <div style={{
                  fontSize: '30px',
                  fontWeight: 800,
                  letterSpacing: '-1px',
                  color: pct >= 75 ? '#34d399' : pct >= 50 ? '#fbbf24' : '#f87171',
                }}>
                  {pct.toFixed(0)}%
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 700 }}>
                  {metrics.attendance_status}
                </div>
              </div>
            </div>

            {/* Active Students in View Summary */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
              marginTop: '10px',
            }}>
              <div style={{
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                padding: '8px',
                borderRadius: 'var(--radius-sm)',
              }}>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#34d399' }}>{attentiveCount}</div>
                <div style={{ fontSize: '10px', color: '#a7f3d0', fontWeight: 600 }}>Focused Students</div>
              </div>

              <div style={{
                background: inattentiveCount > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                border: `1px solid ${inattentiveCount > 0 ? 'rgba(239, 68, 68, 0.35)' : 'var(--border-color)'}`,
                padding: '8px',
                borderRadius: 'var(--radius-sm)',
              }}>
                <div style={{ fontSize: '16px', fontWeight: 800, color: inattentiveCount > 0 ? '#f87171' : 'var(--text-muted)' }}>
                  {inattentiveCount}
                </div>
                <div style={{ fontSize: '10px', color: inattentiveCount > 0 ? '#fca5a5' : 'var(--text-dim)', fontWeight: 600 }}>
                  Distracted Students
                </div>
              </div>
            </div>
          </div>

          {/* Live Detected Students In Current Frame */}
          <div className="glass-panel" style={{ padding: '18px' }}>
            <div style={{
              fontSize: '12px',
              fontWeight: 700,
              color: 'var(--text-dim)',
              marginBottom: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span>CURRENTLY DETECTED IN FRAME</span>
              <span className="pill pill-neutral" style={{ fontSize: '10px' }}>
                {metrics.active_students?.length || 0} active
              </span>
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              maxHeight: '260px',
              overflowY: 'auto',
            }}>
              {metrics.active_students && metrics.active_students.length > 0 ? (
                metrics.active_students.map((st, i) => (
                  <div key={i} style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: `1px solid ${st.is_attentive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                    borderRadius: 'var(--radius-sm)',
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>
                        {st.student_name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                        Roll: {st.student_roll} • Yaw {st.yaw}° / Pitch {st.pitch}°
                      </div>
                      <div style={{ fontSize: '10px', color: st.is_attentive ? '#34d399' : '#f87171', marginTop: '2px', fontWeight: 600 }}>
                        {st.reason}
                      </div>
                    </div>

                    <span className={`pill ${st.is_attentive ? 'pill-success' : 'pill-danger'}`} style={{ fontSize: '10px', padding: '3px 8px' }}>
                      {st.is_attentive ? '✓ Focused' : '⚠ Distracted'}
                    </span>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '12px', padding: '20px 10px' }}>
                  No students currently detected in view.<br />
                  Point camera toward students or start session.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Cumulative Multi-Student Session Attendance Table */}
      {metrics.tracked_students && metrics.tracked_students.length > 0 && (
        <div className="glass-panel" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '12px' }}>
            👥 Multi-Student Real-Time Attendance Roster ({metrics.tracked_students.length} Tracked in Session)
          </h3>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-dim)', fontSize: '11px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 12px' }}>Student Name</th>
                  <th style={{ padding: '10px 12px' }}>Roll Number</th>
                  <th style={{ padding: '10px 12px' }}>Attentive Frames</th>
                  <th style={{ padding: '10px 12px' }}>Total Frames</th>
                  <th style={{ padding: '10px 12px' }}>Attentiveness %</th>
                  <th style={{ padding: '10px 12px' }}>Calculated Status</th>
                  <th style={{ padding: '10px 12px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {metrics.tracked_students.map((st, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#fff' }}>
                      {st.student_name}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#818cf8', fontWeight: 600 }}>
                      {st.student_roll}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#34d399', fontWeight: 600 }}>
                      {st.attentive_frames}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                      {st.total_frames}
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: st.attentiveness_percentage >= 75 ? '#34d399' : '#f87171' }}>
                      {st.attentiveness_percentage}%
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span className={`pill ${st.attendance_status === 'PRESENT' ? 'pill-success' : st.attendance_status === 'WARNING' ? 'pill-warning' : 'pill-danger'}`} style={{ fontSize: '10px', padding: '3px 8px' }}>
                        {st.attendance_status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: '11px', padding: '4px 10px' }}
                        onClick={() => handleTriggerAlert(st.student_id, `Manual warning sent to ${st.student_name}`)}
                      >
                        ✉️ Warn
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Session Summary Modal for Multi-Student Results with Auto-Stop Tag */}
      {sessionSummary && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ padding: '30px', maxWidth: '640px' }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '42px', marginBottom: '6px' }}>
                {sessionSummary.autoStopped ? '⏰' : (sessionSummary.attendance_status === 'PRESENT' ? '🎉' : '📊')}
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>
                {sessionSummary.autoStopped ? 'Lecture Timer Completed (Auto-Stopped)' : 'Lecture Session Completed & Recorded'}
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                {sessionSummary.autoStopped
                  ? `The configured ${sessionSummary.durationMinutes || lectureDuration} minute lecture duration has expired. Attendance was automatically calculated.`
                  : 'Attentiveness scores calculated and individual attendance logged for all detected students.'}
              </p>
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              padding: '16px',
              marginBottom: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              fontSize: '13px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Lecture Title:</span>
                <span style={{ fontWeight: 600, color: '#fff' }}>{sessionSummary.lecture_title}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Duration Completed:</span>
                <span style={{ fontWeight: 600, color: '#fff' }}>{sessionSummary.duration_seconds} seconds</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Classroom Attentiveness:</span>
                <span style={{ fontWeight: 700, color: sessionSummary.attentiveness_percentage >= 75 ? '#34d399' : '#f87171' }}>
                  {sessionSummary.attentiveness_percentage}%
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Total Students Monitored:</span>
                <span style={{ fontWeight: 700, color: '#818cf8' }}>
                  {sessionSummary.total_students_monitored || (sessionSummary.students_summary?.length || 0)} Students
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Session Completion Mode:</span>
                <span className="pill pill-success" style={{ fontSize: '10px' }}>
                  {sessionSummary.autoStopped ? '⏰ Auto-Stop Timer' : '⏹ Manual Stop'}
                </span>
              </div>
            </div>

            {/* List of individual student results */}
            {sessionSummary.students_summary && sessionSummary.students_summary.length > 0 && (
              <div style={{ marginBottom: '20px', maxHeight: '200px', overflowY: 'auto' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-dim)', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase' }}>
                  Student Attendance Breakdown
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {sessionSummary.students_summary.map((st, idx) => (
                    <div key={idx} style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '12px',
                    }}>
                      <div>
                        <strong>{st.student_name}</strong> <span style={{ color: 'var(--text-dim)' }}>({st.student_roll})</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 700, color: st.attentiveness_percentage >= 75 ? '#34d399' : '#f87171' }}>
                          {st.attentiveness_percentage}%
                        </span>
                        <span className={`pill ${st.attendance_status === 'PRESENT' ? 'pill-success' : st.attendance_status === 'WARNING' ? 'pill-warning' : 'pill-danger'}`} style={{ fontSize: '9px', padding: '2px 6px' }}>
                          {st.attendance_status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              className="btn btn-primary"
              style={{ width: '100%', height: '42px' }}
              onClick={() => {
                setSessionSummary(null);
                setTimeExpiredAlert(false);
              }}
            >
              Close & View Records in Attendance Table
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

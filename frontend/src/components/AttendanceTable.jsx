import React, { useState, useEffect } from 'react';

export default function AttendanceTable() {
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(false);

  const fetchAttendance = () => {
    setLoading(true);
    fetch('/api/monitoring/attendance')
      .then((res) => res.json())
      .then((data) => {
        setRecords(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });

    fetch('/api/monitoring/attendance/summary')
      .then((res) => res.json())
      .then((data) => setSummary(data))
      .catch((err) => console.error(err));
  };

  useEffect(() => {
    fetchAttendance();
  }, []);

  const exportToCSV = () => {
    if (records.length === 0) {
      alert('No attendance records to export.');
      return;
    }

    const headers = ['Student Name', 'Roll Number', 'Department', 'Lecture Title', 'Feed Source', 'Attentiveness %', 'Attendance Status', 'Duration (s)', 'Date'];
    const rows = records.map((r) => [
      r.student_name,
      r.roll_number,
      r.department,
      `"${r.lecture_title}"`,
      r.source_type,
      r.attentiveness_percentage,
      r.attendance_status,
      r.duration_seconds,
      new Date(r.start_time).toLocaleString(),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `smartclass_attendance_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredRecords = records.filter((r) => {
    const matchSearch =
      r.student_name.toLowerCase().includes(search.toLowerCase()) ||
      r.roll_number.toLowerCase().includes(search.toLowerCase()) ||
      r.lecture_title.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || r.attendance_status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Attendance Summary Stat Cards */}
      {summary && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
        }}>
          <div className="glass-panel" style={{ padding: '20px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
              Total Sessions Monitored
            </div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#fff', marginTop: '6px' }}>
              {summary.total_sessions}
            </div>
            <div style={{ fontSize: '11px', color: '#818cf8', marginTop: '4px' }}>
              Recorded lectures & classes
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '20px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
              Present (≥75% Attention)
            </div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#34d399', marginTop: '6px' }}>
              {summary.present_count}
            </div>
            <div style={{ fontSize: '11px', color: '#10b981', marginTop: '4px' }}>
              {summary.total_sessions > 0 ? Math.round((summary.present_count / summary.total_sessions) * 100) : 0}% of sessions
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '20px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
              Warning (50% - 74%)
            </div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#fbbf24', marginTop: '6px' }}>
              {summary.warning_count}
            </div>
            <div style={{ fontSize: '11px', color: '#f59e0b', marginTop: '4px' }}>
              Inattentive warning issued
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '20px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
              Absent (&lt;50% Attention)
            </div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#f87171', marginTop: '6px' }}>
              {summary.absent_count}
            </div>
            <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px' }}>
              Attendance rejected
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '20px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
              Average Attentiveness
            </div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#a5b4fc', marginTop: '6px' }}>
              {summary.avg_attentiveness}%
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
              Classroom attention index
            </div>
          </div>
        </div>
      )}

      {/* Table Container */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          marginBottom: '20px',
        }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#fff' }}>
              Automated Attendance Logs
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Attendance is automatically marked based on real-time lecture attentiveness percentage.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button className="btn btn-secondary" onClick={fetchAttendance}>
              🔄 Refresh
            </button>
            <button className="btn btn-primary" onClick={exportToCSV}>
              📥 Export CSV
            </button>
          </div>
        </div>

        {/* Filters */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(240px, 2fr) minmax(180px, 1fr)',
          gap: '16px',
          marginBottom: '20px',
        }}>
          <input
            type="text"
            className="form-input"
            placeholder="🔍 Filter by student, roll number, or lecture..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className="form-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="PRESENT">Present (≥75%)</option>
            <option value="WARNING">Warning (50-74%)</option>
            <option value="ABSENT">Absent (&lt;50%)</option>
          </select>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{
                borderBottom: '1px solid var(--border-color)',
                color: 'var(--text-dim)',
                textTransform: 'uppercase',
                fontSize: '11px',
                letterSpacing: '0.5px',
              }}>
                <th style={{ padding: '12px 16px' }}>Student</th>
                <th style={{ padding: '12px 16px' }}>Lecture / Subject</th>
                <th style={{ padding: '12px 16px' }}>Feed Source</th>
                <th style={{ padding: '12px 16px' }}>Attentiveness %</th>
                <th style={{ padding: '12px 16px' }}>Attendance Status</th>
                <th style={{ padding: '12px 16px' }}>Duration</th>
                <th style={{ padding: '12px 16px' }}>Date & Time</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((r) => {
                const pct = r.attentiveness_percentage;
                return (
                  <tr
                    key={r.id}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 600, color: '#fff' }}>{r.student_name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{r.roll_number}</div>
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--text-main)', fontWeight: 500 }}>
                      {r.lecture_title}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span className="pill pill-neutral" style={{ fontSize: '11px' }}>
                        {r.source_type}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '60px',
                          height: '6px',
                          background: '#1f2937',
                          borderRadius: '3px',
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            width: `${pct}%`,
                            height: '100%',
                            background: pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444',
                            borderRadius: '3px',
                          }} />
                        </div>
                        <span style={{
                          fontWeight: 700,
                          color: pct >= 75 ? '#34d399' : pct >= 50 ? '#fbbf24' : '#f87171',
                        }}>
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span className={`pill ${r.attendance_status === 'PRESENT' ? 'pill-success' : r.attendance_status === 'WARNING' ? 'pill-warning' : 'pill-danger'}`}>
                        {r.attendance_status}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--text-muted)' }}>
                      {r.duration_seconds}s
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--text-dim)', fontSize: '12px' }}>
                      {new Date(r.start_time).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredRecords.length === 0 && !loading && (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No attendance records yet. Start a lecture monitoring session on the Live Monitor tab to calculate attendance!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

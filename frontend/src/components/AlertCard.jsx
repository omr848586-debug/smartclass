import React, { useState, useEffect } from 'react';

export default function AlertCenter() {
  const [alerts, setAlerts] = useState([]);
  const [testEmail, setTestEmail] = useState('');
  const [testStatus, setTestStatus] = useState(null);
  const [testing, setTesting] = useState(false);
  const [loading, setLoading] = useState(false);

  // SMTP Settings State
  const [showConfig, setShowConfig] = useState(false);
  const [smtpConfig, setSmtpConfig] = useState({
    host: 'smtp.gmail.com',
    port: 587,
    user: '',
    password: '',
    from_email: '',
    enabled: false,
    has_password: false,
  });
  const [savingConfig, setSavingConfig] = useState(false);
  const [configMsg, setConfigMsg] = useState(null);

  const fetchAlerts = () => {
    setLoading(true);
    fetch('/api/alerts')
      .then((res) => res.json())
      .then((data) => {
        setAlerts(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  };

  const fetchSmtpConfig = () => {
    fetch('/api/alerts/smtp_config')
      .then((res) => res.json())
      .then((data) => {
        setSmtpConfig((prev) => ({
          ...prev,
          ...data,
          password: '', // keep input blank unless user types new password
        }));
      })
      .catch((err) => console.error('Error fetching SMTP config:', err));
  };

  useEffect(() => {
    fetchAlerts();
    fetchSmtpConfig();
  }, []);

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSavingConfig(true);
    setConfigMsg(null);

    try {
      const res = await fetch('/api/alerts/smtp_config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: smtpConfig.host,
          port: parseInt(smtpConfig.port, 10),
          user: smtpConfig.user,
          password: smtpConfig.password || undefined,
          from_email: smtpConfig.from_email || smtpConfig.user,
          enabled: smtpConfig.enabled,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const updated = await res.json();
      setSmtpConfig((prev) => ({
        ...prev,
        ...updated,
        password: '',
      }));
      setConfigMsg({
        type: 'success',
        text: '✅ SMTP Configuration successfully saved and activated!',
      });
    } catch (err) {
      setConfigMsg({
        type: 'error',
        text: `❌ Failed to save SMTP configuration: ${err.message}`,
      });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleTestEmail = async (e) => {
    e.preventDefault();
    if (!testEmail) return;

    setTesting(true);
    setTestStatus(null);
    try {
      const res = await fetch('/api/alerts/test_email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient_email: testEmail }),
      });
      const data = await res.json();
      setTestStatus(data);
      fetchAlerts();
    } catch (err) {
      setTestStatus({
        status: 'FAILED',
        message: `Network error: ${err.message}`,
      });
    } finally {
      setTesting(false);
    }
  };

  const isLiveSMTP = smtpConfig.enabled && smtpConfig.has_password && smtpConfig.user;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Real SMTP vs Simulation Banner */}
      <div
        style={{
          padding: '16px 20px',
          borderRadius: 'var(--radius-md)',
          background: isLiveSMTP
            ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(6, 78, 59, 0.2))'
            : 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(120, 53, 15, 0.2))',
          border: `1px solid ${isLiveSMTP ? 'rgba(16, 185, 129, 0.35)' : 'rgba(245, 158, 11, 0.35)'}`,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ fontSize: '26px' }}>{isLiveSMTP ? '🟢' : '⚠️'}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '15px', color: isLiveSMTP ? '#34d399' : '#fbbf24' }}>
              {isLiveSMTP
                ? `Live SMTP Active (${smtpConfig.user})`
                : 'Email Dispatcher is in Simulation Mode (No Real Emails Sent)'}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {isLiveSMTP
                ? `Real automated emails will be dispatched to students and parents via ${smtpConfig.host}:${smtpConfig.port}`
                : 'Emails are logged in database only. To deliver REAL emails directly to receiver inboxes (Gmail/Outlook), configure SMTP credentials below.'}
            </div>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setShowConfig(!showConfig)}
          style={{ fontSize: '13px', padding: '8px 16px', whiteSpace: 'nowrap' }}
        >
          {showConfig ? '▲ Hide SMTP Settings' : '⚙️ Configure SMTP / Gmail'}
        </button>
      </div>

      {/* SMTP Configuration Form Panel */}
      {showConfig && (
        <div
          className="glass-panel"
          style={{
            padding: '24px',
            border: '1px solid rgba(99, 102, 241, 0.4)',
            background: 'rgba(17, 24, 39, 0.95)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>
                ⚙️ SMTP Email Delivery Settings
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Configure your outgoing mail server to send real alert emails to students and parents.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '13px', color: '#fff', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  type="checkbox"
                  checked={smtpConfig.enabled}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, enabled: e.target.checked })}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                />
                Enable Live Email Dispatch
              </label>
            </div>
          </div>

          {/* Quick Help for Gmail */}
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              fontSize: '12px',
              color: 'var(--text-muted)',
              marginBottom: '20px',
              lineHeight: '1.5',
            }}
          >
            <strong style={{ color: '#a5b4fc' }}>💡 Gmail Setup Tip:</strong> Google requires an <strong>App Password</strong> instead of your regular password.
            1. Enable 2-Step Verification on your Google Account.
            2. Go to <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" style={{ color: '#818cf8', textDecoration: 'underline' }}>myaccount.google.com/apppasswords</a>.
            3. Generate a new 16-character password and paste it into the Password field below.
          </div>

          <form onSubmit={handleSaveConfig}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '18px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-dim)', display: 'block', marginBottom: '6px' }}>
                  SMTP Host
                </label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="smtp.gmail.com"
                  value={smtpConfig.host}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, host: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-dim)', display: 'block', marginBottom: '6px' }}>
                  SMTP Port
                </label>
                <select
                  className="form-select"
                  value={smtpConfig.port}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, port: e.target.value })}
                >
                  <option value={587}>587 (STARTTLS - Recommended for Gmail/Outlook)</option>
                  <option value={465}>465 (SSL)</option>
                  <option value={25}>25 (Standard Unencrypted)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-dim)', display: 'block', marginBottom: '6px' }}>
                  Sender Email (Username)
                </label>
                <input
                  type="email"
                  required
                  className="form-input"
                  placeholder="your.email@gmail.com"
                  value={smtpConfig.user}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, user: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-dim)', display: 'block', marginBottom: '6px' }}>
                  Password / App Password {smtpConfig.has_password && <span style={{ color: '#34d399' }}>(Configured ✓)</span>}
                </label>
                <input
                  type="password"
                  className="form-input"
                  placeholder={smtpConfig.has_password ? '•••••••••••••••• (Leave blank to keep current)' : '16-character App Password'}
                  value={smtpConfig.password}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, password: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-dim)', display: 'block', marginBottom: '6px' }}>
                  From Display Email (Optional)
                </label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="alerts@smartclass.edu"
                  value={smtpConfig.from_email}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, from_email: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div>
                {configMsg && (
                  <span
                    style={{
                      fontSize: '13px',
                      color: configMsg.type === 'success' ? '#34d399' : '#f87171',
                      fontWeight: 600,
                    }}
                  >
                    {configMsg.text}
                  </span>
                )}
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={savingConfig}
                style={{ padding: '10px 24px' }}
              >
                {savingConfig ? 'Saving Settings...' : '💾 Save & Activate SMTP'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Top Banner & SMTP Test Panel */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(300px, 1.4fr) minmax(280px, 1.1fr)',
            gap: '24px',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <span style={{ fontSize: '24px' }}>✉️</span>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#fff' }}>
                Automated Inattention Email Dispatcher
              </h2>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              When a student turns away, looks down at their phone, or leaves the screen during a lecture, the AI system automatically dispatches formal notification emails to the student and their parent.
            </p>
          </div>

          {/* Test Email Box */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 'var(--radius-md)',
              padding: '18px',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>
              Send Live Test Email to Receiver
            </div>
            <form onSubmit={handleTestEmail} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="email"
                required
                className="form-input"
                placeholder="receiver-email@gmail.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                style={{ fontSize: '13px', padding: '8px 12px' }}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={testing}
                style={{ fontSize: '13px', padding: '8px 16px', whiteSpace: 'nowrap' }}
              >
                {testing ? 'Sending...' : 'Send Test'}
              </button>
            </form>

            {testStatus && (
              <div
                style={{
                  marginTop: '12px',
                  fontSize: '12px',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  lineHeight: '1.4',
                  background:
                    testStatus.status === 'SENT_LIVE'
                      ? 'rgba(16, 185, 129, 0.2)'
                      : testStatus.status === 'SENT_SIMULATED'
                      ? 'rgba(245, 158, 11, 0.2)'
                      : 'rgba(239, 68, 68, 0.2)',
                  color:
                    testStatus.status === 'SENT_LIVE'
                      ? '#34d399'
                      : testStatus.status === 'SENT_SIMULATED'
                      ? '#fbbf24'
                      : '#f87171',
                  border: `1px solid ${
                    testStatus.status === 'SENT_LIVE'
                      ? 'rgba(16, 185, 129, 0.4)'
                      : testStatus.status === 'SENT_SIMULATED'
                      ? 'rgba(245, 158, 11, 0.4)'
                      : 'rgba(239, 68, 68, 0.4)'
                  }`,
                }}
              >
                <strong>
                  {testStatus.status === 'SENT_LIVE'
                    ? '✅ Real Email Sent:'
                    : testStatus.status === 'SENT_SIMULATED'
                    ? '⚠️ Simulated Only:'
                    : '❌ Delivery Failed:'}{' '}
                </strong>
                {testStatus.message || testStatus.status}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Alerts Log Table */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>
              Alert Notification History
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
              Real-time audit log of inattention warnings and email delivery status.
            </p>
          </div>
          <button className="btn btn-secondary" onClick={fetchAlerts}>
            🔄 Refresh Log
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid var(--border-color)',
                  color: 'var(--text-dim)',
                  textTransform: 'uppercase',
                  fontSize: '11px',
                  letterSpacing: '0.5px',
                }}
              >
                <th style={{ padding: '12px 16px' }}>Student</th>
                <th style={{ padding: '12px 16px' }}>Alert Type</th>
                <th style={{ padding: '12px 16px' }}>Attentiveness</th>
                <th style={{ padding: '12px 16px' }}>Email Recipients</th>
                <th style={{ padding: '12px 16px' }}>Delivery Status</th>
                <th style={{ padding: '12px 16px' }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => {
                const isLive = a.status === 'SENT_LIVE' || a.status === 'SENT';
                const isSimulated = a.status === 'SENT_SIMULATED';
                const isFail = a.status === 'FAILED';

                return (
                  <tr
                    key={a.id}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 600, color: '#fff' }}>{a.student_name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{a.student_roll}</div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span className="pill pill-danger" style={{ fontSize: '11px' }}>
                        {a.alert_type}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: 700, color: '#f87171' }}>
                      {a.attentiveness_score.toFixed(1)}%
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--text-muted)' }}>
                      {a.email_sent_to}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {isLive && (
                        <span className="pill pill-success" style={{ fontSize: '10px' }}>
                          🟢 DELIVERED (LIVE)
                        </span>
                      )}
                      {isSimulated && (
                        <span className="pill pill-warning" style={{ fontSize: '10px' }}>
                          🟡 SIMULATED (DEV)
                        </span>
                      )}
                      {isFail && (
                        <span className="pill pill-danger" style={{ fontSize: '10px' }}>
                          🔴 FAILED (ERROR)
                        </span>
                      )}
                      {!isLive && !isSimulated && !isFail && (
                        <span className="pill pill-neutral" style={{ fontSize: '10px' }}>
                          {a.status}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--text-dim)', fontSize: '12px' }}>
                      {new Date(a.created_at).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {alerts.length === 0 && !loading && (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No alerts have been triggered yet. When students are detected inattentive during a live monitoring session, alerts will be logged here.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';

export default function Login({ onLoginSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('Computer Science & AI');
  const [subject, setSubject] = useState('Deep Learning & Vision');
  const [email, setEmail] = useState('teacher@smartclass.edu');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      if (isRegister) {
        // Register new teacher
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, department, subject, password }),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.detail || 'Registration failed');
        }

        setSuccessMsg('Teacher account registered successfully! You can now sign in.');
        setIsRegister(false);
      } else {
        // Login existing teacher
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.detail || 'Login failed');
        }

        const data = await res.json();
        localStorage.setItem('smartclass_token', data.access_token);
        localStorage.setItem('smartclass_user', JSON.stringify(data.user));
        if (onLoginSuccess) onLoginSuccess(data.user);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '80vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div className="glass-panel" style={{
        maxWidth: '480px',
        width: '100%',
        padding: '36px',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            marginBottom: '16px',
            boxShadow: '0 8px 20px rgba(99, 102, 241, 0.35)',
          }}>
            🎯
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>
            {isRegister ? 'Add / Register Teacher' : 'Instructor Portal'}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            {isRegister
              ? 'Create a new faculty instructor profile with subject assignments.'
              : 'Sign in to start live lecture attentiveness monitoring and track automated attendance.'}
          </p>
        </div>

        {/* Tab Toggle */}
        <div style={{
          display: 'flex',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '10px',
          padding: '4px',
          marginBottom: '20px',
        }}>
          <button
            type="button"
            onClick={() => { setIsRegister(false); setError(''); setSuccessMsg(''); }}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              background: !isRegister ? '#6366f1' : 'transparent',
              color: !isRegister ? '#fff' : 'var(--text-muted)',
              transition: 'all 0.2s ease',
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setIsRegister(true); setError(''); setSuccessMsg(''); }}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              background: isRegister ? '#6366f1' : 'transparent',
              color: isRegister ? '#fff' : 'var(--text-muted)',
              transition: 'all 0.2s ease',
            }}
          >
            + Add New Teacher
          </button>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171',
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '13px',
            marginBottom: '18px',
          }}>
            {error}
          </div>
        )}

        {successMsg && (
          <div style={{
            background: 'rgba(52, 211, 153, 0.15)',
            border: '1px solid rgba(52, 211, 153, 0.3)',
            color: '#34d399',
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '13px',
            marginBottom: '18px',
          }}>
            {successMsg}
          </div>
        )}

        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {isRegister && (
            <>
              <div>
                <label className="form-label">Full Name & Title</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Prof. Alan Turing"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="form-label">Department</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Computer Science"
                  />
                </div>
                <div>
                  <label className="form-label">Teaching Subject</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="AI & Vision"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="form-label">Teacher Email Address</label>
            <input
              type="email"
              required
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. teacher@smartclass.edu"
            />
          </div>

          <div>
            <label className="form-label">Password</label>
            <input
              type="password"
              required
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', height: '44px', marginTop: '6px' }}
            disabled={loading}
          >
            {loading
              ? (isRegister ? 'Registering Teacher...' : 'Authenticating...')
              : (isRegister ? 'Create Teacher Account' : 'Sign In to Dashboard')}
          </button>
        </form>

        {!isRegister && (
          <div style={{
            marginTop: '20px',
            padding: '12px',
            background: 'rgba(255, 255, 255, 0.02)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-color)',
            fontSize: '12px',
            color: 'var(--text-dim)',
            textAlign: 'center',
          }}>
            <div><strong>Preconfigured Demo Credentials:</strong></div>
            <div style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
              <code>teacher@smartclass.edu</code> / <code>admin123</code>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

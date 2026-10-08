import React, { useState, useEffect } from 'react';

export default function StudentDirectory() {
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);

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
  }, []);

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
        setFormData({ ...formData, photo_url: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
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

      setIsAddModalOpen(false);
      setEditingStudent(null);
      setPhotoPreview('');
      setFormData({
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
    setIsAddModalOpen(true);
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
              Student Information & Registry
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Complete student records, parent email contact, enrollment details, and facial profiles.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              className="btn btn-primary"
              onClick={() => {
                setEditingStudent(null);
                setPhotoPreview('');
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
              <span>+</span> Add New Student
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
                <span style={{ color: 'var(--text-dim)' }}>Face Profile:</span>
                <span className={`pill ${s.has_face_enrolled ? 'pill-success' : 'pill-warning'}`} style={{ fontSize: '10px', padding: '2px 8px' }}>
                  {s.has_face_enrolled ? '✓ Enrolled' : '⚠ No Face Data'}
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button
                className="btn btn-secondary"
                style={{ flex: 1, padding: '7px 12px', fontSize: '12px' }}
                onClick={() => handleEdit(s)}
              >
                ✏️ Edit Info
              </button>
              <button
                className="btn btn-danger"
                style={{ padding: '7px 12px', fontSize: '12px' }}
                onClick={() => handleDelete(s.id, s.name)}
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

      {/* Add / Edit Student Modal */}
      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ padding: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#fff' }}>
                {editingStudent ? 'Edit Student Profile' : 'Add New Student Record'}
              </h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
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

              {/* Photo & Face Enrollment */}
              <div>
                <label className="form-label">Student Photo (Used for Facial Verification & Identification)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  {photoPreview && (
                    <img
                      src={photoPreview}
                      alt="Preview"
                      style={{ width: '60px', height: '60px', borderRadius: '12px', objectFit: 'cover' }}
                    />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="form-input"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 2 }}
                >
                  Save Student Information
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import * as projectsApi from '../api/projects.js';

export default function ProjectForm({ onCreated }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) { setError('Project name is required'); return; }

    setError('');
    setLoading(true);
    try {
      const project = await projectsApi.createProject(name.trim());
      setName('');
      if (onCreated) onCreated(project);
    } catch (err) {
      setError(err.error || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card mb-3" style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: '200px' }}>
        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '0.3rem' }}>
          New project
        </label>
        <input
          id="project-name"
          className="input"
          type="text"
          placeholder="Project name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
        />
      </div>
      <button className="btn btn-primary" disabled={loading}>
        {loading ? 'Creating…' : 'Create'}
      </button>
      {error && <div className="error-msg" style={{ width: '100%' }}>{error}</div>}
    </form>
  );
}

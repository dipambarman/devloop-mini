import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import * as projectsApi from '../api/projects.js';
import ProjectForm from '../components/ProjectForm.jsx';

export default function ProjectListPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    projectsApi
      .listProjects()
      .then(setProjects)
      .catch((err) => setError(err.error || 'Failed to load projects'))
      .finally(() => setLoading(false));
  }, []);

  function handleCreated(project) {
    setProjects((prev) => [project, ...prev]);
  }

  return (
    <div className="page fade-in">
      <div className="page-header">
        <h1>Projects</h1>
        <p>Your projects and teams</p>
      </div>

      <ProjectForm onCreated={handleCreated} />

      {error && <div className="error-msg">{error}</div>}

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      ) : projects.length === 0 ? (
        <div className="empty-state">
          <p>No projects yet. Create one above to get started.</p>
        </div>
      ) : (
        <div className="project-grid">
          {projects.map((p) => (
            <Link key={p._id || p.id} to={`/projects/${p._id || p.id}/bugs`} style={{ textDecoration: 'none' }}>
              <div className="card card-clickable project-card">
                <h3>{p.name}</h3>
                <span className="owner">{p.owner?.email || 'You'}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

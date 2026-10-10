import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import * as bugsApi from '../api/bugs.js';
import BugTimeline from '../components/BugTimeline.jsx';
import StatusActions from '../components/StatusActions.jsx';

const STATUS_LABELS = { open: 'Open', in_progress: 'In Progress', fixed: 'Fixed', wontfix: "Won't Fix" };

export default function BugDetailPage() {
  const { bugId } = useParams();
  const [bug, setBug] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    bugsApi
      .getBug(bugId)
      .then((data) => {
        const { events: ev, ...rest } = data;
        setBug(rest);
        setEvents(ev || []);
      })
      .catch((err) => setError(err.error || 'Failed to load bug'))
      .finally(() => setLoading(false));
  }, [bugId]);

  function handleStatusUpdated(updatedBug) {
    setBug(updatedBug);
    // Re-fetch to get updated timeline
    bugsApi.getBug(bugId).then((data) => {
      const { events: ev, ...rest } = data;
      setBug(rest);
      setEvents(ev || []);
    });
  }

  if (loading) return <div className="page"><p style={{ color: 'var(--text-muted)' }}>Loading…</p></div>;
  if (error) return <div className="page"><div className="error-msg">{error}</div></div>;
  if (!bug) return null;

  return (
    <div className="page fade-in">
      <div className="page-header">
        <p>
          <Link to={`/projects/${bug.project}/bugs`} style={{ fontSize: '0.85rem' }}>
            ← Bug list
          </Link>
        </p>
        <h1 style={{ fontSize: '1.35rem', background: 'none', WebkitTextFillColor: 'var(--text-primary)' }}>
          {bug.title}
        </h1>
      </div>

      <div className="detail-header">
        <span className={`badge badge-${bug.status}`}>
          {STATUS_LABELS[bug.status] || bug.status}
        </span>
        <span className={`badge badge-${bug.severity}`}>{bug.severity}</span>
      </div>

      <div className="detail-grid card mb-3">
        <div>
          <div className="label">Occurrences</div>
          <div className="value">{bug.occurrenceCount}</div>
        </div>
        <div>
          <div className="label">Regressions</div>
          <div className="value">{bug.regressions}</div>
        </div>
        <div>
          <div className="label">Last Seen</div>
          <div className="value" style={{ fontSize: '0.82rem' }}>
            {new Date(bug.lastSeen).toLocaleString()}
          </div>
        </div>
        <div>
          <div className="label">Fingerprint</div>
          <div className="value mono">{bug.fingerprint}</div>
        </div>
        <div>
          <div className="label">Error Type</div>
          <div className="value">{bug.errorType}</div>
        </div>
        <div>
          <div className="label">Version</div>
          <div className="value">{bug.__v}</div>
        </div>
      </div>

      <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
        Actions
      </h2>
      <StatusActions bug={bug} onUpdated={handleStatusUpdated} />

      <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
        Timeline
      </h2>
      <BugTimeline events={events} />
    </div>
  );
}

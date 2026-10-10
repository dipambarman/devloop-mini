import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import * as bugsApi from '../api/bugs.js';
import FilterBar from '../components/FilterBar.jsx';
import PasteErrorBox from '../components/PasteErrorBox.jsx';

const STATUS_LABELS = { open: 'Open', in_progress: 'In Progress', fixed: 'Fixed', wontfix: "Won't Fix" };
const LIMIT = 50;

export default function BugListPage() {
  const { id: projectId } = useParams();
  const [bugs, setBugs] = useState([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const debounceRef = useRef(null);

  const fetchBugs = useCallback(
    async (filtersToUse, skip = 0) => {
      setLoading(true);
      setError('');
      try {
        const data = await bugsApi.listBugs(projectId, { ...filtersToUse, skip, limit: LIMIT });
        if (skip === 0) {
          setBugs(data.bugs);
        } else {
          setBugs((prev) => [...prev, ...data.bugs]);
        }
        setTotal(data.total);
      } catch (err) {
        setError(err.error || 'Failed to load bugs');
      } finally {
        setLoading(false);
      }
    },
    [projectId],
  );

  // Debounced filter change — 300ms
  function handleFilterChange(next) {
    setFilters(next);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchBugs(next, 0), 300);
  }

  useEffect(() => {
    fetchBugs(filters, 0);
    return () => clearTimeout(debounceRef.current);
  }, [fetchBugs]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleLoadMore() {
    fetchBugs(filters, bugs.length);
  }

  function handleIngested() {
    fetchBugs(filters, 0);
  }

  function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return (
    <div className="page fade-in">
      <div className="page-header">
        <h1>Bugs</h1>
        <p>
          <Link to="/projects" style={{ fontSize: '0.85rem' }}>
            ← Projects
          </Link>
        </p>
      </div>

      <PasteErrorBox projectId={projectId} onIngested={handleIngested} />

      <FilterBar filters={filters} onChange={handleFilterChange} />

      {error && <div className="error-msg">{error}</div>}

      <div className="card" style={{ padding: 0 }}>
        {bugs.length === 0 && !loading ? (
          <div className="empty-state">
            <p>No bugs found. Paste an error above to create one.</p>
          </div>
        ) : (
          bugs.map((b) => (
            <Link key={b._id} to={`/bugs/${b._id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="bug-row">
                <div>
                  <div className="bug-title">{b.title}</div>
                  <div className="bug-meta">
                    <span className={`badge badge-${b.status}`}>
                      {STATUS_LABELS[b.status] || b.status}
                    </span>
                    <span className={`badge badge-${b.severity}`}>{b.severity}</span>
                  </div>
                </div>
                <div className="bug-stats" style={{ flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                  <span>
                    <span className="count">{b.occurrenceCount}</span> occ
                    {b.regressions > 0 && (
                      <span style={{ color: 'var(--severity-high)', marginLeft: '0.5rem' }}>
                        {b.regressions} reg
                      </span>
                    )}
                  </span>
                  <span style={{ fontSize: '0.72rem' }}>{timeAgo(b.lastSeen)}</span>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      {bugs.length < total && (
        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <button className="btn btn-outline" onClick={handleLoadMore} disabled={loading}>
            {loading ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import * as bugsApi from '../api/bugs.js';

const TRANSITIONS = {
  open: ['in_progress', 'wontfix'],
  in_progress: ['open', 'fixed'],
  fixed: ['open'],
  wontfix: ['open'],
};

const LABELS = {
  open: 'Reopen',
  in_progress: 'Start Progress',
  fixed: 'Mark Fixed',
  wontfix: "Won't Fix",
};

export default function StatusActions({ bug, onUpdated }) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState('');

  const allowed = TRANSITIONS[bug.status] || [];

  async function handleTransition(toStatus) {
    setError('');
    setLoading(toStatus);
    try {
      const updated = await bugsApi.transitionStatus(bug._id, toStatus, bug.__v);
      if (onUpdated) onUpdated(updated);
    } catch (err) {
      setError(err.error || 'Transition failed');
    } finally {
      setLoading('');
    }
  }

  return (
    <div>
      <div className="status-actions">
        {allowed.map((status) => (
          <button
            key={status}
            className={`btn btn-sm btn-status-${status}`}
            onClick={() => handleTransition(status)}
            disabled={!!loading}
          >
            {loading === status ? '…' : LABELS[status] || status}
          </button>
        ))}
      </div>
      {error && <div className="error-msg">{error}</div>}
    </div>
  );
}

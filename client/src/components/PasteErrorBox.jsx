import React, { useState } from 'react';
import * as ingestApi from '../api/ingest.js';

export default function PasteErrorBox({ projectId, onIngested }) {
  const [message, setMessage] = useState('');
  const [stack, setStack] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!message.trim() || !stack.trim()) {
      setError('Both message and stack trace are required');
      return;
    }

    setError('');
    setResult(null);
    setLoading(true);
    try {
      const bug = await ingestApi.ingestError(projectId, message, stack);
      setResult(bug);
      setMessage('');
      setStack('');
      if (onIngested) onIngested(bug);
    } catch (err) {
      setError(err.error || 'Ingest failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <details className="paste-box card">
      <summary>Paste an Error</summary>
      <form onSubmit={handleSubmit} style={{ marginTop: '0.75rem' }}>
        <div className="form-group">
          <label htmlFor="paste-message">Error Message</label>
          <textarea
            id="paste-message"
            className="textarea"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={2000}
            rows={2}
            placeholder="TypeError: Cannot read properties of undefined (reading 'map')"
          />
        </div>
        <div className="form-group">
          <label htmlFor="paste-stack">Stack Trace</label>
          <textarea
            id="paste-stack"
            className="textarea"
            value={stack}
            onChange={(e) => setStack(e.target.value)}
            maxLength={50000}
            rows={5}
            placeholder="    at Object.render (src/components/List.jsx:42:13)&#10;    at ..."
          />
        </div>

        {error && <div className="error-msg">{error}</div>}
        {result && (
          <div className="success-msg">
            Ingested — status: <strong>{result.status}</strong>, occurrences:{' '}
            <strong>{result.occurrenceCount}</strong>
          </div>
        )}

        <button className="btn btn-primary" disabled={loading}>
          {loading ? 'Ingesting…' : 'Ingest Error'}
        </button>
      </form>
    </details>
  );
}

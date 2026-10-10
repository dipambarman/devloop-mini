import React from 'react';

export default function BugTimeline({ events }) {
  if (!events || events.length === 0) {
    return <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No events yet.</p>;
  }

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleString();
  }

  return (
    <div className="timeline">
      {events.map((ev) => (
        <div key={ev._id} className="timeline-item">
          <div className={`timeline-dot ${ev.type}`} />
          <div className="timeline-content">
            {ev.type === 'occurrence' && (
              <span>
                Occurrence <strong>#{ev.occurrenceCount}</strong>
              </span>
            )}
            {ev.type === 'status_changed' && (
              <span>
                Status changed{' '}
                <span className={`badge badge-${ev.from}`} style={{ fontSize: '0.68rem' }}>
                  {ev.from}
                </span>{' '}
                →{' '}
                <span className={`badge badge-${ev.to}`} style={{ fontSize: '0.68rem' }}>
                  {ev.to}
                </span>
              </span>
            )}
          </div>
          <div className="timeline-time">{formatDate(ev.createdAt)}</div>
        </div>
      ))}
    </div>
  );
}

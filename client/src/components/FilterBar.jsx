import React from 'react';

export default function FilterBar({ filters, onChange }) {
  function set(key, value) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="filter-bar">
      <select
        className="select"
        value={filters.status || ''}
        onChange={(e) => set('status', e.target.value)}
      >
        <option value="">All statuses</option>
        <option value="open">Open</option>
        <option value="in_progress">In Progress</option>
        <option value="fixed">Fixed</option>
        <option value="wontfix">Won&apos;t Fix</option>
      </select>

      <select
        className="select"
        value={filters.severity || ''}
        onChange={(e) => set('severity', e.target.value)}
      >
        <option value="">All severities</option>
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
        <option value="critical">Critical</option>
      </select>

      <input
        className="input"
        type="text"
        placeholder="Search bugs…"
        value={filters.search || ''}
        onChange={(e) => set('search', e.target.value)}
      />
    </div>
  );
}

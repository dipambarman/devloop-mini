async function request(url, options = {}) {
  const res = await fetch(url, { credentials: 'include', ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw data;
  return data;
}

export function ingestError(projectId, message, stack) {
  return request(`/api/projects/${projectId}/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, stack }),
  });
}

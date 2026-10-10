async function request(url, options = {}) {
  const res = await fetch(url, { credentials: 'include', ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw data;
  return data;
}

export function listBugs(projectId, params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') qs.set(k, v);
  });
  return request(`/api/projects/${projectId}/bugs?${qs}`);
}

export function getBug(bugId) {
  return request(`/api/bugs/${bugId}`);
}

export function patchBug(bugId, data) {
  return request(`/api/bugs/${bugId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function transitionStatus(bugId, status, version) {
  return request(`/api/bugs/${bugId}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, version }),
  });
}

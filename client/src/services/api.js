const BASE = '/api';

export async function generateRequests({ endpoint, idx, allEndpoints, userStory, baseUrl }) {
  const res = await fetch(`${BASE}/generate/requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint, idx, allEndpoints, userStory, baseUrl }),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Erreur serveur');
  const data = await res.json();
  return data.results;
}

export async function generateCollection({ endpoints, userStory, baseUrl, collectionName }) {
  const res = await fetch(`${BASE}/generate/collection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoints, userStory, baseUrl, collectionName }),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Erreur serveur');
  return await res.json();
}

export async function generateGherkin({ spec, endpointPath, method, bodyNominal, code, label, scenario, values, assertions }) {
  const res = await fetch('/api/generate/gherkin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ spec, endpointPath, method, bodyNominal, code, label, scenario, values, assertions }),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Erreur serveur');
  const data = await res.json();
  return data.gherkin;
}

export async function suggestValues({ endpoint, code, scenario }) {
  const res = await fetch('/api/generate/suggest-values', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint, code, scenario }),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Erreur serveur');
  const data = await res.json();
  return data.suggestion;
}

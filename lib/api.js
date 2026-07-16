const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  getSkills: () => request('/skills'),
  createBusiness: (data) => request('/businesses', { method: 'POST', body: JSON.stringify(data) }),
  createAgent: (data) => request('/agents', { method: 'POST', body: JSON.stringify(data) }),
  updateAgent: (id, data) => request(`/agents/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  getAgent: (id) => request(`/agents/${id}`),
  setAgentSkills: (id, skills) => request(`/agents/${id}/skills`, { method: 'PUT', body: JSON.stringify({ skills }) }),
  setGuardrails: (id, data) => request(`/agents/${id}/guardrails`, { method: 'PUT', body: JSON.stringify(data) }),
  deployAgent: (id) => request(`/agents/${id}/deploy`, { method: 'POST' }),
  getOnboarding: (id) => request(`/agents/${id}/onboarding`),
  getManifest: (id) => request(`/agents/${id}/manifest`),
  generateManifest: (id) => request(`/agents/${id}/manifest`, { method: 'POST' }),
  getOrders: (id) => request(`/agents/${id}/orders`),
  fulfillOrder: (orderId, agentId) => request(`/orders/${orderId}/fulfill`, { method: 'POST', body: JSON.stringify({ agentId }) }),
  simulateOrder: (data) => request('/webhook/message', { method: 'POST', body: JSON.stringify(data) }),
  getServices: (agentId) => request(`/agents/${agentId}/services`),
  createService: (agentId, data) => request(`/agents/${agentId}/services`, { method: 'POST', body: JSON.stringify(data) }),
  publishService: (serviceId) => request(`/services/${serviceId}/publish`, { method: 'POST' }),
};

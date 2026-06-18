// Thin wrapper around fetch for talking to the backend through the gateway.
// Authentication was removed, so there is no token/Authorization header anymore;
// the customer is identified by a customerId query parameter where needed.
// The versioned API prefix lives here in one place: callers pass resource paths
// like '/products' and we prepend '/api/v1' so a future bump touches only this line.
const API_BASE = '/api/v1'

export async function apiCall<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { message?: string }).message ?? `HTTP ${res.status}`)
  }
  return data as T
}

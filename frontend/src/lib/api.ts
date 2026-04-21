const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000/api";

export interface Recommendation {
  p_id: string;
  name: string;
  brand: string;
  similarity_score: number;
  image_base64?: string;
}

export async function getRecommendations(
  productId: string,
  top: number = 5
): Promise<Recommendation[]> {
  const res = await fetch(`${API_BASE}/recommendations/${productId}?top=${top}`);
  if (!res.ok) throw new Error("Failed to fetch recommendations");
  return res.json();
}

interface ApiOptions {
  method?: string;
  body?: unknown;
  token?: string | null;
}

export async function apiFetch<T = unknown>(
  endpoint: string,
  { method = "GET", body, token }: ApiOptions = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }

  return data as T;
}

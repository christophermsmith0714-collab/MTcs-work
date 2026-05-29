import { QueryClient } from "@tanstack/react-query";

// Store session token in memory (not localStorage — blocked in iframe)
let sessionToken: string | null = null;

export function setSessionToken(token: string | null) {
  sessionToken = token;
}
export function getSessionToken() {
  return sessionToken;
}

export async function apiRequest(method: string, url: string, body?: any) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (sessionToken) headers["x-session-token"] = sessionToken;

  const baseUrl = (window as any).__PORT_5000__ ?? "";
  const res = await fetch(`${baseUrl}${url}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return res;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        const url = queryKey[0] as string;
        const res = await apiRequest("GET", url);
        if (!res.ok) {
          if (res.status === 401) throw new Error("UNAUTHORIZED");
          throw new Error(`Request failed: ${res.status}`);
        }
        return res.json();
      },
      retry: false,
      staleTime: 30_000,
    },
  },
});

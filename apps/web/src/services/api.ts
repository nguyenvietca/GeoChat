export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

export async function getHealth() {
  const response = await fetch(`${apiBaseUrl}/api/health`);
  return response.json();
}

export const apiBaseUrl = 'http://localhost:8080';

export async function getHealth() {
  const response = await fetch(`${apiBaseUrl}/api/health`);
  return response.json();
}

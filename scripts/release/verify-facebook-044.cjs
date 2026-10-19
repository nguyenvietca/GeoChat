// Run after compose.facebook-044.yml is healthy. Uses only disposable test data.
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const compose = ['compose', '-p', 'geochat-v044-tests', '-f', 'scripts/release/compose.facebook-044.yml'];
function docker(args, input) {
  const run = spawnSync('docker', [...compose, ...args], { input, encoding: 'utf8', timeout: 30000 });
  if (run.status !== 0) throw new Error(`Docker verification command failed: ${run.stderr}`);
  return run.stdout;
}
function request(path, { method = 'GET', origin, cookie, body, token } = {}) {
  const args = ['exec', '-T', 'backend', 'curl', '--silent', '--show-error', '--include', '--max-time', '20', '-X', method];
  if (origin) args.push('-H', `Origin: ${origin}`);
  if (cookie) args.push('-H', `Cookie: ${cookie}`);
  if (token) args.push('-H', `Authorization: Bearer ${token}`);
  if (body) args.push('-H', 'Content-Type: application/json', '--data-binary', '@-');
  args.push(`http://web:8080${path}`);
  const raw = docker(args, body ? JSON.stringify(body) : undefined);
  const boundary = raw.indexOf('\r\n\r\n');
  const headers = raw.slice(0, boundary).split('\r\n');
  const status = Number(headers[0].split(' ')[1]);
  const header = name => headers.find(row => row.toLowerCase().startsWith(name.toLowerCase() + ':'))?.slice(name.length + 1).trim();
  return { status, header, body: raw.slice(boundary + 4) };
}
function passed(label) { console.log(`PASS ${label}`); }
docker(['exec', '-T', 'web', 'nginx', '-t']); passed('Nginx configuration');
for (const provider of ['google', 'facebook']) {
  const config = request(`/api/v1/auth/${provider}/config`);
  assert.equal(config.status, 200); assert.equal(JSON.parse(config.body).data.enabled, true);
  passed(`${provider} optional configuration through Nginx`);
  const blocked = request(`/api/v1/auth/${provider}/link`, { method: 'POST', origin: 'http://localhost', body: {} });
  assert.equal(blocked.status, 401); passed(`${provider} linking requires JWT`);
  const wrongOrigin = request(`/api/v1/auth/${provider}/start`, { method: 'POST', origin: 'https://untrusted.invalid' });
  assert.equal(wrongOrigin.status, 403); passed(`${provider} Origin protection`);
  const start = request(`/api/v1/auth/${provider}/start`, { method: 'POST', origin: 'http://localhost' });
  assert.equal(start.status, 200);
  const cookie = start.header('Set-Cookie'); assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Lax/);
  const authorization = request(JSON.parse(start.body).data.url, { cookie: cookie.split(';')[0] });
  assert.equal(authorization.status, 302);
  const location = new URL(authorization.header('Location'));
  assert.equal(location.hostname, provider === 'facebook' ? 'www.facebook.com' : 'accounts.google.com');
  assert.equal(location.searchParams.has('client_secret'), false);
  assert.equal(location.searchParams.has('code_challenge'), provider === 'google');
  if (provider === 'facebook') assert.deepEqual(location.searchParams.get('scope').split(' ').sort(), ['email', 'public_profile']);
  passed(`${provider} authorization redirect and provider-specific parameters`);
  const callback = request(`/api/login/oauth2/code/${provider}?state=${encodeURIComponent(location.searchParams.get('state'))}&error=access_denied`, { cookie: cookie.split(';')[0] });
  assert.equal(callback.status, 302); assert.match(callback.header('Location'), /\/oauth\/complete\?error=cancelled$/);
  passed(`${provider} cancellation callback routing`);
}
const marker = 'SYNTHETIC_CALLBACK_MARKER_044';
const invalid = request(`/api/login/oauth2/code/facebook?state=invalid&code=${marker}`);
assert.equal(invalid.status, 302);
assert.equal(invalid.header('Location'), 'http://localhost/oauth/complete?error=failed');
assert.match(invalid.header('Referrer-Policy'), /no-referrer/);
const logs = docker(['logs', '--no-color', 'web', 'backend']);
assert.equal(logs.includes(marker), false); passed('Invalid Facebook state rejected; callback code absent from logs and redirect');
assert.equal(request('/oauth/complete').status, 200); passed('SPA completion route');
const username = `verify044_${Date.now()}`;
const registration = request('/api/v1/auth/register', { method: 'POST', body: { username, password: 'Disposable044!Password', displayName: 'Disposable verification' } });
assert.equal(registration.status, 200);
const login = request('/api/v1/auth/login', { method: 'POST', body: { username, password: 'Disposable044!Password' } });
assert.equal(login.status, 200);
const token = JSON.parse(login.body).data.token;
const profile = request('/api/v1/users/me', { token }); assert.equal(profile.status, 200);
assert.equal(JSON.parse(profile.body).data.username, username);
passed('Password registration/login and existing JWT profile through Nginx');
console.log('HTTP smoke completed. Real provider consent and visual browser checks were not performed.');

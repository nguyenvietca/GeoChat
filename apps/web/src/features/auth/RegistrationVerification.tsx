import { useEffect, useRef, useState } from 'react';
import { registrationConfig } from '../../api/auth';

type Turnstile = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
};
declare global { interface Window { turnstile?: Turnstile } }
let scriptLoad: Promise<Turnstile> | undefined;

function loadWidget() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!scriptLoad) {
    scriptLoad = new Promise<Turnstile>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      const timeout = window.setTimeout(() => fail(), 15_000);
      const fail = () => { window.clearTimeout(timeout); script.remove(); scriptLoad = undefined; reject(new Error('Verification unavailable')); };
      script.onload = () => { window.clearTimeout(timeout); if (window.turnstile) resolve(window.turnstile); else fail(); };
      script.onerror = fail;
      document.head.appendChild(script);
    });
  }
  return scriptLoad;
}

export type RegistrationProof = { pending: boolean; enabled: boolean; token: string };
export function RegistrationVerification({ onChange, resetKey }: {
  onChange: (proof: RegistrationProof) => void; resetKey: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    let widget: string | undefined;
    let api: Turnstile | undefined;
    setError('');
    setLoading(true);
    onChange({ pending: true, enabled: false, token: '' });
    void registrationConfig().then(async config => {
      if (!active) return;
      if (!config.enabled) { setLoading(false); onChange({ pending: false, enabled: false, token: '' }); return; }
      onChange({ pending: false, enabled: true, token: '' });
      if (!config.siteKey) throw new Error('Missing verification configuration');
      api = await loadWidget();
      if (!active || !container.current) return;
      widget = api.render(container.current, {
        sitekey: config.siteKey, action: 'register', theme: 'auto', size: container.current.clientWidth < 300 ? 'compact' : 'flexible',
        callback: (token: string) => { if (active) { setError(''); onChange({ pending: false, enabled: true, token }); } },
        'expired-callback': () => { if (active) onChange({ pending: false, enabled: true, token: '' }); },
        'error-callback': () => { if (active) { onChange({ pending: false, enabled: true, token: '' }); setError('Verification could not load. Please retry.'); } },
      });
      setLoading(false);
    }).catch(() => { if (active) { setLoading(false); setError('Registration verification is unavailable. Please retry.'); } });
    return () => { active = false; if (widget !== undefined) api?.remove(widget); };
  }, [onChange, resetKey, retry]);
  return <div className="registration-verification">
    {loading ? <p role="status">Loading registration verification…</p> : null}
    <div ref={container} />
    {error ? <><p role="alert">{error}</p><button type="button" className="quiet-light-button" onClick={() => setRetry(value => value + 1)}>Retry verification</button></> : null}
  </div>;
}

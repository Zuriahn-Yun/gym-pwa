import { insforge } from '../insforge.js';

export async function render(container, params = {}) {
  container.innerHTML = `
    <div style="min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;">
      <div style="width:100%;max-width:360px;">
        <button class="btn btn-secondary btn-full" id="google-signin-btn" style="gap:12px;font-size:16px;padding:14px 20px;border-radius:12px;margin-bottom:12px;">
          <svg width="20" height="20" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" fill="#FFC107"/>
            <path d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" fill="#FF3D00"/>
            <path d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" fill="#4CAF50"/>
            <path d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" fill="#1976D2"/>
          </svg>
          Continue with Google
        </button>

        <button class="btn btn-primary btn-full" id="strava-signin-btn" style="gap:12px;font-size:16px;padding:14px 20px;border-radius:12px;background:#fc4c02;border:none;">
          <div style="width:20px; height:20px; background:white; border-radius:4px; display:flex; align-items:center; justify-content:center; color:#fc4c02; font-weight:bold; font-size:12px;">S</div>
          Continue with Strava
        </button>
        <div id="auth-error" style="${params.error ? 'display:block' : 'display:none'};margin-top:16px;padding:12px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:8px;color:#ef4444;font-size:13px;text-align:center;">
          ${params.error ? (params.error.message || 'Authentication failed. Please try again.') : ''}
        </div>
        ${params.hasCode ? '<div style="margin-top:8px;font-size:10px;color:var(--text-muted);text-align:center;">OAuth code detected, exchanging...</div>' : ''}
      </div>
    </div>`;

  container.querySelector('#google-signin-btn').addEventListener('click', async () => {
    const btn = container.querySelector('#google-signin-btn');
    const errEl = container.querySelector('#auth-error');
    btn.disabled = true;
    btn.textContent = 'Signing in...';
    errEl.style.display = 'none';
    try {
      const { error } = await insforge.auth.signInWithOAuth({ 
        provider: 'google',
        redirectTo: window.location.origin
      });
      if (error) throw error;
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" fill="#FFC107"/><path d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" fill="#FF3D00"/><path d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" fill="#4CAF50"/><path d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" fill="#1976D2"/></svg> Continue with Google`;
      errEl.textContent = err.message || 'Sign in failed. Please try again.';
      errEl.style.display = 'block';
    }
  });

  container.querySelector('#strava-signin-btn').addEventListener('click', () => {
    const clientId = '146440';
    const redirectUri = 'https://ifu5d87t.insforge.site/';
    window.location.href = `https://www.strava.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=read,activity:read_all&state=strava_login`;
  });
}

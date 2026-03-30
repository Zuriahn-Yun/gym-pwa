import * as api from '../api.js';

export async function render(container, params) {
  const userId = params?.userId ?? null;
  container.innerHTML = '<div class="loading">Loading profile...</div>';

  try {
    const profile = await api.getProfile(userId);
    
    container.innerHTML = `
      <div class="page">
        <h1 class="page-title">Profile</h1>
        
        <div class="card" style="display:flex; align-items:center; gap:16px;">
          <img src="${profile?.avatar_url || 'https://via.placeholder.com/64'}" 
               style="width:64px; height:64px; border-radius:50%; background:var(--surface2);" />
          <div>
            <div style="font-size:18px; font-weight:700;">${profile?.full_name || 'User'}</div>
            <div style="font-size:13px; color:var(--text-muted);">${profile?.email || ''}</div>
          </div>
        </div>

        <div style="font-size:15px; font-weight:600; color:var(--text-muted); margin:24px 0 12px;">Integrations</div>
        
        <div class="card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <div style="display:flex; align-items:center; gap:10px;">
              <div style="width:32px; height:32px; background:#fc4c02; border-radius:6px; display:flex; align-items:center; justify-content:center; color:white; font-weight:bold; font-size:12px;">S</div>
              <div style="font-weight:600;">Strava</div>
            </div>
            ${profile?.strava_access_token 
              ? '<span class="tag" style="color:var(--success); background:rgba(34,197,94,0.1);">Connected</span>' 
              : '<span class="tag">Not Connected</span>'}
          </div>
          <p style="font-size:13px; color:var(--text-muted); margin-bottom:16px;">
            Sync your running and swimming activities directly from Strava.
          </p>
          ${profile?.strava_access_token 
            ? '<button class="btn btn-secondary btn-full" id="disconnect-strava">Disconnect</button>' 
            : '<button class="btn btn-primary btn-full" id="connect-strava">Connect to Strava</button>'}
        </div>

        <div style="margin-top:40px;">
          <button class="btn btn-danger btn-full" onclick="window.__logout()">Sign Out</button>
        </div>
      </div>
    `;

    const connectBtn = container.querySelector('#connect-strava');
    if (connectBtn) {
      connectBtn.onclick = () => {
        const clientId = '146440'; // Replace with actual Client ID
        const redirectUri = window.location.origin + '/#profile';
        window.location.href = `https://www.strava.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=read,activity:read_all`;
      };
    }

    // Handle OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const stravaCode = urlParams.get('code');
    const isProfilePage = window.location.hash.includes('profile');

    if (stravaCode && isProfilePage) {
      container.innerHTML = '<div class="loading">Connecting to Strava...</div>';
      try {
        const res = await insforge.functions.invoke('strava-token-exchange', {
          body: { code: stravaCode, userId }
        });
        
        if (res.error) throw res.error;

        // Clean up URL
        const url = new URL(window.location.href);
        url.searchParams.delete('code');
        url.searchParams.delete('scope');
        window.history.replaceState({}, '', url.pathname + url.hash);

        // Re-render
        render(container, params);
      } catch (err) {
        alert('Strava connection failed: ' + err.message);
        render(container, params);
      }
    }

    const disconnectBtn = container.querySelector('#disconnect-strava');
    if (disconnectBtn) {
      disconnectBtn.onclick = async () => {
        if (!confirm('Disconnect Strava?')) return;
        try {
          await api.disconnectStrava(userId);
          render(container, params);
        } catch (err) {
          alert('Failed to disconnect: ' + err.message);
        }
      };
    }

  } catch (err) {
    container.innerHTML = `<div class="page"><div class="empty"><div class="empty-text">Error: ${err.message}</div></div></div>`;
  }
}

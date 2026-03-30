import * as api from '../api.js';
import { insforge } from '../insforge.js';

export async function render(container, params) {
  const userId = params?.userId ?? null;
  container.innerHTML = '<div class="loading">Loading settings...</div>';

  try {
    const profile = await api.getProfile(userId);
    
    container.innerHTML = `
      <div class="page">
        <h1 class="page-title">Settings</h1>
        
        <div class="card" style="display:flex; align-items:center; gap:16px; margin-bottom:24px;">
          <img src="${profile?.avatar_url || 'https://via.placeholder.com/64'}" 
               style="width:52px; height:62px; border-radius:12px; background:var(--surface2); object-fit:cover;" />
          <div>
            <div style="font-size:17px; font-weight:700;">${profile?.full_name || 'User'}</div>
            <div style="font-size:13px; color:var(--text-muted);">${profile?.email || ''}</div>
          </div>
        </div>

        <div style="font-size:14px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:12px; padding-left:4px;">
          Integrations
        </div>
        
        <div class="card" style="margin-bottom:24px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <div style="display:flex; align-items:center; gap:12px;">
              <div style="width:36px; height:36px; background:#fc4c02; border-radius:8px; display:flex; align-items:center; justify-content:center; color:white; font-weight:bold; font-size:14px;">S</div>
              <div>
                <div style="font-weight:600;">Strava</div>
                <div style="font-size:12px; color:var(--text-muted);">Sync activities</div>
              </div>
            </div>
            ${profile?.strava_access_token 
              ? '<span class="tag" style="color:var(--success); background:rgba(34,197,94,0.1); border:1px solid rgba(34,197,94,0.2);">Connected</span>' 
              : '<span class="tag">Disconnected</span>'}
          </div>
          
          ${profile?.strava_access_token 
            ? `
              <div style="display:flex; gap:8px; margin-bottom:8px;">
                <button class="btn btn-primary btn-full" id="sync-strava" style="background:#fc4c02; border:none;">Sync Activities Now</button>
              </div>
              <button class="btn btn-secondary btn-full" id="disconnect-strava">Disconnect Strava</button>
            ` 
            : `<button class="btn btn-primary btn-full" id="connect-strava" style="background:#fc4c02; border:none;">Connect to Strava</button>`}
        </div>

        <div style="font-size:14px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:12px; padding-left:4px;">
          Account
        </div>

        <div class="card">
          <button class="btn btn-danger btn-full" id="logout-btn-settings" style="justify-content:flex-start; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.2); color:var(--danger);">
            <span style="flex:1; text-align:left;">Sign Out</span>
            <span style="font-size:18px;">›</span>
          </button>
        </div>

        <div style="text-align:center; margin-top:32px; font-size:12px; color:var(--text-muted);">
          Gym PWA v1.0.0
        </div>
      </div>
    `;

    // Sign Out logic
    container.querySelector('#logout-btn-settings').onclick = () => {
      if (confirm('Are you sure you want to sign out?')) {
        window.__logout();
      }
    };

    // Strava Sync logic
    const syncBtn = container.querySelector('#sync-strava');
    if (syncBtn) {
      syncBtn.onclick = async () => {
        syncBtn.disabled = true;
        syncBtn.textContent = 'Syncing...';
        try {
          const res = await insforge.functions.invoke('strava-sync');
          if (res.error) throw new Error(res.error);
          alert('Sync complete! Check your history for new activities.');
          syncBtn.textContent = 'Sync Activities Now';
          syncBtn.disabled = false;
        } catch (err) {
          alert('Sync failed: ' + err.message);
          syncBtn.textContent = 'Sync Activities Now';
          syncBtn.disabled = false;
        }
      };
    }

    const connectBtn = container.querySelector('#connect-strava');
    if (connectBtn) {
      connectBtn.onclick = () => {
        const clientId = '146440'; 
        const redirectUri = 'https://ifu5d87t.insforge.site';
        window.location.href = `https://www.strava.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=read,activity:read_all&state=strava_settings`;
      };
    }

    // Strava Disconnect logic
    const disconnectBtn = container.querySelector('#disconnect-strava');
    if (disconnectBtn) {
      disconnectBtn.onclick = async () => {
        if (!confirm('Disconnect your Strava account? This will stop activity syncing.')) return;
        try {
          await api.disconnectStrava(userId);
          render(container, params);
        } catch (err) {
          alert('Failed to disconnect: ' + err.message);
        }
      };
    }

    // Handle OAuth callback (if redirected back with code)
    const urlParams = new URLSearchParams(window.location.search);
    const stravaCode = urlParams.get('code');
    const stravaState = urlParams.get('state');

    if (stravaCode && stravaState === 'strava_settings') {
      container.innerHTML = '<div class="loading">Finalizing Strava connection...</div>';
      try {
        const res = await insforge.functions.invoke('strava-token-exchange', {
          body: { code: stravaCode, userId }
        });
        
        if (res.error) throw res.error;

        // Clean up URL parameters
        const url = new URL(window.location.href);
        url.search = ''; 
        window.history.replaceState({}, '', url.pathname + url.hash);

        // Success! Re-render page
        render(container, params);
      } catch (err) {
        alert('Strava connection failed: ' + err.message);
        const url = new URL(window.location.href);
        url.search = '';
        window.history.replaceState({}, '', url.pathname + url.hash);
        render(container, params);
      }
    }

  } catch (err) {
    container.innerHTML = `<div class="page"><div class="empty"><div class="empty-text">Error loading settings</div><div class="empty-sub">${err.message}</div></div></div>`;
  }
}

import { createClient, TokenManager } from '/js/vendor/insforge-sdk-bundle.mjs';

/**
 * Custom TokenManager that persists session to localStorage
 */
class LocalTokenManager extends TokenManager {
  constructor() {
    super();
    this.storageKey = 'insforge_session';
    this.loadFromStorage();
  }

  saveSession(session) {
    super.saveSession(session);
    if (session) {
      localStorage.setItem(this.storageKey, JSON.stringify(session));
    } else {
      localStorage.removeItem(this.storageKey);
    }
  }

  clearSession() {
    super.clearSession();
    localStorage.removeItem(this.storageKey);
  }

  loadFromStorage() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const session = JSON.parse(stored);
        this.accessToken = session.accessToken;
        this.user = session.user;
      }
    } catch (e) {
      console.warn('Failed to load session from storage:', e);
    }
  }
}

const customTokenManager = new LocalTokenManager();

// Create client with default internal manager
export const insforge = createClient({
  baseUrl: 'https://ifu5d87t.us-west.insforge.app',
  anonKey: 'ik_1a53b3d9989f708e4ee782d35f97d71a',
  debug: true
});

// Deep override to ensure all services use the same persisting manager
insforge.tokenManager = customTokenManager;
insforge.auth.tokenManager = customTokenManager;
insforge.http.tokenManager = customTokenManager;

// Also ensure the auth service's internal http reference uses it
if (insforge.auth.http) {
  insforge.auth.http.tokenManager = customTokenManager;
}


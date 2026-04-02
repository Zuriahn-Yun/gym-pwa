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

// Initialize the client
const client = createClient({
  baseUrl: 'https://ifu5d87t.us-west.insforge.app',
  functionsUrl: 'https://ifu5d87t.functions.insforge.app',
  anonKey: 'ik_1a53b3d9989f708e4ee782d35f97d71a',
  debug: true
});

// Deep override to ensure all services use the same persisting manager
client.tokenManager = customTokenManager;
client.auth.tokenManager = customTokenManager;
client.http.tokenManager = customTokenManager;

if (client.auth.http) {
  client.auth.http.tokenManager = customTokenManager;
}

// Immediately ensure database is aliased if needed
if (!client.database) {
  client.database = client.from ? client : null;
}

// Export the stable reference
export const insforge = client;

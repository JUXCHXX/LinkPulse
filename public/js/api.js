// public/js/api.js
class API {
  constructor(authManager) {
    this.auth = authManager;
    this.baseUrl = '/api';
  }

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.auth.token) {
      headers.Authorization = `Bearer ${this.auth.token}`;
    }

    try {
      const res = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
      });

      if (!res.ok) {
        if (res.status === 401) {
          this.auth.logout();
          location.hash = '#/login';
        }
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || `Error ${res.status}`);
      }

      return await res.json();
    } catch (err) {
      console.error(`API Error [${endpoint}]:`, err);
      throw err;
    }
  }

  // ── Sites ────────────────────────────────────
  getSites() {
    return this.request('/sites');
  }

  getSite(siteId) {
    return this.request(`/sites/${siteId}`);
  }

  addSite(name, url, visibility) {
    return this.request('/sites', {
      method: 'POST',
      body: JSON.stringify({ name, url, visibility }),
    });
  }

  deleteSite(siteId) {
    return this.request(`/sites/${siteId}`, { method: 'DELETE' });
  }

  updateSiteVisibility(siteId, visibility) {
    return this.request(`/sites/${siteId}`, {
      method: 'PUT',
      body: JSON.stringify({ visibility }),
    });
  }

  // ── Checks ────────────────────────────────────
  getLatency(siteId, limit = 50) {
    return this.request(`/latency/${siteId}?limit=${limit}`);
  }

  getChecks(limit = 100) {
    return this.request(`/checks?limit=${limit}`);
  }

  // ── Public ────────────────────────────────────
  getGlobalSites(limit = 10) {
    return fetch(`${this.baseUrl}/public/global?limit=${limit}`).then((r) => r.json());
  }
}

const api = new API(auth);

/**
 * AIOS Firebase Realtime Database Helper
 * Uses REST API - no SDK needed
 */
AIOS.firebase = {
  _config: null,
  _listeners: {},

  async init() {
    this._config = await AIOS.storage.getFirebaseConfig();
    return !!this._config && !!this._config.databaseURL;
  },

  isConfigured() {
    return !!this._config && !!this._config.databaseURL;
  },

  _buildUrl(path) {
    const base = this._config.databaseURL.replace(/\/$/, '');
    return `${base}/${path}.json`;
  },

  async read(path) {
    if (!this.isConfigured()) throw new Error('Firebase not configured');
    const res = await fetch(this._buildUrl(path));
    if (!res.ok) throw new Error(`Firebase read error: ${res.status}`);
    return res.json();
  },

  async write(path, data) {
    if (!this.isConfigured()) throw new Error('Firebase not configured');
    const res = await fetch(this._buildUrl(path), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(`Firebase write error: ${res.status}`);
    return res.json();
  },

  async update(path, data) {
    if (!this.isConfigured()) throw new Error('Firebase not configured');
    const res = await fetch(this._buildUrl(path), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(`Firebase update error: ${res.status}`);
    return res.json();
  },

  async push(path, data) {
    if (!this.isConfigured()) throw new Error('Firebase not configured');
    const res = await fetch(this._buildUrl(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(`Firebase push error: ${res.status}`);
    return res.json();
  },

  async remove(path) {
    if (!this.isConfigured()) throw new Error('Firebase not configured');
    const res = await fetch(this._buildUrl(path), { method: 'DELETE' });
    if (!res.ok) throw new Error(`Firebase remove error: ${res.status}`);
    return res.json();
  },

  listen(path, callback) {
    if (!this.isConfigured()) return null;

    // Close existing listener for this path
    if (this._listeners[path]) {
      this._listeners[path].close();
    }

    const url = this._buildUrl(path);
    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        callback(parsed);
      } catch (e) {
        console.warn('[AIOS] Firebase SSE parse error:', e);
      }
    };

    eventSource.onerror = (e) => {
      console.warn('[AIOS] Firebase SSE error, reconnecting...');
    };

    this._listeners[path] = eventSource;
    return eventSource;
  },

  stopListening(path) {
    if (this._listeners[path]) {
      this._listeners[path].close();
      delete this._listeners[path];
    }
  },

  stopAll() {
    Object.keys(this._listeners).forEach(path => this.stopListening(path));
  },

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  },

  getShareableLink(sessionId) {
    const configB64 = btoa(JSON.stringify({
      databaseURL: this._config.databaseURL
    }));
    return `https://davidcastelnuovo.github.io/calander/?session=${sessionId}&fb=${encodeURIComponent(configB64)}`;
  }
};

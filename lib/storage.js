/**
 * Chrome Storage Helper
 */
AIOS.storage = {
  _isContextValid() {
    try {
      return !!chrome.runtime && !!chrome.runtime.id;
    } catch (e) {
      return false;
    }
  },

  async get(key, defaultValue = null) {
    if (!this._isContextValid()) return defaultValue;
    try {
      return new Promise((resolve) => {
        chrome.storage.local.get(key, (result) => {
          if (chrome.runtime.lastError) {
            console.warn('[AIOS] Storage get error:', chrome.runtime.lastError.message);
            resolve(defaultValue);
            return;
          }
          resolve(result[key] !== undefined ? result[key] : defaultValue);
        });
      });
    } catch (e) {
      console.warn('[AIOS] Extension context invalidated (get)');
      return defaultValue;
    }
  },

  async set(key, value) {
    if (!this._isContextValid()) return;
    try {
      return new Promise((resolve) => {
        chrome.storage.local.set({ [key]: value }, () => {
          if (chrome.runtime.lastError) {
            console.warn('[AIOS] Storage set error:', chrome.runtime.lastError.message);
          }
          resolve();
        });
      });
    } catch (e) {
      console.warn('[AIOS] Extension context invalidated (set)');
    }
  },

  async remove(key) {
    if (!this._isContextValid()) return;
    try {
      return new Promise((resolve) => {
        chrome.storage.local.remove(key, () => {
          if (chrome.runtime.lastError) {
            console.warn('[AIOS] Storage remove error:', chrome.runtime.lastError.message);
          }
          resolve();
        });
      });
    } catch (e) {
      console.warn('[AIOS] Extension context invalidated (remove)');
    }
  },

  async getAll(keys) {
    if (!this._isContextValid()) return {};
    try {
      return new Promise((resolve) => {
        chrome.storage.local.get(keys, (result) => {
          if (chrome.runtime.lastError) {
            console.warn('[AIOS] Storage getAll error:', chrome.runtime.lastError.message);
            resolve({});
            return;
          }
          resolve(result);
        });
      });
    } catch (e) {
      console.warn('[AIOS] Extension context invalidated (getAll)');
      return {};
    }
  },

  // Specific storage helpers
  async getApiKey() {
    return this.get('claude_api_key', '');
  },

  async setApiKey(key) {
    return this.set('claude_api_key', key);
  },

  async getAutomationRules() {
    return this.get('automation_rules', []);
  },

  async setAutomationRules(rules) {
    return this.set('automation_rules', rules);
  },

  async getScheduledMessages() {
    return this.get('scheduled_messages', []);
  },

  async setScheduledMessages(messages) {
    return this.set('scheduled_messages', messages);
  },

  async getTasks() {
    return this.get('tasks', []);
  },

  async setTasks(tasks) {
    return this.set('tasks', tasks);
  },

  async getSettings() {
    return this.get('aios_settings', {
      autoReply: false,
      spamFilter: false,
      chatCategories: true,
      theme: 'dark'
    });
  },

  async setSettings(settings) {
    return this.set('aios_settings', settings);
  },

  async getFirebaseConfig() {
    return this.get('firebase_config', null);
  },

  async setFirebaseConfig(config) {
    return this.set('firebase_config', config);
  },

  async getSchedulerSessions() {
    return this.get('scheduler_sessions', []);
  },

  async setSchedulerSessions(sessions) {
    return this.set('scheduler_sessions', sessions);
  }
};

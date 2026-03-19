/**
 * Chrome Storage Helper
 */
AIOS.storage = {
  async get(key, defaultValue = null) {
    return new Promise((resolve) => {
      chrome.storage.local.get(key, (result) => {
        resolve(result[key] !== undefined ? result[key] : defaultValue);
      });
    });
  },

  async set(key, value) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, resolve);
    });
  },

  async remove(key) {
    return new Promise((resolve) => {
      chrome.storage.local.remove(key, resolve);
    });
  },

  async getAll(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, resolve);
    });
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
  }
};

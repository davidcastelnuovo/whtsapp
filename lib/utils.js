/**
 * AIOS Utilities
 */
const AIOS = window.AIOS || {};
window.AIOS = AIOS;

AIOS.utils = {
  /**
   * Wait for a DOM element to appear
   */
  waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);

      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) {
          observer.disconnect();
          resolve(el);
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Timeout waiting for ${selector}`));
      }, timeout);
    });
  },

  /**
   * Debounce function calls
   */
  debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  },

  /**
   * Generate unique ID
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  },

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * Format timestamp to readable Hebrew date
   */
  formatTime(date) {
    const d = new Date(date);
    return d.toLocaleString('he-IL', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit'
    });
  },

  /**
   * Truncate text with ellipsis
   */
  truncate(text, maxLength = 100) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  },

  /**
   * Simple event emitter
   */
  createEventEmitter() {
    const listeners = {};
    return {
      on(event, fn) {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(fn);
      },
      off(event, fn) {
        if (!listeners[event]) return;
        listeners[event] = listeners[event].filter(f => f !== fn);
      },
      emit(event, ...args) {
        if (!listeners[event]) return;
        listeners[event].forEach(fn => fn(...args));
      }
    };
  }
};

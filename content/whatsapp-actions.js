/**
 * WhatsApp Actions
 * Programmatically interact with WhatsApp Web
 */
AIOS.actions = {
  /**
   * Send a message in the current active chat
   */
  async sendMessage(text) {
    const inputEl = document.querySelector('[data-testid="conversation-compose-box-input"]')
      || document.querySelector('footer [contenteditable="true"]');

    if (!inputEl) {
      throw new Error('לא נמצא שדה הקלט. ודא ששיחה פתוחה.');
    }

    // Focus and set text
    inputEl.focus();

    // Use execCommand for compatibility with React-controlled inputs
    document.execCommand('insertText', false, text);

    // Dispatch input event
    inputEl.dispatchEvent(new InputEvent('input', { bubbles: true }));

    // Wait a moment then click send
    await new Promise(resolve => setTimeout(resolve, 300));

    const sendBtn = document.querySelector('[data-testid="send"]')
      || document.querySelector('button[aria-label="שלח"]')
      || document.querySelector('span[data-icon="send"]');

    if (sendBtn) {
      sendBtn.click();
      return true;
    }

    // Fallback: simulate Enter key
    inputEl.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true
    }));

    return true;
  },

  /**
   * Open a chat by contact name
   */
  async openChat(name) {
    // Click search
    const searchBtn = document.querySelector('[data-testid="chat-list-search"]')
      || document.querySelector('[data-testid="search"]')
      || document.querySelector('[contenteditable="true"][data-tab="3"]');

    if (!searchBtn) {
      throw new Error('לא נמצא כפתור חיפוש');
    }

    searchBtn.click();
    await new Promise(resolve => setTimeout(resolve, 500));

    // Type in search box
    const searchInput = document.querySelector('[data-testid="search-input"]')
      || document.querySelector('div[contenteditable="true"][data-tab="3"]');

    if (!searchInput) {
      throw new Error('לא נמצא שדה חיפוש');
    }

    searchInput.focus();
    searchInput.textContent = '';
    document.execCommand('insertText', false, name);
    searchInput.dispatchEvent(new InputEvent('input', { bubbles: true }));

    // Wait for results
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Click first result
    const results = document.querySelectorAll('[data-testid="cell-frame-container"]');
    for (const result of results) {
      const titleEl = result.querySelector('span[title]');
      if (titleEl && titleEl.getAttribute('title').includes(name)) {
        result.click();
        await new Promise(resolve => setTimeout(resolve, 500));
        return true;
      }
    }

    throw new Error(`לא נמצא צ'אט עם "${name}"`);
  },

  /**
   * Scroll up to load more messages
   */
  async scrollToLoadMore() {
    const panel = document.querySelector('[data-testid="conversation-panel-messages"]')
      || document.querySelector('[role="application"]');

    if (!panel) return false;

    panel.scrollTop = 0;
    await new Promise(resolve => setTimeout(resolve, 1500));
    return true;
  }
};

/**
 * WhatsApp DOM Reader
 * Extracts data from WhatsApp Web's DOM
 */
AIOS.reader = {
  _initialized: false,

  init() {
    this._initialized = true;
    console.log('[AIOS] WhatsApp Reader initialized');
  },

  /**
   * Get all visible chats from the chat list
   */
  getChats() {
    const chatList = document.querySelector('[data-testid="chat-list"]');
    if (!chatList) return [];

    const chatElements = chatList.querySelectorAll('[data-testid="cell-frame-container"]');
    const chats = [];

    chatElements.forEach(el => {
      try {
        const nameEl = el.querySelector('[data-testid="cell-frame-title"] span[title]');
        const lastMsgEl = el.querySelector('[data-testid="last-msg-status"]')
          || el.querySelector('span[title][class*="matched-text"]')
          || el.querySelector('span.matched-text')
          || el.querySelector('[data-testid="cell-frame-secondary"] span span');
        const unreadEl = el.querySelector('[data-testid="icon-unread-count"]')
          || el.querySelector('span[data-testid="icon-unread-count"]');
        const timeEl = el.querySelector('[data-testid="cell-frame-primary-detail"]');

        const name = nameEl ? nameEl.getAttribute('title') || nameEl.textContent : '';
        const lastMsg = lastMsgEl ? lastMsgEl.textContent.trim() : '';
        const unread = unreadEl ? parseInt(unreadEl.textContent) || 0 : 0;
        const time = timeEl ? timeEl.textContent.trim() : '';

        if (name) {
          chats.push({ name, lastMsg, unread, time, element: el });
        }
      } catch (e) {
        // Skip malformed chat elements
      }
    });

    return chats;
  },

  /**
   * Get messages from the active conversation
   */
  getMessages() {
    const messageContainer = document.querySelector('[data-testid="conversation-panel-messages"]')
      || document.querySelector('[role="application"]');
    if (!messageContainer) return [];

    const msgElements = messageContainer.querySelectorAll('[data-testid="msg-container"]');
    const messages = [];

    msgElements.forEach(el => {
      try {
        const isIncoming = el.querySelector('.message-in') !== null;
        const textEl = el.querySelector('.selectable-text span');
        const metaEl = el.querySelector('[data-pre-plain-text]');

        let sender = 'אני';
        let timestamp = '';

        if (metaEl) {
          const meta = metaEl.getAttribute('data-pre-plain-text');
          // Format: "[HH:MM, DD/MM/YYYY] Name: "
          const match = meta.match(/\[(.+?)\]\s*(.+?):\s*/);
          if (match) {
            timestamp = match[1];
            sender = match[2];
          }
        }

        const text = textEl ? textEl.textContent.trim() : '';

        if (text) {
          messages.push({
            id: AIOS.utils.generateId(),
            text,
            sender: isIncoming ? sender : 'אני',
            timestamp,
            isIncoming,
            element: el
          });
        }
      } catch (e) {
        // Skip malformed messages
      }
    });

    return messages;
  },

  /**
   * Get current active chat contact info
   */
  getContactInfo() {
    const header = document.querySelector('[data-testid="conversation-info-header"]')
      || document.querySelector('header [data-testid="conversation-contact"]')
      || document.querySelector('#main header');

    if (!header) return null;

    const nameEl = header.querySelector('span[title]')
      || header.querySelector('[data-testid="conversation-info-header-chat-title"]');
    const statusEl = header.querySelector('span[title*="מקוון"]')
      || header.querySelector('[data-testid="conversation-subtitle"]');

    return {
      name: nameEl ? nameEl.getAttribute('title') || nameEl.textContent : 'לא ידוע',
      status: statusEl ? statusEl.textContent.trim() : '',
      isOnline: statusEl ? statusEl.textContent.includes('מקוון') : false
    };
  },

  /**
   * Get the number of unread chats
   */
  getUnreadCount() {
    const badges = document.querySelectorAll('[data-testid="icon-unread-count"]');
    let total = 0;
    badges.forEach(el => {
      total += parseInt(el.textContent) || 0;
    });
    return total;
  }
};

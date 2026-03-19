/**
 * WhatsApp DOM Reader
 * Extracts data from WhatsApp Web's DOM
 * Uses multiple fallback selectors since WhatsApp frequently changes their DOM
 */
AIOS.reader = {
  _initialized: false,
  _selectorCache: {},

  init() {
    this._initialized = true;
    console.log('[AIOS] WhatsApp Reader initialized');

    // Run debug on init to log available selectors
    setTimeout(() => this.debugSelectors(), 2000);
  },

  /**
   * Debug utility - logs all data-testid and role attributes in #main
   * Call from DevTools: AIOS.reader.debugSelectors()
   */
  debugSelectors() {
    console.group('[AIOS] DOM Selector Debug');

    const main = document.querySelector('#main');
    if (!main) {
      console.warn('[AIOS] #main not found - no conversation open');
      console.groupEnd();
      return;
    }

    console.log('[AIOS] #main found, children:', main.children.length);

    // Log all data-testid elements
    const testIdEls = main.querySelectorAll('[data-testid]');
    console.log(`[AIOS] data-testid elements in #main (${testIdEls.length}):`);
    const testIds = new Set();
    testIdEls.forEach(el => {
      const id = el.getAttribute('data-testid');
      if (!testIds.has(id)) {
        testIds.add(id);
        console.log(`  - ${el.tagName} data-testid="${id}" (children: ${el.children.length})`);
      }
    });

    // Log all role elements
    const roleEls = main.querySelectorAll('[role]');
    console.log(`[AIOS] role elements in #main (${roleEls.length}):`);
    const roles = new Set();
    roleEls.forEach(el => {
      const role = el.getAttribute('role');
      if (!roles.has(role)) {
        roles.add(role);
        console.log(`  - ${el.tagName} role="${role}"`);
      }
    });

    // Check specific selectors
    const selectors = [
      '[data-testid="conversation-panel-messages"]',
      '[data-testid="msg-container"]',
      '.message-in',
      '.message-out',
      '.copyable-text',
      '.selectable-text',
      '[data-pre-plain-text]',
      '[role="row"]',
      '[role="listitem"]',
      '[role="application"]',
      '[role="region"]',
      '.focusable-list-item'
    ];

    console.log('[AIOS] Selector check:');
    selectors.forEach(sel => {
      const count = main.querySelectorAll(sel).length;
      console.log(`  ${sel}: ${count} matches`);
    });

    console.groupEnd();
  },

  /**
   * Get all visible chats from the chat list
   */
  getChats() {
    const chatList = document.querySelector('[data-testid="chat-list"]')
      || document.querySelector('#pane-side')
      || document.querySelector('[aria-label="Chat list"]');
    if (!chatList) return [];

    const chatElements = chatList.querySelectorAll('[data-testid="cell-frame-container"]')
      || chatList.querySelectorAll('[data-testid="list-item"]')
      || chatList.querySelectorAll('[role="listitem"]');
    const chats = [];

    chatElements.forEach(el => {
      try {
        const nameEl = el.querySelector('[data-testid="cell-frame-title"] span[title]')
          || el.querySelector('span[title]');
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
   * Find the message container element using multiple strategies
   */
  _findMessageContainer() {
    // Strategy 1: data-testid (most reliable when it exists)
    let container = document.querySelector('[data-testid="conversation-panel-messages"]');
    if (container) {
      console.log('[AIOS] Message container found via data-testid="conversation-panel-messages"');
      return container;
    }

    // Strategy 2: role="application" inside #main
    container = document.querySelector('#main [role="application"]');
    if (container) {
      console.log('[AIOS] Message container found via #main [role="application"]');
      return container;
    }

    // Strategy 3: role="region" inside #main
    container = document.querySelector('#main [role="region"]');
    if (container) {
      console.log('[AIOS] Message container found via #main [role="region"]');
      return container;
    }

    // Strategy 4: Look for the div that contains message-in/message-out classes
    const msgIn = document.querySelector('#main .message-in');
    if (msgIn) {
      // Walk up to find the scrollable container
      let parent = msgIn.parentElement;
      while (parent && parent.id !== 'main') {
        if (parent.scrollHeight > parent.clientHeight || parent.children.length > 3) {
          console.log('[AIOS] Message container found via .message-in parent walk');
          return parent;
        }
        parent = parent.parentElement;
      }
    }

    // Strategy 5: Look for focusable-list-item parent
    const focusable = document.querySelector('#main .focusable-list-item');
    if (focusable) {
      let parent = focusable.parentElement;
      while (parent && parent.id !== 'main') {
        if (parent.children.length > 3) {
          console.log('[AIOS] Message container found via .focusable-list-item parent walk');
          return parent;
        }
        parent = parent.parentElement;
      }
    }

    // Strategy 6: Just use #main as a last resort
    container = document.querySelector('#main');
    if (container) {
      console.log('[AIOS] Message container fallback: using #main directly');
      return container;
    }

    console.warn('[AIOS] Could not find any message container');
    return null;
  },

  /**
   * Find individual message elements using multiple strategies
   */
  _findMessageElements(container) {
    // Strategy 1: data-testid="msg-container"
    let elements = container.querySelectorAll('[data-testid="msg-container"]');
    if (elements.length > 0) {
      console.log(`[AIOS] Found ${elements.length} messages via [data-testid="msg-container"]`);
      return elements;
    }

    // Strategy 2: message-in and message-out classes
    elements = container.querySelectorAll('.message-in, .message-out');
    if (elements.length > 0) {
      console.log(`[AIOS] Found ${elements.length} messages via .message-in/.message-out`);
      return elements;
    }

    // Strategy 3: focusable-list-item (WhatsApp wraps messages in these)
    elements = container.querySelectorAll('.focusable-list-item');
    if (elements.length > 0) {
      console.log(`[AIOS] Found ${elements.length} messages via .focusable-list-item`);
      return elements;
    }

    // Strategy 4: role="row" (some WhatsApp versions use this)
    elements = container.querySelectorAll('[role="row"]');
    if (elements.length > 0) {
      console.log(`[AIOS] Found ${elements.length} messages via [role="row"]`);
      return elements;
    }

    // Strategy 5: role="listitem"
    elements = container.querySelectorAll('[role="listitem"]');
    if (elements.length > 0) {
      console.log(`[AIOS] Found ${elements.length} messages via [role="listitem"]`);
      return elements;
    }

    // Strategy 6: data-id attribute (WhatsApp sometimes uses this on messages)
    elements = container.querySelectorAll('[data-id]');
    if (elements.length > 0) {
      console.log(`[AIOS] Found ${elements.length} messages via [data-id]`);
      return elements;
    }

    console.warn('[AIOS] Could not find any message elements');
    return [];
  },

  /**
   * Extract text from a message element using multiple strategies
   */
  _extractMessageText(el) {
    // Strategy 1: .selectable-text span
    let textEl = el.querySelector('.selectable-text span');
    if (textEl && textEl.textContent.trim()) return textEl.textContent.trim();

    // Strategy 2: .selectable-text directly
    textEl = el.querySelector('.selectable-text');
    if (textEl && textEl.textContent.trim()) return textEl.textContent.trim();

    // Strategy 3: .copyable-text
    textEl = el.querySelector('.copyable-text');
    if (textEl && textEl.textContent.trim()) return textEl.textContent.trim();

    // Strategy 4: data-testid="msg-text"
    textEl = el.querySelector('[data-testid="msg-text"]');
    if (textEl && textEl.textContent.trim()) return textEl.textContent.trim();

    // Strategy 5: span with dir attribute (WhatsApp text messages have dir="ltr" or "rtl")
    textEl = el.querySelector('span[dir]');
    if (textEl && textEl.textContent.trim()) return textEl.textContent.trim();

    // Strategy 6: any span with substantial text
    const spans = el.querySelectorAll('span');
    for (const span of spans) {
      const text = span.textContent.trim();
      if (text.length > 2 && !text.match(/^\d{1,2}:\d{2}$/) && !text.includes('✓')) {
        return text;
      }
    }

    return '';
  },

  /**
   * Extract sender info from a message element
   */
  _extractSender(el, isIncoming) {
    if (!isIncoming) return 'אני';

    // Strategy 1: data-pre-plain-text attribute
    const metaEl = el.querySelector('[data-pre-plain-text]');
    if (metaEl) {
      const meta = metaEl.getAttribute('data-pre-plain-text');
      const match = meta.match(/\[(.+?)\]\s*(.+?):\s*/);
      if (match) {
        return { sender: match[2], timestamp: match[1] };
      }
    }

    // Strategy 2: aria-label on the message
    const ariaLabel = el.getAttribute('aria-label') || el.querySelector('[aria-label]')?.getAttribute('aria-label');
    if (ariaLabel) {
      const match = ariaLabel.match(/(.+?):/);
      if (match) return { sender: match[1], timestamp: '' };
    }

    // Strategy 3: data-testid="author" or similar
    const authorEl = el.querySelector('[data-testid="author"]') || el.querySelector('[data-testid="msg-meta"]');
    if (authorEl) return { sender: authorEl.textContent.trim(), timestamp: '' };

    // Fallback: get contact name from header
    const contact = this.getContactInfo();
    return { sender: contact ? contact.name : 'לא ידוע', timestamp: '' };
  },

  /**
   * Get messages from the active conversation
   */
  getMessages() {
    const messageContainer = this._findMessageContainer();
    if (!messageContainer) return [];

    const msgElements = this._findMessageElements(messageContainer);
    const messages = [];

    msgElements.forEach(el => {
      try {
        // Determine direction
        const isIncoming = el.querySelector('.message-in') !== null
          || el.classList.contains('message-in')
          || el.querySelector('[data-testid="msg-dblcheck"]') === null;

        // Check if outgoing more carefully
        const isOutgoing = el.querySelector('.message-out') !== null
          || el.classList.contains('message-out')
          || el.querySelector('[data-testid="msg-dblcheck"]') !== null;

        const finalIsIncoming = isOutgoing ? false : isIncoming;

        const text = this._extractMessageText(el);
        if (!text) return; // Skip empty messages (media, etc.)

        const senderInfo = this._extractSender(el, finalIsIncoming);
        const sender = typeof senderInfo === 'string' ? senderInfo : senderInfo.sender;
        const timestamp = typeof senderInfo === 'string' ? '' : senderInfo.timestamp;

        messages.push({
          id: AIOS.utils.generateId(),
          text,
          sender: finalIsIncoming ? sender : 'אני',
          timestamp,
          isIncoming: finalIsIncoming,
          element: el
        });
      } catch (e) {
        // Skip malformed messages
        console.warn('[AIOS] Error extracting message:', e);
      }
    });

    console.log(`[AIOS] getMessages() extracted ${messages.length} messages from ${msgElements.length} elements`);
    return messages;
  },

  /**
   * Get current active chat contact info
   */
  getContactInfo() {
    const header = document.querySelector('[data-testid="conversation-info-header"]')
      || document.querySelector('[data-testid="conversation-contact"]')
      || document.querySelector('[data-testid="conversation-header"]')
      || document.querySelector('#main header');

    if (!header) return null;

    const nameEl = header.querySelector('span[title]')
      || header.querySelector('[data-testid="conversation-info-header-chat-title"]')
      || header.querySelector('[data-testid="conversation-title"]')
      || header.querySelector('span[dir]');
    const statusEl = header.querySelector('span[title*="מקוון"]')
      || header.querySelector('[data-testid="conversation-subtitle"]')
      || header.querySelector('._3-cMa')
      || header.querySelector('span[title*="online"]');

    return {
      name: nameEl ? nameEl.getAttribute('title') || nameEl.textContent : 'לא ידוע',
      status: statusEl ? statusEl.textContent.trim() : '',
      isOnline: statusEl ? (statusEl.textContent.includes('מקוון') || statusEl.textContent.includes('online')) : false
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

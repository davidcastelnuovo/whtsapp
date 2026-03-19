/**
 * WhatsApp Message Observer
 * Watches for new messages using MutationObserver
 */
AIOS.observer = {
  _observer: null,
  _seenMessages: new Set(),
  _events: null,
  _processingQueue: [],
  _isProcessing: false,

  init() {
    this._events = AIOS.utils.createEventEmitter();
    this._startObserving();
    console.log('[AIOS] Message observer initialized');
  },

  /**
   * Register a callback for new messages
   */
  onNewMessage(callback) {
    this._events.on('newMessage', callback);
  },

  /**
   * Register a callback for chat switches
   */
  onChatSwitch(callback) {
    this._events.on('chatSwitch', callback);
  },

  _startObserving() {
    // Observe the main app for conversation panel changes
    const appEl = document.getElementById('app');
    if (!appEl) return;

    this._observer = new MutationObserver(
      AIOS.utils.debounce(() => this._checkForChanges(), 500)
    );

    this._observer.observe(appEl, {
      childList: true,
      subtree: true
    });

    // Also observe for chat switches (header changes)
    this._observeHeader();
  },

  _observeHeader() {
    const checkHeader = () => {
      const contact = AIOS.reader.getContactInfo();
      if (contact && contact.name !== this._lastContactName) {
        this._lastContactName = contact.name;
        this._seenMessages.clear();
        this._events.emit('chatSwitch', contact);
      }
    };

    setInterval(checkHeader, 1000);
  },

  _checkForChanges() {
    const messages = AIOS.reader.getMessages();
    const newMessages = [];

    messages.forEach(msg => {
      const msgKey = `${msg.sender}:${msg.text}:${msg.timestamp}`;
      if (!this._seenMessages.has(msgKey)) {
        this._seenMessages.add(msgKey);
        newMessages.push(msg);
      }
    });

    // Only emit truly new messages (after initial load)
    if (this._seenMessages.size > messages.length) {
      newMessages.forEach(msg => {
        this._events.emit('newMessage', msg);
        this._processingQueue.push(msg);
      });
      this._processQueue();
    } else {
      // Initial load - just mark all as seen
      messages.forEach(msg => {
        const msgKey = `${msg.sender}:${msg.text}:${msg.timestamp}`;
        this._seenMessages.add(msgKey);
      });
    }
  },

  async _processQueue() {
    if (this._isProcessing || this._processingQueue.length === 0) return;
    this._isProcessing = true;

    while (this._processingQueue.length > 0) {
      const msg = this._processingQueue.shift();
      await this._processMessage(msg);
    }

    this._isProcessing = false;
  },

  async _processMessage(msg) {
    // Check automation rules
    try {
      const rules = await AIOS.storage.getAutomationRules();
      const settings = await AIOS.storage.getSettings();

      if (!settings.autoReply || !msg.isIncoming) return;

      const activeRules = rules.filter(r => r.enabled);
      for (const rule of activeRules) {
        if (this._matchesRule(msg.text, rule)) {
          if (rule.useAI) {
            const reply = await AIOS.claude.generateAutoReply(
              [msg],
              [rule]
            );
            if (reply && reply !== 'NO_MATCH') {
              await AIOS.actions.sendMessage(reply);
            }
          } else {
            await AIOS.actions.sendMessage(rule.response);
          }
          break;
        }
      }
    } catch (error) {
      console.error('[AIOS] Error processing message:', error);
    }
  },

  _matchesRule(text, rule) {
    const lowerText = text.toLowerCase();
    const lowerTrigger = rule.trigger.toLowerCase();

    switch (rule.matchType) {
      case 'exact':
        return lowerText === lowerTrigger;
      case 'contains':
        return lowerText.includes(lowerTrigger);
      case 'regex':
        try {
          return new RegExp(rule.trigger, 'i').test(text);
        } catch {
          return false;
        }
      default:
        return lowerText.includes(lowerTrigger);
    }
  },

  destroy() {
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }
  }
};

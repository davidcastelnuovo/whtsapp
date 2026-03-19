/**
 * AIOS AI Assistant Panel
 * Chat interface with Claude, context-aware to current conversation
 */
AIOS.aiPanel = {
  _messages: [],
  _isLoading: false,

  render() {
    const panel = document.createElement('div');
    panel.className = 'aios-ai-panel-inner';

    panel.innerHTML = `
      <div class="aios-ai-header">
        <div class="aios-ai-title">
          <span class="aios-ai-icon">🤖</span>
          <span>עוזר AI</span>
        </div>
        <div class="aios-ai-context" id="aios-ai-context">
          לא מחובר לשיחה
        </div>
      </div>

      <div class="aios-ai-quick-actions">
        <button class="aios-quick-btn" data-action="summarize">📝 סכם שיחה</button>
        <button class="aios-quick-btn" data-action="suggest">💡 הצע תגובה</button>
        <button class="aios-quick-btn" data-action="sentiment">🎭 סנטימנט</button>
        <button class="aios-quick-btn" data-action="tasks">✅ חלץ משימות</button>
      </div>

      <div class="aios-ai-messages" id="aios-ai-messages">
        <div class="aios-ai-welcome">
          <div class="aios-ai-welcome-icon">🤖</div>
          <h3>שלום! אני העוזר AI שלך</h3>
          <p>אני יכול לסכם שיחות, להציע תגובות, לנתח סנטימנט ועוד. בחר פעולה מהירה או שאל אותי משהו.</p>
        </div>
      </div>

      <div class="aios-ai-input-area">
        <div class="aios-ai-input-wrapper">
          <textarea class="aios-ai-input" id="aios-ai-input" placeholder="שאל את Claude..." rows="1"></textarea>
          <button class="aios-ai-send" id="aios-ai-send">➤</button>
        </div>
      </div>
    `;

    // Setup event listeners after render
    setTimeout(() => this._setupEvents(), 0);

    return panel;
  },

  _setupEvents() {
    // Quick action buttons
    document.querySelectorAll('.aios-quick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.quickAction(btn.dataset.action);
      });
    });

    // Send button
    const sendBtn = document.getElementById('aios-ai-send');
    if (sendBtn) {
      sendBtn.addEventListener('click', () => this._sendMessage());
    }

    // Input - auto resize and Enter to send
    const input = document.getElementById('aios-ai-input');
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this._sendMessage();
        }
      });
      input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
      });
    }

    // Listen for chat switches to update context
    if (AIOS.observer && AIOS.observer._events) {
      AIOS.observer.onChatSwitch((contact) => {
        this._updateContext(contact);
      });
    }
  },

  _updateContext(contact) {
    const contextEl = document.getElementById('aios-ai-context');
    if (contextEl) {
      contextEl.textContent = contact ? `שיחה עם: ${contact.name}` : 'לא מחובר לשיחה';
      contextEl.classList.toggle('active', !!contact);
    }
  },

  async quickAction(action) {
    const messages = AIOS.reader.getMessages();
    if (messages.length === 0) {
      this._addMessage('system', 'פתח שיחה כדי שאוכל לנתח אותה.');
      return;
    }

    const contact = AIOS.reader.getContactInfo();
    const chatName = contact ? contact.name : 'לא ידוע';

    switch (action) {
      case 'summarize':
        this._addMessage('user', `סכם את השיחה עם ${chatName}`);
        await this._callAI(() => AIOS.claude.summarize(messages));
        break;
      case 'suggest':
        this._addMessage('user', `הצע תגובה לשיחה עם ${chatName}`);
        await this._callAI(() => AIOS.claude.suggestReply(messages));
        break;
      case 'sentiment':
        this._addMessage('user', `נתח סנטימנט בשיחה עם ${chatName}`);
        await this._callAI(() => AIOS.claude.analyzeSentiment(messages));
        break;
      case 'tasks':
        this._addMessage('user', `חלץ משימות מהשיחה עם ${chatName}`);
        await this._callAI(() => AIOS.claude.extractTasks(messages));
        break;
    }
  },

  async _sendMessage() {
    const input = document.getElementById('aios-ai-input');
    if (!input) return;

    const text = input.value.trim();
    if (!text || this._isLoading) return;

    input.value = '';
    input.style.height = 'auto';

    this._addMessage('user', text);

    // Build context from current conversation
    const messages = AIOS.reader.getMessages();
    const context = messages.length > 0
      ? messages.map(m => `${m.sender}: ${m.text}`).join('\n')
      : '';

    await this._callAI(() => AIOS.claude.ask(text, context));
  },

  async _callAI(fn) {
    this._isLoading = true;
    this._addMessage('loading', '');

    try {
      const result = await fn();
      this._removeLoading();
      this._addMessage('ai', result);
    } catch (error) {
      this._removeLoading();
      this._addMessage('error', `שגיאה: ${error.message}`);
    }

    this._isLoading = false;
  },

  _addMessage(type, text) {
    const container = document.getElementById('aios-ai-messages');
    if (!container) return;

    // Remove welcome message on first interaction
    const welcome = container.querySelector('.aios-ai-welcome');
    if (welcome) welcome.remove();

    const msg = document.createElement('div');
    msg.className = `aios-ai-msg aios-ai-msg-${type}`;

    if (type === 'loading') {
      msg.innerHTML = `
        <div class="aios-ai-msg-content">
          <div class="aios-typing-indicator">
            <span></span><span></span><span></span>
          </div>
        </div>
      `;
    } else if (type === 'user') {
      msg.innerHTML = `<div class="aios-ai-msg-content">${AIOS.utils.escapeHtml(text)}</div>`;
    } else if (type === 'ai') {
      msg.innerHTML = `
        <div class="aios-ai-msg-avatar">🤖</div>
        <div class="aios-ai-msg-content">${this._formatAIResponse(text)}</div>
      `;
    } else if (type === 'error') {
      msg.innerHTML = `<div class="aios-ai-msg-content aios-error">${AIOS.utils.escapeHtml(text)}</div>`;
    } else if (type === 'system') {
      msg.innerHTML = `<div class="aios-ai-msg-content aios-system">${AIOS.utils.escapeHtml(text)}</div>`;
    }

    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;

    this._messages.push({ type, text, time: Date.now() });
  },

  _removeLoading() {
    const loading = document.querySelector('.aios-ai-msg-loading');
    if (loading) loading.remove();
  },

  _formatAIResponse(text) {
    // Basic markdown-like formatting
    let html = AIOS.utils.escapeHtml(text);
    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Line breaks
    html = html.replace(/\n/g, '<br>');
    // Numbered lists
    html = html.replace(/^(\d+)\.\s/gm, '<span class="aios-list-num">$1.</span> ');
    return html;
  },

  focus() {
    const input = document.getElementById('aios-ai-input');
    if (input) input.focus();
  }
};

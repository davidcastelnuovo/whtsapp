/**
 * AIOS Dashboard - Full Takeover Layout
 * Wraps WhatsApp Web with the AIOS interface
 */
AIOS.dashboard = {
  init() {
    this._createLayout();
    this._setupKeyboardShortcuts();
    console.log('[AIOS] Dashboard initialized');
  },

  _createLayout() {
    const app = document.getElementById('app') || document.querySelector('[id="app"]');
    if (!app) {
      console.error('[AIOS] Could not find WhatsApp #app element');
      return;
    }

    // Prevent double initialization
    if (document.getElementById('aios-root')) {
      console.warn('[AIOS] Dashboard already initialized');
      return;
    }

    // === NEW APPROACH: Don't move #app. Instead, shrink it via CSS ===
    // === and overlay AIOS panels around it. ===

    // Mark body so CSS can apply layout adjustments
    document.body.classList.add('aios-active');

    // Shrink WhatsApp's #app to make room for sidebar (right), topbar (top), AI panel (left)
    app.classList.add('aios-whatsapp-adjusted');

    // Create AIOS overlay root (does NOT contain #app)
    const root = document.createElement('div');
    root.id = 'aios-root';

    // Create sidebar
    const sidebar = AIOS.sidebar.render();
    root.appendChild(sidebar);

    // Create topbar
    const topbar = document.createElement('div');
    topbar.id = 'aios-topbar';
    root.appendChild(topbar);

    // Create AI panel
    const aiPanel = document.createElement('div');
    aiPanel.id = 'aios-ai-panel';
    if (AIOS.aiPanel) {
      aiPanel.appendChild(AIOS.aiPanel.render());
    }
    root.appendChild(aiPanel);

    // Main content area (for non-chat views like automation, analytics, etc.)
    const mainContent = document.createElement('div');
    mainContent.id = 'aios-main-content';
    mainContent.style.display = 'none';
    root.appendChild(mainContent);

    // Insert into page
    document.body.appendChild(root);

    // Command palette
    this._createCommandPalette(root);

    // Fill topbar content
    this._fillTopBar(topbar);

    console.log('[AIOS] Layout created (overlay approach, #app not moved)');
  },

  _fillTopBar(topBar) {
    topBar.innerHTML = `
      <div class="aios-topbar-right">
        <div class="aios-quick-stat">
          <span class="aios-stat-label">הודעות שלא נקראו</span>
          <span class="aios-stat-value" id="aios-unread-count">0</span>
        </div>
        <div class="aios-quick-stat">
          <span class="aios-stat-label">אוטומציות פעילות</span>
          <span class="aios-stat-value" id="aios-auto-count">0</span>
        </div>
        <div class="aios-quick-stat">
          <span class="aios-stat-label">משימות פתוחות</span>
          <span class="aios-stat-value" id="aios-tasks-count">0</span>
        </div>
      </div>
      <div class="aios-topbar-left">
        <button class="aios-cmd-trigger" id="aios-cmd-trigger" title="Ctrl+K">
          <span>⌘</span> פקודה מהירה
        </button>
      </div>
    `;

    // Update stats periodically
    this._updateStats();
    setInterval(() => this._updateStats(), 5000);

    // Command palette trigger
    document.getElementById('aios-cmd-trigger').addEventListener('click', () => {
      this._toggleCommandPalette();
    });
  },

  async _updateStats() {
    try {
      const unreadEl = document.getElementById('aios-unread-count');
      const autoEl = document.getElementById('aios-auto-count');
      const tasksEl = document.getElementById('aios-tasks-count');

      if (unreadEl && AIOS.reader) {
        unreadEl.textContent = AIOS.reader.getUnreadCount();
      }

      if (autoEl) {
        const rules = await AIOS.storage.getAutomationRules();
        autoEl.textContent = rules.filter(r => r.enabled).length;
      }

      if (tasksEl) {
        const tasks = await AIOS.storage.getTasks();
        tasksEl.textContent = tasks.filter(t => t.status !== 'done').length;
      }
    } catch (e) {
      console.warn('[AIOS] Error updating stats:', e.message);
    }
  },

  _createCommandPalette(parent) {
    const palette = document.createElement('div');
    palette.id = 'aios-command-palette';
    palette.className = 'aios-hidden';
    palette.innerHTML = `
      <div class="aios-cmd-overlay"></div>
      <div class="aios-cmd-dialog">
        <input type="text" class="aios-cmd-input" placeholder="הקלד פקודה..." id="aios-cmd-input">
        <div class="aios-cmd-results" id="aios-cmd-results"></div>
      </div>
    `;
    parent.appendChild(palette);

    // Close on overlay click
    palette.querySelector('.aios-cmd-overlay').addEventListener('click', () => {
      this._toggleCommandPalette(false);
    });

    // Handle input
    const input = document.getElementById('aios-cmd-input');
    input.addEventListener('input', () => this._filterCommands(input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this._toggleCommandPalette(false);
      if (e.key === 'Enter') this._executeSelectedCommand();
    });
  },

  _commands: [
    { id: 'summarize', label: 'סכם שיחה', icon: '📝', action: () => AIOS.aiPanel && AIOS.aiPanel.quickAction('summarize') },
    { id: 'suggest', label: 'הצע תגובה', icon: '💡', action: () => AIOS.aiPanel && AIOS.aiPanel.quickAction('suggest') },
    { id: 'sentiment', label: 'נתח סנטימנט', icon: '🎭', action: () => AIOS.aiPanel && AIOS.aiPanel.quickAction('sentiment') },
    { id: 'tasks', label: 'חלץ משימות', icon: '✅', action: () => AIOS.aiPanel && AIOS.aiPanel.quickAction('tasks') },
    { id: 'auto', label: 'אוטומציות', icon: '⚡', action: () => AIOS.sidebar.switchView('automation') },
    { id: 'analytics', label: 'ניתוחים', icon: '📊', action: () => AIOS.sidebar.switchView('analytics') },
    { id: 'settings', label: 'הגדרות', icon: '⚙️', action: () => AIOS.sidebar.switchView('settings') },
  ],

  _filterCommands(query) {
    const results = document.getElementById('aios-cmd-results');
    if (!results) return;

    const filtered = query
      ? this._commands.filter(c => c.label.includes(query))
      : this._commands;

    results.innerHTML = filtered.map((cmd, i) => `
      <div class="aios-cmd-item ${i === 0 ? 'selected' : ''}" data-cmd="${cmd.id}">
        <span class="aios-cmd-item-icon">${cmd.icon}</span>
        <span>${cmd.label}</span>
      </div>
    `).join('');

    // Click handlers
    results.querySelectorAll('.aios-cmd-item').forEach(item => {
      item.addEventListener('click', () => {
        const cmd = this._commands.find(c => c.id === item.dataset.cmd);
        if (cmd) {
          cmd.action();
          this._toggleCommandPalette(false);
        }
      });
    });
  },

  _executeSelectedCommand() {
    const selected = document.querySelector('.aios-cmd-item.selected');
    if (selected) selected.click();
  },

  _toggleCommandPalette(show) {
    const palette = document.getElementById('aios-command-palette');
    if (!palette) return;

    if (show === undefined) {
      show = palette.classList.contains('aios-hidden');
    }

    palette.classList.toggle('aios-hidden', !show);

    if (show) {
      const input = document.getElementById('aios-cmd-input');
      input.value = '';
      input.focus();
      this._filterCommands('');
    }
  },

  _setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+K / Cmd+K - Command palette
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        this._toggleCommandPalette();
      }
    });
  }
};

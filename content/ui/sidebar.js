/**
 * AIOS Sidebar Navigation
 */
AIOS.sidebar = {
  _activeView: 'chats',

  views: [
    { id: 'chats', icon: '💬', label: 'צ\'אטים' },
    { id: 'ai', icon: '🤖', label: 'עוזר AI' },
    { id: 'automation', icon: '⚡', label: 'אוטומציות' },
    { id: 'analytics', icon: '📊', label: 'ניתוחים' },
    { id: 'tasks', icon: '✅', label: 'משימות' },
    { id: 'scheduler', icon: '📅', label: 'תזמון' },
    { id: 'settings', icon: '⚙️', label: 'הגדרות' }
  ],

  render() {
    const sidebar = document.createElement('div');
    sidebar.id = 'aios-sidebar';

    // Logo
    const logo = document.createElement('div');
    logo.className = 'aios-sidebar-logo';
    logo.innerHTML = `
      <div class="aios-logo-icon">AI</div>
      <div class="aios-logo-text">AIOS</div>
    `;
    sidebar.appendChild(logo);

    // Navigation
    const nav = document.createElement('nav');
    nav.className = 'aios-sidebar-nav';

    this.views.forEach(view => {
      const btn = document.createElement('button');
      btn.className = `aios-nav-btn ${view.id === this._activeView ? 'active' : ''}`;
      btn.dataset.view = view.id;
      btn.innerHTML = `
        <span class="aios-nav-icon">${view.icon}</span>
        <span class="aios-nav-label">${view.label}</span>
      `;
      btn.addEventListener('click', () => this.switchView(view.id));
      nav.appendChild(btn);
    });

    sidebar.appendChild(nav);

    // Bottom section - status
    const bottom = document.createElement('div');
    bottom.className = 'aios-sidebar-bottom';
    bottom.innerHTML = `
      <div class="aios-status">
        <div class="aios-status-dot"></div>
        <span>מערכת פעילה</span>
      </div>
    `;
    sidebar.appendChild(bottom);

    return sidebar;
  },

  switchView(viewId) {
    this._activeView = viewId;

    // Update nav buttons
    document.querySelectorAll('.aios-nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewId);
    });

    // Elements
    const app = document.getElementById('app');
    const aiPanel = document.getElementById('aios-ai-panel');
    const mainContent = document.getElementById('aios-main-content');

    // Reset
    if (aiPanel) aiPanel.style.display = 'none';
    if (mainContent) mainContent.innerHTML = '';
    if (mainContent) mainContent.style.display = 'none';
    if (app) app.style.display = '';

    switch (viewId) {
      case 'chats':
        if (aiPanel) aiPanel.style.display = 'flex';
        break;
      case 'ai':
        if (aiPanel) aiPanel.style.display = 'flex';
        if (AIOS.aiPanel) AIOS.aiPanel.focus();
        break;
      case 'automation':
        if (app) app.style.display = 'none';
        if (aiPanel) aiPanel.style.display = 'none';
        if (mainContent) {
          mainContent.style.display = 'flex';
          if (AIOS.automationPanel) AIOS.automationPanel.render(mainContent);
        }
        break;
      case 'analytics':
        if (app) app.style.display = 'none';
        if (aiPanel) aiPanel.style.display = 'none';
        if (mainContent) {
          mainContent.style.display = 'flex';
          if (AIOS.analyticsPanel) AIOS.analyticsPanel.render(mainContent);
        }
        break;
      case 'tasks':
        if (app) app.style.display = 'none';
        if (aiPanel) aiPanel.style.display = 'none';
        if (mainContent) {
          mainContent.style.display = 'flex';
          if (AIOS.tasksPanel) AIOS.tasksPanel.render(mainContent);
        }
        break;
      case 'scheduler':
        if (app) app.style.display = 'none';
        if (aiPanel) aiPanel.style.display = 'none';
        if (mainContent) {
          mainContent.style.display = 'flex';
          if (AIOS.schedulerPanel) AIOS.schedulerPanel.render(mainContent);
        }
        break;
      case 'settings':
        if (app) app.style.display = 'none';
        if (aiPanel) aiPanel.style.display = 'none';
        if (mainContent) {
          mainContent.style.display = 'flex';
          if (AIOS.settingsPanel) AIOS.settingsPanel.render(mainContent);
        }
        break;
    }
  }
};

/**
 * AIOS Settings Panel (in-dashboard)
 */
AIOS.settingsPanel = {
  async render(container) {
    const settings = await AIOS.storage.getSettings();
    const apiKey = await AIOS.storage.getApiKey();
    const fbConfig = await AIOS.storage.getFirebaseConfig() || {};

    container.innerHTML = `
      <div class="aios-panel-full">
        <div class="aios-panel-header">
          <h2>⚙️ הגדרות</h2>
        </div>

        <div class="aios-settings-section">
          <h3>חיבור API</h3>
          <div class="aios-form-field">
            <label>מפתח API של Claude</label>
            <div class="aios-input-group">
              <input type="password" id="aios-settings-apikey" value="${apiKey ? AIOS.utils.escapeHtml(apiKey) : ''}" placeholder="sk-ant-..." dir="ltr">
              <button class="aios-btn-secondary" id="aios-toggle-key">👁️</button>
            </div>
          </div>
          <button class="aios-btn-primary" id="aios-save-key">שמור מפתח</button>
          <span class="aios-msg" id="aios-key-msg"></span>
        </div>

        <div class="aios-settings-section">
          <h3>כללי</h3>

          <div class="aios-setting-row">
            <div>
              <div class="aios-setting-label">תגובות אוטומטיות</div>
              <div class="aios-setting-desc">הפעל מענה אוטומטי לפי כללים שהגדרת</div>
            </div>
            <label class="toggle">
              <input type="checkbox" id="aios-set-autoreply" ${settings.autoReply ? 'checked' : ''}>
              <span class="slider"></span>
            </label>
          </div>

          <div class="aios-setting-row">
            <div>
              <div class="aios-setting-label">סינון ספאם</div>
              <div class="aios-setting-desc">זיהוי אוטומטי של הודעות ספאם בעזרת AI</div>
            </div>
            <label class="toggle">
              <input type="checkbox" id="aios-set-spam" ${settings.spamFilter ? 'checked' : ''}>
              <span class="slider"></span>
            </label>
          </div>

          <div class="aios-setting-row">
            <div>
              <div class="aios-setting-label">קטגוריות צ'אט</div>
              <div class="aios-setting-desc">סיווג אוטומטי של שיחות לקטגוריות</div>
            </div>
            <label class="toggle">
              <input type="checkbox" id="aios-set-categories" ${settings.chatCategories ? 'checked' : ''}>
              <span class="slider"></span>
            </label>
          </div>
        </div>

        <div class="aios-settings-section">
          <h3>Firebase (תזמון פגישות)</h3>
          <div class="aios-setting-desc" style="margin-bottom: 12px;">
            נדרש לשימוש במערכת תיאום הפגישות. צור פרויקט חינמי ב-Firebase Console.
          </div>
          <div class="aios-form-field">
            <label>Database URL</label>
            <input type="text" id="aios-fb-dburl" value="${fbConfig.databaseURL ? AIOS.utils.escapeHtml(fbConfig.databaseURL) : ''}" placeholder="https://your-project-default-rtdb.firebaseio.com" dir="ltr">
          </div>
          <button class="aios-btn-primary" id="aios-save-firebase">שמור הגדרות Firebase</button>
          <span class="aios-msg" id="aios-fb-msg"></span>
        </div>

        <div class="aios-settings-section">
          <h3>נתונים</h3>
          <div class="aios-settings-buttons">
            <button class="aios-btn-secondary" id="aios-export-data">📤 ייצא נתונים</button>
            <button class="aios-btn-secondary aios-btn-danger" id="aios-clear-data">🗑️ נקה את כל הנתונים</button>
          </div>
        </div>

        <div class="aios-settings-section">
          <h3>קיצורי מקלדת</h3>
          <div class="aios-shortcuts-list">
            <div class="aios-shortcut-row">
              <span>פתח פקודה מהירה</span>
              <kbd>Ctrl + K</kbd>
            </div>
          </div>
        </div>

        <div class="aios-settings-footer">
          <p>WhatsApp AIOS v1.0.0</p>
          <p class="aios-settings-credit">Powered by Claude AI</p>
        </div>
      </div>
    `;

    this._setupEvents(container);
  },

  _setupEvents(container) {
    // Toggle API key visibility
    const toggleBtn = document.getElementById('aios-toggle-key');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const input = document.getElementById('aios-settings-apikey');
        input.type = input.type === 'password' ? 'text' : 'password';
      });
    }

    // Save API key
    const saveKeyBtn = document.getElementById('aios-save-key');
    if (saveKeyBtn) {
      saveKeyBtn.addEventListener('click', async () => {
        const key = document.getElementById('aios-settings-apikey').value.trim();
        if (!key) return;
        await AIOS.storage.setApiKey(key);
        const msg = document.getElementById('aios-key-msg');
        if (msg) {
          msg.textContent = 'נשמר!';
          msg.style.color = '#00a884';
          setTimeout(() => { msg.textContent = ''; }, 2000);
        }
      });
    }

    // Save Firebase config
    const saveFbBtn = document.getElementById('aios-save-firebase');
    if (saveFbBtn) {
      saveFbBtn.addEventListener('click', async () => {
        const databaseURL = document.getElementById('aios-fb-dburl').value.trim();
        if (!databaseURL) return;
        await AIOS.storage.setFirebaseConfig({ databaseURL });
        if (AIOS.firebase) await AIOS.firebase.init();
        const msg = document.getElementById('aios-fb-msg');
        if (msg) {
          msg.textContent = 'נשמר!';
          msg.style.color = '#00a884';
          setTimeout(() => { msg.textContent = ''; }, 2000);
        }
      });
    }

    // Save settings on toggle change
    const toggles = ['aios-set-autoreply', 'aios-set-spam', 'aios-set-categories'];
    toggles.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', async () => {
          await AIOS.storage.setSettings({
            autoReply: document.getElementById('aios-set-autoreply').checked,
            spamFilter: document.getElementById('aios-set-spam').checked,
            chatCategories: document.getElementById('aios-set-categories').checked,
            theme: 'dark'
          });
        });
      }
    });

    // Export data
    const exportBtn = document.getElementById('aios-export-data');
    if (exportBtn) {
      exportBtn.addEventListener('click', async () => {
        const data = await AIOS.storage.getAll([
          'automation_rules', 'scheduled_messages', 'tasks', 'aios_settings'
        ]);
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `aios-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      });
    }

    // Clear data
    const clearBtn = document.getElementById('aios-clear-data');
    if (clearBtn) {
      clearBtn.addEventListener('click', async () => {
        if (confirm('האם אתה בטוח שברצונך למחוק את כל הנתונים?')) {
          await AIOS.storage.remove('automation_rules');
          await AIOS.storage.remove('scheduled_messages');
          await AIOS.storage.remove('tasks');
          this.render(container);
        }
      });
    }
  }
};

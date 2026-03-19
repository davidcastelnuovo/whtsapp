/**
 * AIOS Automation Panel
 * Auto-replies, scheduled messages, chat categorization
 */
AIOS.automationPanel = {
  async render(container) {
    const rules = await AIOS.storage.getAutomationRules();
    const scheduled = await AIOS.storage.getScheduledMessages();

    container.innerHTML = `
      <div class="aios-panel-full">
        <div class="aios-panel-header">
          <h2>⚡ אוטומציות</h2>
        </div>

        <div class="aios-tabs">
          <button class="aios-tab active" data-tab="rules">כללי תגובה</button>
          <button class="aios-tab" data-tab="scheduled">הודעות מתוזמנות</button>
          <button class="aios-tab" data-tab="categories">קטגוריות</button>
        </div>

        <!-- Rules Tab -->
        <div class="aios-tab-content active" id="aios-tab-rules">
          <div class="aios-section-actions">
            <button class="aios-btn-primary" id="aios-add-rule">+ הוסף כלל</button>
          </div>
          <div class="aios-rules-list" id="aios-rules-list">
            ${rules.length === 0 ? '<div class="aios-empty">אין כללים עדיין. הוסף כלל חדש כדי להתחיל.</div>' : ''}
            ${rules.map((rule, i) => this._renderRule(rule, i)).join('')}
          </div>
        </div>

        <!-- Scheduled Tab -->
        <div class="aios-tab-content" id="aios-tab-scheduled">
          <div class="aios-section-actions">
            <button class="aios-btn-primary" id="aios-add-scheduled">+ תזמן הודעה</button>
          </div>
          <div class="aios-scheduled-list" id="aios-scheduled-list">
            ${scheduled.length === 0 ? '<div class="aios-empty">אין הודעות מתוזמנות.</div>' : ''}
            ${scheduled.map((msg, i) => this._renderScheduled(msg, i)).join('')}
          </div>
        </div>

        <!-- Categories Tab -->
        <div class="aios-tab-content" id="aios-tab-categories">
          <div class="aios-section-actions">
            <button class="aios-btn-primary" id="aios-categorize-all">🏷️ סווג את כל הצ'אטים</button>
          </div>
          <div class="aios-categories-list" id="aios-categories-list">
            <div class="aios-empty">לחץ "סווג" כדי לסווג את כל השיחות בעזרת AI.</div>
          </div>
        </div>

        <!-- New Rule Modal -->
        <div class="aios-modal aios-hidden" id="aios-rule-modal">
          <div class="aios-modal-content">
            <h3>כלל תגובה חדש</h3>
            <div class="aios-form-field">
              <label>סוג התאמה</label>
              <select id="aios-rule-match">
                <option value="contains">מכיל</option>
                <option value="exact">מדויק</option>
                <option value="regex">Regex</option>
              </select>
            </div>
            <div class="aios-form-field">
              <label>טריגר (מילת מפתח)</label>
              <input type="text" id="aios-rule-trigger" placeholder="למשל: שלום">
            </div>
            <div class="aios-form-field">
              <label>תגובה</label>
              <textarea id="aios-rule-response" placeholder="למשל: היי! מה קורה?"></textarea>
            </div>
            <div class="aios-form-field">
              <label class="aios-checkbox-label">
                <input type="checkbox" id="aios-rule-ai">
                <span>השתמש ב-AI ליצירת תגובה</span>
              </label>
            </div>
            <div class="aios-modal-actions">
              <button class="aios-btn-secondary" id="aios-rule-cancel">ביטול</button>
              <button class="aios-btn-primary" id="aios-rule-save">שמור</button>
            </div>
          </div>
        </div>

        <!-- Schedule Modal -->
        <div class="aios-modal aios-hidden" id="aios-schedule-modal">
          <div class="aios-modal-content">
            <h3>תזמון הודעה</h3>
            <div class="aios-form-field">
              <label>שם איש קשר / קבוצה</label>
              <input type="text" id="aios-sched-contact" placeholder="שם הצ'אט">
            </div>
            <div class="aios-form-field">
              <label>הודעה</label>
              <textarea id="aios-sched-text" placeholder="תוכן ההודעה"></textarea>
            </div>
            <div class="aios-form-field">
              <label>תאריך ושעה</label>
              <input type="datetime-local" id="aios-sched-time">
            </div>
            <div class="aios-modal-actions">
              <button class="aios-btn-secondary" id="aios-sched-cancel">ביטול</button>
              <button class="aios-btn-primary" id="aios-sched-save">תזמן</button>
            </div>
          </div>
        </div>
      </div>
    `;

    this._setupEvents(container);
  },

  _renderRule(rule, index) {
    return `
      <div class="aios-rule-card" data-index="${index}">
        <div class="aios-rule-header">
          <div class="aios-rule-trigger">
            <span class="aios-badge">${rule.matchType === 'contains' ? 'מכיל' : rule.matchType === 'exact' ? 'מדויק' : 'Regex'}</span>
            "${AIOS.utils.escapeHtml(rule.trigger)}"
          </div>
          <label class="toggle small">
            <input type="checkbox" ${rule.enabled ? 'checked' : ''} data-toggle-rule="${index}">
            <span class="slider"></span>
          </label>
        </div>
        <div class="aios-rule-response">
          ${rule.useAI ? '🤖 תגובת AI' : AIOS.utils.escapeHtml(rule.response)}
        </div>
        <button class="aios-rule-delete" data-delete-rule="${index}">🗑️</button>
      </div>
    `;
  },

  _renderScheduled(msg, index) {
    const sendAt = new Date(msg.sendAt);
    const isPast = sendAt < new Date();
    return `
      <div class="aios-scheduled-card ${msg.status === 'sent' ? 'sent' : ''}" data-index="${index}">
        <div class="aios-scheduled-info">
          <div class="aios-scheduled-contact">📱 ${AIOS.utils.escapeHtml(msg.chatName)}</div>
          <div class="aios-scheduled-text">${AIOS.utils.escapeHtml(msg.text)}</div>
          <div class="aios-scheduled-time">🕐 ${sendAt.toLocaleString('he-IL')}</div>
        </div>
        <div class="aios-scheduled-status">
          ${msg.status === 'sent' ? '✅ נשלח' : isPast ? '⏰ בהמתנה' : '⏳ מתוזמן'}
        </div>
        ${msg.status === 'pending' ? `<button class="aios-rule-delete" data-cancel-scheduled="${msg.id}">🗑️</button>` : ''}
      </div>
    `;
  },

  _setupEvents(container) {
    // Tab switching
    container.querySelectorAll('.aios-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        container.querySelectorAll('.aios-tab').forEach(t => t.classList.remove('active'));
        container.querySelectorAll('.aios-tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        const tabContent = container.querySelector(`#aios-tab-${tab.dataset.tab}`);
        if (tabContent) tabContent.classList.add('active');
      });
    });

    // Add rule
    const addRuleBtn = document.getElementById('aios-add-rule');
    if (addRuleBtn) {
      addRuleBtn.addEventListener('click', () => {
        document.getElementById('aios-rule-modal').classList.remove('aios-hidden');
      });
    }

    // Cancel rule modal
    const cancelRuleBtn = document.getElementById('aios-rule-cancel');
    if (cancelRuleBtn) {
      cancelRuleBtn.addEventListener('click', () => {
        document.getElementById('aios-rule-modal').classList.add('aios-hidden');
      });
    }

    // Save rule
    const saveRuleBtn = document.getElementById('aios-rule-save');
    if (saveRuleBtn) {
      saveRuleBtn.addEventListener('click', async () => {
        const rule = {
          matchType: document.getElementById('aios-rule-match').value,
          trigger: document.getElementById('aios-rule-trigger').value.trim(),
          response: document.getElementById('aios-rule-response').value.trim(),
          useAI: document.getElementById('aios-rule-ai').checked,
          enabled: true
        };

        if (!rule.trigger) return;

        const rules = await AIOS.storage.getAutomationRules();
        rules.push(rule);
        await AIOS.storage.setAutomationRules(rules);

        document.getElementById('aios-rule-modal').classList.add('aios-hidden');
        this.render(container);
      });
    }

    // Toggle rule
    container.querySelectorAll('[data-toggle-rule]').forEach(toggle => {
      toggle.addEventListener('change', async () => {
        const index = parseInt(toggle.dataset.toggleRule);
        const rules = await AIOS.storage.getAutomationRules();
        if (rules[index]) {
          rules[index].enabled = toggle.checked;
          await AIOS.storage.setAutomationRules(rules);
        }
      });
    });

    // Delete rule
    container.querySelectorAll('[data-delete-rule]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const index = parseInt(btn.dataset.deleteRule);
        const rules = await AIOS.storage.getAutomationRules();
        rules.splice(index, 1);
        await AIOS.storage.setAutomationRules(rules);
        this.render(container);
      });
    });

    // Add scheduled
    const addSchedBtn = document.getElementById('aios-add-scheduled');
    if (addSchedBtn) {
      addSchedBtn.addEventListener('click', () => {
        document.getElementById('aios-schedule-modal').classList.remove('aios-hidden');
      });
    }

    // Cancel schedule modal
    const cancelSchedBtn = document.getElementById('aios-sched-cancel');
    if (cancelSchedBtn) {
      cancelSchedBtn.addEventListener('click', () => {
        document.getElementById('aios-schedule-modal').classList.add('aios-hidden');
      });
    }

    // Save scheduled
    const saveSchedBtn = document.getElementById('aios-sched-save');
    if (saveSchedBtn) {
      saveSchedBtn.addEventListener('click', async () => {
        const chatName = document.getElementById('aios-sched-contact').value.trim();
        const text = document.getElementById('aios-sched-text').value.trim();
        const sendAt = document.getElementById('aios-sched-time').value;

        if (!chatName || !text || !sendAt) return;

        await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(
            { type: 'SCHEDULE_MESSAGE', payload: { chatName, text, sendAt } },
            (response) => {
              if (response.error) reject(new Error(response.error));
              else resolve(response.result);
            }
          );
        });

        document.getElementById('aios-schedule-modal').classList.add('aios-hidden');
        this.render(container);
      });
    }

    // Cancel scheduled message
    container.querySelectorAll('[data-cancel-scheduled]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.cancelScheduled;
        await new Promise((resolve) => {
          chrome.runtime.sendMessage(
            { type: 'CANCEL_SCHEDULED', payload: { id } },
            resolve
          );
        });
        this.render(container);
      });
    });

    // Categorize all chats
    const categorizeBtn = document.getElementById('aios-categorize-all');
    if (categorizeBtn) {
      categorizeBtn.addEventListener('click', async () => {
        categorizeBtn.disabled = true;
        categorizeBtn.textContent = '🔄 מסווג...';

        const categoriesList = document.getElementById('aios-categories-list');
        const chats = AIOS.reader.getChats();

        categoriesList.innerHTML = '';

        for (const chat of chats.slice(0, 20)) {
          try {
            const category = await AIOS.claude.categorizeChat(chat.name, [{ sender: chat.name, text: chat.lastMsg }]);
            categoriesList.innerHTML += `
              <div class="aios-category-item">
                <span class="aios-category-name">${AIOS.utils.escapeHtml(chat.name)}</span>
                <span class="aios-badge category-${category.trim()}">${AIOS.utils.escapeHtml(category.trim())}</span>
              </div>
            `;
          } catch (e) {
            categoriesList.innerHTML += `
              <div class="aios-category-item">
                <span class="aios-category-name">${AIOS.utils.escapeHtml(chat.name)}</span>
                <span class="aios-badge">שגיאה</span>
              </div>
            `;
          }
        }

        categorizeBtn.disabled = false;
        categorizeBtn.textContent = '🏷️ סווג את כל הצ\'אטים';
      });
    }
  }
};

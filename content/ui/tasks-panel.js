/**
 * AIOS Tasks Panel
 * Kanban-style task manager with AI task extraction
 */
AIOS.tasksPanel = {
  async render(container) {
    const tasks = await AIOS.storage.getTasks();

    const todo = tasks.filter(t => t.status === 'todo');
    const inProgress = tasks.filter(t => t.status === 'in_progress');
    const done = tasks.filter(t => t.status === 'done');

    container.innerHTML = `
      <div class="aios-panel-full">
        <div class="aios-panel-header">
          <h2>✅ משימות</h2>
          <div class="aios-panel-actions">
            <button class="aios-btn-primary" id="aios-extract-tasks">🤖 חלץ משימות מהשיחה</button>
            <button class="aios-btn-secondary" id="aios-add-task">+ הוסף משימה</button>
          </div>
        </div>

        <div class="aios-kanban">
          <div class="aios-kanban-column" data-status="todo">
            <div class="aios-kanban-header">
              <span>📋 לעשות</span>
              <span class="aios-kanban-count">${todo.length}</span>
            </div>
            <div class="aios-kanban-cards" data-status="todo">
              ${todo.map(t => this._renderTask(t)).join('')}
            </div>
          </div>

          <div class="aios-kanban-column" data-status="in_progress">
            <div class="aios-kanban-header">
              <span>🔄 בתהליך</span>
              <span class="aios-kanban-count">${inProgress.length}</span>
            </div>
            <div class="aios-kanban-cards" data-status="in_progress">
              ${inProgress.map(t => this._renderTask(t)).join('')}
            </div>
          </div>

          <div class="aios-kanban-column" data-status="done">
            <div class="aios-kanban-header">
              <span>✅ הושלם</span>
              <span class="aios-kanban-count">${done.length}</span>
            </div>
            <div class="aios-kanban-cards" data-status="done">
              ${done.map(t => this._renderTask(t)).join('')}
            </div>
          </div>
        </div>

        <!-- Add Task Modal -->
        <div class="aios-modal aios-hidden" id="aios-task-modal">
          <div class="aios-modal-content">
            <h3>משימה חדשה</h3>
            <div class="aios-form-field">
              <label>כותרת</label>
              <input type="text" id="aios-task-title" placeholder="מה צריך לעשות?">
            </div>
            <div class="aios-form-field">
              <label>תיאור (אופציונלי)</label>
              <textarea id="aios-task-desc" placeholder="פרטים נוספים..."></textarea>
            </div>
            <div class="aios-form-field">
              <label>מקור</label>
              <input type="text" id="aios-task-source" placeholder="מאיזה צ'אט?" readonly>
            </div>
            <div class="aios-modal-actions">
              <button class="aios-btn-secondary" id="aios-task-cancel">ביטול</button>
              <button class="aios-btn-primary" id="aios-task-save">הוסף</button>
            </div>
          </div>
        </div>
      </div>
    `;

    this._setupEvents(container);
  },

  _renderTask(task) {
    return `
      <div class="aios-task-card" data-id="${task.id}">
        <div class="aios-task-title">${AIOS.utils.escapeHtml(task.title)}</div>
        ${task.description ? `<div class="aios-task-desc">${AIOS.utils.escapeHtml(task.description)}</div>` : ''}
        <div class="aios-task-meta">
          ${task.source ? `<span class="aios-task-source">📱 ${AIOS.utils.escapeHtml(task.source)}</span>` : ''}
          <span class="aios-task-date">${AIOS.utils.formatTime(task.createdAt)}</span>
        </div>
        <div class="aios-task-actions">
          ${task.status !== 'done' ? `
            <button class="aios-task-move" data-move="${task.status === 'todo' ? 'in_progress' : 'done'}" data-id="${task.id}">
              ${task.status === 'todo' ? '▶ התחל' : '✓ סיים'}
            </button>
          ` : ''}
          <button class="aios-task-delete" data-id="${task.id}">🗑️</button>
        </div>
      </div>
    `;
  },

  _setupEvents(container) {
    // Add task
    const addBtn = document.getElementById('aios-add-task');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        const contact = AIOS.reader.getContactInfo();
        const sourceInput = document.getElementById('aios-task-source');
        if (sourceInput && contact) sourceInput.value = contact.name;
        document.getElementById('aios-task-modal').classList.remove('aios-hidden');
      });
    }

    // Cancel task modal
    const cancelBtn = document.getElementById('aios-task-cancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        document.getElementById('aios-task-modal').classList.add('aios-hidden');
      });
    }

    // Save task
    const saveBtn = document.getElementById('aios-task-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const title = document.getElementById('aios-task-title').value.trim();
        if (!title) return;

        const tasks = await AIOS.storage.getTasks();
        tasks.push({
          id: AIOS.utils.generateId(),
          title,
          description: document.getElementById('aios-task-desc').value.trim(),
          source: document.getElementById('aios-task-source').value.trim(),
          status: 'todo',
          createdAt: Date.now()
        });
        await AIOS.storage.setTasks(tasks);

        document.getElementById('aios-task-modal').classList.add('aios-hidden');
        this.render(container);
      });
    }

    // Extract tasks with AI
    const extractBtn = document.getElementById('aios-extract-tasks');
    if (extractBtn) {
      extractBtn.addEventListener('click', async () => {
        const messages = AIOS.reader.getMessages();
        if (messages.length === 0) return;

        extractBtn.disabled = true;
        extractBtn.textContent = '🔄 מחלץ משימות...';

        try {
          const result = await AIOS.claude.extractTasks(messages);
          const contact = AIOS.reader.getContactInfo();

          // Parse numbered list from AI response
          const taskLines = result.split('\n').filter(line => /^\d+\./.test(line.trim()));
          const tasks = await AIOS.storage.getTasks();

          taskLines.forEach(line => {
            const title = line.replace(/^\d+\.\s*/, '').trim();
            if (title) {
              tasks.push({
                id: AIOS.utils.generateId(),
                title,
                description: '',
                source: contact ? contact.name : '',
                status: 'todo',
                createdAt: Date.now()
              });
            }
          });

          await AIOS.storage.setTasks(tasks);
          this.render(container);
        } catch (e) {
          console.error('[AIOS] Extract tasks error:', e);
        }

        extractBtn.disabled = false;
        extractBtn.textContent = '🤖 חלץ משימות מהשיחה';
      });
    }

    // Move task
    container.querySelectorAll('.aios-task-move').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const newStatus = btn.dataset.move;
        const tasks = await AIOS.storage.getTasks();
        const task = tasks.find(t => t.id === id);
        if (task) {
          task.status = newStatus;
          await AIOS.storage.setTasks(tasks);
          this.render(container);
        }
      });
    });

    // Delete task
    container.querySelectorAll('.aios-task-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        let tasks = await AIOS.storage.getTasks();
        tasks = tasks.filter(t => t.id !== id);
        await AIOS.storage.setTasks(tasks);
        this.render(container);
      });
    });
  }
};

/**
 * AIOS Scheduler Panel
 * Meeting scheduling with multi-participant availability coordination
 */
AIOS.schedulerPanel = {
  _currentView: 'list',
  _currentSessionId: null,
  _listener: null,
  _selectedSlots: {},
  _currentWeekStart: null,

  async render(container) {
    if (this._currentView === 'detail' && this._currentSessionId) {
      return this._renderDetail(container);
    }
    return this._renderList(container);
  },

  async _renderList(container) {
    const sessions = await AIOS.storage.getSchedulerSessions();
    const firebaseReady = AIOS.firebase && AIOS.firebase.isConfigured();

    container.innerHTML = `
      <div class="aios-panel-full">
        <div class="aios-panel-header">
          <h2>📅 תזמון פגישות</h2>
          <div class="aios-panel-actions">
            <button class="aios-btn-primary" id="aios-create-session" ${!firebaseReady ? 'disabled title="הגדר Firebase בהגדרות"' : ''}>+ פגישה חדשה</button>
          </div>
        </div>

        ${!firebaseReady ? `
          <div class="aios-scheduler-notice">
            <p>כדי להשתמש בתזמון פגישות, הגדר את Firebase בהגדרות.</p>
            <button class="aios-btn-secondary" id="aios-goto-settings">עבור להגדרות</button>
          </div>
        ` : ''}

        <div class="aios-scheduler-sessions">
          ${sessions.length === 0 ? `
            <div class="aios-empty">
              <p>אין פגישות מתוזמנות</p>
              <p>צור פגישה חדשה כדי להתחיל</p>
            </div>
          ` : sessions.map(s => this._renderSessionCard(s)).join('')}
        </div>

        <!-- Create Session Modal -->
        <div class="aios-modal aios-hidden" id="aios-session-modal">
          <div class="aios-modal-content aios-modal-wide">
            <h3>פגישה חדשה</h3>
            <div class="aios-form-field">
              <label>כותרת הפגישה</label>
              <input type="text" id="aios-session-title" placeholder="לדוגמה: ישיבת צוות שבועית">
            </div>
            <div class="aios-form-field">
              <label>אימייל מארגן</label>
              <input type="email" id="aios-session-email" placeholder="your@email.com" dir="ltr">
            </div>
            <div class="aios-form-row">
              <div class="aios-form-field">
                <label>מספר משתתפים (לא כולל מארגן)</label>
                <input type="number" id="aios-session-count" min="1" max="20" value="2">
              </div>
              <div class="aios-form-field">
                <label>משך חלון זמן</label>
                <select id="aios-session-duration">
                  <option value="30" selected>30 דקות</option>
                  <option value="60">60 דקות</option>
                </select>
              </div>
            </div>
            <div class="aios-form-field">
              <label>בחרו חלונות זמן פנויים</label>
              <div class="aios-week-nav">
                <button type="button" id="aios-week-next">&#8594;</button>
                <span class="aios-week-label" id="aios-week-label"></span>
                <button type="button" id="aios-week-prev">&#8592;</button>
              </div>
              <div id="aios-week-calendar-container"></div>
              <div class="aios-week-slot-count" id="aios-slot-count">0 חלונות נבחרו</div>
            </div>
            <div class="aios-modal-actions">
              <button class="aios-btn-secondary" id="aios-session-cancel">ביטול</button>
              <button class="aios-btn-primary" id="aios-session-save">צור פגישה</button>
            </div>
          </div>
        </div>
      </div>
    `;

    this._setupListEvents(container);
  },

  _renderSessionCard(session) {
    const statusLabels = {
      active: '🟢 פעילה',
      completed: '✅ נקבעה',
      expired: '⏰ פג תוקף'
    };
    const participantCount = session.participantIds ? session.participantIds.length : 0;
    const total = session.participantCount || 0;

    return `
      <div class="aios-scheduler-card ${session.status}" data-session-id="${session.id}">
        <div class="aios-scheduler-card-header">
          <span class="aios-scheduler-card-title">${AIOS.utils.escapeHtml(session.title)}</span>
          <span class="aios-scheduler-card-status">${statusLabels[session.status] || session.status}</span>
        </div>
        <div class="aios-scheduler-card-info">
          <span>👥 ${participantCount}/${total} משתתפים</span>
          <span>📅 ${session.availableSlots ? Object.keys(session.availableSlots).length + ' חלונות' : session.dateRange.start + ' - ' + session.dateRange.end}</span>
        </div>
        ${session.consensusSlot ? `
          <div class="aios-scheduler-consensus">
            נקבעה: ${session.consensusSlot.date} בשעה ${session.consensusSlot.time}
          </div>
        ` : ''}
        <div class="aios-scheduler-card-actions">
          <button class="aios-btn-secondary aios-copy-link" data-session-id="${session.id}">📋 העתק קישור</button>
          <button class="aios-btn-secondary aios-view-session" data-session-id="${session.id}">👁️ צפה</button>
          <button class="aios-btn-secondary aios-share-wa" data-session-id="${session.id}">📱 שלח בוואטסאפ</button>
          <button class="aios-btn-secondary aios-btn-danger aios-delete-session" data-session-id="${session.id}">🗑️</button>
        </div>
      </div>
    `;
  },

  _setupListEvents(container) {
    // Go to settings
    const gotoSettings = document.getElementById('aios-goto-settings');
    if (gotoSettings) {
      gotoSettings.addEventListener('click', () => {
        if (AIOS.sidebar) AIOS.sidebar.switchView('settings');
      });
    }

    // Create session modal
    const createBtn = document.getElementById('aios-create-session');
    if (createBtn) {
      createBtn.addEventListener('click', () => {
        // Reset state
        this._selectedSlots = {};
        this._isDragging = false;
        this._dragMode = true;

        // Set week start to next Sunday (or today if it's Sunday)
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0=Sunday
        const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
        this._currentWeekStart = new Date(today);
        this._currentWeekStart.setDate(today.getDate() + daysUntilSunday);

        document.getElementById('aios-session-modal').classList.remove('aios-hidden');

        // Render calendar
        this._renderWeekCalendar();

        // Week navigation
        const prevBtn = document.getElementById('aios-week-prev');
        const nextBtn = document.getElementById('aios-week-next');
        if (prevBtn) {
          prevBtn.onclick = () => {
            this._currentWeekStart.setDate(this._currentWeekStart.getDate() - 7);
            this._renderWeekCalendar();
          };
        }
        if (nextBtn) {
          nextBtn.onclick = () => {
            this._currentWeekStart.setDate(this._currentWeekStart.getDate() + 7);
            this._renderWeekCalendar();
          };
        }

        // Duration change re-renders calendar
        const durationSelect = document.getElementById('aios-session-duration');
        if (durationSelect) {
          durationSelect.onchange = () => this._renderWeekCalendar();
        }
      });
    }

    // Cancel modal
    const cancelBtn = document.getElementById('aios-session-cancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        document.getElementById('aios-session-modal').classList.add('aios-hidden');
      });
    }

    // Save session
    const saveBtn = document.getElementById('aios-session-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const title = document.getElementById('aios-session-title').value.trim();
        const email = document.getElementById('aios-session-email').value.trim();
        const count = parseInt(document.getElementById('aios-session-count').value) || 2;
        const selectedSlots = { ...this._selectedSlots };
        const slotKeys = Object.keys(selectedSlots).sort();
        const duration = parseInt(document.getElementById('aios-session-duration').value) || 30;

        if (!title || !email || slotKeys.length === 0) {
          alert('נא למלא כותרת, אימייל ולבחור לפחות חלון זמן אחד');
          return;
        }

        const dates = [...new Set(slotKeys.map(k => k.split('_')[0]))].sort();
        const times = [...new Set(slotKeys.map(k => k.split('_')[1]))].sort();
        const dateStart = dates[0];
        const dateEnd = dates[dates.length - 1];
        const timeStart = times[0];
        const timeEnd = times[times.length - 1];

        saveBtn.disabled = true;
        saveBtn.textContent = 'יוצר...';

        try {
          const sessionId = AIOS.firebase.generateId();
          const now = Date.now();
          const expiresAt = new Date(dateEnd);
          expiresAt.setDate(expiresAt.getDate() + 1);

          const sessionData = {
            title,
            organizerEmail: email,
            participantCount: count,
            availableSlots: selectedSlots,
            dateRange: { start: dateStart, end: dateEnd },
            timeRange: { start: timeStart, end: timeEnd },
            slotDurationMinutes: duration,
            createdAt: now,
            expiresAt: expiresAt.getTime(),
            status: 'active',
            consensusSlot: null,
            participants: {}
          };

          // Write to Firebase
          await AIOS.firebase.write(`sessions/${sessionId}`, sessionData);

          // Save locally
          const sessions = await AIOS.storage.getSchedulerSessions();
          sessions.unshift({
            id: sessionId,
            ...sessionData,
            participantIds: []
          });
          await AIOS.storage.setSchedulerSessions(sessions);

          document.getElementById('aios-session-modal').classList.add('aios-hidden');
          this._renderList(container);
        } catch (e) {
          console.error('[AIOS] Create session error:', e);
          alert('שגיאה ביצירת הפגישה: ' + e.message);
        }

        saveBtn.disabled = false;
        saveBtn.textContent = 'צור פגישה';
      });
    }

    // Copy link
    container.querySelectorAll('.aios-copy-link').forEach(btn => {
      btn.addEventListener('click', async () => {
        const sessionId = btn.dataset.sessionId;
        const link = AIOS.firebase.getShareableLink(sessionId);
        try {
          await navigator.clipboard.writeText(link);
          btn.textContent = '✅ הועתק!';
          setTimeout(() => { btn.textContent = '📋 העתק קישור'; }, 2000);
        } catch (e) {
          prompt('העתק את הקישור:', link);
        }
      });
    });

    // View session detail
    container.querySelectorAll('.aios-view-session').forEach(btn => {
      btn.addEventListener('click', () => {
        this._currentView = 'detail';
        this._currentSessionId = btn.dataset.sessionId;
        this._renderDetail(container);
      });
    });

    // Share via WhatsApp
    container.querySelectorAll('.aios-share-wa').forEach(btn => {
      btn.addEventListener('click', async () => {
        const sessionId = btn.dataset.sessionId;
        const sessions = await AIOS.storage.getSchedulerSessions();
        const session = sessions.find(s => s.id === sessionId);
        if (!session) return;

        const link = AIOS.firebase.getShareableLink(sessionId);
        const message = `📅 תיאום פגישה: ${session.title}\nבחרו את הזמנים שנוחים לכם:\n${link}`;

        if (AIOS.actions && AIOS.actions.sendMessage) {
          try {
            await AIOS.actions.sendMessage(message);
            btn.textContent = '✅ נשלח!';
            setTimeout(() => { btn.textContent = '📱 שלח בוואטסאפ'; }, 2000);
          } catch (e) {
            prompt('העתק את ההודעה:', message);
          }
        } else {
          prompt('העתק את ההודעה:', message);
        }
      });
    });

    // Delete session
    container.querySelectorAll('.aios-delete-session').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('למחוק את הפגישה?')) return;
        const sessionId = btn.dataset.sessionId;

        try {
          await AIOS.firebase.remove(`sessions/${sessionId}`);
        } catch (e) {
          console.warn('[AIOS] Firebase delete error:', e);
        }

        let sessions = await AIOS.storage.getSchedulerSessions();
        sessions = sessions.filter(s => s.id !== sessionId);
        await AIOS.storage.setSchedulerSessions(sessions);
        this._renderList(container);
      });
    });
  },

  async _renderDetail(container) {
    const sessions = await AIOS.storage.getSchedulerSessions();
    const localSession = sessions.find(s => s.id === this._currentSessionId);
    if (!localSession) {
      this._currentView = 'list';
      return this._renderList(container);
    }

    // Fetch live data from Firebase
    let session;
    try {
      session = await AIOS.firebase.read(`sessions/${this._currentSessionId}`);
      if (!session) throw new Error('Session not found');
    } catch (e) {
      session = localSession;
    }

    const participants = session.participants || {};
    const participantList = Object.entries(participants);
    const colors = ['#00a884', '#5b72f0', '#f0a05b', '#f05b8e', '#8e5bf0', '#5bf0c8'];

    // Build availability grid
    let dates, slots;
    if (session.availableSlots) {
      const slotKeys = Object.keys(session.availableSlots).sort();
      dates = [...new Set(slotKeys.map(k => k.split('_')[0]))].sort();
      slots = [...new Set(slotKeys.map(k => k.split('_')[1]))].sort();
    } else {
      dates = this._getDateRange(session.dateRange.start, session.dateRange.end);
      slots = this._getTimeSlots(session.timeRange.start, session.timeRange.end, session.slotDurationMinutes);
    }

    // Find consensus slots
    const consensusSlots = this._findConsensusSlots(participants, session.participantCount);

    container.innerHTML = `
      <div class="aios-panel-full">
        <div class="aios-panel-header">
          <h2>📅 ${AIOS.utils.escapeHtml(session.title)}</h2>
          <div class="aios-panel-actions">
            <button class="aios-btn-secondary" id="aios-back-to-list">חזרה לרשימה</button>
            <button class="aios-btn-secondary aios-copy-link-detail" data-session-id="${this._currentSessionId}">📋 העתק קישור</button>
          </div>
        </div>

        <div class="aios-scheduler-detail-info">
          <span>👥 ${participantList.length}/${session.participantCount} משתתפים</span>
          <span>📅 ${session.availableSlots ? Object.keys(session.availableSlots).length + ' חלונות' : session.dateRange.start + ' - ' + session.dateRange.end}</span>
          <span>⏱️ ${session.slotDurationMinutes} דקות</span>
        </div>

        ${consensusSlots.length > 0 ? `
          <div class="aios-scheduler-consensus-banner">
            ✅ כל המשתתפים זמינים ב: ${consensusSlots.map(s => `<strong>${s.replace('_', ' ')}</strong>`).join(', ')}
          </div>
        ` : ''}

        <div class="aios-scheduler-participants">
          <h3>משתתפים</h3>
          ${participantList.length === 0 ? '<p class="aios-empty">עדיין אין משתתפים</p>' :
            participantList.map(([id, p], i) => `
              <div class="aios-scheduler-participant">
                <span class="aios-scheduler-participant-color" style="background:${colors[i % colors.length]}"></span>
                <span>${AIOS.utils.escapeHtml(p.email)}</span>
                <span class="aios-scheduler-participant-slots">${p.slots ? Object.keys(p.slots).length : 0} חלונות</span>
              </div>
            `).join('')
          }
        </div>

        <div class="aios-scheduler-grid-wrapper">
          <h3>לוח זמינות</h3>
          <div class="aios-scheduler-grid" style="grid-template-columns: 80px repeat(${dates.length}, 1fr);">
            <div class="aios-scheduler-grid-header"></div>
            ${dates.map(d => `<div class="aios-scheduler-grid-header">${this._formatDate(d)}</div>`).join('')}
            ${slots.map(time => `
              <div class="aios-scheduler-grid-time">${time}</div>
              ${dates.map(date => {
                const slotKey = `${date}_${time}`;
                const isAvailable = !session.availableSlots || session.availableSlots[slotKey];
                if (!isAvailable) {
                  return `<div class="aios-scheduler-grid-cell aios-scheduler-grid-cell-disabled" data-slot="${slotKey}"></div>`;
                }
                const selectedBy = participantList.filter(([id, p]) => p.slots && p.slots[slotKey]);
                const count = selectedBy.length;
                const isConsensus = consensusSlots.includes(slotKey);
                const opacity = count > 0 ? Math.max(0.3, count / session.participantCount) : 0;
                return `
                  <div class="aios-scheduler-grid-cell ${isConsensus ? 'consensus' : ''}"
                       data-slot="${slotKey}"
                       style="${count > 0 ? `background: rgba(0, 168, 132, ${opacity});` : ''}"
                       title="${count > 0 ? selectedBy.map(([id, p]) => p.email).join(', ') : 'לא נבחר'}">
                    ${count > 0 ? count : ''}
                  </div>
                `;
              }).join('')}
            `).join('')}
          </div>
        </div>

        ${this._renderHeatmapLegend(session.participantCount)}
      </div>
    `;

    this._setupDetailEvents(container);
    this._startListening();
  },

  _renderHeatmapLegend(total) {
    return `
      <div class="aios-scheduler-legend">
        <span>0/${total}</span>
        <div class="aios-scheduler-legend-bar"></div>
        <span>${total}/${total}</span>
      </div>
    `;
  },

  _setupDetailEvents(container) {
    const backBtn = document.getElementById('aios-back-to-list');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        this._stopListening();
        this._currentView = 'list';
        this._currentSessionId = null;
        this._renderList(container);
      });
    }

    const copyBtn = container.querySelector('.aios-copy-link-detail');
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        const link = AIOS.firebase.getShareableLink(copyBtn.dataset.sessionId);
        try {
          await navigator.clipboard.writeText(link);
          copyBtn.textContent = '✅ הועתק!';
          setTimeout(() => { copyBtn.textContent = '📋 העתק קישור'; }, 2000);
        } catch (e) {
          prompt('העתק:', link);
        }
      });
    }
  },

  _startListening() {
    if (!this._currentSessionId || !AIOS.firebase.isConfigured()) return;

    this._listener = AIOS.firebase.listen(
      `sessions/${this._currentSessionId}`,
      (data) => {
        if (!data) return;
        // Update local storage with latest data
        this._syncLocalSession(data);

        // Check for new consensus
        const participants = data.participants || {};
        const consensusSlots = this._findConsensusSlots(participants, data.participantCount);
        if (consensusSlots.length > 0 && data.status !== 'completed') {
          const [date, time] = consensusSlots[0].split('_');
          AIOS.firebase.update(`sessions/${this._currentSessionId}`, {
            status: 'completed',
            consensusSlot: { date, time }
          });
          data.status = 'completed';
          data.consensusSlot = { date, time };
        }

        if (data.status === 'completed' && data.consensusSlot) {
          this._handleConsensus(data);
        }

        // Re-render if we're still on the detail view
        if (this._currentView === 'detail') {
          const mainContent = document.getElementById('aios-main-content');
          if (mainContent) this._renderDetail(mainContent);
        }
      }
    );
  },

  _stopListening() {
    if (this._currentSessionId) {
      AIOS.firebase.stopListening(`sessions/${this._currentSessionId}`);
    }
    this._listener = null;
  },

  async _syncLocalSession(firebaseData) {
    const sessions = await AIOS.storage.getSchedulerSessions();
    const idx = sessions.findIndex(s => s.id === this._currentSessionId);
    if (idx >= 0) {
      sessions[idx] = {
        ...sessions[idx],
        ...firebaseData,
        id: this._currentSessionId,
        participantIds: firebaseData.participants ? Object.keys(firebaseData.participants) : []
      };
      await AIOS.storage.setSchedulerSessions(sessions);
    }
  },

  async _handleConsensus(session) {
    if (!session.consensusSlot || session._inviteSent) return;

    const slot = session.consensusSlot;
    const participants = session.participants || {};
    const emails = Object.values(participants).map(p => p.email);
    const duration = session.slotDurationMinutes || 30;

    // Calculate start and end times
    const startDateTime = `${slot.date}T${slot.time}:00`;
    const [h, m] = slot.time.split(':').map(Number);
    const endMinutes = h * 60 + m + duration;
    const endH = Math.floor(endMinutes / 60).toString().padStart(2, '0');
    const endM = (endMinutes % 60).toString().padStart(2, '0');
    const endDateTime = `${slot.date}T${endH}:${endM}:00`;

    console.log('[AIOS] Consensus reached! Creating calendar event:', {
      title: session.title,
      start: startDateTime,
      end: endDateTime,
      attendees: [session.organizerEmail, ...emails]
    });

    // Send message to service worker to create calendar event
    try {
      chrome.runtime.sendMessage({
        type: 'SCHEDULER_CREATE_EVENT',
        payload: {
          title: session.title,
          startDateTime,
          endDateTime,
          organizerEmail: session.organizerEmail,
          attendeeEmails: emails,
          sessionId: this._currentSessionId
        }
      }, (response) => {
        if (response && response.result) {
          console.log('[AIOS] Calendar event created:', response.result);
        } else if (response && response.error) {
          console.warn('[AIOS] Calendar event creation failed:', response.error);
        }
      });

      // Mark invite as sent in Firebase
      await AIOS.firebase.update(`sessions/${this._currentSessionId}`, {
        _inviteSent: true
      });
    } catch (e) {
      console.error('[AIOS] Failed to create calendar event:', e);
    }
  },

  _findConsensusSlots(participants, requiredCount) {
    const entries = Object.values(participants);
    if (entries.length < requiredCount) return [];

    const slotCounts = {};
    entries.forEach(p => {
      if (p.slots) {
        Object.keys(p.slots).forEach(slot => {
          slotCounts[slot] = (slotCounts[slot] || 0) + 1;
        });
      }
    });

    return Object.entries(slotCounts)
      .filter(([slot, count]) => count >= requiredCount)
      .map(([slot]) => slot);
  },

  _getDateRange(startStr, endStr) {
    const dates = [];
    const start = new Date(startStr);
    const end = new Date(endStr);
    const current = new Date(start);
    while (current <= end) {
      dates.push(current.toISOString().slice(0, 10));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  },

  _getTimeSlots(startStr, endStr, durationMin) {
    const slots = [];
    const [startH, startM] = startStr.split(':').map(Number);
    const [endH, endM] = endStr.split(':').map(Number);
    let totalStart = startH * 60 + startM;
    const totalEnd = endH * 60 + endM;

    while (totalStart < totalEnd) {
      const h = Math.floor(totalStart / 60).toString().padStart(2, '0');
      const m = (totalStart % 60).toString().padStart(2, '0');
      slots.push(`${h}:${m}`);
      totalStart += durationMin;
    }
    return slots;
  },

  _formatDate(dateStr) {
    const d = new Date(dateStr);
    const days = ['א\'', 'ב\'', 'ג\'', 'ד\'', 'ה\'', 'ו\'', 'ש\''];
    return `${days[d.getDay()]}<br>${d.getDate()}/${d.getMonth() + 1}`;
  },

  _renderWeekCalendar() {
    const container = document.getElementById('aios-week-calendar-container');
    const label = document.getElementById('aios-week-label');
    if (!container || !this._currentWeekStart) return;

    const duration = parseInt(document.getElementById('aios-session-duration')?.value) || 30;
    const weekStart = new Date(this._currentWeekStart);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    // Update label
    if (label) {
      label.textContent = `${weekStart.getDate()}/${weekStart.getMonth() + 1} - ${weekEnd.getDate()}/${weekEnd.getMonth() + 1}`;
    }

    const days = ['א\'', 'ב\'', 'ג\'', 'ד\'', 'ה\'', 'ו\'', 'ש\''];
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      dates.push(d.toISOString().slice(0, 10));
    }

    // Generate time slots from 08:00 to 20:00
    const slots = [];
    let totalMin = 8 * 60;
    const endMin = 20 * 60;
    while (totalMin < endMin) {
      const h = Math.floor(totalMin / 60).toString().padStart(2, '0');
      const m = (totalMin % 60).toString().padStart(2, '0');
      slots.push(`${h}:${m}`);
      totalMin += duration;
    }

    let html = `<div class="aios-week-calendar" style="grid-template-columns: 50px repeat(7, 1fr);">`;

    // Headers
    html += `<div class="aios-week-header"></div>`;
    dates.forEach((dateStr, i) => {
      const d = new Date(dateStr);
      html += `<div class="aios-week-header">${days[d.getDay()]}<br>${d.getDate()}/${d.getMonth() + 1}</div>`;
    });

    // Time rows
    slots.forEach(time => {
      html += `<div class="aios-week-time">${time}</div>`;
      dates.forEach(date => {
        const slotKey = `${date}_${time}`;
        const isSelected = this._selectedSlots[slotKey];
        // Don't allow selecting past dates
        const slotDate = new Date(date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isPast = slotDate < today;
        html += `<div class="aios-week-cell ${isSelected ? 'aios-week-cell-selected' : ''} ${isPast ? 'aios-week-cell-past' : ''}" data-slot="${slotKey}">${isSelected ? '\u2713' : ''}</div>`;
      });
    });

    html += `</div>`;
    container.innerHTML = html;

    // Update slot count
    this._updateSlotCount();

    // Setup cell click events
    container.querySelectorAll('.aios-week-cell:not(.aios-week-cell-past)').forEach(cell => {
      cell.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const slotKey = cell.dataset.slot;
        if (!slotKey) return;
        // Determine drag mode: if cell is selected, we're deselecting; otherwise selecting
        this._isDragging = true;
        this._dragMode = !this._selectedSlots[slotKey];
        this._toggleSlot(slotKey, this._dragMode);
        this._updateCellVisual(cell, this._dragMode);
      });

      cell.addEventListener('mouseenter', () => {
        if (!this._isDragging) return;
        const slotKey = cell.dataset.slot;
        if (!slotKey) return;
        this._toggleSlot(slotKey, this._dragMode);
        this._updateCellVisual(cell, this._dragMode);
      });
    });

    // End drag on mouseup anywhere
    const mouseUpHandler = () => {
      this._isDragging = false;
      document.removeEventListener('mouseup', mouseUpHandler);
    };
    document.addEventListener('mouseup', mouseUpHandler);
  },

  _toggleSlot(slotKey, select) {
    if (select) {
      this._selectedSlots[slotKey] = true;
    } else {
      delete this._selectedSlots[slotKey];
    }
    this._updateSlotCount();
  },

  _updateCellVisual(cell, selected) {
    if (selected) {
      cell.classList.add('aios-week-cell-selected');
      cell.textContent = '\u2713';
    } else {
      cell.classList.remove('aios-week-cell-selected');
      cell.textContent = '';
    }
  },

  _updateSlotCount() {
    const countEl = document.getElementById('aios-slot-count');
    if (countEl) {
      const count = Object.keys(this._selectedSlots).length;
      countEl.textContent = `${count} חלונות נבחרו`;
      countEl.style.color = count > 0 ? 'var(--aios-accent)' : 'var(--aios-text-secondary)';
    }
  }
};

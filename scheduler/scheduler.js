/**
 * Meeting Scheduler - Standalone Participant Page
 * Firebase REST API for real-time collaboration
 */
(function () {
  'use strict';

  const COLORS = ['#00a884', '#5b72f0', '#f0a05b', '#f05b8e', '#8e5bf0', '#5bf0c8', '#f0e55b', '#5bcdf0'];

  let state = {
    sessionId: null,
    dbURL: null,
    session: null,
    participantId: null,
    email: null,
    mySlots: {},
    mobileDateIndex: 0
  };

  // --- Firebase REST helpers ---
  function fbUrl(path) {
    return `${state.dbURL}/${path}.json`;
  }

  async function fbRead(path) {
    const res = await fetch(fbUrl(path));
    if (!res.ok) throw new Error(`Firebase error: ${res.status}`);
    return res.json();
  }

  async function fbWrite(path, data) {
    const res = await fetch(fbUrl(path), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(`Firebase error: ${res.status}`);
    return res.json();
  }

  async function fbUpdate(path, data) {
    const res = await fetch(fbUrl(path), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(`Firebase error: ${res.status}`);
    return res.json();
  }

  function fbListen(path, callback) {
    const url = fbUrl(path);
    const es = new EventSource(url);
    es.onmessage = (e) => {
      try {
        callback(JSON.parse(e.data));
      } catch (err) {
        console.warn('SSE parse error:', err);
      }
    };
    es.onerror = () => console.warn('SSE connection error, will reconnect...');
    return es;
  }

  // --- URL Parsing ---
  function parseParams() {
    const params = new URLSearchParams(window.location.search);
    state.sessionId = params.get('session');
    const fbParam = params.get('fb');
    if (fbParam) {
      try {
        const config = JSON.parse(atob(decodeURIComponent(fbParam)));
        state.dbURL = config.databaseURL.replace(/\/$/, '');
      } catch (e) {
        console.error('Failed to parse Firebase config:', e);
      }
    }
  }

  // --- Date/Time Helpers ---
  function getDateRange(start, end) {
    const dates = [];
    const current = new Date(start);
    const endDate = new Date(end);
    while (current <= endDate) {
      dates.push(current.toISOString().slice(0, 10));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }

  function getTimeSlots(start, end, duration) {
    const slots = [];
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let total = sh * 60 + sm;
    const totalEnd = eh * 60 + em;
    while (total < totalEnd) {
      const h = Math.floor(total / 60).toString().padStart(2, '0');
      const m = (total % 60).toString().padStart(2, '0');
      slots.push(`${h}:${m}`);
      total += duration;
    }
    return slots;
  }

  function formatDateHeader(dateStr) {
    const d = new Date(dateStr);
    const days = ['\u05d0\'', '\u05d1\'', '\u05d2\'', '\u05d3\'', '\u05d4\'', '\u05d5\'', '\u05e9\''];
    return `${days[d.getDay()]}<br>${d.getDate()}/${d.getMonth() + 1}`;
  }

  function formatDateFull(dateStr) {
    const d = new Date(dateStr);
    const days = ['\u05e8\u05d0\u05e9\u05d5\u05df', '\u05e9\u05e0\u05d9', '\u05e9\u05dc\u05d9\u05e9\u05d9', '\u05e8\u05d1\u05d9\u05e2\u05d9', '\u05d7\u05de\u05d9\u05e9\u05d9', '\u05e9\u05d9\u05e9\u05d9', '\u05e9\u05d1\u05ea'];
    return `\u05d9\u05d5\u05dd ${days[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Rendering ---
  function renderLoading() {
    document.getElementById('app').innerHTML = `
      <div class="loading">
        <div class="loading-spinner"></div>
        <p>\u05d8\u05d5\u05e2\u05df \u05e0\u05ea\u05d5\u05e0\u05d9 \u05e4\u05d2\u05d9\u05e9\u05d4...</p>
      </div>
    `;
  }

  function renderError(msg) {
    document.getElementById('app').innerHTML = `
      <div class="error-notice">
        <h2>\u05e9\u05d2\u05d9\u05d0\u05d4</h2>
        <p>${escapeHtml(msg)}</p>
      </div>
    `;
  }

  function renderExpired() {
    document.getElementById('app').innerHTML = `
      <div class="expired-notice">
        <h2>\u23f0 \u05e4\u05d2 \u05ea\u05d5\u05e7\u05e3</h2>
        <p>\u05e1\u05e9\u05df \u05d4\u05ea\u05d9\u05d0\u05d5\u05dd \u05d4\u05d6\u05d4 \u05e4\u05d2 \u05ea\u05d5\u05e7\u05e4\u05d5.</p>
      </div>
    `;
  }

  function renderCompleted(session) {
    const slot = session.consensusSlot;
    document.getElementById('app').innerHTML = `
      <div class="container">
        <div class="scheduler-header">
          <h1>📅 ${escapeHtml(session.title)}</h1>
          <div class="organizer">\u05de\u05d0\u05e8\u05d2\u05df: ${escapeHtml(session.organizerEmail)}</div>
        </div>
        <div class="completed-notice">
          <h2>\u2705 \u05d4\u05e4\u05d2\u05d9\u05e9\u05d4 \u05e0\u05e7\u05d1\u05e2\u05d4!</h2>
          <p>\u05db\u05dc \u05d4\u05de\u05e9\u05ea\u05ea\u05e4\u05d9\u05dd \u05d6\u05de\u05d9\u05e0\u05d9\u05dd \u05d1-<strong>${slot.date}</strong> \u05d1\u05e9\u05e2\u05d4 <strong>${slot.time}</strong></p>
          <p style="margin-top: 8px; color: var(--text-secondary);">\u05d6\u05d9\u05de\u05d5\u05df \u05dc\u05d9\u05d5\u05de\u05df \u05e0\u05e9\u05dc\u05d7 \u05d0\u05d5\u05d8\u05d5\u05de\u05d8\u05d9\u05ea.</p>
        </div>
      </div>
    `;
  }

  function renderJoinForm(session) {
    document.getElementById('app').innerHTML = `
      <div class="container">
        <div class="scheduler-header">
          <h1>📅 ${escapeHtml(session.title)}</h1>
          <div class="subtitle">\u05ea\u05d9\u05d0\u05d5\u05dd \u05e4\u05d2\u05d9\u05e9\u05d4 \u05de\u05e8\u05d5\u05d1\u05ea \u05de\u05e9\u05ea\u05ea\u05e4\u05d9\u05dd</div>
          <div class="organizer">\u05de\u05d0\u05e8\u05d2\u05df: ${escapeHtml(session.organizerEmail)}</div>
        </div>
        <div class="status-bar">
          <span>👥 ${Object.keys(session.participants || {}).length}/${session.participantCount} \u05de\u05e9\u05ea\u05ea\u05e4\u05d9\u05dd</span>
          <span>📅 ${session.availableSlots ? Object.keys(session.availableSlots).length + ' \u05d7\u05dc\u05d5\u05e0\u05d5\u05ea \u05d6\u05de\u05d9\u05e0\u05d9\u05dd' : session.dateRange.start + ' - ' + session.dateRange.end}</span>
          <span>⏱️ ${session.slotDurationMinutes} \u05d3\u05e7\u05d5\u05ea</span>
        </div>
        <div class="join-form">
          <h2>\u05d4\u05e6\u05d8\u05e8\u05e4\u05d5 \u05dc\u05ea\u05d9\u05d0\u05d5\u05dd</h2>
          <input type="email" id="email-input" placeholder="\u05d4\u05d0\u05d9\u05de\u05d9\u05d9\u05dc \u05e9\u05dc\u05db\u05dd" dir="ltr">
          <button class="btn-primary" id="join-btn">\u05d4\u05de\u05e9\u05da</button>
        </div>
      </div>
    `;

    document.getElementById('join-btn').addEventListener('click', handleJoin);
    document.getElementById('email-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleJoin();
    });
  }

  function renderScheduler(session) {
    const participants = session.participants || {};
    const participantEntries = Object.entries(participants);
    let dates, slots;
    if (session.availableSlots) {
      const slotKeys = Object.keys(session.availableSlots).sort();
      dates = [...new Set(slotKeys.map(k => k.split('_')[0]))].sort();
      slots = [...new Set(slotKeys.map(k => k.split('_')[1]))].sort();
    } else {
      dates = getDateRange(session.dateRange.start, session.dateRange.end);
      slots = getTimeSlots(session.timeRange.start, session.timeRange.end, session.slotDurationMinutes);
    }

    // Find consensus
    const consensusSlots = findConsensus(participants, session.participantCount);

    // Mobile: limit to one day
    const isMobile = window.innerWidth <= 600;
    const visibleDates = isMobile ? [dates[state.mobileDateIndex]] : dates;

    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="container">
        <div class="scheduler-header">
          <h1>📅 ${escapeHtml(session.title)}</h1>
          <div class="organizer">\u05de\u05d0\u05e8\u05d2\u05df: ${escapeHtml(session.organizerEmail)}</div>
        </div>

        <div class="status-bar">
          <span>👥 ${participantEntries.length}/${session.participantCount} \u05de\u05e9\u05ea\u05ea\u05e4\u05d9\u05dd</span>
          <span>📧 ${escapeHtml(state.email)}</span>
        </div>

        ${consensusSlots.length > 0 ? `
          <div class="consensus-banner">
            \u2705 \u05db\u05dc \u05d4\u05de\u05e9\u05ea\u05ea\u05e4\u05d9\u05dd \u05d6\u05de\u05d9\u05e0\u05d9\u05dd \u05d1: ${consensusSlots.map(s => `<strong>${s.replace('_', ' ')}</strong>`).join(', ')}
          </div>
        ` : ''}

        <div class="participants-section">
          <h3>\u05de\u05e9\u05ea\u05ea\u05e4\u05d9\u05dd</h3>
          <div class="participant-list">
            ${participantEntries.map(([id, p], i) => `
              <div class="participant-chip">
                <span class="participant-dot" style="background:${COLORS[i % COLORS.length]}"></span>
                <span>${escapeHtml(p.email)}${id === state.participantId ? ' (\u05d0\u05ea\u05d4)' : ''}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="grid-wrapper">
          <div class="grid-instructions">\u05dc\u05d7\u05e6\u05d5 \u05e2\u05dc \u05d4\u05de\u05e9\u05d1\u05e6\u05d5\u05ea \u05db\u05d3\u05d9 \u05dc\u05e1\u05de\u05df \u05d0\u05ea \u05d4\u05d6\u05de\u05e0\u05d9\u05dd \u05e9\u05e0\u05d5\u05d7\u05d9\u05dd \u05dc\u05db\u05dd</div>

          <div class="mobile-nav">
            <button id="prev-day">&rarr;</button>
            <span class="current-date">${isMobile ? formatDateFull(dates[state.mobileDateIndex]) : ''}</span>
            <button id="next-day">&larr;</button>
          </div>

          <div class="scheduler-grid" style="grid-template-columns: 60px repeat(${visibleDates.length}, 1fr);">
            <div class="grid-header"></div>
            ${visibleDates.map(d => `<div class="grid-header">${formatDateHeader(d)}</div>`).join('')}
            ${slots.map(time => `
              <div class="grid-time">${time}</div>
              ${visibleDates.map(date => {
                const slotKey = `${date}_${time}`;
                const isAvailable = !session.availableSlots || session.availableSlots[slotKey];
                if (!isAvailable) {
                  return `<div class="grid-cell grid-cell-disabled" data-slot="${slotKey}"></div>`;
                }
                const isMine = state.mySlots[slotKey];
                const others = participantEntries.filter(([id, p]) => id !== state.participantId && p.slots && p.slots[slotKey]);
                const totalCount = (isMine ? 1 : 0) + others.length;
                const isConsensus = consensusSlots.includes(slotKey);

                let classes = 'grid-cell';
                if (isMine) classes += ' selected-self';
                if (others.length > 0) classes += ' has-others';
                if (isConsensus) classes += ' consensus';

                const opacity = others.length > 0 ? Math.max(0.2, others.length / session.participantCount) : 0;

                return `
                  <div class="${classes}" data-slot="${slotKey}"
                       style="${!isMine && others.length > 0 ? `background: rgba(0, 168, 132, ${opacity});` : ''}"
                       title="${others.map(([id, p]) => p.email).join(', ') || ''}">
                    ${totalCount > 0 ? `<span class="cell-count">${totalCount}</span>` : ''}
                    ${others.length > 0 ? `
                      <div class="cell-dots">
                        ${others.slice(0, 4).map(([id, p]) => {
                          const idx = participantEntries.findIndex(([pid]) => pid === id);
                          return `<span class="cell-dot" style="background:${COLORS[idx % COLORS.length]}"></span>`;
                        }).join('')}
                      </div>
                    ` : ''}
                  </div>
                `;
              }).join('')}
            `).join('')}
          </div>
        </div>

        <div class="legend">
          <div class="legend-item">
            <div class="legend-box" style="background: var(--accent);"></div>
            <span>\u05d4\u05d1\u05d7\u05d9\u05e8\u05d4 \u05e9\u05dc\u05d9</span>
          </div>
          <div class="legend-item">
            <div class="legend-box" style="background: rgba(0, 168, 132, 0.3);"></div>
            <span>\u05d0\u05d7\u05e8\u05d9\u05dd \u05d1\u05d7\u05e8\u05d5</span>
          </div>
          <div class="legend-item">
            <div class="legend-box" style="background: var(--accent); border: 2px solid var(--accent); box-shadow: 0 0 8px rgba(0, 168, 132, 0.4);"></div>
            <span>\u05d4\u05e1\u05db\u05de\u05d4 \u05de\u05dc\u05d0\u05d4</span>
          </div>
        </div>
      </div>
    `;

    setupGridEvents(dates);
  }

  // --- Event Handlers ---
  async function handleJoin() {
    const emailInput = document.getElementById('email-input');
    const email = emailInput.value.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      emailInput.style.borderColor = 'var(--danger)';
      return;
    }

    const btn = document.getElementById('join-btn');
    btn.disabled = true;
    btn.textContent = '\u05de\u05ea\u05d7\u05d1\u05e8...';

    try {
      // Check if email already registered
      const participants = state.session.participants || {};
      const existing = Object.entries(participants).find(([id, p]) => p.email.toLowerCase() === email);

      if (existing) {
        // Rejoin
        state.participantId = existing[0];
        state.email = email;
        state.mySlots = existing[1].slots || {};
      } else {
        // Check participant limit
        if (Object.keys(participants).length >= state.session.participantCount) {
          alert('\u05de\u05e1\u05e4\u05e8 \u05d4\u05de\u05e9\u05ea\u05ea\u05e4\u05d9\u05dd \u05d4\u05de\u05e7\u05e1\u05d9\u05de\u05dc\u05d9 \u05d4\u05d5\u05e9\u05d2');
          btn.disabled = false;
          btn.textContent = '\u05d4\u05de\u05e9\u05da';
          return;
        }

        // Create new participant
        state.participantId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        state.email = email;
        state.mySlots = {};

        await fbWrite(`sessions/${state.sessionId}/participants/${state.participantId}`, {
          email: email,
          joinedAt: Date.now(),
          slots: {}
        });
      }

      // Save to localStorage for returning visits
      localStorage.setItem(`scheduler_${state.sessionId}`, JSON.stringify({
        participantId: state.participantId,
        email: state.email
      }));

      // Refresh session data and render
      state.session = await fbRead(`sessions/${state.sessionId}`);
      renderScheduler(state.session);
      startListening();
    } catch (e) {
      console.error('Join error:', e);
      alert('\u05e9\u05d2\u05d9\u05d0\u05d4 \u05d1\u05d4\u05ea\u05d7\u05d1\u05e8\u05d5\u05ea: ' + e.message);
      btn.disabled = false;
      btn.textContent = '\u05d4\u05de\u05e9\u05da';
    }
  }

  function setupGridEvents(allDates) {
    // Cell click - toggle slot
    document.querySelectorAll('.grid-cell').forEach(cell => {
      cell.addEventListener('click', async () => {
        if (cell.classList.contains('grid-cell-disabled')) return;
        const slotKey = cell.dataset.slot;
        if (!slotKey) return;

        if (state.mySlots[slotKey]) {
          delete state.mySlots[slotKey];
        } else {
          state.mySlots[slotKey] = true;
        }

        // Write to Firebase
        try {
          await fbWrite(
            `sessions/${state.sessionId}/participants/${state.participantId}/slots`,
            state.mySlots
          );

          // Check consensus
          const session = await fbRead(`sessions/${state.sessionId}`);
          state.session = session;
          const consensus = findConsensus(session.participants || {}, session.participantCount);

          if (consensus.length > 0 && session.status !== 'completed') {
            const [date, time] = consensus[0].split('_');
            await fbUpdate(`sessions/${state.sessionId}`, {
              status: 'completed',
              consensusSlot: { date, time }
            });
          }

          renderScheduler(session);
        } catch (e) {
          console.error('Slot update error:', e);
        }
      });
    });

    // Mobile navigation
    const prevBtn = document.getElementById('prev-day');
    const nextBtn = document.getElementById('next-day');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (state.mobileDateIndex < allDates.length - 1) {
          state.mobileDateIndex++;
          renderScheduler(state.session);
        }
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (state.mobileDateIndex > 0) {
          state.mobileDateIndex--;
          renderScheduler(state.session);
        }
      });
    }
  }

  function findConsensus(participants, requiredCount) {
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
      .filter(([, count]) => count >= requiredCount)
      .map(([slot]) => slot)
      .sort();
  }

  // --- Real-time Listening ---
  let eventSource = null;

  function startListening() {
    if (eventSource) eventSource.close();

    eventSource = fbListen(`sessions/${state.sessionId}`, (data) => {
      if (!data) return;
      state.session = data;

      // Update own slots from server
      if (data.participants && data.participants[state.participantId]) {
        state.mySlots = data.participants[state.participantId].slots || {};
      }

      if (data.status === 'completed') {
        renderCompleted(data);
        if (eventSource) eventSource.close();
        return;
      }

      if (data.status === 'expired') {
        renderExpired();
        if (eventSource) eventSource.close();
        return;
      }

      renderScheduler(data);
    });
  }

  // --- Init ---
  async function init() {
    parseParams();

    if (!state.sessionId || !state.dbURL) {
      renderError('\u05e7\u05d9\u05e9\u05d5\u05e8 \u05dc\u05d0 \u05ea\u05e7\u05d9\u05df. \u05d5\u05d3\u05d0\u05d5 \u05e9\u05e7\u05d9\u05d1\u05dc\u05ea\u05dd \u05e7\u05d9\u05e9\u05d5\u05e8 \u05ea\u05e7\u05d9\u05df.');
      return;
    }

    renderLoading();

    try {
      const session = await fbRead(`sessions/${state.sessionId}`);
      if (!session) {
        renderError('\u05e4\u05d2\u05d9\u05e9\u05d4 \u05dc\u05d0 \u05e0\u05de\u05e6\u05d0\u05d4.');
        return;
      }

      state.session = session;

      // Check expiration
      if (session.expiresAt && Date.now() > session.expiresAt) {
        if (session.status !== 'expired') {
          await fbUpdate(`sessions/${state.sessionId}`, { status: 'expired' });
        }
        renderExpired();
        return;
      }

      // Check if completed
      if (session.status === 'completed') {
        renderCompleted(session);
        return;
      }

      // Check localStorage for returning user
      const saved = localStorage.getItem(`scheduler_${state.sessionId}`);
      if (saved) {
        try {
          const { participantId, email } = JSON.parse(saved);
          const participants = session.participants || {};
          if (participants[participantId]) {
            state.participantId = participantId;
            state.email = email;
            state.mySlots = participants[participantId].slots || {};
            renderScheduler(session);
            startListening();
            return;
          }
        } catch (e) {
          localStorage.removeItem(`scheduler_${state.sessionId}`);
        }
      }

      renderJoinForm(session);
    } catch (e) {
      console.error('Init error:', e);
      renderError('\u05e9\u05d2\u05d9\u05d0\u05d4 \u05d1\u05d8\u05e2\u05d9\u05e0\u05ea \u05d4\u05e0\u05ea\u05d5\u05e0\u05d9\u05dd: ' + e.message);
    }
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

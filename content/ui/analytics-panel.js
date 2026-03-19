/**
 * AIOS Analytics Panel
 * Chat statistics and conversation insights
 */
AIOS.analyticsPanel = {
  render(container) {
    const chats = AIOS.reader.getChats();
    const messages = AIOS.reader.getMessages();

    // Calculate basic stats
    const totalChats = chats.length;
    const unreadChats = chats.filter(c => c.unread > 0).length;
    const totalMessages = messages.length;
    const incomingMsgs = messages.filter(m => m.isIncoming).length;
    const outgoingMsgs = messages.filter(m => !m.isIncoming).length;

    // Word frequency analysis
    const wordFreq = this._getWordFrequency(messages);
    const topWords = wordFreq.slice(0, 15);

    // Message length stats
    const avgLength = messages.length > 0
      ? Math.round(messages.reduce((sum, m) => sum + m.text.length, 0) / messages.length)
      : 0;

    container.innerHTML = `
      <div class="aios-panel-full">
        <div class="aios-panel-header">
          <h2>📊 ניתוחים</h2>
          <button class="aios-btn-primary" id="aios-ai-analyze">🤖 ניתוח AI מעמיק</button>
        </div>

        <!-- Stats Grid -->
        <div class="aios-stats-grid">
          <div class="aios-stat-card">
            <div class="aios-stat-number">${totalChats}</div>
            <div class="aios-stat-label">צ'אטים</div>
          </div>
          <div class="aios-stat-card">
            <div class="aios-stat-number">${unreadChats}</div>
            <div class="aios-stat-label">לא נקראו</div>
          </div>
          <div class="aios-stat-card">
            <div class="aios-stat-number">${totalMessages}</div>
            <div class="aios-stat-label">הודעות בשיחה</div>
          </div>
          <div class="aios-stat-card">
            <div class="aios-stat-number">${avgLength}</div>
            <div class="aios-stat-label">אורך ממוצע</div>
          </div>
        </div>

        <!-- Message Distribution -->
        <div class="aios-analytics-section">
          <h3>התפלגות הודעות</h3>
          <div class="aios-bar-chart">
            <div class="aios-bar-row">
              <span class="aios-bar-label">נכנסות</span>
              <div class="aios-bar-container">
                <div class="aios-bar incoming" style="width: ${totalMessages > 0 ? (incomingMsgs / totalMessages * 100) : 0}%"></div>
              </div>
              <span class="aios-bar-value">${incomingMsgs}</span>
            </div>
            <div class="aios-bar-row">
              <span class="aios-bar-label">יוצאות</span>
              <div class="aios-bar-container">
                <div class="aios-bar outgoing" style="width: ${totalMessages > 0 ? (outgoingMsgs / totalMessages * 100) : 0}%"></div>
              </div>
              <span class="aios-bar-value">${outgoingMsgs}</span>
            </div>
          </div>
        </div>

        <!-- Top Chats -->
        <div class="aios-analytics-section">
          <h3>צ'אטים עם הכי הרבה הודעות שלא נקראו</h3>
          <div class="aios-top-list">
            ${chats
              .filter(c => c.unread > 0)
              .sort((a, b) => b.unread - a.unread)
              .slice(0, 10)
              .map((chat, i) => `
                <div class="aios-top-item">
                  <span class="aios-top-rank">${i + 1}</span>
                  <span class="aios-top-name">${AIOS.utils.escapeHtml(chat.name)}</span>
                  <span class="aios-top-count">${chat.unread} הודעות</span>
                </div>
              `).join('') || '<div class="aios-empty">אין הודעות שלא נקראו!</div>'}
          </div>
        </div>

        <!-- Word Cloud -->
        <div class="aios-analytics-section">
          <h3>מילים נפוצות בשיחה</h3>
          <div class="aios-word-cloud" id="aios-word-cloud">
            ${topWords.map(([word, count]) => {
              const size = Math.min(24, Math.max(12, 10 + count * 2));
              const opacity = Math.min(1, 0.4 + count * 0.1);
              return `<span class="aios-word" style="font-size: ${size}px; opacity: ${opacity}">${AIOS.utils.escapeHtml(word)}</span>`;
            }).join(' ')}
            ${topWords.length === 0 ? '<div class="aios-empty">פתח שיחה כדי לראות מילים נפוצות</div>' : ''}
          </div>
        </div>

        <!-- AI Deep Analysis Result -->
        <div class="aios-analytics-section aios-hidden" id="aios-deep-analysis">
          <h3>🤖 ניתוח AI</h3>
          <div class="aios-analysis-result" id="aios-analysis-result"></div>
        </div>
      </div>
    `;

    this._setupEvents(container);
  },

  _getWordFrequency(messages) {
    const stopWords = new Set(['את', 'של', 'על', 'זה', 'אני', 'לא', 'כן', 'מה', 'גם', 'אם', 'עם', 'היה', 'הוא', 'היא', 'אבל', 'או', 'כי', 'יש', 'אין', 'the', 'is', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for']);
    const freq = {};

    messages.forEach(msg => {
      const words = msg.text.split(/\s+/);
      words.forEach(word => {
        const clean = word.replace(/[^\w\u0590-\u05FF]/g, '').toLowerCase();
        if (clean.length > 1 && !stopWords.has(clean)) {
          freq[clean] = (freq[clean] || 0) + 1;
        }
      });
    });

    return Object.entries(freq).sort((a, b) => b[1] - a[1]);
  },

  _setupEvents(container) {
    const analyzeBtn = document.getElementById('aios-ai-analyze');
    if (analyzeBtn) {
      analyzeBtn.addEventListener('click', async () => {
        const messages = AIOS.reader.getMessages();
        if (messages.length === 0) return;

        analyzeBtn.disabled = true;
        analyzeBtn.textContent = '🔄 מנתח...';

        try {
          const context = messages.map(m => `${m.sender}: ${m.text}`).join('\n');
          const result = await AIOS.claude.ask(
            'תן ניתוח מעמיק של השיחה הזו בעברית: 1) נושאים עיקריים 2) דינמיקת השיחה 3) נקודות מעניינות 4) המלצות',
            context
          );

          const section = document.getElementById('aios-deep-analysis');
          const resultDiv = document.getElementById('aios-analysis-result');
          if (section && resultDiv) {
            section.classList.remove('aios-hidden');
            resultDiv.innerHTML = result.replace(/\n/g, '<br>');
          }
        } catch (e) {
          console.error('[AIOS] Analysis error:', e);
        }

        analyzeBtn.disabled = false;
        analyzeBtn.textContent = '🤖 ניתוח AI מעמיק';
      });
    }
  }
};

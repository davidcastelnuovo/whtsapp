/**
 * Claude API Client
 * Communicates with background service worker to make API calls
 */
AIOS.claude = {
  /**
   * Send a message to Claude via background service worker
   */
  async sendMessage(prompt, context = '') {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: 'CLAUDE_API_CALL',
          payload: { prompt, context }
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (response.error) {
            reject(new Error(response.error));
            return;
          }
          resolve(response.result);
        }
      );
    });
  },

  /**
   * Summarize a conversation
   */
  async summarize(messages) {
    const context = messages
      .map(m => `${m.sender}: ${m.text}`)
      .join('\n');
    return this.sendMessage(
      'סכם את השיחה הבאה בעברית. תן סיכום קצר וממוקד של הנקודות העיקריות.',
      context
    );
  },

  /**
   * Suggest a reply
   */
  async suggestReply(messages, tone = 'ידידותי') {
    const context = messages
      .map(m => `${m.sender}: ${m.text}`)
      .join('\n');
    return this.sendMessage(
      `הצע תגובה מתאימה לשיחה הבאה. הטון צריך להיות ${tone}. תן 3 אפשרויות תגובה בעברית.`,
      context
    );
  },

  /**
   * Analyze sentiment
   */
  async analyzeSentiment(messages) {
    const context = messages
      .map(m => `${m.sender}: ${m.text}`)
      .join('\n');
    return this.sendMessage(
      'נתח את הסנטימנט של השיחה הבאה בעברית. ציין את המצב הרגשי הכללי, נקודות מתח אם יש, ותן ציון מ-1 עד 10.',
      context
    );
  },

  /**
   * Categorize a chat
   */
  async categorizeChat(chatName, recentMessages) {
    const context = recentMessages
      .map(m => `${m.sender}: ${m.text}`)
      .join('\n');
    return this.sendMessage(
      `סווג את השיחה עם "${chatName}" לאחת מהקטגוריות: עבודה, משפחה, חברים, קבוצות, שירות לקוחות, ספאם. החזר רק את שם הקטגוריה.`,
      context
    );
  },

  /**
   * Extract tasks from conversation
   */
  async extractTasks(messages) {
    const context = messages
      .map(m => `${m.sender}: ${m.text}`)
      .join('\n');
    return this.sendMessage(
      'חלץ משימות ופריטי פעולה מהשיחה הבאה. החזר רשימה ממוספרת בעברית של דברים שצריך לעשות.',
      context
    );
  },

  /**
   * Generate AI auto-reply
   */
  async generateAutoReply(messages, rules) {
    const context = messages
      .map(m => `${m.sender}: ${m.text}`)
      .join('\n');
    const rulesContext = rules
      .map(r => `כלל: כש-"${r.trigger}" → תגיב "${r.response}"`)
      .join('\n');
    return this.sendMessage(
      `בהתבסס על הכללים והשיחה, צור תגובה אוטומטית מתאימה בעברית. אם אין כלל מתאים, החזר "NO_MATCH".\n\nכללים:\n${rulesContext}`,
      context
    );
  },

  /**
   * Free-form question about conversations
   */
  async ask(question, conversationContext) {
    return this.sendMessage(question, conversationContext);
  }
};

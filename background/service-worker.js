/**
 * AIOS Background Service Worker
 * Handles Claude API calls, alarms for scheduled messages, and extension lifecycle
 */

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

/**
 * Make a Claude API call
 */
async function callClaudeAPI(apiKey, prompt, context = '') {
  const systemPrompt = `אתה עוזר AI שמשולב כתוסף Chrome בתוך WhatsApp Web של המשתמש. יש לך גישה ישירה לשיחות WhatsApp שלו - התוסף קורא את ההודעות מה-DOM ושולח לך אותן כקונטקסט.

כשמצורף קונטקסט שיחה (מתחת ל"--- שיחה ---"), זהו תוכן אמיתי מ-WhatsApp Web של המשתמש. נתח, סכם, והגב בהתאם לתוכן האמיתי.

כשאין קונטקסט שיחה, ייתכן שהמשתמש לא פתח שיחה עדיין. הנחה אותו לפתוח שיחה ולנסות שוב.

אתה עונה בעברית בצורה טבעית וידידותית. כשמבקשים ממך לנתח שיחות, אתה מדויק וממוקד.`;

  const userMessage = context
    ? `${prompt}\n\n--- שיחה ---\n${context}`
    : prompt;

  const response = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userMessage }
      ]
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

/**
 * Handle messages from content script
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CLAUDE_API_CALL') {
    handleClaudeCall(message.payload)
      .then(result => sendResponse({ result }))
      .catch(error => sendResponse({ error: error.message }));
    return true; // Keep channel open for async response
  }

  if (message.type === 'SCHEDULE_MESSAGE') {
    handleScheduleMessage(message.payload)
      .then(result => sendResponse({ result }))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  if (message.type === 'GET_SCHEDULED') {
    getScheduledMessages()
      .then(result => sendResponse({ result }))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  if (message.type === 'CANCEL_SCHEDULED') {
    cancelScheduledMessage(message.payload.id)
      .then(result => sendResponse({ result }))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  if (message.type === 'SCHEDULER_CREATE_EVENT') {
    handleCreateCalendarEvent(message.payload)
      .then(result => sendResponse({ result }))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }
});

async function handleClaudeCall({ prompt, context }) {
  const result = await chrome.storage.local.get('claude_api_key');
  const apiKey = result.claude_api_key;

  if (!apiKey) {
    throw new Error('מפתח API לא הוגדר. הגדר אותו בהגדרות התוסף.');
  }

  return callClaudeAPI(apiKey, prompt, context);
}

/**
 * Scheduled Messages
 */
async function handleScheduleMessage({ chatName, text, sendAt }) {
  const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

  const result = await chrome.storage.local.get('scheduled_messages');
  const messages = result.scheduled_messages || [];
  messages.push({ id, chatName, text, sendAt, status: 'pending' });
  await chrome.storage.local.set({ scheduled_messages: messages });

  // Create alarm
  const delayMs = new Date(sendAt).getTime() - Date.now();
  if (delayMs > 0) {
    chrome.alarms.create(`msg_${id}`, { delayInMinutes: delayMs / 60000 });
  }

  return { id, status: 'scheduled' };
}

async function getScheduledMessages() {
  const result = await chrome.storage.local.get('scheduled_messages');
  return result.scheduled_messages || [];
}

async function cancelScheduledMessage(id) {
  const result = await chrome.storage.local.get('scheduled_messages');
  const messages = (result.scheduled_messages || []).filter(m => m.id !== id);
  await chrome.storage.local.set({ scheduled_messages: messages });
  chrome.alarms.clear(`msg_${id}`);
  return { status: 'cancelled' };
}

/**
 * Handle alarms (scheduled messages)
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith('msg_')) return;

  const msgId = alarm.name.replace('msg_', '');
  const result = await chrome.storage.local.get('scheduled_messages');
  const messages = result.scheduled_messages || [];
  const msg = messages.find(m => m.id === msgId);

  if (!msg || msg.status !== 'pending') return;

  // Send message to content script to execute
  const tabs = await chrome.tabs.query({ url: '*://web.whatsapp.com/*' });
  if (tabs.length > 0) {
    chrome.tabs.sendMessage(tabs[0].id, {
      type: 'EXECUTE_SCHEDULED_MESSAGE',
      payload: msg
    });
  }

  // Update status
  msg.status = 'sent';
  await chrome.storage.local.set({ scheduled_messages: messages });
});

/**
 * Calendar event creation for meeting scheduler
 * Stores event details for the extension to process via MCP tools
 */
async function handleCreateCalendarEvent({ title, startDateTime, endDateTime, organizerEmail, attendeeEmails, sessionId }) {
  // Store the pending event for the content script to pick up and process via MCP
  const event = {
    id: sessionId,
    title,
    startDateTime,
    endDateTime,
    organizerEmail,
    attendeeEmails,
    status: 'pending',
    createdAt: Date.now()
  };

  const result = await chrome.storage.local.get('scheduler_pending_events');
  const events = result.scheduler_pending_events || [];
  events.push(event);
  await chrome.storage.local.set({ scheduler_pending_events: events });

  // Notify content script to process the event via MCP tools
  const tabs = await chrome.tabs.query({ url: '*://web.whatsapp.com/*' });
  if (tabs.length > 0) {
    chrome.tabs.sendMessage(tabs[0].id, {
      type: 'SCHEDULER_PROCESS_EVENT',
      payload: event
    });
  }

  return { status: 'queued', event };
}

/**
 * Extension install handler
 */
chrome.runtime.onInstalled.addListener(() => {
  console.log('WhatsApp AIOS installed');
});

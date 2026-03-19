/**
 * AIOS Main Entry Point
 * Initializes the AIOS system on WhatsApp Web
 */
(async function initAIOS() {
  console.log('[AIOS] Initializing WhatsApp AIOS...');

  // Show loading indicator immediately
  const loader = document.createElement('div');
  loader.id = 'aios-loader';
  loader.style.cssText = `
    position: fixed; bottom: 20px; left: 20px; z-index: 999999;
    background: #202c33; color: #e9edef; padding: 12px 20px;
    border-radius: 10px; font-family: sans-serif; font-size: 14px;
    direction: rtl; box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    border: 1px solid #00a884; display: flex; align-items: center; gap: 10px;
  `;
  loader.innerHTML = `
    <div style="width:12px;height:12px;border:2px solid #00a884;border-top-color:transparent;border-radius:50%;animation:aios-spin 1s linear infinite"></div>
    <span>AIOS טוען...</span>
    <style>@keyframes aios-spin{to{transform:rotate(360deg)}}</style>
  `;
  document.body.appendChild(loader);

  try {
    // Wait for WhatsApp's #app element
    await AIOS.utils.waitForElement('#app', 20000);
    console.log('[AIOS] Found #app element');

    // Try multiple selectors for chat list (WhatsApp changes these frequently)
    const chatListSelectors = [
      '[data-testid="chat-list"]',
      '[data-testid="chatlist-header"]',
      '[aria-label="Chat list"]',
      '[aria-label="רשימת צ\'אטים"]',
      '#pane-side',
      '[data-testid="panel-list"]',
      'div[tabindex] > div > div > div[aria-label]'
    ];

    let chatListFound = false;
    try {
      await AIOS.utils.waitForAnyElement(chatListSelectors, 20000);
      chatListFound = true;
      console.log('[AIOS] WhatsApp chat list detected');
    } catch (e) {
      console.warn('[AIOS] Chat list selectors not found, proceeding anyway...', e.message);
      // Still proceed - WhatsApp is loaded (#app exists), selectors just changed
    }

    // Remove loader
    loader.remove();

    console.log('[AIOS] Injecting AIOS dashboard...');

    // Initialize the dashboard (full takeover)
    AIOS.dashboard.init();

    // Initialize WhatsApp reader
    AIOS.reader.init();

    // Initialize message observer
    AIOS.observer.init();

    // Listen for scheduled message execution from background
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'EXECUTE_SCHEDULED_MESSAGE') {
        const { chatName, text } = message.payload;
        AIOS.actions.openChat(chatName).then(() => {
          setTimeout(() => {
            AIOS.actions.sendMessage(text);
            sendResponse({ status: 'sent' });
          }, 1000);
        });
        return true;
      }
    });

    console.log('[AIOS] System ready!');
  } catch (error) {
    console.error('[AIOS] Failed to initialize:', error);

    // Show visible error to user instead of silent failure
    loader.innerHTML = `
      <span style="color:#ea4335">&#x26A0;</span>
      <span>AIOS: שגיאה בטעינה - ${error.message}</span>
      <button id="aios-retry" style="
        background:#00a884; color:#111b21; border:none; padding:6px 12px;
        border-radius:6px; cursor:pointer; font-size:13px; margin-right:8px;
      ">נסה שוב</button>
    `;
    loader.style.borderColor = '#ea4335';

    document.getElementById('aios-retry').addEventListener('click', () => {
      loader.remove();
      initAIOS();
    });
  }
})();

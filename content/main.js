/**
 * AIOS Main Entry Point
 * Initializes the AIOS system on WhatsApp Web
 */
(async function initAIOS() {
  console.log('[AIOS] Initializing WhatsApp AIOS...');

  try {
    // Wait for WhatsApp to fully load
    await AIOS.utils.waitForElement('#app', 15000);
    await AIOS.utils.waitForElement('[data-testid="chat-list"]', 15000);

    console.log('[AIOS] WhatsApp loaded, injecting AIOS dashboard...');

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
  }
})();

/**
 * AIOS Main Entry Point
 * Initializes the AIOS system on WhatsApp Web
 */
(async function initAIOS() {
  console.log('[AIOS] Initializing WhatsApp AIOS v1.0.0...');
  console.log('[AIOS] URL:', location.href);
  console.log('[AIOS] AIOS object keys:', Object.keys(window.AIOS || {}));

  // Prevent double init
  if (document.getElementById('aios-root')) {
    console.log('[AIOS] Already initialized, skipping');
    return;
  }

  // Show loading indicator immediately
  const loader = document.createElement('div');
  loader.id = 'aios-loader';
  loader.style.cssText = `
    position: fixed; bottom: 20px; left: 20px; z-index: 9999999;
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
    // Check that all AIOS modules are loaded
    const requiredModules = ['utils', 'storage', 'claude', 'reader', 'actions', 'observer', 'sidebar', 'dashboard', 'aiPanel'];
    const missingModules = requiredModules.filter(m => !AIOS[m]);
    if (missingModules.length > 0) {
      console.error('[AIOS] Missing modules:', missingModules);
      throw new Error(`מודולים חסרים: ${missingModules.join(', ')}`);
    }
    console.log('[AIOS] All modules loaded');

    // Wait for WhatsApp's #app element
    console.log('[AIOS] Waiting for #app element...');
    const appEl = await AIOS.utils.waitForElement('#app', 30000);
    console.log('[AIOS] Found #app element:', appEl.tagName, appEl.className);

    // Wait for WhatsApp to fully render (any of these selectors)
    const chatListSelectors = [
      '[data-testid="chat-list"]',
      '[data-testid="chatlist-header"]',
      '[aria-label="Chat list"]',
      '[aria-label="רשימת צ\'אטים"]',
      '#pane-side',
      '[data-testid="panel-list"]',
      'div[tabindex] > div > div > div[aria-label]',
      // Additional fallback selectors
      'header',
      '[data-testid="default-user"]',
      '[data-testid="menu-bar-icon"]'
    ];

    try {
      console.log('[AIOS] Waiting for WhatsApp UI...');
      await AIOS.utils.waitForAnyElement(chatListSelectors, 25000);
      console.log('[AIOS] WhatsApp UI detected');
    } catch (e) {
      console.warn('[AIOS] WhatsApp UI selectors not matched, proceeding anyway...');
    }

    // Small delay to ensure WhatsApp rendering is complete
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Remove loader
    loader.remove();

    console.log('[AIOS] Injecting AIOS dashboard...');

    // Initialize the dashboard (full takeover)
    AIOS.dashboard.init();
    console.log('[AIOS] Dashboard init done, checking DOM...');
    console.log('[AIOS] aios-root exists:', !!document.getElementById('aios-root'));
    console.log('[AIOS] aios-sidebar exists:', !!document.getElementById('aios-sidebar'));
    console.log('[AIOS] aios-topbar exists:', !!document.getElementById('aios-topbar'));

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
    console.error('[AIOS] Stack:', error.stack);

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

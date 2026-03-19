document.addEventListener('DOMContentLoaded', async () => {
  const apiKeyInput = document.getElementById('apiKey');
  const autoReply = document.getElementById('autoReply');
  const spamFilter = document.getElementById('spamFilter');
  const chatCategories = document.getElementById('chatCategories');

  // Load saved values
  const data = await chrome.storage.local.get(['claude_api_key', 'aios_settings']);

  if (data.claude_api_key) {
    apiKeyInput.value = data.claude_api_key;
  }

  const settings = data.aios_settings || {};
  autoReply.checked = settings.autoReply || false;
  spamFilter.checked = settings.spamFilter || false;
  chatCategories.checked = settings.chatCategories !== false;

  // Save API key
  document.getElementById('saveApi').addEventListener('click', async () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
      showMsg('apiMsg', 'נא להזין מפתח', 'error');
      return;
    }
    await chrome.storage.local.set({ claude_api_key: key });
    showMsg('apiMsg', 'נשמר!', 'success');
  });

  // Save settings
  document.getElementById('saveSettings').addEventListener('click', async () => {
    await chrome.storage.local.set({
      aios_settings: {
        autoReply: autoReply.checked,
        spamFilter: spamFilter.checked,
        chatCategories: chatCategories.checked,
        theme: 'dark'
      }
    });
    showMsg('settingsMsg', 'הגדרות נשמרו!', 'success');
  });

  function showMsg(id, text, type) {
    const el = document.getElementById(id);
    el.textContent = text;
    el.className = `msg ${type}`;
    setTimeout(() => { el.textContent = ''; }, 3000);
  }
});

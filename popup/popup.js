document.addEventListener('DOMContentLoaded', async () => {
  const apiKeyInput = document.getElementById('apiKey');
  const saveBtn = document.getElementById('saveBtn');
  const message = document.getElementById('message');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');

  // Load existing API key
  const result = await chrome.storage.local.get('claude_api_key');
  if (result.claude_api_key) {
    apiKeyInput.value = result.claude_api_key;
    showMessage('מפתח API מוגדר', 'success');
  }

  // Check if WhatsApp tab is open
  const tabs = await chrome.tabs.query({ url: '*://web.whatsapp.com/*' });
  if (tabs.length > 0) {
    statusDot.classList.remove('inactive');
    statusText.textContent = 'AIOS פעיל על WhatsApp';
  } else {
    statusText.textContent = 'WhatsApp Web לא פתוח';
  }

  // Save API key
  saveBtn.addEventListener('click', async () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
      showMessage('נא להזין מפתח API', 'error');
      return;
    }

    if (!key.startsWith('sk-ant-')) {
      showMessage('מפתח API לא תקין', 'error');
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'שומר...';

    await chrome.storage.local.set({ claude_api_key: key });
    showMessage('מפתח API נשמר בהצלחה!', 'success');

    saveBtn.disabled = false;
    saveBtn.textContent = 'שמור מפתח';
  });

  // Open settings
  document.getElementById('openSettings').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  function showMessage(text, type) {
    message.textContent = text;
    message.className = `msg ${type}`;
    setTimeout(() => { message.textContent = ''; }, 3000);
  }
});

async function loadSettings() {
  const data = await chrome.storage.local.get(['username', 'password', 'rememberDays', 'refreshInterval']);
  if (data.username != null)        document.getElementById('username').value = data.username;
  if (data.password != null)        document.getElementById('password').value = data.password;
  if (data.rememberDays != null)    document.getElementById('remember').value = String(data.rememberDays);
  if (data.refreshInterval != null) document.getElementById('refresh-interval').value = String(data.refreshInterval);
}

function showStatus(message, type) {
  const el = document.getElementById('status');
  el.textContent = message;
  el.className = `status ${type}`;
}

document.getElementById('save').addEventListener('click', async () => {
  const username        = document.getElementById('username').value.trim();
  const password        = document.getElementById('password').value;
  const rememberDays    = Number(document.getElementById('remember').value);
  const refreshInterval = Number(document.getElementById('refresh-interval').value);

  if (!username || !password) {
    showStatus('Vul gebruikersnaam en wachtwoord in.', 'error');
    return;
  }

  const btn = document.getElementById('save');
  btn.disabled = true;

  const expiresAt = rememberDays === 0
    ? null
    : Date.now() + rememberDays * 24 * 60 * 60 * 1000;

  await chrome.storage.local.set({ username, password, rememberDays, expiresAt, refreshInterval });
  showStatus('Instellingen opgeslagen.', 'success');
  btn.disabled = false;
});

loadSettings();

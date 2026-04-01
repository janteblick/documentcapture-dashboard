chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
});

// ── Same-origin fetch via tab injection ────────────────────────────────────
// The getcompanysection endpoint returns a partial HTML fragment only when
// called with X-Requested-With: XMLHttpRequest. Sending that header from the
// extension page causes a 500 (server rejects the chrome-extension Origin).
// Workaround: spin up a hidden background tab on the cluster domain so the
// fetch is same-origin, then immediately close it.

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== 'FETCH_COMPANY_LINKS') return;
  fetchViaTab(msg.baseUrl, msg.targetUrl)
    .then(html  => sendResponse({ html }))
    .catch(err  => sendResponse({ error: err.message }));
  return true; // keep message channel open for async response
});

async function fetchViaTab(baseUrl, targetUrl) {
  const tab = await chrome.tabs.create({ url: baseUrl, active: false });
  try {
    await tabComplete(tab.id);
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async url => {
        const r = await fetch(url, {
          credentials: 'include',
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      },
      args: [targetUrl],
    });
    return result;
  } finally {
    chrome.tabs.remove(tab.id).catch(() => {});
  }
}

function tabComplete(tabId) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Tab load timed out')),
      20_000
    );
    chrome.tabs.onUpdated.addListener(function check(id, info) {
      if (id !== tabId || info.status !== 'complete') return;
      chrome.tabs.onUpdated.removeListener(check);
      clearTimeout(timer);
      resolve();
    });
  });
}

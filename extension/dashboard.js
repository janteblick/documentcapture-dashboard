import { loginAndFetchAll }    from './fetcher.js';
import { parseApprovalPage }  from './parser.js';

const CLUSTERS = [
  { name: 'Sneyers',  url: 'https://sneyers.documentcapture.eu' },
  { name: 'Jorssen',  url: 'https://jorssen.documentcapture.eu' },
  { name: 'Gamotors', url: 'https://gamotors.documentcapture.eu' },
  { name: 'Belien',   url: 'https://belien.documentcapture.eu' },
];

// ── Credential helpers ──────────────────────────────────────────────────────

async function getCredentials() {
  const data = await chrome.storage.local.get(['username', 'password', 'expiresAt']);
  if (!data.username || !data.password) return null;
  if (data.expiresAt && Date.now() > data.expiresAt) {
    await chrome.storage.local.remove(['username', 'password', 'expiresAt']);
    return null;
  }
  return { username: data.username, password: data.password };
}

// ── Render helpers ──────────────────────────────────────────────────────────

function renderNotConfigured() {
  document.getElementById('main-content').innerHTML = `
    <div class="not-configured">
      <p>No credentials configured or the remember period has expired.</p>
      <p><a href="#" id="open-options">Open settings</a></p>
    </div>`;
  document.getElementById('open-options')?.addEventListener('click', e => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
}

function renderInitialCards(clusters) {
  document.getElementById('main-content').innerHTML = clusters.map(c => `
    <div class="cluster-card" data-cluster="${c.name}">
      <div class="cluster-header">
        <span class="cluster-name">${c.name}</span>
        <span class="cluster-count">…</span>
        <a href="${c.url}" target="_blank" class="cluster-open-btn">Open ↗</a>
      </div>
      <div class="cluster-body">
        <div class="loading"><span class="spinner"></span> Loading…</div>
      </div>
    </div>`).join('');
}

function renderClusterResult(clusterName, result) {
  const card = document.querySelector(`[data-cluster="${clusterName}"]`);
  if (!card) return;

  const countEl = card.querySelector('.cluster-count');
  const bodyEl  = card.querySelector('.cluster-body');

  if (result.error) {
    countEl.textContent = '!';
    countEl.className   = 'cluster-count error';
    const errDiv = document.createElement('div');
    errDiv.className = 'error-state';
    errDiv.textContent = result.error;
    bodyEl.replaceChildren(errDiv);
    return;
  }

  const allInvoices = result.companies.flatMap(c => c.invoices);
  const total       = allInvoices.length;

  countEl.textContent = total;
  countEl.className   = total === 0 ? 'cluster-count zero' : 'cluster-count';

  bodyEl.innerHTML = result.companies
    .map(c => `
      <div class="company-group">
        <div class="company-name">
          <a href="${c.url}" target="_blank" class="company-link">${c.name}</a>
          <span class="inv-badge">${c.invoices.length}</span>
        </div>
        ${c.invoices.length === 0
          ? '<div class="no-invoices">✓ No pending approvals</div>'
          : `<table class="invoice-table">
          <thead>
            <tr><th>Document</th><th>Name</th><th>Amount</th></tr>
          </thead>
          <tbody>
            ${c.invoices.map(inv => `
              <tr>
                <td>${inv.number}</td>
                <td>${inv.vendor}</td>
                <td>${inv.amount}</td>
              </tr>`).join('')}
          </tbody>
        </table>`
        }
      </div>`).join('');
}

function updateFooter(results) {
  const total  = results.flatMap(r => r.companies ?? []).flatMap(c => c.invoices).length;
  const errors = results.filter(r => r.error).map(r => r.clusterName);

  document.getElementById('total-count').textContent = `Total pending: ${total}`;
  document.getElementById('error-summary').textContent = errors.length
    ? `Errors: ${errors.join(', ')}` : '';

  document.getElementById('last-updated').textContent =
    `Updated: ${new Date().toLocaleTimeString('en-BE')}`;
}

// ── Main refresh ────────────────────────────────────────────────────────────

let refreshInProgress = false;

async function refresh() {
  if (refreshInProgress) return;
  refreshInProgress = true;
  document.getElementById('refresh-btn').disabled = true;

  const creds = await getCredentials();
  if (!creds) {
    renderNotConfigured();
    document.getElementById('refresh-btn').disabled = false;
    refreshInProgress = false;
    return;
  }

  const { enabledClusters } = await chrome.storage.local.get('enabledClusters');
  const activeClusters = enabledClusters
    ? CLUSTERS.filter(c => enabledClusters.includes(c.name))
    : CLUSTERS;

  renderInitialCards(activeClusters);

  const results = await Promise.all(
    activeClusters.map(async cluster => {
      try {
        const { companies: rawCompanies } = await loginAndFetchAll(cluster.url, creds.username, creds.password);
        const companies = rawCompanies.map(({ name, html, url }) => ({
          name,
          url,
          invoices: parseApprovalPage(html).invoices,
        }));
        renderClusterResult(cluster.name, { companies });
        return { clusterName: cluster.name, companies };
      } catch (err) {
        const errorResult = { error: err.message };
        renderClusterResult(cluster.name, errorResult);
        return { clusterName: cluster.name, error: err.message, companies: [] };
      }
    })
  );

  updateFooter(results);
  document.getElementById('refresh-btn').disabled = false;
  refreshInProgress = false;
}

// ── Auto-refresh ────────────────────────────────────────────────────────────

chrome.storage.local.get('refreshInterval', data => {
  const minutes = data.refreshInterval ?? 5;
  setInterval(refresh, minutes * 60 * 1000);
});

// ── Event listeners ─────────────────────────────────────────────────────────

document.getElementById('refresh-btn').addEventListener('click', refresh);
document.getElementById('settings-link').addEventListener('click', e => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

// ── Initial load ─────────────────────────────────────────────────────────────
refresh();

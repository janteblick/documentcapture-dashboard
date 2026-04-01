import { loginAndFetch }              from './fetcher.js';
import { parseApprovalPage, CONFIG }  from './parser.js';

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
      <p>Geen inloggegevens ingesteld of de onthoud-periode is verlopen.</p>
      <p><a href="#" id="open-options">Open instellingen</a></p>
    </div>`;
  document.getElementById('open-options')?.addEventListener('click', e => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
}

function renderInitialCards() {
  document.getElementById('main-content').innerHTML = CLUSTERS.map(c => `
    <div class="cluster-card" data-cluster="${c.name}">
      <div class="cluster-header">
        <span class="cluster-name">${c.name}</span>
        <span class="cluster-count">…</span>
        <a href="${c.url}" target="_blank" class="cluster-open-btn">Openen ↗</a>
      </div>
      <div class="cluster-body">
        <div class="loading"><span class="spinner"></span> Laden…</div>
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
    bodyEl.innerHTML    = `<div class="error-state">${result.error}</div>`;
    return;
  }

  const allInvoices = result.companies.flatMap(c => c.invoices);
  const total       = allInvoices.length;

  countEl.textContent = total;
  countEl.className   = total === 0 ? 'cluster-count zero' : 'cluster-count';

  if (total === 0) {
    bodyEl.innerHTML = '<div class="no-invoices">✓ Geen openstaande facturen</div>';
    return;
  }

  const hasVendor = allInvoices.some(inv => inv.vendor);

  bodyEl.innerHTML = result.companies
    .filter(c => c.invoices.length > 0)
    .map(c => `
      <div class="company-group">
        <div class="company-name">
          ${c.name}
          <span class="inv-badge">${c.invoices.length}</span>
        </div>
        <table class="invoice-table">
          <thead>
            <tr>
              <th>Nummer</th><th>Datum</th><th>Bedrag</th>
              ${hasVendor ? '<th>Leverancier</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${c.invoices.map(inv => `
              <tr>
                <td>${inv.number}</td>
                <td>${inv.date}</td>
                <td>${inv.amount}</td>
                ${hasVendor ? `<td>${inv.vendor || ''}</td>` : ''}
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`).join('');
}

function updateFooter(results) {
  const total  = results.flatMap(r => r.companies ?? []).flatMap(c => c.invoices).length;
  const errors = results.filter(r => r.error).map(r => r.clusterName);

  document.getElementById('total-count').textContent = `Totaal openstaand: ${total}`;
  document.getElementById('error-summary').textContent = errors.length
    ? `Fouten: ${errors.join(', ')}` : '';

  document.getElementById('last-updated').textContent =
    `Bijgewerkt: ${new Date().toLocaleTimeString('nl-BE')}`;
}

// ── Main refresh ────────────────────────────────────────────────────────────

async function refresh() {
  document.getElementById('refresh-btn').disabled = true;

  const creds = await getCredentials();
  if (!creds) {
    renderNotConfigured();
    document.getElementById('refresh-btn').disabled = false;
    return;
  }

  renderInitialCards();

  const results = await Promise.all(
    CLUSTERS.map(async cluster => {
      try {
        const html   = await loginAndFetch(cluster.url, creds.username, creds.password, CONFIG.approvalPath);
        const parsed = parseApprovalPage(html);
        renderClusterResult(cluster.name, parsed);
        return { clusterName: cluster.name, companies: parsed.companies };
      } catch (err) {
        const errorResult = { error: err.message };
        renderClusterResult(cluster.name, errorResult);
        return { clusterName: cluster.name, error: err.message, companies: [] };
      }
    })
  );

  updateFooter(results);
  document.getElementById('refresh-btn').disabled = false;
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

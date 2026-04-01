# DocumentCapture Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome/Edge extension that opens a full-page dashboard tab showing pending invoice approval counts and lists across 4 Continia Document Capture clusters.

**Architecture:** A Manifest V3 Chrome extension where the dashboard page (`dashboard.html`) performs all HTTP communication via the Fetch API — extension `host_permissions` bypass CORS. Credentials are stored in `chrome.storage.local` with configurable expiry. HTML parsing (pure functions) lives in `parser.js`; HTTP logic lives in `fetcher.js`; `dashboard.js` orchestrates everything.

**Tech Stack:** HTML, CSS, Vanilla JavaScript (ES modules), Chrome Extension Manifest V3, `chrome.storage` API, Fetch API, DOMParser

---

## File Map

| File | Responsibility |
|---|---|
| `extension/manifest.json` | Extension manifest, permissions, host permissions |
| `extension/background.js` | Service worker: opens dashboard tab on icon click |
| `extension/fetcher.js` | Login to a cluster + fetch the approval page HTML |
| `extension/parser.js` | Parse approval HTML → structured data (pure functions, testable) |
| `extension/dashboard.html` | Dashboard tab markup |
| `extension/dashboard.css` | Dashboard styles |
| `extension/dashboard.js` | Orchestrates fetch + parse + render; handles UI events |
| `extension/options.html` | Settings page markup |
| `extension/options.css` | Settings page styles |
| `extension/options.js` | Save/load credentials + remember-me + refresh interval |
| `extension/icons/generate.html` | One-time icon generator (Canvas → PNG download) |
| `extension/tests/test-parser.html` | Browser-based unit tests for `parser.js` |

---

### Task 1: Project scaffolding

**Files:**
- Create: `extension/manifest.json`
- Create: `extension/background.js`
- Create: `extension/icons/generate.html`

- [ ] **Step 1: Create folder structure**

```bash
mkdir -p extension/icons extension/tests
```

- [ ] **Step 2: Create `extension/manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "DocumentCapture Dashboard",
  "version": "1.0.0",
  "description": "Overzicht openstaande factuurgoedkeuringen over alle clusters",
  "permissions": ["storage"],
  "host_permissions": [
    "https://sneyers.documentcapture.eu/*",
    "https://jorssen.documentcapture.eu/*",
    "https://gamotors.documentcapture.eu/*",
    "https://belien.documentcapture.eu/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "action": {
    "default_title": "DocumentCapture Dashboard",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "options_ui": {
    "page": "options.html",
    "open_in_tab": true
  }
}
```

- [ ] **Step 3: Create `extension/background.js`**

```javascript
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
});
```

- [ ] **Step 4: Create `extension/icons/generate.html` and generate the icons**

Create the file, then open it in Chrome. Three PNG files are automatically downloaded. Move them to `extension/icons/`.

```html
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Icon generator</title></head>
<body>
<p>Generating icons…</p>
<script>
['16','48','128'].forEach(size => {
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1a73e8';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.round(size * 0.45)}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('DC', size / 2, size / 2);
  canvas.toBlob(blob => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `icon${size}.png`;
    document.body.appendChild(a);
    a.click();
  });
});
</script>
<p>3 downloads gestart: icon16.png, icon48.png, icon128.png — verplaats naar <code>extension/icons/</code></p>
</body>
</html>
```

- [ ] **Step 5: Load the extension in Chrome**

1. Open `chrome://extensions/`
2. Schakel "Ontwikkelaarsmodus" in (rechts bovenaan)
3. Klik "Uitgepakte extensie laden" → selecteer de `extension/` map
4. Verwacht: extensie staat in de lijst zonder foutmeldingen
5. Klik op het extensie-icoon → een nieuwe tab probeert te openen (fout verwacht, `dashboard.html` bestaat nog niet — OK)

- [ ] **Step 6: Commit**

```bash
git add extension/
git commit -m "feat: extension scaffolding and manifest"
```

---

### Task 2: Options page

**Files:**
- Create: `extension/options.html`
- Create: `extension/options.css`
- Create: `extension/options.js`

- [ ] **Step 1: Create `extension/options.html`**

```html
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <title>Instellingen — DocumentCapture Dashboard</title>
  <link rel="stylesheet" href="options.css">
</head>
<body>
  <main>
    <h1>Instellingen</h1>

    <section>
      <h2>Inloggegevens</h2>

      <label for="username">Gebruikersnaam</label>
      <input type="text" id="username" placeholder="DOMEIN\gebruikersnaam" autocomplete="username">

      <label for="password">Wachtwoord</label>
      <input type="password" id="password" autocomplete="current-password">

      <label for="remember">Onthoud inloggegevens</label>
      <select id="remember">
        <option value="1">1 dag</option>
        <option value="7" selected>7 dagen</option>
        <option value="30">30 dagen</option>
        <option value="0">Altijd</option>
      </select>

      <label for="refresh-interval">Automatisch vernieuwen</label>
      <select id="refresh-interval">
        <option value="1">Elke minuut</option>
        <option value="5" selected>Elke 5 minuten</option>
        <option value="15">Elke 15 minuten</option>
        <option value="30">Elke 30 minuten</option>
      </select>
    </section>

    <div class="actions">
      <button id="save">Opslaan</button>
    </div>

    <div id="status" class="status hidden"></div>
  </main>
  <script type="module" src="options.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `extension/options.css`**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; color: #333; }
main { max-width: 480px; margin: 40px auto; background: #fff; padding: 32px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,.1); }
h1 { font-size: 1.4rem; margin-bottom: 24px; color: #1a73e8; }
h2 { font-size: 1rem; margin-bottom: 16px; color: #555; font-weight: 600; }
section { margin-bottom: 24px; }
label { display: block; font-size: .85rem; font-weight: 500; margin-bottom: 4px; margin-top: 14px; color: #555; }
input, select { width: 100%; padding: 8px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: .95rem; }
input:focus, select:focus { outline: none; border-color: #1a73e8; }
.actions { margin-top: 20px; }
button { background: #1a73e8; color: #fff; border: none; padding: 10px 24px; border-radius: 4px; font-size: .95rem; cursor: pointer; }
button:hover { background: #1558b0; }
button:disabled { background: #aaa; cursor: default; }
.status { margin-top: 16px; padding: 10px 14px; border-radius: 4px; font-size: .9rem; }
.status.success { background: #e6f4ea; color: #137333; }
.status.error { background: #fce8e6; color: #c5221f; }
.hidden { display: none; }
```

- [ ] **Step 3: Create `extension/options.js`**

```javascript
async function loadSettings() {
  const data = await chrome.storage.local.get(['username', 'password', 'rememberDays', 'refreshInterval']);
  if (data.username)        document.getElementById('username').value = data.username;
  if (data.password)        document.getElementById('password').value = data.password;
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

  const expiresAt = rememberDays === 0
    ? null
    : Date.now() + rememberDays * 24 * 60 * 60 * 1000;

  await chrome.storage.local.set({ username, password, rememberDays, expiresAt, refreshInterval });
  showStatus('Instellingen opgeslagen.', 'success');
});

loadSettings();
```

- [ ] **Step 4: Verify**

1. Herlaad de extensie in `chrome://extensions/`
2. Klik rechts op het extensie-icoon → "Opties" (of via Details → Extensieopties)
3. Vul gebruikersnaam en wachtwoord in, klik "Opslaan"
4. Verwacht: groene melding "Instellingen opgeslagen."
5. Open DevTools op de optiespagina → Application → Storage → Extension Storage → controleer dat `username`, `password`, `expiresAt` aanwezig zijn

- [ ] **Step 5: Commit**

```bash
git add extension/options.html extension/options.css extension/options.js
git commit -m "feat: options page with credential and refresh-interval storage"
```

---

### Task 3: Login module (fetcher.js)

**Files:**
- Create: `extension/fetcher.js`

- [ ] **Step 1: Create `extension/fetcher.js`**

```javascript
/**
 * Logs into a Continia Document Capture cluster and fetches the approval page.
 *
 * @param {string} baseUrl      e.g. 'https://sneyers.documentcapture.eu'
 * @param {string} username
 * @param {string} password
 * @param {string} approvalPath e.g. '/Approval'
 * @returns {Promise<string>}   HTML of the approval page
 * @throws {Error}              On login failure or network error
 */
export async function loginAndFetch(baseUrl, username, password, approvalPath) {
  // Step 1: GET login page — extract CSRF token and form action
  const loginPageRes = await fetch(`${baseUrl}/Account/Login`, {
    credentials: 'include',
    mode: 'cors',
  });
  if (!loginPageRes.ok) {
    throw new Error(`Loginpagina niet bereikbaar (HTTP ${loginPageRes.status})`);
  }

  const loginHtml = await loginPageRes.text();
  const loginDoc  = new DOMParser().parseFromString(loginHtml, 'text/html');

  const tokenEl = loginDoc.querySelector('input[name="__RequestVerificationToken"]');
  const token   = tokenEl ? tokenEl.value : null;

  const formEl   = loginDoc.querySelector('#loginform') || loginDoc.querySelector('form[method="post"]');
  const rawAction = formEl ? (formEl.getAttribute('action') || '/Account/Login') : '/Account/Login';
  const formAction = new URL(rawAction, baseUrl).href;

  // Step 2: POST credentials
  const body = new URLSearchParams({ Email_Username: username, Password: password });
  if (token) body.append('__RequestVerificationToken', token);

  const loginRes = await fetch(formAction, {
    method: 'POST',
    credentials: 'include',
    mode: 'cors',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    redirect: 'follow',
  });
  if (!loginRes.ok) {
    throw new Error(`Login request mislukt (HTTP ${loginRes.status})`);
  }

  const finalPath = new URL(loginRes.url).pathname.toLowerCase();
  if (finalPath.includes('/account/login')) {
    throw new Error('Login mislukt — controleer gebruikersnaam en wachtwoord');
  }

  // Step 3: Fetch approval page
  const approvalUrl = new URL(approvalPath, baseUrl).href;
  const approvalRes = await fetch(approvalUrl, {
    credentials: 'include',
    mode: 'cors',
  });
  if (!approvalRes.ok) {
    throw new Error(`Goedkeuringspagina niet bereikbaar (HTTP ${approvalRes.status})`);
  }

  return approvalRes.text();
}
```

- [ ] **Step 2: Manual smoke test**

1. Zorg dat credentials ingesteld zijn (Task 2)
2. Ga naar `chrome://extensions/` → DocumentCapture Dashboard → klik "Serviceworkerpagina inspecteren"
3. Plak in de console:

```javascript
const { loginAndFetch } = await import(chrome.runtime.getURL('fetcher.js'));
const html = await loginAndFetch(
  'https://sneyers.documentcapture.eu',
  (await chrome.storage.local.get('username')).username,
  (await chrome.storage.local.get('password')).password,
  '/Approval'   // tijdelijk pad — wordt bijgewerkt na Task 4
);
console.log('Login OK, begin van HTML:', html.substring(0, 300));
```

Verwacht: console toont HTML (geen loginpagina-content).  
Als je een fout ziet over het pad `/Approval`: dat is normaal als het pad nog niet klopt — login zelf werkt dan al wel. Controleer `html.substring(0,300)` voor aanwijzingen over het juiste pad.

- [ ] **Step 3: Commit**

```bash
git add extension/fetcher.js
git commit -m "feat: cluster login and approval page fetch module"
```

---

### Task 4: Discovery — goedkeuringspagina URL en HTML-structuur

**Doel:** Bepaal het exacte URL-pad van de goedkeuringslijst en de CSS-selectors voor bedrijven en facturen. Geen code te schrijven — noteer de resultaten zodat je ze in Task 5 kunt invullen.

- [ ] **Step 1: Log handmatig in en navigeer naar de goedkeuringslijst**

1. Open Chrome en ga naar `https://sneyers.documentcapture.eu/`
2. Log in met je credentials
3. Navigeer naar de pagina met openstaande facturen ter goedkeuring
4. **Noteer het URL-pad** (het deel na `sneyers.documentcapture.eu`, bijv. `/Approval/Index`) → dit wordt `APPROVAL_PATH` in Task 5

- [ ] **Step 2: Voer het discovery-script uit in DevTools console (F12 → Console)**

```javascript
console.log('=== APPROVAL_PATH ===');
console.log(location.pathname);

console.log('\n=== Tabellen ===');
document.querySelectorAll('table').forEach((t, i) => {
  const rows = t.querySelectorAll('tr');
  console.log(`Table[${i}]: id="${t.id}" class="${t.className}" rows=${rows.length}`);
  if (rows[0]) console.log('  Rij 0:', rows[0].innerText.replace(/\s+/g,' ').trim().substring(0,120));
  if (rows[1]) console.log('  Rij 1:', rows[1].innerText.replace(/\s+/g,' ').trim().substring(0,120));
});

console.log('\n=== Bedrijfscontainers ===');
[...document.querySelectorAll('*')].filter(el =>
  /company|tenant|group|section|panel|card/i.test(el.className + el.id)
).slice(0, 12).forEach(el =>
  console.log(`${el.tagName}: id="${el.id}" class="${el.className.substring(0,80)}"`)
);

console.log('\n=== Tellers / badges ===');
[...document.querySelectorAll('*')].filter(el =>
  /count|badge|total|pending|aantal/i.test(el.className + el.id) && el.innerText.trim().length < 10
).slice(0, 8).forEach(el =>
  console.log(`${el.tagName}: "${el.innerText.trim()}" class="${el.className}"`)
);
```

- [ ] **Step 3: Noteer de resultaten**

Bewaar de console-output. Bepaal uit de output:

| Variabele | Waarde (in te vullen) |
|---|---|
| `APPROVAL_PATH` | bijv. `/Approval/Index` |
| `COMPANY_SELECTOR` | CSS-selector voor container per bedrijf |
| `COMPANY_NAME_SELECTOR` | CSS-selector voor de naam binnen de container |
| `INVOICE_ROW_SELECTOR` | CSS-selector voor één factuur-rij |
| `INVOICE_NUMBER_SELECTOR` | CSS-selector voor het factuurnummer |
| `INVOICE_DATE_SELECTOR` | CSS-selector voor de datum |
| `INVOICE_AMOUNT_SELECTOR` | CSS-selector voor het bedrag |
| `INVOICE_VENDOR_SELECTOR` | CSS-selector voor de leverancier (leeglaten als niet aanwezig) |

→ Gebruik deze waarden in **Task 5, Step 1** om de `CONFIG` in `parser.js` in te vullen.

---

### Task 5: Parser module + browser tests

**Files:**
- Create: `extension/parser.js`
- Create: `extension/tests/test-parser.html`

- [ ] **Step 1: Create `extension/parser.js` — vul CONFIG in met waarden uit Task 4**

```javascript
// parser.js
// Pure functions: HTML string → structured data objects. No side effects, no network calls.

/**
 * UPDATE these selectors with your findings from Task 4.
 * The defaults below use common Bootstrap/table patterns as a starting point.
 */
export const CONFIG = {
  approvalPath:           '/Approval',              // UPDATE: exact path from Task 4
  companySelector:        '.company-group',         // UPDATE: container per bedrijf
  companyNameSelector:    'h3, h4, .company-name',  // UPDATE
  invoiceRowSelector:     'tbody tr',               // UPDATE
  invoiceNumberSelector:  'td:nth-child(1)',         // UPDATE
  invoiceDateSelector:    'td:nth-child(2)',         // UPDATE
  invoiceAmountSelector:  'td:nth-child(3)',         // UPDATE
  invoiceVendorSelector:  'td:nth-child(4)',         // UPDATE or leave empty string '' if absent
};

/**
 * Parses the approval page HTML into structured data.
 * @param {string} html
 * @returns {{ companies: Array<{ name: string, invoices: Array<{ number: string, date: string, amount: string, vendor: string }> }> }}
 */
export function parseApprovalPage(html) {
  const doc          = new DOMParser().parseFromString(html, 'text/html');
  const companyEls   = doc.querySelectorAll(CONFIG.companySelector);
  const companies    = [];

  if (companyEls.length === 0) {
    // Fallback: no company grouping found — treat entire page as one unnamed group
    const invoices = extractInvoices(doc.body);
    if (invoices.length > 0) companies.push({ name: '(alle)', invoices });
    return { companies };
  }

  companyEls.forEach(container => {
    const nameEl = container.querySelector(CONFIG.companyNameSelector);
    const name   = nameEl ? nameEl.textContent.trim() : '(onbekend)';
    const invoices = extractInvoices(container);
    companies.push({ name, invoices });
  });

  return { companies };
}

function extractInvoices(container) {
  const rows    = container.querySelectorAll(CONFIG.invoiceRowSelector);
  const result  = [];
  rows.forEach(row => {
    const number = cell(row, CONFIG.invoiceNumberSelector);
    const date   = cell(row, CONFIG.invoiceDateSelector);
    const amount = cell(row, CONFIG.invoiceAmountSelector);
    const vendor = CONFIG.invoiceVendorSelector ? cell(row, CONFIG.invoiceVendorSelector) : '';
    if (number) result.push({ number, date, amount, vendor });
  });
  return result;
}

function cell(row, selector) {
  if (!selector) return '';
  const el = row.querySelector(selector);
  return el ? el.textContent.trim() : '';
}
```

- [ ] **Step 2: Create `extension/tests/test-parser.html`**

```html
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <title>Parser tests</title>
  <style>
    body { font-family: monospace; padding: 20px; background: #1e1e1e; color: #d4d4d4; }
    .pass { color: #4ec9b0; } .fail { color: #f44747; }
    h1 { color: #9cdcfe; margin-bottom: 12px; } h2 { color: #9cdcfe; margin-top: 16px; }
  </style>
</head>
<body>
<h1>Parser unit tests</h1>
<div id="results"></div>
<script type="module">
import { parseApprovalPage } from '../parser.js';

const out = document.getElementById('results');
let passed = 0, failed = 0;

function assert(desc, condition) {
  const el = document.createElement('div');
  if (condition) { el.className = 'pass'; el.textContent = `✓ ${desc}`; passed++; }
  else           { el.className = 'fail'; el.textContent = `✗ ${desc}`; failed++; }
  out.appendChild(el);
}

// Test 1: empty HTML → no companies
const r1 = parseApprovalPage('<html><body></body></html>');
assert('Lege HTML geeft geen bedrijven', r1.companies.length === 0);

// Test 2: fallback — no company groups, plain table with invoice rows
const r2 = parseApprovalPage(`
  <html><body>
    <table><tbody>
      <tr><td>FAC-001</td><td>01/04/2026</td><td>1.250,00</td><td>Leverancier A</td></tr>
      <tr><td>FAC-002</td><td>02/04/2026</td><td>880,00</td><td>Leverancier B</td></tr>
    </tbody></table>
  </body></html>`);
assert('Fallback: 2 facturen gevonden zonder bedrijfsgroep', r2.companies[0]?.invoices.length === 2);
assert('Factuurnummer correct uitgelezen',  r2.companies[0]?.invoices[0]?.number === 'FAC-001');
assert('Datum correct uitgelezen',          r2.companies[0]?.invoices[0]?.date === '01/04/2026');
assert('Bedrag correct uitgelezen',         r2.companies[0]?.invoices[1]?.amount === '880,00');
assert('Leverancier correct uitgelezen',    r2.companies[0]?.invoices[1]?.vendor === 'Leverancier B');

// Test 3: header row in tbody (should be skipped — no "number" in th)
const r3 = parseApprovalPage(`
  <html><body>
    <table>
      <thead><tr><th>Nr</th><th>Datum</th><th>Bedrag</th></tr></thead>
      <tbody>
        <tr><td>FAC-003</td><td>03/04/2026</td><td>500,00</td></tr>
      </tbody>
    </table>
  </body></html>`);
assert('Slechts 1 factuur (header niet meegeteld)', r3.companies[0]?.invoices.length === 1);
assert('Juist factuurnummer in rij 1', r3.companies[0]?.invoices[0]?.number === 'FAC-003');

const summary = document.createElement('h2');
summary.textContent = `${passed} geslaagd, ${failed} mislukt`;
out.appendChild(summary);
</script>
</body>
</html>
```

- [ ] **Step 3: Run the tests**

Navigeer naar de testpagina in Chrome:
- Ga naar `chrome://extensions/` → DocumentCapture Dashboard → extensie-ID kopiëren
- Open: `chrome-extension://<extensie-id>/tests/test-parser.html`

Verwacht: **5 geslaagd, 0 mislukt**

- [ ] **Step 4: Commit**

```bash
git add extension/parser.js extension/tests/test-parser.html
git commit -m "feat: HTML parser with browser unit tests"
```

---

### Task 6: Dashboard HTML + CSS

**Files:**
- Create: `extension/dashboard.html`
- Create: `extension/dashboard.css`

- [ ] **Step 1: Create `extension/dashboard.html`**

```html
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <title>DocumentCapture Dashboard</title>
  <link rel="stylesheet" href="dashboard.css">
</head>
<body>
  <header>
    <div class="header-left">
      <h1>DocumentCapture Dashboard</h1>
      <span id="last-updated" class="subtitle"></span>
    </div>
    <div class="header-right">
      <button id="refresh-btn">↺ Vernieuwen</button>
      <a href="#" id="settings-link">Instellingen</a>
    </div>
  </header>

  <main id="main-content">
    <!-- Rendered by dashboard.js -->
  </main>

  <footer>
    <span id="total-count"></span>
    <span id="error-summary"></span>
  </footer>

  <script type="module" src="dashboard.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `extension/dashboard.css`**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f0f4f8;
  color: #2d3748;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* ── Header ── */
header {
  background: #1a73e8;
  color: #fff;
  padding: 14px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 6px rgba(0,0,0,.2);
  flex-shrink: 0;
}
header h1    { font-size: 1.2rem; font-weight: 600; }
.subtitle    { font-size: .8rem; opacity: .8; margin-left: 12px; }
.header-right { display: flex; gap: 12px; align-items: center; }

#refresh-btn {
  background: rgba(255,255,255,.2);
  color: #fff;
  border: 1px solid rgba(255,255,255,.4);
  padding: 6px 14px;
  border-radius: 4px;
  cursor: pointer;
  font-size: .9rem;
}
#refresh-btn:hover    { background: rgba(255,255,255,.3); }
#refresh-btn:disabled { opacity: .5; cursor: default; }

#settings-link { color: rgba(255,255,255,.85); font-size: .85rem; text-decoration: none; }
#settings-link:hover { color: #fff; }

/* ── Main grid ── */
main {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: 20px;
  padding: 24px;
  align-content: start;
}

/* ── Cluster card ── */
.cluster-card {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0,0,0,.1);
  overflow: hidden;
}
.cluster-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
  gap: 12px;
}
.cluster-name  { font-size: 1.05rem; font-weight: 600; flex: 1; }
.cluster-count { font-size: 1.5rem; font-weight: 700; color: #1a73e8; }
.cluster-count.zero  { color: #38a169; }
.cluster-count.error { color: #e53e3e; font-size: 1rem; }

.cluster-open-btn {
  background: #1a73e8;
  color: #fff;
  border: none;
  padding: 6px 14px;
  border-radius: 4px;
  cursor: pointer;
  font-size: .82rem;
  text-decoration: none;
  white-space: nowrap;
}
.cluster-open-btn:hover { background: #1558b0; }

.cluster-body { padding: 0 20px 16px; }

/* ── Company group ── */
.company-group  { margin-top: 14px; }
.company-name   { font-size: .85rem; font-weight: 600; color: #4a5568; margin-bottom: 6px; }
.inv-badge {
  display: inline-block;
  background: #ebf4ff;
  color: #1a73e8;
  border-radius: 12px;
  padding: 1px 8px;
  font-size: .75rem;
  margin-left: 6px;
}

/* ── Invoice table ── */
.invoice-table { width: 100%; border-collapse: collapse; font-size: .82rem; }
.invoice-table th {
  text-align: left;
  padding: 4px 8px;
  color: #718096;
  font-weight: 500;
  border-bottom: 1px solid #e2e8f0;
}
.invoice-table td { padding: 5px 8px; border-bottom: 1px solid #f0f0f0; }
.invoice-table tr:last-child td { border-bottom: none; }

/* ── States ── */
.loading {
  padding: 28px;
  text-align: center;
  color: #718096;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}
.no-invoices  { padding: 14px 0; color: #38a169; font-size: .9rem; }
.error-state  { padding: 10px; color: #c5221f; font-size: .88rem; background: #fff5f5; border-radius: 4px; margin-top: 10px; }
.not-configured { padding: 48px; text-align: center; color: #718096; line-height: 1.8; }
.not-configured a { color: #1a73e8; }

/* ── Footer ── */
footer {
  background: #2d3748;
  color: #cbd5e0;
  padding: 8px 24px;
  font-size: .82rem;
  display: flex;
  justify-content: space-between;
  flex-shrink: 0;
}
#error-summary { color: #fc8181; }

/* ── Spinner ── */
@keyframes spin { to { transform: rotate(360deg); } }
.spinner {
  display: inline-block;
  width: 18px; height: 18px;
  border: 2px solid #e2e8f0;
  border-top-color: #1a73e8;
  border-radius: 50%;
  animation: spin .7s linear infinite;
  flex-shrink: 0;
}
```

- [ ] **Step 3: Verify**

1. Herlaad extensie in `chrome://extensions/`
2. Klik op extensie-icoon → dashboard-tab opent
3. Pagina toont een lege witte pagina met blauwe header — geen JS-fouten in console (F12)

- [ ] **Step 4: Commit**

```bash
git add extension/dashboard.html extension/dashboard.css
git commit -m "feat: dashboard HTML and CSS layout"
```

---

### Task 7: Dashboard controller (dashboard.js)

**Files:**
- Create: `extension/dashboard.js`

- [ ] **Step 1: Create `extension/dashboard.js`**

```javascript
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
```

- [ ] **Step 2: Verify — full end-to-end test**

1. Herlaad extensie, klik op icoon → dashboard opent
2. Verwacht: 4 cluster-cards tonen, spinners starten, dan resultaten (of foutmeldingen als `CONFIG.approvalPath` nog niet klopt)
3. Controleer: "Vernieuwen"-knop wordt disabled tijdens laden, daarna weer actief
4. Controleer: footertekst "Totaal openstaand: X" en tijdstempel
5. Test foutscenario: stel een verkeerd wachtwoord in → alle cards tonen rode foutmelding, niet één blanke pagina

- [ ] **Step 3: Update `CONFIG.approvalPath` in `parser.js` met de waarde uit Task 4**

Pas de eerste waarde in `CONFIG` aan:
```javascript
export const CONFIG = {
  approvalPath: '/JOUW-PAD-UIT-TASK-4',  // ← hier het werkelijke pad invullen
  ...
};
```

Herhaal Step 2 — nu moeten facturen verschijnen.

- [ ] **Step 4: Commit**

```bash
git add extension/dashboard.js extension/parser.js
git commit -m "feat: dashboard controller wired up end-to-end"
```

---

## Installatie-instructies (samenvatting voor eindgebruiker)

1. Open `extension/icons/generate.html` in Chrome → 3 PNG-bestanden worden gedownload → verplaats naar `extension/icons/`
2. Ga naar `chrome://extensions/`
3. Schakel "Ontwikkelaarsmodus" in
4. Klik "Uitgepakte extensie laden" → selecteer de `extension/` map
5. Klik op het extensie-icoon → dashboard opent
6. Klik "Instellingen" → vul credentials in → sla op

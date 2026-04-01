# DocumentCapture Dashboard

A Chrome/Edge extension that shows a consolidated dashboard of pending invoice approvals across multiple [Continia Document Capture](https://www.continia.com/solutions/document-capture/) clusters.

## What it does

Users who need to approve invoices across multiple Document Capture clusters (each at a different subdomain of `documentcapture.eu`) can see everything in one place: per-cluster, per-company invoice counts with direct links to each invoice and company approval page.

![Dashboard screenshot placeholder]

---

## Table of Contents

- [Architecture](#architecture)
- [File structure](#file-structure)
- [How it works](#how-it-works)
- [Known quirks](#known-quirks)
- [Development setup](#development-setup)
- [Adding a new cluster](#adding-a-new-cluster)
- [Packaging a new release](#packaging-a-new-release)
- [Distribution](#distribution)

---

## Architecture

```
User clicks icon
      │
      ▼
dashboard.html  (full-page tab, the UI)
      │  reads credentials & cluster settings
      │  from chrome.storage.local
      │
      ├─► fetcher.js ──► loginToCluster()
      │                  │  GET  /Account/Login  →  extract CSRF token
      │                  │  POST /Account/Login  →  session cookie set
      │                  │  returns: companyCode (first path segment of redirect URL)
      │                  │
      │                  └─► fetchCompanyLinks()  ──► background.js
      │                      (via chrome.runtime.sendMessage)         │
      │                                                               │ opens hidden tab
      │                                                               │ on cluster domain
      │                                                               │ executes same-origin fetch
      │                                                               │ closes tab
      │                                                               │ returns HTML fragment
      │                  ◄──────────────────────────────────────────-─┘
      │                  parses <a href*="/purchase/approval"> links
      │                  returns: [{name, url}]
      │
      │         for each company:
      ├─► fetcher.js ──► fetchPage(url)
      │                  GET /{companyCode}/purchase/approval
      │                  returns: raw HTML string
      │
      ├─► parser.js ──► parseApprovalPage(html)
      │                  queries tr.approvalLine rows
      │                  returns: [{number, vendor, amount, invoiceUrl, pdfUrl}]
      │
      └─► dashboard.js ──► renderClusterResult()
                           builds the UI cards
```

---

## File structure

```
extension/
├── manifest.json          # MV3 manifest — permissions, host_permissions, entry points
├── background.js          # Service worker — opens/closes tabs for same-origin fetches
├── dashboard.html         # Main UI (opened as a tab when icon is clicked)
├── dashboard.js           # Dashboard logic: refresh loop, render, credentials check
├── dashboard.css          # Dashboard styles
├── fetcher.js             # Login + company discovery + page fetching
├── parser.js              # Pure HTML parser — invoice rows → structured objects
├── options.html           # Settings page
├── options.js             # Settings load/save (chrome.storage.local)
├── options.css            # Settings styles
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   ├── icon128.png
│   └── generate.html      # One-time tool: open in Chrome to generate the PNGs
└── tests/
    └── test-parser.html   # In-browser unit tests for parser.js

docs/
├── privacy-policy.html         # Hosted on GitHub Pages (Chrome Web Store requirement)
├── gebruikersinstructies.html  # End-user installation & usage guide
└── superpowers/
    ├── specs/                  # Original design specification
    └── plans/                  # Original implementation plan
```

---

## How it works

### Login flow

Continia Document Capture uses ASP.NET MVC with CSRF tokens. Login is a two-step process:

1. `GET /Account/Login` — extracts `__RequestVerificationToken` from the form
2. `POST /Account/Login` — submits credentials + token; server sets a session cookie and redirects to `/{companyCode}/purchase/approval`

The first path segment of the redirect URL is the "active" company code for this session.

### Company discovery — the CORS workaround

After login, the list of companies in a cluster is loaded by the page's JavaScript via:

```
GET /purchaseapproval/getcompanysection?companycode={code}&menuCode=purchase&subMenuCode=approval
```

This endpoint **requires** the `X-Requested-With: XMLHttpRequest` header (ASP.NET's `IsAjaxRequest()` check) to return the HTML fragment instead of the full page. However, sending a custom header from the extension page triggers CORS preflight behaviour — the server returns **HTTP 500** when it receives `Origin: chrome-extension://...` together with that header.

**Workaround:** `background.js` creates a hidden background tab on the cluster domain (same origin as the server), executes the fetch from within that tab's context, and immediately closes the tab. Same-origin requests bypass CORS entirely.

```js
// background.js
const tab = await chrome.tabs.create({ url: baseUrl, active: false });
// ... wait for load ...
const [{ result }] = await chrome.scripting.executeScript({
  target: { tabId: tab.id },
  func: async url => {
    const r = await fetch(url, {
      credentials: 'include',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    });
    return r.text();
  },
  args: [targetUrl],
});
chrome.tabs.remove(tab.id);
```

This means users will briefly see a tab appear and close during each refresh — this is expected.

### HTML parsing

The approval page is fetched as raw HTML (before JavaScript runs). The raw HTML has a **12-column** table structure for `tr.approvalLine` rows:

| td | Content |
|----|---------|
| 1 | Hidden (group label) |
| 2 | Hidden (group label + count) |
| 3 | Checkbox |
| 4 | Action icons (search / download PDF) |
| **5** | **Document** (invoice number) |
| **6** | **Naam** (vendor name) |
| 7 | Commentaren |
| **8** | **Bedrag excl. BTW** (amount excl. VAT) |
| 9 | Bedrag incl. BTW |
| 10 | Documentdatum |
| 11 | Vervaldatum |
| 12 | Empty |

> ⚠ The rendered DOM (DevTools) shows 10 columns because columns 1–2 are `display:none` and JavaScript adds visual structure. Always verify selectors against the **raw fetched HTML**, not DevTools.

Invoice and PDF URLs are extracted from `data-editurl` attribute and `td:nth-child(4) a[href*="/pdf/"]` respectively.

---

## Known quirks

| Quirk | Detail |
|-------|--------|
| Tab flicker on refresh | Each cluster opens a hidden tab briefly. Expected — required for the CORS workaround. |
| `X-Requested-With` + `chrome-extension` Origin = HTTP 500 | Server CORS middleware crashes when these are combined. Fixed via tab injection. |
| Raw HTML ≠ rendered DOM | The server pre-renders 2 hidden columns (group metadata). Selectors must target raw HTML columns. |
| `#companyList` is empty in raw HTML | The company dropdown is populated by JS after page load. This is why we use `getcompanysection` instead of parsing the main page. |
| Session cookies | All four clusters use the same credentials. The browser's cookie store is shared across extension pages and tabs, so login from one context is valid for subsequent tab-based fetches. |

---

## Development setup

No build tools required. The extension uses ES modules natively.

1. Clone the repo
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked** → select the `extension/` folder
5. Edit files → click **↺** (reload) on the extension card to pick up changes

### Running the parser tests

Open `extension/tests/test-parser.html` directly in Chrome (File → Open). All tests run in the browser and results are shown on the page.

### Regenerating icons

Open `extension/icons/generate.html` in Chrome. It uses `<canvas>` to draw the icons and auto-downloads `icon16.png`, `icon48.png`, `icon128.png`. Move them to `extension/icons/`.

---

## Adding a new cluster

1. **`extension/manifest.json`** — add to `host_permissions`:
   ```json
   "https://newcluster.documentcapture.eu/*"
   ```

2. **`extension/dashboard.js`** — add to the `CLUSTERS` array:
   ```js
   { name: 'Newcluster', url: 'https://newcluster.documentcapture.eu' },
   ```

3. **`extension/options.html`** — add a checkbox:
   ```html
   <label><input type="checkbox" name="cluster" value="Newcluster"> Newcluster</label>
   ```

4. **`extension/options.js`** — add to `ALL_CLUSTERS`:
   ```js
   const ALL_CLUSTERS = ['Sneyers', 'Jorssen', 'Gamotors', 'Belien', 'Newcluster'];
   ```

5. Reload the extension and test.

---

## Packaging a new release

```bash
# 1. Bump the version in manifest.json
# 2. Create the ZIP (Windows PowerShell)
Compress-Archive -Path extension\* -DestinationPath documentcapture-dashboard-vX.Y.Z.zip -Force

# 3. Tag and release on GitHub
gh release create vX.Y.Z documentcapture-dashboard-vX.Y.Z.zip \
  --title "vX.Y.Z — <short description>" \
  --notes "<changelog>"
```

If published on the Chrome Web Store: upload the same ZIP via the [Developer Dashboard](https://chrome.google.com/webstore/devconsole).

---

## Distribution

| Channel | Status | URL |
|---------|--------|-----|
| Chrome Web Store | Pending review | — |
| GitHub Releases | Live | [releases/latest](https://github.com/janteblick/documentcapture-dashboard/releases/latest) |
| End-user guide | Live | [gebruikersinstructies.html](https://janteblick.github.io/documentcapture-dashboard/gebruikersinstructies.html) |
| Privacy policy | Live | [privacy-policy.html](https://janteblick.github.io/documentcapture-dashboard/privacy-policy.html) |

---

## Permissions explained

| Permission | Why |
|-----------|-----|
| `storage` | Saves credentials and settings locally (`chrome.storage.local`) |
| `tabs` | Opens hidden background tabs for same-origin fetches |
| `scripting` | Executes locally-defined fetch functions inside those tabs |
| `host_permissions` | Allows authenticated requests to the four cluster domains |

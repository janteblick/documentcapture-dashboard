/**
 * fetcher.js
 * Handles login to a Continia Document Capture cluster and discovers all companies.
 */

/**
 * Logs into a cluster. Returns the company code extracted from the redirect URL.
 * @param {string} baseUrl  e.g. 'https://sneyers.documentcapture.eu'
 * @param {string} username
 * @param {string} password
 * @returns {Promise<string>} company code (e.g. 'carrossney')
 */
async function loginToCluster(baseUrl, username, password) {
  const loginPageRes = await fetch(`${baseUrl}/Account/Login`, {
    credentials: 'include',
    mode: 'cors',
  });
  if (!loginPageRes.ok) {
    throw new Error(`Login page unreachable (HTTP ${loginPageRes.status})`);
  }

  const loginHtml  = await loginPageRes.text();
  const loginDoc   = new DOMParser().parseFromString(loginHtml, 'text/html');
  const tokenEl    = loginDoc.querySelector('input[name="__RequestVerificationToken"]');
  const token      = tokenEl ? tokenEl.value : null;
  const formEl     = loginDoc.querySelector('#loginform') || loginDoc.querySelector('form[method="post"]');
  const rawAction  = formEl ? (formEl.getAttribute('action') || '/Account/Login') : '/Account/Login';
  const formAction = new URL(rawAction, baseUrl).href;

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
    throw new Error(`Login request failed (HTTP ${loginRes.status})`);
  }

  const finalPath = new URL(loginRes.url).pathname.toLowerCase();
  if (finalPath.includes('/account/login')) {
    throw new Error('Login failed — check username and password');
  }

  // Landing URL is /{companyCode}/purchase/approval — extract the first path segment
  const pathParts   = new URL(loginRes.url).pathname.split('/').filter(Boolean);
  const companyCode = pathParts[0];
  if (!companyCode) throw new Error('Could not determine company code after login');

  return companyCode;
}

/**
 * Fetches all company links for a cluster via the getcompanysection endpoint.
 * The endpoint returns HTML fragments prepended to #companyList by the page's JS.
 * @param {string} baseUrl
 * @param {string} companyCode  current company code (used as the session lookup key)
 * @returns {Promise<Array<{name: string, url: string}>>}
 */
async function fetchCompanyLinks(baseUrl, companyCode) {
  const sectionUrl = new URL(
    `/purchaseapproval/getcompanysection?companycode=${encodeURIComponent(companyCode)}&menuCode=purchase&subMenuCode=approval`,
    baseUrl
  ).href;

  const res = await fetch(sectionUrl, { credentials: 'include', mode: 'cors' });
  if (!res.ok) throw new Error(`Company list unreachable (HTTP ${res.status})`);

  const html = await res.text();
  const doc  = new DOMParser().parseFromString(html, 'text/html');

  // Company links: <a href="/{code}/purchase/approval"><strong>Name</strong>...</a>
  const anchors = Array.from(doc.querySelectorAll('a[href*="/purchase/approval"]'))
    .filter(a => !a.getAttribute('href').includes('/settings'));

  return anchors.map(a => {
    const nameEl = a.querySelector('strong');
    const name   = nameEl
      ? nameEl.textContent.trim()
      : a.textContent.trim().split('\n')[0].trim();
    return { name, url: new URL(a.getAttribute('href'), baseUrl).href };
  });
}

/**
 * Fetches any page using the existing session cookies.
 * @param {string} url
 * @returns {Promise<string>} HTML
 */
export async function fetchPage(url) {
  const res = await fetch(url, { credentials: 'include', mode: 'cors' });
  if (!res.ok) throw new Error(`Page unreachable (HTTP ${res.status}): ${url}`);
  return res.text();
}

/**
 * Full pipeline: login → discover all companies → fetch each company's approval page.
 * @param {string} baseUrl
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{ companies: Array<{ name: string, html: string }> }>}
 */
export async function loginAndFetchAll(baseUrl, username, password) {
  const companyCode  = await loginToCluster(baseUrl, username, password);
  const companyLinks = await fetchCompanyLinks(baseUrl, companyCode);

  if (companyLinks.length === 0) {
    throw new Error('No companies found in this cluster');
  }

  const companies = await Promise.all(
    companyLinks.map(async ({ name, url }) => {
      const html = await fetchPage(url);
      return { name, html };
    })
  );

  return { companies };
}

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

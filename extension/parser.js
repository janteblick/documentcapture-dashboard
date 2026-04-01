// parser.js
// Pure functions: HTML string → structured data objects. No side effects, no network calls.

/**
 * UPDATE these selectors with your findings from Task 4 (discovery).
 * The defaults below use common Bootstrap/table patterns as a starting point.
 */
export const CONFIG = Object.freeze({
  approvalPath:           '/Approval',              // UPDATE: exact path from Task 4
  companySelector:        '.company-group',         // UPDATE: container per bedrijf
  companyNameSelector:    'h3, h4, .company-name',  // UPDATE
  invoiceRowSelector:     'tbody tr',               // UPDATE
  invoiceNumberSelector:  'td:nth-child(1)',         // UPDATE
  invoiceDateSelector:    'td:nth-child(2)',         // UPDATE
  invoiceAmountSelector:  'td:nth-child(3)',         // UPDATE
  invoiceVendorSelector:  'td:nth-child(4)',         // UPDATE or leave empty string '' if absent
});  // Object.freeze prevents accidental mutation across module imports

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

// parser.js
// Pure functions: HTML string → structured data objects. No side effects, no network calls.
// Selectors verified against Continia Document Capture live site on 2026-04-01.

export const CONFIG = Object.freeze({
  invoiceRowSelector:    'tr.approvalLine',  // each invoice row in #approvalsTable
  invoiceNumberSelector: 'td:nth-child(2)',  // "Document" column
  invoiceVendorSelector: 'td:nth-child(3)',  // "Naam" column
  invoiceAmountSelector: 'td:nth-child(5)',  // "Bedrag excl. BTW" column
  invoiceDateSelector:   'td:nth-child(7)',  // "Documentdatum" column
});

/**
 * Parses a single company's approval page HTML.
 * @param {string} html
 * @returns {{ invoices: Array<{ number: string, vendor: string, amount: string, date: string }> }}
 */
export function parseApprovalPage(html) {
  const doc    = new DOMParser().parseFromString(html, 'text/html');
  const rows   = doc.querySelectorAll(CONFIG.invoiceRowSelector);
  const invoices = [];

  rows.forEach(row => {
    const number = cell(row, CONFIG.invoiceNumberSelector);
    const vendor = cell(row, CONFIG.invoiceVendorSelector);
    const amount = cell(row, CONFIG.invoiceAmountSelector);
    const date   = cell(row, CONFIG.invoiceDateSelector);
    if (number) invoices.push({ number, vendor, amount, date });
  });

  return { invoices };
}

function cell(row, selector) {
  const el = row.querySelector(selector);
  return el ? el.textContent.trim() : '';
}

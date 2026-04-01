// parser.js
// Pure functions: HTML string → structured data objects. No side effects, no network calls.
// Selectors verified against Continia Document Capture live site on 2026-04-01.

// Actual column layout (verified 2026-04-01):
// td[1]=checkbox  td[2]=actions  td[3]=Document  td[4]=Naam
// td[5]=Commentaren  td[6]=Bedrag excl.BTW  td[7]=Bedrag incl.BTW
// td[8]=Documentdatum  td[9]=Vervaldatum  td[10]=empty
export const CONFIG = Object.freeze({
  invoiceRowSelector:    'tr.approvalLine',  // each invoice row in #approvalsTable
  invoiceNumberSelector: 'td:nth-child(3)',  // "Document" column
  invoiceVendorSelector: 'td:nth-child(4)',  // "Naam" column
  invoiceAmountSelector: 'td:nth-child(6)',  // "Bedrag excl. BTW" column
});

/**
 * Parses a single company's approval page HTML.
 * @param {string} html
 * @returns {{ invoices: Array<{ number: string, vendor: string, amount: string }> }}
 */
export function parseApprovalPage(html) {
  const doc    = new DOMParser().parseFromString(html, 'text/html');
  const rows   = doc.querySelectorAll(CONFIG.invoiceRowSelector);
  const invoices = [];

  rows.forEach(row => {
    const number = cell(row, CONFIG.invoiceNumberSelector);
    const vendor = cell(row, CONFIG.invoiceVendorSelector);
    const amount = cell(row, CONFIG.invoiceAmountSelector);
    if (number) invoices.push({ number, vendor, amount });
  });

  return { invoices };
}

function cell(row, selector) {
  const el = row.querySelector(selector);
  return el ? el.textContent.trim() : '';
}

// parser.js
// Pure functions: HTML string → structured data objects. No side effects, no network calls.
// Selectors verified against Continia Document Capture live site on 2026-04-01.

// Raw HTML column layout (verified 2026-04-01 via fetch of unrendered HTML):
// td[1]=hidden  td[2]=hidden  td[3]=checkbox  td[4]=actions
// td[5]=Document  td[6]=Naam  td[7]=Commentaren  td[8]=Bedrag excl.BTW
// td[9]=Bedrag incl.BTW  td[10]=Documentdatum  td[11]=Vervaldatum  td[12]=empty
export const CONFIG = Object.freeze({
  invoiceRowSelector:    'tr.approvalLine',  // each invoice row in #approvalsTable
  invoiceNumberSelector: 'td:nth-child(5)',  // "Document" column
  invoiceVendorSelector: 'td:nth-child(6)',  // "Naam" column
  invoiceAmountSelector: 'td:nth-child(8)',  // "Bedrag excl. BTW" column
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
    const number     = cell(row, CONFIG.invoiceNumberSelector);
    const vendor     = cell(row, CONFIG.invoiceVendorSelector);
    const amount     = cell(row, CONFIG.invoiceAmountSelector);
    const invoiceUrl = row.getAttribute('data-editurl') || '';
    const pdfAnchor  = row.querySelector('td:nth-child(4) a[href*="/pdf/"]');
    const pdfUrl     = pdfAnchor ? pdfAnchor.getAttribute('href') : '';
    if (number) invoices.push({ number, vendor, amount, invoiceUrl, pdfUrl });
  });

  return { invoices };
}

function cell(row, selector) {
  const el = row.querySelector(selector);
  return el ? el.textContent.trim() : '';
}

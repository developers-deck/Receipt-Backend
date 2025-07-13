import * as QRCode from 'qrcode';

export class PdfGeneratorService {
  async generateReceiptPdf(receiptData: any): Promise<string> {
    const traLogoUrl = 'https://f004.backblazeb2.com/file/receipts-tanzania/tralogoss.png'; // Replace with actual TRA logo URL
    // Generate QR code as a data URL for the verification URL
    const qrCodeDataUrl = await QRCode.toDataURL(receiptData.verificationCodeUrl || '');
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Legal Receipt</title>
          <link href="https://fonts.googleapis.com/css?family=Nunito+Sans:400,700&display=swap" rel="stylesheet">
          <style>
              body { font-family: 'Helvetica Neue', 'Nunito Sans', Arial, Helvetica, sans-serif; background: #fafbfc; color: #222; }
              .receipt-container { max-width: 900px; margin: 20px auto; background: #fff; border: 1px solid #eee; padding: 30px 40px; box-shadow: 0 0 10px rgba(0,0,0,0.05); }
              .header, .footer { text-align: center; font-weight: bold; color: #888; margin-bottom: 10px; }
              .logo { display: block; margin: 0 auto 10px auto; height: 60px; }
              .divider { border-top: 1px dotted #bbb; margin: 20px 0; }
              .company-info { text-align: center; font-size: 1.1em; color: #234; margin-bottom: 10px; }
              .company-info strong { font-size: 1.2em; color: #234; }
              .details-table, .items-table, .totals-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
              .details-table td { padding: 2px 6px; font-size: 0.98em; }
              .items-table th, .items-table td { border: 1px solid #e0e0e0; padding: 8px; text-align: left; }
              .items-table th { background: #f5f5f5; font-weight: bold; }
              .items-table td:last-child, .items-table th:last-child { text-align: right; }
              .items-table td:nth-child(2) { text-align: center; }
              .totals-table td { padding: 6px; font-size: 1em; border: 1px solid #e0e0e0; }
              .totals-table tr:not(:last-child) td { background: #fafbfc; }
              .totals-table tr:last-child td { font-weight: bold; background: #f5f5f5; }
              .section-title { font-size: 1.1em; font-weight: bold; margin: 18px 0 8px 0; color: #234; }
              .qr-section { text-align: center; margin: 20px 0 10px 0; }
              .qr-section img { height: 90px; margin-bottom: 8px; }
              .verification-code { text-align: center; font-size: 1.1em; font-weight: bold; margin: 10px 0; }
              .print-btn { display: inline-block; background: #ffe600; color: #222; border: none; padding: 8px 18px; font-size: 1em; border-radius: 4px; margin: 18px auto 0 auto; cursor: pointer; font-weight: bold; }
          </style>
      </head>
      <body>
        <div class="receipt-container">
          <div class="header">*** START OF LEGAL RECEIPT ***</div>
          <img src="${traLogoUrl}" alt="TRA Logo" class="logo" />
          <div class="divider"></div>
          <div class="company-info">
            <strong>${receiptData.companyName || ''}</strong><br/>
            ${receiptData.poBox ? `P.O BOX ${receiptData.poBox}` : ''} ${receiptData.mobile ? `<br/>MOBILE: ${receiptData.mobile}` : ''}<br/>
            TIN: ${receiptData.tin || ''}<br/>
            VRN: ${receiptData.vrn || ''}<br/>
            ${receiptData.serialNo ? `SERIAL NO: ${receiptData.serialNo}<br/>` : ''}
            ${receiptData.uin ? `UIN: ${receiptData.uin}<br/>` : ''}
            ${receiptData.taxOffice ? `TAX OFFICE: ${receiptData.taxOffice}` : ''}
          </div>
          <div class="divider"></div>
          <table class="details-table">
            <tr><td><b>CUSTOMER NAME:</b> ${receiptData.customerName || ''}</td><td><b>CUSTOMER ID TYPE:</b> ${receiptData.customerIdType || ''}</td></tr>
            <tr><td><b>CUSTOMER ID:</b> ${receiptData.customerId || ''}</td><td><b>CUSTOMER MOBILE:</b> ${receiptData.customerMobile || ''}</td></tr>
            <tr><td><b>RECEIPT NO:</b> ${receiptData.receiptNo || ''}</td><td><b>Z NUMBER:</b> ${receiptData.zNumber || ''}</td></tr>
            <tr><td><b>RECEIPT DATE:</b> ${receiptData.receiptDate || ''}</td><td><b>RECEIPT TIME:</b> ${receiptData.receiptTime || ''}</td></tr>
          </table>
          <div class="divider"></div>
          <div class="section-title">Purchased Items</div>
          <table class="items-table">
            <thead>
              <tr><th>Description</th><th>Qty</th><th>Amount</th></tr>
            </thead>
            <tbody>
              ${receiptData.items.map(item => `
                <tr>
                  <td>${item.description}</td>
                  <td>${item.qty}</td>
                  <td>${Number(item.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <table class="totals-table">
            <tr><td>TOTAL EXCL OF TAX:</td><td>${receiptData.totalExclTax || ''}</td></tr>
            <tr><td>TAX RATE A (18%):</td><td>${receiptData.totalTax || ''}</td></tr>
            <tr><td>TOTAL TAX:</td><td>${receiptData.totalTax || ''}</td></tr>
            <tr><td>TOTAL INCL OF TAX:</td><td>${receiptData.totalInclTax || ''}</td></tr>
          </table>
          <div class="divider"></div>
          <div class="verification-code">RECEIPT VERIFICATION CODE<br/>${receiptData.verificationCode || ''}</div>
          <div class="qr-section">
            <img src="${qrCodeDataUrl}" alt="QR Code" />
          </div>
          <div class="divider"></div>
          <div class="footer">*** END OF LEGAL RECEIPT ***</div>
          <div style="text-align:center;">
            <span class="print-btn">Print Receipt</span>
          </div>
        </div>
      </body>
      </html>
    `;
    return htmlContent;
  }
} 
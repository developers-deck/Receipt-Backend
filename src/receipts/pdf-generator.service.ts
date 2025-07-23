import * as QRCode from 'qrcode';

export class PdfGeneratorService {
  async generateReceiptPdf(receiptData: any): Promise<string> {
    const traLogoUrl = 'https://f004.backblazeb2.com/file/receipts-tanzania/tralogoss.png';
    
    // Ensure we have a valid verification URL for the QR code
    const verificationUrl = receiptData.verificationCodeUrl || receiptData.verificationUrl || `https://verify.tra.go.tz/${receiptData.verificationCode}`;
    console.log('Using verification URL for QR code:', verificationUrl);
    const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl);

    const itemsHtml = (receiptData.items || []).map(item => `
      <tr>
        <td>${item.description}</td>
        <td>${item.quantity || item.qty}</td>
        <td>${Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
      </tr>
    `).join('');

    const totalsHtml = (receiptData.totalAmounts || []).map(total => `
      <tr>
        <td>${total.label}</td>
        <td>${total.amount}</td>
      </tr>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Legal Receipt</title>
          <link href="https://fonts.googleapis.com/css?family=Nunito+Sans:400,700&display=swap" rel="stylesheet">
                    <style>
              body {
                  margin: 0;
                  padding: 0;
                  background-color: #f0f2f5;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  min-height: 100vh;
                  font-family: 'Helvetica Neue', 'Nunito Sans', Arial, Helvetica, sans-serif;
                  color: #333;
                  font-size: 14px; /* Base font size */
              }
              .receipt-container {
                  width: 80mm; /* A more realistic receipt width */
                  max-height: 277mm; /* A4 height minus some padding */
                  background: #fff;
                  border: 1px solid #e0e0e0;
                  padding: 20px;
                  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
                  box-sizing: border-box;
                  transform-origin: center center;
              }
              .header, .footer { text-align: center; font-weight: bold; color: #888; margin-bottom: 8px; font-size: 0.9em; }
              .logo { display: block; margin: 0 auto 8px auto; height: 50px; }
              .divider { border-top: 1px dotted #bbb; margin: 15px 0; }
              .company-info { text-align: center; font-size: 0.95em; color: #234; margin-bottom: 8px; line-height: 1.4; }
              .company-info strong { font-size: 1.1em; color: #234; }
              .details-table, .items-table, .totals-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
              .details-table td { padding: 2px 4px; font-size: 0.9em; }
              .items-table th, .items-table td { border: 1px solid #e0e0e0; padding: 6px; text-align: left; font-size: 0.95em; }
              .items-table th { background: #f5f5f5; font-weight: bold; }
              .items-table td:last-child, .items-table th:last-child { text-align: right; }
              .items-table td:nth-child(2) { text-align: center; }
              .totals-table td { padding: 5px; font-size: 0.95em; border: 1px solid #e0e0e0; text-align: right; }
              .totals-table td:first-child { text-align: left; font-weight: bold; }
              .totals-table tr:not(:last-child) td { background: #fafbfc; }
              .totals-table tr:last-child td { font-weight: bold; background: #f5f5f5; }
              .section-title { font-size: 1em; font-weight: bold; margin: 15px 0 8px 0; color: #234; }
              .qr-section { text-align: center; margin: 15px 0 5px 0; }
              .qr-section img { height: 80px; margin-bottom: 5px; }
              .verification-code { text-align: center; font-size: 1em; font-weight: bold; margin: 8px 0; }
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
            TIN: ${receiptData['TIN:'] || receiptData.tin}<br/>
            VRN: ${receiptData['VRN:'] || receiptData.vrn}<br/>
            ${receiptData['Serial No:'] || receiptData.serialNo ? `SERIAL NO: ${receiptData['Serial No:'] || receiptData.serialNo}<br/>` : ''}
            ${receiptData['UIN:'] || receiptData.uin ? `UIN: ${receiptData['UIN:'] || receiptData.uin}<br/>` : ''}
            ${receiptData['Tax Office:'] || receiptData.taxOffice ? `TAX OFFICE: ${receiptData['Tax Office:'] || receiptData.taxOffice}` : ''}
          </div>
          <div class="divider"></div>
          <table class="details-table">
            <tr><td><b>CUSTOMER NAME:</b> ${receiptData['Customer Name:'] || receiptData.customerName || ''}</td><td><b>CUSTOMER ID TYPE:</b> ${receiptData['Customer ID Type:'] || receiptData.customerIdType || ''}</td></tr>
            <tr><td><b>CUSTOMER ID:</b> ${receiptData['Customer ID:'] || receiptData.customerId || ''}</td><td><b>CUSTOMER MOBILE:</b> ${receiptData['Customer Mobile:'] || receiptData.customerMobile || ''}</td></tr>
            <tr><td><b>RECEIPT NO:</b> ${receiptData['Receipt No:'] || receiptData.receiptNo || ''}</td><td><b>Z NUMBER:</b> ${receiptData['Z-Number:'] || receiptData.zNumber || ''}</td></tr>
            <tr><td><b>RECEIPT DATE:</b> ${receiptData.receiptDate || ''}</td><td><b>RECEIPT TIME:</b> ${receiptData.receiptTime || ''}</td></tr>
          </table>
          <div class="divider"></div>
          <div class="section-title">Purchased Items</div>
          <table class="items-table">
            <thead>
              <tr><th>Description</th><th>Qty</th><th>Amount</th></tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          <div class="section-title">Totals</div>
          <table class="totals-table">
            <tbody>
              ${totalsHtml}
            </tbody>
          </table>
          <div class="divider"></div>
          <div class="verification-code">RECEIPT VERIFICATION CODE<br/>${receiptData.verificationCode || ''}</div>
          <div class="qr-section">
            <img src="${qrCodeDataUrl}" alt="QR Code" />
          </div>
          <div class="divider"></div>
          <div class="footer">*** END OF LEGAL RECEIPT ***</div>
        </div>
      </body>
      </html>
    `;
    return htmlContent;
  }
}
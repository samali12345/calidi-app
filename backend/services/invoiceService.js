const Order = require("../models/Order");

exports.generateInvoiceHTML = (order) => {
  const date = new Date(order.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const itemsHtml = order.items.map(item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #eee;">
        <div style="font-weight: 600; color: #1a1a1a;">${item.name}</div>
        <div style="font-size: 12px; color: #666;">Size: ${item.size}</div>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">Rs. ${item.unitPrice.toLocaleString()}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right; font-weight: 600;">Rs. ${(item.unitPrice * item.quantity).toLocaleString()}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Invoice - ${order.orderId}</title>
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; margin: 0; padding: 40px; line-height: 1.6; }
        .invoice-box { max-width: 800px; margin: auto; padding: 30px; border: 1px solid #eee; box-shadow: 0 0 10px rgba(0, 0, 0, 0.05); background: #fff; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
        .brand { color: #1a1a1a; }
        .brand h1 { margin: 0; font-size: 28px; letter-spacing: 2px; text-transform: uppercase; }
        .details { text-align: right; }
        .details h2 { margin: 0; color: #999; font-size: 18px; text-transform: uppercase; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
        .info-section h3 { font-size: 14px; text-transform: uppercase; color: #999; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
        th { background: #f9f9f9; text-align: left; padding: 12px; font-size: 12px; text-transform: uppercase; color: #999; }
        .totals { margin-left: auto; width: 300px; }
        .total-row { display: flex; justify-content: space-between; padding: 10px 0; }
        .total-row.grand { border-top: 2px solid #1a1a1a; margin-top: 10px; font-weight: bold; font-size: 18px; }
        .footer { text-align: center; margin-top: 60px; color: #999; font-size: 12px; }
        @media print {
          body { padding: 0; }
          .invoice-box { box-shadow: none; border: none; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="text-align: right; margin-bottom: 20px;">
        <button onclick="window.print()" style="padding: 10px 20px; background: #1a1a1a; color: #fff; border: none; border-radius: 4px; cursor: pointer;">Print / Download PDF</button>
      </div>
      <div class="invoice-box">
        <div class="header">
          <div class="brand">
            <h1>CALIDI</h1>
            <p>Boutique & Fashion</p>
          </div>
          <div class="details">
            <h2>INVOICE</h2>
            <p>#${order.orderId}<br>${date}</p>
          </div>
        </div>

        <div class="info-grid">
          <div class="info-section">
            <h3>Bill To</h3>
            <p><strong>${order.shippingAddress.fullName}</strong><br>
            ${order.shippingAddress.street}<br>
            ${order.shippingAddress.city}, ${order.shippingAddress.state}<br>
            ${order.shippingAddress.zipCode}</p>
          </div>
          <div class="info-section">
            <h3>Payment Method</h3>
            <p>${order.paymentMethod === 'cash_on_delivery' ? 'Cash on Delivery' : 'Credit / Debit Card'}<br>
            Status: <span style="color: ${order.status === 'paid' ? '#2ecc71' : '#e67e22'}">${order.status.toUpperCase()}</span></p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Item Description</th>
              <th style="text-align: center;">Qty</th>
              <th style="text-align: right;">Unit Price</th>
              <th style="text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="totals">
          <div class="total-row">
            <span>Subtotal</span>
            <span>Rs. ${order.subtotal.toLocaleString()}</span>
          </div>
          <div class="total-row">
            <span>Shipping</span>
            <span>Rs. ${order.deliveryFee.toLocaleString()}</span>
          </div>
          <div class="total-row grand">
            <span>Total</span>
            <span>Rs. ${order.total.toLocaleString()}</span>
          </div>
        </div>

        <div class="footer">
          <p>Thank you for shopping with CALIDI!</p>
          <p>If you have any questions, please contact us at support@calidi.com</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

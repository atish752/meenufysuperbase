import type { Order, RestaurantInfo } from '../context/RealtimeStore';

export function printThermalReceipt(order: Order, type: 'kot' | 'bill', restaurant: RestaurantInfo) {
  // Get config values with clean fallbacks
  const width = restaurant.printWidth || '80mm';
  const headerMessage = restaurant.printHeaderMessage || 'Welcome to our restaurant!';
  const footerMessage = restaurant.printFooterMessage || 'Thank you for dining with us! Visit again.';
  const showDateTime = restaurant.printShowDateTime !== false;
  const showOrderNumber = restaurant.printShowOrderNumber !== false;
  const taxPercent = restaurant.taxPercentage ?? 5;
  const currency = restaurant.currency || '₹';

  const dateStr = showDateTime ? new Date(order.createdAt).toLocaleString() : '';

  let html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          @page {
            size: auto;
            margin: 0mm;
          }
          body {
            margin: 0;
            padding: 10px;
            font-family: 'Courier New', Courier, monospace;
            font-size: 12px;
            color: #000;
            background: #fff;
            width: ${width === '58mm' ? '180px' : '280px'};
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .bold { font-weight: bold; }
          .header { margin-bottom: 8px; line-height: 1.4; }
          .title { font-size: 16px; font-weight: bold; text-transform: uppercase; }
          .subtitle { font-size: 11px; margin-top: 2px; }
          .divider { border-top: 1px dashed #000; margin: 6px 0; }
          .item-row { display: flex; justify-content: space-between; margin: 3px 0; }
          .item-name { flex: 1; }
          .item-qty { width: 30px; text-align: center; }
          .item-price { width: 60px; text-align: right; }
          .total-section { margin-top: 8px; }
          .total-row { display: flex; justify-content: space-between; margin: 3px 0; font-size: 13px; }
          .kot-title { font-size: 18px; font-weight: bold; border: 1px solid #000; padding: 4px; display: inline-block; margin-bottom: 8px; }
          .table-badge { font-size: 20px; font-weight: bold; margin: 4px 0; }
        </style>
      </head>
      <body>
  `;

  if (type === 'kot') {
    // --- KITCHEN ORDER TICKET TEMPLATE ---
    html += `
      <div class="text-center">
        <span class="kot-title">K.O.T</span>
        <div class="table-badge">TABLE ${order.tableNumber}</div>
        <div>KOT #${order.id.slice(-4).toUpperCase()}</div>
        ${dateStr ? `<div style="font-size: 10px; margin-top: 2px;">${dateStr}</div>` : ''}
      </div>
      <div class="divider"></div>
      <div class="bold" style="display: flex; justify-content: space-between;">
        <span>Item Details</span>
        <span style="width: 40px; text-align: right;">Qty</span>
      </div>
      <div class="divider"></div>
      ${order.items.map(item => `
        <div class="item-row bold" style="font-size: 13px;">
          <span class="item-name">${item.name} ${item.variant ? `(${item.variant.name})` : ''}</span>
          <span class="text-right" style="width: 40px;">x${item.qty}</span>
        </div>
      `).join('')}
      <div class="divider"></div>
      ${order.specialNote ? `
        <div style="margin-top: 6px; padding: 4px; border: 1px dashed #000; font-size: 11px;">
          <span class="bold">INSTRUCTION:</span> ${order.specialNote}
        </div>
      ` : ''}
      <div style="height: 20px;"></div>
    `;
  } else {
    // --- BILL / RECEIPT TEMPLATE ---
    const subtotal = order.totalAmount;
    const taxAmount = (subtotal * taxPercent) / 100;
    const grandTotal = subtotal + taxAmount;

    html += `
      <div class="text-center header">
        <div class="title">${restaurant.name || 'Restaurant'}</div>
        <div class="subtitle">${restaurant.tagline || ''}</div>
        <div style="font-size: 10px; margin-top: 4px;">
          ${restaurant.address ? `<div>${restaurant.address}</div>` : ''}
          ${restaurant.phone ? `<div>Tel: ${restaurant.phone}</div>` : ''}
        </div>
      </div>
      <div class="divider"></div>
      <div>
        <div style="display: flex; justify-content: space-between;">
          <span>Table: <span class="bold">${order.tableNumber}</span></span>
          <span>Cust: ${order.customerName || 'Guest'}</span>
        </div>
        ${showOrderNumber ? `<div>Order: #${order.id.slice(-4).toUpperCase()}</div>` : ''}
        ${dateStr ? `<div>Date: ${dateStr}</div>` : ''}
      </div>
      <div class="divider"></div>
      <div class="bold" style="display: flex; justify-content: space-between;">
        <span class="item-name">Item</span>
        <span style="width: 30px; text-align: center;">Qty</span>
        <span style="width: 60px; text-align: right;">Price</span>
      </div>
      <div class="divider"></div>
      ${order.items.map(item => `
        <div class="item-row">
          <span class="item-name">${item.name} ${item.variant ? `(${item.variant.name})` : ''}</span>
          <span class="item-qty">x${item.qty}</span>
          <span class="item-price">${currency}${(item.price * item.qty).toFixed(2)}</span>
        </div>
      `).join('')}
      <div class="divider"></div>
      <div class="total-section">
        <div class="item-row">
          <span>Subtotal:</span>
          <span>${currency}${subtotal.toFixed(2)}</span>
        </div>
        <div class="item-row">
          <span>Tax (${taxPercent}%):</span>
          <span>${currency}${taxAmount.toFixed(2)}</span>
        </div>
        <div class="divider"></div>
        <div class="total-row bold">
          <span>TOTAL DUE:</span>
          <span>${currency}${grandTotal.toFixed(2)}</span>
        </div>
      </div>
      <div class="divider"></div>
      <div class="text-center" style="font-size: 10px; margin-top: 10px;">
        <div>${headerMessage}</div>
        <div class="bold" style="margin-top: 4px;">${footerMessage}</div>
      </div>
      <div style="height: 20px;"></div>
    `;
  }

  html += `
      </body>
    </html>
  `;

  // Create an iframe to print
  const iframeId = 'thermal-printing-iframe';
  let iframe = document.getElementById(iframeId) as HTMLIFrameElement;
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = iframeId;
    iframe.style.position = 'fixed';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);
  }

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();

    // Small delay to ensure content renders inside iframe before calling print
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }, 250);
  }
}

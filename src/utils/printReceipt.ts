import type { Order, RestaurantInfo } from '../context/RealtimeStore';

// ─── ESC/POS Command Constants ─────────────────────────────────────────────────
const ESC = 0x1b;
const GS  = 0x1d;

const INIT          = [ESC, 0x40];            // Initialize printer
const ALIGN_LEFT    = [ESC, 0x61, 0x00];      // Left align
const ALIGN_CENTER  = [ESC, 0x61, 0x01];      // Center align
const BOLD_ON       = [ESC, 0x45, 0x01];      // Bold on
const BOLD_OFF      = [ESC, 0x45, 0x00];      // Bold off
const DOUBLE_WIDTH  = [ESC, 0x21, 0x20];      // Double width text  
const DOUBLE_SIZE   = [ESC, 0x21, 0x30];      // Double width + height
const NORMAL_SIZE   = [ESC, 0x21, 0x00];      // Normal size
const CUT_PAPER     = [GS,  0x56, 0x42, 0x00]; // Full cut
const FEED_LINES    = (n: number) => [ESC, 0x64, n]; // Feed n lines

// ─── Bluetooth Printer State ───────────────────────────────────────────────────
let _btDevice: BluetoothDevice | null = null;
let _btCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
let _btConnecting = false;

// ESC/POS Bluetooth Service & Characteristic UUIDs (standard for most thermal printers)
const PRINTER_SERVICE_UUIDS = [
  '000018f0-0000-1000-8000-00805f9b34fb',  // Generic printer service
  '00001101-0000-1000-8000-00805f9b34fb',  // SPP (Serial Port Profile)
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',  // ReceiptPrinter
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',  // ISSC Transparent Service
];
const PRINTER_CHAR_UUIDS = [
  '00002af1-0000-1000-8000-00805f9b34fb',  // Generic write char
  '49535343-8841-43f4-a8d4-ecbe34729bb3',  // ISSC write char
  'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f',  // ReceiptPrinter write
];

// ─── Text Encoder ──────────────────────────────────────────────────────────────
function textToBytes(text: string): number[] {
  // Replace Rupee sign with Rs. and other non-ASCII currency characters for Bluetooth print compatibility
  let cleanText = text.replace(/₹/g, 'Rs.');
  const bytes: number[] = [];
  for (let i = 0; i < cleanText.length; i++) {
    const c = cleanText.charCodeAt(i);
    bytes.push(c > 127 ? 0x3f : c); // Replace non-ASCII with '?'
  }
  return bytes;
}

function line(text: string): number[] {
  return [...textToBytes(text), 0x0a]; // text + newline
}

function padRight(str: string, len: number): string {
  return str.length >= len ? str.substring(0, len) : str + ' '.repeat(len - str.length);
}

function padLeft(str: string, len: number): string {
  return str.length >= len ? str.substring(0, len) : ' '.repeat(len - str.length) + str;
}

function splitLine(left: string, right: string, width: number): string {
  const rightLen = right.length;
  const leftMax = width - rightLen - 1;
  const leftTrimmed = left.length > leftMax ? left.substring(0, leftMax - 1) + '~' : left;
  return leftTrimmed + ' '.repeat(width - leftTrimmed.length - rightLen) + right;
}

function dashes(width: number): number[] {
  return line('-'.repeat(width));
}

// Generates native ESC/POS QR code commands
function buildEscposQrCode(data: string): number[] {
  const bytes: number[] = [];
  const store_len = data.length + 3;
  const pl = store_len % 256;
  const ph = Math.floor(store_len / 256);

  // 1. Set QR code model (Model 2 is standard)
  bytes.push(0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
  
  // 2. Set QR code size (typically 3 to 8, 5 is a balanced fit for 58mm/80mm)
  bytes.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x05);
  
  // 3. Set QR code error correction level (Level M is standard)
  bytes.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x44, 0x31);
  
  // 4. Store QR code data
  bytes.push(0x1d, 0x28, 0x6b, pl, ph, 0x31, 0x50, 0x30);
  for (let i = 0; i < data.length; i++) {
    bytes.push(data.charCodeAt(i));
  }
  
  // 5. Print the QR code
  bytes.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30);
  
  return bytes;
}

// ─── Build ESC/POS KOT Byte Array (Compact & Paper-Saving) ─────────────────────
function buildKotBytes(order: Order, restaurant: RestaurantInfo): Uint8Array {
  const W = restaurant.printWidth === '58mm' ? 32 : 42; // chars per line
  const showDateTime = restaurant.printShowDateTime !== false;
  const bytes: number[] = [];

  bytes.push(...INIT);
  bytes.push(...ALIGN_CENTER);
  bytes.push(...DOUBLE_SIZE);
  bytes.push(...line('K.O.T'));
  bytes.push(...NORMAL_SIZE);
  bytes.push(...BOLD_ON);
  bytes.push(...line(`TABLE ${order.tableNumber}`));
  bytes.push(...BOLD_OFF);
  
  const oType = order.orderType === 'take-away' ? 'Take Away' : 'Dine In';
  bytes.push(...line(`KOT #${order.id.slice(-4).toUpperCase()} | ${oType}`));
  
  if (showDateTime) {
    bytes.push(...line(new Date(order.createdAt).toLocaleString('en-IN', { hour12: true })));
  }
  bytes.push(...dashes(W));

  bytes.push(...ALIGN_LEFT);
  bytes.push(...BOLD_ON);
  bytes.push(...line(splitLine('Item Details', 'Qty', W)));
  bytes.push(...BOLD_OFF);
  bytes.push(...dashes(W));

  for (const item of order.items) {
    const nameWithVariant = item.name + (item.variant ? ` (${item.variant.name})` : '');
    const qty = `x${item.qty}`;
    const maxNameLen = W - qty.length - 1;
    
    bytes.push(...BOLD_ON);
    if (nameWithVariant.length <= maxNameLen) {
      bytes.push(...line(splitLine(nameWithVariant, qty, W)));
    } else {
      bytes.push(...line(splitLine(nameWithVariant.substring(0, maxNameLen - 1) + '.', qty, W)));
      bytes.push(...line('  ' + nameWithVariant.substring(maxNameLen - 1)));
    }
    bytes.push(...BOLD_OFF);
    
    // Print addons/modifiers
    if (item.addons && item.addons.length > 0) {
      for (const a of item.addons) {
        const addonLine = `  + ${a.optionName}`;
        bytes.push(...line(addonLine.substring(0, W)));
      }
    }
  }

  bytes.push(...dashes(W));

  if (order.specialNote) {
    bytes.push(...BOLD_ON);
    bytes.push(...line('INSTRUCTION:'));
    bytes.push(...BOLD_OFF);
    bytes.push(...line(order.specialNote));
    bytes.push(...dashes(W));
  }

  bytes.push(...ALIGN_CENTER);
  bytes.push(...line('*** KITCHEN COPY ***'));
  bytes.push(...FEED_LINES(1)); // Reduce paper feed to 1 line
  bytes.push(...CUT_PAPER);

  return new Uint8Array(bytes);
}

// ─── Build ESC/POS Bill Byte Array (Compact, Custom Fields & Prefilled UPI QR) ──
function buildBillBytes(order: Order, restaurant: RestaurantInfo): Uint8Array {
  const W = restaurant.printWidth === '58mm' ? 32 : 42; // chars per line
  const showDateTime = restaurant.printShowDateTime !== false;
  const showOrderNumber = restaurant.printShowOrderNumber !== false;
  const taxPercent = restaurant.taxPercentage ?? 5;
  const currency = restaurant.currency || '₹';
  const headerMessage = restaurant.printHeaderMessage || 'Welcome!';
  const footerMessage = restaurant.printFooterMessage || 'Thank you! Visit again.';

  const subtotal = order.totalAmount;
  const taxAmount = (subtotal * taxPercent) / 100;
  const grandTotal = subtotal + taxAmount;

  const bytes: number[] = [];

  bytes.push(...INIT);
  bytes.push(...ALIGN_CENTER);
  bytes.push(...DOUBLE_WIDTH);
  bytes.push(...BOLD_ON);
  bytes.push(...line((restaurant.name || 'RESTAURANT').toUpperCase()));
  bytes.push(...BOLD_OFF);
  bytes.push(...NORMAL_SIZE);
  
  if (restaurant.tagline) {
    bytes.push(...line(restaurant.tagline));
  }
  if (restaurant.address) {
    bytes.push(...line(restaurant.address));
  }
  if (restaurant.phone) {
    bytes.push(...line(`Tel: ${restaurant.phone}`));
  }
  if (restaurant.fssai) {
    bytes.push(...line(`FSSAI: ${restaurant.fssai}`));
  }
  if (restaurant.gst) {
    bytes.push(...line(`GST: ${restaurant.gst}`));
  }

  bytes.push(...dashes(W));
  bytes.push(...ALIGN_LEFT);

  // Table, Customer, Type, Order info
  const oType = order.orderType === 'take-away' ? 'Take Away' : 'Dine In';
  bytes.push(...line(splitLine(`Table: ${order.tableNumber}`, `Cust: ${order.customerName || 'Guest'}`, W)));
  bytes.push(...line(splitLine(`Type: ${oType}`, showOrderNumber ? `Order: #${order.id.slice(-4).toUpperCase()}` : '', W)));
  
  if (showDateTime) {
    bytes.push(...line(`Date: ${new Date(order.createdAt).toLocaleString('en-IN', { hour12: true })}`));
  }

  bytes.push(...dashes(W));
  bytes.push(...BOLD_ON);
  const header = padRight('Item', W - 12) + padLeft('Qty', 4) + padLeft('Amt', 8);
  bytes.push(...line(header));
  bytes.push(...BOLD_OFF);
  bytes.push(...dashes(W));

  for (const item of order.items) {
    const nameWithVariant = item.name + (item.variant ? ` (${item.variant.name})` : '');
    const amt = `${currency}${(item.price * item.qty).toFixed(2)}`;
    const qtyStr = `x${item.qty}`;
    const maxName = W - qtyStr.length - amt.length - 2;
    const name = nameWithVariant.length > maxName
      ? nameWithVariant.substring(0, maxName - 1) + '.'
      : padRight(nameWithVariant, maxName);
    bytes.push(...line(`${name} ${qtyStr} ${padLeft(amt, amt.length)}`));
    
    // Print addons/modifiers
    if (item.addons && item.addons.length > 0) {
      for (const a of item.addons) {
        const addonLabel = `  + ${a.optionName}`;
        const addonAmt = a.price > 0 ? `${currency}${(a.price * item.qty).toFixed(2)}` : '';
        if (addonAmt) {
          bytes.push(...line(splitLine(addonLabel, addonAmt, W)));
        } else {
          bytes.push(...line(addonLabel.substring(0, W)));
        }
      }
    }
  }

  bytes.push(...dashes(W));

  bytes.push(...line(splitLine('Subtotal:', `${currency}${subtotal.toFixed(2)}`, W)));
  if (taxPercent > 0) {
    bytes.push(...line(splitLine(`Tax (${taxPercent}%):`, `${currency}${taxAmount.toFixed(2)}`, W)));
  }
  bytes.push(...dashes(W));
  bytes.push(...BOLD_ON);
  bytes.push(...line(splitLine('TOTAL AMOUNT:', `${currency}${grandTotal.toFixed(2)}`, W)));
  bytes.push(...BOLD_OFF);
  bytes.push(...dashes(W));

  bytes.push(...ALIGN_CENTER);
  if (headerMessage) {
    bytes.push(...line(headerMessage));
  }
  bytes.push(...BOLD_ON);
  bytes.push(...line(footerMessage));
  bytes.push(...BOLD_OFF);

  // pre-filled UPI Payment QR code
  if (restaurant.upiId) {
    bytes.push(...line(''));
    bytes.push(...line('Scan to Pay via UPI'));
    const cleanRestName = (restaurant.name || 'Merchant').replace(/[^a-zA-Z0-9]/g, '');
    const upiUrl = `upi://pay?pa=${restaurant.upiId}&pn=${cleanRestName}&am=${grandTotal.toFixed(2)}&cu=INR`;
    bytes.push(...buildEscposQrCode(upiUrl));
    bytes.push(...BOLD_ON);
    bytes.push(...line(`Rs. ${grandTotal.toFixed(2)}`));
    bytes.push(...BOLD_OFF);
  }

  bytes.push(...FEED_LINES(1)); // Reduce paper feed to 1 line
  bytes.push(...CUT_PAPER);

  return new Uint8Array(bytes);
}

// ─── Connect to Bluetooth Printer ──────────────────────────────────────────────
export async function connectBluetoothPrinter(): Promise<{ success: boolean; name?: string; error?: string }> {
  if (!navigator.bluetooth) {
    return { success: false, error: 'Web Bluetooth is not supported in this browser. Please use Chrome on Android or Chrome desktop.' };
  }

  if (_btConnecting) {
    return { success: false, error: 'Already connecting...' };
  }

  _btConnecting = true;

  try {
    if (_btDevice?.gatt?.connected) {
      _btDevice.gatt.disconnect();
    }
    _btDevice = null;
    _btCharacteristic = null;

    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: PRINTER_SERVICE_UUIDS,
    });

    _btDevice = device;
    device.addEventListener('gattserverdisconnected', () => {
      _btDevice = null;
      _btCharacteristic = null;
      console.log('Bluetooth printer disconnected');
    });

    const server = await device.gatt!.connect();
    let characteristic: BluetoothRemoteGATTCharacteristic | null = null;

    for (const serviceUuid of PRINTER_SERVICE_UUIDS) {
      try {
        const service = await server.getPrimaryService(serviceUuid);
        for (const charUuid of PRINTER_CHAR_UUIDS) {
          try {
            const ch = await service.getCharacteristic(charUuid);
            if (ch.properties.write || ch.properties.writeWithoutResponse) {
              characteristic = ch;
              break;
            }
          } catch { /* try next */ }
        }
        if (characteristic) break;
        try {
          const allChars = await service.getCharacteristics();
          for (const ch of allChars) {
            if (ch.properties.write || ch.properties.writeWithoutResponse) {
              characteristic = ch;
              break;
            }
          }
        } catch { /* try next service */ }
        if (characteristic) break;
      } catch { /* try next service */ }
    }

    if (!characteristic) {
      return { success: false, error: `Connected to "${device.name}" but couldn't find a writable printer characteristic.` };
    }

    _btCharacteristic = characteristic;
    _btConnecting = false;
    return { success: true, name: device.name || 'Unknown Printer' };

  } catch (err: any) {
    _btConnecting = false;
    _btDevice = null;
    _btCharacteristic = null;
    if (err?.name === 'NotFoundError') {
      return { success: false, error: 'No printer selected. Please try again and select your thermal printer.' };
    }
    return { success: false, error: `Connection failed: ${err?.message || String(err)}` };
  }
}

// ─── Re-establish Bluetooth connection if GATT drops ───────────────────────────
export async function ensureBluetoothConnected(): Promise<boolean> {
  if (!_btDevice) return false;

  try {
    if (!_btDevice.gatt?.connected) {
      console.log('Reconnecting Bluetooth GATT server...');
      await _btDevice.gatt!.connect();
    }

    if (!_btCharacteristic) {
      console.log('Discovering writable characteristic...');
      let characteristic: BluetoothRemoteGATTCharacteristic | null = null;

      for (const serviceUuid of PRINTER_SERVICE_UUIDS) {
        try {
          const service = await _btDevice.gatt!.getPrimaryService(serviceUuid);
          for (const charUuid of PRINTER_CHAR_UUIDS) {
            try {
              const ch = await service.getCharacteristic(charUuid);
              if (ch.properties.write || ch.properties.writeWithoutResponse) {
                characteristic = ch;
                break;
              }
            } catch { /* try next */ }
          }
          if (characteristic) break;
          const allChars = await service.getCharacteristics();
          for (const ch of allChars) {
            if (ch.properties.write || ch.properties.writeWithoutResponse) {
              characteristic = ch;
              break;
            }
          }
          if (characteristic) break;
        } catch { /* try next service */ }
      }

      if (characteristic) {
        _btCharacteristic = characteristic;
        console.log('Bluetooth characteristic re-established successfully');
      } else {
        return false;
      }
    }

    return !!(_btDevice.gatt?.connected && _btCharacteristic);
  } catch (err) {
    console.error('Failed to auto-reconnect Bluetooth:', err);
    return false;
  }
}

export function isBluetoothPrinterConnected(): boolean {
  return !!(_btDevice?.gatt?.connected && _btCharacteristic);
}

export function getConnectedPrinterName(): string {
  return _btDevice?.name || '';
}

export async function disconnectBluetoothPrinter(): Promise<void> {
  if (_btDevice?.gatt?.connected) {
    _btDevice.gatt.disconnect();
  }
  _btDevice = null;
  _btCharacteristic = null;
}

// ─── Send Raw Bytes to Bluetooth Printer ───────────────────────────────────────
async function sendBytesToBluetooth(data: Uint8Array): Promise<{ success: boolean; error?: string }> {
  const isConnected = await ensureBluetoothConnected();
  if (!isConnected) {
    return { success: false, error: 'Printer disconnected and auto-reconnect failed. Connect again in settings.' };
  }

  try {
    const CHUNK_SIZE = 512;
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE);
      try {
        await _btCharacteristic!.writeValueWithoutResponse(chunk);
      } catch {
        await _btCharacteristic!.writeValue(chunk);
      }
      if (i + CHUNK_SIZE < data.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: `Print write failed: ${err?.message || String(err)}` };
  }
}

// ─── Browser (iframe) Print ────────────────────────────────────────────────────
function buildBrowserHtml(order: Order, type: 'kot' | 'bill', restaurant: RestaurantInfo): string {
  const width = restaurant.printWidth || '80mm';
  const headerMessage = restaurant.printHeaderMessage || 'Welcome to our restaurant!';
  const footerMessage = restaurant.printFooterMessage || 'Thank you for dining with us! Visit again.';
  const showDateTime = restaurant.printShowDateTime !== false;
  const showOrderNumber = restaurant.printShowOrderNumber !== false;
  const taxPercent = restaurant.taxPercentage ?? 5;
  const currency = restaurant.currency || '₹';
  const dateStr = showDateTime ? new Date(order.createdAt).toLocaleString('en-IN', { hour12: true }) : '';
  const bodyWidth = width === '58mm' ? '190px' : '280px';
  const oType = order.orderType === 'take-away' ? 'Take Away' : 'Dine In';

  let html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      @page { size: auto; margin: 1mm; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: 'Courier New', Courier, monospace;
        font-size: 11px;
        color: #000;
        background: #fff;
        width: ${bodyWidth};
        padding: 4px;
      }
      .center { text-align: center; }
      .right { text-align: right; }
      .bold { font-weight: bold; }
      .divider { border: none; border-top: 1px dashed #000; margin: 4px 0; }
      .stardivider { border: none; border-top: 1px solid #000; margin: 4px 0; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      td { vertical-align: top; padding: 1px 0; }
      .td-name { width: auto; word-break: break-word; }
      .td-qty { width: 28px; text-align: center; white-space: nowrap; }
      .td-price { width: 68px; text-align: right; white-space: nowrap; }
      .title { font-size: 16px; font-weight: bold; text-transform: uppercase; margin-top: 2px; }
      .kot-badge { font-size: 18px; font-weight: bold; border: 1.5px solid #000; display: inline-block; padding: 1px 6px; }
      .table-no { font-size: 18px; font-weight: bold; }
      .total-table td { padding: 1px 0; }
      .grand-total td { font-size: 13px; font-weight: bold; border-top: 1px dashed #000; padding-top: 3px; }
      .logo-img { width: 40px; height: 40px; object-fit: contain; margin-bottom: 2px; }
    </style>
  </head>
  <body>`;

  if (type === 'kot') {
    html += `
    <div class="center">
      <div class="kot-badge">K.O.T</div>
      <div class="table-no">TABLE ${order.tableNumber}</div>
      <div class="bold">KOT #${order.id.slice(-4).toUpperCase()} | ${oType}</div>
      ${dateStr ? `<div style="font-size:9px;margin-top:1px;">${dateStr}</div>` : ''}
    </div>
    <hr class="divider">
    <table>
      <thead>
        <tr class="bold">
          <td class="td-name">Item Details</td>
          <td class="td-qty">Qty</td>
        </tr>
      </thead>
    </table>
    <hr class="divider">
    <table>
      ${order.items.map(item => `
        <tr class="bold">
          <td class="td-name" style="font-size:11px;">
            ${item.name}${item.variant ? ` (${item.variant.name})` : ''}
            ${item.addons && item.addons.length > 0 ? `<div style="font-size:8px;font-weight:normal;margin-left:6px;">${item.addons.map(a => `+ ${a.optionName}`).join(', ')}</div>` : ''}
          </td>
          <td class="td-qty" style="font-size:11px;">x${item.qty}</td>
        </tr>
      `).join('')}
    </table>
    <hr class="divider">
    ${order.specialNote ? `
      <div style="border:1px dashed #000;padding:2px;margin-top:2px;font-size:9px;">
        <span class="bold">INSTRUCTION:</span> ${order.specialNote}
      </div>
    ` : ''}
    <div style="margin-top:6px;" class="center bold">*** KITCHEN COPY ***</div>`;

  } else {
    const subtotal = order.totalAmount;
    const taxAmount = (subtotal * taxPercent) / 100;
    const grandTotal = subtotal + taxAmount;

    html += `
    <div class="center">
      ${restaurant.logo ? `<img class="logo-img" src="${restaurant.logo}" alt="logo" />` : ''}
      <div class="title">${restaurant.name || 'Restaurant'}</div>
      ${restaurant.tagline ? `<div style="font-size:9px;color:#333;">${restaurant.tagline}</div>` : ''}
      ${restaurant.address ? `<div style="font-size:8px;margin-top:1px;">${restaurant.address}</div>` : ''}
      ${restaurant.phone ? `<div style="font-size:8px;">Tel: ${restaurant.phone}</div>` : ''}
      ${restaurant.fssai ? `<div style="font-size:8px;">FSSAI: ${restaurant.fssai}</div>` : ''}
      ${restaurant.gst ? `<div style="font-size:8px;">GST: ${restaurant.gst}</div>` : ''}
    </div>
    <hr class="stardivider">
    <table>
      <tr>
        <td class="bold">Table: ${order.tableNumber}</td>
        <td class="right">Cust: ${order.customerName || 'Guest'}</td>
      </tr>
      <tr>
        <td>Type: ${oType}</td>
        <td class="right">${showOrderNumber ? `Order: #${order.id.slice(-4).toUpperCase()}` : ''}</td>
      </tr>
      ${dateStr ? `<tr><td colspan="2">Date: ${dateStr}</td></tr>` : ''}
    </table>
    <hr class="divider">
    <table>
      <thead>
        <tr class="bold">
          <td class="td-name">Item</td>
          <td class="td-qty">Qty</td>
          <td class="td-price">Price</td>
        </tr>
      </thead>
    </table>
    <hr class="divider">
    <table>
      ${order.items.map(item => `
        <tr>
          <td class="td-name">
            ${item.name}${item.variant ? ` (${item.variant.name})` : ''}
            ${item.addons && item.addons.length > 0 ? item.addons.map(a => `<div style="font-size:8px;color:#555;margin-left:6px;">+ ${a.optionName} (+${currency}${a.price})</div>`).join('') : ''}
          </td>
          <td class="td-qty">x${item.qty}</td>
          <td class="td-price">${currency}${(item.price * item.qty).toFixed(2)}</td>
        </tr>
      `).join('')}
    </table>
    <hr class="divider">
    <table class="total-table">
      <tr>
        <td>Subtotal:</td>
        <td class="right">${currency}${subtotal.toFixed(2)}</td>
      </tr>
      ${taxPercent > 0 ? `
      <tr>
        <td>Tax (${taxPercent}%):</td>
        <td class="right">${currency}${taxAmount.toFixed(2)}</td>
      </tr>` : ''}
    </table>
    <table class="total-table">
      <tr class="grand-total">
        <td>TOTAL DUE:</td>
        <td class="right">${currency}${grandTotal.toFixed(2)}</td>
      </tr>
    </table>
    <hr class="divider">
    <div class="center" style="font-size:9px;margin-top:4px;margin-bottom:6px;">
      <div>${headerMessage}</div>
      <div class="bold" style="margin-top:2px;">${footerMessage}</div>
    </div>`;

    if (restaurant.upiId) {
      const cleanRestName = (restaurant.name || 'Merchant').replace(/[^a-zA-Z0-9]/g, '');
      const upiUrl = `upi://pay?pa=${restaurant.upiId}&pn=${cleanRestName}&am=${grandTotal.toFixed(2)}&cu=INR`;
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(upiUrl)}`;
      html += `
      <hr class="divider">
      <div class="center" style="margin-top:6px;">
        <div class="bold" style="font-size:9px;">Scan to Pay via UPI</div>
        <img src="${qrApiUrl}" style="width:105px;height:105px;margin-top:4px;margin-bottom:2px;" alt="UPI QR" />
        <div class="bold" style="font-size:12px;margin-top:2px;">Rs. ${grandTotal.toFixed(2)}</div>
      </div>`;
    }
  }

  html += `
  </body>
</html>`;

  return html;
}

function printViaBrowser(order: Order, type: 'kot' | 'bill', restaurant: RestaurantInfo) {
  const html = buildBrowserHtml(order, type, restaurant);

  const iframeId = 'thermal-printing-iframe';
  let iframe = document.getElementById(iframeId) as HTMLIFrameElement;
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = iframeId;
    iframe.style.cssText = 'position:fixed;width:0;height:0;border:none;left:-9999px;top:-9999px;';
    document.body.appendChild(iframe);
  }

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }, 300);
  }
}

// ─── Main Export: printThermalReceipt ──────────────────────────────────────────
/**
 * Prints a KOT or Bill receipt.
 * If printMethod is 'bluetooth' and a printer is connected, sends raw ESC/POS.
 * Falls back to browser print dialog if Bluetooth fails or is not set.
 * @returns Promise resolving with { success, error? }
 */
export async function printThermalReceipt(
  order: Order,
  type: 'kot' | 'bill',
  restaurant: RestaurantInfo
): Promise<{ success: boolean; error?: string }> {
  const method = restaurant.printMethod || 'browser';

  if (method === 'bluetooth') {
    const isConnected = await ensureBluetoothConnected();
    if (!isConnected) {
      // Fallback to browser print on pairing/connection failure
      printViaBrowser(order, type, restaurant);
      return { success: true, error: 'No Bluetooth printer connected. Fell back to browser print.' };
    }

    const bytes = type === 'kot'
      ? buildKotBytes(order, restaurant)
      : buildBillBytes(order, restaurant);

    const result = await sendBytesToBluetooth(bytes);
    if (!result.success) {
      // Fall back to browser print on write failure
      printViaBrowser(order, type, restaurant);
      return { success: true, error: `Bluetooth write failed (${result.error}). Fell back to browser print.` };
    }
    return { success: true };
  }

  // Browser mode
  printViaBrowser(order, type, restaurant);
  return { success: true };
}

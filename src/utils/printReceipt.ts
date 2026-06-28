import type { Order, RestaurantInfo } from '../context/RealtimeStore';

// ─── ESC/POS Command Constants ─────────────────────────────────────────────────
const ESC = 0x1b;
const GS  = 0x1d;

const INIT          = [ESC, 0x40];            // Initialize printer
const ALIGN_LEFT    = [ESC, 0x61, 0x00];      // Left align
const ALIGN_CENTER  = [ESC, 0x61, 0x01];      // Center align
const BOLD_ON       = [ESC, 0x45, 0x01];      // Bold on
const BOLD_OFF      = [ESC, 0x45, 0x00];      // Bold off
const DOUBLE_HEIGHT = [ESC, 0x21, 0x10];      // Double height text
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
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
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

function stars(width: number): number[] {
  return line('*'.repeat(width));
}

// ─── Build ESC/POS KOT Byte Array ──────────────────────────────────────────────
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
  bytes.push(...DOUBLE_HEIGHT);
  bytes.push(...line(`TABLE ${order.tableNumber}`));
  bytes.push(...NORMAL_SIZE);
  bytes.push(...BOLD_OFF);
  bytes.push(...line(`KOT #${order.id.slice(-4).toUpperCase()}`));
  if (showDateTime) {
    bytes.push(...line(new Date(order.createdAt).toLocaleString('en-IN', { hour12: true })));
  }
  bytes.push(...dashes(W));

  bytes.push(...ALIGN_LEFT);
  bytes.push(...BOLD_ON);
  bytes.push(...line(splitLine('Item', 'Qty', W)));
  bytes.push(...BOLD_OFF);
  bytes.push(...dashes(W));

  for (const item of order.items) {
    const nameWithVariant = item.name + (item.variant ? ` (${item.variant.name})` : '');
    const qty = `x${item.qty}`;
    // If item name is long, wrap it
    const maxNameLen = W - qty.length - 1;
    if (nameWithVariant.length <= maxNameLen) {
      bytes.push(...BOLD_ON);
      bytes.push(...line(splitLine(nameWithVariant, qty, W)));
      bytes.push(...BOLD_OFF);
    } else {
      // First line with name truncated
      bytes.push(...BOLD_ON);
      bytes.push(...line(splitLine(nameWithVariant.substring(0, maxNameLen - 1) + '.', qty, W)));
      // Second line with rest of name
      bytes.push(...line('  ' + nameWithVariant.substring(maxNameLen - 1)));
      bytes.push(...BOLD_OFF);
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
  bytes.push(...FEED_LINES(4));
  bytes.push(...CUT_PAPER);

  return new Uint8Array(bytes);
}

// ─── Build ESC/POS Bill Byte Array ─────────────────────────────────────────────
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

  bytes.push(...stars(W));
  bytes.push(...ALIGN_LEFT);

  // Table & customer info
  bytes.push(...line(splitLine(`Table: ${order.tableNumber}`, `Cust: ${order.customerName || 'Guest'}`, W)));
  if (showOrderNumber) {
    bytes.push(...line(`Order: #${order.id.slice(-4).toUpperCase()}`));
  }
  if (showDateTime) {
    bytes.push(...line(`Date: ${new Date(order.createdAt).toLocaleString('en-IN', { hour12: true })}`));
  }

  bytes.push(...dashes(W));
  bytes.push(...BOLD_ON);
  bytes.push(...line(splitLine(padRight('Item', W - 14), padLeft('Qty', 5), W) + padLeft('Amt', 8).substring(0, 8)));
  // Fix: just print simple aligned header
  const header = padRight('Item', W - 10) + padLeft('Qty', 4) + padLeft('Price', 6);
  bytes.pop(); // Remove the last newline we added
  bytes.push(...line(header));
  bytes.push(...BOLD_OFF);
  bytes.push(...dashes(W));

  for (const item of order.items) {
    const nameWithVariant = item.name + (item.variant ? ` (${item.variant.name})` : '');
    const amt = `${currency}${(item.price * item.qty).toFixed(0)}`;
    const qtyStr = `x${item.qty}`;
    const maxName = W - qtyStr.length - amt.length - 2;
    const name = nameWithVariant.length > maxName
      ? nameWithVariant.substring(0, maxName - 1) + '.'
      : padRight(nameWithVariant, maxName);
    bytes.push(...line(`${name} ${qtyStr} ${padLeft(amt, amt.length)}`));
  }

  bytes.push(...dashes(W));

  bytes.push(...line(splitLine('Subtotal:', `${currency}${subtotal.toFixed(2)}`, W)));
  bytes.push(...line(splitLine(`Tax (${taxPercent}%):`, `${currency}${taxAmount.toFixed(2)}`, W)));
  bytes.push(...dashes(W));
  bytes.push(...BOLD_ON);
  bytes.push(...DOUBLE_HEIGHT);
  bytes.push(...line(splitLine('TOTAL:', `${currency}${grandTotal.toFixed(2)}`, W)));
  bytes.push(...NORMAL_SIZE);
  bytes.push(...BOLD_OFF);
  bytes.push(...dashes(W));

  bytes.push(...ALIGN_CENTER);
  bytes.push(...line(headerMessage));
  bytes.push(...BOLD_ON);
  bytes.push(...line(footerMessage));
  bytes.push(...BOLD_OFF);

  bytes.push(...FEED_LINES(4));
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
    // Disconnect any existing device
    if (_btDevice?.gatt?.connected) {
      _btDevice.gatt.disconnect();
    }
    _btDevice = null;
    _btCharacteristic = null;

    // Request the device — allow any Bluetooth device that has a writable characteristic
    const device = await navigator.bluetooth.requestDevice({
      // Accept any device (user will pick from the list)
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

    // Try each service UUID until one works
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
        // If no specific characteristic found, try to get all and use any writable one
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
      return { success: false, error: `Connected to "${device.name}" but couldn't find a writable printer characteristic. This device may not be a supported thermal printer.` };
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
  if (!_btCharacteristic) {
    return { success: false, error: 'Printer not connected. Please connect your Bluetooth printer first.' };
  }

  // Need to reconnect if disconnected
  if (!_btDevice?.gatt?.connected) {
    try {
      await _btDevice?.gatt?.connect();
    } catch (e: any) {
      _btCharacteristic = null;
      return { success: false, error: 'Printer disconnected. Please reconnect.' };
    }
  }

  try {
    // Send in chunks of 512 bytes (BLE MTU limit)
    const CHUNK_SIZE = 512;
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE);
      try {
        await _btCharacteristic.writeValueWithoutResponse(chunk);
      } catch {
        await _btCharacteristic.writeValue(chunk);
      }
      // Small delay between chunks
      if (i + CHUNK_SIZE < data.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: `Print failed: ${err?.message || String(err)}` };
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

  let html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      @page { size: auto; margin: 2mm; }
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
      .divider { border: none; border-top: 1px dashed #000; margin: 5px 0; }
      .stardivider { border: none; border-top: 2px solid #000; margin: 5px 0; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      td { vertical-align: top; padding: 1px 0; }
      .td-name { width: auto; word-break: break-word; }
      .td-qty { width: 28px; text-align: center; white-space: nowrap; }
      .td-price { width: 58px; text-align: right; white-space: nowrap; }
      .title { font-size: 18px; font-weight: bold; text-transform: uppercase; }
      .kot-badge { font-size: 22px; font-weight: bold; border: 2px solid #000; display: inline-block; padding: 2px 8px; }
      .table-no { font-size: 20px; font-weight: bold; }
      .total-table td { padding: 2px 0; }
      .grand-total td { font-size: 14px; font-weight: bold; border-top: 1px solid #000; padding-top: 4px; }
    </style>
  </head>
  <body>`;

  if (type === 'kot') {
    html += `
    <div class="center">
      <div class="kot-badge">K.O.T</div>
      <div class="table-no">TABLE ${order.tableNumber}</div>
      <div class="bold">KOT #${order.id.slice(-4).toUpperCase()}</div>
      ${dateStr ? `<div style="font-size:9px;margin-top:2px;">${dateStr}</div>` : ''}
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
          <td class="td-name" style="font-size:12px;">${item.name}${item.variant ? ` (${item.variant.name})` : ''}</td>
          <td class="td-qty" style="font-size:12px;">x${item.qty}</td>
        </tr>
      `).join('')}
    </table>
    <hr class="divider">
    ${order.specialNote ? `
      <div style="border:1px dashed #000;padding:3px;margin-top:4px;font-size:10px;">
        <span class="bold">INSTRUCTION:</span> ${order.specialNote}
      </div>
    ` : ''}
    <div style="margin-top:8px;" class="center bold">*** KITCHEN COPY ***</div>
    <div style="height:24px;"></div>`;

  } else {
    const subtotal = order.totalAmount;
    const taxAmount = (subtotal * taxPercent) / 100;
    const grandTotal = subtotal + taxAmount;

    html += `
    <div class="center">
      <div class="title">${restaurant.name || 'Restaurant'}</div>
      ${restaurant.tagline ? `<div style="font-size:10px;">${restaurant.tagline}</div>` : ''}
      ${restaurant.address ? `<div style="font-size:9px;margin-top:2px;">${restaurant.address}</div>` : ''}
      ${restaurant.phone ? `<div style="font-size:9px;">Tel: ${restaurant.phone}</div>` : ''}
    </div>
    <hr class="stardivider">
    <table>
      <tr>
        <td class="bold">Table: ${order.tableNumber}</td>
        <td class="right">Cust: ${order.customerName || 'Guest'}</td>
      </tr>
      ${showOrderNumber ? `<tr><td colspan="2">Order: #${order.id.slice(-4).toUpperCase()}</td></tr>` : ''}
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
          <td class="td-name">${item.name}${item.variant ? ` (${item.variant.name})` : ''}</td>
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
      <tr>
        <td>Tax (${taxPercent}%):</td>
        <td class="right">${currency}${taxAmount.toFixed(2)}</td>
      </tr>
    </table>
    <table class="total-table">
      <tr class="grand-total">
        <td>TOTAL DUE:</td>
        <td class="right">${currency}${grandTotal.toFixed(2)}</td>
      </tr>
    </table>
    <hr class="divider">
    <div class="center" style="font-size:10px;margin-top:6px;">
      <div>${headerMessage}</div>
      <div class="bold" style="margin-top:3px;">${footerMessage}</div>
    </div>
    <div style="height:24px;"></div>`;
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
    if (!isBluetoothPrinterConnected()) {
      // Auto-attempt reconnect if we have a device stored
      if (_btDevice && !_btDevice.gatt?.connected) {
        try {
          await _btDevice.gatt?.connect();
        } catch {
          // Can't auto-reconnect, fall back to browser
          printViaBrowser(order, type, restaurant);
          return { success: true, error: 'Bluetooth printer disconnected. Fell back to browser print.' };
        }
      } else {
        // No device paired at all — fall back to browser
        printViaBrowser(order, type, restaurant);
        return { success: true, error: 'No Bluetooth printer connected. Fell back to browser print. Please connect your printer in the Autoprint Settings.' };
      }
    }

    const bytes = type === 'kot'
      ? buildKotBytes(order, restaurant)
      : buildBillBytes(order, restaurant);

    const result = await sendBytesToBluetooth(bytes);
    if (!result.success) {
      // Fall back to browser print on failure
      printViaBrowser(order, type, restaurant);
      return { success: true, error: `Bluetooth failed (${result.error}). Fell back to browser print.` };
    }
    return { success: true };
  }

  // Browser mode
  printViaBrowser(order, type, restaurant);
  return { success: true };
}

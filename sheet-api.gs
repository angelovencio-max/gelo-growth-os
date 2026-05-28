// ============================================================
// Gelo Growth OS — Sheet API (Web App)
//
// This script turns your Google Sheet into a simple REST API.
// The dashboard reads and writes data through this script.
//
// SETUP:
// 1. Open your "Gelo Growth OS" Google Sheet
// 2. Go to Extensions > Apps Script
// 3. Create a NEW file (click + next to "Files") named "API"
// 4. Paste this entire script into the new file
// 5. Click Deploy > New deployment
// 6. Type: Web app
// 7. Execute as: Me
// 8. Who has access: Anyone
// 9. Click Deploy
// 10. Copy the Web App URL — paste it into sheets-config.js
//
// That's it! The dashboard can now read/write your sheet.
// ============================================================


// ── GET Handler (Read Data) ───────────────────────────────────
function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'readAll';
    const tab = e && e.parameter && e.parameter.tab;

    if (action === 'readAll') {
      return sendJSON(readAllTabs());
    }

    if (action === 'read' && tab) {
      return sendJSON(readTab(tab));
    }

    if (action === 'ping') {
      return sendJSON({ status: 'ok', timestamp: new Date().toISOString(), sheetName: SpreadsheetApp.getActiveSpreadsheet().getName() });
    }

    return sendJSON({ error: 'Unknown action. Use: readAll, read, or ping' });

  } catch (err) {
    return sendJSON({ error: err.message });
  }
}


// ── POST Handler (Write Data) ─────────────────────────────────
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const { action, tab, data, rowIndex } = payload;

    if (action === 'append' && tab && data) {
      const result = appendRow(tab, data);
      return sendJSON({ success: true, action: 'append', tab: tab, rowsAfter: result });
    }

    if (action === 'update' && tab && data && rowIndex !== undefined) {
      updateRow(tab, rowIndex, data);
      return sendJSON({ success: true, action: 'update', tab: tab, row: rowIndex });
    }

    if (action === 'batchAppend' && tab && Array.isArray(data)) {
      const result = batchAppendRows(tab, data);
      return sendJSON({ success: true, action: 'batchAppend', tab: tab, rowsAdded: data.length, rowsAfter: result });
    }

    return sendJSON({ error: 'Invalid action. Use: append, update, or batchAppend' });

  } catch (err) {
    return sendJSON({ error: err.message });
  }
}


// ── Read All Tabs ─────────────────────────────────────────────
function readAllTabs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tabNames = [
    'Contacts', 'Organizations', 'LinkedIn_Leads', 'Prime_Pipeline',
    'SCC_Content', 'Calmera_Orders', 'Source_Assets', 'Repurpose_Outputs',
    'Interactions', 'Tasks'
  ];

  const result = {};

  tabNames.forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (sheet && sheet.getLastRow() > 1) {
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn());
      const rows = dataRange.getValues();

      result[name] = rows
        .filter(row => row.some(cell => cell !== '' && cell !== null))
        .map(row => {
          const obj = {};
          headers.forEach((header, i) => {
            let val = row[i];
            // Convert dates to strings
            if (val instanceof Date) {
              val = Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
            }
            // Convert empty to ''
            if (val === null || val === undefined) val = '';
            obj[header] = val;
          });
          return obj;
        });
    } else {
      result[name] = [];
    }
  });

  return result;
}


// ── Read Single Tab ───────────────────────────────────────────
function readTab(tabName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(tabName);

  if (!sheet) return { error: `Tab "${tabName}" not found` };
  if (sheet.getLastRow() <= 1) return [];

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn());
  const rows = dataRange.getValues();

  return rows
    .filter(row => row.some(cell => cell !== '' && cell !== null))
    .map(row => {
      const obj = {};
      headers.forEach((header, i) => {
        let val = row[i];
        if (val instanceof Date) {
          val = Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        }
        if (val === null || val === undefined) val = '';
        obj[header] = val;
      });
      return obj;
    });
}


// ── Append Row ────────────────────────────────────────────────
function appendRow(tabName, data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(tabName);
  if (!sheet) throw new Error(`Tab "${tabName}" not found`);

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map(header => data[header] !== undefined ? data[header] : '');

  sheet.appendRow(row);
  return sheet.getLastRow() - 1; // data row count
}


// ── Batch Append ──────────────────────────────────────────────
function batchAppendRows(tabName, dataArray) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(tabName);
  if (!sheet) throw new Error(`Tab "${tabName}" not found`);

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rows = dataArray.map(data =>
    headers.map(header => data[header] !== undefined ? data[header] : '')
  );

  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow + 1, 1, rows.length, headers.length).setValues(rows);
  return sheet.getLastRow() - 1;
}


// ── Update Row ────────────────────────────────────────────────
function updateRow(tabName, rowIndex, data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(tabName);
  if (!sheet) throw new Error(`Tab "${tabName}" not found`);

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map(header => data[header] !== undefined ? data[header] : '');
  const sheetRow = rowIndex + 2; // +1 for header, +1 for 1-indexed

  sheet.getRange(sheetRow, 1, 1, headers.length).setValues([row]);
}


// ── JSON Response Helper ──────────────────────────────────────
function sendJSON(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}


// ── Test function (run manually to verify) ────────────────────
function testReadAll() {
  const data = readAllTabs();
  Logger.log('Tabs loaded: ' + Object.keys(data).join(', '));
  Object.entries(data).forEach(([tab, rows]) => {
    Logger.log(`  ${tab}: ${rows.length} rows`);
  });
}

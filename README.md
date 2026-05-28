# Gelo Growth OS — MVP Dashboard

A unified operating system for managing LinkedIn leads, Prime Consultancy pipeline, Self Care Club content, Calmera order reconfirmation, and content repurposing — all backed by Google Sheets.

## Quick Start (Demo Mode)

1. Open `index.html` in your browser — that's it!
2. The dashboard loads with realistic sample data across all 5 streams
3. Click through views, filter records, click rows to see details, and try the message generator

## Features

| Feature | Description |
|---------|-------------|
| **Daily Command Center** | Overdue tasks, KPI cards, pipeline funnel, activity feed |
| **LinkedIn Lead Funnel** | Full lifecycle tracking with lead scoring |
| **Prime Consultancy Pipeline** | Stage management with weighted value forecasting |
| **Self Care Club Content** | Content calendar with pillar/format/channel tracking |
| **Calmera Reconfirmation Desk** | Order confirmation with cutoff alerts |
| **Content Repurposing Engine** | Source assets → multi-channel derivatives |
| **Status Filters** | Filter by status, priority, and free-text search |
| **Lead Scoring** | Automatic scoring based on qualification signals |
| **Follow-up Reminders** | Color-coded overdue/today/upcoming indicators |
| **Message Generator** | 13 pre-built templates with auto-fill from records |

## Connecting to Google Sheets

To use real data instead of demo data:

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (e.g., "Gelo Growth OS")
3. Enable the **Google Sheets API** from the API Library

### 2. Create OAuth Credentials

1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > OAuth client ID**
3. Choose **Web application**
4. Add `http://localhost` and your hosting URL to **Authorized JavaScript origins**
5. Copy the **Client ID**

### 3. Create an API Key

1. Click **Create Credentials > API Key**
2. Restrict it to the **Google Sheets API**
3. Copy the **API Key**

### 4. Create Your Google Sheet

1. Create a new Google Sheet named **"Gelo Growth OS - Master"**
2. Create these tabs: `Contacts`, `Organizations`, `LinkedIn_Leads`, `Prime_Pipeline`, `SCC_Content`, `Calmera_Orders`, `Reconfirmations`, `Source_Assets`, `Repurpose_Outputs`, `Interactions`, `Tasks`, `Lists_Config`, `Automation_Log`
3. Copy the Spreadsheet ID from the URL (the long string between `/d/` and `/edit`)

### 5. Configure the Dashboard

Open `sheets-config.js` and fill in your credentials:

```javascript
const SHEETS_CONFIG = {
  API_KEY: 'YOUR_API_KEY_HERE',
  CLIENT_ID: 'YOUR_CLIENT_ID_HERE',
  SPREADSHEET_ID: 'YOUR_SPREADSHEET_ID_HERE',
  SHEET_NAME: 'LinkedIn_Leads',
  // ...
};
```

### 6. Add Google API Scripts

Add these scripts to `index.html` before your other scripts:

```html
<script src="https://apis.google.com/js/api.js"></script>
<script src="https://accounts.google.com/gsi/client"></script>
```

## File Structure

```
lead-tracker-crm/
├── index.html            # Main dashboard page
├── style.css             # Dark theme design system
├── app.js                # Core application logic
├── sheets-config.js      # Google Sheets API integration
├── message-templates.js  # Message templates & engine
├── demo-data.js          # Sample data for demo mode
└── README.md             # This file
```

## Google Sheet Column Reference

See the PRD for the complete column specifications per tab. The key tabs are:

- **LinkedIn_Leads**: lead_id, contact_id, source, stage, qualification_score, priority, next_action, next_action_date...
- **Prime_Pipeline**: opportunity_id, contact_id, service_interest, stage, estimated_value, probability_percent, weighted_value...
- **SCC_Content**: content_id, title, pillar, format, channel, status, planned_publish_at, views, comments...
- **Calmera_Orders**: order_id, customer_name, items_summary, order_amount, fulfillment_cutoff, reconfirmation_status...
- **Source_Assets / Repurpose_Outputs**: source_id → output_id with format, channel, status, performance...

## Tech Stack

- **Frontend**: Pure HTML + CSS + JavaScript (no framework)
- **Database**: Google Sheets via Sheets API v4
- **Design**: Dark theme with glassmorphism, Inter font, micro-animations
- **Hosting**: Any static host (GitHub Pages, Netlify, Vercel) or just open locally

## License

Private — Gelo Growth OS. All rights reserved.

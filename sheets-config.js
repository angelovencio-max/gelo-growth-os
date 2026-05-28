// ============================================================
// Gelo Growth OS — Sheets Connection (Simple Mode)
//
// Only 1 thing to configure: your Web App URL
// No API keys, no OAuth, no Google Cloud project needed.
// ============================================================

const SHEETS_CONFIG = {
  // Paste your Apps Script Web App URL here (from Deploy > Web app)
  WEBAPP_URL: 'https://script.google.com/macros/s/AKfycbwLCatU2GdBLNurcwfqmuGpbrqRUF97ffXoZErUe74GY_qSWvc2gAYlUgZUsnhz3Jo/exec',
};

// ── Column Mappings ───────────────────────────────────────────
// Maps Sheet column names (snake_case) → JS property names (camelCase)
const COLUMN_MAP = {
  // Contacts
  contact_id: 'contactId', full_name: 'fullName', email: 'email', mobile: 'mobile',
  linkedin_url: 'linkedinUrl', organization_id: 'organizationId', segments: 'segments',
  preferred_channel: 'preferredChannel', contact_basis: 'contactBasis',
  owner_id: 'ownerId', status: 'status', created_at: 'createdAt',
  updated_at: 'updatedAt', notes: 'notes',

  // Organizations
  organization_id: 'organizationId', organization_name: 'organizationName',
  industry: 'industry', website: 'website', source: 'source',
  account_status: 'accountStatus',

  // LinkedIn Leads
  lead_id: 'leadId', date_captured: 'dateCaptured',
  connection_status: 'connectionStatus', role: 'role',
  interest_signal: 'interestSignal', qualification_score: 'qualificationScore',
  priority: 'priority', stage: 'stage', last_interaction_at: 'lastInteractionAt',
  next_action: 'nextAction', next_action_date: 'nextActionDate',
  converted_opportunity_id: 'convertedOpportunityId',

  // Prime Pipeline
  opportunity_id: 'opportunityId', source_lead_id: 'sourceLeadId',
  service_interest: 'serviceInterest', problem_statement: 'problemStatement',
  estimated_value: 'estimatedValue', probability_percent: 'probabilityPercent',
  weighted_value: 'weightedValue', budget_range: 'budgetRange',
  decision_maker: 'decisionMaker', timeline: 'timeline',
  discovery_date: 'discoveryDate', proposal_date: 'proposalDate',
  close_date: 'closeDate', outcome_reason: 'outcomeReason',

  // SCC Content
  content_id: 'contentId', title: 'title', content_pillar: 'contentPillar',
  audience_need: 'audienceNeed', format: 'format', channel: 'channel',
  campaign: 'campaign', CTA: 'cta', planned_publish_at: 'plannedPublishAt',
  draft_url: 'draftUrl', asset_url: 'assetUrl', published_url: 'publishedUrl',
  published_at: 'publishedAt', views: 'views', comments: 'comments',
  saves: 'saves', replies: 'replies', repurpose_flag: 'repurposeFlag',
  source_id: 'sourceId',

  // Calmera Orders
  order_id: 'orderId', external_order_ref: 'externalOrderRef',
  customer_name: 'customerName', order_date: 'orderDate',
  items_summary: 'itemsSummary', order_amount: 'orderAmount',
  fulfillment_cutoff: 'fulfillmentCutoff',
  reconfirmation_status: 'reconfirmationStatus',
  latest_attempt_at: 'latestAttemptAt', response_due_at: 'responseDueAt',
  order_status: 'orderStatus', change_notes: 'changeNotes',
  resolved_at: 'resolvedAt',

  // Source Assets
  source_type: 'sourceType', origin_channel: 'originChannel',
  origin_url: 'originUrl', captured_at: 'capturedAt',
  key_theme: 'keyTheme', audience: 'audience',
  reuse_approved: 'reuseApproved', transcript_or_notes_url: 'transcriptUrl',

  // Repurpose Outputs
  output_id: 'outputId', linked_content_id: 'linkedContentId',
  target_brand: 'targetBrand', target_channel: 'targetChannel',
  angle_or_hook: 'angleOrHook', scheduled_at: 'scheduledAt',
  engagements: 'engagements', leads_generated: 'leadsGenerated',

  // Interactions
  interaction_id: 'interactionId', record_type: 'recordType',
  record_id: 'recordId', direction: 'direction',
  interaction_type: 'interactionType', occurred_at: 'occurredAt',
  summary: 'summary', outcome: 'outcome',

  // Tasks
  task_id: 'taskId', task_type: 'taskType',
  due_at: 'dueAt', assigned_to: 'assignedTo',
  completed_at: 'completedAt', generated_by_rule_id: 'generatedByRuleId',

  // Leads & Pipeline Extensions
  converted_to_pipeline: 'convertedToPipeline',
  pipeline_opportunity_id: 'pipelineOpportunityId',
  deal_status: 'dealStatus',
  payment_status: 'paymentStatus',
  pipeline_stage: 'stage',
  deal_value: 'estimatedValue',
  category: 'category',
  source: 'source',
  follow_up_time: 'followUpTime',
  name: 'contactName',
  lead_score: 'qualificationScore',
};

// Reverse map (camelCase → snake_case)
const REVERSE_COLUMN_MAP = {};
Object.entries(COLUMN_MAP).forEach(([snake, camel]) => {
  if (!REVERSE_COLUMN_MAP[camel]) {
    REVERSE_COLUMN_MAP[camel] = snake;
  }
});
// Explicitly prioritize standard mapping names when writing back to Sheets
const PRIORITY_REVERSE = {
  estimatedValue: 'estimated_value',
  stage: 'stage',
  pipelineOpportunityId: 'pipeline_opportunity_id',
  convertedToPipeline: 'converted_to_pipeline',
  dealStatus: 'deal_status',
  paymentStatus: 'payment_status',
  contactName: 'full_name',
  company: 'company',
};
Object.entries(PRIORITY_REVERSE).forEach(([camel, snake]) => {
  REVERSE_COLUMN_MAP[camel] = snake;
});

// Number fields that should be parsed as integers/floats
const NUMBER_FIELDS = new Set([
  'qualificationScore', 'estimatedValue', 'probabilityPercent', 'weightedValue',
  'orderAmount', 'views', 'comments', 'saves', 'replies', 'engagements', 'leadsGenerated',
]);

// Dynamic Tab name ↔ JS collection key mapping
function resolveTabToJsKey(tabName) {
  if (typeof settingsEngine !== 'undefined') {
    const mappings = settingsEngine.get().sheets.tabMappings;
    const modIdToJsKey = {
      leads:          'linkedinLeads',
      salesPipeline:  'primePipeline',
      brandCommunity: 'sccContent',
      productsOrders: 'calmeraOrders',
      content:        'repurposeOutputs',
      contacts:       'contacts',
      organizations:  'organizations',
    };
    
    for (const [modId, customTabName] of Object.entries(mappings)) {
      if (customTabName === tabName) {
        return modIdToJsKey[modId] || modId;
      }
    }
  }
  
  const defaultTabKeyMap = {
    'Contacts': 'contacts',
    'Organizations': 'organizations',
    'LinkedIn_Leads': 'linkedinLeads',
    'Prime_Pipeline': 'primePipeline',
    'SCC_Content': 'sccContent',
    'Calmera_Orders': 'calmeraOrders',
    'Source_Assets': 'sourceAssets',
    'Repurpose_Outputs': 'repurposeOutputs',
    'Interactions': 'interactions',
    'Tasks': 'tasks',
    'Calendar': 'tasks',
  };
  
  return defaultTabKeyMap[tabName] || tabName;
}

function resolveJsKeyToTab(jsKey) {
  if (typeof settingsEngine !== 'undefined') {
    const mappings = settingsEngine.get().sheets.tabMappings;
    const jsKeyToModId = {
      contacts: 'contacts',
      organizations: 'organizations',
      linkedinLeads: 'leads',
      primePipeline: 'salesPipeline',
      sccContent: 'brandCommunity',
      calmeraOrders: 'productsOrders',
      repurposeOutputs: 'content',
    };
    
    const modId = jsKeyToModId[jsKey];
    if (modId && mappings[modId]) {
      return mappings[modId];
    }
  }
  
  const defaultJsToTab = {
    contacts: 'Contacts',
    organizations: 'Organizations',
    linkedinLeads: 'LinkedIn_Leads',
    primePipeline: 'Prime_Pipeline',
    sccContent: 'SCC_Content',
    calmeraOrders: 'Calmera_Orders',
    sourceAssets: 'Source_Assets',
    repurposeOutputs: 'Repurpose_Outputs',
    interactions: 'Interactions',
    tasks: 'Tasks',
  };
  
  return defaultJsToTab[jsKey] || jsKey;
}


// ============================================================
// Sheets Service (Simple — no OAuth)
// ============================================================
class SheetsService {
  constructor() {
    this.isSignedIn = false;
  }

  isConfigured() {
    return !!(settingsEngine.getWebAppUrl());
  }

  // ── Test Connection ───────────────────────────────────────
  async ping() {
    if (!this.isConfigured()) return false;

    try {
      const url = `${settingsEngine.getWebAppUrl()}?action=ping`;
      const response = await fetch(url);
      const data = await response.json();
      return data.status === 'ok';
    } catch (err) {
      console.error('Ping failed:', err);
      return false;
    }
  }

  // ── Read All Data ─────────────────────────────────────────
  async readAllData() {
    const url = `${settingsEngine.getWebAppUrl()}?action=readAll`;
    const response = await fetch(url);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const rawData = await response.json();
    if (rawData.error) throw new Error(rawData.error);

    // Transform: snake_case → camelCase + parse numbers + denormalize
    const data = {};
    Object.entries(rawData).forEach(([tabName, rows]) => {
      const jsKey = resolveTabToJsKey(tabName);
      if (!jsKey) return;

      data[jsKey] = rows.map((row, index) => {
        const obj = { _rowIndex: index };
        Object.entries(row).forEach(([col, val]) => {
          const key = COLUMN_MAP[col] || col;
          // Parse numbers
          if (NUMBER_FIELDS.has(key) && val !== '' && val !== null) {
            obj[key] = parseFloat(val) || 0;
          }
          // Parse booleans
          else if (val === 'TRUE' || val === true) obj[key] = true;
          else if (val === 'FALSE' || val === false) obj[key] = false;
          else {
            obj[key] = val !== null && val !== undefined ? String(val) : '';
          }
        });
        return obj;
      });
    });

    // Denormalize — add display names
    this._denormalize(data);

    return data;
  }

  // ── Write Record ──────────────────────────────────────────
  async appendRecord(jsKey, record) {
    const tabName = resolveJsKeyToTab(jsKey);
    if (!tabName) throw new Error(`Unknown collection: ${jsKey}`);

    // Convert camelCase → snake_case for the sheet
    const sheetRow = {};
    Object.entries(record).forEach(([key, val]) => {
      const col = REVERSE_COLUMN_MAP[key] || key;
      if (val === true) sheetRow[col] = 'TRUE';
      else if (val === false) sheetRow[col] = 'FALSE';
      else if (Array.isArray(val)) sheetRow[col] = val.join(', ');
      else sheetRow[col] = val;
    });

    const response = await fetch(settingsEngine.getWebAppUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'append', tab: tabName, data: sheetRow }),
    });

    const result = await response.json();
    if (result.error) throw new Error(result.error);
    return result;
  }

  // ── Update Record ─────────────────────────────────────────
  async updateRecord(jsKey, rowIndex, record) {
    const tabName = resolveJsKeyToTab(jsKey);
    if (!tabName) throw new Error(`Unknown collection: ${jsKey}`);

    const sheetRow = {};
    Object.entries(record).forEach(([key, val]) => {
      const col = REVERSE_COLUMN_MAP[key] || key;
      if (val === true) sheetRow[col] = 'TRUE';
      else if (val === false) sheetRow[col] = 'FALSE';
      else if (Array.isArray(val)) sheetRow[col] = val.join(', ');
      else sheetRow[col] = val;
    });

    const response = await fetch(settingsEngine.getWebAppUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'update', tab: tabName, data: sheetRow, rowIndex }),
    });

    const result = await response.json();
    if (result.error) throw new Error(result.error);
    return result;
  }

  // ── Delete Record ─────────────────────────────────────────
  async deleteRecord(jsKey, rowIndex) {
    const tabName = resolveJsKeyToTab(jsKey);
    if (!tabName) throw new Error(`Unknown collection: ${jsKey}`);

    const response = await fetch(settingsEngine.getWebAppUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'delete', tab: tabName, rowIndex }),
    });

    const result = await response.json();
    if (result.error) throw new Error(result.error);
    return result;
  }

  // ── Sign In/Out (simplified — just flags) ─────────────────
  signIn()  { this.isSignedIn = true; }
  signOut() { this.isSignedIn = false; }

  // ── Denormalize ───────────────────────────────────────────
  _denormalize(data) {
    const contactMap = {};
    (data.contacts || []).forEach(c => { contactMap[c.contactId] = c; });

    const orgMap = {};
    (data.organizations || []).forEach(o => { orgMap[o.organizationId] = o; });

    // LinkedIn Leads
    (data.linkedinLeads || []).forEach(lead => {
      const contact = contactMap[lead.contactId];
      lead.contactName = contact?.fullName || lead.contactId || '—';
      lead.email = lead.email || contact?.email || '';
      lead.mobile = lead.mobile || contact?.mobile || '';
      lead.status = lead.status || contact?.status || 'Lead';
      const org = orgMap[lead.organizationId] || orgMap[contact?.organizationId];
      lead.company = org?.organizationName || '';
    });

    // Prime Pipeline
    (data.primePipeline || []).forEach(opp => {
      const contact = contactMap[opp.contactId];
      opp.contactName = contact?.fullName || opp.contactId || '—';
      const org = orgMap[opp.organizationId];
      opp.orgName = org?.organizationName || '';
    });

    // Calmera Orders
    (data.calmeraOrders || []).forEach(order => {
      if (!order.customerName) {
        const contact = contactMap[order.contactId];
        order.customerName = contact?.fullName || order.contactId || '—';
      }
    });

    // Interactions
    (data.interactions || []).forEach(int => {
      const contact = contactMap[int.contactId];
      int.contactName = contact?.fullName || int.contactId || '—';
    });
  }
}

// Singleton
const sheetsService = new SheetsService();

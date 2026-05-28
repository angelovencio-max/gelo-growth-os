// ============================================================
// Gelo Growth OS — Core Application v2
// State management, rendering, filtering, scoring, CRUD
// + Settings Engine, new views, mobile-first navigation
// ============================================================

// Module ID → internal view type mapping (keeps all existing logic intact)
const MODULE_TO_VIEW = {
  today:          'command-center',
  calendar:       'calendar',
  leads:          'linkedin',
  messages:       'messages',
  salesPipeline:  'prime',
  brandCommunity: 'scc',
  productsOrders: 'calmera',
  content:        'repurposing',
  settings:       'settings',
};
const VIEW_TO_MODULE = Object.fromEntries(Object.entries(MODULE_TO_VIEW).map(([k,v]) => [v,k]));

// Bottom-nav primary modules (always visible)
const BOTTOM_NAV_MODULES = ['today', 'calendar', 'leads', 'messages'];
// Modules that go in the "More" drawer
const DRAWER_MODULES = ['salesPipeline', 'brandCommunity', 'productsOrders', 'content', 'settings'];

class GeloGrowthOS {
  constructor() {
    // State
    this.currentView    = 'command-center';
    this.currentModule  = 'today';
    this.data           = null;
    this.filteredData   = null;
    this.filters        = { status: 'all', priority: 'all', search: '' };
    this.selectedRecord = null;
    this.sheetsConnected = false;
    this.sortConfig     = { key: null, direction: 'asc' };
    this.confirmCallback = null;
    this._calendarDate  = new Date();
    this._calendarViewMode = 'list'; // list | month
    this._settingsTab   = 'workspace';
    this._msgType       = 'follow-up';
    this._msgTone       = 'warm';
    this._currentMessage = null;

    // Init
    this.loadData();
    this.bindEvents();
    this._initApp();
  }

  // ── App Initialization ───────────────────────────────────────
  _initApp() {
    // Apply saved theme immediately
    settingsEngine.applyTheme();

    // Build navigation from settings
    this.buildNavigation();

    // Update profile in sidebar
    this.updateSidebarProfile();

    // Update app name
    this.updateAppName();

    // Set initial page title
    document.getElementById('page-title').textContent = settingsEngine.getWorkspaceName();

    // Render the first view
    this.render();
  }

  // ── Build Navigation from Settings ──────────────────────────
  buildNavigation() {
    const settings = settingsEngine.get();
    const modules  = settingsEngine.getVisibleModules();

    // Build sidebar nav
    const nav = document.getElementById('sidebar-nav');
    if (nav) {
      nav.innerHTML = modules.map(mod => `
        <button class="gos-nav-item ${this.currentModule === mod.id ? 'active' : ''}" 
                data-module="${mod.id}"
                onclick="app.navigateTo('${mod.id}')">
          <span class="nav-item-icon">${mod.icon}</span>
          <span class="nav-item-label">${mod.label}</span>
          ${mod.id === 'today' ? '<span class="nav-item-badge" id="nav-badge-overdue" style="display:none">0</span>' : ''}
        </button>
      `).join('');
    }

    // Build mobile bottom-nav labels dynamically
    BOTTOM_NAV_MODULES.forEach(moduleId => {
      const mod = settings.modules.find(m => m.id === moduleId);
      if (!mod) return;
      const label = document.getElementById(`mob-label-${moduleId}`);
      if (label) label.textContent = mod.label;
    });

    // Build "More" drawer nav
    const drawer = document.getElementById('drawer-nav');
    if (drawer) {
      const drawerMods = modules.filter(m => DRAWER_MODULES.includes(m.id));
      drawer.innerHTML = drawerMods.map(mod => `
        <button class="drawer-nav-item ${this.currentModule === mod.id ? 'active' : ''}"
                data-module="${mod.id}"
                onclick="app.navigateTo('${mod.id}'); app.closeMoreDrawer();">
          <span class="drawer-nav-icon">${mod.icon}</span>
          <span>${mod.label}</span>
        </button>
      `).join('');
    }
  }

  // ── Update Sidebar Profile ───────────────────────────────────
  updateSidebarProfile() {
    const p = settingsEngine.getProfile();
    const el = (id) => document.getElementById(id);
    if (el('sidebar-avatar')) el('sidebar-avatar').textContent = p.avatarInitials || 'GV';
    if (el('sidebar-name'))   el('sidebar-name').textContent   = p.displayName   || 'Gelo';
    if (el('sidebar-company')) el('sidebar-company').textContent = `${p.company || ''} · ${p.role || ''}`;
  }

  // ── Update App Name ──────────────────────────────────────────
  updateAppName() {
    const name = settingsEngine.getWorkspaceName();
    const el = document.getElementById('sidebar-app-name');
    if (el) el.textContent = name;
    document.getElementById('page-title').textContent = name;
  }

  // ── Primary Navigation ───────────────────────────────────────
  navigateTo(moduleId) {
    // Determine internal view type
    const viewType = MODULE_TO_VIEW[moduleId] || moduleId;
    this.currentModule = moduleId;
    this.currentView   = viewType;
    this.filters = { status: 'all', priority: 'all', search: '' };
    this.sortConfig = { key: null, direction: 'asc' };

    // Update nav active states
    this._updateActiveNav(moduleId);

    // Update topbar
    this.updateTopbar();

    // Update filter options
    this.updateFilterOptions();

    // Apply filters and render
    this.applyFilters();
    this.renderContent();

    // Reset search input
    const searchInput = document.getElementById('global-search');
    if (searchInput) searchInput.value = '';

    // Reset filter dropdown
    const statusFilter = document.getElementById('filter-status');
    if (statusFilter) statusFilter.value = 'all';

    // Close any open overlays
    this.closeMoreDrawer();
    this.closeMobileSidebar();
  }

  _updateActiveNav(moduleId) {
    // Sidebar nav items
    document.querySelectorAll('.gos-nav-item[data-module]').forEach(item => {
      item.classList.toggle('active', item.dataset.module === moduleId);
    });
    // Bottom nav buttons
    document.querySelectorAll('.mobile-nav-btn[data-module]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.module === moduleId);
    });
    // Drawer nav items
    document.querySelectorAll('.drawer-nav-item[data-module]').forEach(item => {
      item.classList.toggle('active', item.dataset.module === moduleId);
    });
  }

  // ── Mobile Sidebar ───────────────────────────────────────────
  openMobileSidebar() {
    document.getElementById('sidebar')?.classList.add('sidebar-open');
    document.getElementById('sidebar-overlay')?.classList.add('active');
  }

  closeMobileSidebar() {
    document.getElementById('sidebar')?.classList.remove('sidebar-open');
    document.getElementById('sidebar-overlay')?.classList.remove('active');
  }

  // ── More Drawer ──────────────────────────────────────────────
  openMoreDrawer() {
    document.getElementById('mobile-drawer')?.classList.add('open');
    document.getElementById('drawer-backdrop').style.display = 'block';
  }

  closeMoreDrawer() {
    document.getElementById('mobile-drawer')?.classList.remove('open');
    const bd = document.getElementById('drawer-backdrop');
    if (bd) bd.style.display = 'none';
  }

  // ── Theme Toggle ────────────────────────────────────────────
  toggleTheme() {
    const newTheme = settingsEngine.toggleTheme();
    this.showToast(`Switched to ${newTheme} mode`, 'success');
  }

  // ── Handle search (replaces previous event listener approach) 
  handleSearch(value) {
    this.filters.search = value.toLowerCase();
    this.applyFilters();
    this.renderContent();
  }

  // ── Handle filter status dropdown
  handleFilterStatus(value) {
    this.filters.status = value;
    this.applyFilters();
    this.renderContent();
  }

  // ── Confirm Dialog ───────────────────────────────────────────
  showConfirm(title, message, btnLabel, callback) {
    this.confirmCallback = callback;
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    document.getElementById('confirm-action-btn').textContent = btnLabel || 'Confirm';
    document.getElementById('confirm-modal-overlay').style.display = 'flex';
  }
  executeConfirm() {
    document.getElementById('confirm-modal-overlay').style.display = 'none';
    if (this.confirmCallback) { this.confirmCallback(); this.confirmCallback = null; }
  }
  cancelConfirm() {
    document.getElementById('confirm-modal-overlay').style.display = 'none';
    this.confirmCallback = null;
  }

  // ── Data Loading ────────────────────────────────────────────
  loadData() {
    // Use demo data (or Sheets data when connected)
    this.data = { ...DEMO_DATA };
    this.applyFilters();
  }

  // ── Event Binding ───────────────────────────────────────────
  bindEvents() {
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closePanel();
        this.closeModal('add-modal');
        this.closeModal('msg-modal');
        this.closeMobileSidebar();
        this.closeMoreDrawer();
      }
    });
  }

  // ── View Switching (legacy support — use navigateTo() for new code) ─
  switchView(view) {
    // If given a module ID, delegate to navigateTo
    if (MODULE_TO_VIEW[view]) { this.navigateTo(view); return; }
    // If given an internal view type, find the module and navigate
    const moduleId = VIEW_TO_MODULE[view] || view;
    this.navigateTo(moduleId);
  }

  // ── Filter Options per View ─────────────────────────────────
  updateFilterOptions() {
    const statusFilter = document.getElementById('filter-status');
    if (!statusFilter) return;

    const options = { 'all': 'All Statuses' };

    switch (this.currentView) {
      case 'linkedin':
        Object.assign(options, { 'New': 'New', 'Qualified': 'Qualified', 'Contacted': 'Contacted', 'Nurturing': 'Nurturing', 'Converted': 'Converted', 'Recycle': 'Recycle', 'Closed': 'Closed' });
        break;
      case 'prime':
        Object.assign(options, { 'New Inquiry': 'New Inquiry', 'Qualified': 'Qualified', 'Discovery': 'Discovery', 'Proposal Sent': 'Proposal Sent', 'Negotiation': 'Negotiation', 'Won': 'Won', 'Lost': 'Lost', 'Handoff': 'Handoff' });
        break;
      case 'scc':
        Object.assign(options, { 'Idea': 'Idea', 'Planned': 'Planned', 'Draft': 'Draft', 'Review': 'Review', 'Scheduled': 'Scheduled', 'Published': 'Published', 'Archived': 'Archived' });
        break;
      case 'calmera':
        Object.assign(options, { 'Pending Contact': 'Pending Contact', 'Awaiting Response': 'Awaiting Response', 'Confirmed': 'Confirmed', 'Changed': 'Changed', 'Cancelled': 'Cancelled', 'Escalated': 'Escalated' });
        break;
      case 'repurposing':
        Object.assign(options, { 'Available': 'Available', 'Queued': 'Queued', 'Draft': 'Draft', 'Review': 'Review', 'Scheduled': 'Scheduled', 'Published': 'Published', 'Evaluated': 'Evaluated' });
        break;
      default:
        Object.assign(options, { 'Open': 'Open', 'In Progress': 'In Progress', 'Completed': 'Completed' });
    }

    statusFilter.innerHTML = Object.entries(options)
      .map(([v, l]) => `<option value="${v}">${l}</option>`)
      .join('');
  }

  // ── Filtering ───────────────────────────────────────────────
  applyFilters() {
    const viewDataMap = {
      'command-center': 'tasks',
      'linkedin': 'linkedinLeads',
      'prime': 'primePipeline',
      'scc': 'sccContent',
      'calmera': 'calmeraOrders',
      'repurposing': 'repurposeOutputs',
    };

    const dataKey = viewDataMap[this.currentView] || 'tasks';
    let items = [...(this.data[dataKey] || [])];

    // Status filter
    if (this.filters.status !== 'all') {
      items = items.filter(item => {
        const status = item.stage || item.status || item.reconfirmationStatus || '';
        return status === this.filters.status;
      });
    }

    // Priority filter
    if (this.filters.priority !== 'all') {
      items = items.filter(item => (item.priority || '') === this.filters.priority);
    }

    // Search
    if (this.filters.search) {
      items = items.filter(item => {
        const searchable = Object.values(item).join(' ').toLowerCase();
        return searchable.includes(this.filters.search);
      });
    }

    // Sort
    if (this.sortConfig.key) {
      items.sort((a, b) => {
        let aVal = a[this.sortConfig.key] || '';
        let bVal = b[this.sortConfig.key] || '';
        if (typeof aVal === 'number') return this.sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
        return this.sortConfig.direction === 'asc'
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      });
    }

    this.filteredData = items;
  }

  // ── Sorting ─────────────────────────────────────────────────
  toggleSort(key) {
    if (this.sortConfig.key === key) {
      this.sortConfig.direction = this.sortConfig.direction === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortConfig = { key, direction: 'asc' };
    }
    this.applyFilters();
    this.renderContent();
  }

  // ── Main Render ─────────────────────────────────────────────
  render() {
    this.updateTopbar();
    this.renderContent();
  }

  updateTopbar() {
    const settings  = settingsEngine.get();
    const profile   = settings.profile;
    const modules   = settings.modules;

    // Build title from module label
    const mod = modules.find(m => m.id === this.currentModule) || {};
    const defaultSubtitles = {
      today:          `Good ${this._getTimeOfDay()}, ${profile.displayName}! Here's your daily action plan.`,
      calendar:       'Your upcoming calls, follow-ups, and scheduled tasks',
      leads:          'Capture, qualify, nurture, and convert your leads',
      messages:       'Generate and copy messages for any lead or stage',
      salesPipeline:  'Track opportunities from inquiry to closed deal',
      brandCommunity: 'Plan, create, and publish community content',
      productsOrders: 'Manage product leads, orders, and customer reconfirmations',
      content:        'Turn source assets into multi-channel content',
      settings:       'Customize your Growth OS workspace',
    };

    const title    = mod.label || 'Dashboard';
    const subtitle = defaultSubtitles[this.currentModule] || mod.description || '';

    const titleEl    = document.getElementById('view-title');
    const subtitleEl = document.getElementById('view-subtitle');
    if (titleEl)    titleEl.textContent    = title;
    if (subtitleEl) subtitleEl.textContent = subtitle;
  }

  _getTimeOfDay() {
    const h = new Date().getHours();
    if (h < 12) return 'morning';
    if (h < 17) return 'afternoon';
    return 'evening';
  }

  renderContent() {
    const content = document.getElementById('main-content');
    if (!content) return;

    content.className = 'gos-content animate-fade-in';

    switch (this.currentView) {
      case 'command-center': this.renderToday(content); break;
      case 'calendar':       this.renderCalendar(content); break;
      case 'linkedin':       this.renderLinkedIn(content); break;
      case 'messages':       this.renderMessagesPage(content); break;
      case 'prime':          this.renderPrime(content); break;
      case 'scc':            this.renderSCC(content); break;
      case 'calmera':        this.renderCalmera(content); break;
      case 'repurposing':    this.renderRepurposing(content); break;
      case 'settings':       this.renderSettings(content); break;
      default:               this.renderToday(content);
    }
  }

  // ── Today / Command Center ──────────────────────────────────
  renderToday(container) { this.renderCommandCenter(container); }

  // ── Legacy Command Center (kept for compatibility) ───────────
  renderCommandCenter(container) {
    const tasks = this.data.tasks;
    const openTasks = tasks.filter(t => t.status !== 'Completed' && t.status !== 'Cancelled');
    const overdue = openTasks.filter(t => isOverdue(t.dueAt));
    const dueToday = openTasks.filter(t => isDueToday(t.dueAt));
    const dueWeek = openTasks.filter(t => { const d = daysUntil(t.dueAt); return d > 0 && d <= 7; });
    const critical = openTasks.filter(t => t.priority === 'Critical');

    const pipeline = this.data.primePipeline;
    const activeDeals = pipeline.filter(p => !['Won', 'Lost'].includes(p.stage));
    const totalWeighted = pipeline.reduce((s, p) => s + (p.weightedValue || 0), 0);
    const wonDeals = pipeline.filter(p => p.stage === 'Won');

    const leads = this.data.linkedinLeads;
    const activeLeads = leads.filter(l => !['Closed', 'Converted'].includes(l.stage));

    const orders = this.data.calmeraOrders;
    const pendingOrders = orders.filter(o => !['Confirmed', 'Closed'].includes(o.reconfirmationStatus) && o.reconfirmationStatus !== 'Changed');
    const atRiskOrders = orders.filter(o => o.orderStatus === 'At Risk' || o.reconfirmationStatus === 'Escalated');

    container.innerHTML = `
      <div class="gos-kpi-grid">
        <div class="gos-kpi-card red">
          <div class="gos-kpi-header">
            <span class="gos-kpi-label">Overdue</span>
            <span class="gos-kpi-icon">⚠️</span>
          </div>
          <div class="gos-kpi-value">${overdue.length}</div>
          <div class="gos-kpi-detail">${critical.length} critical actions</div>
        </div>
        <div class="gos-kpi-card blue">
          <div class="gos-kpi-header">
            <span class="gos-kpi-label">Due Today</span>
            <span class="gos-kpi-icon">📋</span>
          </div>
          <div class="gos-kpi-value">${dueToday.length}</div>
          <div class="gos-kpi-detail">${dueWeek.length} due this week</div>
        </div>
        <div class="gos-kpi-card purple">
          <div class="gos-kpi-header">
            <span class="gos-kpi-label">Pipeline Value</span>
            <span class="gos-kpi-icon">💰</span>
          </div>
          <div class="gos-kpi-value">₱${this.formatNumber(totalWeighted)}</div>
          <div class="gos-kpi-detail">${activeDeals.length} active deals</div>
        </div>
        <div class="gos-kpi-card green">
          <div class="gos-kpi-header">
            <span class="gos-kpi-label">Active Leads</span>
            <span class="gos-kpi-icon">🔗</span>
          </div>
          <div class="gos-kpi-value">${activeLeads.length}</div>
          <div class="gos-kpi-detail">${leads.filter(l => l.stage === 'Converted').length} converted</div>
        </div>
        <div class="gos-kpi-card amber">
          <div class="gos-kpi-header">
            <span class="gos-kpi-label">Pending Orders</span>
            <span class="gos-kpi-icon">📦</span>
          </div>
          <div class="gos-kpi-value">${pendingOrders.length}</div>
          <div class="gos-kpi-detail">${atRiskOrders.length > 0 ? `<span class="text-red">${atRiskOrders.length} at risk!</span>` : 'No escalations'}</div>
        </div>
        <div class="gos-kpi-card green">
          <div class="gos-kpi-header">
            <span class="gos-kpi-label">Won Revenue</span>
            <span class="gos-kpi-icon">🏆</span>
          </div>
          <div class="gos-kpi-value">₱${this.formatNumber(wonDeals.reduce((s, d) => s + d.estimatedValue, 0))}</div>
          <div class="gos-kpi-detail">${wonDeals.length} closed won</div>
        </div>
      </div>

      <div class="gos-section-grid">
        <div class="gos-section-card">
          <div class="gos-section-card-header">
            <span class="gos-section-card-title">🔴 Critical & Overdue Tasks</span>
            <span class="gos-table-count">${overdue.length + critical.filter(t => !isOverdue(t.dueAt)).length}</span>
          </div>
          <div class="gos-section-card-body">
            <ul class="gos-task-list">
              ${[...overdue, ...critical.filter(t => !isOverdue(t.dueAt))].slice(0, 6).map(t => this.renderTaskItem(t)).join('')}
              ${overdue.length === 0 && critical.filter(t => !isOverdue(t.dueAt)).length === 0 ? '<div class="gos-empty" style="padding:30px"><span class="gos-empty-icon">✅</span><span class="gos-empty-title">All clear!</span></div>' : ''}
            </ul>
          </div>
        </div>

        <div class="gos-section-card">
          <div class="gos-section-card-header">
            <span class="gos-section-card-title">📋 Due Today</span>
            <span class="gos-table-count">${dueToday.length}</span>
          </div>
          <div class="gos-section-card-body">
            <ul class="gos-task-list">
              ${dueToday.slice(0, 6).map(t => this.renderTaskItem(t)).join('')}
              ${dueToday.length === 0 ? '<div class="gos-empty" style="padding:30px"><span class="gos-empty-icon">📭</span><span class="gos-empty-title">Nothing due today</span></div>' : ''}
            </ul>
          </div>
        </div>

        <div class="gos-section-card">
          <div class="gos-section-card-header">
            <span class="gos-section-card-title">👤 ${settingsEngine.getModuleLabel('leads')} Funnel</span>
            <button class="gos-btn gos-btn-ghost gos-btn-sm" onclick="app.navigateTo('leads')">View All →</button>
          </div>
          <div class="gos-section-card-body">
            ${this.renderFunnel(leads, ['New', 'Qualified', 'Contacted', 'Nurturing', 'Converted'])}
          </div>
        </div>

        <div class="gos-section-card">
          <div class="gos-section-card-header">
            <span class="gos-section-card-title">💼 ${settingsEngine.getModuleLabel('salesPipeline')}</span>
            <button class="gos-btn gos-btn-ghost gos-btn-sm" onclick="app.navigateTo('salesPipeline')">View All →</button>
          </div>
          <div class="gos-section-card-body">
            ${this.renderFunnel(pipeline, ['New Inquiry', 'Discovery', 'Proposal Sent', 'Negotiation', 'Won'], 'stage')}
          </div>
        </div>

        <div class="gos-section-card">
          <div class="gos-section-card-header">
            <span class="gos-section-card-title">📦 ${settingsEngine.getModuleLabel('productsOrders')} Alerts</span>
            <button class="gos-btn gos-btn-ghost gos-btn-sm" onclick="app.navigateTo('productsOrders')">View All →</button>
          </div>
          <div class="gos-section-card-body">
            <ul class="gos-task-list">
              ${orders.filter(o => o.reconfirmationStatus === 'Escalated' || o.reconfirmationStatus === 'Pending Contact' || o.reconfirmationStatus === 'Awaiting Response').slice(0, 4).map(o => `
                <li class="gos-task-item ${o.reconfirmationStatus === 'Escalated' ? 'overdue' : ''}" onclick="app.openRecordPanel('calmera', '${o.orderId}')">
                  <div class="gos-task-info">
                    <div class="gos-task-title">${o.customerName} — ${o.externalOrderRef}</div>
                    <div class="gos-task-meta">
                      ${this.renderBadge(o.reconfirmationStatus)}
                      <span>₱${o.orderAmount.toLocaleString()}</span>
                      <span>Cutoff: ${o.fulfillmentCutoff}</span>
                    </div>
                  </div>
                </li>
              `).join('')}
            </ul>
          </div>
        </div>

        <div class="gos-section-card">
          <div class="gos-section-card-header">
            <span class="gos-section-card-title">📢 Recent Activity</span>
          </div>
          <div class="gos-section-card-body">
            <ul class="gos-task-list">
              ${this.data.interactions.slice(0, 5).map(i => `
                <li class="gos-task-item">
                  <div class="gos-task-info">
                    <div class="gos-task-title">${i.contactName} — ${i.interactionType}</div>
                    <div class="gos-task-meta">
                      <span>${i.channel}</span>
                      <span>${i.direction}</span>
                      <span>${i.occurredAt}</span>
                    </div>
                  </div>
                </li>
              `).join('')}
            </ul>
          </div>
        </div>
      </div>
    `;
  }

  renderTaskItem(task) {
    const due = daysUntil(task.dueAt);
    const overdueClass = due < 0 ? 'overdue' : due === 0 ? 'due-today' : '';
    const dueLabel = due < 0 ? `${Math.abs(due)}d overdue` : due === 0 ? 'Due today' : `${due}d left`;
    const dueClass = due < 0 ? 'overdue' : due === 0 ? 'due-today' : due <= 3 ? 'due-soon' : 'due-later';

    return `
      <li class="gos-task-item ${overdueClass}" onclick="app.openTaskPanel('${task.taskId}')">
        <div class="gos-task-check ${task.status === 'Completed' ? 'checked' : ''}" onclick="event.stopPropagation(); app.toggleTask('${task.taskId}')"></div>
        <div class="gos-task-info">
          <div class="gos-task-title">${task.title}</div>
          <div class="gos-task-meta">
            ${this.renderBadge(task.priority)}
            <span class="gos-due ${dueClass}">
              <span class="due-icon">${due < 0 ? '🔴' : due === 0 ? '🔵' : '⏳'}</span>
              ${dueLabel}
            </span>
            <span>${task.recordType}</span>
          </div>
        </div>
      </li>
    `;
  }

  renderFunnel(data, stages, stageKey = 'stage') {
    const counts = stages.map(s => data.filter(d => d[stageKey] === s).length);
    const max = Math.max(...counts, 1);
    const colors = ['#3b82f6', '#22d3ee', '#6366f1', '#f59e0b', '#10b981'];

    return `
      <div class="gos-funnel">
        ${stages.map((stage, i) => `
          <div class="gos-funnel-stage">
            <span class="gos-funnel-count">${counts[i]}</span>
            <div class="gos-funnel-bar" style="height: ${Math.max((counts[i] / max) * 50, 8)}px; background: ${colors[i] || colors[0]};"></div>
            <span class="gos-funnel-label">${stage.length > 10 ? stage.substring(0, 8) + '…' : stage}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  // ── LinkedIn Leads View ─────────────────────────────────────
  renderLinkedIn(container) {
    const leads = this.data.linkedinLeads;
    const activeLeads = leads.filter(l => !['Closed', 'Converted'].includes(l.stage));
    const noAction = activeLeads.filter(l => isOverdue(l.nextActionDate));
    const avgScore = leads.length > 0 ? Math.round(leads.reduce((s, l) => s + l.qualificationScore, 0) / leads.length) : 0;
    const converted = leads.filter(l => l.stage === 'Converted').length;
    const convRate = leads.length > 0 ? Math.round((converted / leads.length) * 100) : 0;

    container.innerHTML = `
      <div class="gos-kpi-grid">
        <div class="gos-kpi-card purple">
          <div class="gos-kpi-header"><span class="gos-kpi-label">Total Leads</span><span class="gos-kpi-icon">👥</span></div>
          <div class="gos-kpi-value">${leads.length}</div>
          <div class="gos-kpi-detail">${activeLeads.length} active</div>
        </div>
        <div class="gos-kpi-card green">
          <div class="gos-kpi-header"><span class="gos-kpi-label">Conversion Rate</span><span class="gos-kpi-icon">📈</span></div>
          <div class="gos-kpi-value">${convRate}%</div>
          <div class="gos-kpi-detail">${converted} converted</div>
        </div>
        <div class="gos-kpi-card blue">
          <div class="gos-kpi-header"><span class="gos-kpi-label">Avg Score</span><span class="gos-kpi-icon">⭐</span></div>
          <div class="gos-kpi-value">${avgScore}</div>
          <div class="gos-kpi-detail">of 100 qualification points</div>
        </div>
        <div class="gos-kpi-card ${noAction.length > 0 ? 'red' : 'green'}">
          <div class="gos-kpi-header"><span class="gos-kpi-label">Overdue Follow-ups</span><span class="gos-kpi-icon">${noAction.length > 0 ? '⚠️' : '✅'}</span></div>
          <div class="gos-kpi-value">${noAction.length}</div>
          <div class="gos-kpi-detail">${noAction.length > 0 ? 'Need immediate attention' : 'All follow-ups on track'}</div>
        </div>
      </div>

      ${this.renderDataTable(this.filteredData, [
        { key: 'contactName', label: 'Name', render: (v, r) => `<span class="cell-name">${v}</span><br><span class="cell-company">${r.company}</span>` },
        { key: 'stage', label: 'Stage', render: (v) => this.renderBadge(v) },
        { key: 'qualificationScore', label: 'Score', render: (v) => this.renderScore(v) },
        { key: 'priority', label: 'Priority', render: (v) => this.renderBadge(v) },
        { key: 'nextAction', label: 'Next Action', render: (v) => `<span class="truncate" style="max-width:200px;display:inline-block">${v || '—'}</span>` },
        { key: 'nextActionDate', label: 'Follow-up', render: (v) => this.renderDueDate(v) },
        { key: 'source', label: 'Source' },
      ], 'linkedin', 'leadId')}
    `;
  }

  // ── Prime Pipeline View ─────────────────────────────────────
  renderPrime(container) {
    const pipeline = this.data.primePipeline;
    const activeDeals = pipeline.filter(p => !['Won', 'Lost'].includes(p.stage));
    const totalPipeline = activeDeals.reduce((s, p) => s + (p.estimatedValue || 0), 0);
    const totalWeighted = activeDeals.reduce((s, p) => s + (p.weightedValue || 0), 0);
    const won = pipeline.filter(p => p.stage === 'Won');
    const lost = pipeline.filter(p => p.stage === 'Lost');
    const winRate = (won.length + lost.length) > 0 ? Math.round((won.length / (won.length + lost.length)) * 100) : 0;

    container.innerHTML = `
      <div class="gos-kpi-grid">
        <div class="gos-kpi-card purple">
          <div class="gos-kpi-header"><span class="gos-kpi-label">Total Pipeline</span><span class="gos-kpi-icon">💼</span></div>
          <div class="gos-kpi-value">₱${this.formatNumber(totalPipeline)}</div>
          <div class="gos-kpi-detail">${activeDeals.length} active opportunities</div>
        </div>
        <div class="gos-kpi-card blue">
          <div class="gos-kpi-header"><span class="gos-kpi-label">Weighted Forecast</span><span class="gos-kpi-icon">📊</span></div>
          <div class="gos-kpi-value">₱${this.formatNumber(totalWeighted)}</div>
          <div class="gos-kpi-detail">probability-adjusted value</div>
        </div>
        <div class="gos-kpi-card green">
          <div class="gos-kpi-header"><span class="gos-kpi-label">Win Rate</span><span class="gos-kpi-icon">🏆</span></div>
          <div class="gos-kpi-value">${winRate}%</div>
          <div class="gos-kpi-detail">${won.length} won / ${lost.length} lost</div>
        </div>
        <div class="gos-kpi-card amber">
          <div class="gos-kpi-header"><span class="gos-kpi-label">Won Revenue</span><span class="gos-kpi-icon">💰</span></div>
          <div class="gos-kpi-value">₱${this.formatNumber(won.reduce((s, d) => s + d.estimatedValue, 0))}</div>
          <div class="gos-kpi-detail">${won.length} closed deals</div>
        </div>
      </div>

      ${this.renderDataTable(this.filteredData, [
        { key: 'contactName', label: 'Contact', render: (v, r) => `<span class="cell-name">${v}</span><br><span class="cell-company">${r.orgName}</span>` },
        { key: 'serviceInterest', label: 'Service', render: (v) => `<span class="truncate" style="max-width:180px;display:inline-block">${v}</span>` },
        { key: 'stage', label: 'Stage', render: (v) => this.renderBadge(v) },
        { key: 'estimatedValue', label: 'Value', render: (v) => `<span class="cell-value">₱${(v || 0).toLocaleString()}</span>` },
        { key: 'probabilityPercent', label: 'Prob.', render: (v) => `${v || 0}%` },
        { key: 'weightedValue', label: 'Weighted', render: (v) => `<span class="cell-value">₱${(v || 0).toLocaleString()}</span>` },
        { key: 'nextAction', label: 'Next Action', render: (v) => `<span class="truncate" style="max-width:180px;display:inline-block">${v || '—'}</span>` },
        { key: 'nextActionDate', label: 'Due', render: (v) => this.renderDueDate(v) },
      ], 'prime', 'opportunityId')}
    `;
  }

  // ── Self Care Club Content View ─────────────────────────────
  renderSCC(container) {
    const content = this.data.sccContent;
    const published = content.filter(c => c.status === 'Published');
    const upcoming = content.filter(c => ['Scheduled', 'Review', 'Draft', 'Planned'].includes(c.status));
    const totalViews = published.reduce((s, c) => s + (c.views || 0), 0);
    const totalEng = published.reduce((s, c) => s + (c.comments || 0) + (c.saves || 0) + (c.replies || 0), 0);

    container.innerHTML = `
      <div class="gos-kpi-grid">
        <div class="gos-kpi-card purple">
          <div class="gos-kpi-header"><span class="gos-kpi-label">Total Content</span><span class="gos-kpi-icon">📝</span></div>
          <div class="gos-kpi-value">${content.length}</div>
          <div class="gos-kpi-detail">${upcoming.length} in pipeline</div>
        </div>
        <div class="gos-kpi-card green">
          <div class="gos-kpi-header"><span class="gos-kpi-label">Published</span><span class="gos-kpi-icon">🚀</span></div>
          <div class="gos-kpi-value">${published.length}</div>
          <div class="gos-kpi-detail">${content.filter(c => c.repurposeFlag).length} flagged for repurpose</div>
        </div>
        <div class="gos-kpi-card blue">
          <div class="gos-kpi-header"><span class="gos-kpi-label">Total Views</span><span class="gos-kpi-icon">👀</span></div>
          <div class="gos-kpi-value">${this.formatNumber(totalViews)}</div>
          <div class="gos-kpi-detail">across published content</div>
        </div>
        <div class="gos-kpi-card amber">
          <div class="gos-kpi-header"><span class="gos-kpi-label">Engagements</span><span class="gos-kpi-icon">💬</span></div>
          <div class="gos-kpi-value">${totalEng}</div>
          <div class="gos-kpi-detail">comments + saves + replies</div>
        </div>
      </div>

      ${this.renderDataTable(this.filteredData, [
        { key: 'title', label: 'Title', render: (v) => `<span class="cell-name truncate" style="max-width:250px;display:inline-block">${v}</span>` },
        { key: 'contentPillar', label: 'Pillar' },
        { key: 'format', label: 'Format' },
        { key: 'channel', label: 'Channel' },
        { key: 'status', label: 'Status', render: (v) => this.renderBadge(v) },
        { key: 'plannedPublishAt', label: 'Publish Date', render: (v) => this.renderDueDate(v) },
        { key: 'views', label: 'Views', render: (v) => v > 0 ? this.formatNumber(v) : '—' },
      ], 'scc', 'contentId')}
    `;
  }

  // ── Calmera Orders View ─────────────────────────────────────
  renderCalmera(container) {
    const orders = this.data.calmeraOrders;
    const pending = orders.filter(o => ['Pending Contact', 'Awaiting Response'].includes(o.reconfirmationStatus));
    const confirmed = orders.filter(o => o.reconfirmationStatus === 'Confirmed');
    const atRisk = orders.filter(o => o.reconfirmationStatus === 'Escalated' || o.orderStatus === 'At Risk');
    const totalValue = orders.reduce((s, o) => s + (o.orderAmount || 0), 0);

    container.innerHTML = `
      <div class="gos-kpi-grid">
        <div class="gos-kpi-card purple">
          <div class="gos-kpi-header"><span class="gos-kpi-label">Total Orders</span><span class="gos-kpi-icon">📦</span></div>
          <div class="gos-kpi-value">${orders.length}</div>
          <div class="gos-kpi-detail">₱${this.formatNumber(totalValue)} total value</div>
        </div>
        <div class="gos-kpi-card amber">
          <div class="gos-kpi-header"><span class="gos-kpi-label">Pending</span><span class="gos-kpi-icon">⏳</span></div>
          <div class="gos-kpi-value">${pending.length}</div>
          <div class="gos-kpi-detail">awaiting contact or response</div>
        </div>
        <div class="gos-kpi-card green">
          <div class="gos-kpi-header"><span class="gos-kpi-label">Confirmed</span><span class="gos-kpi-icon">✅</span></div>
          <div class="gos-kpi-value">${confirmed.length}</div>
          <div class="gos-kpi-detail">${Math.round((confirmed.length / Math.max(orders.length, 1)) * 100)}% confirmation rate</div>
        </div>
        <div class="gos-kpi-card ${atRisk.length > 0 ? 'red' : 'green'}">
          <div class="gos-kpi-header"><span class="gos-kpi-label">At Risk</span><span class="gos-kpi-icon">${atRisk.length > 0 ? '🚨' : '✅'}</span></div>
          <div class="gos-kpi-value">${atRisk.length}</div>
          <div class="gos-kpi-detail">${atRisk.length > 0 ? 'Escalated — act now!' : 'No escalations'}</div>
        </div>
      </div>

      ${this.renderDataTable(this.filteredData, [
        { key: 'customerName', label: 'Customer', render: (v, r) => `<span class="cell-name">${v}</span><br><span class="cell-mono">${r.externalOrderRef}</span>` },
        { key: 'itemsSummary', label: 'Items', render: (v) => `<span class="truncate" style="max-width:200px;display:inline-block">${v}</span>` },
        { key: 'orderAmount', label: 'Amount', render: (v) => `<span class="cell-value">₱${(v || 0).toLocaleString()}</span>` },
        { key: 'reconfirmationStatus', label: 'Status', render: (v) => this.renderBadge(v) },
        { key: 'fulfillmentCutoff', label: 'Cutoff', render: (v) => this.renderDueDate(v) },
        { key: 'orderStatus', label: 'Order Status', render: (v) => this.renderBadge(v) },
        { key: 'preferredChannel', label: 'Channel' },
      ], 'calmera', 'orderId')}
    `;
  }

  // ── Repurposing View ────────────────────────────────────────
  renderRepurposing(container) {
    const sources = this.data.sourceAssets;
    const outputs = this.data.repurposeOutputs;
    const published = outputs.filter(o => o.status === 'Published');
    const inProd = outputs.filter(o => ['Queued', 'Draft', 'Review', 'Scheduled'].includes(o.status));
    const totalViews = published.reduce((s, o) => s + (o.views || 0), 0);
    const avgPerSource = sources.length > 0 ? (outputs.length / sources.length).toFixed(1) : 0;

    container.innerHTML = `
      <div class="gos-kpi-grid">
        <div class="gos-kpi-card purple">
          <div class="gos-kpi-header"><span class="gos-kpi-label">Source Assets</span><span class="gos-kpi-icon">📚</span></div>
          <div class="gos-kpi-value">${sources.length}</div>
          <div class="gos-kpi-detail">${sources.filter(s => s.reuseApproved).length} approved for reuse</div>
        </div>
        <div class="gos-kpi-card blue">
          <div class="gos-kpi-header"><span class="gos-kpi-label">Outputs</span><span class="gos-kpi-icon">🔄</span></div>
          <div class="gos-kpi-value">${outputs.length}</div>
          <div class="gos-kpi-detail">${avgPerSource} avg per source</div>
        </div>
        <div class="gos-kpi-card green">
          <div class="gos-kpi-header"><span class="gos-kpi-label">Published</span><span class="gos-kpi-icon">🚀</span></div>
          <div class="gos-kpi-value">${published.length}</div>
          <div class="gos-kpi-detail">${this.formatNumber(totalViews)} total views</div>
        </div>
        <div class="gos-kpi-card amber">
          <div class="gos-kpi-header"><span class="gos-kpi-label">In Production</span><span class="gos-kpi-icon">⚙️</span></div>
          <div class="gos-kpi-value">${inProd.length}</div>
          <div class="gos-kpi-detail">queued, draft, review, scheduled</div>
        </div>
      </div>

      <div style="margin-bottom:24px">
        <div class="gos-table-container">
          <div class="gos-table-header">
            <span class="gos-table-title">📚 Source Assets</span>
            <span class="gos-table-count">${sources.length} sources</span>
          </div>
          <div class="gos-table-wrap">
            <table class="gos-table">
              <thead>
                <tr>
                  <th>Title</th><th>Type</th><th>Theme</th><th>Channel</th><th>Status</th><th>Outputs</th>
                </tr>
              </thead>
              <tbody>
                ${sources.map(s => {
                  const outputCount = outputs.filter(o => o.sourceId === s.sourceId).length;
                  return `
                    <tr class="clickable" onclick="app.openSourcePanel('${s.sourceId}')">
                      <td><span class="cell-name">${s.title}</span></td>
                      <td>${s.sourceType}</td>
                      <td><span class="truncate" style="max-width:160px;display:inline-block">${s.keyTheme}</span></td>
                      <td>${s.originChannel}</td>
                      <td>${this.renderBadge(s.status === 'Pending Approval' ? 'Pending Approval' : s.status)}</td>
                      <td><span class="cell-value">${outputCount}</span></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      ${this.renderDataTable(this.filteredData, [
        { key: 'angleOrHook', label: 'Angle / Hook', render: (v) => `<span class="cell-name truncate" style="max-width:200px;display:inline-block">${v}</span>` },
        { key: 'targetChannel', label: 'Channel' },
        { key: 'format', label: 'Format' },
        { key: 'targetBrand', label: 'Brand' },
        { key: 'status', label: 'Status', render: (v) => this.renderBadge(v) },
        { key: 'scheduledAt', label: 'Scheduled', render: (v) => v || '—' },
        { key: 'views', label: 'Views', render: (v) => v > 0 ? this.formatNumber(v) : '—' },
        { key: 'engagements', label: 'Engagements', render: (v) => v > 0 ? v : '—' },
      ], 'repurposing', 'outputId', 'Repurpose Outputs')}
    `;
  }

  // ── Generic Data Table Renderer ─────────────────────────────
  renderDataTable(data, columns, viewType, idKey, title) {
    const tableTitle = title || {
      'linkedin': 'LinkedIn Leads',
      'prime': 'Pipeline Opportunities',
      'scc': 'Content Calendar',
      'calmera': 'Order Reconfirmations',
      'repurposing': 'Repurpose Outputs',
    }[viewType] || 'Records';

    if (!data || data.length === 0) {
      return `
        <div class="gos-table-container">
          <div class="gos-table-header">
            <span class="gos-table-title">${tableTitle}</span>
            <span class="gos-table-count">0 records</span>
          </div>
          <div class="gos-empty">
            <span class="gos-empty-icon">📭</span>
            <span class="gos-empty-title">No records found</span>
            <span class="gos-empty-text">Try adjusting your filters or add a new record.</span>
          </div>
        </div>
      `;
    }

    return `
      <div class="gos-table-container">
        <div class="gos-table-header">
          <span class="gos-table-title">${tableTitle}</span>
          <span class="gos-table-count">${data.length} records</span>
        </div>
        <div class="gos-table-wrap">
          <table class="gos-table">
            <thead>
              <tr>
                ${columns.map(col => `
                  <th onclick="app.toggleSort('${col.key}')" class="${this.sortConfig.key === col.key ? 'sorted' : ''}">
                    ${col.label}
                    <span class="sort-icon">${this.sortConfig.key === col.key ? (this.sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
                  </th>
                `).join('')}
                <th style="width:40px"></th>
              </tr>
            </thead>
            <tbody>
              ${data.map(record => `
                <tr class="clickable" onclick="app.openRecordPanel('${viewType}', '${record[idKey]}')">
                  ${columns.map(col => `
                    <td>${col.render ? col.render(record[col.key], record) : (record[col.key] || '—')}</td>
                  `).join('')}
                  <td>
                    <button class="gos-btn gos-btn-ghost gos-btn-sm" onclick="event.stopPropagation(); app.openMessageForRecord('${viewType}', '${record[idKey]}')" title="Generate message">✉️</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // ── Badge Renderer ──────────────────────────────────────────
  renderBadge(value) {
    if (!value) return '<span class="text-muted">—</span>';
    const cssClass = value.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    return `<span class="gos-badge badge-${cssClass}">${value}</span>`;
  }

  // ── Score Renderer ──────────────────────────────────────────
  renderScore(score) {
    const s = score || 0;
    const level = s >= 75 ? 'high' : s >= 50 ? 'medium' : 'low';
    return `
      <div class="gos-score score-${level}">
        <span class="score-num">${s}</span>
        <div class="score-bar-bg">
          <div class="score-bar-fill" style="width:${s}%"></div>
        </div>
      </div>
    `;
  }

  // ── Due Date Renderer ───────────────────────────────────────
  renderDueDate(dateStr) {
    if (!dateStr) return '<span class="text-muted">—</span>';
    const days = daysUntil(dateStr);
    let cls, label, icon;

    if (days < 0) {
      cls = 'overdue';
      label = `${Math.abs(days)}d overdue`;
      icon = '🔴';
    } else if (days === 0) {
      cls = 'due-today';
      label = 'Today';
      icon = '🔵';
    } else if (days <= 3) {
      cls = 'due-soon';
      label = `${days}d`;
      icon = '🟡';
    } else {
      cls = 'due-later';
      label = dateStr;
      icon = '';
    }

    return `<span class="gos-due ${cls}">${icon} ${label}</span>`;
  }

  // ── Detail Panel ────────────────────────────────────────────
  openRecordPanel(viewType, id) {
    const dataMap = {
      'linkedin': { data: this.data.linkedinLeads, idKey: 'leadId' },
      'prime': { data: this.data.primePipeline, idKey: 'opportunityId' },
      'scc': { data: this.data.sccContent, idKey: 'contentId' },
      'calmera': { data: this.data.calmeraOrders, idKey: 'orderId' },
      'repurposing': { data: this.data.repurposeOutputs, idKey: 'outputId' },
    };

    const config = dataMap[viewType];
    if (!config) return;

    const record = config.data.find(r => r[config.idKey] === id);
    if (!record) return;

    this.selectedRecord = { viewType, record };

    const panel       = document.getElementById('detail-panel');
    const panelTitle  = document.getElementById('panel-title');
    const panelBody   = document.getElementById('panel-body');
    const panelFooter = document.getElementById('panel-footer');
    const backdrop    = document.getElementById('panel-backdrop');

    panelTitle.textContent   = this.getRecordTitle(viewType, record);
    panelBody.innerHTML      = this.renderRecordDetail(viewType, record);

    if (panelFooter) {
      const idFieldName = Object.keys(record).find(k => k.endsWith('Id') && k !== 'contactId' && k !== 'organizationId' && k !== 'sourceLeadId') || 'id';
      const idVal = record[idFieldName];
      panelFooter.innerHTML = `
        <button class="btn-secondary btn-sm" onclick="app.closePanel()">Close</button>
        <button class="btn-danger btn-sm" onclick="app.deleteSelectedRecord()" style="margin-right:auto">🗑️ Delete</button>
        <button class="btn-ghost btn-sm" onclick="app.editSelectedRecord()">✏️ Edit</button>
        <button class="btn-primary btn-sm" onclick="app.openMessageForRecord('${viewType}', '${idVal}')">✉️ Message</button>
      `;
    }

    panel.classList.add('open');
    if (backdrop) backdrop.style.display = 'block';
  }

  openTaskPanel(taskId) {
    const task = this.data.tasks.find(t => t.taskId === taskId);
    if (!task) return;

    this.selectedRecord = { viewType: 'task', record: task };

    const panel = document.getElementById('detail-panel');
    const overlay = document.getElementById('panel-overlay');
    const panelFooter = document.getElementById('panel-footer');
    document.getElementById('panel-title').textContent = 'Task Details';
    document.getElementById('panel-body').innerHTML = `
      <div class="gos-panel-section">
        <div class="gos-panel-section-title">Task Information</div>
        ${this.renderField('Title', task.title)}
        ${this.renderField('Priority', this.renderBadge(task.priority))}
        ${this.renderField('Status', this.renderBadge(task.status))}
        ${this.renderField('Due Date', this.renderDueDate(task.dueAt))}
        ${this.renderField('Type', task.taskType)}
        ${this.renderField('Related To', `${task.recordType} — ${task.recordId}`)}
        ${this.renderField('Assigned To', task.assignedTo)}
        ${this.renderField('Notes', task.notes)}
      </div>
    `;

    if (panelFooter) {
      panelFooter.innerHTML = `
        <button class="gos-btn gos-btn-secondary" onclick="app.closePanel()">Close</button>
      `;
    }

    panel.classList.add('open');
    overlay.classList.add('open');
  }

  openSourcePanel(sourceId) {
    const source = this.data.sourceAssets.find(s => s.sourceId === sourceId);
    if (!source) return;

    const outputs = this.data.repurposeOutputs.filter(o => o.sourceId === sourceId);

    this.selectedRecord = { viewType: 'source', record: source };

    const panel = document.getElementById('detail-panel');
    const overlay = document.getElementById('panel-overlay');
    const panelFooter = document.getElementById('panel-footer');
    document.getElementById('panel-title').textContent = 'Source Asset';
    document.getElementById('panel-body').innerHTML = `
      <div class="gos-panel-section">
        <div class="gos-panel-section-title">Source Details</div>
        ${this.renderField('Title', source.title)}
        ${this.renderField('Type', source.sourceType)}
        ${this.renderField('Theme', source.keyTheme)}
        ${this.renderField('Channel', source.originChannel)}
        ${this.renderField('Status', this.renderBadge(source.status))}
        ${this.renderField('Reuse Approved', source.reuseApproved ? '✅ Yes' : '❌ No')}
        ${this.renderField('Captured', source.capturedAt)}
      </div>
      <div class="gos-panel-section">
        <div class="gos-panel-section-title">Derivative Outputs (${outputs.length})</div>
        ${outputs.map(o => `
          <div style="padding:10px;background:var(--bg-surface);border-radius:var(--radius-md);margin-bottom:8px;border:1px solid var(--border)">
            <div style="font-weight:600;font-size:13px;margin-bottom:4px">${o.angleOrHook}</div>
            <div class="flex gap-8" style="font-size:12px;color:var(--text-muted)">
              ${this.renderBadge(o.status)}
              <span>${o.targetChannel}</span>
              <span>${o.format}</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    if (panelFooter) {
      panelFooter.innerHTML = `
        <button class="gos-btn gos-btn-secondary" onclick="app.closePanel()">Close</button>
      `;
    }

    panel.classList.add('open');
    overlay.classList.add('open');
  }

  closePanel() {
    document.getElementById('detail-panel')?.classList.remove('open');
    const bd = document.getElementById('panel-backdrop');
    if (bd) bd.style.display = 'none';
    this.selectedRecord = null;
  }

  // ── Inline Edit Flow ─────────────────────────────────────────
  editSelectedRecord() {
    if (!this.selectedRecord) return;
    const { viewType, record } = this.selectedRecord;

    const panelBody = document.getElementById('panel-body');
    const panelFooter = document.getElementById('panel-footer');

    // Swap body to edit form
    panelBody.innerHTML = this.renderEditForm(viewType, record);

    // Swap footer to Save/Cancel actions
    if (panelFooter) {
      panelFooter.innerHTML = `
        <button class="btn-secondary btn-sm" onclick="app.cancelRecordEdit()">Cancel</button>
        <button class="btn-primary btn-sm" onclick="app.saveRecordEdit()">💾 Save Changes</button>
      `;
    }
  }

  cancelRecordEdit() {
    if (!this.selectedRecord) return;
    const { viewType, record } = this.selectedRecord;
    const idKeyMap = {
      'linkedin': 'leadId',
      'prime': 'opportunityId',
      'scc': 'contentId',
      'calmera': 'orderId',
      'repurposing': 'outputId',
    };
    const idKey = idKeyMap[viewType];
    this.openRecordPanel(viewType, record[idKey]);
  }

  async saveRecordEdit() {
    const form = document.getElementById('edit-record-form');
    if (!form || !this.selectedRecord) return;

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const formData = new FormData(form);
    const updatedFields = Object.fromEntries(formData);
    const { viewType, record } = this.selectedRecord;

    const dataMap = {
      'linkedin': { data: this.data.linkedinLeads, idKey: 'leadId', tabKey: 'linkedinLeads' },
      'prime': { data: this.data.primePipeline, idKey: 'opportunityId', tabKey: 'primePipeline' },
      'scc': { data: this.data.sccContent, idKey: 'contentId', tabKey: 'sccContent' },
      'calmera': { data: this.data.calmeraOrders, idKey: 'orderId', tabKey: 'calmeraOrders' },
      'repurposing': { data: this.data.repurposeOutputs, idKey: 'outputId', tabKey: 'repurposeOutputs' },
    };

    const config = dataMap[viewType];
    if (!config) return;

    // Keep an old copy to revert if needed
    const oldRecord = { ...record };

    // Update fields locally
    Object.entries(updatedFields).forEach(([key, val]) => {
      // Parse numbers
      const numberFields = new Set([
        'qualificationScore', 'estimatedValue', 'probabilityPercent', 'weightedValue',
        'orderAmount', 'views', 'comments', 'saves', 'replies', 'engagements', 'leadsGenerated',
      ]);
      if (numberFields.has(key) && val !== '' && val !== null) {
        record[key] = parseFloat(val) || 0;
      } else {
        record[key] = val;
      }
    });

    // Side-effects / calculations
    if (viewType === 'prime') {
      const val = parseFloat(record.estimatedValue) || 0;
      const prob = parseFloat(record.probabilityPercent) || 0;
      record.weightedValue = Math.round(val * prob / 100);
    }

    // Relational self-repair/sync
    let contactToSave, orgToSave;
    let isNewContact = false, isNewOrg = false;
    const today = getDemoToday();

    if (viewType === 'linkedin') {
      let oldContactId = record.contactId;
      let contactName = updatedFields.contactName || record.contactName || '';
      let isMigrated = false;

      if (oldContactId && oldContactId.startsWith('CON-') && contactName) {
        let contact = this.data.contacts.find(c => c.contactId === oldContactId);
        if (contact) {
          contact.contactId = contactName;
          contact.fullName = contactName;
          contact.linkedinUrl = record.linkedinUrl || '';
          contact.updatedAt = today;
          contactToSave = contact;
        }
        record.contactId = contactName;
        const localLead = this.data.linkedinLeads.find(l => l.leadId === record.leadId);
        if (localLead) localLead.contactId = contactName;
        isMigrated = true;
      }

      let contact = this.data.contacts.find(c => c.contactId === record.contactId);
      if (!contact && !isMigrated) {
        contact = {
          contactId: record.contactId,
          fullName: updatedFields.contactName,
          email: '',
          mobile: '',
          linkedinUrl: record.linkedinUrl || '',
          organizationId: record.organizationId || '',
          segments: ['LinkedIn Lead'],
          preferredChannel: 'LinkedIn',
          contactBasis: '',
          ownerId: 'Gelo',
          status: 'Active',
          createdAt: today,
          updatedAt: today,
          notes: '',
        };
        this.data.contacts.push(contact);
        isNewContact = true;
        contactToSave = contact;
      } else if (!isMigrated) {
        contact.fullName = updatedFields.contactName;
        contact.linkedinUrl = record.linkedinUrl;
        contact.updatedAt = today;
        contactToSave = contact;
      }

      if (updatedFields.company) {
        if (!record.organizationId) {
          record.organizationId = `ORG-${String((this.data.organizations || []).length + 1).padStart(4, '0')}`;
          if (contactToSave) contactToSave.organizationId = record.organizationId;
        }
        let org = this.data.organizations.find(o => o.organizationId === record.organizationId);
        if (!org) {
          org = {
            organizationId: record.organizationId,
            organizationName: updatedFields.company,
            industry: '',
            website: '',
            source: 'LinkedIn',
            accountStatus: 'Active',
            ownerId: 'Gelo',
            createdAt: today,
            updatedAt: today,
            notes: '',
          };
          this.data.organizations.push(org);
          isNewOrg = true;
        } else {
          org.organizationName = updatedFields.company;
          org.updatedAt = today;
        }
        orgToSave = org;
      }
    } else if (viewType === 'prime') {
      let oldContactId = record.contactId;
      let contactName = updatedFields.contactName || record.contactName || '';
      let isMigrated = false;

      if (oldContactId && oldContactId.startsWith('CON-') && contactName) {
        let contact = this.data.contacts.find(c => c.contactId === oldContactId);
        if (contact) {
          contact.contactId = contactName;
          contact.fullName = contactName;
          contact.updatedAt = today;
          contactToSave = contact;
        }
        record.contactId = contactName;
        const localOpp = this.data.primePipeline.find(o => o.opportunityId === record.opportunityId);
        if (localOpp) localOpp.contactId = contactName;
        isMigrated = true;
      }

      let contact = this.data.contacts.find(c => c.contactId === record.contactId);
      if (!contact && !isMigrated) {
        contact = {
          contactId: record.contactId,
          fullName: updatedFields.contactName,
          email: '',
          mobile: '',
          linkedinUrl: '',
          organizationId: record.organizationId || '',
          segments: ['Prime'],
          preferredChannel: 'Email',
          contactBasis: '',
          ownerId: 'Gelo',
          status: 'Active',
          createdAt: today,
          updatedAt: today,
          notes: '',
        };
        this.data.contacts.push(contact);
        isNewContact = true;
        contactToSave = contact;
      } else if (!isMigrated) {
        contact.fullName = updatedFields.contactName;
        contact.updatedAt = today;
        contactToSave = contact;
      }

      let org = this.data.organizations.find(o => o.organizationId === record.organizationId);
      if (!org) {
        org = {
          organizationId: record.organizationId,
          organizationName: updatedFields.orgName,
          industry: '',
          website: '',
          source: 'Direct',
          accountStatus: 'Prospect',
          ownerId: 'Gelo',
          createdAt: today,
          updatedAt: today,
          notes: '',
        };
        this.data.organizations.push(org);
        isNewOrg = true;
      } else {
        org.organizationName = updatedFields.orgName;
        org.updatedAt = today;
      }
      orgToSave = org;
    } else if (viewType === 'calmera') {
      let oldContactId = record.contactId;
      let customerName = updatedFields.customerName || record.customerName || '';
      let isMigrated = false;

      if (oldContactId && oldContactId.startsWith('CON-') && customerName) {
        let contact = this.data.contacts.find(c => c.contactId === oldContactId);
        if (contact) {
          contact.contactId = customerName;
          contact.fullName = customerName;
          contact.preferredChannel = updatedFields.preferredChannel || 'Email';
          contact.updatedAt = today;
          contactToSave = contact;
        }
        record.contactId = customerName;
        const localOrder = this.data.calmeraOrders.find(o => o.orderId === record.orderId);
        if (localOrder) localOrder.contactId = customerName;
        isMigrated = true;
      }

      let contact = this.data.contacts.find(c => c.contactId === record.contactId);
      if (!contact && !isMigrated) {
        contact = {
          contactId: record.contactId,
          fullName: updatedFields.customerName,
          email: '',
          mobile: '',
          linkedinUrl: '',
          organizationId: '',
          segments: ['Calmera'],
          preferredChannel: updatedFields.preferredChannel || 'Email',
          contactBasis: '',
          ownerId: 'Gelo',
          status: 'Active',
          createdAt: today,
          updatedAt: today,
          notes: '',
        };
        this.data.contacts.push(contact);
        isNewContact = true;
        contactToSave = contact;
      } else if (!isMigrated) {
        contact.fullName = updatedFields.customerName;
        contact.preferredChannel = updatedFields.preferredChannel || 'Email';
        contact.updatedAt = today;
        contactToSave = contact;
      }
    }

    // Run denormalize locally to immediately update view properties (like contactName and company)
    sheetsService._denormalize(this.data);

    // Refresh CRM views and reopen panel in view mode
    this.applyFilters();
    this.render();
    this.openRecordPanel(viewType, record[config.idKey]);
    this.showToast('Changes saved locally!', 'success');

    // Sync in background to Sheets (if connected)
    if (this.sheetsConnected) {
      const rowIndex = record._rowIndex;
      if (rowIndex !== undefined) {
        try {
          // Write/Update the Main Record
          await sheetsService.updateRecord(config.tabKey, rowIndex, record);
          
          // Write/Update Contact
          if (contactToSave) {
            if (isNewContact) {
              await sheetsService.appendRecord('contacts', contactToSave)
                .then(res => { if (res && res.rowsAfter !== undefined) contactToSave._rowIndex = res.rowsAfter - 1; });
            } else if (contactToSave._rowIndex !== undefined) {
              await sheetsService.updateRecord('contacts', contactToSave._rowIndex, contactToSave);
            }
          }
          
          // Write/Update Organization
          if (orgToSave) {
            if (isNewOrg) {
              await sheetsService.appendRecord('organizations', orgToSave)
                .then(res => { if (res && res.rowsAfter !== undefined) orgToSave._rowIndex = res.rowsAfter - 1; });
            } else if (orgToSave._rowIndex !== undefined) {
              await sheetsService.updateRecord('organizations', orgToSave._rowIndex, orgToSave);
            }
          }

          this.showToast('📤 Saved to Google Sheets', 'success');
        } catch (err) {
          console.error('Sheet update failed:', err);
          this.showToast('⚠️ Saved locally, but failed to sync to Google Sheets. Check your Apps Script deployment!', 'warning');
        }
      } else {
        this.showToast('⚠️ Sheet row index not found. Saved only locally.', 'warning');
      }
    }
  }

  async deleteSelectedRecord() {
    if (!this.selectedRecord) return;
    const { viewType, record } = this.selectedRecord;
    const label = viewType === 'linkedin' ? 'lead' : viewType === 'prime' ? 'opportunity' : 'record';

    this.showConfirm(
      'Delete Record',
      `Are you sure you want to permanently delete this ${label}? This will also delete its row in Google Sheets.`,
      '🗑️ Delete',
      () => this._doDeleteRecord(viewType, record)
    );
  }

  async _doDeleteRecord(viewType, record) {

    const dataMap = {
      'linkedin':   { data: this.data.linkedinLeads, idKey: 'leadId', tabKey: 'linkedinLeads' },
      'prime':      { data: this.data.primePipeline, idKey: 'opportunityId', tabKey: 'primePipeline' },
      'scc':        { data: this.data.sccContent, idKey: 'contentId', tabKey: 'sccContent' },
      'calmera':    { data: this.data.calmeraOrders, idKey: 'orderId', tabKey: 'calmeraOrders' },
      'repurposing':{ data: this.data.repurposeOutputs, idKey: 'outputId', tabKey: 'repurposeOutputs' },
    };

    const config = dataMap[viewType];
    if (!config) return;

    const rowIndex = record._rowIndex;
    const recordId = record[config.idKey];

    const index = config.data.findIndex(r => r[config.idKey] === recordId);
    if (index !== -1) config.data.splice(index, 1);

    config.data.forEach(r => {
      if (r._rowIndex !== undefined && r._rowIndex > rowIndex) r._rowIndex--;
    });

    this.closePanel();
    this.applyFilters();
    this.render();
    this.showToast('Record deleted locally!', 'success');

    if (this.sheetsConnected && rowIndex !== undefined) {
      try {
        await sheetsService.deleteRecord(config.tabKey, rowIndex);
        this.showToast('🗑️ Deleted from Google Sheets', 'success');
      } catch (err) {
        this.showToast('⚠️ Deleted locally, but Google Sheets delete failed.', 'warning');
      }
    }
  }

  renderEditForm(viewType, r) {
    switch (viewType) {
      case 'linkedin':
        return `
          <form id="edit-record-form" onsubmit="event.preventDefault();">
            <div class="gos-panel-section">
              <div class="gos-panel-section-title">Edit Lead Details</div>
              
              <div class="gos-form-group">
                <label class="gos-form-label">Full Name *</label>
                <input class="gos-form-input" name="contactName" value="${r.contactName || ''}" required>
              </div>
              
              <div class="gos-form-group">
                <label class="gos-form-label">Company</label>
                <input class="gos-form-input" name="company" value="${r.company || ''}">
              </div>
              
              <div class="gos-form-group">
                <label class="gos-form-label">Role</label>
                <input class="gos-form-input" name="role" value="${r.role || ''}">
              </div>

              <div class="gos-form-row">
                <div class="gos-form-group">
                  <label class="gos-form-label">Stage</label>
                  <select class="gos-form-select" name="stage">
                    ${['New', 'Qualified', 'Contacted', 'Nurturing', 'Converted', 'Recycle', 'Closed'].map(opt => `
                      <option value="${opt}" ${r.stage === opt ? 'selected' : ''}>${opt}</option>
                    `).join('')}
                  </select>
                </div>
                <div class="gos-form-group">
                  <label class="gos-form-label">Priority</label>
                  <select class="gos-form-select" name="priority">
                    ${['Normal', 'High', 'Critical', 'Low'].map(opt => `
                      <option value="${opt}" ${r.priority === opt ? 'selected' : ''}>${opt}</option>
                    `).join('')}
                  </select>
                </div>
              </div>

              <div class="gos-form-group">
                <label class="gos-form-label">Score (0-100)</label>
                <input class="gos-form-input" type="number" name="qualificationScore" min="0" max="100" value="${r.qualificationScore || 0}">
              </div>

              <div class="gos-form-group">
                <label class="gos-form-label">Next Action</label>
                <input class="gos-form-input" name="nextAction" value="${r.nextAction || ''}">
              </div>

              <div class="gos-form-group">
                <label class="gos-form-label">Follow-up Date</label>
                <input class="gos-form-input" type="date" name="nextActionDate" value="${r.nextActionDate || ''}">
              </div>

              <div class="gos-form-group">
                <label class="gos-form-label">Notes</label>
                <textarea class="gos-form-textarea" name="notes" rows="4">${r.notes || ''}</textarea>
              </div>
            </div>
          </form>
        `;
      case 'prime':
        return `
          <form id="edit-record-form" onsubmit="event.preventDefault();">
            <div class="gos-panel-section">
              <div class="gos-panel-section-title">Edit Opportunity Details</div>

              <div class="gos-form-group">
                <label class="gos-form-label">Contact Name *</label>
                <input class="gos-form-input" name="contactName" value="${r.contactName || ''}" required>
              </div>

              <div class="gos-form-group">
                <label class="gos-form-label">Organization *</label>
                <input class="gos-form-input" name="orgName" value="${r.orgName || ''}" required>
              </div>

              <div class="gos-form-group">
                <label class="gos-form-label">Service Interest *</label>
                <input class="gos-form-input" name="serviceInterest" value="${r.serviceInterest || ''}" required>
              </div>

              <div class="gos-form-group">
                <label class="gos-form-label">Stage</label>
                <select class="gos-form-select" name="stage">
                  ${['New Inquiry', 'Qualified', 'Discovery', 'Proposal Sent', 'Negotiation', 'Won', 'Lost', 'Handoff'].map(opt => `
                    <option value="${opt}" ${r.stage === opt ? 'selected' : ''}>${opt}</option>
                  `).join('')}
                </select>
              </div>

              <div class="gos-form-row">
                <div class="gos-form-group">
                  <label class="gos-form-label">Estimated Value (₱)</label>
                  <input class="gos-form-input" type="number" name="estimatedValue" value="${r.estimatedValue || 0}">
                </div>
                <div class="gos-form-group">
                  <label class="gos-form-label">Probability (%)</label>
                  <input class="gos-form-input" type="number" name="probabilityPercent" min="0" max="100" value="${r.probabilityPercent || 20}">
                </div>
              </div>

              <div class="gos-form-group">
                <label class="gos-form-label">Next Action</label>
                <input class="gos-form-input" name="nextAction" value="${r.nextAction || ''}">
              </div>

              <div class="gos-form-group">
                <label class="gos-form-label">Action Due Date</label>
                <input class="gos-form-input" type="date" name="nextActionDate" value="${r.nextActionDate || ''}">
              </div>

              <div class="gos-form-group">
                <label class="gos-form-label">Problem Statement</label>
                <textarea class="gos-form-textarea" name="problemStatement" rows="3">${r.problemStatement || ''}</textarea>
              </div>
            </div>
          </form>
        `;
      case 'scc':
        return `
          <form id="edit-record-form" onsubmit="event.preventDefault();">
            <div class="gos-panel-section">
              <div class="gos-panel-section-title">Edit Content Calendar Details</div>

              <div class="gos-form-group">
                <label class="gos-form-label">Title *</label>
                <input class="gos-form-input" name="title" value="${r.title || ''}" required>
              </div>

              <div class="gos-form-row">
                <div class="gos-form-group">
                  <label class="gos-form-label">Pillar</label>
                  <select class="gos-form-select" name="contentPillar">
                    ${['Mindset & Habits', 'Mental Health', 'Physical Wellness', 'Productivity', 'Community'].map(opt => `
                      <option value="${opt}" ${r.contentPillar === opt ? 'selected' : ''}>${opt}</option>
                    `).join('')}
                  </select>
                </div>
                <div class="gos-form-group">
                  <label class="gos-form-label">Format</label>
                  <select class="gos-form-select" name="format">
                    ${['Carousel Post', 'Short Video', 'Blog Article', 'Live Session', 'Story Series', 'Interview Post', 'Quote Graphic'].map(opt => `
                      <option value="${opt}" ${r.format === opt ? 'selected' : ''}>${opt}</option>
                    `).join('')}
                  </select>
                </div>
              </div>

              <div class="gos-form-row">
                <div class="gos-form-group">
                  <label class="gos-form-label">Channel</label>
                  <select class="gos-form-select" name="channel">
                    ${['Instagram', 'TikTok / Reels', 'LinkedIn', 'Facebook Group', 'Website'].map(opt => `
                      <option value="${opt}" ${r.channel === opt ? 'selected' : ''}>${opt}</option>
                    `).join('')}
                  </select>
                </div>
                <div class="gos-form-group">
                  <label class="gos-form-label">Status</label>
                  <select class="gos-form-select" name="status">
                    ${['Idea', 'Planned', 'Draft', 'Review', 'Scheduled', 'Published', 'Archived'].map(opt => `
                      <option value="${opt}" ${r.status === opt ? 'selected' : ''}>${opt}</option>
                    `).join('')}
                  </select>
                </div>
              </div>

              <div class="gos-form-group">
                <label class="gos-form-label">CTA</label>
                <input class="gos-form-input" name="cta" value="${r.cta || ''}">
              </div>

              <div class="gos-form-group">
                <label class="gos-form-label">Planned Publish Date</label>
                <input class="gos-form-input" type="date" name="plannedPublishAt" value="${r.plannedPublishAt || ''}">
              </div>

              <div class="gos-form-group">
                <label class="gos-form-label">Draft URL</label>
                <input class="gos-form-input" name="draftUrl" value="${r.draftUrl || ''}">
              </div>

              <div class="gos-form-group">
                <label class="gos-form-label">Published URL</label>
                <input class="gos-form-input" name="publishedUrl" value="${r.publishedUrl || ''}">
              </div>

              <div class="gos-form-row">
                <div class="gos-form-group">
                  <label class="gos-form-label">Views</label>
                  <input class="gos-form-input" type="number" name="views" value="${r.views || 0}">
                </div>
                <div class="gos-form-group">
                  <label class="gos-form-label">Comments</label>
                  <input class="gos-form-input" type="number" name="comments" value="${r.comments || 0}">
                </div>
              </div>
            </div>
          </form>
        `;
      case 'calmera':
        return `
          <form id="edit-record-form" onsubmit="event.preventDefault();">
            <div class="gos-panel-section">
              <div class="gos-panel-section-title">Edit Order Information</div>

              <div class="gos-form-group">
                <label class="gos-form-label">Customer Name *</label>
                <input class="gos-form-input" name="customerName" value="${r.customerName || ''}" required>
              </div>

              <div class="gos-form-group">
                <label class="gos-form-label">Order Reference</label>
                <input class="gos-form-input" name="externalOrderRef" value="${r.externalOrderRef || ''}">
              </div>

              <div class="gos-form-group">
                <label class="gos-form-label">Items Summary *</label>
                <input class="gos-form-input" name="itemsSummary" value="${r.itemsSummary || ''}" required>
              </div>

              <div class="gos-form-group">
                <label class="gos-form-label">Amount (₱)</label>
                <input class="gos-form-input" type="number" name="orderAmount" value="${r.orderAmount || 0}">
              </div>

              <div class="gos-form-group">
                <label class="gos-form-label">Fulfillment Cutoff *</label>
                <input class="gos-form-input" type="date" name="fulfillmentCutoff" value="${r.fulfillmentCutoff || ''}" required>
              </div>

              <div class="gos-form-row">
                <div class="gos-form-group">
                  <label class="gos-form-label">Reconfirmation Status</label>
                  <select class="gos-form-select" name="reconfirmationStatus">
                    ${['Pending Contact', 'Awaiting Response', 'Confirmed', 'Changed', 'Cancelled', 'Escalated', 'Closed'].map(opt => `
                      <option value="${opt}" ${r.reconfirmationStatus === opt ? 'selected' : ''}>${opt}</option>
                    `).join('')}
                  </select>
                </div>
                <div class="gos-form-group">
                  <label class="gos-form-label">Order Status</label>
                  <select class="gos-form-select" name="orderStatus">
                    ${['New', 'Pending', 'Updated', 'Fulfillment Ready', 'At Risk', 'Closed', 'Cancelled'].map(opt => `
                      <option value="${opt}" ${r.orderStatus === opt ? 'selected' : ''}>${opt}</option>
                    `).join('')}
                  </select>
                </div>
              </div>

              <div class="gos-form-group">
                <label class="gos-form-label">Change Notes</label>
                <input class="gos-form-input" name="changeNotes" value="${r.changeNotes || ''}">
              </div>
            </div>
          </form>
        `;
      default:
        return `<div class="gos-empty">Edit not supported for this view type.</div>`;
    }
  }

  getRecordTitle(viewType, record) {
    switch (viewType) {
      case 'linkedin': return `${record.contactName} — LinkedIn Lead`;
      case 'prime': return `${record.orgName} — ${record.serviceInterest}`;
      case 'scc': return record.title;
      case 'calmera': return `${record.customerName} — ${record.externalOrderRef}`;
      case 'repurposing': return record.angleOrHook;
      default: return 'Record Details';
    }
  }

  renderRecordDetail(viewType, record) {
    switch (viewType) {
      case 'linkedin': return this.renderLinkedInDetail(record);
      case 'prime': return this.renderPrimeDetail(record);
      case 'scc': return this.renderSCCDetail(record);
      case 'calmera': return this.renderCalmeraDetail(record);
      case 'repurposing': return this.renderRepurposeDetail(record);
      default: return '';
    }
  }

  renderLinkedInDetail(r) {
    const interactions = this.data.interactions.filter(i => i.recordId === r.leadId);
    return `
      <div class="gos-panel-section">
        <div class="gos-panel-section-title">Lead Information</div>
        ${this.renderField('Name', r.contactName)}
        ${this.renderField('Company', r.company)}
        ${this.renderField('Role', r.role)}
        ${this.renderField('Stage', this.renderBadge(r.stage))}
        ${this.renderField('Priority', this.renderBadge(r.priority))}
        ${this.renderField('Score', this.renderScore(r.qualificationScore))}
        ${this.renderField('Source', r.source)}
        ${this.renderField('Connection', r.connectionStatus)}
      </div>
      <div class="gos-panel-section">
        <div class="gos-panel-section-title">Interest & Qualification</div>
        ${this.renderField('Interest Signal', r.interestSignal)}
        ${this.renderField('Notes', r.notes)}
      </div>
      <div class="gos-panel-section">
        <div class="gos-panel-section-title">Follow-Up</div>
        ${this.renderField('Next Action', r.nextAction)}
        ${this.renderField('Follow-up Date', this.renderDueDate(r.nextActionDate))}
        ${this.renderField('Last Interaction', r.lastInteractionAt || '—')}
        ${r.convertedOpportunityId ? this.renderField('Converted To', `<a class="cell-link" onclick="app.openRecordPanel('prime', '${r.convertedOpportunityId}')">${r.convertedOpportunityId}</a>`) : ''}
      </div>
      ${interactions.length > 0 ? `
        <div class="gos-panel-section">
          <div class="gos-panel-section-title">Interactions (${interactions.length})</div>
          ${interactions.map(i => `
            <div style="padding:10px;background:var(--bg-surface);border-radius:var(--radius-md);margin-bottom:8px;border:1px solid var(--border)">
              <div style="font-weight:600;font-size:13px;margin-bottom:4px">${i.interactionType} — ${i.channel}</div>
              <div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px">${i.summary}</div>
              <div style="font-size:11px;color:var(--text-muted)">${i.occurredAt} · ${i.direction}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;
  }

  renderPrimeDetail(r) {
    const interactions = this.data.interactions.filter(i => i.recordId === r.opportunityId);
    return `
      <div class="gos-panel-section">
        <div class="gos-panel-section-title">Opportunity Details</div>
        ${this.renderField('Contact', r.contactName)}
        ${this.renderField('Organization', r.orgName)}
        ${this.renderField('Service', r.serviceInterest)}
        ${this.renderField('Stage', this.renderBadge(r.stage))}
        ${this.renderField('Problem', r.problemStatement)}
      </div>
      <div class="gos-panel-section">
        <div class="gos-panel-section-title">Commercial</div>
        ${this.renderField('Estimated Value', `₱${(r.estimatedValue || 0).toLocaleString()}`)}
        ${this.renderField('Probability', `${r.probabilityPercent}%`)}
        ${this.renderField('Weighted Value', `₱${(r.weightedValue || 0).toLocaleString()}`)}
        ${this.renderField('Budget Range', r.budgetRange)}
        ${this.renderField('Decision Maker', r.decisionMaker)}
        ${this.renderField('Timeline', r.timeline)}
      </div>
      <div class="gos-panel-section">
        <div class="gos-panel-section-title">Dates & Actions</div>
        ${this.renderField('Discovery', r.discoveryDate || '—')}
        ${this.renderField('Proposal Sent', r.proposalDate || '—')}
        ${this.renderField('Next Action', r.nextAction)}
        ${this.renderField('Action Due', this.renderDueDate(r.nextActionDate))}
        ${r.closeDate ? this.renderField('Closed', r.closeDate) : ''}
        ${r.outcomeReason ? this.renderField('Outcome', r.outcomeReason) : ''}
      </div>
      ${interactions.length > 0 ? `
        <div class="gos-panel-section">
          <div class="gos-panel-section-title">Interactions (${interactions.length})</div>
          ${interactions.map(i => `
            <div style="padding:10px;background:var(--bg-surface);border-radius:var(--radius-md);margin-bottom:8px;border:1px solid var(--border)">
              <div style="font-weight:600;font-size:13px;margin-bottom:4px">${i.interactionType} — ${i.channel}</div>
              <div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px">${i.summary}</div>
              <div style="font-size:11px;color:var(--text-muted)">${i.occurredAt}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;
  }

  renderSCCDetail(r) {
    return `
      <div class="gos-panel-section">
        <div class="gos-panel-section-title">Content Details</div>
        ${this.renderField('Title', r.title)}
        ${this.renderField('Pillar', r.contentPillar)}
        ${this.renderField('Format', r.format)}
        ${this.renderField('Channel', r.channel)}
        ${this.renderField('Status', this.renderBadge(r.status))}
        ${this.renderField('CTA', r.cta)}
        ${this.renderField('Campaign', r.campaign || '—')}
      </div>
      <div class="gos-panel-section">
        <div class="gos-panel-section-title">Schedule</div>
        ${this.renderField('Planned Publish', this.renderDueDate(r.plannedPublishAt))}
        ${r.publishedAt ? this.renderField('Published At', r.publishedAt) : ''}
        ${r.draftUrl ? this.renderField('Draft', `<a href="${r.draftUrl}" target="_blank" class="cell-link">Open Draft</a>`) : ''}
        ${r.publishedUrl ? this.renderField('Published URL', `<a href="${r.publishedUrl}" target="_blank" class="cell-link">View Post</a>`) : ''}
      </div>
      ${r.status === 'Published' ? `
        <div class="gos-panel-section">
          <div class="gos-panel-section-title">Performance</div>
          <div class="gos-form-row" style="margin-bottom:0">
            <div>${this.renderField('Views', this.formatNumber(r.views))}</div>
            <div>${this.renderField('Comments', r.comments)}</div>
            <div>${this.renderField('Saves', r.saves)}</div>
            <div>${this.renderField('Replies', r.replies)}</div>
          </div>
        </div>
      ` : ''}
      ${this.renderField('Repurpose Flag', r.repurposeFlag ? '✅ Flagged for repurposing' : '—')}
    `;
  }

  renderCalmeraDetail(r) {
    const reconfirmations = this.data.interactions.filter(i => i.recordId === r.orderId);
    return `
      <div class="gos-panel-section">
        <div class="gos-panel-section-title">Order Information</div>
        ${this.renderField('Customer', r.customerName)}
        ${this.renderField('Order Ref', r.externalOrderRef)}
        ${this.renderField('Items', r.itemsSummary)}
        ${this.renderField('Amount', `₱${(r.orderAmount || 0).toLocaleString()}`)}
        ${this.renderField('Order Date', r.orderDate)}
      </div>
      <div class="gos-panel-section">
        <div class="gos-panel-section-title">Reconfirmation</div>
        ${this.renderField('Status', this.renderBadge(r.reconfirmationStatus))}
        ${this.renderField('Order Status', this.renderBadge(r.orderStatus))}
        ${this.renderField('Fulfillment Cutoff', this.renderDueDate(r.fulfillmentCutoff))}
        ${this.renderField('Preferred Channel', r.preferredChannel)}
        ${this.renderField('Response Due', this.renderDueDate(r.responseDueAt))}
        ${r.latestAttemptAt ? this.renderField('Last Attempt', r.latestAttemptAt) : ''}
        ${r.resolvedAt ? this.renderField('Resolved', r.resolvedAt) : ''}
        ${r.changeNotes ? this.renderField('Change Notes', `<span class="text-amber">${r.changeNotes}</span>`) : ''}
      </div>
    `;
  }

  renderRepurposeDetail(r) {
    const source = this.data.sourceAssets.find(s => s.sourceId === r.sourceId);
    return `
      <div class="gos-panel-section">
        <div class="gos-panel-section-title">Output Details</div>
        ${this.renderField('Angle / Hook', r.angleOrHook)}
        ${this.renderField('Target Channel', r.targetChannel)}
        ${this.renderField('Format', r.format)}
        ${this.renderField('Brand', r.targetBrand)}
        ${this.renderField('CTA', r.cta)}
        ${this.renderField('Status', this.renderBadge(r.status))}
      </div>
      <div class="gos-panel-section">
        <div class="gos-panel-section-title">Source</div>
        ${source ? `
          ${this.renderField('Source Title', source.title)}
          ${this.renderField('Source Type', source.sourceType)}
          ${this.renderField('Theme', source.keyTheme)}
        ` : this.renderField('Source ID', r.sourceId)}
      </div>
      ${r.status === 'Published' ? `
        <div class="gos-panel-section">
          <div class="gos-panel-section-title">Performance</div>
          ${this.renderField('Views', this.formatNumber(r.views))}
          ${this.renderField('Engagements', r.engagements)}
          ${this.renderField('Leads Generated', r.leadsGenerated)}
        </div>
      ` : ''}
      <div class="gos-panel-section">
        <div class="gos-panel-section-title">Schedule</div>
        ${r.scheduledAt ? this.renderField('Scheduled', r.scheduledAt) : ''}
        ${r.publishedAt ? this.renderField('Published', r.publishedAt) : ''}
        ${r.draftUrl ? this.renderField('Draft', `<a href="${r.draftUrl}" target="_blank" class="cell-link">Open Draft</a>`) : ''}
        ${r.publishedUrl ? this.renderField('Published URL', `<a href="${r.publishedUrl}" target="_blank" class="cell-link">View Post</a>`) : ''}
      </div>
    `;
  }

  renderField(label, value) {
    return `
      <div class="gos-panel-field">
        <div class="gos-panel-field-label">${label}</div>
        <div class="gos-panel-field-value">${value || '—'}</div>
      </div>
    `;
  }

  // ── Add Record Modal ────────────────────────────────────────
  openAddModal() {
    const overlay   = document.getElementById('add-modal-overlay');
    const formFields = document.getElementById('add-form-fields');
    const titleEl   = document.getElementById('add-modal-title');

    const viewTitles = {
      linkedin:   'Add New Lead', prime:      'Add New Opportunity',
      scc:        'Add New Content', calmera:  'Add New Order',
      repurposing:'Add New Output',  settings: '',
      'command-center': 'Add New Lead', calendar: 'Add New Lead',
      messages:   'Add New Lead',
    };
    if (titleEl) titleEl.textContent = viewTitles[this.currentView] || 'Add New Record';
    if (formFields) formFields.innerHTML = this.getAddFormFields();
    if (overlay) overlay.style.display = 'flex';
  }

  closeModal(modalId) {
    if (modalId === 'add-modal') {
      const el = document.getElementById('add-modal-overlay');
      if (el) el.style.display = 'none';
    } else {
      const el = document.getElementById('msg-modal-overlay');
      if (el) el.style.display = 'none';
    }
  }

  getAddFormFields() {
    switch (this.currentView) {
      case 'linkedin': return `
        <div class="gos-form-row">
          <div class="gos-form-group"><label class="gos-form-label">Full Name *</label><input class="gos-form-input" name="contactName" required></div>
          <div class="gos-form-group"><label class="gos-form-label">Company</label><input class="gos-form-input" name="company"></div>
        </div>
        <div class="gos-form-row">
          <div class="gos-form-group"><label class="gos-form-label">Role</label><input class="gos-form-input" name="role"></div>
          <div class="gos-form-group"><label class="gos-form-label">LinkedIn URL</label><input class="gos-form-input" name="linkedinUrl"></div>
        </div>
        <div class="gos-form-row">
          <div class="gos-form-group">
            <label class="gos-form-label">Source</label>
            <select class="gos-form-select" name="source"><option>LinkedIn Search</option><option>LinkedIn Content</option><option>LinkedIn Event</option><option>Referral</option><option>Network</option><option>Other</option></select>
          </div>
          <div class="gos-form-group">
            <label class="gos-form-label">Priority</label>
            <select class="gos-form-select" name="priority"><option>Normal</option><option>High</option><option>Critical</option><option>Low</option></select>
          </div>
        </div>
        <div class="gos-form-group"><label class="gos-form-label">Interest Signal</label><input class="gos-form-input" name="interestSignal" placeholder="What caught your attention about this lead?"></div>
        <div class="gos-form-row">
          <div class="gos-form-group"><label class="gos-form-label">Next Action</label><input class="gos-form-input" name="nextAction" placeholder="e.g., Send connection request"></div>
          <div class="gos-form-group"><label class="gos-form-label">Follow-up Date</label><input class="gos-form-input" name="nextActionDate" type="date"></div>
        </div>
        <div class="gos-form-group"><label class="gos-form-label">Notes</label><textarea class="gos-form-textarea" name="notes" rows="3"></textarea></div>
      `;
      case 'prime': return `
        <div class="gos-form-row">
          <div class="gos-form-group"><label class="gos-form-label">Contact Name *</label><input class="gos-form-input" name="contactName" required></div>
          <div class="gos-form-group"><label class="gos-form-label">Organization *</label><input class="gos-form-input" name="orgName" required></div>
        </div>
        <div class="gos-form-group"><label class="gos-form-label">Service Interest *</label><input class="gos-form-input" name="serviceInterest" required></div>
        <div class="gos-form-group"><label class="gos-form-label">Problem Statement</label><textarea class="gos-form-textarea" name="problemStatement" rows="2"></textarea></div>
        <div class="gos-form-row">
          <div class="gos-form-group"><label class="gos-form-label">Estimated Value (₱)</label><input class="gos-form-input" name="estimatedValue" type="number"></div>
          <div class="gos-form-group"><label class="gos-form-label">Probability (%)</label><input class="gos-form-input" name="probabilityPercent" type="number" min="0" max="100"></div>
        </div>
        <div class="gos-form-row">
          <div class="gos-form-group"><label class="gos-form-label">Next Action</label><input class="gos-form-input" name="nextAction"></div>
          <div class="gos-form-group"><label class="gos-form-label">Action Due Date</label><input class="gos-form-input" name="nextActionDate" type="date"></div>
        </div>
      `;
      case 'scc': return `
        <div class="gos-form-group"><label class="gos-form-label">Title *</label><input class="gos-form-input" name="title" required></div>
        <div class="gos-form-row">
          <div class="gos-form-group">
            <label class="gos-form-label">Pillar</label>
            <select class="gos-form-select" name="contentPillar"><option>Mindset & Habits</option><option>Mental Health</option><option>Physical Wellness</option><option>Productivity</option><option>Community</option></select>
          </div>
          <div class="gos-form-group">
            <label class="gos-form-label">Format</label>
            <select class="gos-form-select" name="format"><option>Carousel Post</option><option>Short Video</option><option>Blog Article</option><option>Live Session</option><option>Story Series</option><option>Interview Post</option><option>Quote Graphic</option></select>
          </div>
        </div>
        <div class="gos-form-row">
          <div class="gos-form-group">
            <label class="gos-form-label">Channel</label>
            <select class="gos-form-select" name="channel"><option>Instagram</option><option>TikTok / Reels</option><option>LinkedIn</option><option>Facebook Group</option><option>Website</option></select>
          </div>
          <div class="gos-form-group"><label class="gos-form-label">Planned Publish Date</label><input class="gos-form-input" name="plannedPublishAt" type="date"></div>
        </div>
        <div class="gos-form-group"><label class="gos-form-label">CTA</label><input class="gos-form-input" name="cta" placeholder="Call to action"></div>
      `;
      case 'calmera': return `
        <div class="gos-form-row">
          <div class="gos-form-group"><label class="gos-form-label">Customer Name *</label><input class="gos-form-input" name="customerName" required></div>
          <div class="gos-form-group"><label class="gos-form-label">Order Reference</label><input class="gos-form-input" name="externalOrderRef"></div>
        </div>
        <div class="gos-form-group"><label class="gos-form-label">Items Summary *</label><input class="gos-form-input" name="itemsSummary" required></div>
        <div class="gos-form-row">
          <div class="gos-form-group"><label class="gos-form-label">Amount (₱)</label><input class="gos-form-input" name="orderAmount" type="number"></div>
          <div class="gos-form-group"><label class="gos-form-label">Fulfillment Cutoff *</label><input class="gos-form-input" name="fulfillmentCutoff" type="date" required></div>
        </div>
        <div class="gos-form-group">
          <label class="gos-form-label">Preferred Channel</label>
          <select class="gos-form-select" name="preferredChannel"><option>Email</option><option>SMS</option><option>Phone</option></select>
        </div>
      `;
      default: return `
        <div class="gos-form-group"><label class="gos-form-label">Title *</label><input class="gos-form-input" name="title" required></div>
        <div class="gos-form-group"><label class="gos-form-label">Notes</label><textarea class="gos-form-textarea" name="notes" rows="3"></textarea></div>
      `;
    }
  }

  handleAddRecord() {
    const form = document.getElementById('add-form');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);

    const today = getDemoToday();
    let newRecord;
    let newContact;
    let newOrg;

    switch (this.currentView) {
      case 'linkedin': {
        const contactId = data.contactName;
        let orgId = '';

        // Avoid duplicate contacts
        let contact = this.data.contacts.find(c => c.fullName === data.contactName || c.contactId === contactId);
        if (!contact) {
          newContact = {
            contactId,
            fullName: data.contactName,
            email: '',
            mobile: '',
            linkedinUrl: data.linkedinUrl || '',
            organizationId: '', // will be set below
            segments: ['LinkedIn Lead'],
            preferredChannel: 'LinkedIn',
            contactBasis: '',
            ownerId: 'Gelo',
            status: 'Active',
            createdAt: today,
            updatedAt: today,
            notes: data.notes || '',
          };
          this.data.contacts.push(newContact);
        } else {
          newContact = null;
        }

        if (data.company) {
          let org = this.data.organizations.find(o => o.organizationName === data.company);
          if (!org) {
            orgId = `ORG-${String((this.data.organizations || []).length + 1).padStart(4, '0')}`;
            newOrg = {
              organizationId: orgId,
              organizationName: data.company,
              industry: '',
              website: '',
              source: 'LinkedIn',
              accountStatus: 'Active',
              ownerId: 'Gelo',
              createdAt: today,
              updatedAt: today,
              notes: '',
            };
            this.data.organizations.push(newOrg);
          } else {
            orgId = org.organizationId;
            newOrg = null;
          }
          if (newContact) newContact.organizationId = orgId;
          else if (contact) contact.organizationId = orgId;
        }

        newRecord = {
          leadId: `LL-${String((this.data.linkedinLeads || []).length + 1).padStart(4, '0')}`,
          contactId: contactId,
          linkedinUrl: data.linkedinUrl || '',
          source: data.source || 'LinkedIn Search',
          dateCaptured: today,
          connectionStatus: 'Pending',
          role: data.role || '',
          organizationId: orgId,
          interestSignal: data.interestSignal || '',
          qualificationScore: this.calculateLeadScore(data),
          priority: data.priority || 'Normal',
          stage: 'New',
          lastInteractionAt: '',
          nextAction: data.nextAction || '',
          nextActionDate: data.nextActionDate || '',
          convertedOpportunityId: '',
          ownerId: 'Gelo',
          notes: data.notes || '',
        };
        this.data.linkedinLeads.push(newRecord);
        break;
      }
      case 'prime': {
        const primeContactId = data.contactName;
        let primeOrgId = '';

        let contact = this.data.contacts.find(c => c.fullName === data.contactName || c.contactId === primeContactId);
        if (!contact) {
          newContact = {
            contactId: primeContactId,
            fullName: data.contactName,
            email: '',
            mobile: '',
            linkedinUrl: '',
            organizationId: '', // will be set below
            segments: ['Prime'],
            preferredChannel: 'Email',
            contactBasis: '',
            ownerId: 'Gelo',
            status: 'Active',
            createdAt: today,
            updatedAt: today,
            notes: '',
          };
          this.data.contacts.push(newContact);
        } else {
          newContact = null;
        }

        let org = this.data.organizations.find(o => o.organizationName === data.orgName);
        if (!org) {
          primeOrgId = `ORG-${String((this.data.organizations || []).length + 1).padStart(4, '0')}`;
          newOrg = {
            organizationId: primeOrgId,
            organizationName: data.orgName,
            industry: '',
            website: '',
            source: 'Direct',
            accountStatus: 'Prospect',
            ownerId: 'Gelo',
            createdAt: today,
            updatedAt: today,
            notes: '',
          };
          this.data.organizations.push(newOrg);
        } else {
          primeOrgId = org.organizationId;
          newOrg = null;
        }
        if (newContact) newContact.organizationId = primeOrgId;
        else if (contact) contact.organizationId = primeOrgId;

        const value = parseInt(data.estimatedValue) || 0;
        const prob = parseInt(data.probabilityPercent) || 20;
        newRecord = {
          opportunityId: `PO-${String((this.data.primePipeline || []).length + 1).padStart(4, '0')}`,
          contactId: primeContactId,
          organizationId: primeOrgId,
          sourceLeadId: '',
          serviceInterest: data.serviceInterest,
          problemStatement: data.problemStatement || '',
          stage: 'New Inquiry',
          estimatedValue: value,
          probabilityPercent: prob,
          weightedValue: Math.round(value * prob / 100),
          budgetRange: '',
          decisionMaker: data.contactName,
          timeline: '',
          discoveryDate: '',
          proposalDate: '',
          nextAction: data.nextAction || '',
          nextActionDate: data.nextActionDate || '',
          closeDate: '',
          outcomeReason: '',
          ownerId: 'Gelo',
        };
        this.data.primePipeline.push(newRecord);
        break;
      }
      case 'scc': {
        newRecord = {
          contentId: `SCC-${String((this.data.sccContent || []).length + 1).padStart(4, '0')}`,
          ...data,
          status: 'Idea',
          views: 0, comments: 0, saves: 0, replies: 0,
          repurposeFlag: 'FALSE',
          sourceId: '',
          ownerId: 'Gelo',
          publishedAt: '', publishedUrl: '', draftUrl: '', assetUrl: '',
        };
        this.data.sccContent.push(newRecord);
        break;
      }
      case 'calmera': {
        const calmeraContactId = data.customerName;

        let contact = this.data.contacts.find(c => c.fullName === data.customerName || c.contactId === calmeraContactId);
        if (!contact) {
          newContact = {
            contactId: calmeraContactId,
            fullName: data.customerName,
            email: '',
            mobile: '',
            linkedinUrl: '',
            organizationId: '',
            segments: ['Calmera'],
            preferredChannel: data.preferredChannel || 'Email',
            contactBasis: '',
            ownerId: 'Gelo',
            status: 'Active',
            createdAt: today,
            updatedAt: today,
            notes: '',
          };
          this.data.contacts.push(newContact);
        } else {
          newContact = null;
        }

        newRecord = {
          orderId: `CAL-${String((this.data.calmeraOrders || []).length + 1).padStart(4, '0')}`,
          externalOrderRef: data.externalOrderRef || '',
          contactId: calmeraContactId,
          customerName: data.customerName,
          orderDate: today,
          itemsSummary: data.itemsSummary,
          orderAmount: parseInt(data.orderAmount) || 0,
          fulfillmentCutoff: data.fulfillmentCutoff,
          preferredChannel: data.preferredChannel || 'Email',
          reconfirmationStatus: 'Pending Contact',
          latestAttemptAt: '',
          responseDueAt: '',
          orderStatus: 'New',
          changeNotes: '',
          resolvedAt: '',
          ownerId: 'Gelo',
        };
        this.data.calmeraOrders.push(newRecord);
        break;
      }
    }

    this.closeModal('add-modal');
    form.reset();

    // Map relational display names locally (so that names show in lists instantly!)
    sheetsService._denormalize(this.data);

    this.applyFilters();
    this.renderContent();
    this.showToast('Record added successfully!', 'success');

    // Write to Google Sheets in background (if connected)
    if (this.sheetsConnected && newRecord) {
      const tabMap = {
        'linkedin': 'linkedinLeads',
        'prime': 'primePipeline',
        'scc': 'sccContent',
        'calmera': 'calmeraOrders',
      };
      const tabKey = tabMap[this.currentView];
      if (tabKey) {
        // Sequentially write Contact -> Organization -> Main Record to keep Sheets relational database clean
        const promises = [];
        if (newContact) promises.push(sheetsService.appendRecord('contacts', newContact));
        if (newOrg) promises.push(sheetsService.appendRecord('organizations', newOrg));

        Promise.all(promises)
          .then(() => {
            return sheetsService.appendRecord(tabKey, newRecord);
          })
          .then((res) => {
            if (res && res.rowsAfter !== undefined) {
              newRecord._rowIndex = res.rowsAfter - 1;
            }
            this.showToast('📤 Saved to Google Sheets', 'success');
          })
          .catch(err => {
            console.error('Sheet write failed:', err);
            this.showToast('⚠️ Saved locally, but Sheet write failed.', 'warning');
          });
      }
    }
  }

  // ── Lead Scoring ────────────────────────────────────────────
  calculateLeadScore(data) {
    let score = 30; // base

    // Interest signal
    if (data.interestSignal && data.interestSignal.length > 10) score += 20;

    // Priority
    if (data.priority === 'Critical') score += 25;
    else if (data.priority === 'High') score += 15;
    else if (data.priority === 'Normal') score += 5;

    // Company provided
    if (data.company) score += 10;

    // Role provided
    if (data.role) score += 10;

    // LinkedIn URL
    if (data.linkedinUrl) score += 5;

    return Math.min(score, 100);
  }

  // ── Task Toggle ─────────────────────────────────────────────
  toggleTask(taskId) {
    const task = this.data.tasks.find(t => t.taskId === taskId);
    if (task) {
      task.status = task.status === 'Completed' ? 'Open' : 'Completed';
      task.completedAt = task.status === 'Completed' ? getDemoToday() : '';
      this.renderContent();
      this.showToast(
        task.status === 'Completed' ? 'Task completed! ✅' : 'Task reopened',
        task.status === 'Completed' ? 'success' : 'info'
      );
    }
  }

  // ── Message Generator ───────────────────────────────────────
  openMessageGenerator() {
    const overlay = document.getElementById('msg-modal-overlay');
    const body    = document.getElementById('msg-modal-body');

    const streamMap = {
      linkedin: 'linkedin', prime: 'prime', scc: 'scc', calmera: 'calmera',
      'command-center': 'general', repurposing: 'general', messages: 'linkedin',
    };
    const stream    = streamMap[this.currentView] || 'general';
    const templates = MessageGenerator.getTemplates(stream);
    const categories = MessageGenerator.getCategories();

    body.innerHTML = `
      <div style="padding:20px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap">
          <span>Stream:</span>
          <select class="gos-form-select" style="width:auto" id="msg-category" onchange="app.switchMsgCategory(this.value)">
            ${categories.map(c => `<option value="${c}" ${c === stream ? 'selected' : ''}>${c.charAt(0).toUpperCase() + c.slice(1)}</option>`).join('')}
          </select>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin-bottom:20px" id="msg-templates">
          ${templates.map(t => `
            <div style="background:var(--surface-alt);border:1px solid var(--border);border-radius:var(--radius);padding:14px;cursor:pointer;transition:border-color 0.15s" 
                 onclick="app.selectTemplate('${t.id}')" data-template-id="${t.id}" 
                 onmouseover="this.style.borderColor='var(--accent)'" onmouseout="if(!this.classList.contains('selected'))this.style.borderColor='var(--border)'">
              <div style="font-weight:600;font-size:13px;color:var(--text-primary);margin-bottom:4px">${t.name}</div>
              <div style="font-size:11px;color:var(--text-muted)">${t.stage} · ${t.channel}</div>
            </div>
          `).join('')}
        </div>
        <div id="msg-preview" style="display:none">
          <div id="msg-preview-subject" style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px"></div>
          <div class="message-preview-text" id="msg-preview-body"></div>
        </div>
        <div id="msg-actions" style="display:none;gap:10px;margin-top:16px;flex-wrap:wrap">
          <button class="btn-copy large" onclick="app.copyMessage()">📋 Copy to Clipboard</button>
          <button class="btn-secondary" onclick="app.closeModal('msg-modal')">Close</button>
        </div>
      </div>
    `;

    if (overlay) overlay.style.display = 'flex';
  }

  openMessageForRecord(viewType, id) {
    const dataMap = {
      'linkedin': { data: this.data.linkedinLeads, idKey: 'leadId' },
      'prime': { data: this.data.primePipeline, idKey: 'opportunityId' },
      'scc': { data: this.data.sccContent, idKey: 'contentId' },
      'calmera': { data: this.data.calmeraOrders, idKey: 'orderId' },
    };

    const config = dataMap[viewType];
    if (!config) { this.openMessageGenerator(); return; }

    const record = config.data.find(r => r[config.idKey] === id);
    this.selectedRecord = { viewType, record };
    this.openMessageGenerator();
  }

  switchMsgCategory(category) {
    const templates = MessageGenerator.getTemplates(category);
    const grid = document.getElementById('msg-templates');
    grid.innerHTML = templates.map(t => `
      <div class="gos-msg-template-card" onclick="app.selectTemplate('${t.id}')" data-template-id="${t.id}">
        <div class="gos-msg-template-name">${t.name}</div>
        <div class="gos-msg-template-stage">${t.stage} · ${t.channel}</div>
      </div>
    `).join('');

    document.getElementById('msg-preview').style.display = 'none';
    document.getElementById('msg-actions').style.display = 'none';
  }

  selectTemplate(templateId) {
    // Highlight selected
    document.querySelectorAll('.gos-msg-template-card').forEach(card => {
      card.classList.toggle('selected', card.dataset.templateId === templateId);
    });

    const template = MessageGenerator.getTemplateById(templateId);
    if (!template) return;

    let result;
    if (this.selectedRecord?.record) {
      result = MessageGenerator.generatePreview(templateId, this.selectedRecord.record);
    } else {
      result = MessageGenerator.fillTemplate(template, {});
    }

    const preview = document.getElementById('msg-preview');
    const subject = document.getElementById('msg-preview-subject');
    const body = document.getElementById('msg-preview-body');
    const actions = document.getElementById('msg-actions');

    subject.textContent = result.subject || '(No subject — direct message)';
    // Highlight placeholders
    body.innerHTML = result.body.replace(/\[(\w+)\]/g, '<span class="placeholder">[$1]</span>');

    preview.style.display = 'block';
    actions.style.display = 'flex';

    this._currentMessage = result;
  }

  copyMessage() {
    if (!this._currentMessage) return;
    const text = (this._currentMessage.subject ? `Subject: ${this._currentMessage.subject}\n\n` : '') + this._currentMessage.body;
    navigator.clipboard.writeText(text).then(() => {
      this.showToast('Message copied to clipboard!', 'success');
    }).catch(() => {
      this.showToast('Failed to copy — check browser permissions', 'error');
    });
  }

  // ── Toast Notifications ─────────────────────────────────────
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `gos-toast ${type}`;
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
      <span class="toast-text">${message}</span>
      <button style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:0 0 0 8px;font-size:16px;line-height:1" onclick="this.parentElement.remove()">×</button>
    `;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => toast.remove(), 300); }, 3500);
  }

  // ── Helpers ─────────────────────────────────────────────────
  formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(num >= 10000 ? 0 : 1) + 'K';
    return num.toLocaleString();
  }

  // ── Google Sheets Connection ────────────────────────────────

  async connectSheets() {
    if (!sheetsService.isConfigured()) {
      this.showToast('⚠️ Add your Web App URL to sheets-config.js first. See the setup guide!', 'warning');
      return;
    }

    this.updateConnectionUI('loading');
    this.showToast('Connecting to Google Sheets...', 'info');

    try {
      // Test the connection
      const alive = await sheetsService.ping();
      if (!alive) {
        this.showToast('❌ Could not reach the Sheet API. Check your Web App URL.', 'error');
        this.updateConnectionUI('demo');
        return;
      }

      sheetsService.signIn();

      // Load data from Sheets
      await this.refreshFromSheets();

    } catch (err) {
      console.error('Connection error:', err);
      this.showToast('Failed to connect: ' + (err.message || 'Unknown error'), 'error');
      this.updateConnectionUI('demo');
    }
  }

  async refreshFromSheets() {
    if (!sheetsService.isSignedIn) {
      this.showToast('Not connected to Google Sheets.', 'warning');
      return;
    }

    this.updateConnectionUI('loading');

    try {
      const sheetsData = await sheetsService.readAllData();

      // Use Sheets data directly (empty arrays if a sheet tab is empty)
      this.data = {
        contacts: sheetsData.contacts || [],
        organizations: sheetsData.organizations || [],
        linkedinLeads: sheetsData.linkedinLeads || [],
        primePipeline: sheetsData.primePipeline || [],
        sccContent: sheetsData.sccContent || [],
        calmeraOrders: sheetsData.calmeraOrders || [],
        sourceAssets: sheetsData.sourceAssets || [],
        repurposeOutputs: sheetsData.repurposeOutputs || [],
        interactions: sheetsData.interactions || [],
        tasks: sheetsData.tasks || [],
      };

      this.sheetsConnected = true;
      localStorage.setItem('gos_sheets_connected', 'true');
      this.applyFilters();
      this.render();
      this.updateConnectionUI('connected');
      this.updateNavBadge();
      this.showToast('✅ Data loaded from Google Sheets!', 'success');

    } catch (err) {
      console.error('Refresh error:', err);
      this.showToast('Failed to load data: ' + (err.message || 'Check sheet permissions'), 'error');
      this.updateConnectionUI('demo');
    }
  }

  disconnectSheets() {
    if (sheetsService.isSignedIn) {
      sheetsService.signOut();
    }
    this.sheetsConnected = false;
    localStorage.setItem('gos_sheets_connected', 'false');
    this.data = { ...DEMO_DATA };
    this.applyFilters();
    this.render();
    this.updateConnectionUI('demo');
    this.updateNavBadge();
    this.showToast('Disconnected — using demo data.', 'info');
  }

  updateConnectionUI(state) {
    const dot      = document.getElementById('conn-dot');
    const label    = document.getElementById('conn-label');
    const btnCon   = document.getElementById('btn-connect');
    const btnDis   = document.getElementById('btn-disconnect');
    const btnRef   = document.getElementById('btn-refresh');

    if (!dot) return;

    dot.className = `conn-dot ${state === 'connected' ? 'connected' : state === 'loading' ? 'loading' : ''}`;

    switch (state) {
      case 'connected':
        if (label)  label.textContent   = 'Google Sheets';
        if (btnCon) btnCon.style.display = 'none';
        if (btnDis) btnDis.style.display = 'block';
        if (btnRef) btnRef.style.display = 'block';
        break;
      case 'loading':
        if (label)  label.textContent   = 'Connecting…';
        if (btnCon) btnCon.style.display = 'none';
        if (btnDis) btnDis.style.display = 'none';
        if (btnRef) btnRef.style.display = 'none';
        break;
      default:
        if (label)  label.textContent   = 'Not Connected';
        if (btnCon) btnCon.style.display = 'block';
        if (btnDis) btnDis.style.display = 'none';
        if (btnRef) btnRef.style.display = 'none';
    }
  }

  updateNavBadge() {
    const tasks = this.data.tasks || [];
    const overdue = tasks.filter(t => t.status !== 'Completed' && t.status !== 'Cancelled' && isOverdue(t.dueAt));
    const badge = document.getElementById('nav-badge-overdue');
    if (badge) {
      badge.textContent = overdue.length;
      badge.style.display = overdue.length === 0 ? 'none' : 'inline-flex';
    }
  }
  // ═══════════════════════════════════════════════════════════
  // ── NEW VIEWS ───────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════

  // ── Calendar View ───────────────────────────────────────────
  renderCalendar(container) {
    const leads   = this.data.linkedinLeads || [];
    const pipe    = this.data.primePipeline || [];
    const orders  = this.data.calmeraOrders || [];
    const today   = getDemoToday();

    // Aggregate events from all data sources
    const events = [];

    leads.forEach(l => {
      if (l.nextActionDate) events.push({
        date:    l.nextActionDate,
        name:    l.contactName  || 'Unknown',
        type:    'Follow-up',
        next:    l.nextAction   || '',
        stage:   l.stage        || '',
        color:   '#6366f1',
        viewType:'linkedin', id: l.leadId,
      });
    });

    pipe.forEach(p => {
      if (p.nextActionDate) events.push({
        date:    p.nextActionDate,
        name:    p.contactName  || 'Unknown',
        type:    'Sales Action',
        next:    p.nextAction   || '',
        stage:   p.stage        || '',
        color:   '#10b981',
        viewType:'prime', id: p.opportunityId,
      });
    });

    orders.forEach(o => {
      if (o.fulfillmentCutoff) events.push({
        date:    o.fulfillmentCutoff,
        name:    o.customerName || 'Unknown',
        type:    'Order Cutoff',
        next:    o.itemsSummary || '',
        stage:   o.reconfirmationStatus || '',
        color:   '#f59e0b',
        viewType:'calmera', id: o.orderId,
      });
    });

    // Apply filter from this._calFilter
    const filter = this._calFilter || 'all';
    let filtered = events.slice();
    if (filter === 'today')    filtered = filtered.filter(e => e.date === today);
    else if (filter === 'week') {
      const d7 = new Date(); d7.setDate(d7.getDate() + 7);
      filtered = filtered.filter(e => e.date >= today && e.date <= d7.toISOString().slice(0,10));
    }
    else if (filter === 'overdue') filtered = filtered.filter(e => e.date < today);
    else if (filter === 'followup') filtered = filtered.filter(e => e.type === 'Follow-up');
    else if (filter === 'calls')   filtered = filtered.filter(e => e.type === 'Sales Action');

    // Group events by date
    const groups = {};
    filtered.sort((a,b) => a.date.localeCompare(b.date)).forEach(ev => {
      if (!groups[ev.date]) groups[ev.date] = [];
      groups[ev.date].push(ev);
    });

    const todayEvents    = (groups[today] || []);
    const futureEvents   = filtered.filter(e => e.date > today);
    const overdueEvents  = filtered.filter(e => e.date < today);

    const filterBtns = ['all','today','week','overdue','followup','calls'].map(f => `
      <button class="calendar-filter-btn ${filter === f ? 'active' : ''}" onclick="app._setCalFilter('${f}')">
        ${{ all:'All', today:'Today', week:'This Week', overdue:'⚠️ Overdue', followup:'Follow-ups', calls:'Sales Actions' }[f]}
      </button>
    `).join('');

    const renderEventCard = (ev) => `
      <div class="calendar-event-card" onclick="app.openRecordPanel('${ev.viewType}', '${ev.id}')">
        <div class="event-time-col">${ev.date === today ? 'Today' : ev.date.slice(5).replace('-','/')}</div>
        <div class="event-type-dot" style="background:${ev.color}"></div>
        <div class="event-info">
          <div class="event-lead-name">${ev.name}</div>
          <div class="event-type-label">${ev.type} · ${ev.stage}</div>
          ${ev.next ? `<div class="event-next-action">${ev.next}</div>` : ''}
        </div>
        <button class="event-msg-btn" onclick="event.stopPropagation();app.openMessageForRecord('${ev.viewType}','${ev.id}')">✉️ Msg</button>
      </div>
    `;

    container.innerHTML = `
      <div class="calendar-toolbar">
        <div class="calendar-filters">${filterBtns}</div>
        <button class="btn-primary btn-sm" onclick="app.showToast('Calendar events sync automatically from your leads and pipeline.','info')">+ Manual Event (Coming Soon)</button>
      </div>
      <div class="calendar-layout">
        <div class="calendar-main">
          ${overdueEvents.length > 0 ? `
            <div class="calendar-day-group">
              <div class="calendar-day-label"><span style="color:var(--red)">⚠️ Overdue (${overdueEvents.length})</span></div>
              ${overdueEvents.map(renderEventCard).join('')}
            </div>` : ''}
          ${todayEvents.length > 0 ? `
            <div class="calendar-day-group">
              <div class="calendar-day-label">Today — ${today} <span class="today-pill">TODAY</span></div>
              ${todayEvents.map(renderEventCard).join('')}
            </div>` : ''}
          ${Object.entries(groups).filter(([d]) => d > today).map(([date, evs]) => `
            <div class="calendar-day-group">
              <div class="calendar-day-label">${date}</div>
              ${evs.map(renderEventCard).join('')}
            </div>
          `).join('')}
          ${filtered.length === 0 ? `<div class="gos-empty"><span class="gos-empty-icon">📅</span><span class="gos-empty-title">No events match this filter</span><span class="gos-empty-desc">Add leads with follow-up dates to populate your calendar.</span></div>` : ''}
        </div>
        <div class="calendar-sidebar">
          <div class="upcoming-section">
            <div class="upcoming-section-title">📌 Today (${todayEvents.length})</div>
            ${todayEvents.slice(0,4).map(ev => `
              <div class="upcoming-item" onclick="app.openRecordPanel('${ev.viewType}','${ev.id}')">
                <div class="upcoming-item-name">${ev.name}</div>
                <div class="upcoming-item-type">${ev.type}</div>
              </div>`).join('') || '<div class="text-muted text-sm" style="padding:8px">Nothing today</div>'}
          </div>
          <div class="upcoming-section">
            <div class="upcoming-section-title">⏰ Overdue (${overdueEvents.length})</div>
            ${overdueEvents.slice(0,4).map(ev => `
              <div class="upcoming-item" onclick="app.openRecordPanel('${ev.viewType}','${ev.id}')">
                <div class="upcoming-item-name" style="color:var(--red)">${ev.name}</div>
                <div class="upcoming-item-type">${ev.type} — ${ev.date}</div>
              </div>`).join('') || '<div class="text-muted text-sm" style="padding:8px">No overdue items</div>'}
          </div>
          <div class="upcoming-section">
            <div class="upcoming-section-title">🔜 Upcoming (${futureEvents.length})</div>
            ${futureEvents.slice(0,5).map(ev => `
              <div class="upcoming-item" onclick="app.openRecordPanel('${ev.viewType}','${ev.id}')">
                <div class="upcoming-item-name">${ev.name}</div>
                <div class="upcoming-item-type">${ev.date} · ${ev.type}</div>
              </div>`).join('') || '<div class="text-muted text-sm" style="padding:8px">No upcoming events</div>'}
          </div>
        </div>
      </div>
    `;
  }

  _setCalFilter(f) {
    this._calFilter = f;
    this.renderContent();
  }

  // ── Messages Page ────────────────────────────────────────────
  renderMessagesPage(container) {
    const leads     = this.data.linkedinLeads || [];
    const toneOpts  = [
      { id:'warm',    label:'Warm Taglish',       desc:'Relatable, friendly, mix of Filipino warmth' },
      { id:'direct',  label:'Direct Professional', desc:'Straight to the point, executive style' },
      { id:'casual',  label:'Friendly Casual',     desc:'Conversational and light' },
      { id:'ceo',     label:'CEO / Founder Style', desc:'Confident, positioning-first' },
      { id:'comm',    label:'Community Style',     desc:'Inclusive, community-first language' },
    ];
    const typeOpts  = [
      { id:'connection',  label:'Connection Request'    },
      { id:'thank-you',   label:'Thank You Message'     },
      { id:'follow-up',   label:'Follow-up'             },
      { id:'call-invite', label:'Call Invite'           },
      { id:'no-reply',    label:'No-Reply Follow-up'    },
      { id:'proposal',    label:'Proposal Follow-up'    },
      { id:'referral',    label:'Referral Ask'          },
      { id:'reconfirm',   label:'Reconfirmation'        },
    ];

    const curTone = this._msgTone || 'warm';
    const curType = this._msgType || 'follow-up';

    container.innerHTML = `
      <div class="messages-layout">
        <div class="messages-form-panel">
          <div style="margin-bottom:16px">
            <div class="gos-form-label" style="margin-bottom:8px">Lead / Name</div>
            <input class="gos-form-input" id="msg-page-name" placeholder="e.g. Maria Cruz" list="msg-leads-list">
            <datalist id="msg-leads-list">${leads.map(l => `<option value="${l.contactName}">`).join('')}</datalist>
          </div>
          <div class="gos-form-group">
            <label class="gos-form-label">Offer / Category</label>
            <input class="gos-form-input" id="msg-page-offer" placeholder="e.g. Consultation, Self Care Bundle">
          </div>
          <div class="gos-form-group">
            <label class="gos-form-label">Stage</label>
            <select class="gos-form-select" id="msg-page-stage">
              <option>New</option><option>Contacted</option><option>Follow-up Due</option>
              <option>Call Booked</option><option>Proposal Sent</option><option>Negotiation</option>
            </select>
          </div>
          <div class="gos-form-group">
            <label class="gos-form-label">Platform</label>
            <select class="gos-form-select" id="msg-page-platform">
              <option>LinkedIn</option><option>Instagram</option><option>Facebook</option>
              <option>Messenger</option><option>WhatsApp</option><option>SMS</option><option>Email</option>
            </select>
          </div>
          <div class="gos-form-label" style="margin-bottom:8px">Message Type</div>
          <div class="message-type-grid">
            ${typeOpts.map(t => `
              <button class="message-type-btn ${curType === t.id ? 'active' : ''}" 
                      onclick="app._setMsgType('${t.id}')">${t.label}</button>
            `).join('')}
          </div>
          <div class="gos-form-label" style="margin:8px 0">Tone</div>
          <div class="tone-selector">
            ${toneOpts.map(t => `
              <button class="tone-option ${curTone === t.id ? 'active' : ''}"
                      onclick="app._setMsgTone('${t.id}')">
                <strong>${t.label}</strong> — <span style="font-weight:400">${t.desc}</span>
              </button>
            `).join('')}
          </div>
          <button class="btn-primary" style="width:100%;margin-top:16px" onclick="app._generateMessage()">✨ Generate Message</button>
        </div>
        <div class="messages-preview-panel">
          <div class="messages-panel-header">Message Preview</div>
          <div class="message-preview-body" id="msg-page-preview">
            <div class="gos-empty" style="padding:40px 20px">
              <span class="gos-empty-icon">✉️</span>
              <span class="gos-empty-title">Fill in the form and generate a message</span>
              <span class="gos-empty-desc">Choose a type, tone, and click Generate.</span>
            </div>
          </div>
          <div class="message-actions" id="msg-page-actions" style="display:none">
            <button class="btn-copy large" onclick="app._copyPageMessage()">📋 Copy Message</button>
            <button class="btn-secondary" onclick="app._generateMessage()">↻ Regenerate</button>
          </div>
        </div>
      </div>
    `;
  }

  _setMsgType(type) { this._msgType = type; this.renderContent(); }
  _setMsgTone(tone) { this._msgTone = tone; this.renderContent(); }

  _generateMessage() {
    const name     = document.getElementById('msg-page-name')?.value    || '[Name]';
    const offer    = document.getElementById('msg-page-offer')?.value   || '[Offer]';
    const stage    = document.getElementById('msg-page-stage')?.value   || 'Follow-up Due';
    const platform = document.getElementById('msg-page-platform')?.value|| 'LinkedIn';
    const type     = this._msgType || 'follow-up';
    const tone     = this._msgTone || 'warm';

    // Build a contextual message using MESSAGE_TEMPLATES if available
    let msg = '';
    try {
      // Try existing message generator first
      const streamMap = { 'follow-up':'linkedin','call-invite':'linkedin','proposal':'prime','reconfirm':'calmera' };
      const stream    = streamMap[type] || 'linkedin';
      const templates = MessageGenerator.getTemplates(stream);
      const template  = templates[0]; // pick first available
      if (template) {
        const result = MessageGenerator.fillTemplate(template, { name, company: offer, serviceInterest: offer });
        msg = result.body;
      }
    } catch(e) {}

    if (!msg) {
      // Fallback: generate a simple contextual message
      const toneMap = {
        warm:   `Hi ${name}! `,
        direct: `Hi ${name}, `,
        casual: `Hey ${name}! `,
        ceo:    `Hi ${name}, `,
        comm:   `Hi ${name}! `,
      };
      const typeMap = {
        'connection':  `I'd love to connect. I help people with ${offer}. Would love to have you in my network!`,
        'thank-you':   `Thank you so much for connecting! Excited to learn more about what you're working on.`,
        'follow-up':   `Just following up on our last conversation. I work with ${offer} and wanted to check if this could be a fit for you.`,
        'call-invite': `Would love to hop on a quick call to explore how ${offer} could help you. Are you free this week?`,
        'no-reply':    `Hi again! I know things get busy — just wanted to check if you had a chance to see my last message about ${offer}.`,
        'proposal':    `Following up on the proposal I sent. Happy to answer any questions or adjust based on your needs.`,
        'referral':    `Do you know anyone who might benefit from ${offer}? I'd appreciate any referrals!`,
        'reconfirm':   `Hi ${name}! Just confirming your order. Please let me know if anything has changed. Thank you!`,
      };
      msg = (toneMap[tone] || `Hi ${name}! `) + (typeMap[type] || 'How are you?');
    }

    this._pageMessage = msg;
    const prev = document.getElementById('msg-page-preview');
    const acts = document.getElementById('msg-page-actions');
    if (prev) prev.innerHTML = `<div class="message-preview-text">${msg}</div>`;
    if (acts) acts.style.display = 'flex';
  }

  _copyPageMessage() {
    if (!this._pageMessage) return;
    navigator.clipboard.writeText(this._pageMessage).then(() => {
      this.showToast('Message copied! 📋', 'success');
    }).catch(() => {
      this.showToast('Copy failed — please copy manually', 'error');
    });
  }

  // ── Settings Page ─────────────────────────────────────────────
  renderSettings(container) {
    const settings = settingsEngine.get();
    const tab      = this._settingsTab || 'workspace';

    const tabs = [
      { id:'workspace',  label:'Workspace' },
      { id:'profile',    label:'Profile'   },
      { id:'modules',    label:'Modules'   },
      { id:'categories', label:'Categories'},
      { id:'sheets',     label:'Sheets'    },
      { id:'appearance', label:'Appearance'},
    ];

    container.innerHTML = `
      <div class="settings-layout">
        <div class="settings-tabs">
          ${tabs.map(t => `
            <button class="settings-tab ${tab === t.id ? 'active' : ''}" onclick="app._setSettingsTab('${t.id}')">
              ${t.label}
            </button>
          `).join('')}
        </div>

        <!-- Workspace -->
        <div class="settings-section ${tab === 'workspace' ? 'active' : ''}">
          <div class="settings-card">
            <div class="settings-card-header">
              <div>
                <div class="settings-card-title">Workspace Settings</div>
                <div class="settings-card-desc">Customize the name and subtitle of your Growth OS.</div>
              </div>
            </div>
            <div class="settings-card-body">
              <div class="gos-form-group">
                <label class="gos-form-label">App Name</label>
                <input class="gos-form-input" id="set-appName" value="${this._esc(settings.appName)}" placeholder="e.g. Gelo Growth OS">
                <div class="gos-form-hint">Appears in the browser tab title.</div>
              </div>
              <div class="gos-form-group">
                <label class="gos-form-label">Workspace Name</label>
                <input class="gos-form-input" id="set-workspaceName" value="${this._esc(settings.workspaceName)}" placeholder="e.g. Growth OS">
                <div class="gos-form-hint">Appears in the sidebar logo area.</div>
              </div>
              <div class="gos-form-group">
                <label class="gos-form-label">Workspace Subtitle</label>
                <textarea class="gos-form-textarea" id="set-workspaceSubtitle" rows="2">${this._esc(settings.workspaceSubtitle)}</textarea>
                <div class="gos-form-hint">A short description of your workspace purpose.</div>
              </div>
              <button class="btn-primary" onclick="app._saveWorkspaceSettings()">Save Workspace</button>
            </div>
          </div>
        </div>

        <!-- Profile -->
        <div class="settings-section ${tab === 'profile' ? 'active' : ''}">
          <div class="settings-card">
            <div class="settings-card-header">
              <div>
                <div class="settings-card-title">Your Profile</div>
                <div class="settings-card-desc">How your name and role appear in the sidebar.</div>
              </div>
            </div>
            <div class="settings-card-body">
              <div class="gos-form-row">
                <div class="gos-form-group">
                  <label class="gos-form-label">Display Name</label>
                  <input class="gos-form-input" id="set-displayName" value="${this._esc(settings.profile.displayName)}">
                </div>
                <div class="gos-form-group">
                  <label class="gos-form-label">Avatar Initials</label>
                  <input class="gos-form-input" id="set-avatarInitials" value="${this._esc(settings.profile.avatarInitials)}" maxlength="2" style="text-transform:uppercase">
                </div>
              </div>
              <div class="gos-form-row">
                <div class="gos-form-group">
                  <label class="gos-form-label">Role / Title</label>
                  <input class="gos-form-input" id="set-role" value="${this._esc(settings.profile.role)}">
                </div>
                <div class="gos-form-group">
                  <label class="gos-form-label">Company</label>
                  <input class="gos-form-input" id="set-company" value="${this._esc(settings.profile.company)}">
                </div>
              </div>
              <div class="gos-form-group">
                <label class="gos-form-label">Email</label>
                <input class="gos-form-input" type="email" id="set-email" value="${this._esc(settings.profile.email)}">
              </div>
              <div class="gos-form-group">
                <label class="gos-form-label">Main Focus</label>
                <input class="gos-form-input" id="set-mainFocus" value="${this._esc(settings.profile.mainFocus)}" placeholder="e.g. Sales, Content, and Growth">
              </div>
              <button class="btn-primary" onclick="app._saveProfileSettings()">Save Profile</button>
            </div>
          </div>
        </div>

        <!-- Modules -->
        <div class="settings-section ${tab === 'modules' ? 'active' : ''}">
          <div class="settings-card">
            <div class="settings-card-header">
              <div>
                <div class="settings-card-title">Modules</div>
                <div class="settings-card-desc">Rename modules. Changes update the sidebar and navigation instantly.</div>
              </div>
            </div>
            <div class="settings-card-body">
              ${settings.modules.map((mod, idx) => `
                <div class="module-item">
                  <div class="module-item-icon">${mod.icon}</div>
                  <div class="module-item-info">
                    <div class="module-item-name">${this._esc(mod.label)}</div>
                    ${mod.sheetTab ? `<div class="module-item-sheet">📊 ${mod.sheetTab}</div>` : '<div class="module-item-sheet text-muted">No sheet tab</div>'}
                  </div>
                  <div class="module-item-actions">
                    <input class="module-rename-input" id="mod-label-${idx}" value="${this._esc(mod.label)}" placeholder="Module name">
                    ${mod.sheetTab ? `<input class="module-rename-input" id="mod-tab-${idx}" value="${this._esc(mod.sheetTab)}" placeholder="Sheet tab name" style="width:120px">` : ''}
                    <label class="toggle-switch" title="Show/hide this module">
                      <input type="checkbox" ${mod.visible ? 'checked' : ''} onchange="app._toggleModuleVisible(${idx}, this.checked)">
                      <span class="toggle-slider"></span>
                    </label>
                  </div>
                </div>
              `).join('')}
              <div style="margin-top:16px">
                <button class="btn-primary" onclick="app._saveModuleSettings()">Save Module Names</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Categories -->
        <div class="settings-section ${tab === 'categories' ? 'active' : ''}">
          <div class="settings-card">
            <div class="settings-card-header">
              <div>
                <div class="settings-card-title">Categories</div>
                <div class="settings-card-desc">Categories help you organize leads, content, and orders by business area.</div>
              </div>
              <button class="btn-secondary btn-sm" onclick="app._addCategory()">+ Add Category</button>
            </div>
            <div class="settings-card-body">
              <div id="category-list">
                ${settings.categories.map((cat, idx) => `
                  <div class="category-item" id="cat-item-${idx}">
                    <div class="category-color-dot" style="background:${cat.color}"></div>
                    <input class="category-label-input" id="cat-label-${idx}" value="${this._esc(cat.label)}">
                    <input type="color" value="${cat.color}" style="width:32px;height:32px;border:none;background:none;cursor:pointer;border-radius:var(--radius-sm)" onchange="app._setCategoryColor(${idx}, this.value)">
                    <button class="btn-ghost btn-sm btn-icon" onclick="app._deleteCategory(${idx})" title="Delete">🗑️</button>
                  </div>
                `).join('')}
              </div>
              <div style="margin-top:16px">
                <button class="btn-primary" onclick="app._saveCategorySettings()">Save Categories</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Sheets -->
        <div class="settings-section ${tab === 'sheets' ? 'active' : ''}">
          <div class="settings-card">
            <div class="settings-card-header">
              <div>
                <div class="settings-card-title">Google Sheets Connection</div>
                <div class="settings-card-desc">Status: <span class="conn-status-pill ${this.sheetsConnected ? 'connected' : 'disconnected'}">${this.sheetsConnected ? '✅ Connected' : '❌ Not Connected'}</span></div>
              </div>
            </div>
            <div class="settings-card-body">
              <div class="gos-form-group">
                <label class="gos-form-label">Apps Script Web App URL</label>
                <input class="gos-form-input" id="set-webAppUrl" value="${this._esc(settings.sheets.webAppUrl || SHEETS_CONFIG.WEBAPP_URL || '')}" placeholder="https://script.google.com/macros/s/...">
                <div class="gos-form-hint">Deploy your sheet-api.gs as a Web App and paste the URL here.</div>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px">
                <button class="btn-primary" onclick="app._saveAndTestSheets()">Save &amp; Test Connection</button>
                ${this.sheetsConnected ? '<button class="btn-secondary" onclick="app.refreshFromSheets()">↻ Sync Now</button>' : ''}
                ${this.sheetsConnected ? '<button class="btn-danger btn-sm" onclick="app.disconnectSheets()">Disconnect</button>' : ''}
              </div>
              <div class="gos-form-label" style="margin-bottom:12px">Sheet Tab Mappings</div>
              ${Object.entries(settings.sheets.tabMappings).map(([modId, tabName]) => `
                <div class="sheet-mapping-row">
                  <div class="sheet-mapping-label">${settingsEngine.getModuleLabel(modId) || modId}</div>
                  <input class="gos-form-input" id="tab-${modId}" value="${this._esc(tabName)}" placeholder="Tab name in Google Sheets">
                </div>
              `).join('')}
              <button class="btn-secondary" style="margin-top:12px" onclick="app._saveTabMappings()">Save Tab Names</button>
            </div>
          </div>
        </div>

        <!-- Appearance -->
        <div class="settings-section ${tab === 'appearance' ? 'active' : ''}">
          <div class="settings-card">
            <div class="settings-card-header">
              <div class="settings-card-title">Appearance</div>
            </div>
            <div class="settings-card-body">
              <div class="gos-form-label" style="margin-bottom:12px">Theme</div>
              <div class="theme-options">
                <div class="theme-option ${settings.appearance.theme === 'dark' ? 'active' : ''}" onclick="app._setTheme('dark')">
                  <div class="theme-option-preview dark-preview"></div>
                  <div class="theme-option-label">Dark Mode</div>
                  <div class="theme-option-desc">Premium dark navy — easy on the eyes</div>
                </div>
                <div class="theme-option ${settings.appearance.theme === 'light' ? 'active' : ''}" onclick="app._setTheme('light')">
                  <div class="theme-option-preview light-preview"></div>
                  <div class="theme-option-label">Light Mode</div>
                  <div class="theme-option-desc">Clean white — great for daytime use</div>
                </div>
              </div>
            </div>
          </div>
          <div class="settings-card">
            <div class="settings-card-header">
              <div class="settings-card-title">⚠️ Reset Settings</div>
            </div>
            <div class="settings-card-body">
              <p style="color:var(--text-muted);font-size:13px;margin-bottom:12px">Reset all workspace settings back to defaults. Your Google Sheets data will NOT be affected.</p>
              <button class="btn-danger" onclick="app._resetSettings()">Reset All Settings</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _setSettingsTab(tab) { this._settingsTab = tab; this.renderContent(); }
  _setTheme(t) { settingsEngine.applyTheme(t); this.showToast(`Switched to ${t} mode`, 'success'); this.renderContent(); }

  _esc(str) { return String(str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  _saveWorkspaceSettings() {
    const settings = settingsEngine.get();
    settings.appName           = document.getElementById('set-appName')?.value           || settings.appName;
    settings.workspaceName     = document.getElementById('set-workspaceName')?.value     || settings.workspaceName;
    settings.workspaceSubtitle = document.getElementById('set-workspaceSubtitle')?.value || settings.workspaceSubtitle;
    settingsEngine.save(settings);
    this.updateAppName();
    document.getElementById('page-title').textContent = settings.appName;
    this.showToast('Workspace settings saved!', 'success');
  }

  _saveProfileSettings() {
    const settings = settingsEngine.get();
    settings.profile.displayName    = document.getElementById('set-displayName')?.value    || settings.profile.displayName;
    settings.profile.avatarInitials = document.getElementById('set-avatarInitials')?.value || settings.profile.avatarInitials;
    settings.profile.role           = document.getElementById('set-role')?.value           || settings.profile.role;
    settings.profile.company        = document.getElementById('set-company')?.value        || settings.profile.company;
    settings.profile.email          = document.getElementById('set-email')?.value          || '';
    settings.profile.mainFocus      = document.getElementById('set-mainFocus')?.value      || settings.profile.mainFocus;
    settingsEngine.save(settings);
    this.updateSidebarProfile();
    this.showToast('Profile saved!', 'success');
  }

  _saveModuleSettings() {
    const settings = settingsEngine.get();
    settings.modules.forEach((mod, idx) => {
      const labelEl = document.getElementById(`mod-label-${idx}`);
      const tabEl   = document.getElementById(`mod-tab-${idx}`);
      if (labelEl && labelEl.value.trim()) mod.label = labelEl.value.trim();
      if (tabEl   && tabEl.value.trim())   mod.sheetTab = tabEl.value.trim();
    });
    settingsEngine.save(settings);
    this.buildNavigation();
    this.updateTopbar();
    this.showToast('Module names saved!', 'success');
    this.renderContent();
  }

  _toggleModuleVisible(idx, visible) {
    const settings = settingsEngine.get();
    if (settings.modules[idx]) settings.modules[idx].visible = visible;
    settingsEngine.save(settings);
    this.buildNavigation();
  }

  _addCategory() {
    const settings = settingsEngine.get();
    const colors   = ['#6366f1','#10b981','#3b82f6','#f59e0b','#ec4899','#eab308','#22d3ee','#a855f7'];
    settings.categories.push({
      id:    `cat-${Date.now()}`,
      label: 'New Category',
      color: colors[settings.categories.length % colors.length],
    });
    settingsEngine.save(settings);
    this.renderContent();
  }

  _setCategoryColor(idx, color) {
    const settings = settingsEngine.get();
    if (settings.categories[idx]) settings.categories[idx].color = color;
    settingsEngine.save(settings);
  }

  _deleteCategory(idx) {
    const settings = settingsEngine.get();
    settings.categories.splice(idx, 1);
    settingsEngine.save(settings);
    this.renderContent();
  }

  _saveCategorySettings() {
    const settings = settingsEngine.get();
    settings.categories.forEach((cat, idx) => {
      const el = document.getElementById(`cat-label-${idx}`);
      if (el && el.value.trim()) cat.label = el.value.trim();
    });
    settingsEngine.save(settings);
    this.showToast('Categories saved!', 'success');
  }

  async _saveAndTestSheets() {
    const settings   = settingsEngine.get();
    const url        = document.getElementById('set-webAppUrl')?.value.trim();
    if (!url) { this.showToast('Please enter a Web App URL', 'warning'); return; }
    settings.sheets.webAppUrl = url;
    settingsEngine.save(settings);
    // Update SHEETS_CONFIG too
    if (typeof SHEETS_CONFIG !== 'undefined') SHEETS_CONFIG.WEBAPP_URL = url;
    this.showToast('URL saved. Testing connection…', 'info');
    await this.connectSheets();
    this.renderContent();
  }

  _saveTabMappings() {
    const settings = settingsEngine.get();
    Object.keys(settings.sheets.tabMappings).forEach(modId => {
      const el = document.getElementById(`tab-${modId}`);
      if (el && el.value.trim()) settings.sheets.tabMappings[modId] = el.value.trim();
    });
    settingsEngine.save(settings);
    this.showToast('Tab mappings saved!', 'success');
  }

  _resetSettings() {
    this.showConfirm(
      'Reset All Settings',
      'This will reset all workspace settings (names, modules, categories, theme) to defaults. Your Google Sheets data will NOT be affected.',
      '🔄 Reset',
      () => {
        settingsEngine.reset();
        settingsEngine.applyTheme();
        this.buildNavigation();
        this.updateSidebarProfile();
        this.updateAppName();
        this.renderContent();
        this.showToast('Settings reset to defaults.', 'info');
      }
    );
  }
}

// ── Initialize ────────────────────────────────────────────────
let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new GeloGrowthOS();
  app.updateNavBadge();

  // Auto-connect to Google Sheets on startup if configured and not explicitly disconnected
  const savedUrl = settingsEngine.get().sheets.webAppUrl;
  if (savedUrl && typeof SHEETS_CONFIG !== 'undefined') SHEETS_CONFIG.WEBAPP_URL = savedUrl;

  if (sheetsService.isConfigured() && localStorage.getItem('gos_sheets_connected') !== 'false') {
    app.connectSheets();
  }
});

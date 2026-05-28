// ============================================================
// Gelo Growth OS — Settings Engine v2
// Manages all customization: modules, categories, profile,
// appearance, and Sheets mappings via localStorage.
// ============================================================

const SETTINGS_VERSION = 'gos_settings_v2';

const DEFAULT_SETTINGS = {
  appName: 'Gelo Growth OS',
  workspaceName: 'Growth OS',
  workspaceSubtitle: 'Your personal operating system for sales, content, and growth.',
  profile: {
    displayName: 'Gelo',
    role: 'Founder / Operator',
    company: 'Prime',
    avatarInitials: 'GV',
    email: '',
    mainFocus: 'Sales, Content, and Growth',
  },
  modules: [
    { id: 'today',          label: 'Today',              icon: '🏠', visible: true,  order: 1, description: 'Daily priority actions',                               sheetTab: '' },
    { id: 'calendar',       label: 'Calendar',           icon: '📅', visible: true,  order: 2, description: 'Calls, follow-ups, and scheduled tasks',               sheetTab: 'Calendar' },
    { id: 'leads',          label: 'Leads',              icon: '👤', visible: true,  order: 3, description: 'All prospects and leads',                              sheetTab: 'LinkedIn_Leads' },
    { id: 'messages',       label: 'Messages',           icon: '💬', visible: true,  order: 4, description: 'Message templates and generator',                       sheetTab: '' },
    { id: 'salesPipeline',  label: 'Sales Pipeline',     icon: '💼', visible: true,  order: 5, description: 'Deals and sales stages',                              sheetTab: 'Prime_Pipeline' },
    { id: 'brandCommunity', label: 'Brand / Community',  icon: '🌿', visible: true,  order: 6, description: 'Manage your brand, community, or apparel-related work.', sheetTab: 'SCC_Content' },
    { id: 'productsOrders', label: 'Products / Orders',  icon: '📦', visible: true,  order: 7, description: 'Manage product leads, orders, and customer follow-ups.', sheetTab: 'Calmera_Orders' },
    { id: 'content',        label: 'Content',            icon: '📝', visible: true,  order: 8, description: 'Content ideas and repurposing',                        sheetTab: 'Repurpose_Outputs' },
    { id: 'settings',       label: 'Settings',           icon: '⚙️', visible: true,  order: 9, description: 'Customize your workspace',                            sheetTab: '' },
  ],
  categories: [
    { id: 'consulting',     label: 'Consulting',         color: '#6366f1', description: 'Consulting and sales prospects' },
    { id: 'brandCommunity', label: 'Brand / Community',  color: '#10b981', description: 'Community, apparel, or brand-related work' },
    { id: 'productsOrders', label: 'Products / Orders',  color: '#3b82f6', description: 'Product leads, orders, and customer follow-ups' },
    { id: 'content',        label: 'Content',            color: '#f59e0b', description: 'Content and video services' },
    { id: 'personalBrand',  label: 'Personal Brand',     color: '#ec4899', description: 'Personal brand content and opportunities' },
    { id: 'referral',       label: 'Referral',           color: '#eab308', description: 'Referral partners and introductions' },
  ],
  sheets: {
    spreadsheetUrl: '',
    webAppUrl: '',
    tabMappings: {
      leads:          'LinkedIn_Leads',
      salesPipeline:  'Prime_Pipeline',
      brandCommunity: 'SCC_Content',
      productsOrders: 'Calmera_Orders',
      content:        'Repurpose_Outputs',
      calendar:       'Calendar',
      contacts:       'Contacts',
      organizations:  'Organizations',
    },
  },
  appearance: {
    theme: 'dark',
  },
};

// ── Settings Engine Class ────────────────────────────────────
class SettingsEngine {
  constructor() {
    this._cache = null;
  }

  // Load from localStorage (with deep merge against defaults for new keys)
  get() {
    if (this._cache) return this._cache;
    try {
      const raw = localStorage.getItem(SETTINGS_VERSION);
      if (raw) {
        const parsed = JSON.parse(raw);
        this._cache = this._deepMerge(DEFAULT_SETTINGS, parsed);
        // Ensure all default modules exist (handles upgrades)
        DEFAULT_SETTINGS.modules.forEach(defMod => {
          if (!this._cache.modules.find(m => m.id === defMod.id)) {
            this._cache.modules.push({ ...defMod });
          }
        });
        DEFAULT_SETTINGS.categories.forEach(defCat => {
          if (!this._cache.categories.find(c => c.id === defCat.id)) {
            this._cache.categories.push({ ...defCat });
          }
        });
      } else {
        this._cache = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
      }
    } catch (e) {
      console.warn('[SettingsEngine] Load failed, using defaults:', e);
      this._cache = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    }
    return this._cache;
  }

  // Persist to localStorage
  save(data) {
    this._cache = data;
    try {
      localStorage.setItem(SETTINGS_VERSION, JSON.stringify(data));
    } catch (e) {
      console.error('[SettingsEngine] Save failed:', e);
    }
  }

  // Partial update helper
  update(partialUpdate) {
    const current = this.get();
    const updated = this._deepMerge(current, partialUpdate);
    this.save(updated);
    return updated;
  }

  // ── Module Helpers ─────────────────────────────────────────
  getVisibleModules() {
    return this.get().modules
      .filter(m => m.visible)
      .sort((a, b) => a.order - b.order);
  }

  getModule(id) {
    return this.get().modules.find(m => m.id === id) || null;
  }

  getModuleLabel(id) {
    const mod = this.getModule(id);
    return mod ? mod.label : id;
  }

  getModuleIcon(id) {
    const mod = this.getModule(id);
    return mod ? mod.icon : '📄';
  }

  // ── Category Helpers ───────────────────────────────────────
  getAllCategories() {
    return this.get().categories;
  }

  getCategory(id) {
    return this.get().categories.find(c => c.id === id) || null;
  }

  getCategoryLabel(id) {
    const cat = this.getCategory(id);
    return cat ? cat.label : id;
  }

  getCategoryOptions() {
    return this.get().categories.map(c =>
      `<option value="${c.id}">${c.label}</option>`
    ).join('');
  }

  getCategoryLabelsArray() {
    return this.get().categories.map(c => c.label);
  }

  // ── Sheets Helpers ─────────────────────────────────────────
  getTabName(moduleId) {
    const settings = this.get();
    return (settings.sheets.tabMappings && settings.sheets.tabMappings[moduleId]) || '';
  }

  getWebAppUrl() {
    // Prefer settings-stored URL, fall back to SHEETS_CONFIG
    const settings = this.get();
    if (settings.sheets.webAppUrl) return settings.sheets.webAppUrl;
    if (typeof SHEETS_CONFIG !== 'undefined') return SHEETS_CONFIG.WEBAPP_URL;
    return '';
  }

  // ── Profile Helpers ────────────────────────────────────────
  getProfile() {
    return this.get().profile;
  }

  getDisplayName() {
    return this.get().profile.displayName || 'Gelo';
  }

  getAvatarInitials() {
    return this.get().profile.avatarInitials || 'GV';
  }

  // ── Appearance ─────────────────────────────────────────────
  getTheme() {
    return this.get().appearance?.theme || 'dark';
  }

  applyTheme(theme) {
    const t = theme || this.getTheme();
    document.documentElement.setAttribute('data-theme', t);
    // Update stored theme
    if (theme) {
      const settings = this.get();
      settings.appearance.theme = theme;
      this.save(settings);
    }
  }

  toggleTheme() {
    const current = this.getTheme();
    const next = current === 'dark' ? 'light' : 'dark';
    this.applyTheme(next);
    return next;
  }

  // ── App Name ───────────────────────────────────────────────
  getAppName() {
    return this.get().appName || 'Gelo Growth OS';
  }

  getWorkspaceName() {
    return this.get().workspaceName || 'Growth OS';
  }

  // ── Deep Merge Utility ─────────────────────────────────────
  _deepMerge(target, source) {
    const result = Object.assign({}, target);
    for (const key in source) {
      if (
        source[key] !== null &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key])
      ) {
        result[key] = this._deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }

  // ── Reset ──────────────────────────────────────────────────
  reset() {
    this._cache = null;
    localStorage.removeItem(SETTINGS_VERSION);
  }
}

// Singleton instance
const settingsEngine = new SettingsEngine();

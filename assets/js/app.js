// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
    baseSizes: {
        '1u': { height: 10.5, width: 34.5, label: '1 Unit' },
        '2u': { height: 10.5, width: 76.5, label: '2 Units' },
        '3u': { height: 10.5, width: 118.5, label: '3 Units' }
    },
    leftLayouts: {
        '0': { label: 'None', hint: 'No icon', iconKey: 'none', iconCount: 0 },
        '1': { label: '1 Icon', hint: 'Single icon', iconKey: 'single', iconCount: 1 },
        '2h': { label: '2 Side', hint: 'Left + right', iconKey: 'double-side', iconCount: 2, arrangement: 'side' },
        '2v': { label: '2 Stack', hint: 'Top + bottom', iconKey: 'double-stack', iconCount: 2, arrangement: 'stacked' },
        '2t': { label: '2 Top', hint: 'Icons above text', iconKey: 'top', iconCount: 2, arrangement: 'top' }
    },
    rightLayouts: {
        '0': { label: 'None', hint: 'No text', iconKey: 'none', textCount: 0 },
        '1': { label: '1 Line', hint: 'Single text line', iconKey: 'line-1', textCount: 1 },
        '2': { label: '2 Lines', hint: 'Two text lines', iconKey: 'line-2', textCount: 2 }
    },
    iconsBasePath: 'icons/' // Base path for icon files (served from Icons_SVG)
};

// Icon file list - naming convention: category_subcategory_name.png
// Example: electrical_connector_jst.png -> Electrical > Connector > jst
// Files are stored flat in the Icons/ folder, loaded from backend API
let ICONS_FILES = [];
let ICONS_CACHE_TOKEN = String(Date.now());

// Build hierarchical structure from flat file list
// Supports both 2-part (category_name) and 3-part (category_subcategory_name) naming
function buildIconTree(files) {
    const tree = {};

    files.forEach(filename => {
        // Remove .svg extension and split by underscore
        const baseName = filename.replace(/\.svg$/i, '');
        const parts = baseName.split('_');

        let category, subcategory, name;

        if (parts.length === 2) {
            // 2-part: category_name → Category > General > name
            category = capitalize(parts[0]);
            subcategory = 'General';
            name = parts[1];
        } else if (parts.length >= 3) {
            // 3+ parts: category_subcategory_name → Category > Subcategory > name
            category = capitalize(parts[0]);
            subcategory = capitalize(parts[1]);
            name = parts.slice(2).join('-'); // Join remaining parts with dash
        } else {
            // Skip files that don't match naming convention
            return;
        }

        // Initialize category if not exists
        if (!tree[category]) {
            tree[category] = {};
        }

        // Initialize subcategory if not exists
        if (!tree[category][subcategory]) {
            tree[category][subcategory] = [];
        }

        // Add icon to subcategory (SVG only)
        tree[category][subcategory].push({
            name: name,
            displayName: formatDisplayName(name),
            filename: filename,
            svg: filename
        });
    });

    // Sort subcategories and icons within each
    for (const category of Object.keys(tree)) {
        for (const subcategory of Object.keys(tree[category])) {
            tree[category][subcategory].sort((a, b) =>
                a.displayName.localeCompare(b.displayName)
            );
        }
    }

    return tree;
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function formatDisplayName(name) {
    // Convert underscores and dashes to spaces, then title case
    return name
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}

// Build the icon tree from files (will be populated by scanner or localStorage)
let ICONS_DATA = buildIconTree(ICONS_FILES);

// ============================================
// STATE
// ============================================
let state = {
    tags: [],
    editingId: null,
    currentSize: '1u',
    leftLayout: '1',
    rightLayout: '1',
    icons: [null, null], // Up to 2 icons
    texts: ['', ''], // Up to 2 text lines
    textAlign: 'center', // left or center
    textSize: 100, // percentage of available space (10-100)
    iconSize: 100, // percentage of available space (10-100)
    selectedZone: null // {type:'icon', index:0}, {type:'text', index:0}, or null
};

const TAG_LONG_PRESS_MS = 550;
let _tagPreviewPressTimer = null;
let _tagPreviewPressTriggered = false;
let _tagPreviewPressTagId = null;
let _jsonExportText = '';
let _jsonExportFilename = '';
let _zoneEditSnapshot = null;
let _zoneEditDirty = false;
let _singleExportBusy = false;
let _batchExportBusy = false;
let _batchExportStatus = { message: '', tone: 'info' };
let _batchExportFormatSelection = '3mf';

// ============================================
// LOCAL STORAGE
// ============================================
const STORAGE_KEY = 'infinitygrid_tags';
const PREVIEW_SCHEMA_VERSION = 4;

function loadFromStorage() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) {
            state.tags = JSON.parse(data);
        }
    } catch (e) {
        console.error('Failed to load from localStorage:', e);
        state.tags = [];
    }
}

function saveToStorage() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tags));
    } catch (e) {
        console.error('Failed to save to localStorage:', e);
    }
}

// Generate SVG previews for tags that don't have one (e.g. loaded from old storage)
async function generateMissingPreviews() {
    let changed = false;
    for (const tag of state.tags) {
        if (!tag.preview || tag.previewVersion !== PREVIEW_SCHEMA_VERSION) {
            try {
                const svgString = await generateSVGString(tag);
                tag.preview = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
                tag.previewVersion = PREVIEW_SCHEMA_VERSION;
                changed = true;
                // Update the img in the DOM immediately
                const img = document.querySelector(`img[data-tag-id="${tag.id}"]`);
                if (img) img.src = tag.preview;
            } catch (e) {
                console.error('Preview generation failed for tag:', tag.id, e);
            }
        }
    }
    if (changed) saveToStorage();
}

// ============================================
// BACKEND API
// ============================================

// Fetch icons list from backend
async function fetchIconsFromBackend() {
    try {
        const response = await fetch('/api/icons', { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        ICONS_CACHE_TOKEN = data && data.version ? String(data.version) : String(Date.now());

        // Filter valid SVG files (must have underscores for category_subcategory_name format)
        ICONS_FILES = (data.files || []).filter(f =>
            f.toLowerCase().endsWith('.svg') && f.includes('_')
        );

        // Rebuild icon tree
        rebuildIconTree();

        // Update UI if editor is open
        if (document.getElementById('editorModal').classList.contains('active')) {
            renderZoneEditor();
        }

        return true;
    } catch (e) {
        console.error('Failed to fetch icons from backend:', e);
        return false;
    }
}

// Refresh icons from backend
async function refreshIcons() {
    const success = await fetchIconsFromBackend();
    if (success) {
        console.log(`Loaded ${ICONS_FILES.length} icons`);
    } else {
        alert('Failed to load icons.\n\nMake sure the server is running:\npython server.py');
    }
}

// Rebuild ICONS_DATA from ICONS_FILES
function rebuildIconTree() {
    const tree = buildIconTree(ICONS_FILES);
    // Update the global ICONS_DATA
    Object.keys(ICONS_DATA).forEach(key => delete ICONS_DATA[key]);
    Object.assign(ICONS_DATA, tree);
    // Update icon count display
    updateIconCount();
}

// Update icon count in header
function updateIconCount() {
    const countEl = document.getElementById('iconCount');
    if (countEl) {
        countEl.textContent = ICONS_FILES.length > 0 ? `${ICONS_FILES.length} icons` : '';
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function getAspectRatio(sizeKey) {
    const size = CONFIG.baseSizes[sizeKey];
    return `${size.width} / ${size.height}`;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function generateTagName() {
    const parts = [];
    const leftConfig = CONFIG.leftLayouts[state.leftLayout];
    const rightConfig = CONFIG.rightLayouts[state.rightLayout];

    // Add icon names (use display-friendly format)
    for (let i = 0; i < leftConfig.iconCount; i++) {
        if (state.icons[i]) {
            // Convert name like "jst-xh" to "JST XH"
            const displayName = state.icons[i].name.replace(/-/g, ' ').toUpperCase();
            parts.push(displayName);
        }
    }

    // Add text content
    for (let i = 0; i < rightConfig.textCount; i++) {
        if (state.texts[i] && state.texts[i].trim()) {
            parts.push(state.texts[i].trim());
        }
    }

    return parts.length > 0 ? parts.join(' - ') : 'Untitled';
}

function getIconPath(icon) {
    const filename = icon.filename || icon.svg;
    return buildIconUrl(filename);
}

function buildIconUrl(filename, bustCache = false) {
    const clean = String(filename || '').replace(/^\/+/, '');
    let url = CONFIG.iconsBasePath + clean;
    if (bustCache) {
        const sep = url.includes('?') ? '&' : '?';
        url += `${sep}v=${encodeURIComponent(ICONS_CACHE_TOKEN)}`;
    }
    return url;
}

function getIconDisplayName(icon) {
    if (!icon) return '?';
    return icon.name.replace(/-/g, ' ').toUpperCase();
}

function getSelectedExportStyle() {
    const select = document.getElementById('exportStyleSelect');
    const value = select ? String(select.value || '').toLowerCase() : 'flush';
    return value === 'raised' ? 'raised' : 'flush';
}

function getSelectedBatchExportFormat() {
    const select = document.getElementById('batchExportFormat');
    const value = select ? String(select.value || '').toLowerCase() : _batchExportFormatSelection;
    if (value === 'step' || value === 'svg' || value === '3mf') {
        _batchExportFormatSelection = value;
        return value;
    }
    return _batchExportFormatSelection;
}

function rememberBatchExportFormat(value) {
    const normalized = String(value || '').toLowerCase();
    if (normalized === 'step' || normalized === 'svg' || normalized === '3mf') {
        _batchExportFormatSelection = normalized;
    }
}

function setSingleExportStatus(message = '', tone = 'info') {
    const statusEl = document.getElementById('singleExportStatus');
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.classList.toggle('visible', Boolean(message));
    statusEl.classList.toggle('is-error', tone === 'error');
    statusEl.classList.toggle('is-success', tone === 'success');
}

function setSingleExportBusyState(isBusy, message = '') {
    _singleExportBusy = Boolean(isBusy);

    const btn = document.getElementById('downloadExportBtn');
    if (btn) {
        btn.disabled = _singleExportBusy;
        btn.textContent = _singleExportBusy ? 'Working...' : 'Download';
        btn.classList.toggle('is-busy', _singleExportBusy);
    }

    const formatSelect = document.getElementById('exportFormatSelect');
    if (formatSelect) formatSelect.disabled = _singleExportBusy;

    const styleSelect = document.getElementById('exportStyleSelect');
    if (styleSelect) styleSelect.disabled = _singleExportBusy;

    if (message) {
        setSingleExportStatus(message, 'info');
    }
}

function syncBatchExportControls() {
    const btn = document.getElementById('exportAllBtn');
    const select = document.getElementById('batchExportFormat');
    const hasTags = state.tags.length > 0;

    if (btn) {
        btn.disabled = _batchExportBusy || !hasTags;
        btn.textContent = _batchExportBusy ? 'Working...' : 'Batch Export';
        btn.classList.toggle('is-busy', _batchExportBusy);
    }

    if (select) {
        select.disabled = _batchExportBusy || !hasTags;
    }

    const statusEl = document.getElementById('batchExportStatus');
    if (statusEl) {
        statusEl.textContent = _batchExportStatus.message || '';
        statusEl.classList.toggle('visible', Boolean(_batchExportStatus.message));
        statusEl.classList.toggle('is-error', _batchExportStatus.tone === 'error');
        statusEl.classList.toggle('is-success', _batchExportStatus.tone === 'success');
    }
}

function setBatchExportStatus(message = '', tone = 'info', isBusy = _batchExportBusy) {
    _batchExportStatus = { message, tone };
    _batchExportBusy = Boolean(isBusy);
    syncBatchExportControls();
}

// ============================================
// RENDERING FUNCTIONS
// ============================================
function renderDashboard() {
    const dashboard = document.getElementById('dashboard');
    const hasTags = state.tags.length > 0;
    const header = `
                <div class="dashboard-header">
                    <h2>Your Tags (${state.tags.length})</h2>
                    <div class="dashboard-tools">
                        <button class="btn btn-secondary btn-sm" onclick="importTagsJSON()" title="Import JSON">Import JSON</button>
                        <button class="btn btn-secondary btn-sm" onclick="exportTagsJSON()" title="Export JSON">Export JSON</button>
                        <div class="batch-export-controls">
                            <label for="batchExportFormat" class="batch-format-label">Format</label>
                            <select id="batchExportFormat" class="form-select batch-format-select" title="Batch export format" onchange="rememberBatchExportFormat(this.value)">
                                <option value="3mf" ${_batchExportFormatSelection === '3mf' ? 'selected' : ''}>3MF</option>
                                <option value="step" ${_batchExportFormatSelection === 'step' ? 'selected' : ''}>STEP</option>
                                <option value="svg" ${_batchExportFormatSelection === 'svg' ? 'selected' : ''}>SVG</option>
                            </select>
                        </div>
                        <button class="btn btn-secondary btn-sm" id="exportAllBtn" onclick="exportAllTags()" title="Batch export selected format" ${hasTags ? '' : 'disabled'}>Export All</button>
                    </div>
                    <div id="batchExportStatus" class="batch-export-status" aria-live="polite"></div>
                </div>
            `;

    if (!hasTags) {
        dashboard.innerHTML = header + `
                    <div class="empty-state">
                        <div class="empty-state-icon">◧</div>
                        <h3>No Tags Created Yet</h3>
                        <p>Click "Add New Tag" to create your first label</p>
                    </div>
                `;
        syncBatchExportControls();
        return;
    }

    const rows = state.tags.map(tag => {
        return `
                <tr data-id="${tag.id}">
                    <td class="table-preview-cell" data-label="Preview">
                        <div class="table-preview table-preview-interactive"
                             onclick="handleTagPreviewClick(event, '${tag.id}')"
                             onpointerdown="startTagPreviewPress(event, '${tag.id}')"
                             onpointerup="endTagPreviewPress()"
                             onpointercancel="cancelTagPreviewPress()"
                             onpointerleave="cancelTagPreviewPress()"
                             oncontextmenu="handleTagPreviewContext(event, '${tag.id}')">
                            <img data-tag-id="${tag.id}" alt="${escapeHtml(tag.name)}" src="${tag.preview || ''}" draggable="false">
                        </div>
                    </td>
                    <td class="table-text-cell" data-label="Name">
                        <div class="tag-name">${escapeHtml(tag.name)}</div>
                        <div class="tag-meta">${CONFIG.baseSizes[tag.size].label}</div>
                    </td>
                    <td class="table-actions-cell" data-label="Actions">
                        <button class="btn btn-icon" onclick="editTag('${tag.id}')" title="Edit">✏️</button>
                        <button class="btn btn-icon" onclick="deleteTag('${tag.id}')" title="Delete">🗑️</button>
                    </td>
                </tr>
                `;
    }).join('');

    dashboard.innerHTML = header + `
                <table class="tags-table">
                    <thead>
                        <tr>
                            <th>Preview</th>
                            <th>Name</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            `;
    syncBatchExportControls();

    // Generate previews for tags that don't have one yet
    generateMissingPreviews();
}

function renderSizeSelector() {
    const container = document.getElementById('sizeSelector');
    const selected = CONFIG.baseSizes[state.currentSize];
    container.innerHTML = `
                <div class="form-group selector-field">
                    <label for="sizeSelect">Tag Size</label>
                    <select id="sizeSelect" class="form-select editor-dropdown" onchange="selectSize(this.value)">
                        ${Object.entries(CONFIG.baseSizes).map(([key, size]) =>
        `<option value="${key}" ${state.currentSize === key ? 'selected' : ''}>${size.label} (${size.width} x ${size.height}mm)</option>`
    ).join('')}
                    </select>
                    <div class="selector-caption">${selected.width} x ${selected.height} mm base</div>
                </div>
            `;
}

function renderLayoutSelectors() {
    const leftContainer = document.getElementById('leftLayoutSelector');
    const rightContainer = document.getElementById('rightLayoutSelector');
    const leftSelected = CONFIG.leftLayouts[state.leftLayout];
    const rightSelected = CONFIG.rightLayouts[state.rightLayout];

    leftContainer.innerHTML = `
                <div class="form-group selector-field">
                    <label for="leftLayoutSelect">Icon Layout</label>
                    <select id="leftLayoutSelect" class="form-select editor-dropdown" onchange="selectLeftLayout(this.value)">
                        ${Object.entries(CONFIG.leftLayouts).map(([key, layout]) =>
        `<option value="${key}" ${state.leftLayout === key ? 'selected' : ''}>${layout.label}</option>`
    ).join('')}
                    </select>
                    <div class="selector-caption">${leftSelected.hint || 'No icon section'}</div>
                </div>
            `;

    rightContainer.innerHTML = `
                <div class="form-group selector-field">
                    <label for="rightLayoutSelect">Text Layout</label>
                    <select id="rightLayoutSelect" class="form-select editor-dropdown" onchange="selectRightLayout(this.value)">
                        ${Object.entries(CONFIG.rightLayouts).map(([key, layout]) =>
        `<option value="${key}" ${state.rightLayout === key ? 'selected' : ''}>${layout.label}</option>`
    ).join('')}
                    </select>
                    <div class="selector-caption">${rightSelected.hint || 'No text section'}</div>
                </div>
            `;
}

function renderZoneEditor() {
    const panel = document.getElementById('slotEditorPanel');
    if (!panel) return;
    const sel = state.selectedZone;

    if (!sel) {
        panel.innerHTML = `<div class="zone-editor-hint">Tap a slot on the preview to edit it</div>`;
        closeSlotEditorModal();
        return;
    }

    if (sel.type === 'icon') {
        renderIconZonePanel(panel, sel.index);
    } else if (sel.type === 'text') {
        renderTextZonePanel(panel, sel.index);
    }
}

function openSlotEditorModal() {
    const modal = document.getElementById('slotEditorModal');
    if (modal) modal.classList.add('active');
}

function closeSlotEditorModal() {
    const modal = document.getElementById('slotEditorModal');
    if (modal) modal.classList.remove('active');
}

function renderIconZonePanel(panel, index) {
    const leftConfig = CONFIG.leftLayouts[state.leftLayout];
    let label = 'Icon';
    if (leftConfig.iconCount === 2) {
        if (leftConfig.arrangement === 'stacked') {
            label = ['Top Icon', 'Bottom Icon'][index];
        } else {
            label = ['Left Icon', 'Right Icon'][index];
        }
    }

    const selectedIcon = state.icons[index];

    // Preserve search query if panel is already showing this zone
    const existingSearch = panel.querySelector('.icon-search .zone-input');
    const searchQuery = existingSearch ? existingSearch.value : '';

    panel.innerHTML = `
                <div class="zone-editor-header">
                    <span class="zone-editor-title">${label}</span>
                    <button class="zone-editor-close" onclick="cancelZoneEdit()" title="Cancel">&times;</button>
                </div>
                <div class="zone-editor-body">
                    <div class="icon-search">
                        <input type="text"
                               class="zone-input"
                               placeholder="Search icons..."
                               value="${escapeHtml(searchQuery)}"
                               oninput="filterIcons(this, ${index})">
                    </div>
                    <div class="treeview" id="treeview-${index}">
                        ${renderTreeview(index)}
                    </div>
                    ${selectedIcon ? `
                        <button class="btn btn-secondary btn-sm icon-clear-btn" onclick="clearIcon(${index})">
                            Clear: ${selectedIcon.name.replace(/-/g, ' ')}
                        </button>
                    ` : ''}
                    <div class="text-size-control">
                        <label>
                            <span>Icon Size</span>
                            <span class="text-size-value" id="iconSizeValue">${state.iconSize}%</span>
                        </label>
                        <input type="range"
                               min="10"
                               max="100"
                               value="${state.iconSize}"
                               oninput="updateIconSize(this.value)">
                    </div>
                </div>
                <div class="zone-editor-actions">
                    <button type="button" class="btn btn-secondary" onclick="cancelZoneEdit()">Cancel</button>
                    <button type="button" class="btn btn-primary" onclick="applyZoneEdit()">Apply</button>
                </div>
            `;

    // Re-apply search filter if there was a query
    if (searchQuery) {
        const searchInput = panel.querySelector('.icon-search .zone-input');
        filterIcons(searchInput, index);
    }
}

function renderTextZonePanel(panel, index) {
    const rightConfig = CONFIG.rightLayouts[state.rightLayout];
    const label = rightConfig.textCount === 1 ? 'Text' : `Line ${index + 1}`;

    panel.innerHTML = `
                <div class="zone-editor-header">
                    <span class="zone-editor-title">${label}</span>
                    <button class="zone-editor-close" onclick="cancelZoneEdit()" title="Cancel">&times;</button>
                </div>
                <div class="zone-editor-body">
                    <div class="zone-item">
                        <input type="text"
                               class="zone-input"
                               id="zoneTextInput"
                               placeholder="Enter text..."
                               value="${escapeHtml(state.texts[index])}"
                               oninput="updateText(${index}, this.value)">
                    </div>
                    <div class="zone-item">
                        <label class="zone-label">Text Align</label>
                        <div class="text-align-toggle">
                            <button type="button"
                                    class="text-align-btn ${state.textAlign === 'left' ? 'active' : ''}"
                                    onclick="updateTextAlign('left')"
                                    title="Align left"
                                    aria-label="Align left">
                                <svg class="text-align-icon" viewBox="0 0 20 14" aria-hidden="true">
                                    <line x1="1.5" y1="2" x2="16.5" y2="2"></line>
                                    <line x1="1.5" y1="7" x2="12.5" y2="7"></line>
                                    <line x1="1.5" y1="12" x2="18.5" y2="12"></line>
                                </svg>
                            </button>
                            <button type="button"
                                    class="text-align-btn ${state.textAlign === 'center' ? 'active' : ''}"
                                    onclick="updateTextAlign('center')"
                                    title="Align center"
                                    aria-label="Align center">
                                <svg class="text-align-icon" viewBox="0 0 20 14" aria-hidden="true">
                                    <line x1="2.5" y1="2" x2="17.5" y2="2"></line>
                                    <line x1="4.5" y1="7" x2="15.5" y2="7"></line>
                                    <line x1="1.5" y1="12" x2="18.5" y2="12"></line>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div class="text-size-control">
                        <label>
                            <span>Text Size</span>
                            <span class="text-size-value" id="textSizeValue">${state.textSize}%</span>
                        </label>
                        <input type="range"
                               min="10"
                               max="100"
                               value="${state.textSize}"
                               oninput="updateTextSize(this.value)">
                    </div>
                </div>
                <div class="zone-editor-actions">
                    <button type="button" class="btn btn-secondary" onclick="cancelZoneEdit()">Cancel</button>
                    <button type="button" class="btn btn-primary" onclick="applyZoneEdit()">Apply</button>
                </div>
            `;

    // Auto-focus the text input
    requestAnimationFrame(() => {
        const input = document.getElementById('zoneTextInput');
        if (input) input.focus();
    });
}

function renderTreeview(zoneIndex) {
    const selectedIcon = state.icons[zoneIndex];

    // Check if there are any icons
    if (Object.keys(ICONS_DATA).length === 0) {
        return `<div class="zone-empty" style="padding: 1rem; text-align: center; color: var(--text-secondary);">
                    No icons found.<br>
                    <small>Add PNG filenames to ICONS_FILES array</small>
                </div>`;
    }

    // Count total icons in a category
    function countCategoryIcons(categoryData) {
        return Object.values(categoryData).reduce((sum, items) => sum + items.length, 0);
    }

    return Object.entries(ICONS_DATA).map(([category, subcategories]) => `
                <div class="treeview-folder treeview-category" data-category="${category}">
                    <div class="treeview-header" onclick="toggleFolder(this.parentElement)">
                        <span class="treeview-arrow">▶</span>
                        <span>${category}</span>
                        <span style="color: var(--text-secondary); font-size: 0.7rem; margin-left: auto;">${countCategoryIcons(subcategories)}</span>
                    </div>
                    <div class="treeview-subcategories">
                        ${Object.entries(subcategories).map(([subcategory, icons]) => `
                            <div class="treeview-folder treeview-subcategory" data-subcategory="${subcategory}">
                                <div class="treeview-header treeview-header-sub" onclick="toggleFolder(this.parentElement); event.stopPropagation();">
                                    <span class="treeview-arrow">▶</span>
                                    <span>${subcategory}</span>
                                    <span style="color: var(--text-secondary); font-size: 0.65rem; margin-left: auto;">${icons.length}</span>
                                </div>
                                <div class="treeview-content">
                                    ${icons.map(icon => `
                                        <div class="treeview-item ${selectedIcon && selectedIcon.filename === icon.filename ? 'selected' : ''}"
                                             data-name="${icon.name}"
                                             data-filename="${icon.filename}"
                                             onclick="selectIcon(${zoneIndex}, '${icon.name}', '${icon.svg}', '${icon.filename}'); event.stopPropagation();">
                                            <div class="treeview-icon-preview">
                                                <img src="${buildIconUrl(icon.svg, true)}" alt="${icon.displayName}" onerror="this.style.display='none'; this.parentElement.innerHTML='<span style=\\'font-size:8px;color:#666;\\'>${icon.displayName}</span>'">
                                            </div>
                                            <span class="treeview-icon-name">${icon.displayName}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('');
}

// Build tagData object from current editor state
function buildTagData() {
    return {
        size: state.currentSize,
        leftLayout: state.leftLayout,
        rightLayout: state.rightLayout,
        icons: [...state.icons],
        texts: [...state.texts],
        textAlign: state.textAlign,
        iconSize: state.iconSize,
        textSize: state.textSize,
        contentColor: state.contentColor,
        backgroundColor: state.backgroundColor
    };
}

// Compute clickable zone positions (percentages) from layout geometry
function computeZonePositions() {
    const size = CONFIG.baseSizes[state.currentSize];
    const W = size.width, H = size.height;
    const leftConfig = CONFIG.leftLayouts[state.leftLayout];
    const rightConfig = CONFIG.rightLayouts[state.rightLayout];
    const iconScale = (state.iconSize || 100) / 100;

    const margin = 0.6, gapIconText = 0.25, gapBetween = 0.6;
    const availH = H - 2 * margin;
    const hasIcons = leftConfig.iconCount > 0;
    const hasText = rightConfig.textCount > 0;
    const isTopLayout = leftConfig.arrangement === 'top' && hasText;
    const zones = [];

    if (isTopLayout) {
        // Top layout: icons top half, text bottom half
        if (hasIcons) {
            for (let i = 0; i < leftConfig.iconCount; i++) {
                zones.push({
                    type: 'icon', index: i,
                    left: (i * 100 / leftConfig.iconCount), top: 0,
                    width: 100 / leftConfig.iconCount, height: 50
                });
            }
        }
        if (hasText) {
            zones.push({ type: 'text', index: 0, left: 0, top: 50, width: 100, height: 50 });
        }
    } else {
        // Horizontal layout — compute icon area width
        let iconEndX = margin;
        if (hasIcons) {
            if (leftConfig.arrangement === 'stacked') {
                const iconSize = (availH - gapBetween) / 2 * iconScale;
                iconEndX = margin + iconSize + gapIconText;
            } else {
                const iconSize = availH * iconScale;
                for (let i = 0; i < leftConfig.iconCount; i++)
                    iconEndX += iconSize + (i < leftConfig.iconCount - 1 ? gapBetween : gapIconText);
            }
            const iconPct = iconEndX / W * 100;
            if (leftConfig.arrangement === 'stacked') {
                for (let i = 0; i < leftConfig.iconCount; i++)
                    zones.push({ type: 'icon', index: i, left: 0, top: i * 50, width: iconPct, height: 50 });
            } else if (leftConfig.iconCount === 1) {
                zones.push({ type: 'icon', index: 0, left: 0, top: 0, width: iconPct, height: 100 });
            } else {
                const half = iconPct / leftConfig.iconCount;
                for (let i = 0; i < leftConfig.iconCount; i++)
                    zones.push({ type: 'icon', index: i, left: i * half, top: 0, width: half, height: 100 });
            }
        }
        if (hasText) {
            const textStartPct = hasIcons ? iconEndX / W * 100 : 0;
            const textWidthPct = 100 - textStartPct;
            if (rightConfig.textCount === 1) {
                zones.push({ type: 'text', index: 0, left: textStartPct, top: 0, width: textWidthPct, height: 100 });
            } else {
                for (let i = 0; i < rightConfig.textCount; i++)
                    zones.push({ type: 'text', index: i, left: textStartPct, top: i * 50, width: textWidthPct, height: 50 });
            }
        }
    }
    return zones;
}

let _renderSeq = 0;
async function renderCanvas() {
    const seq = ++_renderSeq;
    const canvas = document.getElementById('canvas');
    const canvasWrapper = document.getElementById('canvasWrapper');

    // Update aspect ratio and max-width
    canvas.style.aspectRatio = getAspectRatio(state.currentSize);
    const size = CONFIG.baseSizes[state.currentSize];
    canvasWrapper.style.maxWidth = `${size.width * 10}px`;

    // Generate SVG (same pipeline as table preview and export)
    const tagData = buildTagData();
    const svgString = await generateSVGString(tagData);
    if (seq !== _renderSeq) return; // newer render in progress, discard
    const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);

    // Build overlay zones
    const sel = state.selectedZone;
    const zones = computeZonePositions();
    const overlayHtml = zones.map(z => {
        const isSelected = sel && sel.type === z.type && sel.index === z.index;
        const cls = 'canvas-zone' + (isSelected ? ' slot-selected' : '');
        const isEmpty = z.type === 'icon' ? !state.icons[z.index] : !state.texts[z.index];
        const emptyLabel = isEmpty ? (z.type === 'icon' ? '+' : '') : '';
        const emptyCls = isEmpty ? ' canvas-zone-empty' : '';
        return `<div class="${cls}${emptyCls}" style="left:${z.left}%;top:${z.top}%;width:${z.width}%;height:${z.height}%"
                    onclick="selectZone('${z.type}', ${z.index}); event.stopPropagation();">${emptyLabel}</div>`;
    }).join('');

    canvas.innerHTML = `<img src="${dataUrl}"><div class="canvas-overlays">${overlayHtml}</div>`;
    updateAutoName();
}

function updateAutoName() {
    const nameEl = document.getElementById('autoTagName');
    nameEl.textContent = generateTagName();
}

function captureZoneEditSnapshot() {
    return {
        icons: state.icons.map(icon => icon ? { ...icon } : null),
        texts: [...state.texts],
        textAlign: state.textAlign,
        iconSize: state.iconSize,
        textSize: state.textSize
    };
}

function restoreZoneEditSnapshot(snapshot) {
    state.icons = snapshot.icons.map(icon => icon ? { ...icon } : null);
    state.texts = [...snapshot.texts];
    state.textAlign = snapshot.textAlign;
    state.iconSize = snapshot.iconSize;
    state.textSize = snapshot.textSize;
}

function beginZoneEditSession() {
    _zoneEditSnapshot = captureZoneEditSnapshot();
    _zoneEditDirty = false;
}

function clearZoneEditSession() {
    _zoneEditSnapshot = null;
    _zoneEditDirty = false;
}

function markZoneEditDirty() {
    if (_zoneEditSnapshot) {
        _zoneEditDirty = true;
    }
}

// ============================================
// EVENT HANDLERS
// ============================================
function selectZone(type, index) {
    // Validate zone exists in current layout
    if (type === 'icon') {
        const iconCount = CONFIG.leftLayouts[state.leftLayout].iconCount;
        if (index >= iconCount) return;
    } else if (type === 'text') {
        const textCount = CONFIG.rightLayouts[state.rightLayout].textCount;
        if (index >= textCount) return;
    }

    const current = state.selectedZone;
    if (current && current.type === type && current.index === index) {
        openSlotEditorModal();
        return;
    }

    if (current) {
        // Keep in-progress values when switching zones, then start a fresh snapshot.
        clearZoneEditSession();
    }

    state.selectedZone = { type, index };
    beginZoneEditSession();
    renderCanvas();
    renderZoneEditor();
    openSlotEditorModal();
}

function deselectZone() {
    clearZoneEditSession();
    state.selectedZone = null;
    renderCanvas();
    renderZoneEditor();
}

function applyZoneEdit() {
    clearZoneEditSession();
    state.selectedZone = null;
    renderCanvas();
    renderZoneEditor();
}

function cancelZoneEdit() {
    if (_zoneEditSnapshot && _zoneEditDirty) {
        restoreZoneEditSnapshot(_zoneEditSnapshot);
    }
    clearZoneEditSession();
    state.selectedZone = null;
    renderCanvas();
    renderZoneEditor();
}

function openEditor(tagId = null) {
    state.editingId = tagId;
    state.selectedZone = null;
    clearZoneEditSession();
    setSingleExportBusyState(false);
    setSingleExportStatus('');

    if (tagId) {
        // Load existing tag
        const tag = state.tags.find(t => t.id === tagId);
        if (tag) {
            state.currentSize = tag.size;
            state.leftLayout = tag.leftLayout;
            state.rightLayout = tag.rightLayout;
            state.icons = [...tag.icons];
            state.texts = [...tag.texts];
            state.textAlign = tag.textAlign === 'left' ? 'left' : 'center';
            state.iconSize = tag.iconSize != null ? tag.iconSize : 100;
            state.textSize = tag.textSize != null ? tag.textSize : 100;
            document.getElementById('modalTitle').textContent = 'Edit Tag';
        }
    } else {
        // New tag defaults
        state.currentSize = '1u';
        state.leftLayout = '1';
        state.rightLayout = '1';
        state.icons = [null, null];
        state.texts = ['', ''];
        state.textAlign = 'center';
        state.iconSize = 100;
        state.textSize = 100;
        document.getElementById('modalTitle').textContent = 'Create New Tag';
        const exportFormatSelect = document.getElementById('exportFormatSelect');
        if (exportFormatSelect) exportFormatSelect.value = '3mf';
        const exportStyleSelect = document.getElementById('exportStyleSelect');
        if (exportStyleSelect) exportStyleSelect.value = 'flush';
    }

    renderSizeSelector();
    renderLayoutSelectors();
    renderZoneEditor();
    renderCanvas();

    document.getElementById('editorModal').classList.add('active');
}

function closeEditor() {
    document.getElementById('editorModal').classList.remove('active');
    state.selectedZone = null;
    clearZoneEditSession();
    closeSlotEditorModal();
    state.editingId = null;
    setSingleExportBusyState(false);
    setSingleExportStatus('');
}

function selectSize(sizeKey) {
    if (!CONFIG.baseSizes[sizeKey]) return;
    state.currentSize = sizeKey;
    renderSizeSelector();
    renderCanvas();
}

function selectLeftLayout(layoutKey) {
    if (!CONFIG.leftLayouts[layoutKey]) return;
    state.leftLayout = layoutKey;
    // Clear icons that exceed the new count
    const iconCount = CONFIG.leftLayouts[layoutKey].iconCount;
    for (let i = iconCount; i < state.icons.length; i++) {
        state.icons[i] = null;
    }
    // Clear selectedZone if icon slot no longer exists
    if (state.selectedZone && state.selectedZone.type === 'icon' && state.selectedZone.index >= iconCount) {
        state.selectedZone = null;
        clearZoneEditSession();
    }
    renderLayoutSelectors();
    renderZoneEditor();
    renderCanvas();
}

function selectRightLayout(layoutKey) {
    if (!CONFIG.rightLayouts[layoutKey]) return;
    state.rightLayout = layoutKey;
    // Clear texts that exceed the new count
    const textCount = CONFIG.rightLayouts[layoutKey].textCount;
    for (let i = textCount; i < state.texts.length; i++) {
        state.texts[i] = '';
    }
    // Clear selectedZone if text slot no longer exists
    if (state.selectedZone && state.selectedZone.type === 'text' && state.selectedZone.index >= textCount) {
        state.selectedZone = null;
        clearZoneEditSession();
    }
    renderLayoutSelectors();
    renderZoneEditor();
    renderCanvas();
}

function updateText(index, value) {
    if (state.texts[index] === value) return;
    state.texts[index] = value;
    markZoneEditDirty();
    renderCanvas();
}

function updateIconSize(value) {
    const nextSize = parseInt(value, 10);
    if (Number.isNaN(nextSize) || state.iconSize === nextSize) return;
    state.iconSize = nextSize;
    markZoneEditDirty();
    const label = document.getElementById('iconSizeValue');
    if (label) label.textContent = `${state.iconSize}%`;
    renderCanvas();
}

function updateTextSize(value) {
    const nextSize = parseInt(value, 10);
    if (Number.isNaN(nextSize) || state.textSize === nextSize) return;
    state.textSize = nextSize;
    markZoneEditDirty();
    const label = document.getElementById('textSizeValue');
    if (label) label.textContent = `${state.textSize}%`;
    renderCanvas();
}

function updateTextAlign(value) {
    const nextAlign = value === 'left' ? 'left' : 'center';
    if (state.textAlign === nextAlign) return;
    state.textAlign = nextAlign;
    markZoneEditDirty();
    renderCanvas();
    if (state.selectedZone && state.selectedZone.type === 'text') {
        renderZoneEditor();
    }
}

function toggleFolder(folderElement) {
    folderElement.classList.toggle('open');
}

function selectIcon(zoneIndex, name, svg, filename) {
    const current = state.icons[zoneIndex];
    if (current && current.filename === filename && current.name === name && current.svg === svg) {
        return;
    }
    state.icons[zoneIndex] = { name, svg, filename };
    markZoneEditDirty();
    renderCanvas();
    renderZoneEditor();
}

function clearIcon(index) {
    if (!state.icons[index]) return;
    state.icons[index] = null;
    markZoneEditDirty();
    renderCanvas();
    renderZoneEditor();
}

function filterIcons(input, zoneIndex) {
    const query = input.value.toLowerCase();
    const treeview = document.getElementById(`treeview-${zoneIndex}`);

    treeview.querySelectorAll('.treeview-category').forEach(category => {
        let categoryHasMatch = false;

        category.querySelectorAll('.treeview-subcategory').forEach(subcategory => {
            let subcategoryHasMatch = false;

            subcategory.querySelectorAll('.treeview-item').forEach(item => {
                const itemName = item.dataset.name.toLowerCase();
                const filename = item.dataset.filename.toLowerCase();
                const matches = itemName.includes(query) || filename.includes(query);
                item.style.display = matches ? '' : 'none';
                if (matches) {
                    subcategoryHasMatch = true;
                    categoryHasMatch = true;
                }
            });

            subcategory.style.display = subcategoryHasMatch ? '' : 'none';
            if (subcategoryHasMatch && query) {
                subcategory.classList.add('open');
            }
        });

        category.style.display = categoryHasMatch ? '' : 'none';
        if (categoryHasMatch && query) {
            category.classList.add('open');
        }
    });
}

async function saveTag(closeAfterSave = true) {
    const name = generateTagName();

    if (name === 'Untitled') {
        alert('Please add at least one icon or text to create a tag');
        return false;
    }

    const tagData = {
        id: state.editingId || generateId(),
        name: name,
        size: state.currentSize,
        leftLayout: state.leftLayout,
        rightLayout: state.rightLayout,
        icons: [...state.icons],
        texts: [...state.texts],
        textAlign: state.textAlign,
        iconSize: state.iconSize,
        textSize: state.textSize,
        contentColor: state.contentColor,
        backgroundColor: state.backgroundColor,
        updatedAt: Date.now()
    };

    // Generate SVG preview image
    try {
        const svgString = await generateSVGString(tagData);
        tagData.preview = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
        tagData.previewVersion = PREVIEW_SCHEMA_VERSION;
    } catch (e) {
        console.error('Failed to generate preview:', e);
    }

    if (state.editingId) {
        // Update existing
        const index = state.tags.findIndex(t => t.id === state.editingId);
        if (index !== -1) {
            state.tags[index] = tagData;
        }
    } else {
        // Add new
        tagData.createdAt = Date.now();
        state.tags.unshift(tagData);
    }

    saveToStorage();
    renderDashboard();
    if (closeAfterSave) {
        closeEditor();
    }
    return true;
}

async function saveAndNew() {
    const saved = await saveTag(false);
    if (!saved) return;

    // Stay in the form and keep the current content as a template for the next tag
    state.editingId = null;
    document.getElementById('modalTitle').textContent = 'Create New Tag';
}

function sanitizeFileName(name) {
    return (name || 'tag').replace(/[^a-zA-Z0-9]/g, '_');
}

function triggerBlobDownload(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    // Use RAF so the element is in DOM before click dispatch (more reliable on some browsers).
    requestAnimationFrame(() => {
        a.click();
        document.body.removeChild(a);
    });
    // Keep URL alive long enough for browsers that start reading asynchronously.
    setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function buildCurrentTagForExport() {
    return {
        name: generateTagName(),
        ...buildTagData()
    };
}

function getSelectedExportFormat() {
    const select = document.getElementById('exportFormatSelect');
    const value = select ? String(select.value || '').toLowerCase() : '3mf';
    if (value === 'step' || value === 'svg' || value === '3mf') {
        return value;
    }
    return '3mf';
}

function getSelectedSTEPGeometryMode() {
    const select = document.getElementById('exportGeometrySelect');
    const value = select ? String(select.value || '').toLowerCase() : 'compat';
    return value === 'vector' ? 'vector' : 'compat';
}

async function downloadCurrentExport() {
    if (_singleExportBusy) return;

    const format = getSelectedExportFormat();
    const styleVal = getSelectedExportStyle();
    try {
        const tagData = buildCurrentTagForExport();
        const upperFormat = format.toUpperCase();
        setSingleExportBusyState(true, `Preparing ${upperFormat} download... this can take a little while.`);

        if (format === 'svg') {
            await downloadTagSVG(tagData);
        } else if (format === '3mf') {
            await downloadTag3MF(tagData, styleVal);
        } else {
            await downloadTagSTEP(tagData, styleVal);
        }

        setSingleExportStatus(`${upperFormat} download started.`, 'success');
        setTimeout(() => {
            if (!_singleExportBusy) setSingleExportStatus('');
        }, 2200);
    } catch (err) {
        console.error('Export failed:', err);
        const isTimeout = err && err.name === 'AbortError';
        const formatLabel = format === '3mf' ? '3MF' : format.toUpperCase();
        const msg = isTimeout
            ? `${formatLabel} export timed out after 90 seconds.`
            : `Failed to export ${formatLabel}: ${err && err.message ? err.message : 'Unknown error'}`;
        setSingleExportStatus(msg, 'error');
        alert(msg);
    } finally {
        setSingleExportBusyState(false);
    }
}

// ============================================
// CONTOUR EXTRACTION FOR STEP EXPORT
// ============================================

async function svgToImageData(svgString, widthMM, heightMM, pxPerMM) {
    return new Promise((resolve, reject) => {
        const widthPx = widthMM * pxPerMM;
        const heightPx = heightMM * pxPerMM;

        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = widthPx;
            canvas.height = heightPx;
            const ctx = canvas.getContext('2d');

            // Draw white background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, widthPx, heightPx);

            // Draw the SVG text and icons (assuming they are black)
            ctx.drawImage(img, 0, 0, widthPx, heightPx);

            const imageData = ctx.getImageData(0, 0, widthPx, heightPx);
            resolve(imageData);
        };
        img.onerror = (e) => reject(new Error('Failed to load SVG into Image for contour extraction'));
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
    });
}

function rasterRunsToRects(imageData) {
    const { width, height, data } = imageData;
    const active = new Map();
    const rects = [];

    function finalizeInactive(nextKeys) {
        for (const [key, r] of active.entries()) {
            if (!nextKeys.has(key)) {
                rects.push(r);
                active.delete(key);
            }
        }
    }

    for (let y = 0; y < height; y++) {
        const runs = [];
        let x = 0;
        while (x < width) {
            const idx = (y * width + x) * 4;
            const solid = (data[idx] < 140 && data[idx + 3] > 140);
            if (!solid) {
                x++;
                continue;
            }
            const x0 = x;
            x++;
            while (x < width) {
                const i2 = (y * width + x) * 4;
                const s2 = (data[i2] < 140 && data[i2 + 3] > 140);
                if (!s2) break;
                x++;
            }
            runs.push([x0, x - 1]);
        }

        const nextKeys = new Set();
        for (const [x0, x1] of runs) {
            const key = `${x0}:${x1}`;
            nextKeys.add(key);
            const existing = active.get(key);
            if (existing) {
                existing.h += 1;
            } else {
                active.set(key, { x: x0, y, w: x1 - x0 + 1, h: 1 });
            }
        }
        finalizeInactive(nextKeys);
    }

    for (const r of active.values()) rects.push(r);
    return rects;
}

async function generateContourSVGString(tagData) {
    const contentSvgString = await generateSVGString(tagData, true);
    const size = CONFIG.baseSizes[tagData.size];
    const widthMM = size.width;
    const heightMM = size.height;
    // Higher raster density improves icon/text edge quality for STEP export.
    // Keep bounded to avoid pathological payloads.
    const pxPerMM = 28;

    const imageData = await svgToImageData(contentSvgString, widthMM, heightMM, pxPerMM);
    const rects = rasterRunsToRects(imageData);
    if (rects.length === 0) {
        throw new Error('No visible content to export');
    }
    if (rects.length > 18000) {
        throw new Error(`Contour too complex (${rects.length} regions). Reduce icon/text complexity.`);
    }

    let svgContent = "";
    for (const r of rects) {
        const x0 = (r.x / pxPerMM).toFixed(3);
        const y0 = (r.y / pxPerMM).toFixed(3);
        const x1 = ((r.x + r.w) / pxPerMM).toFixed(3);
        const y1 = ((r.y + r.h) / pxPerMM).toFixed(3);
        svgContent += `<path fill="black" d="M ${x0} ${y0} L ${x1} ${y0} L ${x1} ${y1} L ${x0} ${y1} Z" />\n`;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${widthMM}mm" height="${heightMM}mm" viewBox="0 0 ${widthMM} ${heightMM}">
                ${svgContent}
            </svg>`;
}

async function requestSTEPBlob(svgString, size, styleVal) {
    const formData = new FormData();
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
    formData.append('svg_file', svgBlob, 'label.svg');
    formData.append('width', size.width);
    formData.append('height', size.height);
    formData.append('style', styleVal);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);
    let response;
    try {
        response = await fetch('/api/export_step', {
            method: 'POST',
            body: formData,
            signal: controller.signal
        });
    } finally {
        clearTimeout(timeoutId);
    }

    if (!response.ok) {
        const err = await response.text();
        throw new Error(err);
    }
    return await response.blob();
}

async function request3MFBlob(svgString, size, styleVal) {
    const formData = new FormData();
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
    formData.append('svg_file', svgBlob, 'label.svg');
    formData.append('width', size.width);
    formData.append('height', size.height);
    formData.append('style', styleVal);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);
    let response;
    try {
        response = await fetch('/api/export_3mf', {
            method: 'POST',
            body: formData,
            signal: controller.signal
        });
    } finally {
        clearTimeout(timeoutId);
    }

    if (!response.ok) {
        const err = await response.text();
        throw new Error(err);
    }
    return await response.blob();
}

async function buildSTEPBlobWithFallback(tagData, size, styleVal, preferredMode) {
    const attempts = preferredMode === 'vector'
        ? ['vector', 'compat']
        : ['compat', 'vector'];
    const errors = [];

    for (const mode of attempts) {
        try {
            if (mode === 'vector') {
                const vectorSvg = await generateSVGString(tagData, true);
                return await requestSTEPBlob(vectorSvg, size, styleVal);
            }
            const compatSvg = await generateContourSVGString(tagData);
            return await requestSTEPBlob(compatSvg, size, styleVal);
        } catch (err) {
            errors.push(`${mode}: ${err && err.message ? err.message : String(err)}`);
        }
    }

    throw new Error(`All STEP geometry modes failed. ${errors.join(' | ')}`);
}

async function build3MFBlobWithFallback(tagData, size, styleVal, preferredMode) {
    const attempts = preferredMode === 'vector'
        ? ['vector', 'compat']
        : ['compat', 'vector'];
    const errors = [];

    for (const mode of attempts) {
        try {
            if (mode === 'vector') {
                const vectorSvg = await generateSVGString(tagData, true);
                return await request3MFBlob(vectorSvg, size, styleVal);
            }
            const compatSvg = await generateContourSVGString(tagData);
            return await request3MFBlob(compatSvg, size, styleVal);
        } catch (err) {
            errors.push(`${mode}: ${err && err.message ? err.message : String(err)}`);
        }
    }

    throw new Error(`All 3MF geometry modes failed. ${errors.join(' | ')}`);
}

async function getTagSTEPBlob(tagData, styleVal = 'flush') {
    const size = CONFIG.baseSizes[tagData.size];
    if (!size) throw new Error(`Invalid tag size: ${tagData.size}`);
    const geometryMode = getSelectedSTEPGeometryMode();
    const blob = await buildSTEPBlobWithFallback(tagData, size, styleVal, geometryMode);
    if (!blob || blob.size === 0) throw new Error('Server returned an empty STEP file');
    return blob;
}

async function getTag3MFBlob(tagData, styleVal = 'flush') {
    const size = CONFIG.baseSizes[tagData.size];
    if (!size) throw new Error(`Invalid tag size: ${tagData.size}`);
    const geometryMode = getSelectedSTEPGeometryMode();
    const blob = await build3MFBlobWithFallback(tagData, size, styleVal, geometryMode);
    if (!blob || blob.size === 0) throw new Error('Server returned an empty 3MF file');
    return blob;
}

async function downloadTagSTEP(tagData, styleVal = 'flush') {
    const blob = await getTagSTEPBlob(tagData, styleVal);
    const tagName = sanitizeFileName(tagData.name || 'tag');
    triggerBlobDownload(blob, `${tagName}.step`);
}

async function downloadTag3MF(tagData, styleVal = 'flush') {
    const blob = await getTag3MFBlob(tagData, styleVal);
    const tagName = sanitizeFileName(tagData.name || 'tag');
    triggerBlobDownload(blob, `${tagName}.3mf`);
}

async function getTagBlobForFormat(tagData, format, styleVal = 'flush') {
    if (format === 'svg') return await exportTagSVG(tagData);
    if (format === '3mf') return await getTag3MFBlob(tagData, styleVal);
    return await getTagSTEPBlob(tagData, styleVal);
}

function getBatchConcurrency(format) {
    const hw = Number((typeof navigator !== 'undefined' && navigator.hardwareConcurrency) ? navigator.hardwareConcurrency : 4);
    if (format === 'svg') {
        return Math.max(2, Math.min(8, hw));
    }
    return Math.max(2, Math.min(3, Math.floor(hw / 2) || 2));
}

function buildBatchFileName(tag, index, format) {
    const ext = format === '3mf' ? '3mf' : format;
    const safeName = sanitizeFileName(tag.name || `tag_${index + 1}`);
    return `${index + 1}_${safeName}.${ext}`;
}

async function runParallelBatchExport(tags, format, styleVal) {
    const total = tags.length;
    const results = new Array(total);
    const workerCount = Math.max(1, Math.min(total, getBatchConcurrency(format)));
    let nextIndex = 0;
    let completed = 0;

    const worker = async () => {
        while (true) {
            const i = nextIndex++;
            if (i >= total) return;
            const tag = tags[i];
            const blob = await getTagBlobForFormat(tag, format, styleVal);
            results[i] = { filename: buildBatchFileName(tag, i, format), blob };
            completed += 1;
            setBatchExportStatus(`Exporting ${format.toUpperCase()} files... (${completed}/${total})`, 'info', true);
        }
    };

    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    return results;
}

async function exportAllTags() {
    if (_batchExportBusy) return;
    if (state.tags.length === 0) {
        alert('No tags to export.');
        return;
    }

    const format = getSelectedBatchExportFormat();
    const styleVal = 'flush';

    try {
        if (typeof JSZip === 'undefined') {
            throw new Error('JSZip is not loaded. Please ensure the JSZip library is included in index.html.');
        }

        setBatchExportStatus(`Preparing batch ${format.toUpperCase()} export...`, 'info', true);
        const results = await runParallelBatchExport(state.tags, format, styleVal);

        setBatchExportStatus('Creating ZIP archive...', 'info', true);
        const zip = new JSZip();
        for (const result of results) {
            zip.file(result.filename, result.blob);
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        triggerBlobDownload(zipBlob, `infinitygrid_${format}_labels.zip`);
        setBatchExportStatus(`Batch export ready: ${results.length} files (${format.toUpperCase()}).`, 'success', false);
        setTimeout(() => {
            if (!_batchExportBusy) setBatchExportStatus('', 'info', false);
        }, 3000);
    } catch (err) {
        console.error('Batch export failed:', err);
        const msg = err && err.name === 'AbortError'
            ? `Batch ${format.toUpperCase()} export timed out after 90 seconds.`
            : `Batch export failed: ${err && err.message ? err.message : 'Unknown error'}`;
        setBatchExportStatus(msg, 'error', false);
        alert(msg);
    } finally {
        if (_batchExportBusy) setBatchExportStatus(_batchExportStatus.message, _batchExportStatus.tone, false);
        syncBatchExportControls();
    }
}

function startTagPreviewPress(event, tagId) {
    if (event && event.pointerType === 'mouse' && event.button !== 0) return;
    cancelTagPreviewPress();
    _tagPreviewPressTriggered = false;
    _tagPreviewPressTagId = tagId;
    _tagPreviewPressTimer = setTimeout(() => {
        _tagPreviewPressTriggered = true;
        deleteTag(tagId);
    }, TAG_LONG_PRESS_MS);
}

function endTagPreviewPress() {
    if (_tagPreviewPressTimer) {
        clearTimeout(_tagPreviewPressTimer);
        _tagPreviewPressTimer = null;
    }
}

function cancelTagPreviewPress() {
    if (_tagPreviewPressTimer) {
        clearTimeout(_tagPreviewPressTimer);
        _tagPreviewPressTimer = null;
    }
}

function handleTagPreviewClick(event, tagId) {
    if (_tagPreviewPressTriggered && _tagPreviewPressTagId === tagId) {
        event.preventDefault();
        event.stopPropagation();
        _tagPreviewPressTriggered = false;
        _tagPreviewPressTagId = null;
        return;
    }
    editTag(tagId);
}

function handleTagPreviewContext(event, tagId) {
    event.preventDefault();
    cancelTagPreviewPress();
    deleteTag(tagId);
}

function editTag(tagId) {
    openEditor(tagId);
}

function deleteTag(tagId) {
    if (confirm('Are you sure you want to delete this tag?')) {
        state.tags = state.tags.filter(t => t.id !== tagId);
        saveToStorage();
        renderDashboard();
    }
}

// ============================================
// SVG EXPORT
// ============================================

async function generateSVGString(tagData, forceBlack = false) {
    await ensureTextFontLoaded(120);

    const size = CONFIG.baseSizes[tagData.size];
    const leftConfig = CONFIG.leftLayouts[tagData.leftLayout];
    const rightConfig = CONFIG.rightLayouts[tagData.rightLayout];

    const contentColor = forceBlack ? 'black' : (tagData.contentColor || 'black');
    const bgColor = forceBlack ? 'white' : (tagData.backgroundColor || 'white');

    // Dimensions in mm
    const width = size.width;
    const height = size.height;

    // Spacing constants (in mm)
    const margin = 0.6;
    const gapIconText = 0.25;
    const gapBetween = 0.6;

    // Calculate available space
    const availableHeight = height - (2 * margin); // 9.3mm for single items
    const iconScale = (tagData.iconSize != null ? tagData.iconSize : 100) / 100;
    const textScale = (tagData.textSize != null ? tagData.textSize : 100) / 100;
    const textAlign = tagData.textAlign === 'left' ? 'left' : 'center';

    // Start building SVG
    let svgContent = `<rect x="0" y="0" width="${width}" height="${height}" fill="${bgColor}" />`;
    let currentX = margin;

    const hasIcons = leftConfig.iconCount > 0;
    const hasText = rightConfig.textCount > 0;
    const isTopLayout = leftConfig.arrangement === 'top' && hasText;

    if (isTopLayout) {
        // Vertical layout: icons on top, text below (tight spacing)
        const topMargin = 0.3;
        const topGap = 0.3;
        const itemHeight = (height - topMargin * 2 - topGap) / 2; // 4.8mm each

        // Icons section (centered at top)
        if (hasIcons) {
            const iconSize = itemHeight * iconScale;
            const iconGap = 0.3;
            const totalIconsWidth = (leftConfig.iconCount * iconSize) + ((leftConfig.iconCount - 1) * iconGap);
            let iconX = (width - totalIconsWidth) / 2;
            const iconY = topMargin + (itemHeight - iconSize) / 2;

            for (let i = 0; i < leftConfig.iconCount; i++) {
                const icon = tagData.icons[i];
                if (icon) {
                    svgContent += await createIconSVGElement(icon.svg, iconX, iconY, iconSize, iconSize, contentColor);
                }
                iconX += iconSize + iconGap;
            }
        }

        // Text section (centered below)
        if (hasText) {
            const textY = topMargin + itemHeight + topGap;
            const textHeight = itemHeight * textScale;
            const availableTextWidth = width - (2 * margin);
            const text = tagData.texts[0] || '';
            if (text) {
                const fontSize = calculateFontSize(text, availableTextWidth, textHeight);
                if (textAlign === 'left') {
                    const leftTextX = getVisualTextStartX(text, margin, fontSize);
                    svgContent += createTextSVGElement(text, leftTextX, textY + itemHeight / 2, fontSize, 'start', contentColor);
                } else {
                    svgContent += createTextSVGElement(text, width / 2, textY + itemHeight / 2, fontSize, 'middle', contentColor);
                }
            }
        }
    } else {
        // Horizontal layout: icons left, text right

        // Icons section
        if (hasIcons) {
            if (leftConfig.arrangement === 'stacked') {
                // Stacked icons
                const iconHeight = (availableHeight - gapBetween) / 2;
                const iconSize = iconHeight * iconScale;
                const offsetY = (iconHeight - iconSize) / 2;
                let iconY = margin + offsetY;

                for (let i = 0; i < leftConfig.iconCount; i++) {
                    const icon = tagData.icons[i];
                    if (icon) {
                        svgContent += await createIconSVGElement(icon.svg, currentX, iconY, iconSize, iconSize, contentColor);
                    }
                    iconY += iconHeight + gapBetween;
                }
                currentX += iconSize + gapIconText;
            } else {
                // Side by side icons
                const iconSize = availableHeight * iconScale;
                const iconY = margin + (availableHeight - iconSize) / 2;

                for (let i = 0; i < leftConfig.iconCount; i++) {
                    const icon = tagData.icons[i];
                    if (icon) {
                        svgContent += await createIconSVGElement(icon.svg, currentX, iconY, iconSize, iconSize, contentColor);
                    }
                    currentX += iconSize + (i < leftConfig.iconCount - 1 ? gapBetween : gapIconText);
                }
            }
        }

        // Text section
        if (hasText) {
            const textX = currentX;
            const availableTextWidth = width - textX - margin;

            if (rightConfig.textCount === 1) {
                // Single line
                const textHeight = availableHeight * textScale;
                const text = tagData.texts[0] || '';
                if (text) {
                    const fontSize = calculateFontSize(text, availableTextWidth, textHeight);
                    if (textAlign === 'center') {
                        const centerTextX = textX + (availableTextWidth / 2);
                        svgContent += createTextSVGElement(text, centerTextX, height / 2, fontSize, 'middle', contentColor);
                    } else {
                        const visualTextX = getVisualTextStartX(text, textX, fontSize);
                        svgContent += createTextSVGElement(text, visualTextX, height / 2, fontSize, 'start', contentColor);
                    }
                }
            } else {
                // Two lines
                const lineHeight = (availableHeight - gapBetween) / 2 * textScale;
                for (let i = 0; i < 2; i++) {
                    const text = tagData.texts[i] || '';
                    if (text) {
                        const textY = margin + (i * (lineHeight + gapBetween)) + lineHeight / 2;
                        const fontSize = calculateFontSize(text, availableTextWidth, lineHeight);
                        if (textAlign === 'center') {
                            const centerTextX = textX + (availableTextWidth / 2);
                            svgContent += createTextSVGElement(text, centerTextX, textY, fontSize, 'middle', contentColor);
                        } else {
                            const visualTextX = getVisualTextStartX(text, textX, fontSize);
                            svgContent += createTextSVGElement(text, visualTextX, textY, fontSize, 'start', contentColor);
                        }
                    }
                }
            }
        }
    }

    // Create final SVG
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="${width}mm"
     height="${height}mm"
     viewBox="0 0 ${width} ${height}">
  <style>
    text { font-family: "StickerText", "Bungee Outline", "Arial Black", Arial, sans-serif; font-weight: 400; }
  </style>
  ${svgContent}
</svg>`;
}

async function exportTagSVG(tagData) {
    const svg = await generateSVGString(tagData);
    return new Blob([svg], { type: 'image/svg+xml' });
}

async function downloadTagSVG(tagData) {
    const blob = await exportTagSVG(tagData);
    const tagName = sanitizeFileName(tagData.name || 'tag');
    triggerBlobDownload(blob, `${tagName}.svg`);
}

async function exportSVG() {
    await downloadTagSVG(buildCurrentTagForExport());
}

let _iconIdCounter = 0;

async function createIconSVGElement(svgPath, x, y, w, h) {
    // Try to fetch and embed the SVG content
    try {
        const response = await fetch(buildIconUrl(svgPath, true), { cache: 'no-store' });
        if (response.ok) {
            let svgText = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(svgText, 'image/svg+xml');
            const svgEl = doc.querySelector('svg');

            if (svgEl) {
                const viewBox = svgEl.getAttribute('viewBox') || `0 0 ${w} ${h}`;
                let innerContent = svgEl.innerHTML;

                // Make IDs unique to avoid conflicts between multiple icons
                const uid = 'ic' + (++_iconIdCounter);
                innerContent = innerContent.replace(/\bid="([^"]*)"/g, `id="${uid}_$1"`);
                innerContent = innerContent.replace(/url\(#([^)]*)\)/g, `url(#${uid}_$1)`);
                innerContent = innerContent.replace(/href="#([^"]*)"/g, `href="#${uid}_$1"`);

                // Use nested <svg> — the browser handles viewBox mapping natively,
                // including masks, clips, defs, and non-zero viewBox origins.
                return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${viewBox}" overflow="hidden">${innerContent}</svg>\n`;
            }
        }
    } catch (e) {
        console.error('Error loading SVG:', e);
    }

    // Fallback: draw a rectangle placeholder
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="black" />\n`;
}

const TEXT_FONT_WEIGHT = 400;
const TEXT_FONT_FAMILY = '"StickerText", "Bungee Outline", "Arial Black", Arial, sans-serif';
const TEXT_FONT_LOAD_SPEC = '400 16px "StickerText"';
const SVG_TEXT_SCALE = 1.2;
const TEXT_STROKE_RATIO = 0.04;
const TEXT_FIT_WIDTH_RATIO = 0.96;
const TEXT_FIT_HEIGHT_CAP = 0.9;
const _textMeasureCanvas = document.createElement('canvas');
const _textMeasureCtx = _textMeasureCanvas.getContext('2d');
let _textFontLoadPromise = null;

async function ensureTextFontLoaded(maxWaitMs = 120) {
    if (!document.fonts || !document.fonts.load) return;
    if (!_textFontLoadPromise) {
        _textFontLoadPromise = document.fonts.load(TEXT_FONT_LOAD_SPEC).catch(() => { });
    }
    await Promise.race([
        _textFontLoadPromise,
        new Promise(resolve => setTimeout(resolve, maxWaitMs))
    ]);
}

function getTextMetrics(text, fontSize) {
    if (!_textMeasureCtx || !text || !fontSize) {
        return { width: 0, left: 0 };
    }

    _textMeasureCtx.font = `${TEXT_FONT_WEIGHT} ${fontSize}px ${TEXT_FONT_FAMILY}`;
    const metrics = _textMeasureCtx.measureText(text);
    const hasBoxMetrics = Number.isFinite(metrics.actualBoundingBoxLeft) && Number.isFinite(metrics.actualBoundingBoxRight);

    if (hasBoxMetrics) {
        return {
            width: metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight,
            left: metrics.actualBoundingBoxLeft
        };
    }

    return {
        width: metrics.width,
        left: 0
    };
}

function getVisualTextStartX(text, targetLeftX, fontSize) {
    if (!text || fontSize <= 0) {
        return targetLeftX;
    }

    const svgFontSize = fontSize * SVG_TEXT_SCALE;
    const metrics = getTextMetrics(text, svgFontSize);
    return targetLeftX + metrics.left;
}

function createTextSVGElement(text, x, y, fontSize, anchor) {
    const svgFontSize = fontSize * SVG_TEXT_SCALE;
    const strokeWidth = Math.max(0.04, svgFontSize * TEXT_STROKE_RATIO);
    return `<text x="${x}" y="${y}" font-size="${svgFontSize}" text-anchor="${anchor}" dominant-baseline="central" fill="black" stroke="black" stroke-width="${strokeWidth}" paint-order="stroke fill">${escapeXml(text)}</text>\n`;
}

function calculateFontSize(text, availableWidth, maxHeight) {
    if (!text || availableWidth <= 0 || maxHeight <= 0) {
        return 0;
    }

    const usableWidth = availableWidth * TEXT_FIT_WIDTH_RATIO;
    const cappedMaxHeight = maxHeight * TEXT_FIT_HEIGHT_CAP;

    let min = 0;
    let max = cappedMaxHeight;
    let best = 0;

    for (let i = 0; i < 14; i++) {
        const mid = (min + max) / 2;
        const svgFontSize = mid * SVG_TEXT_SCALE;
        const metrics = getTextMetrics(text, svgFontSize);

        if (metrics.width <= usableWidth) {
            best = mid;
            min = mid;
        } else {
            max = mid;
        }
    }

    return Math.min(cappedMaxHeight, best);
}

function escapeXml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function downloadJSONText(jsonText, fileName) {
    const blob = new Blob([jsonText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function openJSONExportModal(jsonText, fileName) {
    _jsonExportText = jsonText;
    _jsonExportFilename = fileName;

    const textarea = document.getElementById('jsonExportText');
    const fileNameEl = document.getElementById('jsonExportFilename');
    const shareBtn = document.getElementById('jsonShareBtn');

    if (textarea) textarea.value = jsonText;
    if (fileNameEl) fileNameEl.textContent = fileName;
    if (shareBtn) shareBtn.style.display = typeof navigator.share === 'function' ? '' : 'none';

    const modal = document.getElementById('jsonExportModal');
    if (modal) modal.classList.add('active');
}

function closeJSONExportModal() {
    const modal = document.getElementById('jsonExportModal');
    if (modal) modal.classList.remove('active');
}

function downloadExportedJSON() {
    if (!_jsonExportText) return;
    downloadJSONText(_jsonExportText, _jsonExportFilename || `infinitygrid_tags_${new Date().toISOString().slice(0, 10)}.json`);
}

async function shareExportedJSON() {
    if (!_jsonExportText || typeof navigator.share !== 'function') return;

    const fileName = _jsonExportFilename || `infinitygrid_tags_${new Date().toISOString().slice(0, 10)}.json`;
    const blob = new Blob([_jsonExportText], { type: 'application/json' });
    const file = new File([blob], fileName, { type: 'application/json' });
    const canShareFile = typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });

    try {
        if (canShareFile) {
            await navigator.share({
                title: 'InfinityGrid Tags Backup',
                text: 'InfinityGrid tags export',
                files: [file]
            });
        } else {
            await navigator.share({
                title: 'InfinityGrid Tags Backup',
                text: _jsonExportText
            });
        }
    } catch (e) {
        if (e && e.name !== 'AbortError') {
            console.error('JSON share failed:', e);
            alert('Share failed. Try Copy instead.');
        }
    }
}

async function copyExportedJSON() {
    if (!_jsonExportText) return;

    let copied = false;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
            await navigator.clipboard.writeText(_jsonExportText);
            copied = true;
        } catch (e) {
            console.warn('Clipboard API failed, falling back:', e);
        }
    }

    if (!copied) {
        const textarea = document.getElementById('jsonExportText');
        if (textarea) {
            textarea.focus();
            textarea.select();
            textarea.setSelectionRange(0, textarea.value.length);
            copied = document.execCommand('copy');
        }
    }

    if (copied) {
        alert('JSON copied. Paste it into a file and save.');
    } else {
        alert('Could not copy automatically. Select the JSON text and copy manually.');
    }
}

async function exportTagsJSON() {
    try {
        const portableTags = state.tags.map(tag => {
            const { preview, previewVersion, ...rest } = tag;
            return rest;
        });

        const data = {
            version: 1,
            timestamp: Date.now(),
            // stlSettings: loadSTLSettings(), // Removed STL settings from export
            tags: portableTags
        };
        const jsonText = JSON.stringify(data, null, 2);
        const fileName = `infinitygrid_tags_${new Date().toISOString().slice(0, 10)}.json`;
        openJSONExportModal(jsonText, fileName);
    } catch (e) {
        console.error('JSON export failed:', e);
        alert('Export failed: ' + e.message);
    }
}

function openJSONImportModal() {
    const textarea = document.getElementById('jsonImportText');
    if (textarea) textarea.value = '';
    const modal = document.getElementById('jsonImportModal');
    if (modal) modal.classList.add('active');
}

function closeJSONImportModal() {
    const modal = document.getElementById('jsonImportModal');
    if (modal) modal.classList.remove('active');
}

function importJSONString(jsonString) {
    const json = JSON.parse(jsonString);

    let newTags = [];
    let settings = null; // Keep for parsing, but won't be used

    if (Array.isArray(json)) {
        newTags = json;
    } else if (json.tags && Array.isArray(json.tags)) {
        newTags = json.tags;
        settings = json.stlSettings; // Still parse if present, but ignore
    } else {
        throw new Error('Invalid JSON format: missing tags array');
    }

    // if (settings) { // Removed STL settings import logic
    //     localStorage.setItem('infinitygrid_stl_settings', JSON.stringify(settings));
    // }

    let addedCount = 0;
    const existingIds = new Set(state.tags.map(t => t.id));

    for (const tag of newTags) {
        const normalizedTag = { ...tag };
        delete normalizedTag.preview;
        delete normalizedTag.previewVersion;

        if (!normalizedTag.id) normalizedTag.id = generateId();
        if (!existingIds.has(normalizedTag.id)) {
            state.tags.unshift(normalizedTag);
            existingIds.add(normalizedTag.id);
            addedCount++;
        }
    }

    saveToStorage();
    renderDashboard();
    return { addedCount, restoredSettings: false };
}

function uploadImportJSONFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';

    input.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = event => {
            try {
                const text = String(event.target.result || '');
                const textarea = document.getElementById('jsonImportText');
                if (textarea) textarea.value = text;
                const result = importJSONString(text);
                closeJSONImportModal();
                alert(`Imported ${result.addedCount} new tags.`); // Removed restoredSettings from alert
            } catch (err) {
                console.error('Import error:', err);
                alert('Failed to import JSON: ' + err.message);
            }
        };
        reader.readAsText(file);
    };

    input.click();
}

function importPastedJSON() {
    try {
        const textarea = document.getElementById('jsonImportText');
        const text = (textarea ? textarea.value : '').trim();
        if (!text) {
            alert('Paste JSON first.');
            return;
        }

        const result = importJSONString(text);
        closeJSONImportModal();
        alert(`Imported ${result.addedCount} new tags.`); // Removed restoredSettings from alert
    } catch (err) {
        console.error('Import error:', err);
        alert('Failed to import JSON: ' + err.message);
    }
}

async function importTagsJSON() {
    openJSONImportModal();
}

async function exportCurrentSTL() {
    const tagData = buildCurrentTagForExport();
    await downloadTagSTL(tagData);
}

async function exportCurrent3MF() {
    const tagData = buildCurrentTagForExport();
    await downloadTag3MF(tagData);
}

async function exportAllSTLs() {
    if (state.tags.length === 0) {
        alert('No tags to export.');
        return;
    }

    const btn = document.getElementById('exportAllBtn');
    const originalText = btn ? btn.textContent : '';

    try {
        const zip = new JSZip();
        for (let i = 0; i < state.tags.length; i++) {
            const tag = state.tags[i];
            if (btn) btn.textContent = `Exporting... (${i + 1}/${state.tags.length})`;
            const blob = await exportTagSTL(tag);
            const filename = (tag.name || 'tag').replace(/[^a-zA-Z0-9]/g, '_') + '.stl';
            zip.file(filename, blob);
        }

        if (btn) btn.textContent = 'Zipping...';
        const zipBlob = await zip.generateAsync({ type: 'blob' });

        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'infinitygrid_labels.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error('Export all STLs failed:', e);
        alert('Export failed: ' + e.message);
    } finally {
        if (btn) btn.textContent = originalText;
    }
}

// ============================================
// INITIALIZATION
// ============================================
async function init() {
    loadFromStorage();
    await fetchIconsFromBackend();
    renderDashboard();
}

// Start the app
document.addEventListener('DOMContentLoaded', init);


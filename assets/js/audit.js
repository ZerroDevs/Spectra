/**
 * Spectra Intelligence - Security Audit & Griefer Database Controller
 * Modular logic for: Flagged identities indexer, reason tag parser,
 * custom moderation notes, and multi-format blocklist exporter.
 */
(() => {
    'use strict';

    // Theme initialization
    let currentTheme = 'dark';
    try {
        currentTheme = localStorage.getItem('multiCheckTheme') || localStorage.getItem('spectraTheme') || 'dark';
    } catch (e) { }
    document.documentElement.setAttribute('data-theme', currentTheme);

    const KEYS = {
        workspaces: 'multiCheckWorkspaces',
        current: 'multiCheckCurrentWorkspace',
        tabs: 'multiCheckTabs',
        notes: 'multiCheckGrieferNotes'
    };

    const GRIEFER_TAGS = ['Non-RP', 'Fail-RP', 'Provoking', 'GR3.1', 'GR3.2', 'DM', 'Griefer', 'Scammer', 'Blacklist'];
    const escapeRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const GRIEFER_RE = new RegExp(`(?:^|[^a-z0-9])(${GRIEFER_TAGS.map(escapeRegex).join('|')})(?:[^a-z0-9]|$)`, 'i');
    const MAIN_RE = /\(\s*m\s*\)|\bm\s*$/i;
    const TWINK_RE = /\(\s*t\s*\)|\bt\s*$/i;

    function lsGet(k, fallback) {
        try {
            const v = localStorage.getItem(k);
            return v === null ? fallback : v;
        } catch (e) {
            return fallback;
        }
    }

    function lsSet(k, v) {
        try {
            localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
            return true;
        } catch (e) {
            return false;
        }
    }

    function parseJSON(str, fallback) {
        try {
            const v = JSON.parse(str);
            return v === null || v === undefined ? fallback : v;
        } catch (e) {
            return fallback;
        }
    }

    function wsKey(base, wsId) {
        return `${base}_${wsId}`;
    }

    function showToast(msg, duration = 2800) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.innerHTML = `<img src="assets/images/logo1.png" alt="" class="toast-favicon" style="width:15px;height:15px;vertical-align:middle;margin-right:7px;border-radius:3px;display:inline-block;"><span>${msg}</span>`;
        toast.classList.add('visible');
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => toast.classList.remove('visible'), duration);
    }

    // Scan all workspaces for flagged identities
    function scanBlacklist() {
        const workspaces = parseJSON(lsGet(KEYS.workspaces, '[]'), [
            { id: 'workspace-default', name: 'Default', color: '#38bdf8' }
        ]);
        const customNotes = parseJSON(lsGet(KEYS.notes, '{}'), {});

        const records = [];
        const uniqueIds = new Set();
        const tagCounts = new Map();

        workspaces.forEach(ws => {
            if (!ws || !ws.id) return;
            const tabs = parseJSON(lsGet(wsKey(KEYS.tabs, ws.id), '[]'), []);

            tabs.forEach(tab => {
                if (!tab || !tab.output) return;
                const lines = tab.output.split('\n');

                lines.forEach((rawLine, lineIdx) => {
                    const line = rawLine.trim();
                    if (!line || !line.includes('|')) return;

                    const grieferMatch = line.match(GRIEFER_RE);
                    if (grieferMatch) {
                        const tag = grieferMatch[1] || 'Griefer';
                        const isMain = MAIN_RE.test(line);
                        const isTwink = TWINK_RE.test(line);

                        // Parse identity / ID
                        const parts = line.split('|').map(p => p.trim());
                        const nameOrId = parts[0] || 'Unknown';
                        const secondaryId = parts[1] || '';

                        // Extract clean digits ID if available
                        const idMatch = line.match(/\b\d{4,10}\b/);
                        const numericId = idMatch ? idMatch[0] : nameOrId;

                        const noteObj = customNotes[nameOrId] || customNotes[numericId] || null;

                        records.push({
                            id: numericId,
                            identity: nameOrId,
                            details: secondaryId,
                            rawLine: line,
                            tag,
                            classification: isMain ? 'Main' : isTwink ? 'Twink' : 'Unlabeled',
                            wsId: ws.id,
                            wsName: ws.name || 'Workspace',
                            wsColor: ws.color || '#38bdf8',
                            tabId: tab.id,
                            tabName: tab.name || 'Tab',
                            note: noteObj ? noteObj.note : '',
                            noteTime: noteObj ? noteObj.updatedAt : null
                        });

                        uniqueIds.add(numericId);
                        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
                    }
                });
            });
        });

        return {
            records,
            uniqueCount: uniqueIds.size,
            workspacesCount: workspaces.length,
            tagCounts,
            workspaces
        };
    }

    // State for filtering
    const state = {
        search: '',
        tag: 'all',
        workspace: 'all',
        classification: 'all',
        data: null,
        exportFormat: 'userscript'
    };

    // Render stats & filter selects
    function renderVitals(data) {
        const totalEl = document.getElementById('vital-total-griefers');
        const uniqueEl = document.getElementById('vital-unique-identities');
        const tagsEl = document.getElementById('vital-active-tags');
        const wsEl = document.getElementById('vital-workspaces-count');
        const tableBadge = document.getElementById('table-records-badge');

        if (totalEl) totalEl.textContent = data.records.length;
        if (uniqueEl) uniqueEl.textContent = data.uniqueCount;
        if (tagsEl) tagsEl.textContent = data.tagCounts.size;
        if (wsEl) wsEl.textContent = data.workspacesCount;
        if (tableBadge) tableBadge.textContent = `${data.records.length} records`;

        // Populate Workspace Filter
        const wsSelect = document.getElementById('audit-filter-ws');
        if (wsSelect && wsSelect.options && wsSelect.options.length <= 1) {
            data.workspaces.forEach(ws => {
                const opt = document.createElement('option');
                opt.value = ws.id;
                opt.textContent = ws.name || 'Workspace';
                wsSelect.appendChild(opt);
            });
        }

        // Populate Tag Filter
        const tagSelect = document.getElementById('audit-filter-tag');
        if (tagSelect && tagSelect.options && tagSelect.options.length <= 1) {
            data.tagCounts.forEach((cnt, tag) => {
                const opt = document.createElement('option');
                opt.value = tag;
                opt.textContent = `${tag} (${cnt})`;
                tagSelect.appendChild(opt);
            });
        }
    }

    function renderTable() {
        const tbody = document.getElementById('blacklist-table-body');
        if (!tbody || !state.data) return;

        const filtered = state.data.records.filter(r => {
            if (state.search) {
                const q = state.search.toLowerCase();
                const matchId = (r.identity || '').toLowerCase().includes(q) || (r.id || '').includes(q);
                const matchNote = (r.note || '').toLowerCase().includes(q);
                const matchLine = (r.rawLine || '').toLowerCase().includes(q);
                if (!matchId && !matchNote && !matchLine) return false;
            }
            if (state.tag !== 'all' && r.tag !== state.tag) return false;
            if (state.workspace !== 'all' && r.wsId !== state.workspace) return false;
            if (state.classification !== 'all' && r.classification !== state.classification) return false;
            return true;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; color: var(--text-3); padding: 40px 20px;">
                        No matching flagged accounts found for current filter criteria.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filtered.map(r => `
            <tr>
                <td class="blacklist-id-cell">
                    <div style="display: flex; flex-direction: column; gap: 2px;">
                        <span style="font-weight: 700; color: var(--text-1);">${r.identity}</span>
                        ${r.id !== r.identity ? `<span style="font-size: 0.72rem; color: var(--text-3);">ID: ${r.id}</span>` : ''}
                    </div>
                </td>
                <td>
                    <span class="blacklist-tag-badge">
                        <svg viewBox="0 0 24 24" width="11" height="11" stroke="currentColor" stroke-width="2.5" fill="none"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                        ${r.tag}
                    </span>
                </td>
                <td>
                    <span style="font-size: 0.75rem; font-weight: 600; color: ${r.classification === 'Main' ? '#22d3ee' : r.classification === 'Twink' ? '#f472b6' : 'var(--text-3)'};">
                        ${r.classification}
                    </span>
                </td>
                <td>
                    <div style="display: flex; align-items: center; gap: 6px; font-size: 0.78rem;">
                        <span style="width: 8px; height: 8px; border-radius: 50%; background: ${r.wsColor};"></span>
                        <span style="font-weight: 600;">${r.wsName}</span>
                        <span style="color: var(--text-3);">/ ${r.tabName}</span>
                    </div>
                </td>
                <td>
                    <div class="blacklist-note-text" title="${r.note ? r.note : 'No notes recorded'}">
                        ${r.note ? `<span>${r.note}</span>` : '<span style="color: var(--text-3); font-style: italic;">None</span>'}
                    </div>
                </td>
                <td>
                    <div class="blacklist-actions-cell">
                        <button type="button" class="blacklist-act-btn" data-ban-cmd="${r.id}" data-ban-reason="${r.tag}" title="Copy /ban command to clipboard">
                            <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                            <span>/ban</span>
                        </button>
                        <button type="button" class="blacklist-act-btn" data-edit-note="${r.identity}" data-edit-note-current="${encodeURIComponent(r.note || '')}" title="Edit incident notes">
                            <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                            <span>Note</span>
                        </button>
                        <a href="workspace.html#ban" class="blacklist-act-btn" data-jump-ws="${r.wsId}" data-jump-tab="${r.tabId}" title="Inspect in Ban Matrix">
                            <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polyline></svg>
                        </a>
                    </div>
                </td>
            </tr>
        `).join('');

        // Bind Copy /ban Buttons
        tbody.querySelectorAll('[data-ban-cmd]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.banCmd;
                const reason = btn.dataset.banReason || 'Rule Violation';
                const cmd = `/ban ${id} 60 ${reason}`;
                navigator.clipboard.writeText(cmd).then(() => {
                    showToast(`Copied: <code>${cmd}</code>`);
                });
            });
        });

        // Bind Edit Note Buttons
        tbody.querySelectorAll('[data-edit-note]').forEach(btn => {
            btn.addEventListener('click', () => {
                const identity = btn.dataset.editNote;
                const currentNote = decodeURIComponent(btn.dataset.editNoteCurrent || '');
                openNoteModal(identity, currentNote);
            });
        });

        // Bind Jump Workspace Links
        tbody.querySelectorAll('[data-jump-ws]').forEach(link => {
            link.addEventListener('click', () => {
                const wsId = link.dataset.jumpWs;
                const tabId = link.dataset.jumpTab;
                if (wsId) lsSet(KEYS.current, wsId);
                if (tabId) lsSet(wsKey('multiCheckActiveTab', wsId), tabId);
            });
        });
    }

    // --------------------------------------------------------------------------
    // Custom Notes Modal
    // --------------------------------------------------------------------------
    function openNoteModal(identity, currentNote) {
        const modal = document.getElementById('edit-note-modal');
        const input = document.getElementById('note-text-input');
        const title = document.getElementById('note-modal-title');
        const saveBtn = document.getElementById('save-note-btn');

        if (!modal) return;
        if (title) title.textContent = `Incident Note: ${identity}`;
        if (input) input.value = currentNote;

        modal.style.display = 'flex';
        if (input) input.focus();

        if (saveBtn) {
            saveBtn.onclick = () => {
                const val = (input.value || '').trim();
                const notes = parseJSON(lsGet(KEYS.notes, '{}'), {});

                if (val) {
                    notes[identity] = { note: val, updatedAt: Date.now() };
                } else {
                    delete notes[identity];
                }

                lsSet(KEYS.notes, notes);
                modal.style.display = 'none';
                showToast('Incident note saved.');
                refreshData();
            };
        }
    }

    // --------------------------------------------------------------------------
    // Blocklist Exporter Logic
    // --------------------------------------------------------------------------
    function generateExportCode(format) {
        if (!state.data) return '';
        const records = state.data.records;
        const uniqueIds = Array.from(new Set(records.map(r => r.id)));

        switch (format) {
            case 'userscript':
                return `// ==UserScript==\n// @name         Spectra Blacklist Rule\n// @description  Automated blacklist injector for Spectra moderation\n// @version      1.0.0\n// ==/UserScript==\n\nconst SPECTRA_BLACKLIST_IDS = new Set([\n${uniqueIds.map(id => `    "${id}"`).join(',\n')}\n]);\n\n// Usage Check Example:\nfunction isFlagged(id) {\n    return SPECTRA_BLACKLIST_IDS.has(String(id));\n}`;

            case 'plain':
                return uniqueIds.join('\n');

            case 'json':
                return JSON.stringify(records.map(r => ({
                    id: r.id,
                    identity: r.identity,
                    reason: r.tag,
                    classification: r.classification,
                    workspace: r.wsName,
                    note: r.note,
                    timestamp: r.noteTime || Date.now()
                })), null, 2);

            case 'discord':
                return `**SPECTRA SECURITY BLACKLIST REPORT**\n*Total Records: ${records.length} | Unique Identities: ${uniqueIds.length}*\n\n` +
                    records.slice(0, 30).map(r => `• **${r.identity}** (ID: \`${r.id}\`) — [${r.tag}] (${r.wsName})`).join('\n') +
                    (records.length > 30 ? `\n*... and ${records.length - 30} more accounts.*` : '');

            default:
                return uniqueIds.join('\n');
        }
    }

    function initExporter() {
        const modal = document.getElementById('export-blocklist-modal');
        const openBtn = document.getElementById('open-export-modal-btn');
        const closeBtn = document.getElementById('close-export-modal-btn');
        const preview = document.getElementById('export-code-preview');
        const copyBtn = document.getElementById('copy-export-code-btn');
        const downloadBtn = document.getElementById('download-export-code-btn');
        const tabBtns = document.querySelectorAll('.export-format-btn');

        if (!modal || !openBtn) return;

        function updatePreview() {
            if (preview) {
                preview.value = generateExportCode(state.exportFormat);
            }
        }

        openBtn.addEventListener('click', () => {
            modal.style.display = 'flex';
            updatePreview();
        });

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.exportFormat = btn.dataset.format;
                updatePreview();
            });
        });

        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                if (!preview) return;
                navigator.clipboard.writeText(preview.value).then(() => {
                    showToast('Copied blocklist to clipboard!');
                });
            });
        }

        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                if (!preview) return;
                const ext = state.exportFormat === 'json' ? 'json' : state.exportFormat === 'userscript' ? 'user.js' : 'txt';
                const blob = new Blob([preview.value], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `spectra-blacklist-${new Date().toISOString().slice(0, 10)}.${ext}`;
                a.click();
                URL.revokeObjectURL(url);
                showToast(`Downloaded blocklist as .${ext}`);
            });
        }
    }

    // --------------------------------------------------------------------------
    // Refresh & Initialize
    // --------------------------------------------------------------------------
    function refreshData() {
        state.data = scanBlacklist();
        renderVitals(state.data);
        renderTable();
    }

    function init() {
        refreshData();
        initExporter();

        // Bind Search Input
        const searchInput = document.getElementById('audit-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                state.search = e.target.value.trim();
                renderTable();
            });
        }

        // Bind Workspace Filter
        const wsSelect = document.getElementById('audit-filter-ws');
        if (wsSelect) {
            wsSelect.addEventListener('change', (e) => {
                state.workspace = e.target.value;
                renderTable();
            });
        }

        // Bind Tag Filter
        const tagSelect = document.getElementById('audit-filter-tag');
        if (tagSelect) {
            tagSelect.addEventListener('change', (e) => {
                state.tag = e.target.value;
                renderTable();
            });
        }

        // Bind Classification Filter
        const classSelect = document.getElementById('audit-filter-class');
        if (classSelect) {
            classSelect.addEventListener('change', (e) => {
                state.classification = e.target.value;
                renderTable();
            });
        }

        // Close Note Modal
        const closeNoteBtn = document.getElementById('close-note-modal-btn');
        const cancelNoteBtn = document.getElementById('cancel-note-btn');
        const noteModal = document.getElementById('edit-note-modal');
        if (closeNoteBtn && noteModal) closeNoteBtn.onclick = () => noteModal.style.display = 'none';
        if (cancelNoteBtn && noteModal) cancelNoteBtn.onclick = () => noteModal.style.display = 'none';

        // Theme Toggle
        const themeBtn = document.getElementById('theme-toggle-btn');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => {
                const cur = document.documentElement.getAttribute('data-theme') || 'dark';
                const next = cur === 'dark' ? 'light' : 'dark';
                document.documentElement.setAttribute('data-theme', next);
                lsSet('multiCheckTheme', next);
                lsSet('spectraTheme', next);
            });
        }

        // Refresh Button
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                refreshData();
                showToast('Refreshed security audit records.');
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

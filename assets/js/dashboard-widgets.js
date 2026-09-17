/**
 * Spectra Intelligence Dashboard - Widgets & Telemetry Engine
 * Modular logic for: Quick Action Bar, Health Radar, Workspace Storage Stacked Bar,
 * Pinned Forensics, and Drag & Drop Backup Ingestion.
 */
(() => {
    'use strict';

    const STORAGE_LIMIT = 5 * 1024 * 1024; // 5MB standard localStorage quota
    const KEYS = {
        workspaces: 'multiCheckWorkspaces',
        current: 'multiCheckCurrentWorkspace',
        tabs: 'multiCheckTabs',
        groups: 'multiCheckGroups'
    };

    const GRIEFER_TAGS = ['Non-RP', 'Fail-RP', 'Provoking', 'GR3.1', 'GR3.2', 'DM'];
    const escapeRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const GRIEFER_RE = new RegExp(`(?:^|[^a-z0-9])(${GRIEFER_TAGS.map(escapeRegex).join('|')})(?:[^a-z0-9]|$)`, 'i');
    const MAIN_RE = /\(\s*m\s*\)|\bm\s*$/i;
    const TWINK_RE = /\(\s*t\s*\)|\bt\s*$/i;

    // Helper functions
    function lsGet(key, fallback) {
        try {
            const v = localStorage.getItem(key);
            return v === null ? fallback : v;
        } catch (e) {
            return fallback;
        }
    }

    function lsSet(key, val) {
        try {
            localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val));
            return true;
        } catch (e) {
            console.error('Failed to set localStorage key:', key, e);
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

    function formatBytes(bytes) {
        if (!bytes || bytes <= 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    }

    function formatRelativeTime(ts) {
        if (!ts) return 'Never';
        const diff = Date.now() - Number(ts);
        if (isNaN(diff) || diff < 0) return 'Just now';
        const s = Math.floor(diff / 1000);
        if (s < 60) return 'Just now';
        const m = Math.floor(s / 60);
        if (m < 60) return `${m}m ago`;
        const h = Math.floor(m / 60);
        if (h < 24) return `${h}h ago`;
        const d = Math.floor(h / 24);
        if (d < 30) return `${d}d ago`;
        return new Date(ts).toLocaleDateString();
    }

    function safeColor(c) {
        return typeof c === 'string' && /^#[0-9a-f]{3,8}$/i.test(c.trim()) ? c.trim() : '#38bdf8';
    }

    function showToast(msg, duration = 3000) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.innerHTML = msg;
        toast.classList.add('show');
        toast.classList.add('visible');
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => {
            toast.classList.remove('show');
            toast.classList.remove('visible');
        }, duration);
    }

    function recordMutation(title, type = 'mutation') {
        try {
            const MUTATION_KEY = 'multiCheckTemporalMutations';
            const now = Date.now();
            const raw = localStorage.getItem(MUTATION_KEY);
            const list = raw ? JSON.parse(raw) : [];
            list.unshift({
                id: 'mut-' + now + '-' + Math.random().toString(36).substr(2, 4),
                title,
                type,
                time: now
            });
            // auto prune > 7 days, max 50
            const pruned = list.filter(m => (now - Number(m.time || 0)) <= 7 * 24 * 60 * 60 * 1000).slice(0, 50);
            localStorage.setItem(MUTATION_KEY, JSON.stringify(pruned));
        } catch (e) { }
    }

    function analyzeTabContent(output) {
        const stats = { accounts: 0, mains: 0, twinks: 0, griefers: 0, unformattedLines: 0 };
        if (!output || typeof output !== 'string') return stats;
        const lines = output.split('\n');
        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) continue;
            if (!line.includes('|')) {
                stats.unformattedLines++;
                continue;
            }
            stats.accounts++;
            if (MAIN_RE.test(line)) stats.mains++;
            else if (TWINK_RE.test(line)) stats.twinks++;
            if (GRIEFER_RE.test(line)) stats.griefers++;
        }
        return stats;
    }

    function getAvailableWorkspaces() {
        let ws = [];
        try {
            const raw = localStorage.getItem(KEYS.workspaces);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    ws = parsed;
                }
            }
        } catch (e) { }

        // Also check if any workspaces exist in localStorage by keys
        if (ws.length === 0) {
            const discovered = new Set();
            try {
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && k.startsWith('multiCheckTabs_')) {
                        const id = k.replace('multiCheckTabs_', '');
                        if (id) discovered.add(id);
                    }
                }
            } catch (e) { }

            if (discovered.size > 0) {
                discovered.forEach(id => {
                    ws.push({
                        id: id,
                        name: id === 'workspace-default' ? 'Default' : id.replace(/^workspace-/, 'Workspace '),
                        color: '#38bdf8'
                    });
                });
            }
        }

        if (ws.length === 0) {
            ws = [{ id: 'workspace-default', name: 'Default', color: '#38bdf8' }];
        }

        return ws;
    }

    // Comprehensive Workspace & Tab Scanner
    function scanAllWorkspaceData() {
        const workspaces = getAvailableWorkspaces();
        const currentId = lsGet(KEYS.current, 'workspace-default');

        const result = {
            workspaces: [],
            allTabs: [],
            pinnedTabs: [],
            staleTabs: [],
            totalBytes: 0,
            totalAccounts: 0,
            totalGriefers: 0,
            unformattedCount: 0,
            tabNamesMap: new Map(),
            duplicateTabNamesCount: 0
        };

        // Measure global localStorage usage
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k) {
                    const v = localStorage.getItem(k) || '';
                    result.totalBytes += (k.length + v.length);
                }
            }
        } catch (e) { }

        workspaces.forEach(ws => {
            if (!ws || !ws.id) return;
            const tabsKey = wsKey(KEYS.tabs, ws.id);
            const groupsKey = wsKey(KEYS.groups, ws.id);
            let tabsStr = lsGet(tabsKey, null);
            if ((!tabsStr || tabsStr === '[]') && ws.id === 'workspace-default') {
                const legacy = lsGet(KEYS.tabs, null);
                if (legacy && legacy !== '[]') tabsStr = legacy;
            }
            tabsStr = tabsStr || '[]';
            const groupsStr = lsGet(groupsKey, '[]');
            const tabs = parseJSON(tabsStr, []);

            const wsBytes = (tabsKey.length + tabsStr.length) + (groupsKey.length + groupsStr.length);
            let wsAccounts = 0;
            let wsGriefers = 0;

            const tabDetails = tabs.map(tab => {
                if (!tab) return null;
                const stats = analyzeTabContent(tab.output);
                wsAccounts += stats.accounts;
                wsGriefers += stats.griefers;
                result.unformattedCount += stats.unformattedLines;

                const nameNorm = (tab.name || '').trim().toLowerCase();
                if (nameNorm) {
                    const existing = result.tabNamesMap.get(nameNorm) || 0;
                    result.tabNamesMap.set(nameNorm, existing + 1);
                    if (existing === 1) {
                        result.duplicateTabNamesCount++;
                    }
                }

                const isStale = stats.accounts === 0 && (!tab.output || !tab.output.trim());
                const isPinned = !!(tab.pinned || tab.isPinned || tab.starred || tab.favorite);
                const item = {
                    wsId: ws.id,
                    wsName: ws.name || 'Workspace',
                    wsColor: safeColor(ws.color),
                    tab,
                    stats,
                    isStale,
                    isPinned
                };

                result.allTabs.push(item);
                if (isPinned) result.pinnedTabs.push(item);
                if (isStale) result.staleTabs.push(item);

                return item;
            }).filter(Boolean);

            result.totalAccounts += wsAccounts;
            result.totalGriefers += wsGriefers;

            result.workspaces.push({
                ws,
                bytes: wsBytes,
                accounts: wsAccounts,
                griefers: wsGriefers,
                tabs: tabDetails,
                isCurrent: ws.id === currentId
            });
        });

        return result;
    }

    // --------------------------------------------------------------------------
    // 1. Quick Health Radar Calculation & Render
    // --------------------------------------------------------------------------
    function renderHealthRadar(scan) {
        const gaugeEl = document.getElementById('health-gauge-bar');
        const scoreEl = document.getElementById('health-score-num');
        const statusEl = document.getElementById('health-score-status');

        const factorStorage = document.getElementById('factor-storage');
        const factorDups = document.getElementById('factor-dups');
        const factorGriefers = document.getElementById('factor-griefers');
        const factorStale = document.getElementById('factor-stale');
        const factorFormat = document.getElementById('factor-format');

        let score = 100;
        const penalties = {
            storage: 0,
            duplicates: 0,
            griefers: 0,
            stale: 0,
            format: 0
        };

        // Storage Quota Penalty
        const storageRatio = scan.totalBytes / STORAGE_LIMIT;
        if (storageRatio > 0.85) {
            penalties.storage = 25;
            score -= 25;
        } else if (storageRatio > 0.65) {
            penalties.storage = 12;
            score -= 12;
        }

        // Duplicate Tab Names Penalty
        if (scan.duplicateTabNamesCount > 0) {
            penalties.duplicates = Math.min(scan.duplicateTabNamesCount * 5, 15);
            score -= penalties.duplicates;
        }

        // Griefer Ratio Penalty
        if (scan.totalAccounts > 0) {
            const grieferRatio = scan.totalGriefers / scan.totalAccounts;
            if (grieferRatio > 0.25) {
                penalties.griefers = 20;
                score -= 20;
            } else if (grieferRatio > 0.12) {
                penalties.griefers = 10;
                score -= 10;
            } else if (grieferRatio > 0.05) {
                penalties.griefers = 5;
                score -= 5;
            }
        }

        // Stale Tabs Penalty
        if (scan.staleTabs.length > 0) {
            penalties.stale = Math.min(scan.staleTabs.length * 3, 18);
            score -= penalties.stale;
        }

        // Unformatted Lines Penalty
        if (scan.unformattedCount > 10) {
            penalties.format = 8;
            score -= 8;
        } else if (scan.unformattedCount > 0) {
            penalties.format = 4;
            score -= 4;
        }

        score = Math.max(10, Math.min(100, Math.round(score)));

        // Animate Score Counter
        if (scoreEl) {
            scoreEl.textContent = score;
        }

        // Update Gauge SVG Circle
        if (gaugeEl) {
            const circumference = 377; // 2 * PI * 60
            const offset = circumference - (circumference * score / 100);
            gaugeEl.style.strokeDashoffset = offset;

            let color = '#10b981';
            let statusText = 'Optimal';
            let statusClass = 'status-optimal';

            if (score >= 90) {
                color = '#10b981';
                statusText = 'Optimal';
                statusClass = 'status-optimal';
            } else if (score >= 75) {
                color = '#38bdf8';
                statusText = 'Healthy';
                statusClass = 'status-good';
            } else if (score >= 55) {
                color = '#f59e0b';
                statusText = 'Moderate';
                statusClass = 'status-moderate';
            } else {
                color = '#ef4444';
                statusText = 'Critical';
                statusClass = 'status-critical';
            }

            gaugeEl.style.stroke = color;
            gaugeEl.style.filter = `drop-shadow(0 0 8px ${color}88)`;
            if (statusEl) {
                statusEl.textContent = statusText;
                statusEl.className = `health-score-status ${statusClass}`;
            }
        }

        // Render Factors Breakdown
        if (factorStorage) {
            const pct = Math.round(storageRatio * 100);
            factorStorage.innerHTML = `
                <span class="hygiene-factor-name">
                    <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    Storage Footprint
                </span>
                <span class="hygiene-factor-status ${pct > 80 ? 'hygiene-fail' : pct > 60 ? 'hygiene-warn' : 'hygiene-pass'}">
                    ${pct}% (${formatBytes(scan.totalBytes)})
                </span>
            `;
        }

        if (factorDups) {
            factorDups.innerHTML = `
                <span class="hygiene-factor-name">
                    <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    Duplicate Tab Names
                </span>
                <span class="hygiene-factor-status ${scan.duplicateTabNamesCount > 0 ? 'hygiene-warn' : 'hygiene-pass'}">
                    ${scan.duplicateTabNamesCount === 0 ? 'Clean (0)' : `${scan.duplicateTabNamesCount} Duplicates (-${penalties.duplicates}%)`}
                </span>
            `;
        }

        if (factorStale) {
            factorStale.innerHTML = `
                <span class="hygiene-factor-name">
                    <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    Stale / Empty Tabs
                </span>
                <span class="hygiene-factor-status ${scan.staleTabs.length > 0 ? 'hygiene-warn' : 'hygiene-pass'}">
                    ${scan.staleTabs.length === 0 ? '0 Empty' : `${scan.staleTabs.length} Stale (-${penalties.stale}%)`}
                </span>
            `;
        }

        if (factorGriefers) {
            const grieferPct = scan.totalAccounts > 0 ? Math.round((scan.totalGriefers / scan.totalAccounts) * 100) : 0;
            factorGriefers.innerHTML = `
                <span class="hygiene-factor-name">
                    <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    Flagged Griefer Density
                </span>
                <span class="hygiene-factor-status ${grieferPct > 15 ? 'hygiene-fail' : grieferPct > 5 ? 'hygiene-warn' : 'hygiene-pass'}">
                    ${grieferPct}% (${scan.totalGriefers} accounts)
                </span>
            `;
        }

        if (factorFormat) {
            factorFormat.innerHTML = `
                <span class="hygiene-factor-name">
                    <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><line x1="4" y1="6" x2="20" y2="6"></line><line x1="4" y1="12" x2="20" y2="12"></line><line x1="4" y1="18" x2="20" y2="18"></line></svg>
                    Log Normalization
                </span>
                <span class="hygiene-factor-status ${scan.unformattedCount > 0 ? 'hygiene-warn' : 'hygiene-pass'}">
                    ${scan.unformattedCount === 0 ? 'Optimal' : `${scan.unformattedCount} Raw lines`}
                </span>
            `;
        }
    }

    // --------------------------------------------------------------------------
    // 2. Storage Quota Breakdown by Workspace
    // --------------------------------------------------------------------------
    function renderStorageBreakdown(scan) {
        const barWrapper = document.getElementById('ws-storage-bar-segments');
        const legendWrapper = document.getElementById('ws-storage-legend');
        const summaryText = document.getElementById('ws-storage-summary-text');

        if (!barWrapper || !legendWrapper) return;

        barWrapper.innerHTML = '';
        legendWrapper.innerHTML = '';

        const totalBytes = Math.max(scan.totalBytes, 1);
        if (summaryText) {
            summaryText.textContent = `${formatBytes(scan.totalBytes)} utilized of 5.0 MB quota (${Math.round((scan.totalBytes / STORAGE_LIMIT) * 100)}%)`;
        }

        // Palette for workspaces without custom color
        const fallbackColors = ['#38bdf8', '#f59e0b', '#10b981', '#a855f7', '#ec4899', '#06b6d4', '#6366f1'];

        scan.workspaces.forEach((wItem, idx) => {
            const ws = wItem.ws;
            const color = ws.color ? safeColor(ws.color) : fallbackColors[idx % fallbackColors.length];
            const pct = Math.max(Math.round((wItem.bytes / totalBytes) * 100), 1);

            // Bar segment
            const seg = document.createElement('div');
            seg.className = 'storage-quota-segment';
            seg.style.width = `${pct}%`;
            seg.style.backgroundColor = color;
            seg.title = `${ws.name || 'Workspace'}: ${formatBytes(wItem.bytes)} (${pct}%) · ${wItem.accounts} accounts`;
            barWrapper.appendChild(seg);

            // Legend item
            const item = document.createElement('div');
            item.className = 'storage-legend-item';
            item.innerHTML = `
                <div class="storage-legend-left">
                    <span class="storage-legend-dot" style="background-color: ${color};"></span>
                    <span class="storage-legend-name" title="${ws.name || 'Workspace'}">${ws.name || 'Workspace'}</span>
                </div>
                <div class="storage-legend-size">${formatBytes(wItem.bytes)} (${pct}%)</div>
            `;
            legendWrapper.appendChild(item);
        });
    }

    // --------------------------------------------------------------------------
    // 3. Pinned Forensics / Favorite Tabs Widget
    // --------------------------------------------------------------------------
    function renderPinnedTabs(scan) {
        const container = document.getElementById('pinned-tabs-container');
        const countBadge = document.getElementById('pinned-tabs-count');
        if (!container) return;

        const pinned = scan.pinnedTabs;
        if (countBadge) countBadge.textContent = `${pinned.length} pinned`;

        if (pinned.length === 0) {
            container.innerHTML = `
                <div class="pinned-empty-state">
                    <div class="pinned-empty-icon">
                        <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2" fill="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                    </div>
                    <div class="pinned-empty-title">No Pinned Tabs</div>
                    <p class="pinned-empty-desc">Star or Pin critical forensic tabs in your workspaces to monitor them here with priority deep links and live telemetry.</p>
                    <a href="workspace.html#main" class="quick-act-btn quick-act-btn-amber" style="margin-top: 6px;">
                        Open Workspace to Star Tabs
                    </a>
                </div>
            `;
            return;
        }

        const grid = document.createElement('div');
        grid.className = 'pinned-tabs-grid';

        pinned.forEach(item => {
            const card = document.createElement('article');
            card.className = 'pinned-tab-card';

            card.innerHTML = `
                <div class="pinned-tab-top">
                    <div class="pinned-tab-info">
                        <h4 class="pinned-tab-name" title="${item.tab.name || 'Untitled Tab'}">${item.tab.name || 'Untitled Tab'}</h4>
                        <div class="pinned-tab-ws-badge">
                            <span class="pinned-ws-dot" style="background-color: ${item.wsColor};"></span>
                            <span>${item.wsName}</span>
                        </div>
                    </div>
                    <div class="pinned-tab-actions">
                        <button type="button" class="pinned-unpin-btn" data-unpin-ws="${item.wsId}" data-unpin-tab="${item.tab.id}" title="Unpin from dashboard">
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                        </button>
                    </div>
                </div>

                <div class="pinned-tab-stats">
                    <span class="pinned-stat-pill">
                        <strong>${item.stats.accounts}</strong> Accs
                    </span>
                    <span class="pinned-stat-pill" style="color: #22d3ee;">
                        <strong>${item.stats.mains}</strong> M
                    </span>
                    <span class="pinned-stat-pill" style="color: #f472b6;">
                        <strong>${item.stats.twinks}</strong> T
                    </span>
                    ${item.stats.griefers > 0 ? `
                        <span class="pinned-stat-pill" style="color: #f87171; border-color: rgba(239, 68, 68, 0.3);">
                            <strong>${item.stats.griefers}</strong> Griefers
                        </span>
                    ` : ''}
                </div>

                <div class="pinned-tab-bottom">
                    <span class="pinned-tab-time">${formatRelativeTime(item.tab.lastEdited || item.tab.createdAt)}</span>
                    <div class="pinned-tab-links">
                        <a href="workspace.html#main" class="pinned-link-btn" data-switch-ws="${item.wsId}" data-switch-tab="${item.tab.id}" title="Open Inspector Workspace">
                            <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.2" fill="none"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
                            <span>Inspect</span>
                        </a>
                        <a href="workspace.html#ban" class="pinned-link-btn accent-amber" data-switch-ws="${item.wsId}" data-switch-tab="${item.tab.id}" title="Open Ban Matrix">
                            <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.2" fill="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                            <span>/ban</span>
                        </a>
                    </div>
                </div>
            `;

            grid.appendChild(card);
        });

        container.innerHTML = '';
        container.appendChild(grid);

        // Bind Unpin buttons
        container.querySelectorAll('[data-unpin-tab]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const wsId = btn.dataset.unpinWs;
                const tabId = btn.dataset.unpinTab;
                unpinTab(wsId, tabId);
            });
        });

        // Bind Quick Switch Links
        container.querySelectorAll('[data-switch-ws]').forEach(link => {
            link.addEventListener('click', () => {
                const wsId = link.dataset.switchWs;
                const tabId = link.dataset.switchTab;
                if (wsId) lsSet(KEYS.current, wsId);
                if (tabId) lsSet(wsKey('multiCheckActiveTab', wsId), tabId);
            });
        });
    }

    function unpinTab(wsId, tabId) {
        const tabsKey = wsKey(KEYS.tabs, wsId);
        const tabs = parseJSON(lsGet(tabsKey, '[]'), []);
        const target = tabs.find(t => t.id === tabId);
        if (target) {
            target.pinned = false;
            lsSet(tabsKey, tabs);
            recordMutation(`Unpinned forensic tab "${target.name || 'Tab'}"`, 'mutation');
            showToast(`Unpinned "<strong>${target.name || 'Tab'}</strong>"`);
            refreshAllWidgets();
            if (typeof window.refreshDashboardData === 'function') {
                window.refreshDashboardData();
            }
        }
    }

    // --------------------------------------------------------------------------
    // 4. Quick Action: [+ Quick Tab] Modal Handler
    // --------------------------------------------------------------------------
    function initQuickTabAction() {
        const btn = document.getElementById('quick-add-tab-btn');
        const modal = document.getElementById('quick-tab-modal');
        const closeBtn = document.getElementById('close-quick-tab-modal');
        const cancelBtn = document.getElementById('cancel-quick-tab-btn');
        const submitBtn = document.getElementById('submit-quick-tab-btn');

        const wsSelect = document.getElementById('quick-tab-ws');
        const nameInput = document.getElementById('quick-tab-name');
        const dataInput = document.getElementById('quick-tab-data');

        if (!btn || !modal) return;

        function openModal() {
            // Populate workspaces dropdown
            const workspaces = getAvailableWorkspaces();
            const currentWsId = lsGet(KEYS.current, 'workspace-default');

            if (wsSelect) {
                wsSelect.innerHTML = workspaces.map(ws => `
                    <option value="${ws.id}" ${ws.id === currentWsId ? 'selected' : ''}>
                        ${ws.name || 'Workspace'} ${ws.id === currentWsId ? '(Active)' : ''}
                    </option>
                `).join('');
            }

            if (nameInput) {
                nameInput.value = `Tab ${Date.now().toString().slice(-4)}`;
            }
            if (dataInput) {
                dataInput.value = '';
            }

            modal.style.display = 'flex';
            if (nameInput) nameInput.focus();
        }

        function closeModal() {
            modal.style.display = 'none';
        }

        btn.addEventListener('click', openModal);
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

        if (submitBtn) {
            submitBtn.addEventListener('click', () => {
                const targetWsId = wsSelect.value || 'workspace-default';
                const tabName = (nameInput.value || '').trim() || 'Untitled Tab';
                const rawData = (dataInput.value || '').trim();

                const tabsKey = wsKey(KEYS.tabs, targetWsId);
                const tabs = parseJSON(lsGet(tabsKey, '[]'), []);

                const newTab = {
                    id: 'tab-' + Date.now(),
                    name: tabName,
                    input: rawData,
                    output: rawData,
                    pinned: false,
                    lastEdited: Date.now()
                };

                tabs.push(newTab);
                lsSet(tabsKey, tabs);
                lsSet(wsKey('multiCheckActiveTab', targetWsId), newTab.id);

                closeModal();
                recordMutation(`Created quick tab "${tabName}" in workspace`, 'create');
                showToast(`Created tab "<strong>${tabName}</strong>" in workspace!`);
                refreshAllWidgets();

                if (typeof window.refreshDashboardData === 'function') {
                    window.refreshDashboardData();
                }
            });
        }
    }

    // --------------------------------------------------------------------------
    // 5. Quick Action: [Wipe Stale Tabs] Handler
    // --------------------------------------------------------------------------
    function initWipeStaleAction() {
        const btn = document.getElementById('wipe-stale-tabs-btn');
        const modal = document.getElementById('wipe-stale-modal');
        const closeBtn = document.getElementById('close-wipe-stale-modal');
        const cancelBtn = document.getElementById('cancel-wipe-stale-btn');
        const confirmBtn = document.getElementById('confirm-wipe-stale-btn');
        const listEl = document.getElementById('stale-tabs-preview-list');
        const countText = document.getElementById('stale-tabs-count-text');

        if (!btn || !modal) return;

        function openModal() {
            const scan = scanAllWorkspaceData();
            const stale = scan.staleTabs;

            if (stale.length === 0) {
                showToast('✨ No stale tabs detected! Workspace hygiene is optimal (100%).');
                return;
            }

            if (countText) {
                countText.textContent = `Found ${stale.length} empty or unpopulated tab${stale.length === 1 ? '' : 's'} across your workspaces:`;
            }

            if (listEl) {
                listEl.innerHTML = stale.map(item => `
                    <div class="stale-tab-item">
                        <span class="stale-tab-item-name">${item.tab.name || 'Untitled Tab'}</span>
                        <span class="stale-tab-item-ws">${item.wsName}</span>
                    </div>
                `).join('');
            }

            modal.style.display = 'flex';
        }

        function closeModal() {
            modal.style.display = 'none';
        }

        btn.addEventListener('click', openModal);
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                const scan = scanAllWorkspaceData();
                let wipedCount = 0;

                scan.workspaces.forEach(wItem => {
                    const wsId = wItem.ws.id;
                    const tabsKey = wsKey(KEYS.tabs, wsId);
                    let tabsStr = lsGet(tabsKey, null);
                    if ((!tabsStr || tabsStr === '[]') && wsId === 'workspace-default') {
                        const legacy = lsGet(KEYS.tabs, null);
                        if (legacy && legacy !== '[]') tabsStr = legacy;
                    }
                    const tabs = parseJSON(tabsStr || '[]', []);
                    const before = tabs.length;

                    // Keep non-stale tabs
                    const remaining = tabs.filter(t => {
                        const hasContent = (t.input && t.input.trim()) || (t.output && t.output.trim());
                        return !!hasContent;
                    });

                    // Ensure workspace always has at least 1 tab
                    if (remaining.length === 0) {
                        remaining.push({
                            id: 'tab-' + Date.now(),
                            name: 'Main List',
                            input: '',
                            output: '',
                            pinned: false,
                            lastEdited: Date.now()
                        });
                    }

                    wipedCount += Math.max(0, before - remaining.length);
                    lsSet(tabsKey, remaining);
                });

                closeModal();
                recordMutation(`Purged ${wipedCount} stale tabs across workspaces`, 'delete');
                showToast(`🧹 Wiped <strong>${wipedCount}</strong> stale tabs! Telemetry hygiene updated.`);
                refreshAllWidgets();

                if (typeof window.refreshDashboardData === 'function') {
                    window.refreshDashboardData();
                }
            });
        }
    }

    // --------------------------------------------------------------------------
    // 6. Quick Action: [Import JSON] & Global Drag & Drop Handler
    // --------------------------------------------------------------------------
    function initImportJsonAction() {
        const importBtn = document.getElementById('quick-import-json-btn');
        const fileInput = document.getElementById('global-json-file-input');
        const overlay = document.getElementById('drag-drop-overlay');

        if (importBtn && fileInput) {
            importBtn.addEventListener('click', () => {
                fileInput.value = '';
                fileInput.click();
            });

            fileInput.addEventListener('change', (e) => {
                const file = e.target.files && e.target.files[0];
                if (file) handleJsonFile(file);
            });
        }

        // Global Drag & Drop Events
        if (overlay) {
            let dragCounter = 0;

            window.addEventListener('dragenter', (e) => {
                e.preventDefault();
                dragCounter++;
                overlay.classList.add('active');
            });

            window.addEventListener('dragleave', (e) => {
                e.preventDefault();
                dragCounter--;
                if (dragCounter <= 0) {
                    overlay.classList.remove('active');
                    dragCounter = 0;
                }
            });

            window.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
            });

            window.addEventListener('drop', (e) => {
                e.preventDefault();
                dragCounter = 0;
                overlay.classList.remove('active');

                const files = e.dataTransfer.files;
                if (files && files.length > 0) {
                    const file = files[0];
                    if (file.name.endsWith('.json') || file.type.includes('json')) {
                        handleJsonFile(file);
                    } else {
                        showToast('⚠️ Please drop a valid Spectra JSON backup file.');
                    }
                }
            });
        }
    }

    function handleJsonFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                processImportedBackup(data, file.name);
            } catch (err) {
                showToast('❌ Invalid JSON backup format.');
                console.error(err);
            }
        };
        reader.readAsText(file);
    }

    function processImportedBackup(data, fileName) {
        // Detect schema type
        // Type A: Full Spectra backup with multiCheckWorkspaces
        if (data.workspaces || data.multiCheckWorkspaces || Array.isArray(data)) {
            const confirmed = window.confirm(`Restore Spectra backup "${fileName}"?\nThis will merge workspaces and tab records into your local sandbox.`);
            if (!confirmed) return;

            let importedWsCount = 0;
            let importedTabsCount = 0;

            // Merging full backup
            if (data.multiCheckWorkspaces || data.workspaces) {
                const newWs = data.multiCheckWorkspaces || data.workspaces || [];
                const currentWs = parseJSON(lsGet(KEYS.workspaces, '[]'), []);
                const mergedWs = [...currentWs];

                newWs.forEach(ws => {
                    if (!ws || !ws.id) return;
                    if (!mergedWs.find(w => w.id === ws.id)) {
                        mergedWs.push(ws);
                        importedWsCount++;
                    }
                });
                lsSet(KEYS.workspaces, mergedWs);

                // Import workspace tabs
                Object.keys(data).forEach(k => {
                    if (k.startsWith('multiCheckTabs_')) {
                        const tabs = data[k];
                        if (Array.isArray(tabs)) {
                            lsSet(k, tabs);
                            importedTabsCount += tabs.length;
                        }
                    }
                });
            } else if (Array.isArray(data)) {
                // Array of tabs: import into current workspace
                const curWsId = lsGet(KEYS.current, 'workspace-default');
                const tabsKey = wsKey(KEYS.tabs, curWsId);
                const currentTabs = parseJSON(lsGet(tabsKey, '[]'), []);
                data.forEach(t => {
                    if (t && t.name) {
                        currentTabs.push(t);
                        importedTabsCount++;
                    }
                });
                lsSet(tabsKey, currentTabs);
            }

            showToast(`✅ Successfully imported <strong>${importedTabsCount} tabs</strong> across <strong>${importedWsCount} workspaces</strong>!`);
            refreshAllWidgets();

            if (typeof window.refreshDashboardData === 'function') {
                window.refreshDashboardData();
            }
        } else {
            showToast('⚠️ Unrecognized backup structure.');
        }
    }

    // --------------------------------------------------------------------------
    // Refresh All Widgets
    // --------------------------------------------------------------------------
    function refreshAllWidgets() {
        try {
            const scan = scanAllWorkspaceData();
            renderHealthRadar(scan);
            renderStorageBreakdown(scan);
            renderPinnedTabs(scan);
        } catch (e) {
            console.error('Error refreshing dashboard widgets:', e);
        }
    }

    // Expose for external calls
    window.dashboardWidgetsRefresh = refreshAllWidgets;

    // Initialize on DOM ready
    function init() {
        initQuickTabAction();
        initWipeStaleAction();
        initImportJsonAction();
        refreshAllWidgets();

        // Listen for workspace switches, tab focus, or storage events
        window.addEventListener('storage', refreshAllWidgets);
        window.addEventListener('focus', refreshAllWidgets);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                refreshAllWidgets();
            }
        });

        // Hook into dashboard refresh button
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                setTimeout(refreshAllWidgets, 100);
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

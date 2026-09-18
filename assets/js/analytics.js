/**
 * Spectra Intelligence - Deep Forensics & Historical Analytics Engine
 * Modular logic for: Historical Change Detection, Cross-Workspace Duplicate Matrix,
 * and Activity Timeline Forensics.
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
        snapshots: 'multiCheckHistoricalSnapshots',
        mutations: 'multiCheckTemporalMutations',
        clearedAt: 'multiCheckTimelineClearedAt'
    };

    const RETENTION_DAYS = 7;
    const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const MAX_MUTATIONS_COUNT = 50;

    function logTemporalMutation(title, type = 'mutation') {
        try {
            const now = Date.now();
            const raw = lsGet(KEYS.mutations, '[]');
            const list = parseJSON(raw, []);
            list.unshift({
                id: 'mut-' + now + '-' + Math.random().toString(36).substr(2, 4),
                title,
                type,
                time: now
            });
            // Auto-prune items older than 7 days, max 50 items
            const pruned = list
                .filter(item => (now - Number(item.time || 0)) <= RETENTION_MS)
                .slice(0, MAX_MUTATIONS_COUNT);
            lsSet(KEYS.mutations, pruned);
        } catch (e) { }
    }
    window.logSpectraMutation = logTemporalMutation;

    // Automatic storage maintenance: prunes mutations and snapshots older than threshold
    function autoPruneOldData() {
        const now = Date.now();
        // 1. Auto-prune mutations older than 7 days and cap to MAX_MUTATIONS_COUNT
        try {
            const rawMutations = lsGet(KEYS.mutations, '[]');
            const mutations = parseJSON(rawMutations, []);
            if (Array.isArray(mutations) && mutations.length > 0) {
                const pruned = mutations
                    .filter(m => (now - Number(m.time || 0)) <= RETENTION_MS)
                    .slice(0, MAX_MUTATIONS_COUNT);
                if (pruned.length !== mutations.length) {
                    lsSet(KEYS.mutations, pruned);
                }
            }
        } catch (e) { }

        // 2. Auto-prune snapshots older than 30 days to protect localStorage space
        try {
            const SNAPSHOT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
            const rawSnaps = lsGet(KEYS.snapshots, '[]');
            const snaps = parseJSON(rawSnaps, []);
            if (Array.isArray(snaps) && snaps.length > 0) {
                const prunedSnaps = snaps
                    .filter(s => (now - Number(s.timestamp || 0)) <= SNAPSHOT_RETENTION_MS)
                    .slice(-60);
                if (prunedSnaps.length !== snaps.length) {
                    lsSet(KEYS.snapshots, prunedSnaps);
                }
            }
        } catch (e) { }
    }

    const GRIEFER_TAGS = ['Non-RP', 'Fail-RP', 'Provoking', 'GR3.1', 'GR3.2', 'DM'];
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

    function formatBytes(bytes) {
        if (!bytes || bytes <= 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    }

    function formatRelativeTime(ts) {
        if (!ts) return 'Unknown';
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

    function showToast(msg, duration = 3500, isRoast = false) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.innerHTML = `<img src="assets/images/logo1.png" alt="" class="toast-favicon" style="width:15px;height:15px;vertical-align:middle;margin-right:7px;border-radius:3px;display:inline-block;"><span>${msg}</span>`;
        toast.classList.add('show');
        toast.classList.add('visible');
        if (isRoast) toast.classList.add('roast');
        else toast.classList.remove('roast');

        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => {
            toast.classList.remove('show');
            toast.classList.remove('visible');
            toast.classList.remove('roast');
        }, duration);
    }

    // --------------------------------------------------------------------------
    // Current System Scan
    // --------------------------------------------------------------------------
    function scanSystem() {
        const workspaces = parseJSON(lsGet(KEYS.workspaces, '[]'), [
            { id: 'workspace-default', name: 'Default', color: '#38bdf8' }
        ]);

        let totalAccounts = 0;
        let mains = 0;
        let twinks = 0;
        let griefers = 0;
        let storageBytes = 0;
        const allAccounts = []; // For cross-workspace matrix
        const timelineEvents = [];

        try {
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k) storageBytes += (k.length + (localStorage.getItem(k) || '').length);
            }
        } catch (e) { }

        workspaces.forEach(ws => {
            if (!ws || !ws.id) return;
            const tabs = parseJSON(lsGet(wsKey(KEYS.tabs, ws.id), '[]'), []);

            if (ws.createdAt) {
                timelineEvents.push({
                    type: 'workspace',
                    title: `Workspace "${ws.name || 'Workspace'}" created`,
                    time: ws.createdAt,
                    color: 'dot-green'
                });
            }

            tabs.forEach(tab => {
                if (!tab) return;
                const output = tab.output || '';
                const lines = output.split('\n');

                if (tab.lastEdited || tab.createdAt) {
                    timelineEvents.push({
                        type: 'tab',
                        title: `Tab "${tab.name || 'Tab'}" updated in ${ws.name || 'Workspace'}`,
                        time: tab.lastEdited || tab.createdAt,
                        color: 'dot-amber'
                    });
                }

                lines.forEach(rawLine => {
                    const line = rawLine.trim();
                    if (!line || !line.includes('|')) return;

                    totalAccounts++;
                    const isMain = MAIN_RE.test(line);
                    const isTwink = TWINK_RE.test(line);
                    const isGriefer = GRIEFER_RE.test(line);

                    if (isMain) mains++;
                    else if (isTwink) twinks++;
                    if (isGriefer) griefers++;

                    // Extract primary account identifier (Name or ID before first | or after)
                    const parts = line.split('|').map(p => p.trim());
                    const idCandidate = parts[0] || 'Unknown';

                    allAccounts.push({
                        identity: idCandidate,
                        rawLine: line,
                        wsId: ws.id,
                        wsName: ws.name || 'Workspace',
                        wsColor: ws.color || '#38bdf8',
                        tabId: tab.id,
                        tabName: tab.name || 'Tab',
                        classification: isMain ? 'Main' : isTwink ? 'Twink' : 'Unlabeled',
                        isGriefer
                    });
                });
            });
        });

        return {
            workspaces,
            totalAccounts,
            mains,
            twinks,
            griefers,
            storageBytes,
            allAccounts,
            timelineEvents
        };
    }

    // --------------------------------------------------------------------------
    // Historical Snapshots Management
    // --------------------------------------------------------------------------
    function getSnapshots() {
        return parseJSON(lsGet(KEYS.snapshots, '[]'), []);
    }

    function saveSnapshots(snapshots) {
        lsSet(KEYS.snapshots, snapshots);
    }

    function captureSnapshot(system, manual = false) {
        const snapshots = getSnapshots();
        const latest = snapshots[snapshots.length - 1];

        // Rate-limit auto snapshots (unless manual or account count changed)
        if (!manual && latest) {
            const timeDiff = Date.now() - latest.timestamp;
            const sameAccounts = latest.totalAccounts === system.totalAccounts;
            if (timeDiff < 30 * 60 * 1000 && sameAccounts) {
                return; // Skip redundant snapshot
            }
        }

        const newSnapshot = {
            id: 'snap-' + Date.now(),
            timestamp: Date.now(),
            totalAccounts: system.totalAccounts,
            mains: system.mains,
            twinks: system.twinks,
            griefers: system.griefers,
            workspacesCount: system.workspaces.length,
            storageBytes: system.storageBytes
        };

        snapshots.push(newSnapshot);
        // Keep last 60 snapshots to conserve storage
        if (snapshots.length > 60) snapshots.shift();
        saveSnapshots(snapshots);

        if (manual) {
            logTemporalMutation(`Forensic snapshot captured (${system.totalAccounts} accounts)`, 'create');
            showToast('Forensic snapshot captured successfully!');
            renderAll();
        }
    }

    function renderSnapshots(system) {
        const snapshots = getSnapshots();
        const tbody = document.getElementById('snapshots-table-body');
        const countBadge = document.getElementById('snapshots-total-badge');
        const velocityVal = document.getElementById('velocity-value');
        const velocityBadge = document.getElementById('velocity-badge');
        const mainsTrendVal = document.getElementById('mains-trend-value');
        const grieferTrendVal = document.getElementById('griefer-trend-value');

        if (countBadge) countBadge.textContent = `${snapshots.length} snapshots`;

        // Calculate Velocity & Deltas
        if (snapshots.length >= 2) {
            const first = snapshots[0];
            const last = snapshots[snapshots.length - 1];
            const delta = last.totalAccounts - first.totalAccounts;
            const pct = first.totalAccounts > 0 ? Math.round((delta / first.totalAccounts) * 100) : 0;

            if (velocityVal) velocityVal.textContent = delta >= 0 ? `+${delta}` : `${delta}`;
            if (velocityBadge) {
                velocityBadge.textContent = `${delta >= 0 ? '+' : ''}${pct}% net`;
                velocityBadge.className = `trend-badge ${delta >= 0 ? 'positive' : 'negative'}`;
            }
        } else {
            if (velocityVal) velocityVal.textContent = `${system.totalAccounts}`;
            if (velocityBadge) {
                velocityBadge.textContent = 'Baseline';
                velocityBadge.className = 'trend-badge neutral';
            }
        }

        if (mainsTrendVal) {
            const mainPct = system.totalAccounts > 0 ? Math.round((system.mains / system.totalAccounts) * 100) : 0;
            mainsTrendVal.textContent = `${mainPct}%`;
        }

        if (grieferTrendVal) {
            const grieferPct = system.totalAccounts > 0 ? ((system.griefers / system.totalAccounts) * 100).toFixed(1) : 0;
            grieferTrendVal.textContent = `${grieferPct}%`;
        }

        if (!tbody) return;

        if (snapshots.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; color: var(--text-3); padding: 30px;">
                        No forensic snapshots recorded yet. Click "+ Capture Snapshot" above to log your first record.
                    </td>
                </tr>
            `;
            return;
        }

        // Render table in reverse chronological order
        const rows = snapshots.slice().reverse().map((snap, idx, arr) => {
            const prevSnap = arr[idx + 1];
            let deltaHtml = '<span class="snapshot-delta" style="color: var(--text-3);">--</span>';

            if (prevSnap) {
                const diff = snap.totalAccounts - prevSnap.totalAccounts;
                if (diff > 0) {
                    deltaHtml = `<span class="snapshot-delta" style="color: #34d399;">+${diff}</span>`;
                } else if (diff < 0) {
                    deltaHtml = `<span class="snapshot-delta" style="color: #f87171;">${diff}</span>`;
                } else {
                    deltaHtml = `<span class="snapshot-delta" style="color: var(--text-3);">0</span>`;
                }
            }

            return `
                <tr>
                    <td><strong>${new Date(snap.timestamp).toLocaleString()}</strong></td>
                    <td><strong>${snap.totalAccounts}</strong> accounts</td>
                    <td>${deltaHtml}</td>
                    <td>
                        <span style="color: #22d3ee; font-weight: 600;">${snap.mains}M</span> / 
                        <span style="color: #f472b6; font-weight: 600;">${snap.twinks}T</span>
                    </td>
                    <td>
                        <span style="color: ${snap.griefers > 0 ? '#f87171' : 'var(--text-3)'}; font-weight: 600;">
                            ${snap.griefers}
                        </span>
                    </td>
                    <td>${formatBytes(snap.storageBytes)}</td>
                    <td style="text-align: right;">
                        <button type="button" class="snapshot-del-btn" data-delete-snap="${snap.id}" title="Delete snapshot">
                            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        tbody.innerHTML = rows;

        // Bind delete buttons
        tbody.querySelectorAll('[data-delete-snap]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.deleteSnap;
                const updated = getSnapshots().filter(s => s.id !== id);
                saveSnapshots(updated);
                logTemporalMutation('Forensic snapshot record deleted', 'delete');
                showToast('Deleted snapshot record.');
                renderAll();
            });
        });
    }

    // --------------------------------------------------------------------------
    // Cross-Workspace Collision & Duplicate Matrix
    // --------------------------------------------------------------------------
    function renderCollisionMatrix(system) {
        const container = document.getElementById('collision-cards-container');
        const countBadge = document.getElementById('collision-count-badge');
        const searchInput = document.getElementById('collision-search-input');
        if (!container) return;

        // Group accounts by identity key
        const identityMap = new Map();

        system.allAccounts.forEach(acc => {
            const key = acc.identity.toLowerCase();
            if (!identityMap.has(key)) {
                identityMap.set(key, []);
            }
            identityMap.get(key).push(acc);
        });

        // Filter for identities present across multiple DIFFERENT workspaces
        const collisions = [];
        identityMap.forEach((occurrences, key) => {
            const wsSet = new Set(occurrences.map(o => o.wsId));
            if (wsSet.size > 1) {
                // Check for classification conflict
                const classSet = new Set(occurrences.map(o => o.classification));
                const hasConflict = classSet.size > 1;

                collisions.push({
                    key,
                    identity: occurrences[0].identity,
                    occurrences,
                    wsCount: wsSet.size,
                    hasConflict
                });
            }
        });

        if (countBadge) {
            countBadge.textContent = `${collisions.length} shared identities`;
        }

        const filterQuery = (searchInput && searchInput.value || '').trim().toLowerCase();
        const filtered = collisions.filter(c => !filterQuery || c.key.includes(filterQuery));

        if (filtered.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; padding: 40px 20px; text-align: center; color: var(--text-2); background: var(--surface); border: 1px dashed var(--border); border-radius: var(--radius-md);">
                    <svg viewBox="0 0 24 24" width="36" height="36" stroke="currentColor" stroke-width="1.8" fill="none" style="opacity: 0.4; margin-bottom: 10px;">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <h4 style="margin: 0 0 6px 0; color: var(--text-1);">No Cross-Workspace Collisions Found</h4>
                    <p style="margin: 0; font-size: 0.82rem;">All workspaces currently maintain distinct account identity registries.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = filtered.map(c => `
            <article class="collision-card ${c.hasConflict ? 'has-conflict' : ''}">
                <div class="collision-identity">
                    <span class="collision-name">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                        ${c.identity}
                    </span>
                    ${c.hasConflict ? '<span class="collision-conflict-badge"><svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.2" fill="none" style="vertical-align: -1px; margin-right: 4px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>Classification Conflict</span>' : ''}
                </div>

                <div class="collision-occurrences">
                    ${c.occurrences.map(o => `
                        <div class="collision-occurrence-item">
                            <div class="collision-ws-tag">
                                <span style="width: 8px; height: 8px; border-radius: 50%; background: ${o.wsColor};"></span>
                                <span>${o.wsName}</span>
                                <span class="collision-tab-tag">/ ${o.tabName}</span>
                            </div>
                            <span class="collision-class-badge" style="background: ${o.classification === 'Main' ? 'rgba(34, 211, 238, 0.15)' : o.classification === 'Twink' ? 'rgba(244, 114, 182, 0.15)' : 'rgba(148, 163, 184, 0.15)'}; color: ${o.classification === 'Main' ? '#22d3ee' : o.classification === 'Twink' ? '#f472b6' : 'var(--text-2)'};">
                                ${o.classification}
                            </span>
                        </div>
                    `).join('')}
                </div>
            </article>
        `).join('');
    }

    // --------------------------------------------------------------------------
    // Temporal Activity Timeline
    // --------------------------------------------------------------------------
    function renderTimeline(system) {
        const container = document.getElementById('timeline-list');
        if (!container) return;

        // Automatically delete / prune old entries
        autoPruneOldData();

        const now = Date.now();
        const clearedAt = Number(lsGet(KEYS.clearedAt, '0')) || 0;

        // 1. Workspace and Tab system events
        const events = [...system.timelineEvents];

        // 2. Stored custom mutations
        const storedMutations = parseJSON(lsGet(KEYS.mutations, '[]'), []);
        storedMutations.forEach(m => {
            events.push({
                type: m.type || 'mutation',
                title: m.title || 'Data mutation recorded',
                time: m.time,
                color: m.type === 'delete' ? 'dot-red' : m.type === 'create' ? 'dot-green' : 'timeline-dot'
            });
        });

        // 3. Historical snapshots
        const snapshots = getSnapshots();
        snapshots.forEach(s => {
            events.push({
                type: 'snapshot',
                title: `Forensic snapshot captured (${s.totalAccounts} accounts)`,
                time: s.timestamp,
                color: 'timeline-dot'
            });
        });

        // 4. Auto-delete: filter out events older than 7 days, AND filter out events cleared before clearedAt
        const validEvents = events.filter(e => {
            const t = Number(e.time || 0);
            if (!t) return false;
            // Auto-delete / ignore events older than 7 days
            if ((now - t) > RETENTION_MS) return false;
            // Ignore events prior to user clearing
            if (t <= clearedAt) return false;
            return true;
        });

        // Sort descending (newest first)
        validEvents.sort((a, b) => Number(b.time || 0) - Number(a.time || 0));

        const displayEvents = validEvents.slice(0, 25);

        if (displayEvents.length === 0) {
            const wasCleared = clearedAt > 0;
            container.innerHTML = `
                <div class="timeline-empty-state">
                    <svg viewBox="0 0 24 24" width="28" height="28" stroke="currentColor" stroke-width="1.8" fill="none"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
                    <div style="font-weight: 600; color: var(--text-1); font-size: 0.95rem;">${wasCleared ? 'Timeline Cleared' : 'No Recent Activity'}</div>
                    <p style="color: var(--text-3); font-size: 0.8rem; margin: 0; max-width: 380px;">
                        ${wasCleared 
                            ? 'Past mutations and activity history were cleared. Auto-pruning (&gt;7d) is active. New mutations will record here automatically.'
                            : 'No mutations recorded in the last 7 days. Modifying tabs or workspaces will record events here automatically.'}
                    </p>
                    ${wasCleared ? `
                        <button type="button" class="btn btn-secondary" id="restore-timeline-btn" style="margin-top: 6px; font-size: 0.76rem; padding: 5px 12px;">
                            Restore Full Activity History
                        </button>
                    ` : ''}
                </div>
            `;

            const restoreBtn = document.getElementById('restore-timeline-btn');
            if (restoreBtn) {
                restoreBtn.addEventListener('click', () => {
                    localStorage.removeItem(KEYS.clearedAt);
                    showToast('Guilt got the better of you? Full activity history resurrected.', 3500, true);
                    const updatedSystem = scanSystem();
                    renderTimeline(updatedSystem);
                });
            }
            return;
        }

        container.innerHTML = displayEvents.map(e => `
            <div class="timeline-item">
                <div class="timeline-dot ${e.color || ''}"></div>
                <div class="timeline-content">
                    <span class="timeline-desc">${e.title}</span>
                    <span class="timeline-time">${formatRelativeTime(e.time)}</span>
                </div>
            </div>
        `).join('');
    }

    // --------------------------------------------------------------------------
    // Master Render & Event Bindings
    // --------------------------------------------------------------------------
    function renderAll() {
        const system = scanSystem();
        captureSnapshot(system, false); // auto snapshot check
        renderSnapshots(system);
        renderCollisionMatrix(system);
        renderTimeline(system);
    }

    function init() {
        renderAll();

        // Bind Capture Snapshot Button
        const snapBtn = document.getElementById('capture-snapshot-btn');
        if (snapBtn) {
            snapBtn.addEventListener('click', () => {
                const system = scanSystem();
                captureSnapshot(system, true);
            });
        }

        // Bind Export Snapshots Button
        const exportBtn = document.getElementById('export-snapshots-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                const data = JSON.stringify(getSnapshots(), null, 2);
                const blob = new Blob([data], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `spectra-snapshots-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
                showToast('Exported snapshots JSON.');
            });
        }

        // Bind Collision Search Input
        const collisionInput = document.getElementById('collision-search-input');
        if (collisionInput) {
            collisionInput.addEventListener('input', () => {
                const system = scanSystem();
                renderCollisionMatrix(system);
            });
        }


        let roastIndex = 0;
        const CLEAR_ROASTS = [
            "Timeline incinerated! What shady evidence were you trying to bury?",
            "Running from your past faster than a griefer dodging a ban hammer, huh?",
            "Plausible deniability unlocked: Even the feds couldn't trace those mutations now.",
            "Evidence shredded! Moving like a covert operative with zero paper trail.",
            "Poof! Wiped cleaner than an admin's search history before an audit.",
            "Timeline nuked! Pretending you never touched those tabs, are we?",
            "Fresh slate! Your browser storage thanks you, but your conscience remembers.",
            "Scorched earth! 0 logs, 0 traces, 100% suspicious behavior detected."
        ];

        // Bind Clear Timeline Button with Roast Notification
        const clearTimelineBtn = document.getElementById('clear-timeline-btn');
        if (clearTimelineBtn) {
            clearTimelineBtn.addEventListener('click', () => {
                const now = Date.now();
                lsSet(KEYS.clearedAt, String(now));
                lsSet(KEYS.mutations, []);

                const roast = CLEAR_ROASTS[roastIndex % CLEAR_ROASTS.length];
                roastIndex++;
                showToast(roast, 4200, true);

                const system = scanSystem();
                renderTimeline(system);
            });
        }

        // Refresh Button
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                renderAll();
                showToast('Refreshed analytics metrics.');
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

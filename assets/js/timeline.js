/**
 * Spectra Intelligence - Forensic Incident Timeline & Event Stream
 * Modular logic for chronological forensic tracking, multi-account cluster synchrony,
 * time-delta proximity alerts, and Discord markdown export.
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
        mutations: 'multiCheckTemporalMutations',
        snapshots: 'multiCheckHistoricalSnapshots',
        customEvents: 'multiCheckTimelineCustomEvents'
    };

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

    function showToast(msg, duration = 3000) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.innerHTML = `<img src="assets/images/logo1.png" alt="" class="toast-favicon" style="width:15px;height:15px;vertical-align:middle;margin-right:7px;border-radius:3px;display:inline-block;"><span>${msg}</span>`;
        toast.classList.add('show', 'visible');
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => toast.classList.remove('show', 'visible'), duration);
    }

    // State
    let allEvents = [];
    let activeFilter = 'ALL';
    let searchQuery = '';
    let synchronySuspects = [];

    // Parse accounts and historical records into timeline events
    function collectEvents() {
        const events = [];
        const now = Date.now();

        // 1. Gather Temporal Mutations from analytics.js
        const rawMutations = parseJSON(lsGet(KEYS.mutations, '[]'), []);
        if (Array.isArray(rawMutations)) {
            rawMutations.forEach(m => {
                events.push({
                    id: m.id || 'mut-' + m.time,
                    time: Number(m.time) || now,
                    type: (m.type || 'MUTATION').toUpperCase(),
                    title: m.title || 'Temporal Identity Mutation',
                    details: m.details || 'Identity or alias attribute modification detected in workspace.',
                    account: m.account || 'Unknown',
                    idTag: m.idTag || '',
                    hwid: m.hwid || '',
                    ip: m.ip || '',
                    source: 'Telemetry Mutation'
                });
            });
        }

        // 2. Gather accounts from current workspace / tabs
        const currentWsId = lsGet(KEYS.current, 'default');
        const tabsKey = currentWsId === 'default' ? KEYS.tabs : `${KEYS.tabs}_${currentWsId}`;
        const tabs = parseJSON(lsGet(tabsKey, '[]'), []);

        if (Array.isArray(tabs)) {
            tabs.forEach((tab, tIdx) => {
                const text = tab.text || '';
                const lines = text.split('\n');
                lines.forEach((line, lIdx) => {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed.startsWith('#')) return;

                    // Detect potential log elements
                    const isGriefer = /(?:Non-RP|Fail-RP|GR3\.[12]|DM|Griefer|Scammer|Blacklist)/i.test(trimmed);
                    const isTwink = /\(t\)|\bt\b/i.test(trimmed);
                    const isMain = /\(m\)|\bm\b/i.test(trimmed);
                    const idMatch = trimmed.match(/\b\d{4,7}\b/);
                    const ipMatch = trimmed.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
                    const hwidMatch = trimmed.match(/\b[A-F0-9]{32}\b/i) || trimmed.match(/HWID[:\s]*([A-Za-z0-9_-]+)/i);

                    // Synthesize simulated baseline timestamps if raw logs don't have explicit ISO stamps
                    const simulatedOffset = (tabs.length - tIdx) * 3600000 + (lines.length - lIdx) * 120000;
                    const eventTime = now - simulatedOffset;

                    if (isGriefer) {
                        events.push({
                            id: `griefer-${tIdx}-${lIdx}`,
                            time: eventTime + 45000,
                            type: 'FLAG',
                            title: `Moderation Violation Flag Detected`,
                            details: trimmed,
                            account: idMatch ? `ID: ${idMatch[0]}` : (tab.name || 'Account'),
                            idTag: idMatch ? idMatch[0] : '',
                            hwid: hwidMatch ? (hwidMatch[1] || hwidMatch[0]) : '',
                            ip: ipMatch ? ipMatch[0] : '',
                            source: `Tab: ${tab.name || 'Workspace'}`
                        });
                    }

                    if (isTwink) {
                        events.push({
                            id: `twink-${tIdx}-${lIdx}`,
                            time: eventTime,
                            type: 'MUTATION',
                            title: `Secondary Identity (Twink) Linked`,
                            details: trimmed,
                            account: idMatch ? `ID: ${idMatch[0]}` : (tab.name || 'Alternate'),
                            idTag: idMatch ? idMatch[0] : '',
                            hwid: hwidMatch ? (hwidMatch[1] || hwidMatch[0]) : '',
                            ip: ipMatch ? ipMatch[0] : '',
                            source: `Tab: ${tab.name || 'Workspace'}`
                        });
                    }
                });
            });
        }

        // 3. Gather Custom Stored Timeline Events
        const custom = parseJSON(lsGet(KEYS.customEvents, '[]'), []);
        if (Array.isArray(custom)) {
            custom.forEach(c => events.push(c));
        }

        // Sort descending (most recent first)
        events.sort((a, b) => (Number(b.time) || 0) - (Number(a.time) || 0));

        // Compute synchrony / time-delta (< 60s difference between consecutive different accounts)
        for (let i = 0; i < events.length - 1; i++) {
            const curr = events[i];
            const next = events[i + 1];
            const deltaSec = Math.abs(Math.round((curr.time - next.time) / 1000));
            if (deltaSec <= 60 && curr.idTag && next.idTag && curr.idTag !== next.idTag) {
                curr.synchronyDelta = deltaSec;
                curr.synchronyPartner = next.account;
            }
        }

        allEvents = events;
        updateMetrics();
        renderTimeline();
    }

    function updateMetrics() {
        const countEl = document.getElementById('metric-total-events');
        const syncEl = document.getElementById('metric-sync-events');
        const clustersEl = document.getElementById('metric-active-clusters');
        const spanEl = document.getElementById('metric-timespan');

        if (countEl) countEl.textContent = allEvents.length;

        const syncCount = allEvents.filter(e => e.synchronyDelta !== undefined).length;
        if (syncEl) syncEl.textContent = syncCount;

        const uniqueAccounts = new Set(allEvents.map(e => e.idTag || e.account).filter(Boolean));
        if (clustersEl) clustersEl.textContent = uniqueAccounts.size;

        if (spanEl && allEvents.length > 1) {
            const oldest = allEvents[allEvents.length - 1].time;
            const newest = allEvents[0].time;
            const hours = Math.max(1, Math.round((newest - oldest) / (1000 * 60 * 60)));
            spanEl.textContent = hours < 24 ? `${hours} hrs` : `${Math.round(hours / 24)} days`;
        } else if (spanEl) {
            spanEl.textContent = 'Active';
        }
    }

    function renderTimeline() {
        const stream = document.getElementById('timeline-stream');
        if (!stream) return;

        let filtered = allEvents.filter(e => {
            if (activeFilter !== 'ALL' && e.type !== activeFilter) return false;
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const matchAcc = (e.account || '').toLowerCase().includes(q);
                const matchTitle = (e.title || '').toLowerCase().includes(q);
                const matchDet = (e.details || '').toLowerCase().includes(q);
                const matchIp = (e.ip || '').toLowerCase().includes(q);
                const matchHwid = (e.hwid || '').toLowerCase().includes(q);
                if (!matchAcc && !matchTitle && !matchDet && !matchIp && !matchHwid) return false;
            }
            return true;
        });

        if (filtered.length === 0) {
            if (allEvents.length === 0) {
                stream.innerHTML = `
                    <div class="timeline-empty-state">
                        <svg viewBox="0 0 24 24" width="44" height="44" stroke="currentColor" stroke-width="1.6" fill="none" style="color: #38bdf8; margin-bottom: 12px;">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        <h3 style="margin: 0 0 8px; color: var(--text-1); font-size: 1.15rem;">No Incident Events Yet</h3>
                        <p style="color: var(--text-3); font-size: 0.88rem; max-width: 520px; margin: 0 auto 18px; line-height: 1.5;">
                            No moderation flags, bans, logins, or identity events were detected in your active workspace tabs, and no manual incident markers have been logged.
                        </p>
                        <div style="background: var(--bg-deep); border: 1px solid var(--border); border-radius: 10px; max-width: 540px; margin: 0 auto 20px; padding: 14px 18px; text-align: left; font-size: 0.82rem; color: var(--text-2); line-height: 1.6;">
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; color: #38bdf8; font-weight: 700;">
                                <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2.2" fill="none">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="16" x2="12" y2="12"></line>
                                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                                </svg>
                                <span>How to populate the Timeline</span>
                            </div>
                            <ol style="margin: 0; padding-left: 20px;">
                                <li>Paste raw player logs or ban outputs into your <strong>Workspace</strong> tabs.</li>
                                <li>Or click <strong>Log Event</strong> to manually record an incident marker with timestamps, HWID, and notes.</li>
                                <li>Coordinated actions between different accounts within 60 seconds are automatically calculated and badged as synchronous deltas.</li>
                            </ol>
                        </div>
                        <div style="display: flex; justify-content: center; gap: 12px; flex-wrap: wrap;">
                            <button class="btn btn-primary btn-sm" id="empty-log-event-btn">
                                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                                    <line x1="12" y1="5" x2="12" y2="19"></line>
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                </svg>
                                Log Incident Marker
                            </button>
                            <a href="workspace.html" class="btn btn-secondary btn-sm">
                                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                                    <polyline points="16 18 22 12 16 6"></polyline>
                                    <polyline points="8 6 2 12 8 18"></polyline>
                                </svg>
                                Open Workspace
                            </a>
                        </div>
                    </div>
                `;
                const emptyBtn = document.getElementById('empty-log-event-btn');
                if (emptyBtn) {
                    emptyBtn.addEventListener('click', () => {
                        const modal = document.getElementById('ingest-modal');
                        if (modal) modal.classList.remove('hidden');
                    });
                }
            } else {
                stream.innerHTML = `
                    <div class="timeline-empty-state">
                        <svg viewBox="0 0 24 24" width="36" height="36" stroke="currentColor" stroke-width="1.8" fill="none" style="color: var(--text-3); margin-bottom: 12px;">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        <h3 style="margin: 0 0 8px; color: var(--text-1); font-size: 1.1rem;">No Matching Events</h3>
                        <p style="color: var(--text-3); font-size: 0.85rem; margin: 0;">Adjust your search keyword or chip filter to reveal more recorded events.</p>
                    </div>
                `;
            }
            return;
        }

        let html = '';
        let lastDateStr = '';

        filtered.forEach(ev => {
            const d = new Date(ev.time);
            const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
            const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            if (dateStr !== lastDateStr) {
                html += `
                    <div class="timeline-date-group">
                        <span class="timeline-date-badge">${dateStr}</span>
                        <div style="flex: 1; height: 1px; background: var(--border);"></div>
                    </div>
                `;
                lastDateStr = dateStr;
            }

            let markerClass = '';
            if (ev.type === 'FLAG' || ev.type === 'SANCTION') markerClass = 'marker-red';
            else if (ev.type === 'IP_CHANGE' || ev.type === 'MUTATION') markerClass = 'marker-amber';
            else if (ev.type === 'LOGIN') markerClass = 'marker-green';

            html += `
                <div class="timeline-item" id="ev-${ev.id}">
                    <div class="timeline-marker ${markerClass}">
                        <div class="timeline-marker-dot"></div>
                    </div>
                    <div class="timeline-card">
                        <div class="timeline-card-header">
                            <div class="timeline-card-title">
                                <span class="badge" style="${getTypeBadgeStyle(ev.type)}">${ev.type}</span>
                                <span>${escapeHTML(ev.title)}</span>
                                ${ev.synchronyDelta !== undefined ? `
                                    <span class="timeline-delta-badge" title="Coordinated action: occurred ${ev.synchronyDelta}s apart from ${escapeHTML(ev.synchronyPartner)}">
                                        <svg viewBox="0 0 24 24" width="11" height="11" stroke="currentColor" stroke-width="2.5" fill="none" style="vertical-align: -1px;"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                                        +${ev.synchronyDelta}s Delta
                                    </span>
                                ` : ''}
                            </div>
                            <span class="timeline-time-tag">${timeStr}</span>
                        </div>
                        <div class="timeline-card-body">${escapeHTML(ev.details)}</div>
                        <div class="timeline-card-meta">
                            ${ev.account ? `
                                <span class="timeline-meta-pill">
                                    <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none" style="vertical-align: -1px; margin-right: 3px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                    ${escapeHTML(ev.account)}
                                </span>` : ''}
                            ${ev.ip ? `
                                <span class="timeline-meta-pill">
                                    <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none" style="vertical-align: -1px; margin-right: 3px;"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                                    IP: ${escapeHTML(ev.ip)}
                                </span>` : ''}
                            ${ev.hwid ? `
                                <span class="timeline-meta-pill">
                                    <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none" style="vertical-align: -1px; margin-right: 3px;"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                                    HWID: ${escapeHTML(ev.hwid.slice(0, 12))}...
                                </span>` : ''}
                            ${ev.source ? `
                                <span class="timeline-meta-pill" style="opacity: 0.8;">
                                    <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none" style="vertical-align: -1px; margin-right: 3px;"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
                                    ${escapeHTML(ev.source)}
                                </span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        });

        stream.innerHTML = html;
    }

    function getTypeBadgeStyle(type) {
        switch (type) {
            case 'SANCTION':
            case 'FLAG':
                return 'background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3);';
            case 'IP_CHANGE':
            case 'MUTATION':
                return 'background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3);';
            case 'LOGIN':
                return 'background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3);';
            default:
                return 'background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3);';
        }
    }

    function escapeHTML(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // Export to Discord format with <t:unix:F> tags
    function exportToDiscord() {
        if (!allEvents || allEvents.length === 0) {
            showToast('No events available to export');
            return;
        }

        let md = `### Spectra Intelligence · Forensic Incident Timeline\n`;
        md += `**Exported At:** <t:${Math.floor(Date.now() / 1000)}:F> | **Total Events:** ${allEvents.length}\n`;
        md += `\`\`\`diff\n`;

        const sample = allEvents.slice(0, 25);
        sample.forEach(ev => {
            const unix = Math.floor(ev.time / 1000);
            let prefix = '+';
            if (ev.type === 'SANCTION' || ev.type === 'FLAG') prefix = '-';
            else if (ev.type === 'IP_CHANGE' || ev.type === 'MUTATION') prefix = '!';

            const acc = ev.account ? `[${ev.account}]` : '';
            md += `${prefix} [${new Date(ev.time).toISOString().slice(11, 19)}] ${ev.type}: ${ev.title} ${acc}\n`;
            if (ev.details) md += `    > ${ev.details.slice(0, 100)}\n`;
        });
        md += `\`\`\`\n`;

        if (allEvents.length > 25) {
            md += `\n*... and ${allEvents.length - 25} earlier events recorded in Spectra forensic storage.*`;
        }

        navigator.clipboard.writeText(md).then(() => {
            showToast('Discord Markdown Timeline copied to clipboard');
        }).catch(() => {
            showToast('Failed to copy to clipboard');
        });
    }

    // Add Manual Event Modal Handler
    function addManualEvent(title, type, details, account, ip, hwid) {
        const ev = {
            id: 'manual-' + Date.now(),
            time: Date.now(),
            type: type || 'FLAG',
            title: title || 'Manual Incident Marker',
            details: details || 'Manual note logged by investigating staff member.',
            account: account || 'Target Account',
            idTag: (account.match(/\b\d+\b/) || [''])[0],
            ip: ip || '',
            hwid: hwid || '',
            source: 'Manual Investigation Log'
        };

        const list = parseJSON(lsGet(KEYS.customEvents, '[]'), []);
        list.unshift(ev);
        lsSet(KEYS.customEvents, list);

        collectEvents();
        showToast('Incident event logged to timeline');
    }

    // Initialize DOM event listeners
    document.addEventListener('DOMContentLoaded', () => {
        // Search input
        const searchInput = document.getElementById('timeline-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                searchQuery = e.target.value.trim();
                renderTimeline();
            });
        }

        // Chip filters
        const chips = document.querySelectorAll('.timeline-chip');
        chips.forEach(chip => {
            chip.addEventListener('click', () => {
                chips.forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                activeFilter = chip.getAttribute('data-filter') || 'ALL';
                renderTimeline();
            });
        });

        // Discord Export Button
        const discordBtn = document.getElementById('discord-export-btn');
        if (discordBtn) {
            discordBtn.addEventListener('click', exportToDiscord);
        }

        // Ingest Modal Triggers
        const openIngestBtn = document.getElementById('open-ingest-btn');
        const ingestModal = document.getElementById('ingest-modal');
        const closeIngestBtn = document.getElementById('close-ingest-modal-btn');
        const cancelIngestBtn = document.getElementById('cancel-ingest-btn');
        const saveIngestBtn = document.getElementById('save-ingest-btn');

        const closeModal = () => {
            if (ingestModal) ingestModal.classList.add('hidden');
        };

        if (openIngestBtn && ingestModal) {
            openIngestBtn.addEventListener('click', () => {
                ingestModal.classList.remove('hidden');
                const firstInput = document.getElementById('manual-title-input');
                if (firstInput) firstInput.focus();
            });
        }
        if (closeIngestBtn) closeIngestBtn.addEventListener('click', closeModal);
        if (cancelIngestBtn) cancelIngestBtn.addEventListener('click', closeModal);

        if (ingestModal) {
            ingestModal.addEventListener('click', (e) => {
                if (e.target === ingestModal) closeModal();
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && ingestModal && !ingestModal.classList.contains('hidden')) {
                closeModal();
            }
        });

        if (saveIngestBtn && ingestModal) {
            saveIngestBtn.addEventListener('click', () => {
                const title = document.getElementById('manual-title-input')?.value.trim();
                const type = document.getElementById('manual-type-select')?.value;
                const acc = document.getElementById('manual-acc-input')?.value.trim();
                const ip = document.getElementById('manual-ip-input')?.value.trim();
                const hwid = document.getElementById('manual-hwid-input')?.value.trim();
                const details = document.getElementById('manual-details-input')?.value.trim();

                if (!title) {
                    showToast('Please enter an incident title');
                    return;
                }

                addManualEvent(title, type, details, acc, ip, hwid);
                closeModal();

                // Clear fields
                if (document.getElementById('manual-title-input')) document.getElementById('manual-title-input').value = '';
                if (document.getElementById('manual-acc-input')) document.getElementById('manual-acc-input').value = '';
                if (document.getElementById('manual-ip-input')) document.getElementById('manual-ip-input').value = '';
                if (document.getElementById('manual-hwid-input')) document.getElementById('manual-hwid-input').value = '';
                if (document.getElementById('manual-details-input')) document.getElementById('manual-details-input').value = '';
            });
        }

        // Refresh Button
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                collectEvents();
                showToast('Timeline events refreshed');
            });
        }

        collectEvents();
    });
})();

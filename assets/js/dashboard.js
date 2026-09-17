(() => {
    'use strict';

    let currentTheme = 'dark';
    try {
        currentTheme = localStorage.getItem('multiCheckTheme') || localStorage.getItem('spectraTheme') || 'dark';
    } catch (e) { }
    document.documentElement.setAttribute('data-theme', currentTheme);

    const KEYS = {
        workspaces: 'multiCheckWorkspaces',
        current: 'multiCheckCurrentWorkspace',
        tabs: 'multiCheckTabs',
        groups: 'multiCheckGroups'
    };

    const DEFAULT_WORKSPACE_ID = 'workspace-default';
    const STORAGE_LIMIT = 5 * 1024 * 1024;
    const GRIEFER_TAGS = ['Non-RP', 'Fail-RP', 'Provoking', 'GR3.1', 'GR3.2', 'DM'];
    const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const escapeRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const GRIEFER_RE = new RegExp(`(?:^|[^a-z0-9])(${GRIEFER_TAGS.map(escapeRegex).join('|')})(?:[^a-z0-9]|$)`, 'i');
    const MAIN_RE = /\(\s*m\s*\)|\bm\s*$/i;
    const TWINK_RE = /\(\s*t\s*\)|\bt\s*$/i;

    const state = {
        loadedAt: 0,
        expanded: new Set(),
        wsSearch: '',
        tabSearch: '',
        wsSort: 'default',
        tabSort: 'default',
        data: null,
        hiddenStats: new Set(),
        statsCollapsed: false
    };

    const $ = id => document.getElementById(id);
    const els = {
        backBtn: $('back-btn'),
        refreshBtn: $('refresh-btn'),
        lastUpdated: $('last-updated'),
        statAccounts: $('stat-accounts'),
        statTabs: $('stat-tabs'),
        statWorkspaces: $('stat-workspaces'),
        statGroups: $('stat-groups'),
        statMains: $('stat-mains'),
        statTwinks: $('stat-twinks'),
        statGriefers: $('stat-griefers'),
        statStorage: $('stat-storage'),
        statsGrid: $('stats-grid'),
        metricsHeader: $('metrics-section-header'),
        metricsCounter: $('metrics-counter'),
        metricsRestoreBtn: $('metrics-restore-btn'),
        metricsHiddenCount: $('metrics-hidden-count'),
        metricsToggleBtn: $('metrics-toggle-btn'),
        metricsToggleIcon: $('metrics-toggle-icon'),
        metricsToggleLabel: $('metrics-toggle-label'),
        statsCollapsedBanner: $('stats-collapsed-banner'),
        statsCollapsedText: $('stats-collapsed-text'),
        statsExpandBtn: $('stats-expand-btn'),
        distTotal: $('dist-total'),
        distMains: $('dist-mains'),
        distTwinks: $('dist-twinks'),
        distUnlabeled: $('dist-unlabeled'),
        distMainsCount: $('dist-mains-count'),
        distTwinksCount: $('dist-twinks-count'),
        distUnlabeledCount: $('dist-unlabeled-count'),
        wsSearch: $('ws-search'),
        wsSort: $('ws-sort'),
        wsList: $('workspaces-list'),
        tabsSearch: $('tabs-search'),
        tabsSort: $('tabs-sort'),
        tabsList: $('tabs-list'),
        tabsWsName: $('tabs-workspace-name'),
        groupsList: $('groups-list'),
        groupsWsName: $('groups-workspace-name'),
        storageUsed: $('storage-used'),
        storagePercent: $('storage-percent'),
        storageBar: $('storage-progress') || $('storage-bar'),
        storageProgress: $('storage-progress'),
        storageKeys: $('storage-keys'),
        exportBtn: $('export-btn'),
        themeToggleBtn: $('theme-toggle-btn'),
        portalBanGen: $('portal-ban-gen'),
        launchBanGenBtn: $('launch-ban-gen-btn'),
        toast: $('toast')
    };

    function lsGet(key, fallback) {
        try {
            const v = localStorage.getItem(key);
            return v === null ? fallback : v;
        } catch (e) {
            return fallback;
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

    function wsKey(base, workspaceId) {
        return `${base}_${workspaceId}`;
    }

    function formatBytes(bytes) {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    }

    function safeColor(color) {
        return typeof color === 'string' && /^#[0-9a-f]{3,8}$/i.test(color.trim()) ? color.trim() : '#38bdf8';
    }

    function analyzeOutput(output) {
        const stats = { accounts: 0, mains: 0, twinks: 0, griefers: 0 };
        if (!output) return stats;
        for (const line of String(output).split('\n')) {
            if (!line.includes('|')) continue;
            stats.accounts++;
            if (MAIN_RE.test(line)) stats.mains++;
            else if (TWINK_RE.test(line)) stats.twinks++;
            if (GRIEFER_RE.test(line)) stats.griefers++;
        }
        return stats;
    }

    function addStats(target, source) {
        target.accounts += source.accounts;
        target.mains += source.mains;
        target.twinks += source.twinks;
        target.griefers += source.griefers;
    }

    function animateValue(el, target, formatter = v => Math.round(v).toLocaleString()) {
        const from = Number(el.dataset.v || 0);
        el.dataset.v = String(target);
        if (REDUCED_MOTION || from === target) {
            el.textContent = formatter(target);
            return;
        }
        if (el.dataset.raf) cancelAnimationFrame(Number(el.dataset.raf));
        const duration = 650;
        const start = performance.now();
        const step = now => {
            const p = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            el.textContent = formatter(from + (target - from) * eased);
            if (p < 1) el.dataset.raf = String(requestAnimationFrame(step));
            else delete el.dataset.raf;
        };
        el.dataset.raf = String(requestAnimationFrame(step));
    }

    function collectData() {
        const workspacesRaw = parseJSON(lsGet(KEYS.workspaces, '[]'), []);
        const currentId = lsGet(KEYS.current, DEFAULT_WORKSPACE_ID);

        const totals = { accounts: 0, mains: 0, twinks: 0, griefers: 0, tabs: 0, groups: 0 };
        const wsRows = [];
        let currentName = 'Default';

        for (const ws of workspacesRaw) {
            if (!ws || !ws.id) continue;
            const tabs = parseJSON(lsGet(wsKey(KEYS.tabs, ws.id), '[]'), []);
            const groups = parseJSON(lsGet(wsKey(KEYS.groups, ws.id), '[]'), []);
            const wsStats = { accounts: 0, mains: 0, twinks: 0, griefers: 0 };
            const tabRows = tabs.map(tab => {
                const stats = analyzeOutput(tab && tab.output);
                addStats(wsStats, stats);
                return { tab, stats };
            });
            totals.accounts += wsStats.accounts;
            totals.mains += wsStats.mains;
            totals.twinks += wsStats.twinks;
            totals.griefers += wsStats.griefers;
            totals.tabs += tabs.length;
            totals.groups += Array.isArray(groups) ? groups.length : 0;
            if (ws.id === currentId) currentName = ws.name || 'Default';
            wsRows.push({ ws, tabRows, groupCount: Array.isArray(groups) ? groups.length : 0, stats: wsStats });
        }

        const curTabs = parseJSON(lsGet(wsKey(KEYS.tabs, currentId), '[]'), []);
        const curGroups = parseJSON(lsGet(wsKey(KEYS.groups, currentId), '[]'), []);
        const curTabRows = curTabs.map(tab => ({ tab, stats: analyzeOutput(tab && tab.output) }));

        let bytes = 0;
        let keyCount = 0;
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('multiCheck')) {
                    bytes += (localStorage.getItem(key) || '').length;
                    keyCount++;
                }
            }
        } catch (e) { /* storage unavailable */ }

        return { wsRows, currentId, currentName, curTabRows, curGroups, totals, storage: { bytes, keyCount } };
    }

    function renderStats() {
        const t = state.data.totals;
        animateValue(els.statAccounts, t.accounts);
        animateValue(els.statTabs, t.tabs);
        animateValue(els.statWorkspaces, state.data.wsRows.length);
        animateValue(els.statGroups, t.groups);
        animateValue(els.statMains, t.mains);
        animateValue(els.statTwinks, t.twinks);
        animateValue(els.statGriefers, t.griefers);
        animateValue(els.statStorage, state.data.storage.bytes, formatBytes);
    }

    function renderDistribution() {
        const { accounts, mains, twinks } = state.data.totals;
        const unlabeled = Math.max(accounts - mains - twinks, 0);
        const pct = v => (accounts > 0 ? (v / accounts) * 100 : 0);
        els.distMains.style.width = pct(mains) + '%';
        els.distTwinks.style.width = pct(twinks) + '%';
        els.distUnlabeled.style.width = pct(unlabeled) + '%';
        els.distTotal.textContent = accounts.toLocaleString();
        els.distMainsCount.textContent = mains.toLocaleString();
        els.distTwinksCount.textContent = twinks.toLocaleString();
        els.distUnlabeledCount.textContent = unlabeled.toLocaleString();
    }

    function metaText(stats) {
        return `${stats.accounts} account${stats.accounts === 1 ? '' : 's'} · ${stats.mains}M / ${stats.twinks}T · ${stats.griefers} griefer${stats.griefers === 1 ? '' : 's'}`;
    }

    function makeEl(tag, className, text) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (text !== undefined) el.textContent = text;
        return el;
    }

    function chevronSvg() {
        const ns = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('width', '15');
        svg.setAttribute('height', '15');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2.4');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        svg.classList.add('chev');
        const poly = document.createElementNS(ns, 'polyline');
        poly.setAttribute('points', '6 9 12 15 18 9');
        svg.appendChild(poly);
        return svg;
    }

    function emptyState(message, iconPathBuilder) {
        const wrap = makeEl('div', 'empty-state');
        const ns = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '1.6');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        iconPathBuilder(svg, ns);
        const p = makeEl('p', null, message);
        wrap.append(svg, p);
        return wrap;
    }

    function sortRows(rows, mode) {
        const sorted = rows.slice();
        switch (mode) {
            case 'name':
                sorted.sort((a, b) => rowName(a).localeCompare(rowName(b), undefined, { sensitivity: 'base' }));
                break;
            case 'accounts':
                sorted.sort((a, b) => b.stats.accounts - a.stats.accounts);
                break;
            case 'tabs':
                sorted.sort((a, b) => rowCount(a) - rowCount(b)).reverse();
                break;
        }
        return sorted;
    }

    function rowName(row) {
        return (row.tab ? row.tab.name : row.ws.name) || '';
    }

    function rowCount(row) {
        return row.tabRows ? row.tabRows.length : 0;
    }

    function renderWorkspaces() {
        const list = els.wsList;
        list.innerHTML = '';

        if (state.data.wsRows.length === 0) {
            list.appendChild(emptyState('No workspaces found', (svg, ns) => {
                const p1 = document.createElementNS(ns, 'path');
                p1.setAttribute('d', 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2');
                const c = document.createElementNS(ns, 'circle');
                c.setAttribute('cx', '9');
                c.setAttribute('cy', '7');
                c.setAttribute('r', '4');
                svg.append(p1, c);
            }));
            return;
        }

        let rows = state.data.wsRows.filter(r => (r.ws.name || '').toLowerCase().includes(state.wsSearch));
        rows = sortRows(rows, state.wsSort);

        if (rows.length === 0) {
            list.appendChild(emptyState('No workspaces match your filter', (svg, ns) => {
                const c1 = document.createElementNS(ns, 'circle');
                c1.setAttribute('cx', '11');
                c1.setAttribute('cy', '11');
                c1.setAttribute('r', '8');
                const l = document.createElementNS(ns, 'line');
                l.setAttribute('x1', '21');
                l.setAttribute('y1', '21');
                l.setAttribute('x2', '16.65');
                l.setAttribute('y2', '16.65');
                svg.append(c1, l);
            }));
            return;
        }

        for (const row of rows) {
            const block = makeEl('div', 'ws-block' + (state.expanded.has(row.ws.id) ? ' open' : ''));

            const item = makeEl('div', 'item ws-item');
            item.setAttribute('role', 'button');
            item.setAttribute('tabindex', '0');
            item.setAttribute('aria-expanded', String(state.expanded.has(row.ws.id)));

            const main = makeEl('div', 'item-main');
            main.append(chevronSvg(), makeEl('span', 'item-name', row.ws.name || 'Untitled'));
            main.appendChild(makeEl('span', 'badge', `${row.tabRows.length} tab${row.tabRows.length === 1 ? '' : 's'}`));
            if (row.groupCount > 0) main.appendChild(makeEl('span', 'badge badge-green', `${row.groupCount} group${row.groupCount === 1 ? '' : 's'}`));

            const meta = makeEl('div', 'item-meta');
            meta.append(document.createTextNode(metaText(row.stats)));
            const openWsLink = makeEl('a', 'badge badge-green', 'Open #workspace');
            openWsLink.href = `workspace.html#workspace=${encodeURIComponent(row.ws.id)}`;
            openWsLink.title = `Open workspace "${row.ws.name}" in Workspace Engine`;
            openWsLink.style.textDecoration = 'none';
            openWsLink.addEventListener('click', (e) => e.stopPropagation());
            meta.appendChild(openWsLink);
            item.append(main, meta);

            const children = makeEl('div', 'ws-children');
            const inner = makeEl('div', 'ws-children-inner');
            for (const tr of row.tabRows) {
                const mini = makeEl('div', 'mini-row');
                const nameWrap = makeEl('div', 'item-main');
                const tabLink = makeEl('a', 'mini-name', tr.tab.name || 'Untitled');
                tabLink.href = `workspace.html#tab=${encodeURIComponent(tr.tab.id)}`;
                tabLink.title = `Open tab "${tr.tab.name}" in Workspace (#tab)`;
                tabLink.style.textDecoration = 'none';
                tabLink.style.color = 'inherit';
                nameWrap.appendChild(tabLink);
                if (tr.tab.pinned) nameWrap.appendChild(makeEl('span', 'badge badge-amber', 'Pinned'));
                mini.append(nameWrap, makeEl('span', 'mini-meta', metaText(tr.stats)));
                inner.appendChild(mini);
            }
            children.appendChild(inner);

            const toggle = () => {
                const open = !state.expanded.has(row.ws.id);
                if (open) state.expanded.add(row.ws.id);
                else state.expanded.delete(row.ws.id);
                block.classList.toggle('open', open);
                item.setAttribute('aria-expanded', String(open));
            };
            item.addEventListener('click', toggle);
            item.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggle();
                }
            });

            block.append(item, children);
            list.appendChild(block);
        }
    }

    function renderTabs() {
        const list = els.tabsList;
        list.innerHTML = '';
        els.tabsWsName.textContent = `· ${state.data.currentName}`;
        els.groupsWsName.textContent = `· ${state.data.currentName}`;

        if (state.data.curTabRows.length === 0) {
            list.appendChild(emptyState('No tabs in this workspace', (svg, ns) => {
                const r = document.createElementNS(ns, 'rect');
                r.setAttribute('x', '3');
                r.setAttribute('y', '3');
                r.setAttribute('width', '18');
                r.setAttribute('height', '18');
                r.setAttribute('rx', '2');
                const l1 = document.createElementNS(ns, 'line');
                l1.setAttribute('x1', '3');
                l1.setAttribute('y1', '9');
                l1.setAttribute('x2', '21');
                l1.setAttribute('y2', '9');
                const l2 = document.createElementNS(ns, 'line');
                l2.setAttribute('x1', '9');
                l2.setAttribute('y1', '21');
                l2.setAttribute('x2', '9');
                l2.setAttribute('y2', '9');
                svg.append(r, l1, l2);
            }));
            return;
        }

        const groupNameById = new Map(state.data.curGroups.map(g => [g.id, g]));

        let rows = state.data.curTabRows.filter(r => (r.tab.name || '').toLowerCase().includes(state.tabSearch));
        rows = sortRows(rows, state.tabSort);

        if (rows.length === 0) {
            list.appendChild(emptyState('No tabs match your filter', (svg, ns) => {
                const c1 = document.createElementNS(ns, 'circle');
                c1.setAttribute('cx', '11');
                c1.setAttribute('cy', '11');
                c1.setAttribute('r', '8');
                const l = document.createElementNS(ns, 'line');
                l.setAttribute('x1', '21');
                l.setAttribute('y1', '21');
                l.setAttribute('x2', '16.65');
                l.setAttribute('y2', '16.65');
                svg.append(c1, l);
            }));
            return;
        }

        for (const row of rows) {
            const item = makeEl('div', 'item');
            const main = makeEl('div', 'item-main');
            main.appendChild(makeEl('span', 'item-name', row.tab.name || 'Untitled'));
            if (row.tab.pinned) main.appendChild(makeEl('span', 'badge badge-amber', 'Pinned'));
            const group = groupNameById.get(row.tab.groupId);
            if (group) {
                const chip = makeEl('span', 'group-chip');
                const dot = makeEl('i', 'dot');
                dot.style.background = safeColor(group.color);
                chip.append(dot, document.createTextNode(group.name || 'Group'));
                main.appendChild(chip);
            }
            const metaWrap = makeEl('div', 'item-meta');
            metaWrap.append(document.createTextNode(metaText(row.stats)));
            const openTabBadge = makeEl('a', 'badge', 'Open #tab');
            openTabBadge.href = `workspace.html#tab=${encodeURIComponent(row.tab.id)}`;
            openTabBadge.title = `Open tab "${row.tab.name}" in Workspace`;
            openTabBadge.style.textDecoration = 'none';
            metaWrap.appendChild(openTabBadge);
            item.append(main, metaWrap);
            list.appendChild(item);
        }
    }

    function renderGroups() {
        const list = els.groupsList;
        list.innerHTML = '';

        if (state.data.curGroups.length === 0) {
            list.appendChild(emptyState('No groups in this workspace', (svg, ns) => {
                const c = document.createElementNS(ns, 'circle');
                c.setAttribute('cx', '12');
                c.setAttribute('cy', '12');
                c.setAttribute('r', '10');
                const l1 = document.createElementNS(ns, 'line');
                l1.setAttribute('x1', '12');
                l1.setAttribute('y1', '8');
                l1.setAttribute('x2', '12');
                l1.setAttribute('y2', '12');
                const l2 = document.createElementNS(ns, 'line');
                l2.setAttribute('x1', '12');
                l2.setAttribute('y1', '16');
                l2.setAttribute('x2', '12.01');
                l2.setAttribute('y2', '16');
                svg.append(c, l1, l2);
            }));
            return;
        }

        const totalTabs = state.data.curTabRows.length || 1;
        for (const group of state.data.curGroups) {
            const tabCount = state.data.curTabRows.filter(r => r.tab.groupId === group.id).length;
            const share = Math.round((tabCount / totalTabs) * 100);

            const item = makeEl('div', 'item');
            const main = makeEl('div', 'item-main');
            const dot = makeEl('i', 'dot');
            dot.style.background = safeColor(group.color);
            main.append(dot, makeEl('span', 'item-name', group.name || 'Untitled group'));
            item.append(
                main,
                makeEl('span', 'badge', `${tabCount} tab${tabCount === 1 ? '' : 's'} · ${share}%`)
            );
            list.appendChild(item);
        }
    }

    function renderStorage() {
        if (!state.data || !state.data.storage) return;
        const { bytes, keyCount } = state.data.storage;
        const percent = Math.min((bytes / STORAGE_LIMIT) * 100, 100);

        if (els.storageUsed) els.storageUsed.textContent = formatBytes(bytes);
        if (els.storagePercent) els.storagePercent.textContent = `${percent.toFixed(percent < 10 ? 1 : 0)}%`;
        
        const bar = els.storageProgress || els.storageBar;
        if (bar) {
            bar.style.width = percent + '%';
            bar.classList.toggle('warn', percent >= 60 && percent < 85);
            bar.classList.toggle('danger', percent >= 85);
            bar.setAttribute('aria-valuenow', String(Math.round(percent)));
        }
        if (els.storageKeys) els.storageKeys.textContent = keyCount.toLocaleString();
    }

    function relativeTime(ts) {
        const diff = Math.max(Math.floor((Date.now() - ts) / 1000), 0);
        if (diff < 10) return 'Updated just now';
        if (diff < 60) return `Updated ${diff}s ago`;
        if (diff < 3600) return `Updated ${Math.floor(diff / 60)}m ago`;
        return `Updated ${Math.floor(diff / 3600)}h ago`;
    }

    let toastTimer = null;
    function toast(message) {
        if (!els.toast) return;
        els.toast.textContent = message;
        els.toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => els.toast && els.toast.classList.remove('show'), 2200);
    }

    function refresh(options = {}) {
        const { silent = false } = options;
        try {
            state.data = collectData();
            if (typeof renderStats === 'function') renderStats();
            if (typeof renderDistribution === 'function') renderDistribution();
            if (typeof renderWorkspaces === 'function') renderWorkspaces();
            if (typeof renderTabs === 'function') renderTabs();
            if (typeof renderGroups === 'function') renderGroups();
            if (typeof renderStorage === 'function') renderStorage();
        } catch (err) {
            console.error('Error refreshing dashboard:', err);
        } finally {
            state.loadedAt = Date.now();
            if (els.lastUpdated) {
                els.lastUpdated.textContent = relativeTime(state.loadedAt);
            }
        }

        if (!silent) {
            toast('Dashboard refreshed');
            if (els.refreshBtn) {
                els.refreshBtn.classList.add('loading');
                setTimeout(() => els.refreshBtn && els.refreshBtn.classList.remove('loading'), 700);
            }
        }
    }

    function exportData() {
        const dump = {};
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('multiCheck')) dump[key] = localStorage.getItem(key);
            }
        } catch (e) {
            toast('Export failed: storage unavailable');
            return;
        }
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `multicheck-backup-${stamp}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast(`Exported ${Object.keys(dump).length} keys`);
    }

    function applyTheme(theme) {
        currentTheme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        try {
            localStorage.setItem('multiCheckTheme', theme);
            localStorage.setItem('spectraTheme', theme);
        } catch (e) { }
        if (els.themeToggleBtn) {
            if (theme === 'light') {
                els.themeToggleBtn.title = 'Switch to Dark Theme';
                els.themeToggleBtn.setAttribute('aria-label', 'Switch to Dark Theme');
                els.themeToggleBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
            } else {
                els.themeToggleBtn.title = 'Switch to Light Theme';
                els.themeToggleBtn.setAttribute('aria-label', 'Switch to Light Theme');
                els.themeToggleBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';
            }
        }
    }

    const STAT_META = {
        accounts: { label: 'Total Accounts' },
        tabs: { label: 'Total Tabs' },
        workspaces: { label: 'Workspaces' },
        groups: { label: 'Groups' },
        mains: { label: 'Main Accounts (M)' },
        twinks: { label: 'Twinks (T)' },
        griefers: { label: 'Flagged Griefers' },
        storage: { label: 'Storage Utilized' }
    };
    const ALL_STAT_KEYS = Object.keys(STAT_META);

    function saveHiddenStats() {
        try {
            localStorage.setItem('spectraHiddenStats', JSON.stringify([...state.hiddenStats]));
        } catch (e) {}
    }

    function saveStatsCollapsed() {
        try {
            localStorage.setItem('spectraStatsCollapsed', String(state.statsCollapsed));
        } catch (e) {}
    }

    function updateMetricsUI() {
        const cards = document.querySelectorAll('.stat-card[data-stat-id]');
        const totalCards = cards.length || ALL_STAT_KEYS.length;
        let visibleCount = 0;

        cards.forEach(card => {
            const id = card.dataset.statId;
            const isHidden = state.hiddenStats.has(id);
            card.classList.toggle('is-hidden', isHidden);
            if (!isHidden) visibleCount++;
        });

        const hiddenCount = state.hiddenStats.size;

        if (els.metricsCounter) {
            els.metricsCounter.textContent = `${visibleCount} active`;
        }
        if (els.metricsHiddenCount) {
            els.metricsHiddenCount.textContent = String(hiddenCount);
        }
        if (els.metricsRestoreBtn) {
            els.metricsRestoreBtn.style.display = hiddenCount > 0 ? 'inline-flex' : 'none';
        }

        const isCollapsed = state.statsCollapsed;
        const allHidden = visibleCount === 0;

        if (els.statsGrid) {
            els.statsGrid.classList.toggle('is-collapsed', isCollapsed || allHidden);
        }

        if (els.statsCollapsedBanner) {
            if (isCollapsed) {
                els.statsCollapsedBanner.style.display = 'flex';
                if (els.statsCollapsedText) {
                    els.statsCollapsedText.textContent = `Forensic metrics section is collapsed (${visibleCount} of ${totalCards} active).`;
                }
                if (els.statsExpandBtn) {
                    els.statsExpandBtn.textContent = 'Expand Metrics';
                }
            } else if (allHidden) {
                els.statsCollapsedBanner.style.display = 'flex';
                if (els.statsCollapsedText) {
                    els.statsCollapsedText.textContent = `All ${totalCards} forensic metric cards are closed/hidden.`;
                }
                if (els.statsExpandBtn) {
                    els.statsExpandBtn.textContent = 'Restore All Cards';
                }
            } else {
                els.statsCollapsedBanner.style.display = 'none';
            }
        }

        if (els.metricsToggleLabel) {
            els.metricsToggleLabel.textContent = isCollapsed ? 'Expand' : 'Collapse';
        }
        if (els.metricsToggleIcon) {
            els.metricsToggleIcon.style.transform = isCollapsed ? 'rotate(180deg)' : '';
        }
    }

    function hideStatCard(id, cardEl) {
        if (!id) return;
        const meta = STAT_META[id];
        const card = cardEl || document.querySelector(`.stat-card[data-stat-id="${id}"]`);

        if (card) {
            card.classList.add('closing');
            setTimeout(() => {
                card.classList.remove('closing');
                state.hiddenStats.add(id);
                saveHiddenStats();
                updateMetricsUI();
                toast(`"${meta ? meta.label : id}" metric closed`);
            }, 180);
        } else {
            state.hiddenStats.add(id);
            saveHiddenStats();
            updateMetricsUI();
        }
    }

    function restoreAllStats() {
        state.hiddenStats.clear();
        state.statsCollapsed = false;
        saveHiddenStats();
        saveStatsCollapsed();
        updateMetricsUI();
        toast('All metric cards restored');
    }

    function toggleStatsCollapse() {
        state.statsCollapsed = !state.statsCollapsed;
        saveStatsCollapsed();
        updateMetricsUI();
    }

    function initMetricsControls() {
        const storedHidden = parseJSON(lsGet('spectraHiddenStats', '[]'), []);
        state.hiddenStats = new Set(Array.isArray(storedHidden) ? storedHidden : []);
        state.statsCollapsed = lsGet('spectraStatsCollapsed', 'false') === 'true';
        updateMetricsUI();
    }

    function bindEvents() {
        applyTheme(currentTheme);

        // Closeable metrics delegation
        document.addEventListener('click', e => {
            const closeBtn = e.target.closest('.stat-card-close-btn');
            if (closeBtn) {
                e.preventDefault();
                e.stopPropagation();
                const statId = closeBtn.dataset.closeStat;
                const card = closeBtn.closest('.stat-card');
                hideStatCard(statId, card);
                return;
            }

            const restoreBtn = e.target.closest('#metrics-restore-btn');
            if (restoreBtn) {
                e.preventDefault();
                restoreAllStats();
                return;
            }

            const toggleBtn = e.target.closest('#metrics-toggle-btn');
            if (toggleBtn) {
                e.preventDefault();
                toggleStatsCollapse();
                return;
            }

            const expandBtn = e.target.closest('#stats-expand-btn');
            if (expandBtn) {
                e.preventDefault();
                if (state.hiddenStats.size === ALL_STAT_KEYS.length) {
                    restoreAllStats();
                } else {
                    state.statsCollapsed = false;
                    saveStatsCollapsed();
                    updateMetricsUI();
                }
                return;
            }
        });

        if (els.backBtn) {
            els.backBtn.addEventListener('click', () => {
                window.location.href = 'workspace.html#main';
            });
        }

        if (els.themeToggleBtn) {
            els.themeToggleBtn.addEventListener('click', () => {
                const active = document.documentElement.getAttribute('data-theme') || 'dark';
                const next = active === 'dark' ? 'light' : 'dark';
                applyTheme(next);
                toast(`Switched to ${next} theme`);
            });
        }

        window.addEventListener('storage', (e) => {
            if ((e.key === 'multiCheckTheme' || e.key === 'spectraTheme') && e.newValue) {
                applyTheme(e.newValue);
            }
        });

        if (els.portalBanGen) {
            els.portalBanGen.addEventListener('click', () => {
                localStorage.setItem('multiCheckView', 'ban-generator');
            });
        }

        if (els.launchBanGenBtn) {
            els.launchBanGenBtn.addEventListener('click', () => {
                localStorage.setItem('multiCheckView', 'ban-generator');
            });
        }

        els.refreshBtn.addEventListener('click', () => refresh());
        els.exportBtn.addEventListener('click', exportData);

        els.wsSearch.addEventListener('input', e => {
            state.wsSearch = e.target.value.trim().toLowerCase();
            renderWorkspaces();
        });

        els.tabsSearch.addEventListener('input', e => {
            state.tabSearch = e.target.value.trim().toLowerCase();
            renderTabs();
        });

        els.wsSort.addEventListener('change', e => {
            state.wsSort = e.target.value;
            renderWorkspaces();
        });

        els.tabsSort.addEventListener('change', e => {
            state.tabSort = e.target.value;
            renderTabs();
        });

        document.addEventListener('keydown', e => {
            const tag = (e.target.tagName || '').toLowerCase();
            if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            const key = e.key.toLowerCase();
            if (key === 'r') {
                e.preventDefault();
                refresh();
            } else if (key === 'w') {
                window.location.href = 'workspace.html#main';
            } else if (key === 'b') {
                window.location.href = 'workspace.html#ban';
            } else if (key === 'a') {
                window.location.href = 'about.html';
            } else if (key === 't') {
                if (els.themeToggleBtn) els.themeToggleBtn.click();
            }
        });

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) refresh({ silent: true });
        });

        setInterval(() => {
            if (state.loadedAt) els.lastUpdated.textContent = relativeTime(state.loadedAt);
        }, 30000);
    }

    initMetricsControls();
    bindEvents();
    refresh({ silent: true });
})();

/**
 * Spectra Intelligence - Forensic Visual Diff & Log Comparator Engine
 * Side-by-side and unified forensic comparison across tabs, snapshots, and raw logs.
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
        tabs: 'multiCheckTabs',
        snapshots: 'multiCheckHistoricalSnapshots'
    };

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

    function showToast(msg, duration = 3000) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.innerHTML = `<img src="assets/images/logo1.png" alt="" class="toast-favicon" style="width:15px;height:15px;vertical-align:middle;margin-right:7px;border-radius:3px;display:inline-block;"><span>${msg}</span>`;
        toast.classList.add('show', 'visible');
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => {
            toast.classList.remove('show', 'visible');
        }, duration);
    }

    // State
    const state = {
        sourceAType: 'tab', // 'tab', 'snapshot', 'raw'
        sourceBType: 'tab',
        sourceAValue: '',
        sourceBValue: '',
        rawA: '',
        rawB: '',
        mode: 'unified', // 'unified' or 'split'
        filter: 'all', // 'all', 'add', 'del', 'mut', 'griefer'
        showUnchanged: false,
        diffResults: null
    };

    // Parse raw text logs into structured account map
    function parseLogData(text) {
        const lines = (text || '').split('\n');
        const accounts = [];
        const map = new Map();

        lines.forEach(rawLine => {
            const line = rawLine.trim();
            if (!line || !line.includes('|')) return;

            const parts = line.split('|').map(p => p.trim());
            const name = parts[0] || 'Unknown';
            const idCandidate = parts[1] || '';
            const tagStr = parts.slice(2).join(' | ');

            const isMain = MAIN_RE.test(line);
            const isTwink = TWINK_RE.test(line);
            const isGriefer = GRIEFER_RE.test(line);

            // Derive reliable unique key: prefer numeric ID if present, else fallback to name
            const numericMatch = idCandidate.match(/\b\d{3,10}\b/) || line.match(/\b\d{3,10}\b/);
            const key = numericMatch ? `id:${numericMatch[0]}` : `name:${name.toLowerCase()}`;

            const item = {
                key,
                rawLine: line,
                name,
                id: numericMatch ? numericMatch[0] : (idCandidate || 'N/A'),
                classification: isMain ? 'Main' : isTwink ? 'Twink' : 'Unlabeled',
                isGriefer,
                tags: tagStr
            };

            accounts.push(item);
            map.set(key, item);
        });

        return { accounts, map };
    }

    // Compute forensic delta between Dataset A and Dataset B
    function computeDiff(dataA, dataB) {
        const delta = [];
        const seenKeys = new Set();

        let addedCount = 0;
        let removedCount = 0;
        let mutatedCount = 0;
        let grieferEscalations = 0;
        let unchangedCount = 0;

        // Check items in A against B
        dataA.accounts.forEach(itemA => {
            seenKeys.add(itemA.key);
            const itemB = dataB.map.get(itemA.key);

            if (!itemB) {
                removedCount++;
                delta.push({
                    type: 'del',
                    itemA,
                    itemB: null,
                    summary: `Removed: ${itemA.name} (${itemA.id})`
                });
            } else {
                // Check for mutations: name change, classification change, or griefer flag change
                const nameChanged = itemA.name.toLowerCase() !== itemB.name.toLowerCase();
                const classChanged = itemA.classification !== itemB.classification;
                const grieferGained = !itemA.isGriefer && itemB.isGriefer;
                const grieferLost = itemA.isGriefer && !itemB.isGriefer;

                if (grieferGained) grieferEscalations++;

                if (nameChanged || classChanged || grieferGained || grieferLost) {
                    mutatedCount++;
                    let mutationNote = [];
                    if (nameChanged) mutationNote.push(`Renamed from "${itemA.name}" to "${itemB.name}"`);
                    if (classChanged) mutationNote.push(`Shifted from ${itemA.classification} to ${itemB.classification}`);
                    if (grieferGained) mutationNote.push(`Flagged as GRIEFER`);
                    if (grieferLost) mutationNote.push(`Griefer tag removed`);

                    delta.push({
                        type: 'mut',
                        itemA,
                        itemB,
                        mutationNote: mutationNote.join(' · '),
                        grieferGained,
                        summary: `Mutated: ${itemB.name} (${itemB.id})`
                    });
                } else {
                    unchangedCount++;
                    delta.push({
                        type: 'unchanged',
                        itemA,
                        itemB,
                        summary: `Unchanged: ${itemA.name}`
                    });
                }
            }
        });

        // Check for additions in B not in A
        dataB.accounts.forEach(itemB => {
            if (!seenKeys.has(itemB.key)) {
                addedCount++;
                if (itemB.isGriefer) grieferEscalations++;
                delta.push({
                    type: 'add',
                    itemA: null,
                    itemB,
                    summary: `Added: ${itemB.name} (${itemB.id})`
                });
            }
        });

        return {
            delta,
            stats: {
                totalA: dataA.accounts.length,
                totalB: dataB.accounts.length,
                netDelta: dataB.accounts.length - dataA.accounts.length,
                addedCount,
                removedCount,
                mutatedCount,
                grieferEscalations,
                unchangedCount
            }
        };
    }

    // Populate dropdown selectors with workspaces, tabs, and snapshots
    function populateSourceSelectors() {
        const selectA = document.getElementById('diff-source-a-select');
        const selectB = document.getElementById('diff-source-b-select');
        if (!selectA || !selectB) return;

        // Workspaces & tabs
        const workspacesRaw = parseJSON(lsGet(KEYS.workspaces, '[]'), [
            { id: 'workspace-default', name: 'Default' }
        ]);

        let tabOptions = '<optgroup label="Workspaces & Tabs">';
        workspacesRaw.forEach(ws => {
            let tabsStr = lsGet(wsKey(KEYS.tabs, ws.id), null);
            if ((!tabsStr || tabsStr === '[]') && ws.id === 'workspace-default') {
                const legacy = lsGet(KEYS.tabs, null);
                if (legacy && legacy !== '[]') tabsStr = legacy;
            }
            const tabs = parseJSON(tabsStr || '[]', []);
            tabs.forEach(tab => {
                const val = `tab:${ws.id}:${tab.id}`;
                tabOptions += `<option value="${val}">[${ws.name || 'WS'}] ${tab.name || 'Tab'}</option>`;
            });
        });
        tabOptions += '</optgroup>';

        // Historical snapshots
        const snapshots = parseJSON(lsGet(KEYS.snapshots, '[]'), []);
        let snapOptions = '<optgroup label="Historical Snapshots">';
        snapshots.slice().reverse().forEach((snap, idx) => {
            const dateStr = new Date(snap.timestamp).toLocaleString();
            const val = `snap:${snap.id}`;
            snapOptions += `<option value="${val}">Snapshot #${snapshots.length - idx} (${dateStr} - ${snap.totalAccounts} accs)</option>`;
        });
        snapOptions += '</optgroup>';

        const rawOption = '<optgroup label="Manual Input"><option value="raw:custom">Custom Raw Log Input</option></optgroup>';

        const combinedOptions = tabOptions + snapOptions + rawOption;

        selectA.innerHTML = combinedOptions;
        selectB.innerHTML = combinedOptions;

        // Default selections: select first tab for A, and second tab or raw for B
        if (selectA.options.length > 0) selectA.selectedIndex = 0;
        if (selectB.options.length > 1) selectB.selectedIndex = 1;
        else if (selectB.options.length > 0) selectB.selectedIndex = 0;
    }

    // Resolve text content from selector value
    function resolveSourceContent(selectorVal, rawTextareaVal) {
        if (!selectorVal || selectorVal.startsWith('raw:')) {
            return rawTextareaVal || '';
        }

        if (selectorVal.startsWith('tab:')) {
            const parts = selectorVal.split(':');
            const wsId = parts[1];
            const tabId = parts[2];
            let tabsStr = lsGet(wsKey(KEYS.tabs, wsId), null);
            if ((!tabsStr || tabsStr === '[]') && wsId === 'workspace-default') {
                const legacy = lsGet(KEYS.tabs, null);
                if (legacy && legacy !== '[]') tabsStr = legacy;
            }
            const tabs = parseJSON(tabsStr || '[]', []);
            const target = tabs.find(t => t.id === tabId);
            return (target && (target.output || target.input)) || '';
        }

        if (selectorVal.startsWith('snap:')) {
            const snapId = selectorVal.replace('snap:', '');
            // For snapshots, if full raw content isn't in snapshot record, fall back to current
            const snapshots = parseJSON(lsGet(KEYS.snapshots, '[]'), []);
            const snap = snapshots.find(s => s.id === snapId);
            if (snap && snap.rawContent) return snap.rawContent;
            return `Snapshot: ${snap?.totalAccounts || 0} accounts logged at ${new Date(snap?.timestamp || Date.now()).toLocaleString()}`;
        }

        return '';
    }

    // Execute the Diff
    function runDiff() {
        const selectA = document.getElementById('diff-source-a-select');
        const selectB = document.getElementById('diff-source-b-select');
        const rawAreaA = document.getElementById('raw-input-a');
        const rawAreaB = document.getElementById('raw-input-b');

        const contentA = resolveSourceContent(selectA?.value, rawAreaA?.value);
        const contentB = resolveSourceContent(selectB?.value, rawAreaB?.value);

        if (!contentA.trim() && !contentB.trim()) {
            showToast('Both sources are empty. Select active tabs or paste log data.');
            return;
        }

        const dataA = parseLogData(contentA);
        const dataB = parseLogData(contentB);

        state.diffResults = computeDiff(dataA, dataB);
        renderDiffOutput();
        showToast(`Forensic diff analyzed: ${state.diffResults.delta.length} account delta events.`);
    }

    // Render Metrics and Diff Container
    function renderDiffOutput() {
        const container = document.getElementById('diff-output-container');
        const netVal = document.getElementById('metric-net-delta');
        const addVal = document.getElementById('metric-added-count');
        const delVal = document.getElementById('metric-removed-count');
        const mutVal = document.getElementById('metric-mutated-count');
        const grieferVal = document.getElementById('metric-griefers-count');

        if (!state.diffResults || !container) return;

        const { delta, stats } = state.diffResults;

        // Update metric tiles
        if (netVal) {
            netVal.textContent = (stats.netDelta >= 0 ? `+${stats.netDelta}` : String(stats.netDelta));
            netVal.style.color = stats.netDelta > 0 ? '#34d399' : stats.netDelta < 0 ? '#f87171' : 'var(--text-1)';
        }
        if (addVal) addVal.textContent = `+${stats.addedCount}`;
        if (delVal) delVal.textContent = `-${stats.removedCount}`;
        if (mutVal) mutVal.textContent = `${stats.mutatedCount}`;
        if (grieferVal) grieferVal.textContent = `${stats.grieferEscalations}`;

        // Filter delta items
        const filtered = delta.filter(row => {
            if (!state.showUnchanged && row.type === 'unchanged') return false;
            if (state.filter === 'add') return row.type === 'add';
            if (state.filter === 'del') return row.type === 'del';
            if (state.filter === 'mut') return row.type === 'mut';
            if (state.filter === 'griefer') {
                return (row.itemB && row.itemB.isGriefer) || (row.itemA && row.itemA.isGriefer);
            }
            return true;
        });

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="diff-empty-state">
                    <svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" stroke-width="1.8" fill="none"><circle cx="12" cy="12" r="10"></circle><path d="M8 12l3 3 5-5"></path></svg>
                    <div style="font-weight: 700; color: var(--text-1);">No Differences Found</div>
                    <p style="font-size: 0.85rem; margin: 0;">Both selected sources contain identical account rosters under the active filter.</p>
                </div>
            `;
            return;
        }

        if (state.mode === 'unified') {
            renderUnifiedView(filtered, container);
        } else {
            renderSplitView(filtered, container);
        }
    }

    function renderUnifiedView(rows, container) {
        container.innerHTML = `
            <div class="diff-unified-list">
                ${rows.map(row => {
                    const item = row.itemB || row.itemA;
                    let symbol = ' ';
                    let rowClass = 'row-unchanged';

                    if (row.type === 'add') { symbol = '+'; rowClass = 'row-add'; }
                    else if (row.type === 'del') { symbol = '-'; rowClass = 'row-del'; }
                    else if (row.type === 'mut') { symbol = '~'; rowClass = 'row-mut'; }

                    return `
                        <div class="diff-unified-row ${rowClass}">
                            <div class="diff-symbol">${symbol}</div>
                            <div class="diff-row-content">
                                <span class="diff-row-identity">${item.name}</span>
                                <span class="diff-row-id">#${item.id}</span>
                                <span class="badge" style="font-size: 0.7rem;">${item.classification}</span>
                                ${item.isGriefer ? '<span class="badge" style="background: rgba(239, 68, 68, 0.2); color: #f87171; border-color: rgba(239, 68, 68, 0.4);">Griefer Flag</span>' : ''}
                                ${row.mutationNote ? `<span style="font-size: 0.74rem; color: #fbbf24; margin-left: 8px;">(${row.mutationNote})</span>` : ''}
                            </div>
                            <div class="diff-row-meta">
                                <span style="font-size: 0.72rem; color: var(--text-3);">${item.tags || ''}</span>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    function renderSplitView(rows, container) {
        const leftLines = [];
        const rightLines = [];

        rows.forEach((row, idx) => {
            const lineNum = idx + 1;
            if (row.type === 'add') {
                leftLines.push(`
                    <div class="diff-split-line line-empty">
                        <span class="diff-line-num">${lineNum}</span>
                        <span>--</span>
                    </div>
                `);
                rightLines.push(`
                    <div class="diff-split-line line-add">
                        <span class="diff-line-num">${lineNum}</span>
                        <span>+ ${row.itemB.name} | ${row.itemB.id} | ${row.itemB.classification}</span>
                    </div>
                `);
            } else if (row.type === 'del') {
                leftLines.push(`
                    <div class="diff-split-line line-del">
                        <span class="diff-line-num">${lineNum}</span>
                        <span>- ${row.itemA.name} | ${row.itemA.id} | ${row.itemA.classification}</span>
                    </div>
                `);
                rightLines.push(`
                    <div class="diff-split-line line-empty">
                        <span class="diff-line-num">${lineNum}</span>
                        <span>--</span>
                    </div>
                `);
            } else if (row.type === 'mut') {
                leftLines.push(`
                    <div class="diff-split-line line-mut">
                        <span class="diff-line-num">${lineNum}</span>
                        <span>~ ${row.itemA.name} | ${row.itemA.id} | ${row.itemA.classification}</span>
                    </div>
                `);
                rightLines.push(`
                    <div class="diff-split-line line-mut">
                        <span class="diff-line-num">${lineNum}</span>
                        <span>~ ${row.itemB.name} | ${row.itemB.id} | ${row.itemB.classification}</span>
                    </div>
                `);
            } else {
                leftLines.push(`
                    <div class="diff-split-line">
                        <span class="diff-line-num">${lineNum}</span>
                        <span>  ${row.itemA.name} | ${row.itemA.id}</span>
                    </div>
                `);
                rightLines.push(`
                    <div class="diff-split-line">
                        <span class="diff-line-num">${lineNum}</span>
                        <span>  ${row.itemB.name} | ${row.itemB.id}</span>
                    </div>
                `);
            }
        });

        container.innerHTML = `
            <div class="diff-split-container">
                <div class="diff-pane">
                    <div class="diff-pane-header">
                        <span>Side A (Baseline)</span>
                        <span>${rows.length} lines</span>
                    </div>
                    <div class="diff-pane-content" id="split-left-pane">
                        ${leftLines.join('')}
                    </div>
                </div>
                <div class="diff-pane">
                    <div class="diff-pane-header">
                        <span>Side B (Comparison)</span>
                        <span>${rows.length} lines</span>
                    </div>
                    <div class="diff-pane-content" id="split-right-pane">
                        ${rightLines.join('')}
                    </div>
                </div>
            </div>
        `;

        // Synchronize scroll
        const leftPane = document.getElementById('split-left-pane');
        const rightPane = document.getElementById('split-right-pane');
        if (leftPane && rightPane) {
            leftPane.addEventListener('scroll', () => {
                rightPane.scrollTop = leftPane.scrollTop;
            });
            rightPane.addEventListener('scroll', () => {
                leftPane.scrollTop = rightPane.scrollTop;
            });
        }
    }

    // Exporters
    function exportDiscordDiff() {
        if (!state.diffResults) {
            showToast('Run comparison first.');
            return;
        }
        const delta = state.diffResults.delta;
        let out = '```diff\n';
        out += `--- Spectra Forensic Diff [Side A vs Side B] ---\n`;
        delta.forEach(row => {
            if (row.type === 'add') out += `+ ${row.itemB.name} | ${row.itemB.id} [${row.itemB.classification}]\n`;
            else if (row.type === 'del') out += `- ${row.itemA.name} | ${row.itemA.id} [${row.itemA.classification}]\n`;
            else if (row.type === 'mut') out += `! ${row.itemB.name} | ${row.itemB.id} (${row.mutationNote})\n`;
        });
        out += '```';

        navigator.clipboard.writeText(out).then(() => {
            showToast('Copied Discord formatted diff block to clipboard!');
        });
    }

    function exportDeltaJSON() {
        if (!state.diffResults) {
            showToast('Run comparison first.');
            return;
        }
        const blob = new Blob([JSON.stringify(state.diffResults, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `spectra-diff-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Exported diff JSON file.');
    }

    // Bind event handlers
    function init() {
        populateSourceSelectors();

        const selectA = document.getElementById('diff-source-a-select');
        const selectB = document.getElementById('diff-source-b-select');
        const rawDrawer = document.getElementById('raw-input-drawer');
        const runBtn = document.getElementById('run-diff-btn');
        const swapBtn = document.getElementById('swap-sources-btn');

        function checkRawDrawer() {
            const needRaw = selectA?.value?.startsWith('raw:') || selectB?.value?.startsWith('raw:');
            if (rawDrawer) rawDrawer.style.display = needRaw ? 'grid' : 'none';
        }

        if (selectA) selectA.addEventListener('change', checkRawDrawer);
        if (selectB) selectB.addEventListener('change', checkRawDrawer);

        if (swapBtn) {
            swapBtn.addEventListener('click', () => {
                const temp = selectA.value;
                selectA.value = selectB.value;
                selectB.value = temp;
                checkRawDrawer();
                runDiff();
            });
        }

        if (runBtn) runBtn.addEventListener('click', runDiff);

        // Mode switchers
        document.querySelectorAll('[data-diff-mode]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('[data-diff-mode]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.mode = btn.dataset.diffMode;
                renderDiffOutput();
            });
        });

        // Filter chips
        document.querySelectorAll('[data-diff-filter]').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('[data-diff-filter]').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                state.filter = chip.dataset.diffFilter;
                renderDiffOutput();
            });
        });

        // Toggle Unchanged
        const toggleUnchanged = document.getElementById('toggle-unchanged-btn');
        if (toggleUnchanged) {
            toggleUnchanged.addEventListener('click', () => {
                state.showUnchanged = !state.showUnchanged;
                toggleUnchanged.classList.toggle('active', state.showUnchanged);
                renderDiffOutput();
            });
        }

        // Exporters
        const discordBtn = document.getElementById('export-discord-diff-btn');
        if (discordBtn) discordBtn.addEventListener('click', exportDiscordDiff);

        const jsonBtn = document.getElementById('export-json-diff-btn');
        if (jsonBtn) jsonBtn.addEventListener('click', exportDeltaJSON);


        // Auto-run if sources present
        runDiff();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

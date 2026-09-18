/**
 * Spectra Intelligence - Hardware & Network Collision Matrix
 * Pairwise cross-identity collision detection, weighted overlap scoring,
 * interactive heatmap, and /24 subnet cluster intelligence.
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
        tabs: 'multiCheckTabs'
    };

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

    function showToast(msg, duration = 2800) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.innerHTML = `<img src="assets/images/logo1.png" alt="" class="toast-favicon" style="width:15px;height:15px;vertical-align:middle;margin-right:7px;border-radius:3px;display:inline-block;"><span>${msg}</span>`;
        toast.classList.add('show', 'visible');
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => toast.classList.remove('show', 'visible'), duration);
    }

    // State
    let accounts = [];
    let collisionPairs = [];
    let minConfidence = 0;
    let currentView = 'heatmap'; // 'heatmap' or 'list'
    let batchQuery = '';

    // Collect and normalize accounts from workspaces
    function collectAccounts() {
        const accList = [];
        const currentWsId = lsGet(KEYS.current, 'default');
        const tabsKey = currentWsId === 'default' ? KEYS.tabs : `${KEYS.tabs}_${currentWsId}`;
        const tabs = parseJSON(lsGet(tabsKey, '[]'), []);

        if (Array.isArray(tabs)) {
            tabs.forEach((tab, tIdx) => {
                const lines = (tab.text || '').split('\n');
                lines.forEach((line, lIdx) => {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed.startsWith('#')) return;

                    const idMatch = trimmed.match(/\b\d{4,7}\b/);
                    const ipMatch = trimmed.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
                    const hwidMatch = trimmed.match(/\b[A-F0-9]{32}\b/i) || trimmed.match(/HWID[:\s]*([A-Za-z0-9_-]+)/i);
                    const discordMatch = trimmed.match(/discord[:\s]*(\d{17,19})/i);

                    let name = trimmed.split(/[\t,|]/)[0].trim();
                    if (name.length > 20) name = name.slice(0, 18) + '...';

                    if (idMatch || ipMatch || hwidMatch) {
                        accList.push({
                            id: idMatch ? idMatch[0] : `acc-${tIdx}-${lIdx}`,
                            name: name || `Player ${idMatch ? idMatch[0] : lIdx}`,
                            hwid: hwidMatch ? (hwidMatch[1] || hwidMatch[0]) : '',
                            ip: ipMatch ? ipMatch[0] : '',
                            discord: discordMatch ? discordMatch[1] : '',
                            subnet: ipMatch ? ipMatch[0].split('.').slice(0, 3).join('.') + '.0/24' : '',
                            raw: trimmed
                        });
                    }
                });
            });
        }

        // Only use user-inputted accounts from active workspace
        accounts = accList.slice(0, 16);
        computePairwiseCollisions();
        updateVitals();
        renderActiveView();
        renderSubnetClusters();
    }

    // Compute pairwise overlap scores
    function computePairwiseCollisions() {
        const pairs = [];
        for (let i = 0; i < accounts.length; i++) {
            for (let j = i + 1; j < accounts.length; j++) {
                const a = accounts[i];
                const b = accounts[j];

                let score = 0;
                const matches = [];

                // HWID match
                if (a.hwid && b.hwid && a.hwid.toLowerCase() === b.hwid.toLowerCase()) {
                    score += 50;
                    matches.push('Identical Hardware ID (HWID)');
                }

                // IP match
                if (a.ip && b.ip && a.ip === b.ip) {
                    score += 40;
                    matches.push('Identical Public IP Address');
                } else if (a.subnet && b.subnet && a.subnet === b.subnet) {
                    score += 20;
                    matches.push(`Shared /24 Subnet (${a.subnet})`);
                }

                // Discord match
                if (a.discord && b.discord && a.discord === b.discord) {
                    score += 30;
                    matches.push('Shared Discord Identifier');
                }

                score = Math.min(100, score);

                if (score > 0) {
                    pairs.push({
                        accA: a,
                        accB: b,
                        score,
                        matches
                    });
                }
            }
        }

        // Sort descending by score
        pairs.sort((a, b) => b.score - a.score);
        collisionPairs = pairs;
    }

    function updateVitals() {
        const totalAccEl = document.getElementById('vital-total-acc');
        const totalCollisionsEl = document.getElementById('vital-total-collisions');
        const highMatchesEl = document.getElementById('vital-high-matches');
        const subnetsCountEl = document.getElementById('vital-subnet-clusters');

        if (totalAccEl) totalAccEl.textContent = accounts.length;
        if (totalCollisionsEl) totalCollisionsEl.textContent = collisionPairs.length;

        const highCount = collisionPairs.filter(p => p.score >= 75).length;
        if (highMatchesEl) highMatchesEl.textContent = highCount;

        const subnets = new Set(accounts.map(a => a.subnet).filter(Boolean));
        if (subnetsCountEl) subnetsCountEl.textContent = subnets.size;
    }

    function renderActiveView() {
        const heatmapEl = document.getElementById('matrix-heatmap-view');
        const listEl = document.getElementById('matrix-list-view');

        if (currentView === 'heatmap') {
            if (heatmapEl) heatmapEl.classList.remove('hidden');
            if (listEl) listEl.classList.add('hidden');
            renderHeatmap();
        } else {
            if (heatmapEl) heatmapEl.classList.add('hidden');
            if (listEl) listEl.classList.remove('hidden');
            renderRankedList();
        }
    }

    function renderHeatmap() {
        const container = document.getElementById('matrix-heatmap-container');
        if (!container) return;

        if (accounts.length < 2) {
            container.innerHTML = `
                <div style="text-align: center; padding: 50px 20px;">
                    <svg viewBox="0 0 24 24" width="44" height="44" stroke="currentColor" stroke-width="1.6" fill="none" style="color: #818cf8; margin-bottom: 12px;">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="3" y1="9" x2="21" y2="9"></line>
                        <line x1="3" y1="15" x2="21" y2="15"></line>
                        <line x1="9" y1="3" x2="9" y2="21"></line>
                        <line x1="15" y1="3" x2="15" y2="21"></line>
                    </svg>
                    <h3 style="margin: 0 0 8px; color: var(--text-1); font-size: 1.15rem;">Insufficient Accounts for Matrix Analysis</h3>
                    <p style="color: var(--text-3); font-size: 0.88rem; max-width: 520px; margin: 0 auto 18px; line-height: 1.5;">
                        Pairwise correlation analysis requires at least 2 player records loaded in your active workspace to compare hardware IDs, IP addresses, and subnets.
                    </p>
                    <div style="background: var(--bg-deep); border: 1px solid var(--border); border-radius: 10px; max-width: 520px; margin: 0 auto 20px; padding: 14px 18px; text-align: left; font-size: 0.82rem; color: var(--text-2); line-height: 1.6;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; color: #818cf8; font-weight: 700;">
                            <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2.2" fill="none">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="16" x2="12" y2="12"></line>
                                <line x1="12" y1="8" x2="12.01" y2="8"></line>
                            </svg>
                            <span>How Collision Detection Works</span>
                        </div>
                        <ul style="margin: 0; padding-left: 20px;">
                            <li>Exact <strong>HWID matches</strong> indicate the same physical computer (100% collision confidence).</li>
                            <li>Identical <strong>Public IPs</strong> indicate shared network or proxy usage (90% correlation).</li>
                            <li>Shared <strong>/24 Subnet prefixes</strong> flag localized VPN ranges or co-located players (50% correlation).</li>
                        </ul>
                    </div>
                    <a href="workspace.html" class="btn btn-primary btn-sm">
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                            <polyline points="16 18 22 12 16 6"></polyline>
                            <polyline points="8 6 2 12 8 18"></polyline>
                        </svg>
                        Open Workspace to Add Accounts
                    </a>
                </div>
            `;
            return;
        }

        let html = '<table class="matrix-heatmap-table"><thead><tr><th></th>';

        // Column headers
        accounts.forEach(acc => {
            html += `<th title="${escapeHTML(acc.name)} (ID: ${acc.id})">${escapeHTML(acc.id)}</th>`;
        });
        html += '</tr></thead><tbody>';

        // Rows
        accounts.forEach((rowAcc, rIdx) => {
            html += `<tr><th title="${escapeHTML(rowAcc.name)} (ID: ${rowAcc.id})" style="text-align: right; padding-right: 10px;">${escapeHTML(rowAcc.id)}</th>`;

            accounts.forEach((colAcc, cIdx) => {
                if (rIdx === cIdx) {
                    html += `<td><div class="matrix-cell self" title="${escapeHTML(rowAcc.name)} — Self">—</div></td>`;
                    return;
                }

                // Find collision score
                const pair = collisionPairs.find(p =>
                    (p.accA.id === rowAcc.id && p.accB.id === colAcc.id) ||
                    (p.accA.id === colAcc.id && p.accB.id === rowAcc.id)
                );

                const score = pair ? pair.score : 0;

                let scoreClass = 'score-0';
                if (score >= 75) scoreClass = 'score-high';
                else if (score >= 40) scoreClass = 'score-med';
                else if (score > 0) scoreClass = 'score-low';

                html += `
                    <td>
                        <div class="matrix-cell ${scoreClass}" 
                             data-id-a="${rowAcc.id}" 
                             data-id-b="${colAcc.id}" 
                             title="${escapeHTML(rowAcc.name)} ↔ ${escapeHTML(colAcc.name)}: ${score}% Match">
                            ${score > 0 ? score + '%' : ''}
                        </div>
                    </td>
                `;
            });
            html += '</tr>';
        });

        html += '</tbody></table>';
        container.innerHTML = html;

        // Attach click listener for cell details
        container.querySelectorAll('.matrix-cell:not(.self)').forEach(cell => {
            cell.addEventListener('click', () => {
                const idA = cell.getAttribute('data-id-a');
                const idB = cell.getAttribute('data-id-b');
                openCollisionModal(idA, idB);
            });
        });
    }

    function renderRankedList() {
        const container = document.getElementById('matrix-ranked-container');
        if (!container) return;

        let filtered = collisionPairs.filter(p => p.score >= minConfidence);

        if (batchQuery) {
            const q = batchQuery.toLowerCase();
            filtered = filtered.filter(p =>
                p.accA.name.toLowerCase().includes(q) ||
                p.accA.id.toLowerCase().includes(q) ||
                p.accA.hwid.toLowerCase().includes(q) ||
                p.accB.name.toLowerCase().includes(q) ||
                p.accB.id.toLowerCase().includes(q) ||
                p.accB.hwid.toLowerCase().includes(q)
            );
        }

        if (filtered.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--text-3);">
                    No pairwise collisions match current threshold (${minConfidence}%).
                </div>
            `;
            return;
        }

        let html = '';
        filtered.forEach(pair => {
            let badgeClass = 'score-badge-low';
            if (pair.score >= 75) badgeClass = 'score-badge-high';
            else if (pair.score >= 40) badgeClass = 'score-badge-med';

            html += `
                <div class="matrix-ranked-item">
                    <div style="display: flex; align-items: center; gap: 14px;">
                        <div class="matrix-match-score ${badgeClass}">${pair.score}%</div>
                        <div>
                            <div style="font-weight: 700; color: var(--text-1); font-size: 0.95rem;">
                                ${escapeHTML(pair.accA.name)} <span style="color: var(--text-3);">↔</span> ${escapeHTML(pair.accB.name)}
                            </div>
                            <div style="font-size: 0.8rem; color: var(--text-3); margin-top: 4px;">
                                ${pair.matches.join(' • ')}
                            </div>
                        </div>
                    </div>
                    <button class="btn btn-secondary btn-sm" onclick="window.viewMatrixCollision('${pair.accA.id}', '${pair.accB.id}')">
                        Inspect Overlap
                    </button>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    function renderSubnetClusters() {
        const container = document.getElementById('matrix-subnet-container');
        if (!container) return;

        const subnetsMap = {};
        accounts.forEach(acc => {
            if (!acc.subnet) return;
            if (!subnetsMap[acc.subnet]) subnetsMap[acc.subnet] = [];
            subnetsMap[acc.subnet].push(acc);
        });

        let html = '';
        Object.keys(subnetsMap).forEach(sub => {
            const list = subnetsMap[sub];
            const isSuspicious = list.length >= 2;

            html += `
                <div class="matrix-subnet-card" style="${isSuspicious ? 'border-color: rgba(245, 158, 11, 0.4);' : ''}">
                    <div class="matrix-subnet-header">
                        <span class="matrix-subnet-ip">${sub}</span>
                        <span class="badge" style="${isSuspicious ? 'background: rgba(245, 158, 11, 0.15); color: #fbbf24;' : 'background: rgba(56, 189, 248, 0.15); color: #38bdf8;'}">
                            ${list.length} Accounts
                        </span>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 6px;">
                        ${list.map(a => `
                            <div style="display: flex; justify-content: space-between; font-size: 0.82rem; font-family: 'JetBrains Mono', monospace; padding: 4px 0; border-bottom: 1px solid var(--border);">
                                <span style="color: var(--text-1);">${escapeHTML(a.name)} (ID: ${a.id})</span>
                                <span style="color: var(--text-3);">${a.ip}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    function openCollisionModal(idA, idB) {
        const a = accounts.find(acc => acc.id === idA);
        const b = accounts.find(acc => acc.id === idB);
        if (!a || !b) return;

        const pair = collisionPairs.find(p =>
            (p.accA.id === idA && p.accB.id === idB) ||
            (p.accA.id === idB && p.accB.id === idA)
        );

        const score = pair ? pair.score : 0;
        const matches = pair ? pair.matches : ['No overlapping attributes detected.'];

        const modal = document.getElementById('collision-modal');
        const titleEl = document.getElementById('collision-modal-title');
        const bodyEl = document.getElementById('collision-modal-body');

        if (titleEl) titleEl.textContent = `${a.name} ↔ ${b.name}`;

        if (bodyEl) {
            bodyEl.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; padding: 12px 16px; background: var(--bg-deep); border-radius: 10px; border: 1px solid var(--border);">
                    <div>
                        <div style="font-size: 0.8rem; color: var(--text-3);">Pairwise Overlap Confidence</div>
                        <div style="font-size: 1.5rem; font-weight: 800; font-family: 'JetBrains Mono', monospace; color: ${score >= 75 ? '#f87171' : score >= 40 ? '#fbbf24' : '#38bdf8'};">
                            ${score}% Probability
                        </div>
                    </div>
                    <span class="badge" style="background: rgba(129, 140, 248, 0.15); color: #818cf8;">Forensic Match</span>
                </div>

                <div style="margin-bottom: 16px;">
                    <div style="font-size: 0.82rem; font-weight: 700; color: var(--text-2); margin-bottom: 8px;">Collision Evidence</div>
                    <ul style="margin: 0; padding-left: 20px; font-size: 0.85rem; color: var(--text-1); line-height: 1.6;">
                        ${matches.map(m => `<li>${escapeHTML(m)}</li>`).join('')}
                    </ul>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 0.8rem; font-family: 'JetBrains Mono', monospace;">
                    <div style="background: var(--bg-deep); padding: 12px; border-radius: 8px; border: 1px solid var(--border);">
                        <div style="font-weight: 700; color: var(--text-1); margin-bottom: 6px;">${escapeHTML(a.name)}</div>
                        <div>ID: ${a.id}</div>
                        <div>IP: ${a.ip || 'None'}</div>
                        <div style="word-break: break-all;">HWID: ${a.hwid || 'None'}</div>
                    </div>
                    <div style="background: var(--bg-deep); padding: 12px; border-radius: 8px; border: 1px solid var(--border);">
                        <div style="font-weight: 700; color: var(--text-1); margin-bottom: 6px;">${escapeHTML(b.name)}</div>
                        <div>ID: ${b.id}</div>
                        <div>IP: ${b.ip || 'None'}</div>
                        <div style="word-break: break-all;">HWID: ${b.hwid || 'None'}</div>
                    </div>
                </div>
            `;
        }

        if (modal) modal.classList.remove('hidden');
    }
    window.viewMatrixCollision = openCollisionModal;

    function escapeHTML(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // Initialize Event Listeners
    document.addEventListener('DOMContentLoaded', () => {
        loadCollisionData();

        // View toggle buttons
        const toggleHeatmap = document.getElementById('toggle-view-heatmap');
        const toggleList = document.getElementById('toggle-view-list');

        if (toggleHeatmap && toggleList) {
            toggleHeatmap.addEventListener('click', () => {
                currentView = 'heatmap';
                toggleHeatmap.classList.add('active');
                toggleList.classList.remove('active');
                renderActiveView();
            });
            toggleList.addEventListener('click', () => {
                currentView = 'list';
                toggleList.classList.add('active');
                toggleHeatmap.classList.remove('active');
                renderActiveView();
            });
        }

        // Confidence threshold slider
        const slider = document.getElementById('confidence-threshold-slider');
        const sliderVal = document.getElementById('confidence-threshold-val');
        if (slider && sliderVal) {
            slider.addEventListener('input', (e) => {
                minConfidence = Number(e.target.value);
                sliderVal.textContent = minConfidence + '%';
                if (currentView === 'list') renderRankedList();
            });
        }

        // Batch Query Input
        const queryInput = document.getElementById('matrix-batch-query');
        if (queryInput) {
            queryInput.addEventListener('input', (e) => {
                batchQuery = e.target.value.trim();
                if (currentView === 'list') renderRankedList();
            });
        }

        // Modal Close
        const modal = document.getElementById('collision-modal');
        const closeBtn = document.getElementById('close-collision-modal-btn');
        const okBtn = document.getElementById('collision-modal-ok');

        const closeModal = () => {
            if (modal) modal.classList.add('hidden');
        };

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (okBtn) okBtn.addEventListener('click', closeModal);

        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeModal();
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
                closeModal();
            }
        });

        // Refresh Button
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                collectAccounts();
                showToast('Collision matrix recalculated');
            });
        }

        collectAccounts();
    });
})();

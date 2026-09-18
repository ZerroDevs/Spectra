/**
 * Spectra Intelligence - Tactical Watchlist & Second-Screen HUD
 * Real-time staffing radar, persistent target pinboard, sub-millisecond triage lookup,
 * client-side synthetic audio cues, and rapid command synthesis.
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
        watchlist: 'multiCheckWatchlist',
        notes: 'multiCheckGrieferNotes'
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

    function showToast(msg, duration = 2800) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.innerHTML = `<img src="assets/images/logo1.png" alt="" class="toast-favicon" style="width:15px;height:15px;vertical-align:middle;margin-right:7px;border-radius:3px;display:inline-block;"><span>${msg}</span>`;
        toast.classList.add('show', 'visible');
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => toast.classList.remove('show', 'visible'), duration);
    }

    // State
    let audioEnabled = true;
    let watchlist = [];
    let audioCtx = null;

    // Web Audio API Synthetic Beep (100% Client-Side)
    function playAlertSound() {
        if (!audioEnabled) return;
        try {
            if (!audioCtx) {
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                if (!AudioContextClass) return;
                audioCtx = new AudioContextClass();
            }
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }

            const osc1 = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();

            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
            osc1.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.12); // A6

            gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);

            osc1.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            osc1.start();
            osc1.stop(audioCtx.currentTime + 0.16);
        } catch (e) { }
    }

    // Digital Clock
    function startClock() {
        const timeEl = document.getElementById('live-clock-time');
        const utcEl = document.getElementById('live-clock-utc');

        function update() {
            const now = new Date();
            if (timeEl) {
                timeEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            }
            if (utcEl) {
                utcEl.textContent = `UTC: ${now.toUTCString().slice(17, 25)} | Session Active`;
            }
        }
        update();
        setInterval(update, 1000);
    }

    // Load Watchlist Targets
    function loadWatchlist() {
        const raw = lsGet(KEYS.watchlist, '[]');
        let list = parseJSON(raw, []);
        if (!Array.isArray(list)) list = [];

        // Clean out legacy demo seed suspects if present
        list = list.filter(item => !(item.id === '1042' && item.name && item.name.includes('Zerro')));

        watchlist = list;
        renderWatchlist();
    }

    function renderWatchlist() {
        const container = document.getElementById('live-watchlist-container');
        const countEl = document.getElementById('live-pinned-count');
        if (countEl) countEl.textContent = watchlist.length;

        if (!container) return;

        if (watchlist.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 50px 20px; background: var(--surface); border: 1px dashed var(--border); border-radius: var(--radius-md);">
                    <svg viewBox="0 0 24 24" width="44" height="44" stroke="currentColor" stroke-width="1.6" fill="none" style="color: #ef4444; margin-bottom: 12px;">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="22" y1="12" x2="18" y2="12"></line>
                        <line x1="6" y1="12" x2="2" y2="12"></line>
                        <line x1="12" y1="6" x2="12" y2="2"></line>
                        <line x1="12" y1="22" x2="12" y2="18"></line>
                    </svg>
                    <h3 style="margin: 0 0 8px; color: var(--text-1); font-size: 1.15rem;">No Targets Pinned to Watchlist HUD</h3>
                    <p style="color: var(--text-3); font-size: 0.88rem; max-width: 520px; margin: 0 auto 18px; line-height: 1.5;">
                        Track active suspects during live moderation shifts. Pinned targets allow instant lookup, hardware correlation checks, and 1-click console sanction execution.
                    </p>
                    <div style="background: var(--bg-deep); border: 1px solid var(--border); border-radius: 10px; max-width: 520px; margin: 0 auto 20px; padding: 14px 18px; text-align: left; font-size: 0.82rem; color: var(--text-2); line-height: 1.6;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; color: #ef4444; font-weight: 700;">
                            <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2.2" fill="none">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="16" x2="12" y2="12"></line>
                                <line x1="12" y1="8" x2="12.01" y2="8"></line>
                            </svg>
                            <span>How Radar Surveillance Works</span>
                        </div>
                        <ul style="margin: 0; padding-left: 20px;">
                            <li>Click <strong>Pin Target</strong> to register a suspect by Character Name, Server ID, or HWID.</li>
                            <li>Or press <kbd style="background: var(--surface); padding: 1px 5px; border-radius: 4px; border: 1px solid var(--border);">Ctrl+K</kbd> to rapidly triage live logs and pin suspects with one click.</li>
                            <li>Run preformatted ban, kick, and freeze commands copied instantly to your clipboard.</li>
                        </ul>
                    </div>
                    <button class="btn btn-primary btn-sm" id="empty-pin-target-btn">
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Pin First Target
                    </button>
                </div>
            `;
            const emptyBtn = document.getElementById('empty-pin-target-btn');
            if (emptyBtn) {
                emptyBtn.addEventListener('click', () => {
                    const modal = document.getElementById('add-target-modal');
                    if (modal) modal.classList.remove('hidden');
                });
            }
            return;
        }

        let html = '';
        watchlist.forEach((s, idx) => {
            const isHigh = s.status === 'CRITICAL' || s.status === 'HIGH';
            let statusBadge = `<span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8;">WATCH</span>`;
            if (s.status === 'CRITICAL') {
                statusBadge = `<span class="badge" style="background: rgba(239, 68, 68, 0.15); color: #f87171;">CRITICAL</span>`;
            } else if (s.status === 'HIGH') {
                statusBadge = `<span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24;">HIGH RISK</span>`;
            }

            html += `
                <article class="live-suspect-card ${isHigh ? 'pinned-high' : ''}">
                    <div class="live-suspect-top">
                        <div>
                            <div class="live-suspect-name">${escapeHTML(s.name)}</div>
                            <div class="live-suspect-id">Server ID: <strong>${escapeHTML(s.id)}</strong></div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 6px;">
                            ${statusBadge}
                            <button class="icon-btn small" onclick="window.unpinSuspect(${idx})" title="Unpin Target" style="width: 24px; height: 24px;"><svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.2" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
                        </div>
                    </div>

                    <div class="live-suspect-details">
                        <div>IP: <span style="color: var(--text-1);">${escapeHTML(s.ip || 'N/A')}</span></div>
                        <div style="word-break: break-all;">HWID: <span style="color: var(--text-1);">${escapeHTML((s.hwid || '').slice(0, 16))}...</span></div>
                        ${s.alts && s.alts.length ? `<div>Linked Alts: <span style="color: #fbbf24;">${escapeHTML(s.alts.join(', '))}</span></div>` : ''}
                        <div style="color: var(--text-3); font-size: 0.78rem; margin-top: 4px;">${escapeHTML(s.notes || 'No custom notes.')}</div>
                    </div>

                    <div class="live-suspect-actions">
                        <button class="live-action-btn ban-btn" onclick="window.copyBanCommand('${s.id}', '${escapeHTML(s.name)}')">
                            /ban ${s.id}
                        </button>
                        <button class="live-action-btn" onclick="window.copyKickCommand('${s.id}')">
                            /kick ${s.id}
                        </button>
                        <button class="live-action-btn" onclick="window.copyFreezeCommand('${s.id}')">
                            /freeze ${s.id}
                        </button>
                    </div>
                </article>
            `;
        });

        container.innerHTML = html;
    }

    // Triage Quick Lookup
    function handleTriageSearch(query) {
        const resultContainer = document.getElementById('live-triage-result');
        if (!resultContainer) return;

        const q = query.trim().toLowerCase();
        if (!q) {
            resultContainer.innerHTML = '';
            resultContainer.classList.add('hidden');
            return;
        }

        // Search in watchlist, workspaces, and notes
        const currentWsId = lsGet(KEYS.current, 'default');
        const tabsKey = currentWsId === 'default' ? KEYS.tabs : `${KEYS.tabs}_${currentWsId}`;
        const tabs = parseJSON(lsGet(tabsKey, '[]'), []);

        let matches = [];

        // 1. Check watchlist
        watchlist.forEach(w => {
            if (w.id.toLowerCase().includes(q) || w.name.toLowerCase().includes(q) || (w.ip && w.ip.includes(q)) || (w.hwid && w.hwid.toLowerCase().includes(q))) {
                matches.push({
                    source: 'Watchlist Pinboard',
                    name: w.name,
                    id: w.id,
                    ip: w.ip,
                    hwid: w.hwid,
                    status: w.status
                });
            }
        });

        // 2. Check workspace tabs
        tabs.forEach(t => {
            (t.text || '').split('\n').forEach(line => {
                const trimmed = line.trim();
                if (trimmed.toLowerCase().includes(q)) {
                    const idMatch = trimmed.match(/\b\d{4,7}\b/);
                    const ipMatch = trimmed.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
                    const hwidMatch = trimmed.match(/\b[A-F0-9]{32}\b/i);
                    matches.push({
                        source: `Workspace: ${t.name || 'Tab'}`,
                        name: trimmed.split(/[\t,|]/)[0].trim(),
                        id: idMatch ? idMatch[0] : 'N/A',
                        ip: ipMatch ? ipMatch[0] : 'N/A',
                        hwid: hwidMatch ? hwidMatch[0] : 'N/A',
                        status: /griefer|fail-rp/i.test(trimmed) ? 'CRITICAL' : 'MATCH'
                    });
                }
            });
        });

        // Remove duplicates by ID
        const unique = [];
        const seen = new Set();
        matches.forEach(m => {
            const key = m.id + m.name;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(m);
            }
        });

        resultContainer.classList.remove('hidden');

        if (unique.length === 0) {
            resultContainer.innerHTML = `
                <div class="live-triage-result-card">
                    <span style="color: var(--text-3); font-size: 0.85rem;">No active blacklist or workspace records match "${escapeHTML(query)}"</span>
                    <button class="btn btn-secondary btn-sm" onclick="window.quickPinFromQuery('${escapeHTML(query)}')">+ Pin as Target</button>
                </div>
            `;
        } else {
            playAlertSound();
            const first = unique[0];
            resultContainer.innerHTML = `
                <div class="live-triage-result-card match-alert">
                    <div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span class="badge" style="background: rgba(239, 68, 68, 0.2); color: #f87171;">DETECTED MATCH</span>
                            <strong style="color: var(--text-1); font-size: 0.95rem;">${escapeHTML(first.name)} (ID: ${escapeHTML(first.id)})</strong>
                            <span style="font-size: 0.75rem; color: var(--text-3);">[${escapeHTML(first.source)}]</span>
                        </div>
                        <div style="font-size: 0.8rem; font-family: 'JetBrains Mono', monospace; color: var(--text-2); margin-top: 4px;">
                            IP: <code>${escapeHTML(first.ip)}</code> | HWID: <code>${escapeHTML((first.hwid || '').slice(0, 16))}...</code>
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="live-action-btn ban-btn" onclick="window.copyBanCommand('${first.id}', '${escapeHTML(first.name)}')">/ban ${first.id}</button>
                        <button class="btn btn-secondary btn-sm" onclick="window.quickPinRecord('${escapeHTML(first.name)}', '${first.id}', '${first.ip}', '${first.hwid}')">Pin Target</button>
                    </div>
                </div>
            `;
        }
    }

    // Global Command Generators
    window.copyBanCommand = (id, name) => {
        const cmd = `/ban ${id} 60d GR3.1 + Multi-Accounting [Spectra Radar]`;
        navigator.clipboard.writeText(cmd).then(() => {
            showToast(`Copied: <code>${cmd}</code>`);
        });
    };

    window.copyKickCommand = (id) => {
        const cmd = `/kick ${id} Admin Investigation Required`;
        navigator.clipboard.writeText(cmd).then(() => {
            showToast(`Copied: <code>${cmd}</code>`);
        });
    };

    window.copyFreezeCommand = (id) => {
        const cmd = `/freeze ${id}`;
        navigator.clipboard.writeText(cmd).then(() => {
            showToast(`Copied: <code>${cmd}</code>`);
        });
    };

    window.unpinSuspect = (idx) => {
        watchlist.splice(idx, 1);
        lsSet(KEYS.watchlist, watchlist);
        renderWatchlist();
        showToast('Target unpinned from watchlist');
    };

    window.quickPinRecord = (name, id, ip, hwid) => {
        watchlist.unshift({
            id: id || '0',
            name: name || 'Suspect',
            ip: ip === 'N/A' ? '' : ip,
            hwid: hwid === 'N/A' ? '' : hwid,
            status: 'HIGH',
            notes: 'Quick-pinned from triage search.',
            alts: []
        });
        lsSet(KEYS.watchlist, watchlist);
        renderWatchlist();
        showToast(`Pinned ${name} to HUD pinboard`);
    };

    window.quickPinFromQuery = (query) => {
        watchlist.unshift({
            id: query.replace(/\D/g, '') || '0',
            name: query,
            ip: '',
            hwid: '',
            status: 'WATCH',
            notes: 'Quick-pinned target.',
            alts: []
        });
        lsSet(KEYS.watchlist, watchlist);
        renderWatchlist();
        showToast(`Pinned target "${query}" to HUD`);
    };

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
        // Theme toggle
        const themeBtn = document.getElementById('theme-toggle-btn');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => {
                const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
                document.documentElement.setAttribute('data-theme', next);
                localStorage.setItem('multiCheckTheme', next);
                localStorage.setItem('spectraTheme', next);
            });
        }

        startClock();
        loadWatchlist();

        // Audio toggle
        const audioBtn = document.getElementById('toggle-audio-radar-btn');
        if (audioBtn) {
            audioBtn.addEventListener('click', () => {
                audioEnabled = !audioEnabled;
                audioBtn.innerHTML = audioEnabled ? `
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                    </svg>
                    Radar Audio ON
                ` : `
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" style="opacity: 0.6;">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                        <line x1="23" y1="9" x2="17" y2="15"></line>
                        <line x1="17" y1="9" x2="23" y2="15"></line>
                    </svg>
                    Radar Audio Muted
                `;
                showToast(audioEnabled ? 'Synthetic Radar Sound Enabled' : 'Audio Muted');
            });
        }

        // Triage input
        const triageInput = document.getElementById('live-triage-input');
        if (triageInput) {
            triageInput.addEventListener('input', (e) => {
                handleTriageSearch(e.target.value);
            });
        }

        // Keyboard Shortcut Ctrl+K
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                if (triageInput) {
                    triageInput.focus();
                    triageInput.select();
                }
            }
        });

        // Add Target Modal
        const addTargetBtn = document.getElementById('add-target-btn');
        const targetModal = document.getElementById('add-target-modal');
        const closeTargetBtn = document.getElementById('close-target-modal-btn');
        const cancelTargetBtn = document.getElementById('cancel-target-btn');
        const saveTargetBtn = document.getElementById('save-target-btn');

        const closeModal = () => {
            if (targetModal) targetModal.classList.add('hidden');
        };

        if (addTargetBtn && targetModal) {
            addTargetBtn.addEventListener('click', () => {
                targetModal.classList.remove('hidden');
                const first = document.getElementById('new-target-name');
                if (first) first.focus();
            });
        }
        if (closeTargetBtn) closeTargetBtn.addEventListener('click', closeModal);
        if (cancelTargetBtn) cancelTargetBtn.addEventListener('click', closeModal);

        if (targetModal) {
            targetModal.addEventListener('click', (e) => {
                if (e.target === targetModal) closeModal();
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && targetModal && !targetModal.classList.contains('hidden')) {
                closeModal();
            }
        });

        if (saveTargetBtn && targetModal) {
            saveTargetBtn.addEventListener('click', () => {
                const name = document.getElementById('new-target-name')?.value.trim();
                const id = document.getElementById('new-target-id')?.value.trim();
                const ip = document.getElementById('new-target-ip')?.value.trim();
                const hwid = document.getElementById('new-target-hwid')?.value.trim();
                const status = document.getElementById('new-target-status')?.value;
                const notes = document.getElementById('new-target-notes')?.value.trim();

                if (!name || !id) {
                    showToast('Please provide Name and ID');
                    return;
                }

                watchlist.unshift({ name, id, ip, hwid, status, notes, alts: [] });
                lsSet(KEYS.watchlist, watchlist);
                renderWatchlist();
                closeModal();
                showToast(`Pinned target ${name}`);

                // Clear fields
                if (document.getElementById('new-target-name')) document.getElementById('new-target-name').value = '';
                if (document.getElementById('new-target-id')) document.getElementById('new-target-id').value = '';
                if (document.getElementById('new-target-ip')) document.getElementById('new-target-ip').value = '';
                if (document.getElementById('new-target-hwid')) document.getElementById('new-target-hwid').value = '';
                if (document.getElementById('new-target-notes')) document.getElementById('new-target-notes').value = '';
            });
        }
    });
})();

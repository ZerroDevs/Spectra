/**
 * Spectra Intelligence - Multi-Framework Log Parser & Transpiler
 * Ingests raw logs from txAdmin, ESX, QBCore, vRP, Discord Webhooks, and CSV,
 * transpiling foreign formats into Spectra's native normalizer syntax.
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

    let activePreset = 'auto';

    // Sample datasets for testing
    const SAMPLES = {
        txadmin: `[txAdmin:PlayerList] ID: 1042 | Zerro | ping: 24ms | identifiers: [license:9b84c1a45f01e8402d67ae419b726c81, discord:41928410294819281, ip:178.62.204.18]
[txAdmin:PlayerList] ID: 9841 | Shadow | ping: 31ms | identifiers: [license:9b84c1a45f01e8402d67ae419b726c81, discord:41928410294819281, ip:178.62.204.22] (twink)
[txAdmin:PlayerList] ID: 5512 | Ghost_RP | ping: 88ms | identifiers: [license:9b84c1a45f01e8402d67ae419b726c81, ip:45.142.122.9] [Griefer]`,
        esx: `license:3a12d9f88c00b1294f90cc112a341e77	Vortex	2104	178.62.204.99	discord:89102948102948192
license:8812ee771a990142c8019942fa1109b3	Krypton	7731	185.191.171.4	Non-RP
license:3a12d9f88c00b1294f90cc112a341e77	Phantom (t)	3419	91.200.12.44	discord:89102948102948192`,
        qbcore: `[QB-Core:PlayerDump] CID: 1042 | CitizenID: ZER1042 | Name: Zerro | HWID: 9B84C1A45F01E8402D67AE419B726C81 | IP: 178.62.204.18 | Char: Main
[QB-Core:PlayerDump] CID: 9841 | CitizenID: SHA9841 | Name: Shadow | HWID: 9B84C1A45F01E8402D67AE419B726C81 | IP: 178.62.204.22 | Char: Alt
[QB-Core:PlayerDump] CID: 6019 | CitizenID: ECH6019 | Name: Echo_Fox | HWID: FA99104421C0E8119A42018449D017A2 | IP: 82.165.197.1 | Char: Main`,
        discord: `**Audit Event:** Player \`Zerro\` [ID: 1042] joined server. IP: \`178.62.204.18\` | HWID: \`9B84C1A45F01E8402D67AE419B726C81\`
**Audit Event:** Player \`Shadow\` [ID: 9841] joined server. IP: \`178.62.204.22\` | HWID: \`9B84C1A45F01E8402D67AE419B726C81\` [Twink]
**Warning Alert:** Griefer flag detected on ID 9841 [GR3.1, Fail-RP]`,
        csv: `Name,Server_ID,Hardware_ID,IP_Address,Flags
Zerro,1042,9B84C1A45F01E8402D67AE419B726C81,178.62.204.18,Main
Shadow,9841,9B84C1A45F01E8402D67AE419B726C81,178.62.204.22,Twink
Ghost_RP,5512,9B84C1A45F01E8402D67AE419B726C81,45.142.122.9,Griefer`
    };

    // Strip ANSI colors
    function stripAnsi(str) {
        return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
    }

    // Auto-detect format heuristics
    function detectFormat(raw) {
        if (/\[txAdmin/i.test(raw) || /license:[a-f0-9]{32}/i.test(raw) && /ping:/i.test(raw)) return 'txadmin';
        if (/license:[a-f0-9]{32}/i.test(raw)) return 'esx';
        if (/QB-Core/i.test(raw) || /CitizenID/i.test(raw)) return 'qbcore';
        if (/\*\*Audit Event/i.test(raw) || /`[0-9a-f]{16,32}`/i.test(raw)) return 'discord';
        if (/,Server_ID,/i.test(raw) || raw.split('\n')[0].split(',').length >= 4) return 'csv';
        return 'generic';
    }

    // Main transpiler
    function transpile(rawText) {
        if (!rawText.trim()) return '';

        const cleaned = stripAnsi(rawText);
        const lines = cleaned.split('\n');
        const outputLines = [];

        let detected = activePreset;
        if (detected === 'auto') {
            detected = detectFormat(cleaned);
        }

        const badgeEl = document.getElementById('detected-format-badge');
        if (badgeEl) badgeEl.textContent = detected.toUpperCase();

        lines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed) return;
            if (trimmed.startsWith('#') || trimmed.startsWith('Name,Server_ID')) return; // header comment

            let name = '';
            let id = '';
            let hwid = '';
            let ip = '';
            let tags = [];

            // Extract ID
            const idMatch = trimmed.match(/(?:ID|CID|Server_ID)[:=\s]*(\d{1,7})\b/i) || trimmed.match(/\b\d{4,7}\b/);
            if (idMatch) id = idMatch[1] || idMatch[0];

            // Extract IP
            const ipMatch = trimmed.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
            if (ipMatch) ip = ipMatch[0];

            // Extract HWID or License
            const hwidMatch = trimmed.match(/(?:hwid|license)[:=\s]*([a-f0-9]{32})/i) || trimmed.match(/\b[A-F0-9]{32}\b/i);
            if (hwidMatch) hwid = (hwidMatch[1] || hwidMatch[0]).toUpperCase();

            // Detect tags
            if (/\(t\)|\btwink\b/i.test(trimmed)) tags.push('(T)');
            if (/\(m\)|\bmain\b/i.test(trimmed)) tags.push('(M)');
            if (/griefer/i.test(trimmed)) tags.push('Griefer');
            if (/fail-rp/i.test(trimmed)) tags.push('Fail-RP');
            if (/non-rp/i.test(trimmed)) tags.push('Non-RP');
            if (/gr3\.[12]/i.test(trimmed)) tags.push('GR3.1');

            // Extract Name based on format
            if (detected === 'txadmin') {
                const parts = trimmed.split('|');
                if (parts.length >= 2) {
                    name = parts[1].replace(/ID:\s*\d+/i, '').trim();
                }
            } else if (detected === 'qbcore') {
                const nameMatch = trimmed.match(/Name:\s*([^|]+)/i);
                if (nameMatch) name = nameMatch[1].trim();
            } else if (detected === 'csv') {
                const cols = trimmed.split(',');
                if (cols.length >= 1) name = cols[0].trim();
            } else if (detected === 'discord') {
                const nameMatch = trimmed.match(/Player\s*`([^`]+)`/i);
                if (nameMatch) name = nameMatch[1].trim();
            }

            // Fallback name extraction
            if (!name) {
                const firstPart = trimmed.split(/[\t,|;]/)[0].trim();
                name = firstPart.replace(/^\[.*?\]\s*/, '').replace(/ID:\s*\d+/i, '').trim();
                if (!name || name.length > 25) name = id ? `Player_${id}` : 'Account';
            }

            // Clean up name
            name = name.replace(/\(t\)|\(m\)/gi, '').trim();

            const record = `${name} | ${id || '0'} | ${hwid || 'NO_HWID'} | ${ip || '0.0.0.0'}${tags.length ? ' | ' + tags.join(' ') : ''}`;
            outputLines.push(record);
        });

        return outputLines.join('\n');
    }

    function runTranspile() {
        const inputEl = document.getElementById('converter-raw-input');
        const outputEl = document.getElementById('converter-output');
        const countEl = document.getElementById('converted-records-count');

        if (!inputEl || !outputEl) return;

        const result = transpile(inputEl.value);
        outputEl.value = result;

        const count = result ? result.split('\n').filter(Boolean).length : 0;
        if (countEl) countEl.textContent = count;
    }

    // Send converted records to Workspace (#main)
    function sendToWorkspace() {
        const outputEl = document.getElementById('converter-output');
        if (!outputEl || !outputEl.value.trim()) {
            showToast('No converted records to send');
            return;
        }

        const currentWsId = lsGet(KEYS.current, 'default');
        const tabsKey = currentWsId === 'default' ? KEYS.tabs : `${KEYS.tabs}_${currentWsId}`;
        const tabs = parseJSON(lsGet(tabsKey, '[]'), []);

        const newTab = {
            id: 'tab-' + Date.now(),
            name: `Transpiled Import (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
            text: outputEl.value.trim()
        };

        tabs.push(newTab);
        lsSet(tabsKey, tabs);

        showToast('Injected into Workspace tabs! Opening workspace...');
        setTimeout(() => {
            window.location.href = 'workspace.html#main';
        }, 800);
    }

    // Initialize Event Listeners
    document.addEventListener('DOMContentLoaded', () => {
        const rawInput = document.getElementById('converter-raw-input');
        if (rawInput) {
            rawInput.addEventListener('input', runTranspile);
        }

        // Preset Chips
        const chips = document.querySelectorAll('.converter-chip');
        chips.forEach(chip => {
            chip.addEventListener('click', () => {
                chips.forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                activePreset = chip.getAttribute('data-preset') || 'auto';
                runTranspile();
                showToast(`Parser preset set to ${activePreset.toUpperCase()}`);
            });
        });

        // Dropzone handling
        const dropzone = document.getElementById('converter-dropzone');
        if (dropzone && rawInput) {
            dropzone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropzone.classList.add('dragover');
            });
            dropzone.addEventListener('dragleave', () => {
                dropzone.classList.remove('dragover');
            });
            dropzone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropzone.classList.remove('dragover');
                const file = e.dataTransfer.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        rawInput.value = event.target.result;
                        runTranspile();
                        showToast(`Loaded file: ${file.name}`);
                    };
                    reader.readAsText(file);
                }
            });
        }

        // Send to Workspace button
        const sendBtn = document.getElementById('send-to-workspace-btn');
        if (sendBtn) {
            sendBtn.addEventListener('click', sendToWorkspace);
        }

        // Copy button
        const copyBtn = document.getElementById('copy-converted-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                const outputEl = document.getElementById('converter-output');
                if (outputEl && outputEl.value) {
                    navigator.clipboard.writeText(outputEl.value).then(() => {
                        showToast('Converted records copied to clipboard!');
                    });
                }
            });
        }

        // Download button
        const downloadBtn = document.getElementById('download-converted-btn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                const outputEl = document.getElementById('converter-output');
                if (outputEl && outputEl.value) {
                    const blob = new Blob([outputEl.value], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `spectra-normalized-${Date.now()}.txt`;
                    a.click();
                    URL.revokeObjectURL(url);
                    showToast('Normalized file downloaded');
                }
            });
        }
    });
})();

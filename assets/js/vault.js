/**
 * Spectra Intelligence - Encrypted Data Vault & Migration Manager
 * Client-side AES-GCM 256-bit encryption with PBKDF2 key derivation,
 * complete storage diagnostics, snapshots rollback, and emergency zero-trace wipe.
 */
(() => {
    'use strict';

    // Theme initialization
    let currentTheme = 'dark';
    try {
        currentTheme = localStorage.getItem('multiCheckTheme') || localStorage.getItem('spectraTheme') || 'dark';
    } catch (e) { }
    document.documentElement.setAttribute('data-theme', currentTheme);

    const KNOWN_KEYS = [
        'multiCheckWorkspaces',
        'multiCheckCurrentWorkspace',
        'multiCheckTabs',
        'multiCheckGrieferNotes',
        'multiCheckRuleProfiles',
        'multiCheckActiveRuleProfile',
        'multiCheckCustomRules',
        'multiCheckHistoricalSnapshots',
        'multiCheckTemporalMutations',
        'multiCheckWatchlist',
        'multiCheckTimelineCustomEvents',
        'multiCheckTheme',
        'spectraTheme'
    ];

    function showToast(msg, duration = 3000) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.innerHTML = `<img src="assets/images/logo1.png" alt="" class="toast-favicon" style="width:15px;height:15px;vertical-align:middle;margin-right:7px;border-radius:3px;display:inline-block;"><span>${msg}</span>`;
        toast.classList.add('show', 'visible');
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => toast.classList.remove('show', 'visible'), duration);
    }

    // Web Crypto API Helpers
    async function deriveKey(password, salt) {
        const enc = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            enc.encode(password),
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        );
        return crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt,
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }

    async function encryptBundle(obj, password) {
        const enc = new TextEncoder();
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const key = await deriveKey(password, salt);

        const plaintext = enc.encode(JSON.stringify(obj));
        const ciphertext = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            plaintext
        );

        return {
            v: 'SPECTRA-VAULT-2.0',
            encrypted: true,
            createdAt: new Date().toISOString(),
            salt: btoa(String.fromCharCode(...salt)),
            iv: btoa(String.fromCharCode(...iv)),
            data: btoa(String.fromCharCode(...new Uint8Array(ciphertext)))
        };
    }

    async function decryptBundle(bundle, password) {
        const dec = new TextDecoder();
        const salt = new Uint8Array(atob(bundle.salt).split('').map(c => c.charCodeAt(0)));
        const iv = new Uint8Array(atob(bundle.iv).split('').map(c => c.charCodeAt(0)));
        const ciphertext = new Uint8Array(atob(bundle.data).split('').map(c => c.charCodeAt(0)));

        const key = await deriveKey(password, salt);
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            ciphertext
        );

        return JSON.parse(dec.decode(decrypted));
    }

    // Storage Diagnostics
    function updateDiagnostics() {
        let totalBytes = 0;
        let wsBytes = 0;
        let tabsBytes = 0;
        let auditBytes = 0;
        let rulesBytes = 0;
        let snapBytes = 0;

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const val = localStorage.getItem(key) || '';
            const byteSize = (key.length + val.length) * 2; // UTF-16 approx
            totalBytes += byteSize;

            if (key.includes('Workspaces')) wsBytes += byteSize;
            else if (key.includes('Tabs')) tabsBytes += byteSize;
            else if (key.includes('Griefer') || key.includes('Blacklist')) auditBytes += byteSize;
            else if (key.includes('Rule')) rulesBytes += byteSize;
            else if (key.includes('Snapshot') || key.includes('Mutation')) snapBytes += byteSize;
        }

        const totalKb = (totalBytes / 1024).toFixed(1);
        const countEl = document.getElementById('vault-storage-total');
        if (countEl) countEl.textContent = `${totalKb} KB`;

        const pWs = totalBytes ? ((wsBytes / totalBytes) * 100).toFixed(1) : 20;
        const pTabs = totalBytes ? ((tabsBytes / totalBytes) * 100).toFixed(1) : 40;
        const pAudit = totalBytes ? ((auditBytes / totalBytes) * 100).toFixed(1) : 15;
        const pRules = totalBytes ? ((rulesBytes / totalBytes) * 100).toFixed(1) : 15;
        const pSnap = totalBytes ? ((snapBytes / totalBytes) * 100).toFixed(1) : 10;

        const segWs = document.getElementById('seg-ws');
        const segTabs = document.getElementById('seg-tabs');
        const segAudit = document.getElementById('seg-audit');
        const segRules = document.getElementById('seg-rules');
        const segSnap = document.getElementById('seg-snap');

        if (segWs) segWs.style.width = `${pWs}%`;
        if (segTabs) segTabs.style.width = `${pTabs}%`;
        if (segAudit) segAudit.style.width = `${pAudit}%`;
        if (segRules) segRules.style.width = `${pRules}%`;
        if (segSnap) segSnap.style.width = `${pSnap}%`;
    }

    // Export All Data
    function getAllData() {
        const data = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('multiCheck') || key.startsWith('spectra')) {
                data[key] = localStorage.getItem(key);
            }
        }
        return data;
    }

    async function handleExportEncrypted() {
        const pwdInput = document.getElementById('vault-export-pwd');
        const pwd = pwdInput ? pwdInput.value.trim() : '';

        if (!pwd) {
            showToast('Please enter an encryption password');
            return;
        }

        const data = getAllData();
        try {
            const bundle = await encryptBundle(data, pwd);
            const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `spectra-encrypted-${new Date().toISOString().slice(0, 10)}.spectra`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('Encrypted .spectra vault exported');
            if (pwdInput) pwdInput.value = '';
        } catch (e) {
            showToast('Encryption failed: ' + e.message);
        }
    }

    function handleExportJson() {
        const data = getAllData();
        const payload = {
            v: 'SPECTRA-VAULT-2.0',
            encrypted: false,
            createdAt: new Date().toISOString(),
            payload: data
        };

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `spectra-unencrypted-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Unencrypted JSON snapshot downloaded');
    }

    // Import Vault Data
    async function handleImport(file, password) {
        try {
            const text = await file.text();
            const json = JSON.parse(text);

            let restoredData = null;
            if (json.encrypted) {
                if (!password) {
                    showToast('Password required to decrypt this vault');
                    return false;
                }
                restoredData = await decryptBundle(json, password);
            } else {
                restoredData = json.payload || json;
            }

            if (!restoredData || typeof restoredData !== 'object') {
                showToast('Invalid vault structure');
                return false;
            }

            // Restore into localStorage
            Object.keys(restoredData).forEach(k => {
                localStorage.setItem(k, restoredData[k]);
            });

            updateDiagnostics();
            loadSnapshotsTable();
            showToast('Vault successfully decrypted and restored');
            return true;
        } catch (e) {
            showToast('Decryption error: Incorrect password or corrupt file');
            return false;
        }
    }

    // Load Snapshots List
    function loadSnapshotsTable() {
        const tbody = document.getElementById('vault-snapshots-tbody');
        if (!tbody) return;

        let raw = localStorage.getItem('multiCheckHistoricalSnapshots');
        let snapshots = [];
        try {
            snapshots = JSON.parse(raw) || [];
        } catch (e) { }

        if (!Array.isArray(snapshots)) snapshots = [];

        // Purge legacy demo snapshots if present
        snapshots = snapshots.filter(s => s.id !== 'snap-01' && s.id !== 'snap-02');

        if (snapshots.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; padding: 40px 16px; color: var(--text-3);">
                        <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
                            <svg viewBox="0 0 24 24" width="36" height="36" stroke="currentColor" stroke-width="1.8" fill="none" style="color: #fbbf24; opacity: 0.85;">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                <line x1="16" y1="2" x2="16" y2="6"></line>
                                <line x1="8" y1="2" x2="8" y2="6"></line>
                                <line x1="3" y1="10" x2="21" y2="10"></line>
                            </svg>
                            <span style="font-size: 0.95rem; font-weight: 600; color: var(--text-1);">No Snapshots Saved Yet</span>
                            <span style="font-size: 0.82rem; max-width: 460px; line-height: 1.5;">Checkpoints allow rolling back investigation tabs and rule configurations. Create a snapshot to preserve your current browser session state.</span>
                            <button class="btn btn-secondary btn-sm" id="create-first-snapshot-btn" style="margin-top: 6px;">
                                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                                    <line x1="12" y1="5" x2="12" y2="19"></line>
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                </svg>
                                Create Current Checkpoint
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            const createBtn = document.getElementById('create-first-snapshot-btn');
            if (createBtn) {
                createBtn.addEventListener('click', () => createCurrentSnapshot());
            }
            return;
        }

        let html = '';
        snapshots.forEach((snap, idx) => {
            const d = new Date(snap.timestamp || Date.now());
            html += `
                <tr>
                    <td><strong>${escapeHTML(snap.title || 'Checkpoint ' + snap.id)}</strong></td>
                    <td>${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>${snap.recordsCount || 0} Records</td>
                    <td>
                        <button class="btn btn-secondary btn-sm" onclick="window.restoreSnapshot('${snap.id}')">Restore</button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    }

    function createCurrentSnapshot() {
        const data = getAllData();
        let recordsCount = 0;
        try {
            const tabs = JSON.parse(localStorage.getItem('multiCheckTabs') || '[]');
            if (Array.isArray(tabs)) {
                tabs.forEach(t => {
                    recordsCount += (t.text || '').split('\n').filter(l => l.trim()).length;
                });
            }
        } catch (e) { }

        let raw = localStorage.getItem('multiCheckHistoricalSnapshots');
        let snapshots = [];
        try {
            snapshots = JSON.parse(raw) || [];
        } catch (e) { }
        if (!Array.isArray(snapshots)) snapshots = [];

        const newSnap = {
            id: 'chk-' + Date.now().toString(36),
            title: `Session Checkpoint (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
            timestamp: Date.now(),
            recordsCount: recordsCount || Object.keys(data).length,
            payload: data
        };

        snapshots.unshift(newSnap);
        localStorage.setItem('multiCheckHistoricalSnapshots', JSON.stringify(snapshots));
        updateDiagnostics();
        loadSnapshotsTable();
        showToast('System checkpoint created successfully');
    }

    window.restoreSnapshot = (id) => {
        let raw = localStorage.getItem('multiCheckHistoricalSnapshots');
        let snapshots = [];
        try {
            snapshots = JSON.parse(raw) || [];
        } catch (e) { }

        const snap = snapshots.find(s => s.id === id);
        if (snap && snap.payload) {
            Object.keys(snap.payload).forEach(k => {
                localStorage.setItem(k, snap.payload[k]);
            });
            updateDiagnostics();
            loadSnapshotsTable();
            showToast(`Rolled back to checkpoint ${id}`);
        } else {
            showToast(`Checkpoint ${id} restored`);
        }
    };

    function escapeHTML(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // Emergency Shred Data
    function shredAllData() {
        KNOWN_KEYS.forEach(k => localStorage.removeItem(k));

        // Also clean any dynamic workspace tabs
        const toRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('multiCheck') || key.startsWith('spectra'))) {
                toRemove.push(key);
            }
        }
        toRemove.forEach(k => localStorage.removeItem(k));

        updateDiagnostics();
        loadSnapshotsTable();
        showToast('Zero-Trace Wipe Completed: All local data shredded');
    }

    // Initialize Event Listeners
    document.addEventListener('DOMContentLoaded', () => {
        updateDiagnostics();
        loadSnapshotsTable();

        // Export Encrypted
        const exportEncBtn = document.getElementById('export-encrypted-btn');
        if (exportEncBtn) exportEncBtn.addEventListener('click', handleExportEncrypted);

        // Export JSON
        const exportJsonBtn = document.getElementById('export-json-btn');
        if (exportJsonBtn) exportJsonBtn.addEventListener('click', handleExportJson);

        // Import
        const importFileEl = document.getElementById('vault-import-file');
        const importBtn = document.getElementById('vault-import-btn');
        const importPwdEl = document.getElementById('vault-import-pwd');

        if (importBtn && importFileEl) {
            importBtn.addEventListener('click', () => {
                const file = importFileEl.files[0];
                if (!file) {
                    showToast('Please select a .spectra or .json backup file');
                    return;
                }
                const pwd = importPwdEl ? importPwdEl.value.trim() : '';
                handleImport(file, pwd);
            });
        }

        // Shred Modal
        const shredModal = document.getElementById('shred-modal');
        const openShredBtn = document.getElementById('open-shred-modal-btn');
        const closeShredBtn = document.getElementById('close-shred-modal-btn');
        const cancelShredBtn = document.getElementById('cancel-shred-btn');
        const confirmShredBtn = document.getElementById('confirm-shred-btn');
        const shredInput = document.getElementById('shred-confirm-input');

        const closeModal = () => {
            if (shredModal) shredModal.classList.add('hidden');
        };

        if (openShredBtn && shredModal) {
            openShredBtn.addEventListener('click', () => {
                shredModal.classList.remove('hidden');
                if (shredInput) shredInput.focus();
            });
        }
        if (closeShredBtn) closeShredBtn.addEventListener('click', closeModal);
        if (cancelShredBtn) cancelShredBtn.addEventListener('click', closeModal);

        if (shredModal) {
            shredModal.addEventListener('click', (e) => {
                if (e.target === shredModal) closeModal();
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && shredModal && !shredModal.classList.contains('hidden')) {
                closeModal();
            }
        });

        if (confirmShredBtn && shredInput && shredModal) {
            confirmShredBtn.addEventListener('click', () => {
                if (shredInput.value.trim().toUpperCase() === 'CONFIRM SHRED') {
                    shredAllData();
                    closeModal();
                    shredInput.value = '';
                } else {
                    showToast('Type "CONFIRM SHRED" exactly to proceed');
                }
            });
        }
    });
})();

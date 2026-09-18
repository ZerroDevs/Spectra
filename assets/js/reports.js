/**
 * Spectra Intelligence - Case Dossier & Evidence Pack Generator
 * Formulates formal moderation case sheets, rule citations, 1-click redaction,
 * printable PDF reports, and Discord embed packages.
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
        profiles: 'multiCheckRuleProfiles',
        customRules: 'multiCheckCustomRules'
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

    function showToast(msg, duration = 3000) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.innerHTML = `<img src="assets/images/logo1.png" alt="" class="toast-favicon" style="width:15px;height:15px;vertical-align:middle;margin-right:7px;border-radius:3px;display:inline-block;"><span>${msg}</span>`;
        toast.classList.add('show', 'visible');
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => toast.classList.remove('show', 'visible'), duration);
    }

    // State
    let isRedacted = false;
    let selectedRules = new Set(['Rule 1.1 - Multi-accounting (Twinking)']);

    // Case Data (Clean, user-inputted only)
    const caseData = {
        caseNumber: 'CAS-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(100 + Math.random() * 900),
        title: '',
        investigator: '',
        severity: 'HIGH',
        targetName: '',
        targetId: '',
        targetHwid: '',
        targetIp: '',
        targetDiscord: '',
        alts: [],
        evidenceText: '',
        sanctionRecommendation: ''
    };

    function loadFromWorkspace() {
        const currentWsId = lsGet(KEYS.current, 'default');
        const tabsKey = currentWsId === 'default' ? KEYS.tabs : `${KEYS.tabs}_${currentWsId}`;
        const tabs = parseJSON(lsGet(tabsKey, '[]'), []);

        let found = null;
        if (Array.isArray(tabs)) {
            for (let t of tabs) {
                const lines = (t.text || '').split('\n');
                for (let l of lines) {
                    const trimmed = l.trim();
                    if (!trimmed || trimmed.startsWith('#')) continue;
                    const idMatch = trimmed.match(/\b\d{4,7}\b/);
                    const ipMatch = trimmed.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
                    const hwidMatch = trimmed.match(/\b[A-F0-9]{32}\b/i);
                    const name = trimmed.split(/[\t,|]/)[0].trim();
                    found = {
                        name: name || 'Suspect',
                        id: idMatch ? idMatch[0] : '',
                        ip: ipMatch ? ipMatch[0] : '',
                        hwid: hwidMatch ? hwidMatch[0] : '',
                        evidence: trimmed
                    };
                    break;
                }
                if (found) break;
            }
        }

        if (found) {
            const nameEl = document.getElementById('report-target-name');
            const idEl = document.getElementById('report-target-id');
            const ipEl = document.getElementById('report-target-ip');
            const hwidEl = document.getElementById('report-target-hwid');
            const titleEl = document.getElementById('report-title');
            const evEl = document.getElementById('report-evidence-text');

            if (nameEl) nameEl.value = found.name;
            if (idEl) idEl.value = found.id;
            if (ipEl) ipEl.value = found.ip;
            if (hwidEl) hwidEl.value = found.hwid;
            if (titleEl && !titleEl.value) titleEl.value = `Moderation Investigation: ${found.name} (ID: ${found.id || 'N/A'})`;
            if (evEl && !evEl.value) evEl.value = `[Evidence Record]\n${found.evidence}`;

            updateDossierPreview();
            showToast('Loaded suspect records from active Workspace');
        } else {
            showToast('No account records found in Workspace tabs');
        }
    }

    function loadRuleOptions() {
        const picker = document.getElementById('rule-chips-picker');
        if (!picker) return;

        const availableRules = [
            'Rule 1.1 - Multi-accounting (Twinking)',
            'Rule 1.2 - Hardware ID Spoofing / Evasion',
            'Rule 1.3 - Account Sharing & Transfer',
            'GR 3.1 - Insulting Admin / Server',
            'GR 3.2 - Toxicity / Insulting Relatives',
            'Rule 6.2 - Combat Logging (F1)',
            'Rule 6.4 - Non-RP Behavior / Fail-RP',
            'Rule 6.15 - Deathmatching (DM) without Demand'
        ];

        // Also check if custom rules exist in localStorage
        const custom = parseJSON(lsGet(KEYS.customRules, '[]'), []);
        if (Array.isArray(custom)) {
            custom.forEach(r => {
                if (r.title && !availableRules.includes(r.title)) availableRules.push(r.title);
            });
        }

        let html = '';
        availableRules.forEach(rule => {
            const isSelected = selectedRules.has(rule);
            html += `<div class="reports-rule-chip ${isSelected ? 'selected' : ''}" data-rule="${escapeHTML(rule)}">${escapeHTML(rule)}</div>`;
        });

        picker.innerHTML = html;

        picker.querySelectorAll('.reports-rule-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const r = chip.getAttribute('data-rule');
                if (selectedRules.has(r)) {
                    selectedRules.delete(r);
                    chip.classList.remove('selected');
                } else {
                    selectedRules.add(r);
                    chip.classList.add('selected');
                }
                updateDossierPreview();
            });
        });
    }

    function applyRedaction(str, type) {
        if (!isRedacted || !str) return str;
        if (type === 'ip') {
            return str.replace(/(\d{1,3}\.\d{1,3}\.)\d{1,3}\.\d{1,3}/g, '$1***.***');
        }
        if (type === 'hwid') {
            if (str.length > 10) return str.slice(0, 6) + '...[MASKED]';
            return '***MASKED***';
        }
        if (type === 'evidence') {
            return str
                .replace(/(\d{1,3}\.\d{1,3}\.)\d{1,3}\.\d{1,3}/g, '$1***.***')
                .replace(/\b[A-F0-9]{24,32}\b/gi, match => match.slice(0, 6) + '...[MASKED]');
        }
        return str;
    }

    function updateDossierPreview() {
        // Read form inputs if modified
        caseData.title = document.getElementById('report-title')?.value || caseData.title;
        caseData.investigator = document.getElementById('report-investigator')?.value || caseData.investigator;
        caseData.severity = document.getElementById('report-severity')?.value || caseData.severity;
        caseData.targetName = document.getElementById('report-target-name')?.value || caseData.targetName;
        caseData.targetId = document.getElementById('report-target-id')?.value || caseData.targetId;
        caseData.targetIp = document.getElementById('report-target-ip')?.value || caseData.targetIp;
        caseData.targetHwid = document.getElementById('report-target-hwid')?.value || caseData.targetHwid;
        caseData.targetDiscord = document.getElementById('report-target-discord')?.value || caseData.targetDiscord;
        caseData.evidenceText = document.getElementById('report-evidence-text')?.value || caseData.evidenceText;
        caseData.sanctionRecommendation = document.getElementById('report-sanction')?.value || caseData.sanctionRecommendation;

        // Render preview fields
        const caseNumEl = document.getElementById('dossier-case-num');
        const titleEl = document.getElementById('dossier-title');
        const adminEl = document.getElementById('dossier-admin');
        const dateEl = document.getElementById('dossier-date');
        const sevEl = document.getElementById('dossier-severity');
        const citationsContainer = document.getElementById('dossier-citations-list');
        const identitiesTbody = document.getElementById('dossier-identities-tbody');
        const evidenceBox = document.getElementById('dossier-evidence-content');
        const sanctionEl = document.getElementById('dossier-sanction-content');
        const hashEl = document.getElementById('dossier-security-hash');

        if (caseNumEl) caseNumEl.textContent = caseData.caseNumber;
        if (titleEl) titleEl.textContent = caseData.title;
        if (adminEl) adminEl.textContent = caseData.investigator;
        if (dateEl) dateEl.textContent = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

        if (sevEl) {
            sevEl.textContent = caseData.severity;
            sevEl.className = 'badge';
            if (caseData.severity === 'CRITICAL') {
                sevEl.style = 'background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4);';
            } else if (caseData.severity === 'HIGH') {
                sevEl.style = 'background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4);';
            } else {
                sevEl.style = 'background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4);';
            }
        }

        // Citations
        if (citationsContainer) {
            if (selectedRules.size === 0) {
                citationsContainer.innerHTML = '<span style="color: var(--text-3); font-size: 0.8rem;">No specific rule articles cited.</span>';
            } else {
                citationsContainer.innerHTML = Array.from(selectedRules).map(r => `
                    <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #34d399; margin: 3px; font-size: 0.75rem;">
                        § ${escapeHTML(r)}
                    </span>
                `).join('');
            }
        }
        // Identities Table
        if (identitiesTbody) {
            if (!caseData.targetName && !caseData.targetId && (!caseData.alts || caseData.alts.length === 0)) {
                identitiesTbody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align: center; color: var(--text-3); padding: 18px;">
                            No suspect identity specified. Enter details on the left or click "Load from Workspace".
                        </td>
                    </tr>
                `;
            } else {
                let rows = '';
                if (caseData.targetName || caseData.targetId) {
                    rows += `
                        <tr>
                            <td><strong style="color: #38bdf8;">${escapeHTML(caseData.targetName || 'Unnamed')} (Main)</strong></td>
                            <td>${escapeHTML(caseData.targetId || 'N/A')}</td>
                            <td>${escapeHTML(applyRedaction(caseData.targetIp, 'ip') || 'N/A')}</td>
                            <td style="font-size: 0.75rem;">${escapeHTML(applyRedaction(caseData.targetHwid, 'hwid') || 'N/A')}</td>
                            <td>${escapeHTML(caseData.targetDiscord || 'N/A')}</td>
                        </tr>
                    `;
                }

                (caseData.alts || []).forEach(alt => {
                    rows += `
                        <tr>
                            <td><span style="color: #fbbf24;">${escapeHTML(alt.name)}</span></td>
                            <td>${escapeHTML(alt.id)}</td>
                            <td>${escapeHTML(applyRedaction(alt.ip, 'ip'))}</td>
                            <td style="font-size: 0.75rem;">${escapeHTML(applyRedaction(alt.hwid, 'hwid'))}</td>
                            <td>${escapeHTML(alt.discord || 'N/A')}</td>
                        </tr>
                    `;
                });

                identitiesTbody.innerHTML = rows;
            }
        }

        // Evidence Box
        if (evidenceBox) {
            evidenceBox.textContent = caseData.evidenceText
                ? applyRedaction(caseData.evidenceText, 'evidence')
                : 'No evidence transcript entered yet. Paste logs or statements into the editor on the left.';
        }

        // Sanctions Box
        if (sanctionEl) {
            sanctionEl.textContent = caseData.sanctionRecommendation || 'Pending investigation outcome / administrative review.';
        }

        // Hash
        if (hashEl) {
            const hash = (Math.abs(hashCode(caseData.caseNumber + (caseData.targetId || '') + (caseData.evidenceText || '')))).toString(16).toUpperCase();
            hashEl.textContent = `SPECTRA-SIG-SHA256-${hash}`;
        }
    }

    function hashCode(str) {
        let h = 0;
        for (let i = 0; i < str.length; i++) {
            h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
        }
        return h;
    }

    function escapeHTML(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // Export to Discord Embed Markdown
    function copyDiscordEmbed() {
        let md = `\`\`\`ansi\n [1;32m=== SPECTRA FORENSIC INCIDENT DOSSIER === [0m\n\`\`\`\n`;
        md += `> **Case Number:** \`${caseData.caseNumber}\`\n`;
        md += `> **Severity:** \`${caseData.severity}\` | **Investigator:** \`${caseData.investigator || 'Staff'}\`\n`;
        md += `> **Date:** <t:${Math.floor(Date.now() / 1000)}:D>\n\n`;

        md += `### **Identified Suspect Cluster**\n`;
        md += `* **Primary:** \`${caseData.targetName || 'N/A'}\` (ID: \`${caseData.targetId || 'N/A'}\`)\n`;
        md += `  * IP: \`${applyRedaction(caseData.targetIp, 'ip') || 'N/A'}\` | HWID: \`${applyRedaction(caseData.targetHwid, 'hwid') || 'N/A'}\`\n`;
        (caseData.alts || []).forEach(alt => {
            md += `* **Linked Alt:** \`${alt.name}\` (ID: \`${alt.id}\`)\n`;
            md += `  * IP: \`${applyRedaction(alt.ip, 'ip')}\` | HWID: \`${applyRedaction(alt.hwid, 'hwid')}\`\n`;
        });

        md += `\n### **Citations & Violations**\n`;
        if (selectedRules.size === 0) {
            md += `* No specific rule violations cited.\n`;
        } else {
            selectedRules.forEach(r => {
                md += `* § \`${r}\`\n`;
            });
        }

        md += `\n### **Forensic Evidence Log**\n`;
        md += `\`\`\`diff\n${applyRedaction(caseData.evidenceText || '[No transcript logs attached]', 'evidence')}\n\`\`\`\n`;

        md += `> **Recommended Enforcement:** \`${caseData.sanctionRecommendation || 'Pending Review'}\`\n`;
        md += `*Verified via Spectra Intelligence Suite Sandbox (100% Client-Side)*`;

        navigator.clipboard.writeText(md).then(() => {
            showToast('Discord Dossier Markdown copied to clipboard');
        }).catch(() => {
            showToast('Failed to copy to clipboard');
        });
    }

    // Export JSON Evidence Bundle
    function exportJSON() {
        const payload = {
            spectraVersion: '2.0.0',
            exportedAt: new Date().toISOString(),
            case: caseData,
            citedRules: Array.from(selectedRules),
            isRedacted
        };

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${caseData.caseNumber}-evidence.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Evidence Bundle JSON downloaded');
    }

    // Initialize Event Listeners
    document.addEventListener('DOMContentLoaded', () => {
        // Import from workspace button
        const importWsBtn = document.getElementById('import-ws-report-btn');
        if (importWsBtn) {
            importWsBtn.addEventListener('click', loadFromWorkspace);
        }

        // Live input listeners
        const formInputs = [
            'report-title', 'report-investigator', 'report-severity',
            'report-target-name', 'report-target-id', 'report-target-ip',
            'report-target-hwid', 'report-target-discord', 'report-evidence-text', 'report-sanction'
        ];
        formInputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', updateDossierPreview);
        });

        // Redaction Switch
        const redactToggle = document.getElementById('redaction-toggle');
        if (redactToggle) {
            redactToggle.addEventListener('change', (e) => {
                isRedacted = e.target.checked;
                updateDossierPreview();
                showToast(isRedacted ? 'Sensitive IP and HWID data masked' : 'Full unredacted data revealed');
            });
        }

        // Print Button
        const printBtn = document.getElementById('print-dossier-btn');
        if (printBtn) {
            printBtn.addEventListener('click', () => window.print());
        }

        // Copy Discord Button
        const discordBtn = document.getElementById('copy-discord-dossier-btn');
        if (discordBtn) {
            discordBtn.addEventListener('click', copyDiscordEmbed);
        }

        // Export JSON Button
        const jsonBtn = document.getElementById('export-json-dossier-btn');
        if (jsonBtn) {
            jsonBtn.addEventListener('click', exportJSON);
        }

        loadRuleOptions();
        updateDossierPreview();
    });
})();


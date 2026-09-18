/**
 * Spectra Intelligence - Server Rulebook & Ban Matrix Customizer
 * Manage rule sets, command templates, penalty durations, and sync with workspace.html.
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
        profiles: 'multiCheckRuleProfiles',
        activeProfile: 'multiCheckActiveRuleProfile',
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
        toast.innerHTML = msg;
        toast.classList.add('show', 'visible');
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => toast.classList.remove('show', 'visible'), duration);
    }

    // Default Seed Profiles
    const DEFAULT_PROFILES = [
        {
            id: 'profile-rpserver',
            name: 'RP Server Standard Rulebook',
            commandTemplate: '/ban {id} {duration} {reason}',
            durationUnit: 'Days',
            rules: [
                { id: 'r1', code: '3.1', name: 'Mentioning Parents / Insulting Relatives', category: 'Chat', duration: '3', unit: 'Days', severity: 'High', reason: 'GR 3.1 Insulting Parents' },
                { id: 'r2', code: '3.2', name: 'OOC Toxic / OOC Disrespect', category: 'Chat', duration: '180', unit: 'Minutes', severity: 'Medium', reason: 'GR 3.2 OOC Toxicity' },
                { id: 'r3', code: '6.2', name: 'Leaving RP Situation / Combat Logging', category: 'Roleplay', duration: 'Warn', unit: 'Days', severity: 'Medium', reason: 'GR 6.2 Combat Log' },
                { id: 'r4', code: '6.8', name: 'Sexual Harassment / Inappropriate RP', category: 'Roleplay', duration: '7', unit: 'Days', severity: 'Critical', reason: 'GR 6.8 Unacceptable Behavior' },
                { id: 'r5', code: 'failrp', name: 'Unrealistic Actions / Non-Roleplay', category: 'Roleplay', duration: '120', unit: 'Minutes', severity: 'Low', reason: 'Fail-RP Demorgan' },
                { id: 'r6', code: 'dm', name: 'Deathmatching without Demand/Reason', category: 'Combat', duration: '120', unit: 'Minutes', severity: 'Medium', reason: 'DM Demorgan' },
                { id: 'r7', code: 'provoking', name: 'Intentionally Provoking / Trolling players', category: 'General', duration: '60', unit: 'Minutes', severity: 'Low', reason: 'Provoking in Greenzone' }
            ]
        },
        {
            id: 'profile-fivem',
            name: 'FiveM / NoPixel Standard',
            commandTemplate: '/ban {id} {duration} {reason}',
            durationUnit: 'Days',
            rules: [
                { id: 'r8', code: 'RDM', name: 'Random Deathmatch', category: 'Combat', duration: '3', unit: 'Days', severity: 'High', reason: 'RDM - Attacking without initiation' },
                { id: 'r9', code: 'VDM', name: 'Vehicle Deathmatch', category: 'Combat', duration: '1', unit: 'Days', severity: 'Medium', reason: 'VDM - Using vehicle as weapon' },
                { id: 'r10', code: 'CombatLog', name: 'Disconnecting while in combat/police custody', category: 'Roleplay', duration: '7', unit: 'Days', severity: 'High', reason: 'Combat Logging' },
                { id: 'r11', code: 'Powergaming', name: 'Forcing RP outcomes or supernatural feats', category: 'Roleplay', duration: '1', unit: 'Days', severity: 'Medium', reason: 'Powergaming violation' },
                { id: 'r12', code: 'Metagaming', name: 'Using external stream/Discord info in-character', category: 'Roleplay', duration: '14', unit: 'Days', severity: 'Critical', reason: 'Metagaming stream snipe' }
            ]
        }
    ];

    // Profile Management
    function getProfiles() {
        const raw = lsGet(KEYS.profiles, null);
        if (!raw) {
            lsSet(KEYS.profiles, DEFAULT_PROFILES);
            return DEFAULT_PROFILES;
        }
        let parsed = parseJSON(raw, DEFAULT_PROFILES);
        if (Array.isArray(parsed)) {
            let changed = false;
            parsed.forEach(p => {
                if (p.id === 'profile-grandrp') {
                    p.id = 'profile-rpserver';
                    changed = true;
                }
                if (p.name && /grand\s*5?rp|rpgrand/i.test(p.name)) {
                    p.name = p.name.replace(/grand\s*5?rp|rpgrand/gi, 'RP Server');
                    changed = true;
                }
            });
            if (changed) {
                lsSet(KEYS.profiles, parsed);
            }
        }
        return parsed;
    }

    function saveProfiles(profiles) {
        lsSet(KEYS.profiles, profiles);
        syncActiveProfileWithPlatform();
    }

    function getActiveProfile() {
        const profiles = getProfiles();
        let activeId = lsGet(KEYS.activeProfile, profiles[0]?.id || 'profile-rpserver');
        if (activeId === 'profile-grandrp') {
            activeId = 'profile-rpserver';
            lsSet(KEYS.activeProfile, activeId);
        }
        return profiles.find(p => p.id === activeId) || profiles[0] || DEFAULT_PROFILES[0];
    }

    function setActiveProfile(id) {
        lsSet(KEYS.activeProfile, id);
        syncActiveProfileWithPlatform();
        renderAll();
    }

    // Sync active rules so workspace.html and audit.html automatically reflect them
    function syncActiveProfileWithPlatform() {
        const active = getActiveProfile();
        if (active) {
            lsSet(KEYS.customRules, active.rules);
        }
    }

    // Modal State
    let editingRuleId = null;

    function openRuleModal(rule = null) {
        const modal = document.getElementById('rule-modal');
        const titleEl = document.getElementById('modal-title');
        const codeInput = document.getElementById('rule-code-input');
        const nameInput = document.getElementById('rule-name-input');
        const catSelect = document.getElementById('rule-category-select');
        const durInput = document.getElementById('rule-duration-input');
        const unitSelect = document.getElementById('rule-unit-select');
        const sevSelect = document.getElementById('rule-severity-select');
        const reasonInput = document.getElementById('rule-reason-input');

        editingRuleId = rule ? rule.id : null;

        if (titleEl) titleEl.textContent = rule ? 'Edit Server Rule' : 'Add New Server Rule';
        if (codeInput) codeInput.value = rule ? rule.code : '';
        if (nameInput) nameInput.value = rule ? rule.name : '';
        if (catSelect) catSelect.value = rule ? rule.category : 'General';
        if (durInput) durInput.value = rule ? rule.duration : '3';
        if (unitSelect) unitSelect.value = rule ? rule.unit : 'Days';
        if (sevSelect) sevSelect.value = rule ? rule.severity : 'Medium';
        if (reasonInput) reasonInput.value = rule ? rule.reason : '';

        if (modal) modal.style.display = 'flex';
    }

    function closeRuleModal() {
        const modal = document.getElementById('rule-modal');
        if (modal) modal.style.display = 'none';
        editingRuleId = null;
    }

    function saveRuleFromModal() {
        const code = (document.getElementById('rule-code-input')?.value || '').trim();
        const name = (document.getElementById('rule-name-input')?.value || '').trim();
        const category = document.getElementById('rule-category-select')?.value || 'General';
        const duration = (document.getElementById('rule-duration-input')?.value || '').trim() || '1';
        const unit = document.getElementById('rule-unit-select')?.value || 'Days';
        const severity = document.getElementById('rule-severity-select')?.value || 'Medium';
        const reason = (document.getElementById('rule-reason-input')?.value || '').trim() || `${code} Violation`;

        if (!code || !name) {
            showToast('⚠️ Rule Code and Rule Title are required.');
            return;
        }

        const profiles = getProfiles();
        const active = getActiveProfile();
        const profile = profiles.find(p => p.id === active.id);
        if (!profile) return;

        if (editingRuleId) {
            const rule = profile.rules.find(r => r.id === editingRuleId);
            if (rule) {
                rule.code = code;
                rule.name = name;
                rule.category = category;
                rule.duration = duration;
                rule.unit = unit;
                rule.severity = severity;
                rule.reason = reason;
                showToast(`Updated rule "${code}".`);
            }
        } else {
            profile.rules.push({
                id: 'r-' + Date.now(),
                code,
                name,
                category,
                duration,
                unit,
                severity,
                reason
            });
            showToast(`Added rule "${code}" to rulebook!`);
        }

        saveProfiles(profiles);
        closeRuleModal();
        renderAll();
    }

    function deleteRule(ruleId) {
        const profiles = getProfiles();
        const active = getActiveProfile();
        const profile = profiles.find(p => p.id === active.id);
        if (!profile) return;

        profile.rules = profile.rules.filter(r => r.id !== ruleId);
        saveProfiles(profiles);
        showToast('Rule removed from rulebook.');
        renderAll();
    }

    // Render Preview
    function updateCommandPreview() {
        const active = getActiveProfile();
        const template = (document.getElementById('cmd-template-input')?.value || active.commandTemplate || '/ban {id} {duration} {reason}').trim();
        const previewEl = document.getElementById('cmd-preview-output');

        if (!previewEl) return;

        const sampleRule = active.rules[0] || { code: 'GR 3.1', duration: '3', reason: 'GR 3.1 Insulting Parents' };
        const dummyId = '1042';
        const dummyDur = sampleRule.duration;
        const dummyReason = sampleRule.reason;

        const formatted = template
            .replace(/\{id\}/gi, dummyId)
            .replace(/\{duration\}/gi, dummyDur)
            .replace(/\{reason\}/gi, dummyReason)
            .replace(/\{code\}/gi, sampleRule.code);

        previewEl.textContent = formatted;
    }

    // Render Table
    function renderTable() {
        const active = getActiveProfile();
        const tbody = document.getElementById('rules-table-body');
        const countBadge = document.getElementById('rules-count-badge');
        const searchVal = (document.getElementById('rules-search-input')?.value || '').trim().toLowerCase();
        const catFilter = document.getElementById('rules-category-filter')?.value || 'all';

        if (!tbody) return;

        let filtered = active.rules.filter(r => {
            if (catFilter !== 'all' && r.category !== catFilter) return false;
            if (searchVal) {
                const match = r.code.toLowerCase().includes(searchVal) || r.name.toLowerCase().includes(searchVal) || r.reason.toLowerCase().includes(searchVal);
                if (!match) return false;
            }
            return true;
        });

        if (countBadge) countBadge.textContent = `${filtered.length} rules`;

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; color: var(--text-3); padding: 30px;">
                        No rules found matching your query. Click "+ Add Rule" to create one.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filtered.map(r => `
            <tr>
                <td>
                    <span class="rule-code-badge">${r.code}</span>
                </td>
                <td>
                    <strong>${r.name}</strong>
                    <div style="font-size: 0.74rem; color: var(--text-3); margin-top: 2px;">Reason: <code>${r.reason}</code></div>
                </td>
                <td>
                    <span class="badge" style="font-size: 0.72rem;">${r.category}</span>
                </td>
                <td>
                    <strong style="font-family: 'JetBrains Mono', monospace;">${r.duration}</strong>
                    <span style="font-size: 0.74rem; color: var(--text-3);">${r.unit}</span>
                </td>
                <td>
                    <span class="severity-pill severity-${(r.severity || 'medium').toLowerCase()}">${r.severity}</span>
                </td>
                <td style="text-align: right;">
                    <div style="display: flex; gap: 6px; justify-content: flex-end;">
                        <button type="button" class="btn btn-secondary" data-copy-rule="${r.id}" title="Copy Command Preview" style="padding: 4px 8px; font-size: 0.74rem;">
                            Copy
                        </button>
                        <button type="button" class="btn btn-secondary" data-edit-rule="${r.id}" title="Edit Rule" style="padding: 4px 8px; font-size: 0.74rem;">
                            Edit
                        </button>
                        <button type="button" class="btn btn-secondary" data-del-rule="${r.id}" title="Delete Rule" style="padding: 4px 8px; font-size: 0.74rem; color: #f87171;">
                            ✕
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        // Bind buttons
        tbody.querySelectorAll('[data-copy-rule]').forEach(btn => {
            btn.addEventListener('click', () => {
                const rule = active.rules.find(r => r.id === btn.dataset.copyRule);
                if (rule) {
                    const template = active.commandTemplate || '/ban {id} {duration} {reason}';
                    const cmd = template
                        .replace(/\{id\}/gi, 'ID')
                        .replace(/\{duration\}/gi, rule.duration)
                        .replace(/\{reason\}/gi, rule.reason)
                        .replace(/\{code\}/gi, rule.code);
                    navigator.clipboard.writeText(cmd).then(() => {
                        showToast(`📋 Copied rule syntax: <code>${cmd}</code>`);
                    });
                }
            });
        });

        tbody.querySelectorAll('[data-edit-rule]').forEach(btn => {
            btn.addEventListener('click', () => {
                const rule = active.rules.find(r => r.id === btn.dataset.editRule);
                if (rule) openRuleModal(rule);
            });
        });

        tbody.querySelectorAll('[data-del-rule]').forEach(btn => {
            btn.addEventListener('click', () => {
                deleteRule(btn.dataset.delRule);
            });
        });
    }

    function renderProfilesDropdown() {
        const select = document.getElementById('profile-select');
        if (!select) return;

        const profiles = getProfiles();
        const active = getActiveProfile();

        select.innerHTML = profiles.map(p => `
            <option value="${p.id}" ${p.id === active.id ? 'selected' : ''}>${p.name}</option>
        `).join('');
    }

    function renderAll() {
        renderProfilesDropdown();
        updateCommandPreview();
        renderTable();
    }

    // Bind event handlers
    function init() {
        syncActiveProfileWithPlatform();
        renderAll();

        // Profile switcher
        const profileSelect = document.getElementById('profile-select');
        if (profileSelect) {
            profileSelect.addEventListener('change', () => {
                setActiveProfile(profileSelect.value);
            });
        }

        // New profile button
        const newProfileBtn = document.getElementById('new-profile-btn');
        if (newProfileBtn) {
            newProfileBtn.addEventListener('click', () => {
                const name = prompt('Enter name for the new rule profile:', 'Custom Server Rulebook');
                if (!name || !name.trim()) return;

                const profiles = getProfiles();
                const newProfile = {
                    id: 'profile-' + Date.now(),
                    name: name.trim(),
                    commandTemplate: '/ban {id} {duration} {reason}',
                    durationUnit: 'Days',
                    rules: []
                };
                profiles.push(newProfile);
                saveProfiles(profiles);
                setActiveProfile(newProfile.id);
                showToast(`Created new profile "${name.trim()}".`);
            });
        }

        // Duplicate profile button
        const dupProfileBtn = document.getElementById('duplicate-profile-btn');
        if (dupProfileBtn) {
            dupProfileBtn.addEventListener('click', () => {
                const active = getActiveProfile();
                const profiles = getProfiles();
                const copy = JSON.parse(JSON.stringify(active));
                copy.id = 'profile-' + Date.now();
                copy.name = `${active.name} (Copy)`;
                profiles.push(copy);
                saveProfiles(profiles);
                setActiveProfile(copy.id);
                showToast(`Duplicated profile as "${copy.name}".`);
            });
        }

        // Template Input
        const templateInput = document.getElementById('cmd-template-input');
        if (templateInput) {
            templateInput.value = getActiveProfile().commandTemplate || '/ban {id} {duration} {reason}';
            templateInput.addEventListener('input', () => {
                const active = getActiveProfile();
                const profiles = getProfiles();
                const profile = profiles.find(p => p.id === active.id);
                if (profile) {
                    profile.commandTemplate = templateInput.value;
                    saveProfiles(profiles);
                }
                updateCommandPreview();
            });
        }

        // Search & Category Filters
        const searchInput = document.getElementById('rules-search-input');
        if (searchInput) searchInput.addEventListener('input', renderTable);

        const catFilter = document.getElementById('rules-category-filter');
        if (catFilter) catFilter.addEventListener('change', renderTable);

        // Modal triggers
        const addRuleBtn = document.getElementById('add-rule-btn');
        if (addRuleBtn) addRuleBtn.addEventListener('click', () => openRuleModal());

        const closeModalBtn = document.getElementById('close-rule-modal');
        if (closeModalBtn) closeModalBtn.addEventListener('click', closeRuleModal);

        const cancelModalBtn = document.getElementById('cancel-rule-btn');
        if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeRuleModal);

        const saveModalBtn = document.getElementById('save-rule-btn');
        if (saveModalBtn) saveModalBtn.addEventListener('click', saveRuleFromModal);

        // Export JSON
        const exportBtn = document.getElementById('export-rules-json-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                const active = getActiveProfile();
                const blob = new Blob([JSON.stringify(active, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `spectra-rules-${active.name.toLowerCase().replace(/\s+/g, '-')}.json`;
                a.click();
                URL.revokeObjectURL(url);
                showToast('Exported rule profile JSON.');
            });
        }

        // Theme Toggle
        const themeBtn = document.getElementById('theme-toggle-btn');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => {
                const cur = document.documentElement.getAttribute('data-theme') || 'dark';
                const next = cur === 'dark' ? 'light' : 'dark';
                document.documentElement.setAttribute('data-theme', next);
                localStorage.setItem('multiCheckTheme', next);
                localStorage.setItem('spectraTheme', next);
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

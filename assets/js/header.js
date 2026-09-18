/**
 * Spectra Intelligence - Centralized Header & Tools Drawer Controller
 * Manages the compact topbar navigation, automatic button pruning for screen width,
 * and maintains the comprehensive slide-out Tools Drawer on PC and mobile.
 */
(() => {
    'use strict';

    // Auto-inject header.css if not present
    if (!document.querySelector('link[href*="header.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'assets/css/header.css';
        document.head.appendChild(link);
    }

    // Comprehensive Platform Registry (All 14 Modules)
    const PLATFORM_MODULES = [
        // Category 1: Core Hub & Workspace
        {
            id: 'dashboard',
            name: 'Operations Dashboard',
            href: 'index.html',
            desc: 'Primary command center, workspace health radar, and real-time operations summary.',
            category: 'Core Workbenches',
            badge: 'HUB',
            pinned: true,
            iconColor: '#38bdf8',
            svg: '<rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect>'
        },
        {
            id: 'workspace',
            name: 'Workspace Inspector',
            href: 'workspace.html#main',
            desc: 'Cleanse raw server account dumps, link primary/twink identities, and generate moderation commands.',
            category: 'Core Workbenches',
            badge: '#main',
            pinned: true,
            iconColor: '#10b981',
            svg: '<polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline>'
        },
        {
            id: 'ban_matrix',
            name: 'Ban Command Matrix',
            href: 'workspace.html#ban',
            desc: 'Fast console command generator with custom reason templates, durations, and serial copy.',
            category: 'Core Workbenches',
            badge: '#ban',
            pinned: false,
            iconColor: '#f59e0b',
            svg: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>'
        },
        {
            id: 'workspaces_manager',
            name: 'Workspaces & Tenancy',
            href: 'workspace.html#workspaces',
            desc: 'Isolated case partitions, multi-tenancy management, and local workspace archiving.',
            category: 'Core Workbenches',
            badge: '#workspaces',
            pinned: false,
            iconColor: '#34d399',
            svg: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>'
        },

        // Category 2: Forensics & Relationship Analysis
        {
            id: 'timeline',
            name: 'Incident Timeline & Stream',
            href: 'timeline.html',
            desc: 'Chronological event stream, <60s multi-account cluster synchrony tracking, and Discord timestamps.',
            category: 'Forensic Intelligence',
            badge: 'STREAM',
            pinned: false,
            iconColor: '#38bdf8',
            svg: '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>'
        },
        {
            id: 'matrix',
            name: 'Collision Matrix',
            href: 'matrix.html',
            desc: 'Pairwise HWID, IP, Subnet, and Discord overlap heatmap table with collision scoring.',
            category: 'Forensic Intelligence',
            badge: 'HEATMAP',
            pinned: false,
            iconColor: '#818cf8',
            svg: '<rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line>'
        },
        {
            id: 'graph',
            name: 'Syndicate Alt Graph',
            href: 'graph.html',
            desc: 'Force-directed visual node graph mapping alternate accounts, shared hardware, and syndicate clusters.',
            category: 'Forensic Intelligence',
            badge: 'NETWORK',
            pinned: true,
            iconColor: '#22d3ee',
            svg: '<circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>'
        },
        {
            id: 'diff',
            name: 'Forensic Diff Comparator',
            href: 'diff.html',
            desc: 'Side-by-side delta comparator to spot newly emerged twinks and identity mutations between log snapshots.',
            category: 'Forensic Intelligence',
            badge: 'DELTA',
            pinned: false,
            iconColor: '#10b981',
            svg: '<polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="21 16 21 21 16 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line><line x1="4" y1="4" x2="9" y2="9"></line>'
        },
        {
            id: 'analytics',
            name: 'Deep Analytics',
            href: 'analytics.html',
            desc: 'Historical account velocity, cross-workspace collision stats, and longitudinal activity telemetry.',
            category: 'Forensic Intelligence',
            badge: 'METRICS',
            pinned: false,
            iconColor: '#38bdf8',
            svg: '<line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line>'
        },

        // Category 3: Security & Moderation
        {
            id: 'audit',
            name: 'Security Audit & Blacklist',
            href: 'audit.html',
            desc: 'Centralized database of flagged griefers, rule violators, incident notes, and reusable blocklists.',
            category: 'Security & Moderation',
            badge: 'SECURITY',
            pinned: true,
            iconColor: '#f87171',
            svg: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>'
        },
        {
            id: 'reports',
            name: 'Case Dossiers & Evidence',
            href: 'reports.html',
            desc: 'Formal case file compiler, 1-click IP/HWID redaction mode, server rule citations, and PDF export.',
            category: 'Security & Moderation',
            badge: 'DOSSIER',
            pinned: false,
            iconColor: '#34d399',
            svg: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line>'
        },
        {
            id: 'rules',
            name: 'Server Rulebook Customizer',
            href: 'rules.html',
            desc: 'Custom server rules, penalty matrices, command templates, and synchronization with workspaces.',
            category: 'Security & Moderation',
            badge: 'RULES',
            pinned: false,
            iconColor: '#fbbf24',
            svg: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path><line x1="9" y1="7" x2="15" y2="7"></line><line x1="9" y1="11" x2="13" y2="11"></line>'
        },
        {
            id: 'live',
            name: 'Tactical Watchlist & HUD',
            href: 'live.html',
            desc: 'High-contrast 2nd-screen staffing radar, persistent target pinboard, and sub-ms Ctrl+K triage lookup.',
            category: 'Security & Moderation',
            badge: 'RADAR',
            pinned: false,
            iconColor: '#ef4444',
            svg: '<circle cx="12" cy="12" r="2"></circle><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"></path>'
        },

        // Category 4: Data & System
        {
            id: 'converter',
            name: 'Log Parser & Transpiler',
            href: 'converter.html',
            desc: 'Ingest and normalize logs from txAdmin, ESX, QBCore, vRP, Discord bots, and CSV spreadsheets.',
            category: 'Data & Utilities',
            badge: 'PARSER',
            pinned: false,
            iconColor: '#14b8a6',
            svg: '<polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line>'
        },
        {
            id: 'vault',
            name: 'Encrypted Data Vault',
            href: 'vault.html',
            desc: 'Client-side AES-GCM 256-bit encrypted backup, storage quota diagnostics, and zero-trace purge.',
            category: 'Data & Utilities',
            badge: 'VAULT',
            pinned: false,
            iconColor: '#f59e0b',
            svg: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>'
        },
        {
            id: 'about',
            name: 'System Specs & Docs',
            href: 'about.html',
            desc: 'Technical architecture, offline security specifications, and sandbox documentation.',
            category: 'Data & Utilities',
            badge: 'DOCS',
            pinned: false,
            iconColor: '#94a3b8',
            svg: '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>'
        }
    ];

    // Determine current page filename
    function getCurrentPage() {
        const path = window.location.pathname;
        const page = path.split('/').pop() || 'index.html';
        return page.toLowerCase();
    }

    // Build the Drawer HTML
    function buildDrawerElement() {
        const existing = document.getElementById('spectra-tools-drawer-overlay');
        if (existing) return existing;

        const currentPage = getCurrentPage();

        const overlay = document.createElement('div');
        overlay.id = 'spectra-tools-drawer-overlay';
        overlay.className = 'spectra-drawer-overlay';

        // Group modules by category
        const categories = {};
        PLATFORM_MODULES.forEach(m => {
            if (!categories[m.category]) categories[m.category] = [];
            categories[m.category].push(m);
        });

        let sectionsHtml = '';
        Object.keys(categories).forEach(catName => {
            const list = categories[catName];
            sectionsHtml += `
                <div class="drawer-category-block">
                    <div class="drawer-section-title">${catName}</div>
                    <div class="drawer-tools-grid">
                        ${list.map(mod => {
                            const isCurrent = currentPage === mod.href.split('#')[0].toLowerCase();
                            return `
                                <a href="${mod.href}" class="drawer-tool-card ${isCurrent ? 'active-page' : ''}" data-tool-name="${mod.name.toLowerCase()} ${mod.desc.toLowerCase()}">
                                    <div class="drawer-tool-left">
                                        <div class="drawer-tool-icon" style="background: color-mix(in srgb, ${mod.iconColor} 15%, transparent); color: ${mod.iconColor}; border: 1px solid color-mix(in srgb, ${mod.iconColor} 30%, transparent);">
                                            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
                                                ${mod.svg}
                                            </svg>
                                        </div>
                                        <div class="drawer-tool-info">
                                            <div class="drawer-tool-name">
                                                <span>${mod.name}</span>
                                                ${isCurrent ? '<span style="font-size: 0.68rem; color: #38bdf8;">(Current)</span>' : ''}
                                            </div>
                                            <div class="drawer-tool-desc">${mod.desc}</div>
                                        </div>
                                    </div>
                                    <span class="drawer-tool-badge">${mod.badge}</span>
                                </a>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        });

        overlay.innerHTML = `
            <aside class="spectra-drawer" role="dialog" aria-label="Spectra Platform Navigation Drawer">
                <div class="spectra-drawer-header">
                    <div class="spectra-drawer-title-group">
                        <div class="brand-icon" style="width: 32px; height: 32px; border-radius: 8px;">
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none">
                                <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                                <polyline points="2 17 12 22 22 17"></polyline>
                                <polyline points="2 12 12 17 22 12"></polyline>
                            </svg>
                        </div>
                        <div>
                            <div style="font-weight: 800; font-size: 1.05rem; color: var(--text-1); display: flex; align-items: center; gap: 8px;">
                                Spectra Navigation
                                <span class="spectra-drawer-badge">${PLATFORM_MODULES.length} Tools</span>
                            </div>
                            <div style="font-size: 0.76rem; color: var(--text-3);">100% Client-Side Forensic Suite</div>
                        </div>
                    </div>
                    <button class="spectra-drawer-close" id="spectra-drawer-close-btn" title="Close Drawer (Esc)"><svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.2" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
                </div>

                <div class="spectra-drawer-search-wrapper">
                    <div class="spectra-drawer-search">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" style="color: var(--text-3);">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        <input type="text" id="spectra-drawer-search-input" placeholder="Quick find forensic tools, format parsers, ban matrices...">
                    </div>
                </div>

                <div class="spectra-drawer-body" id="spectra-drawer-body">
                    ${sectionsHtml}
                </div>

                <div class="spectra-drawer-footer">
                    <div>Press <code style="background: var(--bg-deep); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border);">Esc</code> to close</div>
                    <div style="color: #38bdf8; font-weight: 600;">Spectra v2.5 Sandbox</div>
                </div>
            </aside>
        `;

        document.body.appendChild(overlay);

        // Event listeners
        const closeBtn = overlay.querySelector('#spectra-drawer-close-btn');
        if (closeBtn) closeBtn.addEventListener('click', closeDrawer);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeDrawer();
        });

        const searchInput = overlay.querySelector('#spectra-drawer-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.trim().toLowerCase();
                const cards = overlay.querySelectorAll('.drawer-tool-card');
                const blocks = overlay.querySelectorAll('.drawer-category-block');

                cards.forEach(card => {
                    const text = card.getAttribute('data-tool-name') || '';
                    if (!query || text.includes(query)) {
                        card.style.display = 'flex';
                    } else {
                        card.style.display = 'none';
                    }
                });

                blocks.forEach(block => {
                    const visibleCards = block.querySelectorAll('.drawer-tool-card[style*="display: flex"], .drawer-tool-card:not([style*="display: none"])');
                    const hasVisible = Array.from(visibleCards).some(c => c.style.display !== 'none');
                    block.style.display = hasVisible ? 'block' : 'none';
                });
            });
        }

        return overlay;
    }

    function openDrawer() {
        const overlay = buildDrawerElement();
        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
        const searchInput = overlay.querySelector('#spectra-drawer-search-input');
        if (searchInput) {
            setTimeout(() => {
                searchInput.focus();
                searchInput.select();
            }, 100);
        }
        const drawerBtn = document.getElementById('topbar-tools-drawer-btn');
        if (drawerBtn) drawerBtn.classList.add('active');
    }

    function closeDrawer() {
        const overlay = document.getElementById('spectra-tools-drawer-overlay');
        if (overlay) {
            overlay.classList.remove('open');
            document.body.style.overflow = '';
        }
        const drawerBtn = document.getElementById('topbar-tools-drawer-btn');
        if (drawerBtn) drawerBtn.classList.remove('active');
    }

    // Standardize and maintain the Topbar
    function maintainTopbar() {
        const topbar = document.querySelector('.topbar') || document.querySelector('.nav-header');
        
        // Also support workspace.html sidebar integration
        const wsDashboardBtn = document.getElementById('dashboard-btn');
        if (wsDashboardBtn && !document.getElementById('ws-tools-drawer-btn')) {
            const wsDrawerBtn = document.createElement('button');
            wsDrawerBtn.id = 'ws-tools-drawer-btn';
            wsDrawerBtn.className = 'icon-btn';
            wsDrawerBtn.title = 'Spectra Platform Tools Drawer (14 Modules)';
            wsDrawerBtn.style.cssText = 'width: 32px; height: 32px; border-radius: 6px; background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.25); color: #38bdf8; display: inline-flex; align-items: center; justify-content: center; cursor: pointer;';
            wsDrawerBtn.innerHTML = `
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.2" fill="none">
                    <rect x="3" y="3" width="7" height="7" rx="1.5"></rect>
                    <rect x="14" y="3" width="7" height="7" rx="1.5"></rect>
                    <rect x="14" y="14" width="7" height="7" rx="1.5"></rect>
                    <rect x="3" y="14" width="7" height="7" rx="1.5"></rect>
                </svg>
            `;
            wsDrawerBtn.onclick = (e) => {
                e.preventDefault();
                openDrawer();
            };
            wsDashboardBtn.parentNode.insertBefore(wsDrawerBtn, wsDashboardBtn.nextSibling);
        }

        if (!topbar) return;

        const topbarBrand = topbar.querySelector('.topbar-brand') || topbar.querySelector('.nav-links') || topbar;
        if (!topbarBrand) return;

        const currentPage = getCurrentPage();

        // Target list of essential pinned buttons in the normal header
        // Pinned: Dashboard, Workspace, Alt Graph, Audit, and Current Page (if not already one of these)
        const pinnedHrefs = ['index.html', 'workspace.html#main', 'workspace.html', 'graph.html', 'audit.html'];

        // Get all links currently inside topbarBrand
        const links = topbarBrand.querySelectorAll('a.btn, a.nav-btn');
        links.forEach(link => {
            const href = link.getAttribute('href');
            if (!href) return;
            const linkBase = href.split('#')[0].toLowerCase();
            const isCurrent = currentPage === linkBase;

            // Keep link visible only if pinned OR if it is the current active page
            const isPinned = pinnedHrefs.includes(href) || pinnedHrefs.includes(linkBase);
            if (isPinned || isCurrent) {
                link.style.display = 'inline-flex';
                link.classList.remove('nav-unpinned');
                link.classList.add('pinned-nav-btn');
            } else {
                // Prune from topbar to prevent horizontal overflow!
                link.style.display = 'none';
                link.classList.add('nav-unpinned');
                link.classList.remove('pinned-nav-btn');
            }
        });

        // Add the "All Tools ▾" drawer trigger button if not already present
        let drawerBtn = document.getElementById('topbar-tools-drawer-btn');
        if (!drawerBtn) {
            drawerBtn = document.createElement('button');
            drawerBtn.id = 'topbar-tools-drawer-btn';
            drawerBtn.className = 'topbar-drawer-btn';
            drawerBtn.title = 'Open All Platform Tools Drawer (14 modules)';
            drawerBtn.innerHTML = `
                <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2.2" fill="none">
                    <rect x="3" y="3" width="7" height="7" rx="1.5"></rect>
                    <rect x="14" y="3" width="7" height="7" rx="1.5"></rect>
                    <rect x="14" y="14" width="7" height="7" rx="1.5"></rect>
                    <rect x="3" y="14" width="7" height="7" rx="1.5"></rect>
                </svg>
                <span>Tools</span>
                <span style="font-size: 0.7rem; font-family: 'JetBrains Mono', monospace; opacity: 0.75;">(14)</span>
                <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" class="drawer-chevron">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            `;
            topbarBrand.appendChild(drawerBtn);
        }

        drawerBtn.onclick = (e) => {
            e.preventDefault();
            const overlay = document.getElementById('spectra-tools-drawer-overlay');
            if (overlay && overlay.classList.contains('open')) {
                closeDrawer();
            } else {
                openDrawer();
            }
        };

        // Theme Toggle maintenance
        const themeToggleBtn = topbar.querySelector('#theme-toggle-btn') || document.querySelector('#theme-toggle-btn') || document.querySelector('#theme-toggle');
        if (themeToggleBtn && !themeToggleBtn._boundHeader) {
            themeToggleBtn._boundHeader = true;
            themeToggleBtn.addEventListener('click', () => {
                const active = document.documentElement.getAttribute('data-theme') || 'dark';
                const next = active === 'dark' ? 'light' : 'dark';
                document.documentElement.setAttribute('data-theme', next);
                localStorage.setItem('multiCheckTheme', next);
                localStorage.setItem('spectraTheme', next);
            });
        }
    }

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeDrawer();
        }
        // Ctrl+M or Alt+T to toggle drawer
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'm') {
            e.preventDefault();
            const overlay = document.getElementById('spectra-tools-drawer-overlay');
            if (overlay && overlay.classList.contains('open')) closeDrawer();
            else openDrawer();
        }
    });

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            maintainTopbar();
            buildDrawerElement();
        });
    } else {
        maintainTopbar();
        buildDrawerElement();
    }

    // Export for external caller if needed
    window.SpectraHeader = {
        openDrawer,
        closeDrawer,
        refresh: maintainTopbar
    };
})();

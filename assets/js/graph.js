/**
 * Spectra Intelligence - Network Alt Graph & Syndicate Visualizer
 * High-performance 60 FPS HTML5 Canvas force-directed graph engine.
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

    function getAvailableWorkspaces() {
        let list = parseJSON(lsGet(KEYS.workspaces, '[]'), []);
        if (!Array.isArray(list) || list.length === 0) {
            list = [];
            try {
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && k.startsWith(KEYS.tabs + '_')) {
                        const wsId = k.substring(KEYS.tabs.length + 1);
                        list.push({ id: wsId, name: wsId === 'workspace-default' ? 'Default' : wsId });
                    }
                }
            } catch (e) { }
        }
        if (list.length === 0) {
            list = [{ id: 'workspace-default', name: 'Default', color: '#38bdf8' }];
        }
        return list;
    }

    function parseAccountLine(rawLine) {
        const line = (rawLine || '').trim();
        if (!line || line.startsWith('//') || line.startsWith('#') || line.startsWith('`') || line.startsWith('---')) return null;

        let name = '';
        let cleanId = '';
        let tags = '';

        if (line.includes('|')) {
            const parts = line.split('|').map(p => p.trim());
            name = parts[0] || 'Unknown';
            const idCandidate = parts[1] || '';
            const numMatch = idCandidate.match(/\b\d{3,10}\b/) || line.match(/\b\d{3,10}\b/);
            cleanId = numMatch ? numMatch[0] : '';
            tags = parts.slice(2).join(' | ');
        } else {
            const numMatch = line.match(/\b\d{3,10}\b/);
            if (numMatch) {
                cleanId = numMatch[0];
                name = line.replace(numMatch[0], '').replace(/[()#\[\],]/g, ' ').replace(/\s+/g, ' ').trim();
                if (!name) name = `ID_${cleanId}`;
            } else {
                name = line;
            }
        }

        const isMain = MAIN_RE.test(line);
        const isTwink = TWINK_RE.test(line);
        const isGriefer = GRIEFER_RE.test(line);

        return {
            name,
            cleanId,
            line,
            tags,
            isMain,
            isTwink,
            isGriefer
        };
    }

    // Graph Engine State
    const graph = {
        nodes: [],
        edges: [],
        nodeMap: new Map(),
        selectedNode: null,
        hoveredNode: null,
        animFrameId: null,
        running: true,
        // Viewport transform
        zoom: 1,
        panX: 0,
        panY: 0,
        isPanning: false,
        lastMouseX: 0,
        lastMouseY: 0,
        draggedNode: null,
        // Physics settings
        repulsion: 2600,
        linkDist: 85,
        gravity: 0.045,
        damping: 0.88,
        // Filters
        filterMains: true,
        filterTwinks: true,
        filterGriefers: true,
        filterIsolated: false,
        activeWsId: 'all'
    };

    let canvas, ctx;

    // Scan all workspaces & build node/edge network
    function buildGraphData() {
        const rawWorkspaces = getAvailableWorkspaces();

        const nodes = [];
        const edges = [];
        const nodeMap = new Map();
        const idClusterMap = new Map();
        const rootNameClusterMap = new Map();

        // 1. Gather accounts from real workspaces
        let realAccountsFound = 0;

        rawWorkspaces.forEach(ws => {
            if (!ws || !ws.id) return;
            if (graph.activeWsId !== 'all' && ws.id !== graph.activeWsId) return;

            let tabsStr = lsGet(wsKey(KEYS.tabs, ws.id), null);
            if ((!tabsStr || tabsStr === '[]') && ws.id === 'workspace-default') {
                const legacy = lsGet(KEYS.tabs, null);
                if (legacy && legacy !== '[]') tabsStr = legacy;
            }
            const tabs = parseJSON(tabsStr || '[]', []);

            tabs.forEach(tab => {
                const content = (tab.output && tab.output.trim()) ? tab.output : (tab.input || '');
                const lines = content.split('\n');

                lines.forEach(rawLine => {
                    const parsed = parseAccountLine(rawLine);
                    if (!parsed) return;
                    realAccountsFound++;

                    const nodeKey = parsed.cleanId ? `id:${parsed.cleanId}` : `name:${parsed.name.toLowerCase()}`;
                    let existing = nodeMap.get(nodeKey);

                    if (!existing) {
                        const angle = Math.random() * Math.PI * 2;
                        const dist = 60 + Math.random() * 240;

                        existing = {
                            key: nodeKey,
                            name: parsed.name,
                            id: parsed.cleanId || 'N/A',
                            rawLine: parsed.line,
                            wsId: ws.id,
                            wsName: ws.name || 'Workspace',
                            tabId: tab.id,
                            tabName: tab.name || 'Tab',
                            classification: parsed.isMain ? 'Main' : parsed.isTwink ? 'Twink' : 'Unlabeled',
                            isGriefer: parsed.isGriefer,
                            tags: parsed.tags,
                            // Position & physics
                            x: (canvas ? canvas.width / 2 : 400) + Math.cos(angle) * dist,
                            y: (canvas ? canvas.height / 2 : 300) + Math.sin(angle) * dist,
                            vx: 0,
                            vy: 0,
                            radius: parsed.isGriefer ? 13 : parsed.isMain ? 12 : 9,
                            color: parsed.isGriefer ? '#ef4444' : parsed.isMain ? '#06b6d4' : '#ec4899',
                            connected: new Set()
                        };

                        nodes.push(existing);
                        nodeMap.set(nodeKey, existing);
                    } else {
                        if (parsed.isGriefer) {
                            existing.isGriefer = true;
                            existing.color = '#ef4444';
                        }
                    }

                    if (parsed.cleanId) {
                        const cluster = idClusterMap.get(parsed.cleanId) || [];
                        cluster.push(existing);
                        idClusterMap.set(parsed.cleanId, cluster);
                    }

                    const rootName = parsed.name.replace(/_?(alt|twink|m|t|main|\d+)$/i, '').toLowerCase().trim();
                    if (rootName.length >= 3) {
                        const nameCluster = rootNameClusterMap.get(rootName) || [];
                        nameCluster.push(existing);
                        rootNameClusterMap.set(rootName, nameCluster);
                    }
                });
            });
        });

        // Generate Edges between linked alts & twinks
        const edgeKeys = new Set();
        function addLink(nodeA, nodeB, reason) {
            if (!nodeA || !nodeB || nodeA === nodeB) return;
            const pairKey = [nodeA.key, nodeB.key].sort().join('--');
            if (edgeKeys.has(pairKey)) return;
            edgeKeys.add(pairKey);

            nodeA.connected.add(nodeB);
            nodeB.connected.add(nodeA);

            edges.push({
                source: nodeA,
                target: nodeB,
                reason
            });
        }

        // 1. Link by identical numeric ID
        idClusterMap.forEach(cluster => {
            for (let i = 0; i < cluster.length; i++) {
                for (let j = i + 1; j < cluster.length; j++) {
                    addLink(cluster[i], cluster[j], 'Shared ID');
                }
            }
        });

        // 2. Link by root name match
        rootNameClusterMap.forEach(cluster => {
            if (cluster.length > 1 && cluster.length <= 15) {
                for (let i = 0; i < cluster.length; i++) {
                    for (let j = i + 1; j < cluster.length; j++) {
                        addLink(cluster[i], cluster[j], 'Name Pattern');
                    }
                }
            }
        });

        // Apply filters
        graph.nodes = nodes.filter(n => {
            if (!graph.filterMains && n.classification === 'Main') return false;
            if (!graph.filterTwinks && n.classification === 'Twink') return false;
            if (!graph.filterGriefers && n.isGriefer) return false;
            if (!graph.filterIsolated && n.connected.size === 0 && nodes.length > 30) return false;
            return true;
        });

        graph.edges = edges.filter(e => graph.nodes.includes(e.source) && graph.nodes.includes(e.target));
        graph.nodeMap = nodeMap;

        // Toggle Empty Overlay
        const emptyOverlay = document.getElementById('graph-empty-overlay');
        if (emptyOverlay) {
            emptyOverlay.style.display = graph.nodes.length === 0 ? 'flex' : 'none';
        }

        updateHUDStats();
    }

    function updateHUDStats() {
        const countBadge = document.getElementById('graph-node-count');
        const clusterBadge = document.getElementById('graph-cluster-count');
        if (countBadge) countBadge.textContent = `${graph.nodes.length} nodes`;
        if (clusterBadge) clusterBadge.textContent = `${graph.edges.length} links`;
    }

    // Force-directed Physics Step
    function stepPhysics() {
        if (!graph.running) return;

        const nodes = graph.nodes;
        const edges = graph.edges;
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;

        // 1. Repulsion force between all node pairs
        for (let i = 0; i < nodes.length; i++) {
            const na = nodes[i];
            for (let j = i + 1; j < nodes.length; j++) {
                const nb = nodes[j];
                const dx = nb.x - na.x;
                const dy = nb.y - na.y;
                let distSq = dx * dx + dy * dy;
                if (distSq < 1) distSq = 1;
                const dist = Math.sqrt(distSq);

                if (dist < 400) {
                    const force = graph.repulsion / (distSq + 200);
                    const fx = (dx / dist) * force;
                    const fy = (dy / dist) * force;

                    na.vx -= fx;
                    na.vy -= fy;
                    nb.vx += fx;
                    nb.vy += fy;
                }
            }

            // Gravity towards center
            const gdx = cx - na.x;
            const gdy = cy - na.y;
            na.vx += gdx * graph.gravity * 0.05;
            na.vy += gdy * graph.gravity * 0.05;
        }

        // 2. Spring link forces along edges
        for (let i = 0; i < edges.length; i++) {
            const e = edges[i];
            const dx = e.target.x - e.source.x;
            const dy = e.target.y - e.source.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const diff = dist - graph.linkDist;
            const force = diff * 0.04;

            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            e.source.vx += fx;
            e.source.vy += fy;
            e.target.vx -= fx;
            e.target.vy -= fy;
        }

        // 3. Integrate velocities and apply damping
        for (let i = 0; i < nodes.length; i++) {
            const n = nodes[i];
            if (n === graph.draggedNode) continue; // Don't move actively dragged node

            n.vx *= graph.damping;
            n.vy *= graph.damping;

            // Cap maximum speed
            const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
            if (speed > 12) {
                n.vx = (n.vx / speed) * 12;
                n.vy = (n.vy / speed) * 12;
            }

            n.x += n.vx;
            n.y += n.vy;
        }
    }

    // Render Canvas Frame
    function renderFrame() {
        stepPhysics();

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        // Apply camera pan & zoom
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(graph.zoom, graph.zoom);
        ctx.translate(-canvas.width / 2 + graph.panX, -canvas.height / 2 + graph.panY);

        const cx = canvas.width / 2;
        const cy = canvas.height / 2;

        // Draw Ambient Tactical Radar Grid & Range Rings
        ctx.save();
        ctx.lineWidth = 1;
        const isDark = (document.documentElement.getAttribute('data-theme') || 'dark') === 'dark';
        const rings = [100, 220, 360, 520, 700];
        rings.forEach(r => {
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.strokeStyle = isDark ? 'rgba(56, 189, 248, 0.05)' : 'rgba(15, 23, 42, 0.05)';
            ctx.setLineDash([4, 6]);
            ctx.stroke();

            // Distance label
            ctx.setLineDash([]);
            ctx.font = '500 9px JetBrains Mono, monospace';
            ctx.fillStyle = isDark ? 'rgba(56, 189, 248, 0.22)' : 'rgba(15, 23, 42, 0.22)';
            ctx.fillText(`R-${r}`, cx + 6, cy - r + 12);
        });

        // Center Coordinate Crosshair
        ctx.beginPath();
        ctx.moveTo(cx - 24, cy);
        ctx.lineTo(cx + 24, cy);
        ctx.moveTo(cx, cy - 24);
        ctx.lineTo(cx, cy + 24);
        ctx.strokeStyle = isDark ? 'rgba(56, 189, 248, 0.28)' : 'rgba(15, 23, 42, 0.2)';
        ctx.setLineDash([]);
        ctx.stroke();
        ctx.restore();

        const activeNode = graph.hoveredNode || graph.selectedNode;

        // Draw Links
        for (let i = 0; i < graph.edges.length; i++) {
            const e = graph.edges[i];
            const isConnectedToActive = activeNode && (e.source === activeNode || e.target === activeNode);

            ctx.beginPath();
            ctx.moveTo(e.source.x, e.source.y);
            ctx.lineTo(e.target.x, e.target.y);

            if (isConnectedToActive) {
                ctx.strokeStyle = '#38bdf8';
                ctx.lineWidth = 2.5;
            } else if (activeNode) {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
                ctx.lineWidth = 1;
            } else {
                ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
                ctx.lineWidth = 1.2;
            }
            ctx.stroke();
        }

        // Draw Nodes
        const now = Date.now();
        for (let i = 0; i < graph.nodes.length; i++) {
            const n = graph.nodes[i];
            const isSelected = n === graph.selectedNode;
            const isHovered = n === graph.hoveredNode;
            const isConnected = activeNode && (n === activeNode || activeNode.connected.has(n));
            const isDimmed = activeNode && !isConnected;

            ctx.save();
            ctx.translate(n.x, n.y);

            // Dim unconnected nodes if one is highlighted
            if (isDimmed) {
                ctx.globalAlpha = 0.2;
            }

            // Griefer Pulse Ring
            if (n.isGriefer) {
                const pulse = (Math.sin(now / 200) + 1) * 3;
                ctx.beginPath();
                ctx.arc(0, 0, n.radius + 4 + pulse, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }

            // Selection Halo
            if (isSelected || isHovered) {
                ctx.beginPath();
                ctx.arc(0, 0, n.radius + 6, 0, Math.PI * 2);
                ctx.strokeStyle = '#38bdf8';
                ctx.lineWidth = 2.5;
                ctx.stroke();
            }

            // Core Node Circle
            ctx.beginPath();
            ctx.arc(0, 0, n.radius, 0, Math.PI * 2);
            ctx.fillStyle = n.color;
            ctx.fill();
            ctx.strokeStyle = '#070711';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Label (show if zoom >= 0.8 or node is active/connected)
            if (graph.zoom >= 0.8 || isConnected || isSelected || isHovered) {
                ctx.font = `${isSelected ? '700' : '600'} 11px Outfit, sans-serif`;
                ctx.fillStyle = isSelected ? '#38bdf8' : '#f8fafc';
                ctx.textAlign = 'center';
                ctx.fillText(n.name, 0, n.radius + 14);

                if (n.id && n.id !== 'N/A') {
                    ctx.font = '500 9px JetBrains Mono, monospace';
                    ctx.fillStyle = '#94a3b8';
                    ctx.fillText(`#${n.id}`, 0, n.radius + 25);
                }
            }

            ctx.restore();
        }

        ctx.restore();

        graph.animFrameId = requestAnimationFrame(renderFrame);
    }

    // Convert Screen coordinates to World coordinates
    function screenToWorld(sx, sy) {
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const wx = (sx - cx) / graph.zoom + cx - graph.panX;
        const wy = (sy - cy) / graph.zoom + cy - graph.panY;
        return { x: wx, y: wy };
    }

    // Find node under mouse
    function getNodeAt(sx, sy) {
        const world = screenToWorld(sx, sy);
        for (let i = graph.nodes.length - 1; i >= 0; i--) {
            const n = graph.nodes[i];
            const dx = world.x - n.x;
            const dy = world.y - n.y;
            if (dx * dx + dy * dy <= (n.radius + 5) * (n.radius + 5)) {
                return n;
            }
        }
        return null;
    }

    // Select node & open Player Dossier Drawer
    function selectNode(node) {
        graph.selectedNode = node;
        const drawer = document.getElementById('dossier-drawer');
        if (!drawer) return;

        if (!node) {
            drawer.classList.remove('open');
            return;
        }

        // Populate drawer
        const nameEl = document.getElementById('dossier-name');
        const idEl = document.getElementById('dossier-id');
        const wsEl = document.getElementById('dossier-workspace');
        const classEl = document.getElementById('dossier-class-badge');
        const altsList = document.getElementById('dossier-alts-list');
        const rawBox = document.getElementById('dossier-raw-box');
        const banBtn = document.getElementById('dossier-ban-btn');
        const inspectBtn = document.getElementById('dossier-inspect-btn');

        if (nameEl) nameEl.textContent = node.name;
        if (idEl) idEl.textContent = node.id && node.id !== 'N/A' ? `ID #${node.id}` : 'No numeric ID';
        if (wsEl) wsEl.textContent = `${node.wsName} · ${node.tabName}`;

        if (classEl) {
            classEl.textContent = node.classification;
            classEl.style.backgroundColor = node.classification === 'Main' ? 'rgba(6, 182, 212, 0.2)' : 'rgba(236, 72, 153, 0.2)';
            classEl.style.color = node.classification === 'Main' ? '#22d3ee' : '#f472b6';
        }

        if (rawBox) rawBox.textContent = node.rawLine;

        // List connected alts
        if (altsList) {
            const alts = Array.from(node.connected);
            if (alts.length === 0) {
                altsList.innerHTML = '<p style="color: var(--text-3); font-size: 0.78rem; margin: 0;">No direct twinks or alts linked.</p>';
            } else {
                altsList.innerHTML = alts.map(alt => `
                    <div class="dossier-alt-item" data-select-key="${alt.key}">
                        <div>
                            <strong style="color: var(--text-1);">${alt.name}</strong>
                            <span style="color: var(--text-3); font-size: 0.72rem; margin-left: 6px;">#${alt.id}</span>
                        </div>
                        <span class="badge" style="font-size: 0.68rem; color: ${alt.color};">${alt.classification}</span>
                    </div>
                `).join('');

                altsList.querySelectorAll('[data-select-key]').forEach(item => {
                    item.addEventListener('click', () => {
                        const target = graph.nodeMap.get(item.dataset.selectKey);
                        if (target) selectNode(target);
                    });
                });
            }
        }

        // Action links
        if (banBtn) {
            banBtn.onclick = () => {
                const cmd = `/ban ${node.id !== 'N/A' ? node.id : node.name} 60 ${node.tags || 'Griefer'}`;
                navigator.clipboard.writeText(cmd).then(() => {
                    showToast(`📋 Copied command: <code>${cmd}</code>`);
                });
            };
        }

        if (inspectBtn) {
            inspectBtn.onclick = () => {
                localStorage.setItem('multiCheckCurrentWorkspace', node.wsId);
                localStorage.setItem(`multiCheckActiveTab_${node.wsId}`, node.tabId);
                window.location.href = 'workspace.html#main';
            };
        }

        drawer.classList.add('open');
    }

    function showToast(msg) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.innerHTML = msg;
        toast.classList.add('show', 'visible');
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => toast.classList.remove('show', 'visible'), 3000);
    }

    // Resize canvas to match wrapper container
    function handleResize() {
        const wrapper = document.querySelector('.graph-viewport-wrapper');
        if (!wrapper || !canvas) return;
        canvas.width = wrapper.clientWidth;
        canvas.height = wrapper.clientHeight;
    }

    // Bind event handlers
    function init() {
        canvas = document.getElementById('graph-canvas');
        if (!canvas) return;
        ctx = canvas.getContext('2d');

        handleResize();
        window.addEventListener('resize', handleResize);

        // Populate Workspace Filter
        const wsSelect = document.getElementById('graph-ws-select');
        if (wsSelect) {
            const rawWorkspaces = getAvailableWorkspaces();
            wsSelect.innerHTML = '<option value="all">All Workspaces</option>' + rawWorkspaces.map(ws => `
                <option value="${ws.id}">${ws.name || 'Workspace'}</option>
            `).join('');

            wsSelect.addEventListener('change', () => {
                graph.activeWsId = wsSelect.value;
                buildGraphData();
            });
        }

        // Live Storage & Visibility Synchronization
        window.addEventListener('storage', (e) => {
            if (e.key && (e.key.startsWith(KEYS.tabs) || e.key === KEYS.workspaces)) {
                buildGraphData();
            }
        });

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                buildGraphData();
            }
        });

        buildGraphData();
        renderFrame();

        // Mouse interactions
        canvas.addEventListener('mousedown', (e) => {
            const rect = canvas.getBoundingClientRect();
            const sx = e.clientX - rect.left;
            const sy = e.clientY - rect.top;
            const node = getNodeAt(sx, sy);

            if (node) {
                graph.draggedNode = node;
                selectNode(node);
            } else {
                graph.isPanning = true;
                graph.lastMouseX = e.clientX;
                graph.lastMouseY = e.clientY;
            }
        });

        window.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const sx = e.clientX - rect.left;
            const sy = e.clientY - rect.top;

            if (graph.draggedNode) {
                const world = screenToWorld(sx, sy);
                graph.draggedNode.x = world.x;
                graph.draggedNode.y = world.y;
                graph.draggedNode.vx = 0;
                graph.draggedNode.vy = 0;
            } else if (graph.isPanning) {
                const dx = e.clientX - graph.lastMouseX;
                const dy = e.clientY - graph.lastMouseY;
                graph.panX += dx / graph.zoom;
                graph.panY += dy / graph.zoom;
                graph.lastMouseX = e.clientX;
                graph.lastMouseY = e.clientY;
            } else {
                graph.hoveredNode = getNodeAt(sx, sy);
                canvas.style.cursor = graph.hoveredNode ? 'pointer' : 'grab';
            }
        });

        window.addEventListener('mouseup', () => {
            graph.draggedNode = null;
            graph.isPanning = false;
        });

        // Zoom with wheel
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
            const newZoom = Math.min(Math.max(graph.zoom * zoomFactor, 0.25), 3.5);
            graph.zoom = newZoom;
        }, { passive: false });

        // Search Node
        const searchInput = document.getElementById('graph-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                const query = searchInput.value.trim().toLowerCase();
                if (!query) return;

                const match = graph.nodes.find(n => n.name.toLowerCase().includes(query) || n.id.includes(query));
                if (match) {
                    graph.panX = canvas.width / 2 - match.x;
                    graph.panY = canvas.height / 2 - match.y;
                    selectNode(match);
                }
            });
        }

        // Close Drawer button
        const closeDrawerBtn = document.getElementById('close-dossier-btn');
        if (closeDrawerBtn) {
            closeDrawerBtn.addEventListener('click', () => selectNode(null));
        }

        // Filter Toggles
        const toggleMains = document.getElementById('toggle-mains');
        const toggleTwinks = document.getElementById('toggle-twinks');
        const toggleGriefers = document.getElementById('toggle-griefers');

        if (toggleMains) toggleMains.onclick = () => {
            graph.filterMains = !graph.filterMains;
            toggleMains.classList.toggle('active', graph.filterMains);
            buildGraphData();
        };
        if (toggleTwinks) toggleTwinks.onclick = () => {
            graph.filterTwinks = !graph.filterTwinks;
            toggleTwinks.classList.toggle('active', graph.filterTwinks);
            buildGraphData();
        };
        if (toggleGriefers) toggleGriefers.onclick = () => {
            graph.filterGriefers = !graph.filterGriefers;
            toggleGriefers.classList.toggle('active', graph.filterGriefers);
            buildGraphData();
        };

        // Reset Camera
        const resetCamBtn = document.getElementById('reset-camera-btn');
        if (resetCamBtn) {
            resetCamBtn.onclick = () => {
                graph.zoom = 1;
                graph.panX = 0;
                graph.panY = 0;
                showToast('Camera reset to center.');
            };
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

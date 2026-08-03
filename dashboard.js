function getWorkspaceStorageKey(baseKey) {
    const currentWorkspace = localStorage.getItem('multiCheckCurrentWorkspace') || 'workspace-default';
    return `${baseKey}_${currentWorkspace}`;
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function loadDashboard() {
    let totalAccounts = 0;
    let totalTabs = 0;
    let totalMains = 0;
    let totalTwinks = 0;
    let totalGriefers = 0;
    let totalGroups = 0;
    let totalSize = 0;

    // Get all workspaces
    const workspaces = JSON.parse(localStorage.getItem('multiCheckWorkspaces') || '[]');
    const workspacesList = document.getElementById('workspaces-list');
    workspacesList.innerHTML = '';

    if (workspaces.length === 0) {
        workspacesList.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                </svg>
                <p>No workspaces found</p>
            </div>
        `;
    } else {
        workspaces.forEach(workspace => {
            const wsKey = `${workspace.id}`;
            const tabs = JSON.parse(localStorage.getItem(`multiCheckTabs_${wsKey}`) || '[]');
            const groups = JSON.parse(localStorage.getItem(`multiCheckGroups_${wsKey}`) || '[]');
            
            let wsAccounts = 0;
            let wsMains = 0;
            let wsTwinks = 0;
            let wsGriefers = 0;

            tabs.forEach(tab => {
                const output = tab.output || '';
                const lines = output.split('\n');
                lines.forEach(line => {
                    if (line.includes('|')) {
                        wsAccounts++;
                        // Count both (M)/(T), M/T, and ( M )/( T ) formats
                        if (line.includes('(M)') || line.match(/M\s*$/) || line.includes('( M )')) wsMains++;
                        else if (line.includes('(T)') || line.match(/T\s*$/) || line.includes('( T )')) wsTwinks++;
                        
                        const grieferTags = ['(Non-RP)', '(Fail-RP)', '(Provoking)', '(GR3.1)', '(GR3.2)', '(DM)'];
                        const upperLine = line.toUpperCase();
                        // Check both with and without parentheses, and with/without !! suffix
                        const hasGrieferTag = grieferTags.some(tag => {
                            const tagWithParens = tag.toUpperCase();
                            const tagWithoutParens = tag.replace(/[()]/g, '').toUpperCase();
                            const tagWithoutParensNoSuffix = tagWithoutParens.replace(' !!', '').trim();
                            return upperLine.includes(tagWithParens) || upperLine.includes(tagWithoutParens) || upperLine.includes(tagWithoutParensNoSuffix);
                        });
                        if (hasGrieferTag) {
                            wsGriefers++;
                        }
                    }
                });
            });

            totalAccounts += wsAccounts;
            totalTabs += tabs.length;
            totalMains += wsMains;
            totalTwinks += wsTwinks;
            totalGriefers += wsGriefers;
            totalGroups += groups.length;

            const wsItem = document.createElement('div');
            wsItem.className = 'workspace-item';
            wsItem.innerHTML = `
                <div class="item-info">
                    <div class="item-name">${workspace.name}</div>
                    <div class="item-badge">${tabs.length} tabs</div>
                </div>
                <div class="item-meta">${wsAccounts} accounts • ${wsMains}M / ${wsTwinks}T • ${wsGriefers} Griefers</div>
            `;
            workspacesList.appendChild(wsItem);
        });
    }

    // Get all tabs from current workspace
    const tabs = JSON.parse(localStorage.getItem(getWorkspaceStorageKey('multiCheckTabs')) || '[]');
    const groups = JSON.parse(localStorage.getItem(getWorkspaceStorageKey('multiCheckGroups')) || '[]');
    
    const tabsList = document.getElementById('tabs-list');
    tabsList.innerHTML = '';

    if (tabs.length === 0) {
        tabsList.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="3" y1="9" x2="21" y2="9"></line>
                    <line x1="9" y1="21" x2="9" y2="9"></line>
                </svg>
                <p>No tabs found</p>
            </div>
        `;
    } else {
        tabs.forEach(tab => {
            const output = tab.output || '';
            const lines = output.split('\n');
            let tabAccounts = 0;
            let tabMains = 0;
            let tabTwinks = 0;
            let tabGriefers = 0;

            lines.forEach(line => {
                if (line.includes('|')) {
                    tabAccounts++;
                    // Count both (M)/(T) and M/T formats
                    if (line.includes('(M)') || line.match(/M\s*$/) || line.includes('( M )')) tabMains++;
                    else if (line.includes('(T)') || line.match(/T\s*$/) || line.includes('( T )')) tabTwinks++;
                    
                    const grieferTags = ['(Non-RP)', '(Fail-RP)', '(Provoking)', '(GR3.1)', '(GR3.2)', '(DM)'];
                    const upperLine = line.toUpperCase();
                    // Check both with and without parentheses, and with/without !! suffix
                    const hasGrieferTag = grieferTags.some(tag => {
                        const tagWithParens = tag.toUpperCase();
                        const tagWithoutParens = tag.replace(/[()]/g, '').toUpperCase();
                        const tagWithoutParensNoSuffix = tagWithoutParens.replace(' !!', '').trim();
                        return upperLine.includes(tagWithParens) || upperLine.includes(tagWithoutParens) || upperLine.includes(tagWithoutParensNoSuffix);
                    });
                    if (hasGrieferTag) {
                        tabGriefers++;
                    }
                }
            });

            const tabItem = document.createElement('div');
            tabItem.className = 'tab-item';
            tabItem.innerHTML = `
                <div class="item-info">
                    <div class="item-name">${tab.name}</div>
                    ${tab.pinned ? '<span class="item-badge" style="background: rgba(245, 158, 11, 0.2); color: #fbbf24;">Pinned</span>' : ''}
                </div>
                <div class="item-meta">${tabAccounts} accounts • ${tabMains}M / ${tabTwinks}T • ${tabGriefers} Griefers</div>
            `;
            tabsList.appendChild(tabItem);
        });
    }

    // Groups
    const groupsList = document.getElementById('groups-list');
    groupsList.innerHTML = '';

    if (groups.length === 0) {
        groupsList.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <p>No groups found</p>
            </div>
        `;
    } else {
        groups.forEach(group => {
            const groupTabs = tabs.filter(t => t.groupId === group.id);
            const groupItem = document.createElement('div');
            groupItem.className = 'group-item';
            groupItem.innerHTML = `
                <div class="item-info">
                    <div class="color-dot" style="background: ${group.color}; margin-right: 8px;"></div>
                    <div class="item-name">${group.name}</div>
                </div>
                <div class="item-badge">${groupTabs.length} tabs</div>
            `;
            groupsList.appendChild(groupItem);
        });
    }

    // Calculate storage
    let storageUsed = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('multiCheck')) {
            storageUsed += (localStorage.getItem(key) || '').length;
        }
    }

    // Update stats
    document.getElementById('total-accounts').textContent = totalAccounts.toLocaleString();
    document.getElementById('total-tabs').textContent = totalTabs.toLocaleString();
    document.getElementById('total-workspaces').textContent = workspaces.length;
    document.getElementById('total-groups').textContent = totalGroups.toLocaleString();
    document.getElementById('total-size').textContent = formatBytes(storageUsed);
    document.getElementById('total-mains').textContent = totalMains.toLocaleString();
    document.getElementById('total-twinks').textContent = totalTwinks.toLocaleString();
    document.getElementById('total-griefers').textContent = totalGriefers.toLocaleString();

    // Storage info
    document.getElementById('storage-used').textContent = formatBytes(storageUsed);
    document.getElementById('storage-keys').textContent = localStorage.length;
    const storagePercent = Math.min((storageUsed / (5 * 1024 * 1024)) * 100, 100);
    document.getElementById('storage-bar').style.width = storagePercent + '%';
}

// Load dashboard on page load
loadDashboard();

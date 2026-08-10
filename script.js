// Workspace Management
let workspaces = JSON.parse(localStorage.getItem('multiCheckWorkspaces')) || [
    { id: 'workspace-default', name: 'Default', tags: [], createdAt: Date.now() }
];
let currentWorkspaceId = localStorage.getItem('multiCheckCurrentWorkspace') || 'workspace-default';

function getWorkspaceStorageKey(baseKey) {
    return `${baseKey}_${currentWorkspaceId}`;
}

function getCurrentWorkspace() {
    return workspaces.find(w => w.id === currentWorkspaceId) || workspaces[0];
}

function saveWorkspaces() {
    localStorage.setItem('multiCheckWorkspaces', JSON.stringify(workspaces));
    localStorage.setItem('multiCheckCurrentWorkspace', currentWorkspaceId);
}

// Migration: Move old localStorage data to default workspace
function migrateOldDataToDefaultWorkspace() {
    const oldKeys = [
        'multiCheckTabs',
        'multiCheckActiveTab',
        'multiCheckFontSizeIdx',
        'multiCheckUnderscoreNames',
        'multiCheckDiscordCode',
        'multiCheckKbdHotkeys',
        'multiCheckStats',
        'multiCheckFullscreen',
        'multiCheckBanBy',
        'multiCheckBanPending',
        'multiCheckBanOnlyMort',
        'multiCheckBanAdmin',
        'multiCheckBanGenState'
    ];
    
    const defaultWorkspaceKey = 'workspace-default';
    let migrated = false;
    let migrationLog = [];
    
    // Check if migration was already done
    const migrationFlag = localStorage.getItem('multiCheckWorkspaceMigrationDone');
    
    oldKeys.forEach(oldKey => {
        const oldValue = localStorage.getItem(oldKey);
        const newKey = `${oldKey}_${defaultWorkspaceKey}`;
        const existingNewValue = localStorage.getItem(newKey);
        
        // Migrate if old data exists and either:
        // 1. New data doesn't exist, OR
        // 2. Migration wasn't done before and old data has actual content
        if (oldValue !== null) {
            const hasContent = oldValue.trim() !== '' && oldValue !== '[]' && oldValue !== 'null';
            const newHasContent = existingNewValue && existingNewValue.trim() !== '' && existingNewValue !== '[]' && existingNewValue !== 'null';
            
            if (!existingNewValue || (!migrationFlag && hasContent && !newHasContent)) {
                localStorage.setItem(newKey, oldValue);
                migrated = true;
                migrationLog.push(`Migrated ${oldKey} -> ${newKey}`);
            } else if (existingNewValue) {
                migrationLog.push(`Skipped ${oldKey} (new data exists)`);
            } else {
                migrationLog.push(`Skipped ${oldKey} (no content)`);
            }
        } else {
            migrationLog.push(`Skipped ${oldKey} (no old data)`);
        }
    });
    
    // Mark migration as done
    if (migrated) {
        localStorage.setItem('multiCheckWorkspaceMigrationDone', 'true');
    }
    
    if (migrationLog.length > 0) {
        console.log('Workspace Migration Log:', migrationLog);
    }
    
    return migrated;
}

// Run migration on first load
migrateOldDataToDefaultWorkspace();

// Force re-migration function (can be called from console if needed)
window.forceReMigration = function() {
    localStorage.removeItem('multiCheckWorkspaceMigrationDone');
    console.log('Migration flag cleared. Refreshing page to re-migrate...');
    location.reload();
};

function switchWorkspace(workspaceId) {
    if (!workspaceId || workspaceId === currentWorkspaceId) return;
    
    // Save current workspace data before switching
    saveState();
    
    // Switch to new workspace
    currentWorkspaceId = workspaceId;
    saveWorkspaces();
    
    // Reload data for new workspace
    tabs = normalizeTabs(JSON.parse(localStorage.getItem(getWorkspaceStorageKey('multiCheckTabs'))) || [
        { id: 'tab-' + Date.now(), name: 'Main List', input: '', output: '' }
    ]);
    activeTabId = localStorage.getItem(getWorkspaceStorageKey('multiCheckActiveTab')) || (tabs[0] ? tabs[0].id : null);
    
    // Reload workspace-specific settings
    fontSizeIdx = parseInt(localStorage.getItem(getWorkspaceStorageKey('multiCheckFontSizeIdx')) ?? DEFAULT_FONT_IDX, 10);
    if (fontSizeIdx < 0 || fontSizeIdx >= FONT_STEPS.length) fontSizeIdx = DEFAULT_FONT_IDX;
    applyFontSize();
    
    if (underscoreNamesToggle) {
        underscoreNamesToggle.checked = localStorage.getItem(getWorkspaceStorageKey('multiCheckUnderscoreNames')) === 'true';
    }
    if (discordCodeToggle) {
        discordCodeToggle.checked = localStorage.getItem(getWorkspaceStorageKey('multiCheckDiscordCode')) === 'true';
    }
    if (kbdToggle) {
        kbdToggle.checked = localStorage.getItem(getWorkspaceStorageKey('multiCheckKbdHotkeys')) === 'true';
        applyKbdToggleStyle();
    }
    if (autoProcessToggle) {
        autoProcessToggle.checked = localStorage.getItem(getWorkspaceStorageKey('multiCheckAutoProcess')) === 'true';
        autoProcessEnabled = autoProcessToggle.checked;
    }
    statsVisible = localStorage.getItem(getWorkspaceStorageKey('multiCheckStats')) !== 'false';
    applyStatsToggle();
    isFullscreen = localStorage.getItem(getWorkspaceStorageKey('multiCheckFullscreen')) === 'true';
    updateFullscreenState();

    // Reload ban generator settings (custom presets are now global, not workspace-specific)
    if (banByCheckbox) {
        banByCheckbox.checked = localStorage.getItem(getWorkspaceStorageKey('multiCheckBanBy')) === 'true';
    }
    if (banPendingCheckbox) {
        banPendingCheckbox.checked = localStorage.getItem(getWorkspaceStorageKey('multiCheckBanPending')) === 'true';
    }
    if (banGrieferOnlyCheckbox) {
        banGrieferOnlyCheckbox.checked = localStorage.getItem(getWorkspaceStorageKey('multiCheckBanGrieferOnly')) === 'true';
    }
    if (banNoTagCheckbox) {
        banNoTagCheckbox.checked = localStorage.getItem(getWorkspaceStorageKey('multiCheckBanNoTag')) === 'true';
    }
    if (banOnlyMortCheckbox) {
        banOnlyMortCheckbox.checked = localStorage.getItem(getWorkspaceStorageKey('multiCheckBanOnlyMort')) === 'true';
    }
    if (banAdminName) {
        banAdminName.value = localStorage.getItem(getWorkspaceStorageKey('multiCheckBanAdmin')) || '';
    }
    
    // Reload ban generator state
    if (typeof loadBanGeneratorState === 'function') {
        loadBanGeneratorState();
    }

    // Ensure view is correct for empty workspaces
    if (tabs.length === 0 && currentView === 'bans') {
        viewToggleBtn.click();
    }

    // Update UI
    renderWorkspaceUI();
    renderTabs();
    
    // Update workspace list in modal if it's open
    const workspaceModal = document.getElementById('workspace-modal');
    if (workspaceModal && !workspaceModal.classList.contains('hidden')) {
        renderWorkspaceList();
    }
}

function createWorkspace(name, tags = []) {
    const trimmedName = (name || '').trim();
    if (!trimmedName) return null;
    
    const newWorkspace = {
        id: 'workspace-' + Date.now(),
        name: trimmedName,
        tags: tags.filter(t => t.trim()).map(t => t.trim().replace(/^#/, '')),
        createdAt: Date.now(),
        pinned: false
    };
    
    workspaces.push(newWorkspace);
    saveWorkspaces();
    renderWorkspaceUI();
    
    // Add creation animation
    setTimeout(() => {
        const workspaceList = document.getElementById('workspace-list');
        const workspaceItems = workspaceList?.querySelectorAll('.workspace-item');
        const newItem = workspaceItems?.[workspaceItems.length - 1];
        if (newItem) {
            newItem.classList.add('creating');
            setTimeout(() => newItem.classList.remove('creating'), 300);
        }
    }, 0);
    
    renderWorkspaceList();
    
    return newWorkspace;
}

function deleteWorkspace(workspaceId) {
    if (workspaceId === 'workspace-default') {
        showAlert('Cannot Delete', 'Cannot delete the default workspace.');
        return;
    }
    
    if (workspaceId === currentWorkspaceId) {
        showAlert('Cannot Delete', 'Cannot delete the workspace you are currently in. Switch to another workspace first.');
        return;
    }
    
    const workspaceIndex = workspaces.findIndex(w => w.id === workspaceId);
    if (workspaceIndex === -1) return;
    
    // Find and animate the workspace item
    const workspaceList = document.getElementById('workspace-list');
    const workspaceItems = workspaceList?.querySelectorAll('.workspace-item');
    let targetItem = null;
    
    workspaceItems?.forEach(item => {
        const itemInfo = item.querySelector('.workspace-item-name');
        if (itemInfo && itemInfo.textContent === workspaces[workspaceIndex].name) {
            targetItem = item;
        }
    });
    
    // Backup workspace data for potential undo
    const workspace = workspaces[workspaceIndex];
    const workspaceData = {};
    Object.keys(localStorage).forEach(key => {
        if (key.endsWith(`_${workspaceId}`)) {
            workspaceData[key] = localStorage.getItem(key);
        }
    });
    
    deletedWorkspaceBackup = {
        workspace: JSON.parse(JSON.stringify(workspace)),
        data: workspaceData
    };
    
    // Animate deletion
    if (targetItem) {
        targetItem.classList.add('deleting');
        
        // Wait for animation to complete before removing
        setTimeout(() => {
            // Remove workspace from array
            workspaces.splice(workspaceIndex, 1);
            saveWorkspaces();
            renderWorkspaceUI();
        }, 500); // Match animation duration
    } else {
        // If item not found, proceed immediately
        workspaces.splice(workspaceIndex, 1);
        saveWorkspaces();
        renderWorkspaceUI();
    }
    
    // Show undo toast with 10 second timer
    showUndoToast(`Workspace "${workspace.name}" deleted`, () => {
        // Undo: restore workspace
        workspaces.push(deletedWorkspaceBackup.workspace);
        saveWorkspaces();
        
        // Restore localStorage data
        Object.keys(deletedWorkspaceBackup.data).forEach(key => {
            localStorage.setItem(key, deletedWorkspaceBackup.data[key]);
        });
        
        deletedWorkspaceBackup = null;
        renderWorkspaceUI();
    }, 10000); // 10 seconds
    
    // Actually delete data after timer expires
    clearTimeout(workspaceDeleteTimer);
    workspaceDeleteTimer = setTimeout(() => {
        if (deletedWorkspaceBackup) {
            // Permanently delete the data
            Object.keys(deletedWorkspaceBackup.data).forEach(key => {
                localStorage.removeItem(key);
            });
            deletedWorkspaceBackup = null;
        }
    }, 10000);
}

function renameWorkspace(workspaceId, newName) {
    const workspace = workspaces.find(w => w.id === workspaceId);
    if (!workspace) return;
    
    const trimmedName = (newName || '').trim();
    if (!trimmedName) return;
    
    workspace.name = trimmedName;
    saveWorkspaces();
    renderWorkspaceUI();
}

function startInlineWorkspaceRename(workspaceId) {
    inlineRenamingWorkspaceId = workspaceId;
    renderWorkspaceList();
}

function finishInlineWorkspaceRename(workspaceId, nextName, shouldSave) {
    const workspace = workspaces.find(w => w.id === workspaceId);
    if (!workspace) return;

    if (shouldSave) {
        const trimmed = (nextName || '').trim();
        if (trimmed) {
            workspace.name = trimmed;
            saveWorkspaces();
            renderWorkspaceUI();
        }
    }

    inlineRenamingWorkspaceId = null;
    renderWorkspaceList();
}

function updateWorkspaceTags(workspaceId, tags) {
    const workspace = workspaces.find(w => w.id === workspaceId);
    if (!workspace) return;
    
    workspace.tags = tags.filter(t => t.trim()).map(t => t.trim().replace(/^#/, ''));
    saveWorkspaces();
    renderWorkspaceUI();
}

function renderWorkspaceUI() {
    // Update workspace dropdown button label
    const currentWorkspace = getCurrentWorkspace();
    if (workspaceDropdownLabel && currentWorkspace) {
        workspaceDropdownLabel.textContent = currentWorkspace.name;
    }
    
    // Update workspace dropdown menu
    if (workspaceDropdownMenu) {
        workspaceDropdownMenu.innerHTML = '';
        // Sort workspaces: pinned first, then by order index, then by name
        const sortedWorkspaces = [...workspaces].sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            const orderA = a.order !== undefined ? a.order : 999;
            const orderB = b.order !== undefined ? b.order : 999;
            if (orderA !== orderB) return orderA - orderB;
            return a.name.localeCompare(b.name);
        });
        sortedWorkspaces.forEach(workspace => {
            const item = document.createElement('div');
            item.className = `workspace-dropdown-item ${workspace.id === currentWorkspaceId ? 'active' : ''}`;
            
            const name = document.createElement('span');
            name.className = 'workspace-dropdown-item-name';
            name.textContent = workspace.name;
            
            const count = document.createElement('span');
            count.className = 'workspace-dropdown-item-count';
            count.textContent = `${getWorkspaceTabCount(workspace.id)} list${getWorkspaceTabCount(workspace.id) !== 1 ? 's' : ''}`;
            
            item.appendChild(name);
            item.appendChild(count);
            
            item.onclick = () => {
                switchWorkspace(workspace.id);
                toggleWorkspaceDropdown(false);
            };
            
            // Drag and drop handlers for workspace items
            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                item.classList.add('drag-over');
            });
            
            item.addEventListener('dragleave', () => {
                item.classList.remove('drag-over');
            });
            
            item.addEventListener('drop', (e) => {
                e.preventDefault();
                item.classList.remove('drag-over');
                
                if (draggedTabId && workspace.id !== currentWorkspaceId) {
                    moveTabToWorkspace(draggedTabId, workspace.id);
                }
            });
            
            workspaceDropdownMenu.appendChild(item);
        });
    }
    
    // Update workspace tags display
    workspaceTags.innerHTML = '';
    if (currentWorkspace && currentWorkspace.tags.length > 0) {
        currentWorkspace.tags.forEach(tag => {
            const tagEl = document.createElement('span');
            tagEl.className = 'workspace-tag';
            tagEl.textContent = '#' + tag;
            workspaceTags.appendChild(tagEl);
        });
    }
}

function toggleWorkspaceDropdown(show) {
    if (!workspaceDropdownMenu || !workspaceDropdownBtn) return;
    
    const isOpen = !workspaceDropdownMenu.classList.contains('hidden');
    const shouldOpen = show !== undefined ? show : !isOpen;
    
    if (shouldOpen) {
        workspaceDropdownMenu.classList.remove('hidden');
        workspaceDropdownBtn.classList.add('active');
    } else {
        workspaceDropdownMenu.classList.add('hidden');
        workspaceDropdownBtn.classList.remove('active');
    }
}

function getWorkspaceTabCount(workspaceId) {
    const tabsKey = `multiCheckTabs_${workspaceId}`;
    const tabsData = localStorage.getItem(tabsKey);
    if (!tabsData) return 0;
    
    try {
        const tabs = JSON.parse(tabsData);
        return tabs ? tabs.length : 0;
    } catch {
        return 0;
    }
}

function getWorkspaceStorageUsage(workspaceId) {
    let totalBytes = 0;
    
    // Calculate storage for all workspace-specific keys
    Object.keys(localStorage).forEach(key => {
        if (key.endsWith(`_${workspaceId}`)) {
            const value = localStorage.getItem(key);
            if (value) {
                totalBytes += key.length + value.length;
            }
        }
    });
    
    return totalBytes;
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function createTabGroup(name, color = '#6366f1') {
    const group = {
        id: 'group-' + Date.now(),
        name: name,
        color: color,
        collapsed: false
    };
    tabGroups.push(group);
    saveTabGroups();
    return group;
}

function deleteTabGroup(groupId) {
    // Remove tabs from this group
    tabs.forEach(tab => {
        if (tab.groupId === groupId) {
            tab.groupId = null;
        }
    });
    saveState();
    
    // Remove the group
    tabGroups = tabGroups.filter(g => g.id !== groupId);
    saveTabGroups();
    renderTabs();
}

function saveTabGroups() {
    localStorage.setItem(getWorkspaceStorageKey('multiCheckTabGroups'), JSON.stringify(tabGroups));
}

function getTabGroupById(groupId) {
    return tabGroups.find(g => g.id === groupId);
}

function toggleTabGroupCollapse(groupId) {
    const group = getTabGroupById(groupId);
    if (group) {
        group.collapsed = !group.collapsed;
        saveTabGroups();
        renderTabs();
    }
}

function addTabToGroup(tabId, groupId) {
    const tab = getTabById(tabId);
    if (!tab) return;
    
    tab.groupId = groupId;
    saveState();
    renderTabs();
}

function removeTabFromGroup(tabId) {
    const tab = getTabById(tabId);
    if (!tab) return;
    
    tab.groupId = null;
    saveState();
    renderTabs();
}

function populateTabGroupSubmenu(tabId) {
    if (!tabGroupSubmenu) return;
    
    tabGroupSubmenu.innerHTML = '';
    
    // Add "No Group" option
    const noGroupItem = document.createElement('button');
    noGroupItem.className = 'context-submenu-item';
    noGroupItem.textContent = 'Remove from Group';
    noGroupItem.onclick = (e) => {
        e.stopPropagation();
        removeTabFromGroup(tabId);
        hideAllContextMenus();
    };
    tabGroupSubmenu.appendChild(noGroupItem);
    
    // Add divider
    const divider = document.createElement('div');
    divider.className = 'context-menu-divider';
    tabGroupSubmenu.appendChild(divider);
    
    // Add existing groups
    tabGroups.forEach(group => {
        const item = document.createElement('button');
        item.className = 'context-submenu-item';
        item.innerHTML = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${group.color};margin-right:8px;"></span>${group.name}`;
        
        item.onclick = (e) => {
            e.stopPropagation();
            addTabToGroup(tabId, group.id);
            hideAllContextMenus();
        };
        
        tabGroupSubmenu.appendChild(item);
    });
    
    // Add "Create New Group" option
    const createGroupItem = document.createElement('button');
    createGroupItem.className = 'context-submenu-item';
    createGroupItem.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" style="margin-right:8px;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>Create New Group';
    createGroupItem.onclick = (e) => {
        e.stopPropagation();
        openCreateGroupModal(tabId);
        hideAllContextMenus();
    };
    
    const divider2 = document.createElement('div');
    divider2.className = 'context-menu-divider';
    tabGroupSubmenu.appendChild(divider2);
    tabGroupSubmenu.appendChild(createGroupItem);
}

function openCreateGroupModal(tabId) {
    tabToAddToGroup = tabId;
    groupNameInput.value = '';
    selectedGroupColor = '#6366f1';
    populateGroupColorPicker();
    createGroupModal.classList.remove('hidden');
    groupNameInput.focus();
}

function closeCreateGroupModal() {
    createGroupModal.classList.add('hidden');
    tabToAddToGroup = null;
}

function populateGroupColorPicker() {
    if (!groupColorPicker) return;
    
    groupColorPicker.innerHTML = '';
    
    const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6'];
    
    colors.forEach(color => {
        const colorOption = document.createElement('div');
        colorOption.className = 'group-color-option';
        colorOption.style.backgroundColor = color;
        if (color === selectedGroupColor) {
            colorOption.classList.add('selected');
        }
        
        colorOption.onclick = () => {
            selectedGroupColor = color;
            document.querySelectorAll('.group-color-option').forEach(opt => opt.classList.remove('selected'));
            colorOption.classList.add('selected');
        };
        
        groupColorPicker.appendChild(colorOption);
    });
}

function saveCreateGroup() {
    const groupName = groupNameInput.value.trim();
    if (!groupName) {
        groupNameInput.focus();
        return;
    }
    
    if (editingGroupId) {
        // Editing existing group
        const group = getTabGroupById(editingGroupId);
        if (group) {
            group.name = groupName;
            group.color = selectedGroupColor;
            saveTabGroups();
            renderTabs();
        }
        editingGroupId = null;
    } else {
        // Creating new group
        const newGroup = createTabGroup(groupName, selectedGroupColor);
        if (tabToAddToGroup) {
            addTabToGroup(tabToAddToGroup, newGroup.id);
        }
    }
    
    closeCreateGroupModal();
    renderGroupsList();
}

function renderGroupsList() {
    if (!groupsList) return;
    
    groupsList.innerHTML = '';
    
    if (tabGroups.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.style.textAlign = 'center';
        emptyState.style.padding = '20px';
        emptyState.style.color = 'var(--text-muted)';
        emptyState.textContent = 'No groups yet. Create one to organize your tabs.';
        groupsList.appendChild(emptyState);
        return;
    }
    
    tabGroups.forEach((group, index) => {
        const tabCount = tabs.filter(t => t.groupId === group.id).length;
        
        // Calculate storage for this group
        let groupStorage = 0;
        tabs.filter(t => t.groupId === group.id).forEach(tab => {
            groupStorage += JSON.stringify(tab).length;
        });
        
        // Get last used time
        const groupTabs = tabs.filter(t => t.groupId === group.id);
        const lastUsed = groupTabs.length > 0 ? Math.max(...groupTabs.map(t => t.lastEdited)) : null;
        
        const item = document.createElement('div');
        item.className = 'group-management-item';
        item.dataset.groupId = group.id;
        item.dataset.index = index;
        item.draggable = true;
        
        const info = document.createElement('div');
        info.className = 'group-management-info';
        info.style.display = 'flex';
        info.style.alignItems = 'flex-start';
        info.style.gap = '8px';

        const dragHandle = document.createElement('div');
        dragHandle.className = 'group-drag-handle';
        dragHandle.textContent = '::';
        dragHandle.style.cursor = 'grab';
        dragHandle.style.color = 'var(--text-muted)';
        dragHandle.style.fontSize = '14px';
        dragHandle.style.fontWeight = 'bold';
        dragHandle.style.userSelect = 'none';
        dragHandle.style.paddingTop = '2px';
        info.appendChild(dragHandle);

        const content = document.createElement('div');
        content.style.flex = '1';
        content.style.display = 'flex';
        content.style.flexDirection = 'column';
        content.style.gap = '6px';

        const nameRow = document.createElement('div');
        nameRow.style.display = 'flex';
        nameRow.style.alignItems = 'center';
        nameRow.style.gap = '8px';

        const colorDot = document.createElement('div');
        colorDot.className = 'group-color-dot';
        colorDot.style.backgroundColor = group.color;

        if (inlineRenamingGroupId === group.id) {
            const nameInput = document.createElement('input');
            nameInput.className = 'tab-name-input';
            nameInput.value = group.name;
            nameInput.style.flex = '1';
            nameInput.addEventListener('click', (e) => e.stopPropagation());
            nameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') finishInlineGroupRename(group.id, nameInput.value, true);
                if (e.key === 'Escape') finishInlineGroupRename(group.id, group.name, false);
            });
            nameInput.addEventListener('blur', () => finishInlineGroupRename(group.id, nameInput.value, true));
            nameRow.appendChild(colorDot);
            nameRow.appendChild(nameInput);
            requestAnimationFrame(() => {
                nameInput.focus();
                nameInput.select();
            });
        } else {
            const nameDisplay = document.createElement('span');
            nameDisplay.className = 'group-name-display';
            nameDisplay.textContent = group.name;
            nameRow.appendChild(colorDot);
            nameRow.appendChild(nameDisplay);
        }

        content.appendChild(nameRow);

        const badgesRow = document.createElement('div');
        badgesRow.style.display = 'flex';
        badgesRow.style.flexWrap = 'wrap';
        badgesRow.style.gap = '6px';

        const tabCountBadge = document.createElement('span');
        tabCountBadge.className = 'group-tab-count';
        tabCountBadge.textContent = `${tabCount} tab${tabCount !== 1 ? 's' : ''}`;

        const storageBadge = document.createElement('span');
        storageBadge.className = 'group-tab-count';
        storageBadge.style.background = 'rgba(16, 185, 129, 0.1)';
        storageBadge.style.color = '#10b981';
        storageBadge.textContent = formatBytes(groupStorage);

        const lastUsedBadge = document.createElement('span');
        lastUsedBadge.className = 'group-tab-count';
        lastUsedBadge.style.background = 'rgba(245, 158, 11, 0.1)';
        lastUsedBadge.style.color = '#f59e0b';
        lastUsedBadge.textContent = lastUsed ? timeAgo(lastUsed) : 'Never';

        badgesRow.appendChild(tabCountBadge);
        badgesRow.appendChild(storageBadge);
        badgesRow.appendChild(lastUsedBadge);
        content.appendChild(badgesRow);
        info.appendChild(content);
        
        const actions = document.createElement('div');
        actions.className = 'group-management-actions';
        
        const renameBtn = document.createElement('button');
        renameBtn.className = 'icon-btn';
        renameBtn.title = 'Rename group';
        renameBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>';
        renameBtn.onclick = (e) => {
            e.stopPropagation();
            startInlineGroupRename(group.id);
        };
        
        const colorBtn = document.createElement('button');
        colorBtn.className = 'icon-btn';
        colorBtn.title = 'Change color';
        colorBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"></circle></svg>';
        colorBtn.onclick = () => openGroupColorModal(group.id);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'icon-btn delete';
        deleteBtn.title = 'Delete group';
        deleteBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
        deleteBtn.onclick = () => {
            showConfirm('Delete Group', `Delete "${group.name}"? Tabs will be ungrouped.`, () => {
                const groupItem = groupsList.querySelector(`[data-group-id="${group.id}"]`);
                if (groupItem) {
                    groupItem.classList.add('deleting');
                    setTimeout(() => {
                        deleteTabGroup(group.id);
                        renderGroupsList();
                    }, 500);
                } else {
                    deleteTabGroup(group.id);
                    renderGroupsList();
                }
            });
        };
        
        actions.appendChild(renameBtn);
        actions.appendChild(colorBtn);
        actions.appendChild(deleteBtn);
        
        item.appendChild(info);
        item.appendChild(actions);
        
        // Drag events
        item.addEventListener('dragstart', (e) => {
            item.classList.add('dragging');
            e.dataTransfer.setData('text/plain', index);
            e.dataTransfer.effectAllowed = 'move';
        });
        
        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            document.querySelectorAll('.group-management-item').forEach(i => i.classList.remove('drag-over'));
        });
        
        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (!item.classList.contains('dragging')) {
                item.classList.add('drag-over');
            }
        });
        
        item.addEventListener('dragleave', () => {
            item.classList.remove('drag-over');
        });
        
        item.addEventListener('drop', (e) => {
            e.preventDefault();
            const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
            const toIndex = index;
            
            if (fromIndex !== toIndex) {
                // Reorder array
                const [movedGroup] = tabGroups.splice(fromIndex, 1);
                tabGroups.splice(toIndex, 0, movedGroup);
                saveTabGroups();
                renderGroupsList();
            }
            
            item.classList.remove('drag-over');
        });
        
        groupsList.appendChild(item);
    });
}

function startInlineGroupRename(groupId) {
    inlineRenamingGroupId = groupId;
    renderGroupsList();
}

function finishInlineGroupRename(groupId, newName, save) {
    if (save && newName.trim()) {
        const group = getTabGroupById(groupId);
        if (group) {
            group.name = newName.trim();
            saveTabGroups();
            renderTabs();
        }
    }
    inlineRenamingGroupId = null;
    renderGroupsList();
}

function openGroupColorModal(groupId) {
    const group = getTabGroupById(groupId);
    if (!group) return;
    
    editingGroupId = groupId;
    selectedGroupColor = group.color;
    populateGroupColorPicker();
    createGroupModal.classList.remove('hidden');
    groupNameInput.value = group.name;
    groupNameInput.focus();
}

function startEditGroupColor(groupId) {
    const group = getTabGroupById(groupId);
    if (!group) return;
    
    editingGroupId = groupId;
    const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6'];
    const currentIndex = colors.indexOf(group.color);
    const nextIndex = (currentIndex + 1) % colors.length;
    group.color = colors[nextIndex];
    saveTabGroups();
    renderGroupsList();
    renderTabs();
    editingGroupId = null;
}

function switchModalTab(tabName) {
    if (tabName === 'workspaces') {
        workspaceTabBtn.classList.add('active');
        groupsTabBtn.classList.remove('active');
        archiveTabBtn.classList.remove('active');
        workspacesTabContent.classList.remove('hidden');
        groupsTabContent.classList.add('hidden');
        archiveTabContent.classList.add('hidden');
    } else if (tabName === 'groups') {
        workspaceTabBtn.classList.remove('active');
        groupsTabBtn.classList.add('active');
        archiveTabBtn.classList.remove('active');
        workspacesTabContent.classList.add('hidden');
        groupsTabContent.classList.remove('hidden');
        archiveTabContent.classList.add('hidden');
        renderGroupsList();
    } else if (tabName === 'archive') {
        workspaceTabBtn.classList.remove('active');
        groupsTabBtn.classList.remove('active');
        archiveTabBtn.classList.add('active');
        workspacesTabContent.classList.add('hidden');
        groupsTabContent.classList.add('hidden');
        archiveTabContent.classList.remove('hidden');
        renderArchiveList();
    }
}

function renderArchiveList() {
    if (!archiveList) return;
    
    archiveList.innerHTML = '';
    
    // Calculate total storage
    let totalStorage = 0;
    archivedWorkspaces.forEach(archived => {
        Object.keys(archived.data).forEach(key => {
            totalStorage += key.length + archived.data[key].length;
        });
    });
    archivedItems.forEach(item => {
        totalStorage += JSON.stringify(item).length;
    });
    
    // Show storage header
    const storageHeader = document.createElement('div');
    storageHeader.style.padding = '10px 12px';
    storageHeader.style.marginBottom = '12px';
    storageHeader.style.background = 'rgba(99, 102, 241, 0.1)';
    storageHeader.style.borderRadius = '8px';
    storageHeader.style.fontSize = '0.85rem';
    storageHeader.style.color = 'var(--primary-color)';
    storageHeader.textContent = `Total Archived Storage: ${formatBytes(totalStorage)}`;
    archiveList.appendChild(storageHeader);
    
    if (archivedWorkspaces.length === 0 && archivedItems.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.style.textAlign = 'center';
        emptyState.style.padding = '20px';
        emptyState.style.color = 'var(--text-muted)';
        emptyState.textContent = 'No archived items yet.';
        archiveList.appendChild(emptyState);
        return;
    }
    
    // Render archived workspaces
    archivedWorkspaces.forEach(archived => {
        const item = document.createElement('div');
        item.className = 'workspace-item';
        item.dataset.archiveId = archived.id;
        
        const info = document.createElement('div');
        info.className = 'workspace-item-info';
        
        const name = document.createElement('div');
        name.className = 'workspace-item-name';
        name.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" style="margin-right:6px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>${archived.name}`;
        
        const meta = document.createElement('div');
        meta.className = 'workspace-item-meta';
        
        const type = document.createElement('span');
        type.className = 'workspace-item-tag';
        type.style.background = 'rgba(99, 102, 241, 0.1)';
        type.style.color = 'var(--primary-color)';
        type.textContent = 'Workspace';
        
        const date = document.createElement('span');
        date.className = 'workspace-item-tag';
        date.textContent = `Archived: ${new Date(archived.archivedAt).toLocaleDateString()}`;
        
        const note = document.createElement('span');
        note.className = 'workspace-item-tag';
        note.textContent = archived.note || 'No note';
        
        meta.appendChild(type);
        meta.appendChild(date);
        meta.appendChild(note);
        
        info.appendChild(name);
        info.appendChild(meta);
        
        const actions = document.createElement('div');
        actions.className = 'workspace-item-actions';
        
        const restoreBtn = document.createElement('button');
        restoreBtn.className = 'icon-btn';
        restoreBtn.title = 'Restore workspace';
        restoreBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>';
        restoreBtn.onclick = () => restoreArchivedWorkspace(archived.id);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'icon-btn delete';
        deleteBtn.title = 'Permanently delete';
        deleteBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
        deleteBtn.onclick = () => {
            showConfirm('Permanently Delete', `Delete "${archived.name}" permanently? This cannot be undone.`, () => {
                permanentlyDeleteArchivedWorkspace(archived.id);
            }, true);
        };
        
        actions.appendChild(restoreBtn);
        actions.appendChild(deleteBtn);
        
        item.appendChild(info);
        item.appendChild(actions);
        archiveList.appendChild(item);
    });
    
    // Render archived tabs
    archivedItems.forEach(archived => {
        const item = document.createElement('div');
        item.className = 'workspace-item';
        item.dataset.archiveId = archived.id;
        
        const info = document.createElement('div');
        info.className = 'workspace-item-info';
        
        const name = document.createElement('div');
        name.className = 'workspace-item-name';
        name.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" style="margin-right:6px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>${archived.name}`;
        
        const meta = document.createElement('div');
        meta.className = 'workspace-item-meta';
        
        const type = document.createElement('span');
        type.className = 'workspace-item-tag';
        type.style.background = 'rgba(239, 68, 68, 0.1)';
        type.style.color = '#ef4444';
        type.textContent = 'Tab';
        
        const workspace = document.createElement('span');
        workspace.className = 'workspace-item-tag';
        workspace.textContent = archived.workspaceName;
        
        const date = document.createElement('span');
        date.className = 'workspace-item-tag';
        date.textContent = `Archived: ${new Date(archived.archivedAt).toLocaleDateString()}`;
        
        const note = document.createElement('span');
        note.className = 'workspace-item-tag';
        note.textContent = archived.note || 'No note';
        
        meta.appendChild(type);
        meta.appendChild(workspace);
        meta.appendChild(date);
        meta.appendChild(note);
        
        info.appendChild(name);
        info.appendChild(meta);
        
        const actions = document.createElement('div');
        actions.className = 'workspace-item-actions';

        const previewBtn = document.createElement('button');
        previewBtn.className = 'icon-btn';
        previewBtn.title = 'Preview tab';
        previewBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
        previewBtn.onclick = () => previewArchivedTab(archived);

        const restoreBtn = document.createElement('button');
        restoreBtn.className = 'icon-btn';
        restoreBtn.title = 'Restore tab';
        restoreBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>';
        restoreBtn.onclick = () => restoreArchivedTab(archived.id);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'icon-btn delete';
        deleteBtn.title = 'Permanently delete';
        deleteBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
        deleteBtn.onclick = () => {
            showConfirm('Permanently Delete', `Delete "${archived.name}" permanently? This cannot be undone.`, () => {
                permanentlyDeleteArchivedTab(archived.id);
            }, true);
        };

        actions.appendChild(previewBtn);
        actions.appendChild(restoreBtn);
        actions.appendChild(deleteBtn);
        
        item.appendChild(info);
        item.appendChild(actions);
        archiveList.appendChild(item);
    });
}

function previewArchivedTab(archivedTab) {
    const previewModal = document.createElement('div');
    previewModal.className = 'modal';
    previewModal.style.zIndex = '2000';

    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content glass';
    modalContent.style.width = '600px';
    modalContent.style.maxHeight = '80vh';
    modalContent.style.overflowY = 'auto';

    const header = document.createElement('h3');
    header.textContent = `Preview: ${archivedTab.name}`;
    modalContent.appendChild(header);

    const meta = document.createElement('div');
    meta.style.marginBottom = '16px';
    meta.style.fontSize = '0.85rem';
    meta.style.color = 'var(--text-muted)';
    meta.innerHTML = `
        <div>Workspace: ${archivedTab.workspaceName}</div>
        <div>Archived: ${new Date(archivedTab.archivedAt).toLocaleString()}</div>
        ${archivedTab.note ? `<div>Note: ${archivedTab.note}</div>` : ''}
    `;
    modalContent.appendChild(meta);

    const inputLabel = document.createElement('label');
    inputLabel.style.display = 'block';
    inputLabel.style.marginBottom = '6px';
    inputLabel.style.fontSize = '0.85rem';
    inputLabel.style.color = 'var(--text-muted)';
    inputLabel.textContent = 'Input:';
    modalContent.appendChild(inputLabel);

    const inputArea = document.createElement('textarea');
    inputArea.value = archivedTab.input || '';
    inputArea.readOnly = true;
    inputArea.style.width = '100%';
    inputArea.style.height = '100px';
    inputArea.style.marginBottom = '16px';
    inputArea.style.padding = '8px';
    inputArea.style.borderRadius = '6px';
    inputArea.style.border = '1px solid var(--glass-border)';
    inputArea.style.background = 'rgba(255, 255, 255, 0.05)';
    inputArea.style.color = 'var(--text-main)';
    inputArea.style.fontFamily = 'monospace';
    inputArea.style.fontSize = '0.85rem';
    modalContent.appendChild(inputArea);

    const outputLabel = document.createElement('label');
    outputLabel.style.display = 'block';
    outputLabel.style.marginBottom = '6px';
    outputLabel.style.fontSize = '0.85rem';
    outputLabel.style.color = 'var(--text-muted)';
    outputLabel.textContent = 'Output:';
    modalContent.appendChild(outputLabel);

    const outputArea = document.createElement('textarea');
    outputArea.value = archivedTab.output || '';
    outputArea.readOnly = true;
    outputArea.style.width = '100%';
    outputArea.style.height = '200px';
    outputArea.style.marginBottom = '20px';
    outputArea.style.padding = '8px';
    outputArea.style.borderRadius = '6px';
    outputArea.style.border = '1px solid var(--glass-border)';
    outputArea.style.background = 'rgba(255, 255, 255, 0.05)';
    outputArea.style.color = 'var(--text-main)';
    outputArea.style.fontFamily = 'monospace';
    outputArea.style.fontSize = '0.85rem';
    modalContent.appendChild(outputArea);

    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'secondary-btn';
    closeBtn.textContent = 'Close';
    closeBtn.onclick = () => {
        document.body.removeChild(previewModal);
    };

    const restoreBtn = document.createElement('button');
    restoreBtn.className = 'primary-btn';
    restoreBtn.textContent = 'Restore Tab';
    restoreBtn.onclick = () => {
        restoreArchivedTab(archivedTab.id);
        document.body.removeChild(previewModal);
    };

    actions.appendChild(closeBtn);
    actions.appendChild(restoreBtn);
    modalContent.appendChild(actions);

    previewModal.appendChild(modalContent);
    document.body.appendChild(previewModal);

    previewModal.onclick = (e) => {
        if (e.target === previewModal) {
            document.body.removeChild(previewModal);
        }
    };
}

function archiveWorkspace(workspaceId, note = '') {
    const workspace = workspaces.find(w => w.id === workspaceId);
    if (!workspace) return;
    
    if (workspaceId === 'workspace-default') {
        showAlert('Cannot Archive', 'Cannot archive the default workspace.');
        return;
    }
    
    if (workspaceId === currentWorkspaceId) {
        showAlert('Cannot Archive', 'Cannot archive the workspace you are currently in. Switch to another workspace first.');
        return;
    }
    
    // Collect all workspace data
    const workspaceData = {};
    Object.keys(localStorage).forEach(key => {
        if (key.endsWith(`_${workspaceId}`)) {
            workspaceData[key] = localStorage.getItem(key);
        }
    });
    
    // Create archive entry
    const archive = {
        id: 'archive-' + Date.now(),
        workspaceId: workspace.id,
        name: workspace.name,
        tags: workspace.tags,
        createdAt: workspace.createdAt,
        archivedAt: Date.now(),
        note: note,
        data: workspaceData
    };
    
    archivedWorkspaces.push(archive);
    localStorage.setItem('multiCheckArchivedWorkspaces', JSON.stringify(archivedWorkspaces));
    
    // Remove workspace from active list
    workspaces = workspaces.filter(w => w.id !== workspaceId);
    saveWorkspaces();
    
    // Remove workspace localStorage data
    Object.keys(workspaceData).forEach(key => {
        localStorage.removeItem(key);
    });
    
    renderWorkspaceUI();
    renderWorkspaceList();
    renderArchiveList();
    
    showUndoToast(`Workspace "${workspace.name}" archived`, () => {
        // Undo: restore workspace
        restoreArchivedWorkspace(archive.id, true);
    }, 10000);
}

function restoreArchivedWorkspace(archiveId, isUndo = false) {
    const archive = archivedWorkspaces.find(a => a.id === archiveId);
    if (!archive) return;
    
    // Restore localStorage data
    Object.keys(archive.data).forEach(key => {
        localStorage.setItem(key, archive.data[key]);
    });
    
    // Restore workspace to active list
    const restoredWorkspace = {
        id: archive.workspaceId,
        name: archive.name,
        tags: archive.tags,
        createdAt: archive.createdAt
    };
    
    workspaces.push(restoredWorkspace);
    saveWorkspaces();
    
    // Remove from archive
    archivedWorkspaces = archivedWorkspaces.filter(a => a.id !== archiveId);
    localStorage.setItem('multiCheckArchivedWorkspaces', JSON.stringify(archivedWorkspaces));
    
    renderWorkspaceUI();
    renderWorkspaceList();
    renderArchiveList();
    
    if (!isUndo) {
        showUndoToast(`Workspace "${archive.name}" restored`, () => {
            // Undo: re-archive
            archiveWorkspace(restoredWorkspace.id, archive.note);
        }, 10000);
    }
}

function permanentlyDeleteArchivedWorkspace(archiveId) {
    const archive = archivedWorkspaces.find(a => a.id === archiveId);
    if (!archive) return;
    
    // Permanently delete the archived data
    Object.keys(archive.data).forEach(key => {
        localStorage.removeItem(key);
    });
    
    // Remove from archive
    archivedWorkspaces = archivedWorkspaces.filter(a => a.id !== archiveId);
    localStorage.setItem('multiCheckArchivedWorkspaces', JSON.stringify(archivedWorkspaces));
    
    renderArchiveList();
}

function openArchiveModal(type, id, name) {
    archiveTargetType = type;
    archiveTargetId = id;
    archiveModalTitle.textContent = type === 'workspace' ? `Archive Workspace: ${name}` : `Archive Tab: ${name}`;
    archiveNoteInput.value = '';
    archiveModal.classList.remove('hidden');
    archiveNoteInput.focus();
}

function closeArchiveModal() {
    archiveModal.classList.add('hidden');
    archiveTargetType = null;
    archiveTargetId = null;
    archiveNoteInput.value = '';
}

function saveArchive() {
    const note = archiveNoteInput.value.trim();
    
    if (archiveTargetType === 'workspace') {
        archiveWorkspace(archiveTargetId, note);
    } else if (archiveTargetType === 'tab') {
        archiveTab(archiveTargetId, note);
    }
    
    closeArchiveModal();
    renderArchiveList();
}

function archiveTab(tabId, note = '') {
    const tab = getTabById(tabId);
    if (!tab) {
        console.error('Tab not found:', tabId);
        return;
    }
    
    const workspace = workspaces.find(w => w.id === currentWorkspaceId);
    
    // Create archive entry
    const archive = {
        id: 'archive-tab-' + Date.now(),
        tabId: tab.id,
        name: tab.name,
        input: tab.input,
        output: tab.output,
        pinned: tab.pinned,
        lastEdited: tab.lastEdited,
        groupId: tab.groupId,
        workspaceId: currentWorkspaceId,
        workspaceName: workspace ? workspace.name : 'Unknown',
        archivedAt: Date.now(),
        note: note
    };
    
    archivedItems.push(archive);
    localStorage.setItem('multiCheckArchivedItems', JSON.stringify(archivedItems));
    
    // Remove tab from current workspace
    tabs = tabs.filter(t => t.id !== tabId);
    
    // Set active tab to another if needed
    if (activeTabId === tabId) {
        activeTabId = tabs[0] ? tabs[0].id : null;
    }
    
    saveState();
    renderTabs();
    
    showUndoToast(`Tab "${tab.name}" archived`, () => {
        // Undo: restore tab
        restoreArchivedTab(archive.id, true);
    }, 10000);
}

function restoreArchivedTab(archiveId, isUndo = false) {
    const archive = archivedItems.find(a => a.id === archiveId);
    if (!archive) return;
    
    // Check if workspace still exists
    const workspace = workspaces.find(w => w.id === archive.workspaceId);
    if (!workspace) {
        showAlert('Cannot Restore', 'The original workspace no longer exists. The tab will be restored to the current workspace.');
        archive.workspaceId = currentWorkspaceId;
    }
    
    // Switch to the workspace if it exists
    if (workspace && workspace.id !== currentWorkspaceId) {
        switchWorkspace(workspace.id);
    }
    
    // Restore tab
    const restoredTab = {
        id: archive.tabId,
        name: archive.name,
        input: archive.input,
        output: archive.output,
        pinned: archive.pinned,
        lastEdited: archive.lastEdited,
        groupId: archive.groupId
    };
    
    tabs.push(restoredTab);
    activeTabId = restoredTab.id;
    saveState();
    renderTabs();
    
    // Remove from archive
    archivedItems = archivedItems.filter(a => a.id !== archiveId);
    localStorage.setItem('multiCheckArchivedItems', JSON.stringify(archivedItems));
    
    renderArchiveList();
    
    if (!isUndo) {
        showUndoToast(`Tab "${archive.name}" restored`, () => {
            // Undo: re-archive
            archiveTab(restoredTab.id, archive.note);
        }, 10000);
    }
}

function permanentlyDeleteArchivedTab(archiveId) {
    const archive = archivedItems.find(a => a.id === archiveId);
    if (!archive) return;
    
    // Remove from archive
    archivedItems = archivedItems.filter(a => a.id !== archiveId);
    localStorage.setItem('multiCheckArchivedItems', JSON.stringify(archivedItems));
    
    renderArchiveList();
}

function renderWorkspaceList() {
    const workspaceList = document.getElementById('workspace-list');
    if (!workspaceList) return;

    workspaceList.innerHTML = '';

    // Sort workspaces: pinned first, then by order index, then by name
    const sortedWorkspaces = [...workspaces].sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        const orderA = a.order !== undefined ? a.order : 999;
        const orderB = b.order !== undefined ? b.order : 999;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
    });

    sortedWorkspaces.forEach((workspace, index) => {
        const item = document.createElement('div');
        item.className = `workspace-item ${workspace.id === currentWorkspaceId ? 'active' : ''} ${workspace.pinned ? 'pinned' : ''}`;
        item.dataset.workspaceId = workspace.id;
        item.dataset.index = index;
        item.draggable = true;
        
        const info = document.createElement('div');
        info.className = 'workspace-item-info';
        info.style.display = 'flex';
        info.style.alignItems = 'flex-start';
        info.style.gap = '8px';

        const dragHandle = document.createElement('div');
        dragHandle.className = 'workspace-drag-handle';
        dragHandle.textContent = '::';
        dragHandle.style.cursor = 'grab';
        dragHandle.style.color = 'var(--text-muted)';
        dragHandle.style.fontSize = '14px';
        dragHandle.style.fontWeight = 'bold';
        dragHandle.style.userSelect = 'none';
        dragHandle.style.paddingTop = '2px';
        info.appendChild(dragHandle);

        const content = document.createElement('div');
        content.style.flex = '1';

        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.marginBottom = '4px';
        
        if (inlineRenamingWorkspaceId === workspace.id) {
            const nameInput = document.createElement('input');
            nameInput.className = 'tab-name-input';
            nameInput.value = workspace.name;
            nameInput.style.flex = '1';
            nameInput.style.marginRight = '8px';
            nameInput.addEventListener('click', (e) => e.stopPropagation());
            nameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') finishInlineWorkspaceRename(workspace.id, nameInput.value, true);
                if (e.key === 'Escape') finishInlineWorkspaceRename(workspace.id, workspace.name, false);
            });
            nameInput.addEventListener('blur', () => finishInlineWorkspaceRename(workspace.id, nameInput.value, true));
            header.appendChild(nameInput);
            requestAnimationFrame(() => {
                nameInput.focus();
                nameInput.select();
            });
        } else {
            const nameContainer = document.createElement('div');
            nameContainer.style.display = 'flex';
            nameContainer.style.alignItems = 'center';
            nameContainer.style.gap = '8px';
            
            const name = document.createElement('div');
            name.className = 'workspace-item-name';
            name.textContent = workspace.name;
            nameContainer.appendChild(name);
            
            // Add active indicator
            if (workspace.id === currentWorkspaceId) {
                const activeIndicator = document.createElement('span');
                activeIndicator.className = 'workspace-active-indicator';
                activeIndicator.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="3" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg>';
                activeIndicator.title = 'Current workspace';
                nameContainer.appendChild(activeIndicator);
            }
            
            header.appendChild(nameContainer);
        }
        
        const tabCount = document.createElement('span');
        tabCount.className = 'workspace-item-tag';
        tabCount.style.background = 'rgba(52, 211, 153, 0.15)';
        tabCount.style.color = '#34d399';
        tabCount.textContent = `${getWorkspaceTabCount(workspace.id)} list${getWorkspaceTabCount(workspace.id) !== 1 ? 's' : ''}`;
        
        header.appendChild(tabCount);
        
        const storageUsage = document.createElement('span');
        storageUsage.className = 'workspace-item-tag';
        storageUsage.style.background = 'rgba(99, 102, 241, 0.15)';
        storageUsage.style.color = 'var(--primary-color)';
        storageUsage.style.fontSize = '0.7rem';
        storageUsage.textContent = formatBytes(getWorkspaceStorageUsage(workspace.id));
        
        header.appendChild(storageUsage);
        
        const tags = document.createElement('div');
        tags.className = 'workspace-item-tags';
        workspace.tags.forEach(tag => {
            const tagEl = document.createElement('span');
            tagEl.className = 'workspace-item-tag';
            tagEl.textContent = '#' + tag;
            tags.appendChild(tagEl);
        });

        content.appendChild(header);
        content.appendChild(tags);
        info.appendChild(content);
        
        const actions = document.createElement('div');
        actions.className = 'workspace-item-actions';
        
        const pinBtn = document.createElement('button');
        pinBtn.className = 'icon-btn';
        pinBtn.title = workspace.pinned ? 'Unpin workspace' : 'Pin workspace';
        pinBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 17v5"></path><path d="M5 3h14l-3 7v3l-4-2-4 2v-3L5 3z"></path></svg>';
        if (workspace.pinned) {
            pinBtn.style.color = '#fbbf24';
        }
        pinBtn.onclick = (e) => {
            e.stopPropagation();
            toggleWorkspacePin(workspace.id);
        };
        actions.appendChild(pinBtn);
        
        const renameBtn = document.createElement('button');
        renameBtn.className = 'icon-btn';
        renameBtn.title = 'Rename workspace';
        renameBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>';
        renameBtn.onclick = (e) => {
            e.stopPropagation();
            startInlineWorkspaceRename(workspace.id);
        };
        actions.appendChild(renameBtn);
        
        if (workspace.id !== 'workspace-default') {
            const archiveBtn = document.createElement('button');
            archiveBtn.className = 'icon-btn';
            archiveBtn.title = 'Archive workspace';
            archiveBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="15" height="13"></rect><polyline points="10 12 15 12 15 7"></polyline></svg>';
            archiveBtn.onclick = (e) => {
                e.stopPropagation();
                openArchiveModal('workspace', workspace.id, workspace.name);
            };
            actions.appendChild(archiveBtn);
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'icon-btn delete';
            deleteBtn.title = 'Delete workspace';
            deleteBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                showConfirm('Delete Workspace', `Are you sure you want to delete "${workspace.name}"? All data in this workspace will be permanently lost.`, () => {
                    deleteWorkspace(workspace.id);
                }, true);
            };
            actions.appendChild(deleteBtn);
        }
        
        item.appendChild(info);
        item.appendChild(actions);

        item.onclick = (e) => {
            if (e.target.closest('.workspace-item-actions')) return;
            switchWorkspace(workspace.id);
        };

        // Drag and drop functionality
        item.addEventListener('dragstart', (e) => {
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });

        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            document.querySelectorAll('.workspace-item').forEach(el => {
                el.classList.remove('drag-over');
            });
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            const dragging = document.querySelector('.workspace-item.dragging');
            if (dragging !== item) {
                item.classList.add('drag-over');
            }
        });

        item.addEventListener('dragleave', () => {
            item.classList.remove('drag-over');
        });

        item.addEventListener('drop', (e) => {
            e.preventDefault();
            item.classList.remove('drag-over');
            const dragging = document.querySelector('.workspace-item.dragging');
            if (dragging && dragging !== item) {
                const draggedId = dragging.dataset.workspaceId;
                const targetId = item.dataset.workspaceId;
                const draggedIndex = workspaces.findIndex(w => w.id === draggedId);
                const targetIndex = workspaces.findIndex(w => w.id === targetId);

                if (draggedIndex !== -1 && targetIndex !== -1) {
                    // Remove dragged workspace and insert at target position
                    const [draggedWorkspace] = workspaces.splice(draggedIndex, 1);
                    workspaces.splice(targetIndex, 0, draggedWorkspace);

                    // Update order indices
                    workspaces.forEach((w, i) => {
                        if (w.pinned) {
                            w.order = 0;
                        } else {
                            w.order = i;
                        }
                    });

                    saveWorkspaces();
                    renderWorkspaceList();
                    renderWorkspaceUI();
                }
            }
        });

        // Right-click context menu for workspace
        item.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            contextMenuTargetWorkspaceId = workspace.id;
            populateWorkspaceCopySubmenu(workspace.id);
            showContextMenu(workspaceContextMenu, e.clientX, e.clientY);
        });
        
        workspaceList.appendChild(item);
    });
}

function toggleWorkspacePin(workspaceId) {
    const workspace = workspaces.find(w => w.id === workspaceId);
    if (!workspace) return;
    
    workspace.pinned = !workspace.pinned;
    saveWorkspaces();
    renderWorkspaceList();
    renderWorkspaceUI();
}

let tabs = normalizeTabs(JSON.parse(localStorage.getItem(getWorkspaceStorageKey('multiCheckTabs'))) || [
    { id: 'tab-' + Date.now(), name: 'Main List', input: '', output: '' }
]);
let activeTabId = localStorage.getItem(getWorkspaceStorageKey('multiCheckActiveTab')) || (tabs[0] ? tabs[0].id : null);

const tabListEl = document.getElementById('tab-list');
const addTabBtn = document.getElementById('add-tab-btn');
const dashboardBtn = document.getElementById('dashboard-btn');
const currentTabTitle = document.getElementById('current-tab-title');
const workspaceDropdownBtn = document.getElementById('workspace-dropdown-btn');
const workspaceDropdownLabel = document.getElementById('workspace-dropdown-label');
const workspaceDropdownMenu = document.getElementById('workspace-dropdown-menu');
const workspaceTags = document.getElementById('workspace-tags');
const manageWorkspacesBtn = document.getElementById('manage-workspaces-btn');
const tabContextMenu = document.getElementById('tab-context-menu');
const workspaceContextMenu = document.getElementById('workspace-context-menu');
const workspaceCopySubmenu = document.getElementById('workspace-copy-submenu');
const tabCopySubmenu = document.getElementById('tab-copy-submenu');
const tabGroupSubmenu = document.getElementById('tab-group-submenu');
const createGroupModal = document.getElementById('create-group-modal');
const groupNameInput = document.getElementById('group-name-input');
const groupColorPicker = document.getElementById('group-color-picker');
const cancelCreateGroupBtn = document.getElementById('cancel-create-group-btn');
const saveCreateGroupBtn = document.getElementById('save-create-group-btn');
const workspaceTabBtn = document.getElementById('workspace-tab-btn');
const groupsTabBtn = document.getElementById('groups-tab-btn');
const workspacesTabContent = document.getElementById('workspaces-tab-content');
const groupsTabContent = document.getElementById('groups-tab-content');
const archiveTabBtn = document.getElementById('archive-tab-btn');
const archiveTabContent = document.getElementById('archive-tab-content');
const archiveList = document.getElementById('archive-list');
const archiveModal = document.getElementById('archive-modal');
const archiveModalTitle = document.getElementById('archive-modal-title');
const archiveNoteInput = document.getElementById('archive-note-input');
const cancelArchiveBtn = document.getElementById('cancel-archive-btn');
const saveArchiveBtn = document.getElementById('save-archive-btn');
const newGroupNameInput = document.getElementById('new-group-name');
const createGroupBtn = document.getElementById('create-group-btn');
const groupsList = document.getElementById('groups-list');
const inputArea = document.getElementById('input-area');
const autoProcessToggle = document.getElementById('auto-process-toggle');
const tagFormatToggle = document.getElementById('tag-format-toggle');
const outputArea = document.getElementById('output-area');
const processBtn = document.getElementById('process-btn');
const copyBtn = document.getElementById('copy-btn');
const editorContainer = document.getElementById('editor-container');
const toggleFullscreenBtn = document.getElementById('toggle-fullscreen-btn');
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const editorThemeBtn = document.getElementById('editor-theme-btn');
const toggleHoverBtn = document.getElementById('toggle-hover-btn');
const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
const hideHeaderBtn = document.getElementById('hide-header-btn');
const showHeaderBtn = document.getElementById('show-header-btn');
const topBar = document.querySelector('.top-bar');
const exportBtn = document.getElementById('export-btn');
const sidebar = document.querySelector('.sidebar');
const revertBtn = document.getElementById('revert-btn');
const inputLines = document.getElementById('input-lines');
const outputLines = document.getElementById('output-lines');
const outputMirror = document.getElementById('output-mirror');
const saveStatusEl = document.getElementById('save-status');
const undoToast = document.getElementById('undo-toast');
const undoToastMessage = document.getElementById('undo-toast-message');
const undoToastBtn = document.getElementById('undo-toast-btn');
const TAB_REORDER_HOLD_MS = 220;
const TAB_REORDER_MOVE_TOLERANCE = 6;

let suppressTabClickUntil = 0;
let tabDragState = null;
let inlineRenamingTabId = null;
let inlineRenamingWorkspaceId = null;
let movedTabHighlightId = null;
let movedTabHighlightTimer = null;
let undoToastTimer = null;
let undoToastAction = null;
let saveStatusTimer = null;
let deletedWorkspaceBackup = null;
let workspaceDeleteTimer = null;
let contextMenuTargetTabId = null;
let contextMenuTargetWorkspaceId = null;
let draggedTabId = null;
let tabGroups = JSON.parse(localStorage.getItem(getWorkspaceStorageKey('multiCheckTabGroups'))) || [];
let selectedGroupColor = '#6366f1';
let tabToAddToGroup = null;
let editingGroupId = null;
let inlineRenamingGroupId = null;
let autoProcessEnabled = false;
let archivedWorkspaces = JSON.parse(localStorage.getItem('multiCheckArchivedWorkspaces')) || [];
let archivedItems = JSON.parse(localStorage.getItem('multiCheckArchivedItems')) || [];
let archiveTargetType = null; // 'workspace' or 'tab'
let archiveTargetId = null;

function normalizeTab(tab) {
    return {
        id: tab?.id || ('tab-' + Date.now()),
        name: (tab?.name || 'New List').trim() || 'New List',
        input: tab?.input || '',
        output: tab?.output || '',
        pinned: Boolean(tab?.pinned),
        lastEdited: typeof tab?.lastEdited === 'number' ? tab.lastEdited : Date.now(),
        groupId: tab?.groupId || null
    };
}

function sortTabsForDisplay(tabItems) {
    return tabItems
        .map((tab, index) => ({ tab, index }))
        .sort((a, b) => {
            if (a.tab.pinned === b.tab.pinned) return a.index - b.index;
            return a.tab.pinned ? -1 : 1;
        })
        .map(entry => entry.tab);
}

function normalizeTabs(tabItems) {
    return sortTabsForDisplay((tabItems || []).map(normalizeTab));
}

function getTabById(tabId) {
    return tabs.find(tab => tab.id === tabId) || null;
}

function createTabSnapshot(tab) {
    return tab ? JSON.parse(JSON.stringify(tab)) : null;
}

function getTabAccountCount(tab) {
    const lines = (tab.output || '').split('\n').filter(line => line.trim());
    let rawAccountCount = 0;
    const uniqueIds = new Set();

    for (const line of lines) {
        if (!line.includes('|')) continue;
        rawAccountCount++;
        const match = line.match(/\|\s*(\d+)/);
        if (match) uniqueIds.add(match[1]);
    }

    return uniqueIds.size > 0 ? uniqueIds.size : rawAccountCount;
}

function formatRelativeTime(timestamp) {
    if (!timestamp) return 'just now';
    const diff = Math.max(0, Date.now() - timestamp);
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (diff < 45 * 1000) return 'just now';
    if (diff < hour) return `${Math.max(1, Math.round(diff / minute))}m ago`;
    if (diff < day) return `${Math.max(1, Math.round(diff / hour))}h ago`;
    return `${Math.max(1, Math.round(diff / day))}d ago`;
}

function setSaveStatus(state, message) {
    if (!saveStatusEl) return;
    clearTimeout(saveStatusTimer);

    const statusMessage = message || (
        state === 'saving' ? 'Saving...' :
            state === 'idle' ? 'No list selected' :
                'Autosaved'
    );

    saveStatusEl.textContent = statusMessage;
    saveStatusEl.dataset.state = state;

    if (state === 'saved') {
        saveStatusTimer = setTimeout(() => {
            if (saveStatusEl.dataset.state === 'saved') {
                saveStatusEl.textContent = 'Autosaved';
            }
        }, 1400);
    }
}

function showUndoToast(message, onUndo, timeout = 6000) {
    if (!undoToast || !undoToastMessage || !undoToastBtn) return;

    clearTimeout(undoToastTimer);
    undoToastAction = typeof onUndo === 'function' ? onUndo : null;
    undoToastMessage.textContent = message;
    undoToast.classList.remove('hidden');
    undoToastTimer = setTimeout(() => {
        hideUndoToast();
    }, timeout);
}

function hideUndoToast() {
    if (!undoToast) return;
    clearTimeout(undoToastTimer);
    undoToast.classList.add('hidden');
    undoToastAction = null;
}

// Context Menu Functions
function showContextMenu(menu, x, y) {
    if (!menu) return;
    
    // Ensure menu stays within viewport
    const menuWidth = 180;
    const menuHeight = menu.offsetHeight || 200;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    if (x + menuWidth > viewportWidth) {
        x = viewportWidth - menuWidth - 10;
    }
    if (y + menuHeight > viewportHeight) {
        y = viewportHeight - menuHeight - 10;
    }
    
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.classList.remove('hidden');
}

function hideAllContextMenus() {
    if (tabContextMenu) tabContextMenu.classList.add('hidden');
    if (workspaceContextMenu) workspaceContextMenu.classList.add('hidden');
    if (workspaceCopySubmenu) workspaceCopySubmenu.classList.add('hidden');
    if (tabCopySubmenu) tabCopySubmenu.classList.add('hidden');
    if (tabGroupSubmenu) tabGroupSubmenu.classList.add('hidden');
    contextMenuTargetTabId = null;
    contextMenuTargetWorkspaceId = null;
}

function duplicateTab(tabId) {
    const tab = getTabById(tabId);
    if (!tab) return;
    
    const newTab = {
        id: 'tab-' + Date.now(),
        name: tab.name + ' (Copy)',
        input: tab.input,
        output: tab.output,
        pinned: false,
        lastEdited: Date.now()
    };
    
    tabs.push(newTab);
    saveState();
    renderTabs();
    switchTab(newTab.id);
}

function exportTab(tabId) {
    const tab = getTabById(tabId);
    if (!tab) return;

    const exportContent = `${tab.name}\n\n${tab.output}`;

    const blob = new Blob([exportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tab.name.replace(/[^a-z0-9]/gi, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    showUndoToast(`Tab "${tab.name}" exported`, null, 3000);
}

function moveTabToWorkspace(tabId, targetWorkspaceId) {
    const tab = getTabById(tabId);
    if (!tab) return;
    
    const tabData = JSON.parse(JSON.stringify(tab));
    
    // Remove tab from current workspace
    const tabIndex = tabs.findIndex(t => t.id === tabId);
    if (tabIndex > -1) {
        tabs.splice(tabIndex, 1);
        saveState();
    }
    
    // Switch to target workspace
    const previousWorkspaceId = currentWorkspaceId;
    switchWorkspace(targetWorkspaceId);
    
    // Add tab to target workspace
    tabs.push(tabData);
    saveState();
    renderTabs();
    
    showUndoToast(`Tab "${tabData.name}" moved to "${getCurrentWorkspace().name}"`, () => {
        // Undo: move back to previous workspace
        const undoTabData = JSON.parse(JSON.stringify(tabData));
        
        // Remove from current workspace
        const undoTabIndex = tabs.findIndex(t => t.id === tabData.id);
        if (undoTabIndex > -1) {
            tabs.splice(undoTabIndex, 1);
            saveState();
        }
        
        // Switch back to previous workspace
        switchWorkspace(previousWorkspaceId);
        
        // Add back to previous workspace
        tabs.push(undoTabData);
        saveState();
        renderTabs();
    }, 10000);
}

function copyWorkspaceToWorkspace(sourceWorkspaceId, targetWorkspaceId) {
    if (sourceWorkspaceId === targetWorkspaceId) return;
    
    const sourceWorkspace = workspaces.find(w => w.id === sourceWorkspaceId);
    const targetWorkspace = workspaces.find(w => w.id === targetWorkspaceId);
    
    if (!sourceWorkspace || !targetWorkspace) return;
    
    // Save current workspace state
    const previousWorkspaceId = currentWorkspaceId;
    
    // Get source workspace tabs
    const sourceTabsKey = `multiCheckTabs_${sourceWorkspaceId}`;
    const sourceTabsData = localStorage.getItem(sourceTabsKey);
    const sourceTabs = sourceTabsData ? JSON.parse(sourceTabsData) : [];
    
    // Switch to target workspace
    switchWorkspace(targetWorkspaceId);
    
    // Copy tabs to target workspace
    sourceTabs.forEach(tab => {
        const newTab = {
            ...tab,
            id: 'tab-' + Date.now() + Math.random().toString(36).substr(2, 9),
            name: tab.name + ' (Copy)',
            lastEdited: Date.now()
        };
        tabs.push(newTab);
    });
    
    saveState();
    renderTabs();
    
    showUndoToast(`Copied ${sourceTabs.length} tabs from "${sourceWorkspace.name}" to "${targetWorkspace.name}"`, () => {
        // Undo: remove the copied tabs
        const copiedTabIds = tabs.slice(-sourceTabs.length).map(t => t.id);
        copiedTabIds.forEach(tabId => {
            const index = tabs.findIndex(t => t.id === tabId);
            if (index > -1) {
                tabs.splice(index, 1);
            }
        });
        saveState();
        renderTabs();
    }, 10000);
}

function populateWorkspaceCopySubmenu(sourceWorkspaceId) {
    if (!workspaceCopySubmenu) return;
    
    workspaceCopySubmenu.innerHTML = '';
    
    workspaces.forEach(workspace => {
        if (workspace.id === sourceWorkspaceId) return; // Skip current workspace
        
        const item = document.createElement('button');
        item.className = 'context-submenu-item';
        item.textContent = workspace.name;
        
        item.onclick = (e) => {
            e.stopPropagation();
            copyWorkspaceToWorkspace(sourceWorkspaceId, workspace.id);
            hideAllContextMenus();
        };
        
        workspaceCopySubmenu.appendChild(item);
    });
    
    // If no other workspaces, show disabled message
    if (workspaceCopySubmenu.children.length === 0) {
        const disabledItem = document.createElement('button');
        disabledItem.className = 'context-submenu-item disabled';
        disabledItem.textContent = 'No other workspaces';
        workspaceCopySubmenu.appendChild(disabledItem);
    }
}

function copyTabToWorkspace(tabId, targetWorkspaceId) {
    if (targetWorkspaceId === currentWorkspaceId) return;
    
    const tab = getTabById(tabId);
    if (!tab) return;
    
    const tabData = JSON.parse(JSON.stringify(tab));
    const previousWorkspaceId = currentWorkspaceId;
    
    // Switch to target workspace
    switchWorkspace(targetWorkspaceId);
    
    // Add tab to target workspace
    tabs.push(tabData);
    saveState();
    renderTabs();
    
    showUndoToast(`Tab "${tabData.name}" copied to "${getCurrentWorkspace().name}"`, () => {
        // Undo: remove the copied tab
        const undoTabIndex = tabs.findIndex(t => t.id === tabData.id);
        if (undoTabIndex > -1) {
            tabs.splice(undoTabIndex, 1);
            saveState();
            renderTabs();
        }
        
        // Switch back to previous workspace
        switchWorkspace(previousWorkspaceId);
    }, 10000);
}

function populateTabCopySubmenu(tabId) {
    if (!tabCopySubmenu) return;
    
    tabCopySubmenu.innerHTML = '';
    
    workspaces.forEach(workspace => {
        if (workspace.id === currentWorkspaceId) return; // Skip current workspace
        
        const item = document.createElement('button');
        item.className = 'context-submenu-item';
        item.textContent = workspace.name;
        
        item.onclick = (e) => {
            e.stopPropagation();
            copyTabToWorkspace(tabId, workspace.id);
            hideAllContextMenus();
        };
        
        tabCopySubmenu.appendChild(item);
    });
    
    // If no other workspaces, show disabled message
    if (tabCopySubmenu.children.length === 0) {
        const disabledItem = document.createElement('button');
        disabledItem.className = 'context-submenu-item disabled';
        disabledItem.textContent = 'No other workspaces';
        tabCopySubmenu.appendChild(disabledItem);
    }
}

if (undoToastBtn) {
    undoToastBtn.addEventListener('click', () => {
        const action = undoToastAction;
        hideUndoToast();
        if (action) action();
    });
}

// Create Group Modal Event Listeners
if (cancelCreateGroupBtn) {
    cancelCreateGroupBtn.addEventListener('click', closeCreateGroupModal);
}

if (saveCreateGroupBtn) {
    saveCreateGroupBtn.addEventListener('click', saveCreateGroup);
}

if (groupNameInput) {
    groupNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            saveCreateGroup();
        } else if (e.key === 'Escape') {
            closeCreateGroupModal();
        }
    });
}

if (createGroupModal) {
    createGroupModal.addEventListener('click', (e) => {
        if (e.target === createGroupModal) {
            closeCreateGroupModal();
        }
    });
}

// Workspace Modal Tab Switching
if (workspaceTabBtn) {
    workspaceTabBtn.addEventListener('click', () => switchModalTab('workspaces'));
}

if (groupsTabBtn) {
    groupsTabBtn.addEventListener('click', () => switchModalTab('groups'));
}

if (archiveTabBtn) {
    archiveTabBtn.addEventListener('click', () => switchModalTab('archive'));
}

// Archive Modal Event Listeners
if (cancelArchiveBtn) {
    cancelArchiveBtn.addEventListener('click', closeArchiveModal);
}

if (saveArchiveBtn) {
    saveArchiveBtn.addEventListener('click', saveArchive);
}

if (archiveNoteInput) {
    archiveNoteInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            saveArchive();
        } else if (e.key === 'Escape') {
            closeArchiveModal();
        }
    });
}

if (archiveModal) {
    archiveModal.addEventListener('click', (e) => {
        if (e.target === archiveModal) {
            closeArchiveModal();
        }
    });
}

// Create Group from Workspace Modal
if (createGroupBtn) {
    createGroupBtn.addEventListener('click', () => {
        const groupName = newGroupNameInput.value.trim();
        if (groupName) {
            const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6'];
            const randomColor = colors[Math.floor(Math.random() * colors.length)];
            createTabGroup(groupName, randomColor);
            newGroupNameInput.value = '';
            
            // Add creation animation
            setTimeout(() => {
                const groupItems = groupsList?.querySelectorAll('.group-management-item');
                const newItem = groupItems?.[groupItems.length - 1];
                if (newItem) {
                    newItem.classList.add('creating');
                    setTimeout(() => newItem.classList.remove('creating'), 300);
                }
            }, 0);
            
            renderGroupsList();
        }
    });
}

if (newGroupNameInput) {
    newGroupNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            createGroupBtn.click();
        }
    });
}

// --- Font Size Controller ---
const fontDecBtn = document.getElementById('font-dec-btn');
const fontIncBtn = document.getElementById('font-inc-btn');
const fontSizeDisplay = document.getElementById('font-size-display');
const FONT_STEPS = [60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130];
const DEFAULT_FONT_IDX = 8; // 100%

let fontSizeIdx = parseInt(localStorage.getItem(getWorkspaceStorageKey('multiCheckFontSizeIdx')) ?? DEFAULT_FONT_IDX, 10);
if (fontSizeIdx < 0 || fontSizeIdx >= FONT_STEPS.length) fontSizeIdx = DEFAULT_FONT_IDX;

function applyFontSize() {
    const pct = FONT_STEPS[fontSizeIdx];
    const rem = (pct / 100 * 0.95).toFixed(4) + 'rem';
    // Apply to both panes via the editor-container custom property
    editorContainer.style.setProperty('--editor-font-size', rem);
    if (fontSizeDisplay) fontSizeDisplay.textContent = pct + '%';
    localStorage.setItem(getWorkspaceStorageKey('multiCheckFontSizeIdx'), fontSizeIdx);
}

if (fontDecBtn) {
    fontDecBtn.onclick = () => {
        if (fontSizeIdx > 0) { fontSizeIdx--; applyFontSize(); }
    };
}
if (fontIncBtn) {
    fontIncBtn.onclick = () => {
        if (fontSizeIdx < FONT_STEPS.length - 1) { fontSizeIdx++; applyFontSize(); }
    };
}
// Double-click display to reset to default
if (fontSizeDisplay) {
    fontSizeDisplay.title = 'Double-click to reset';
    fontSizeDisplay.style.cursor = 'pointer';
    fontSizeDisplay.addEventListener('dblclick', () => {
        fontSizeIdx = DEFAULT_FONT_IDX;
        applyFontSize();
    });
}
applyFontSize();

function updateLineNumbers(textarea, lineNumbersDiv) {
    const linesCount = textarea.value.split('\n').length;
    let linesHtml = '';
    for (let i = 1; i <= linesCount; i++) {
        linesHtml += i + '<br>';
    }
    lineNumbersDiv.innerHTML = linesHtml;
}

function syncScroll(textarea, lineNumbersDiv) {
    lineNumbersDiv.scrollTop = textarea.scrollTop;
}

function updateAllLineNumbers() {
    updateLineNumbers(inputArea, inputLines);
    updateOutputLineNumbers();
}

function updateOutputLineNumbers() {
    const lines = outputArea.value.split('\n');
    const count = lines.length;
    let html = '';
    for (let i = 0; i < count; i++) {
        const line = lines[i].trim();
        let copyValue = null;
        let lineType = null;

        // Serial line (32-char hex)
        if (/^[A-Fa-f0-9]{32}$/.test(line)) {
            copyValue = line;
            lineType = 'serial';
        }
        // Ban command line (/ban NAME duration reason)
        else if (line.startsWith('/ban')) {
            const parts = line.split(' ');
            if (parts.length >= 2) {
                const name = parts[1];
                if (name) {
                    copyValue = name;
                    lineType = 'name';
                }
            }
        }
        // Name line (contains |)
        else if (line.includes('|')) {
            const splitIndex = line.indexOf('|');
            const name = line.substring(0, splitIndex).trim();
            if (name) {
                copyValue = name;
                lineType = 'name';
            }
        }

        if (copyValue) {
            const escaped = escapeHtml(copyValue);
            html += `<span class="line-num-clickable" data-copy="${escaped}" data-type="${lineType}" title="Click to copy ${lineType}">${i + 1}</span><br>`;
        } else {
            html += `<span>${i + 1}</span><br>`;
        }
    }
    outputLines.innerHTML = html;
    // NOTE: click handling is done via delegated listener below — no per-element handlers needed
}

// Single delegated listener — survives DOM rebuilds
outputLines.addEventListener('click', (e) => {
    const el = e.target.closest('.line-num-clickable');
    if (!el) return;

    let value = el.getAttribute('data-copy');
    if (!value) return;

    const toggle = document.getElementById('underscore-names-toggle');
    if (toggle && toggle.checked && el.getAttribute('data-type') === 'name') {
        value = value.replace(/ /g, '_');
    }

    const showFeedback = () => {
        const original = el.textContent;
        el.textContent = '\u2713';
        el.style.color = 'var(--primary-color)';
        setTimeout(() => {
            el.textContent = original;
            el.style.color = '';
        }, 1200);
    };

    robustCopy(value, showFeedback);
});

function robustCopy(text, onSuccess) {
    // Try synchronous execCommand first — works even when Clipboard API is blocked
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;';
    document.body.appendChild(ta);
    ta.focus({ preventScroll: true });
    ta.select();
    let execOk = false;
    try { execOk = document.execCommand('copy'); } catch (_) { }
    document.body.removeChild(ta);

    if (execOk) {
        if (onSuccess) onSuccess();
        return;
    }

    // Fallback: async Clipboard API (requires page focus & user gesture)
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            if (onSuccess) onSuccess();
        }).catch(() => { });
    }
}

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function updateMirror() {
    const text = outputArea.value;
    const lines = text.split('\n');
    const htmlLines = lines.map((line) => {
        if (!line) return '';

        if (/^[A-Fa-f0-9]{32}(\s.*)?$/.test(line)) {
            const serial = line.substring(0, 32);
            const rest = line.substring(32);
            return `<span data-type="Serial" data-value="${serial}">${serial}</span>${escapeHtml(rest)}`;
        }

        const splitIndex = line.indexOf('|');
        if (splitIndex !== -1) {
            const namePart = line.substring(0, splitIndex).trimEnd();
            const spaces = line.substring(namePart.length, splitIndex);

            let html = `<span data-type="Name" data-value="${escapeHtml(namePart)}">${escapeHtml(namePart)}</span>${spaces}|`;

            const restOfLine = line.substring(splitIndex + 1);
            const idMatch = restOfLine.match(/(\d+)/);
            if (idMatch) {
                const spacesBeforeId = restOfLine.substring(0, idMatch.index);
                const idVal = idMatch[1];
                const afterId = restOfLine.substring(idMatch.index + idVal.length);

                html += `${spacesBeforeId}<span data-type="ID" data-value="${idVal}">${idVal}</span>${escapeHtml(afterId)}`;
            } else {
                html += escapeHtml(restOfLine);
            }
            return html;
        }

        return escapeHtml(line);
    });

    outputMirror.innerHTML = htmlLines.join('\n');
    outputMirror.scrollTop = outputArea.scrollTop;
    outputMirror.scrollLeft = outputArea.scrollLeft;
}

function syncVisuals() {
    updateLineNumbers(inputArea, inputLines);
    updateOutputLineNumbers();
    updateMirror();
}

let outputHistory = [];
let debounceTimer;

let currentTheme = localStorage.getItem('multiCheckTheme') || 'dark';

function applyTheme() {
    document.documentElement.setAttribute('data-theme', currentTheme);
    if (currentTheme === 'light') {
        themeToggleBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
    } else {
        themeToggleBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';
    }
}

themeToggleBtn.onclick = () => {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('multiCheckTheme', currentTheme);
    applyTheme();
};

applyTheme();

let editorTheme = localStorage.getItem('multiCheckEditorTheme') || currentTheme;

function applyEditorTheme() {
    editorContainer.setAttribute('data-editor-theme', editorTheme);
    const banView = document.getElementById('ban-generator-view');
    if (banView) banView.setAttribute('data-editor-theme', editorTheme);

    if (editorTheme === 'light') {
        editorThemeBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" style="vertical-align: middle;"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
    } else {
        editorThemeBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" style="vertical-align: middle;"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';
    }
}

editorThemeBtn.onclick = () => {
    editorTheme = editorTheme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('multiCheckEditorTheme', editorTheme);
    applyEditorTheme();
};

applyEditorTheme();

const inputPane = document.getElementById('input-pane');

toggleFullscreenBtn.onclick = () => {
    const isFullscreen = editorContainer.classList.toggle('fullscreen-mode');

    if (isFullscreen) {
        inputPane.style.display = 'none';
        editorContainer.style.gridTemplateColumns = '1fr';
        toggleFullscreenBtn.classList.add('active');
    } else {
        inputPane.style.display = 'flex';
        editorContainer.style.gridTemplateColumns = '1fr 1fr';
        toggleFullscreenBtn.classList.remove('active');
    }
    syncVisuals();
};

const trueFullscreenBtn = document.getElementById('true-fullscreen-btn');
const outputPane = document.getElementById('output-pane');

if (trueFullscreenBtn && outputPane) {
    trueFullscreenBtn.onclick = () => {
        const isTrueFs = outputPane.classList.toggle('true-fullscreen');
        if (isTrueFs) {
            trueFullscreenBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M4 14h6v6M20 10h-6V4M10 14l-7 7M14 10l7-7"></path></svg>';
        } else {
            trueFullscreenBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"></path></svg>';
        }
        syncVisuals();
    };
}

let sidebarCollapsed = localStorage.getItem('multiCheckSidebar') === 'true';
if (sidebarCollapsed) {
    sidebar.classList.add('collapsed');
}

toggleSidebarBtn.onclick = () => {
    sidebar.classList.toggle('collapsed');
    localStorage.setItem('multiCheckSidebar', sidebar.classList.contains('collapsed'));
};

let headerCollapsed = localStorage.getItem('multiCheckHeader') === 'true';
if (headerCollapsed) {
    topBar.classList.add('collapsed');
    showHeaderBtn.classList.remove('hidden');
}

hideHeaderBtn.onclick = () => {
    topBar.classList.add('collapsed');
    showHeaderBtn.classList.remove('hidden');
    localStorage.setItem('multiCheckHeader', 'true');
};

showHeaderBtn.onclick = () => {
    topBar.classList.remove('collapsed');
    showHeaderBtn.classList.add('hidden');
    localStorage.setItem('multiCheckHeader', 'false');
};

// Tag format dropdown (with/without parentheses)
let tagFormatMode = localStorage.getItem(getWorkspaceStorageKey('multiCheckTagFormat')) || 'none';
const tagFormatDropdownBtn = document.getElementById('tag-format-dropdown-btn');
const tagFormatDropdownMenu = document.getElementById('tag-format-dropdown-menu');
const tagFormatLabel = document.getElementById('tag-format-label');
const tagFormatOptions = document.querySelectorAll('.tag-format-option');

const tagFormatLabels = {
    'none': 'With ()',
    'mt': 'No () M/T',
    'all': 'No () All'
};

function updateTagFormatLabel() {
    if (tagFormatLabel) {
        tagFormatLabel.textContent = tagFormatLabels[tagFormatMode] || 'With ()';
    }
    // Update active state of options
    tagFormatOptions.forEach(option => {
        option.classList.toggle('active', option.dataset.value === tagFormatMode);
    });
}

if (tagFormatDropdownBtn) {
    tagFormatDropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        tagFormatDropdownMenu.classList.toggle('hidden');
    });
}

if (tagFormatOptions) {
    tagFormatOptions.forEach(option => {
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            tagFormatMode = option.dataset.value;
            localStorage.setItem(getWorkspaceStorageKey('multiCheckTagFormat'), tagFormatMode);
            updateTagFormatLabel();
            tagFormatDropdownMenu.classList.add('hidden');
        });
    });
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (tagFormatDropdownMenu && !tagFormatDropdownMenu.contains(e.target) && !tagFormatDropdownBtn.contains(e.target)) {
        tagFormatDropdownMenu.classList.add('hidden');
    }
});

// Initialize label and active state
updateTagFormatLabel();

// Discord webhook URL
const discordWebhookUrlInput = document.getElementById('discord-webhook-url');
if (discordWebhookUrlInput) {
    discordWebhookUrlInput.value = localStorage.getItem(getWorkspaceStorageKey('multiCheckDiscordWebhookUrl')) || '';
    discordWebhookUrlInput.addEventListener('change', () => {
        localStorage.setItem(getWorkspaceStorageKey('multiCheckDiscordWebhookUrl'), discordWebhookUrlInput.value);
        showUndoToast('Discord webhook URL saved', null, 2000);
    });
}

// Register service worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then((registration) => {
                console.log('Service Worker registered:', registration);
            })
            .catch((error) => {
                console.log('Service Worker registration failed:', error);
            });
    });
}

// PWA Install handling
let deferredPrompt;
const installAppBtn = document.getElementById('install-app-btn');

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installAppBtn) {
        installAppBtn.classList.remove('hidden');
    }
});

if (installAppBtn) {
    installAppBtn.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                installAppBtn.classList.add('hidden');
            }
            deferredPrompt = null;
        }
    });
}

window.addEventListener('appinstalled', () => {
    if (installAppBtn) {
        installAppBtn.classList.add('hidden');
    }
    showUndoToast('App installed successfully!', null, 3000);
});

// Discord webhook sending function
async function sendToDiscord(content, source = 'Output') {
    const webhookUrl = discordWebhookUrlInput?.value?.trim();
    if (!webhookUrl) {
        showUndoToast('No Webhook URL - Please enter a Discord webhook URL in the Manage Workspaces modal.', null, 4000);
        return false;
    }

    if (!content || content.trim() === '') {
        showUndoToast('No Content - There is no content to send.', null, 4000);
        return false;
    }

    const maxLength = 2000;
    const codeBlockPrefix = '```\n';
    const codeBlockSuffix = '\n```';
    const sourceLabel = `**Source: ${source}**\n\n`;

    // Split content into chunks that fit in code blocks
    const lines = content.split('\n');
    let currentChunk = '';
    let chunks = [];

    for (const line of lines) {
        const testChunk = currentChunk ? currentChunk + '\n' + line : line;
        const fullLength = sourceLabel.length + codeBlockPrefix.length + testChunk.length + codeBlockSuffix.length;

        if (fullLength > maxLength) {
            if (currentChunk) {
                chunks.push(currentChunk);
            }
            currentChunk = line;
        } else {
            currentChunk = testChunk;
        }
    }
    if (currentChunk) {
        chunks.push(currentChunk);
    }

    let successCount = 0;
    for (let i = 0; i < chunks.length; i++) {
        try {
            const embedContent = sourceLabel + codeBlockPrefix + chunks[i] + codeBlockSuffix;
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    embeds: [{
                        title: `${source} - Part ${i + 1}/${chunks.length}`,
                        description: embedContent,
                        color: source === 'Ban Generator' ? 15158332 : 5763719,
                        timestamp: new Date().toISOString()
                    }]
                })
            });

            if (response.ok) {
                successCount++;
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            showUndoToast(`Send Failed - Failed to send chunk ${i + 1}/${chunks.length}: ${error.message}`, null, 5000);
            return false;
        }
    }

    showUndoToast(`Successfully sent ${successCount}/${chunks.length} message(s) to Discord.`, null, 4000);
    return true;
}

// Send button for main output
const sendBtn = document.getElementById('send-btn');
if (sendBtn) {
    sendBtn.onclick = () => {
        const content = outputArea.value;
        sendToDiscord(content, 'Output');
    };
}

// Send button for ban generator
const banSendBtn = document.getElementById('ban-send-btn');
if (banSendBtn) {
    banSendBtn.onclick = () => {
        const banLines = Array.from(banOutputArea.querySelectorAll('.ban-line')).map(el => el.textContent);
        const content = banLines.join('\n');
        sendToDiscord(content, 'Ban Generator');
    };
}

let hoverCopyEnabled = localStorage.getItem('hoverCopyEnabled') !== 'false';
function updateHoverBtnState() {
    if (hoverCopyEnabled) {
        toggleHoverBtn.style.opacity = '1';
        toggleHoverBtn.style.color = 'var(--primary-color)';
    } else {
        toggleHoverBtn.style.opacity = '0.5';
        toggleHoverBtn.style.color = 'var(--text-main)';
    }
}

toggleHoverBtn.onclick = () => {
    hoverCopyEnabled = !hoverCopyEnabled;
    localStorage.setItem('hoverCopyEnabled', hoverCopyEnabled);
    updateHoverBtnState();
    if (!hoverCopyEnabled && typeof hideHoverPopup === 'function') hideHoverPopup();
};
updateHoverBtnState();

const underscoreNamesToggle = document.getElementById('underscore-names-toggle');
if (underscoreNamesToggle) {
    underscoreNamesToggle.checked = localStorage.getItem(getWorkspaceStorageKey('multiCheckUnderscoreNames')) === 'true';
    underscoreNamesToggle.addEventListener('change', (e) => {
        e.stopPropagation();
        localStorage.setItem(getWorkspaceStorageKey('multiCheckUnderscoreNames'), underscoreNamesToggle.checked);
    });
    // Prevent label click from bubbling
    underscoreNamesToggle.parentElement?.addEventListener('click', (e) => {
        e.stopPropagation();
    });
}

if (autoProcessToggle) {
    autoProcessToggle.checked = localStorage.getItem(getWorkspaceStorageKey('multiCheckAutoProcess')) === 'true';
    autoProcessEnabled = autoProcessToggle.checked;
    autoProcessToggle.addEventListener('change', (e) => {
        e.stopPropagation();
        autoProcessEnabled = autoProcessToggle.checked;
        localStorage.setItem(getWorkspaceStorageKey('multiCheckAutoProcess'), autoProcessEnabled);
    });
    // Prevent label click from bubbling
    autoProcessToggle.parentElement?.addEventListener('click', (e) => {
        e.stopPropagation();
    });
}

// Auto-process on paste
if (inputArea) {
    inputArea.addEventListener('paste', () => {
        if (autoProcessEnabled) {
            setTimeout(() => {
                processBtn.click();
            }, 10);
        }
    });
}

const discordCodeToggle = document.getElementById('discord-code-toggle');
if (discordCodeToggle) {
    discordCodeToggle.checked = localStorage.getItem(getWorkspaceStorageKey('multiCheckDiscordCode')) === 'true';
    discordCodeToggle.addEventListener('change', (e) => {
        e.stopPropagation();
        localStorage.setItem(getWorkspaceStorageKey('multiCheckDiscordCode'), discordCodeToggle.checked);
    });
    // Prevent label click from bubbling
    discordCodeToggle.parentElement?.addEventListener('click', (e) => {
        e.stopPropagation();
    });
}

function saveOutputState() {
    const val = outputArea.value;
    if (outputHistory.length === 0 || outputHistory[outputHistory.length - 1] !== val) {
        outputHistory.push(val);
        if (outputHistory.length > 50) outputHistory.shift();
    }
}

revertBtn.onclick = () => {
    if (outputHistory.length > 1) {
        outputHistory.pop();
        outputArea.value = outputHistory[outputHistory.length - 1];
        updateCurrentTabData();
        syncVisuals();
        if (typeof updateStats === 'function') updateStats();
    }
};

const renameModal = document.getElementById('rename-modal');
const renameInput = document.getElementById('rename-input');
const saveRenameBtn = document.getElementById('save-rename-btn');
const cancelRenameBtn = document.getElementById('cancel-rename-btn');
let tabToRename = null;

const clearInputBtn = document.getElementById('clear-input-btn');
if (clearInputBtn) {
    clearInputBtn.onclick = () => {
        if (inputArea.value.trim() === '') return;
        const targetTabId = activeTabId;
        const previousInput = inputArea.value;
        showConfirm('Clear Input', 'Are you sure you want to clear the raw data?', () => {
            inputArea.value = '';
            syncVisuals();
            updateCurrentTabData();
            showUndoToast('Input cleared', () => {
                const tab = getTabById(targetTabId);
                if (!tab) return;
                activeTabId = targetTabId;
                tab.input = previousInput;
                tab.lastEdited = Date.now();
                saveState();
                renderTabs();
            });
        }, true);
    };
}

const clearOutputBtn = document.getElementById('clear-output-btn');
if (clearOutputBtn) {
    clearOutputBtn.onclick = () => {
        if (outputArea.value.trim() === '') return;
        const targetTabId = activeTabId;
        const previousOutput = outputArea.value;
        showConfirm('Clear Output', 'Are you sure you want to clear the processed output?', () => {
            outputArea.value = '';
            syncVisuals();
            if (typeof updateStats === 'function') updateStats();
            updateCurrentTabData();
            saveOutputState();
            showUndoToast('Output cleared', () => {
                const tab = getTabById(targetTabId);
                if (!tab) return;
                activeTabId = targetTabId;
                tab.output = previousOutput;
                tab.lastEdited = Date.now();
                saveState();
                renderTabs();
            });
        }, true);
    };
}

const clearAllBtn = document.getElementById('clear-all-btn');
if (clearAllBtn) {
    clearAllBtn.onclick = () => {
        // Check if there's an active tab before clearing
        if (!activeTabId || tabs.length === 0) {
            showAlert('No List Selected', 'Please create or select a list before clearing data.');
            return;
        }
        
        const hasData = inputArea.value.trim() !== '' || outputArea.value.trim() !== '' || (typeof banInputArea !== 'undefined' && banInputArea.value.trim() !== '');
        if (!hasData) return;

        const targetTabId = activeTabId;
        const tabSnapshot = createTabSnapshot(getTabById(activeTabId));
        const banSnapshot = captureBanGeneratorSnapshot();
        showConfirm('Clear All', 'Are you sure you want to completely clear ALL data in this tab (Input, Output, and Ban Generator)?', () => {
            inputArea.value = '';
            outputArea.value = '';
            if (typeof banInputArea !== 'undefined') {
                banInputArea.value = '';
                banOutputArea.innerHTML = '';
                if (typeof banCountBadge !== 'undefined' && banCountBadge) banCountBadge.style.display = 'none';
                window.banCopyIndex = 0;
                if (typeof saveBanGeneratorState === 'function') saveBanGeneratorState();
            }
            syncVisuals();
            if (typeof updateStats === 'function') updateStats();
            updateCurrentTabData();
            saveOutputState();
            showUndoToast('All tab data cleared', () => {
                if (tabSnapshot) {
                    const tab = getTabById(targetTabId);
                    if (tab) {
                        Object.assign(tab, tabSnapshot, { lastEdited: Date.now() });
                    }
                    activeTabId = targetTabId;
                    restoreBanGeneratorSnapshot(banSnapshot);
                    saveState();
                    renderTabs();
                }
            });
        }, true);
    };
}

const deleteModal = document.getElementById('delete-modal');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
const archiveDeleteBtn = document.getElementById('archive-delete-btn');
let tabToDelete = null;

function saveState() {
    tabs = sortTabsForDisplay(tabs);
    localStorage.setItem(getWorkspaceStorageKey('multiCheckTabs'), JSON.stringify(tabs));
    if (activeTabId) {
        localStorage.setItem(getWorkspaceStorageKey('multiCheckActiveTab'), activeTabId);
    } else {
        localStorage.removeItem(getWorkspaceStorageKey('multiCheckActiveTab'));
    }
    setSaveStatus(activeTabId ? 'saved' : 'idle', activeTabId ? 'Autosaved' : 'No list selected');
}

function findTabListItem(tabId) {
    return Array.from(tabListEl.children).find(el => el.dataset.tabId === tabId) || null;
}

function queueMovedTabHighlight(tabId) {
    movedTabHighlightId = tabId;
    clearTimeout(movedTabHighlightTimer);
    movedTabHighlightTimer = setTimeout(() => {
        movedTabHighlightId = null;
        renderTabs();
    }, 1600);
}

function updateTabGhostPosition(clientX, clientY) {
    if (!tabDragState || !tabDragState.ghostEl) return;
    const { ghostEl, offsetX, offsetY } = tabDragState;
    ghostEl.style.left = `${clientX - offsetX}px`;
    ghostEl.style.top = `${clientY - offsetY}px`;
}

function moveTabPlaceholder(clientY) {
    if (!tabDragState || !tabDragState.placeholderEl) return;

    const placeholderEl = tabDragState.placeholderEl;
    const sourceEl = tabDragState.sourceEl;
    const candidates = Array.from(tabListEl.querySelectorAll('.tab-item'))
        .filter(el => el !== placeholderEl && el !== sourceEl);

    let inserted = false;
    for (const item of candidates) {
        const rect = item.getBoundingClientRect();
        if (clientY < rect.top + rect.height / 2) {
            tabListEl.insertBefore(placeholderEl, item);
            inserted = true;
            break;
        }
    }

    if (!inserted) {
        tabListEl.appendChild(placeholderEl);
    }
}

function startTabReorder() {
    if (!tabDragState || tabDragState.isDragging) return;

    const sourceEl = findTabListItem(tabDragState.tabId);
    if (!sourceEl) return;

    const rect = sourceEl.getBoundingClientRect();
    const placeholderEl = document.createElement('li');
    placeholderEl.className = 'tab-item tab-item-placeholder';
    placeholderEl.style.height = `${rect.height}px`;

    const ghostEl = sourceEl.cloneNode(true);
    ghostEl.classList.remove('active');
    ghostEl.classList.add('tab-item-ghost');
    ghostEl.style.width = `${rect.width}px`;
    ghostEl.style.height = `${rect.height}px`;
    document.body.appendChild(ghostEl);

    sourceEl.classList.add('tab-drag-source');
    sourceEl.style.display = 'none';
    sourceEl.insertAdjacentElement('afterend', placeholderEl);

    tabDragState.isDragging = true;
    tabDragState.sourceEl = sourceEl;
    tabDragState.placeholderEl = placeholderEl;
    tabDragState.ghostEl = ghostEl;

    document.body.classList.add('tab-reordering');
    document.body.classList.add('tab-reordering-active');
    updateTabGhostPosition(tabDragState.lastClientX, tabDragState.lastClientY);
    moveTabPlaceholder(tabDragState.lastClientY);
}

function cleanupTabReorder(shouldCommit) {
    if (!tabDragState) return;

    clearTimeout(tabDragState.holdTimer);

    const {
        isDragging,
        placeholderEl,
        ghostEl,
        sourceEl,
        tabId
    } = tabDragState;

    if (isDragging && placeholderEl && sourceEl) {
        if (shouldCommit) {
            const orderedIds = [];
            Array.from(tabListEl.children).forEach(child => {
                if (child === placeholderEl) {
                    orderedIds.push(tabId);
                    return;
                }
                if (child !== sourceEl && child.dataset.tabId) {
                    orderedIds.push(child.dataset.tabId);
                }
            });

            tabs = orderedIds
                .map(id => tabs.find(tab => tab.id === id))
                .filter(Boolean);
            saveState();
            queueMovedTabHighlight(tabId);
        }

        sourceEl.style.display = '';
        sourceEl.classList.remove('tab-drag-source');
        placeholderEl.remove();
        suppressTabClickUntil = Date.now() + 250;
    }

    if (ghostEl) ghostEl.remove();

    document.body.classList.remove('tab-reordering');
    document.body.classList.remove('tab-reordering-active');
    tabDragState = null;

    if (isDragging && shouldCommit) {
        renderTabs();
    }
}

function beginTabPointerDrag(item, e, immediateStart = false) {
    cleanupTabReorder(false);
    tabDragState = {
        tabId: item.dataset.tabId,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        lastClientX: e.clientX,
        lastClientY: e.clientY,
        offsetX: e.clientX - item.getBoundingClientRect().left,
        offsetY: e.clientY - item.getBoundingClientRect().top,
        holdTimer: immediateStart ? null : setTimeout(startTabReorder, TAB_REORDER_HOLD_MS),
        isDragging: false,
        sourceEl: null,
        placeholderEl: null,
        ghostEl: null
    };
    if (immediateStart) {
        startTabReorder();
    }
}

tabListEl.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('.tab-actions') || e.target.closest('.tab-name-input')) return;

    const item = e.target.closest('.tab-item');
    if (!item || !item.dataset.tabId) return;

    const handle = e.target.closest('.tab-drag-handle');
    const clickedButton = e.target.closest('button');
    if (clickedButton && !handle) return;

    beginTabPointerDrag(item, e, Boolean(handle));
});

document.addEventListener('pointermove', (e) => {
    if (!tabDragState || e.pointerId !== tabDragState.pointerId) return;

    tabDragState.lastClientX = e.clientX;
    tabDragState.lastClientY = e.clientY;

    if (tabDragState.isDragging) {
        e.preventDefault();
        updateTabGhostPosition(e.clientX, e.clientY);
        moveTabPlaceholder(e.clientY);
        return;
    }

    const movedX = e.clientX - tabDragState.startX;
    const movedY = e.clientY - tabDragState.startY;
    const movedDistance = Math.hypot(movedX, movedY);

    if (movedDistance > TAB_REORDER_MOVE_TOLERANCE) {
        clearTimeout(tabDragState.holdTimer);
        tabDragState.holdTimer = null;
    }
});

document.addEventListener('pointerup', (e) => {
    if (!tabDragState || e.pointerId !== tabDragState.pointerId) return;
    cleanupTabReorder(true);
});

document.addEventListener('pointercancel', (e) => {
    if (!tabDragState || e.pointerId !== tabDragState.pointerId) return;
    cleanupTabReorder(false);
});

// Confirmation modal helper
const confirmModal = document.getElementById('confirm-modal');
const confirmModalTitle = document.getElementById('confirm-modal-title');
const confirmModalMsg = document.getElementById('confirm-modal-msg');
const confirmModalOk = document.getElementById('confirm-modal-ok');
const confirmModalCancel = document.getElementById('confirm-modal-cancel');

function showConfirm(title, msg, onConfirm, dangerStyle = false, isAlert = false) {
    confirmModalTitle.textContent = title;
    confirmModalMsg.textContent = msg;
    confirmModal.classList.remove('hidden');
    confirmModalOk.style.background = dangerStyle ? 'var(--danger)' : '';
    confirmModalOk.style.boxShadow = dangerStyle ? '0 4px 15px rgba(239,68,68,0.3)' : '';

    if (isAlert) {
        confirmModalCancel.style.display = 'none';
        confirmModalOk.textContent = 'OK';
    } else {
        confirmModalCancel.style.display = '';
        confirmModalOk.textContent = dangerStyle ? 'Delete' : 'Confirm';
    }

    const doConfirm = () => {
        confirmModal.classList.add('hidden');
        confirmModalOk.removeEventListener('click', doConfirm);
        confirmModalCancel.removeEventListener('click', doCancel);
        onConfirm();
    };
    const doCancel = () => {
        confirmModal.classList.add('hidden');
        confirmModalOk.removeEventListener('click', doConfirm);
        confirmModalCancel.removeEventListener('click', doCancel);
    };
    confirmModalOk.addEventListener('click', doConfirm);
    confirmModalCancel.addEventListener('click', doCancel);
    confirmModal.addEventListener('click', (e) => {
        if (e.target === confirmModal) doCancel();
    }, { once: true });
}

function showAlert(title, msg) {
    showConfirm(title, msg, () => { }, false, true);
}

function captureBanGeneratorSnapshot() {
    if (typeof banInputArea === 'undefined') return null;
    return {
        input: banInputArea.value,
        outputHtml: banOutputArea.innerHTML,
        copyIndex: window.banCopyIndex || 0,
        preset: currentPresetId,
        duration: currentDuration,
        badgeText: banCountBadge ? banCountBadge.textContent : '',
        badgeDisplay: banCountBadge ? banCountBadge.style.display : 'none',
        currentView
    };
}

function restoreBanGeneratorSnapshot(snapshot) {
    if (!snapshot || typeof banInputArea === 'undefined') return;

    if (currentView !== snapshot.currentView) {
        viewToggleBtn.click();
    }
    banInputArea.value = snapshot.input || '';
    banOutputArea.innerHTML = snapshot.outputHtml || '';
    window.banCopyIndex = snapshot.copyIndex || 0;
    if (snapshot.preset) {
        currentPresetId = snapshot.preset;
        const preset = [...BAN_PRESETS, ...customPresets].find(p => p.id === snapshot.preset);
        if (preset && banPresetLabel) banPresetLabel.textContent = preset.name;
        rebuildPresetSelect();
    }
    if (snapshot.duration) {
        currentDuration = snapshot.duration;
        const durationItem = document.querySelector(`.duration-dropdown-item[data-value="${snapshot.duration}"]`);
        if (durationItem && banDurationLabel) {
            banDurationLabel.textContent = durationItem.textContent;
            document.querySelectorAll('.duration-dropdown-item').forEach(el => el.classList.remove('active'));
            durationItem.classList.add('active');
        }
    }
    if (banCountBadge) {
        banCountBadge.textContent = snapshot.badgeText || '';
        banCountBadge.style.display = snapshot.badgeDisplay || 'none';
    }
    if (typeof saveBanGeneratorState === 'function') saveBanGeneratorState();
}

function startInlineRename(tabId) {
    inlineRenamingTabId = tabId;
    renderTabs();
}

function finishInlineRename(tabId, nextName, shouldSave) {
    const tab = getTabById(tabId);
    if (!tab) return;

    if (shouldSave) {
        const trimmed = (nextName || '').trim();
        if (trimmed) {
            tab.name = trimmed;
            saveState();
        }
    }

    inlineRenamingTabId = null;
    renderTabs();
}

function toggleTabPin(tabId) {
    const tab = getTabById(tabId);
    if (!tab) return;
    tab.pinned = !tab.pinned;
    saveState();
    renderTabs();
}

function renderTabs() {
    // Enable virtual scrolling if there are many tabs (50+)
    const useVirtualScroll = tabs.length > 50;
    
    if (useVirtualScroll) {
        renderTabsVirtual();
    } else {
        renderTabsStandard();
    }
}

function renderTabsStandard() {
    tabListEl.innerHTML = '';
    tabListEl.classList.remove('virtual-scroll');

    if (!tabs.find(t => t.id === activeTabId)) {
        activeTabId = tabs.length > 0 ? tabs[0].id : null;
    }

    if (tabs.length === 0) {
        currentTabTitle.textContent = 'No List Selected';
        inputArea.value = '';
        outputArea.value = '';
        outputHistory = [];
        syncVisuals();
        updateStats();
        setSaveStatus('idle', 'No list selected');

        const emptyState = document.createElement('li');
        emptyState.className = 'tab-empty-state';
        emptyState.innerHTML = `
            <strong>No lists yet</strong>
            <span>Click + to create one.</span>
            <button type="button" class="primary-btn">Create List</button>
        `;
        emptyState.querySelector('button').addEventListener('click', () => addTab());
        tabListEl.appendChild(emptyState);
        
        // Show empty state in editor area
        const editorContainer = document.getElementById('editor-container');
        let editorEmptyState = document.getElementById('editor-empty-state');
        if (!editorEmptyState) {
            editorEmptyState = document.createElement('div');
            editorEmptyState.id = 'editor-empty-state';
            editorEmptyState.className = 'editor-empty-state';
            editorEmptyState.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: var(--text-muted);">
                    <svg viewBox="0 0 24 24" width="64" height="64" stroke="currentColor" stroke-width="1" fill="none" style="opacity: 0.3; margin-bottom: 20px;">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="12" y1="18" x2="12" y2="12"></line>
                        <line x1="12" y1="6" x2="12.01" y2="6"></line>
                    </svg>
                    <h3 style="font-size: 1.2rem; margin-bottom: 10px; color: var(--text-main);">No lists in this workspace</h3>
                    <p style="margin-bottom: 20px;">Create a list to start processing your data</p>
                    <button type="button" class="primary-btn" onclick="document.getElementById('add-tab-btn').click()">Create First List</button>
                </div>
            `;
            editorContainer.style.display = 'none';
            editorContainer.parentNode.insertBefore(editorEmptyState, editorContainer);
        } else {
            editorEmptyState.style.display = 'block';
            editorContainer.style.display = 'none';
        }
        
        return;
    }
    
    // Hide empty state if it exists and we have tabs
    const editorEmptyState = document.getElementById('editor-empty-state');
    if (editorEmptyState) {
        editorEmptyState.style.display = 'none';
        editorContainer.style.display = 'flex';
    }

    // Render tab groups first
    tabGroups.forEach(group => {
        const groupTabs = tabs.filter(t => t.groupId === group.id);
        if (groupTabs.length === 0) return;
        
        const groupHeader = document.createElement('div');
        groupHeader.className = 'tab-group-header';
        groupHeader.style.borderLeft = `3px solid ${group.color}`;
        
        const groupInfo = document.createElement('div');
        groupInfo.className = 'tab-group-info';
        groupInfo.style.cursor = 'pointer';
        groupInfo.onclick = () => toggleTabGroupCollapse(group.id);
        
        const collapseIcon = document.createElement('span');
        collapseIcon.className = 'tab-group-collapse-icon';
        collapseIcon.innerHTML = group.collapsed 
            ? '<svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none"><polyline points="9 18 15 12 9 6"></polyline></svg>'
            : '<svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none"><polyline points="6 9 12 15 18 9"></polyline></svg>';
        
        const groupName = document.createElement('span');
        groupName.className = 'tab-group-name';
        groupName.textContent = group.name;
        
        const groupCount = document.createElement('span');
        groupCount.className = 'tab-group-count';
        groupCount.textContent = `${groupTabs.length}`;
        
        groupInfo.appendChild(collapseIcon);
        groupInfo.appendChild(groupName);
        groupInfo.appendChild(groupCount);
        
        const groupActions = document.createElement('div');
        groupActions.className = 'tab-group-actions';
        
        const deleteGroupBtn = document.createElement('button');
        deleteGroupBtn.className = 'icon-btn';
        deleteGroupBtn.title = 'Delete group';
        deleteGroupBtn.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
        deleteGroupBtn.onclick = (e) => {
            e.stopPropagation();
            showConfirm('Delete Group', `Delete "${group.name}"? Tabs will be ungrouped.`, () => {
                deleteTabGroup(group.id);
            });
        };
        
        groupActions.appendChild(deleteGroupBtn);
        
        groupHeader.appendChild(groupInfo);
        groupHeader.appendChild(groupActions);
        tabListEl.appendChild(groupHeader);
        
        // Render tabs in this group
        if (!group.collapsed) {
            groupTabs.forEach(tab => {
                const li = createTabElement(tab);
                li.style.marginLeft = '16px';
                li.style.borderLeft = `2px solid ${group.color}`;
                tabListEl.appendChild(li);
            });
        }
    });
    
    // Render ungrouped tabs
    const ungroupedTabs = tabs.filter(t => !t.groupId);
    ungroupedTabs.forEach(tab => {
        const li = document.createElement('li');
        li.className = `tab-item ${tab.id === activeTabId ? 'active' : ''}`;
        if (tab.pinned) li.classList.add('pinned');
        if (tab.id === movedTabHighlightId) li.classList.add('just-moved');
        li.dataset.tabId = tab.id;
        li.draggable = true;
        
        li.addEventListener('click', (e) => {
            if (Date.now() < suppressTabClickUntil) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            switchTab(tab.id);
        });
        
        // Right-click context menu
        li.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            contextMenuTargetTabId = tab.id;
            populateTabCopySubmenu(tab.id);
            populateTabGroupSubmenu(tab.id);
            showContextMenu(tabContextMenu, e.clientX, e.clientY);
        });
        
        // Drag and drop for moving tabs between workspaces
        li.addEventListener('dragstart', (e) => {
            draggedTabId = tab.id;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', tab.id);
            li.style.opacity = '0.5';
        });
        
        li.addEventListener('dragend', () => {
            draggedTabId = null;
            li.style.opacity = '1';
        });

        const handle = document.createElement('button');
        handle.type = 'button';
        handle.className = 'tab-drag-handle';
        handle.title = 'Drag to reorder';
        handle.setAttribute('aria-label', 'Drag to reorder');
        handle.innerHTML = '<span></span><span></span><span></span><span></span><span></span><span></span>';

        const bodyDiv = document.createElement('div');
        bodyDiv.className = 'tab-body';

        const titleRow = document.createElement('div');
        titleRow.className = 'tab-title-row';

        const nameWrap = document.createElement('div');
        nameWrap.className = 'tab-name-wrap';
        nameWrap.title = tab.name;

        const accountCount = getTabAccountCount(tab);

        if (inlineRenamingTabId === tab.id) {
            const nameInput = document.createElement('input');
            nameInput.className = 'tab-name-input';
            nameInput.value = tab.name;
            nameInput.addEventListener('click', (e) => e.stopPropagation());
            nameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') finishInlineRename(tab.id, nameInput.value, true);
                if (e.key === 'Escape') finishInlineRename(tab.id, tab.name, false);
            });
            nameInput.addEventListener('blur', () => finishInlineRename(tab.id, nameInput.value, true));
            nameWrap.appendChild(nameInput);
            requestAnimationFrame(() => {
                nameInput.focus();
                nameInput.select();
            });
        } else {
            const nameSpan = document.createElement('span');
            nameSpan.className = 'tab-name';
            nameSpan.textContent = tab.name;
            nameSpan.title = `${tab.name}\nDouble-click to rename`;
            nameSpan.addEventListener('dblclick', (e) => {
                e.preventDefault();
                e.stopPropagation();
                startInlineRename(tab.id);
            });
            nameWrap.appendChild(nameSpan);
        }

        if (accountCount > 0) {
            const badge = document.createElement('span');
            badge.className = 'tab-badge';
            badge.textContent = accountCount;
            nameWrap.appendChild(badge);
        }

        const metaRow = document.createElement('div');
        metaRow.className = 'tab-meta';
        const countLabel = accountCount === 1 ? '1 account' : `${accountCount} accounts`;
        metaRow.textContent = `${countLabel} • Edited ${formatRelativeTime(tab.lastEdited)}`;

        titleRow.appendChild(nameWrap);
        bodyDiv.appendChild(titleRow);
        bodyDiv.appendChild(metaRow);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'tab-actions';

        const pinBtn = document.createElement('button');
        pinBtn.className = `icon-btn pin-btn ${tab.pinned ? 'active' : ''}`;
        pinBtn.title = tab.pinned ? 'Unpin' : 'Pin to top';
        pinBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 17v5"></path><path d="M5 3h14l-3 7v3l-4-2-4 2v-3L5 3z"></path></svg>';
        pinBtn.onclick = (e) => {
            e.stopPropagation();
            toggleTabPin(tab.id);
        };

        const editBtn = document.createElement('button');
        editBtn.className = 'icon-btn';
        editBtn.title = 'Rename';
        editBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>';
        editBtn.onclick = (e) => {
            e.stopPropagation();
            startInlineRename(tab.id);
        };

        const delBtn = document.createElement('button');
        delBtn.className = 'icon-btn delete';
        delBtn.title = 'Delete';
        delBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
        delBtn.onclick = (e) => {
            e.stopPropagation();
            deleteTab(tab.id);
        };

        actionsDiv.appendChild(pinBtn);
        actionsDiv.appendChild(editBtn);
        actionsDiv.appendChild(delBtn);

        li.appendChild(handle);
        li.appendChild(bodyDiv);
        li.appendChild(actionsDiv);
        tabListEl.appendChild(li);
    });

    const activeTab = tabs.find(t => t.id === activeTabId);
    if (activeTab) {
        currentTabTitle.textContent = activeTab.name;
        inputArea.value = activeTab.input;
        outputArea.value = activeTab.output;

        outputHistory = [];
        saveOutputState();
        syncVisuals();
        updateStats();
        setSaveStatus('saved', 'Autosaved');
    }
}

function switchTab(id) {
    if (!id) return;
    updateCurrentTabData();
    activeTabId = id;
    
    // Lazy load tab content
    const tab = getTabById(id);
    if (tab) {
        inputArea.value = tab.input || '';
        outputArea.value = tab.output || '';
        syncVisuals();
        updateStats();
    }
    
    saveState();
    renderTabs();
}

function renderTabsVirtual() {
    tabListEl.innerHTML = '';
    tabListEl.classList.add('virtual-scroll');
    
    // Create viewport and content containers
    const viewport = document.createElement('div');
    viewport.className = 'tab-list-viewport';
    
    const content = document.createElement('div');
    content.className = 'tab-list-content';
    content.style.height = (tabs.length * 80) + 'px';
    
    viewport.appendChild(content);
    tabListEl.appendChild(viewport);
    
    const itemHeight = 80;
    const visibleCount = Math.ceil(tabListEl.offsetHeight / itemHeight) + 5;
    
    const renderVisibleItems = () => {
        const scrollTop = viewport.scrollTop;
        const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - 2);
        const endIndex = Math.min(startIndex + visibleCount + 4, tabs.length);
        
        content.innerHTML = '';
        for (let i = startIndex; i < endIndex; i++) {
            const tab = tabs[i];
            if (!tab) continue;
            
            const li = createTabElement(tab);
            li.style.position = 'absolute';
            li.style.top = (i * itemHeight) + 'px';
            li.style.width = '100%';
            content.appendChild(li);
        }
    };
    
    viewport.addEventListener('scroll', () => {
        requestAnimationFrame(renderVisibleItems);
    });
    
    renderVisibleItems();
}

function createTabElement(tab) {
    const li = document.createElement('li');
    li.className = `tab-item ${tab.id === activeTabId ? 'active' : ''}`;
    if (tab.pinned) li.classList.add('pinned');
    if (tab.id === movedTabHighlightId) li.classList.add('just-moved');
    li.dataset.tabId = tab.id;
    li.draggable = true;
    
    li.addEventListener('click', (e) => {
        if (Date.now() < suppressTabClickUntil) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        switchTab(tab.id);
    });
    
    li.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        contextMenuTargetTabId = tab.id;
        showContextMenu(tabContextMenu, e.clientX, e.clientY);
    });
    
    li.addEventListener('dragstart', (e) => {
        draggedTabId = tab.id;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', tab.id);
        li.style.opacity = '0.5';
    });
    
    li.addEventListener('dragend', () => {
        draggedTabId = null;
        li.style.opacity = '1';
    });

    const handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'tab-drag-handle';
    handle.title = 'Drag to reorder';
    handle.setAttribute('aria-label', 'Drag to reorder');
    handle.innerHTML = '<span></span><span></span><span></span><span></span><span></span><span></span>';

    const bodyDiv = document.createElement('div');
    bodyDiv.className = 'tab-body';

    const titleRow = document.createElement('div');
    titleRow.className = 'tab-title-row';

    const nameWrap = document.createElement('div');
    nameWrap.className = 'tab-name-wrap';
    nameWrap.title = tab.name;

    const accountCount = getTabAccountCount(tab);

    if (inlineRenamingTabId === tab.id) {
        const nameInput = document.createElement('input');
        nameInput.className = 'tab-name-input';
        nameInput.value = tab.name;
        nameInput.addEventListener('click', (e) => e.stopPropagation());
        nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') finishInlineRename(tab.id, nameInput.value, true);
            if (e.key === 'Escape') finishInlineRename(tab.id, tab.name, false);
        });
        nameInput.addEventListener('blur', () => finishInlineRename(tab.id, nameInput.value, true));
        nameWrap.appendChild(nameInput);
        requestAnimationFrame(() => {
            nameInput.focus();
            nameInput.select();
        });
    } else {
        const nameSpan = document.createElement('span');
        nameSpan.className = 'tab-name';
        nameSpan.textContent = tab.name;
        nameSpan.title = `${tab.name}\nDouble-click to rename`;
        nameSpan.addEventListener('dblclick', (e) => {
            e.preventDefault();
            e.stopPropagation();
            startInlineRename(tab.id);
        });
        nameWrap.appendChild(nameSpan);
    }

    if (accountCount > 0) {
        const badge = document.createElement('span');
        badge.className = 'tab-badge';
        badge.textContent = accountCount;
        nameWrap.appendChild(badge);
    }

    const metaRow = document.createElement('div');
    metaRow.className = 'tab-meta';
    const countLabel = accountCount === 1 ? '1 account' : `${accountCount} accounts`;
    metaRow.textContent = `${countLabel} • Edited ${formatRelativeTime(tab.lastEdited)}`;

    titleRow.appendChild(nameWrap);
    bodyDiv.appendChild(titleRow);
    bodyDiv.appendChild(metaRow);

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'tab-actions';

    const pinBtn = document.createElement('button');
    pinBtn.className = `icon-btn pin-btn ${tab.pinned ? 'active' : ''}`;
    pinBtn.title = tab.pinned ? 'Unpin' : 'Pin to top';
    pinBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 17v5"></path><path d="M5 3h14l-3 7v3l-4-2-4 2v-3L5 3z"></path></svg>';
    pinBtn.onclick = (e) => {
        e.stopPropagation();
        toggleTabPin(tab.id);
    };

    const editBtn = document.createElement('button');
    editBtn.className = 'icon-btn';
    editBtn.title = 'Rename';
    editBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>';
    editBtn.onclick = (e) => {
        e.stopPropagation();
        startInlineRename(tab.id);
    };

    const delBtn = document.createElement('button');
    delBtn.className = 'icon-btn delete';
    delBtn.title = 'Delete';
    delBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
    delBtn.onclick = (e) => {
        e.stopPropagation();
        deleteTab(tab.id);
    };

    actionsDiv.appendChild(pinBtn);
    actionsDiv.appendChild(editBtn);
    actionsDiv.appendChild(delBtn);

    li.appendChild(handle);
    li.appendChild(bodyDiv);
    li.appendChild(actionsDiv);
    
    return li;
}

function addTab(name = 'New List') {
    updateCurrentTabData();
    const newTab = {
        id: 'tab-' + Date.now(),
        name: name,
        input: '',
        output: '',
        pinned: false,
        lastEdited: Date.now()
    };
    tabs.push(newTab);
    activeTabId = newTab.id;
    saveState();
    renderTabs();
}

function deleteTab(id) {
    tabToDelete = id;
    deleteModal.classList.remove('hidden');
}

function closeDeleteModal() {
    deleteModal.classList.add('hidden');
    tabToDelete = null;
}

confirmDeleteBtn.onclick = () => {
    if (tabToDelete) {
        const deletedIndex = tabs.findIndex(t => t.id === tabToDelete);
        const deletedTab = createTabSnapshot(tabs[deletedIndex]);
        const previousActiveTabId = activeTabId;
        tabs = tabs.filter(t => t.id !== tabToDelete);
        if (activeTabId === tabToDelete) {
            activeTabId = tabs[0] ? tabs[0].id : null;
        }
        saveState();
        renderTabs();
        showUndoToast('List deleted', () => {
            if (!deletedTab) return;
            tabs.splice(Math.max(0, deletedIndex), 0, normalizeTab(deletedTab));
            activeTabId = previousActiveTabId && getTabById(previousActiveTabId) ? previousActiveTabId : deletedTab.id;
            saveState();
            renderTabs();
        });
    }
    closeDeleteModal();
};

cancelDeleteBtn.onclick = closeDeleteModal;

archiveDeleteBtn.onclick = () => {
    if (tabToDelete) {
        const tab = getTabById(tabToDelete);
        if (tab) {
            const tabId = tabToDelete; // Store ID before clearing
            closeDeleteModal();
            openArchiveModal('tab', tabId, tab.name);
        }
    }
};

deleteModal.addEventListener('click', (e) => {
    if (e.target === deleteModal) closeDeleteModal();
});

function updateCurrentTabData() {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (activeTab) {
        const inputChanged = activeTab.input !== inputArea.value;
        const outputChanged = activeTab.output !== outputArea.value;
        if (inputChanged || outputChanged) {
            activeTab.input = inputArea.value;
            activeTab.output = outputArea.value;
            activeTab.lastEdited = Date.now();
            saveState();
        }
    }
}

function openRenameModal(id) {
    tabToRename = tabs.find(t => t.id === id);
    if (tabToRename) {
        renameInput.value = tabToRename.name;
        renameModal.classList.remove('hidden');
        renameInput.focus();
        renameInput.select();
    }
}

function closeRenameModal() {
    renameModal.classList.add('hidden');
    tabToRename = null;
}

saveRenameBtn.onclick = () => {
    if (tabToRename && renameInput.value.trim()) {
        tabToRename.name = renameInput.value.trim();
        saveState();
        renderTabs();
    }
    closeRenameModal();
};

cancelRenameBtn.onclick = closeRenameModal;
renameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveRenameBtn.click();
    if (e.key === 'Escape') closeRenameModal();
});

renameModal.addEventListener('click', (e) => {
    if (e.target === renameModal) closeRenameModal();
});

let isFullscreen = localStorage.getItem(getWorkspaceStorageKey('multiCheckFullscreen')) === 'true';

function updateFullscreenState() {
    if (isFullscreen) {
        editorContainer.classList.add('fullscreen-output');
        toggleFullscreenBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path></svg>';
    } else {
        editorContainer.classList.remove('fullscreen-output');
        toggleFullscreenBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>';
    }
}

toggleFullscreenBtn.onclick = () => {
    isFullscreen = !isFullscreen;
    localStorage.setItem(getWorkspaceStorageKey('multiCheckFullscreen'), isFullscreen);
    updateFullscreenState();
};

updateFullscreenState();

if (dashboardBtn) {
    dashboardBtn.onclick = () => {
        window.location.href = 'dashboard.html';
    };
}

addTabBtn.onclick = () => addTab();

inputArea.addEventListener('input', () => {
    setSaveStatus(activeTabId ? 'saving' : 'idle');
    updateCurrentTabData();
    updateLineNumbers(inputArea, inputLines);
});

inputArea.addEventListener('scroll', () => {
    syncScroll(inputArea, inputLines);
});

outputArea.addEventListener('input', () => {
    setSaveStatus(activeTabId ? 'saving' : 'idle');
    updateCurrentTabData();
    updateOutputLineNumbers();
    updateMirror();
    updateStats();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(saveOutputState, 500);
});

outputArea.addEventListener('scroll', () => {
    syncScroll(outputArea, outputLines);
});

// Highlight all occurrences of selected text in the mirror
function clearMatchHighlights() {
    outputMirror.querySelectorAll('.match-highlight').forEach(el => el.classList.remove('match-highlight'));
}

function applyMatchHighlights() {
    clearMatchHighlights();
    const start = outputArea.selectionStart;
    const end = outputArea.selectionEnd;
    if (start === end) return; // no selection

    const selected = outputArea.value.substring(start, end).trim();
    if (selected.length < 2) return; // too short to be meaningful

    const selectedLower = selected.toLowerCase();
    outputMirror.querySelectorAll('span[data-value]').forEach(span => {
        const val = (span.getAttribute('data-value') || '').toLowerCase();
        if (val === selectedLower) {
            span.classList.add('match-highlight');
        }
    });
}

outputArea.addEventListener('mouseup', applyMatchHighlights);
outputArea.addEventListener('keyup', (e) => {
    if (e.shiftKey || e.key === 'Shift') applyMatchHighlights();
    else if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') clearMatchHighlights();
});
outputArea.addEventListener('blur', clearMatchHighlights);

// Button group collapse/expand functionality
const groupToggles = document.querySelectorAll('.group-toggle');
groupToggles.forEach(toggle => {
    toggle.addEventListener('click', () => {
        const groupName = toggle.getAttribute('data-group');
        const buttonsContainer = document.getElementById(groupName + '-buttons');
        if (buttonsContainer) {
            buttonsContainer.classList.toggle('collapsed');
            // Save collapse state to localStorage
            const isCollapsed = buttonsContainer.classList.contains('collapsed');
            localStorage.setItem(getWorkspaceStorageKey('multiCheckGroup_' + groupName), isCollapsed);
        }
    });
});

// Restore collapse state on load
groupToggles.forEach(toggle => {
    const groupName = toggle.getAttribute('data-group');
    const buttonsContainer = document.getElementById(groupName + '-buttons');
    if (buttonsContainer) {
        const wasCollapsed = localStorage.getItem(getWorkspaceStorageKey('multiCheckGroup_' + groupName)) === 'true';
        if (wasCollapsed) {
            buttonsContainer.classList.add('collapsed');
        }
    }
});

const shortcutBtns = document.querySelectorAll('.shortcut-btn[data-text]');
shortcutBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const textToInsert = ' ' + btn.getAttribute('data-text');
        const start = outputArea.selectionStart;
        const end = outputArea.selectionEnd;
        const value = outputArea.value;

        outputArea.value = value.substring(0, start) + textToInsert + value.substring(end);

        outputArea.selectionStart = outputArea.selectionEnd = start + textToInsert.length;
        outputArea.focus();
        updateCurrentTabData();
        saveOutputState();
        updateOutputLineNumbers();
        updateMirror();
        if (typeof updateStats === 'function') updateStats();
    });
});

// Keyboard Hotkeys Toggle
const kbdToggle = document.getElementById('kbd-shortcuts-toggle');
const kbdLabel = document.getElementById('kbd-shortcuts-label');

const kbdShortcutMap = {
    '`': '(T)',
    'ذ': '(T)',
    '1': '(Non-RP) !!',
    '2': '(Fail-RP) !!',
    '3': '(Provoking) !!',
    '4': '(GR3.1) !!',
    '5': '(GR3.2) !!',
    "6": "(DM) !!",
    "7": "(GR 5.3) !!"
};

const kbdGrieferShortcutMap = {
    '1': 'Non-RP !!',
    '2': 'Fail-RP !!',
    '3': 'Provoking !!',
    '4': 'GR3.1 !!',
    '5': 'GR3.2 !!',
    "6": "DM !!",
    "7": "GR 5.3 !!"
};

function applyKbdToggleStyle() {
    if (!kbdLabel) return;
    if (kbdToggle && kbdToggle.checked) {
        kbdLabel.style.color = 'var(--primary-color)';
        kbdLabel.style.borderColor = 'var(--primary-color)';
        kbdLabel.style.background = 'rgba(79,70,229,0.12)';
    } else {
        kbdLabel.style.color = 'var(--text-muted)';
        kbdLabel.style.borderColor = 'transparent';
        kbdLabel.style.background = 'transparent';
    }
}

if (kbdToggle) {
    kbdToggle.checked = localStorage.getItem(getWorkspaceStorageKey('multiCheckKbdHotkeys')) === 'true';
    applyKbdToggleStyle();
    kbdToggle.addEventListener('change', (e) => {
        e.stopPropagation();
        localStorage.setItem(getWorkspaceStorageKey('multiCheckKbdHotkeys'), kbdToggle.checked);
        applyKbdToggleStyle();
    });
    // Prevent label click from bubbling
    kbdLabel?.addEventListener('click', (e) => {
        e.stopPropagation();
    });
}

outputArea.addEventListener('keydown', (e) => {
    if (!kbdToggle || !kbdToggle.checked) return;
    const key = e.key;

    // Handle ESC for revert
    if (key === 'Escape') {
        e.preventDefault();
        revertBtn.click();
        return;
    }

    // Handle TAB for (M) or M based on dropdown
    if (key === 'Tab') {
        e.preventDefault();
        const useNoParens = tagFormatMode === 'mt' || tagFormatMode === 'all';
        const textToInsert = useNoParens ? ' M' : ' (M)';
        const start = outputArea.selectionStart;
        const end = outputArea.selectionEnd;
        const value = outputArea.value;

        outputArea.value = value.substring(0, start) + textToInsert + value.substring(end);
        outputArea.selectionStart = outputArea.selectionEnd = start + textToInsert.length;
        outputArea.focus();
        updateCurrentTabData();
        saveOutputState();
        updateOutputLineNumbers();
        updateMirror();
        if (typeof updateStats === 'function') updateStats();
        return;
    }

    if (!kbdShortcutMap[key]) return;

    e.preventDefault();
    let textToInsert = ' ' + kbdShortcutMap[key];

    // For the ` key (T), respect the dropdown (no parens for mt or all)
    if (key === '`' || key === 'ذ') {
        const useNoParens = tagFormatMode === 'mt' || tagFormatMode === 'all';
        textToInsert = useNoParens ? ' T' : ' (T)';
    }

    // For griefer hotkeys (1-6), respect the dropdown (no parens only for all)
    if (kbdGrieferShortcutMap[key]) {
        const useNoParens = tagFormatMode === 'all';
        textToInsert = useNoParens ? ' ' + kbdGrieferShortcutMap[key] : ' ' + kbdShortcutMap[key];
    }
    const start = outputArea.selectionStart;
    const end = outputArea.selectionEnd;
    const value = outputArea.value;

    outputArea.value = value.substring(0, start) + textToInsert + value.substring(end);
    outputArea.selectionStart = outputArea.selectionEnd = start + textToInsert.length;
    outputArea.focus();
    updateCurrentTabData();
    saveOutputState();
    updateOutputLineNumbers();
    updateMirror();
    if (typeof updateStats === 'function') updateStats();
});

const mortBtn = document.getElementById('mort-btn');
mortBtn.addEventListener('click', () => {
    let text = outputArea.value;
    if (!text.trim()) return;

    const lines = text.split('\n');
    const blocks = [];
    let currentBlock = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim() === '') {
            if (currentBlock.length > 0) {
                blocks.push(currentBlock);
                currentBlock = [];
            }
            blocks.push([line]);
        } else {
            currentBlock.push(line);
        }
    }
    if (currentBlock.length > 0) blocks.push(currentBlock);

    const newLines = [];
    for (const block of blocks) {
        const isUserBlock = block.some(line => line.includes('|'));

        if (isUserBlock) {
            let lowestId = Infinity;
            for (const line of block) {
                const match = line.match(/\|\s*(\d+)/);
                if (match) {
                    const id = parseInt(match[1], 10);
                    if (id < lowestId) lowestId = id;
                }
            }

            for (const line of block) {
                const match = line.match(/\|\s*(\d+)/);
                if (match) {
                    const id = parseInt(match[1], 10);
                    let cleanLine = line.replace(/\s*\([MT]\)/g, '').replace(/\s*\([MT]\s*\)/g, '').replace(/\s*M\s*$/g, '').replace(/\s*T\s*$/g, '').replace(/\s*\( M \)/g, '').replace(/\s*\( T \)/g, '').replace(/\s*\(\d+\s+days\)/g, '');
                    const tagFormat = ' ';
                    const useNoParens = tagFormatMode === 'mt' || tagFormatMode === 'all';
                    if (id === lowestId) {
                        newLines.push(cleanLine + tagFormat + (useNoParens ? 'M' : '(M)'));
                    } else {
                        newLines.push(cleanLine + tagFormat + (useNoParens ? 'T' : '(T)'));
                    }
                } else {
                    newLines.push(line);
                }
            }
        } else {
            newLines.push(...block);
        }
    }

    outputArea.value = newLines.join('\n');
    updateCurrentTabData();
    saveOutputState();
    updateOutputLineNumbers();
    updateMirror();
    if (typeof updateStats === 'function') updateStats();
});

const serialIdsBtn = document.getElementById('serial-ids-btn');
if (serialIdsBtn) {
    serialIdsBtn.addEventListener('click', () => {
        let text = outputArea.value;
        if (!text.trim()) return;

        const lines = text.split('\n');
        const newLines = [];
        let currentSerial = null;
        let currentBlock = [];
        let serialIdsMap = new Map();

        // First pass: collect IDs for each serial
        for (const line of lines) {
            const serialMatch = line.match(/^([A-Fa-f0-9]{32})/);
            if (serialMatch) {
                // Process previous block
                if (currentSerial && currentBlock.length > 0) {
                    const ids = [];
                    for (const blockLine of currentBlock) {
                        const match = blockLine.match(/\|\s*(\d+)/);
                        if (match) {
                            const id = match[1];
                            // Check if line has M or T tag (any format)
                            const hasM = blockLine.includes('(M)') || blockLine.match(/M\s*$/) || blockLine.includes('( M )');
                            const hasT = blockLine.includes('(T)') || blockLine.match(/T\s*$/) || blockLine.includes('( T )');
                            if (hasM || hasT) {
                                ids.push(id);
                            }
                        }
                    }
                    if (ids.length > 0) {
                        serialIdsMap.set(currentSerial, ids);
                    }
                }
                currentSerial = serialMatch[1];
                currentBlock = [];
            } else if (line.includes('|')) {
                currentBlock.push(line);
            }
        }

        // Process last block
        if (currentSerial && currentBlock.length > 0) {
            const ids = [];
            for (const blockLine of currentBlock) {
                const match = blockLine.match(/\|\s*(\d+)/);
                if (match) {
                    const id = match[1];
                    const hasM = blockLine.includes('(M)') || blockLine.match(/M\s*$/) || blockLine.includes('( M )');
                    const hasT = blockLine.includes('(T)') || blockLine.match(/T\s*$/) || blockLine.includes('( T )');
                    if (hasM || hasT) {
                        ids.push(id);
                    }
                }
            }
            if (ids.length > 0) {
                serialIdsMap.set(currentSerial, ids);
            }
        }

        // Second pass: add IDs to serial lines
        for (const line of lines) {
            const serialMatch = line.match(/^([A-Fa-f0-9]{32})(.*)$/);
            if (serialMatch) {
                const serial = serialMatch[1];
                const restOfLine = serialMatch[2];
                const ids = serialIdsMap.get(serial);
                if (ids && ids.length > 0) {
                    newLines.push(serial + restOfLine + ' [ ' + ids.join(', ') + ' ]');
                } else {
                    newLines.push(line);
                }
            } else {
                newLines.push(line);
            }
        }

        outputArea.value = newLines.join('\n');
        updateCurrentTabData();
        saveOutputState();
        updateOutputLineNumbers();
        updateMirror();
        if (typeof updateStats === 'function') updateStats();
    });
}

const rankAgeBtn = document.getElementById('rank-age-btn');
if (rankAgeBtn) {
    rankAgeBtn.addEventListener('click', () => {
        let text = outputArea.value;
        if (!text.trim()) return;

        let start = outputArea.selectionStart;
        let end = outputArea.selectionEnd;
        let isSelection = start !== end;

        let targetText = isSelection ? text.substring(start, end) : text;

        const lines = targetText.split('\n');

        // Check if we are removing or adding.
        // We use a zero-width space (\u200B) to safely tag ranked lines.
        const isRemoving = lines.some(line => line.includes('\u200B'));

        const blocks = [];
        let currentBlock = [];

        // Split into blocks by empty line or serial line
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.trim() === '') {
                if (currentBlock.length > 0) blocks.push(currentBlock);
                blocks.push([line]);
                currentBlock = [];
            } else if (/^[A-Fa-f0-9]{32}$/.test(line.trim())) {
                if (currentBlock.length > 0) blocks.push(currentBlock);
                currentBlock = [line];
            } else {
                currentBlock.push(line);
            }
        }
        if (currentBlock.length > 0) blocks.push(currentBlock);

        const newLines = [];
        for (const block of blocks) {
            const isUserBlock = block.some(line => line.includes('|'));

            if (isUserBlock) {
                let ids = [];
                if (!isRemoving) {
                    for (const line of block) {
                        const match = line.match(/\|\s*(\d+)/);
                        if (match) ids.push(parseInt(match[1], 10));
                    }
                    ids = [...new Set(ids)].sort((a, b) => a - b);
                }

                for (const line of block) {
                    const match = line.match(/\|\s*(\d+)/);
                    if (match) {
                        let cleanLine = line.replace(/\u200B\s*\d+(\s+oldest)?/i, '');
                        if (isRemoving) {
                            newLines.push(cleanLine);
                        } else {
                            const id = parseInt(match[1], 10);
                            const rank = ids.indexOf(id) + 1;
                            let rankText = rank === 1 ? '1 oldest' : rank.toString();
                            newLines.push(cleanLine + '\u200B ' + rankText);
                        }
                    } else {
                        newLines.push(line.replace(/\u200B\s*\d+(\s+oldest)?/i, ''));
                    }
                }
            } else {
                newLines.push(...block);
            }
        }

        const newTargetText = newLines.join('\n');

        if (isSelection) {
            outputArea.value = text.substring(0, start) + newTargetText + text.substring(end);
            outputArea.selectionStart = start;
            outputArea.selectionEnd = start + newTargetText.length;
        } else {
            outputArea.value = newTargetText;
        }

        outputArea.focus();
        updateCurrentTabData();
        saveOutputState();
        updateOutputLineNumbers();
        updateMirror();
        if (typeof updateStats === 'function') updateStats();
    });
}

processBtn.onclick = () => {
    const rawData = inputArea.value;
    if (!rawData.trim()) return;

    const result = processData(rawData);
    outputArea.value = result;
    updateCurrentTabData();
    saveOutputState();
    syncVisuals();
    updateStats();
};

// Stats Bar logic
const statsBar = document.getElementById('stats-bar');
const toggleStatsBtn = document.getElementById('toggle-stats-btn');
let statsVisible = localStorage.getItem(getWorkspaceStorageKey('multiCheckStats')) !== 'false';

const grieferAlertBar = document.getElementById('griefer-alert-bar');
const grieferCountEl = document.getElementById('griefer-count');
const grieferCopyBtn = document.getElementById('griefer-copy-btn');
const grieferTags = ['(Non-RP)', '(Fail-RP)', '(Provoking)', '(GR3.1)', '(GR3.2)', "(DM)"];
let currentGrieferLines = [];
let currentGrieferBlocks = '';

function checkGrieferAlert() {
    if (!grieferAlertBar) return;
    const text = outputArea.value;
    const lines = text.split('\n');
    let totalScore = 0;
    currentGrieferLines = [];
    currentGrieferBlocks = '';

    let currentSerial = '';
    const blocksMap = new Map();

    for (const line of lines) {
        if (!line.trim()) continue;

        if (/^[A-Fa-f0-9]{32}$/.test(line.trim())) {
            currentSerial = line.trim();
            continue;
        }

        const upperLine = line.toUpperCase();
        let hasTag = false;
        for (const tag of grieferTags) {
            // Check both with and without parentheses, and with/without !! suffix
            const tagWithParens = tag.toUpperCase();
            const tagWithoutParens = tag.replace(/[()]/g, '').toUpperCase();
            const tagWithoutParensNoSuffix = tagWithoutParens.replace(' !!', '').trim();
            if (upperLine.includes(tagWithParens) || upperLine.includes(tagWithoutParens) || upperLine.includes(tagWithoutParensNoSuffix)) {
                hasTag = true;
                break;
            }
        }

        if (hasTag) {
            currentGrieferLines.push(line.trim());
            totalScore += 1;

            if (currentSerial) {
                if (!blocksMap.has(currentSerial)) blocksMap.set(currentSerial, []);
                blocksMap.get(currentSerial).push(line.trim());
            }
        }
    }

    blocksMap.forEach((gLines, serial) => {
        currentGrieferBlocks += serial + '\n' + gLines.join('\n') + '\n\n';
    });
    currentGrieferBlocks = currentGrieferBlocks.trim();

    if (totalScore >= 10) {
        grieferCountEl.textContent = totalScore;
        grieferAlertBar.style.display = 'flex';
    } else {
        grieferAlertBar.style.display = 'none';
    }
}

const grieferCopyAccountsBtn = document.getElementById('griefer-copy-accounts-btn');
if (grieferCopyAccountsBtn) {
    grieferCopyAccountsBtn.onclick = () => {
        if (currentGrieferBlocks) {
            robustCopy(currentGrieferBlocks, () => {
                const orig = grieferCopyAccountsBtn.textContent;
                grieferCopyAccountsBtn.textContent = 'Copied!';
                setTimeout(() => grieferCopyAccountsBtn.textContent = orig, 2000);
            });
        }
    };
}

const grieferCopyIdsBtn = document.getElementById('griefer-copy-ids-btn');
if (grieferCopyIdsBtn) {
    grieferCopyIdsBtn.onclick = () => {
        if (currentGrieferLines.length > 0) {
            const ids = [];
            for (const line of currentGrieferLines) {
                const match = line.match(/\|\s*(\d+)/);
                if (match) {
                    ids.push(match[1]);
                }
            }
            if (ids.length > 0) {
                robustCopy(ids.join(', ') + ',', () => {
                    const orig = grieferCopyIdsBtn.textContent;
                    grieferCopyIdsBtn.textContent = 'Copied!';
                    setTimeout(() => grieferCopyIdsBtn.textContent = orig, 2000);
                });
            }
        }
    };
}

const grieferCopyCleanBtn = document.getElementById('griefer-copy-clean-btn');
if (grieferCopyCleanBtn) {
    grieferCopyCleanBtn.onclick = () => {
        const text = outputArea.value;
        const lines = text.split('\n');
        const grieferTags = ['(Non-RP)', '(Fail-RP)', '(Provoking)', '(GR3.1)', '(GR3.2)', '(DM)'];
        
        const cleanedLines = lines.map(line => {
            let cleanedLine = line;
            grieferTags.forEach(tag => {
                // Remove tag and any following "!!" with flexible spacing
                const regex = new RegExp(escapeRegExp(tag) + '\\s*!!', 'gi');
                cleanedLine = cleanedLine.replace(regex, '');
            });
            // Clean up extra spaces
            cleanedLine = cleanedLine.replace(/\s+/g, ' ').trim();
            return cleanedLine;
        });
        
        const cleanedText = cleanedLines.join('\n');
        const useCodeBlocks = localStorage.getItem(getWorkspaceStorageKey('multiCheckCodeBlocks')) !== 'false';
        const finalText = useCodeBlocks ? '```\n' + cleanedText + '\n```' : cleanedText;
        
        robustCopy(finalText, () => {
            const orig = grieferCopyCleanBtn.textContent;
            grieferCopyCleanBtn.textContent = 'Copied!';
            setTimeout(() => grieferCopyCleanBtn.textContent = orig, 2000);
        });
    };
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

if (grieferCopyBtn) {
    grieferCopyBtn.onclick = () => {
        if (currentGrieferLines.length > 0) {
            robustCopy(currentGrieferLines.join('\n'), () => {
                const orig = grieferCopyBtn.textContent;
                grieferCopyBtn.textContent = 'Copied!';
                setTimeout(() => grieferCopyBtn.textContent = orig, 2000);
            });
        }
    };
}

function updateStats() {
    checkGrieferAlert();
    if (!statsVisible) return;
    const text = outputArea.value;
    if (!text.trim()) {
        statsBar.style.display = 'none';
        return;
    }
    const lines = text.split('\n').filter(l => l.trim());
    let mCount = 0, tCount = 0, serialCount = 0, occurrencesCount = 0, grieferCount = 0;
    const uniqueIds = new Set();
    const grieferTags = ['(Non-RP)', '(Fail-RP)', '(Provoking)', '(GR3.1)', '(GR3.2)', '(DM)'];
    const grieferIds = new Set();

    for (const line of lines) {
        const t = line.trim();
        // Count as serial if line starts with 32 hex chars (allows text after)
        if (/^[A-Fa-f0-9]{32}/.test(t)) { serialCount++; continue; }
        if (t.includes('|')) {
            occurrencesCount++;
            const match = t.match(/\|\s*(\d+)/);
            if (match) {
                uniqueIds.add(match[1]);
            }
            // Count both (M)/(T), M/T, and ( M )/( T ) formats
            if (t.includes('(M)') || t.match(/M\s*$/) || t.includes('( M )')) mCount++;
            else if (t.includes('(T)') || t.match(/T\s*$/) || t.includes('( T )')) tCount++;
            
            // Check for griefer tags (both with and without parentheses)
            const upperLine = t.toUpperCase();
            const hasGrieferTag = grieferTags.some(tag => {
                const tagWithParens = tag.toUpperCase();
                const tagWithoutParens = tag.replace(/[()]/g, '').toUpperCase();
                // Also check for format without !! suffix
                const tagWithoutParensNoSuffix = tagWithoutParens.replace(' !!', '').trim();
                return upperLine.includes(tagWithParens) || upperLine.includes(tagWithoutParens) || upperLine.includes(tagWithoutParensNoSuffix);
            });
            if (hasGrieferTag && match) {
                grieferIds.add(match[1]);
            }
        }
    }
    grieferCount = grieferIds.size;
    
    const textSize = new Blob([text]).size;
    const textSizeFormatted = textSize < 1024 ? `${textSize} B` : `${(textSize / 1024).toFixed(1)} KB`;
    
    const hasData = occurrencesCount > 0 || serialCount > 0;
    statsBar.style.display = hasData ? 'flex' : 'none';
    if (hasData) {
        document.getElementById('stats-accounts').innerHTML = `Accounts: <strong>${uniqueIds.size > 0 ? uniqueIds.size : occurrencesCount}</strong>`;
        document.getElementById('stats-m').innerHTML = `M: <strong>${mCount}</strong>`;
        document.getElementById('stats-t').innerHTML = `T: <strong>${tCount}</strong>`;
        document.getElementById('stats-serials').innerHTML = `Serials: <strong>${serialCount}</strong>`;
        document.getElementById('stats-griefers').innerHTML = `Griefers: <strong style="color: ${grieferCount > 0 ? '#ef4444' : 'inherit'}">${grieferCount}</strong>`;
        document.getElementById('stats-size').innerHTML = `Size: <strong>${textSizeFormatted}</strong>`;
    }
}

function applyStatsToggle() {
    if (statsVisible) {
        toggleStatsBtn.style.opacity = '1';
        toggleStatsBtn.style.color = 'var(--primary-color)';
        updateStats();
    } else {
        toggleStatsBtn.style.opacity = '0.5';
        toggleStatsBtn.style.color = '';
        statsBar.style.display = 'none';
    }
}

toggleStatsBtn.onclick = () => {
    statsVisible = !statsVisible;
    localStorage.setItem(getWorkspaceStorageKey('multiCheckStats'), statsVisible);
    applyStatsToggle();
};

applyStatsToggle();

// Workspace Management UI
const workspaceModal = document.getElementById('workspace-modal');
const newWorkspaceName = document.getElementById('new-workspace-name');
const createWorkspaceBtn = document.getElementById('create-workspace-btn');
const workspaceModalCancel = document.getElementById('workspace-modal-cancel');

if (workspaceDropdownBtn) {
    workspaceDropdownBtn.addEventListener('click', () => {
        toggleWorkspaceDropdown();
    });
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (workspaceDropdownMenu && !workspaceDropdownMenu.contains(e.target) && !workspaceDropdownBtn.contains(e.target)) {
        toggleWorkspaceDropdown(false);
    }
    
    // Hide context menus when clicking outside
    if (tabContextMenu && !tabContextMenu.contains(e.target)) {
        tabContextMenu.classList.add('hidden');
        if (tabCopySubmenu) tabCopySubmenu.classList.add('hidden');
        if (tabGroupSubmenu) tabGroupSubmenu.classList.add('hidden');
    }
    if (workspaceContextMenu && !workspaceContextMenu.contains(e.target)) {
        workspaceContextMenu.classList.add('hidden');
        if (workspaceCopySubmenu) workspaceCopySubmenu.classList.add('hidden');
    }
});

// Tab Context Menu Handlers
document.getElementById('ctx-rename-tab')?.addEventListener('click', () => {
    if (contextMenuTargetTabId) {
        startInlineRename(contextMenuTargetTabId);
    }
    hideAllContextMenus();
});

document.getElementById('ctx-duplicate-tab')?.addEventListener('click', () => {
    if (contextMenuTargetTabId) {
        duplicateTab(contextMenuTargetTabId);
    }
    hideAllContextMenus();
});

document.getElementById('ctx-export-tab')?.addEventListener('click', () => {
    if (contextMenuTargetTabId) {
        exportTab(contextMenuTargetTabId);
    }
    hideAllContextMenus();
});

document.getElementById('ctx-pin-tab')?.addEventListener('click', () => {
    if (contextMenuTargetTabId) {
        toggleTabPin(contextMenuTargetTabId);
    }
    hideAllContextMenus();
});

document.getElementById('ctx-delete-tab')?.addEventListener('click', () => {
    if (contextMenuTargetTabId) {
        deleteTab(contextMenuTargetTabId);
    }
    hideAllContextMenus();
});

document.getElementById('ctx-archive-tab')?.addEventListener('click', () => {
    if (contextMenuTargetTabId) {
        const tab = getTabById(contextMenuTargetTabId);
        if (tab) {
            openArchiveModal('tab', contextMenuTargetTabId, tab.name);
        }
    }
    hideAllContextMenus();
});

// Workspace Context Menu Handlers
document.getElementById('ctx-rename-workspace')?.addEventListener('click', () => {
    if (contextMenuTargetWorkspaceId) {
        startInlineWorkspaceRename(contextMenuTargetWorkspaceId);
    }
    hideAllContextMenus();
});

document.getElementById('ctx-switch-workspace')?.addEventListener('click', () => {
    if (contextMenuTargetWorkspaceId) {
        switchWorkspace(contextMenuTargetWorkspaceId);
        workspaceModal.classList.add('hidden');
    }
    hideAllContextMenus();
});

// Submenu hover handler for workspace context menu
const workspaceSubmenuItem = workspaceContextMenu?.querySelector('.submenu-item');
if (workspaceSubmenuItem && workspaceCopySubmenu) {
    const workspaceSubmenuContent = workspaceSubmenuItem.querySelector('.context-menu-item-content');
    
    workspaceSubmenuContent.addEventListener('mouseenter', () => {
        workspaceCopySubmenu.classList.remove('hidden');
    });
    
    workspaceSubmenuItem.addEventListener('mouseleave', () => {
        workspaceCopySubmenu.classList.add('hidden');
    });
    
    workspaceCopySubmenu.addEventListener('mouseenter', () => {
        workspaceCopySubmenu.classList.remove('hidden');
    });
    
    workspaceCopySubmenu.addEventListener('mouseleave', () => {
        workspaceCopySubmenu.classList.add('hidden');
    });
}

// Submenu hover handler for tab context menu
const tabSubmenuItems = tabContextMenu?.querySelectorAll('.submenu-item');
if (tabSubmenuItems) {
    tabSubmenuItems.forEach((submenuItem, index) => {
        const submenuContent = submenuItem.querySelector('.context-menu-item-content');
        const submenu = index === 0 ? tabCopySubmenu : tabGroupSubmenu;
        
        if (submenuContent && submenu) {
            submenuContent.addEventListener('mouseenter', () => {
                submenu.classList.remove('hidden');
            });
            
            submenuItem.addEventListener('mouseleave', () => {
                submenu.classList.add('hidden');
            });
            
            submenu.addEventListener('mouseenter', () => {
                submenu.classList.remove('hidden');
            });
            
            submenu.addEventListener('mouseleave', () => {
                submenu.classList.add('hidden');
            });
        }
    });
}

document.getElementById('ctx-delete-workspace')?.addEventListener('click', () => {
    if (contextMenuTargetWorkspaceId) {
        const workspace = workspaces.find(w => w.id === contextMenuTargetWorkspaceId);
        if (workspace) {
            showConfirm('Delete Workspace', `Are you sure you want to delete "${workspace.name}"? All data in this workspace will be permanently lost.`, () => {
                deleteWorkspace(contextMenuTargetWorkspaceId);
            }, true);
        }
    }
    hideAllContextMenus();
});

if (manageWorkspacesBtn) {
    manageWorkspacesBtn.onclick = () => {
        renderWorkspaceList();
        workspaceModal.classList.remove('hidden');
    };
}

if (workspaceModalCancel) {
    workspaceModalCancel.onclick = () => {
        workspaceModal.classList.add('hidden');
        newWorkspaceName.value = '';
    };
}

if (createWorkspaceBtn) {
    createWorkspaceBtn.onclick = () => {
        const name = newWorkspaceName.value.trim();
        if (!name) {
            showAlert('Invalid Name', 'Please enter a workspace name.');
            return;
        }
        
        // Extract tags from name (e.g., "Server A #gaming #admin")
        const tagMatches = name.match(/#\w+/g);
        const tags = tagMatches || [];
        const cleanName = name.replace(/#\w+/g, '').trim();
        
        const newWorkspace = createWorkspace(cleanName, tags);
        if (newWorkspace) {
            newWorkspaceName.value = '';
            renderWorkspaceList();
            switchWorkspace(newWorkspace.id);
            showUndoToast(`Workspace "${newWorkspace.name}" created`, () => {
                deleteWorkspace(newWorkspace.id);
            });
        }
    };
}

if (workspaceModal) {
    workspaceModal.addEventListener('click', (e) => {
        if (e.target === workspaceModal) {
            workspaceModal.classList.add('hidden');
            newWorkspaceName.value = '';
        }
    });
}

// Initialize workspace UI
renderWorkspaceUI();

copyBtn.onclick = () => {
    let textToCopy = outputArea.value;
    if (discordCodeToggle && discordCodeToggle.checked) {
        textToCopy = '```\n' + textToCopy + '\n```';
    }

    robustCopy(textToCopy, () => {
        outputArea.select(); // Keep visual selection for user
        const originalText = copyBtn.innerText;
        copyBtn.innerText = 'Copied!';
        setTimeout(() => copyBtn.innerText = originalText, 2000);
    });
};

const copyIdsBtn = document.getElementById('copy-ids-btn');
if (copyIdsBtn) {
    copyIdsBtn.onclick = () => {
        const text = outputArea.value;
        const lines = text.split('\n').filter(l => l.trim());
        const uniqueIds = new Set();
        for (const line of lines) {
            const t = line.trim();
            if (t.includes('|')) {
                const match = t.match(/\|\s*(\d+)/);
                if (match) uniqueIds.add(match[1]);
            }
        }

        if (uniqueIds.size > 0) {
            const idsString = Array.from(uniqueIds).join(', ') + ',';
            robustCopy(idsString, () => {
                const originalText = copyIdsBtn.innerText;
                copyIdsBtn.innerText = 'Copied!';
                setTimeout(() => copyIdsBtn.innerText = originalText, 2000);
            });
        } else {
            const originalText = copyIdsBtn.innerText;
            copyIdsBtn.innerText = 'No IDs found';
            setTimeout(() => copyIdsBtn.innerText = originalText, 2000);
        }
    };
}

const copyMtIdsBtn = document.getElementById('copy-mt-ids-btn');
if (copyMtIdsBtn) {
    copyMtIdsBtn.onclick = () => {
        const text = outputArea.value;
        const lines = text.split('\n').filter(l => l.trim());
        const uniqueIds = new Set();
        for (const line of lines) {
            const t = line.trim();
            if (t.includes('|')) {
                const match = t.match(/\|\s*(\d+)/);
                if (match) {
                    // Check if line has M or T tag (any format)
                    const hasM = t.includes('(M)') || t.match(/M\s*$/) || t.includes('( M )');
                    const hasT = t.includes('(T)') || t.match(/T\s*$/) || t.includes('( T )');
                    if (hasM || hasT) {
                        uniqueIds.add(match[1]);
                    }
                }
            }
        }

        if (uniqueIds.size > 0) {
            const idsString = Array.from(uniqueIds).join(', ') + ',';
            robustCopy(idsString, () => {
                const originalText = copyMtIdsBtn.innerText;
                copyMtIdsBtn.innerText = 'Copied!';
                setTimeout(() => copyMtIdsBtn.innerText = originalText, 2000);
            });
        } else {
            const originalText = copyMtIdsBtn.innerText;
            copyMtIdsBtn.innerText = 'No M/T IDs';
            setTimeout(() => copyMtIdsBtn.innerText = originalText, 2000);
        }
    };
}

exportBtn.onclick = () => {
    const text = outputArea.value;
    if (!text) return;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const tabName = tabs.find(t => t.id === activeTabId)?.name || 'list';
    a.download = `${tabName}.txt`;
    a.click();
    URL.revokeObjectURL(url);
};

// Hover Copy Logic
const hoverCopyPopup = document.getElementById('hover-copy-popup');
const hoverCopyType = document.getElementById('hover-copy-type');
let currentHoverValue = null;
let currentHoverSpan = null;
let hidePopupTimeout;
let isMouseOverPopup = false;

function cancelHideHoverPopup() {
    if (hidePopupTimeout) {
        clearTimeout(hidePopupTimeout);
        hidePopupTimeout = null;
    }
}

function delayedHideHoverPopup(delay = 700) {
    cancelHideHoverPopup();
    hidePopupTimeout = setTimeout(() => {
        if (!isMouseOverPopup) hideHoverPopup();
        hidePopupTimeout = null;
    }, delay);
}

function hideHoverPopup() {
    if (isMouseOverPopup) return;
    hoverCopyPopup.classList.add('hidden');
    currentHoverValue = null;
    if (currentHoverSpan) {
        currentHoverSpan.classList.remove('hovered');
        currentHoverSpan = null;
    }
    cancelHideHoverPopup();
}

// Track mouse entering/leaving the popup itself
hoverCopyPopup.addEventListener('mouseenter', () => {
    isMouseOverPopup = true;
    cancelHideHoverPopup();
});

hoverCopyPopup.addEventListener('mouseleave', () => {
    isMouseOverPopup = false;
    delayedHideHoverPopup(400);
});

outputArea.addEventListener('mousemove', (e) => {
    if (!hoverCopyEnabled) return;

    const elements = document.elementsFromPoint(e.clientX, e.clientY);
    let hoveredSpan = null;
    for (let el of elements) {
        if (el.tagName === 'SPAN' && el.parentElement === outputMirror) {
            hoveredSpan = el;
            break;
        }
    }

    if (hoveredSpan) {
        cancelHideHoverPopup();

        if (currentHoverSpan !== hoveredSpan) {
            if (currentHoverSpan) currentHoverSpan.classList.remove('hovered');
            currentHoverSpan = hoveredSpan;
            currentHoverSpan.classList.add('hovered');

            const type = hoveredSpan.getAttribute('data-type');
            const value = hoveredSpan.getAttribute('data-value');

            currentHoverValue = value;
            hoverCopyType.textContent = type;

            hoverCopyPopup.classList.remove('hidden');
            hoverCopyPopup.classList.remove('flipped');

            requestAnimationFrame(() => {
                const popupWidth = hoverCopyPopup.offsetWidth;
                const popupHeight = hoverCopyPopup.offsetHeight;
                const spanRect = hoveredSpan.getBoundingClientRect();

                let left = spanRect.left + (spanRect.width / 2) - (popupWidth / 2);
                let top = spanRect.top - popupHeight - 8;

                if (top < 10) {
                    top = spanRect.bottom + 8;
                    hoverCopyPopup.classList.add('flipped');
                }
                if (left < 10) left = 10;
                const maxLeft = window.innerWidth - popupWidth - 10;
                if (left > maxLeft) left = maxLeft;

                hoverCopyPopup.style.left = `${left}px`;
                hoverCopyPopup.style.top = `${top}px`;
            });
        }
    } else {
        // Mouse drifted off a span but DON'T clear highlight or hide immediately.
        // Give a generous window so user can reach the popup.
        delayedHideHoverPopup(700);
    }
});

outputArea.addEventListener('mouseleave', (e) => {
    // Only hide if mouse is NOT going to the popup
    if (!isMouseOverPopup) {
        delayedHideHoverPopup(700);
    }
});

outputArea.addEventListener('scroll', () => {
    outputMirror.scrollTop = outputArea.scrollTop;
    outputMirror.scrollLeft = outputArea.scrollLeft;
    if (!isMouseOverPopup) hideHoverPopup();
});

hoverCopyPopup.addEventListener('click', () => {
    if (currentHoverValue) {
        let textToCopy = currentHoverValue;
        const toggle = document.getElementById('underscore-names-toggle');
        if (toggle && toggle.checked && hoverCopyType.textContent === 'Name') {
            textToCopy = textToCopy.replace(/ /g, '_');
        }
        robustCopy(textToCopy, () => {
            const savedInner = hoverCopyType.textContent;
            hoverCopyType.textContent = '✓ Copied!';
            setTimeout(() => {
                hoverCopyType.textContent = savedInner;
                isMouseOverPopup = false;
                hideHoverPopup();
            }, 1200);
        });
    }
});

// Ban Generator Logic
const viewToggleBtn = document.getElementById('view-toggle-btn');
const multiCheckerView = document.getElementById('editor-container');
const banGeneratorView = document.getElementById('ban-generator-view');
const pageStateIndicator = document.getElementById('page-state-indicator');

let currentView = 'multi';

function updatePageStateIndicator() {
    if (pageStateIndicator) {
        pageStateIndicator.textContent = currentView === 'multi' ? 'Multi Checker' : 'Ban Generator';
    }
}

viewToggleBtn.onclick = () => {
    if (currentView === 'multi') {
        // Check if there's an active tab before switching to ban generator
        if (!activeTabId || tabs.length === 0) {
            showAlert('No List Selected', 'Please create or select a list before using the Ban Generator.');
            return;
        }
        currentView = 'bans';
        multiCheckerView.style.display = 'none';
        banGeneratorView.style.display = 'flex';
        viewToggleBtn.textContent = 'Switch to Multi-Checker';
    } else {
        currentView = 'multi';
        banGeneratorView.style.display = 'none';
        multiCheckerView.style.display = '';
        viewToggleBtn.textContent = 'Ban Generator';
    }
    updatePageStateIndicator();
    if (typeof saveBanGeneratorState === 'function') saveBanGeneratorState();
};

const BAN_PRESETS = [
    {
        id: 'griefing',
        name: "Multi Account Griefing",
        template: "/ban {name} {duration} Multi Account Griefing ( التخريب بعده حسابات ) {tag}"
    }
];

// Load custom presets from localStorage (global across all workspaces)
let customPresets = JSON.parse(localStorage.getItem('multiCheckCustomPresets') || '[]');

function saveCustomPresets() {
    localStorage.setItem('multiCheckCustomPresets', JSON.stringify(customPresets));
}

const banPresetBtn = document.getElementById('ban-preset-btn');
const banPresetLabel = document.getElementById('ban-preset-label');
const banPresetMenu = document.getElementById('ban-preset-menu');
let currentPresetId = BAN_PRESETS[0]?.id || '';

// Toggle preset dropdown
banPresetBtn.onclick = (e) => {
    e.stopPropagation();
    banPresetMenu.classList.toggle('hidden');
    banPresetBtn.classList.toggle('active');
    // Close duration dropdown if open
    banDurationMenu.classList.add('hidden');
    banDurationBtn.classList.remove('active');
};

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (!banPresetBtn.contains(e.target) && !banPresetMenu.contains(e.target)) {
        banPresetMenu.classList.add('hidden');
        banPresetBtn.classList.remove('active');
    }
});

// Duration dropdown
const banDurationBtn = document.getElementById('ban-duration-btn');
const banDurationLabel = document.getElementById('ban-duration-label');
const banDurationMenu = document.getElementById('ban-duration-menu');
let currentDuration = '60';

// Toggle duration dropdown
banDurationBtn.onclick = (e) => {
    e.stopPropagation();
    banDurationMenu.classList.toggle('hidden');
    banDurationBtn.classList.toggle('active');
    // Close preset dropdown if open
    banPresetMenu.classList.add('hidden');
    banPresetBtn.classList.remove('active');
};

// Close duration dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (!banDurationBtn.contains(e.target) && !banDurationMenu.contains(e.target)) {
        banDurationMenu.classList.add('hidden');
        banDurationBtn.classList.remove('active');
    }
});

// Handle duration item selection
document.querySelectorAll('.duration-dropdown-item').forEach(item => {
    item.onclick = () => {
        currentDuration = item.dataset.value;
        banDurationLabel.textContent = item.textContent;
        banDurationMenu.classList.add('hidden');
        banDurationBtn.classList.remove('active');

        // Update active states
        document.querySelectorAll('.duration-dropdown-item').forEach(el => {
            el.classList.remove('active');
        });
        item.classList.add('active');

        saveBanGeneratorState();
    };
});

// Set initial active state for duration
document.querySelector(`.duration-dropdown-item[data-value="${currentDuration}"]`)?.classList.add('active');

function rebuildPresetSelect() {
    banPresetMenu.innerHTML = '';
    [...BAN_PRESETS, ...customPresets].forEach(preset => {
        const item = document.createElement('div');
        item.className = `preset-dropdown-item ${preset.id === currentPresetId ? 'active' : ''}`;
        
        const name = document.createElement('span');
        name.className = 'preset-dropdown-item-name';
        name.textContent = preset.name;
        
        const type = document.createElement('span');
        type.className = 'preset-dropdown-item-type';
        type.textContent = BAN_PRESETS.find(bp => bp.id === preset.id) ? 'Built-in' : 'Custom';
        
        item.appendChild(name);
        item.appendChild(type);
        
        item.onclick = () => {
            currentPresetId = preset.id;
            banPresetLabel.textContent = preset.name;
            banPresetMenu.classList.add('hidden');
            banPresetBtn.classList.remove('active');
            
            // Update active states
            document.querySelectorAll('.preset-dropdown-item').forEach(el => {
                el.classList.remove('active');
            });
            item.classList.add('active');
            
            saveBanGeneratorState();
        };
        
        banPresetMenu.appendChild(item);
    });
}

// Initialize preset dropdown
rebuildPresetSelect();

// Initialize page state indicator
updatePageStateIndicator();

// Remove Duplicates Modal
const removeDuplicatesBtn = document.getElementById('remove-duplicates-btn');
const removeDuplicatesModal = document.getElementById('remove-duplicates-modal');
const duplicatesInput = document.getElementById('duplicates-input');
const cancelDuplicatesBtn = document.getElementById('cancel-duplicates-btn');
const removeDuplicatesConfirmBtn = document.getElementById('remove-duplicates-confirm-btn');

removeDuplicatesBtn.onclick = () => {
    if (!activeTabId || tabs.length === 0) {
        showAlert('No List Selected', 'Please create or select a list before removing duplicates.');
        return;
    }
    removeDuplicatesModal.classList.remove('hidden');
    duplicatesInput.value = '';
    duplicatesInput.focus();
};

cancelDuplicatesBtn.onclick = () => {
    removeDuplicatesModal.classList.add('hidden');
};

removeDuplicatesModal.onclick = (e) => {
    if (e.target === removeDuplicatesModal) {
        removeDuplicatesModal.classList.add('hidden');
    }
};

removeDuplicatesConfirmBtn.onclick = () => {
    const inputText = duplicatesInput.value.trim();
    if (!inputText) {
        showAlert('No Input', 'Please enter data to check for duplicates.');
        return;
    }

    // Auto-detect input format
    const lines = inputText.split('\n');
    const firstLine = lines.find(l => l.trim());
    
    let processedInput = inputText;
    
    // Check if it's raw tab-separated data (has tabs and 6+ columns)
    if (firstLine && firstLine.includes('\t') && firstLine.split('\t').length >= 6) {
        // Process raw data first
        processedInput = processData(inputText);
    }

    // Parse input - extract names and IDs from "Name | ID xN (Tag)" format
    const namesToCheck = new Set();
    const idsToCheck = new Set();

    for (const line of processedInput.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Skip serials (32 hex chars) - we don't want to remove them
        if (/^[A-Fa-f0-9]{32}$/.test(trimmed)) {
            continue;
        }

        // Parse "Name | ID xN (Tag)" format
        if (trimmed.includes('|')) {
            const parts = trimmed.split('|');
            if (parts.length >= 2) {
                // Extract name (before |)
                const name = parts[0].trim();
                if (name) namesToCheck.add(name.toLowerCase());

                // Extract ID (after |, before x)
                const idPart = parts[1].trim();
                const idMatch = idPart.match(/^(\d+)/);
                if (idMatch) {
                    idsToCheck.add(idMatch[1]);
                }
            }
        }
    }

    if (namesToCheck.size === 0 && idsToCheck.size === 0) {
        showAlert('Invalid Input', 'No valid names or IDs found. Format should be "Name | ID xN (Tag)" or tab-separated raw data.');
        return;
    }

    // Get current output
    const outputLines = outputArea.value.split('\n');
    const filteredLines = [];
    let removedCount = 0;
    const originalOutput = outputArea.value; // Save original for undo

    for (const line of outputLines) {
        const trimmed = line.trim();
        if (!trimmed) {
            filteredLines.push(line);
            continue;
        }

        let isDuplicate = false;

        // Check for name match (in "Name | ID" format)
        if (trimmed.includes('|')) {
            const parts = trimmed.split('|');
            if (parts.length >= 1) {
                const name = parts[0].trim();
                if (name && namesToCheck.has(name.toLowerCase())) {
                    isDuplicate = true;
                }
            }
        }

        // Check for ID match (in "| ID" format)
        if (!isDuplicate && trimmed.includes('|')) {
            const match = trimmed.match(/\|\s*(\d+)/);
            if (match && idsToCheck.has(match[1])) {
                isDuplicate = true;
            }
        }

        if (!isDuplicate) {
            filteredLines.push(line);
        } else {
            removedCount++;
        }
    }

    // Update output
    outputArea.value = filteredLines.join('\n');
    syncVisuals();
    updateCurrentTabData();
    saveOutputState();

    // Close modal and show result with undo
    removeDuplicatesModal.classList.add('hidden');
    showUndoToast(`Removed ${removedCount} duplicate(s)`, () => {
        // Undo: restore original output
        outputArea.value = originalOutput;
        syncVisuals();
        updateCurrentTabData();
        saveOutputState();
    }, 10000);
};

// Merge Data Modal
const mergeDataBtn = document.getElementById('merge-data-btn');
const mergeDataModal = document.getElementById('merge-data-modal');
const mergeDataInput = document.getElementById('merge-data-input');
const cancelMergeBtn = document.getElementById('cancel-merge-btn');
const mergeDataConfirmBtn = document.getElementById('merge-data-confirm-btn');

mergeDataBtn.onclick = () => {
    if (!activeTabId || tabs.length === 0) {
        showAlert('No List Selected', 'Please create or select a list before merging data.');
        return;
    }
    mergeDataModal.classList.remove('hidden');
    mergeDataInput.value = '';
    mergeDataInput.focus();
};

cancelMergeBtn.onclick = () => {
    mergeDataModal.classList.add('hidden');
};

mergeDataModal.onclick = (e) => {
    if (e.target === mergeDataModal) {
        mergeDataModal.classList.add('hidden');
    }
};

mergeDataConfirmBtn.onclick = () => {
    const newData = mergeDataInput.value.trim();
    if (!newData) {
        showAlert('No Input', 'Please enter new data to process and merge.');
        return;
    }

    // Process the new data
    const newProcessed = processData(newData);
    
    // Parse existing output to get serial blocks and their accounts
    const existingOutputLines = outputArea.value.split('\n');
    const serialBlocks = new Map(); // serial -> array of account lines
    const existingAccounts = new Set();
    let currentSerial = '';
    
    for (const line of existingOutputLines) {
        const trimmed = line.trim();
        
        if (/^[A-Fa-f0-9]{32}$/.test(trimmed)) {
            currentSerial = trimmed;
            if (!serialBlocks.has(currentSerial)) {
                serialBlocks.set(currentSerial, []);
            }
            continue;
        }
        
        if (!trimmed) {
            currentSerial = '';
            continue;
        }
        
        if (currentSerial && trimmed.includes('|')) {
            const parts = trimmed.split('|');
            if (parts.length >= 2) {
                const name = parts[0].trim();
                const idPart = parts[1].trim();
                const idMatch = idPart.match(/^(\d+)/);
                const id = idMatch ? idMatch[1] : '';
                
                if (name && id) {
                    const accountKey = `${name.toLowerCase()}|${id}`;
                    existingAccounts.add(accountKey);
                    serialBlocks.get(currentSerial).push(trimmed);
                }
            }
        }
    }
    
    // Parse new processed data and merge with existing serial blocks
    const newLines = newProcessed.split('\n');
    let addedCount = 0;
    let currentHash = '';
    
    for (const line of newLines) {
        const trimmed = line.trim();
        
        if (/^[A-Fa-f0-9]{32}$/.test(trimmed)) {
            currentHash = trimmed;
            continue;
        }
        
        if (!trimmed) continue;
        
        if (trimmed.includes('|')) {
            const parts = trimmed.split('|');
            if (parts.length >= 2) {
                const name = parts[0].trim();
                const idPart = parts[1].trim();
                const idMatch = idPart.match(/^(\d+)/);
                const id = idMatch ? idMatch[1] : '';
                
                if (name && id) {
                    const accountKey = `${name.toLowerCase()}|${id}`;
                    if (!existingAccounts.has(accountKey)) {
                        // Add to existing serial block or create new one
                        if (currentHash && serialBlocks.has(currentHash)) {
                            serialBlocks.get(currentHash).push(trimmed);
                        } else if (currentHash) {
                            serialBlocks.set(currentHash, [trimmed]);
                        }
                        existingAccounts.add(accountKey);
                        addedCount++;
                    }
                }
            }
        }
    }
    
    if (addedCount === 0) {
        showAlert('No New Accounts', 'All accounts from the new data already exist in the output.');
        mergeDataModal.classList.add('hidden');
        return;
    }
    
    // Rebuild output with merged data
    let mergedOutput = '';
    for (const [serial, accounts] of serialBlocks.entries()) {
        if (accounts.length > 0) {
            mergedOutput += serial + '\n';
            for (const account of accounts) {
                mergedOutput += account + '\n';
            }
            mergedOutput += '\n';
        }
    }
    
    outputArea.value = mergedOutput.trim();
    
    syncVisuals();
    updateCurrentTabData();
    saveOutputState();
    updateStats();
    
    // Close modal and show result
    mergeDataModal.classList.add('hidden');
    showUndoToast(`Added ${addedCount} new account(s)`, null, 3000);
};

const banInputArea = document.getElementById('ban-input-area');
const banOutputArea = document.getElementById('ban-output-area');
const generateBansBtn = document.getElementById('generate-bans-btn');
const banClearBtn = document.getElementById('ban-clear-btn');
const banCopyBtn = document.getElementById('ban-copy-btn');
const banCopyNextBtn = document.getElementById('ban-copy-next-btn');
const banByCheckbox = document.getElementById('ban-by-checkbox');
const banPendingCheckbox = document.getElementById('ban-pending-checkbox');
const banOnlyMortCheckbox = document.getElementById('ban-only-mort-checkbox');
const banGrieferOnlyCheckbox = document.getElementById('ban-griefer-only-checkbox');
const banNoTagCheckbox = document.getElementById('ban-no-tag-checkbox');
const banAdminName = document.getElementById('ban-admin-name');
const banDurationSelect = document.getElementById('ban-duration-select');
const importFromTabBtn = document.getElementById('import-from-tab-btn');
const banCountBadge = document.getElementById('ban-count-badge');
const banManualInputCheckbox = document.getElementById('ban-manual-input-checkbox');
const banManualInputArea = document.getElementById('ban-manual-input-area');
const banAccountInputWrapper = document.getElementById('ban-account-input-wrapper');
const banManualInputWrapper = document.getElementById('ban-manual-input-wrapper');
const banInputLabel = document.getElementById('ban-input-label');

importFromTabBtn.onclick = () => {
    banInputArea.value = outputArea.value;
    const originalText = importFromTabBtn.textContent;
    importFromTabBtn.textContent = '✓ Imported!';
    if (typeof saveBanGeneratorState === 'function') saveBanGeneratorState();
    setTimeout(() => importFromTabBtn.textContent = originalText, 2000);
};

if (banManualInputCheckbox) {
    banManualInputCheckbox.onchange = () => {
        if (banManualInputCheckbox.checked) {
            banAccountInputWrapper.style.display = 'none';
            banManualInputWrapper.style.display = 'flex';
            banInputLabel.textContent = 'Manual Ban Commands';
            generateBansBtn.textContent = 'Process Manual Input';
        } else {
            banAccountInputWrapper.style.display = 'flex';
            banManualInputWrapper.style.display = 'none';
            banInputLabel.textContent = 'Input (List of Accounts)';
            generateBansBtn.textContent = 'Generate Bans';
        }
        if (typeof saveBanGeneratorState === 'function') saveBanGeneratorState();
    };
}

if (banClearBtn) {
    banClearBtn.onclick = () => {
        showConfirm('Clear Ban Generator', 'Are you sure you want to clear the input and generated commands?', () => {
            banInputArea.value = '';
            if (banManualInputArea) banManualInputArea.value = '';
            banOutputArea.innerHTML = '';
            if (banCountBadge) banCountBadge.style.display = 'none';
            window.banCopyIndex = 0;
            if (typeof saveBanGeneratorState === 'function') saveBanGeneratorState();
        }, true); // true for danger style
    };
}

if (banByCheckbox) {
    banByCheckbox.checked = localStorage.getItem(getWorkspaceStorageKey('multiCheckBanBy')) === 'true';
    banByCheckbox.onchange = () => localStorage.setItem(getWorkspaceStorageKey('multiCheckBanBy'), banByCheckbox.checked);
}
if (banPendingCheckbox) {
    banPendingCheckbox.checked = localStorage.getItem(getWorkspaceStorageKey('multiCheckBanPending')) === 'true';
    banPendingCheckbox.onchange = () => localStorage.setItem(getWorkspaceStorageKey('multiCheckBanPending'), banPendingCheckbox.checked);
}
if (banGrieferOnlyCheckbox) {
    banGrieferOnlyCheckbox.checked = localStorage.getItem(getWorkspaceStorageKey('multiCheckBanGrieferOnly')) === 'true';
    banGrieferOnlyCheckbox.onchange = () => localStorage.setItem(getWorkspaceStorageKey('multiCheckBanGrieferOnly'), banGrieferOnlyCheckbox.checked);
}
if (banNoTagCheckbox) {
    banNoTagCheckbox.checked = localStorage.getItem(getWorkspaceStorageKey('multiCheckBanNoTag')) === 'true';
    banNoTagCheckbox.onchange = () => localStorage.setItem(getWorkspaceStorageKey('multiCheckBanNoTag'), banNoTagCheckbox.checked);
}
if (banOnlyMortCheckbox) {
    banOnlyMortCheckbox.checked = localStorage.getItem(getWorkspaceStorageKey('multiCheckBanOnlyMort')) === 'true';
    banOnlyMortCheckbox.onchange = () => localStorage.setItem(getWorkspaceStorageKey('multiCheckBanOnlyMort'), banOnlyMortCheckbox.checked);
}
if (banAdminName) {
    banAdminName.value = localStorage.getItem(getWorkspaceStorageKey('multiCheckBanAdmin')) || '';
    banAdminName.oninput = () => localStorage.setItem(getWorkspaceStorageKey('multiCheckBanAdmin'), banAdminName.value);
}

generateBansBtn.onclick = () => {
    // Check if manual input mode is enabled
    if (banManualInputCheckbox && banManualInputCheckbox.checked) {
        // Process manual input
        const manualLines = banManualInputArea.value.split('\n');
        const outLines = [];
        const seenCommands = new Set();

        for (let line of manualLines) {
            line = line.trim();
            if (!line) continue;

            // Check if it's a ban command
            if (line.startsWith('/ban ')) {
                // Remove duplicates
                if (seenCommands.has(line)) continue;
                seenCommands.add(line);
                outLines.push(line);
            }
        }

        banOutputArea.innerHTML = '';
        outLines.forEach(line => {
            const div = document.createElement('div');
            div.className = 'ban-line';
            div.textContent = line;
            banOutputArea.appendChild(div);
        });

        // Update line numbers
        const banLineNumbers = document.getElementById('ban-line-numbers');
        if (banLineNumbers) {
            let numHtml = '';
            for (let i = 1; i <= outLines.length; i++) numHtml += `<span>${i}</span><br>`;
            banLineNumbers.innerHTML = numHtml || '1';
        }

        window.banCopyIndex = 0;

        // Ban count badge
        if (banCountBadge) {
            if (outLines.length > 0) {
                banCountBadge.textContent = `${outLines.length} bans`;
                banCountBadge.style.display = 'inline-block';
            } else {
                banCountBadge.style.display = 'none';
            }
        }

        if (typeof saveBanGeneratorState === 'function') saveBanGeneratorState();
        return;
    }

    // Original ban generation logic
    const preset = [...BAN_PRESETS, ...customPresets].find(p => p.id === currentPresetId);
    if (!preset) return;

    const duration = currentDuration;
    const lines = banInputArea.value.split('\n');
    const outLines = [];
    const seenNames = new Set();

    for (let line of lines) {
        line = line.trim();
        if (!line) continue;

        if (/^[A-Fa-f0-9]{32}$/.test(line)) continue;

        const splitIndex = line.indexOf('|');
        if (splitIndex !== -1) {
            let name = line.substring(0, splitIndex).trim();
            name = name.replace(/\s+/g, '_');

            const lowerName = name.toLowerCase();
            if (seenNames.has(lowerName)) continue;
            seenNames.add(lowerName);

            const rest = line.substring(splitIndex + 1);

            // Extract (M) or (T) marker (with or without parentheses, including spaced format)
            const mortMatch = rest.match(/\((M|T)\)/) || rest.match(/(M|T)(?=\s|$)/) || rest.match(/\( M \)/) || rest.match(/\( T \)/);

            if (banOnlyMortCheckbox && banOnlyMortCheckbox.checked && !mortMatch) {
                // Remove from seenNames so we don't accidentally skip them if they appear later WITH a tag
                seenNames.delete(lowerName);
                continue;
            }

            // Check for griefer tags if griefer-only mode is enabled (both with and without parentheses, and with/without !! suffix)
            if (banGrieferOnlyCheckbox && banGrieferOnlyCheckbox.checked) {
                const grieferTags = ['(Non-RP)', '(Fail-RP)', '(Provoking)', '(GR3.1)', '(GR3.2)', '(DM)'];
                const hasGrieferTag = grieferTags.some(tag => {
                    const tagWithParens = tag.toUpperCase();
                    const tagWithoutParens = tag.replace(/[()]/g, '').toUpperCase();
                    const tagWithoutParensNoSuffix = tagWithoutParens.replace(' !!', '').trim();
                    return rest.toUpperCase().includes(tagWithParens) || rest.toUpperCase().includes(tagWithoutParens) || rest.toUpperCase().includes(tagWithoutParensNoSuffix);
                });
                if (!hasGrieferTag) {
                    seenNames.delete(lowerName);
                    continue;
                }
            }

            // Use empty tag if "No Tag" is enabled
            let tag = '';
            if (!(banNoTagCheckbox && banNoTagCheckbox.checked) && mortMatch) {
                // Always use format with spaces inside parentheses: ( M ) or ( T )
                const mortTag = mortMatch[1]; // M or T
                tag = '(' + mortTag + ')';
            }

            let command;
            if (duration === 'no') {
                // Remove the {duration} placeholder and any surrounding space
                command = preset.template.replace(/\s*\{duration\}\s*/g, ' ').trim();
            } else {
                command = preset.template.replace('{duration}', duration);
            }
            command = command.replace('{name}', name);
            command = command.replace('{tag}', tag);

            // Clean up extra spaces if tag is empty
            if (tag === '') {
                command = command.replace(/\s+/g, ' ').trim();
            }

            let suffix = '';
            if (banPendingCheckbox && banPendingCheckbox.checked) {
                suffix += ' (Pending Perma)';
            }
            if (banByCheckbox && banByCheckbox.checked && banAdminName.value.trim() !== '') {
                suffix += ' By ' + banAdminName.value.trim();
            }
            command += suffix;

            outLines.push(command);
        }
    }

    banOutputArea.innerHTML = '';
    outLines.forEach(line => {
        const div = document.createElement('div');
        div.className = 'ban-line';
        div.textContent = line;
        banOutputArea.appendChild(div);
    });

    // Update line numbers
    const banLineNumbers = document.getElementById('ban-line-numbers');
    if (banLineNumbers) {
        let numHtml = '';
        for (let i = 1; i <= outLines.length; i++) numHtml += `<span>${i}</span><br>`;
        banLineNumbers.innerHTML = numHtml || '1';
    }

    window.banCopyIndex = 0;

    // Ban count badge
    if (banCountBadge) {
        if (outLines.length > 0) {
            banCountBadge.textContent = `${outLines.length} bans`;
            banCountBadge.style.display = 'inline-block';
        } else {
            banCountBadge.style.display = 'none';
        }
    }

    if (typeof saveBanGeneratorState === 'function') saveBanGeneratorState();
};

// Sync ban output scroll with line numbers
const banLineNumbers = document.getElementById('ban-line-numbers');
if (banOutputArea && banLineNumbers) {
    banOutputArea.addEventListener('scroll', () => {
        banLineNumbers.scrollTop = banOutputArea.scrollTop;
    });

    // Add click handler to copy name by line number
    banLineNumbers.addEventListener('click', (e) => {
        if (e.target.tagName === 'SPAN') {
            const lineNumber = parseInt(e.target.textContent);
            const banLines = banOutputArea.querySelectorAll('.ban-line');
            if (lineNumber > 0 && lineNumber <= banLines.length) {
                const banLine = banLines[lineNumber - 1];
                const banText = banLine.textContent;

                // Extract name from ban command: /ban NAME duration reason
                const parts = banText.split(' ');
                if (parts.length >= 2 && parts[0] === '/ban') {
                    const name = parts[1];
                    const originalText = e.target.textContent;
                    robustCopy(name, () => {
                        e.target.textContent = '✓';
                        e.target.style.color = '#22c55e';
                        e.target.style.fontWeight = 'bold';
                        setTimeout(() => {
                            e.target.textContent = originalText;
                            e.target.style.color = '';
                            e.target.style.fontWeight = '';
                        }, 1000);
                        showUndoToast(`Copied: ${name}`, null, 2000);
                    });
                }
            }
        }
    });

    // Add cursor style to indicate clickable
    banLineNumbers.style.cursor = 'pointer';
}

if (banCopyNextBtn) {
    banCopyNextBtn.onclick = () => {
        const lines = banOutputArea.querySelectorAll('.ban-line');
        if (window.banCopyIndex === undefined) window.banCopyIndex = 0;

        if (window.banCopyIndex < lines.length) {
            const currentLine = lines[window.banCopyIndex];
            const textToCopy = currentLine.textContent;
            robustCopy(textToCopy, () => {
                currentLine.classList.add('copied');
                window.banCopyIndex++;

                if (window.banCopyIndex < lines.length) {
                    lines[window.banCopyIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
                }

                const orig = banCopyNextBtn.textContent;
                banCopyNextBtn.textContent = 'Copied!';
                setTimeout(() => banCopyNextBtn.textContent = orig, 1000);

                if (typeof saveBanGeneratorState === 'function') saveBanGeneratorState();
            });
        }
    };
}

banCopyBtn.onclick = () => {
    const text = Array.from(banOutputArea.querySelectorAll('.ban-line'))
        .map(el => el.textContent)
        .join('\n');
    if (!text) return;
    robustCopy(text, () => {
        const originalText = banCopyBtn.innerText;
        banCopyBtn.innerText = 'Copied!';
        setTimeout(() => banCopyBtn.innerText = originalText, 2000);
    });
};

function processData(text) {
    const lines = text.split('\n');
    const dataMap = new Map();

    for (const line of lines) {
        if (!line.trim()) continue;

        let name = '', id = '', hash = '', count = 0;
        const parts = line.split('\t');

        if (parts.length >= 6) {
            name = parts[0].trim();
            id = parts[1].trim();
            hash = parts[2].trim();
            count = parseInt(parts[parts.length - 1].trim(), 10) || 0;
        } else {
            const hashMatch = line.match(/([a-fA-F0-9]{32})/);
            if (hashMatch) {
                hash = hashMatch[1];
                const hashIndex = line.indexOf(hash);

                const beforeHash = line.substring(0, hashIndex).trim();
                const lastSpace = beforeHash.lastIndexOf(' ');
                const lastTab = beforeHash.lastIndexOf('\t');
                const splitIndex = Math.max(lastSpace, lastTab);

                if (splitIndex > -1) {
                    name = beforeHash.substring(0, splitIndex).trim();
                    id = beforeHash.substring(splitIndex).trim();
                } else {
                    name = beforeHash;
                }

                const afterHash = line.substring(hashIndex + 32).trim();
                const countMatch = afterHash.match(/(\d+)$/);
                count = countMatch ? parseInt(countMatch[1], 10) : 0;
            } else {
                continue;
            }
        }

        if (!hash) continue;

        if (!dataMap.has(hash)) {
            dataMap.set(hash, new Map());
        }

        const userKey = `${name} | ${id}`;
        const currentCount = dataMap.get(hash).get(userKey) || 0;
        dataMap.get(hash).set(userKey, currentCount + count);
    }

    const hashBlocks = [];

    for (const [hash, usersMap] of dataMap.entries()) {
        const userArr = Array.from(usersMap.entries()).map(([userStr, totalCount]) => ({
            userStr, totalCount
        }));

        userArr.sort((a, b) => b.totalCount - a.totalCount);

        const blockTotal = userArr.reduce((sum, u) => sum + u.totalCount, 0);

        hashBlocks.push({ hash, userArr, blockTotal });
    }

    hashBlocks.sort((a, b) => b.blockTotal - a.blockTotal);

    let output = '';
    for (const block of hashBlocks) {
        output += block.hash + '\n';
        for (const user of block.userArr) {
            output += `${user.userStr} x${user.totalCount}\n`;
        }
        output += '\n';
    }

    return output.trim();
}

renderTabs();

// ── Search & Highlight ──────────────────────────────────────────────────────
const searchBarRow = document.getElementById('search-bar-row');
const searchInput = document.getElementById('search-input');
const searchCount = document.getElementById('search-count');
const searchPrevBtn = document.getElementById('search-prev-btn');
const searchNextBtn = document.getElementById('search-next-btn');
const searchClearBtn = document.getElementById('search-clear-btn');

let searchMatches = [];
let searchActiveIdx = 0;

function openSearch() {
    searchBarRow.classList.add('visible');
    searchInput.focus();
    searchInput.select();
}

function closeSearch() {
    searchBarRow.classList.remove('visible');
    searchInput.value = '';
    runSearch();
    outputArea.focus();
}

// Ctrl+F opens search (intercept browser's native find)
document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        openSearch();
    }
});

function runSearch() {
    const query = searchInput.value.trim().toLowerCase();
    outputMirror.querySelectorAll('span.search-match').forEach(el => {
        el.classList.remove('search-match', 'active-match');
    });
    searchMatches = [];
    searchActiveIdx = 0;

    if (!query) {
        searchCount.textContent = '';
        return;
    }

    outputMirror.querySelectorAll('span[data-value]').forEach(el => {
        if (el.getAttribute('data-value').toLowerCase().includes(query)) {
            el.classList.add('search-match');
            searchMatches.push(el);
        }
    });

    if (searchMatches.length === 0) {
        searchCount.textContent = '0 / 0';
        return;
    }

    activateSearchMatch(0);
}

function activateSearchMatch(idx) {
    searchMatches.forEach(el => el.classList.remove('active-match'));
    if (searchMatches.length === 0) return;
    searchActiveIdx = (idx + searchMatches.length) % searchMatches.length;
    const active = searchMatches[searchActiveIdx];
    active.classList.add('active-match');
    searchCount.textContent = `${searchActiveIdx + 1} / ${searchMatches.length}`;

    // Scroll the textarea to the match position using offsetTop of span in mirror
    const mirrorPaddingTop = 10;
    const matchTop = active.offsetTop - mirrorPaddingTop;
    const areaHeight = outputArea.clientHeight;
    const targetScroll = matchTop - (areaHeight / 2);
    outputArea.scrollTop = Math.max(0, targetScroll);
    outputMirror.scrollTop = outputArea.scrollTop;
}

searchInput.addEventListener('input', runSearch);
searchPrevBtn.onclick = () => activateSearchMatch(searchActiveIdx - 1);
searchNextBtn.onclick = () => activateSearchMatch(searchActiveIdx + 1);
searchClearBtn.onclick = closeSearch;
searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
        e.shiftKey ? activateSearchMatch(searchActiveIdx - 1) : activateSearchMatch(searchActiveIdx + 1);
    } else if (e.key === 'Escape') {
        closeSearch();
    }
});


// Re-run search after mirror updates so highlights stay in sync
const origUpdateMirror = updateMirror;
window.updateMirror = function () {
    origUpdateMirror();
    if (searchInput.value.trim()) runSearch();
};

// ── Custom Preset Builder ───────────────────────────────────────────────────
const presetModal = document.getElementById('preset-modal');
const presetModalSave = document.getElementById('preset-modal-save');
const presetModalCancel = document.getElementById('preset-modal-cancel');
const presetNameInput = document.getElementById('preset-name-input');
const presetTemplateInput = document.getElementById('preset-template-input');

// Placeholder button functionality
document.querySelectorAll('.placeholder-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const placeholder = btn.dataset.placeholder;
        const input = presetTemplateInput;
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const text = input.value;
        const newText = text.substring(0, start) + placeholder + text.substring(end);
        input.value = newText;
        input.focus();
        input.selectionStart = input.selectionEnd = start + placeholder.length;
    });
});
const presetListEl = document.getElementById('preset-list');
const openPresetBuilderBtn = document.getElementById('open-preset-builder-btn');

// Custom presets are loaded near BAN_PRESETS definition

function renderPresetList() {
    presetListEl.innerHTML = '';

    BAN_PRESETS.forEach(p => {
        const div = document.createElement('div');
        div.className = 'preset-item';
        div.innerHTML = `
            <div class="preset-item-content">
                <div class="preset-item-name">${p.name}</div>
                <div class="preset-item-template-wrapper">
                    <div class="preset-item-template">${p.template}</div>
                </div>
            </div>
            <div class="preset-item-actions">
                <span class="preset-built-in">Built-in</span>
            </div>
        `;

        const templateEl = div.querySelector('.preset-item-template');
        setupTooltip(templateEl, p.template);

        presetListEl.appendChild(div);
    });

    customPresets.forEach((p, i) => {
        const div = document.createElement('div');
        div.className = 'preset-item';
        div.innerHTML = `
            <div class="preset-item-content">
                <div class="preset-item-name">${p.name}</div>
                <div class="preset-item-template-wrapper">
                    <div class="preset-item-template">${p.template}</div>
                </div>
            </div>
            <div class="preset-item-actions"></div>
        `;

        const templateEl = div.querySelector('.preset-item-template');
        setupTooltip(templateEl, p.template);

        const actionsDiv = div.querySelector('.preset-item-actions');

        const editBtn = document.createElement('button');
        editBtn.className = 'btn-edit';
        editBtn.innerHTML = '✎';
        editBtn.title = 'Edit';
        editBtn.onclick = () => {
            presetNameInput.value = p.name;
            presetTemplateInput.value = p.template;
            presetModalSave.textContent = 'Update Preset';
            presetModalSave.dataset.editIndex = i;
            presetNameInput.focus();
        };

        const duplicateBtn = document.createElement('button');
        duplicateBtn.className = 'btn-duplicate';
        duplicateBtn.innerHTML = '📋';
        duplicateBtn.title = 'Duplicate';
        duplicateBtn.onclick = () => {
            const newPreset = {
                id: 'custom-' + Date.now(),
                name: p.name + ' (Copy)',
                template: p.template
            };
            customPresets.push(newPreset);
            saveCustomPresets();
            rebuildPresetSelect();
            renderPresetList();
        };

        const delBtn = document.createElement('button');
        delBtn.className = 'btn-delete';
        delBtn.innerHTML = '✕';
        delBtn.title = 'Delete';
        delBtn.onclick = () => {
            showConfirm('Delete Preset', `Delete preset "${p.name}"? This cannot be undone.`, () => {
                customPresets.splice(i, 1);
                saveCustomPresets();
                rebuildPresetSelect();
                renderPresetList();
            }, true);
        };

        actionsDiv.appendChild(editBtn);
        actionsDiv.appendChild(duplicateBtn);
        actionsDiv.appendChild(delBtn);
        presetListEl.appendChild(div);
    });

    if (BAN_PRESETS.length === 0 && customPresets.length === 0) {
        presetListEl.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">No presets yet.</p>';
    }
}

function setupTooltip(element, text) {
    const wrapper = element.parentElement;
    let tooltip = wrapper.querySelector('.preset-tooltip');

    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.className = 'preset-tooltip';
        document.body.appendChild(tooltip);
    }

    tooltip.textContent = text;

    element.addEventListener('mouseenter', (e) => {
        const rect = element.getBoundingClientRect();
        tooltip.style.left = (rect.left + rect.width / 2) + 'px';
        tooltip.style.top = (rect.top - 10) + 'px';
        tooltip.style.transform = 'translateX(-50%) translateY(-100%)';
        tooltip.classList.add('visible');
    });

    element.addEventListener('mouseleave', () => {
        tooltip.classList.remove('visible');
    });
}

openPresetBuilderBtn.onclick = () => {
    renderPresetList();
    presetModal.classList.remove('hidden');
    // Reset to add mode
    presetNameInput.value = '';
    presetTemplateInput.value = '';
    presetModalSave.textContent = 'Add Preset';
    delete presetModalSave.dataset.editIndex;
};

presetModalCancel.onclick = () => {
    presetModal.classList.add('hidden');
    // Reset to add mode
    presetNameInput.value = '';
    presetTemplateInput.value = '';
    presetModalSave.textContent = 'Add Preset';
    delete presetModalSave.dataset.editIndex;
};

presetModal.addEventListener('click', e => { if (e.target === presetModal) {
    presetModal.classList.add('hidden');
    // Reset to add mode
    presetNameInput.value = '';
    presetTemplateInput.value = '';
    presetModalSave.textContent = 'Add Preset';
    delete presetModalSave.dataset.editIndex;
}});

presetModalSave.onclick = () => {
    const name = presetNameInput.value.trim();
    const template = presetTemplateInput.value.trim();
    if (!name || !template) {
        presetNameInput.style.borderColor = name ? '' : 'var(--danger)';
        presetTemplateInput.style.borderColor = template ? '' : 'var(--danger)';
        return;
    }
    presetNameInput.style.borderColor = '';
    presetTemplateInput.style.borderColor = '';

    const editIndex = presetModalSave.dataset.editIndex;

    if (editIndex !== undefined) {
        // Update existing preset
        customPresets[parseInt(editIndex)] = {
            id: customPresets[parseInt(editIndex)].id,
            name,
            template
        };
    } else {
        // Create new preset
        const newPreset = { id: 'custom-' + Date.now(), name, template };
        customPresets.push(newPreset);
    }
    saveCustomPresets();
    rebuildPresetSelect();
    renderPresetList();
    presetNameInput.value = '';
    presetTemplateInput.value = '';
    presetModalSave.textContent = 'Add Preset';
    delete presetModalSave.dataset.editIndex;
};

// Initialize preset select with both built-in and custom presets
rebuildPresetSelect();

// ── Confirmation on process btn if output has data ─────────────────────────
const origProcessClick = processBtn.onclick;
processBtn.onclick = () => {
    if (outputArea.value.trim()) {
        showConfirm('Re-process Data', 'This will overwrite your current output. Any manual edits will be lost. Continue?', () => {
            origProcessClick && origProcessClick();
        });
    } else {
        origProcessClick && origProcessClick();
    }
};

// ── Ban Generator State Persistence ──────────────────────────────────────────
let isLoadingBanState = false;

function saveBanGeneratorState() {
    if (isLoadingBanState) return;
    const state = {
        view: currentView,
        input: banInputArea.value,
        manualInput: banManualInputArea ? banManualInputArea.value : '',
        manualInputMode: banManualInputCheckbox ? banManualInputCheckbox.checked : false,
        outputHtml: banOutputArea.innerHTML,
        copyIndex: window.banCopyIndex || 0,
        preset: currentPresetId,
        duration: currentDuration,
        badgeText: banCountBadge ? banCountBadge.textContent : '',
        badgeDisplay: banCountBadge ? banCountBadge.style.display : 'none'
    };
    localStorage.setItem(getWorkspaceStorageKey('multiCheckBanGenState'), JSON.stringify(state));
}

function loadBanGeneratorState() {
    try {
        isLoadingBanState = true;
        const saved = localStorage.getItem(getWorkspaceStorageKey('multiCheckBanGenState'));

        // First, clear all fields to ensure no data persists from previous workspace
        banInputArea.value = '';
        if (banManualInputArea) banManualInputArea.value = '';
        banOutputArea.innerHTML = '';
        window.banCopyIndex = 0;
        if (banCountBadge) {
            banCountBadge.style.display = 'none';
        }

        // Check if workspace has tabs - if not, force multi view
        const hasTabs = tabs.length > 0 && activeTabId;
        if (!hasTabs && currentView === 'bans') {
            currentView = 'multi';
            banGeneratorView.style.display = 'none';
            multiCheckerView.style.display = '';
            viewToggleBtn.textContent = 'Ban Generator';
            updatePageStateIndicator();
        }

        if (saved) {
            const state = JSON.parse(saved);

            // Restore View - only if workspace has tabs
            if (hasTabs) {
                if (state.view === 'bans' && currentView === 'multi') {
                    viewToggleBtn.click();
                } else if (state.view === 'multi' && currentView === 'bans') {
                    viewToggleBtn.click();
                }
            }

            // Restore Inputs
            if (state.input) banInputArea.value = state.input;
            if (state.manualInput && banManualInputArea) banManualInputArea.value = state.manualInput;
            if (state.manualInputMode !== undefined && banManualInputCheckbox) {
                banManualInputCheckbox.checked = state.manualInputMode;
                // Trigger the change event to update UI
                banManualInputCheckbox.dispatchEvent(new Event('change'));
            }
            if (state.preset) {
                currentPresetId = state.preset;
                const preset = [...BAN_PRESETS, ...customPresets].find(p => p.id === state.preset);
                if (preset && banPresetLabel) banPresetLabel.textContent = preset.name;
                rebuildPresetSelect();
            }
            if (state.duration) {
                currentDuration = state.duration;
                const durationItem = document.querySelector(`.duration-dropdown-item[data-value="${state.duration}"]`);
                if (durationItem && banDurationLabel) {
                    banDurationLabel.textContent = durationItem.textContent;
                    document.querySelectorAll('.duration-dropdown-item').forEach(el => el.classList.remove('active'));
                    durationItem.classList.add('active');
                }
            }

            // Restore Output
            if (state.outputHtml) banOutputArea.innerHTML = state.outputHtml;
            if (state.copyIndex !== undefined) window.banCopyIndex = state.copyIndex;

            // Restore Badge
            if (banCountBadge) {
                banCountBadge.textContent = state.badgeText || '';
                banCountBadge.style.display = state.badgeDisplay || 'none';
            }
        } else {
            // No saved state for this workspace - reset to defaults
            currentPresetId = BAN_PRESETS[0]?.id || '';
            const defaultPreset = [...BAN_PRESETS, ...customPresets].find(p => p.id === currentPresetId);
            if (defaultPreset && banPresetLabel) banPresetLabel.textContent = defaultPreset.name;
            rebuildPresetSelect();
            currentDuration = '60';
            const defaultDurationItem = document.querySelector(`.duration-dropdown-item[data-value="60"]`);
            if (defaultDurationItem && banDurationLabel) {
                banDurationLabel.textContent = defaultDurationItem.textContent;
                document.querySelectorAll('.duration-dropdown-item').forEach(el => el.classList.remove('active'));
                defaultDurationItem.classList.add('active');
            }
        }
    } catch (e) {
        console.error("Failed to load ban generator state", e);
    } finally {
        isLoadingBanState = false;
    }
}

// Hook up event listeners for inputs
banInputArea.addEventListener('input', saveBanGeneratorState);

// Load state on startup
loadBanGeneratorState();

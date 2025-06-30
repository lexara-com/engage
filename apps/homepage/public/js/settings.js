// Settings page JavaScript functionality
let auth0Client = null;
let currentFirmData = null;
let debugMode = false;

document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM loaded, initializing settings page');
  await initializeAuth0();
  await loadSettings();
  setupEventListeners();
});

async function initializeAuth0() {
  try {
    // Load Auth0 SDK
    const script = document.createElement('script');
    script.src = 'https://cdn.auth0.com/js/auth0-spa-js/2.0/auth0-spa-js.production.js';
    document.head.appendChild(script);
    
    await new Promise((resolve, reject) => {
      script.onload = resolve;
      script.onerror = reject;
    });
    
    // Initialize Auth0 client
    auth0Client = await window.auth0.createAuth0Client({
      domain: 'dev-sv0pf6cz2530xz0o.us.auth0.com',
      clientId: 'OjsR6To3nDqYDLVHtRjDFpk7wRcCfrfi',
      authorizationParams: {
        redirect_uri: window.location.origin + '/firm/callback'
      },
      cacheLocation: 'localstorage',
      useRefreshTokens: false
    });
    
    console.log('Auth0 client initialized for settings');
  } catch (error) {
    console.error('Failed to initialize Auth0:', error);
    showError('Authentication system failed to load.');
  }
}

async function loadSettings() {
  try {
    showLoading(true);
    
    // Check authentication
    if (!auth0Client) {
      throw new Error('Auth0 client not initialized');
    }
    
    const isAuthenticated = await auth0Client.isAuthenticated();
    if (!isAuthenticated) {
      console.log('User not authenticated, redirecting to login');
      window.location.href = '/firm/login';
      return;
    }
    
    console.log('User is authenticated, loading settings');
    
    // Get user info
    const user = await auth0Client.getUser();
    updateUserHeader(user);
    
    // Extract firm ID from user metadata
    let firmId = user.user_metadata?.firmId || user.app_metadata?.organization || user.app_metadata?.firmId;
    
    if (!firmId && user.email) {
      const emailDomain = user.email.split('@')[1].replace(/\./g, '-');
      firmId = 'firm-' + emailDomain;
    }
    
    if (!firmId) {
      firmId = 'firm-' + user.sub.split('|')[1].substr(0, 8);
    }
    
    // Load firm data
    await loadFirmData(firmId);
    
    // Update debug info
    updateDebugInfo(user, firmId);
    
    showSettings();
    
  } catch (error) {
    console.error('Failed to load settings:', error);
    showError('Unable to load settings. Please check your connection and try again.');
  }
}

async function loadFirmData(firmId) {
  try {
    console.log('Loading firm data for:', firmId);
    
    // Load firm settings and users in parallel
    const [settingsResponse, usersResponse] = await Promise.all([
      fetch(`/api/v1/firm/settings?firmId=${encodeURIComponent(firmId)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      }),
      fetch(`/api/v1/firm/users?firmId=${encodeURIComponent(firmId)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await auth0Client.getTokenSilently()}`
        }
      })
    ]);
    
    // Process settings response
    let firmData = {};
    if (settingsResponse.ok) {
      const settingsResult = await settingsResponse.json();
      if (settingsResult.success) {
        firmData = settingsResult.data.firm;
      }
    }
    
    // Process users response
    let users = [];
    let userError = null;
    if (usersResponse.ok) {
      const usersResult = await usersResponse.json();
      if (usersResult.success) {
        users = usersResult.data.users;
        console.log(`✅ Loaded ${users.length} users for firm ${firmId}`);
      } else {
        userError = usersResult.error?.message || 'Failed to load users';
      }
    } else if (usersResponse.status === 403) {
      userError = 'You do not have permission to manage users';
    } else {
      userError = `Failed to load users: ${usersResponse.status}`;
    }
    
    currentFirmData = {
      ...firmData,
      firmId: firmId,
      users: users,
      userError: userError,
      debug: {
        firmId: firmId,
        timestamp: new Date().toISOString(),
        userCount: users.length,
        hasUserPermissions: !userError
      }
    };
    
    updateFirmInformation(currentFirmData);
    updateAuthorizedUsers(currentFirmData.users, currentFirmData.userError);
    
  } catch (error) {
    console.error('Failed to load firm data:', error);
    
    // Fallback to placeholder data if API fails
    currentFirmData = {
      firmId: firmId,
      firmName: 'API Connection Failed',
      firmSize: '',
      plan: 'Unable to load',
      practiceAreas: [],
      users: [],
      error: error.message,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };
    
    updateFirmInformation(currentFirmData);
    updateAuthorizedUsers(currentFirmData.users);
    
    throw error;
  }
}

function updateFirmInformation(firmData) {
  // Update form fields
  const firmNameInput = document.getElementById('firm-name');
  const firmIdInput = document.getElementById('firm-id');
  const firmSizeSelect = document.getElementById('firm-size');
  const planInput = document.getElementById('plan');
  
  if (firmNameInput) firmNameInput.value = firmData.firmName || '';
  if (firmIdInput) firmIdInput.value = firmData.firmId || '';
  if (firmSizeSelect) firmSizeSelect.value = firmData.firmSize || '';
  if (planInput) planInput.value = firmData.plan || '';
  
  // Update practice areas
  updatePracticeAreas(firmData.practiceAreas || []);
}

function updatePracticeAreas(areas) {
  const practiceAreasContainer = document.getElementById('practice-areas');
  if (!practiceAreasContainer) return;
  
  const allAreas = [
    'Personal Injury', 'Criminal Defense', 'Family Law', 'Estate Planning',
    'Real Estate', 'Business Law', 'Employment Law', 'Immigration',
    'Bankruptcy', 'Tax Law', 'Intellectual Property', 'Civil Litigation'
  ];
  
  practiceAreasContainer.innerHTML = allAreas.map(area => `
    <label class="flex items-center space-x-2">
      <input type="checkbox" value="${area}" ${areas.includes(area) ? 'checked' : ''}
             class="rounded border-gray-300 text-lexara-primary focus:ring-lexara-primary">
      <span class="text-sm text-lexara-secondary">${area}</span>
    </label>
  `).join('');
}

function updateAuthorizedUsers(users, userError = null) {
  const usersList = document.getElementById('users-list');
  const noUsers = document.getElementById('no-users');
  const addUserButton = document.getElementById('add-user-button');
  
  // Show/hide add user button based on permissions
  if (addUserButton) {
    if (userError && userError.includes('permission')) {
      addUserButton.style.display = 'none';
    } else {
      addUserButton.style.display = 'block';
    }
  }
  
  // Handle error state
  if (userError) {
    if (usersList) {
      usersList.innerHTML = `
        <div class="p-8 text-center">
          <div class="w-12 h-12 bg-lexara-error/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-6 h-6 text-lexara-error" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
            </svg>
          </div>
          <h4 class="text-lg font-medium text-lexara-secondary mb-2">Unable to Load Users</h4>
          <p class="text-lexara-gray">${userError}</p>
        </div>
      `;
    }
    if (noUsers) noUsers.classList.add('hidden');
    return;
  }
  
  // Handle empty state
  if (!users || users.length === 0) {
    if (usersList) usersList.innerHTML = '';
    if (noUsers) noUsers.classList.remove('hidden');
    return;
  }

  if (noUsers) noUsers.classList.add('hidden');
  
  if (usersList) {
    usersList.innerHTML = users.map(user => {
      const isCurrentUser = false; // Will be determined by checking against auth0 user
      const canRemove = user.role !== 'admin' || (user.role === 'admin' && getAdminCount(users) > 1);
      
      return `
        <div class="p-6 flex items-center justify-between border-b border-gray-100 last:border-b-0">
          <!-- User Info -->
          <div class="flex items-center space-x-4">
            <div class="w-12 h-12 rounded-full bg-lexara-primary/10 flex items-center justify-center">
              <span class="text-sm font-medium text-lexara-primary">
                ${getUserInitials(user.name || user.email)}
              </span>
            </div>
            <div class="flex-1">
              <div class="flex items-center space-x-2">
                <p class="font-medium text-lexara-secondary">${user.name || 'Unknown User'}</p>
                ${isCurrentUser ? '<span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">You</span>' : ''}
              </div>
              <p class="text-sm text-lexara-gray">${user.email || 'No email'}</p>
              <div class="flex items-center space-x-4 mt-1">
                <div class="flex items-center space-x-1">
                  ${getEmailVerificationIcon(user.emailVerified)}
                  <span class="text-xs text-lexara-gray">${user.emailVerified ? 'Verified' : 'Pending verification'}</span>
                </div>
                <span class="text-xs text-lexara-gray">
                  Last login: ${user.lastLogin ? formatDate(user.lastLogin) : 'Never'}
                </span>
              </div>
            </div>
          </div>
          
          <!-- Actions -->
          <div class="flex items-center space-x-3">
            <!-- Role Selection -->
            <select 
              class="text-xs px-2 py-1 border border-gray-300 rounded ${getRoleSelectClass(user.role)}"
              onchange="changeUserRole('${user.id}', this.value, '${user.role}')"
              ${isCurrentUser && getAdminCount(users) <= 1 ? 'disabled title="Cannot change role - you are the last admin"' : ''}
            >
              <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
              <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
            </select>
            
            <!-- Status Badge -->
            <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(user.status)}">
              ${getStatusText(user.status)}
            </span>
            
            <!-- Remove Button -->
            ${canRemove ? `
              <button 
                onclick="showRemoveUserModal('${user.id}', '${user.name || user.email}', '${user.role}')"
                class="text-lexara-error hover:text-red-800 text-sm font-medium"
                title="Remove user"
              >
                Remove
              </button>
            ` : `
              <span class="text-gray-400 text-sm" title="${isCurrentUser ? 'Cannot remove yourself' : 'Cannot remove last admin'}">
                Remove
              </span>
            `}
          </div>
        </div>
      `;
    }).join('');
  }
}

function updateUserHeader(user) {
  const userInfo = document.getElementById('user-info');
  const userNameElement = document.getElementById('user-name');
  const userEmailElement = document.getElementById('user-email');
  const userInitialsElement = document.getElementById('user-initials');
  const logoutButton = document.getElementById('logout-button');
  
  if (user && user.name) {
    if (userInfo) userInfo.classList.remove('hidden');
    if (logoutButton) logoutButton.classList.remove('hidden');
    
    if (userNameElement) userNameElement.textContent = user.name;
    if (userEmailElement) userEmailElement.textContent = user.email || '';
    
    if (userInitialsElement) {
      const initials = user.name.split(' ').map(n => n.charAt(0)).join('').toUpperCase().slice(0, 2);
      userInitialsElement.textContent = initials;
    }
  }
}

function updateDebugInfo(user, firmId) {
  // Update user debug info
  const userDebug = document.getElementById('user-debug');
  if (userDebug) {
    userDebug.textContent = JSON.stringify({
      sub: user.sub,
      email: user.email,
      name: user.name,
      user_metadata: user.user_metadata,
      app_metadata: user.app_metadata,
      extractedFirmId: firmId
    }, null, 2);
  }
  
  // Update firm debug info
  const firmDebug = document.getElementById('firm-debug');
  if (firmDebug) {
    firmDebug.textContent = JSON.stringify(currentFirmData, null, 2);
  }
  
  // Update system debug info
  const systemDebug = document.getElementById('system-debug');
  if (systemDebug) {
    systemDebug.textContent = JSON.stringify({
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      localStorage: Object.keys(localStorage).length + ' items',
      sessionStorage: Object.keys(sessionStorage).length + ' items'
    }, null, 2);
  }
}

function setupEventListeners() {
  console.log('Setting up event listeners');
  
  // Logout button
  const logoutButton = document.getElementById('logout-button');
  if (logoutButton) {
    logoutButton.addEventListener('click', async function() {
      if (!auth0Client) return;
      
      try {
        await auth0Client.logout({
          logoutParams: {
            returnTo: window.location.origin + '/firm/login'
          }
        });
      } catch (error) {
        console.error('Logout failed:', error);
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = '/firm/login';
      }
    });
  }
  
  // Export debug
  const exportDebug = document.getElementById('export-debug');
  if (exportDebug) {
    exportDebug.addEventListener('click', function() {
      const debugData = {
        user: JSON.parse(document.getElementById('user-debug').textContent),
        firm: JSON.parse(document.getElementById('firm-debug').textContent),
        system: JSON.parse(document.getElementById('system-debug').textContent)
      };
      
      const blob = new Blob([JSON.stringify(debugData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `firm-debug-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }
  
  // Refresh data
  const refreshData = document.getElementById('refresh-data');
  if (refreshData) {
    refreshData.addEventListener('click', loadSettings);
  }
  
  // Save settings
  const saveSettings = document.getElementById('save-settings');
  if (saveSettings) {
    saveSettings.addEventListener('click', saveFirmSettings);
  }
  
  // Retry button
  const retryButton = document.getElementById('retry-button');
  if (retryButton) {
    retryButton.addEventListener('click', loadSettings);
  }
  
  // Add User modal
  setupAddUserModal();
  
  console.log('Event listeners setup complete');
}

async function saveFirmSettings() {
  try {
    console.log('Save button clicked, starting save process...');
    
    const saveButton = document.getElementById('save-settings');
    if (!saveButton) {
      console.error('Save button not found');
      return;
    }
    
    const originalText = saveButton.textContent;
    saveButton.textContent = 'Saving...';
    saveButton.disabled = true;
    
    // Validate we have current firm data
    if (!currentFirmData || !currentFirmData.firmId) {
      throw new Error('No firm data loaded. Please refresh the page.');
    }
    
    // Collect form data
    const firmNameInput = document.getElementById('firm-name');
    const firmSizeSelect = document.getElementById('firm-size');
    const practiceAreasCheckboxes = document.querySelectorAll('#practice-areas input[type="checkbox"]:checked');
    
    if (!firmNameInput || !firmSizeSelect) {
      throw new Error('Form elements not found. Please refresh the page.');
    }
    
    const firmName = firmNameInput.value.trim();
    const firmSize = firmSizeSelect.value;
    const practiceAreas = Array.from(practiceAreasCheckboxes).map(checkbox => checkbox.value);
    
    console.log('Collected form data:', { firmName, firmSize, practiceAreas });
    
    if (!firmName) {
      throw new Error('Firm name is required');
    }
    
    const settingsData = {
      firmId: currentFirmData.firmId,
      firmName: firmName,
      firmSize: firmSize,
      practiceAreas: practiceAreas,
      lastUpdated: new Date().toISOString()
    };
    
    console.log('Sending settings data:', settingsData);
    
    // Call API to save settings
    const response = await fetch('/api/v1/firm/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settingsData)
    });
    
    console.log('API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API error response:', errorText);
      throw new Error(`Save failed: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    console.log('API response data:', result);
    
    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to save settings');
    }
    
    // Update current data
    currentFirmData = { ...currentFirmData, ...result.data.firm };
    
    // Update debug info
    updateDebugInfo(await auth0Client.getUser(), currentFirmData.firmId);
    
    // Show success feedback
    saveButton.textContent = 'Saved!';
    saveButton.classList.remove('bg-lexara-primary', 'hover:bg-blue-800');
    saveButton.classList.add('bg-lexara-success', 'hover:bg-green-800');
    
    console.log('Settings saved successfully');
    
    setTimeout(() => {
      saveButton.textContent = originalText;
      saveButton.classList.remove('bg-lexara-success', 'hover:bg-green-800');
      saveButton.classList.add('bg-lexara-primary', 'hover:bg-blue-800');
      saveButton.disabled = false;
    }, 2000);
    
  } catch (error) {
    console.error('Failed to save settings:', error);
    
    const saveButton = document.getElementById('save-settings');
    if (saveButton) {
      saveButton.textContent = 'Error';
      saveButton.classList.remove('bg-lexara-primary', 'hover:bg-blue-800');
      saveButton.classList.add('bg-lexara-error', 'hover:bg-red-800');
      
      setTimeout(() => {
        saveButton.textContent = 'Save Changes';
        saveButton.classList.remove('bg-lexara-error', 'hover:bg-red-800');
        saveButton.classList.add('bg-lexara-primary', 'hover:bg-blue-800');
        saveButton.disabled = false;
      }, 3000);
    }
    
    alert('Failed to save settings: ' + error.message);
  }
}

function getRoleColor(role) {
  switch (role) {
    case 'admin': return 'bg-lexara-primary/10 text-lexara-primary';
    case 'lawyer': return 'bg-lexara-accent/10 text-lexara-accent';
    case 'staff': return 'bg-gray-100 text-gray-600';
    default: return 'bg-gray-100 text-gray-600';
  }
}

function formatDate(dateString) {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function showLoading(show) {
  const loadingState = document.getElementById('loading-state');
  const settingsContent = document.getElementById('settings-content');
  const errorState = document.getElementById('error-state');
  
  if (show) {
    loadingState?.classList.remove('hidden');
    settingsContent?.classList.add('hidden');
    errorState?.classList.add('hidden');
  }
}

function showSettings() {
  const loadingState = document.getElementById('loading-state');
  const settingsContent = document.getElementById('settings-content');
  const errorState = document.getElementById('error-state');
  
  loadingState?.classList.add('hidden');
  settingsContent?.classList.remove('hidden');
  errorState?.classList.add('hidden');
}

function showError(message) {
  const loadingState = document.getElementById('loading-state');
  const settingsContent = document.getElementById('settings-content');
  const errorState = document.getElementById('error-state');
  const errorMessage = document.getElementById('error-message');
  
  loadingState?.classList.add('hidden');
  settingsContent?.classList.add('hidden');
  errorState?.classList.remove('hidden');
  
  if (errorMessage) {
    errorMessage.textContent = message;
  }
}

// Helper functions for user display
function getUserInitials(name) {
  if (!name) return '?';
  return name.split(' ')
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getEmailVerificationIcon(isVerified) {
  if (isVerified) {
    return '<svg class="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>';
  } else {
    return '<svg class="w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>';
  }
}

function getStatusColor(status) {
  switch (status) {
    case 'active': return 'bg-green-100 text-green-800';
    case 'pending': return 'bg-yellow-100 text-yellow-800';
    case 'inactive': return 'bg-gray-100 text-gray-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

function getStatusText(status) {
  switch (status) {
    case 'active': return 'Active';
    case 'pending': return 'Pending';
    case 'inactive': return 'Inactive';
    default: return 'Unknown';
  }
}

function getRoleSelectClass(role) {
  switch (role) {
    case 'admin': return 'bg-blue-50 border-blue-200 text-blue-700';
    case 'user': return 'bg-gray-50 border-gray-200 text-gray-700';
    default: return 'bg-gray-50 border-gray-200 text-gray-700';
  }
}

function getAdminCount(users) {
  return users.filter(user => user.role === 'admin').length;
}

// User management functions
async function changeUserRole(userId, newRole, currentRole) {
  if (newRole === currentRole) return;
  
  try {
    console.log(`Changing role for user ${userId} from ${currentRole} to ${newRole}`);
    
    const firmId = currentFirmData?.firmId;
    if (!firmId) {
      throw new Error('Firm ID not available');
    }

    const response = await fetch(`/api/v1/firm/users/${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await auth0Client.getTokenSilently()}`
      },
      body: JSON.stringify({
        firmId: firmId,
        role: newRole
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `Failed to update role: ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to update role');
    }

    console.log('Role updated successfully');
    
    // Refresh the user list
    await loadFirmData(firmId);
    
  } catch (error) {
    console.error('Failed to change user role:', error);
    alert(`Failed to change user role: ${error.message}`);
    
    // Revert the select dropdown
    const select = event.target;
    select.value = currentRole;
  }
}

function showRemoveUserModal(userId, userName, userRole) {
  const isLastAdmin = userRole === 'admin' && getAdminCount(currentFirmData.users) <= 1;
  
  if (isLastAdmin) {
    alert('Cannot remove the last administrator. Promote another user to admin first.');
    return;
  }

  const confirmed = confirm(
    `Are you sure you want to remove ${userName} from the firm?\n\n` +
    `This action cannot be undone. The user will lose access to the firm dashboard immediately.`
  );

  if (confirmed) {
    removeUser(userId, userName);
  }
}

async function removeUser(userId, userName) {
  try {
    console.log(`Removing user ${userId} (${userName})`);
    
    const firmId = currentFirmData?.firmId;
    if (!firmId) {
      throw new Error('Firm ID not available');
    }

    const response = await fetch(`/api/v1/firm/users/${userId}?firmId=${encodeURIComponent(firmId)}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await auth0Client.getTokenSilently()}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `Failed to remove user: ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to remove user');
    }

    console.log('User removed successfully');
    
    // Refresh the user list
    await loadFirmData(firmId);
    
    // Show success message
    alert(`${userName} has been removed from the firm.`);
    
  } catch (error) {
    console.error('Failed to remove user:', error);
    alert(`Failed to remove user: ${error.message}`);
  }
}

function setupAddUserModal() {
  const addUserButton = document.getElementById('add-user-button');
  const addUserModal = document.getElementById('add-user-modal');
  const closeModalButton = document.getElementById('close-add-user-modal');
  const cancelButton = document.getElementById('cancel-add-user');
  const addUserForm = document.getElementById('add-user-form');

  // Show modal
  if (addUserButton) {
    addUserButton.addEventListener('click', () => {
      console.log('Add User button clicked - showing modal');
      showAddUserModal();
    });
  }

  // Hide modal
  const hideModal = () => {
    if (addUserModal) {
      addUserModal.classList.add('hidden');
      resetAddUserForm();
    }
  };

  if (closeModalButton) {
    closeModalButton.addEventListener('click', hideModal);
  }

  if (cancelButton) {
    cancelButton.addEventListener('click', hideModal);
  }

  // Click outside to close
  if (addUserModal) {
    addUserModal.addEventListener('click', (e) => {
      if (e.target === addUserModal) {
        hideModal();
      }
    });
  }

  // Handle form submission
  if (addUserForm) {
    addUserForm.addEventListener('submit', handleAddUserSubmit);
  }
}

function showAddUserModal() {
  console.log('Showing add user modal');
  const addUserModal = document.getElementById('add-user-modal');
  if (addUserModal) {
    addUserModal.classList.remove('hidden');
    // Focus on email input
    const emailInput = document.getElementById('new-user-email');
    if (emailInput) {
      setTimeout(() => emailInput.focus(), 100);
    }
  } else {
    console.error('Add user modal not found');
  }
}

function resetAddUserForm() {
  const form = document.getElementById('add-user-form');
  if (form) {
    form.reset();
  }
  
  // Reset submit button
  const submitButton = document.getElementById('submit-add-user');
  if (submitButton) {
    submitButton.textContent = 'Send Invitation';
    submitButton.disabled = false;
    submitButton.classList.remove('bg-gray-400');
    submitButton.classList.add('bg-lexara-primary');
  }
}

async function handleAddUserSubmit(event) {
  event.preventDefault();
  
  const submitButton = document.getElementById('submit-add-user');
  const originalText = submitButton?.textContent || 'Send Invitation';
  
  try {
    // Update button state
    if (submitButton) {
      submitButton.textContent = 'Sending...';
      submitButton.disabled = true;
      submitButton.classList.remove('bg-lexara-primary');
      submitButton.classList.add('bg-gray-400');
    }

    // Get form data
    const formData = new FormData(event.target);
    const email = formData.get('email')?.trim();
    const role = formData.get('role');
    const firstName = formData.get('firstName')?.trim();
    const lastName = formData.get('lastName')?.trim();

    // Validate required fields
    if (!email || !role) {
      throw new Error('Email and role are required');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Please enter a valid email address');
    }

    // Get firm ID
    const firmId = currentFirmData?.firmId;
    if (!firmId) {
      throw new Error('Firm ID not available');
    }

    // Prepare request data
    const requestData = {
      firmId: firmId,
      email: email,
      role: role
    };

    if (firstName) requestData.firstName = firstName;
    if (lastName) requestData.lastName = lastName;

    console.log('Sending user invitation:', requestData);

    // Send invitation
    const response = await fetch('/api/v1/firm/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await auth0Client.getTokenSilently()}`
      },
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `Failed to send invitation: ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to send invitation');
    }

    console.log('User invitation sent successfully');

    // Show success
    if (submitButton) {
      submitButton.textContent = 'Sent!';
      submitButton.classList.remove('bg-gray-400');
      submitButton.classList.add('bg-lexara-success');
    }

    // Close modal after short delay
    setTimeout(() => {
      const addUserModal = document.getElementById('add-user-modal');
      if (addUserModal) {
        addUserModal.classList.add('hidden');
        resetAddUserForm();
      }
    }, 1500);

    // Refresh user list
    await loadFirmData(firmId);

    // Show success message
    alert(`Invitation sent to ${email}. They will receive an email to complete their registration.`);

  } catch (error) {
    console.error('Failed to send invitation:', error);
    
    // Reset button
    if (submitButton) {
      submitButton.textContent = originalText;
      submitButton.disabled = false;
      submitButton.classList.remove('bg-gray-400');
      submitButton.classList.add('bg-lexara-primary');
    }
    
    alert(`Failed to send invitation: ${error.message}`);
  }
}

function setupAddUserModal() {
  console.log('Setting up Add User Modal');
  
  const addUserButton = document.getElementById('add-user-button');
  const addUserModal = document.getElementById('add-user-modal');
  const closeModalButton = document.getElementById('close-add-user-modal');
  const cancelButton = document.getElementById('cancel-add-user');
  const addUserForm = document.getElementById('add-user-form');

  console.log('Add User Button:', addUserButton);
  console.log('Add User Modal:', addUserModal);

  // Show modal
  if (addUserButton) {
    addUserButton.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('Add User button clicked - showing modal');
      showAddUserModal();
    });
    console.log('Add User button event listener attached');
  } else {
    console.error('Add User button not found!');
  }

  // Hide modal
  const hideModal = () => {
    console.log('Hiding modal');
    if (addUserModal) {
      addUserModal.classList.add('hidden');
      resetAddUserForm();
    }
  };

  if (closeModalButton) {
    closeModalButton.addEventListener('click', hideModal);
  }

  if (cancelButton) {
    cancelButton.addEventListener('click', hideModal);
  }

  // Click outside to close
  if (addUserModal) {
    addUserModal.addEventListener('click', (e) => {
      if (e.target === addUserModal) {
        hideModal();
      }
    });
  }

  // Handle form submission
  if (addUserForm) {
    addUserForm.addEventListener('submit', handleAddUserSubmit);
  }
}

function showAddUserModal() {
  console.log('Showing add user modal');
  const addUserModal = document.getElementById('add-user-modal');
  if (addUserModal) {
    addUserModal.classList.remove('hidden');
    console.log('Modal shown successfully');
    // Focus on email input
    const emailInput = document.getElementById('new-user-email');
    if (emailInput) {
      setTimeout(() => emailInput.focus(), 100);
    }
  } else {
    console.error('Add user modal not found');
  }
}

function resetAddUserForm() {
  const form = document.getElementById('add-user-form');
  if (form) {
    form.reset();
  }
  
  // Reset submit button
  const submitButton = document.getElementById('submit-add-user');
  if (submitButton) {
    submitButton.textContent = 'Send Invitation';
    submitButton.disabled = false;
    submitButton.classList.remove('bg-gray-400');
    submitButton.classList.add('bg-lexara-primary');
  }
}

async function handleAddUserSubmit(event) {
  event.preventDefault();
  
  const submitButton = document.getElementById('submit-add-user');
  const originalText = submitButton?.textContent || 'Send Invitation';
  
  try {
    // Update button state
    if (submitButton) {
      submitButton.textContent = 'Sending...';
      submitButton.disabled = true;
      submitButton.classList.remove('bg-lexara-primary');
      submitButton.classList.add('bg-gray-400');
    }

    // Get form data
    const formData = new FormData(event.target);
    const email = formData.get('email')?.trim();
    const role = formData.get('role');
    const firstName = formData.get('firstName')?.trim();
    const lastName = formData.get('lastName')?.trim();

    // Validate required fields
    if (!email || !role) {
      throw new Error('Email and role are required');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Please enter a valid email address');
    }

    // Get firm ID
    const firmId = currentFirmData?.firmId;
    if (!firmId) {
      throw new Error('Firm ID not available');
    }

    // Prepare request data
    const requestData = {
      firmId: firmId,
      email: email,
      role: role
    };

    if (firstName) requestData.firstName = firstName;
    if (lastName) requestData.lastName = lastName;

    console.log('Sending user invitation:', requestData);

    // Send invitation
    const response = await fetch('/api/v1/firm/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await auth0Client.getTokenSilently()}`
      },
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `Failed to send invitation: ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to send invitation');
    }

    console.log('User invitation sent successfully');

    // Show success
    if (submitButton) {
      submitButton.textContent = 'Sent!';
      submitButton.classList.remove('bg-gray-400');
      submitButton.classList.add('bg-lexara-success');
    }

    // Close modal after short delay
    setTimeout(() => {
      const addUserModal = document.getElementById('add-user-modal');
      if (addUserModal) {
        addUserModal.classList.add('hidden');
        resetAddUserForm();
      }
    }, 1500);

    // Refresh user list
    await loadFirmData(firmId);

    // Show success message
    alert(`Invitation sent to ${email}. They will receive an email to complete their registration.`);

  } catch (error) {
    console.error('Failed to send invitation:', error);
    
    // Reset button
    if (submitButton) {
      submitButton.textContent = originalText;
      submitButton.disabled = false;
      submitButton.classList.remove('bg-gray-400');
      submitButton.classList.add('bg-lexara-primary');
    }
    
    alert(`Failed to send invitation: ${error.message}`);
  }
}

// Make functions globally available for onclick handlers
window.changeUserRole = changeUserRole;
window.showRemoveUserModal = showRemoveUserModal;
window.showAddUserModal = showAddUserModal;
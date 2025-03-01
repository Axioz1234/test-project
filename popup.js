// Popup script for auto copy to Google Docs extension
document.addEventListener('DOMContentLoaded', function() {
  console.log("Popup initialized - Pro version");
  
  // Initialize UI
  updateUI();
  
  // Set up button handlers
  document.getElementById('authorize').addEventListener('click', authorize);
  document.getElementById('saveSettings').addEventListener('click', saveSettings);
  document.getElementById('testPaste').addEventListener('click', testPaste);
  document.getElementById('clearAuth').addEventListener('click', clearAuth);
  
  // Set up checkbox handler for source URLs
  const includeUrlsCheckbox = document.getElementById('includeSourceUrls');
  includeUrlsCheckbox.addEventListener('change', function() {
    chrome.storage.local.set({includeSourceUrls: this.checked}, function() {
      console.log("Source URL preference saved:", includeUrlsCheckbox.checked);
    });
  });
});

// Function to update the UI based on current state
function updateUI() {
  // Get current authorization and settings
  chrome.storage.local.get(['isAuthorized', 'docId', 'includeSourceUrls'], function(result) {
    // Update auth status indicator
    const authIndicator = document.getElementById('auth-indicator');
    const authStatus = document.getElementById('auth-status');
    
    if (result.isAuthorized) {
      authIndicator.classList.add('active');
      authIndicator.classList.remove('inactive');
      authStatus.textContent = 'Authorized';
    } else {
      authIndicator.classList.add('inactive');
      authIndicator.classList.remove('active');
      authStatus.textContent = 'Not authorized';
    }
    
    // Update doc ID field
    if (result.docId) {
      document.getElementById('docId').value = result.docId;
    }
    
    // Update source URLs checkbox
    // Default to true if not set
    const includeSourceUrls = result.includeSourceUrls !== false;
    document.getElementById('includeSourceUrls').checked = includeSourceUrls;
  });
}

// Function to clear authorization
function clearAuth() {
  if (confirm('This will clear your Google authorization. You will need to authorize again. Continue?')) {
    showStatus('Clearing authorization...', 'normal');
    chrome.runtime.sendMessage({action: 'clearAuth'}, function(response) {
      if (response && response.success) {
        showStatus('Authorization cleared. Please authorize again.', 'normal');
        updateUI();
      } else {
        showStatus('Failed to clear authorization.', 'error');
      }
    });
  }
}

// Function to authorize with Google
function authorize() {
  showStatus('Authorizing with Google...', 'normal');
  
  chrome.runtime.sendMessage({action: 'authorize'}, function(response) {
    if (response && response.success) {
      showStatus('Authorization successful!', 'success');
      updateUI();
    } else {
      const errorMsg = response && response.error ? response.error : 'Unknown error';
      showStatus('Authorization failed: ' + errorMsg, 'error');
    }
  });
}

// Function to save settings
function saveSettings() {
  let inputDocId = document.getElementById('docId').value.trim();
  
  if (!inputDocId) {
    showStatus('Please enter a Google Doc ID or URL', 'error');
    return;
  }
  
  // Clean up Doc ID
  if (inputDocId.includes('/edit')) {
    inputDocId = inputDocId.split('/edit')[0];
  }
  if (inputDocId.includes('docs.google.com/document/d/')) {
    inputDocId = inputDocId.split('docs.google.com/document/d/')[1];
  }
  
  // Save to storage
  chrome.storage.local.set({docId: inputDocId}, function() {
    document.getElementById('docId').value = inputDocId;
    showStatus('Settings saved! Document ID: ' + inputDocId, 'success');
  });
}

// Function to test pasting from clipboard
function testPaste() {
  showStatus('Testing clipboard paste...', 'normal');
  
  navigator.clipboard.readText()
    .then(text => {
      if (!text) {
        showStatus('Clipboard is empty', 'error');
        return;
      }
      
      chrome.runtime.sendMessage({
        action: 'manualPaste',
        text: text
      }, function(response) {
        if (response && response.success) {
          showStatus('Test successful! Text added to Doc.', 'success');
        } else {
          const errorMsg = response && response.error ? response.error : 'Unknown error';
          showStatus('Test failed: ' + errorMsg, 'error');
        }
      });
    })
    .catch(error => {
      showStatus('Error reading clipboard: ' + error.message, 'error');
    });
}

// Helper function to show status
function showStatus(message, type) {
  const statusElement = document.getElementById('status');
  statusElement.textContent = message;
  
  // Reset classes
  statusElement.classList.remove('error', 'success');
  
  // Add appropriate class
  if (type === 'error') {
    statusElement.classList.add('error');
  } else if (type === 'success') {
    statusElement.classList.add('success');
  }
}
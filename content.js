// This script runs on every webpage and monitors for copy events
console.log("📋 Content script loaded on " + window.location.href);

// Initialize floating button and auto-copy functionality
let lastCopiedText = '';
let lastCopyTime = 0;
let floatingButton = null;

// No more floating button - we've removed it
// Initialize the content script
console.log("📋 Content script initialized - Pro version");

// Listen for messages from background
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  // Handle notification of text pasted
  if (request.action === 'textPasted' && request.success) {
    showNotification('Text copied to Google Doc!', false);
  }
  
  return true;
});

// Track when we've handled a copy to avoid duplicates
let lastProcessedText = '';
let lastProcessTime = 0;
let processingInProgress = false;

// Method 1: Standard copy event listener
document.addEventListener('copy', function(event) {
  console.log("📋 Copy event detected");
  
  // Track what text is being copied for duplicate detection
  const selectedText = window.getSelection().toString().trim();
  if (selectedText) {
    // Store this for duplicate prevention in background script
    chrome.storage.local.set({
      lastCopiedText: selectedText,
      lastCopyTime: Date.now()
    });
  }
  
  handleCopyEvent();
});

// Method 2: Selection change monitoring
document.addEventListener('selectionchange', function() {
  // This helps detect copy events that might not trigger the copy event
  if (document.hasFocus()) {
    // Listen for Ctrl+C or Command+C
    document.addEventListener('keydown', function(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        console.log("📋 Keyboard copy detected (Ctrl/Cmd+C)");
        setTimeout(handleCopyEvent, 100); // Small delay to let the copy happen
      }
    }, { once: true });
  }
});

// Method 3: Clipboard API (where supported)
if (navigator.clipboard && navigator.clipboard.readText) {
  // Poll clipboard periodically (only in active tabs)
  let isActive = true;
  
  window.addEventListener('focus', () => { isActive = true; });
  window.addEventListener('blur', () => { isActive = false; });
  
  // Check clipboard every 2 seconds when tab is active
  setInterval(() => {
    if (isActive) {
      try {
        navigator.clipboard.readText().then(text => {
          if (text && text.trim() && text !== lastCopiedText) {
            console.log("📋 New clipboard content detected");
            lastCopiedText = text;
            sendTextToBackgroundScript(text);
          }
        }).catch(err => {
          // Silent fail - clipboard permission may not be granted
        });
      } catch (e) {
        // Silent fail for unsupported browsers
      }
    }
  }, 2000);
}

// Handle copy events
function handleCopyEvent() {
  // Prevent duplicate processing
  const now = Date.now();
  if (now - lastCopyTime < 1000) {
    return; // Ignore if less than 1 second since last copy
  }
  lastCopyTime = now;
  
  try {
    // Get selected text
    const selectedText = window.getSelection().toString().trim();
    
    if (selectedText && selectedText !== lastCopiedText) {
      console.log("📋 Text copied: " + selectedText.substring(0, 50) + (selectedText.length > 50 ? "..." : ""));
      lastCopiedText = selectedText;
      sendTextToBackgroundScript(selectedText);
    }
  } catch (e) {
    console.error("📋 Error in copy handler:", e);
  }
}

// Send text to background script with better error handling
function sendTextToBackgroundScript(text) {
  // Prevent duplicate sending
  if (processingInProgress || (text === lastProcessedText && Date.now() - lastProcessTime < 3000)) {
    console.log("📋 Skipping duplicate text processing");
    return;
  }
  
  // Mark as processing and update last processed text
  processingInProgress = true;
  lastProcessedText = text;
  lastProcessTime = Date.now();
  
  try {
    // Get the includeSourceUrls preference before sending
    chrome.storage.local.get(['includeSourceUrls', 'processingId'], function(result) {
      chrome.runtime.sendMessage({
        action: 'textCopied',
        text: text,
        url: result.includeSourceUrls ? window.location.href : null,
        title: result.includeSourceUrls ? document.title : null,
        processingId: result.processingId // Pass along the processing ID for deduplication
      }, function(response) {
      if (chrome.runtime.lastError) {
        console.error("📋 Runtime error:", chrome.runtime.lastError);
        // Still show a notification even if there's a connection error
        showNotification("Text will be copied to Google Doc", false);
        return;
      }
      
      if (response && response.success) {
        console.log("📋 Successfully sent to Google Doc");
        showNotification("Text copied to Google Doc!", false);
      } else if (response && response.error) {
        console.error("📋 Error sending to Google Doc:", response.error);
        showNotification("Error: " + response.error, true);
      } else {
        console.log("📋 No response from background script");
        // Still show a notification
        showNotification("Text will be processed", false);
      }
      
      // Reset processing flag after response
      processingInProgress = false;
    });
    });
  } catch (e) {
    // Reset processing flag on error
    processingInProgress = false;
    console.error("📋 Exception sending to background:", e);
    // Still show a positive notification since background monitoring should catch it
    showNotification("Text will be processed", false);
  }
}

// All floating button code removed - it's not needed anymore

// Show a brief notification (toast-style, more prominent)
function showNotification(message, isError) {
  // Remove any existing notifications
  const existingNotification = document.getElementById('gdocs-notification');
  if (existingNotification) {
    existingNotification.remove();
  }
  
  // Create notification container
  const notification = document.createElement('div');
  notification.id = 'gdocs-notification';
  
  // Create icon based on status
  const icon = document.createElement('div');
  icon.className = 'notification-icon';
  icon.innerHTML = isError 
    ? '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>'
    : '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
  
  // Create message text
  const text = document.createElement('div');
  text.className = 'notification-text';
  text.textContent = message;
  
  // Add Google logo for branding
  const logo = document.createElement('div');
  logo.className = 'notification-logo';
  logo.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>';
  
  // Assemble notification
  notification.appendChild(icon);
  notification.appendChild(text);
  notification.appendChild(logo);
  
  // Style the notification
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    padding: 12px 16px;
    background-color: ${isError ? '#FEECEB' : '#E6F4EA'};
    color: ${isError ? '#D93025' : '#188038'};
    border-left: 4px solid ${isError ? '#D93025' : '#188038'};
    border-radius: 4px;
    font-family: 'Roboto', Arial, sans-serif;
    font-size: 14px;
    z-index: 99999;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    display: flex;
    align-items: center;
    min-width: 250px;
    max-width: 450px;
    animation: gdocsNotificationSlideIn 0.3s forwards;
  `;
  
  // Add CSS for the components and animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes gdocsNotificationSlideIn {
      from { transform: translate(-50%, -100%); opacity: 0; }
      to { transform: translate(-50%, 0); opacity: 1; }
    }
    @keyframes gdocsNotificationSlideOut {
      from { transform: translate(-50%, 0); opacity: 1; }
      to { transform: translate(-50%, -100%); opacity: 0; }
    }
    #gdocs-notification .notification-icon {
      margin-right: 12px;
      display: flex;
      align-items: center;
    }
    #gdocs-notification .notification-text {
      flex: 1;
    }
    #gdocs-notification .notification-logo {
      margin-left: 12px;
      opacity: 0.7;
    }
  `;
  document.head.appendChild(style);
  
  // Add to page
  document.body.appendChild(notification);
  
  // Remove after delay with animation
  setTimeout(function() {
    notification.style.animation = 'gdocsNotificationSlideOut 0.3s forwards';
    setTimeout(function() {
      if (notification.parentNode) {
        document.body.removeChild(notification);
      }
      if (style.parentNode) {
        document.head.removeChild(style);
      }
    }, 300);
  }, 3000);
}
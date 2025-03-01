// Background script for automatic copy-to-docs functionality
console.log("Background script initialized - v5 with direct clipboard detection");

// Setup clipboard monitoring
let lastClipboardText = '';
function setupClipboardMonitoring() {
  // Check clipboard periodically
  setInterval(function() {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        navigator.clipboard.readText().then(text => {
          if (text && text.trim() && text !== lastClipboardText) {
            console.log("📋 New clipboard content detected by background script");
            lastClipboardText = text;
            handleCopiedText(text);
          }
        }).catch(err => {
          // Silent fail - clipboard permission may not be granted
        });
      }
    } catch (e) {
      // Silent fail for unsupported browsers
    }
  }, 1000); // Check every second
}

// Handle copied text directly
function handleCopiedText(text) {
  // Check for duplicate content to avoid double-pasting
  chrome.storage.local.get(['lastCopiedText', 'lastCopyTime'], function(stored) {
    // If this is the same text and it was copied in the last 2 seconds, skip it
    const now = Date.now();
    if (stored.lastCopiedText === text && 
        stored.lastCopyTime && 
        (now - stored.lastCopyTime < 2000)) {
      console.log("Duplicate content detected, skipping paste");
      return;
    }
    
    // Update the last copied text for future duplicate checks
    chrome.storage.local.set({
      lastCopiedText: text,
      lastCopyTime: now
    });
    
    // Get the active tab for source information
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      let sourceUrl = '';
      let sourceTitle = '';
      
      if (tabs.length > 0) {
        sourceUrl = tabs[0].url;
        sourceTitle = tabs[0].title;
      }
      
      // Only proceed if we have authorization and a doc ID
      chrome.storage.local.get(['isAuthorized', 'docId', 'includeSourceUrls'], function(result) {
        if (!result.isAuthorized || !result.docId) {
          console.log("Not authorized or no Doc ID set, can't auto-paste");
          return;
        }
        
        // Check if we should include source URLs
        const includeSourceUrls = result.includeSourceUrls !== false;
        
        console.log("Auto-pasting text to Google Doc:", result.docId);
        console.log("Include source URLs:", includeSourceUrls);
        
        appendToGoogleDoc(
          result.docId, 
          text, 
          includeSourceUrls ? sourceUrl : null, 
          includeSourceUrls ? sourceTitle : null
        ).then(() => {
          console.log("Successfully auto-pasted text to Google Doc");
          
          // Notify all tabs of the successful paste
          chrome.tabs.query({}, function(tabs) {
            tabs.forEach(tab => {
              try {
                chrome.tabs.sendMessage(tab.id, {
                  action: 'textPasted',
                  success: true
                });
              } catch (e) {
                // Tab might not have content script loaded, ignore errors
              }
            });
          });
        }).catch(error => {
          console.error("Error auto-pasting to Google Doc:", error);
        });
      });
    });
  });
}

// Start clipboard monitoring
setupClipboardMonitoring();

// Store the current auth token
let accessToken = null;
let isAuthorized = false;

// Check if we're already authorized
chrome.storage.local.get(['isAuthorized'], function(result) {
  isAuthorized = result.isAuthorized || false;
  console.log("Initial authorization state:", isAuthorized);
  
  // If we think we're authorized, validate the token
  if (isAuthorized) {
    chrome.identity.getAuthToken({interactive: false}, function(token) {
      if (token) {
        console.log("Retrieved existing token");
        accessToken = token;
      } else {
        console.log("No existing token found, will need to authorize");
        isAuthorized = false;
        chrome.storage.local.set({isAuthorized: false});
      }
    });
  }
});

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log("Message received:", request.action);
  
  // Handle auth request from popup
  if (request.action === 'authorize') {
    authorize()
      .then(token => {
        isAuthorized = true;
        chrome.storage.local.set({isAuthorized: true});
        sendResponse({success: true});
      })
      .catch(error => {
        console.error('Authorization error:', error);
        isAuthorized = false;
        chrome.storage.local.set({isAuthorized: false});
        sendResponse({success: false, error: error.message});
      });
    return true; // Keep the message channel open for async response
  }
  
  // Handle clear auth request
  if (request.action === 'clearAuth') {
    console.log("Clearing authorization");
    if (accessToken) {
      chrome.identity.removeCachedAuthToken({token: accessToken}, function() {
        console.log("Auth token removed");
        accessToken = null;
        isAuthorized = false;
        chrome.storage.local.set({isAuthorized: false}, function() {
          sendResponse({success: true});
        });
      });
    } else {
      isAuthorized = false;
      chrome.storage.local.set({isAuthorized: false}, function() {
        sendResponse({success: true});
      });
    }
    return true; // Keep the message channel open for async response
  }
  
  // Handle text copied from content script
  if (request.action === 'textCopied') {
    console.log("Text copied event from content script");
    
    // Check if we're authorized
    if (!isAuthorized || !accessToken) {
      console.log("Not authorized yet, can't handle copied text");
      sendResponse({success: false, error: "Not authorized yet. Please open extension popup and click 'Authorize'"});
      return true;
    }
    
    // Get the Google Doc ID
    chrome.storage.local.get(['docId'], function(result) {
      if (!result.docId) {
        console.log("No Google Doc ID found");
        sendResponse({success: false, error: "No Google Doc ID set. Please open extension popup and set a Doc ID"});
        return;
      }
      
      console.log("Sending text to Google Doc without requiring doc tab to be active");
      
      // Add the copied text to the Google Doc
      appendToGoogleDoc(result.docId, request.text, request.url, request.title)
        .then(() => {
          console.log("Successfully added text to Google Doc");
          sendResponse({success: true});
        })
        .catch(error => {
          console.error("Error adding text to Google Doc:", error);
          sendResponse({success: false, error: error.message});
          
          // If the token is invalid, we need to re-authorize
          if (error.message.includes('invalid_token') || error.message.includes('Invalid Credentials')) {
            console.log("Token appears to be invalid, clearing it");
            chrome.identity.removeCachedAuthToken({token: accessToken}, function() {
              accessToken = null;
              isAuthorized = false;
              chrome.storage.local.set({isAuthorized: false});
            });
          }
        });
    });
    return true; // Keep the message channel open for async response
  }
  
  // Handle manual paste request from popup
  if (request.action === 'manualPaste') {
    console.log("Manual paste request from popup");
    const text = request.text;
    
    // Get the Google Doc ID
    chrome.storage.local.get(['docId'], function(result) {
      if (!result.docId) {
        console.log("No Google Doc ID found");
        sendResponse({success: false, error: "No Google Doc ID set"});
        return;
      }
      
      // Add the text to the Google Doc
      appendToGoogleDoc(result.docId, text)
        .then(() => {
          console.log("Successfully added text to Google Doc");
          sendResponse({success: true});
        })
        .catch(error => {
          console.error("Error adding text to Google Doc:", error);
          sendResponse({success: false, error: error.message});
        });
    });
    return true; // Keep the message channel open for async response
  }
});

// Function to authorize with Google
function authorize() {
  console.log("Starting authorization process...");
  
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({interactive: true}, function(token) {
      if (chrome.runtime.lastError) {
        console.error("Auth error:", chrome.runtime.lastError);
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      
      if (!token) {
        console.error("No token received");
        reject(new Error("No token received from Google"));
        return;
      }
      
      console.log("Authorization successful!");
      accessToken = token;
      resolve(token);
    });
  });
}

// Function to append text to a Google Doc
async function appendToGoogleDoc(docId, text, sourceUrl, sourceTitle) {
  console.log("Appending to Google Doc:", docId);
  const endpoint = `https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`;
  
  // Simplify our approach to avoid index errors
  let fullText = "";
  
  // Start with the source information at the top if available
  if (sourceUrl && sourceTitle) {
    fullText = "Source: " + sourceTitle + "\n" + "URL: " + sourceUrl + "\n\n";
  }
  
  // Then add the text content
  fullText = fullText + text + "\n\n";
  
  // Create a single insertion request
  const requests = [{
    insertText: {
      location: { index: 1 },
      text: fullText
    }
  }];
  
  const requestBody = {
    requests: requests
  };
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      let errorMessage = "Unknown error";
      try {
        const errorData = await response.json();
        errorMessage = errorData.error ? errorData.error.message : "API error";
      } catch (e) {
        const errorText = await response.text();
        errorMessage = errorText || "Unknown error";
      }
      
      throw new Error(errorMessage);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error in appendToGoogleDoc:", error);
    throw error;
  }
}
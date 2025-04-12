// Ad blocking filter lists
const adServerDomains = [
  'doubleclick.net',
  'googlesyndication.com',
  'googleadservices.com',
  'moatads.com',
  'adnxs.com',
  'rubiconproject.com',
  'criteo.com',
  'casalemedia.com',
  'openx.net',
  'juicyads.com',
  'taboola.com',
  'outbrain.com',
  'teads.tv',
  'bidswitch.net',
  'adsrvr.org'
];

// YouTube specific ad patterns
const youtubeAdPatterns = [
  '*://*.youtube.com/api/stats/ads*',
  '*://*.youtube.com/pagead/*',
  '*://*.youtube.com/ptracking*',
  '*://www.youtube.com/api/stats/qoe*',
  '*://www.youtube.com/pagead/*',
  '*://www.youtube.com/ptracking*',
  '*://www.google.com/pagead/*',
  '*://*.googlevideo.com/videoplayback?*&oad*',
  '*://www.youtube.com/get_midroll_*'
];

// Initialize storage with default values
chrome.runtime.onInstalled.addListener(() => {
  try {
    chrome.storage.local.get(['enabled', 'adsBlockedToday', 'adsBlockedTotal', 'lastReset'], function(data) {
      const defaults = {
        enabled: data.enabled !== undefined ? data.enabled : true,
        adsBlockedToday: data.adsBlockedToday || 0,
        adsBlockedTotal: data.adsBlockedTotal || 0,
        lastReset: data.lastReset || new Date().toDateString()
      };
      
      // Check if we need to reset daily counter
      const today = new Date().toDateString();
      if (today !== defaults.lastReset) {
        defaults.adsBlockedToday = 0;
        defaults.lastReset = today;
      }
      
      chrome.storage.local.set(defaults);
    });
  } catch (error) {
    console.debug('Error initializing storage:', error);
  }
});

// Helper function to check if the URL is injectable
function isInjectableUrl(url) {
  if (!url) return false;
  
  // Cannot inject into chrome:// pages, extension pages, or other restricted URLs
  return !url.startsWith('chrome://') && 
         !url.startsWith('chrome-extension://') && 
         !url.startsWith('chrome-search://') &&
         !url.startsWith('devtools://') &&
         !url.startsWith('file://') &&
         !url.startsWith('about:') &&
         !url.startsWith('edge://') &&
         !url.startsWith('brave://');
}

// Track script injection to avoid duplicate injections
const injectedTabs = new Set();

// Listen for tab updates to apply additional ad blocking when a page loads
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Make sure the page is fully loaded and has a URL
  if (changeInfo.status === 'complete' && tab.url && isInjectableUrl(tab.url)) {
    // Avoid re-injecting scripts into the same tab during the same session
    const tabKey = `${tabId}-${new URL(tab.url).hostname}`;
    
    // Check if we need to inject scripts
    if (!injectedTabs.has(tabKey)) {
      injectedTabs.add(tabKey);
      
      // Inject appropriate content scripts based on URL
      const isYouTube = tab.url.includes('youtube.com');
      
      // Inject general ad blocker script
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      }).catch(err => {
        console.debug('Failed to inject content.js:', err.message);
        // Remove from injected set to allow retry on next navigation
        injectedTabs.delete(tabKey);
      });
      
      // Inject YouTube-specific script if needed
      if (isYouTube) {
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['youtube.js']
        }).catch(err => {
          console.debug('Failed to inject youtube.js:', err.message);
        });
      }
    }
  }
});

// Clean up our injected tabs record when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  // Remove any entries for this tab
  for (const key of injectedTabs) {
    if (key.startsWith(`${tabId}-`)) {
      injectedTabs.delete(key);
    }
  }
});

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getAdStats') {
    // Return ad counting stats
    try {
      chrome.storage.local.get(['adsBlockedToday', 'adsBlockedTotal'], function(data) {
        try {
          sendResponse(data);
        } catch (error) {
          console.debug('Error sending response:', error);
        }
      });
    } catch (error) {
      console.debug('Error getting stats:', error);
      sendResponse({ error: 'Failed to get ad stats' });
    }
    return true; // Required for asynchronous response
  }
  
  if (message.action === 'updateAdCount' && message.adsBlocked) {
    // Update counters
    try {
      chrome.storage.local.get(['adsBlockedToday', 'adsBlockedTotal', 'lastReset'], function(data) {
        try {
          // Initialize defaults if not present
          const blockedToday = data.adsBlockedToday || 0;
          const blockedTotal = data.adsBlockedTotal || 0;
          const lastReset = data.lastReset || new Date().toDateString();
          
          // Check if we need to reset the daily counter
          const today = new Date().toDateString();
          
          if (today !== lastReset) {
            // Reset for new day
            chrome.storage.local.set({
              adsBlockedToday: message.adsBlocked,
              adsBlockedTotal: blockedTotal + message.adsBlocked,
              lastReset: today
            });
          } else {
            // Update existing counters
            chrome.storage.local.set({
              adsBlockedToday: blockedToday + message.adsBlocked,
              adsBlockedTotal: blockedTotal + message.adsBlocked
            });
          }
          
          sendResponse({ success: true });
        } catch (error) {
          console.debug('Error updating counters:', error);
          sendResponse({ error: 'Failed to update counters' });
        }
      });
    } catch (error) {
      console.debug('Error handling updateAdCount:', error);
      sendResponse({ error: 'Failed to update ad count' });
    }
    return true;
  }
}); 
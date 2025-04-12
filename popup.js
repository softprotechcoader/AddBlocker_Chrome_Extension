document.addEventListener('DOMContentLoaded', function() {
  const statusBox = document.getElementById('statusBox');
  const adBlockToggle = document.getElementById('adBlockToggle');
  const adsBlockedToday = document.getElementById('adsBlockedToday');
  const adsBlockedTotal = document.getElementById('adsBlockedTotal');
  
  // Load settings and stats from storage
  chrome.storage.local.get(['enabled', 'adsBlockedToday', 'adsBlockedTotal', 'lastReset'], function(data) {
    // Initialize default values if not set
    const enabled = data.enabled !== undefined ? data.enabled : true;
    const blockedToday = data.adsBlockedToday || 0;
    const blockedTotal = data.adsBlockedTotal || 0;
    const lastReset = data.lastReset || new Date().toDateString();
    
    // Check if we need to reset daily counter
    const today = new Date().toDateString();
    if (today !== lastReset) {
      chrome.storage.local.set({
        adsBlockedToday: 0,
        lastReset: today
      });
      adsBlockedToday.textContent = '0';
    } else {
      adsBlockedToday.textContent = blockedToday.toString();
    }
    
    // Update UI
    adBlockToggle.checked = enabled;
    adsBlockedTotal.textContent = blockedTotal.toString();
    
    if (enabled) {
      statusBox.textContent = 'Ad blocking is enabled';
      statusBox.className = 'status enabled';
    } else {
      statusBox.textContent = 'Ad blocking is disabled';
      statusBox.className = 'status disabled';
    }
  });
  
  // Toggle ad blocking
  adBlockToggle.addEventListener('change', function() {
    const enabled = adBlockToggle.checked;
    
    // Save setting
    chrome.storage.local.set({ enabled: enabled });
    
    // Update status message
    if (enabled) {
      statusBox.textContent = 'Ad blocking is enabled';
      statusBox.className = 'status enabled';
    } else {
      statusBox.textContent = 'Ad blocking is disabled';
      statusBox.className = 'status disabled';
    }
    
    // Notify all tabs about the change using the messaging API
    chrome.tabs.query({}, function(tabs) {
      tabs.forEach(function(tab) {
        try {
          chrome.tabs.sendMessage(tab.id, { 
            action: 'toggleAdBlocking', 
            enabled: enabled 
          }).catch(err => {
            console.log('Could not send message to tab:', tab.id);
          });
        } catch (error) {
          console.log('Error sending message to tab:', tab.id);
        }
      });
    });
  });
  
  // Request latest stats from the background script
  chrome.runtime.sendMessage({ action: 'getAdStats' }, function(response) {
    if (response) {
      adsBlockedToday.textContent = response.adsBlockedToday || '0';
      adsBlockedTotal.textContent = response.adsBlockedTotal || '0';
    }
  });
}); 
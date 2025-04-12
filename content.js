// Use an IIFE to isolate our code
(function() {
  // Only define if not already initialized
  if (typeof window.adRemoverInitialized === 'undefined') {
    // Set flag to prevent multiple initializations
    window.adRemoverInitialized = true;
    
    // Common ad class names and IDs
    const adSelectors = [
      // Common ad selectors
      '[class*="ad-"],[class*="Ad-"],[class*="AD-"],[class*="_ad_"],[class*="_Ad_"],[class*="_AD_"]',
      '[id*="ad-"],[id*="Ad-"],[id*="AD-"],[id*="_ad_"],[id*="_Ad_"],[id*="_AD_"]',
      '[class*="advert"],[class*="Advert"],[class*="ADVERT"]',
      '[id*="advert"],[id*="Advert"],[id*="ADVERT"]',
      '[class*="sponsor"],[class*="Sponsor"],[class*="SPONSOR"]',
      '[id*="sponsor"],[id*="Sponsor"],[id*="SPONSOR"]',
      '[class*="banner"],[class*="Banner"],[class*="BANNER"]',
      '[id*="banner"],[id*="Banner"],[id*="BANNER"]',
      'iframe[src*="ad"],[id*="google_ads_iframe"]',
      '[class*="adsbox"],[id*="adsbox"]',
      // Common containers
      '.ad-container,.ad-wrapper,.adsbygoogle',
      // Specific ad elements
      '.advertisement,.advertising,.advert',
      '.ad-slot,.ad-placement,.ad-banner',
      '.dfp-ad,.dfp-tag,.gpt-ad',
      // Generic terms that often indicate ads
      '[class*="popup"],[id*="popup"]',
      '[class*="overlay"],[id*="overlay"]'
    ];

    // State to be managed even after extension context is invalidated
    window.adRemover = {
      isEnabled: true,
      intervalId: null,
      observer: null,
      
      // Function to clean up resources
      cleanup: function() {
        if (this.intervalId) {
          clearInterval(this.intervalId);
          this.intervalId = null;
        }
        
        if (this.observer) {
          this.observer.disconnect();
          this.observer = null;
        }
        
        document.removeEventListener('DOMContentLoaded', this.removeAds);
        window.removeEventListener('load', this.setupObserver);
      },
      
      // Function to remove ads
      removeAds: function() {
        if (!window.adRemover.isEnabled) return;
        
        // Combine all selectors
        const combinedSelector = adSelectors.join(',');
        
        // Find and remove ad elements
        try {
          const adElements = document.querySelectorAll(combinedSelector);
          
          if (adElements.length > 0) {
            // Report count to extension if possible
            window.adRemover.reportBlockedAds(adElements.length);
            
            // Hide ads
            adElements.forEach(el => {
              if (el.style.display !== 'none') {
                el.style.display = 'none';
              }
            });
          }
        } catch (err) {
          console.debug('Error removing ads:', err.message);
        }
      },
      
      // Report blocked ads to the extension if possible
      reportBlockedAds: function(count) {
        try {
          if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ 
              action: 'updateAdCount', 
              adsBlocked: count 
            }).catch(() => {
              // Messaging error - extension context likely invalidated
              // Continue with local ad blocking anyway
            });
          }
        } catch (err) {
          // Extension context invalidated, but we can still block ads
          console.debug('Error reporting blocked ads (continuing anyway)');
        }
      },
      
      // Setup the mutation observer
      setupObserver: function() {
        if (document.body && !window.adRemover.observer) {
          window.adRemover.observer = new MutationObserver(() => {
            window.adRemover.removeAds();
          });
          
          window.adRemover.observer.observe(document.body, {
            childList: true,
            subtree: true
          });
        }
      },
      
      // Initialize the ad blocker
      init: function() {
        const self = this;
        
        // Initial ad removal
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', self.removeAds);
        } else {
          self.removeAds();
        }
        
        // Setup observer
        self.setupObserver();
        
        // If body isn't available yet, wait for it
        if (!document.body) {
          window.addEventListener('load', self.setupObserver);
        }
        
        // Periodic check
        self.intervalId = setInterval(self.removeAds, 1000);
        
        // Try to connect to the extension
        try {
          if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
            // Check enabled status
            chrome.storage.local.get('enabled', function(data) {
              self.isEnabled = data.enabled !== undefined ? data.enabled : true;
            }).catch(() => {
              // If we can't get the status, assume enabled
              self.isEnabled = true;
            });
            
            // Listen for toggle messages
            chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
              if (message.action === 'toggleAdBlocking') {
                self.isEnabled = message.enabled;
                if (self.isEnabled) self.removeAds();
                try {
                  sendResponse({ success: true });
                } catch (err) {
                  // Ignore response errors
                }
              }
              return true;
            });
          }
        } catch (err) {
          // Extension context might be invalid, but we can still block ads
          console.debug('Extension communication error (continuing with ad blocking)');
          self.isEnabled = true;
        }
      }
    };
    
    // Start the ad blocker
    window.adRemover.init();
    
    // Handle cleanup on unload
    window.addEventListener('beforeunload', () => {
      window.adRemover.cleanup();
    });
  }
})(); 
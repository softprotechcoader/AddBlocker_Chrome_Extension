// Use an IIFE to isolate our code
(function() {
  // Only run if YouTube specific code hasn't been initialized
  if (typeof window.adRemoverYouTubeInitialized === 'undefined') {
    // Set flag to prevent multiple initializations
    window.adRemoverYouTubeInitialized = true;

    // YouTube-specific ad selectors
    const youtubeAdSelectors = [
      // Video ads
      '.ad-showing', // Class added to body when showing ads
      '.ytp-ad-progress-list', // Ad progress bar
      '.ytp-ad-text', // Ad text overlay
      '.ytp-ad-skip-button', // Skip ad button
      '.html5-video-player[data-ad-player="true"]', // Player when showing ad
      '.video-ads', // Ad container
      '.ytp-ad-module', // Ad module
      
      // Non-video ads
      'ytd-promoted-video-renderer', // Promoted videos
      'ytd-display-ad-renderer', // Display ads
      'ytd-compact-promoted-video-renderer', // Compact promoted videos
      'ytd-promoted-sparkles-web-renderer', // "Sparkles" ads
      'ytd-ad-slot-renderer', // Ad slots
      'ytd-in-feed-ad-layout-renderer', // In-feed ads
      'ytd-banner-promo-renderer', // Banner promotions
      'ytd-brand-banner-ad', // Brand banners
      
      // Sidebar ads
      'ytd-companion-slot-renderer', // Companion ad slots
      '#player-ads', // Player ad container
      '#masthead-ad', // Masthead ad at the top
      '#banner_container', // Another banner container
      '#home_discovery_ads', // Home page discovery ads
      
      // Premium upsells (optional - remove if desired)
      'ytd-mealbar-promo-renderer', // Premium promo bar
      
      // Homepage ads
      'ytd-ad-slot-iframe-renderer', // Iframe ad slots
      'ytd-shelf-renderer[is-branded-content]' // Branded content shelves
    ];

    // Elements to specifically avoid hiding (critical YouTube UI elements)
    const safeSelectors = [
      'ytd-searchbox', // Search bar
      'ytd-masthead', // The top navigation bar
      'ytd-menu-renderer', // Menu options
      'ytd-guide-renderer', // Side navigation
      'ytd-watch-flexy', // Video player page
      'ytd-player', // Video player itself
      'yt-search-box' // Old search box
    ];

    // Create or use existing adRemover object
    window.ytAdRemover = {
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
        
        // Remove all event listeners
        document.removeEventListener('DOMContentLoaded', this.removeYouTubeAds);
        window.removeEventListener('load', this.setupObserver);
        document.removeEventListener('yt-navigate-finish', this.removeYouTubeAds);
        document.removeEventListener('yt-page-data-updated', this.removeYouTubeAds);
      },
      
      // Function to skip video ads
      skipAds: function() {
        if (!window.ytAdRemover.isEnabled) return;
        
        try {
          // Skip ad if possible
          const skipButton = document.querySelector('.ytp-ad-skip-button');
          if (skipButton) {
            skipButton.click();
            window.ytAdRemover.reportBlockedAds(1);
          }
          
          // If we're in an ad, try to skip to the end
          if (document.querySelector('.ad-showing')) {
            const video = document.querySelector('video');
            if (video && !isNaN(video.duration)) {
              // Set current time to end of the video to skip the ad
              video.currentTime = video.duration;
              window.ytAdRemover.reportBlockedAds(1);
            }
          }
        } catch (err) {
          console.debug('Error skipping ads:', err.message);
        }
      },
      
      // Function to check if an element is a critical UI element
      isSafeElement: function(element) {
        // Check if the element or any of its parents match the safe selectors
        return safeSelectors.some(selector => {
          // Check if the element itself matches
          if (element.matches && element.matches(selector)) {
            return true;
          }
          
          // Check if any parent matches
          let parent = element.parentElement;
          while (parent) {
            if (parent.matches && parent.matches(selector)) {
              return true;
            }
            parent = parent.parentElement;
          }
          
          return false;
        });
      },
      
      // Function to remove YouTube ads
      removeYouTubeAds: function() {
        if (!window.ytAdRemover.isEnabled) return;
        
        try {
          // Hide all ad elements
          let totalBlocked = 0;
          
          youtubeAdSelectors.forEach(selector => {
            try {
              const elements = document.querySelectorAll(selector);
              if (elements.length > 0) {
                elements.forEach(el => {
                  // Skip critical UI elements
                  if (window.ytAdRemover.isSafeElement(el)) {
                    return;
                  }
                  
                  if (el.style.display !== 'none') { 
                    el.style.display = 'none';
                    totalBlocked++;
                  }
                });
              }
            } catch (err) {
              // Ignore errors with individual selectors
              console.debug('Error with selector:', selector);
            }
          });
          
          // Report blocked ads
          if (totalBlocked > 0) {
            window.ytAdRemover.reportBlockedAds(totalBlocked);
          }
          
          // Skip any video ads
          window.ytAdRemover.skipAds();
        } catch (err) {
          console.debug('Error removing YouTube ads:', err.message);
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
        if (document.body && !window.ytAdRemover.observer) {
          window.ytAdRemover.observer = new MutationObserver(() => {
            window.ytAdRemover.removeYouTubeAds();
          });
          
          window.ytAdRemover.observer.observe(document.body, {
            childList: true,
            subtree: true
          });
        }
      },
      
      // Initialize the ad blocker
      init: function() {
        const self = this;
        
        // Initial cleanup
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', self.removeYouTubeAds);
        } else {
          self.removeYouTubeAds();
        }
        
        // Setup observer
        self.setupObserver();
        
        // If body isn't available yet, wait for it
        if (!document.body) {
          window.addEventListener('load', self.setupObserver);
        }
        
        // Periodic check for ads
        self.intervalId = setInterval(self.removeYouTubeAds, 1000);
        
        // YouTube-specific event listeners
        document.addEventListener('yt-navigate-finish', self.removeYouTubeAds);
        document.addEventListener('yt-page-data-updated', self.removeYouTubeAds);
        
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
                if (self.isEnabled) self.removeYouTubeAds();
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
    window.ytAdRemover.init();
    
    // Handle cleanup on unload
    window.addEventListener('beforeunload', () => {
      window.ytAdRemover.cleanup();
    });
  }
})(); 
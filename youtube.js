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
      // Search and navigation
      'ytd-searchbox', // Main search bar
      '#search-input', // Search input field
      '#search-form', // Search form container
      '#search-container', // Search container
      '#search-icon-legacy', // Search icon
      '#search-clear-button', // Clear search button
      '#voice-search-button', // Voice search button
      'input#search', // Search input element
      'ytd-topbar-menu-button-renderer', // Top bar buttons
      
      // Main UI components
      'ytd-masthead', // The top navigation bar
      'ytd-menu-renderer', // Menu options
      'ytd-guide-renderer', // Side navigation
      'ytd-watch-flexy', // Video player page
      'ytd-player', // Video player itself
      'ytd-app', // Main application container
      'yt-search-box', // Old search box
      
      // Video controls
      '.ytp-chrome-controls', // Player controls
      '.ytp-progress-bar', // Progress bar
      '.ytp-time-display' // Time display
    ];

    // Create or use existing adRemover object
    window.ytAdRemover = {
      isEnabled: true,
      intervalId: null,
      observer: null,
      removedElements: new Set(), // Track elements we've hidden
      
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
        if (!element) return false;
        
        // Check element ID for search-related terms
        if (element.id && (
            element.id.includes('search') || 
            element.id.includes('masthead') ||
            element.id.includes('menu') ||
            element.id.includes('button')
        )) {
          return true;
        }
        
        // Check element class for search-related terms
        if (element.className && typeof element.className === 'string' && (
            element.className.includes('search') ||
            element.className.includes('masthead') ||
            element.className.includes('header') ||
            element.className.includes('topbar')
        )) {
          return true;
        }
        
        // Check if the element or any parent has a role of 'search'
        if (element.getAttribute && element.getAttribute('role') === 'search') {
          return true;
        }
        
        // Check for search input elements
        if (element.tagName === 'INPUT' && element.type === 'text') {
          return true;
        }
        
        // Check if the element matches any safe selector
        if (safeSelectors.some(selector => {
          try {
            return element.matches && element.matches(selector);
          } catch (e) {
            return false;
          }
        })) {
          return true;
        }
        
        // Check all parent elements up to the document root
        let parent = element.parentElement;
        let depth = 0;
        const MAX_DEPTH = 10; // Limit how far up we check to prevent infinite loops
        
        while (parent && depth < MAX_DEPTH) {
          // Check if parent matches any safe selector
          if (safeSelectors.some(selector => {
            try {
              return parent.matches && parent.matches(selector);
            } catch (e) {
              return false;
            }
          })) {
            return true;
          }
          
          // Check for search-related IDs or classes in parents
          if (parent.id && (
              parent.id.includes('search') || 
              parent.id.includes('masthead') ||
              parent.id.includes('menu') ||
              parent.id.includes('button')
          )) {
            return true;
          }
          
          if (parent.className && typeof parent.className === 'string' && (
              parent.className.includes('search') ||
              parent.className.includes('masthead') ||
              parent.className.includes('header') ||
              parent.className.includes('topbar')
          )) {
            return true;
          }
          
          parent = parent.parentElement;
          depth++;
        }
        
        return false;
      },
      
      // Function to restore elements that should not have been hidden
      restoreSafeElements: function() {
        try {
          // Check for the search bar and restore it if missing
          const searchInputs = document.querySelectorAll('input#search, .ytd-searchbox');
          if (searchInputs.length === 0) {
            // Try to find any hidden search elements and restore them
            this.removedElements.forEach(el => {
              if (el && el.id && (el.id.includes('search') || 
                  (el.className && typeof el.className === 'string' && el.className.includes('search')))) {
                el.style.display = ''; // Restore original display
              }
            });
          }
        } catch (err) {
          console.debug('Error restoring safe elements:', err.message);
        }
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
                  // Skip critical UI elements with enhanced protection
                  if (window.ytAdRemover.isSafeElement(el)) {
                    return;
                  }
                  
                  if (el.style.display !== 'none') {
                    // Store the element's original display property
                    window.ytAdRemover.removedElements.add(el);
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
          
          // Check and restore critical UI elements that may have been removed
          window.ytAdRemover.restoreSafeElements();
          
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
        self.intervalId = setInterval(() => {
          self.removeYouTubeAds();
        }, 1000);
        
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
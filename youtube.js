// YouTube Ad Blocker with Brave-style implementation (CSP Compatible)
(() => {
  // Only run once
  if (window.ytAdBlockerActive) return;
  window.ytAdBlockerActive = true;
  
  // Use a more discreet log that won't spam the console
  console.debug('YouTube Ad Blocker: Fixed White Screen Edition');
  
  // Track if we're already processing to avoid concurrent operations
  let processing = false;
  let adCountTotal = 0;
  
  // Network level blocking - similar to Brave's approach
  const AD_DOMAINS = [
    'doubleclick.net',
    'googlesyndication.com',
    'google-analytics.com',
    'googleadservices.com',
    'youtube.com/ptracking',
    'youtube.com/pagead',
    'youtube.com/api/stats/ads',
    'google.com/pagead',
    'google.com/ads',
    'youtube.com/get_midroll_'
  ];

  // Ad parameters that Brave blocks in URLs
  const AD_URL_PARAMS = [
    'ad_type=',
    'adunit=',
    'ad_block=',
    'ad_slot=',
    'pagead',
    'adid=',
    'adroll',
    'doubleclick',
    'gads='
  ];
  
  // List of specific ad selectors - carefully chosen to avoid UI elements
  // Expanded based on Brave's blocking patterns
  const AD_SELECTORS = [
    // Video page ads
    'ytd-companion-slot-renderer',       // Side ads on video page
    'ytd-action-companion-ad-renderer',  // Action companion ads
    'ytd-promoted-video-renderer',       // Promoted videos
    'ytd-display-ad-renderer',           // Display ads
    'ytd-ad-slot-renderer',              // Ad slots
    'ytd-in-feed-ad-layout-renderer',    // In-feed ads
    'ytd-banner-promo-renderer',         // Banner promos
    'ytd-statement-banner-renderer',     // Statement banners
    'ytd-ad-break-title-renderer',       // Ad break titles
    'ytd-promo-renderer',                // Promos
    'ytd-merch-shelf-renderer',          // Merchandise shelf
    
    // Home and sidebar ads
    'ytd-carousel-ad-renderer',          // Carousel ads
    'ytd-promoted-sparkles-web-renderer', // Promoted sparkles
    'ytd-video-masthead-ad-v3-renderer', // Masthead video ads
    'ytd-primetime-promo-renderer',      // Primetime promos
    'ytd-organic-promo-renderer',        // Organic promos
    
    // Ad containers
    '#masthead-ad',                      // Masthead ad
    '#player-ads',                       // Player ads container
    
    // Specific ad indicators 
    '.ytp-ad-overlay-slot',              // Video overlay ad slot
    '.ytp-ad-text-overlay',              // Text overlay
    '.ytp-ad-skip-button-container',     // Skip button container
    '.ytp-ad-module',                    // Ad module
    '.ytd-mealbar-promo-renderer',       // Meal bar promo
    '.ytd-statement-banner-renderer',    // Statement banner
    '.ytp-ad-feedback-dialog-container'  // Ad feedback dialog
  ];
  
  // Apply the core video visibility fix immediately and directly
  const applyImmediateVideoFix = () => {
    // Direct CSS fix that forces videos to be visible
    const emergencyFix = document.createElement('style');
    emergencyFix.textContent = `
      /* EMERGENCY FIX: Force all videos to be visible */
      video, 
      .html5-video-container, 
      .html5-main-video,
      #movie_player video,
      ytd-watch-flexy video,
      .html5-video-player video {
        opacity: 1 !important;
        visibility: visible !important;
        display: block !important;
      }
      
      /* Fix other possible interfering elements */
      .ad-showing .html5-video-container,
      .ad-interrupting .html5-video-container,
      .ad-showing video,
      .ad-interrupting video,
      #movie_player.ad-showing video,
      #movie_player.ad-interrupting video {
        visibility: visible !important;
        opacity: 1 !important;
        display: block !important;
      }
      
      /* Remove any background that might be covering the video */
      .ytp-chrome-top,
      .ytp-chrome-bottom,
      .ytp-gradient-top,
      .ytp-gradient-bottom {
        z-index: 50 !important;
      }
      
      /* Make sure video layers are visible and on top */
      .html5-video-container {
        z-index: 10 !important;
      }
    `;
    document.head.appendChild(emergencyFix);
    
    // Directly apply inline styles to existing videos
    setInterval(() => {
      const videos = document.querySelectorAll('video');
      videos.forEach(video => {
        if (video) {
          video.style.setProperty('visibility', 'visible', 'important');
          video.style.setProperty('opacity', '1', 'important');
          video.style.setProperty('display', 'block', 'important');
        }
      });
      
      // Fix containers too
      const containers = document.querySelectorAll('.html5-video-container');
      containers.forEach(container => {
        if (container) {
          container.style.setProperty('visibility', 'visible', 'important');
          container.style.setProperty('opacity', '1', 'important');
        }
      });
      
      // Remove ad-showing class from player that might be causing issues
      const player = document.querySelector('#movie_player');
      if (player) {
        if (player.classList.contains('ad-showing')) {
          player.classList.remove('ad-showing');
        }
        if (player.classList.contains('ad-interrupting')) {
          player.classList.remove('ad-interrupting');
        }
      }
    }, 500);
  };
  
  // Apply the immediate fix as soon as possible
  applyImmediateVideoFix();
  
  // Suppress console errors
  const suppressConsoleErrors = () => {
    try {
      // Store original console.error
      const originalConsoleError = console.error;
      
      // Override console.error to filter out ad-related errors
      console.error = function(...args) {
        const errorMessage = args.join(' ');
        
        // Filter out specific error messages
        if (errorMessage.includes('requestStorageAccessFor') || 
            errorMessage.includes('Failed to load resource: net::ERR_FAILED') ||
            errorMessage.includes('Access to fetch') ||
            errorMessage.includes('has been blocked by CORS policy') ||
            errorMessage.includes('doubleclick.net') ||
            errorMessage.includes('googleads') ||
            errorMessage.includes('google-analytics')) {
          // Silently ignore these errors
          return;
        }
        
        // Pass other errors to original handler
        return originalConsoleError.apply(console, args);
      };
    } catch (err) {
      // Ignore if we can't override console
    }
  };
  
  // Block requests to ad domains - Using web request interception
  const setupRequestBlocker = () => {
    try {
      // We can't override fetch/XHR directly due to CSP, so we'll focus on 
      // DOM-based blocking instead which is allowed
      const removeAdElements = () => {
        // Look for iframes loading ad content
        const adIframes = document.querySelectorAll('iframe[src*="doubleclick"], iframe[src*="googlesyndication"], iframe[src*="ad"]');
        adIframes.forEach(iframe => {
          if (iframe && iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
            adCountTotal++;
          }
        });
        
        // Also check for ad-related script tags that might be loading
        const adScripts = document.querySelectorAll('script[src*="adservice"], script[src*="doubleclick"], script[src*="pagead"]');
        adScripts.forEach(script => {
          if (script && script.parentNode) {
            script.parentNode.removeChild(script);
          }
        });
      };
      
      // Check for ad iframes periodically
      setInterval(removeAdElements, 1000);
    } catch (err) {
      // Ignore errors
    }
  };
  
  // Function to skip current video ad
  const skipVideoAd = () => {
    if (processing) return;
    processing = true;
    
    try {
      // Check multiple ad indicators
      const adShowing = document.querySelector('.ad-showing') || 
                        document.querySelector('.ytp-ad-player-overlay') ||
                        document.querySelector('div[id^="ad-text"]:not([style*="none"])');
                        
      // Always make sure video is visible, even if no ad is playing
      forceVideoVisibility();
      
      // If no ad is showing, exit
      if (!adShowing) {
        processing = false;
        return;
      }
      
      // Try clicking skip button if available (check multiple formats)
      const skipButton = document.querySelector('.ytp-ad-skip-button') || 
                         document.querySelector('.ytp-ad-skip-button-modern') ||
                         document.querySelector('.videoAdUiSkipButton') ||
                         document.querySelector('[class*="skip"][class*="button"]');
      if (skipButton) {
        skipButton.click();
        adCountTotal++;
        
        // Ensure video is visible right after skipping
        setTimeout(forceVideoVisibility, 100);
        processing = false;
        return;
      }
      
      // If it's an ad, try to skip to the end
      const video = document.querySelector('video');
      if (video && !isNaN(video.duration) && video.duration > 0) {
        // Set time to the end of the ad
        if (video.currentTime < video.duration - 0.1) {
          video.currentTime = video.duration - 0.1;
          adCountTotal++;
          
          // Speed up playback
          try {
            video.playbackRate = 16;
          } catch (e) {}
          
          // Unmute if muted
          if (video.muted) {
            video.muted = false;
          }
          
          // Force the video element to be visible
          video.style.setProperty('visibility', 'visible', 'important');
          video.style.setProperty('opacity', '1', 'important');
          video.style.setProperty('display', 'block', 'important');
          
          setTimeout(forceVideoVisibility, 250);
        }
      }
      
      // Hide ad-related containers directly
      const adContainers = document.querySelectorAll('.ytp-ad-module, .ytp-ad-image-overlay');
      adContainers.forEach(container => {
        if (container && container.style && container.style.display !== 'none') {
          container.style.display = 'none';
          adCountTotal++;
        }
      });
      
      // Remove ad-related classes from player to ensure video visibility
      const player = document.querySelector('#movie_player');
      if (player) {
        if (player.classList.contains('ad-showing')) {
          player.classList.remove('ad-showing');
        }
        if (player.classList.contains('ad-interrupting')) {
          player.classList.remove('ad-interrupting');
        }
      }
    } catch (err) {
      // Silently ignore errors in ad skipping
    } finally {
      processing = false;
    }
  };
  
  // Force video to be visible using all possible methods
  const forceVideoVisibility = () => {
    try {
      // Get the main player and video elements
      const player = document.querySelector('#movie_player');
      const videoContainer = document.querySelector('.html5-video-container');
      const video = document.querySelector('video');
      
      // Reset player classes that might interfere with visibility
      if (player) {
        // Remove ad-showing classes
        player.classList.remove('ad-showing');
        player.classList.remove('ad-interrupting');
        
        // Force internal player state if possible
        if (player.setInternalSize && typeof player.setInternalSize === 'function') {
          try {
            player.setInternalSize();
          } catch(e) {}
        }
      }
      
      // Apply inline styles to video container
      if (videoContainer) {
        videoContainer.style.setProperty('visibility', 'visible', 'important');
        videoContainer.style.setProperty('opacity', '1', 'important');
        videoContainer.style.setProperty('display', 'block', 'important');
      }
      
      // Apply inline styles to video element
      if (video) {
        video.style.setProperty('visibility', 'visible', 'important');
        video.style.setProperty('opacity', '1', 'important');
        video.style.setProperty('display', 'block', 'important');
        
        // Try playing if paused
        if (video.paused && !document.querySelector('.ytp-pause-overlay')) {
          try {
            video.play().catch(() => {});
          } catch(e) {}
        }
      }
      
      // Handle YouTube's special "video ads" div that sometimes glitches
      const videoAds = document.querySelector('.video-ads');
      if (videoAds) {
        // Set lower z-index to prevent it from covering the actual video
        videoAds.style.setProperty('z-index', '-1', 'important');
      }
      
      // Fix hidden container issues
      document.querySelectorAll('.html5-video-player, ytd-watch-flexy, #ytd-player').forEach(el => {
        if (el) {
          // Clear any visibility properties
          el.style.setProperty('opacity', '1', 'important');
          el.style.setProperty('visibility', 'visible', 'important');
        }
      });
    } catch (err) {
      // Silent fail
    }
  };
  
  // Enhanced version that hides both traditional and dynamic ads
  const hideAdElements = () => {
    try {
      let adsRemoved = 0;
      
      // Process each selector carefully
      AD_SELECTORS.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          // Only if not already hidden
          if (el && el.style && el.style.display !== 'none') {
            el.style.display = 'none';
            adsRemoved++;
            adCountTotal++;
          }
        });
      });
      
      // Also check for elements with ad-related classes
      const adClassElements = document.querySelectorAll('[class*="ad-"]:not([class*="ad-player"]):not(.html5-video-player), [class*="-ad-"], [id*="masthead-ad"]');
      adClassElements.forEach(el => {
        // Skip player UI elements to avoid video player interference
        if (el.id && (el.id.includes('player') || el.id.includes('video'))) {
          return;
        }
        
        // Only if not already hidden
        if (el && el.style && el.style.display !== 'none') {
          el.style.display = 'none';
          adsRemoved++;
          adCountTotal++;
        }
      });
      
      // Handle YouTube premium upsell
      const premiumElements = document.querySelectorAll('[class*="premium"], ytd-offer-module-renderer');
      premiumElements.forEach(el => {
        if (el && el.style && el.style.display !== 'none') {
          el.style.display = 'none';
          adsRemoved++;
        }
      });
      
      // Block cookie consent dialogs
      const consentElements = document.querySelectorAll('tp-yt-iron-overlay-backdrop, tp-yt-paper-dialog.ytd-consent-bump-v2-lightbox');
      consentElements.forEach(el => {
        if (el && el.style && el.style.display !== 'none') {
          el.style.display = 'none';
        }
      });
      
      // Attempt to report stats if we removed any ads
      if (adsRemoved > 0) {
        sendAdCountToExtension(adsRemoved);
      }
      
      // Always ensure video is visible
      forceVideoVisibility();
    } catch (err) {
      // Silently ignore errors in ad hiding
    }
  };
  
  // Safely communicate with extension
  const sendAdCountToExtension = (count) => {
    try {
      chrome.runtime.sendMessage({
        action: 'updateAdCount',
        adsBlocked: count
      }).catch(() => {
        // Silent catch - extension might be in invalid state
      });
    } catch (e) {
      // Extension context might be invalid - no logging needed
    }
  };
  
  // Detect ad state changes specifically
  const checkForAds = () => {
    // Always ensure video is visible first
    forceVideoVisibility();
    
    // Skip video ads
    skipVideoAd();
    
    // Hide banner/display ads
    hideAdElements();
  };
  
  // Intercept and handle storage access requests
  const handleStorageAccessRequests = () => {
    try {
      // Create a proxy for the Document.prototype.requestStorageAccess method
      if (Document.prototype.requestStorageAccess) {
        // We can't override requestStorageAccess directly due to CSP,
        // but we can intercept error events related to it
        window.addEventListener('error', (event) => {
          if (event && event.message && event.message.includes('requestStorageAccessFor')) {
            // Prevent the error from appearing in console
            event.preventDefault();
            event.stopPropagation();
          }
        }, true);
      }
    } catch (e) {
      // Silently fail
    }
  };
  
  // CSS-based blocking that's CSP-compatible
  const preventAdPlacements = () => {
    try {
      const style = document.createElement('style');
      style.textContent = `
        /* Hide all ad containers */
        ytd-promoted-video-renderer,
        ytd-display-ad-renderer,
        ytd-ad-slot-renderer,
        ytd-in-feed-ad-layout-renderer,
        ytd-banner-promo-renderer,
        ytd-statement-banner-renderer,
        ytd-ad-slot-renderer,
        ytd-in-feed-ad-layout-renderer,
        ytd-merch-shelf-renderer,
        ytd-promoted-sparkles-web-renderer,
        ytd-video-masthead-ad-v3-renderer,
        #masthead-ad,
        #player-ads,
        .ytp-ad-overlay-slot,
        .ytp-ad-overlay-container,
        .ytp-ad-text-overlay,
        .ytp-ad-skip-button-container,
        .ytp-ad-module,
        .ytp-ad-feedback-dialog-container,
        [class*="ytd-mealbar-promo-renderer"],
        [class*="ytd-statement-banner-renderer"],
        [id*="google_companion_ad_"],
        tp-yt-paper-dialog.ytd-popup-container,
        .upsell-dialog-lightbox,
        .ytd-banner-promo-renderer-background,
        ytd-consent-bump-v2-lightbox {
          display: none !important;
        }
        
        /* NEVER hide the video player or video element */
        video, 
        .html5-video-container, 
        .html5-main-video,
        .html5-video-player video,
        #movie_player video {
          visibility: visible !important;
          opacity: 1 !important;
          display: block !important;
        }
        
        /* Hide YouTube Premium upgrade prompts */
        ytd-enforcement-message-view-model,
        ytd-offline-promo-renderer,
        ytd-mealbar-promo-renderer,
        ytd-consent-bump-v2-lightbox,
        tp-yt-paper-dialog[style*="visibility: visible"] {
          display: none !important;
        }
        
        /* Make sure CORS errors don't affect the interface */
        .ytp-error {
          display: none !important;
        }
        
        /* Fix other common YouTube ad-related elements */
        .video-ads {
          z-index: -1 !important;
        }
        
        /* Adjust player controls visibility */
        .ytp-chrome-controls {
          opacity: 1 !important;
          display: block !important;
        }
      `;
      document.head.appendChild(style);
    } catch (err) {
      // Silent failure
    }
  };
  
  // Add a performant observer that only watches for specific ad-related changes
  const setupAdObserver = () => {
    // Create a focused observer that only watches for ad-related changes
    const adObserver = new MutationObserver(mutations => {
      // Check for any video visibility issues first
      forceVideoVisibility();
      
      // Check if any mutations affect ad-showing class or ads elements
      const hasAdChanges = mutations.some(mutation => {
        // Check for ad-related class changes
        if (mutation.target && mutation.target.classList) {
          if (mutation.target.classList.contains('ad-showing') ||
              mutation.target.classList.contains('ytp-ad-module')) {
            return true;
          }
          
          // Check if target has ad-related ID or class
          if ((mutation.target.id && mutation.target.id.includes('ad')) || 
              (mutation.target.className && typeof mutation.target.className === 'string' && 
               (mutation.target.className.includes('ad-') || mutation.target.className.includes('-ad')))) {
            return true;
          }
        }
        
        // Check for visibility changes on video containers
        if (mutation.target && 
            (mutation.target.classList?.contains('html5-video-container') || 
             mutation.target.tagName === 'VIDEO')) {
          forceVideoVisibility();
          return true;
        }
        
        // Check if any added nodes match our ad selectors
        if (mutation.addedNodes && mutation.addedNodes.length) {
          return Array.from(mutation.addedNodes).some(node => {
            if (node.nodeType !== 1) return false; // Not an element
            
            // More aggressive ad node detection
            if (node.id && node.id.includes('ad')) return true;
            if (node.className && typeof node.className === 'string' && 
                (node.className.includes('ad-') || node.className.includes('-ad'))) {
              return true;
            }
            
            // Check if it matches any known ad selector
            return AD_SELECTORS.some(selector => {
              try {
                return node.matches && node.matches(selector);
              } catch (e) {
                return false;
              }
            });
          });
        }
        
        return false;
      });
      
      if (hasAdChanges) {
        checkForAds();
      }
    });
    
    // Start observing
    if (document.body) {
      adObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'id', 'src']
      });
    }
    
    // Store observer for cleanup
    window.ytAdObserver = adObserver;
  };
  
  // URL-based blocking - detects and handles URLs in a way compatible with CSP
  const setupURLBasedBlocking = () => {
    // Check for ad redirects in a CSP-safe way
    const checkForAdRedirects = () => {
      // Check if current URL has ad parameters
      const currentUrl = window.location.href;
      if (AD_URL_PARAMS.some(param => currentUrl.includes(param))) {
        // Silently handle this - no console logging
        hideAdElements();
      }
    };
    
    // Set up periodic checks
    setInterval(checkForAdRedirects, 2000);
    
    // Listen for YouTube's navigation events
    document.addEventListener('yt-navigate-start', checkForAdRedirects);
  };
  
  // Advanced video fixing that monitors player changes constantly
  const videoFixLoop = () => {
    // This is a dedicated high-frequency loop just for keeping videos visible
    try {
      // Direct access to the most critical elements
      const video = document.querySelector('video');
      const container = document.querySelector('.html5-video-container');
      const player = document.querySelector('#movie_player');
      
      // Fix anything that could be hiding the video
      if (video) {
        // Fix video element directly
        video.style.setProperty('visibility', 'visible', 'important');
        video.style.setProperty('opacity', '1', 'important');
        video.style.setProperty('display', 'block', 'important');
        
        // Fix container if available
        if (container) {
          container.style.setProperty('visibility', 'visible', 'important');
          container.style.setProperty('opacity', '1', 'important');
        }
        
        // Remove ad classes from player
        if (player) {
          if (player.classList.contains('ad-showing')) {
            player.classList.remove('ad-showing');
          }
          if (player.classList.contains('ad-interrupting')) {
            player.classList.remove('ad-interrupting');
          }
        }
      }
    } catch (err) {
      // Silent failure
    }
  };
  
  // Handle CORS errors specifically
  const handleCORSErrors = () => {
    // Set up a global error handler to catch CORS errors
    window.addEventListener('error', (event) => {
      // Check if this is a CORS-related error
      if (event && event.message && (
          event.message.includes('CORS') || 
          event.message.includes('Failed to load resource') || 
          event.message.includes('doubleclick') || 
          event.message.includes('googleads'))) {
        // Prevent the error from appearing in console
        event.preventDefault();
        event.stopPropagation();
        return true;
      }
    }, true);
    
    // Also handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      if (event && event.reason && event.reason.message && (
          event.reason.message.includes('CORS') || 
          event.reason.message.includes('Failed to load resource') || 
          event.reason.message.includes('doubleclick') || 
          event.reason.message.includes('googleads'))) {
        // Prevent the error from appearing in console
        event.preventDefault();
        event.stopPropagation();
        return true;
      }
    }, true);
  };
  
  // Monitor video player to fix any issues immediately
  const monitorVideoPlayer = () => {
    // This creates an extra event listener specifically for video elements
    document.addEventListener('playing', () => {
      // When video starts playing, ensure it's visible
      forceVideoVisibility();
    }, true);
    
    // Also monitor pause events to ensure they're not due to ads
    document.addEventListener('pause', (event) => {
      // Check if pause might be related to ads
      const player = document.querySelector('#movie_player');
      if (player && (player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting'))) {
        // Remove ad flags and try to resume play
        player.classList.remove('ad-showing');
        player.classList.remove('ad-interrupting');
        
        // Resume playback if possible
        setTimeout(() => {
          try {
            event.target.play().catch(() => {});
          } catch(e) {}
        }, 100);
      }
    }, true);
    
    // High-frequency video fix loop
    setInterval(videoFixLoop, 100);
  };
  
  // Initialize everything
  const initialize = () => {
    // Set up error suppression first
    suppressConsoleErrors();
    handleStorageAccessRequests();
    handleCORSErrors();
    
    // Set up request blocker
    setupRequestBlocker();
    
    // Add CSS to prevent ad placements
    preventAdPlacements();
    
    // Apply direct video fixes
    forceVideoVisibility();
    monitorVideoPlayer();
    
    // Set up URL-based blocking
    setupURLBasedBlocking();
    
    // Run an initial check
    checkForAds();
    
    // Set up observer for dynamic changes
    setupAdObserver();
    
    // Continuous interval for checking and fixing everything
    const maintenanceInterval = setInterval(() => {
      forceVideoVisibility();
      checkForAds();
    }, 1000);
    window.ytMaintenanceInterval = maintenanceInterval;
    
    // Handle YouTube navigation events
    document.addEventListener('yt-navigate-finish', () => {
      // Wait a bit for content to load
      setTimeout(() => {
        checkForAds();
        forceVideoVisibility();
      }, 1000);
    });
    
    // Also hook into YouTube's page manager directly
    try {
      document.addEventListener('yt-page-data-updated', () => {
        setTimeout(() => {
          checkForAds(); 
          forceVideoVisibility();
        }, 1000);
      });
    } catch (e) {}
    
    // Handle the YouTube player state changes
    document.addEventListener('onStateChange', () => {
      forceVideoVisibility();
    });
    
    // Cleanup on unload
    window.addEventListener('beforeunload', () => {
      if (window.ytAdObserver) {
        window.ytAdObserver.disconnect();
      }
      if (window.ytMaintenanceInterval) {
        clearInterval(window.ytMaintenanceInterval);
      }
    });
  };
  
  // Start with a delay to let YouTube fully load, but also apply immediate fixes
  setTimeout(initialize, 1500);
})(); 
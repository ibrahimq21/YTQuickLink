// YTQuickLink - Content script
// Fixed: proper URL parsing, type checks, deduplication, background storage

var runtimeAPI = (typeof browser !== 'undefined' && browser.runtime) || (typeof chrome !== 'undefined' && chrome.runtime);

// Extract video ID from any YouTube URL object
function extractVideoId(urlObj) {
  return urlObj.searchParams.get('v') || (urlObj.hostname === 'youtu.be' ? urlObj.pathname.slice(1) : null);
}

function getVideoInfo() {
  try {
    var url = window.location.href;
    
    if (!url.includes('youtube.com')) {
      return { error: 'Not a YouTube page' };
    }
    
    // Proper URL parsing
    var urlObj = new URL(url);
    var videoId = extractVideoId(urlObj);
    
    if (!videoId) {
      return { error: 'No video ID found' };
    }
    
    // Get video title - multiple selectors with fallback
    var titleSelectors = [
      'h1.ytd-video-title',
      'yt-formatted-string.ytd-video-title',
      '#movie_player .ytp-title-link'
    ];
    
    var title = '';
    for (var i = 0; i < titleSelectors.length; i++) {
      var el = document.querySelector(titleSelectors[i]);
      if (el && el.textContent && el.textContent.trim()) {
        title = el.textContent.trim();
        break;
      }
    }
    
    if (!title) {
      title = document.title.split(' - ')[0].replace('YouTube', '').trim() || 'Unknown';
    }
    
    var modifiedUrl = 'https://www.yout-ube.com/watch?v=' + videoId;
    
    return { 
      url: url, 
      videoId: videoId, 
      title: title,
      modifiedUrl: modifiedUrl
    };
  } catch (err) {
    return { error: err.message };
  }
}

// Deduplication - track last video ID
var lastVideoIdSent = '';

// Send message to background (with deduplication)
function sendToBackground(action, data) {
  if (!runtimeAPI) return;
  
  // Dedupe: don't send same video twice
  if (data.videoId === lastVideoIdSent && action !== 'thumbnailClicked') {
    return;
  }
  lastVideoIdSent = data.videoId;
  
  runtimeAPI.sendMessage({
    action: action,
    videoId: data.videoId,
    modifiedUrl: data.modifiedUrl,
    title: data.title,
    originalUrl: data.url
  });
}

// Middle mouse button (auxclick) handler
function setupAuxClickListener() {
  document.addEventListener('auxclick', function(event) {
    // Only intercept middle mouse button (button === 1)
    if (event.button !== 1) return;
    
    // Guard: only run on youtube.com or youtu.be domains (handles embedded players & iframes)
    if (!location.hostname.includes('youtube.com') && location.hostname !== 'youtu.be') return;
    
    // Let browser handle modifier-key clicks (Ctrl/Cmd+Click = open in new tab, Shift+Click = new window)
    if (event.ctrlKey || event.metaKey || event.shiftKey) return;
    
    // Skip if another handler already claimed this event
    if (event.defaultPrevented) return;
    
    var videoLink = event.target.closest('a#thumbnail, a.thumbnail, a.ytd-thumbnail, a[href*="/watch"]');
    if (!videoLink) return;
    
    var href = videoLink.href;
    if (!href || !href.includes('/watch')) return;
    
    try {
      var urlObj = new URL(href);
      var videoId = extractVideoId(urlObj);
      
      if (videoId) {
        var modifiedUrl = 'https://www.yout-ube.com/watch?v=' + videoId;
        event.preventDefault();
        event.stopPropagation();
        window.open(modifiedUrl, '_blank');
      }
    } catch (err) {}
  }, true);
}

// Thumbnail click handler
function setupThumbnailListener() {
  document.addEventListener('click', function(event) {
    var thumbnailLink = event.target.closest('a#thumbnail, a.thumbnail, a.ytd-thumbnail');
    if (!thumbnailLink) return;
    
    var href = thumbnailLink.href;
    if (!href || !href.includes('/watch')) return;
    
    try {
      var urlObj = new URL(href);
      var videoId = extractVideoId(urlObj);
      
      if (videoId) {
        var modifiedUrl = 'https://www.yout-ube.com/watch?v=' + videoId;
        
        // Send to background for storage
        sendToBackground('thumbnailClicked', {
          videoId: videoId,
          modifiedUrl: modifiedUrl,
          url: href
        });
        
        // NOTE: We let normal navigation happen - user can click our button to open modified link
      }
    } catch (err) {}
  }, true);
}

// SPA navigation - use debounce
var navTimeout = null;
function debounceNavigation() {
  if (navTimeout) clearTimeout(navTimeout);
  navTimeout = setTimeout(function() {
    var info = getVideoInfo();
    if (!info.error) {
      sendToBackground('videoChanged', info);
    }
  }, 300);
}

function setupNavigationListener() {
  // popstate
  window.addEventListener('popstate', debounceNavigation);
  
  // YouTube SPA events
  document.addEventListener('yt-navigate-finish', debounceNavigation);
  document.addEventListener('yt-page-data-updated', debounceNavigation);
}

// Message listener
if (runtimeAPI && runtimeAPI.onMessage) {
  runtimeAPI.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'getVideoInfo') {
      sendResponse(getVideoInfo());
      return true;
    }
    if (request.action === 'getModifiedUrl') {
      var info = getVideoInfo();
      sendResponse(info.error ? null : info.modifiedUrl);
      return true;
    }
  });
}

// Initialize
var init = function() {
  setupAuxClickListener();
  setupThumbnailListener();
  setupNavigationListener();
};

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  init();
} else {
  window.addEventListener('DOMContentLoaded', init);
}
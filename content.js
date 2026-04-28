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

// Unified YouTube link tracker — shared state (preview only, not relied on for auxclick)
var hoveredVideoId = null;
var hoveredModifiedUrl = null;

// rAF-based hover scheduler — prevents redundant DOM queries during scroll/reflow
var pendingHoverFrame = false;
var lastMouseX = 0;
var lastMouseY = 0;

function handleMouseMove(event) {
  lastMouseX = event.clientX;
  lastMouseY = event.clientY;
  if (!pendingHoverFrame) {
    pendingHoverFrame = true;
    requestAnimationFrame(resolveHoverFrame);
  }
}

function resolveHoverFrame() {
  pendingHoverFrame = false;
  var el = document.elementFromPoint(lastMouseX, lastMouseY);
  if (!el) { hoveredVideoId = null; hoveredModifiedUrl = null; return; }
  var link = el.closest('a#thumbnail, a.thumbnail, a.ytd-thumbnail, a[href*="/watch"]');
  if (!link) { hoveredVideoId = null; hoveredModifiedUrl = null; return; }
  var href = link.href;
  if (!href || !href.includes('/watch')) { hoveredVideoId = null; hoveredModifiedUrl = null; return; }
  try {
    var videoId = extractVideoId(new URL(href));
    if (videoId) {
      hoveredVideoId = videoId;
      hoveredModifiedUrl = 'https://www.yout-ube.com/watch?v=' + videoId;
    }
  } catch (err) {}
}

// Fresh elementFromPoint resolver — always called at auxclick time, never from stored state
function resolveVideoLinkAt(x, y) {
  var el = document.elementFromPoint(x, y);
  if (!el) return null;
  var link = el.closest('a#thumbnail, a.thumbnail, a.ytd-thumbnail, a[href*="/watch"]');
  if (!link) return null;
  var href = link.href;
  if (!href || !href.includes('/watch')) return null;
  try {
    return extractVideoId(new URL(href));
  } catch (err) {
    return null;
  }
}

// Unified auxclick handler — always resolves fresh at click time
function setupAuxClickListener() {
  document.addEventListener('auxclick', function(event) {
    if (event.button !== 1) return;
    if (event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.defaultPrevented) return;
    if (!location.hostname.includes('youtube.com') && location.hostname !== 'youtu.be') return;

    // Always revalidate DOM at click time via elementFromPoint — no stored state
    var videoId = resolveVideoLinkAt(event.clientX, event.clientY);
    if (!videoId) return;

    var modifiedUrl = 'https://www.yout-ube.com/watch?v=' + videoId;
    event.preventDefault();
    event.stopPropagation();
    window.open(modifiedUrl, '_blank');
  }, true);

  document.addEventListener('mousemove', handleMouseMove, true);
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
// YTQuickLink - Content Script (Event Emitter Only)
// Does NOT store state, build URLs, or manage UI
// Only detects YouTube events, extracts videoId, and emits to background

var runtimeAPI = (typeof browser !== 'undefined' && browser.runtime) || (typeof chrome !== 'undefined' && chrome.runtime);
var BASE_URL = 'https://www.yout-ube.com';
var SCHEMA_VERSION = 1;

// Feature toggle (user-activated)
var activeMode = false;

// Lifecycle guard
var initialized = false;

// Hover cache — stores anchor reference for fast-path reuse without DOM re-query
var hoveredAnchor = null;
var hoveredVideoId = null;

function cacheHover(link) {
  if (hoveredAnchor === link) return;
  hoveredAnchor = link;
  try {
    hoveredVideoId = parseVideoId(new URL(link.href));
  } catch (err) { hoveredVideoId = null; }
}

function clearHover() {
  hoveredAnchor = null;
  hoveredVideoId = null;
}

function parseVideoId(urlObj) {
  return urlObj.searchParams.get('v') || (urlObj.hostname === 'youtu.be' ? urlObj.pathname.slice(1) : null);
}

function isYouTubeHost(hostname) {
  return /^(www\.|m\.|music\.)?youtube\.com$/.test(hostname);
}

function buildWatchUrl(videoId) {
  return BASE_URL + '/watch?v=' + videoId;
}

// Emit event to background (event emitter only — no local state)
function emit(type, payload) {
  if (!runtimeAPI || !runtimeAPI.sendMessage) return;
  runtimeAPI.sendMessage({
    type: type,
    version: SCHEMA_VERSION,
    payload: payload,
    ts: Date.now()
  });
}

// Floating toggle button
function createToggleButton() {
  var btn = document.createElement('button');
  btn.innerText = 'YTQuickLink: OFF';
  btn.id = 'ytquicklink-toggle';
  btn.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:999999;padding:10px 14px;background:#ff0000;color:#fff;border:none;border-radius:8px;cursor:pointer;font-family:sans-serif;font-size:13px;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
  btn.onclick = function() {
    activeMode = !activeMode;
    btn.innerText = activeMode ? 'YTQuickLink: ON' : 'YTQuickLink: OFF';
    btn.style.background = activeMode ? '#00aa00' : '#ff0000';
    if (!activeMode) clearHover();
    // Report toggle state to background for popup awareness
    emit('ACTIVE_MODE_CHANGED', { activeMode: activeMode });
  };
  document.body.appendChild(btn);
}

// Combined hover + wheel-click handler
function setupHoverAndAuxClick() {
  document.addEventListener('auxclick', function(event) {
    if (!activeMode) return;
    if (event.button !== 1) return;
    if (event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.defaultPrevented) return;

    var isYT = isYouTubeHost(location.hostname);
    if (!isYT) return;

    var videoId = null;

    // 1. Always trust DOM at click time (truth source)
    var el = document.elementFromPoint(event.clientX, event.clientY);
    if (el) {
      var link = el.closest('a#thumbnail, a.thumbnail, a.ytd-thumbnail, a[href*="/watch"]');
      if (link) {
        try { videoId = parseVideoId(new URL(link.href)); } catch (e) {}
      }
    }

    // 2. Fast-path: reuse cached anchor href if DOM lookup failed
    if (!videoId && hoveredAnchor) {
      try { videoId = parseVideoId(new URL(hoveredAnchor.href)); } catch (e) {}
    }

    if (videoId) {
      event.preventDefault();
      event.stopPropagation();
      window.open(buildWatchUrl(videoId), '_blank');
    }
  }, true);

  // Hover tracking via pointerover — only when activeMode is on
  document.addEventListener('pointerover', function(e) {
    if (!activeMode) return;
    var link = e.target.closest('a#thumbnail, a.thumbnail, a.ytd-thumbnail, a[href*="/watch"]');
    if (link) cacheHover(link);
  }, true);
}

function sendToBackground(action, data) {
  if (!runtimeAPI || !runtimeAPI.sendMessage) return;
  runtimeAPI.sendMessage({ type: action, payload: data, version: SCHEMA_VERSION, ts: Date.now() });
}

// Thumbnail click handler
function setupThumbnailListener() {
  document.addEventListener('click', function(event) {
    var thumbnailLink = event.target.closest('a#thumbnail, a.thumbnail, a.ytd-thumbnail');
    if (!thumbnailLink) return;
    var href = thumbnailLink.href;
    if (!href || !href.includes('/watch')) return;
    try {
      var videoId = parseVideoId(new URL(href));
      if (videoId) {
        sendToBackground('THUMBNAIL_CLICKED', {
          videoId: videoId,
          modifiedUrl: buildWatchUrl(videoId),
          url: href
        });
      }
    } catch (err) {}
  }, true);
}

var navTimeout = null;
function debounceNavigation() {
  if (navTimeout) clearTimeout(navTimeout);
  navTimeout = setTimeout(function() {
    try {
      var urlObj = new URL(window.location.href);
      var videoId = parseVideoId(urlObj);
      if (videoId) {
        sendToBackground('VIDEO_CHANGED', {
          videoId: videoId,
          modifiedUrl: buildWatchUrl(videoId),
          url: window.location.href
        });
      }
    } catch (err) {}
  }, 300);
}

function setupNavigationListener() {
  window.addEventListener('popstate', debounceNavigation);
  document.addEventListener('yt-navigate-finish', debounceNavigation);
  document.addEventListener('yt-page-data-updated', debounceNavigation);
}

// Message listener — receive state updates from background
if (runtimeAPI && runtimeAPI.onMessage) {
  runtimeAPI.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.type === 'STATE_UPDATE' && request.payload) {
      // Background is pushing state — no local action needed
    }
  });
}

var init = function() {
  if (initialized) return;
  initialized = true;
  createToggleButton();
  setupHoverAndAuxClick();
  setupThumbnailListener();
  setupNavigationListener();
};

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  init();
} else {
  window.addEventListener('DOMContentLoaded', init);
}

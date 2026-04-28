// YTQuickLink - Content script
var runtimeAPI = (typeof browser !== 'undefined' && browser.runtime) || (typeof chrome !== 'undefined' && chrome.runtime);

// Feature toggle — disabled by default, user-activated via button
var activeMode = false;

// Extract video ID from any YouTube URL object
function extractVideoId(urlObj) {
  return urlObj.searchParams.get('v') || (urlObj.hostname === 'youtu.be' ? urlObj.pathname.slice(1) : null);
}

function getVideoInfo() {
  try {
    var url = window.location.href;
    if (!url.includes('youtube.com')) return { error: 'Not a YouTube page' };
    var urlObj = new URL(url);
    var videoId = extractVideoId(urlObj);
    if (!videoId) return { error: 'No video ID found' };
    var titleSelectors = ['h1.ytd-video-title', 'yt-formatted-string.ytd-video-title', '#movie_player .ytp-title-link'];
    var title = '';
    for (var i = 0; i < titleSelectors.length; i++) {
      var el = document.querySelector(titleSelectors[i]);
      if (el && el.textContent && el.textContent.trim()) { title = el.textContent.trim(); break; }
    }
    if (!title) title = document.title.split(' - ')[0].replace('YouTube', '').trim() || 'Unknown';
    return { url: url, videoId: videoId, title: title, modifiedUrl: 'https://www.yout-ube.com/watch?v=' + videoId };
  } catch (err) { return { error: err.message }; }
}

var lastVideoIdSent = '';

function sendToBackground(action, data) {
  if (!runtimeAPI) return;
  if (data.videoId === lastVideoIdSent && action !== 'thumbnailClicked') return;
  lastVideoIdSent = data.videoId;
  runtimeAPI.sendMessage({ action: action, videoId: data.videoId, modifiedUrl: data.modifiedUrl, title: data.title, originalUrl: data.url });
}

// Lifecycle guard
var initialized = false;

// Hover cache — stores anchor reference for fast-path reuse without DOM re-query
var hoveredAnchor = null;
var hoveredVideoId = null;

function cacheHover(link) {
  if (hoveredAnchor === link) return;
  hoveredAnchor = link;
  try {
    hoveredVideoId = extractVideoId(new URL(link.href));
  } catch (err) { hoveredVideoId = null; }
}

function clearHover() {
  hoveredAnchor = null;
  hoveredVideoId = null;
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

    var isYT = /^(www\.|m\.|music\.)?youtube\.com$/.test(location.hostname);
    if (!isYT) return;

    var videoId = null;

    // 1. Always trust DOM at click time (truth source)
    var el = document.elementFromPoint(event.clientX, event.clientY);
    if (el) {
      var link = el.closest('a#thumbnail, a.thumbnail, a.ytd-thumbnail, a[href*="/watch"]');
      if (link) {
        try { videoId = extractVideoId(new URL(link.href)); } catch (e) {}
      }
    }

    // 2. Fast-path: reuse cached anchor href if DOM lookup failed
    if (!videoId && hoveredAnchor) {
      try { videoId = extractVideoId(new URL(hoveredAnchor.href)); } catch (e) {}
    }

    if (videoId) {
      event.preventDefault();
      event.stopPropagation();
      window.open('https://www.yout-ube.com/watch?v=' + videoId, '_blank');
    }
  }, true);

  // Hover tracking via pointerover — only when activeMode is on
  document.addEventListener('pointerover', function(e) {
    if (!activeMode) return;
    var link = e.target.closest('a#thumbnail, a.thumbnail, a.ytd-thumbnail, a[href*="/watch"]');
    if (link) cacheHover(link);
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
      var videoId = extractVideoId(new URL(href));
      if (videoId) sendToBackground('thumbnailClicked', { videoId: videoId, modifiedUrl: 'https://www.yout-ube.com/watch?v=' + videoId, url: href });
    } catch (err) {}
  }, true);
}

var navTimeout = null;
function debounceNavigation() {
  if (navTimeout) clearTimeout(navTimeout);
  navTimeout = setTimeout(function() {
    var info = getVideoInfo();
    if (!info.error) sendToBackground('videoChanged', info);
  }, 300);
}

function setupNavigationListener() {
  window.addEventListener('popstate', debounceNavigation);
  document.addEventListener('yt-navigate-finish', debounceNavigation);
  document.addEventListener('yt-page-data-updated', debounceNavigation);
}

if (runtimeAPI && runtimeAPI.onMessage) {
  runtimeAPI.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'getVideoInfo') { sendResponse(getVideoInfo()); return true; }
    if (request.action === 'getModifiedUrl') { var info = getVideoInfo(); sendResponse(info.error ? null : info.modifiedUrl); return true; }
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

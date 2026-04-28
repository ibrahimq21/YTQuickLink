// YTQuickLink - Content script
var runtimeAPI = (typeof browser !== 'undefined' && browser.runtime) || (typeof chrome !== 'undefined' && chrome.runtime);

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

// rAF-based hover scheduler
var pendingHoverFrame = false;
var lastMouseX = 0;
var lastMouseY = 0;
var hoveredVideoId = null;
var hoveredModifiedUrl = null;

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
    if (videoId) { hoveredVideoId = videoId; hoveredModifiedUrl = 'https://www.yout-ube.com/watch?v=' + videoId; }
  } catch (err) {}
}

// Combined hover + wheel-click handler
function setupHoverAndAuxClick() {
  document.addEventListener('auxclick', function(event) {
    if (event.button !== 1) return;
    if (event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.defaultPrevented) return;
    if (!location.hostname.includes('youtube.com') && location.hostname !== 'youtu.be') return;

    // Resolve fresh at click time using elementFromPoint
    var el = document.elementFromPoint(event.clientX, event.clientY);
    if (!el) return;
    var link = el.closest('a#thumbnail, a.thumbnail, a.ytd-thumbnail, a[href*="/watch"]');
    if (!link) return;
    var href = link.href;
    if (!href || !href.includes('/watch')) return;
    try {
      var videoId = extractVideoId(new URL(href));
      if (!videoId) return;
      event.preventDefault();
      event.stopPropagation();
      window.open('https://www.yout-ube.com/watch?v=' + videoId, '_blank');
    } catch (err) {}
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
  setupHoverAndAuxClick();
  setupThumbnailListener();
  setupNavigationListener();
};

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  init();
} else {
  window.addEventListener('DOMContentLoaded', init);
}

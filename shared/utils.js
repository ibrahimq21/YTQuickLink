// YTQuickLink - Shared Utilities
// Single source of truth for all URL logic and message schemas

var BASE_URL = 'https://www.yout-ube.com';

// Message schema version
var SCHEMA_VERSION = 1;

// Message types
var MSG = {
  VIDEO_CHANGED: 'VIDEO_CHANGED',
  THUMBNAIL_CLICKED: 'THUMBNAIL_CLICKED',
  VIDEO_NAVIGATE: 'VIDEO_NAVIGATE',
  GET_STATE: 'GET_STATE',
  STATE_UPDATE: 'STATE_UPDATE'
};

// Extract video ID from any YouTube URL object
function parseVideoId(urlObj) {
  return urlObj.searchParams.get('v') || (urlObj.hostname === 'youtu.be' ? urlObj.pathname.slice(1) : null);
}

// Build modified watch URL from video ID
function buildWatchUrl(videoId) {
  return BASE_URL + '/watch?v=' + videoId;
}

// Check if hostname is a valid YouTube domain with thumbnails
function isYouTubeHost(hostname) {
  return /^(www\.|m\.|music\.)?youtube\.com$/.test(hostname);
}

// Check if URL is a YouTube video page
function isYouTubeVideoUrl(url) {
  try {
    var urlObj = new URL(url);
    return isYouTubeHost(urlObj.hostname) && urlObj.searchParams.get('v');
  } catch (e) {
    return false;
  }
}

// Build event payload with schema
function buildEvent(type, payload) {
  return {
    type: type,
    version: SCHEMA_VERSION,
    payload: payload,
    ts: Date.now()
  };
}

// Parse video info from URL string
function parseVideoFromUrl(url) {
  try {
    var urlObj = new URL(url);
    var videoId = parseVideoId(urlObj);
    if (!videoId) return null;
    return {
      videoId: videoId,
      modifiedUrl: buildWatchUrl(videoId),
      originalUrl: url
    };
  } catch (e) {
    return null;
  }
}

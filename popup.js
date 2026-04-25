// YTQuickLink - Popup Script v2.0

var runtimeAPI = (typeof browser !== 'undefined' && browser.runtime) ? browser.runtime : 
                ((typeof chrome !== 'undefined' && chrome.runtime) ? chrome.runtime : null);

var currentModifiedUrl = '';

function setUI(title, status, resultText, resultClass) {
  var t = document.getElementById('t');
  var s = document.getElementById('s');
  var r = document.getElementById('r');
  var rt = document.getElementById('rt');
  
  if (t) t.textContent = title || '-';
  if (s) s.textContent = status || '-';
  if (rt) rt.textContent = resultText || '';
  if (r) {
    r.className = resultClass || '';
    r.style.display = resultText ? 'block' : 'none';
  }
}

function getYouTubeUrl() {
  var tabsApi = (runtimeAPI && runtimeAPI.tabs) ? runtimeAPI.tabs : 
               ((typeof chrome !== 'undefined' && chrome.tabs) ? chrome.tabs : null);
  
  if (!tabsApi) {
    return Promise.resolve({ error: 'No tabs API' });
  }
  
  return tabsApi.query({ active: true, currentWindow: true }).then(function(tabs) {
    var tab = tabs[0];
    if (!tab || !tab.url) {
      return { error: 'No active tab' };
    }
    
    var url = tab.url;
    if (url.indexOf('youtube.com') === -1) {
      return { error: 'Not on YouTube' };
    }
    
    var videoId = null;
    try {
      var urlObj = new URL(url);
      videoId = urlObj.searchParams.get('v');
    } catch (e) {
      return { error: 'Invalid URL' };
    }
    
    if (!videoId) {
      return { error: 'No video' };
    }
    
    currentModifiedUrl = 'https://www.yout-ube.com/watch?v=' + videoId;
    
    return {
      videoId: videoId,
      modifiedUrl: currentModifiedUrl,
      tabId: tab.id
    };
  });
}

function handleGrabLink() {
  setUI('Detecting...', 'Getting video...', '', '');
  
  getYouTubeUrl().then(function(data) {
    if (data.error) {
      setUI('Error', '', data.error, 'err');
      return;
    }
    
    setUI('YouTube Video', 'ID: ' + data.videoId, '', '');
    currentModifiedUrl = data.modifiedUrl;
    
    // Update link button
    var lnk = document.getElementById('lnk');
    if (lnk) lnk.href = currentModifiedUrl;
    
    // Copy to clipboard
    navigator.clipboard.writeText(currentModifiedUrl).then(function() {
      setUI('YouTube Video', 'ID: ' + data.videoId, '✓ Copied!', 'suc');
    }).catch(function(err) {
      setUI('YouTube Video', 'ID: ' + data.videoId, 'Copy failed', 'err');
    });
  }).catch(function(err) {
    setUI('Error', '', err.message || 'Error', 'err');
  });
}

function handleOpenLink(e) {
  e.preventDefault();
  
  if (!currentModifiedUrl) {
    handleGrabLink();
  } else {
    window.open(currentModifiedUrl, '_blank');
  }
}

// Init
var btn = document.getElementById('btn');
var lnk = document.getElementById('lnk');

if (btn) btn.onclick = handleGrabLink;
if (lnk) lnk.onclick = handleOpenLink;

// Auto-detect
handleGrabLink();
# YTQuickLink - Firefox Extension

A simple Firefox extension to grab YouTube video links with modified URLs.

## Files

- `manifest.json` - Extension manifest (MV3)
- `popup.html` - Popup UI
- `popup.js` - Popup logic
- `content.js` - Content script (YouTube page interactions)
- `background.js` - Background script
- `icon.svg` - Extension icon

## Installation

### Load in Firefox (Temporary)
1. Open Firefox → `about:debugging`
2. Click **This Firefox** → **Load Temporary Add-on...**
3. Select `manifest.json`

## Usage

1. Go to any YouTube video
2. Click extension icon in toolbar
3. Click **Copy Link**
4. Modified URL copied to clipboard!

## Key Features

- One-click copy to clipboard
- Opens modified link in new tab
- YouTube thumbnail click interception
- Cross-browser support (Firefox + Chrome API)
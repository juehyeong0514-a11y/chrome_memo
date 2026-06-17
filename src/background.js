// Background service worker for capture handling
'use strict';

function captureVisibleTab(sendResponse) {
  chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
    if (chrome.runtime.lastError || !dataUrl) {
      const error = (chrome.runtime.lastError && chrome.runtime.lastError.message) || '캡처 실패';
      sendResponse({ ok: false, error });
      return;
    }
    sendResponse({ ok: true, dataUrl });
  });
}

function captureFilename() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `web-annotation-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.png`;
}

function downloadDataUrl(dataUrl, filename, sendResponse) {
  if (!dataUrl) {
    sendResponse({ ok: false, error: '다운로드할 이미지가 없습니다.' });
    return;
  }

  chrome.downloads.download({
    url: dataUrl,
    filename: filename || captureFilename(),
    conflictAction: 'uniquify',
    saveAs: false
  }, (downloadId) => {
    if (chrome.runtime.lastError || !downloadId) {
      const error = (chrome.runtime.lastError && chrome.runtime.lastError.message) || '다운로드 실패';
      sendResponse({ ok: false, error });
      return;
    }
    sendResponse({ ok: true, downloadId });
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return false;

  if (message.type === 'CAPTURE_VISIBLE_TAB') {
    captureVisibleTab(sendResponse);
    return true;
  }

  if (message.type === 'CAPTURE_VISIBLE_TAB_DATA') {
    captureVisibleTab(sendResponse);
    return true;
  }

  if (message.type === 'DOWNLOAD_DATA_URL') {
    downloadDataUrl(message.dataUrl, message.filename, sendResponse);
    return true;
  }

  return false;
});

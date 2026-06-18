(function () {
  "use strict";

  const SETTINGS_KEY = "settings";
  const POSITION_KEY = "wae:v1:toolbar-position";
  const CONTENT_CSS = ["src/content.css"];
  const CONTENT_JS = [
    "src/utils.js",
    "src/storage-manager.js",
    "src/canvas-manager.js",
    "src/drawing-manager.js",
    "src/text-manager.js",
    "src/toolbar.js",
    "src/content.js"
  ];
  const DEFAULT_SETTINGS = {
    globalEnabled: true,
    siteSettings: {},
    uiSettings: {
      toolbarScale: 1,
      toolbarOrientation: "horizontal",
      language: "ko"
    }
  };

  const enabledToggle = document.getElementById("enabledToggle");
  const enabledText = document.getElementById("enabledText");
  const pageStatus = document.getElementById("pageStatus");
  const unavailableMessage = document.getElementById("unavailableMessage");
  const clearAnnotations = document.getElementById("clearAnnotations");
  const resetPosition = document.getElementById("resetPosition");
  const toolbarScaleSlider = document.getElementById("toolbarScaleSlider");
  const toolbarScaleValue = document.getElementById("toolbarScaleValue");
  const toolbarOrientationValue = document.getElementById("toolbarOrientationValue");
  const orientationButtons = Array.from(document.querySelectorAll("[data-orientation]"));
  const languageSelect = document.getElementById("languageSelect");
  const advancedSettingsToggle = document.getElementById("advancedSettingsToggle");
  const advancedSettingsPanel = document.getElementById("advancedSettingsPanel");

  let currentTab = null;
  let pageAvailable = false;
  let unavailableReason = "";
  let scaleApplyTimer = 0;
  let advancedSettingsOpen = false;

  function getSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get([SETTINGS_KEY], (result) => {
        const stored = result[SETTINGS_KEY] || {};
        const uiSettings = Object.assign({}, DEFAULT_SETTINGS.uiSettings, stored.uiSettings || {});
        resolve({
          globalEnabled: stored.globalEnabled !== false,
          siteSettings: stored.siteSettings || {},
          uiSettings: {
            toolbarScale: normalizeToolbarScale(uiSettings.toolbarScale),
            toolbarOrientation: uiSettings.toolbarOrientation === "vertical" ? "vertical" : "horizontal",
            language: uiSettings.language === "en" ? "en" : "ko"
          }
        });
      });
    });
  }

  function normalizeToolbarScale(scale) {
    const value = Number(scale);
    if (!Number.isFinite(value)) return 1;
    return Math.round(Math.min(Math.max(value, 0.78), 1.35) * 100) / 100;
  }

  function toolbarScaleLabel(scale) {
    const value = normalizeToolbarScale(scale);
    const label = value < 0.94 ? "\uc791\uac8c" : (value < 1.12 ? "\ubcf4\ud1b5" : "\ud06c\uac8c");
    return `${label} ${Math.round(value * 100)}%`;
  }

  function normalizeUiSettings(uiSettings) {
    const source = Object.assign({}, DEFAULT_SETTINGS.uiSettings, uiSettings || {});
    return {
      toolbarScale: normalizeToolbarScale(source.toolbarScale),
      toolbarOrientation: source.toolbarOrientation === "vertical" ? "vertical" : "horizontal",
      language: source.language === "en" ? "en" : "ko"
    };
  }

  function saveSettings(settings) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [SETTINGS_KEY]: settings }, resolve);
    });
  }

  function saveToolbarPosition(toolbarPosition) {
    return new Promise((resolve) => {
      if (!toolbarPosition) {
        resolve();
        return;
      }
      chrome.storage.local.set({ [POSITION_KEY]: { toolbarPosition } }, resolve);
    });
  }

  function getCurrentTab() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        resolve(tabs && tabs[0] ? tabs[0] : null);
      });
    });
  }

  function getAllTabs() {
    return new Promise((resolve) => {
      chrome.tabs.query({}, (tabs) => resolve(tabs || []));
    });
  }

  function classifyUrl(url) {
    if (!url) {
      return { supported: false, reason: "\ud604\uc7ac \ud0ed \uc815\ubcf4\ub97c \ud655\uc778\ud560 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4." };
    }
    if (/^https?:\/\/chrome\.google\.com\/webstore/i.test(url) || /^https?:\/\/chromewebstore\.google\.com\//i.test(url)) {
      return { supported: false, reason: "Chrome \ubcf4\uc548 \uc815\ucc45\uc73c\ub85c \uc0ac\uc6a9\ud560 \uc218 \uc5c6\ub294 \ud398\uc774\uc9c0\uc785\ub2c8\ub2e4." };
    }
    if (/^(chrome|chrome-extension|edge|about|devtools):/i.test(url)) {
      return { supported: false, reason: "Chrome \ubcf4\uc548 \uc815\ucc45\uc73c\ub85c \uc0ac\uc6a9\ud560 \uc218 \uc5c6\ub294 \ud398\uc774\uc9c0\uc785\ub2c8\ub2e4." };
    }
    if (/\.pdf(?:[#?]|$)/i.test(url)) {
      return { supported: false, reason: "Chrome \ub0b4\uc7a5 PDF \ubdf0\uc5b4\ub294 \ud604\uc7ac \uc9c0\uc6d0\ud558\uc9c0 \uc54a\uc2b5\ub2c8\ub2e4." };
    }
    if (/^file:\/\//i.test(url)) {
      return { supported: true, reason: "\ud30c\uc77c URL\uc5d0\uc11c\ub294 \ud655\uc7a5 \ud504\ub85c\uadf8\ub7a8 \uc138\ubd80\uc815\ubcf4\uc758 '\ud30c\uc77c URL\uc5d0 \ub300\ud55c \uc561\uc138\uc2a4 \ud5c8\uc6a9'\uc744 \ucf1c\uc57c \ud569\ub2c8\ub2e4." };
    }
    if (/^https?:\/\//i.test(url)) {
      return { supported: true, reason: "" };
    }
    return { supported: false, reason: "\uc774 \ud398\uc774\uc9c0\uc5d0\uc11c\ub294 \ud655\uc7a5 \ud504\ub85c\uadf8\ub7a8\uc744 \uc0ac\uc6a9\ud560 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4." };
  }

  function sendToTab(tab, message) {
    return new Promise((resolve) => {
      const classification = classifyUrl(tab && tab.url);
      if (!tab || typeof tab.id !== "number" || !classification.supported) {
        resolve({ ok: false, reason: classification.reason });
        return;
      }
      chrome.tabs.sendMessage(tab.id, message, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, reason: chrome.runtime.lastError.message });
          return;
        }
        resolve(response || { ok: false });
      });
    });
  }

  function sendToCurrentTab(message) {
    return sendToTab(currentTab, message);
  }

  function insertCss(tabId) {
    return new Promise((resolve) => {
      if (!chrome.scripting || !chrome.scripting.insertCSS) {
        resolve(false);
        return;
      }
      chrome.scripting.insertCSS({ target: { tabId, allFrames: false }, files: CONTENT_CSS }, () => {
        resolve(!chrome.runtime.lastError);
      });
    });
  }

  function executeContentScripts(tabId) {
    return new Promise((resolve) => {
      if (!chrome.scripting || !chrome.scripting.executeScript) {
        resolve(false);
        return;
      }
      chrome.scripting.executeScript({ target: { tabId, allFrames: false }, files: CONTENT_JS }, () => {
        resolve(!chrome.runtime.lastError);
      });
    });
  }

  async function ensureContentScript(tab = currentTab) {
    const classification = classifyUrl(tab && tab.url);
    if (!tab || typeof tab.id !== "number" || !classification.supported) {
      return { ok: false, reason: classification.reason };
    }

    const ping = await sendToTab(tab, { type: "PING" });
    if (ping.ok) {
      return ping;
    }

    await insertCss(tab.id);
    const injected = await executeContentScripts(tab.id);
    if (!injected) {
      return { ok: false, reason: classification.reason || ping.reason };
    }

    return sendToTab(tab, { type: "PING" });
  }

  async function broadcastEnabled(enabled) {
    const tabs = await getAllTabs();
    const message = enabled
      ? { type: "SET_EXTENSION_ENABLED", enabled: true }
      : { type: "SET_EXTENSION_ENABLED", enabled: false, clearAnnotations: true, destroyUI: true };
    await Promise.all(tabs.map(async (tab) => {
      const classification = classifyUrl(tab.url);
      if (!classification.supported) return;
      if (enabled) {
        const ready = await ensureContentScript(tab);
        if (ready.ok) {
          await sendToTab(tab, message);
        }
      } else {
        await sendToTab(tab, message);
      }
    }));
  }

  async function broadcastToolbarScale(scale) {
    const tabs = await getAllTabs();
    await Promise.all(tabs.map(async (tab) => {
      const classification = classifyUrl(tab.url);
      if (!classification.supported) return;
      const ready = await ensureContentScript(tab);
      if (ready.ok) {
        await sendToTab(tab, { type: "SET_TOOLBAR_SCALE", scale });
      }
    }));
  }

  async function broadcastUiSettings(uiSettings) {
    const normalized = normalizeUiSettings(uiSettings);
    const tabs = await getAllTabs();
    await Promise.all(tabs.map(async (tab) => {
      const classification = classifyUrl(tab.url);
      if (!classification.supported) return;
      const ready = await ensureContentScript(tab);
      if (ready.ok) {
        await sendToTab(tab, { type: "SET_UI_SETTINGS", uiSettings: normalized });
      }
    }));
  }

  async function applyToolbarScale(scale) {
    const settings = Object.assign({}, DEFAULT_SETTINGS, await getSettings());
    settings.siteSettings = settings.siteSettings || {};
    settings.uiSettings = Object.assign({}, DEFAULT_SETTINGS.uiSettings, settings.uiSettings || {}, {
      toolbarScale: normalizeToolbarScale(scale)
    });
    await saveSettings(settings);
    await broadcastToolbarScale(settings.uiSettings.toolbarScale);
    render(settings);
  }

  async function applyUiSettings(partial) {
    const settings = Object.assign({}, DEFAULT_SETTINGS, await getSettings());
    settings.siteSettings = settings.siteSettings || {};
    settings.uiSettings = normalizeUiSettings(Object.assign({}, settings.uiSettings || {}, partial));
    await saveSettings(settings);
    await broadcastUiSettings(settings.uiSettings);
    render(settings);
  }

  async function previewToolbarScale(scale) {
    const normalized = normalizeToolbarScale(scale);
    toolbarScaleSlider.value = String(normalized);
    toolbarScaleValue.textContent = toolbarScaleLabel(normalized);
    if (!pageAvailable) return;
    if (!currentTab) currentTab = await getCurrentTab();
    await sendToCurrentTab({ type: "PREVIEW_TOOLBAR_SCALE", scale: normalized });
  }

  function render(settings) {
    enabledToggle.checked = settings.globalEnabled;
    enabledText.textContent = settings.globalEnabled ? "ON" : "OFF";
    const uiSettings = normalizeUiSettings(settings.uiSettings);
    const scale = uiSettings.toolbarScale;
    toolbarScaleSlider.value = String(scale);
    toolbarScaleValue.textContent = toolbarScaleLabel(scale);
    toolbarOrientationValue.textContent = uiSettings.toolbarOrientation === "vertical" ? "\uc138\ub85c" : "\uac00\ub85c";
    orientationButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.orientation === uiSettings.toolbarOrientation);
    });
    languageSelect.value = uiSettings.language;
    pageStatus.textContent = pageAvailable ? "\uc0ac\uc6a9 \uac00\ub2a5" : "\uc0ac\uc6a9 \ubd88\uac00";
    unavailableMessage.hidden = pageAvailable && !unavailableReason;
    unavailableMessage.textContent = unavailableReason || "\uc774 \ud398\uc774\uc9c0\uc5d0\uc11c\ub294 \ud655\uc7a5 \ud504\ub85c\uadf8\ub7a8\uc744 \uc0ac\uc6a9\ud560 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4.";
    clearAnnotations.disabled = !pageAvailable;
    resetPosition.disabled = !pageAvailable;
  }

  function setAdvancedSettingsOpen(open) {
    advancedSettingsOpen = Boolean(open);
    advancedSettingsToggle.setAttribute("aria-expanded", String(advancedSettingsOpen));
    advancedSettingsPanel.setAttribute("aria-hidden", String(!advancedSettingsOpen));
    advancedSettingsPanel.classList.toggle("open", advancedSettingsOpen);
  }

  async function refresh() {
    const settings = await getSettings();
    currentTab = await getCurrentTab();
    const classification = classifyUrl(currentTab && currentTab.url);

    if (classification.supported) {
      if (settings.globalEnabled) {
        const ping = await ensureContentScript();
        pageAvailable = Boolean(ping.ok);
        unavailableReason = pageAvailable ? classification.reason : (classification.reason || ping.reason || "");
      } else {
        pageAvailable = true;
        unavailableReason = classification.reason;
      }
    } else {
      pageAvailable = false;
      unavailableReason = classification.reason;
    }

    render(settings);
  }

  enabledToggle.addEventListener("change", async () => {
    currentTab = await getCurrentTab();
    const settings = Object.assign({}, DEFAULT_SETTINGS, await getSettings());
    settings.globalEnabled = enabledToggle.checked;
    settings.siteSettings = settings.siteSettings || {};
    settings.uiSettings = Object.assign({}, DEFAULT_SETTINGS.uiSettings, settings.uiSettings || {});
    await saveSettings(settings);

    await broadcastEnabled(settings.globalEnabled);
    const ready = settings.globalEnabled ? await ensureContentScript(currentTab) : await sendToTab(currentTab, { type: "PING" });
    pageAvailable = settings.globalEnabled ? Boolean(ready.ok) : classifyUrl(currentTab && currentTab.url).supported;
    if (pageAvailable) {
      unavailableReason = classifyUrl(currentTab && currentTab.url).reason;
    } else {
      unavailableReason = ready.reason || classifyUrl(currentTab && currentTab.url).reason;
    }
    render(settings);
  });

  toolbarScaleSlider.addEventListener("input", () => {
    previewToolbarScale(toolbarScaleSlider.value);
    window.clearTimeout(scaleApplyTimer);
    scaleApplyTimer = window.setTimeout(() => {
      applyToolbarScale(toolbarScaleSlider.value);
    }, 350);
  });

  toolbarScaleSlider.addEventListener("change", async () => {
    window.clearTimeout(scaleApplyTimer);
    await applyToolbarScale(toolbarScaleSlider.value);
  });

  orientationButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      await applyUiSettings({ toolbarOrientation: button.dataset.orientation });
    });
  });

  languageSelect.addEventListener("change", async () => {
    await applyUiSettings({ language: languageSelect.value });
  });

  advancedSettingsToggle.addEventListener("click", () => {
    setAdvancedSettingsOpen(!advancedSettingsOpen);
  });

  clearAnnotations.addEventListener("click", async () => {
    currentTab = await getCurrentTab();
    clearAnnotations.disabled = true;
    const ready = await ensureContentScript();
    if (!ready.ok) {
      pageAvailable = false;
      unavailableReason = ready.reason || classifyUrl(currentTab && currentTab.url).reason;
      render(await getSettings());
      return;
    }
    const response = await sendToCurrentTab({ type: "SHOW_CLEAR_CONFIRM" });
    if (!response.ok) {
      pageAvailable = false;
      unavailableReason = response.reason || classifyUrl(currentTab && currentTab.url).reason;
      render(await getSettings());
      return;
    }
    clearAnnotations.disabled = false;
  });

  resetPosition.addEventListener("click", async () => {
    currentTab = await getCurrentTab();
    resetPosition.disabled = true;
    const ready = await ensureContentScript();
    if (!ready.ok) {
      pageAvailable = false;
      unavailableReason = ready.reason || classifyUrl(currentTab && currentTab.url).reason;
      render(await getSettings());
      return;
    }
    const response = await sendToCurrentTab({ type: "RESET_TOOLBAR_POSITION" });
    if (response.ok && response.toolbarPosition) {
      await saveToolbarPosition(response.toolbarPosition);
    }
    resetPosition.disabled = !pageAvailable;
  });

  setAdvancedSettingsOpen(false);
  refresh();
})();

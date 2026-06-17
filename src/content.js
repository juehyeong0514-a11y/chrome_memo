(function () {
  "use strict";

  const WAE = window.WebAnnotationExtension;

  WAE.safeRun("content bootstrap", () => {
    if (window.top !== window) {
      return;
    }
    if (window.__webAnnotationExtensionLoaded) {
      return;
    }
    window.__webAnnotationExtensionLoaded = true;

    const storage = new WAE.StorageManager();
    const positionKey = WAE.getPositionKey();
    const settingsKey = "settings";
    const penSettingsKeys = WAE.getPenSettingsKeys();
    const eraserSettingsKeys = WAE.getEraserSettingsKeys();
    const state = {
      enabled: true,
      menuOpen: false,
      penListOpen: false,
      colorOpen: false,
      settingsOpen: false,
      mode: "navigate",
      tool: WAE.CONFIG.defaultTool,
      color: WAE.CONFIG.defaultColor,
      width: WAE.CONFIG.defaultWidth,
      selectedPenType: "ballpoint",
      penSettings: WAE.normalizePenSettings(),
      eraserSettings: WAE.normalizeEraserSettings(),
      uiSettings: {
        toolbarScale: 1
      },
      recentColors: [],
      eraserRadius: WAE.CONFIG.defaultEraserSettings.size / 2,
      hidden: false,
      activeStroke: null,
      isErasing: false,
      strokes: [],
      undoStack: [],
      redoStack: [],
      toolbarPosition: null
    };

    const canvasManager = new WAE.CanvasManager({
      getStrokes: () => state.strokes,
      getHidden: () => state.hidden,
      getEraserPreviewState: () => ({
        visible: state.enabled && state.mode === "draw" && state.tool === "eraser",
        size: state.eraserSettings.size
      })
    });
    const drawingManager = new WAE.DrawingManager({
      state,
      canvasManager,
      onChange: () => {
        toolbar.update();
      }
    });
    const toolbar = new WAE.Toolbar({
      state,
      onTool: (tool) => {
        state.tool = tool;
        if (tool === "eraser") {
          state.eraserRadius = state.eraserSettings.size / 2;
        }
        setMode("draw");
      },
      onMode: () => setMode("navigate"),
      onUndo: () => drawingManager.undo(),
      onRedo: () => drawingManager.redo(),
      onClear: (skipConfirm) => drawingManager.clearAll(skipConfirm),
      onHide: () => {
        state.hidden = !state.hidden;
        toolbar.update();
        canvasManager.render();
      },
      onColor: (color) => {
        const normalized = WAE.normalizeColor(color);
        if (!normalized) {
          return;
        }
        state.color = normalized;
        if (!WAE.CONFIG.colors.includes(normalized)) {
          state.recentColors = WAE.normalizeRecentColors([normalized].concat(state.recentColors));
          savePenPreferences();
        }
        toolbar.update();
      },
      onWidth: (width) => {
        state.width = width;
        toolbar.update();
      },
      onPenType: (penType) => {
        state.selectedPenType = WAE.getPenType(penType).id;
        savePenPreferences();
      },
      onPenSettings: (penType, partial) => {
        state.penSettings = WAE.normalizePenSettings(Object.assign({}, state.penSettings, {
          [penType]: Object.assign({}, state.penSettings[penType], partial)
        }));
        savePenPreferences();
        canvasManager.render();
      },
      onEraserSize: (size) => {
        state.eraserSettings = WAE.normalizeEraserSettings({ size });
        state.eraserRadius = state.eraserSettings.size / 2;
        saveEraserSettings();
        toolbar.update();
      },
      onPosition: () => saveDebounced()
    });
    let uiMounted = false;
    let drawingBound = false;

    function dataForSave() {
      const items = {};
      items[positionKey] = {
        toolbarPosition: state.toolbarPosition
      };
      return items;
    }

    function defaultSettings() {
      return {
        globalEnabled: true,
        siteSettings: {},
        uiSettings: {
          toolbarScale: 1
        }
      };
    }

    function normalizeToolbarScale(scale) {
      const value = Number(scale);
      if (Math.abs(value - 0.85) < 0.02) return 0.85;
      if (Math.abs(value - 1.2) < 0.03) return 1.2;
      return 1;
    }

    function saveDebounced() {
      storage.debounceSave(dataForSave);
    }

    function saveNow() {
      return storage.flushSave(dataForSave);
    }

    function penPreferencesForSave() {
      return {
        penSettings: state.penSettings,
        selectedPenType: state.selectedPenType,
        recentColors: state.recentColors
      };
    }

    function savePenPreferences() {
      storage.set(penPreferencesForSave());
    }

    function saveEraserSettings() {
      storage.set({ eraserSettings: state.eraserSettings });
    }

    function ensureMounted(savedPosition) {
      if (!uiMounted) {
        canvasManager.mount();
        toolbar.mount(savedPosition || toolbar.defaultPosition());
        uiMounted = true;
      } else if (savedPosition) {
        toolbar.applyStoredPosition(savedPosition);
      }
      if (!drawingBound) {
        drawingManager.bind();
        drawingBound = true;
      }
      return uiMounted;
    }

    function setMode(mode) {
      state.mode = mode;
      state.activeStroke = null;
      state.isErasing = false;
      if (uiMounted) {
        canvasManager.setDrawingMode(state.enabled && mode === "draw");
      }
      if (mode !== "draw" || state.tool !== "eraser") {
        if (uiMounted) {
          canvasManager.hideEraserPreview();
        }
      }
      if (uiMounted) {
        toolbar.update();
      }
    }

    function applyEnabled(enabled) {
      state.enabled = Boolean(enabled);
      if (state.enabled) {
        ensureMounted();
      }
      if (!state.enabled) {
        state.activeStroke = null;
        state.isErasing = false;
        state.menuOpen = false;
      }
      if (uiMounted) {
        toolbar.setVisible(state.enabled);
        canvasManager.setVisible(state.enabled);
        canvasManager.setDrawingMode(state.enabled && state.mode === "draw");
        toolbar.update();
      }
      if (state.enabled && uiMounted) {
        canvasManager.render();
      }
    }

    function clearAnnotationState() {
      state.strokes = [];
      state.undoStack = [];
      state.redoStack = [];
      state.activeStroke = null;
      state.isErasing = false;
      drawingManager.activeErase = null;
      if (uiMounted) {
        canvasManager.render();
      }
    }

    function destroyRuntime(clearAnnotations) {
      if (clearAnnotations) {
        clearAnnotationState();
      }
      state.enabled = false;
      state.menuOpen = false;
      state.mode = "navigate";
      state.tool = WAE.CONFIG.defaultTool;
      state.activeStroke = null;
      state.isErasing = false;
      if (drawingBound) {
        drawingManager.destroy();
        drawingBound = false;
      }
      if (uiMounted) {
        toolbar.destroy();
        canvasManager.destroy();
        uiMounted = false;
      }
    }

    async function saveSettings(enabled) {
      const result = await storage.get([settingsKey]);
      const settings = Object.assign(defaultSettings(), result[settingsKey] || {});
      settings.globalEnabled = Boolean(enabled);
      settings.siteSettings = settings.siteSettings || {};
      settings.uiSettings = Object.assign({}, defaultSettings().uiSettings, settings.uiSettings || {});
      await storage.set({ [settingsKey]: settings });
    }

    async function setToolbarScale(scale) {
      const normalized = normalizeToolbarScale(scale);
      state.uiSettings.toolbarScale = normalized;
      const result = await storage.get([settingsKey]);
      const settings = Object.assign(defaultSettings(), result[settingsKey] || {});
      settings.siteSettings = settings.siteSettings || {};
      settings.uiSettings = Object.assign({}, defaultSettings().uiSettings, settings.uiSettings || {}, {
        toolbarScale: normalized
      });
      await storage.set({ [settingsKey]: settings });
      if (uiMounted) {
        toolbar.setScale(normalized);
        toolbar.keepInViewport();
        toolbar.update();
      }
    }

    async function restore() {
      const result = await storage.get([positionKey, settingsKey].concat(penSettingsKeys).concat(eraserSettingsKeys));
      const settings = Object.assign(defaultSettings(), result[settingsKey] || {});
      settings.uiSettings = Object.assign({}, defaultSettings().uiSettings, settings.uiSettings || {});
      const savedPosition = result[positionKey] && result[positionKey].toolbarPosition
        ? result[positionKey].toolbarPosition
        : result[positionKey];
      state.penSettings = WAE.normalizePenSettings(result.penSettings);
      state.eraserSettings = WAE.normalizeEraserSettings(result.eraserSettings);
      state.eraserRadius = state.eraserSettings.size / 2;
      state.uiSettings.toolbarScale = normalizeToolbarScale(settings.uiSettings.toolbarScale);
      state.selectedPenType = WAE.getPenType(result.selectedPenType || state.selectedPenType).id;
      state.recentColors = WAE.normalizeRecentColors(result.recentColors);
      if (settings.globalEnabled) {
        ensureMounted(savedPosition || toolbar.defaultPosition());
        applyEnabled(true);
        toolbar.setScale(state.uiSettings.toolbarScale);
        toolbar.applyStoredPosition(savedPosition || toolbar.defaultPosition());
        toolbar.update();
      } else {
        applyEnabled(false);
      }
    }

    async function setExtensionEnabled(enabled, options = {}) {
      await saveSettings(enabled);
      if (!enabled && options.destroyUI) {
        await saveNow();
        destroyRuntime(options.clearAnnotations !== false);
        return;
      }
      applyEnabled(enabled);
      if (enabled) {
        clearAnnotationState();
        await restore();
      }
    }

    function resetToolbarPosition() {
      const toolbarPosition = toolbar.resetPosition();
      saveNow();
      return toolbarPosition;
    }

    function handleKeydown(event) {
      if (!state.enabled) {
        return;
      }
      if (event.key === "Escape") {
        setMode("navigate");
        return;
      }
      if (WAE.isEditableTarget(event.target)) {
        return;
      }
      const key = event.key.toLowerCase();
      if (event.ctrlKey && event.shiftKey && key === "z") {
        event.preventDefault();
        drawingManager.redo();
      } else if (event.ctrlKey && !event.shiftKey && key === "z") {
        event.preventDefault();
        drawingManager.undo();
      } else if (event.ctrlKey && key === "y") {
        event.preventDefault();
        drawingManager.redo();
      }
    }

    function handleUrlChange() {
      const nextKey = WAE.getPageKey();
      if (nextKey === state.memoryPageKey) {
        return;
      }
      if (!state.enabled) {
        state.memoryPageKey = nextKey;
        clearAnnotationState();
        return;
      }
      saveNow();
      state.memoryPageKey = nextKey;
      drawingManager.loadStrokes([]);
      restore();
    }

    function patchHistory(methodName) {
      if (typeof history === "undefined" || typeof history[methodName] !== "function") {
        return;
      }
      const original = history[methodName];
      history[methodName] = function patchedHistoryMethod() {
        const result = original.apply(this, arguments);
        window.setTimeout(handleUrlChange, 0);
        return result;
      };
    }

    state.memoryPageKey = WAE.getPageKey();
    setMode("navigate");
    restore();

    window.addEventListener("keydown", handleKeydown, true);
    window.addEventListener("pagehide", saveNow);
    window.addEventListener("popstate", handleUrlChange);
    window.addEventListener("hashchange", handleUrlChange);
    window.addEventListener("resize", () => {
      if (!uiMounted) return;
      toolbar.keepInViewport();
      saveDebounced();
    });
    document.addEventListener("fullscreenchange", () => {
      if (!uiMounted) return;
      toolbar.keepInViewport();
      saveDebounced();
    });
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        return WAE.safeRun("message handler", () => {
          if (!message || !message.type) {
            return false;
          }
          if (message.type === "PING") {
            sendResponse({ ok: true, enabled: state.enabled });
            return false;
          } else if (message.type === "SET_EXTENSION_ENABLED") {
            setExtensionEnabled(message.enabled, message).then(() => {
              sendResponse({ ok: true, enabled: state.enabled });
            });
            return true;
          } else if (message.type === "RESET_TOOLBAR_POSITION") {
            const toolbarPosition = resetToolbarPosition();
            sendResponse({ ok: true, toolbarPosition });
            return false;
          } else if (message.type === "SET_TOOLBAR_SCALE") {
            setToolbarScale(message.scale).then(() => {
              sendResponse({ ok: true, scale: state.uiSettings.toolbarScale });
            });
            return true;
          }
          return false;
        });
      });
    }
    patchHistory("pushState");
    patchHistory("replaceState");
  });
})();

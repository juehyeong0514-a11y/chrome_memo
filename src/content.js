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
    const textSettingsKeys = WAE.getTextSettingsKeys();
    let suppressSettingsEnabledChange = false;
    const state = {
      enabled: true,
      menuOpen: false,
      penListOpen: false,
      colorOpen: false,
      settingsOpen: false,
      mode: "draw",
      tool: WAE.CONFIG.defaultTool,
      color: WAE.CONFIG.defaultColor,
      width: WAE.CONFIG.defaultWidth,
      selectedPenType: "ballpoint",
      penSettings: WAE.normalizePenSettings(),
      eraserSettings: WAE.normalizeEraserSettings(),
      textSettings: WAE.normalizeTextSettings(),
      uiSettings: {
        toolbarScale: 1,
        toolbarOrientation: "horizontal",
        language: "ko"
      },
      recentColors: [],
      customColors: [],
      eraserRadius: WAE.CONFIG.defaultEraserSettings.size / 2,
      hidden: false,
      activeStroke: null,
      isErasing: false,
      selectedStrokeId: null,
      selectionMove: null,
      strokes: [],
      textItems: [],
      undoStack: [],
      redoStack: [],
      toolbarPosition: null
    };

    const canvasManager = new WAE.CanvasManager({
      getStrokes: () => state.strokes,
      getHidden: () => state.hidden,
      getSelectedStrokeId: () => state.selectedStrokeId,
      getEraserPreviewState: () => ({
        visible: state.enabled && state.mode === "draw" && ["pen", "highlighter", "eraser"].includes(state.tool),
        tool: state.tool,
        size: getCursorPreviewSize(),
        color: getCursorPreviewColor()
      })
    });
    const drawingManager = new WAE.DrawingManager({
      state,
      canvasManager,
      onChange: () => {
        toolbar.update();
        saveAnnotationsDebounced();
      }
    });
    const textManager = new WAE.TextManager({
      state,
      onSelect: () => canvasManager.render(),
      onChange: () => {
        toolbar.update();
        saveAnnotationsDebounced();
      }
    });
    drawingManager.textManager = textManager;
    const toolbar = new WAE.Toolbar({
      state,
      onTool: (tool) => {
        textManager.commitEdit();
        state.tool = tool;
        if (tool === "eraser") {
          state.eraserRadius = state.eraserSettings.size / 2;
        }
        setMode("draw");
      },
      onMode: () => {
        textManager.commitEdit();
        setMode("navigate");
      },
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
        syncCurrentPenState();
        savePenPreferences();
      },
      onPenSettings: (penType, partial) => {
        state.penSettings = WAE.normalizePenSettings(Object.assign({}, state.penSettings, {
          [penType]: Object.assign({}, state.penSettings[penType], partial)
        }));
        if (penType === state.selectedPenType) {
          syncCurrentPenState();
        }
        savePenPreferences();
        canvasManager.render();
      },
      onEraserSize: (size) => {
        state.eraserSettings = WAE.normalizeEraserSettings({ size });
        state.eraserRadius = state.eraserSettings.size / 2;
        saveEraserSettings();
        toolbar.update();
      },
      onTextSettings: (partial) => {
        state.textSettings = WAE.normalizeTextSettings(Object.assign({}, state.textSettings, partial));
        [partial.color].forEach((color) => {
          const normalized = WAE.normalizeColor(color);
          if (normalized && !WAE.CONFIG.colors.includes(normalized)) {
            state.recentColors = WAE.normalizeRecentColors([normalized].concat(state.recentColors));
            savePenPreferences();
          }
        });
        textManager.applyTextSettings(partial);
        saveTextSettings();
        toolbar.update();
      },
      onCustomColors: (customColors) => {
        state.customColors = WAE.normalizeCustomColors(customColors);
        saveCustomColors();
        toolbar.update();
      },
      onPosition: () => saveDebounced()
      ,
      onScale: (scale) => saveToolbarScale(scale),
      onCaptureMain: () => performCapture("full"),
      onCaptureOption: (opt) => performCapture(opt)
    });
    let uiMounted = false;
    let drawingBound = false;
    let activeCaptureSession = null;

    function dataForSave() {
      const items = {};
      items[positionKey] = {
        toolbarPosition: state.toolbarPosition
      };
      items[state.memoryPageKey || WAE.getPageKey()] = annotationSnapshot();
      return items;
    }

    function annotationSnapshot() {
      const strokes = (state.strokes || []).map((stroke) => WAE.cloneStroke(stroke));
      const textItems = (state.textItems || []).map((item) => textManager.cloneItem(item));
      return {
        version: 1,
        updatedAt: Date.now(),
        strokes,
        textItems
      };
    }

    function normalizeSavedAnnotations(saved) {
      const source = saved && typeof saved === "object" ? saved : {};
      return {
        strokes: Array.isArray(source.strokes) ? source.strokes : [],
        textItems: Array.isArray(source.textItems) ? source.textItems : []
      };
    }

    function defaultSettings() {
      return {
        globalEnabled: true,
        siteSettings: {},
        uiSettings: {
          toolbarScale: 1,
          toolbarOrientation: "horizontal",
          language: "ko"
        }
      };
    }

    function normalizeToolbarScale(scale) {
      const value = Number(scale);
      if (!Number.isFinite(value)) return 1;
      return Math.round(WAE.clamp(value, 0.78, 1.35) * 100) / 100;
    }

    function normalizeToolbarOrientation(orientation) {
      return orientation === "vertical" ? "vertical" : "horizontal";
    }

    function normalizeLanguage(language) {
      return language === "en" ? "en" : "ko";
    }

    function normalizeUiSettings(settings) {
      const source = settings || {};
      return {
        toolbarScale: normalizeToolbarScale(source.toolbarScale),
        toolbarOrientation: normalizeToolbarOrientation(source.toolbarOrientation),
        language: normalizeLanguage(source.language)
      };
    }

    function saveDebounced() {
      storage.debounceSave(dataForSave);
    }

    function saveAnnotationsDebounced() {
      if (!state.enabled) return;
      storage.debounceSave(dataForSave);
    }

    function saveNow() {
      return storage.flushSave(dataForSave);
    }

    function saveNowWithCurrentEdit() {
      if (textManager.editing) {
        textManager.commitEdit();
      }
      return saveNow();
    }

    function penPreferencesForSave() {
      return {
        penSettings: state.penSettings,
        selectedPenType: state.selectedPenType,
        recentColors: state.recentColors,
        customColors: state.customColors
      };
    }

    function savePenPreferences() {
      storage.set(penPreferencesForSave());
    }

    function saveEraserSettings() {
      storage.set({ eraserSettings: state.eraserSettings });
    }

    function saveTextSettings() {
      storage.set({ textSettings: state.textSettings });
    }

    function saveCustomColors() {
      storage.set({ customColors: state.customColors });
    }

    function currentPenSettings() {
      return state.penSettings[state.selectedPenType] || WAE.CONFIG.defaultPenSettings.ballpoint;
    }

    function syncCurrentPenState() {
      const settings = currentPenSettings();
      state.color = settings.color || WAE.CONFIG.defaultColor;
      state.width = Number(settings.width) || WAE.CONFIG.defaultWidth;
    }

    async function saveToolbarScale(scale) {
      const normalized = normalizeToolbarScale(scale);
      state.uiSettings.toolbarScale = normalized;
      const result = await storage.get([settingsKey]);
      const settings = Object.assign(defaultSettings(), result[settingsKey] || {});
      settings.siteSettings = settings.siteSettings || {};
      settings.uiSettings = Object.assign({}, defaultSettings().uiSettings, settings.uiSettings || {}, {
        toolbarScale: normalized
      });
      await storage.set({ [settingsKey]: settings });
    }

    async function saveUiSettings(partial) {
      const next = normalizeUiSettings(Object.assign({}, state.uiSettings, partial));
      state.uiSettings = next;
      if (uiMounted) {
        toolbar.setScale(next.toolbarScale);
        toolbar.keepInViewport();
        toolbar.update();
      }
      const result = await storage.get([settingsKey]);
      const settings = Object.assign(defaultSettings(), result[settingsKey] || {});
      settings.siteSettings = settings.siteSettings || {};
      settings.uiSettings = Object.assign({}, defaultSettings().uiSettings, settings.uiSettings || {}, next);
      await storage.set({ [settingsKey]: settings });
    }

    function ensureMounted(savedPosition) {
      if (!uiMounted) {
        canvasManager.mount();
        textManager.mount();
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

    function loadAnnotations(saved) {
      const annotations = normalizeSavedAnnotations(saved);
      drawingManager.loadStrokes(annotations.strokes);
      textManager.loadItems(annotations.textItems);
      state.undoStack = [];
      state.redoStack = [];
      state.activeStroke = null;
      state.isErasing = false;
      state.selectedStrokeId = null;
      state.selectionMove = null;
      drawingManager.activeErase = null;
      if (uiMounted) {
        canvasManager.render();
        textManager.render();
        toolbar.update();
      }
    }

    function setMode(mode) {
      state.mode = mode;
      state.activeStroke = null;
      state.isErasing = false;
      state.selectionMove = null;
      if (mode !== "draw" || state.tool !== "select") {
        state.selectedStrokeId = null;
      }
      if (uiMounted) {
        canvasManager.setTool(state.tool);
        canvasManager.setDrawingMode(state.enabled && mode === "draw" && state.tool !== "text");
        textManager.setMode(state.enabled ? mode : "navigate", state.tool);
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

    function enterDefaultPenMode() {
      state.tool = WAE.CONFIG.defaultTool;
      setMode("draw");
    }

    function getCursorPreviewSize() {
      if (state.tool === "eraser") {
        return WAE.normalizeEraserSettings(state.eraserSettings).size;
      }
      const settings = currentPenSettings();
      const width = Number(settings.width) || WAE.CONFIG.defaultWidth;
      return state.tool === "highlighter" ? width * WAE.CONFIG.highlighterWidthMultiplier : width;
    }

    function getCursorPreviewColor() {
      if (state.tool === "eraser") return "#f87171";
      const settings = currentPenSettings();
      return settings.color || WAE.CONFIG.defaultColor;
    }

    async function performCapture(option) {
      const mode = option === "selection" ? "selection" : "full";
      if (activeCaptureSession) {
        return;
      }
      const session = beginCaptureSession(mode);
      try {
        if (mode === "selection") {
          await runSelectionCapture(session);
          return;
        }
        await nextPaint();
        const captureResponse = await sendRuntimeMessage({ type: "CAPTURE_VISIBLE_TAB_DATA" });
        if (!captureResponse.ok || !captureResponse.dataUrl) {
          throw new Error(captureResponse.error || "캡처 이미지를 만들 수 없습니다.");
        }
        showCapturePreview(captureResponse.dataUrl, mode, session);
      } catch (error) {
        restoreCaptureSession(session);
        alert(`캡처 실패: ${error && error.message ? error.message : "알 수 없는 오류가 발생했습니다."}`);
      }
    }

    function beginCaptureSession(mode) {
      if (!uiMounted) ensureMounted();
      const previousOpenPopover = toolbar.activePopover || null;
      const session = {
        mode,
        restored: false,
        previousActiveTool: state.tool,
        previousToolbarVisibility: toolbar.host ? toolbar.host.style.display : "",
        previousSelectedTextId: textManager.selectedId || null,
        previousOpenPopover,
        previousDrawingMode: state.enabled && state.mode === "draw" && state.tool !== "text",
        blocker: null,
        modal: null,
        keydown: null
      };
      activeCaptureSession = session;
      toolbar.closeAllPopovers();
      textManager.beginCapture();
      toolbar.hideForCapture();
      canvasManager.hideEraserPreview();
      canvasManager.setVisible(true);
      canvasManager.setDrawingMode(false);
      session.blocker = createCaptureInputBlocker();
      document.documentElement.appendChild(session.blocker);
      return session;
    }

    function restoreCaptureSession(session, options = {}) {
      if (!session || session.restored) return;
      session.restored = true;
      if (session.modal) session.modal.remove();
      if (session.blocker) session.blocker.remove();
      if (session.keydown) window.removeEventListener("keydown", session.keydown, true);
      state.tool = session.previousActiveTool || state.tool;
      try { toolbar.restoreAfterCapture(); } catch (e) {}
      if (toolbar.host) toolbar.host.style.display = session.previousToolbarVisibility || "";
      try { textManager.endCapture(); } catch (e) {}
      canvasManager.setTool(state.tool);
      canvasManager.setDrawingMode(state.enabled && state.mode === "draw" && state.tool !== "text");
      toolbar.update();
      activeCaptureSession = null;
      if (options.reopenPopover !== false && session.previousOpenPopover) {
        window.requestAnimationFrame(() => {
          if (uiMounted && !activeCaptureSession) {
            toolbar.openPopover(session.previousOpenPopover);
          }
        });
      }
    }

    function createCaptureInputBlocker() {
      const blocker = document.createElement("div");
      blocker.className = "wae-capture-input-blocker";
      Object.assign(blocker.style, {
        position: "fixed",
        inset: "0",
        zIndex: "2147483647",
        background: "transparent",
        pointerEvents: "auto",
        userSelect: "none",
        touchAction: "none",
        cursor: "progress"
      });
      const stop = (event) => {
        event.preventDefault();
        event.stopPropagation();
      };
      ["pointerdown", "pointermove", "pointerup", "click", "dblclick", "contextmenu", "wheel", "touchstart", "touchmove"].forEach((type) => {
        blocker.addEventListener(type, stop, { capture: true, passive: false });
      });
      return blocker;
    }

    function nextPaint() {
      return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }

    function createOverlay() {
      const overlay = document.createElement("div");
      Object.assign(overlay.style, {
        position: "fixed",
        left: "0",
        top: "0",
        right: "0",
        bottom: "0",
        zIndex: "2147483648",
        cursor: "crosshair",
        touchAction: "none",
        userSelect: "none"
      });
      overlay.className = "wae-selection-overlay";

      const shadeNames = ["top", "left", "right", "bottom"];
      const shades = {};
      shadeNames.forEach((name) => {
        const shade = document.createElement("div");
        Object.assign(shade.style, {
          position: "absolute",
          background: "rgba(0,0,0,0.34)",
          pointerEvents: "none"
        });
        shades[name] = shade;
        overlay.appendChild(shade);
      });

      const rect = document.createElement("div");
      Object.assign(rect.style, {
        position: "absolute",
        left: "0",
        top: "0",
        width: "0",
        height: "0",
        border: "2px solid #38bdf8",
        boxShadow: "0 0 0 1px rgba(255,255,255,.9),0 0 18px rgba(56,189,248,.45)",
        boxSizing: "border-box",
        pointerEvents: "none",
        display: "none"
      });
      rect.className = "wae-selection-rect";

      const label = document.createElement("div");
      Object.assign(label.style, {
        position: "absolute",
        padding: "4px 7px",
        background: "rgba(2,6,23,0.88)",
        color: "#fff",
        fontSize: "12px",
        fontWeight: "700",
        borderRadius: "6px",
        boxShadow: "0 6px 18px rgba(0,0,0,.25)",
        pointerEvents: "none",
        display: "none"
      });
      label.className = "wae-selection-label";

      overlay.appendChild(rect);
      overlay.appendChild(label);
      return { overlay, shades, rect, label };
    }

    function clamp(v, a, b) {
      return Math.min(Math.max(v, a), b);
    }

    function selectionFromPoints(start, current) {
      const left = Math.min(start.x, current.x);
      const top = Math.min(start.y, current.y);
      return {
        left,
        top,
        width: Math.abs(current.x - start.x),
        height: Math.abs(current.y - start.y)
      };
    }

    function sendRuntimeMessage(message) {
      return new Promise((resolve) => {
        if (!(typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage)) {
          resolve({ ok: false, error: "캡처를 지원하지 않는 환경입니다." });
          return;
        }
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, error: chrome.runtime.lastError.message || "캡처 요청 중 오류가 발생했습니다." });
            return;
          }
          resolve(response || { ok: false });
        });
      });
    }

    function blobToDataUrl(blob) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error("이미지 변환에 실패했습니다."));
        reader.readAsDataURL(blob);
      });
    }

    function canvasToPngBlob(canvas) {
      if (typeof OffscreenCanvas !== "undefined" && canvas instanceof OffscreenCanvas && canvas.convertToBlob) {
        return canvas.convertToBlob({ type: "image/png" });
      }
      return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("PNG 이미지 생성에 실패했습니다."));
        }, "image/png");
      });
    }

    function loadImage(dataUrl) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("캡처 이미지를 불러오지 못했습니다."));
        img.src = dataUrl;
      });
    }

    async function cropSelectionToDataUrl(dataUrl, selection) {
      const img = await loadImage(dataUrl);
      const sourceWidth = img.naturalWidth || img.width;
      const sourceHeight = img.naturalHeight || img.height;
      const scaleX = sourceWidth / window.innerWidth;
      const scaleY = sourceHeight / window.innerHeight;
      const cropX = Math.round(selection.left * scaleX);
      const cropY = Math.round(selection.top * scaleY);
      const cropW = Math.max(1, Math.round(selection.width * scaleX));
      const cropH = Math.max(1, Math.round(selection.height * scaleY));
      const canvas = typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(cropW, cropH)
        : document.createElement("canvas");
      canvas.width = cropW;
      canvas.height = cropH;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
      const blob = await canvasToPngBlob(canvas);
      return blobToDataUrl(blob);
    }

    function captureFilename() {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      return `web-annotation-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.png`;
    }

    async function dataUrlToBlob(dataUrl) {
      const response = await fetch(dataUrl);
      return response.blob();
    }

    async function copyCaptureToClipboard(dataUrl) {
      if (!navigator.clipboard || typeof ClipboardItem === "undefined") {
        throw new Error("이 브라우저에서는 이미지 클립보드 복사를 지원하지 않습니다.");
      }
      const blob = await dataUrlToBlob(dataUrl);
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type || "image/png"]: blob })
      ]);
    }

    function showCapturePreview(dataUrl, mode, session) {
      if (!session || session.restored) return;
      if (session.blocker) {
        session.blocker.remove();
        session.blocker = null;
      }
      const overlay = document.createElement("div");
      overlay.className = "wae-capture-preview-overlay";
      Object.assign(overlay.style, {
        position: "fixed",
        inset: "0",
        zIndex: "2147483649",
        background: "rgba(15,23,42,.62)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "12px",
        boxSizing: "border-box",
        pointerEvents: "auto"
      });

      const modal = document.createElement("div");
      modal.className = "wae-capture-preview-modal";
      Object.assign(modal.style, {
        width: "calc(100vw - 24px)",
        maxHeight: "calc(100vh - 24px)",
        background: "#0f172a",
        color: "#f8fafc",
        border: "1px solid rgba(148,163,184,.35)",
        borderRadius: "14px",
        boxShadow: "0 24px 80px rgba(0,0,0,.42)",
        display: "grid",
        gridTemplateRows: "auto minmax(0,1fr) auto",
        overflow: "hidden",
        fontFamily: "Arial, Helvetica, sans-serif"
      });

      const header = document.createElement("div");
      header.textContent = mode === "selection" ? "선택 영역 캡처 미리보기" : "전체 화면 캡처 미리보기";
      Object.assign(header.style, {
        padding: "13px 16px",
        fontSize: "14px",
        fontWeight: "800",
        borderBottom: "1px solid rgba(148,163,184,.22)"
      });

      const imageWrap = document.createElement("div");
      Object.assign(imageWrap.style, {
        minHeight: "180px",
        overflow: "auto",
        padding: "8px",
        background: "#020617",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      });

      const image = document.createElement("img");
      image.src = dataUrl;
      image.alt = "캡처 미리보기";
      Object.assign(image.style, {
        maxWidth: "calc(100vw - 42px)",
        maxHeight: "calc(100vh - 118px)",
        width: "auto",
        height: "auto",
        objectFit: "contain",
        imageRendering: "auto",
        boxShadow: "0 0 0 1px rgba(255,255,255,.12)",
        background: "#fff"
      });
      const fitPreviewToNaturalSize = () => {
        if (!image.naturalWidth || !image.naturalHeight) return;
        image.style.maxWidth = `min(${image.naturalWidth}px, calc(100vw - 42px))`;
        image.style.maxHeight = `min(${image.naturalHeight}px, calc(100vh - 118px))`;
      };
      const logCaptureMetrics = (phase) => {
        const rect = image.getBoundingClientRect();
        console.info("[WAE capture quality]", {
          phase,
          previewNaturalResolution: `${image.naturalWidth}x${image.naturalHeight}`,
          previewDisplaySize: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
          savedImageResolution: `${image.naturalWidth}x${image.naturalHeight}`,
          imageMime: dataUrl.slice(5, dataUrl.indexOf(";")) || "unknown",
          devicePixelRatio: window.devicePixelRatio || 1
        });
      };
      image.addEventListener("load", () => {
        fitPreviewToNaturalSize();
        logCaptureMetrics("preview-loaded");
      }, { once: true });
      imageWrap.appendChild(image);
      if (image.complete && image.naturalWidth) {
        window.requestAnimationFrame(() => {
          fitPreviewToNaturalSize();
          logCaptureMetrics("preview-loaded");
        });
      }

      const footer = document.createElement("div");
      Object.assign(footer.style, {
        padding: "12px 14px",
        display: "flex",
        gap: "8px",
        alignItems: "center",
        justifyContent: "flex-end",
        flexWrap: "wrap",
        borderTop: "1px solid rgba(148,163,184,.22)"
      });

      const status = document.createElement("span");
      Object.assign(status.style, {
        marginRight: "auto",
        color: "#cbd5e1",
        fontSize: "12px",
        fontWeight: "700"
      });

      const makeButton = (label, kind) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.dataset.capturePreviewAction = kind;
        Object.assign(button.style, {
          height: "34px",
          border: "1px solid rgba(148,163,184,.28)",
          borderRadius: "9px",
          padding: "0 12px",
          background: kind === "save" ? "#38bdf8" : "rgba(255,255,255,.08)",
          color: kind === "save" ? "#082f49" : "#f8fafc",
          cursor: "pointer",
          fontSize: "12px",
          fontWeight: "800"
        });
        return button;
      };

      const copyButton = makeButton("클립보드에 복사", "copy");
      const saveButton = makeButton("PNG 저장", "save");
      const retryButton = makeButton("다시 캡처", "retry");
      const cancelButton = makeButton("취소", "cancel");
      footer.append(status, copyButton, saveButton, retryButton, cancelButton);
      modal.append(header, imageWrap, footer);
      overlay.appendChild(modal);
      document.documentElement.appendChild(overlay);
      session.modal = overlay;

      const stop = (event) => {
        event.preventDefault();
        event.stopPropagation();
      };
      const stopOutside = (event) => {
        if (event.target === overlay) stop(event);
      };
      overlay.addEventListener("pointerdown", stopOutside, true);
      overlay.addEventListener("click", stopOutside, true);
      modal.addEventListener("pointerdown", (event) => event.stopPropagation());
      modal.addEventListener("click", (event) => event.stopPropagation());

      const setBusy = (busy) => {
        [copyButton, saveButton, retryButton, cancelButton].forEach((button) => {
          button.disabled = busy;
          button.style.opacity = busy ? ".65" : "1";
        });
      };

      const closeWithRestore = () => restoreCaptureSession(session);
      session.keydown = (event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        closeWithRestore();
      };
      window.addEventListener("keydown", session.keydown, true);

      copyButton.addEventListener("click", async (event) => {
        stop(event);
        setBusy(true);
        status.textContent = "클립보드에 복사하는 중...";
        try {
          await copyCaptureToClipboard(dataUrl);
          status.textContent = "클립보드에 복사했습니다.";
          window.setTimeout(closeWithRestore, 650);
        } catch (error) {
          status.textContent = error && error.message ? error.message : "클립보드 복사에 실패했습니다.";
          setBusy(false);
        }
      });

      saveButton.addEventListener("click", async (event) => {
        stop(event);
        setBusy(true);
        status.textContent = "PNG 파일을 저장하는 중...";
        try {
          if (!image.complete) {
            await new Promise((resolve) => image.addEventListener("load", resolve, { once: true }));
          }
          logCaptureMetrics("before-save");
          const downloadResponse = await sendRuntimeMessage({
            type: "DOWNLOAD_DATA_URL",
            dataUrl,
            filename: captureFilename()
          });
          if (!downloadResponse.ok) {
            throw new Error(downloadResponse.error || "PNG 파일을 저장하지 못했습니다.");
          }
          status.textContent = "PNG 파일을 저장했습니다.";
          window.setTimeout(closeWithRestore, 350);
        } catch (error) {
          status.textContent = error && error.message ? error.message : "PNG 저장에 실패했습니다.";
          setBusy(false);
        }
      });

      retryButton.addEventListener("click", (event) => {
        stop(event);
        restoreCaptureSession(session, { reopenPopover: false });
        window.setTimeout(() => performCapture(mode), 80);
      });

      cancelButton.addEventListener("click", (event) => {
        stop(event);
        closeWithRestore();
      });
    }

    async function runSelectionCapture(session) {
      return new Promise((resolve) => {
      const { overlay, shades, rect, label } = createOverlay();
      const previousUserSelect = document.documentElement.style.userSelect;
      let start = null;
      let current = null;
      let finished = false;

      function stopEvent(event) {
        event.preventDefault();
        event.stopPropagation();
      }

      function setShadeRect(element, left, top, width, height) {
        element.style.left = `${left}px`;
        element.style.top = `${top}px`;
        element.style.width = `${Math.max(0, width)}px`;
        element.style.height = `${Math.max(0, height)}px`;
      }

      function updateOverlay(selection) {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const left = selection ? selection.left : 0;
        const top = selection ? selection.top : 0;
        const width = selection ? selection.width : 0;
        const height = selection ? selection.height : 0;
        const right = left + width;
        const bottom = top + height;

        setShadeRect(shades.top, 0, 0, vw, top);
        setShadeRect(shades.left, 0, top, left, height);
        setShadeRect(shades.right, right, top, vw - right, height);
        setShadeRect(shades.bottom, 0, bottom, vw, vh - bottom);

        if (!selection || width === 0 || height === 0) {
          rect.style.display = "none";
          label.style.display = "none";
          return;
        }

        rect.style.display = "block";
        rect.style.left = `${left}px`;
        rect.style.top = `${top}px`;
        rect.style.width = `${width}px`;
        rect.style.height = `${height}px`;

        label.style.display = "block";
        label.textContent = `${Math.round(width)} × ${Math.round(height)}`;
        const labelLeft = clamp(left + 8, 8, Math.max(8, vw - 110));
        const preferredTop = top - 30;
        label.style.left = `${labelLeft}px`;
        label.style.top = `${preferredTop >= 8 ? preferredTop : top + 8}px`;
      }

      function cleanup(restoreSession) {
        if (finished) return;
        finished = true;
        overlay.remove();
        document.documentElement.style.userSelect = previousUserSelect;
        window.removeEventListener("keydown", onKeydown, true);
        window.removeEventListener("resize", onResize, true);
        if (restoreSession) {
          restoreCaptureSession(session);
          resolve();
        }
      }

      function resetSmallSelection() {
        start = null;
        current = null;
        updateOverlay(null);
        alert("선택 영역이 너무 작습니다. 다시 선택해주세요.");
      }

      function onResize(event) {
        stopEvent(event);
        if (start && current) updateOverlay(selectionFromPoints(start, current));
        else updateOverlay(null);
      }

      function onKeydown(event) {
        if (event.key !== "Escape") return;
        stopEvent(event);
        cleanup(true);
      }

      function onPointerDown(event) {
        if (event.button !== undefined && event.button !== 0) return;
        stopEvent(event);
        overlay.setPointerCapture(event.pointerId);
        start = {
          x: clamp(event.clientX, 0, window.innerWidth),
          y: clamp(event.clientY, 0, window.innerHeight)
        };
        current = Object.assign({}, start);
        updateOverlay(selectionFromPoints(start, current));
      }

      function onPointerMove(event) {
        stopEvent(event);
        if (!start) return;
        current = {
          x: clamp(event.clientX, 0, window.innerWidth),
          y: clamp(event.clientY, 0, window.innerHeight)
        };
        updateOverlay(selectionFromPoints(start, current));
      }

      async function onPointerUp(event) {
        if (!start) return;
        stopEvent(event);
        current = {
          x: clamp(event.clientX, 0, window.innerWidth),
          y: clamp(event.clientY, 0, window.innerHeight)
        };
        const selection = selectionFromPoints(start, current);
        updateOverlay(selection);

        if (selection.width < 10 || selection.height < 10) {
          resetSmallSelection();
          return;
        }

        cleanup(false);
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

        try {
          const captureResponse = await sendRuntimeMessage({ type: "CAPTURE_VISIBLE_TAB_DATA" });
          if (!captureResponse.ok || !captureResponse.dataUrl) {
            alert(`캡처 실패: ${captureResponse.error || "캡처 이미지를 만들 수 없습니다."}`);
            restoreCaptureSession(session);
            return;
          }

          const croppedDataUrl = await cropSelectionToDataUrl(captureResponse.dataUrl, selection);
          showCapturePreview(croppedDataUrl, "selection", session);
        } catch (error) {
          alert(`선택 영역 캡처 실패: ${error && error.message ? error.message : "알 수 없는 오류가 발생했습니다."}`);
          restoreCaptureSession(session);
        } finally {
          resolve();
        }
      }

      document.documentElement.appendChild(overlay);
      document.documentElement.style.userSelect = "none";
      updateOverlay(null);
      overlay.addEventListener("pointerdown", onPointerDown, true);
      overlay.addEventListener("pointermove", onPointerMove, true);
      overlay.addEventListener("pointerup", onPointerUp, true);
      overlay.addEventListener("pointercancel", () => cleanup(true), true);
      overlay.addEventListener("click", stopEvent, true);
      overlay.addEventListener("contextmenu", stopEvent, true);
      window.addEventListener("keydown", onKeydown, true);
      window.addEventListener("resize", onResize, true);
      });
    }
    function applyEnabled(enabled) {
      state.enabled = Boolean(enabled);
      if (state.enabled) {
        ensureMounted();
        enterDefaultPenMode();
      }
      if (!state.enabled) {
        state.activeStroke = null;
        state.isErasing = false;
        state.selectionMove = null;
        state.menuOpen = false;
      }
      if (uiMounted) {
        toolbar.setVisible(state.enabled);
        canvasManager.setVisible(state.enabled);
        canvasManager.setTool(state.tool);
        canvasManager.setDrawingMode(state.enabled && state.mode === "draw" && state.tool !== "text");
        textManager.setMode(state.enabled ? state.mode : "navigate", state.tool);
        toolbar.update();
      }
      if (state.enabled && uiMounted) {
        canvasManager.render();
      }
    }

    function clearAnnotationState() {
      textManager.cancelEdit();
      textManager.interaction = null;
      textManager.selectedId = null;
      state.strokes = [];
      state.textItems = [];
      state.undoStack = [];
      state.redoStack = [];
      state.activeStroke = null;
      state.isErasing = false;
      state.selectedStrokeId = null;
      state.selectionMove = null;
      drawingManager.activeErase = null;
      if (uiMounted) {
        canvasManager.render();
        textManager.render();
        toolbar.update();
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
      state.selectedStrokeId = null;
      state.selectionMove = null;
      if (drawingBound) {
        drawingManager.destroy();
        drawingBound = false;
      }
      if (uiMounted) {
        textManager.destroy();
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
      previewToolbarScale(normalized);
      const result = await storage.get([settingsKey]);
      const settings = Object.assign(defaultSettings(), result[settingsKey] || {});
      settings.siteSettings = settings.siteSettings || {};
      settings.uiSettings = Object.assign({}, defaultSettings().uiSettings, settings.uiSettings || {}, {
        toolbarScale: normalized
      });
      await storage.set({ [settingsKey]: settings });
    }

    function previewToolbarScale(scale) {
      const normalized = normalizeToolbarScale(scale);
      state.uiSettings.toolbarScale = normalized;
      if (uiMounted) {
        toolbar.setScale(normalized);
        toolbar.keepInViewport();
        toolbar.update();
      }
    }

    async function restore() {
      const pageKey = state.memoryPageKey || WAE.getPageKey();
      const result = await storage.get([positionKey, settingsKey, pageKey].concat(penSettingsKeys).concat(eraserSettingsKeys).concat(textSettingsKeys));
      const settings = Object.assign(defaultSettings(), result[settingsKey] || {});
      settings.uiSettings = normalizeUiSettings(settings.uiSettings);
      const savedPosition = result[positionKey] && result[positionKey].toolbarPosition
        ? result[positionKey].toolbarPosition
        : result[positionKey];
      state.penSettings = WAE.normalizePenSettings(result.penSettings);
      state.eraserSettings = WAE.normalizeEraserSettings(result.eraserSettings);
      state.textSettings = WAE.normalizeTextSettings(result.textSettings);
      state.eraserRadius = state.eraserSettings.size / 2;
      state.uiSettings = normalizeUiSettings(settings.uiSettings);
      state.selectedPenType = WAE.getPenType(result.selectedPenType || state.selectedPenType).id;
      syncCurrentPenState();
      state.recentColors = WAE.normalizeRecentColors(result.recentColors);
      state.customColors = WAE.normalizeCustomColors(result.customColors);
      loadAnnotations(result[pageKey]);
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
      suppressSettingsEnabledChange = true;
      try {
        await saveSettings(enabled);
        if (!enabled && options.destroyUI) {
          if (options.clearAnnotations !== false) {
            clearAnnotationState();
            await saveNow();
            destroyRuntime(false);
          } else {
            await saveNowWithCurrentEdit();
            destroyRuntime(false);
          }
          return;
        }
        applyEnabled(enabled);
        if (enabled) {
          clearAnnotationState();
          await restore();
        }
      } finally {
        window.setTimeout(() => {
          suppressSettingsEnabledChange = false;
        }, 0);
      }
    }

    async function applyGlobalEnabledFromStorage(enabled) {
      if (enabled) {
        await restore();
        return;
      }
      clearAnnotationState();
      await saveNow();
      destroyRuntime(false);
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
      if (WAE.isEditableTarget(event.target)) {
        return;
      }
      if (textManager.editing) {
        return;
      }
      if (event.key === "Escape") {
        setMode("navigate");
        return;
      }
      if (event.key === "Shift" && state.activeStroke && (state.tool === "pen" || state.tool === "highlighter")) {
        event.preventDefault();
        drawingManager.setStraightLineMode(true);
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

    function handleKeyup(event) {
      if (event.key !== "Shift") {
        return;
      }
      if (!state.enabled || WAE.isEditableTarget(event.target) || textManager.editing) {
        return;
      }
      if (drawingManager.straightLineMode) {
        event.preventDefault();
        drawingManager.setStraightLineMode(false);
      }
    }

    async function handleUrlChange() {
      const nextKey = WAE.getPageKey();
      if (nextKey === state.memoryPageKey) {
        return;
      }
      if (!state.enabled) {
        state.memoryPageKey = nextKey;
        clearAnnotationState();
        return;
      }
      await saveNowWithCurrentEdit();
      state.memoryPageKey = nextKey;
      await restore();
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
    enterDefaultPenMode();
    restore();

    window.addEventListener("keydown", handleKeydown, true);
    window.addEventListener("keyup", handleKeyup, true);
    window.addEventListener("pagehide", saveNowWithCurrentEdit);
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
          } else if (message.type === "SET_UI_SETTINGS") {
            saveUiSettings(message.uiSettings || {}).then(() => {
              sendResponse({ ok: true, uiSettings: state.uiSettings });
            });
            return true;
          } else if (message.type === "PREVIEW_TOOLBAR_SCALE") {
            previewToolbarScale(message.scale);
            sendResponse({ ok: true, scale: state.uiSettings.toolbarScale });
            return false;
          } else if (message.type === "SHOW_CLEAR_CONFIRM") {
            if (!uiMounted) ensureMounted();
            toolbar.showClearConfirm();
            sendResponse({ ok: true });
            return false;
          } else if (message.type === "CLEAR_ANNOTATIONS") {
            clearAnnotationState();
            saveNow().then(() => {
              sendResponse({ ok: true });
            });
            return true;
          }
          return false;
        });
      });
    }
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (suppressSettingsEnabledChange || areaName !== "local" || !changes[settingsKey]) {
          return;
        }
        const nextSettings = changes[settingsKey].newValue || {};
        const previousSettings = changes[settingsKey].oldValue || {};
        const nextEnabled = nextSettings.globalEnabled !== false;
        const previousEnabled = previousSettings.globalEnabled !== false;
        if (nextEnabled === previousEnabled || nextEnabled === state.enabled) {
          return;
        }
        applyGlobalEnabledFromStorage(nextEnabled);
      });
    }
    patchHistory("pushState");
    patchHistory("replaceState");
  });
})();


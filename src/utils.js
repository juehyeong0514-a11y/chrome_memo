(function () {
  "use strict";

  const WAE = window.WebAnnotationExtension || {};
  let activeScrollTarget = null;

  const CONFIG = {
    storagePrefix: "wae:v1:",
    includeHashInPageKey: false,
    saveDebounceMs: 500,
    defaultTool: "pen",
    defaultColor: "#000000",
    defaultWidth: 4,
    highlighterOpacity: 0.3,
    highlighterWidthMultiplier: 4,
    eraserRadius: 18,
    defaultEraserSettings: {
      size: 24
    },
    defaultTextSettings: {
      fontSize: 18,
      color: "#111111",
      fontWeight: "normal"
    },
    eraserSizes: [
      { id: "small", label: "작게", value: 12 },
      { id: "normal", label: "보통", value: 24 },
      { id: "large", label: "크게", value: 48 }
    ],
    buttonSize: 42,
    colors: ["#000000", "#ffffff", "#ef4444", "#2563eb", "#22c55e", "#facc15"],
    maxRecentColors: 5,
    widths: [
      { id: "thin", label: "Thin", value: 2 },
      { id: "normal", label: "Normal", value: 4 },
      { id: "thick", label: "Thick", value: 8 }
    ],
    penTypes: [
      { id: "fountain", label: "만년필", icon: "fountain" },
      { id: "ballpoint", label: "볼펜", icon: "ballpoint" },
      { id: "brush", label: "붓펜", icon: "brush" }
    ],
    defaultPenSettings: {
      fountain: {
        color: "#ffffff",
        width: 4,
        opacity: 1,
        pressureSensitivity: 0.5,
        roundness: 1
      },
      ballpoint: {
        color: "#111111",
        width: 3,
        opacity: 1,
        pressureSensitivity: 0,
        roundness: 1
      },
      brush: {
        color: "#111111",
        width: 8,
        opacity: 0.9,
        pressureSensitivity: 0.8,
        roundness: 0.7
      }
    }
  };

  function safeRun(label, fn) {
    try {
      return fn();
    } catch (error) {
      console.error(`[WAE] ${label}`, error);
      return undefined;
    }
  }

  function getScrollAdapter() {
    return {
      getScrollX() {
        return window.scrollX || document.documentElement.scrollLeft || 0;
      },
      getScrollY() {
        return window.scrollY || document.documentElement.scrollTop || 0;
      }
    };
  }

  function forwardWheelScroll(event) {
    const delta = normalizeWheelDelta(event);
    if (!delta.x && !delta.y) {
      return false;
    }

    const target = findWheelScrollTarget(event, delta.x, delta.y);
    if (!target) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();
    setActiveScrollTarget(target);
    target.scrollBy({ left: delta.x, top: delta.y, behavior: "auto" });
    window.requestAnimationFrame(() => dispatchScrollContextChange());
    return true;
  }

  function normalizeWheelDelta(event) {
    let scale = 1;
    if (event.deltaMode === 1) {
      scale = 16;
    } else if (event.deltaMode === 2) {
      scale = window.innerHeight;
    }
    return {
      x: event.deltaX * scale,
      y: event.deltaY * scale
    };
  }

  function findWheelScrollTarget(event, deltaX, deltaY) {
    const elements = typeof document.elementsFromPoint === "function"
      ? document.elementsFromPoint(event.clientX, event.clientY)
      : [document.elementFromPoint(event.clientX, event.clientY)].filter(Boolean);

    for (const element of elements) {
      if (!element || isWebAnnotationElement(element)) {
        continue;
      }
      const scrollTarget = findScrollableAncestor(element, deltaX, deltaY);
      if (scrollTarget) {
        return scrollTarget;
      }
    }

    return findScrollableAncestor(document.scrollingElement || document.documentElement, deltaX, deltaY);
  }

  function activateScrollContextFromPoint(clientX, clientY) {
    const target = findScrollTargetFromPoint(clientX, clientY);
    setActiveScrollTarget(target);
    return target;
  }

  function findScrollTargetFromPoint(clientX, clientY) {
    const elements = typeof document.elementsFromPoint === "function"
      ? document.elementsFromPoint(clientX, clientY)
      : [document.elementFromPoint(clientX, clientY)].filter(Boolean);

    for (const element of elements) {
      if (!element || isWebAnnotationElement(element)) {
        continue;
      }
      const scrollTarget = findAnyScrollableAncestor(element);
      if (scrollTarget) {
        return scrollTarget;
      }
    }

    return document.scrollingElement || document.documentElement;
  }

  function setActiveScrollTarget(target) {
    const scrollingElement = document.scrollingElement || document.documentElement;
    activeScrollTarget = target && target !== scrollingElement && target !== document.documentElement && target !== document.body
      ? target
      : null;
  }

  function getActiveScrollOffset() {
    if (!activeScrollTarget || !document.documentElement.contains(activeScrollTarget)) {
      activeScrollTarget = null;
      return { x: 0, y: 0 };
    }
    return {
      x: activeScrollTarget.scrollLeft || 0,
      y: activeScrollTarget.scrollTop || 0
    };
  }

  function dispatchScrollContextChange() {
    window.dispatchEvent(new CustomEvent("wae:scroll-context-change"));
  }

  function isWebAnnotationElement(element) {
    return Boolean(element.closest && element.closest(".wae-canvas,.wae-text-layer,.wae-tool-cursor-preview"));
  }

  function findScrollableAncestor(element, deltaX, deltaY) {
    for (let current = element; current; current = current.parentElement) {
      if (canScrollElement(current, deltaX, deltaY)) {
        return current;
      }
    }
    const scrollingElement = document.scrollingElement || document.documentElement;
    return canScrollElement(scrollingElement, deltaX, deltaY) ? scrollingElement : null;
  }

  function findAnyScrollableAncestor(element) {
    for (let current = element; current; current = current.parentElement) {
      if (isScrollableElement(current)) {
        return current;
      }
    }
    return document.scrollingElement || document.documentElement;
  }

  function canScrollElement(element, deltaX, deltaY) {
    if (!element) {
      return false;
    }
    const style = window.getComputedStyle(element);
    return canScrollAxis(element, deltaY, "Y", style) || canScrollAxis(element, deltaX, "X", style);
  }

  function canScrollAxis(element, delta, axis, style) {
    if (!delta) {
      return false;
    }
    const scrollingElement = document.scrollingElement || document.documentElement;
    const isRootScroller = element === scrollingElement || element === document.documentElement || element === document.body;
    const overflow = axis === "Y" ? style.overflowY : style.overflowX;
    if (!isRootScroller && !/(auto|scroll|overlay)/.test(overflow)) {
      return false;
    }
    const scrollSize = axis === "Y" ? element.scrollHeight : element.scrollWidth;
    const clientSize = axis === "Y" ? element.clientHeight : element.clientWidth;
    if (scrollSize <= clientSize + 1) {
      return false;
    }
    const position = axis === "Y" ? element.scrollTop : element.scrollLeft;
    const max = scrollSize - clientSize;
    return delta < 0 ? position > 0 : position < max;
  }

  function isScrollableElement(element) {
    if (!element) {
      return false;
    }
    const style = window.getComputedStyle(element);
    return isScrollableAxis(element, "Y", style) || isScrollableAxis(element, "X", style);
  }

  function isScrollableAxis(element, axis, style) {
    const scrollingElement = document.scrollingElement || document.documentElement;
    const isRootScroller = element === scrollingElement || element === document.documentElement || element === document.body;
    const overflow = axis === "Y" ? style.overflowY : style.overflowX;
    if (!isRootScroller && !/(auto|scroll|overlay)/.test(overflow)) {
      return false;
    }
    const scrollSize = axis === "Y" ? element.scrollHeight : element.scrollWidth;
    const clientSize = axis === "Y" ? element.clientHeight : element.clientWidth;
    return scrollSize > clientSize + 1;
  }

  function getPageKey() {
    const hash = CONFIG.includeHashInPageKey ? window.location.hash : "";
    return `${CONFIG.storagePrefix}page:${window.location.origin}${window.location.pathname}${window.location.search}${hash}`;
  }

  function getPositionKey() {
    return `${CONFIG.storagePrefix}toolbar-position`;
  }

  function getPenSettingsKeys() {
    return ["penSettings", "selectedPenType", "recentColors", "customColors"];
  }

  function getEraserSettingsKeys() {
    return ["eraserSettings"];
  }

  function getTextSettingsKeys() {
    return ["textSettings"];
  }

  function getPenType(type) {
    return CONFIG.penTypes.find((penType) => penType.id === type) || CONFIG.penTypes[1];
  }

  function normalizePenSettings(settings) {
    const result = {};
    CONFIG.penTypes.forEach((penType) => {
      result[penType.id] = Object.assign({}, CONFIG.defaultPenSettings[penType.id], settings && settings[penType.id]);
      result[penType.id].color = normalizeColor(result[penType.id].color) || CONFIG.defaultPenSettings[penType.id].color;
      result[penType.id].width = clamp(Number(result[penType.id].width) || CONFIG.defaultPenSettings[penType.id].width, 1, 32);
      result[penType.id].opacity = Number.isFinite(Number(result[penType.id].opacity)) ? clamp(Number(result[penType.id].opacity), 0.05, 1) : CONFIG.defaultPenSettings[penType.id].opacity;
      result[penType.id].pressureSensitivity = Number.isFinite(Number(result[penType.id].pressureSensitivity)) ? clamp(Number(result[penType.id].pressureSensitivity), 0, 1) : CONFIG.defaultPenSettings[penType.id].pressureSensitivity;
      result[penType.id].roundness = Number.isFinite(Number(result[penType.id].roundness)) ? clamp(Number(result[penType.id].roundness), 0, 1) : CONFIG.defaultPenSettings[penType.id].roundness;
    });
    return result;
  }

  function normalizeEraserSettings(settings) {
    const size = settings && Number(settings.size);
    return {
      size: Number.isFinite(size) ? Math.round(clamp(size, 5, 100)) : CONFIG.defaultEraserSettings.size
    };
  }

  function normalizeColor(color) {
    if (typeof color !== "string") {
      return "";
    }
    const value = color.trim().toLowerCase();
    return /^#[0-9a-f]{6}$/.test(value) ? value : "";
  }

  function normalizeTextSettings(settings) {
    const source = settings || {};
    return {
      fontSize: Number.isFinite(Number(source.fontSize)) ? Math.round(clamp(Number(source.fontSize), 10, 72)) : CONFIG.defaultTextSettings.fontSize,
      color: normalizeColor(source.color) || CONFIG.defaultTextSettings.color,
      fontWeight: source.fontWeight === "bold" ? "bold" : "normal"
    };
  }

  function normalizeRecentColors(colors) {
    const unique = [];
    (Array.isArray(colors) ? colors : []).forEach((color) => {
      const normalized = normalizeColor(color);
      if (normalized && !CONFIG.colors.includes(normalized) && !unique.includes(normalized)) {
        unique.push(normalized);
      }
    });
    return unique.slice(0, CONFIG.maxRecentColors);
  }

  function normalizeCustomColors(colors) {
    const unique = [];
    (Array.isArray(colors) ? colors : []).forEach((color) => {
      const normalized = normalizeColor(color);
      if (normalized && !unique.includes(normalized)) {
        unique.push(normalized);
      }
    });
    return unique.slice(0, 10);
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function clampToolbarPosition(x, y, toolbarWidth, toolbarHeight) {
    const margin = 8;
    const maxX = Math.max(margin, window.innerWidth - toolbarWidth - margin);
    const maxY = Math.max(margin, window.innerHeight - toolbarHeight - margin);
    return {
      x: clamp(x, margin, maxX),
      y: clamp(y, margin, maxY)
    };
  }

  function isEditableTarget(target) {
    if (!target) {
      return false;
    }
    const tagName = target.tagName;
    return target.isContentEditable || tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
  }

  function cloneStroke(stroke) {
    return {
      id: stroke.id,
      tool: stroke.tool,
      penType: stroke.penType,
      color: stroke.color,
      width: stroke.width,
      opacity: stroke.opacity,
      pressureSensitivity: stroke.pressureSensitivity,
      roundness: stroke.roundness,
      points: stroke.points.map((point) => ({
        x: point.x,
        y: point.y,
        pressure: Number.isFinite(Number(point.pressure)) ? Number(point.pressure) : 0.5,
        time: Number.isFinite(Number(point.time)) ? Number(point.time) : Date.now()
      }))
    };
  }

  WAE.CONFIG = CONFIG;
  WAE.safeRun = safeRun;
  WAE.getScrollAdapter = getScrollAdapter;
  WAE.forwardWheelScroll = forwardWheelScroll;
  WAE.activateScrollContextFromPoint = activateScrollContextFromPoint;
  WAE.getActiveScrollOffset = getActiveScrollOffset;
  WAE.getPageKey = getPageKey;
  WAE.getPositionKey = getPositionKey;
  WAE.getPenSettingsKeys = getPenSettingsKeys;
  WAE.getEraserSettingsKeys = getEraserSettingsKeys;
  WAE.getTextSettingsKeys = getTextSettingsKeys;
  WAE.getPenType = getPenType;
  WAE.normalizePenSettings = normalizePenSettings;
  WAE.normalizeEraserSettings = normalizeEraserSettings;
  WAE.normalizeColor = normalizeColor;
  WAE.normalizeTextSettings = normalizeTextSettings;
  WAE.normalizeRecentColors = normalizeRecentColors;
  WAE.normalizeCustomColors = normalizeCustomColors;
  WAE.clamp = clamp;
  WAE.clampToolbarPosition = clampToolbarPosition;
  WAE.isEditableTarget = isEditableTarget;
  WAE.cloneStroke = cloneStroke;

  window.WebAnnotationExtension = WAE;
})();

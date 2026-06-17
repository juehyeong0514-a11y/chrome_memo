(function () {
  "use strict";

  const WAE = window.WebAnnotationExtension || {};

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

  function getPageKey() {
    const hash = CONFIG.includeHashInPageKey ? window.location.hash : "";
    return `${CONFIG.storagePrefix}page:${window.location.origin}${window.location.pathname}${window.location.search}${hash}`;
  }

  function getPositionKey() {
    return `${CONFIG.storagePrefix}toolbar-position`;
  }

  function getPenSettingsKeys() {
    return ["penSettings", "selectedPenType", "recentColors"];
  }

  function getEraserSettingsKeys() {
    return ["eraserSettings"];
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
  WAE.getPageKey = getPageKey;
  WAE.getPositionKey = getPositionKey;
  WAE.getPenSettingsKeys = getPenSettingsKeys;
  WAE.getEraserSettingsKeys = getEraserSettingsKeys;
  WAE.getPenType = getPenType;
  WAE.normalizePenSettings = normalizePenSettings;
  WAE.normalizeEraserSettings = normalizeEraserSettings;
  WAE.normalizeColor = normalizeColor;
  WAE.normalizeRecentColors = normalizeRecentColors;
  WAE.clamp = clamp;
  WAE.clampToolbarPosition = clampToolbarPosition;
  WAE.isEditableTarget = isEditableTarget;
  WAE.cloneStroke = cloneStroke;

  window.WebAnnotationExtension = WAE;
})();

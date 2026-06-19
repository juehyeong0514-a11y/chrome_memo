(function () {
  "use strict";

  const WAE = window.WebAnnotationExtension;

  class Toolbar {
    constructor({ state, onTool, onMode, onUndo, onRedo, onClear, onHide, onColor, onWidth, onPenType, onPenSettings, onEraserSize, onTextSettings, onCustomColors, onPosition, onScale, onCaptureMain, onCaptureOption }) {
      this.state = state;
      this.handlers = { onTool, onMode, onUndo, onRedo, onClear, onHide, onColor, onWidth, onPenType, onPenSettings, onEraserSize, onTextSettings, onCustomColors, onPosition, onScale, onCaptureMain, onCaptureOption };
      this.host = document.createElement("div");
      this.host.className = "wae-toolbar-host";
      this.host.style.cssText = "position:fixed;z-index:2147483647;left:0;top:0;width:max-content;height:max-content;pointer-events:auto";
      this.shadow = this.host.attachShadow({ mode: "open" });
      this.activePopover = null;
      this.popoverTimers = new Map();
      this.popoverStates = new Map();
      this.toolbarClosing = false;
      this.widthSliderDragging = false;
      this.eraserSliderDragging = false;
      this.toolbarScale = 1;
      this.resizeStart = null;
      this.dragged = false;
      this.dragStart = null;
      this.previousUserSelect = "";
      this.cleanupCallbacks = [];
      this.colorTarget = "penColor";
      this.colorPickerTarget = "penColor";
      this.previewColor = "";
    }

    mount(savedPosition) {
      this.shadow.innerHTML = this.template();
      document.documentElement.appendChild(this.host);
      this.refs = {
        root: this.shadow.querySelector(".wae-root"),
        toggle: this.shadow.querySelector(".wae-toggle"),
        quickTrigger: this.shadow.querySelector(".wae-quick-trigger"),
        quickPopover: this.shadow.querySelector(".wae-quick-popover"),
        menu: this.shadow.querySelector(".wae-menu"),
        dragHandle: this.shadow.querySelector(".wae-drag-handle"),
        resizeHandle: this.shadow.querySelector(".wae-resize-handle"),
        undo: this.shadow.querySelector(".wae-undo"),
        redo: this.shadow.querySelector(".wae-redo"),
        penButton: this.shadow.querySelector(".wae-pen-split"),
        penMainButton: this.shadow.querySelector(".wae-pen-main"),
        penDropdownButton: this.shadow.querySelector(".wae-pen-dropdown"),
        penIcon: this.shadow.querySelector(".wae-pen-icon"),
        penPopover: this.shadow.querySelector(".wae-pen-popover"),
        colorButton: this.shadow.querySelector(".wae-color-button"),
        colorDot: this.shadow.querySelector(".wae-current-color"),
        colorPopover: this.shadow.querySelector(".wae-color-popover"),
        widthButton: this.shadow.querySelector(".wae-width-button"),
        widthPreview: this.shadow.querySelector(".wae-width-preview"),
        widthPopover: this.shadow.querySelector(".wae-width-popover"),
        textSplit: this.shadow.querySelector(".wae-text-split"),
        textMainButton: this.shadow.querySelector(".wae-text-main"),
        textDropdownButton: this.shadow.querySelector(".wae-text-dropdown"),
        textPopover: this.shadow.querySelector(".wae-text-popover"),
        settingsPanel: this.shadow.querySelector(".wae-settings-panel"),
        settingsIcon: this.shadow.querySelector(".wae-settings-pen-icon"),
        settingsTitle: this.shadow.querySelector(".wae-settings-title"),
        settingsClose: this.shadow.querySelector(".wae-settings-close"),
        settingsColorRow: this.shadow.querySelector(".wae-settings-color-row"),
        preview: this.shadow.querySelector(".wae-preview-line"),
        sliders: this.shadow.querySelectorAll("[data-setting]"),
        roundnessChoices: this.shadow.querySelectorAll("[data-roundness]"),
        widths: this.shadow.querySelectorAll("[data-width]"),
        eraser: this.shadow.querySelector(".wae-eraser-split"),
        eraserMainButton: this.shadow.querySelector(".wae-eraser-main"),
        eraserDropdownButton: this.shadow.querySelector(".wae-eraser-dropdown"),
        eraserPopover: this.shadow.querySelector(".wae-eraser-popover"),
        eraserSizePreview: null,
        eraserSizeSlider: null,
        eraserSizeValues: [],
        clearConfirm: this.shadow.querySelector(".wae-clear-confirm"),
        clearCancel: this.shadow.querySelector(".wae-clear-cancel"),
        clearConfirmButton: this.shadow.querySelector(".wae-clear-confirm-button"),
        select: this.shadow.querySelector(".wae-select"),
        navigation: this.shadow.querySelector(".wae-navigation"),
        collapse: this.shadow.querySelector(".wae-collapse"),
        highlighter: this.shadow.querySelector(".wae-highlighter"),
        hide: this.shadow.querySelector(".wae-hide"),
        clear: this.shadow.querySelector(".wae-clear")
        ,
        captureSplit: this.shadow.querySelector(".wae-capture-split"),
        captureMainButton: this.shadow.querySelector(".wae-capture-main"),
        captureDropdownButton: this.shadow.querySelector(".wae-capture-dropdown"),
        capturePopover: this.shadow.querySelector(".wae-capture-popover")
        ,
        colorSVCanvas: this.shadow.querySelector('.wae-color-sv-canvas'),
        colorSVCursor: this.shadow.querySelector('.wae-color-sv-cursor'),
        hueCanvas: this.shadow.querySelector('.wae-hue-canvas'),
        hueCursor: this.shadow.querySelector('.wae-hue-cursor'),
        previewBox: this.shadow.querySelector('.wae-color-preview'),
        rInput: this.shadow.querySelector('.wae-r-input'),
        gInput: this.shadow.querySelector('.wae-g-input'),
        bInput: this.shadow.querySelector('.wae-b-input'),
        hexInput: this.shadow.querySelector('.wae-hex-input'),
        defaultColors: this.shadow.querySelectorAll('.wae-default-color'),
        customColorsList: this.shadow.querySelector(".wae-my-colors-list"),
        addCustomColorButton: this.shadow.querySelector(".wae-add-my-color")
      };
      this.bind();
      this.applyStoredPosition(savedPosition);
      this.update();
      window.requestAnimationFrame(() => this.syncCollapsedButtonToPenButton());
    }

    language() {
      return this.state && this.state.uiSettings && this.state.uiSettings.language === "en" ? "en" : "ko";
    }

    t(key) {
      const ko = {
        settings: "환경설정",
        close: "닫기",
        toolbarDirection: "도구막대 방향",
        horizontal: "가로",
        vertical: "세로",
        toolbarSize: "도구막대 크기",
        language: "언어",
        Korean: "한국어",
        English: "English",
        small: "작게",
        normal: "보통",
        large: "크게",
        pen: "펜",
        highlighter: "형광펜",
        select: "선택/이동",
        drawStart: "필기 시작",
        color: "색상 선택",
        width: "펜 굵기",
        text: "텍스트 입력",
        capture: "전체 화면 캡처",
        eraser: "지우개",
        navigate: "탐색 모드",
        collapse: "도구막대 접기",
        openTools: "필기 도구 열기",
        ballpoint: "볼펜",
        fountain: "만년필",
        brush: "붓펜"
      };
      const en = {
        settings: "Settings",
        close: "Close",
        toolbarDirection: "Toolbar direction",
        horizontal: "Horizontal",
        vertical: "Vertical",
        toolbarSize: "Toolbar size",
        language: "Language",
        Korean: "Korean",
        English: "English",
        small: "Small",
        normal: "Normal",
        large: "Large",
        pen: "Pen",
        highlighter: "Highlighter",
        select: "Select/move",
        drawStart: "Start drawing",
        color: "Choose color",
        width: "Pen width",
        text: "Text",
        capture: "Capture screen",
        eraser: "Eraser",
        navigate: "Navigate",
        collapse: "Collapse toolbar",
        openTools: "Open drawing tools",
        ballpoint: "Ballpoint",
        fountain: "Fountain pen",
        brush: "Brush"
      };
      const dictionary = this.language() === "en" ? en : ko;
      return dictionary[key] || ko[key] || key;
    }

    scaleLabel(scale) {
      const value = this.normalizeToolbarScale(scale);
      const label = value < 0.94 ? this.t("small") : (value < 1.12 ? this.t("normal") : this.t("large"));
      return `${label} ${Math.round(value * 100)}%`;
    }

    icon(type) {
      const common = 'viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
      if (type === "fountain") {
        return `<svg ${common}><path d="M12 3l7 7-6.2 10.1H7.2L5 17.9 15.1 7.8 12 3z"/><path d="M15.1 7.8L10 12.9"/><circle cx="9.2" cy="13.7" r="2"/></svg>`;
      }
      if (type === "brush") {
        return `<svg ${common}><path d="M16 3.8l4.2 4.2-7.8 7.8c-.9.9-2.1 1.3-3.3 1.1l-1.3-.2.2-1.3c.2-1.2.6-2.4 1.5-3.3L16 3.8z"/><path d="M5.8 17.2c-1.3.4-2.2 1-2.8 2.1 1.8.5 3.5.2 4.8-.7"/></svg>`;
      }
      if (type === "ballpoint") {
        return `<svg ${common}><path d="M4.8 19.2l3.9-1 9.8-9.8a2.2 2.2 0 0 0-3.1-3.1l-9.8 9.8-1 3.9z"/><path d="M13.8 6.8l3.4 3.4"/><path d="M6.2 15.1l2.7 2.7"/><path d="M4.6 20.4l4.1-1.1"/></svg>`;
      }
      if (type === "eraser") {
        return `<svg ${common}><path d="M4 15.5l8.8-8.8a2.1 2.1 0 0 1 3 0l3.5 3.5a2.1 2.1 0 0 1 0 3L13 19.5H8L4 15.5z"/><path d="M9.5 10l5 5"/><path d="M13 19.5h7"/><path d="M3 21h5"/></svg>`;
      }
      if (type === "eye") {
        return `<svg ${common}><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="3"/></svg>`;
      }
      if (type === "hand") {
        return `<svg ${common}><path d="M18 11.5V10a1.5 1.5 0 0 0-3 0v1"/><path d="M15 10.5V8.7a1.5 1.5 0 0 0-3 0v2.8"/><path d="M12 9.5V7.7a1.5 1.5 0 0 0-3 0v6.8"/><path d="M9 14.5l-1.1-1.1a1.7 1.7 0 0 0-2.4 2.4l3.4 3.4A6 6 0 0 0 13.1 21H15a4 4 0 0 0 4-4v-5.5a1.5 1.5 0 0 0-3 0V12"/></svg>`;
      }
      if (type === "settings") {
        return `<svg ${common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 2-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V20h-2.9v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1-2-2 .1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3.5v-2.9h.2a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2-2 .1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V4h2.9v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 2 2-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v2.9H21a1.7 1.7 0 0 0-1.6 1z"/></svg>`;
      }
      if (type === "highlighter") {
        return `<svg ${common}><path d="M5 19h8"/><path d="M7 15l8.8-8.8 2.1 2.1L9.1 17.1 7 15z"/><path d="M14.8 7.2l2 2"/></svg>`;
      }
      if (type === "panel-left") {
        return `<svg ${common}><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M9 5v14"/><path d="M15 9l-3 3 3 3"/></svg>`;
      }
      if (type === "panel-right") {
        return `<svg ${common}><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M15 5v14"/><path d="M9 9l3 3-3 3"/></svg>`;
      }
      if (type === "panel-up") {
        return `<svg ${common}><rect x="5" y="4" width="14" height="16" rx="2"/><path d="M5 9h14"/><path d="M9 15l3-3 3 3"/></svg>`;
      }
      if (type === "panel-down") {
        return `<svg ${common}><rect x="5" y="4" width="14" height="16" rx="2"/><path d="M5 15h14"/><path d="M9 9l3 3 3-3"/></svg>`;
      }
      if (type === "camera") {
        return `<svg ${common}><path d="M4.5 8.2h3l1.4-2h6.2l1.4 2h3a1.8 1.8 0 0 1 1.8 1.8v7.1a1.8 1.8 0 0 1-1.8 1.8h-15A1.8 1.8 0 0 1 2.7 17.1V10a1.8 1.8 0 0 1 1.8-1.8z"/><circle cx="12" cy="13.3" r="3.1"/><path d="M18 10.3h.1"/></svg>`;
      }
      if (type === "text") {
        return `<svg ${common}><path d="M5 5h14"/><path d="M12 5v14"/><path d="M9 19h6"/></svg>`;
      }
      if (type === "collapse-door") {
        return `<svg ${common}><path d="M5 4.5h8.5a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5z"/><path d="M9.5 4.5v15"/><path d="M15.5 12h4.2"/><path d="M17.8 9.8l2.2 2.2-2.2 2.2"/><path d="M7.6 12h.1"/></svg>`;
      }
      return `<svg ${common}><path d="M4 20l4.6-1.1L19.3 8.2a2.2 2.2 0 0 0-3.1-3.1L5.5 15.8 4 20z"/><path d="M14.8 6.5l2.7 2.7"/></svg>`;
    }

    template() {
      return [
        "<style>",
        ":host{all:initial}",
        ".wae-root{--toolbar-scale:1;--button-size:calc(34px * var(--toolbar-scale));--toggle-size:calc(38px * var(--toolbar-scale));--icon-size:calc(21px * var(--toolbar-scale));--toolbar-gap:calc(5px * var(--toolbar-scale));--toolbar-padding:calc(7px * var(--toolbar-scale));--toolbar-radius:calc(14px * var(--toolbar-scale));position:relative;display:inline-block;width:var(--wae-root-width,1px);height:var(--wae-root-height,1px);font-family:Arial,Helvetica,sans-serif;color:#e5e7eb;user-select:none}",
        "button,input{font-family:inherit}",
        ".wae-root svg{width:var(--icon-size);height:var(--icon-size)}",
        ".wae-root.wae-orientation-vertical{--icon-size:calc(24px * var(--toolbar-scale))}",
        ".wae-root.wae-orientation-vertical{--button-size:calc(40px * var(--toolbar-scale))}",
        ".wae-toggle svg{width:calc(23px * var(--toolbar-scale));height:calc(23px * var(--toolbar-scale))}",
        ".wae-toggle{position:absolute;left:var(--wae-collapsed-left,0px);top:var(--wae-collapsed-top,0px);width:var(--toggle-size);height:var(--toggle-size);border:0;border-radius:50%;background:rgba(17,24,39,.95);color:#fff;font-size:calc(17px * var(--toolbar-scale));font-weight:800;box-shadow:0 10px 24px rgba(0,0,0,.25);cursor:pointer;touch-action:none;z-index:2;transition:opacity 150ms ease,transform 150ms ease}",
        ".wae-toggle::after{content:'';position:absolute;right:calc(3px * var(--toolbar-scale));bottom:calc(3px * var(--toolbar-scale));width:calc(10px * var(--toolbar-scale));height:calc(10px * var(--toolbar-scale));border-radius:50%;background:var(--wae-active-color,#111111);border:2px solid rgba(255,255,255,.9);box-shadow:0 0 0 1px rgba(0,0,0,.24)}",
        ".wae-toggle::before{content:'';position:absolute;left:50%;bottom:calc(7px * var(--toolbar-scale));width:calc(17px * var(--toolbar-scale));height:var(--wae-active-width,3px);border-radius:999px;background:var(--wae-active-color,#111111);transform:translateX(-50%);box-shadow:0 0 0 1px rgba(255,255,255,.45)}",
        ".wae-quick-trigger{position:absolute;left:calc(var(--wae-collapsed-left,0px) + var(--toggle-size) - 15px);top:calc(var(--wae-collapsed-top,0px) + var(--toggle-size) - 15px);width:18px;height:18px;border:1px solid rgba(191,219,254,.7);border-radius:50%;background:rgba(15,23,42,.98);color:#dbeafe;display:grid;place-items:center;font-size:11px;line-height:1;box-shadow:0 6px 14px rgba(0,0,0,.28);cursor:pointer;z-index:3;opacity:1;transition:opacity 150ms ease,transform 150ms ease}",
        ".wae-quick-trigger:hover{background:#1e293b;color:#fff;transform:scale(1.06)}",
        ".wae-root.wae-open .wae-quick-trigger,.wae-root.wae-closing .wae-quick-trigger{opacity:0;pointer-events:none;transform:scale(.85)}",
        ".wae-menu{position:absolute;left:var(--wae-menu-left,0px);top:var(--wae-menu-top,0px);display:grid;grid-template-columns:1fr;gap:var(--toolbar-gap);padding:var(--toolbar-padding);border-radius:var(--toolbar-radius);background:rgba(17,24,39,.93);box-shadow:0 16px 38px rgba(0,0,0,.32);border:1px solid rgba(148,163,184,.22);max-width:calc(100vw - 16px);overflow:visible;opacity:0;visibility:hidden;pointer-events:none;transform:scale(.85);transform-origin:var(--wae-toolbar-origin,50% 50%);transition:opacity 160ms ease,transform 160ms ease,visibility 0s linear 160ms}",
        ".wae-root.wae-open .wae-menu{opacity:1;visibility:visible;pointer-events:auto;transform:scale(1);transition:opacity 160ms ease,transform 160ms ease}",
        ".wae-root.wae-closing .wae-menu{opacity:0;visibility:visible;pointer-events:none;transform:scale(.85);transition:opacity 160ms ease,transform 160ms ease}",
        ".wae-root.wae-open .wae-toggle,.wae-root.wae-closing .wae-toggle{opacity:0;pointer-events:none;transform:scale(.85)}",
        ".wae-drag-handle{height:calc(10px * var(--toolbar-scale));border:0;background:transparent;cursor:grab;touch-action:none;position:relative}",
        ".wae-drag-handle::before{content:'';position:absolute;left:50%;top:calc(3px * var(--toolbar-scale));width:calc(40px * var(--toolbar-scale));height:calc(4px * var(--toolbar-scale));border-radius:999px;background:#64748b;transform:translateX(-50%)}",
        ".wae-resize-handle{position:absolute;right:0;bottom:0;width:calc(18px * var(--toolbar-scale));height:calc(18px * var(--toolbar-scale));border:0;background:transparent;cursor:nwse-resize;touch-action:none;z-index:3}",
        ".wae-resize-handle::before{content:'';position:absolute;right:calc(4px * var(--toolbar-scale));bottom:calc(4px * var(--toolbar-scale));width:calc(9px * var(--toolbar-scale));height:calc(9px * var(--toolbar-scale));border-right:2px solid rgba(203,213,225,.75);border-bottom:2px solid rgba(203,213,225,.75);opacity:.8}",
        ".wae-bar{display:flex;align-items:center;gap:var(--toolbar-gap);white-space:nowrap}",
        ".wae-root.wae-size-small .wae-bar{gap:calc(4px * var(--toolbar-scale))}",
        ".wae-root.wae-size-large .wae-bar{gap:calc(6px * var(--toolbar-scale))}",
        ".wae-root.expand-left .wae-bar{flex-direction:row-reverse}",
        ".wae-root.expand-right .wae-bar{flex-direction:row}",
        ".wae-root.wae-orientation-vertical .wae-bar{flex-direction:column}",
        ".wae-root.wae-orientation-vertical .wae-menu{padding:calc(6px * var(--toolbar-scale));border-radius:calc(13px * var(--toolbar-scale))}",
        ".wae-root.wae-orientation-vertical .wae-drag-handle{width:var(--button-size);height:calc(10px * var(--toolbar-scale));justify-self:center}",
        ".wae-root.expand-up .wae-menu{grid-template-areas:'bar' 'handle'}",
        ".wae-root.expand-up .wae-drag-handle{grid-area:handle}",
        ".wae-root.expand-up .wae-bar{grid-area:bar}",
        ".wae-icon-btn,.wae-pen-split,.wae-text-split,.wae-capture-split,.wae-eraser-split,.wae-color-button,.wae-width-button,.wae-select,.wae-navigation,.wae-collapse{box-sizing:border-box;height:var(--button-size);border:1px solid rgba(148,163,184,.18);border-radius:calc(10px * var(--toolbar-scale));background:rgba(255,255,255,.08);color:#f8fafc;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}",
        ".wae-icon-btn,.wae-color-button,.wae-width-button,.wae-select,.wae-navigation,.wae-collapse{width:var(--button-size)}",
        ".wae-icon-btn{font-size:calc(20px * var(--toolbar-scale));line-height:1}",
        ".wae-icon-btn:disabled{opacity:.34;cursor:default;filter:saturate(.5)}",
        ".wae-undo-redo{display:inline-flex;gap:calc(4px * var(--toolbar-scale))}",
        ".wae-root.wae-orientation-vertical .wae-undo-redo{display:grid;grid-template-columns:1fr;width:var(--button-size);gap:calc(4px * var(--toolbar-scale))}",
        ".wae-root.wae-orientation-vertical .wae-undo-redo .wae-icon-btn{width:var(--button-size);height:calc(28px * var(--toolbar-scale));border-radius:calc(7px * var(--toolbar-scale))}",
        ".wae-pen-split{min-width:calc(60px * var(--toolbar-scale));padding:0;overflow:hidden;background:rgba(255,255,255,.08)}",
        ".wae-text-split,.wae-capture-split,.wae-eraser-split{min-width:calc(56px * var(--toolbar-scale));padding:0;overflow:hidden;background:rgba(255,255,255,.08)}",
        ".wae-root.wae-orientation-vertical .wae-pen-split,.wae-root.wae-orientation-vertical .wae-text-split,.wae-root.wae-orientation-vertical .wae-capture-split,.wae-root.wae-orientation-vertical .wae-eraser-split{min-width:0;width:var(--button-size);height:var(--button-size);border-radius:calc(9px * var(--toolbar-scale))}",
        ".wae-pen-main,.wae-pen-dropdown,.wae-text-main,.wae-text-dropdown,.wae-capture-main,.wae-capture-dropdown,.wae-eraser-main,.wae-eraser-dropdown{height:100%;border:0;background:transparent;color:inherit;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}",
        ".wae-pen-main{width:calc(39px * var(--toolbar-scale))}",
        ".wae-text-main,.wae-capture-main,.wae-eraser-main{width:calc(35px * var(--toolbar-scale))}",
        ".wae-pen-dropdown{width:calc(20px * var(--toolbar-scale));border-left:1px solid rgba(148,163,184,.24);font-size:calc(10px * var(--toolbar-scale));color:#bfdbfe}",
        ".wae-text-dropdown,.wae-capture-dropdown{width:calc(19px * var(--toolbar-scale));border-left:1px solid rgba(148,163,184,.24);font-size:calc(10px * var(--toolbar-scale));color:#bfdbfe}",
        ".wae-eraser-dropdown{width:calc(19px * var(--toolbar-scale));border-left:1px solid rgba(148,163,184,.24);font-size:calc(10px * var(--toolbar-scale));color:#fecaca}",
        ".wae-root.wae-orientation-vertical .wae-pen-main,.wae-root.wae-orientation-vertical .wae-text-main,.wae-root.wae-orientation-vertical .wae-capture-main,.wae-root.wae-orientation-vertical .wae-eraser-main{width:calc(var(--button-size) - 10px)}",
        ".wae-root.wae-orientation-vertical .wae-pen-dropdown,.wae-root.wae-orientation-vertical .wae-text-dropdown,.wae-root.wae-orientation-vertical .wae-capture-dropdown,.wae-root.wae-orientation-vertical .wae-eraser-dropdown{width:10px;border-left:1px solid rgba(148,163,184,.18);font-size:calc(9px * var(--toolbar-scale))}",
        ".wae-pen-main:hover,.wae-pen-dropdown:hover,.wae-text-main:hover,.wae-text-dropdown:hover,.wae-capture-main:hover,.wae-capture-dropdown:hover,.wae-eraser-main:hover,.wae-eraser-dropdown:hover{background:rgba(255,255,255,.08)}",
        ".wae-active{border-color:#60a5fa!important;background:rgba(59,130,246,.34)!important;box-shadow:0 0 0 1px rgba(96,165,250,.48) inset}",
        ".wae-collapse{margin-left:calc(7px * var(--toolbar-scale));border-color:rgba(148,163,184,.30)!important;background:linear-gradient(180deg, rgba(30,41,59,.96), rgba(15,23,42,.96));color:#dbeafe;position:relative;border-radius:calc(10px * var(--toolbar-scale));box-shadow:none!important}",
        ".wae-collapse::before{content:'';position:absolute;left:calc(-5px * var(--toolbar-scale));top:18%;width:1px;height:64%;background:rgba(148,163,184,.35)}",
        ".wae-root.wae-orientation-vertical .wae-collapse{margin-left:0;margin-top:calc(7px * var(--toolbar-scale))}",
        ".wae-root.wae-orientation-vertical .wae-collapse::before{left:18%;top:calc(-5px * var(--toolbar-scale));width:64%;height:1px}",
        ".wae-collapse:hover{background:linear-gradient(180deg, rgba(51,65,85,.98), rgba(17,24,39,.98))!important;border-color:rgba(191,219,254,.52)!important;color:#eff6ff}",
        ".wae-collapse:active{transform:translateY(1px)}",
        ".wae-popover,.wae-settings-panel{position:fixed;left:0;top:0;right:auto;bottom:auto;box-sizing:border-box;border:1px solid rgba(148,163,184,.22);background:rgba(15,23,42,.98);box-shadow:0 14px 34px rgba(0,0,0,.35);z-index:2147483647;opacity:0;pointer-events:none;transform:translate(var(--wae-popover-shift-x,0),var(--wae-popover-shift-y,4px)) scale(.95);transition:opacity 150ms ease,transform 150ms ease;transform-origin:var(--wae-origin,left top)}",
        ".wae-popover.wae-mounted{display:grid;gap:4px}",
        ".wae-settings-panel.wae-mounted{display:block}",
        ".wae-popover.wae-open,.wae-settings-panel.wae-open{opacity:1;pointer-events:auto;transform:translate(0,0) scale(1)}",
        ".wae-popover.wae-closing,.wae-settings-panel.wae-closing{opacity:0;pointer-events:none;transform:translate(var(--wae-close-shift-x,0),var(--wae-close-shift-y,4px)) scale(.85)}",
        ".wae-popover:not(.wae-mounted),.wae-settings-panel:not(.wae-mounted){display:none}",
        ".wae-quick-popover{width:184px;padding:8px;border-radius:12px}",
        ".wae-quick-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:7px;color:#e5e7eb;font-size:11px;font-weight:800}",
        ".wae-quick-preview{display:flex;align-items:center;gap:7px;color:#cbd5e1;font-size:11px;font-weight:700}",
        ".wae-quick-dot{width:14px;height:14px;border-radius:50%;border:1px solid rgba(255,255,255,.52);background:var(--wae-active-color,#111111)}",
        ".wae-quick-line{width:32px;height:var(--wae-active-width,3px);border-radius:999px;background:#f8fafc}",
        ".wae-quick-tools{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-bottom:8px}",
        ".wae-quick-tool{height:30px;border:1px solid rgba(148,163,184,.22);border-radius:8px;background:rgba(255,255,255,.08);color:#f8fafc;display:grid;place-items:center;cursor:pointer}",
        ".wae-quick-tool svg{width:18px;height:18px}",
        ".wae-quick-tool:hover,.wae-quick-width:hover{background:rgba(255,255,255,.14)}",
        ".wae-quick-tool.wae-active,.wae-quick-width.wae-active{border-color:#60a5fa;background:rgba(59,130,246,.30)}",
        ".wae-quick-colors{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-bottom:8px}",
        ".wae-quick-color{position:relative;width:22px;height:22px;border:1px solid rgba(148,163,184,.42);border-radius:50%;cursor:pointer;padding:0}",
        ".wae-quick-color.wae-active{box-shadow:0 0 0 2px #38bdf8,0 0 0 4px rgba(56,189,248,.18)}",
        ".wae-quick-widths{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}",
        ".wae-quick-width{height:28px;border:1px solid rgba(148,163,184,.22);border-radius:8px;background:rgba(255,255,255,.08);display:grid;place-items:center;cursor:pointer}",
        ".wae-quick-width span{width:26px;border-radius:999px;background:#f8fafc}",
        ".wae-pen-popover{min-width:166px;padding:6px;border-radius:12px}",
        ".wae-eraser-popover{min-width:132px;padding:6px;border-radius:12px}",
        ".wae-list-item{height:32px;border:0;border-radius:9px;background:transparent;color:#e5e7eb;display:flex;align-items:center;gap:8px;padding:0 8px;cursor:pointer;text-align:left;font-size:12px;font-weight:700}",
        ".wae-list-item:hover{background:rgba(255,255,255,.08)}",
        ".wae-list-item.wae-active{background:rgba(59,130,246,.28)!important}",
        ".wae-list-item svg{width:19px;height:19px}",
        ".wae-pen-separator{height:1px;background:rgba(148,163,184,.22);margin:5px 4px}",
        ".wae-danger-item{height:32px;border:0;border-radius:9px;background:rgba(248,113,113,.10);color:#fecaca;display:flex;align-items:center;gap:8px;padding:0 9px;cursor:pointer;text-align:left;font-size:12px;font-weight:800}",
        ".wae-danger-item:hover{background:rgba(248,113,113,.20);color:#fee2e2}",
        ".wae-eraser-preview-row{display:flex;align-items:center;gap:9px;padding:4px 6px 8px;color:#cbd5e1;font-size:12px;font-weight:800}",
        ".wae-eraser-size-circle{width:32px;height:32px;border:2px solid rgba(248,113,113,.78);background:rgba(248,113,113,.08);border-radius:50%;box-sizing:border-box;flex:0 0 auto}",
        ".wae-eraser-size-presets{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-bottom:7px}",
        ".wae-eraser-size-choice{height:28px;border:1px solid rgba(148,163,184,.20);border-radius:8px;background:rgba(255,255,255,.08);color:#e5e7eb;font-size:11px;font-weight:800;cursor:pointer}",
        ".wae-eraser-size-choice.wae-active{border-color:#60a5fa;background:rgba(59,130,246,.28)}",
        ".wae-eraser-custom{border-top:1px solid rgba(148,163,184,.20);border-bottom:1px solid rgba(148,163,184,.20);padding:8px 2px;margin-bottom:6px;color:#cbd5e1;font-size:12px;font-weight:800}",
        ".wae-eraser-custom-head{display:flex;justify-content:space-between;margin-bottom:5px}",
        ".wae-eraser-size-slider{width:100%;accent-color:#f87171;touch-action:none;user-select:none;cursor:pointer;pointer-events:auto}",
        ".wae-clear-confirm{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(15,23,42,.24);z-index:2147483647}",
        ".wae-clear-confirm.wae-open{display:flex}",
        ".wae-clear-dialog{width:min(280px,calc(100vw - 32px));border:1px solid rgba(248,113,113,.28);border-radius:14px;background:rgba(15,23,42,.98);box-shadow:0 18px 42px rgba(0,0,0,.38);padding:14px;color:#e5e7eb}",
        ".wae-clear-message{margin:0 0 12px;font-size:13px;font-weight:800;line-height:1.45}",
        ".wae-clear-actions{display:flex;justify-content:flex-end;gap:8px}",
        ".wae-clear-actions button{height:30px;border:0;border-radius:9px;padding:0 11px;font-size:12px;font-weight:800;cursor:pointer}",
        ".wae-clear-cancel{background:rgba(255,255,255,.08);color:#e5e7eb}",
        ".wae-clear-confirm-button{background:rgba(239,68,68,.88);color:#fff}",
        ".wae-color-button{border-radius:50%}",
        ".wae-root.wae-orientation-vertical .wae-color-button{border-radius:calc(9px * var(--toolbar-scale))}",
        ".wae-current-color{width:calc(18px * var(--toolbar-scale));height:calc(18px * var(--toolbar-scale));border-radius:50%;border:1px solid rgba(255,255,255,.45);box-shadow:0 0 0 1px rgba(0,0,0,.18)}",
        ".wae-root.wae-orientation-vertical .wae-current-color{width:calc(16px * var(--toolbar-scale));height:calc(16px * var(--toolbar-scale))}",
        ".wae-width-preview{width:calc(22px * var(--toolbar-scale));height:calc(18px * var(--toolbar-scale));display:flex;align-items:center;justify-content:center}",
        ".wae-root.wae-orientation-vertical .wae-width-preview{width:calc(18px * var(--toolbar-scale));height:calc(16px * var(--toolbar-scale))}",
        ".wae-width-preview span,.wae-width-line{display:block;width:calc(21px * var(--toolbar-scale));border-radius:999px;background:#f8fafc}",
        ".wae-root.wae-orientation-vertical .wae-width-preview span{width:calc(18px * var(--toolbar-scale))}",
        ".wae-color-popover{min-width:240px;min-height:260px;max-width:calc(100vw - 16px);max-height:calc(100vh - 16px);overflow:auto;display:grid;gap:8px;padding:8px;border-radius:12px;background:transparent}",
        ".wae-color-popover.wae-mounted{display:block!important;width:min(272px,calc(100vw - 16px));min-height:300px;max-height:calc(100vh - 16px);overflow:auto;padding:10px;border-radius:12px;background:rgba(15,23,42,.98)}",
        ".wae-color-panel{box-sizing:border-box;display:grid;gap:9px;width:100%;min-height:280px}",
        ".wae-color-sv{position:relative;width:100%;height:148px;border-radius:8px;overflow:hidden;touch-action:none;cursor:crosshair;background:#f00}",
        ".wae-color-sv-canvas,.wae-hue-canvas{display:block;width:100%;height:100%}",
        ".wae-hue-bar{position:relative;width:100%;height:18px;border-radius:999px;overflow:hidden;touch-action:none;cursor:pointer}",
        ".wae-color-input{box-sizing:border-box;width:100%;min-width:0;padding:6px;border-radius:7px;background:rgba(255,255,255,.06);color:#fff;border:1px solid rgba(255,255,255,.12);font-size:12px}",
        ".wae-default-color{position:relative;width:28px;height:28px;border-radius:6px;border:1px solid rgba(148,163,184,.35);cursor:pointer}",
        ".wae-default-color.wae-active,.wae-my-color.wae-active,.wae-color-chip.wae-active{box-shadow:0 0 0 2px #38bdf8,0 0 0 4px rgba(56,189,248,.18)}",
        ".wae-my-color-head{display:flex;align-items:center;justify-content:space-between;gap:8px;color:#cbd5e1;font-size:11px;font-weight:800}",
        ".wae-add-my-color{height:26px;border:1px solid rgba(148,163,184,.25);border-radius:8px;background:rgba(255,255,255,.08);color:#e5e7eb;font-size:11px;font-weight:800;cursor:pointer;padding:0 8px}",
        ".wae-my-colors-list{display:flex;flex-wrap:wrap;gap:6px;min-height:24px}",
        ".wae-my-color{position:relative;width:24px;height:24px;border-radius:50%;border:1px solid rgba(148,163,184,.45);cursor:pointer;padding:0}",
        ".wae-my-color-delete{position:absolute;right:-5px;top:-5px;width:15px;height:15px;border:0;border-radius:50%;background:#0f172a;color:#fff;font-size:11px;line-height:15px;padding:0;display:none;cursor:pointer}",
        ".wae-my-color:hover .wae-my-color-delete{display:block}",
        ".wae-color-chip,.wae-custom-color{position:relative;width:22px;height:22px;border-radius:50%;border:1px solid rgba(148,163,184,.35);cursor:pointer;background:transparent}",
        ".wae-color-chip.wae-active::after,.wae-my-color.wae-active::after,.wae-default-color.wae-active::after,.wae-width-choice.wae-active::after{content:'✓';position:absolute;right:-4px;bottom:-4px;width:13px;height:13px;border-radius:50%;background:#38bdf8;color:#fff;font-size:9px;line-height:13px;text-align:center;font-weight:800}",
        ".wae-custom-color{display:grid;place-items:center;color:#fff;font-size:14px;font-weight:800;background:linear-gradient(135deg,#ef4444,#facc15,#22c55e,#2563eb,#a855f7)}",
        ".wae-width-popover{width:174px;padding:8px;border-radius:12px}",
        ".wae-width-choice{position:relative;height:32px;border:0;border-radius:9px;background:transparent;color:#e5e7eb;display:grid;grid-template-columns:52px 1fr;align-items:center;gap:7px;padding:0 8px;cursor:pointer;text-align:left;font-size:12px;font-weight:700}",
        ".wae-width-choice:hover{background:rgba(255,255,255,.08)}",
        ".wae-width-choice.wae-active{background:rgba(59,130,246,.28)!important}",
        ".wae-width-custom{border-top:1px solid rgba(148,163,184,.20);margin-top:6px;padding-top:8px;color:#cbd5e1;font-size:12px;font-weight:700}",
        ".wae-width-custom-head{display:flex;justify-content:space-between;margin-bottom:5px}",
        ".wae-width-custom-slider{width:100%;accent-color:#38bdf8;touch-action:none;user-select:none;cursor:pointer;pointer-events:auto}",
        ".wae-settings-panel{width:min(292px,calc(100vw - 16px));max-height:70vh;overflow:auto;padding:10px;border-radius:14px;background:rgba(17,24,39,.98)}",
        ".wae-settings-head{display:flex;align-items:center;gap:8px;margin-bottom:8px}",
        ".wae-settings-pen-icon{width:28px;height:28px;border-radius:9px;background:rgba(59,130,246,.20);display:grid;place-items:center;color:#dbeafe}",
        ".wae-settings-title{flex:1;font-size:13px;font-weight:800;color:#f8fafc}",
        ".wae-settings-close{width:26px;height:26px;border:0;border-radius:8px;background:rgba(255,255,255,.08);color:#e5e7eb;font-size:16px;cursor:pointer}",
        ".wae-preview{height:42px;border-radius:10px;background:rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;margin-bottom:8px}",
        ".wae-preview-line{width:210px;height:28px}",
        ".wae-section{margin-top:8px}",
        ".wae-label{display:flex;justify-content:space-between;align-items:center;color:#cbd5e1;font-size:11px;font-weight:700;margin-bottom:4px}",
        ".wae-slider{width:100%;accent-color:#38bdf8}",
        ".wae-compact-row{display:flex;gap:5px;align-items:center;flex-wrap:wrap}",
        ".wae-width-chip,.wae-round-chip{height:26px;border:1px solid rgba(148,163,184,.20);border-radius:8px;background:rgba(255,255,255,.08);color:#e5e7eb;cursor:pointer;font-size:11px;font-weight:700}",
        ".wae-width-chip{width:34px;display:grid;place-items:center}",
        ".wae-width-chip span{width:18px;border-radius:999px;background:#f8fafc}",
        ".wae-round-chip{padding:0 8px}",
        ".wae-tool-mini{height:28px;border:1px solid rgba(148,163,184,.20);border-radius:9px;background:rgba(255,255,255,.08);color:#e5e7eb;display:inline-flex;align-items:center;gap:5px;padding:0 8px;cursor:pointer;font-size:11px;font-weight:700}",
        "</style>",
        '<div class="wae-root">',
        '  <button class="wae-toggle" title="필기 도구 열기" aria-label="필기 도구 열기"></button>',
        '  <button class="wae-quick-trigger" type="button" title="Quick change" aria-label="Quick change">+</button>',
        '  <div class="wae-menu">',
        '    <button class="wae-drag-handle" title="도구막대 이동" aria-label="도구막대 이동"></button>',
        '    <div class="wae-bar">',
        '      <span class="wae-undo-redo"><button class="wae-icon-btn wae-undo" title="실행 취소" aria-label="실행 취소">&#8630;</button><button class="wae-icon-btn wae-redo" title="다시 실행" aria-label="다시 실행">&#8631;</button></span>',
        '      <span class="wae-pen-split" role="group" aria-label="펜 도구"><button class="wae-pen-main" title="필기 시작" aria-label="필기 시작"><span class="wae-pen-icon"></span></button><button class="wae-pen-dropdown" title="펜 종류 선택" aria-label="펜 종류 선택">▼</button></span>',
        '      <button class="wae-color-button" title="색상 선택" aria-label="색상 선택"><span class="wae-current-color"></span></button>',
        '      <button class="wae-width-button" title="펜 굵기" aria-label="펜 굵기"><span class="wae-width-preview"><span></span></span></button>',
        '      <span class="wae-text-split" role="group" aria-label="텍스트 도구"><button class="wae-text-main" title="텍스트 입력" aria-label="텍스트 입력">' + this.icon("text") + '</button><button class="wae-text-dropdown" title="텍스트 설정" aria-label="텍스트 설정">▼</button></span>',
        '      <span class="wae-capture-split" role="group" aria-label="화면 캡처 도구"><button class="wae-capture-main" title="전체 화면 캡처" aria-label="전체 화면 캡처">' + this.icon("camera") + '</button><button class="wae-capture-dropdown" title="캡처 메뉴" aria-label="캡처 메뉴">▼</button></span>',
        '      <span class="wae-eraser-split" role="group" aria-label="지우개 도구"><button class="wae-eraser-main" title="지우개" aria-label="지우개">' + this.icon("eraser") + '</button><button class="wae-eraser-dropdown" title="지우개 메뉴" aria-label="지우개 메뉴">▼</button></span>',
        '      <button class="wae-select" title="선택/이동" aria-label="선택/이동">' + this.icon("hand") + "</button>",
        '      <button class="wae-navigation" title="탐색 모드" aria-label="탐색 모드">' + this.icon("eye") + "</button>",
        '      <button class="wae-collapse" title="도구막대 접기" aria-label="도구막대 접기">' + this.icon("collapse-door") + '</button>',
        "    </div>",
        '    <div class="wae-resize-handle" title="도구막대 크기 조절" aria-hidden="true"></div>',
          "  </div>",
        '  <div class="wae-popover wae-pen-popover" data-popover="pen"></div>',
        '  <div class="wae-popover wae-quick-popover" data-popover="quick"></div>',
        '  <div class="wae-popover wae-color-popover" data-popover="color">',
        '    <div class="wae-color-panel">',
        '      <div>',
        '        <div class="wae-color-sv">',
        '          <canvas class="wae-color-sv-canvas" width="252" height="148"></canvas>',
        '          <div class="wae-color-sv-cursor" style="position:absolute;width:14px;height:14px;border-radius:50%;box-shadow:0 0 0 2px rgba(0,0,0,0.6),0 0 6px rgba(255,255,255,0.6);transform:translate(-7px,-7px);pointer-events:none"></div>',
        '        </div>',
        '      </div>',
        '      <div class="wae-hue-bar">',
        '        <canvas class="wae-hue-canvas" width="252" height="18"></canvas>',
        '        <div class="wae-hue-cursor" style="position:absolute;top:50%;transform:translate(-5px,-50%);width:10px;height:24px;border-radius:999px;background:#fff;box-shadow:0 0 0 1px rgba(0,0,0,0.45),0 2px 8px rgba(0,0,0,0.4);pointer-events:none"></div>',
        '      </div>',
        '      <div style="display:flex;align-items:center;gap:10px">',
        '        <div class="wae-color-preview" style="width:40px;height:40px;border-radius:8px;border:1px solid rgba(255,255,255,0.08)"></div>',
        '        <div style="flex:1;display:grid;grid-template-columns:repeat(3,1fr);gap:6px">',
        '          <input class="wae-r-input wae-color-input" type="number" min="0" max="255" placeholder="R">',
        '          <input class="wae-g-input wae-color-input" type="number" min="0" max="255" placeholder="G">',
        '          <input class="wae-b-input wae-color-input" type="number" min="0" max="255" placeholder="B">',
        '        </div>',
        '      </div>',
        '      <div style="display:flex;gap:8px;align-items:center">',
        '        <input class="wae-hex-input wae-color-input" type="text" maxlength="7" placeholder="#RRGGBB" style="flex:1">',
        '        <div style="display:flex;gap:6px">',
        '          <button class="wae-default-color" data-color="#000000" style="background:#000"></button>',
        '          <button class="wae-default-color" data-color="#ffffff" style="background:#fff"></button>',
        '          <button class="wae-default-color" data-color="#ff0000" style="background:#f00"></button>',
        '          <button class="wae-default-color" data-color="#0000ff" style="background:#00f"></button>',
        '          <button class="wae-default-color" data-color="#00ff00" style="background:#0f0"></button>',
        '          <button class="wae-default-color" data-color="#ffff00" style="background:#ff0"></button>',
        '        </div>',
        '      </div>',
        '      <div>',
        '        <div class="wae-my-color-head"><span>내 색상</span><button class="wae-add-my-color" type="button">＋ 내 색상에 추가</button></div>',
        '        <div class="wae-my-colors-list"></div>',
        '      </div>',
        '    </div>',
        '  </div>',
        '  <div class="wae-popover wae-width-popover" data-popover="width"></div>',
        '  <div class="wae-popover wae-text-popover" data-popover="text"></div>',
            '  <div class="wae-popover wae-capture-popover" data-popover="capture"><div style="display:grid;gap:6px;min-width:140px;padding:6px;border-radius:10px"><button class="wae-list-item" data-capture-option="full">전체 화면 캡처</button><button class="wae-list-item" data-capture-option="selection">선택 영역 캡처</button></div></div>',
        '  <div class="wae-popover wae-eraser-popover" data-popover="eraser"></div>',
        '  <div class="wae-clear-confirm" role="dialog" aria-modal="true" aria-label="전체 지우기 확인"><div class="wae-clear-dialog"><p class="wae-clear-message">현재 페이지의 모든 필기와 텍스트를 지울까요?</p><div class="wae-clear-actions"><button class="wae-clear-cancel" type="button">취소</button><button class="wae-clear-confirm-button" type="button">전체 지우기</button></div></div></div>',
        '  <div class="wae-settings-panel" data-popover="settings">',
        '    <div class="wae-settings-head"><span class="wae-settings-pen-icon"></span><div class="wae-settings-title"></div><button class="wae-settings-close" title="닫기">×</button></div>',
        '    <div class="wae-preview"><svg class="wae-preview-line" viewBox="0 0 210 28"><path d="M8 19 C 45 3, 73 25, 111 12 S 169 7, 202 17" fill="none"/></svg></div>',
        '    <div class="wae-section"><div class="wae-label"><span>굵기</span><strong data-value-for="width"></strong></div><input class="wae-slider" data-setting="width" type="range" min="1" max="30" step="1"></div>',
        '    <div class="wae-section"><div class="wae-label"><span>투명도</span><strong data-value-for="opacity"></strong></div><input class="wae-slider" data-setting="opacity" type="range" min="5" max="100" step="1"></div>',
        '    <div class="wae-section"><div class="wae-label"><span>압력 반응</span><strong data-value-for="pressureSensitivity"></strong></div><input class="wae-slider" data-setting="pressureSensitivity" type="range" min="0" max="100" step="1"></div>',
        '    <div class="wae-section"><div class="wae-label"><span>선 끝</span><strong class="wae-roundness-text"></strong></div><div class="wae-compact-row"><button class="wae-round-chip" data-roundness="0.15">각짐</button><button class="wae-round-chip" data-roundness="0.55">중간</button><button class="wae-round-chip" data-roundness="1">둥글게</button></div></div>',
        '    <div class="wae-section"><div class="wae-label"><span>색상</span></div><div class="wae-compact-row wae-settings-color-row"></div></div>',
        '    <div class="wae-section"><div class="wae-label"><span>빠른 굵기</span></div><div class="wae-compact-row">' + WAE.CONFIG.widths.map((width) => `<button class="wae-width-chip" data-width="${width.value}" title="${width.label}"><span style="height:${Math.max(2, width.value)}px"></span></button>`).join("") + "</div></div>",
        '    <div class="wae-section"><div class="wae-label"><span>보조 도구</span></div><div class="wae-compact-row"><button class="wae-tool-mini wae-highlighter" title="형광펜">' + this.icon("highlighter") + '형광펜</button><button class="wae-tool-mini wae-hide" title="필기 숨기기">Hide</button><button class="wae-tool-mini wae-clear" title="전체 지우기">Clear</button></div></div>',
        "  </div>",
        "</div>"
      ].join("");
    }

    bind() {
      this.refs.toggle.addEventListener("pointerdown", (event) => this.startDrag(event));
      this.refs.dragHandle.addEventListener("pointerdown", (event) => this.startDrag(event));
      if (this.refs.resizeHandle) {
        this.refs.resizeHandle.addEventListener("pointerdown", (event) => this.startResize(event));
      }
      this.refs.toggle.addEventListener("click", (event) => {
        if (this.dragged) {
          event.preventDefault();
          this.dragged = false;
          return;
        }
        if (this.state.menuOpen) {
          this.closeToolbar();
        } else {
          this.openToolbar();
        }
      });
      this.refs.toggle.addEventListener("contextmenu", (event) => {
        if (this.state.menuOpen) return;
        event.preventDefault();
        event.stopPropagation();
        this.togglePopover("quick", this.refs.quickTrigger || this.refs.toggle);
      });
      this.refs.quickTrigger.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
      });
      this.refs.quickTrigger.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.togglePopover("quick", this.refs.quickTrigger);
      });
      this.refs.penMainButton.addEventListener("click", (event) => {
        event.stopPropagation();
        this.closeAllPopovers();
        this.handlers.onTool("pen");
        this.update();
      });
      this.refs.penDropdownButton.addEventListener("click", (event) => {
        event.stopPropagation();
        this.togglePopover("pen", this.refs.penButton);
      });
      this.refs.captureMainButton && this.refs.captureMainButton.addEventListener("click", (event) => {
        event.stopPropagation();
        this.closeAllPopovers();
        if (this.handlers.onCaptureMain) this.handlers.onCaptureMain();
      });
      this.refs.captureDropdownButton && this.refs.captureDropdownButton.addEventListener("click", (event) => {
        event.stopPropagation();
        this.togglePopover("capture", this.refs.captureDropdownButton);
      });
      this.refs.colorButton.addEventListener("click", (event) => {
        event.stopPropagation();
        this.colorTarget = "penColor";
        this.colorPickerTarget = "penColor";
        this.togglePopover("color", this.refs.colorButton);
      });
      this.refs.widthButton.addEventListener("click", (event) => {
        event.stopPropagation();
        this.handlers.onTool("pen");
        this.togglePopover("width", this.refs.widthButton);
      });
      this.refs.textMainButton.addEventListener("click", (event) => {
        event.stopPropagation();
        this.closeAllPopovers();
        this.handlers.onTool("text");
        this.update();
      });
      this.refs.textDropdownButton.addEventListener("click", (event) => {
        event.stopPropagation();
        this.togglePopover("text", this.refs.textDropdownButton);
      });
      // initialize color canvas draw
      try {
        if (this.refs.hueCanvas && this.refs.colorSVCanvas) {
          this._initColorPopover();
        }
      } catch (e) {}
      this.refs.settingsClose.addEventListener("click", () => this.closePopover("settings"));
      this.refs.undo.addEventListener("click", this.handlers.onUndo);
      this.refs.redo.addEventListener("click", this.handlers.onRedo);
      this.refs.eraserMainButton.addEventListener("click", (event) => {
        event.stopPropagation();
        this.closeAllPopovers();
        this.handlers.onTool("eraser");
      });
      this.refs.eraserDropdownButton.addEventListener("click", (event) => {
        event.stopPropagation();
        this.togglePopover("eraser", this.refs.eraserDropdownButton);
      });
      this.refs.select.addEventListener("click", () => {
        this.closeAllPopovers();
        this.handlers.onTool("select");
      });
      this.refs.navigation.addEventListener("click", () => {
        this.closeAllPopovers();
        this.handlers.onMode();
      });
      this.refs.collapse.addEventListener("click", (event) => {
        event.stopPropagation();
        this.closeToolbar();
      });
      this.refs.sliders.forEach((input) => {
        this.bindNativeRangeSlider(input, {
          onInput: () => this.onSlider(input),
          onChange: () => this.onSlider(input)
        });
      });
      this.refs.roundnessChoices.forEach((button) => button.addEventListener("click", () => this.updateCurrentPen({ roundness: Number(button.dataset.roundness) })));
      this.refs.widths.forEach((button) => button.addEventListener("click", () => this.selectWidth(Number(button.dataset.width), false)));
      this.refs.highlighter.addEventListener("click", () => {
        this.closeAllPopovers();
        this.handlers.onTool("highlighter");
      });
      this.refs.hide.addEventListener("click", this.handlers.onHide);
      this.refs.clear.addEventListener("click", () => this.confirmClearAll());
      this.refs.clearCancel.addEventListener("click", () => this.hideClearConfirm());
      this.refs.clearConfirm.addEventListener("pointerdown", (event) => {
        if (event.target === this.refs.clearConfirm) {
          this.hideClearConfirm();
        }
      });
      this.refs.clearConfirmButton.addEventListener("click", () => {
        this.hideClearConfirm();
        this.handlers.onClear(true);
        this.update();
      });
      this.shadow.addEventListener("click", (event) => {
        if (this.refs.colorPopover && event.composedPath && event.composedPath().includes(this.refs.colorPopover)) {
          return;
        }
        const pen = event.target.closest("[data-pen-type]");
        const penTool = event.target.closest("[data-pen-tool]");
        const color = event.target.closest("[data-color]");
        const custom = event.target.closest("[data-custom-color]");
        const width = event.target.closest("[data-width-choice]");
        const eraserSize = event.target.closest("[data-eraser-size]");
        const textSetting = event.target.closest("[data-text-setting]");
        const textColor = event.target.closest("[data-text-color-target]");
        const clearAll = event.target.closest("[data-clear-all]");
        const quickTool = event.target.closest("[data-quick-tool]");
        const quickColor = event.target.closest("[data-quick-color]");
        const quickWidth = event.target.closest("[data-quick-width]");
        if (pen) this.selectPenType(pen.dataset.penType);
        if (penTool) this.selectPenTool(penTool.dataset.penTool);
        if (color) this.selectColor(color.dataset.color);
        if (custom) this.togglePopover('color', this.refs.colorButton);
        if (width) this.selectWidth(Number(width.dataset.widthChoice), false);
        if (eraserSize) this.selectEraserSize(Number(eraserSize.dataset.eraserSize), false);
        if (quickTool) this.selectQuickTool(quickTool.dataset.quickTool);
        if (quickColor) this.selectQuickColor(quickColor.dataset.quickColor);
        if (quickWidth) this.selectQuickWidth(Number(quickWidth.dataset.quickWidth));
        if (textSetting) this.applyTextSetting(textSetting);
        if (textColor) {
          this.colorTarget = "textColor";
          this.colorPickerTarget = this.colorTarget;
          this.togglePopover("color", this.refs.colorButton);
        }
        if (clearAll) this.confirmClearAll();
        const captureOption = event.target.closest("[data-capture-option]");
        if (captureOption) {
          const opt = captureOption.dataset.captureOption;
          this.closePopover({ type: "capture", anchorElement: this.refs.captureDropdownButton, keepPositionDuringClose: true });
          if (this.handlers.onCaptureOption) this.handlers.onCaptureOption(opt);
        }
      });
      this.shadow.addEventListener("input", (event) => {
        const textSetting = event.target.closest && event.target.closest("[data-text-setting]");
        if (textSetting && (textSetting.type === "range" || textSetting.type === "checkbox")) {
          event.stopPropagation();
          this.applyTextSetting(textSetting);
        }
      });
      const outsidePointerDown = (event) => {
        if (!event.composedPath || !event.composedPath().includes(this.host)) {
          this.closeAllPopovers();
        }
      };
      document.addEventListener("pointerdown", outsidePointerDown, true);
      this.cleanupCallbacks.push(() => document.removeEventListener("pointerdown", outsidePointerDown, true));
      const keydownHandler = (event) => {
        if (event.key === "Escape") {
          this.closeAllPopovers();
          this.hideClearConfirm();
        }
      };
      window.addEventListener("keydown", keydownHandler, true);
      this.cleanupCallbacks.push(() => window.removeEventListener("keydown", keydownHandler, true));
      const resizeHandler = () => this.repositionOpenPopovers();
      const fullscreenHandler = () => this.repositionOpenPopovers();
      window.addEventListener("resize", resizeHandler);
      document.addEventListener("fullscreenchange", fullscreenHandler);
      this.cleanupCallbacks.push(() => window.removeEventListener("resize", resizeHandler));
      this.cleanupCallbacks.push(() => document.removeEventListener("fullscreenchange", fullscreenHandler));
    }

    hideForCapture() {
      if (this.host) this.host.style.display = "none";
    }

    restoreAfterCapture() {
      if (this.host) this.host.style.display = "";
    }

    destroy() {
      this.closeAllPopovers();
      this.hideClearConfirm();
      this.popoverTimers.forEach((timer) => window.clearTimeout(timer));
      this.popoverTimers.clear();
      this.popoverStates.clear();
      this.cleanupCallbacks.splice(0).forEach((cleanup) => cleanup());
      this.activePopover = null;
      this.toolbarClosing = false;
      this.widthSliderDragging = false;
      this.eraserSliderDragging = false;
      document.documentElement.style.userSelect = this.previousUserSelect || "";
      this.shadow.innerHTML = "";
      this.refs = null;
      this.host.remove();
    }

    getPopover(type) {
      return {
        quick: this.refs.quickPopover,
        pen: this.refs.penPopover,
        color: this.refs.colorPopover,
        width: this.refs.widthPopover,
        text: this.refs.textPopover,
        capture: this.refs.capturePopover,
        eraser: this.refs.eraserPopover,
        settings: this.refs.settingsPanel
      }[type];
    }

    getAnchor(type) {
      return {
        quick: this.refs.quickTrigger || this.refs.toggle,
        pen: this.refs.penButton,
        color: this.refs.colorButton,
        width: this.refs.widthButton,
        text: this.refs.textDropdownButton,
        capture: this.refs.captureDropdownButton,
        eraser: this.refs.eraserDropdownButton,
        settings: this.refs.penDropdownButton
      }[type];
    }

    togglePopover(type, anchor) {
      if (this.activePopover === type) {
        this.closePopover({ type, anchorElement: anchor || this.getAnchor(type), keepPositionDuringClose: true });
        return;
      }
      this.openPopover(type, anchor);
    }

    openPopover(type, anchor) {
      this.closeAllPopovers(type);
      this.activePopover = type;
      const popover = this.getPopover(type);
      if (!popover) return;
      window.clearTimeout(this.popoverTimers.get(type));
      this.popoverStates.set(type, { status: "open" });
      popover.classList.remove("wae-closing");
      popover.classList.add("wae-mounted");
      popover.style.visibility = "hidden";
      if (type === 'color') {
        this.colorPickerTarget = this.colorTarget || "penColor";
        this.previewColor = this.getCurrentPickerColor();
      }
      this.update();
      window.requestAnimationFrame(() => {
        this.positionPopover(popover, anchor || this.getAnchor(type));
        popover.style.visibility = "visible";
        popover.classList.add("wae-open");
        if (type === 'color') {
          // initialize canvases and controls to current color
          try {
            this._drawHue();
            this._drawSV();
            const rgb = this._hexToRgb(this.getCurrentPickerColor()) || {r:0,g:0,b:0};
            this._applyRGB(rgb.r, rgb.g, rgb.b, { apply: false });
            this.renderMyColors();
          } catch (e) {}
        }
      });
    }

    closePopover(request) {
      const type = typeof request === "string" ? request : request && request.type;
      const anchorElement = request && request.anchorElement ? request.anchorElement : this.getAnchor(type);
      const popover = this.getPopover(type);
      if (!popover) return;
      if (!popover.classList.contains("wae-mounted")) {
        if (this.activePopover === type) this.activePopover = null;
        this.popoverStates.set(type, { status: "closed" });
        return;
      }
      const popoverRect = popover.getBoundingClientRect();
      const anchorRect = anchorElement ? anchorElement.getBoundingClientRect() : null;
      const placement = popover.dataset.placement || this.inferPopoverPlacement(popoverRect, anchorRect);
      const origin = popover.style.getPropertyValue("--wae-origin") || this.originForPlacement(placement);

      if (this.activePopover === type) {
        this.activePopover = null;
      }
      this.popoverStates.set(type, {
        status: "closing",
        placement,
        origin,
        popoverRect: {
          left: popoverRect.left,
          top: popoverRect.top,
          width: popoverRect.width,
          height: popoverRect.height
        },
        anchorRect: anchorRect ? {
          left: anchorRect.left,
          top: anchorRect.top,
          width: anchorRect.width,
          height: anchorRect.height
        } : null
      });

      popover.style.left = `${popoverRect.left}px`;
      popover.style.top = `${popoverRect.top}px`;
      popover.style.right = "auto";
      popover.style.bottom = "auto";
      popover.style.width = `${popoverRect.width}px`;
      popover.style.height = `${popoverRect.height}px`;
      popover.style.setProperty("--wae-origin", origin);
      const shift = this.closeShiftForPlacement(placement);
      popover.style.setProperty("--wae-close-shift-x", shift.x);
      popover.style.setProperty("--wae-close-shift-y", shift.y);
      popover.classList.remove("wae-open");
      popover.classList.add("wae-closing");
      window.clearTimeout(this.popoverTimers.get(type));
      const finish = (event) => {
        if (event && event.target !== popover) return;
        popover.removeEventListener("transitionend", finish);
        if (this.activePopover === type) return;
        if (type === 'color') this.previewColor = "";
        popover.classList.remove("wae-mounted", "wae-closing");
        popover.style.visibility = "";
        popover.style.width = "";
        popover.style.height = "";
        this.popoverStates.set(type, { status: "closed" });
      };
      popover.addEventListener("transitionend", finish);
      this.popoverTimers.set(type, window.setTimeout(finish, 220));
    }

    closeAllPopovers(exceptType) {
      ["quick", "pen", "color", "width", "text", "capture", "eraser", "settings"].forEach((type) => {
        if (type !== exceptType) {
          this.closePopover({ type, anchorElement: this.getAnchor(type), keepPositionDuringClose: true });
        }
      });
    }

    openToolbar() {
      this.closeAllPopovers();
      this.positionToolbarForCollapsedAnchor();
      this.toolbarClosing = false;
      this.state.menuOpen = true;
      this.update();
    }

    closeToolbar() {
      if (!this.state.menuOpen || this.toolbarClosing) return;
      this.closeAllPopovers();
      this.setMenuOriginFromCollapsedButton();
      this.toolbarClosing = true;
      this.state.menuOpen = false;
      this.update();

      let finished = false;
      const finish = (event) => {
        if (event && event.target !== this.refs.menu) return;
        if (finished) return;
        finished = true;
        this.refs.menu.removeEventListener("transitionend", finish);
        window.clearTimeout(timer);
        this.toolbarClosing = false;
        this.update();
      };

      this.refs.menu.addEventListener("transitionend", finish);
      const timer = window.setTimeout(finish, 220);
    }

    setMenuOriginFromCollapsedButton() {
      const collapsedRect = this.refs.toggle.getBoundingClientRect();
      const menuRect = this.refs.menu.getBoundingClientRect();
      if (!collapsedRect.width || !menuRect.width) return;
      const centerX = collapsedRect.left + collapsedRect.width / 2;
      const centerY = collapsedRect.top + collapsedRect.height / 2;
      this.refs.menu.style.setProperty("--wae-toolbar-origin", `${centerX - menuRect.left}px ${centerY - menuRect.top}px`);
    }

    setExpansionClasses(horizontal, vertical) {
      this.refs.root.classList.remove("expand-right", "expand-left", "expand-up", "expand-down");
      this.refs.root.classList.add(`expand-${horizontal}`, `expand-${vertical}`);
    }

    chooseExpansionDirection(anchorRect, menuSize) {
      const margin = 8;
      const spaceRight = window.innerWidth - anchorRect.right - margin;
      const spaceLeft = anchorRect.left - margin;
      const spaceBelow = window.innerHeight - anchorRect.bottom - margin;
      const spaceAbove = anchorRect.top - margin;
      let horizontal = "right";
      let vertical = "down";

      if (spaceRight >= menuSize.width) horizontal = "right";
      else if (spaceLeft >= menuSize.width) horizontal = "left";
      else horizontal = spaceRight >= spaceLeft ? "right" : "left";

      if (spaceBelow >= menuSize.height) vertical = "down";
      else if (spaceAbove >= menuSize.height) vertical = "up";
      else vertical = spaceBelow >= spaceAbove ? "down" : "up";

      const horizontalFit = Math.max(spaceRight, spaceLeft) / Math.max(1, menuSize.width);
      const verticalFit = Math.max(spaceBelow, spaceAbove) / Math.max(1, menuSize.height);
      const primary = horizontalFit >= verticalFit ? horizontal : vertical;
      return { horizontal, vertical, primary };
    }

    getToolbarAnchorCenter(anchorRect) {
      return {
        x: anchorRect.left + anchorRect.width / 2,
        y: anchorRect.top + anchorRect.height / 2
      };
    }

    measureMenuAgainstAnchor(anchorCenter) {
      const menuRect = this.refs.menu.getBoundingClientRect();
      const penRect = this.refs.penMainButton.getBoundingClientRect();
      const penOffsetX = penRect.left + penRect.width / 2 - menuRect.left;
      const penOffsetY = penRect.top + penRect.height / 2 - menuRect.top;
      return {
        width: Math.max(1, menuRect.width),
        height: Math.max(1, menuRect.height),
        penOffsetX,
        penOffsetY,
        left: anchorCenter.x - penOffsetX,
        top: anchorCenter.y - penOffsetY
      };
    }

    originForToolbarExpansion(direction) {
      if (direction === "left") return "right center";
      if (direction === "up") return "bottom center";
      if (direction === "down") return "top center";
      return "left center";
    }

    positionToolbarForCollapsedAnchor() {
      const anchorRect = this.refs.toggle.getBoundingClientRect();
      const rootRect = this.refs.root.getBoundingClientRect();
      if (!anchorRect.width || !rootRect.width) return;

      const anchorCenter = this.getToolbarAnchorCenter(anchorRect);
      this.setExpansionClasses("right", "down");
      this.refs.menu.style.setProperty("--wae-menu-left", "0px");
      this.refs.menu.style.setProperty("--wae-menu-top", "0px");

      let metrics = this.measureMenuAgainstAnchor(anchorCenter);
      const direction = this.chooseExpansionDirection(anchorRect, metrics);
      this.setExpansionClasses(direction.horizontal, direction.vertical);
      metrics = this.measureMenuAgainstAnchor(anchorCenter);

      const margin = 8;
      const clampedLeft = WAE.clamp(metrics.left, margin, Math.max(margin, window.innerWidth - metrics.width - margin));
      const clampedTop = WAE.clamp(metrics.top, margin, Math.max(margin, window.innerHeight - metrics.height - margin));
      const menuLeft = clampedLeft - rootRect.left;
      const menuTop = clampedTop - rootRect.top;
      const toggleLeft = anchorRect.left - rootRect.left;
      const toggleTop = anchorRect.top - rootRect.top;
      const minLeft = Math.min(menuLeft, toggleLeft);
      const minTop = Math.min(menuTop, toggleTop);
      const maxRight = Math.max(menuLeft + metrics.width, toggleLeft + anchorRect.width);
      const maxBottom = Math.max(menuTop + metrics.height, toggleTop + anchorRect.height);
      const originX = anchorCenter.x - clampedLeft;
      const originY = anchorCenter.y - clampedTop;

      this.refs.menu.style.setProperty("--wae-menu-left", `${menuLeft}px`);
      this.refs.menu.style.setProperty("--wae-menu-top", `${menuTop}px`);
      this.refs.root.style.setProperty("--wae-root-width", `${Math.max(1, maxRight - Math.min(0, minLeft))}px`);
      this.refs.root.style.setProperty("--wae-root-height", `${Math.max(1, maxBottom - Math.min(0, minTop))}px`);
      this.refs.menu.style.setProperty("--wae-toolbar-origin", `${originX}px ${originY}px`);
      this.refs.root.dataset.expandPrimary = direction.primary;
      this.refs.root.dataset.expandHorizontal = direction.horizontal;
      this.refs.root.dataset.expandVertical = direction.vertical;
      this.updateCollapseIcon();
    }

    syncCollapsedButtonToPenButton() {
      if (this.state.menuOpen || this.toolbarClosing) return;
      const toggleWidth = this.refs.toggle.offsetWidth || 38;
      const toggleHeight = this.refs.toggle.offsetHeight || 38;
      this.refs.root.style.setProperty("--wae-collapsed-left", "0px");
      this.refs.root.style.setProperty("--wae-collapsed-top", "0px");
      this.refs.root.style.setProperty("--wae-root-width", `${Math.max(1, toggleWidth)}px`);
      this.refs.root.style.setProperty("--wae-root-height", `${Math.max(1, toggleHeight)}px`);
    }

    selectPenType(penType) {
      this.handlers.onPenType(penType);
      this.handlers.onTool("pen");
      this.closePopover({ type: "pen", anchorElement: this.refs.penButton, keepPositionDuringClose: true });
      this.update();
    }

    selectPenTool(tool) {
      if (tool !== "highlighter") return;
      this.handlers.onTool("highlighter");
      this.closePopover({ type: "pen", anchorElement: this.refs.penButton, keepPositionDuringClose: true });
      this.update();
    }

    onSlider(input) {
      const setting = input.dataset.setting;
      const raw = Number(input.value);
      this.updateCurrentPen({ [setting]: setting === "width" ? raw : raw / 100 });
    }

    selectColor(color) {
      const normalized = WAE.normalizeColor(color);
      if (!normalized) return;
      this.updateCurrentPen({ color: normalized });
      this.handlers.onColor(normalized);
      this.closePopover({ type: "color", anchorElement: this.refs.colorButton, keepPositionDuringClose: true });
      this.update();
    }

    selectWidth(width, keepOpen) {
      const normalized = this.applyWidthValue(width, { commit: true });
      if (!keepOpen) {
        this.closePopover({ type: "width", anchorElement: this.refs.widthButton, keepPositionDuringClose: true });
      }
      this.update();
    }

    applyWidthValue(width, options) {
      const normalized = WAE.clamp(Math.round(Number(width) || WAE.CONFIG.defaultWidth), 1, 30);
      const penType = this.state.selectedPenType;
      this.state.width = normalized;
      this.state.penSettings = WAE.normalizePenSettings(Object.assign({}, this.state.penSettings, {
        [penType]: Object.assign({}, this.state.penSettings[penType], { width: normalized })
      }));
      this.updateWidthControls(normalized);
      this.updatePreview(this.state.penSettings[penType]);
      if (options && options.commit) {
        this.handlers.onPenSettings(penType, { width: normalized });
        this.handlers.onWidth(normalized);
      }
      return normalized;
    }

    updateWidthControls(width) {
      if (this.refs.widthPreview && this.refs.widthPreview.firstElementChild) {
        this.refs.widthPreview.firstElementChild.style.height = `${Math.max(1, Math.min(18, width))}px`;
      }
      if (this.refs.widthSlider) {
        this.refs.widthSlider.value = width;
      }
      if (this.refs.widthValue) {
        this.refs.widthValue.textContent = `${width}px`;
      }
      if (this.refs.widthPopover) {
        this.refs.widthPopover.querySelectorAll("[data-width-choice]").forEach((button) => {
          button.classList.toggle("wae-active", Number(button.dataset.widthChoice) === Number(width));
        });
      }
    }

    updateWidthFromPointer(event, commit) {
      if (!this.refs.widthSlider) return;
      const rect = this.refs.widthSlider.getBoundingClientRect();
      if (!rect.width) return;
      const min = Number(this.refs.widthSlider.min) || 1;
      const max = Number(this.refs.widthSlider.max) || 30;
      const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
      const value = min + ratio * (max - min);
      this.applyWidthValue(value, { commit });
    }

    updateCurrentPen(partial) {
      this.handlers.onPenSettings(this.state.selectedPenType, partial);
      this.update();
    }

    confirmClearAll() {
      this.closePopover({ type: "eraser", anchorElement: this.refs.eraserDropdownButton, keepPositionDuringClose: true });
      this.showClearConfirm();
    }

    selectEraserSize(size, keepOpen) {
      this.applyEraserSizeValue(size, { commit: true });
      if (!keepOpen) {
        this.closePopover({ type: "eraser", anchorElement: this.refs.eraserDropdownButton, keepPositionDuringClose: true });
      }
      this.update();
    }

    applyEraserSizeValue(size, options) {
      const normalized = WAE.normalizeEraserSettings({ size }).size;
      this.state.eraserSettings = WAE.normalizeEraserSettings({ size: normalized });
      this.state.eraserRadius = normalized / 2;
      this.updateEraserSizeControls(normalized);
      if (options && options.commit) {
        this.handlers.onEraserSize(normalized);
      }
      return normalized;
    }

    updateEraserSizeControls(size) {
      const normalized = WAE.normalizeEraserSettings({ size }).size;
      if (this.refs.eraserSizeSlider) this.refs.eraserSizeSlider.value = normalized;
      if (this.refs.eraserSizeValues) {
        this.refs.eraserSizeValues.forEach((element) => {
          element.textContent = `${normalized}px`;
        });
      }
      if (this.refs.eraserSizePreview) {
        const previewSize = Math.max(8, Math.min(42, normalized));
        this.refs.eraserSizePreview.style.width = `${previewSize}px`;
        this.refs.eraserSizePreview.style.height = `${previewSize}px`;
      }
      if (this.refs.eraserPopover) {
        this.refs.eraserPopover.querySelectorAll("[data-eraser-size]").forEach((button) => {
          button.classList.toggle("wae-active", Number(button.dataset.eraserSize) === normalized);
        });
      }
    }

    updateEraserSizeFromPointer(event, commit) {
      if (!this.refs.eraserSizeSlider) return;
      const rect = this.refs.eraserSizeSlider.getBoundingClientRect();
      if (!rect.width) return;
      const min = Number(this.refs.eraserSizeSlider.min) || 5;
      const max = Number(this.refs.eraserSizeSlider.max) || 100;
      const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
      this.applyEraserSizeValue(min + ratio * (max - min), { commit });
    }

    showClearConfirm() {
      this.closeAllPopovers();
      this.refs.clearConfirm.classList.add("wae-open");
      window.requestAnimationFrame(() => this.refs.clearConfirmButton.focus({ preventScroll: true }));
    }

    hideClearConfirm() {
      this.refs.clearConfirm.classList.remove("wae-open");
    }

    renderQuickPopover(settings) {
      if (!this.refs.quickPopover) return;
      const currentColor = WAE.normalizeColor(settings && settings.color) || WAE.CONFIG.defaultColor;
      const currentWidth = Number(settings && settings.width) || WAE.CONFIG.defaultWidth;
      const tools = [
        { id: "pen", icon: WAE.getPenType(this.state.selectedPenType).icon, label: "Pen" },
        { id: "highlighter", icon: "highlighter", label: "Highlighter" },
        { id: "eraser", icon: "eraser", label: "Eraser" },
        { id: "navigate", icon: "eye", label: "Navigate" }
      ];
      const toolMarkup = tools.map((tool) => {
        const active = tool.id === "navigate" ? this.state.mode === "navigate" : this.state.mode === "draw" && this.state.tool === tool.id;
        return `<button class="wae-quick-tool${active ? " wae-active" : ""}" data-quick-tool="${tool.id}" title="${tool.label}" aria-label="${tool.label}">${this.icon(tool.icon)}</button>`;
      }).join("");
      const colorMarkup = WAE.CONFIG.colors.map((color) => {
        const active = WAE.normalizeColor(color) === currentColor;
        return `<button class="wae-quick-color${active ? " wae-active" : ""}" data-quick-color="${color}" title="${color}" aria-label="${color}" style="background:${color}"></button>`;
      }).join("");
      const widthMarkup = WAE.CONFIG.widths.map((width) => {
        const active = Number(width.value) === Number(currentWidth);
        return `<button class="wae-quick-width${active ? " wae-active" : ""}" data-quick-width="${width.value}" title="${width.label}" aria-label="${width.label}"><span style="height:${Math.max(2, width.value)}px"></span></button>`;
      }).join("");
      this.refs.quickPopover.innerHTML = [
        '<div class="wae-quick-head"><span>Quick change</span><span class="wae-quick-preview"><span class="wae-quick-dot"></span><span class="wae-quick-line"></span></span></div>',
        `<div class="wae-quick-tools">${toolMarkup}</div>`,
        `<div class="wae-quick-colors">${colorMarkup}</div>`,
        `<div class="wae-quick-widths">${widthMarkup}</div>`
      ].join("");
    }

    selectQuickTool(tool) {
      if (!["pen", "highlighter", "eraser", "navigate"].includes(tool)) return;
      this.closePopover({ type: "quick", anchorElement: this.refs.quickTrigger, keepPositionDuringClose: true });
      if (tool === "navigate") {
        if (this.state.mode !== "navigate") this.handlers.onMode();
      } else {
        this.handlers.onTool(tool);
      }
      this.update();
    }

    selectQuickColor(color) {
      const normalized = WAE.normalizeColor(color);
      if (!normalized) return;
      this.updateCurrentPen({ color: normalized });
      this.handlers.onColor(normalized);
      this.closePopover({ type: "quick", anchorElement: this.refs.quickTrigger, keepPositionDuringClose: true });
      this.update();
    }

    selectQuickWidth(width) {
      this.applyWidthValue(width, { commit: true });
      this.closePopover({ type: "quick", anchorElement: this.refs.quickTrigger, keepPositionDuringClose: true });
      this.update();
    }

    renderPenPopover() {
      const items = [
        { id: "ballpoint", label: "볼펜", icon: "ballpoint", type: "pen" },
        { id: "highlighter", label: "형광펜", icon: "highlighter", type: "highlighter" },
        { id: "fountain", label: "만년필", icon: "fountain", type: "pen" },
        { id: "brush", label: "붓펜", icon: "brush", type: "pen" }
      ];
      this.refs.penPopover.innerHTML = items.map((item) => {
        const label = item.id ? this.t(item.id) : item.label;
        const active = item.type === "highlighter"
          ? this.state.mode === "draw" && this.state.tool === "highlighter"
          : this.state.selectedPenType === item.id && this.state.tool !== "highlighter";
        const data = item.type === "highlighter" ? 'data-pen-tool="highlighter"' : `data-pen-type="${item.id}"`;
        return `<button class="wae-list-item${active ? " wae-active" : ""}" ${data} title="${label}">${this.icon(item.icon)}<span>${label}</span></button>`;
      }).join("");
    }

    renderColorPopover(currentColor) {
      const makeChip = (color) => `<button class="wae-color-chip${color === currentColor ? " wae-active" : ""}" data-color="${color}" title="${color}" aria-label="${color}" style="background:${color}"></button>`;
      const recent = this.state.recentColors.map(makeChip).join("");
      const custom = '<button class="wae-custom-color" data-custom-color="true" title="사용자 색상" aria-label="사용자 색상">+</button>';
      // do not overwrite our custom color popover markup; update settings row only
      if (this.refs.settingsColorRow) this.refs.settingsColorRow.innerHTML = WAE.CONFIG.colors.map(makeChip).join("") + recent + custom;
      this.updateColorSelectionIndicators();
    }

    renderWidthPopover(currentWidth) {
      const presets = [
        { label: "얇게", width: 2 },
        { label: "보통", width: 5 },
        { label: "굵게", width: 9 }
      ];
      this.refs.widthPopover.innerHTML = presets.map((item) => {
        const active = Math.round(currentWidth) === item.width ? " wae-active" : "";
        return `<button class="wae-width-choice${active}" data-width-choice="${item.width}" title="${item.label}"><span class="wae-width-line" style="height:${item.width}px"></span><span>${item.label}</span></button>`;
      }).join("") + [
        '<div class="wae-width-custom">',
        '  <div class="wae-width-custom-head"><span>사용자 지정</span><strong class="wae-width-custom-value"></strong></div>',
        '  <input class="wae-width-custom-slider" type="range" min="1" max="30" step="1">',
        "</div>"
      ].join("");
      this.refs.widthSlider = this.shadow.querySelector(".wae-width-custom-slider");
      this.refs.widthValue = this.shadow.querySelector(".wae-width-custom-value");
      this.refs.widthSlider.value = currentWidth;
      this.refs.widthValue.textContent = `${currentWidth}px`;
      this.bindWidthSlider();
    }

    renderTextPopover() {
      const settings = WAE.normalizeTextSettings(this.state.textSettings);
      const active = (key, value) => settings[key] === value ? " wae-active" : "";
      this.refs.textPopover.innerHTML = [
        '<div style="display:grid;gap:8px;min-width:218px;padding:8px">',
        '  <div class="wae-label"><span>글자 크기</span><strong data-text-value-for="fontSize">' + settings.fontSize + 'px</strong></div>',
        '  <div class="wae-compact-row">',
        '    <button class="wae-tool-mini' + (settings.fontSize === 14 ? ' wae-active' : '') + '" data-text-setting="fontSize" data-value="14">작게</button>',
        '    <button class="wae-tool-mini' + (settings.fontSize === 18 ? ' wae-active' : '') + '" data-text-setting="fontSize" data-value="18">보통</button>',
        '    <button class="wae-tool-mini' + (settings.fontSize === 24 ? ' wae-active' : '') + '" data-text-setting="fontSize" data-value="24">크게</button>',
        '  </div>',
        '  <input class="wae-slider" data-text-setting="fontSize" type="range" min="10" max="72" step="1" value="' + settings.fontSize + '">',
        '  <div class="wae-label"><span>글자 색상</span><button class="wae-tool-mini" data-text-color-target="textColor"><span style="width:16px;height:16px;border-radius:50%;background:' + settings.color + ';border:1px solid rgba(255,255,255,.35)"></span>선택</button></div>',
        '  <div class="wae-label"><span>굵기</span></div>',
        '  <div class="wae-compact-row"><button class="wae-tool-mini' + active("fontWeight", "normal") + '" data-text-setting="fontWeight" data-value="normal">보통</button><button class="wae-tool-mini' + active("fontWeight", "bold") + '" data-text-setting="fontWeight" data-value="bold">굵게</button></div>',
        '</div>'
      ].join("");
      this.bindTextRangeSliders();
      return;
    }

    applyTextSetting(element) {
      if (!this.handlers.onTextSettings) return;
      const key = element.dataset.textSetting;
      if (!["fontSize", "fontWeight"].includes(key)) return;
      let value = element.dataset.value;
      if (element.type === "range") {
        value = Number(element.value);
      } else if (element.type === "checkbox") {
        value = element.checked;
      } else if (key === "fontSize") {
        value = Number(value);
      }
      this.handlers.onTextSettings({ [key]: value });
      if (element.type === "range") {
        this.updateTextRangeLabel(key, value);
      } else {
        this.renderTextPopover();
      }
    }

    bindNativeRangeSlider(slider, callbacks) {
      if (!slider) return;
      const stop = (event) => event.stopPropagation();
      slider.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
        this.previousUserSelect = document.documentElement.style.userSelect;
        document.documentElement.style.userSelect = "none";
        try { slider.setPointerCapture(event.pointerId); } catch (e) {}
      });
      const finish = (event) => {
        event.stopPropagation();
        document.documentElement.style.userSelect = this.previousUserSelect;
        try {
          if (slider.hasPointerCapture && slider.hasPointerCapture(event.pointerId)) {
            slider.releasePointerCapture(event.pointerId);
          }
        } catch (e) {}
      };
      slider.addEventListener("pointerup", finish);
      slider.addEventListener("pointercancel", finish);
      slider.addEventListener("click", stop);
      slider.addEventListener("keydown", stop);
      slider.addEventListener("input", (event) => {
        event.stopPropagation();
        if (callbacks && callbacks.onInput) callbacks.onInput(event);
      });
      slider.addEventListener("change", (event) => {
        event.stopPropagation();
        if (callbacks && callbacks.onChange) callbacks.onChange(event);
      });
    }

    bindTextRangeSliders() {
      if (!this.refs.textPopover) return;
      this.refs.textPopover.querySelectorAll('input[type="range"][data-text-setting]').forEach((slider) => {
        this.bindNativeRangeSlider(slider, {
          onInput: () => this.applyTextSetting(slider),
          onChange: () => this.applyTextSetting(slider)
        });
      });
    }

    updateTextRangeLabel(key, value) {
      if (!this.refs.textPopover) return;
      const label = this.refs.textPopover.querySelector(`[data-text-value-for="${key}"]`);
      if (!label) return;
      label.textContent = `${Math.round(Number(value))}px`;
    }

    renderEraserPopover() {
      const currentSize = WAE.normalizeEraserSettings(this.state.eraserSettings).size;
      const presets = WAE.CONFIG.eraserSizes.map((item) => {
        const active = item.value === currentSize ? " wae-active" : "";
        return `<button class="wae-eraser-size-choice${active}" data-eraser-size="${item.value}" title="${item.label}">${item.label}</button>`;
      }).join("");
      this.refs.eraserPopover.innerHTML = [
        '<div class="wae-eraser-preview-row"><span class="wae-eraser-size-circle"></span><span>지우개 크기 <strong class="wae-eraser-size-value"></strong></span></div>',
        `<div class="wae-eraser-size-presets">${presets}</div>`,
        '<div class="wae-eraser-custom">',
        '  <div class="wae-eraser-custom-head"><span>사용자 지정</span><strong class="wae-eraser-size-value"></strong></div>',
        '  <input class="wae-eraser-size-slider" type="range" min="5" max="100" step="1">',
        "</div>",
        '<button class="wae-danger-item" data-clear-all="true" title="전체 지우기" aria-label="전체 지우기">',
        '  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6.5 6l1 14h9l1-14"/><path d="M10 11v5"/><path d="M14 11v5"/></svg>',
        "  <span>전체 지우기</span>",
        "</button>"
      ].join("");
      this.refs.eraserSizePreview = this.refs.eraserPopover.querySelector(".wae-eraser-size-circle");
      this.refs.eraserSizeSlider = this.refs.eraserPopover.querySelector(".wae-eraser-size-slider");
      this.refs.eraserSizeValues = Array.from(this.refs.eraserPopover.querySelectorAll(".wae-eraser-size-value"));
      this.updateEraserSizeControls(currentSize);
      this.bindEraserSizeSlider();
    }

    updateCollapseIcon() {
      if (!this.refs || !this.refs.collapse) return;
      const horizontal = this.refs.root.dataset.expandHorizontal || "right";
      const vertical = this.refs.root.dataset.expandVertical || "down";
      this.refs.collapse.innerHTML = this.icon("collapse-door");
      this.refs.collapse.title = "도구막대 접기";
      this.refs.collapse.setAttribute("aria-label", "도구막대 접기");
      this.refs.root.classList.toggle("expand-left", horizontal === "left");
      this.refs.root.classList.toggle("expand-right", horizontal === "right");
      this.refs.root.classList.toggle("expand-up", vertical === "up");
      this.refs.root.classList.toggle("expand-down", vertical === "down");
    }

    setScale(scale) {
      this.toolbarScale = this.normalizeToolbarScale(scale);
      if (this.refs && this.refs.root) {
        this.refs.root.style.setProperty("--toolbar-scale", String(this.toolbarScale));
        this.updateScaleTierClass();
        window.requestAnimationFrame(() => {
          if (this.state.menuOpen && !this.toolbarClosing) {
            this.positionToolbarForCollapsedAnchor();
          } else {
            this.syncCollapsedButtonToPenButton();
          }
          this.keepInViewport();
        });
      }
    }

    normalizeToolbarScale(scale) {
      const value = Number(scale);
      if (!Number.isFinite(value)) return 1;
      return Math.round(WAE.clamp(value, 0.78, 1.35) * 100) / 100;
    }

    updateScaleTierClass() {
      if (!this.refs || !this.refs.root) return;
      this.refs.root.classList.toggle("wae-size-small", this.toolbarScale < 0.94);
      this.refs.root.classList.toggle("wae-size-normal", this.toolbarScale >= 0.94 && this.toolbarScale < 1.12);
      this.refs.root.classList.toggle("wae-size-large", this.toolbarScale >= 1.12);
    }

    bindEraserSizeSlider() {
      const slider = this.refs.eraserSizeSlider;
      if (!slider) return;
      slider.addEventListener("click", (event) => event.stopPropagation());
      slider.addEventListener("pointerdown", (event) => {
        if (event.button !== undefined && event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        this.eraserSliderDragging = true;
        this.previousUserSelect = document.documentElement.style.userSelect;
        document.documentElement.style.userSelect = "none";
        slider.focus({ preventScroll: true });
        slider.setPointerCapture(event.pointerId);
        this.updateEraserSizeFromPointer(event, false);
      });
      slider.addEventListener("pointermove", (event) => {
        if (!this.eraserSliderDragging) return;
        event.preventDefault();
        event.stopPropagation();
        this.updateEraserSizeFromPointer(event, false);
      });
      const finish = (event) => {
        if (!this.eraserSliderDragging) return;
        event.preventDefault();
        event.stopPropagation();
        this.eraserSliderDragging = false;
        document.documentElement.style.userSelect = this.previousUserSelect;
        if (slider.hasPointerCapture && slider.hasPointerCapture(event.pointerId)) {
          slider.releasePointerCapture(event.pointerId);
        }
        this.updateEraserSizeFromPointer(event, true);
      };
      slider.addEventListener("pointerup", finish);
      slider.addEventListener("pointercancel", finish);
      slider.addEventListener("input", (event) => {
        event.stopPropagation();
        if (!this.eraserSliderDragging) this.applyEraserSizeValue(slider.value, { commit: false });
      });
      slider.addEventListener("change", (event) => {
        event.stopPropagation();
        this.applyEraserSizeValue(slider.value, { commit: true });
      });
      slider.addEventListener("keydown", (event) => event.stopPropagation());
    }

    bindWidthSlider() {
      if (!this.refs.widthSlider) return;
      const slider = this.refs.widthSlider;
      const stop = (event) => event.stopPropagation();
      slider.addEventListener("click", stop);
      slider.addEventListener("pointerdown", (event) => {
        if (event.button !== undefined && event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        this.widthSliderDragging = true;
        this.previousUserSelect = document.documentElement.style.userSelect;
        document.documentElement.style.userSelect = "none";
        slider.focus({ preventScroll: true });
        slider.setPointerCapture(event.pointerId);
        this.updateWidthFromPointer(event, false);
      });
      slider.addEventListener("pointermove", (event) => {
        if (!this.widthSliderDragging) return;
        event.preventDefault();
        event.stopPropagation();
        this.updateWidthFromPointer(event, false);
      });
      const finish = (event) => {
        if (!this.widthSliderDragging) return;
        event.preventDefault();
        event.stopPropagation();
        this.widthSliderDragging = false;
        document.documentElement.style.userSelect = this.previousUserSelect;
        if (slider.hasPointerCapture && slider.hasPointerCapture(event.pointerId)) {
          slider.releasePointerCapture(event.pointerId);
        }
        this.updateWidthFromPointer(event, true);
      };
      slider.addEventListener("pointerup", finish);
      slider.addEventListener("pointercancel", finish);
      slider.addEventListener("input", (event) => {
        event.stopPropagation();
        if (!this.widthSliderDragging) {
          this.applyWidthValue(slider.value, { commit: false });
        }
      });
      slider.addEventListener("change", (event) => {
        event.stopPropagation();
        this.applyWidthValue(slider.value, { commit: true });
      });
      slider.addEventListener("keydown", (event) => {
        event.stopPropagation();
      });
    }

    update() {
      const penType = WAE.getPenType(this.state.selectedPenType);
      const penSettings = this.state.penSettings[this.state.selectedPenType];
      const activePenIcon = this.state.tool === "select" ? "hand" : (this.state.tool === "highlighter" ? "highlighter" : penType.icon);
      const displayPenLabel = this.state.tool === "select" ? this.t("select") : (this.state.tool === "highlighter" ? this.t("highlighter") : this.t(penType.id));
      const orientation = this.state.uiSettings && this.state.uiSettings.toolbarOrientation === "vertical" ? "vertical" : "horizontal";
      const activePenLabel = this.state.tool === "select" ? "선택/이동" : (this.state.tool === "highlighter" ? "형광펜" : penType.label);
      this.refs.root.classList.toggle("wae-open", this.state.menuOpen && !this.toolbarClosing);
      this.refs.root.classList.toggle("wae-closing", this.toolbarClosing);
      this.refs.root.classList.toggle("wae-orientation-vertical", orientation === "vertical");
      this.refs.root.classList.toggle("wae-orientation-horizontal", orientation !== "vertical");
      this.refs.root.style.setProperty("--wae-active-color", penSettings.color);
      this.refs.root.style.setProperty("--wae-active-width", `${Math.max(2, Math.min(12, penSettings.width))}px`);
      this.refs.penIcon.innerHTML = this.icon(activePenIcon);
      this.refs.toggle.innerHTML = this.icon(activePenIcon);
      this.refs.toggle.title = this.t("openTools");
      this.refs.toggle.setAttribute("aria-label", this.t("openTools"));
      this.refs.penButton.title = activePenLabel;
      this.refs.penButton.title = displayPenLabel;
      this.refs.penMainButton.title = `${displayPenLabel} - ${this.t("drawStart")}`;
      this.refs.colorButton.title = this.t("color");
      this.refs.widthButton.title = this.t("width");
      this.refs.textMainButton.title = this.t("text");
      this.refs.captureMainButton.title = this.t("capture");
      this.refs.eraserMainButton.title = this.t("eraser");
      this.refs.select.title = this.t("select");
      this.refs.navigation.title = this.t("navigate");
      this.refs.penMainButton.title = `${activePenLabel} - 필기 시작`;
      this.refs.penButton.classList.toggle("wae-active", this.state.mode === "draw" && (this.state.tool === "pen" || this.state.tool === "highlighter"));
      this.refs.penMainButton.title = `${displayPenLabel} - ${this.t("drawStart")}`;
      this.refs.settingsIcon.innerHTML = this.icon(penType.icon);
      this.refs.settingsTitle.textContent = penType.label;
      this.refs.settingsTitle.textContent = this.t(penType.id);
      this.refs.colorDot.style.background = penSettings.color;
      this.refs.widthPreview.firstElementChild.style.height = `${Math.max(1, Math.min(18, penSettings.width))}px`;
      this.refs.widthButton.classList.toggle("wae-active", this.activePopover === "width");
      this.refs.textSplit.classList.toggle("wae-active", this.state.mode === "draw" && this.state.tool === "text");
      this.refs.eraser.classList.toggle("wae-active", this.state.mode === "draw" && this.state.tool === "eraser");
      this.refs.select.classList.toggle("wae-active", this.state.mode === "draw" && this.state.tool === "select");
      this.refs.navigation.classList.toggle("wae-active", this.state.mode === "navigate");
      this.refs.undo.disabled = this.state.undoStack.length === 0;
      this.refs.redo.disabled = this.state.redoStack.length === 0;
      this.refs.hide.textContent = this.state.hidden ? "Show" : "Hide";
      if (!this.isPopoverClosing("quick")) this.renderQuickPopover(penSettings);
      if (!this.isPopoverClosing("pen")) this.renderPenPopover();
      if (!this.isPopoverClosing("color") && !this.isPopoverClosing("settings")) this.renderColorPopover(penSettings.color);
      if (!this.isPopoverClosing("eraser") && this.activePopover !== "eraser") {
        this.renderEraserPopover();
      } else {
        this.updateEraserSizeControls(WAE.normalizeEraserSettings(this.state.eraserSettings).size);
      }
      if (!this.isPopoverClosing("width") && this.activePopover !== "width") {
        this.renderWidthPopover(penSettings.width);
      } else {
        this.updateWidthControls(penSettings.width);
      }
      if (!this.isPopoverClosing("text") && this.activePopover !== "text") {
        this.renderTextPopover();
      }
      this.updateSettingsValues(penSettings);
      this.updatePreview(penSettings);
      if (!this.state.menuOpen && !this.toolbarClosing) {
        window.requestAnimationFrame(() => this.syncCollapsedButtonToPenButton());
      }
      window.requestAnimationFrame(() => this.repositionOpenPopovers());
    }

    updateSettingsValues(settings) {
      this.refs.sliders.forEach((input) => {
        if (input.dataset.setting === "width") input.value = settings.width;
        if (input.dataset.setting === "opacity") input.value = Math.round(settings.opacity * 100);
        if (input.dataset.setting === "pressureSensitivity") input.value = Math.round(settings.pressureSensitivity * 100);
      });
      this.shadow.querySelector('[data-value-for="width"]').textContent = `${settings.width}px`;
      this.shadow.querySelector('[data-value-for="opacity"]').textContent = `${Math.round(settings.opacity * 100)}%`;
      this.shadow.querySelector('[data-value-for="pressureSensitivity"]').textContent = `${Math.round(settings.pressureSensitivity * 100)}%`;
      this.shadow.querySelector(".wae-roundness-text").textContent = settings.roundness > 0.65 ? "둥글게" : settings.roundness > 0.3 ? "중간" : "각짐";
      this.refs.roundnessChoices.forEach((button) => button.classList.toggle("wae-active", Math.abs(Number(button.dataset.roundness) - settings.roundness) < 0.1));
      this.refs.widths.forEach((button) => button.classList.toggle("wae-active", Number(button.dataset.width) === Number(settings.width)));
      try {
        if (this.refs.hexInput) this.refs.hexInput.value = WAE.normalizeColor(settings.color) || WAE.CONFIG.defaultColor;
        if (this.refs.previewBox) this.refs.previewBox.style.background = WAE.normalizeColor(settings.color) || WAE.CONFIG.defaultColor;
      } catch (e) {}
    }

    updatePreview(settings) {
      const path = this.refs.preview.querySelector("path");
      if (!path) return;
      path.setAttribute("stroke", settings.color);
      path.setAttribute("stroke-width", String(settings.width));
      path.setAttribute("opacity", String(settings.opacity));
      path.setAttribute("stroke-linecap", settings.roundness > 0.45 ? "round" : "butt");
      path.setAttribute("stroke-linejoin", "round");
    }

    isPopoverClosing(type) {
      return Boolean(type && this.popoverStates.get(type) && this.popoverStates.get(type).status === "closing");
    }

    inferPopoverPlacement(popoverRect, anchorRect) {
      if (!anchorRect) return "down";
      const popoverCenterX = popoverRect.left + popoverRect.width / 2;
      const popoverCenterY = popoverRect.top + popoverRect.height / 2;
      const anchorCenterX = anchorRect.left + anchorRect.width / 2;
      const anchorCenterY = anchorRect.top + anchorRect.height / 2;
      const dx = popoverCenterX - anchorCenterX;
      const dy = popoverCenterY - anchorCenterY;
      if (Math.abs(dx) >= Math.abs(dy)) {
        return dx >= 0 ? "right" : "left";
      }
      return dy >= 0 ? "down" : "up";
    }

    originForPlacement(placement) {
      if (placement === "right") return "left center";
      if (placement === "left") return "right center";
      if (placement === "up") return "bottom center";
      return "top center";
    }

    closeShiftForPlacement(placement) {
      if (placement === "right") return { x: "-4px", y: "0" };
      if (placement === "left") return { x: "4px", y: "0" };
      if (placement === "up") return { x: "0", y: "4px" };
      return { x: "0", y: "-4px" };
    }

    getBestPopoverPosition(anchorRect, popoverSize, viewportSize) {
      const margin = 8;
      const gap = 6;
      const rightSpace = viewportSize.width - anchorRect.right - margin;
      const leftSpace = anchorRect.left - margin;
      const bottomSpace = viewportSize.height - anchorRect.bottom - margin;
      const topSpace = anchorRect.top - margin;
      let placement = "down";
      if (rightSpace >= popoverSize.width + gap) placement = "right";
      else if (leftSpace >= popoverSize.width + gap) placement = "left";
      else if (bottomSpace >= popoverSize.height + gap) placement = "down";
      else if (topSpace >= popoverSize.height + gap) placement = "up";

      let rawX = anchorRect.left;
      let rawY = anchorRect.bottom + gap;
      let origin = "top center";
      let shiftX = "0";
      let shiftY = "4px";

      if (placement === "right") {
        rawX = anchorRect.right + gap;
        rawY = anchorRect.top + (anchorRect.height - popoverSize.height) / 2;
        origin = "left center";
        shiftX = "-4px";
        shiftY = "0";
      } else if (placement === "left") {
        rawX = anchorRect.left - popoverSize.width - gap;
        rawY = anchorRect.top + (anchorRect.height - popoverSize.height) / 2;
        origin = "right center";
        shiftX = "4px";
        shiftY = "0";
      } else if (placement === "up") {
        rawX = anchorRect.left + (anchorRect.width - popoverSize.width) / 2;
        rawY = anchorRect.top - popoverSize.height - gap;
        origin = "bottom center";
        shiftX = "0";
        shiftY = "4px";
      } else {
        rawX = anchorRect.left + (anchorRect.width - popoverSize.width) / 2;
        rawY = anchorRect.bottom + gap;
        origin = "top center";
        shiftX = "0";
        shiftY = "-4px";
      }

      return {
        x: WAE.clamp(rawX, margin, Math.max(margin, viewportSize.width - popoverSize.width - margin)),
        y: WAE.clamp(rawY, margin, Math.max(margin, viewportSize.height - popoverSize.height - margin)),
        placement,
        origin,
        shiftX,
        shiftY
      };
    }

    positionPopover(popover, anchor) {
      if (!popover || !anchor || !popover.classList.contains("wae-mounted")) return;
      const type = popover.dataset.popover;
      if (this.isPopoverClosing(type)) return;
      const anchorRect = anchor.getBoundingClientRect();
      const previousWidth = popover.style.width;
      const previousHeight = popover.style.height;
      const previousVisibility = popover.style.visibility;
      popover.style.width = "";
      popover.style.height = "";
      popover.style.visibility = "hidden";
      const rect = popover.getBoundingClientRect();
      const size = {
        width: Math.max(1, rect.width || popover.offsetWidth),
        height: Math.max(1, rect.height || popover.offsetHeight)
      };
      const position = this.getBestPopoverPosition(anchorRect, size, {
        width: window.innerWidth,
        height: window.innerHeight
      });
      popover.style.left = `${position.x}px`;
      popover.style.top = `${position.y}px`;
      popover.style.right = "auto";
      popover.style.bottom = "auto";
      popover.style.width = previousWidth;
      popover.style.height = previousHeight;
      popover.style.visibility = previousVisibility;
      popover.dataset.placement = position.placement;
      popover.style.setProperty("--wae-origin", position.origin);
      popover.style.setProperty("--wae-popover-shift-x", position.shiftX);
      popover.style.setProperty("--wae-popover-shift-y", position.shiftY);
    }

    repositionOpenPopovers() {
      this.positionPopover(this.refs.quickPopover, this.refs.quickTrigger || this.refs.toggle);
      this.positionPopover(this.refs.penPopover, this.refs.penButton);
      this.positionPopover(this.refs.colorPopover, this.refs.colorButton);
      this.positionPopover(this.refs.widthPopover, this.refs.widthButton);
      this.positionPopover(this.refs.textPopover, this.refs.textDropdownButton);
      this.positionPopover(this.refs.capturePopover, this.refs.captureDropdownButton);
      this.positionPopover(this.refs.eraserPopover, this.refs.eraserDropdownButton);
      this.positionPopover(this.refs.settingsPanel, this.refs.penDropdownButton);
    }

    defaultPosition() {
      const size = this.getToolbarSize();
      return this.toRatioPosition(window.innerWidth - size.width - 20, this.defaultPositionY(size.height));
    }

    defaultPositionY(toolbarHeight) {
      return (window.innerHeight - toolbarHeight) * 0.2;
    }

    getToolbarSize() {
      const rect = this.getVisibleToolbarRect();
      return {
        width: Math.max(WAE.CONFIG.buttonSize, rect.width || WAE.CONFIG.buttonSize),
        height: Math.max(WAE.CONFIG.buttonSize, rect.height || WAE.CONFIG.buttonSize)
      };
    }

    toRatioPosition(x, y) {
      const margin = 8;
      const metrics = this.getVisibleToolbarMetrics();
      const toolbarWidth = metrics.rect.width || WAE.CONFIG.buttonSize;
      const toolbarHeight = metrics.rect.height || WAE.CONFIG.buttonSize;
      const visibleX = Number(x) + metrics.offsetX;
      const visibleY = Number(y) + metrics.offsetY;
      const availableWidth = Math.max(0, window.innerWidth - toolbarWidth - margin * 2);
      const availableHeight = Math.max(0, window.innerHeight - toolbarHeight - margin * 2);
      return {
        xRatio: availableWidth > 0 ? WAE.clamp((visibleX - margin) / availableWidth, 0, 1) : 0,
        yRatio: availableHeight > 0 ? WAE.clamp((visibleY - margin) / availableHeight, 0, 1) : 0
      };
    }

    toPixelPosition(position) {
      if (position && Number.isFinite(Number(position.xRatio)) && Number.isFinite(Number(position.yRatio))) {
        const margin = 8;
        const metrics = this.getVisibleToolbarMetrics();
        const toolbarWidth = metrics.rect.width || WAE.CONFIG.buttonSize;
        const toolbarHeight = metrics.rect.height || WAE.CONFIG.buttonSize;
        const availableWidth = Math.max(0, window.innerWidth - toolbarWidth - margin * 2);
        const availableHeight = Math.max(0, window.innerHeight - toolbarHeight - margin * 2);
        return {
          x: margin + Number(position.xRatio) * availableWidth - metrics.offsetX,
          y: margin + Number(position.yRatio) * availableHeight - metrics.offsetY
        };
      }
      if (position && Number.isFinite(Number(position.x)) && Number.isFinite(Number(position.y))) {
        return { x: Number(position.x), y: Number(position.y) };
      }
      return { x: window.innerWidth - WAE.CONFIG.buttonSize - 16, y: this.defaultPositionY(WAE.CONFIG.buttonSize) };
    }

    applyStoredPosition(position) {
      const pixel = this.toPixelPosition(position || this.defaultPosition());
      this.applyPixelPosition(pixel.x, pixel.y);
    }

    resetPosition() {
      this.applyStoredPosition(this.defaultPosition());
      this.handlers.onPosition();
      return this.state.toolbarPosition;
    }

    setVisible(visible) {
      this.host.style.display = visible ? "" : "none";
    }

    applyPixelPosition(x, y) {
      const clamped = this.clampHostToViewport(x, y);
      this.state.toolbarPosition = this.toRatioPosition(clamped.x, clamped.y);
      this.host.style.left = `${clamped.x}px`;
      this.host.style.top = `${clamped.y}px`;
      if (this.state.menuOpen && !this.toolbarClosing && !this.dragStart) {
        window.requestAnimationFrame(() => this.positionToolbarForCollapsedAnchor());
      }
      this.repositionOpenPopovers();
    }

    clampHostToViewport(x, y) {
      const margin = 8;
      const metrics = this.getVisibleToolbarMetrics();
      const toolbarWidth = metrics.rect.width || WAE.CONFIG.buttonSize;
      const toolbarHeight = metrics.rect.height || WAE.CONFIG.buttonSize;
      const minX = margin - metrics.offsetX;
      const minY = margin - metrics.offsetY;
      const maxX = Math.max(minX, window.innerWidth - toolbarWidth - margin - metrics.offsetX);
      const maxY = Math.max(minY, window.innerHeight - toolbarHeight - margin - metrics.offsetY);
      const clampedX = WAE.clamp(Number(x) || 0, minX, maxX);
      const clampedY = WAE.clamp(Number(y) || 0, minY, maxY);
      this.host.style.left = `${clampedX}px`;
      this.host.style.top = `${clampedY}px`;
      return { x: clampedX, y: clampedY };
    }

    getVisibleToolbarRect() {
      return this.getVisibleToolbarMetrics().rect;
    }

    getVisibleToolbarMetrics() {
      if (!this.refs) {
        return { rect: { width: WAE.CONFIG.buttonSize, height: WAE.CONFIG.buttonSize }, offsetX: 0, offsetY: 0 };
      }
      const element = this.state.menuOpen || this.toolbarClosing ? this.refs.menu : this.refs.toggle;
      const rect = element && element.getBoundingClientRect ? element.getBoundingClientRect() : null;
      const hostRect = this.host && this.host.getBoundingClientRect ? this.host.getBoundingClientRect() : { left: 0, top: 0 };
      if (rect && rect.width && rect.height) {
        return { rect, offsetX: rect.left - hostRect.left, offsetY: rect.top - hostRect.top };
      }
      const rootRect = this.refs.root && this.refs.root.getBoundingClientRect ? this.refs.root.getBoundingClientRect() : null;
      if (rootRect && rootRect.width && rootRect.height) {
        return { rect: rootRect, offsetX: rootRect.left - hostRect.left, offsetY: rootRect.top - hostRect.top };
      }
      return { rect: { width: WAE.CONFIG.buttonSize, height: WAE.CONFIG.buttonSize }, offsetX: 0, offsetY: 0 };
    }

    getViewportClampRect() {
      return this.getVisibleToolbarRect();
    }

    keepInViewport() {
      const current = this.toPixelPosition(this.state.toolbarPosition || this.defaultPosition());
      this.applyPixelPosition(current.x, current.y);
      if (this.state.menuOpen && !this.toolbarClosing) {
        window.requestAnimationFrame(() => this.positionToolbarForCollapsedAnchor());
      }
    }

    // --- Color picker helpers ---
    _clamp(v, a, b) { return Math.min(Math.max(v, a), b); }

    getCurrentPenColor() {
      return this.getCurrentPickerColor();
    }

    getCurrentPickerColor() {
      if (this.colorPickerTarget === "textColor" || this.colorTarget === "textColor") {
        return WAE.normalizeColor(this.state.textSettings && this.state.textSettings.color) || WAE.CONFIG.defaultTextSettings.color;
      }
      const settings = this.state && this.state.penSettings && this.state.penSettings[this.state.selectedPenType];
      return WAE.normalizeColor(settings && settings.color) || WAE.CONFIG.defaultColor;
    }

    applyColorToCurrentPen(color) {
      this.applyColorToCurrentTarget(color);
    }

    applyColorToCurrentTarget(color) {
      const normalized = WAE.normalizeColor(color);
      if (!normalized) return;
      this.previewColor = normalized;
      if (this.colorPickerTarget === "textColor" || this.colorTarget === "textColor") {
        this.handlers.onTextSettings && this.handlers.onTextSettings({ color: normalized });
        if (this.refs.previewBox) this.refs.previewBox.style.background = normalized;
        this.updateColorSelectionIndicators();
        return;
      }
      const penType = this.state.selectedPenType;
      this.state.color = normalized;
      this.state.penSettings = WAE.normalizePenSettings(Object.assign({}, this.state.penSettings, {
        [penType]: Object.assign({}, this.state.penSettings[penType], { color: normalized })
      }));
      if (this.refs.colorDot) this.refs.colorDot.style.background = normalized;
      if (this.refs.previewBox) this.refs.previewBox.style.background = normalized;
      this.updatePreview(this.state.penSettings[penType]);
      this.handlers.onPenSettings(penType, { color: normalized });
      this.handlers.onColor(normalized);
      this.updateColorSelectionIndicators();
    }

    addCurrentColorToMyColors() {
      const normalized = WAE.normalizeColor(this.previewColor || (this.refs.hexInput && this.refs.hexInput.value) || this.getCurrentPickerColor());
      if (!normalized) return;
      const next = WAE.normalizeCustomColors([normalized].concat(this.state.customColors || []));
      this.state.customColors = next;
      if (this.handlers.onCustomColors) this.handlers.onCustomColors(next);
      this.renderMyColors();
    }

    removeMyColor(color) {
      const normalized = WAE.normalizeColor(color);
      if (!normalized) return;
      const next = WAE.normalizeCustomColors((this.state.customColors || []).filter((item) => WAE.normalizeColor(item) !== normalized));
      this.state.customColors = next;
      if (this.handlers.onCustomColors) this.handlers.onCustomColors(next);
      this.renderMyColors();
    }

    renderMyColors() {
      if (!this.refs.customColorsList) return;
      const colors = WAE.normalizeCustomColors(this.state.customColors || []);
      const currentColor = this.getCurrentPickerColor();
      this.refs.customColorsList.innerHTML = colors.length
        ? colors.map((color) => `<button class="wae-my-color${color === currentColor ? " wae-active" : ""}" data-my-color="${color}" title="${color}" aria-label="${color}" style="background:${color}"><span class="wae-my-color-delete" data-delete-my-color="${color}" title="삭제" aria-label="삭제">×</span></button>`).join("")
        : '<span style="color:#94a3b8;font-size:11px;line-height:24px">저장된 색상이 없습니다</span>';
    }

    updateColorSelectionIndicators() {
      const currentColor = this.getCurrentPickerColor();
      if (this.refs.defaultColors) {
        this.refs.defaultColors.forEach((button) => {
          button.classList.toggle("wae-active", WAE.normalizeColor(button.dataset.color) === currentColor);
        });
      }
      if (this.refs.customColorsList) {
        this.refs.customColorsList.querySelectorAll("[data-my-color]").forEach((button) => {
          button.classList.toggle("wae-active", WAE.normalizeColor(button.dataset.myColor) === currentColor);
        });
      }
      if (this.refs.settingsColorRow) {
        this.refs.settingsColorRow.querySelectorAll("[data-color]").forEach((button) => {
          button.classList.toggle("wae-active", WAE.normalizeColor(button.dataset.color) === currentColor);
        });
      }
    }

    _rgbToHex(r,g,b){
      const toHex = (n)=>('0'+Math.round(n).toString(16)).slice(-2);
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
    }

    _hexToRgb(hex){
      if(!hex) return null;
      const m = hex.replace(/[^0-9a-fA-F]/g,'');
      if(m.length===3) {
        return {r:parseInt(m[0]+m[0],16), g:parseInt(m[1]+m[1],16), b:parseInt(m[2]+m[2],16)};
      }
      if(m.length===6) {
        return {r:parseInt(m.slice(0,2),16), g:parseInt(m.slice(2,4),16), b:parseInt(m.slice(4,6),16)};
      }
      return null;
    }

    _rgbToHsv(r,g,b){
      r/=255;g/=255;b/=255;
      const max=Math.max(r,g,b), min=Math.min(r,g,b);
      const d=max-min; let h=0; if(d===0) h=0; else if(max===r) h=((g-b)/d)%6; else if(max===g) h=(b-r)/d+2; else h=(r-g)/d+4; h=Math.round((h*60+360)%360);
      const v=max; const s = max===0?0:d/max;
      return {h,s,v};
    }

    _hsvToRgb(h,s,v){
      const c = v*s; const hh = h/60; const x = c*(1-Math.abs(hh%2-1)); let r1=0,g1=0,b1=0;
      if(hh>=0 && hh<1){r1=c;g1=x;b1=0;}else if(hh<2){r1=x;g1=c;b1=0;}else if(hh<3){r1=0;g1=c;b1=x;}else if(hh<4){r1=0;g1=x;b1=c;}else if(hh<5){r1=x;g1=0;b1=c;}else{r1=c;g1=0;b1=x;}
      const m = v-c; return {r:Math.round((r1+m)*255), g:Math.round((g1+m)*255), b:Math.round((b1+m)*255)};
    }

    _initColorPopover(){
      // draw hue and sv canvases
      try{
        const hueCanvas = this.refs.hueCanvas; const svCanvas = this.refs.colorSVCanvas;
        this._drawHue();
        this._drawSV();
        // wire pointer handlers
        const stop = (e)=>{ e.stopPropagation(); };
        const hueDown = (e)=>{ e.stopPropagation(); e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); this._hueDragging = true; this._onHuePointer(e); };
        const svDown = (e)=>{ e.stopPropagation(); e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); this._svDragging = true; this._onSVPointer(e); };
        const finishHue = (e)=>{ e.stopPropagation(); this._hueDragging = false; try{ e.currentTarget.releasePointerCapture(e.pointerId); }catch(_){} };
        const finishSV = (e)=>{ e.stopPropagation(); this._svDragging = false; try{ e.currentTarget.releasePointerCapture(e.pointerId); }catch(_){} };
        hueCanvas.addEventListener('pointerdown', hueDown, true);
        hueCanvas.addEventListener('pointermove', (e)=>{ if(this._hueDragging) { e.stopPropagation(); e.preventDefault(); this._onHuePointer(e); } }, true);
        hueCanvas.addEventListener('pointerup', finishHue, true);
        hueCanvas.addEventListener('pointercancel', finishHue, true);
        svCanvas.addEventListener('pointerdown', svDown, true);
        svCanvas.addEventListener('pointermove', (e)=>{ if(this._svDragging) { e.stopPropagation(); e.preventDefault(); this._onSVPointer(e); } }, true);
        svCanvas.addEventListener('pointerup', finishSV, true);
        svCanvas.addEventListener('pointercancel', finishSV, true);

        if (this.refs.colorPopover) {
          this.refs.colorPopover.addEventListener("pointerdown", (event) => event.stopPropagation());
          this.refs.colorPopover.addEventListener("click", (event) => event.stopPropagation());
        }
        // inputs
        const stopKey = (event) => {
          event.stopPropagation();
          if (event.key === "Escape") {
            event.preventDefault();
            this.closePopover('color');
          }
        };
        [this.refs.rInput, this.refs.gInput, this.refs.bInput, this.refs.hexInput, this.refs.addCustomColorButton, this.refs.customColorsList].forEach((element) => {
          if (!element) return;
          element.addEventListener('pointerdown', stop, true);
          element.addEventListener('click', stop);
          element.addEventListener('keydown', stopKey, true);
        });
        const applyRgbInputs = (e)=>{
          e.stopPropagation();
          const r=this._clamp(Number(this.refs.rInput.value)||0,0,255);
          const g=this._clamp(Number(this.refs.gInput.value)||0,0,255);
          const b=this._clamp(Number(this.refs.bInput.value)||0,0,255);
          this._applyRGB(r,g,b);
        };
        if(this.refs.rInput) this.refs.rInput.addEventListener('input', applyRgbInputs);
        if(this.refs.gInput) this.refs.gInput.addEventListener('input', applyRgbInputs);
        if(this.refs.bInput) this.refs.bInput.addEventListener('input', applyRgbInputs);
        if(this.refs.hexInput) this.refs.hexInput.addEventListener('input',(e)=>{ e.stopPropagation(); const rgb=this._hexToRgb(e.target.value.trim()); if(rgb) this._applyRGB(rgb.r,rgb.g,rgb.b); });
        // default colors
        if(this.refs.defaultColors) this.refs.defaultColors.forEach((btn)=>{ btn.addEventListener('click',(e)=>{ e.stopPropagation(); const c=btn.dataset.color; const rgb=this._hexToRgb(c); if(rgb) { this._applyRGB(rgb.r,rgb.g,rgb.b); this.closePopover('color'); } }); });
        if(this.refs.customColorsList) this.refs.customColorsList.addEventListener('click',(e)=>{
          e.stopPropagation();
          const deleteButton = e.target.closest && e.target.closest('[data-delete-my-color]');
          if (deleteButton) {
            this.removeMyColor(deleteButton.dataset.deleteMyColor);
            return;
          }
          const chip = e.target.closest && e.target.closest('[data-my-color]');
          if (chip) {
            const rgb = this._hexToRgb(chip.dataset.myColor);
            if (rgb) this._applyRGB(rgb.r, rgb.g, rgb.b);
          }
        });
        if(this.refs.addCustomColorButton) this.refs.addCustomColorButton.addEventListener('click',(e)=>{ e.stopPropagation(); this.addCurrentColorToMyColors(); });
      }catch(e){console.error(e);}
    }

    _drawHue(){
      const canvas=this.refs.hueCanvas; if(!canvas) return; const ctx=canvas.getContext('2d'); const dpr = window.devicePixelRatio || 1; const w = Math.max(1, Math.floor(canvas.clientWidth * dpr)); const h = Math.max(1, Math.floor(canvas.clientHeight * dpr)); canvas.width = w; canvas.height = h; ctx.setTransform(dpr,0,0,dpr,0,0);
      const grad = ctx.createLinearGradient(0,0,canvas.clientWidth,0);
      grad.addColorStop(0/6,'#ff0000'); grad.addColorStop(1/6,'#ffff00'); grad.addColorStop(2/6,'#00ff00'); grad.addColorStop(3/6,'#00ffff'); grad.addColorStop(4/6,'#0000ff'); grad.addColorStop(5/6,'#ff00ff'); grad.addColorStop(1,'#ff0000');
      ctx.clearRect(0,0,canvas.clientWidth,canvas.clientHeight); ctx.fillStyle = grad; ctx.fillRect(0,0,canvas.clientWidth,canvas.clientHeight);
    }

    _drawSV(hue){
      const canvas=this.refs.colorSVCanvas; if(!canvas) return; const ctx=canvas.getContext('2d'); const dpr = window.devicePixelRatio || 1; const w = Math.max(1, Math.floor(canvas.clientWidth * dpr)); const h = Math.max(1, Math.floor(canvas.clientHeight * dpr)); canvas.width = w; canvas.height = h; ctx.setTransform(dpr,0,0,dpr,0,0);
      hue = typeof hue === 'number' ? hue : (this._svHue!==undefined?this._svHue:0);
      // fill base with hue
      ctx.clearRect(0,0,canvas.clientWidth,canvas.clientHeight);
      ctx.fillStyle = `hsl(${Math.round(hue)},100%,50%)`;
      ctx.fillRect(0,0,canvas.clientWidth,canvas.clientHeight);
      // white gradient left->right
      const g1 = ctx.createLinearGradient(0,0,canvas.clientWidth,0); g1.addColorStop(0,'#fff'); g1.addColorStop(1,'rgba(255,255,255,0)'); ctx.fillStyle = g1; ctx.fillRect(0,0,canvas.clientWidth,canvas.clientHeight);
      // black gradient top->bottom (transparent to black)
      const g2 = ctx.createLinearGradient(0,0,0,canvas.clientHeight); g2.addColorStop(0,'rgba(0,0,0,0)'); g2.addColorStop(1,'#000'); ctx.fillStyle = g2; ctx.fillRect(0,0,canvas.clientWidth,canvas.clientHeight);
    }

    _onHuePointer(e){ if(!this.refs.hueCanvas) return; const rect=this.refs.hueCanvas.getBoundingClientRect(); const x=this._clamp(e.clientX - rect.left,0,rect.width); const hue=(x/Math.max(1,rect.width))*360; this._svHue=hue; this._drawSV(hue); this._moveHueCursor(x); const rgb=this._hsvToRgb(hue,this._svS ?? 1,this._svV ?? 1); this._setTempColor(rgb); }

    _onSVPointer(e){ if(!this.refs.colorSVCanvas) return; const rect=this.refs.colorSVCanvas.getBoundingClientRect(); const x=this._clamp(e.clientX-rect.left,0,rect.width); const y=this._clamp(e.clientY-rect.top,0,rect.height); const s=x/Math.max(1,rect.width); const v=1-(y/Math.max(1,rect.height)); this._svS=s; this._svV=v; this._moveSVCursor(x,y); const rgb=this._hsvToRgb(this._svHue||0,s,v); this._setTempColor(rgb); }

    _moveSVCursor(x,y){ if(!this.refs.colorSVCursor) return; this.refs.colorSVCursor.style.left = x + 'px'; this.refs.colorSVCursor.style.top = y + 'px'; }
    _moveHueCursor(x){ if(!this.refs.hueCursor) return; this.refs.hueCursor.style.left = x + 'px'; }

    _setColorControls(rgb){ if(!rgb) return; const hex=this._rgbToHex(rgb.r,rgb.g,rgb.b); if(this.refs.previewBox) this.refs.previewBox.style.background = hex; if(this.refs.rInput) this.refs.rInput.value = rgb.r; if(this.refs.gInput) this.refs.gInput.value = rgb.g; if(this.refs.bInput) this.refs.bInput.value = rgb.b; if(this.refs.hexInput) this.refs.hexInput.value = hex; }

    _setTempColor(rgb){ if(!rgb) return; const hex=this._rgbToHex(rgb.r,rgb.g,rgb.b); this._setColorControls(rgb); // live reflect
      this.applyColorToCurrentPen(hex);
    }

    _applyRGB(r,g,b,options){ this._svHue = this._rgbToHsv(r,g,b).h; this._svS = this._rgbToHsv(r,g,b).s; this._svV = this._rgbToHsv(r,g,b).v; this._drawSV(this._svHue); // position cursors
      // compute cursor positions
      try{ const svRect=this.refs.colorSVCanvas.getBoundingClientRect(); const x = this._clamp(this._svS*svRect.width,0,svRect.width); const y = this._clamp((1-this._svV)*svRect.height,0,svRect.height); this._moveSVCursor(x,y); const hueRect=this.refs.hueCanvas.getBoundingClientRect(); const hx = this._clamp((this._svHue/360)*hueRect.width,0,hueRect.width); this._moveHueCursor(hx); }catch(e){}
      if (options && options.apply === false) this._setColorControls({r,g,b});
      else this._setTempColor({r,g,b}); }

    startResize(event) {
      if (event.button !== 0 || !this.state.menuOpen) return;
      event.preventDefault();
      event.stopPropagation();
      const menuRect = this.refs.menu.getBoundingClientRect();
      const baseSize = { width: Math.max(1, menuRect.width), height: Math.max(1, menuRect.height) };
      this.resizeStart = {
        pointerX: event.clientX,
        pointerY: event.clientY,
        scale: this.toolbarScale,
        width: baseSize.width,
        height: baseSize.height
      };
      this.previousUserSelect = document.documentElement.style.userSelect;
      document.documentElement.style.userSelect = "none";

      const move = (moveEvent) => {
        moveEvent.preventDefault();
        moveEvent.stopPropagation();
        const dx = moveEvent.clientX - this.resizeStart.pointerX;
        const dy = moveEvent.clientY - this.resizeStart.pointerY;
        const base = Math.max(1, (this.resizeStart.width + this.resizeStart.height) / 2);
        const delta = (dx + dy) / 2;
        const nextScale = this.normalizeToolbarScale(this.resizeStart.scale * ((base + delta) / base));
        this.setScale(nextScale);
      };
      const end = (endEvent) => {
        document.documentElement.style.userSelect = this.previousUserSelect;
        window.removeEventListener("pointermove", move, true);
        window.removeEventListener("pointerup", end, true);
        window.removeEventListener("pointercancel", end, true);
        if (event.currentTarget.hasPointerCapture && event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        this.keepInViewport();
        if (this.handlers.onScale) this.handlers.onScale(this.toolbarScale);
        if (this.handlers.onPosition) this.handlers.onPosition();
        if (endEvent) {
          endEvent.preventDefault();
          endEvent.stopPropagation();
        }
        this.resizeStart = null;
      };

      event.currentTarget.setPointerCapture(event.pointerId);
      window.addEventListener("pointermove", move, true);
      window.addEventListener("pointerup", end, true);
      window.addEventListener("pointercancel", end, true);
    }

    startDrag(event) {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const current = this.toPixelPosition(this.state.toolbarPosition || this.defaultPosition());
      this.dragStart = { pointerX: event.clientX, pointerY: event.clientY, toolbarX: current.x, toolbarY: current.y };
      this.dragged = false;
      this.previousUserSelect = document.documentElement.style.userSelect;
      document.documentElement.style.userSelect = "none";

      const move = (moveEvent) => {
        moveEvent.preventDefault();
        const dx = moveEvent.clientX - this.dragStart.pointerX;
        const dy = moveEvent.clientY - this.dragStart.pointerY;
        if (Math.abs(dx) + Math.abs(dy) > 4) this.dragged = true;
        this.applyPixelPosition(this.dragStart.toolbarX + dx, this.dragStart.toolbarY + dy);
      };
      const end = () => {
        document.documentElement.style.userSelect = this.previousUserSelect;
        window.removeEventListener("pointermove", move, true);
        window.removeEventListener("pointerup", end, true);
        window.removeEventListener("pointercancel", end, true);
        if (this.dragged) this.handlers.onPosition();
      };

      event.currentTarget.setPointerCapture(event.pointerId);
      window.addEventListener("pointermove", move, true);
      window.addEventListener("pointerup", end, true);
      window.addEventListener("pointercancel", end, true);
    }
  }

  WAE.Toolbar = Toolbar;
})();

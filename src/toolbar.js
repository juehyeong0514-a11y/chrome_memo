(function () {
  "use strict";

  const WAE = window.WebAnnotationExtension;

  class Toolbar {
    constructor({ state, onTool, onMode, onUndo, onRedo, onClear, onHide, onColor, onWidth, onPenType, onPenSettings, onEraserSize, onPosition }) {
      this.state = state;
      this.handlers = { onTool, onMode, onUndo, onRedo, onClear, onHide, onColor, onWidth, onPenType, onPenSettings, onEraserSize, onPosition };
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
      this.dragged = false;
      this.dragStart = null;
      this.previousUserSelect = "";
      this.cleanupCallbacks = [];
    }

    mount(savedPosition) {
      this.shadow.innerHTML = this.template();
      document.documentElement.appendChild(this.host);
      this.refs = {
        root: this.shadow.querySelector(".wae-root"),
        toggle: this.shadow.querySelector(".wae-toggle"),
        menu: this.shadow.querySelector(".wae-menu"),
        dragHandle: this.shadow.querySelector(".wae-drag-handle"),
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
        colorInput: this.shadow.querySelector(".wae-color-input"),
        widthButton: this.shadow.querySelector(".wae-width-button"),
        widthPreview: this.shadow.querySelector(".wae-width-preview"),
        widthPopover: this.shadow.querySelector(".wae-width-popover"),
        settings: this.shadow.querySelector(".wae-settings"),
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
        navigation: this.shadow.querySelector(".wae-navigation"),
        collapse: this.shadow.querySelector(".wae-collapse"),
        highlighter: this.shadow.querySelector(".wae-highlighter"),
        hide: this.shadow.querySelector(".wae-hide"),
        clear: this.shadow.querySelector(".wae-clear")
      };
      this.bind();
      this.applyStoredPosition(savedPosition);
      this.update();
      window.requestAnimationFrame(() => this.syncCollapsedButtonToPenButton());
    }

    icon(type) {
      const common = 'viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
      if (type === "fountain") {
        return `<svg ${common}><path d="M12 3l7 7-6.2 10.1H7.2L5 17.9 15.1 7.8 12 3z"/><path d="M15.1 7.8L10 12.9"/><circle cx="9.2" cy="13.7" r="2"/></svg>`;
      }
      if (type === "brush") {
        return `<svg ${common}><path d="M16 3.8l4.2 4.2-7.8 7.8c-.9.9-2.1 1.3-3.3 1.1l-1.3-.2.2-1.3c.2-1.2.6-2.4 1.5-3.3L16 3.8z"/><path d="M5.8 17.2c-1.3.4-2.2 1-2.8 2.1 1.8.5 3.5.2 4.8-.7"/></svg>`;
      }
      if (type === "eraser") {
        return `<svg ${common}><path d="M4 15.5l8.8-8.8a2.1 2.1 0 0 1 3 0l3.5 3.5a2.1 2.1 0 0 1 0 3L13 19.5H8L4 15.5z"/><path d="M9.5 10l5 5"/><path d="M13 19.5h7"/><path d="M3 21h5"/></svg>`;
      }
      if (type === "eye") {
        return `<svg ${common}><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="3"/></svg>`;
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
      return `<svg ${common}><path d="M4 20l4.6-1.1L19.3 8.2a2.2 2.2 0 0 0-3.1-3.1L5.5 15.8 4 20z"/><path d="M14.8 6.5l2.7 2.7"/></svg>`;
    }

    template() {
      return [
        "<style>",
        ":host{all:initial}",
        ".wae-root{--toolbar-scale:1;--button-size:calc(34px * var(--toolbar-scale));--toggle-size:calc(38px * var(--toolbar-scale));--icon-size:calc(21px * var(--toolbar-scale));--toolbar-gap:calc(5px * var(--toolbar-scale));--toolbar-padding:calc(7px * var(--toolbar-scale));--toolbar-radius:calc(14px * var(--toolbar-scale));position:relative;display:inline-block;width:var(--wae-root-width,1px);height:var(--wae-root-height,1px);font-family:Arial,Helvetica,sans-serif;color:#e5e7eb;user-select:none}",
        "button,input{font-family:inherit}",
        ".wae-root svg{width:var(--icon-size);height:var(--icon-size)}",
        ".wae-toggle{position:absolute;left:var(--wae-collapsed-left,0px);top:var(--wae-collapsed-top,0px);width:var(--toggle-size);height:var(--toggle-size);border:0;border-radius:50%;background:rgba(17,24,39,.95);color:#fff;font-size:calc(17px * var(--toolbar-scale));font-weight:800;box-shadow:0 10px 24px rgba(0,0,0,.25);cursor:pointer;touch-action:none;z-index:2;transition:opacity 150ms ease,transform 150ms ease}",
        ".wae-menu{position:absolute;left:var(--wae-menu-left,0px);top:var(--wae-menu-top,0px);display:grid;grid-template-columns:1fr;gap:var(--toolbar-gap);padding:var(--toolbar-padding);border-radius:var(--toolbar-radius);background:rgba(17,24,39,.93);box-shadow:0 16px 38px rgba(0,0,0,.32);border:1px solid rgba(148,163,184,.22);max-width:calc(100vw - 16px);overflow:visible;opacity:0;visibility:hidden;pointer-events:none;transform:scale(.85);transform-origin:var(--wae-toolbar-origin,50% 50%);transition:opacity 160ms ease,transform 160ms ease,visibility 0s linear 160ms}",
        ".wae-root.wae-open .wae-menu{opacity:1;visibility:visible;pointer-events:auto;transform:scale(1);transition:opacity 160ms ease,transform 160ms ease}",
        ".wae-root.wae-closing .wae-menu{opacity:0;visibility:visible;pointer-events:none;transform:scale(.85);transition:opacity 160ms ease,transform 160ms ease}",
        ".wae-root.wae-open .wae-toggle,.wae-root.wae-closing .wae-toggle{opacity:0;pointer-events:none;transform:scale(.85)}",
        ".wae-drag-handle{height:calc(10px * var(--toolbar-scale));border:0;background:transparent;cursor:grab;touch-action:none;position:relative}",
        ".wae-drag-handle::before{content:'';position:absolute;left:50%;top:calc(3px * var(--toolbar-scale));width:calc(40px * var(--toolbar-scale));height:calc(4px * var(--toolbar-scale));border-radius:999px;background:#64748b;transform:translateX(-50%)}",
        ".wae-bar{display:flex;align-items:center;gap:var(--toolbar-gap);white-space:nowrap}",
        ".wae-root.expand-left .wae-bar{flex-direction:row-reverse}",
        ".wae-root.expand-right .wae-bar{flex-direction:row}",
        ".wae-root.expand-up .wae-menu{grid-template-areas:'bar' 'handle'}",
        ".wae-root.expand-up .wae-drag-handle{grid-area:handle}",
        ".wae-root.expand-up .wae-bar{grid-area:bar}",
        ".wae-icon-btn,.wae-pen-split,.wae-eraser-split,.wae-color-button,.wae-width-button,.wae-settings,.wae-navigation,.wae-collapse{box-sizing:border-box;height:var(--button-size);border:1px solid rgba(148,163,184,.18);border-radius:calc(10px * var(--toolbar-scale));background:rgba(255,255,255,.08);color:#f8fafc;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}",
        ".wae-icon-btn,.wae-settings,.wae-color-button,.wae-width-button,.wae-navigation,.wae-collapse{width:var(--button-size)}",
        ".wae-icon-btn{font-size:calc(20px * var(--toolbar-scale));line-height:1}",
        ".wae-icon-btn:disabled{opacity:.34;cursor:default;filter:saturate(.5)}",
        ".wae-undo-redo{display:inline-flex;gap:calc(4px * var(--toolbar-scale))}",
        ".wae-pen-split{min-width:calc(60px * var(--toolbar-scale));padding:0;overflow:hidden;background:rgba(255,255,255,.08)}",
        ".wae-eraser-split{min-width:calc(56px * var(--toolbar-scale));padding:0;overflow:hidden;background:rgba(255,255,255,.08)}",
        ".wae-pen-main,.wae-pen-dropdown,.wae-eraser-main,.wae-eraser-dropdown{height:100%;border:0;background:transparent;color:inherit;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}",
        ".wae-pen-main{width:calc(39px * var(--toolbar-scale))}",
        ".wae-eraser-main{width:calc(35px * var(--toolbar-scale))}",
        ".wae-pen-dropdown{width:calc(20px * var(--toolbar-scale));border-left:1px solid rgba(148,163,184,.24);font-size:calc(10px * var(--toolbar-scale));color:#bfdbfe}",
        ".wae-eraser-dropdown{width:calc(19px * var(--toolbar-scale));border-left:1px solid rgba(148,163,184,.24);font-size:calc(10px * var(--toolbar-scale));color:#fecaca}",
        ".wae-pen-main:hover,.wae-pen-dropdown:hover,.wae-eraser-main:hover,.wae-eraser-dropdown:hover{background:rgba(255,255,255,.08)}",
        ".wae-active{border-color:#60a5fa!important;background:rgba(59,130,246,.34)!important;box-shadow:0 0 0 1px rgba(96,165,250,.48) inset}",
        ".wae-collapse{margin-left:calc(7px * var(--toolbar-scale));border-color:rgba(148,163,184,.34)!important;background:rgba(30,41,59,.92)!important;color:#dbeafe;position:relative}",
        ".wae-collapse::before{content:'';position:absolute;left:calc(-5px * var(--toolbar-scale));top:18%;width:1px;height:64%;background:rgba(148,163,184,.35)}",
        ".wae-collapse:hover{background:rgba(51,65,85,.98)!important;border-color:rgba(191,219,254,.48)!important}",
        ".wae-collapse:active{transform:translateY(1px)}",
        ".wae-popover,.wae-settings-panel{position:fixed;left:0;top:0;right:auto;bottom:auto;box-sizing:border-box;border:1px solid rgba(148,163,184,.22);background:rgba(15,23,42,.98);box-shadow:0 14px 34px rgba(0,0,0,.35);z-index:2147483647;opacity:0;pointer-events:none;transform:translate(var(--wae-popover-shift-x,0),var(--wae-popover-shift-y,4px)) scale(.95);transition:opacity 150ms ease,transform 150ms ease;transform-origin:var(--wae-origin,left top)}",
        ".wae-popover.wae-mounted{display:grid;gap:4px}",
        ".wae-settings-panel.wae-mounted{display:block}",
        ".wae-popover.wae-open,.wae-settings-panel.wae-open{opacity:1;pointer-events:auto;transform:translate(0,0) scale(1)}",
        ".wae-popover.wae-closing,.wae-settings-panel.wae-closing{opacity:0;pointer-events:none;transform:translate(var(--wae-close-shift-x,0),var(--wae-close-shift-y,4px)) scale(.85)}",
        ".wae-popover:not(.wae-mounted),.wae-settings-panel:not(.wae-mounted){display:none}",
        ".wae-pen-popover{min-width:132px;padding:6px;border-radius:12px}",
        ".wae-eraser-popover{min-width:132px;padding:6px;border-radius:12px}",
        ".wae-list-item{height:32px;border:0;border-radius:9px;background:transparent;color:#e5e7eb;display:flex;align-items:center;gap:8px;padding:0 8px;cursor:pointer;text-align:left;font-size:12px;font-weight:700}",
        ".wae-list-item:hover{background:rgba(255,255,255,.08)}",
        ".wae-list-item.wae-active{background:rgba(59,130,246,.28)!important}",
        ".wae-list-item svg{width:19px;height:19px}",
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
        ".wae-current-color{width:calc(18px * var(--toolbar-scale));height:calc(18px * var(--toolbar-scale));border-radius:50%;border:1px solid rgba(255,255,255,.45);box-shadow:0 0 0 1px rgba(0,0,0,.18)}",
        ".wae-width-preview{width:calc(22px * var(--toolbar-scale));height:calc(18px * var(--toolbar-scale));display:flex;align-items:center;justify-content:center}",
        ".wae-width-preview span,.wae-width-line{display:block;width:calc(21px * var(--toolbar-scale));border-radius:999px;background:#f8fafc}",
        ".wae-color-popover{width:154px;grid-template-columns:repeat(6,1fr);gap:6px;padding:6px;border-radius:12px}",
        ".wae-color-chip,.wae-custom-color{position:relative;width:22px;height:22px;border-radius:50%;border:1px solid rgba(148,163,184,.35);cursor:pointer;background:transparent}",
        ".wae-color-chip.wae-active::after,.wae-width-choice.wae-active::after{content:'✓';position:absolute;right:-4px;bottom:-4px;width:13px;height:13px;border-radius:50%;background:#38bdf8;color:#fff;font-size:9px;line-height:13px;text-align:center;font-weight:800}",
        ".wae-custom-color{display:grid;place-items:center;color:#fff;font-size:14px;font-weight:800;background:linear-gradient(135deg,#ef4444,#facc15,#22c55e,#2563eb,#a855f7)}",
        ".wae-color-input{position:absolute;opacity:0;pointer-events:none;width:1px;height:1px}",
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
        '  <div class="wae-menu">',
        '    <button class="wae-drag-handle" title="도구막대 이동" aria-label="도구막대 이동"></button>',
        '    <div class="wae-bar">',
        '      <span class="wae-undo-redo"><button class="wae-icon-btn wae-undo" title="실행 취소" aria-label="실행 취소">&#8630;</button><button class="wae-icon-btn wae-redo" title="다시 실행" aria-label="다시 실행">&#8631;</button></span>',
        '      <span class="wae-pen-split" role="group" aria-label="펜 도구"><button class="wae-pen-main" title="필기 시작" aria-label="필기 시작"><span class="wae-pen-icon"></span></button><button class="wae-pen-dropdown" title="펜 종류 선택" aria-label="펜 종류 선택">▼</button></span>',
        '      <button class="wae-color-button" title="색상 선택" aria-label="색상 선택"><span class="wae-current-color"></span></button>',
        '      <button class="wae-width-button" title="펜 굵기" aria-label="펜 굵기"><span class="wae-width-preview"><span></span></span></button>',
        '      <button class="wae-settings" title="펜 설정" aria-label="펜 설정">' + this.icon("settings") + "</button>",
        '      <span class="wae-eraser-split" role="group" aria-label="지우개 도구"><button class="wae-eraser-main" title="지우개" aria-label="지우개">' + this.icon("eraser") + '</button><button class="wae-eraser-dropdown" title="지우개 메뉴" aria-label="지우개 메뉴">▼</button></span>',
        '      <button class="wae-navigation" title="탐색 모드" aria-label="탐색 모드">' + this.icon("eye") + "</button>",
        '      <button class="wae-collapse" title="도구막대 접기" aria-label="도구막대 접기">‹</button>',
        "    </div>",
        "  </div>",
        '  <div class="wae-popover wae-pen-popover" data-popover="pen"></div>',
        '  <div class="wae-popover wae-color-popover" data-popover="color"></div>',
        '  <div class="wae-popover wae-width-popover" data-popover="width"></div>',
        '  <div class="wae-popover wae-eraser-popover" data-popover="eraser"></div>',
        '  <input class="wae-color-input" type="color" aria-label="사용자 색상 선택">',
        '  <div class="wae-clear-confirm" role="dialog" aria-modal="true" aria-label="전체 지우기 확인"><div class="wae-clear-dialog"><p class="wae-clear-message">현재 페이지의 모든 필기를 지울까요?</p><div class="wae-clear-actions"><button class="wae-clear-cancel" type="button">취소</button><button class="wae-clear-confirm-button" type="button">전체 지우기</button></div></div></div>',
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
      this.refs.colorButton.addEventListener("click", (event) => {
        event.stopPropagation();
        this.togglePopover("color", this.refs.colorButton);
      });
      this.refs.widthButton.addEventListener("click", (event) => {
        event.stopPropagation();
        this.handlers.onTool("pen");
        this.togglePopover("width", this.refs.widthButton);
      });
      this.refs.colorInput.addEventListener("input", () => this.selectColor(this.refs.colorInput.value));
      this.refs.settings.addEventListener("click", () => {
        this.handlers.onTool("pen");
        this.togglePopover("settings", this.refs.settings);
      });
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
      this.refs.navigation.addEventListener("click", () => {
        this.closeAllPopovers();
        this.handlers.onMode();
      });
      this.refs.collapse.addEventListener("click", (event) => {
        event.stopPropagation();
        this.closeToolbar();
      });
      this.refs.sliders.forEach((input) => input.addEventListener("input", () => this.onSlider(input)));
      this.refs.roundnessChoices.forEach((button) => button.addEventListener("click", () => this.updateCurrentPen({ roundness: Number(button.dataset.roundness) })));
      this.refs.widths.forEach((button) => button.addEventListener("click", () => this.selectWidth(Number(button.dataset.width), false)));
      this.refs.highlighter.addEventListener("click", () => {
        this.closeAllPopovers();
        this.handlers.onTool("highlighter");
      });
      this.refs.hide.addEventListener("click", this.handlers.onHide);
      this.refs.clear.addEventListener("click", this.handlers.onClear);
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
        const pen = event.target.closest("[data-pen-type]");
        const color = event.target.closest("[data-color]");
        const custom = event.target.closest("[data-custom-color]");
        const width = event.target.closest("[data-width-choice]");
        const eraserSize = event.target.closest("[data-eraser-size]");
        const clearAll = event.target.closest("[data-clear-all]");
        if (pen) this.selectPenType(pen.dataset.penType);
        if (color) this.selectColor(color.dataset.color);
        if (custom) this.refs.colorInput.click();
        if (width) this.selectWidth(Number(width.dataset.widthChoice), false);
        if (eraserSize) this.selectEraserSize(Number(eraserSize.dataset.eraserSize), false);
        if (clearAll) this.confirmClearAll();
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
        pen: this.refs.penPopover,
        color: this.refs.colorPopover,
        width: this.refs.widthPopover,
        eraser: this.refs.eraserPopover,
        settings: this.refs.settingsPanel
      }[type];
    }

    getAnchor(type) {
      return {
        pen: this.refs.penButton,
        color: this.refs.colorButton,
        width: this.refs.widthButton,
        eraser: this.refs.eraserDropdownButton,
        settings: this.refs.settings
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
      this.update();
      window.requestAnimationFrame(() => {
        this.positionPopover(popover, anchor || this.getAnchor(type));
        popover.classList.add("wae-open");
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
        popover.classList.remove("wae-mounted", "wae-closing");
        popover.style.width = "";
        popover.style.height = "";
        this.popoverStates.set(type, { status: "closed" });
      };
      popover.addEventListener("transitionend", finish);
      this.popoverTimers.set(type, window.setTimeout(finish, 220));
    }

    closeAllPopovers(exceptType) {
      ["pen", "color", "width", "eraser", "settings"].forEach((type) => {
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
      const metrics = this.prepareCollapseToPenButton();
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
        const collapsedButtonRect = this.refs.toggle.getBoundingClientRect();
        const collapsedCenterX = collapsedButtonRect.left + collapsedButtonRect.width / 2;
        const collapsedCenterY = collapsedButtonRect.top + collapsedButtonRect.height / 2;
        console.log({
          toolbarRect: metrics.toolbarRect,
          penRect: metrics.penRect,
          penCenterX: metrics.penCenterX,
          penCenterY: metrics.penCenterY,
          collapsedButtonRect,
          toolbarPosition: this.state.toolbarPosition,
          centerDelta: {
            x: collapsedCenterX - metrics.penCenterX,
            y: collapsedCenterY - metrics.penCenterY
          }
        });
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

    prepareCollapseToPenButton() {
      const penRect = this.refs.penMainButton.getBoundingClientRect();
      const toolbarRect = this.refs.root.getBoundingClientRect();
      const menuRect = this.refs.menu.getBoundingClientRect();
      const penCenterX = penRect.left + penRect.width / 2;
      const penCenterY = penRect.top + penRect.height / 2;
      const toggleWidth = this.refs.toggle.offsetWidth || 38;
      const toggleHeight = this.refs.toggle.offsetHeight || 38;
      const collapsedLeft = penCenterX - toolbarRect.left - toggleWidth / 2;
      const collapsedTop = penCenterY - toolbarRect.top - toggleHeight / 2;
      this.refs.root.style.setProperty("--wae-collapsed-left", `${collapsedLeft}px`);
      this.refs.root.style.setProperty("--wae-collapsed-top", `${collapsedTop}px`);
      this.refs.menu.style.setProperty("--wae-toolbar-origin", `${penCenterX - menuRect.left}px ${penCenterY - menuRect.top}px`);
      return { toolbarRect, penRect, penCenterX, penCenterY };
    }

    syncCollapsedButtonToPenButton() {
      if (this.state.menuOpen || this.toolbarClosing) return;
      const penRect = this.refs.penMainButton.getBoundingClientRect();
      const toolbarRect = this.refs.root.getBoundingClientRect();
      if (!penRect.width || !toolbarRect.width) return;
      const penCenterX = penRect.left + penRect.width / 2;
      const penCenterY = penRect.top + penRect.height / 2;
      const toggleWidth = this.refs.toggle.offsetWidth || 38;
      const toggleHeight = this.refs.toggle.offsetHeight || 38;
      const collapsedLeft = penCenterX - toolbarRect.left - toggleWidth / 2;
      const collapsedTop = penCenterY - toolbarRect.top - toggleHeight / 2;
      this.refs.root.style.setProperty("--wae-collapsed-left", `${collapsedLeft}px`);
      this.refs.root.style.setProperty("--wae-collapsed-top", `${collapsedTop}px`);
      this.refs.root.style.setProperty("--wae-root-width", `${Math.max(1, collapsedLeft + toggleWidth)}px`);
      this.refs.root.style.setProperty("--wae-root-height", `${Math.max(1, collapsedTop + toggleHeight)}px`);
    }

    selectPenType(penType) {
      this.handlers.onPenType(penType);
      this.handlers.onTool("pen");
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

    renderPenPopover() {
      this.refs.penPopover.innerHTML = WAE.CONFIG.penTypes.map((pen) => {
        const active = pen.id === this.state.selectedPenType ? " wae-active" : "";
        return `<button class="wae-list-item${active}" data-pen-type="${pen.id}" title="${pen.label}">${this.icon(pen.icon)}<span>${pen.label}</span></button>`;
      }).join("");
    }

    renderColorPopover(currentColor) {
      const makeChip = (color) => `<button class="wae-color-chip${color === currentColor ? " wae-active" : ""}" data-color="${color}" title="${color}" aria-label="${color}" style="background:${color}"></button>`;
      const recent = this.state.recentColors.map(makeChip).join("");
      const custom = '<button class="wae-custom-color" data-custom-color="true" title="사용자 색상" aria-label="사용자 색상">+</button>';
      this.refs.colorPopover.innerHTML = WAE.CONFIG.colors.map(makeChip).join("") + custom + recent;
      this.refs.settingsColorRow.innerHTML = WAE.CONFIG.colors.map(makeChip).join("") + recent + custom;
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
      const primary = this.refs.root.dataset.expandPrimary || horizontal;
      const iconType = primary === "left" ? "panel-left" : primary === "up" ? "panel-up" : primary === "down" ? "panel-down" : "panel-right";
      this.refs.collapse.innerHTML = this.icon(iconType);
      this.refs.collapse.title = "도구막대 접기";
      this.refs.collapse.setAttribute("aria-label", "도구막대 접기");
      this.refs.root.classList.toggle("expand-left", horizontal === "left");
      this.refs.root.classList.toggle("expand-right", horizontal === "right");
      this.refs.root.classList.toggle("expand-up", vertical === "up");
      this.refs.root.classList.toggle("expand-down", vertical === "down");
    }

    setScale(scale) {
      const value = Number(scale);
      this.toolbarScale = value === 0.85 || value === 1.2 ? value : 1;
      if (this.refs && this.refs.root) {
        this.refs.root.style.setProperty("--toolbar-scale", String(this.toolbarScale));
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
      this.refs.root.classList.toggle("wae-open", this.state.menuOpen && !this.toolbarClosing);
      this.refs.root.classList.toggle("wae-closing", this.toolbarClosing);
      this.refs.penIcon.innerHTML = this.icon(penType.icon);
      this.refs.toggle.innerHTML = this.icon(penType.icon);
      this.refs.penButton.title = penType.label;
      this.refs.penMainButton.title = `${penType.label} - 필기 시작`;
      this.refs.penButton.classList.toggle("wae-active", this.state.mode === "draw" && this.state.tool !== "eraser");
      this.refs.settingsIcon.innerHTML = this.icon(penType.icon);
      this.refs.settingsTitle.textContent = penType.label;
      this.refs.colorDot.style.background = penSettings.color;
      this.refs.widthPreview.firstElementChild.style.height = `${Math.max(1, Math.min(18, penSettings.width))}px`;
      this.refs.widthButton.classList.toggle("wae-active", this.activePopover === "width");
      this.refs.eraser.classList.toggle("wae-active", this.state.mode === "draw" && this.state.tool === "eraser");
      this.refs.navigation.classList.toggle("wae-active", this.state.mode === "navigate");
      this.refs.undo.disabled = this.state.undoStack.length === 0;
      this.refs.redo.disabled = this.state.redoStack.length === 0;
      this.refs.hide.textContent = this.state.hidden ? "Show" : "Hide";
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
      this.refs.colorInput.value = WAE.normalizeColor(settings.color) || WAE.CONFIG.defaultColor;
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
      const size = {
        width: Math.max(1, popover.offsetWidth),
        height: Math.max(1, popover.offsetHeight)
      };
      const position = this.getBestPopoverPosition(anchorRect, size, {
        width: window.innerWidth,
        height: window.innerHeight
      });
      popover.style.left = `${position.x}px`;
      popover.style.top = `${position.y}px`;
      popover.style.right = "auto";
      popover.style.bottom = "auto";
      popover.style.width = "";
      popover.style.height = "";
      popover.dataset.placement = position.placement;
      popover.style.setProperty("--wae-origin", position.origin);
      popover.style.setProperty("--wae-popover-shift-x", position.shiftX);
      popover.style.setProperty("--wae-popover-shift-y", position.shiftY);
    }

    repositionOpenPopovers() {
      this.positionPopover(this.refs.penPopover, this.refs.penButton);
      this.positionPopover(this.refs.colorPopover, this.refs.colorButton);
      this.positionPopover(this.refs.widthPopover, this.refs.widthButton);
      this.positionPopover(this.refs.eraserPopover, this.refs.eraserDropdownButton);
      this.positionPopover(this.refs.settingsPanel, this.refs.settings);
    }

    defaultPosition() {
      const size = this.getToolbarSize();
      return this.toRatioPosition(window.innerWidth - size.width - 20, (window.innerHeight - size.height) / 2);
    }

    getToolbarSize() {
      if (!this.state.menuOpen && !this.toolbarClosing && this.refs && this.refs.toggle) {
        const toggleRect = this.refs.toggle.getBoundingClientRect();
        return {
          width: Math.max(WAE.CONFIG.buttonSize, toggleRect.width || WAE.CONFIG.buttonSize),
          height: Math.max(WAE.CONFIG.buttonSize, toggleRect.height || WAE.CONFIG.buttonSize)
        };
      }
      const rect = this.host.getBoundingClientRect();
      return {
        width: Math.max(WAE.CONFIG.buttonSize, rect.width || WAE.CONFIG.buttonSize),
        height: Math.max(WAE.CONFIG.buttonSize, rect.height || WAE.CONFIG.buttonSize)
      };
    }

    toRatioPosition(x, y) {
      return { xRatio: x / Math.max(1, window.innerWidth), yRatio: y / Math.max(1, window.innerHeight) };
    }

    toPixelPosition(position) {
      if (position && Number.isFinite(Number(position.xRatio)) && Number.isFinite(Number(position.yRatio))) {
        return { x: Number(position.xRatio) * window.innerWidth, y: Number(position.yRatio) * window.innerHeight };
      }
      if (position && Number.isFinite(Number(position.x)) && Number.isFinite(Number(position.y))) {
        return { x: Number(position.x), y: Number(position.y) };
      }
      return { x: window.innerWidth - WAE.CONFIG.buttonSize - 16, y: (window.innerHeight - WAE.CONFIG.buttonSize) / 2 };
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
      if (this.state.menuOpen && !this.toolbarClosing) {
        window.requestAnimationFrame(() => this.positionToolbarForCollapsedAnchor());
      }
      this.repositionOpenPopovers();
    }

    clampHostToViewport(x, y) {
      const margin = 8;
      const initial = {
        x: WAE.clamp(Number(x) || 0, margin, Math.max(margin, window.innerWidth - margin)),
        y: WAE.clamp(Number(y) || 0, margin, Math.max(margin, window.innerHeight - margin))
      };
      this.host.style.left = `${initial.x}px`;
      this.host.style.top = `${initial.y}px`;

      const rect = this.getViewportClampRect();
      let nextX = initial.x;
      let nextY = initial.y;

      if (rect.right > window.innerWidth - margin) {
        nextX -= rect.right - (window.innerWidth - margin);
      }
      if (rect.left < margin) {
        nextX += margin - rect.left;
      }
      if (rect.bottom > window.innerHeight - margin) {
        nextY -= rect.bottom - (window.innerHeight - margin);
      }
      if (rect.top < margin) {
        nextY += margin - rect.top;
      }

      return {
        x: WAE.clamp(nextX, margin - Math.max(0, rect.width - window.innerWidth + margin * 2), Math.max(margin, window.innerWidth - margin)),
        y: WAE.clamp(nextY, margin - Math.max(0, rect.height - window.innerHeight + margin * 2), Math.max(margin, window.innerHeight - margin))
      };
    }

    getViewportClampRect() {
      if (!this.state.menuOpen && !this.toolbarClosing && this.refs && this.refs.toggle) {
        return this.refs.toggle.getBoundingClientRect();
      }
      return this.host.getBoundingClientRect();
    }

    keepInViewport() {
      const current = this.toPixelPosition(this.state.toolbarPosition || this.defaultPosition());
      this.applyPixelPosition(current.x, current.y);
      if (this.state.menuOpen && !this.toolbarClosing) {
        window.requestAnimationFrame(() => this.positionToolbarForCollapsedAnchor());
      }
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

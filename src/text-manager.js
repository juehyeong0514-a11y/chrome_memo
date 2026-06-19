(function () {
  "use strict";

  const WAE = window.WebAnnotationExtension;

  class TextManager {
    constructor({ state, onSelect, onChange }) {
      this.state = state;
      this.onSelect = onSelect || (() => {});
      this.onChange = onChange || (() => {});
      this.layer = document.createElement("div");
      this.layer.className = "wae-text-layer";
      this.nextId = 1;
      this.bound = false;
      this.selectedId = null;
      this.editing = null;
      this.interaction = null;
      this.lastTextPointerDown = null;
      this.captureHiddenState = null;
      this.handlers = {
        pointerdown: (event) => this.onLayerPointerDown(event),
        dblclick: (event) => this.onLayerDoubleClick(event),
        keydown: (event) => this.onKeydown(event),
        pointermove: (event) => this.onPointerMove(event),
        pointerup: (event) => this.onPointerUp(event),
        wheel: (event) => WAE.forwardWheelScroll(event),
        scroll: () => {
          if (!this.editing) this.render();
        },
        resize: () => this.render()
      };
    }

    mount() {
      document.querySelectorAll(".wae-text-layer").forEach((layer) => {
        if (layer !== this.layer) layer.remove();
      });
      if (!document.documentElement.contains(this.layer)) {
        document.documentElement.appendChild(this.layer);
      }
      Object.assign(this.layer.style, {
        position: "absolute",
        left: "0",
        top: "0",
        zIndex: "2147483646",
        pointerEvents: "none",
        fontFamily: "Arial, Helvetica, sans-serif"
      });
      this.installStyles();
      this.bind();
      this.render();
    }

    installStyles() {
      if (this.styleElement) return;
      this.styleElement = document.createElement("style");
      this.styleElement.textContent = [
        ".wae-text-layer{box-sizing:border-box}",
        ".wae-text-box{position:absolute;box-sizing:border-box;min-width:60px;min-height:30px;max-width:none;background:transparent;border:1px dashed transparent;border-radius:4px;cursor:move;user-select:none}",
        ".wae-text-content{box-sizing:border-box;width:100%;height:100%;min-width:60px;min-height:30px;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.35;padding:2px 4px;background:transparent;text-align:left;outline:0;border:0;color:inherit;font:inherit;font-weight:inherit;cursor:inherit}",
        ".wae-text-box.wae-text-selected,.wae-text-box.wae-text-editing{border-color:rgba(59,130,246,.85)}",
        ".wae-text-box.wae-text-editing{outline:2px solid rgba(56,189,248,.50);cursor:text;user-select:text}",
        ".wae-text-box.wae-text-editing .wae-text-content{cursor:text;user-select:text}",
        ".wae-text-box.wae-text-empty.wae-text-editing,.wae-text-box.wae-text-empty.wae-text-editing .wae-text-content{cursor:move;user-select:none}",
        ".wae-text-control{display:none;position:absolute;box-sizing:border-box;z-index:2}",
        ".wae-text-box.wae-text-selected .wae-text-control,.wae-text-box.wae-text-editing .wae-text-control{display:block}",
        ".wae-text-delete{right:-8px;top:-8px;width:18px;height:18px;border:1px solid rgba(15,23,42,.25);border-radius:50%;background:#0f172a;color:#fff;font-size:13px;line-height:16px;text-align:center;padding:0;cursor:pointer}",
        ".wae-text-resize-right{right:-4px;top:14px;bottom:10px;width:8px;cursor:ew-resize}",
        ".wae-text-resize-bottom{left:14px;right:10px;bottom:-4px;height:8px;cursor:ns-resize}",
        ".wae-text-scale{right:-6px;bottom:-6px;width:12px;height:12px;border-radius:50%;background:#38bdf8;border:1px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.25);cursor:nwse-resize}",
        ".wae-text-capture-clean .wae-text-control{display:none!important}",
        ".wae-text-box.wae-text-capture-clean{border-color:transparent!important;outline:0!important}",
        ".wae-text-box.wae-text-capture-clean::after{display:none!important}"
      ].join("");
      document.documentElement.appendChild(this.styleElement);
    }

    bind() {
      if (this.bound) return;
      this.layer.addEventListener("pointerdown", this.handlers.pointerdown, true);
      this.layer.addEventListener("dblclick", this.handlers.dblclick, true);
      this.layer.addEventListener("wheel", this.handlers.wheel, { capture: true, passive: false });
      window.addEventListener("keydown", this.handlers.keydown, true);
      window.addEventListener("pointermove", this.handlers.pointermove, true);
      window.addEventListener("pointerup", this.handlers.pointerup, true);
      window.addEventListener("pointercancel", this.handlers.pointerup, true);
      window.addEventListener("scroll", this.handlers.scroll, true);
      window.addEventListener("resize", this.handlers.resize);
      this.bound = true;
    }

    destroy() {
      this.cancelEdit();
      this.bound = false;
      this.layer.removeEventListener("pointerdown", this.handlers.pointerdown, true);
      this.layer.removeEventListener("dblclick", this.handlers.dblclick, true);
      this.layer.removeEventListener("wheel", this.handlers.wheel, { capture: true, passive: false });
      window.removeEventListener("keydown", this.handlers.keydown, true);
      window.removeEventListener("pointermove", this.handlers.pointermove, true);
      window.removeEventListener("pointerup", this.handlers.pointerup, true);
      window.removeEventListener("pointercancel", this.handlers.pointerup, true);
      window.removeEventListener("scroll", this.handlers.scroll, true);
      window.removeEventListener("resize", this.handlers.resize);
      this.clearMemory(false);
      this.layer.remove();
      if (this.styleElement) {
        this.styleElement.remove();
        this.styleElement = null;
      }
    }

    setMode(mode, tool) {
      const textMode = mode === "draw" && tool === "text";
      this.layer.style.pointerEvents = textMode ? "auto" : "none";
      this.render();
    }

    clearMemory(pushUndo) {
      const previous = this.state.textItems.map((item) => this.cloneItem(item));
      this.cancelEdit();
      this.state.textItems = [];
      this.selectedId = null;
      this.render();
      if (pushUndo && previous.length) this.pushAction({ type: "text-clear", previous });
    }

    loadItems(items) {
      this.cancelEdit();
      this.state.textItems = (Array.isArray(items) ? items : []).map((item) => {
        try {
          return this.cloneItem(item);
        } catch (error) {
          return null;
        }
      }).filter(Boolean);
      this.nextId = this.state.textItems.reduce((max, item) => {
        const numeric = Number(item.id);
        return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
      }, 0) + 1;
      this.selectedId = null;
      this.render();
    }

    beginCapture() {
      const wasEditing = Boolean(this.editing);
      if (this.editing) this.commitEdit();
      this.captureHiddenState = {
        selectedId: this.selectedId,
        wasEditing
      };
      this.selectedId = null;
      this.render();
      this.layer.querySelectorAll(".wae-text-box").forEach((element) => element.classList.add("wae-text-capture-clean"));
    }

    endCapture() {
      if (this.captureHiddenState) {
        this.selectedId = this.captureHiddenState.selectedId;
      }
      const shouldEdit = this.captureHiddenState && this.captureHiddenState.wasEditing && this.captureHiddenState.selectedId;
      this.captureHiddenState = null;
      this.layer.querySelectorAll(".wae-text-box").forEach((element) => element.classList.remove("wae-text-capture-clean"));
      this.render();
      if (shouldEdit) {
        setTimeout(() => this.startEdit(this.selectedId), 0);
      }
    }

    onLayerPointerDown(event) {
      WAE.activateScrollContextFromPoint(event.clientX, event.clientY);
      const deleteButton = event.target.closest && event.target.closest(".wae-text-delete");
      if (deleteButton) {
        event.preventDefault();
        event.stopPropagation();
        this.deleteItem(deleteButton.dataset.textId);
        return;
      }
      const handle = event.target.closest && event.target.closest("[data-text-handle]");
      if (handle) {
        event.preventDefault();
        event.stopPropagation();
        this.selectedId = String(handle.dataset.textId);
        this.startInteraction(event, handle.dataset.textId, handle.dataset.textHandle);
        return;
      }
      const box = event.target.closest && event.target.closest(".wae-text-box");
      if (box) {
        if (event.detail >= 2 || this.isDoublePointerDown(event, box.dataset.textId)) {
          event.preventDefault();
          event.stopPropagation();
          this.lastTextPointerDown = null;
          this.startEdit(box.dataset.textId);
          return;
        }
        this.lastTextPointerDown = {
          id: String(box.dataset.textId),
          x: event.clientX,
          y: event.clientY,
          time: Date.now()
        };
        this.state.selectedStrokeId = null;
        this.selectedId = String(box.dataset.textId);
        this.updateSelectionClasses();
        this.onSelect();
        this.startInteraction(event, box.dataset.textId, "move");
        return;
      }
      if (!(this.state.mode === "draw" && this.state.tool === "text")) return;
      event.preventDefault();
      event.stopPropagation();
      this.commitEdit();
      const point = this.documentPoint(event);
      const item = this.createItem(point.x, point.y, "");
      this.state.textItems.push(item);
      this.selectedId = item.id;
      this.render();
      this.startEdit(item.id, { isNew: true });
    }

    onLayerDoubleClick(event) {
      const box = event.target.closest && event.target.closest(".wae-text-box");
      if (!box) return;
      event.preventDefault();
      event.stopPropagation();
      this.startEdit(box.dataset.textId);
    }

    onKeydown(event) {
      if (this.editing) {
        if (event.key === "Enter" && event.ctrlKey) {
          event.preventDefault();
          event.stopPropagation();
          this.commitEdit();
        } else if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          this.cancelEdit();
        }
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && this.selectedId) {
        event.preventDefault();
        event.stopPropagation();
        this.deleteSelected();
      }
      if (event.key === "Alt") this.enableNavigateSelection(true);
    }

    enableNavigateSelection(enabled) {
      if (this.state.mode === "navigate") {
        this.layer.style.pointerEvents = enabled ? "auto" : "none";
        this.layer.querySelectorAll(".wae-text-box").forEach((box) => {
          box.style.pointerEvents = enabled ? "auto" : "none";
        });
      }
      if (enabled && !this.altReleaseHandler) {
        this.altReleaseHandler = (event) => {
          if (event.key === "Alt") {
            this.enableNavigateSelection(false);
            window.removeEventListener("keyup", this.altReleaseHandler, true);
            this.altReleaseHandler = null;
          }
        };
        window.addEventListener("keyup", this.altReleaseHandler, true);
      }
    }

    startInteraction(event, id, type) {
      if (event.button !== 0) return;
      let resumeEditAfterInteraction = null;
      if (this.editing) {
        if (String(this.editing.id) === String(id) && !this.currentEditingText().trim()) {
          resumeEditAfterInteraction = { isNew: this.editing.isNew };
          this.stopEditingWithoutCommit();
        } else if (type === "move") {
          return;
        } else {
          this.commitEdit();
        }
      }
      event.preventDefault();
      event.stopPropagation();
      const item = this.getItem(id);
      if (!item) return;
      this.interaction = {
        type,
        id,
        startX: event.clientX,
        startY: event.clientY,
        before: this.cloneItem(item),
        originalX: item.x,
        originalY: item.y,
        originalWidth: this.getItemWidth(item),
        originalHeight: this.getItemHeight(item),
        originalFontSize: WAE.normalizeTextSettings(item.settings).fontSize,
        resumeEditAfter: resumeEditAfterInteraction,
        moved: false
      };
      this.previousUserSelect = document.documentElement.style.userSelect;
      document.documentElement.style.userSelect = "none";
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch (e) {}
    }

    onPointerMove(event) {
      if (!this.interaction) return;
      event.preventDefault();
      event.stopPropagation();
      const item = this.getItem(this.interaction.id);
      if (!item) return;
      const dx = event.clientX - this.interaction.startX;
      const dy = event.clientY - this.interaction.startY;
      if (Math.abs(dx) + Math.abs(dy) > 2) this.interaction.moved = true;
      if (this.interaction.type === "move") {
        item.x = this.interaction.originalX + dx;
        item.y = this.interaction.originalY + dy;
      } else if (this.interaction.type === "resize-right") {
        item.width = Math.max(60, Math.round(this.interaction.originalWidth + dx));
      } else if (this.interaction.type === "resize-bottom") {
        item.height = Math.max(30, Math.round(this.interaction.originalHeight + dy));
      } else if (this.interaction.type === "scale") {
        const widthRatio = (this.interaction.originalWidth + dx) / Math.max(1, this.interaction.originalWidth);
        const heightRatio = (this.interaction.originalHeight + dy) / Math.max(1, this.interaction.originalHeight);
        const ratio = Math.max(0.35, Math.min(4, Math.max(widthRatio, heightRatio)));
        item.width = Math.max(60, Math.round(this.interaction.originalWidth * ratio));
        item.height = Math.max(30, Math.round(this.interaction.originalHeight * ratio));
        item.settings = WAE.normalizeTextSettings(Object.assign({}, item.settings, {
          fontSize: Math.round(Math.max(10, Math.min(72, this.interaction.originalFontSize * ratio)))
        }));
      }
      this.render();
    }

    onPointerUp(event) {
      if (!this.interaction) return;
      event.preventDefault();
      event.stopPropagation();
      document.documentElement.style.userSelect = this.previousUserSelect || "";
      const interaction = this.interaction;
      this.interaction = null;
      const item = this.getItem(interaction.id);
      if (item && interaction.moved) {
        if (interaction.type === "move") {
          this.pushAction({
            type: "text-move",
            id: item.id,
            before: { x: interaction.originalX, y: interaction.originalY },
            after: { x: item.x, y: item.y }
          });
        } else {
          this.pushAction({ type: "text-edit", before: interaction.before, after: this.cloneItem(item) });
        }
      }
      if (item && interaction.resumeEditAfter && !String(item.text || "").trim()) {
        window.setTimeout(() => this.startEdit(item.id, interaction.resumeEditAfter), 0);
      }
    }

    createItem(x, y, text) {
      return {
        id: String(this.nextId++),
        x,
        y,
        width: 160,
        height: 36,
        text,
        settings: WAE.normalizeTextSettings(this.state.textSettings)
      };
    }

    startEdit(id, options = {}) {
      const item = this.getItem(id);
      if (!item) return;
      this.commitEdit();
      this.selectedId = id;
      this.render();
      const box = this.layer.querySelector(`[data-text-id="${this.escapeSelectorValue(id)}"]`);
      const element = box && box.querySelector(".wae-text-content");
      if (!box || !element) return;
      this.editing = {
        id,
        before: this.cloneItem(item),
        isNew: Boolean(options.isNew)
      };
      element.contentEditable = "true";
      box.classList.add("wae-text-editing");
      element.focus({ preventScroll: true });
      const range = document.createRange();
      range.selectNodeContents(element);
      range.collapse(false);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      setTimeout(() => {
        const outside = (event) => {
          if (!this.editing) return;
          if (event.composedPath && event.composedPath().includes(box)) return;
          this.commitEdit();
          document.removeEventListener("pointerdown", outside, true);
        };
        document.addEventListener("pointerdown", outside, true);
        this.editing.outside = outside;
      }, 0);
    }

    commitEdit() {
      if (!this.editing) return;
      const edit = this.editing;
      const item = this.getItem(edit.id);
      const box = item && this.layer.querySelector(`[data-text-id="${this.escapeSelectorValue(edit.id)}"]`);
      const element = box && box.querySelector(".wae-text-content");
      if (edit.outside) document.removeEventListener("pointerdown", edit.outside, true);
      this.editing = null;
      if (!item || !element) return;
      const nextText = element.innerText.replace(/\n+$/g, "");
      if (!nextText.trim()) {
        this.removeItem(item.id);
        this.selectedId = null;
        this.render();
        this.onChange();
        return;
      }
      const before = edit.before;
      item.text = nextText;
      this.render();
      if (edit.isNew) {
        this.pushAction({ type: "text-add", item: this.cloneItem(item) });
      } else if (before.text !== item.text) {
        this.pushAction({ type: "text-edit", before, after: this.cloneItem(item) });
      }
    }

    currentEditingText() {
      if (!this.editing) return "";
      const box = this.layer.querySelector(`[data-text-id="${this.escapeSelectorValue(this.editing.id)}"]`);
      const element = box && box.querySelector(".wae-text-content");
      return element ? element.innerText.replace(/\n+$/g, "") : "";
    }

    stopEditingWithoutCommit() {
      if (!this.editing) return;
      if (this.editing.outside) document.removeEventListener("pointerdown", this.editing.outside, true);
      this.editing = null;
      this.render();
    }

    cancelEdit() {
      if (!this.editing) return;
      const edit = this.editing;
      if (edit.outside) document.removeEventListener("pointerdown", edit.outside, true);
      const item = this.getItem(edit.id);
      this.editing = null;
      if (edit.isNew) {
        this.removeItem(edit.id);
        this.selectedId = null;
      } else if (item) {
        Object.assign(item, this.cloneItem(edit.before));
      }
      this.render();
    }

    deleteSelected() {
      this.deleteItem(this.selectedId);
    }

    deleteItem(id) {
      if (this.editing && this.editing.id === String(id)) {
        if (this.editing.outside) document.removeEventListener("pointerdown", this.editing.outside, true);
        this.editing = null;
      }
      const item = this.getItem(id);
      if (!item) return;
      this.removeItem(item.id);
      this.selectedId = null;
      this.render();
      this.pushAction({ type: "text-delete", item: this.cloneItem(item) });
    }

    applyTextSettings(settings) {
      this.state.textSettings = WAE.normalizeTextSettings(Object.assign({}, this.state.textSettings, settings));
      if (this.selectedId) {
        const item = this.getItem(this.selectedId);
        if (item && !this.editing) {
          const before = this.cloneItem(item);
          item.settings = WAE.normalizeTextSettings(Object.assign({}, item.settings, settings));
          this.render();
          this.pushAction({ type: "text-edit", before, after: this.cloneItem(item) });
        }
      }
    }

    applyAction(action) {
      if (action.type === "text-add") {
        this.upsertItem(action.item);
      } else if (action.type === "text-delete") {
        this.removeItem(action.item.id);
      } else if (action.type === "text-edit") {
        this.upsertItem(action.after);
      } else if (action.type === "text-move") {
        const item = this.getItem(action.id);
        if (item) Object.assign(item, action.after);
      } else if (action.type === "text-clear") {
        this.state.textItems = [];
      }
      this.render();
    }

    applyInverse(action) {
      if (action.type === "text-add") {
        this.removeItem(action.item.id);
      } else if (action.type === "text-delete") {
        this.upsertItem(action.item);
      } else if (action.type === "text-edit") {
        this.upsertItem(action.before);
      } else if (action.type === "text-move") {
        const item = this.getItem(action.id);
        if (item) Object.assign(item, action.before);
      } else if (action.type === "text-clear") {
        this.state.textItems = action.previous.map((item) => this.cloneItem(item));
      }
      this.render();
    }

    pushAction(action) {
      this.state.undoStack.push(action);
      this.state.redoStack = [];
      this.onChange();
    }

    render() {
      const width = Math.max(document.documentElement.scrollWidth, window.innerWidth);
      const height = Math.max(document.documentElement.scrollHeight, window.innerHeight);
      this.layer.style.width = `${width}px`;
      this.layer.style.height = `${height}px`;
      this.layer.innerHTML = "";
      const textMode = this.state.mode === "draw" && this.state.tool === "text";
      const selectMode = this.state.mode === "draw" && this.state.tool === "select";
      const interactiveMode = textMode || selectMode;
      this.layer.style.pointerEvents = textMode ? "auto" : "none";
      this.state.textItems.forEach((item) => this.renderItem(item, textMode, interactiveMode));
    }

    renderItem(item, textMode, interactiveMode) {
      const box = document.createElement("div");
      const content = document.createElement("div");
      box.className = "wae-text-box";
      box.dataset.textId = item.id;
      content.className = "wae-text-content";
      content.textContent = item.text || "";
      const settings = WAE.normalizeTextSettings(item.settings || this.state.textSettings);
      Object.assign(box.style, {
        left: `${this.viewportX(item.x)}px`,
        top: `${this.viewportY(item.y)}px`,
        width: `${this.getItemWidth(item)}px`,
        height: `${this.getItemHeight(item)}px`,
        color: settings.color,
        fontSize: `${settings.fontSize}px`,
        fontWeight: settings.fontWeight,
        lineHeight: "1.35",
        background: "transparent",
        pointerEvents: interactiveMode || this.editing ? "auto" : "none"
      });
      box.appendChild(content);
      if (!this.captureHiddenState && textMode) {
        box.appendChild(this.createTextControl("button", "wae-text-delete wae-text-control", "delete", item.id, "×"));
        box.appendChild(this.createTextControl("span", "wae-text-resize-right wae-text-control", "resize-right", item.id));
        box.appendChild(this.createTextControl("span", "wae-text-resize-bottom wae-text-control", "resize-bottom", item.id));
        box.appendChild(this.createTextControl("span", "wae-text-scale wae-text-control", "scale", item.id));
      }
      box.classList.toggle("wae-text-selected", interactiveMode && this.selectedId === item.id && !this.captureHiddenState);
      if (this.editing && this.editing.id === item.id) {
        box.classList.add("wae-text-editing");
      }
      box.classList.toggle("wae-text-empty", !String(item.text || "").trim());
      this.layer.appendChild(box);
    }

    createTextControl(tag, className, handle, id, text) {
      const element = document.createElement(tag);
      element.className = className;
      element.dataset.textHandle = handle;
      element.dataset.textId = id;
      if (handle === "delete") {
        element.type = "button";
        element.textContent = text || "";
        element.title = "텍스트 삭제";
        element.setAttribute("aria-label", "텍스트 삭제");
      }
      return element;
    }

    cloneItem(item) {
      return {
        id: String(item.id),
        x: Number(item.x),
        y: Number(item.y),
        width: Number.isFinite(Number(item.width)) ? Math.max(60, Number(item.width)) : 160,
        height: Number.isFinite(Number(item.height)) ? Math.max(30, Number(item.height)) : 36,
        text: String(item.text || ""),
        settings: WAE.normalizeTextSettings(item.settings)
      };
    }

    getItem(id) {
      return this.state.textItems.find((item) => item.id === String(id));
    }

    upsertItem(item) {
      const clone = this.cloneItem(item);
      const index = this.state.textItems.findIndex((existing) => existing.id === clone.id);
      if (index === -1) this.state.textItems.push(clone);
      else this.state.textItems[index] = clone;
      this.nextId = Math.max(this.nextId, Number(clone.id) + 1 || this.nextId);
    }

    removeItem(id) {
      const index = this.state.textItems.findIndex((item) => item.id === String(id));
      if (index !== -1) this.state.textItems.splice(index, 1);
    }

    selectItem(id) {
      this.selectedId = String(id);
      this.updateSelectionClasses();
    }

    updateSelectionClasses() {
      this.layer.querySelectorAll(".wae-text-box").forEach((box) => {
        const textMode = this.state.mode === "draw" && this.state.tool === "text";
        const selectMode = this.state.mode === "draw" && this.state.tool === "select";
        const interactiveMode = textMode || selectMode;
        box.classList.toggle("wae-text-selected", interactiveMode && this.selectedId === box.dataset.textId && !this.captureHiddenState);
        box.style.pointerEvents = interactiveMode || this.editing ? "auto" : "none";
      });
    }

    getItemWidth(item) {
      return Number.isFinite(Number(item.width)) ? Math.max(60, Number(item.width)) : 160;
    }

    getItemHeight(item) {
      return Number.isFinite(Number(item.height)) ? Math.max(30, Number(item.height)) : 36;
    }

    documentPoint(event) {
      const offset = WAE.getActiveScrollOffset();
      return {
        x: event.clientX + window.scrollX + offset.x,
        y: event.clientY + window.scrollY + offset.y
      };
    }

    viewportX(x) {
      return Number(x) - WAE.getActiveScrollOffset().x;
    }

    viewportY(y) {
      return Number(y) - WAE.getActiveScrollOffset().y;
    }

    escapeSelectorValue(value) {
      if (window.CSS && typeof window.CSS.escape === "function") {
        return window.CSS.escape(String(value));
      }
      return String(value).replace(/["\\]/g, "\\$&");
    }

    isDoublePointerDown(event, id) {
      if (!this.lastTextPointerDown || this.lastTextPointerDown.id !== String(id)) return false;
      const elapsed = Date.now() - this.lastTextPointerDown.time;
      const dx = Math.abs(event.clientX - this.lastTextPointerDown.x);
      const dy = Math.abs(event.clientY - this.lastTextPointerDown.y);
      return elapsed < 450 && dx < 6 && dy < 6;
    }
  }

  WAE.TextManager = TextManager;
})();

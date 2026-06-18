(function () {
  "use strict";

  const WAE = window.WebAnnotationExtension;

  class DrawingManager {
    constructor({ state, canvasManager, onChange }) {
      this.state = state;
      this.canvasManager = canvasManager;
      this.onChange = onChange;
      this.nextStrokeId = 1;
      this.activeErase = null;
      this.bound = false;
      this.handlers = {
        pointerdown: (event) => this.onPointerDown(event),
        pointermove: (event) => this.onPointerMove(event),
        pointerup: (event) => this.onPointerUp(event),
        pointercancel: (event) => this.onPointerUp(event),
        wheel: (event) => this.forwardWheel(event)
      };
    }

    loadStrokes(strokes) {
      this.state.strokes = strokes.map((stroke) => this.normalizeStroke(stroke)).filter(Boolean);
      this.nextStrokeId = this.state.strokes.reduce((max, stroke) => Math.max(max, stroke.id || 0), 0) + 1;
      this.state.undoStack = [];
      this.state.redoStack = [];
      this.canvasManager.render();
    }

    normalizeStroke(stroke) {
      if (!stroke || !Array.isArray(stroke.points)) {
        return null;
      }
      const points = stroke.points
        .map((point) => ({
          x: Number(point.x),
          y: Number(point.y),
          pressure: this.normalizePressure(point.pressure),
          time: Number.isFinite(Number(point.time)) ? Number(point.time) : Date.now()
        }))
        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
      if (!points.length) {
        return null;
      }
      return {
        id: Number.isFinite(Number(stroke.id)) ? Number(stroke.id) : this.nextStrokeId++,
        tool: stroke.tool === "highlighter" ? "highlighter" : "pen",
        penType: stroke.tool === "pen" ? (stroke.penType || "ballpoint") : undefined,
        color: typeof stroke.color === "string" ? stroke.color : WAE.CONFIG.defaultColor,
        width: Number.isFinite(Number(stroke.width)) ? Number(stroke.width) : WAE.CONFIG.defaultWidth,
        opacity: Number.isFinite(Number(stroke.opacity)) ? Number(stroke.opacity) : 1,
        pressureSensitivity: Number.isFinite(Number(stroke.pressureSensitivity)) ? Number(stroke.pressureSensitivity) : 0,
        roundness: Number.isFinite(Number(stroke.roundness)) ? Number(stroke.roundness) : 1,
        points
      };
    }

    bind() {
      if (this.bound) {
        return;
      }
      const canvas = this.canvasManager.canvas;
      canvas.addEventListener("pointerdown", this.handlers.pointerdown);
      canvas.addEventListener("pointermove", this.handlers.pointermove);
      canvas.addEventListener("pointerup", this.handlers.pointerup);
      canvas.addEventListener("pointercancel", this.handlers.pointercancel);
      canvas.addEventListener("wheel", this.handlers.wheel, { passive: false });
      this.bound = true;
    }

    destroy() {
      const canvas = this.canvasManager.canvas;
      if (this.bound) {
        canvas.removeEventListener("pointerdown", this.handlers.pointerdown);
        canvas.removeEventListener("pointermove", this.handlers.pointermove);
        canvas.removeEventListener("pointerup", this.handlers.pointerup);
        canvas.removeEventListener("pointercancel", this.handlers.pointercancel);
        canvas.removeEventListener("wheel", this.handlers.wheel, { passive: false });
      }
      this.bound = false;
      this.state.activeStroke = null;
      this.state.isErasing = false;
      this.activeErase = null;
    }

    onPointerDown(event) {
      if (!this.state.enabled || this.state.mode !== "draw" || event.button !== 0) {
        return;
      }
      event.preventDefault();
      this.canvasManager.canvas.setPointerCapture(event.pointerId);

      if (this.state.tool === "eraser") {
        this.state.isErasing = true;
        this.activeErase = { ids: new Set(), items: [] };
        this.eraseAt(this.canvasManager.documentPoint(event, this.getPointMeta(event)));
        this.canvasManager.render();
        return;
      }

      const tool = this.state.tool === "highlighter" ? "highlighter" : "pen";
      const penSettings = this.state.penSettings[this.state.selectedPenType] || WAE.CONFIG.defaultPenSettings.ballpoint;
      this.state.activeStroke = {
        id: this.nextStrokeId++,
        tool,
        penType: tool === "pen" ? this.state.selectedPenType : undefined,
        color: tool === "pen" ? penSettings.color : this.state.color,
        width: tool === "highlighter" ? this.state.width * WAE.CONFIG.highlighterWidthMultiplier : this.state.width,
        opacity: tool === "highlighter" ? WAE.CONFIG.highlighterOpacity : penSettings.opacity,
        pressureSensitivity: tool === "pen" ? penSettings.pressureSensitivity : 0,
        roundness: tool === "pen" ? penSettings.roundness : 1,
        points: [this.canvasManager.documentPoint(event, this.getPointMeta(event))]
      };
      if (tool === "pen") {
        this.state.activeStroke.width = penSettings.width;
      }
      this.state.strokes.push(this.state.activeStroke);
      this.canvasManager.render();
    }

    onPointerMove(event) {
      if (!this.state.enabled || (!this.state.activeStroke && !this.state.isErasing)) {
        return;
      }
      event.preventDefault();
      if (this.state.isErasing) {
        this.eachPointerSample(event, (sample) => this.eraseAt(this.canvasManager.documentPoint(sample, this.getPointMeta(sample))));
        this.canvasManager.requestRender();
        return;
      }
      this.eachPointerSample(event, (sample) => {
        this.appendPoint(this.state.activeStroke, this.canvasManager.documentPoint(sample, this.getPointMeta(sample)));
      });
      this.canvasManager.requestRender();
    }

    onPointerUp(event) {
      if (!this.state.enabled || (!this.state.activeStroke && !this.state.isErasing)) {
        return;
      }
      event.preventDefault();
      if (this.canvasManager.canvas.hasPointerCapture(event.pointerId)) {
        this.canvasManager.canvas.releasePointerCapture(event.pointerId);
      }

      if (this.state.activeStroke) {
        this.appendPoint(this.state.activeStroke, this.canvasManager.documentPoint(event, this.getPointMeta(event)));
        this.pushAction({ type: "add", stroke: WAE.cloneStroke(this.state.activeStroke) });
        this.canvasManager.render();
      }
      if (this.state.isErasing && this.activeErase && this.activeErase.items.length) {
        this.pushAction({ type: "erase", items: this.activeErase.items.map((item) => ({ index: item.index, stroke: WAE.cloneStroke(item.stroke) })) });
        this.canvasManager.render();
      }

      this.state.activeStroke = null;
      this.state.isErasing = false;
      this.activeErase = null;
    }

    forwardWheel(event) {
      window.scrollBy({ top: event.deltaY, left: event.deltaX, behavior: "auto" });
    }

    getPointMeta(event) {
      const now = Date.now();
      const active = this.state.activeStroke;
      const previous = active && active.points.length ? active.points[active.points.length - 1] : null;
      let pressure = Number(event.pressure);

      if (event.pointerType === "pen" && Number.isFinite(pressure) && pressure > 0) {
        pressure = WAE.clamp(pressure, 0.05, 1);
      } else if (event.pointerType === "mouse" && previous) {
        const distance = Math.hypot(event.clientX + window.scrollX - previous.x, event.clientY + window.scrollY - previous.y);
        const elapsed = Math.max(1, now - previous.time);
        const speed = distance / elapsed;
        pressure = WAE.clamp(1 - speed / 2.2, 0.2, 0.95);
      } else {
        pressure = 0.5;
      }

      return { pressure, time: now };
    }

    eachPointerSample(event, callback) {
      const samples = typeof event.getCoalescedEvents === "function" ? event.getCoalescedEvents() : [];
      (samples.length ? samples : [event]).forEach(callback);
    }

    normalizePressure(value) {
      const pressure = Number(value);
      return Number.isFinite(pressure) && pressure > 0 ? WAE.clamp(pressure, 0.05, 1) : 0.5;
    }

    appendPoint(stroke, point) {
      const previous = stroke.points[stroke.points.length - 1];
      if (!previous) {
        stroke.points.push(point);
        return;
      }

      const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
      const step = Math.max(2, Math.min(8, (Number(stroke.width) || WAE.CONFIG.defaultWidth) * 0.65));
      const segments = Math.max(1, Math.ceil(distance / step));

      for (let index = 1; index <= segments; index += 1) {
        const t = index / segments;
        stroke.points.push({
          x: previous.x + (point.x - previous.x) * t,
          y: previous.y + (point.y - previous.y) * t,
          pressure: previous.pressure + (point.pressure - previous.pressure) * t,
          time: Math.round(previous.time + (point.time - previous.time) * t)
        });
      }
    }

    pushAction(action) {
      this.state.undoStack.push(action);
      this.state.redoStack = [];
      this.onChange();
    }

    undo() {
      const action = this.state.undoStack.pop();
      if (!action) {
        return;
      }
      this.applyInverse(action);
      this.state.redoStack.push(action);
      this.canvasManager.render();
      this.onChange();
    }

    redo() {
      const action = this.state.redoStack.pop();
      if (!action) {
        return;
      }
      this.apply(action);
      this.state.undoStack.push(action);
      this.canvasManager.render();
      this.onChange();
    }

    apply(action) {
      if (action.type === "add") {
        this.state.strokes.push(WAE.cloneStroke(action.stroke));
      } else if (action.type === "erase") {
        action.items.forEach((item) => this.removeStrokeById(item.stroke.id));
      } else if (action.type === "clear") {
        this.state.strokes = [];
        if (this.textManager) {
          this.state.textItems = [];
          this.textManager.render();
        }
      } else if (action.type && action.type.indexOf("text-") === 0 && this.textManager) {
        this.textManager.applyAction(action);
      }
    }

    applyInverse(action) {
      if (action.type === "add") {
        this.removeStrokeById(action.stroke.id);
      } else if (action.type === "erase") {
        this.restoreErased(action.items);
      } else if (action.type === "clear") {
        this.state.strokes = action.previous.map((stroke) => WAE.cloneStroke(stroke));
        if (this.textManager) {
          this.state.textItems = (action.previousText || []).map((item) => this.textManager.cloneItem(item));
          this.textManager.render();
        }
      } else if (action.type && action.type.indexOf("text-") === 0 && this.textManager) {
        this.textManager.applyInverse(action);
      }
    }

    clearAll(skipConfirm) {
      const hasText = this.state.textItems && this.state.textItems.length;
      if ((!this.state.strokes.length && !hasText) || (!skipConfirm && !window.confirm("현재 페이지의 모든 필기와 텍스트를 지울까요?"))) {
        return;
      }
      const previous = this.state.strokes.map((stroke) => WAE.cloneStroke(stroke));
      const previousText = hasText && this.textManager ? this.state.textItems.map((item) => this.textManager.cloneItem(item)) : [];
      this.state.strokes = [];
      if (this.textManager) {
        this.state.textItems = [];
        this.textManager.render();
      }
      this.pushAction({ type: "clear", previous, previousText });
    }

    removeStrokeById(id) {
      const index = this.state.strokes.findIndex((stroke) => stroke.id === id);
      if (index !== -1) {
        this.state.strokes.splice(index, 1);
      }
    }

    restoreErased(items) {
      items
        .slice()
        .sort((a, b) => a.index - b.index)
        .forEach((item) => {
          if (this.state.strokes.some((stroke) => stroke.id === item.stroke.id)) {
            return;
          }
          this.state.strokes.splice(Math.min(item.index, this.state.strokes.length), 0, WAE.cloneStroke(item.stroke));
        });
    }

    eraseAt(point) {
      const radius = this.state.eraserRadius || WAE.CONFIG.eraserRadius;
      for (let index = this.state.strokes.length - 1; index >= 0; index -= 1) {
        const stroke = this.state.strokes[index];
        if (this.activeErase.ids.has(stroke.id)) {
          continue;
        }
        if (this.strokeHitsPoint(stroke, point, radius)) {
          this.activeErase.ids.add(stroke.id);
          this.activeErase.items.push({ index, stroke: WAE.cloneStroke(stroke) });
          this.state.strokes.splice(index, 1);
        }
      }
    }

    strokeHitsPoint(stroke, point, radius) {
      if (stroke.points.length === 1) {
        return Math.hypot(stroke.points[0].x - point.x, stroke.points[0].y - point.y) <= radius + stroke.width / 2;
      }
      for (let index = 1; index < stroke.points.length; index += 1) {
        const distance = this.distanceToSegment(point, stroke.points[index - 1], stroke.points[index]);
        if (distance <= radius + stroke.width / 2) {
          return true;
        }
      }
      return false;
    }

    distanceToSegment(point, start, end) {
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const lengthSquared = dx * dx + dy * dy;
      if (lengthSquared === 0) {
        return Math.hypot(point.x - start.x, point.y - start.y);
      }
      const t = WAE.clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1);
      return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
    }
  }

  WAE.DrawingManager = DrawingManager;
})();

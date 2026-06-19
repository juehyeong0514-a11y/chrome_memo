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
      this.activeSelectionMove = null;
      this.straightLineMode = false;
      this.activeFreehandPoints = null;
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
      this.activeSelectionMove = null;
      this.straightLineMode = false;
      this.activeFreehandPoints = null;
      this.state.selectionMove = null;
    }

    onPointerDown(event) {
      if (!this.state.enabled || this.state.mode !== "draw" || event.button !== 0) {
        return;
      }
      WAE.activateScrollContextFromPoint(event.clientX, event.clientY);
      event.preventDefault();
      this.canvasManager.canvas.setPointerCapture(event.pointerId);

      if (this.state.tool === "select") {
        this.onSelectPointerDown(event);
        return;
      }

      this.state.selectedStrokeId = null;
      if (this.state.tool === "eraser") {
        this.state.isErasing = true;
        this.activeErase = { ids: new Set(), items: [] };
        this.eraseAt(this.canvasManager.documentPoint(event, this.getPointMeta(event)));
        this.canvasManager.render();
        return;
      }

      const tool = this.state.tool === "highlighter" ? "highlighter" : "pen";
      const penSettings = this.state.penSettings[this.state.selectedPenType] || WAE.CONFIG.defaultPenSettings.ballpoint;
      const startPoint = this.canvasManager.documentPoint(event, this.getPointMeta(event));
      this.activeFreehandPoints = [startPoint];
      this.state.activeStroke = {
        id: this.nextStrokeId++,
        tool,
        penType: tool === "pen" ? this.state.selectedPenType : undefined,
        color: penSettings.color,
        width: tool === "highlighter" ? penSettings.width * WAE.CONFIG.highlighterWidthMultiplier : penSettings.width,
        opacity: tool === "highlighter" ? WAE.CONFIG.highlighterOpacity : penSettings.opacity,
        pressureSensitivity: tool === "pen" ? penSettings.pressureSensitivity : 0,
        roundness: tool === "pen" ? penSettings.roundness : 1,
        points: [startPoint]
      };
      this.state.strokes.push(this.state.activeStroke);
      this.canvasManager.render();
    }

    onPointerMove(event) {
      if (!this.state.enabled || (!this.state.activeStroke && !this.state.isErasing && !this.activeSelectionMove)) {
        return;
      }
      event.preventDefault();
      if (this.activeSelectionMove) {
        const point = this.canvasManager.documentPoint(event);
        this.moveSelectedStroke(point.x - this.activeSelectionMove.startX, point.y - this.activeSelectionMove.startY);
        this.canvasManager.requestRender();
        return;
      }
      if (this.state.isErasing) {
        this.eachPointerSample(event, (sample) => this.eraseAt(this.canvasManager.documentPoint(sample, this.getPointMeta(sample))));
        this.canvasManager.requestRender();
        return;
      }
      this.eachPointerSample(event, (sample) => {
        this.appendActivePoint(this.canvasManager.documentPoint(sample, this.getPointMeta(sample)));
      });
      this.canvasManager.requestRender();
    }

    onPointerUp(event) {
      if (!this.state.enabled || (!this.state.activeStroke && !this.state.isErasing && !this.activeSelectionMove)) {
        return;
      }
      event.preventDefault();
      if (this.canvasManager.canvas.hasPointerCapture(event.pointerId)) {
        this.canvasManager.canvas.releasePointerCapture(event.pointerId);
      }

      if (this.activeSelectionMove) {
        const move = this.activeSelectionMove;
        const stroke = this.getStrokeById(move.id);
        if (stroke && move.moved) {
          this.pushAction({ type: "move-stroke", id: stroke.id, before: move.before, after: WAE.cloneStroke(stroke) });
        }
        this.activeSelectionMove = null;
        this.state.selectionMove = null;
        this.canvasManager.render();
        return;
      }

      if (this.state.activeStroke) {
        this.appendActivePoint(this.canvasManager.documentPoint(event, this.getPointMeta(event)));
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
      this.activeFreehandPoints = null;
      this.straightLineMode = false;
    }

    onSelectPointerDown(event) {
      const point = this.canvasManager.documentPoint(event);
      const stroke = this.findStrokeAt(point);
      this.state.activeStroke = null;
      this.state.isErasing = false;
      this.activeErase = null;
      this.state.selectedStrokeId = stroke ? stroke.id : null;
      if (this.textManager) {
        this.textManager.selectedId = null;
        this.textManager.updateSelectionClasses();
      }
      if (!stroke) {
        this.activeSelectionMove = null;
        this.state.selectionMove = null;
        this.canvasManager.render();
        return;
      }
      this.activeSelectionMove = {
        id: stroke.id,
        startX: point.x,
        startY: point.y,
        before: WAE.cloneStroke(stroke),
        originalPoints: stroke.points.map((item) => Object.assign({}, item)),
        moved: false
      };
      this.state.selectionMove = this.activeSelectionMove;
      this.canvasManager.render();
    }

    findStrokeAt(point) {
      const radius = 8;
      for (let index = this.state.strokes.length - 1; index >= 0; index -= 1) {
        const stroke = this.state.strokes[index];
        if (this.strokeHitsPoint(stroke, point, radius)) {
          return stroke;
        }
      }
      return null;
    }

    moveSelectedStroke(dx, dy) {
      const move = this.activeSelectionMove;
      if (!move) return;
      const stroke = this.getStrokeById(move.id);
      if (!stroke) return;
      if (Math.abs(dx) + Math.abs(dy) > 2) {
        move.moved = true;
      }
      stroke.points = move.originalPoints.map((point) => Object.assign({}, point, {
        x: point.x + dx,
        y: point.y + dy
      }));
    }

    forwardWheel(event) {
      WAE.forwardWheelScroll(event);
    }

    getPointMeta(event) {
      const now = Date.now();
      const active = this.state.activeStroke;
      const previous = active && active.points.length ? active.points[active.points.length - 1] : null;
      let pressure = Number(event.pressure);

      if (event.pointerType === "pen" && Number.isFinite(pressure) && pressure > 0) {
        pressure = WAE.clamp(pressure, 0.05, 1);
      } else if (event.pointerType === "mouse" && previous) {
        const offset = WAE.getActiveScrollOffset();
        const distance = Math.hypot(event.clientX + window.scrollX + offset.x - previous.x, event.clientY + window.scrollY + offset.y - previous.y);
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

    setStraightLineMode(enabled) {
      const next = Boolean(enabled);
      if (this.straightLineMode === next) {
        return;
      }
      this.straightLineMode = next;
      this.refreshActiveStrokeShape();
      if (this.state.activeStroke) {
        this.canvasManager.requestRender();
      }
    }

    appendActivePoint(point) {
      if (!this.state.activeStroke) return;
      if (!this.activeFreehandPoints) {
        this.activeFreehandPoints = this.state.activeStroke.points.map((item) => Object.assign({}, item));
      }
      this.appendPointToArray(this.activeFreehandPoints, point, this.state.activeStroke.width);
      this.refreshActiveStrokeShape();
    }

    refreshActiveStrokeShape() {
      const stroke = this.state.activeStroke;
      if (!stroke || !this.activeFreehandPoints || !this.activeFreehandPoints.length) {
        return;
      }
      stroke.points = this.straightLineMode
        ? this.straightLinePoints(stroke, this.activeFreehandPoints)
        : this.activeFreehandPoints.map((point) => Object.assign({}, point));
    }

    straightLinePoints(stroke, sourcePoints) {
      if (!sourcePoints || sourcePoints.length < 2) {
        return (sourcePoints || []).map((point) => Object.assign({}, point));
      }
      const start = sourcePoints[0];
      const end = sourcePoints[sourcePoints.length - 1];
      const distance = Math.hypot(end.x - start.x, end.y - start.y);
      const step = Math.max(2, Math.min(8, (Number(stroke.width) || WAE.CONFIG.defaultWidth) * 0.65));
      const segments = Math.max(1, Math.ceil(distance / step));
      const points = [];
      for (let index = 0; index <= segments; index += 1) {
        const t = index / segments;
        points.push({
          x: start.x + (end.x - start.x) * t,
          y: start.y + (end.y - start.y) * t,
          pressure: start.pressure + ((end.pressure || start.pressure) - start.pressure) * t,
          time: Math.round(start.time + ((end.time || start.time) - start.time) * t)
        });
      }
      return points;
    }

    normalizePressure(value) {
      const pressure = Number(value);
      return Number.isFinite(pressure) && pressure > 0 ? WAE.clamp(pressure, 0.05, 1) : 0.5;
    }

    appendPoint(stroke, point) {
      this.appendPointToArray(stroke.points, point, stroke.width);
    }

    appendPointToArray(points, point, width) {
      const previous = points[points.length - 1];
      if (!previous) {
        points.push(point);
        return;
      }

      const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
      const step = Math.max(2, Math.min(8, (Number(width) || WAE.CONFIG.defaultWidth) * 0.65));
      const segments = Math.max(1, Math.ceil(distance / step));

      for (let index = 1; index <= segments; index += 1) {
        const t = index / segments;
        points.push({
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
      } else if (action.type === "move-stroke") {
        this.replaceStroke(action.after);
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
      } else if (action.type === "move-stroke") {
        this.replaceStroke(action.before);
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
      if (this.textManager) {
        this.textManager.cancelEdit();
        this.textManager.interaction = null;
        this.textManager.selectedId = null;
      }
      this.state.strokes = [];
      this.state.activeStroke = null;
      this.state.isErasing = false;
      this.state.selectedStrokeId = null;
      this.state.selectionMove = null;
      this.activeErase = null;
      this.activeSelectionMove = null;
      this.activeFreehandPoints = null;
      if (this.textManager) {
        this.state.textItems = [];
        this.textManager.render();
      }
      this.canvasManager.render();
      this.pushAction({ type: "clear", previous, previousText });
    }

    removeStrokeById(id) {
      const index = this.state.strokes.findIndex((stroke) => stroke.id === id);
      if (index !== -1) {
        this.state.strokes.splice(index, 1);
      }
      if (String(this.state.selectedStrokeId) === String(id)) {
        this.state.selectedStrokeId = null;
      }
    }

    getStrokeById(id) {
      return this.state.strokes.find((stroke) => String(stroke.id) === String(id));
    }

    replaceStroke(stroke) {
      const clone = WAE.cloneStroke(stroke);
      const index = this.state.strokes.findIndex((item) => String(item.id) === String(clone.id));
      if (index === -1) {
        this.state.strokes.push(clone);
      } else {
        this.state.strokes[index] = clone;
      }
      this.state.selectedStrokeId = clone.id;
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

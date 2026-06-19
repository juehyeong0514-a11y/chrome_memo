(function () {
  "use strict";

  const WAE = window.WebAnnotationExtension;

  class CanvasManager {
    constructor({ getStrokes, getHidden, getSelectedStrokeId, getEraserPreviewState }) {
      this.getStrokes = getStrokes;
      this.getHidden = getHidden;
      this.getSelectedStrokeId = getSelectedStrokeId || (() => null);
      this.getEraserPreviewState = getEraserPreviewState || (() => ({ visible: false, size: 24 }));
      this.scroll = WAE.getScrollAdapter();
      this.canvas = document.createElement("canvas");
      this.canvas.className = "wae-canvas";
      this.eraserPreview = document.createElement("div");
      this.eraserPreview.className = "wae-tool-cursor-preview";
      this.eraserPreview.innerHTML = '<span class="wae-cursor-actual"></span><span class="wae-cursor-guide"></span><span class="wae-cursor-center"></span>';
      this.ctx = this.canvas.getContext("2d");
      this.resizeFrame = 0;
      this.renderFrame = 0;
      this.dprQuery = null;
      this.resizeObserver = null;
      this.mutationObserver = null;
      this.mounted = false;
      this.boundPreview = false;
      this.resizeHandler = () => this.scheduleResize();
      this.scrollHandler = () => this.requestRender();
      this.previewHandlers = {
        pointermove: (event) => this.updateEraserPreview(event),
        pointerdown: (event) => this.updateEraserPreview(event),
        pointerleave: () => this.hideEraserPreview(),
        pointercancel: () => this.hideEraserPreview()
      };
    }

    mount() {
      if (this.mounted) {
        return;
      }
      if (!document.documentElement.contains(this.canvas)) {
        document.documentElement.appendChild(this.canvas);
      }
      if (!document.documentElement.contains(this.eraserPreview)) {
        document.documentElement.appendChild(this.eraserPreview);
      }
      this.applyDocumentCanvasStyle();
      this.applyEraserPreviewStyle();
      this.resize();
      this.installObservers();
      this.bindEraserPreview();
      window.addEventListener("resize", this.resizeHandler);
      window.addEventListener("scroll", this.scrollHandler, true);
      window.addEventListener("wae:scroll-context-change", this.scrollHandler);
      this.watchDevicePixelRatio();
      this.mounted = true;
    }

    applyEraserPreviewStyle() {
      Object.assign(this.eraserPreview.style, {
        position: "fixed",
        left: "0",
        top: "0",
        width: "24px",
        height: "24px",
        border: "1.5px solid rgba(15,23,42,.78)",
        background: "rgba(255,255,255,.12)",
        borderRadius: "50%",
        boxSizing: "border-box",
        transform: "translate(-9999px,-9999px)",
        pointerEvents: "none",
        zIndex: "2147483645",
        display: "none"
      });
    }

    applyDocumentCanvasStyle() {
      Object.assign(this.canvas.style, {
        position: "absolute",
        left: "0",
        top: "0",
        zIndex: "2147483646",
        pointerEvents: "none",
        touchAction: "none"
      });
    }

    setDrawingMode(enabled) {
      this.canvas.classList.toggle("wae-drawing-mode", enabled);
      this.canvas.style.pointerEvents = enabled ? "auto" : "none";
      this.canvas.dataset.waeMode = enabled ? "draw" : "navigate";
      if (!enabled) {
        this.hideEraserPreview();
      }
    }

    setTool(tool) {
      this.canvas.dataset.waeTool = tool || "";
    }

    setVisible(visible) {
      this.canvas.style.display = visible ? "" : "none";
      if (!visible) {
        this.setDrawingMode(false);
        this.hideEraserPreview();
      } else {
        this.render();
      }
    }

    bindEraserPreview() {
      if (this.boundPreview) {
        return;
      }
      this.canvas.addEventListener("pointermove", this.previewHandlers.pointermove);
      this.canvas.addEventListener("pointerdown", this.previewHandlers.pointerdown);
      this.canvas.addEventListener("pointerleave", this.previewHandlers.pointerleave);
      this.canvas.addEventListener("pointercancel", this.previewHandlers.pointercancel);
      this.boundPreview = true;
    }

    updateEraserPreview(event) {
      const state = this.getEraserPreviewState();
      if (!state || !state.visible) {
        this.hideEraserPreview();
        return;
      }
      const tool = state.tool || "eraser";
      const size = Math.max(1, Math.min(140, Number(state.size) || 24));
      const guideSize = Math.max(size, 12);
      const color = state.color || (tool === "eraser" ? "#f87171" : "#111111");
      const actual = this.eraserPreview.querySelector(".wae-cursor-actual");
      const guide = this.eraserPreview.querySelector(".wae-cursor-guide");
      const center = this.eraserPreview.querySelector(".wae-cursor-center");
      if (!actual || !guide || !center) return;

      Object.assign(this.eraserPreview.style, {
        width: `${guideSize}px`,
        height: `${guideSize}px`,
        opacity: "1",
        mixBlendMode: "normal",
        border: "0",
        background: "transparent",
        transform: `translate(${event.clientX - guideSize / 2}px,${event.clientY - guideSize / 2}px)`
      });
      Object.assign(guide.style, {
        position: "absolute",
        left: "50%",
        top: "50%",
        width: `${guideSize}px`,
        height: `${guideSize}px`,
        transform: "translate(-50%,-50%)",
        borderRadius: "50%",
        boxSizing: "border-box",
        border: "1px solid #fff",
        boxShadow: "0 0 0 1px #000,0 1px 4px rgba(0,0,0,.35)",
        background: "transparent",
        display: "block"
      });
      Object.assign(actual.style, {
        position: "absolute",
        left: "50%",
        top: "50%",
        width: `${size}px`,
        height: `${size}px`,
        transform: "translate(-50%,-50%)",
        borderRadius: "50%",
        boxSizing: "border-box",
        border: "1px solid #000",
        boxShadow: "0 0 0 1px #fff",
        background: "rgba(255,255,255,.08)",
        display: "block"
      });
      Object.assign(center.style, {
        position: "absolute",
        left: "50%",
        top: "50%",
        width: "7px",
        height: "7px",
        transform: "translate(-50%,-50%)",
        borderRadius: "50%",
        boxSizing: "border-box",
        border: "1px solid #fff",
        boxShadow: "0 0 0 1px #000",
        background: "rgba(0,0,0,.75)",
        display: "block"
      });

      if (tool === "eraser") {
        actual.style.border = "1px solid #000";
        actual.style.boxShadow = "0 0 0 1px #fff,0 0 0 3px rgba(248,113,113,.55)";
        actual.style.background = "rgba(248,113,113,.08)";
      } else if (tool === "highlighter") {
        actual.style.border = `1px solid ${color}`;
        actual.style.boxShadow = "0 0 0 1px #fff,0 0 0 2px #000";
        actual.style.background = "rgba(255,255,255,.08)";
        actual.style.opacity = "1";
      } else {
        actual.style.border = `1px solid ${color}`;
        actual.style.boxShadow = "0 0 0 1px #fff,0 0 0 2px #000";
        actual.style.background = "rgba(255,255,255,.08)";
      }
      this.eraserPreview.style.display = "block";
    }

    hideEraserPreview() {
      this.eraserPreview.style.display = "none";
      this.eraserPreview.style.transform = "translate(-9999px,-9999px)";
    }

    documentPoint(event, meta = {}) {
      return {
        x: event.clientX + this.scroll.getScrollX() + WAE.getActiveScrollOffset().x,
        y: event.clientY + this.scroll.getScrollY() + WAE.getActiveScrollOffset().y,
        pressure: Number.isFinite(Number(meta.pressure)) ? Number(meta.pressure) : 0.5,
        time: Number.isFinite(Number(meta.time)) ? Number(meta.time) : Date.now()
      };
    }

    viewportPoint(point) {
      const offset = WAE.getActiveScrollOffset();
      return {
        x: point.x - offset.x,
        y: point.y - offset.y
      };
    }

    scheduleResize() {
      if (this.resizeFrame) {
        return;
      }
      this.resizeFrame = window.requestAnimationFrame(() => {
        this.resizeFrame = 0;
        this.resize();
      });
    }

    requestRender() {
      if (this.renderFrame) {
        return;
      }
      this.renderFrame = window.requestAnimationFrame(() => {
        this.renderFrame = 0;
        this.render();
      });
    }

    resize() {
      const ratio = window.devicePixelRatio || 1;
      const size = this.getDocumentSize();
      const width = size.width;
      const height = size.height;
      this.canvas.width = Math.max(1, Math.round(width * ratio));
      this.canvas.height = Math.max(1, Math.round(height * ratio));
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
      this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      this.render();
    }

    getDocumentSize() {
      const body = document.body;
      const element = document.documentElement;
      return {
        width: Math.max(
          element.scrollWidth,
          element.clientWidth,
          body ? body.scrollWidth : 0,
          body ? body.clientWidth : 0,
          window.innerWidth
        ),
        height: Math.max(
          element.scrollHeight,
          element.clientHeight,
          body ? body.scrollHeight : 0,
          body ? body.clientHeight : 0,
          window.innerHeight
        )
      };
    }

    installObservers() {
      if (typeof ResizeObserver !== "undefined") {
        this.resizeObserver = new ResizeObserver(() => this.scheduleResize());
        this.resizeObserver.observe(document.documentElement);
        if (document.body) {
          this.resizeObserver.observe(document.body);
        }
      }

      if (typeof MutationObserver !== "undefined") {
        this.mutationObserver = new MutationObserver(() => {
          if (!document.documentElement.contains(this.canvas)) {
            document.documentElement.appendChild(this.canvas);
            this.applyDocumentCanvasStyle();
          }
          if (!document.documentElement.contains(this.eraserPreview)) {
            document.documentElement.appendChild(this.eraserPreview);
            this.applyEraserPreviewStyle();
          }
          this.scheduleResize();
        });
        this.mutationObserver.observe(document.documentElement, { childList: true, subtree: true });
      }
    }

    watchDevicePixelRatio() {
      if (!window.matchMedia) {
        return;
      }
      if (this.dprQuery) {
        this.dprQuery.removeEventListener("change", this.dprHandler);
      }
      this.dprHandler = () => {
        this.scheduleResize();
        this.watchDevicePixelRatio();
      };
      this.dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      this.dprQuery.addEventListener("change", this.dprHandler, { once: true });
    }

    destroy() {
      if (this.resizeFrame) {
        window.cancelAnimationFrame(this.resizeFrame);
        this.resizeFrame = 0;
      }
      if (this.renderFrame) {
        window.cancelAnimationFrame(this.renderFrame);
        this.renderFrame = 0;
      }
      window.removeEventListener("resize", this.resizeHandler);
      window.removeEventListener("scroll", this.scrollHandler, true);
      window.removeEventListener("wae:scroll-context-change", this.scrollHandler);
      if (this.dprQuery && this.dprHandler) {
        this.dprQuery.removeEventListener("change", this.dprHandler);
      }
      this.dprQuery = null;
      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
        this.resizeObserver = null;
      }
      if (this.mutationObserver) {
        this.mutationObserver.disconnect();
        this.mutationObserver = null;
      }
      if (this.boundPreview) {
        this.canvas.removeEventListener("pointermove", this.previewHandlers.pointermove);
        this.canvas.removeEventListener("pointerdown", this.previewHandlers.pointerdown);
        this.canvas.removeEventListener("pointerleave", this.previewHandlers.pointerleave);
        this.canvas.removeEventListener("pointercancel", this.previewHandlers.pointercancel);
        this.boundPreview = false;
      }
      this.hideEraserPreview();
      this.setDrawingMode(false);
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.canvas.remove();
      this.eraserPreview.remove();
      this.mounted = false;
    }

    render() {
      const size = this.getDocumentSize();
      this.ctx.clearRect(0, 0, size.width, size.height);
      if (this.getHidden()) {
        return;
      }
      const strokes = this.getStrokes();
      strokes.forEach((stroke) => this.drawStroke(stroke));
      const selectedId = this.getSelectedStrokeId();
      if (selectedId !== null && selectedId !== undefined) {
        const selected = strokes.find((stroke) => String(stroke.id) === String(selectedId));
        if (selected) {
          this.drawStrokeSelection(selected);
        }
      }
    }

    drawStrokeSelection(stroke) {
      const bounds = this.strokeBounds(stroke);
      if (!bounds) return;
      const ctx = this.ctx;
      const padding = Math.max(8, (Number(stroke.width) || WAE.CONFIG.defaultWidth) / 2 + 5);
      const left = bounds.left - padding;
      const top = bounds.top - padding;
      const width = Math.max(12, bounds.right - bounds.left + padding * 2);
      const height = Math.max(12, bounds.bottom - bounds.top + padding * 2);
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "#0f172a";
      ctx.strokeRect(left, top, width, height);
      ctx.strokeStyle = "#38bdf8";
      ctx.lineDashOffset = 5;
      ctx.strokeRect(left, top, width, height);
      ctx.restore();
    }

    strokeBounds(stroke) {
      if (!stroke || !stroke.points || !stroke.points.length) return null;
      const points = stroke.points.map((point) => this.viewportPoint(point));
      return points.reduce((bounds, point) => ({
        left: Math.min(bounds.left, point.x),
        top: Math.min(bounds.top, point.y),
        right: Math.max(bounds.right, point.x),
        bottom: Math.max(bounds.bottom, point.y)
      }), {
        left: points[0].x,
        top: points[0].y,
        right: points[0].x,
        bottom: points[0].y
      });
    }

    drawStroke(stroke) {
      if (!stroke.points || stroke.points.length < 1) {
        return;
      }
      if (stroke.tool === "pen") {
        this.drawPenStroke(stroke);
        return;
      }

      const points = stroke.points.map((point) => this.viewportPoint(point));
      const ctx = this.ctx;
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.setLineDash([]);
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.globalAlpha = stroke.opacity;
      ctx.globalCompositeOperation = "source-over";
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);

      if (points.length === 1) {
        ctx.lineTo(points[0].x + 0.01, points[0].y + 0.01);
      } else if (points.length === 2) {
        ctx.lineTo(points[1].x, points[1].y);
      } else {
        for (let index = 1; index < points.length - 1; index += 1) {
          const current = points[index];
          const next = points[index + 1];
          const midX = (current.x + next.x) / 2;
          const midY = (current.y + next.y) / 2;
          ctx.quadraticCurveTo(current.x, current.y, midX, midY);
        }
        const last = points[points.length - 1];
        ctx.lineTo(last.x, last.y);
      }

      ctx.stroke();
      ctx.restore();
    }

    drawPenStroke(stroke) {
      const points = this.prepareRenderPoints(stroke.points);
      const ctx = this.ctx;
      const roundness = Number.isFinite(Number(stroke.roundness)) ? stroke.roundness : 1;

      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.setLineDash([]);
      ctx.strokeStyle = stroke.color;
      ctx.globalAlpha = stroke.opacity;
      ctx.globalCompositeOperation = "source-over";

      if (points.length === 1) {
        ctx.beginPath();
        ctx.lineWidth = this.penWidthAt(stroke, points[0], 0, 1);
        ctx.moveTo(points[0].x, points[0].y);
        ctx.lineTo(points[0].x + 0.01, points[0].y + 0.01);
        ctx.stroke();
        ctx.restore();
        return;
      }

      if (stroke.penType === "ballpoint" || Number(stroke.pressureSensitivity) <= 0.02) {
        this.drawSmoothPath(ctx, points, stroke.width);
        ctx.restore();
        return;
      }

      this.drawSmoothPath(ctx, points, Math.max(0.8, (Number(stroke.width) || WAE.CONFIG.defaultWidth) * 0.35));

      for (let index = 1; index < points.length; index += 1) {
        const previous = points[index - 1];
        const current = points[index];
        const progress = index / Math.max(1, points.length - 1);
        const width = (this.penWidthAt(stroke, previous, (index - 1) / Math.max(1, points.length - 1), points.length) + this.penWidthAt(stroke, current, progress, points.length)) / 2;
        ctx.beginPath();
        ctx.lineWidth = width;
        ctx.moveTo(previous.x, previous.y);
        ctx.lineTo(current.x, current.y);
        ctx.stroke();
      }

      ctx.restore();
    }

    prepareRenderPoints(points) {
      const renderPoints = points.map((point) => Object.assign({}, this.viewportPoint(point), {
        pressure: Number.isFinite(Number(point.pressure)) && Number(point.pressure) > 0 ? Number(point.pressure) : 0.5
      }));
      const dense = [];
      renderPoints.forEach((point) => {
        const previous = dense[dense.length - 1];
        if (!previous) {
          dense.push(point);
          return;
        }
        const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
        const segments = Math.max(1, Math.ceil(distance / 4));
        for (let index = 1; index <= segments; index += 1) {
          const t = index / segments;
          dense.push({
            x: previous.x + (point.x - previous.x) * t,
            y: previous.y + (point.y - previous.y) * t,
            pressure: previous.pressure + (point.pressure - previous.pressure) * t
          });
        }
      });
      return dense;
    }

    drawSmoothPath(ctx, points, width) {
      ctx.beginPath();
      ctx.lineWidth = Math.max(0.5, Number(width) || WAE.CONFIG.defaultWidth);
      ctx.moveTo(points[0].x, points[0].y);
      if (points.length === 2) {
        ctx.lineTo(points[1].x, points[1].y);
      } else {
        for (let index = 1; index < points.length - 1; index += 1) {
          const current = points[index];
          const next = points[index + 1];
          ctx.quadraticCurveTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2);
        }
        const last = points[points.length - 1];
        ctx.lineTo(last.x, last.y);
      }
      ctx.stroke();
    }

    penWidthAt(stroke, point, progress, pointCount) {
      const base = Number(stroke.width) || WAE.CONFIG.defaultWidth;
      const pressure = WAE.clamp(Number(point.pressure) || 0.5, 0.05, 1);
      const sensitivity = WAE.clamp(Number(stroke.pressureSensitivity) || 0, 0, 1);
      let factor = 1;

      if (stroke.penType === "fountain") {
        factor = 0.82 + pressure * 0.36 * sensitivity;
        if (pointCount > 2) {
          const taper = Math.min(1, progress * 4, (1 - progress) * 4);
          factor *= 0.55 + 0.45 * taper;
        }
      } else if (stroke.penType === "brush") {
        factor = 0.35 + pressure * 1.35 * Math.max(0.35, sensitivity);
        if (pointCount > 2) {
          const taper = Math.min(1, progress * 3, (1 - progress) * 3);
          factor *= 0.45 + 0.55 * taper;
        }
      } else {
        factor = 1;
      }

      return Math.max(0.5, base * factor);
    }
  }

  WAE.CanvasManager = CanvasManager;
})();

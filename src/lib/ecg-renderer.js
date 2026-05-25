export class ECGRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.paperSpeed = 25;
        this.gain = 10;
        this.showGrid = true;
        this.showLabels = true;
        this.showAnnotations = false;
        this.zoomLevel = 1.0;
        this.params = null;
        this.dpr = window.devicePixelRatio || 1;
        this.onInterpretationChange = null;
        this._leadCurves = {};
        this.GRID_SQUARES_W = 10;
        this.GRID_SQUARES_H = 4;
        this.RHYTHM_SQUARES_H = 4;
        this.HEADER_ROWS = 3;
        this.FOOTER_ROWS = 3;
        this.LEAD_COLS = 4;
        this.LEAD_ROWS = 3;
        this.leadOrder = [
            ['I', 'II', 'III', 'aVR'],
            ['aVL', 'aVF', 'V1', 'V2'],
            ['V3', 'V4', 'V5', 'V6'],
        ];
        this.colors = {
            background: '#f5f5e8',
            gridMinor: '#f2d4d4',
            gridMajor: '#ffc0c0',
            waveform: '#1a1a1a',
            label: '#888',
        };
    }

    mmToPx(mm) { return mm * this.zoomLevel * 3.78; }
    timeToPx(sec) { return this.mmToPx(sec * this.paperSpeed); }
    mvToPx(mV) { return this.mmToPx(mV * this.gain); }

    initCanvas() {
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        this.dpr = dpr;
        this.displayWidth = Math.floor(rect.width);
        this.displayHeight = Math.floor(rect.height);
        this.canvas.width = this.displayWidth * dpr;
        this.canvas.height = this.displayHeight * dpr;
        this.canvas.style.width = this.displayWidth + 'px';
        this.canvas.style.height = this.displayHeight + 'px';
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        if (this._autoFit !== false) {
            const tw = this.GRID_SQUARES_W * 5 * this.LEAD_COLS;
            const th = (this.HEADER_ROWS + this.GRID_SQUARES_H * this.LEAD_ROWS + this.RHYTHM_SQUARES_H + this.FOOTER_ROWS) * 5;
            const bpm = 3.78;
            this.zoomLevel = Math.min((this.displayWidth - 4) / (tw * bpm), (this.displayHeight - 4) / (th * bpm), 3);
        }
    }

    calcLayout() {
        const lw = this.mmToPx(this.GRID_SQUARES_W * 5);
        const lh = this.mmToPx(this.GRID_SQUARES_H * 5);
        const rh = this.mmToPx(this.RHYTHM_SQUARES_H * 5);
        const hh = this.mmToPx(this.HEADER_ROWS * 5);
        const fh = this.mmToPx(this.FOOTER_ROWS * 5);
        const tw = lw * this.LEAD_COLS;
        const th = hh + lh * this.LEAD_ROWS + rh + fh;
        return {
            leadW: lw, leadH: lh, rhythmH: rh, headerH: hh, footerH: fh,
            offsetX: Math.round((this.displayWidth - tw) / 2),
            offsetY: Math.round((this.displayHeight - th) / 2),
            totalW: tw, totalH: th,
        };
    }

    drawFullGrid(ox, oy, tw, th, hh, fh) {
        const ctx = this.ctx;
        const gridTop = oy + (hh || 0);
        const gridBottom = oy + th - (fh || 0);
        const gridTotalH = gridBottom - gridTop;
        ctx.fillStyle = this.colors.background;
        ctx.fillRect(ox, oy, tw, th);
        if (!this.showGrid) return;
        const s = this.mmToPx(1);
        const l = this.mmToPx(5);
        const R = ox + tw, B = oy + th;
        const top = gridTop;
        const bottom = gridBottom;
        ctx.strokeStyle = this.colors.gridMinor; ctx.lineWidth = 0.3; ctx.beginPath();
        for (let x = ox; x <= R; x += s) { ctx.moveTo(x, top); ctx.lineTo(x, bottom); }
        for (let y = top; y <= bottom; y += s) { ctx.moveTo(ox, y); ctx.lineTo(R, y); }
        ctx.stroke();
        ctx.strokeStyle = this.colors.gridMajor; ctx.lineWidth = 0.6; ctx.beginPath();
        for (let x = ox; x <= R; x += l) { ctx.moveTo(x, top); ctx.lineTo(x, bottom); }
        for (let y = top; y <= bottom; y += l) { ctx.moveTo(ox, y); ctx.lineTo(R, y); }
        ctx.stroke();
        if (hh && hh > 0) {
            ctx.strokeStyle = this.colors.gridMinor; ctx.lineWidth = 0.3; ctx.beginPath();
            for (let x = ox; x <= R; x += s) { ctx.moveTo(x, oy); ctx.lineTo(x, gridTop); }
            for (let y = oy; y <= gridTop; y += s) { ctx.moveTo(ox, y); ctx.lineTo(R, y); }
            ctx.stroke();
            const l2 = this.mmToPx(5);
            ctx.strokeStyle = this.colors.gridMajor; ctx.lineWidth = 0.6; ctx.beginPath();
            for (let x = ox; x <= R; x += l2) { ctx.moveTo(x, oy); ctx.lineTo(x, gridTop); }
            ctx.moveTo(ox, gridTop); ctx.lineTo(R, gridTop);
            const line1 = oy + hh * 0.33;
            const line2 = oy + hh * 0.66;
            ctx.moveTo(ox, line1); ctx.lineTo(R, line1);
            ctx.moveTo(ox, line2); ctx.lineTo(R, line2);
            ctx.stroke();
        }
        if (fh && fh > 0) {
            ctx.strokeStyle = this.colors.gridMinor; ctx.lineWidth = 0.3; ctx.beginPath();
            for (let x = ox; x <= R; x += s) { ctx.moveTo(x, gridBottom); ctx.lineTo(x, B); }
            for (let y = gridBottom; y <= B; y += s) { ctx.moveTo(ox, y); ctx.lineTo(R, y); }
            ctx.stroke();
            const l3 = this.mmToPx(5);
            ctx.strokeStyle = this.colors.gridMajor; ctx.lineWidth = 0.6; ctx.beginPath();
            for (let x = ox; x <= R; x += l3) { ctx.moveTo(x, gridBottom); ctx.lineTo(x, B); }
            ctx.moveTo(ox, gridBottom); ctx.lineTo(R, gridBottom);
            const fline1 = gridBottom + fh * 0.33;
            const fline2 = gridBottom + fh * 0.66;
            ctx.moveTo(ox, fline1); ctx.lineTo(R, fline1);
            ctx.moveTo(ox, fline2); ctx.lineTo(R, fline2);
            ctx.stroke();
        }
    }

    drawLeadLabel(x, y, name) {
        if (!this.showLabels) return;
        const ctx = this.ctx;
        ctx.save();
        this.applyLeadLabelTextStyle(ctx);
        ctx.fillText(name, x + 2, this.getLabelTopY(y));
        ctx.restore();
    }

    getLabelTopY(y) {
        return y + (2 * this.zoomLevel);
    }

    applyLeadLabelTextStyle(ctx) {
        ctx.fillStyle = this.colors.label;
        ctx.font = `${9 * this.zoomLevel}px "Segoe UI", sans-serif`;
        ctx.textBaseline = 'top';
    }

    drawInfoLabel(x, y, w) {
        if (!this.showLabels) return;
        const ctx = this.ctx;
        ctx.save();
        ctx.fillStyle = '#aaa';
        ctx.font = `${7 * this.zoomLevel}px "Courier New", monospace`;
        ctx.textBaseline = 'top';
        ctx.textAlign = 'right';
        ctx.fillText('25mm/s  10mm/mV', x + w - 2, y + (2 * this.zoomLevel));
        ctx.restore();
    }

    drawHeaderText(text) {
        this._headerText = text;
        if (!text || !this._layout) return;
        const ctx = this.ctx;
        const L = this._layout;
        if (L.headerH < this.mmToPx(3)) return;
        const headerMid = L.offsetY + L.headerH / 2;
        ctx.save();
        ctx.fillStyle = '#555';
        ctx.font = `bold ${7 * this.zoomLevel}px "Segoe UI", sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillText(text, L.offsetX + L.totalW / 2, headerMid);
        ctx.restore();
    }

    renderInit(params, { keepCurves = false } = {}) {
        this.params = params;
        this.initCanvas();
        const ctx = this.ctx;
        ctx.fillStyle = this.colors.background;
        ctx.fillRect(0, 0, this.displayWidth, this.displayHeight);

        const L = this.calcLayout();
        this.drawFullGrid(L.offsetX, L.offsetY, L.totalW, L.totalH, L.headerH, L.footerH);
        this._layout = L;
        this._drawWatermark();
        this._leadDuration = 2.5;
        this._rhythmDuration = 10;
        if (!keepCurves) this._headerText = null;
        this._leadPanels = [];
        if (!keepCurves) this._leadCurves = {};

        const gridY = L.offsetY + L.headerH;
        for (let row = 0; row < this.LEAD_ROWS; row++) {
            for (let col = 0; col < this.LEAD_COLS; col++) {
                const lead = this.leadOrder[row][col];
                const x = L.offsetX + col * L.leadW;
                const y = gridY + row * L.leadH;
                this._leadPanels.push({ lead, x, y, w: L.leadW, h: L.leadH });
            }
        }
        this._rhythmPanel = {
            lead: 'II', x: L.offsetX, y: gridY + this.LEAD_ROWS * L.leadH,
            w: this.LEAD_COLS * L.leadW, h: L.rhythmH,
        };

        for (const p of this._leadPanels) this.drawLeadLabel(p.x, p.y, p.lead);
        const fp = this._leadPanels[0];
        if (fp) this.drawInfoLabel(fp.x, fp.y, fp.w);
        if (this.showLabels) {
            ctx.save();
            this.applyLeadLabelTextStyle(ctx);
            ctx.textAlign = 'left';
            ctx.fillText('II', this._rhythmPanel.x + 2, this.getLabelTopY(this._rhythmPanel.y));
            ctx.textAlign = 'right';
            ctx.fillText('Rhythm Strip', this._rhythmPanel.x + this._rhythmPanel.w - 2, this.getLabelTopY(this._rhythmPanel.y));
            ctx.restore();
        }
        if (this._headerText) this.drawHeaderText(this._headerText);
    }

    render(params) {
        this.renderInit(params, { keepCurves: true });
        this._redrawStoredCurves(params);
        if (this.showAnnotations && this._annotationData) {
            this.drawAnnotations(this._annotationData, params);
        }
        this._notifyInterpretation(params);
        return params;
    }

    _drawWatermark() {
        const ctx = this.ctx;
        const L = this._layout;
        if (!L) return;
        const cx = L.offsetX + L.totalW / 2;
        const cy = L.offsetY + L.totalH / 2;

        ctx.save();
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = '#666';
        ctx.font = `bold ${20 * this.zoomLevel}px "Segoe UI", sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.translate(cx, cy);
        ctx.rotate(-0.25 * Math.PI);
        ctx.fillText('AI 生成 · 仅供学习参考', 0, 0);
        ctx.restore();
    }

    _redrawStoredCurves(params) {
        for (const p of this._leadPanels) {
            const curve = this._leadCurves[p.lead];
            if (curve?.length) {
                this.drawPointCurveInRect(p.x, p.y, p.w, p.h, curve, params, this._leadDuration);
            }
        }
        const rcurve = this._leadCurves['II'] || [];
        if (rcurve.length) {
            this.drawPointCurveInRect(
                this._rhythmPanel.x,
                this._rhythmPanel.y,
                this._rhythmPanel.w,
                this._rhythmPanel.h,
                rcurve,
                params,
                this._rhythmDuration,
            );
        }
    }

    drawAnnotations(annotations, params) {
        if (!this._leadPanels || !this._layout) return;
        const dur = this._leadDuration;
        for (const p of this._leadPanels) {
            const a = annotations[p.lead];
            if (!a || !a.times) continue;
            this._drawLeadAnnotations(p.x, p.y, p.w, p.h, a, dur);
        }
        const rA = annotations['II'];
        if (rA && rA.times && this._rhythmPanel) {
            this._drawLeadAnnotations(
                this._rhythmPanel.x, this._rhythmPanel.y,
                this._rhythmPanel.w, this._rhythmPanel.h,
                rA, this._rhythmDuration
            );
        }
    }

    _drawLeadAnnotations(rx, ry, rw, rh, a, duration) {
        const ctx = this.ctx;
        const bl = ry + rh * 0.5;
        const baselinePx = bl - this.mvToPx(a.baselineMv);

        const timeToX = (t) => rx + (t / duration) * rw;
        const mvToY = (mv) => bl - this.mvToPx(mv - a.baselineMv);

        ctx.save();
        ctx.lineWidth = 0.8;
        ctx.font = `${7.5 * this.zoomLevel}px "Segoe UI", sans-serif`;
        ctx.textBaseline = 'bottom';

        // baseline dashed
        ctx.strokeStyle = 'rgba(100,160,220,0.35)';
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(rx + 2, baselinePx); ctx.lineTo(rx + rw - 2, baselinePx);
        ctx.stroke();
        ctx.setLineDash([]);

        // R peak
        if (a.rIdx >= 0 && a.rTime != null) {
            const rxR = timeToX(a.rTime);
            if (rxR >= rx && rxR <= rx + rw) {
                ctx.strokeStyle = '#2c7a4a';
                ctx.setLineDash([1.5, 2]);
                ctx.beginPath();
                ctx.moveTo(rxR, ry + 2); ctx.lineTo(rxR, ry + rh - 2);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.fillStyle = '#2c7a4a';
                ctx.textAlign = 'center';
                ctx.fillText('R', rxR, ry + 2);
            }
        }

        // J point
        if (a.jIdx >= 0 && a.jIdx < a.times.length) {
            const jt = a.times[a.jIdx];
            const xj = timeToX(jt);
            const yj = mvToY(a.vals[a.jIdx]);
            if (xj >= rx && xj <= rx + rw) {
                ctx.fillStyle = '#c0392b';
                ctx.beginPath();
                ctx.arc(xj, yj, 2.5 * this.zoomLevel, 0, Math.PI * 2);
                ctx.fill();
                ctx.textAlign = 'left';
                ctx.fillText('J', xj + 3, yj - 3);
            }
        }

        // T peak
        if (a.tPeakIdx >= 0 && a.tPeakIdx < a.times.length) {
            const tt = a.times[a.tPeakIdx];
            const xt = timeToX(tt);
            const yt = mvToY(a.vals[a.tPeakIdx]);
            if (xt >= rx && xt <= rx + rw) {
                ctx.fillStyle = '#8e44ad';
                ctx.beginPath();
                ctx.arc(xt, yt, 2.5 * this.zoomLevel, 0, Math.PI * 2);
                ctx.fill();
                ctx.textAlign = 'left';
                const label = a.tInverted ? 'T↓' : 'T';
                ctx.fillText(label, xt + 3, yt + (a.tInverted ? -8 : -3));
            }
        }

        // Q wave marker
        if (a.qIdx >= 0 && a.qIdx < a.times.length) {
            const tq = a.times[a.qIdx];
            const xq = timeToX(tq);
            const yq = mvToY(a.vals[a.qIdx]);
            if (xq >= rx && xq <= rx + rw) {
                ctx.fillStyle = '#d35400';
                ctx.beginPath();
                ctx.arc(xq, yq, 2 * this.zoomLevel, 0, Math.PI * 2);
                ctx.fill();
                ctx.textAlign = 'right';
                ctx.fillText('Q', xq - 3, yq - 3);
            }
        }

        // S wave marker  
        if (a.sIdx >= 0 && a.sIdx < a.times.length) {
            const ts = a.times[a.sIdx];
            const xs = timeToX(ts);
            const ys = mvToY(a.vals[a.sIdx]);
            if (xs >= rx && xs <= rx + rw) {
                ctx.fillStyle = '#d35400';
                ctx.beginPath();
                ctx.arc(xs, ys, 2 * this.zoomLevel, 0, Math.PI * 2);
                ctx.fill();
                ctx.textAlign = 'right';
                ctx.fillText('S', xs - 3, ys + 12);
            }
        }

        // ST segment bracket
        if (a.jIdx >= 0 && a.stMeasureTime > 0) {
            const xJ = timeToX(a.times[a.jIdx]);
            const xST = timeToX(a.stMeasureTime);
            if (xJ >= rx && xST <= rx + rw) {
                const yST = mvToY(a.stMv + a.baselineMv);
                ctx.strokeStyle = '#c0392b';
                ctx.lineWidth = 1.4;
                ctx.beginPath();
                ctx.moveTo(xJ + 2, yST);
                ctx.lineTo(xST - 2, yST);
                ctx.stroke();
                ctx.lineWidth = 0.8;
                const stMm = Math.round(a.stMv * 10);
                const arrowY = stMm >= 0 ? Math.max(yST - 6, ry + 4) : Math.min(yST + 6, ry + rh - 4);
                ctx.beginPath();
                ctx.moveTo(xST, yST); ctx.lineTo(xST, arrowY);
                ctx.stroke();
                ctx.fillStyle = '#c0392b';
                ctx.textAlign = 'left';
                ctx.fillText(`ST ${stMm >= 0 ? '+' : ''}${stMm}mm`, xST + 2, arrowY + (stMm >= 0 ? -1 : 10));
            }
        }

        ctx.restore();
    }

    renderLeadCurve(lead, toolCall, params) {
        const panel = this._leadPanels.find(p => p.lead === lead);
        if (!panel) return;
        const dur = this._leadDuration;
        if (toolCall.beats && toolCall.beats.length > 0) {
            const allPts = [];
            for (const beat of toolCall.beats) {
                const smoothed = catmullRomSmooth(beat.points, 0.002);
                const beatStart = smoothed[0]?.[0] || 0;
                for (const [t, mv] of smoothed) {
                    allPts.push({ time: beat.onset + (t - beatStart), mv });
                }
            }
            allPts.sort((a, b) => a.time - b.time);
            this._leadCurves[lead] = [[0, 0]];
            this.drawMultiBeatInRect(panel.x, panel.y, panel.w, panel.h, allPts, dur);
        } else {
            const smoothed = catmullRomSmooth(toolCall.points, 0.002);
            this._leadCurves[lead] = smoothed;
            this.drawPointCurveInRect(panel.x, panel.y, panel.w, panel.h, smoothed, params, dur);
        }
    }

    renderLeadCurveCSV(lead, points, params) {
        const panel = this._leadPanels.find(p => p.lead === lead);
        if (!panel) return;
        const smoothed = catmullRomSmooth(points, 0.008);
        this._leadCurves[lead] = smoothed;
        this.drawPointCurveInRect(panel.x, panel.y, panel.w, panel.h, smoothed, params, this._leadDuration, true);
    }

    renderLeadCurveCycle(lead, points, params) {
        const panel = this._leadPanels.find(p => p.lead === lead);
        if (!panel) return;
        const smoothed = catmullRomSmooth(points, 0.008);
        this._leadCurves[lead] = smoothed;
        this.drawPointCurveInRect(panel.x, panel.y, panel.w, panel.h, smoothed, params, this._leadDuration);
    }

    drawMultiBeatInRect(rx, ry, rw, rh, pts, duration) {
        const ctx = this.ctx;
        const bl = ry + rh * 0.5;
        const baselineMv = pts[0]?.mv || 0;
        ctx.strokeStyle = this.colors.waveform;
        ctx.lineWidth = 1.3 * this.zoomLevel;
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.beginPath();
        let started = false;
        const lm = this.mmToPx(1);
        for (const pt of pts) {
            const sx = rx + (pt.time / duration) * rw;
            const sy = bl - this.mvToPx(pt.mv - baselineMv);
            if (sx > rx + rw) break;
            if (sx < rx - lm) continue;
            if (!started) { ctx.moveTo(sx, sy); started = true; }
            else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
    }

    renderRhythmCurve(lead, params) {
        const rp = this._rhythmPanel;
        const curve = this._leadCurves[lead] || this._leadCurves['II'] || [];
        if (!curve.length) return;
        this.drawPointCurveInRect(rp.x, rp.y, rp.w, rp.h, curve, params, this._rhythmDuration);
    }

    renderRhythmCurveCSV(points, params) {
        const rp = this._rhythmPanel;
        if (!rp || !points.length) return;
        const smoothed = catmullRomSmooth(points, 0.008);
        this.drawPointCurveInRect(rp.x, rp.y, rp.w, rp.h, smoothed, params, this._rhythmDuration, true);
    }

    drawPointCurveInRect(rx, ry, rw, rh, curvePoints, params, duration, noRepeat = false) {
        const ctx = this.ctx;
        const bl = ry + rh * 0.5;
        const time0 = curvePoints[0][0];
        const baselineMv = curvePoints[0][1];
        const cycleLen = curvePoints[curvePoints.length - 1][0] - time0;
        if (cycleLen <= 0) return;
        const reps = noRepeat ? 1 : Math.ceil(duration / cycleLen) + 1;

        const pts = [];
        for (let r = 0; r < reps; r++) {
            const off = r * cycleLen;
            for (const [t, mv] of curvePoints) {
                const at = off + (t - time0);
                pts.push({ time: at, mv });
            }
        }

        ctx.strokeStyle = this.colors.waveform;
        ctx.lineWidth = 1.3 * this.zoomLevel;
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.beginPath();

        let started = false;
        const lm = this.mmToPx(1);
        let prevSx = 0, prevSy = 0;
        for (const pt of pts) {
            const sx = rx + (pt.time / duration) * rw;
            const sy = bl - this.mvToPx(pt.mv - baselineMv);
            if (sx > rx + rw) {
                if (started) {
                    const t = ((rx + rw) - prevSx) / (sx - prevSx);
                    ctx.lineTo(rx + rw, prevSy + (sy - prevSy) * t);
                }
                break;
            }
            if (sx < rx - lm) { prevSx = sx; prevSy = sy; continue; }
            if (!started) { ctx.moveTo(sx, sy); started = true; }
            else ctx.lineTo(sx, sy);
            prevSx = sx;
            prevSy = sy;
        }
        ctx.stroke();
    }

    _notifyInterpretation(params) {
        const interp = this.getInterpretationData(params || this.params);
        if (this.onInterpretationChange) this.onInterpretationChange(interp);
    }

    getInterpretationData(params) {
        const items = [];
        if (params.heartRate) {
            let c = 'normal';
            if (params.heartRate < 60) c = 'low';
            if (params.heartRate > 100) c = 'high';
            items.push({ text: `心率：${params.heartRate} bpm`, className: c });
        }
        const rMap = {
            'sinus': '窦性心律', 'atrial_fibrillation': '心房颤动', 'atrial_flutter': '心房扑动',
            'ventricular': '室性心动过速', 'paced': '心室起搏心律', 'complete_heart_block': 'III°AVB',
            'ventricular_fibrillation': '心室颤动', 'torsades': '尖端扭转型室速',
            'sinus_with_pvc': '窦性心律伴室早', 'sinus_arrhythmia': '窦性心律不齐',
            'sinus_with_wenckebach': 'II°I型AVB', 'sinus_with_mobitz2': 'II°II型AVB',
        };
        if (params.rhythmType && rMap[params.rhythmType]) {
            items.push({ text: `心律：${rMap[params.rhythmType]}`, className: 'normal' });
        }
        return items;
    }

    setPaperSpeed(s) { this.paperSpeed = s; }
    setGain(g) { this.gain = g; }
    setGrid(v) { this.showGrid = v; }
    setLabels(v) { this.showLabels = v; }
    setAnnotations(v) { this.showAnnotations = v; }
    setAnnotationData(data) { this._annotationData = data; }

    adjustZoom(delta) {
        this._autoFit = false;
        this.zoomLevel = Math.max(0.4, Math.min(3, this.zoomLevel + delta));
        if (this.params) this.render(this.params);
    }

    resetZoom() {
        this._autoFit = true;
        if (this.params) this.render(this.params);
    }

    exportImage(fmt = 'png') { return this.canvas.toDataURL(`image/${fmt}`); }

    downloadImage(fn = 'ecg-12lead.png') {
        const a = document.createElement('a');
        a.download = fn; a.href = this.exportImage(); a.click();
    }

    getAllCurves() { return this._leadCurves; }

    restoreCurves(curves) { this._leadCurves = curves; }
}

function catmullRomSpline(p0, p1, p2, p3, t) {
    const t2 = t * t, t3 = t2 * t;
    return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

export function catmullRomSmooth(points, step) {
    if (points.length < 2) return points.map(p => [p[0], p[1]]);
    const result = [];
    const n = points.length;
    for (let i = 0; i < n - 1; i++) {
        const p0 = points[Math.max(0, i - 1)];
        const p1 = points[i];
        const p2 = points[Math.min(n - 1, i + 1)];
        const p3 = points[Math.min(n - 1, i + 2)];
        const segLen = p2[0] - p1[0];
        const steps = Math.max(2, Math.ceil(segLen / step));
        for (let s = 0; s < steps; s++) {
            const t = s / steps;
            result.push([p1[0] + t * segLen, catmullRomSpline(p0[1], p1[1], p2[1], p3[1], t)]);
        }
    }
    result.push([points[n - 1][0], points[n - 1][1]]);
    return result;
}

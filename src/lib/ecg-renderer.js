export class ECGRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.paperSpeed = 25;
        this.gain = 10;
        this.showGrid = true;
        this.showLabels = true;
        this.zoomLevel = 1.0;
        this.params = null;
        this.dpr = window.devicePixelRatio || 1;
        this.onInterpretationChange = null;
        this._leadCurves = {};
        this.GRID_SQUARES_W = 10;
        this.GRID_SQUARES_H = 8;
        this.RHYTHM_SQUARES_H = 4;
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
            const th = this.GRID_SQUARES_H * 5 * this.LEAD_ROWS + this.RHYTHM_SQUARES_H * 5;
            const bpm = 3.78;
            this.zoomLevel = Math.min((this.displayWidth - 4) / (tw * bpm), (this.displayHeight - 4) / (th * bpm), 3);
        }
    }

    calcLayout() {
        const lw = this.mmToPx(this.GRID_SQUARES_W * 5);
        const lh = this.mmToPx(this.GRID_SQUARES_H * 5);
        const rh = this.mmToPx(this.RHYTHM_SQUARES_H * 5);
        const tw = lw * this.LEAD_COLS;
        const th = lh * this.LEAD_ROWS + rh;
        return {
            leadW: lw, leadH: lh, rhythmH: rh,
            offsetX: Math.round((this.displayWidth - tw) / 2),
            offsetY: Math.round((this.displayHeight - th) / 2),
            totalW: tw, totalH: th,
        };
    }

    drawFullGrid(ox, oy, tw, th) {
        const ctx = this.ctx;
        ctx.fillStyle = this.colors.background;
        ctx.fillRect(ox, oy, tw, th);
        if (!this.showGrid) return;
        const s = this.mmToPx(1);
        const l = this.mmToPx(5);
        const R = ox + tw, B = oy + th;
        ctx.strokeStyle = this.colors.gridMinor; ctx.lineWidth = 0.3; ctx.beginPath();
        for (let x = ox; x <= R; x += s) { ctx.moveTo(x, oy); ctx.lineTo(x, B); }
        for (let y = oy; y <= B; y += s) { ctx.moveTo(ox, y); ctx.lineTo(R, y); }
        ctx.stroke();
        ctx.strokeStyle = this.colors.gridMajor; ctx.lineWidth = 0.6; ctx.beginPath();
        for (let x = ox; x <= R; x += l) { ctx.moveTo(x, oy); ctx.lineTo(x, B); }
        for (let y = oy; y <= B; y += l) { ctx.moveTo(ox, y); ctx.lineTo(R, y); }
        ctx.stroke();
    }

    drawLeadLabel(x, y, name) {
        if (!this.showLabels) return;
        const ctx = this.ctx;
        ctx.save();
        ctx.fillStyle = this.colors.label;
        ctx.font = `${9 * this.zoomLevel}px "Segoe UI", sans-serif`;
        ctx.textBaseline = 'top';
        ctx.fillText(name, x + 2, y + (2 * this.zoomLevel));
        ctx.restore();
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

    renderInit(params, { keepCurves = false } = {}) {
        this.params = params;
        this.initCanvas();
        const ctx = this.ctx;
        ctx.fillStyle = this.colors.background;
        ctx.fillRect(0, 0, this.displayWidth, this.displayHeight);

        const L = this.calcLayout();
        this.drawFullGrid(L.offsetX, L.offsetY, L.totalW, L.totalH);
        this._layout = L;
        this._leadDuration = 2.5;
        this._rhythmDuration = 10;
        this._leadPanels = [];
        if (!keepCurves) this._leadCurves = {};

        for (let row = 0; row < this.LEAD_ROWS; row++) {
            for (let col = 0; col < this.LEAD_COLS; col++) {
                const lead = this.leadOrder[row][col];
                const x = L.offsetX + col * L.leadW;
                const y = L.offsetY + row * L.leadH;
                this._leadPanels.push({ lead, x, y, w: L.leadW, h: L.leadH });
            }
        }
        this._rhythmPanel = {
            lead: 'II', x: L.offsetX, y: L.offsetY + this.LEAD_ROWS * L.leadH,
            w: this.LEAD_COLS * L.leadW, h: L.rhythmH,
        };

        for (const p of this._leadPanels) this.drawLeadLabel(p.x, p.y, p.lead);
        const fp = this._leadPanels[0];
        if (fp) this.drawInfoLabel(fp.x, fp.y, fp.w);
        if (this.showLabels) {
            ctx.save();
            ctx.fillStyle = '#aaa';
            ctx.font = `${9 * this.zoomLevel}px "Segoe UI", sans-serif`;
            ctx.textBaseline = 'top';
            ctx.textAlign = 'left';
            ctx.fillText('II', this._rhythmPanel.x + 2, this._rhythmPanel.y + (2 * this.zoomLevel));
            ctx.textAlign = 'right';
            ctx.fillText('Rhythm Strip', this._rhythmPanel.x + this._rhythmPanel.w - 2, this._rhythmPanel.y + (2 * this.zoomLevel));
            ctx.restore();
        }
    }

    render(params) {
        this.renderInit(params, { keepCurves: true });
        this._redrawStoredCurves(params);
        this._notifyInterpretation(params);
        return params;
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

    renderLeadCurve(lead, toolCall, params) {
        const panel = this._leadPanels.find(p => p.lead === lead);
        if (!panel) return;
        const dur = this._leadDuration;
        if (toolCall.beats && toolCall.beats.length > 0) {
            const allPts = [];
            for (const beat of toolCall.beats) {
                const smoothed = catmullRomSmooth(beat.points, 0.002);
                for (const [t, mv] of smoothed) {
                    allPts.push({ time: beat.onset + t, mv });
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

    drawMultiBeatInRect(rx, ry, rw, rh, pts, duration) {
        const ctx = this.ctx;
        const bl = ry + rh * 0.5;
        ctx.strokeStyle = this.colors.waveform;
        ctx.lineWidth = 1.3 * this.zoomLevel;
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.beginPath();
        let started = false;
        const lm = this.mmToPx(1);
        for (const pt of pts) {
            const sx = rx + (pt.time / duration) * rw;
            const sy = bl - this.mvToPx(pt.mv);
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

    drawPointCurveInRect(rx, ry, rw, rh, curvePoints, params, duration) {
        const ctx = this.ctx;
        const bl = ry + rh * 0.5;
        const cycleLen = curvePoints[curvePoints.length - 1][0];
        const reps = Math.ceil(duration / cycleLen) + 1;

        const pts = [];
        for (let r = 0; r < reps; r++) {
            const off = r * cycleLen;
            for (const [t, mv] of curvePoints) {
                const at = off + t;
                if (at < duration) pts.push({ time: at, mv });
            }
        }

        ctx.strokeStyle = this.colors.waveform;
        ctx.lineWidth = 1.3 * this.zoomLevel;
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.beginPath();

        let started = false;
        const lm = this.mmToPx(1);
        for (const pt of pts) {
            const sx = rx + (pt.time / duration) * rw;
            const sy = bl - this.mvToPx(pt.mv);
            if (sx > rx + rw) break;
            if (sx < rx - lm) continue;
            if (!started) { ctx.moveTo(sx, sy); started = true; }
            else ctx.lineTo(sx, sy);
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
}

function catmullRomSpline(p0, p1, p2, p3, t) {
    const t2 = t * t, t3 = t2 * t;
    return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

function catmullRomSmooth(points, step) {
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

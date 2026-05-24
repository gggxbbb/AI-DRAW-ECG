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

        this.colors = {
            background: '#f5f5e8',
            gridMinor: '#f2d4d4',
            gridMajor: '#ffc0c0',
            waveform: '#1a1a1a',
            label: '#666',
            panelBorder: '#d4a0a0',
            rhythmBorder: '#c08080',
        };

        this.leadOrder = [
            ['I', 'II', 'III', 'aVR'],
            ['aVL', 'aVF', 'V1', 'V2'],
            ['V3', 'V4', 'V5', 'V6'],
        ];

        this.rLeadNames = {
            'I': 'I', 'II': 'II', 'III': 'III', 'aVR': 'aVR',
            'aVL': 'aVL', 'aVF': 'aVF',
            'V1': 'V1', 'V2': 'V2', 'V3': 'V3', 'V4': 'V4', 'V5': 'V5', 'V6': 'V6',
        };

        this.leadAngles = {
            'I': 0, 'II': 60, 'III': 120,
            'aVR': -150, 'aVL': -30, 'aVF': 90,
            'V1': null, 'V2': null, 'V3': null,
            'V4': null, 'V5': null, 'V6': null,
        };

        this.precordialIndex = {
            'V1': 0, 'V2': 1, 'V3': 2, 'V4': 3, 'V5': 4, 'V6': 5,
        };
    }

    mmToPx(mm) { return mm * this.dpr * this.zoomLevel * 3.78; }
    timeToPx(sec) { return this.mmToPx(sec * this.paperSpeed); }
    mvToPx(mV) { return this.mmToPx(mV * this.gain); }

    initCanvas() {
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();
        const dpr = this.dpr;
        this.displayWidth = Math.floor(rect.width);
        this.displayHeight = Math.floor(rect.height);
        this.canvas.width = this.displayWidth * dpr;
        this.canvas.height = this.displayHeight * dpr;
        this.canvas.style.width = this.displayWidth + 'px';
        this.canvas.style.height = this.displayHeight + 'px';
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const leadW_mm = this.GRID_SQUARES_W * 5;
        const leadH_mm = this.GRID_SQUARES_H * 5;
        const rhythmH_mm = this.RHYTHM_SQUARES_H * 5;
        const totalW_mm = this.LEAD_COLS * leadW_mm;
        const totalH_mm = this.LEAD_ROWS * leadH_mm + rhythmH_mm;
        const basePxPerMm = dpr * 3.78;
        const scaleW = (this.displayWidth - 4) / (totalW_mm * basePxPerMm);
        const scaleH = (this.displayHeight - 4) / (totalH_mm * basePxPerMm);
        this.zoomLevel = Math.min(scaleW, scaleH, 3);
    }

    calcLayout() {
        const leadW_mm = this.GRID_SQUARES_W * 5;
        const leadH_mm = this.GRID_SQUARES_H * 5;
        const rhythmH_mm = this.RHYTHM_SQUARES_H * 5;
        const leadW = this.mmToPx(leadW_mm);
        const leadH = this.mmToPx(leadH_mm);
        const rhythmH = this.mmToPx(rhythmH_mm);
        const totalW = leadW * this.LEAD_COLS;
        const totalH = leadH * this.LEAD_ROWS + rhythmH;
        const offsetX = Math.round((this.displayWidth - totalW) / 2);
        const offsetY = Math.round((this.displayHeight - totalH) / 2);
        return { leadW, leadH, rhythmH, offsetX, offsetY, totalW, totalH };
    }

    drawFullGrid(ox, oy, tw, th) {
        const ctx = this.ctx;
        ctx.fillStyle = this.colors.background;
        ctx.fillRect(ox, oy, tw, th);

        if (!this.showGrid) return;

        const small = this.mmToPx(1);
        const large = this.mmToPx(5);
        const right = ox + tw;
        const bottom = oy + th;

        ctx.strokeStyle = this.colors.gridMinor;
        ctx.lineWidth = 0.3;
        ctx.beginPath();
        for (let gx = ox; gx <= right; gx += small) {
            ctx.moveTo(gx, oy); ctx.lineTo(gx, bottom);
        }
        for (let gy = oy; gy <= bottom; gy += small) {
            ctx.moveTo(ox, gy); ctx.lineTo(right, gy);
        }
        ctx.stroke();

        ctx.strokeStyle = this.colors.gridMajor;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        for (let gx = ox; gx <= right; gx += large) {
            ctx.moveTo(gx, oy); ctx.lineTo(gx, bottom);
        }
        for (let gy = oy; gy <= bottom; gy += large) {
            ctx.moveTo(ox, gy); ctx.lineTo(right, gy);
        }
        ctx.stroke();
    }

    initCanvas() {
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();
        const dpr = this.dpr;
        const w = Math.floor(rect.width);
        const h = Math.floor(rect.height);
        if (w > 0) this.displayWidth = w;
        if (h > 0) this.displayHeight = h;
        this.canvas.width = this.displayWidth * dpr;
        this.canvas.height = this.displayHeight * dpr;
        this.canvas.style.width = this.displayWidth + 'px';
        this.canvas.style.height = this.displayHeight + 'px';
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    drawGrid(x, y, w, h, isRhythm) {
        const ctx = this.ctx;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();
        ctx.fillStyle = this.colors.background;
        ctx.fillRect(x, y, w, h);

        if (this.showGrid) {
            const small = this.mmToPx(1);
            const large = this.mmToPx(5);

            ctx.strokeStyle = this.colors.gridMinor;
            ctx.lineWidth = 0.3;
            ctx.beginPath();
            for (let gx = x; gx <= x + w + 1; gx += small) {
                ctx.moveTo(gx, y);
                ctx.lineTo(gx, y + h);
            }
            for (let gy = y; gy <= y + h + 1; gy += small) {
                ctx.moveTo(x, gy);
                ctx.lineTo(x + w, gy);
            }
            ctx.stroke();

            ctx.strokeStyle = this.colors.gridMajor;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            for (let gx = x; gx <= x + w + 1; gx += large) {
                ctx.moveTo(gx, y);
                ctx.lineTo(gx, y + h);
            }
            for (let gy = y; gy <= y + h + 1; gy += large) {
                ctx.moveTo(x, gy);
                ctx.lineTo(x + w, gy);
            }
            ctx.stroke();
        }

        ctx.restore();
    }

    drawLeadLabel(x, y, leadName) {
        if (!this.showLabels) return;
        const ctx = this.ctx;
        ctx.fillStyle = this.colors.label;
        ctx.font = `${9 * this.zoomLevel}px "Segoe UI", sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(leadName, x + 2, y + 10);
    }

    drawInfoLabel(x, y, w) {
        if (!this.showLabels) return;
        const ctx = this.ctx;
        ctx.fillStyle = '#aaa';
        ctx.font = `${7 * this.zoomLevel}px "Courier New", monospace`;
        ctx.textAlign = 'right';
        ctx.fillText(`25mm/s  10mm/mV`, x + w - 2, y + 10);
    }

    generateBeatPoints(params) {
        const points = [];
        const hr = params.heartRate || 70;
        const rr = 60 / hr;

        const prDur = (params.prInterval || 160) / 1000;
        const qrsDur = (params.qrsDuration || 90) / 1000;
        const qtDur = (params.qtInterval || 400) / 1000;
        const pDur = (params.pDuration || 90) / 1000;
        const tDur = (params.tDuration || 160) / 1000;

        const pAmp = params.pAmplitude || 0.15;
        const qrsAmp = params.qrsAmplitude || 1.5;
        const tAmp = params.tAmplitude || 0.3;

        const hasP = params.pPresent !== false;

        if (hasP) {
            const pStart = -prDur - pDur * 0.9;
            this._addPWave(points, pStart, pDur, pAmp, params);
        }

        this._addQRS(points, 0, qrsDur, qrsAmp, params);

        const stDur = qtDur - qrsDur - tDur;
        if (stDur > 0) {
            this._addST(points, qrsDur, stDur, params);
        }

        this._addTWave(points, qtDur - tDur, tDur, tAmp, params);

        if (params.uWavePresent || params.uWaveProminent) {
            this._addUWave(points, qtDur + 0.02, 0.1, params.uWaveAmplitude || 0.1, params);
        }

        return { points, duration: rr };
    }

    _addPWave(pts, t0, dur, amp, p) {
        const n = 14;
        if (p.pLowAmplitude) amp *= 0.25;
        for (let i = 0; i < n; i++) {
            const f = i / n;
            const y = amp * Math.exp(-Math.pow((f - 0.45) / 0.2, 2));
            pts.push({ time: t0 + f * dur, amplitude: y, c: 'P' });
        }
    }

    _addQRS(pts, t0, dur, amp, p) {
        const n = 30;
        let qD = amp * 0.12;
        let rH = amp;
        let sD = amp * 0.15;

        if (p.qWave) qD = p.qWave.depth || qD;
        if (p.qrsMorphology === 'wide_bizarre') { rH = amp * 1.3; sD = amp * 0.5; }
        if (p.qrsMorphology === 'paced_lbbb') { qD = 0.03; rH = amp * 0.8; sD = amp * 1.2; }
        if (p.rbbbRsrPattern) rH = amp * 0.6;

        const nQ = Math.floor(n * 0.13);
        for (let i = 0; i < nQ; i++) {
            pts.push({ time: t0 + (i / n) * dur, amplitude: -qD * Math.sin((i / nQ) * Math.PI / 2), c: 'Q' });
        }
        const nRu = Math.floor(n * 0.22);
        for (let i = 0; i < nRu; i++) {
            const f = i / nRu;
            let y = -qD + (rH + qD) * (1 - Math.pow(1 - f, 2.5));
            if (p.qrsNotching && i > nRu * 0.5) y -= 0.04 * Math.sin((i - nRu * 0.5) / (nRu * 0.5) * Math.PI);
            pts.push({ time: t0 + ((nQ + i) / n) * dur, amplitude: y, c: 'R' });
        }
        const peaks = nQ + nRu;
        const nRd = Math.floor(n * 0.3);
        for (let i = 0; i < nRd; i++) {
            const f = i / nRd;
            let y = rH * (1 - Math.pow(f, 1.3));
            if (p.qrsNotching && i < nRd * 0.3) y -= 0.04 * Math.sin(i / (nRd * 0.3) * Math.PI);
            y = Math.max(y, -sD);
            pts.push({ time: t0 + ((peaks + i) / n) * dur, amplitude: y, c: 'R' });
        }
        const nS = n - peaks - nRd;
        for (let i = 0; i < nS; i++) {
            const sf = i / nS;
            pts.push({ time: t0 + ((peaks + nRd + i) / n) * dur, amplitude: -sD + sD * sf * sf * (3 - 2 * sf), c: 'S' });
        }

        if (p.rbbbRsrPattern) {
            const trAmp = p.terminalR || 0.3;
            const nTR = 6;
            for (let i = 0; i < nTR; i++) {
                const y = -sD * 0.2 + trAmp * Math.sin((i / nTR) * Math.PI / 2);
                pts.push({ time: t0 + dur + (i / nTR) * (dur * 0.15), amplitude: y, c: 'R\'' });
            }
        }
    }

    _addST(pts, t0, dur, p) {
        const stEl = p.stElevation || 0;
        const stDep = p.stDepression || 0;
        const lastAmp = pts.length > 0 ? pts[pts.length - 1].amplitude : 0;
        const n = 12;

        for (let i = 0; i < n; i++) {
            const f = i / n;
            let y;
            if (p.stDifficult) {
                y = lastAmp * (1 - f * 0.6);
            } else if (p.stDiscordant) {
                y = lastAmp + (lastAmp > 0 ? -0.12 : 0.12) * f;
            } else if (stEl > 0) {
                if (p.stShape === 'coved' || p.stShape === 'coved_upward') {
                    y = lastAmp + stEl * Math.pow(f, 0.2);
                } else if (p.stShape === 'concave_upward') {
                    y = lastAmp + stEl * (1 - Math.pow(1 - f, 2.5));
                } else {
                    y = lastAmp + stEl * f;
                }
            } else if (stDep < 0) {
                if (p.stSlope === 'downsloping') y = lastAmp + stDep * f * 1.5;
                else if (p.stSlope === 'horizontal') y = lastAmp + stDep;
                else y = lastAmp + stDep * f;
            } else {
                y = lastAmp * (1 - f * 0.08);
            }
            pts.push({ time: t0 + f * dur, amplitude: y, c: 'ST' });
        }
    }

    _addTWave(pts, t0, dur, amp, p) {
        const n = 20;
        let a = Math.abs(amp);
        const inverted = p.tInverted || p.tDirection === 'opposite';
        if (p.tFlattened) a *= 0.25;
        if (p.tPeaked) a *= 2.0;
        if (p.tLowAmplitude) a *= 0.35;
        if (p.tUprightProminent || p.tTall) a *= 1.6;
        if (p.tInvertedDeep) a *= 1.5;

        const shape = p.twaveShape || 'asymmetric';
        const baseline = pts.length > 0 ? pts[pts.length - 1].amplitude : 0;

        for (let i = 0; i < n; i++) {
            const f = i / n;
            let y;
            switch (shape) {
                case 'symmetric_peaked':
                case 'peaked_symmetric_tented':
                    y = a * Math.exp(-Math.pow((f - 0.5) / 0.1, 2)); break;
                case 'symmetric_deep_inverted':
                case 'deep_symmetric_inverted':
                    y = a * Math.exp(-Math.pow((f - 0.5) / 0.17, 2)); break;
                case 'opposite_qrs':
                    y = a * Math.exp(-Math.pow((f - 0.38) / 0.22, 2)); break;
                case 'lv_strain':
                case 'rv_strain':
                    y = a * Math.exp(-Math.pow((f - 0.3) / 0.25, 2)); break;
                case 'brugada_inverted':
                    y = a * Math.exp(-Math.pow((f - 0.4) / 0.2, 2)); break;
                case 'flat_u_wave':
                    y = a * 0.25 * Math.exp(-Math.pow((f - 0.5) / 0.28, 2)); break;
                case 'flat_inverted':
                    y = a * 0.4 * Math.exp(-Math.pow((f - 0.4) / 0.25, 2)); break;
                case 'asymmetric_tall':
                    y = a * Math.exp(-Math.pow((f - 0.35) / 0.22, 2)); break;
                case 'broad_biphasic_notched':
                    y = f < 0.5
                        ? a * Math.exp(-Math.pow((f - 0.32) / 0.12, 2))
                        : -a * 0.35 * Math.exp(-Math.pow((f - 0.7) / 0.12, 2));
                    if (p.tNotched) y += 0.03 * Math.sin(f * Math.PI * 3);
                    if (p.tBroadBased) y *= 0.7;
                    break;
                default:
                    y = a * Math.exp(-Math.pow((f - 0.35) / 0.22, 2));
            }
            if (inverted) y = -y;
            pts.push({ time: t0 + f * dur, amplitude: baseline + y, c: 'T' });
        }
    }

    _addUWave(pts, t0, dur, amp, p) {
        const n = 6;
        for (let i = 0; i < n; i++) {
            const f = i / n;
            pts.push({ time: t0 + f * dur, amplitude: amp * Math.exp(-Math.pow((f - 0.5) / 0.25, 2)), c: 'U' });
        }
    }

    getLeadFactors(lead, params) {
        if (params._noProjection) {
            return {
                qrsScale: 1, pScale: 1, tScale: 1, sScale: 1,
                stScale: 1, stExtra: 0,
                voltageMult: 1, rExtra: 0, sExtra: 0,
                tInvert: params.tInverted || params.tDirection === 'opposite',
                isPrecordial: true,
            };
        }

        const angle = this.leadAngles[lead];
        const isPrecordial = angle === null;

        if (!isPrecordial) {
            const qrsAxis = params.qrsAxis ?? params.axis ?? 30;
            const pAxis = params.pAxis ?? 50;
            const tAxis = params.tAxis ?? 40;

            const qrsProj = Math.cos((qrsAxis - angle) * Math.PI / 180);
            const pProj = Math.cos((pAxis - angle) * Math.PI / 180);
            const tProj = Math.cos((tAxis - angle) * Math.PI / 180);

            const aVRFlip = lead === 'aVR' ? -1 : 1;

            return {
                qrsScale: qrsProj * aVRFlip,
                pScale: pProj * aVRFlip,
                tScale: tProj * aVRFlip,
                stScale: 1,
                isPrecordial: false,
            };
        }

        const idx = this.precordialIndex[lead];
        const rScale = 0.15 + idx * 0.17;
        const sScale = 1.0 - idx * 0.18;
        const tScale = 0.3 + idx * 0.14;

        let stExtra = 0;
        let tInvert = false;

        if (params.qWave && params.qWave.leads && params.qWave.leads.includes(lead)) {
            stExtra = params.stElevation || 0;
        }

        if (params.stDepressionLeads && params.stDepressionLeads.includes(lead)) {
            stExtra = params.stDepression || 0;
        }

        if (params.brugadaPattern && (lead === 'V1' || lead === 'V2' || lead === 'V3')) {
            stExtra = params.stElevation || 0;
            tInvert = true;
        }

        if (params.leadsInvolved && params.leadsInvolved.includes(lead)) {
            tInvert = params.tInvertedDeep || params.tInverted || false;
        }

        if (params.stDiffuse && lead !== 'V1') {
            stExtra = params.stElevation || 0;
        }

        let rExtra = 0;
        if (params.v1DominantR && (lead === 'V1' || lead === 'V2')) {
            rExtra = params.v1RAmplitude || 0.5;
        }

        let sExtra = 0;
        if (params.sWaveBroad && (lead === 'V5' || lead === 'V6')) {
            sExtra = 0.15;
        }

        let voltageMult = 1;
        if (params.highVoltage && (lead === 'V4' || lead === 'V5' || lead === 'V6')) {
            voltageMult = 1.8;
        }

        return {
            qrsScale: rScale,
            sScale: sScale,
            rExtra: rExtra,
            sExtra: sExtra,
            tScale: tScale,
            stScale: 1,
            stExtra: stExtra,
            tInvert: tInvert,
            voltageMult: voltageMult,
            isPrecordial: true,
        };
    }

    generateLeadBeat(lead, baseBeatPoints, params) {
        const factors = this.getLeadFactors(lead, params);
        const leadPts = [];

        for (const pt of baseBeatPoints) {
            let amp = pt.amplitude;

            if (factors.isPrecordial) {
                if (pt.c === 'P') {
                    amp *= 0.6;
                } else if (pt.c === 'Q') {
                    amp *= 0.8 * (factors.qrsScale || 1);
                } else if (pt.c === 'R') {
                    amp *= (factors.qrsScale || 0.5) * (factors.voltageMult || 1);
                    amp += (factors.rExtra || 0);
                } else if (pt.c === 'S') {
                    amp *= (factors.sScale || 0.8);
                    amp -= (factors.sExtra || 0);
                } else if (pt.c === 'T') {
                    amp *= (factors.tScale || 0.5);
                    if (factors.tInvert) amp = -Math.abs(amp);
                } else if (pt.c === 'ST') {
                    amp += (factors.stExtra || 0);
                }
            } else {
                if (pt.c === 'P') {
                    amp *= factors.pScale;
                } else if (pt.c === 'R' || pt.c === 'Q' || pt.c === 'S') {
                    amp *= factors.qrsScale;
                } else if (pt.c === 'T') {
                    amp *= factors.tScale;
                }
            }

            leadPts.push({ time: pt.time, amplitude: amp, c: pt.c });
        }

        return leadPts;
    }

    generateRhythm(params, totalDuration) {
        const beats = [];
        let t = 0;
        const type = params.rhythmType || 'sinus';

        switch (type) {
            case 'atrial_fibrillation':
                this._genAFib(params, totalDuration, beats, t); break;
            case 'atrial_flutter':
                this._genAFlutter(params, totalDuration, beats, t); break;
            case 'sinus_arrhythmia':
                this._genSinusArrhythmia(params, totalDuration, beats, t); break;
            case 'ventricular_fibrillation':
                this._genVFib(params, totalDuration, beats, t); break;
            case 'complete_heart_block':
                this._genCHB(params, totalDuration, beats, t); break;
            case 'sinus_with_pvc':
                this._genPVC(params, totalDuration, beats, t); break;
            case 'sinus_with_wenckebach':
                this._genWenckebach(params, totalDuration, beats, t); break;
            case 'sinus_with_mobitz2':
                this._genMobitz2(params, totalDuration, beats, t); break;
            case 'torsades':
                this._genTorsades(params, totalDuration, beats, t); break;
            case 'paced':
                this._genPaced(params, totalDuration, beats, t); break;
            default:
                this._genRegular(params, totalDuration, beats, t);
        }
        return beats;
    }

    _genRegular(p, total, beats, t) {
        const rr = 60 / (p.heartRate || 70);
        while (t < total) {
            const b = this.generateBeatPoints(p);
            beats.push({ ...b, startTime: t, endTime: t + b.duration, isPVC: false, isDropped: false, isPaced: false });
            t += rr;
        }
    }

    _genSinusArrhythmia(p, total, beats, t) {
        const base = p.heartRate || 72;
        const var_ = p.respiratoryVariation || 15;
        const cycle = 4;
        let phase = 0;
        while (t < total) {
            const hr = base + var_ * Math.sin(phase * Math.PI * 2);
            const rr = 60 / hr;
            beats.push({ ...this.generateBeatPoints({ ...p, heartRate: hr }), startTime: t, endTime: t + rr, isPVC: false, isDropped: false, isPaced: false });
            phase += rr / cycle;
            t += rr;
        }
    }

    _genAFib(p, total, beats, t) {
        const ap = { ...p, pPresent: false };
        while (t < total) {
            const minR = p.rrVariation ? p.rrVariation.min : 0.5;
            const maxR = p.rrVariation ? p.rrVariation.max : 1.1;
            const rr = minR + Math.random() * (maxR - minR);
            const b = this.generateBeatPoints(ap);
            if (p.fibrillationWaves) {
                const fA = p.fibrillationWaves.amplitude || 0.08;
                for (let i = 0; i < Math.floor(rr * 6); i++) {
                    b.points.push({ time: (i / 6) * (rr * 0.8), amplitude: fA * (0.3 + 0.7 * Math.random()) * Math.sin(i * 1.5), c: 'f' });
                }
            }
            beats.push({ ...b, startTime: t, endTime: t + rr, isPVC: false, isDropped: false, isPaced: false });
            t += rr;
        }
    }

    _genAFlutter(p, total, beats, t) {
        const ap = { ...p, pPresent: false };
        const fRate = p.flutterWaves ? p.flutterWaves.frequency : 300;
        const ratio = p.flutterWaves ? p.flutterWaves.conductionRatio : 3;
        const vRate = fRate / ratio;
        const rr = 60 / vRate;
        const fInt = 60 / fRate;
        const fA = p.flutterWaves ? p.flutterWaves.amplitude : 0.25;
        while (t < total) {
            const b = this.generateBeatPoints(ap);
            const nF = Math.floor(rr / fInt);
            for (let i = 0; i < nF; i++) {
                for (let j = 0; j < 5; j++) {
                    b.points.push({ time: i * fInt + (j / 5) * fInt * 0.5, amplitude: fA * (1 - 2 * j / 5), c: 'F' });
                }
            }
            beats.push({ ...b, startTime: t, endTime: t + rr, isPVC: false, isDropped: false, isPaced: false });
            t += rr;
        }
    }

    _genCHB(p, total, beats, t) {
        const vRate = p.heartRate || 40;
        const aRate = p.atrialRate || 75;
        const vr = 60 / vRate;
        const ar = 60 / aRate;
        const ap = { ...p, prInterval: null };
        if (p.junctionalQrs) { ap.qrsDuration = 100; ap.qrsAmplitude = 1.5; }
        while (t < total) {
            const b = this.generateBeatPoints(ap);
            for (let at = t; at < t + vr; at += ar) {
                for (let i = 0; i < 10; i++) {
                    b.points.push({ time: (at - t) + (i / 10) * 0.1, amplitude: (p.pAmplitude || 0.15) * Math.exp(-Math.pow(((i / 10) - 0.5) / 0.2, 2)), c: 'Pd' });
                }
            }
            beats.push({ ...b, startTime: t, endTime: t + vr, isPVC: false, isDropped: false, isPaced: false });
            t += vr;
        }
    }

    _genVFib(p, total, beats, t) {
        const a = p.vfAmplitude ? (p.vfAmplitude.coarse ? 0.5 : 0.2) : 0.3;
        const pts = [];
        const n = Math.floor(total * 120);
        for (let i = 0; i < n; i++) {
            const time = (i / n) * total;
            const y = a * (Math.sin(time * 9) * Math.sin(time * 14) + 0.5 * Math.sin(time * 6) * Math.cos(time * 8) + 0.3 * Math.sin(time * 18) * Math.sin(time * 12)) * (0.5 + 0.5 * Math.sin(time * 0.35));
            pts.push({ time, amplitude: y, c: 'VF' });
        }
        beats.push({ points: pts, startTime: 0, endTime: total, duration: total, isVF: true, isPVC: false, isDropped: false, isPaced: false });
    }

    _genPVC(p, total, beats, t) {
        const hr = p.heartRate || 72;
        const baseRR = 60 / hr;
        const pvcInt = 60 / (p.pvcFrequency || 6);
        let nextPVC = pvcInt;
        while (t < total) {
            if (nextPVC < baseRR * 2) {
                const nBeats = Math.floor(nextPVC / baseRR);
                for (let i = 0; i < nBeats; i++) {
                    const b = this.generateBeatPoints(p);
                    beats.push({ ...b, startTime: t, endTime: t + b.duration, isPVC: false, isDropped: false, isPaced: false });
                    t += baseRR;
                }
                const pvcP = { ...p, qrsDuration: p.pvcQrsDuration || 140, qrsAmplitude: p.qrsAmplitude * 1.3, pPresent: false, tDirection: 'opposite', twaveShape: 'opposite_qrs', tAmplitude: p.tAmplitude * 1.3 };
                const b = this.generateBeatPoints(pvcP);
                beats.push({ ...b, startTime: t, endTime: t + b.duration, isPVC: true, isDropped: false, isPaced: false });
                t += baseRR * 1.8;
                nextPVC = pvcInt;
            } else {
                const b = this.generateBeatPoints(p);
                beats.push({ ...b, startTime: t, endTime: t + b.duration, isPVC: false, isDropped: false, isPaced: false });
                t += baseRR;
                nextPVC -= baseRR;
            }
        }
    }

    _genWenckebach(p, total, beats, t) {
        const cycle = p.droppedBeatEvery || 4;
        const basePR = p.prBaseInterval || 180;
        const inc = p.prIncrement || 40;
        let bi = 0;
        const rr = 60 / (p.heartRate || 65);
        while (t < total) {
            if (bi < cycle - 1) {
                const bp = { ...p, prInterval: basePR + bi * inc };
                const b = this.generateBeatPoints(bp);
                beats.push({ ...b, startTime: t, endTime: t + b.duration, isPVC: false, isDropped: false, isPaced: false });
                bi++;
            } else {
                const dp = { ...p, qrsAmplitude: 0, qrsDuration: 1, tAmplitude: 0, tDuration: 1, prInterval: basePR + bi * inc };
                const b = this.generateBeatPoints(dp);
                b.points = b.points.filter(pt => pt.c === 'P');
                beats.push({ ...b, startTime: t, endTime: t + 0.3, duration: 0.3, isPVC: false, isDropped: true, isPaced: false });
                bi = 0;
                t += rr * 1.5;
                continue;
            }
            t += rr;
        }
    }

    _genMobitz2(p, total, beats, t) {
        const cycle = p.droppedBeatEvery || 3;
        let bi = 0;
        const rr = 60 / (p.heartRate || 60);
        while (t < total) {
            if (bi < cycle - 1) {
                const b = this.generateBeatPoints(p);
                beats.push({ ...b, startTime: t, endTime: t + b.duration, isPVC: false, isDropped: false, isPaced: false });
                bi++;
                t += rr;
            } else {
                const dp = { ...p, qrsAmplitude: 0, qrsDuration: 1, tAmplitude: 0, tDuration: 1 };
                const b = this.generateBeatPoints(dp);
                b.points = b.points.filter(pt => pt.c === 'P');
                beats.push({ ...b, startTime: t, endTime: t + 0.3, duration: 0.3, isPVC: false, isDropped: true, isPaced: false });
                bi = 0;
                t += rr * 2;
            }
        }
    }

    _genTorsades(p, total, beats, t) {
        const baseHR = p.heartRate || 200;
        const cycle = 3;
        while (t < total) {
            const phase = t / cycle;
            const env = Math.abs(Math.sin(phase * Math.PI));
            const hr = baseHR + 30 * Math.sin(phase * 2 * Math.PI);
            const rr = 60 / hr;
            const bp = { ...p, qrsAmplitude: (p.qrsAmplitude || 1.8) * env };
            const b = this.generateBeatPoints(bp);
            b.points = b.points.map(pt => ({ ...pt, amplitude: pt.amplitude * (0.7 + 0.3 * Math.sin((pt.time + t) / cycle * 2 * Math.PI)) }));
            beats.push({ ...b, startTime: t, endTime: t + rr, isPVC: false, isDropped: false, isPaced: false });
            t += rr;
        }
    }

    _genPaced(p, total, beats, t) {
        const rr = 60 / (p.heartRate || 70);
        while (t < total) {
            const b = this.generateBeatPoints(p);
            if (p.paceSpike) {
                b.points.unshift({ time: -0.002, amplitude: 0, c: 'pk' });
                b.points.unshift({ time: -0.002, amplitude: p.paceSpike.amplitude || 0.3, c: 'pk' });
            }
            beats.push({ ...b, startTime: t, endTime: t + rr, isPVC: false, isDropped: false, isPaced: true });
            t += rr;
        }
    }

    render(params) {
        this.renderInit(params);
        for (const lead of ['I','II','III','aVR','aVL','aVF','V1','V2','V3','V4','V5','V6']) {
            this.renderSingleLead(lead, params);
        }
        this.renderRhythmStrip('II', params);
        this._notifyInterpretation(params);
        return params;
    }

    renderInit(params) {
        this.params = params;
        this.initCanvas();

        const ctx = this.ctx;
        ctx.fillStyle = this.colors.background;
        ctx.fillRect(0, 0, this.displayWidth, this.displayHeight);

        const layout = this.calcLayout();
        const { leadW, leadH, rhythmH, offsetX: ox, offsetY: oy } = layout;

        this.drawFullGrid(ox, oy, layout.totalW, layout.totalH);

        this._layout = layout;
        this._leadDuration = 2.5;
        this._rhythmDuration = 10;
        this._baseBeats = this.generateRhythm(params, Math.max(this._leadDuration, this._rhythmDuration) + 1);

        this._leadPanels = [];
        for (let row = 0; row < this.LEAD_ROWS; row++) {
            for (let col = 0; col < this.LEAD_COLS; col++) {
                const lead = this.leadOrder[row][col];
                const x = ox + col * leadW;
                const y = oy + row * leadH;
                this._leadPanels.push({ lead, x, y, w: leadW, h: leadH });
            }
        }
        this._rhythmPanel = {
            lead: 'II',
            x: ox, y: oy + this.LEAD_ROWS * leadH,
            w: this.LEAD_COLS * leadW, h: rhythmH,
        };

        for (const p of this._leadPanels) {
            this.drawLeadLabel(p.x, p.y, p.lead);
        }
        const firstPanel = this._leadPanels[0];
        if (firstPanel) this.drawInfoLabel(firstPanel.x, firstPanel.y, firstPanel.w);

        if (this.showLabels) {
            ctx.fillStyle = '#aaa';
            ctx.font = `${9 * this.zoomLevel}px "Segoe UI", sans-serif`;
            ctx.textAlign = 'left';
            ctx.fillText('II', this._rhythmPanel.x + 2, this._rhythmPanel.y + 10);
            ctx.textAlign = 'right';
            ctx.fillText('Rhythm Strip', this._rhythmPanel.x + this._rhythmPanel.w - 2, this._rhythmPanel.y + 10);
        }
    }

    renderSingleLead(leadName, params) {
        const panel = this._leadPanels.find(p => p.lead === leadName);
        if (!panel) return;
        const leadParams = { ...params, _noProjection: true };
        const dur = this._leadDuration;
        this.drawWaveformInRect(panel.x, panel.y, panel.w, panel.h, leadName, this._baseBeats, leadParams, dur);
    }

    renderRhythmStrip(leadName, params) {
        const rp = this._rhythmPanel;
        const dur = this._rhythmDuration;
        this.drawWaveformInRect(rp.x, rp.y, rp.w, rp.h, leadName || rp.lead, this._baseBeats, params || this.params, dur);
    }

    renderLeadCurve(lead, points, params) {
        const panel = this._leadPanels.find(p => p.lead === lead);
        if (!panel) return;
        const smoothed = catmullRomSmooth(points, 0.002);
        this._leadCurves[lead] = smoothed;
        const dur = this._leadDuration;
        this.drawPointCurveInRect(panel.x, panel.y, panel.w, panel.h, smoothed, params, dur);
    }

    renderRhythmCurve(lead, params) {
        const rp = this._rhythmPanel;
        const curve = this._leadCurves[lead] || this._leadCurves['II'] || [];
        if (curve.length === 0) return;
        const dur = this._rhythmDuration;
        this.drawPointCurveInRect(rp.x, rp.y, rp.w, rp.h, curve, params, dur);
    }

    drawPointCurveInRect(rx, ry, rw, rh, curvePoints, params, duration) {
        const ctx = this.ctx;
        const baseline = ry + rh * 0.5;
        const cycleLen = curvePoints.length > 0 ? curvePoints[curvePoints.length - 1][0] : 1;
        const repCount = Math.ceil(duration / cycleLen) + 1;

        const allPts = [];
        for (let rep = 0; rep < repCount; rep++) {
            const offset = rep * cycleLen;
            for (const [t, mv] of curvePoints) {
                const absTime = offset + t;
                if (absTime < duration) {
                    allPts.push({ time: absTime, mv });
                }
            }
        }

        ctx.strokeStyle = this.colors.waveform;
        ctx.lineWidth = 1.3 * this.zoomLevel;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();

        let started = false;
        const leftMargin = this.mmToPx(1);
        for (const pt of allPts) {
            const sx = rx + (pt.time / duration) * rw;
            const sy = baseline - this.mvToPx(pt.mv);
            if (sx > rx + rw) break;
            if (sx < rx - leftMargin) continue;
            if (!started) { ctx.moveTo(sx, sy); started = true; }
            else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
    }

    _notifyInterpretation(params) {
        const interp = this.getInterpretationData(params || this.params);
        if (this.onInterpretationChange) {
            this.onInterpretationChange(interp);
        }
    }

    drawWaveformInRect(rx, ry, rw, rh, lead, baseBeats, params, duration) {
        const ctx = this.ctx;
        const baseline = ry + rh * 0.5;

        const allPts = [];
        for (const beat of baseBeats) {
            if (beat.endTime > duration + 0.5) continue;
            if (beat.isVF) {
                for (const pt of beat.points) {
                    if (pt.time > duration) break;
                    const factors = this.getLeadFactors(lead, params);
                    allPts.push({ time: pt.time, amplitude: pt.amplitude * (factors.qrsScale || 1), c: pt.c });
                }
                continue;
            }

            const leadPts = this.generateLeadBeat(lead, beat.points, params);
            for (const pt of leadPts) {
                const absTime = beat.startTime + pt.time;
                if (absTime < duration) {
                    allPts.push({ time: absTime, amplitude: pt.amplitude, c: pt.c, isPVC: beat.isPVC });
                }
            }
        }
        allPts.sort((a, b) => a.time - b.time);

        ctx.strokeStyle = this.colors.waveform;
        ctx.lineWidth = 1.3 * this.zoomLevel;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();

        let started = false;
        const leftMargin = this.mmToPx(1);
        for (const pt of allPts) {
            const sx = rx + (pt.time / duration) * rw;
            const sy = baseline - this.mvToPx(pt.amplitude);
            if (sx > rx + rw) break;
            if (sx < rx - leftMargin) continue;
            if (!started) { ctx.moveTo(sx, sy); started = true; }
            else ctx.lineTo(sx, sy);
        }
        ctx.stroke();

        ctx.save();
        ctx.beginPath();
        ctx.rect(rx, ry, rw, rh);
        ctx.clip();

        for (const beat of baseBeats) {
            if (!beat.isPVC || beat.startTime > duration) continue;
            const sx = rx + (beat.startTime / duration) * rw;
            const ex = rx + (Math.min(beat.endTime + 0.3, duration) / duration) * rw;
            if (sx < rx + rw) {
                ctx.fillStyle = 'rgba(255,0,0,0.06)';
                ctx.fillRect(sx, ry, Math.max(ex - sx, 6), rh);
                if (this.showLabels) {
                    ctx.fillStyle = this.colors.label;
                    ctx.font = `${7 * this.zoomLevel}px sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.fillText('PVC', (sx + ex) / 2, ry + 10);
                }
            }
        }

        ctx.restore();
    }

    getInterpretationData(params) {
        const items = [];

        if (params.heartRate) {
            let cls = 'normal';
            if (params.heartRate < 60) cls = 'low';
            if (params.heartRate > 100) cls = 'high';
            items.push({ text: `¤ß²v¡G${params.heartRate} bpm`, className: cls });
        }

        const rMap = {
            'sinus': '?©Ê¤ß«ß', 'atrial_fibrillation': '¤ß©Ð?‰V', 'atrial_flutter': '¤ß©Ð¥·‰V',
            'ventricular': '«Ç©Ê¤ß«ß', 'paced': '°_·i¤ß«ß', 'complete_heart_block': '§¹¥þ©ÊAVB',
            'ventricular_fibrillation': '¤ß«Ç?‰V', 'torsades': '¦yºÝ§á?«¬«Ç³t',
            'sinus_with_pvc': '?©Ê+«Ç¦­', 'sinus_arrhythmia': '?©Ê¤ß«ß¤£ ü',
            'sinus_with_wenckebach': '¤G«×I«¬AVB', 'sinus_with_mobitz2': '¤G«×II«¬AVB',
            'atrial': '©Ð©Ê¤ß«ß',
        };
        if (params.rhythmType && rMap[params.rhythmType]) {
            items.push({ text: `?«ß¡G${rMap[params.rhythmType]}`, className: 'normal' });
        }

        if (params.prInterval) {
            let cls = 'normal';
            if (params.prInterval > 200) cls = 'high';
            items.push({ text: `PR¡G${params.prInterval} ms${params.prInterval > 200 ? ' (©µ‹ë)' : ''}`, className: cls });
        }

        if (params.qrsDuration) {
            let cls = 'normal';
            if (params.qrsDuration >= 120) cls = 'high';
            items.push({ text: `QRS¡G${params.qrsDuration} ms${params.qrsDuration >= 120 ? ' (¼W?)' : ''}`, className: cls });
        }

        if (params.qtInterval) {
            let cls = 'normal';
            const qtc = params.qtcInterval || params.qtInterval;
            if (qtc > 440) cls = 'high';
            if (qtc < 350) cls = 'low';
            items.push({ text: `QTc¡G${qtc} ms`, className: cls });
        }

        if (params.stElevation > 0) {
            items.push({ text: `ST©ï°ª¡G${(params.stElevation * 10).toFixed(1)} mm`, className: 'warning' });
        }
        if (params.stDepression < 0) {
            items.push({ text: `ST?§C¡G${Math.abs(params.stDepression * 10).toFixed(1)} mm`, className: 'warning' });
        }

        if (params.tInverted) items.push({ text: 'Tªi­Ë¸m', className: 'warning' });
        if (params.tPeaked) items.push({ text: 'Tªi°ª¦y', className: 'warning' });
        if (params.tFlattened) items.push({ text: 'Tªi§C¥­', className: 'normal' });
        if (params.qWave) items.push({ text: '¯f²z©ÊQªi', className: 'critical' });
        if (params.qrsAxis) items.push({ text: `‰m?¡G${params.qrsAxis}¢X`, className: 'normal' });

        return items;
    }

    setPaperSpeed(s) { this.paperSpeed = s; }
    setGain(g) { this.gain = g; }
    setGrid(v) { this.showGrid = v; }
    setLabels(v) { this.showLabels = v; }
    setZoom(l) { this.zoomLevel = Math.max(0.4, Math.min(3, l)); }

    adjustZoom(delta) {
        this.zoomLevel = Math.max(0.4, Math.min(3, this.zoomLevel + delta));
        if (this.params) this.render(this.params);
    }

    resetZoom() {
        this.zoomLevel = 1.0;
        if (this.params) this.render(this.params);
    }

    exportImage(fmt = 'png') { return this.canvas.toDataURL(`image/${fmt}`); }

    downloadImage(fn = 'ecg-12lead.png') {
        const a = document.createElement('a');
        a.download = fn;
        a.href = this.exportImage();
        a.click();
    }
}

function catmullRomSpline(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    return 0.5 * (
        (2 * p1) +
        (-p0 + p2) * t +
        (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
        (-p0 + 3 * p1 - 3 * p2 + p3) * t3
    );
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
            const time = p1[0] + t * segLen;
            const mv = catmullRomSpline(p0[1], p1[1], p2[1], p3[1], t);
            result.push([time, mv]);
        }
    }
    result.push([points[n - 1][0], points[n - 1][1]]);
    return result;
}

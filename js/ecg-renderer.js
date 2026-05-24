// 12-Lead ECG Renderer
// Renders a complete 12-lead ECG report on a single canvas
// Based on hexaxial reference system and precordial progression

class ECGRenderer {
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

        this.colors = {
            background: '#f5f5e8',
            gridMinor: '#f2d4d4',
            gridMajor: '#ffc0c0',
            waveform: '#1a1a1a',
            label: '#666',
            panelBorder: '#d4a0a0',
            rhythmBorder: '#c08080',
        };

        // 12-lead layout: 4 columns, 3 rows of leads + 1 rhythm strip row
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

        // Lead angles for hexaxial projection (degrees)
        this.leadAngles = {
            'I': 0, 'II': 60, 'III': 120,
            'aVR': -150, 'aVL': -30, 'aVF': 90,
            'V1': null, 'V2': null, 'V3': null,
            'V4': null, 'V5': null, 'V6': null,
        };

        // Precordial index (0=V1 through 5=V6) for R/S progression
        this.precordialIndex = {
            'V1': 0, 'V2': 1, 'V3': 2, 'V4': 3, 'V5': 4, 'V6': 5,
        };
    }

    mmToPx(mm) { return mm * this.dpr * this.zoomLevel * 3.78; }
    timeToPx(sec) { return this.mmToPx(sec * this.paperSpeed); }
    mvToPx(mV) { return this.mmToPx(mV * this.gain); }

    // ---- LAYOUT CALC ----
    calcLayout() {
        const w = this.displayWidth;
        const h = this.displayHeight;
        const topMargin = 14;
        const bottomMargin = 8;
        const leftMargin = 10;
        const rightMargin = 6;
        const gapX = 8;
        const gapY = 8;

        // 4 rows total: 3 lead rows + 1 rhythm strip
        const rhythmFrac = 0.22; // rhythm strip takes 22% of height
        const availH = h - topMargin - bottomMargin - gapY * 3;
        const rhythmH = availH * rhythmFrac;
        const leadRowH = (availH - rhythmH - gapY * 3) / 3;
        const leadW = (w - leftMargin - rightMargin - gapX * 3) / 4;

        const rhythmTop = topMargin + (leadRowH + gapY) * 3;

        return {
            leftMargin, topMargin, gapX, gapY, leadW, leadRowH, rhythmH, rhythmTop, rhythmLeft: leftMargin,
            rhythmW: leadW * 4 + gapX * 3,
        };
    }

    // ---- INIT CANVAS ----
    initCanvas() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.displayWidth = rect.width;
        this.displayHeight = rect.height;
        this.canvas.width = this.displayWidth * this.dpr;
        this.canvas.height = this.displayHeight * this.dpr;
        this.canvas.style.width = this.displayWidth + 'px';
        this.canvas.style.height = this.displayHeight + 'px';
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(this.dpr, this.dpr);
    }

    // ---- GRID ----
    drawGrid(x, y, w, h, isRhythm) {
        const ctx = this.ctx;
        ctx.fillStyle = this.colors.background;
        ctx.fillRect(x, y, w, h);

        if (!this.showGrid) return;

        const small = this.mmToPx(1);
        const large = this.mmToPx(5);

        // Minor grid
        ctx.strokeStyle = this.colors.gridMinor;
        ctx.lineWidth = 0.4;
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

        // Major grid
        ctx.strokeStyle = this.colors.gridMajor;
        ctx.lineWidth = 0.8;
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

        // Panel border
        ctx.strokeStyle = isRhythm ? this.colors.rhythmBorder : this.colors.panelBorder;
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, w, h);
    }

    // ---- LABELS ----
    drawLeadLabel(x, y, leadName) {
        if (!this.showLabels) return;
        const ctx = this.ctx;
        ctx.fillStyle = this.colors.label;
        ctx.font = `bold ${11 * this.zoomLevel}px "Segoe UI", sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(leadName, x + 4, y + 14);
    }

    drawInfoLabel(x, y, w) {
        if (!this.showLabels) return;
        const ctx = this.ctx;
        ctx.fillStyle = '#999';
        ctx.font = `${8 * this.zoomLevel}px "Courier New", monospace`;
        ctx.textAlign = 'right';
        ctx.fillText(`25mm/s  10mm/mV`, x + w - 4, y + 14);
    }

    // ---- WAVEFORM GENERATION ----
    // Generate a single beat's raw waveform points (time relative to beat start)
    // Returns { points, duration } where points is [{time, amplitude, component}]
    generateBeatPoints(params, beatIndex) {
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

        // P wave
        if (hasP) {
            const pStart = -prDur - pDur * 0.9;
            this._addPWave(points, pStart, pDur, pAmp, params);
        }

        // QRS
        const qrsStart = 0;
        this._addQRS(points, qrsStart, qrsDur, qrsAmp, params);

        // ST segment
        const stStart = qrsDur;
        const stDur = qtDur - qrsDur - tDur;
        if (stDur > 0) {
            this._addST(points, stStart, stDur, params);
        }

        // T wave
        const tStart = qtDur - tDur;
        this._addTWave(points, tStart, tDur, tAmp, params);

        // U wave
        if (params.uWavePresent || params.uWaveProminent) {
            const uStart = qtDur + 0.02;
            this._addUWave(points, uStart, 0.1, params.uWaveAmplitude || 0.1, params);
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
        const wide = p.qrsDuration >= 120;
        let qD = amp * 0.12;
        let rH = amp;
        let sD = amp * 0.15;

        if (p.qWave) qD = p.qWave.depth || qD;
        if (p.qrsMorphology === 'wide_bizarre') { rH = amp * 1.3; sD = amp * 0.5; }
        if (p.qrsMorphology === 'paced_lbbb') { qD = 0.03; rH = amp * 0.8; sD = amp * 1.2; }
        if (p.rbbbRsrPattern) rH = amp * 0.6;

        // Q
        const nQ = Math.floor(n * 0.13);
        for (let i = 0; i < nQ; i++) {
            pts.push({ time: t0 + (i / n) * dur, amplitude: -qD * Math.sin((i / nQ) * Math.PI / 2), c: 'Q' });
        }
        // R up
        const nRu = Math.floor(n * 0.22);
        for (let i = 0; i < nRu; i++) {
            const f = i / nRu;
            let y = -qD + (rH + qD) * (1 - Math.pow(1 - f, 2.5));
            if (p.qrsNotching && i > nRu * 0.5) y -= 0.04 * Math.sin((i - nRu * 0.5) / (nRu * 0.5) * Math.PI);
            pts.push({ time: t0 + ((nQ + i) / n) * dur, amplitude: y, c: 'R' });
        }
        // R down
        const nRd = Math.floor(n * 0.3);
        const rPeak = nQ + nRu;
        for (let i = 0; i < nRd; i++) {
            const f = i / nRd;
            let y = rH * (1 - Math.pow(f, 1.3));
            if (p.qrsNotching && i < nRd * 0.3) y -= 0.04 * Math.sin(i / (nRd * 0.3) * Math.PI);
            y = Math.max(y, -sD);
            pts.push({ time: t0 + ((rPeak + i) / n) * dur, amplitude: y, c: 'R' });
        }
        // S
        const nS = n - rPeak - nRd;
        for (let i = 0; i < nS; i++) {
            pts.push({ time: t0 + ((rPeak + nRd + i) / n) * dur, amplitude: -sD * Math.sin((i / nS) * Math.PI / 2), c: 'S' });
        }

        // Terminal R' for RBBB
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
        const inverted = p.tInverted || p.tDirection === 'opposite' || false;
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
                    y = a * Math.exp(-Math.pow((f - 0.3) / 0.25, 2)); break;
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

    // ---- LEAD PROJECTION ----
    // Project the cardiac vector onto a specific lead
    // Returns scale factors for P, QRS, T amplitudes and ST shift
    getLeadFactors(lead, params) {
        const angle = this.leadAngles[lead];
        const isPrecordial = angle === null;

        if (!isPrecordial) {
            // Limb lead: project main QRS axis
            const qrsAxis = params.qrsAxis || params.axis || 30;
            const pAxis = params.pAxis || 50;
            const tAxis = params.tAxis || 40;

            const qrsProj = Math.cos((qrsAxis - angle) * Math.PI / 180);
            const pProj = Math.cos((pAxis - angle) * Math.PI / 180);
            const tProj = Math.cos((tAxis - angle) * Math.PI / 180);

            // aVR is typically inverted
            const aVRFlip = lead === 'aVR' ? -1 : 1;

            return {
                qrsScale: qrsProj * aVRFlip,
                pScale: pProj * aVRFlip,
                tScale: tProj * aVRFlip,
                stScale: 1,
                qInvert: false,
                tInvert: false,
            };
        } else {
            // Precordial lead: use progression model
            const idx = this.precordialIndex[lead];
            // R wave grows, S wave shrinks from V1 to V6
            const rScale = 0.15 + idx * 0.17; // 0.15 → 1.0
            const sScale = 1.0 - idx * 0.18;  // 1.0 → 0.1
            const tScale = 0.3 + idx * 0.14;  // 0.3 → 1.0

            // Check for condition-specific overrides
            let stFactor = 1;
            let stExtra = 0;
            let tInvert = false;

            // Anterior MI: V1-V4 ST elevation
            if (params.qWave && params.qWave.leads) {
                if (params.qWave.leads.includes(lead)) {
                    stExtra = params.stElevation || 0;
                }
            }

            // Posterior MI: V1-V3 ST depression
            if (params.stDepressionLeads && params.stDepressionLeads.includes(lead)) {
                stExtra = params.stDepression || 0;
            }

            // Brugada: V1-V3 coved ST
            if (params.brugadaPattern && (lead === 'V1' || lead === 'V2' || lead === 'V3')) {
                stExtra = params.stElevation || 0;
                tInvert = true;
            }

            // Wellens: V2-V4 deep T inversion
            if (params.leadsInvolved && params.leadsInvolved.includes(lead)) {
                tInvert = params.tInvertedDeep || params.tInverted || false;
            }

            // Pericarditis: diffuse ST (but not aVR/V1)
            if (params.stDiffuse && lead !== 'V1') {
                stExtra = params.stElevation || 0;
            }

            // RVH: V1 dominant R
            let rExtra = 0;
            if (params.v1DominantR && (lead === 'V1' || lead === 'V2')) {
                rExtra = params.v1RAmplitude || 0.5;
            }

            // RBBB: V1 rsR', V6 broad S
            let sExtra = 0;
            if (params.sWaveBroad && (lead === 'V5' || lead === 'V6')) {
                sExtra = 0.15;
            }

            // LVH: high voltage V5/V6
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
                stScale: stFactor,
                stExtra: stExtra,
                tInvert: tInvert,
                voltageMult: voltageMult,
                isPrecordial: true,
            };
        }
    }

    // Generate beat points for a specific lead by projecting the base beat
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
                } else if (pt.c === 'R\'') {
                    amp *= 1.0;
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

    // ---- RHYTHM GENERATION ----
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
            const b = this.generateBeatPoints(p, beats.length);
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
            beats.push({ ...this.generateBeatPoints({ ...p, heartRate: hr }, beats.length), startTime: t, endTime: t + rr, isPVC: false, isDropped: false, isPaced: false });
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
            const b = this.generateBeatPoints(ap, beats.length);
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
            const b = this.generateBeatPoints(ap, beats.length);
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
            const b = this.generateBeatPoints(ap, beats.length);
            for (let at = t; at < t + vr; at += ar) {
                for (let i = 0; i < 10; i++) {
                    b.points.push({ time: at + (i / 10) * 0.1, amplitude: (p.pAmplitude || 0.15) * Math.exp(-Math.pow(((i / 10) - 0.5) / 0.2, 2)), c: 'Pd' });
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
                    const b = this.generateBeatPoints(p, beats.length);
                    beats.push({ ...b, startTime: t, endTime: t + b.duration, isPVC: false, isDropped: false, isPaced: false });
                    t += baseRR;
                }
                const pvcP = { ...p, qrsDuration: p.pvcQrsDuration || 140, qrsAmplitude: p.qrsAmplitude * 1.3, pPresent: false, tDirection: 'opposite', twaveShape: 'opposite_qrs', tAmplitude: p.tAmplitude * 1.3 };
                const b = this.generateBeatPoints(pvcP, beats.length);
                beats.push({ ...b, startTime: t, endTime: t + b.duration, isPVC: true, isDropped: false, isPaced: false });
                t += baseRR * 1.8;
                nextPVC = pvcInt;
            } else {
                const b = this.generateBeatPoints(p, beats.length);
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
                const b = this.generateBeatPoints(bp, beats.length);
                beats.push({ ...b, startTime: t, endTime: t + b.duration, isPVC: false, isDropped: false, isPaced: false });
                bi++;
            } else {
                const dp = { ...p, qrsAmplitude: 0, qrsDuration: 1, tAmplitude: 0, tDuration: 1, prInterval: basePR + bi * inc };
                const b = this.generateBeatPoints(dp, beats.length);
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
                const b = this.generateBeatPoints(p, beats.length);
                beats.push({ ...b, startTime: t, endTime: t + b.duration, isPVC: false, isDropped: false, isPaced: false });
                bi++;
            } else {
                const dp = { ...p, qrsAmplitude: 0, qrsDuration: 1, tAmplitude: 0, tDuration: 1 };
                const b = this.generateBeatPoints(dp, beats.length);
                b.points = b.points.filter(pt => pt.c === 'P');
                beats.push({ ...b, startTime: t, endTime: t + 0.3, duration: 0.3, isPVC: false, isDropped: true, isPaced: false });
                bi = 0;
            }
            t += rr;
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
            const b = this.generateBeatPoints(bp, beats.length);
            b.points = b.points.map(pt => ({ ...pt, amplitude: pt.amplitude * (0.7 + 0.3 * Math.sin((pt.time + t) / cycle * 2 * Math.PI)) }));
            beats.push({ ...b, startTime: t, endTime: t + rr, isPVC: false, isDropped: false, isPaced: false });
            t += rr;
        }
    }

    _genPaced(p, total, beats, t) {
        const rr = 60 / (p.heartRate || 70);
        while (t < total) {
            const b = this.generateBeatPoints(p, beats.length);
            if (p.paceSpike) {
                b.points.unshift({ time: -0.002, amplitude: 0, c: 'pk' });
                b.points.unshift({ time: -0.002, amplitude: p.paceSpike.amplitude || 0.3, c: 'pk' });
            }
            beats.push({ ...b, startTime: t, endTime: t + rr, isPVC: false, isDropped: false, isPaced: true });
            t += rr;
        }
    }

    // ---- RENDER ENTIRE REPORT ----
    render(params) {
        this.params = params;
        this.initCanvas();

        const ctx = this.ctx;
        const ctxW = this.displayWidth;
        const ctxH = this.displayHeight;
        const layout = this.calcLayout();
        const { leftMargin: LX, topMargin: TY, gapX, gapY, leadW, leadRowH, rhythmH, rhythmTop } = layout;

        // Generate base rhythm (for lead projection)
        const leadDuration = 2.5; // seconds per lead panel
        const rhythmDuration = 10; // seconds for rhythm strip
        const baseBeats = this.generateRhythm(params, Math.max(leadDuration, rhythmDuration) + 1);

        // Draw 12 lead panels
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 4; col++) {
                const lead = this.leadOrder[row][col];
                const x = LX + col * (leadW + gapX);
                const y = TY + row * (leadRowH + gapY);

                this.drawGrid(x, y, leadW, leadRowH, false);
                this.drawLeadLabel(x, y, lead);
                if (row === 0 && col === 0) this.drawInfoLabel(x, y, leadW);

                this.drawWaveformInRect(x, y, leadW, leadRowH, lead, baseBeats, params, leadDuration);
            }
        }

        // Draw rhythm strip
        const rX = layout.rhythmLeft;
        const rY = rhythmTop;
        const rW = layout.rhythmW;
        const rH = rhythmH;
        this.drawGrid(rX, rY, rW, rH, true);
        if (this.showLabels) {
            ctx.fillStyle = '#999';
            ctx.font = `bold ${10 * this.zoomLevel}px "Segoe UI", sans-serif`;
            ctx.textAlign = 'left';
            ctx.fillText('II', rX + 4, rY + 14);
            ctx.textAlign = 'right';
            ctx.fillText('Rhythm Strip', rX + rW - 4, rY + 14);
        }
        this.drawWaveformInRect(rX, rY, rW, rH, 'II', baseBeats, params, rhythmDuration);

        this.updateInterpretation(params);
        return params;
    }

    drawWaveformInRect(rx, ry, rw, rh, lead, baseBeats, params, duration) {
        const ctx = this.ctx;
        const baseline = ry + rh * 0.5;

        // Build lead-specific points from base beats
        const allPts = [];
        for (const beat of baseBeats) {
            if (beat.endTime > duration + 0.5) continue;
            if (beat.isVF) {
                // VF is chaotic - just use raw points with projection
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
                    allPts.push({ time: absTime, amplitude: pt.amplitude, c: pt.c, isPVC: beat.isPVC, isDropped: beat.isDropped, isPaced: beat.isPaced });
                }
            }
        }
        allPts.sort((a, b) => a.time - b.time);

        // Save context, clip to panel
        ctx.save();
        ctx.beginPath();
        ctx.rect(rx, ry, rw, rh);
        ctx.clip();

        // Draw waveform
        ctx.strokeStyle = this.colors.waveform;
        ctx.lineWidth = 1.3 * this.zoomLevel;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();

        let started = false;
        for (const pt of allPts) {
            const sx = rx + (pt.time / duration) * rw;
            const sy = baseline - this.mvToPx(pt.amplitude);
            if (sx > rx + rw) break;
            if (!started) { ctx.moveTo(sx, sy); started = true; }
            else ctx.lineTo(sx, sy);
        }
        ctx.stroke();

        // Highlight PVC regions
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

    // ---- INTERPRETATION ----
    updateInterpretation(params) {
        const el = document.getElementById('interpretationContent');
        const sec = document.getElementById('interpretationSection');
        if (!el || !sec) return;

        sec.style.display = 'block';
        const lines = [];

        if (params.heartRate) {
            let c = 'normal';
            if (params.heartRate < 60) c = 'low';
            if (params.heartRate > 100) c = 'high';
            lines.push(`<span class="int-item">心率：<strong class="${c}">${params.heartRate} bpm</strong></span>`);
        }

        const rMap = {
            'sinus': '窦性心律', 'atrial_fibrillation': '心房颤动', 'atrial_flutter': '心房扑动',
            'ventricular': '室性心律', 'paced': '起搏心律', 'complete_heart_block': '完全性AVB',
            'ventricular_fibrillation': '心室颤动', 'torsades': '尖端扭转型室速',
            'sinus_with_pvc': '窦性+室早', 'sinus_arrhythmia': '窦性心律不齐',
            'sinus_with_wenckebach': '二度I型AVB', 'sinus_with_mobitz2': '二度II型AVB',
            'atrial': '房性心律',
        };
        if (params.rhythmType && rMap[params.rhythmType]) {
            lines.push(`<span class="int-item">节律：<strong>${rMap[params.rhythmType]}</strong></span>`);
        }

        if (params.prInterval) {
            let c = 'normal';
            if (params.prInterval > 200) c = 'high';
            lines.push(`<span class="int-item">PR：<strong class="${c}">${params.prInterval} ms</strong>${params.prInterval > 200 ? ' (延长)' : ''}</span>`);
        }

        if (params.qrsDuration) {
            let c = 'normal';
            if (params.qrsDuration >= 120) c = 'high';
            lines.push(`<span class="int-item">QRS：<strong class="${c}">${params.qrsDuration} ms</strong>${params.qrsDuration >= 120 ? ' (增宽)' : ''}</span>`);
        }

        if (params.qtInterval) {
            let c = 'normal';
            const qtc = params.qtcInterval || params.qtInterval;
            if (qtc > 440) c = 'high';
            if (qtc < 350) c = 'low';
            lines.push(`<span class="int-item">QTc：<strong class="${c}">${qtc} ms</strong></span>`);
        }

        if (params.stElevation > 0) {
            lines.push(`<span class="int-item int-warning">ST抬高：${(params.stElevation * 10).toFixed(1)} mm</span>`);
        }
        if (params.stDepression < 0) {
            lines.push(`<span class="int-item int-warning">ST压低：${Math.abs(params.stDepression * 10).toFixed(1)} mm</span>`);
        }

        if (params.tInverted) lines.push('<span class="int-item int-warning">T波倒置</span>');
        if (params.tPeaked) lines.push('<span class="int-item int-warning">T波高尖</span>');
        if (params.tFlattened) lines.push('<span class="int-item">T波低平</span>');
        if (params.qWave) lines.push('<span class="int-item int-critical">病理性Q波</span>');
        if (params.qrsAxis) lines.push(`<span class="int-item">电轴：${params.qrsAxis}°</span>`);

        el.innerHTML = lines.join('<br>');
    }

    // ---- PUBLIC API ----
    setPaperSpeed(s) { this.paperSpeed = s; }
    setGain(g) { this.gain = g; }
    setGrid(v) { this.showGrid = v; }
    setLabels(v) { this.showLabels = v; }
    setZoom(l) { this.zoomLevel = Math.max(0.4, Math.min(3, l)); }

    exportImage(fmt = 'png') { return this.canvas.toDataURL(`image/${fmt}`); }

    downloadImage(fn = 'ecg-12lead.png') {
        const a = document.createElement('a');
        a.download = fn;
        a.href = this.exportImage();
        a.click();
    }
}

if (typeof module !== 'undefined' && module.exports) { module.exports = ECGRenderer; }

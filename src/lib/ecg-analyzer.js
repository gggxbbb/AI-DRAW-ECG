const CHEST_LEADS = ['V1', 'V2', 'V3', 'V4', 'V5', 'V6'];
const LIMB_LEADS = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF'];
const INFERIOR_LEADS = ['II', 'III', 'aVF'];
const SEPTAL_LEADS = ['V1', 'V2'];
const ANTERIOR_LEADS = ['V3', 'V4'];
const LATERAL_LEADS = ['I', 'aVL', 'V5', 'V6'];

export class ECGAnalyzer {
    analyze(params, curves) {
        if (!params) return null;
        const hr = params.heartRate || 72;
        const qrs = params.qrsDuration || 90;
        const qt = params.qtInterval || 390;
        const qtc = this._bazett(qt, hr);
        const axis = params.qrsAxis ?? 30;
        const rhythmType = params.rhythmType || 'sinus';

        const measurements = [];
        const findings = [];

        measurements.push({ label: '心室率', value: `${hr} bpm`, flag: this._rateFlag(hr) });
        measurements.push({ label: 'QRS 时限', value: `${qrs} ms`, flag: qrs >= 120 ? '↑' : '' });
        measurements.push({ label: 'QT/QTc', value: `${qt} / ${qtc} ms`, flag: this._qtcFlag(qtc) });
        measurements.push({ label: 'QRS 额面电轴', value: `${axis}°`, flag: this._axisFlag(axis) });

        const rhythmDiag = this._rhythmDiagnosis(rhythmType, hr);
        if (rhythmDiag) findings.unshift(rhythmDiag);

        if (curves && Object.keys(curves).length > 0) {
            const leadAnalysis = {};
            for (const [lead, points] of Object.entries(curves)) {
                if (!points || points.length < 6) continue;
                leadAnalysis[lead] = this._analyzeLeadCurve(points);
            }

            const stElevated = [];
            const stDepressed = [];
            const tInverted = [];
            const qWaves = [];

            for (const [lead, a] of Object.entries(leadAnalysis)) {
                if (!a) continue;
                const stMm = Math.round(a.stMv * 10);
                const isChestLead = CHEST_LEADS.includes(lead);
                const stElevThreshold = isChestLead ? 2 : 1;
                if (stMm >= stElevThreshold) stElevated.push(`${lead}(${stMm}mm)`);
                if (stMm <= -1 && a.stMv < 0) stDepressed.push(`${lead}(${Math.abs(stMm)}mm)`);
                if (a.tInverted) tInverted.push(lead);
                if (a.hasQWave && lead !== 'III') qWaves.push(lead);
            }

            if (stElevated.length > 0) {
                const isLeadElevated = (l) => {
                    const a = leadAnalysis[l];
                    if (!a) return false;
                    const threshold = CHEST_LEADS.includes(l) ? 0.2 : 0.1;
                    return a.stMv >= threshold;
                };
                const infMatch = INFERIOR_LEADS.filter(isLeadElevated);
                const antMatch = ANTERIOR_LEADS.filter(isLeadElevated);
                const sepMatch = SEPTAL_LEADS.filter(isLeadElevated);
                const latMatch = LATERAL_LEADS.filter(isLeadElevated);

                if (infMatch.length >= 2) {
                    findings.push({ text: `下壁导联 ST 段抬高 (${infMatch.join(',')})`, severity: 'abnormal' });
                    if (leadAnalysis['III'] && leadAnalysis['II'] &&
                        leadAnalysis['III'].stMv > leadAnalysis['II'].stMv) {
                        findings.push({ text: 'III导联 ST 抬高 > II导联', severity: 'abnormal' });
                    }
                } else if (antMatch.length >= 2) {
                    findings.push({ text: `前壁导联 ST 段抬高 (${antMatch.join(',')})`, severity: 'abnormal' });
                } else if (sepMatch.length >= 2) {
                    findings.push({ text: `间隔导联 ST 段抬高 (${sepMatch.join(',')})`, severity: 'abnormal' });
                } else if (latMatch.length >= 2) {
                    findings.push({ text: `侧壁导联 ST 段抬高 (${latMatch.join(',')})`, severity: 'abnormal' });
                } else {
                    findings.push({ text: `ST 段抬高 (${stElevated.join(',')})`, severity: 'abnormal' });
                }

                const recip = [];
                if (infMatch.length >= 2) {
                    const latRecip = LATERAL_LEADS.filter(l => leadAnalysis[l] && leadAnalysis[l].stMv <= -0.05);
                    if (latRecip.length > 0) recip.push(...latRecip);
                }
                if (antMatch.length >= 2) {
                    const infRecip = INFERIOR_LEADS.filter(l => leadAnalysis[l] && leadAnalysis[l].stMv <= -0.05);
                    if (infRecip.length > 0) recip.push(...infRecip);
                }
                if (recip.length > 0) {
                    findings.push({ text: `对应性 ST 段压低 (${recip.join(',')})`, severity: 'borderline' });
                }
            }

            if (stDepressed.length > 0 && stElevated.length === 0) {
                findings.push({ text: `ST 段压低 (${stDepressed.join(',')})`, severity: 'abnormal' });
            }

            const tInvClinSignificant = tInverted.filter(l => l !== 'aVR' && l !== 'V1' && l !== 'III');
            if (tInvClinSignificant.length >= 3) {
                findings.push({ text: `广泛导联 T 波倒置 (${tInvClinSignificant.join(',')})`, severity: 'abnormal' });
            } else if (tInvClinSignificant.length > 0) {
                findings.push({ text: `T 波倒置 (${tInvClinSignificant.join(',')})`, severity: 'abnormal' });
            }

            if (qWaves.length >= 2) {
                findings.push({ text: `病理性 Q 波 (${qWaves.join(',')})`, severity: 'abnormal' });
            }
        }

        let conclusion = '未见明显异常';
        const crit = findings.filter(f => f.severity === 'critical').length;
        const abn = findings.filter(f => f.severity === 'abnormal').length;
        if (crit > 0) conclusion = '检出多项异常指标';
        else if (abn > 0) conclusion = '检出部分异常指标';
        else if (findings.filter(f => f.severity === 'borderline').length > 0) conclusion = '存在边界性改变';

        return { measurements, findings, conclusion, timestamp: new Date().toISOString() };
    }

    checkRhythmConsistency(params, curves) {
        if (!params || !curves || Object.keys(curves).length < 6) return null;
        const declared = params.rhythmType || 'sinus';
        const hr = params.heartRate || 72;

        const leadNames = Object.keys(curves);
        const cycleLengths = [];
        const baselineOffsets = [];
        const rAmps = [];

        for (const lead of leadNames) {
            const pts = curves[lead];
            if (!pts || pts.length < 6) continue;
            const a = this._analyzeLeadCurve(pts);
            if (!a) continue;
            const len = pts[pts.length - 1][0] - pts[0][0];
            cycleLengths.push(len);
            baselineOffsets.push(a.baselineMv);
            rAmps.push(a.rAmp);
        }

        const issues = [];
        if (cycleLengths.length >= 2) {
            const avgCL = cycleLengths.reduce((s, v) => s + v, 0) / cycleLengths.length;
            const maxDev = Math.max(...cycleLengths.map(c => Math.abs(c - avgCL)));
            if (maxDev > 0.05) {
                issues.push(`导联间周期长度不一致（偏差 ${maxDev.toFixed(2)}s），应为同一周期`);
            }
        }

        if (baselineOffsets.length >= 2) {
            const maxBl = Math.max(...baselineOffsets);
            const minBl = Math.min(...baselineOffsets);
            if (maxBl - minBl > 0.2) {
                issues.push(`导联间基线偏移过大（${minBl.toFixed(2)} ~ ${maxBl.toFixed(2)} mV）`);
            }
        }

        const isSinusDeclared = declared === 'sinus' || declared === 'sinus_arrhythmia';
        if (isSinusDeclared && rAmps.length >= 6) {
            const hasV1V6 = leadNames.includes('V1') && leadNames.includes('V6');
            if (hasV1V6) {
                const aV1 = this._analyzeLeadCurve(curves['V1']);
                const aV6 = this._analyzeLeadCurve(curves['V6']);
                if (aV1 && aV6 && aV1.rAmp > aV6.rAmp) {
                    issues.push('V1→V6 R波递增不良（V1振幅大于V6），正常应为递增');
                }
            }
        }

        return {
            leadCount: leadNames.length,
            avgCycleLength: cycleLengths.length > 0
                ? Math.round(cycleLengths.reduce((s, v) => s + v, 0) / cycleLengths.length * 1000)
                : null,
            issues,
            isConsistent: issues.length === 0,
        };
    }

    _analyzeLeadCurve(points) {
        if (points.length < 10) return null;
        const n = points.length;
        const vals = points.map(p => p[1]);

        let maxMv = -Infinity, maxIdx = 0;
        for (let i = 0; i < n; i++) {
            if (vals[i] > maxMv) { maxMv = vals[i]; maxIdx = i; }
        }
        const rAmp = maxMv;
        const rIdx = maxIdx;

        const sampleDt = n >= 2 ? points[1][0] - points[0][0] : 0.002;
        const qWindowPts = Math.max(3, Math.ceil(0.04 / Math.max(sampleDt, 0.0005)));
        let minMv = Infinity, minIdx = -1;
        const qWindow = Math.max(0, rIdx - qWindowPts);
        for (let i = qWindow; i < rIdx; i++) {
            if (vals[i] < minMv) { minMv = vals[i]; minIdx = i; }
        }
        const qDepth = minIdx >= 0 ? Math.abs(minMv) : 0;
        const qWidthMs = minIdx > 0 && minIdx < rIdx - 1 ? (points[rIdx - 1][0] - points[minIdx][0]) * 1000 : 0;
        const hasQWave = minIdx >= 0 && (rIdx - minIdx > 1) &&
            (qDepth > 0.2 && qDepth > rAmp * 0.33) || (qWidthMs >= 80 && qDepth > 0.1);

        const blStart = Math.max(1, Math.floor(rIdx * 0.25));
        const blEnd = Math.floor(rIdx * 0.45);
        let blSum = 0, blCount = 0;
        for (let i = blStart; i < blEnd && i < n; i++) { blSum += vals[i]; blCount++; }
        const baselineMv = blCount > 0 ? blSum / blCount : 0;

        const sWindowPts = Math.max(5, Math.ceil(0.06 / Math.max(sampleDt, 0.0005)));
        let sIdx = rIdx;
        let sMin = vals[rIdx];
        for (let i = rIdx + 1; i < Math.min(rIdx + sWindowPts, n); i++) {
            if (vals[i] < sMin) { sMin = vals[i]; sIdx = i; }
        }

        let jIdx = sIdx + 1;
        for (let i = sIdx + 1; i < n - 4; i++) {
            let flatRun = true;
            for (let j = 0; j < 3; j++) {
                if (Math.abs(vals[i + j + 1] - vals[i + j]) >= 0.03) { flatRun = false; break; }
            }
            if (flatRun) { jIdx = i; break; }
        }

        let tPeakIdx = -1;
        let tMax = -Infinity;
        const tStart = Math.min(jIdx + 3, n - 1);
        for (let i = tStart; i < n; i++) {
            if (vals[i] > tMax && vals[i] > baselineMv) { tMax = vals[i]; tPeakIdx = i; }
        }
        if (tPeakIdx < 0) {
            let tMin2 = Infinity;
            for (let i = tStart; i < n; i++) {
                if (vals[i] < tMin2) { tMin2 = vals[i]; tPeakIdx = i; }
            }
            tMax = tMin2;
        }
        const tMv = tPeakIdx >= 0 ? vals[tPeakIdx] : baselineMv;
        const tInverted = (tMv - baselineMv) < -0.1;

        const stEnd = tPeakIdx > jIdx ? Math.floor(jIdx + (tPeakIdx - jIdx) * 0.35) : Math.min(jIdx + 2, n - 1);
        let stSum = 0, stCount = 0;
        for (let i = jIdx; i <= stEnd && i < n; i++) { stSum += vals[i] - baselineMv; stCount++; }
        const stMv = stCount > 0 ? stSum / stCount : 0;

        return { rAmp, stMv, baselineMv, hasQWave, tInverted, tAvg: tMv - baselineMv };
    }

    _bazett(qt, hr) { return Math.round(qt / Math.sqrt(60 / hr)); }
    _rateFlag(hr) { return hr < 60 ? '↓' : hr > 100 ? '↑' : ''; }
    _qtcFlag(qtc) { return qtc > 460 ? '↑' : qtc < 340 ? '↓' : ''; }
    _axisFlag(axis) { return axis < -30 ? '←' : axis > 90 ? '→' : ''; }
    _rhythmDiagnosis(type, hr) {
        const m = {
            'sinus': hr < 60 ? { text: '窦性心动过缓', severity: 'borderline' } : hr > 100 ? { text: '窦性心动过速', severity: 'borderline' } : { text: '窦性心律', severity: 'normal' },
            'atrial_fibrillation': { text: '心房颤动', severity: 'abnormal' },
            'atrial_flutter': { text: '心房扑动', severity: 'abnormal' },
            'ventricular': { text: '室性心动过速', severity: 'critical' },
            'ventricular_fibrillation': { text: '心室颤动', severity: 'critical' },
            'paced': { text: '心室起搏心律', severity: 'borderline' },
            'complete_heart_block': { text: 'III°AVB', severity: 'abnormal' },
            'torsades': { text: '尖端扭转型室速', severity: 'critical' },
            'sinus_with_pvc': { text: '窦性心律伴室早', severity: 'abnormal' },
            'sinus_arrhythmia': { text: '窦性心律不齐', severity: 'borderline' },
            'sinus_with_wenckebach': { text: 'II°I型AVB', severity: 'abnormal' },
            'sinus_with_mobitz2': { text: 'II°II型AVB', severity: 'abnormal' },
        };
        return m[type] || null;
    }
}

export const ecgAnalyzer = new ECGAnalyzer();

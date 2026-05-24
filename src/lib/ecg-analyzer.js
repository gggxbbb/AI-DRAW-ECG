const INFERIOR_LEADS = ['II', 'III', 'aVF'];
const ANTERIOR_LEADS = ['V1', 'V2', 'V3', 'V4'];
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
                if (stMm >= 1) stElevated.push(`${lead}(${stMm}mm)`);
                if (stMm <= -1 && a.stMv < 0) stDepressed.push(`${lead}(${Math.abs(stMm)}mm)`);
                if (a.tInverted) tInverted.push(lead);
                if (a.hasQWave) qWaves.push(lead);
            }

            if (stElevated.length > 0) {
                const infMatch = INFERIOR_LEADS.filter(l => leadAnalysis[l] && leadAnalysis[l].stMv >= 0.1);
                const antMatch = ANTERIOR_LEADS.filter(l => leadAnalysis[l] && leadAnalysis[l].stMv >= 0.1);
                const latMatch = LATERAL_LEADS.filter(l => leadAnalysis[l] && leadAnalysis[l].stMv >= 0.1);

                if (infMatch.length >= 2) {
                    findings.push({ text: `下壁导联 ST 段抬高 (${infMatch.join(',')})`, severity: 'abnormal' });
                    findings.push({ text: '提示：急性下壁心肌梗死', severity: 'abnormal' });
                    if (leadAnalysis['III'] && leadAnalysis['II'] &&
                        leadAnalysis['III'].stMv > leadAnalysis['II'].stMv) {
                        findings.push({ text: 'III导联抬高 > II导联，提示右冠脉病变', severity: 'abnormal' });
                    }
                } else if (antMatch.length >= 2) {
                    findings.push({ text: `前壁导联 ST 段抬高 (${antMatch.join(',')})`, severity: 'abnormal' });
                    findings.push({ text: '提示：急性前壁心肌梗死', severity: 'abnormal' });
                } else if (latMatch.length >= 2) {
                    findings.push({ text: `侧壁导联 ST 段抬高 (${latMatch.join(',')})`, severity: 'abnormal' });
                    findings.push({ text: '提示：急性侧壁心肌梗死', severity: 'abnormal' });
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

            if (tInverted.length >= 3) {
                findings.push({ text: `广泛导联 T 波倒置 (${tInverted.join(',')})`, severity: 'abnormal' });
            } else if (tInverted.length > 0) {
                findings.push({ text: `T 波倒置 (${tInverted.join(',')})`, severity: 'abnormal' });
            }

            if (qWaves.length >= 2) {
                findings.push({ text: `病理性 Q 波 (${qWaves.join(',')})`, severity: 'abnormal' });
            }
        }

        let conclusion = '正常心电图';
        const crit = findings.filter(f => f.severity === 'critical').length;
        const abn = findings.filter(f => f.severity === 'abnormal').length;
        if (crit > 0) conclusion = '危急异常心电图';
        else if (abn > 0) conclusion = '异常心电图';
        else if (findings.filter(f => f.severity === 'borderline').length > 0) conclusion = '大致正常心电图（边界性改变）';

        return { measurements, findings, conclusion, timestamp: new Date().toISOString() };
    }

    _analyzeLeadCurve(points) {
        if (points.length < 6) return null;
        const n = points.length;

        let maxMv = -Infinity, maxIdx = 0;
        let minMv = Infinity, minIdx = 0;
        for (let i = 0; i < n; i++) {
            const mv = points[i][1];
            if (mv > maxMv) { maxMv = mv; maxIdx = i; }
            if (mv < minMv) { minMv = mv; minIdx = i; }
        }
        const rAmp = maxMv;
        const rIdx = maxIdx;

        const qIdx = minIdx < maxIdx ? minIdx : -1;
        const hasQWave = qIdx >= 0 && Math.abs(minMv) > 0.1;

        const baselineMv = points.slice(0, Math.min(2, n))[0]?.[1] || 0;

        let stStart = rIdx + Math.floor(n * 0.03);
        let tStart = stStart + Math.floor(n * 0.08);
        if (tStart >= n) tStart = n - 4;
        if (stStart >= n) stStart = n - 6;
        if (stStart > tStart) stStart = tStart - 2;

        let stSum = 0, stCount = 0;
        for (let i = stStart; i < tStart && i < n; i++) {
            stSum += points[i][1];
            stCount++;
        }
        const stMv = stCount > 0 ? stSum / stCount : 0;

        let tStart2 = Math.floor(n * 0.6);
        if (tStart2 < stStart + 1) tStart2 = stStart + 1;
        let tMin = 0, tCount = 0;
        for (let i = tStart2; i < n; i++) {
            tMin += points[i][1];
            tCount++;
        }
        const tAvg = tCount > 0 ? tMin / tCount : 0;
        const tInverted = tAvg < -0.05;

        return { rAmp, stMv, baselineMv, hasQWave, tInverted, tAvg };
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

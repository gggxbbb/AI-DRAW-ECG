export class ECGAnalyzer {
    analyze(params) {
        if (!params) return null;
        const hr = params.heartRate || 72;
        const pr = params.prInterval || 160;
        const qrs = params.qrsDuration || 90;
        const qt = params.qtInterval || 390;
        const qtc = params.qtcInterval || this._bazett(qt, hr);
        const axis = params.qrsAxis ?? params.axis ?? 30;
        const stEl = params.stElevation || 0;
        const stDep = params.stDepression || 0;
        const tAmp = params.tAmplitude || 0.3;
        const qrsAmp = params.qrsAmplitude || 1.5;
        const rhythmType = params.rhythmType || 'sinus';
        const pPresent = params.pPresent !== false;
        const tInv = params.tInverted || false;
        const tPeaked = params.tPeaked || false;
        const tFlat = params.tFlattened || false;
        const hasQWave = !!params.qWave;
        const uWave = params.uWavePresent || params.uWaveProminent || false;
        const brugada = params.brugadaPattern || null;
        const v1DomR = params.v1DominantR || false;
        const highVoltage = params.highVoltage || false;
        const strain = params.strainPattern || false;
        const qrsNotching = params.qrsNotching || false;
        const rbbb = params.rbbbRsrPattern || false;
        const qrsWide = qrs >= 120;
        const paced = rhythmType === 'paced';
        const afib = rhythmType === 'atrial_fibrillation';
        const aflutter = rhythmType === 'atrial_flutter';
        const vtach = rhythmType === 'ventricular';
        const vfib = rhythmType === 'ventricular_fibrillation';
        const chb = rhythmType === 'complete_heart_block';
        const torsades = rhythmType === 'torsades';
        const sinusArr = rhythmType === 'sinus_arrhythmia';
        const sinusPVC = rhythmType === 'sinus_with_pvc';
        const wenckebach = rhythmType === 'sinus_with_wenckebach';
        const mobitz2 = rhythmType === 'sinus_with_mobitz2';

        const measurements = [];
        const findings = [];

        measurements.push({ label: '心室率', value: `${hr} bpm`, flag: this._rateFlag(hr) });
        measurements.push({ label: 'PR 间期', value: pr ? `${pr} ms` : '—', flag: pr > 200 ? '↑' : (pr < 120 && pr > 0 ? '↓' : '') });
        measurements.push({ label: 'QRS 时限', value: `${qrs} ms`, flag: qrsWide ? '↑' : '' });
        measurements.push({ label: 'QT/QTc', value: `${qt} / ${qtc} ms`, flag: this._qtcFlag(qtc) });
        measurements.push({ label: 'P 波', value: pPresent ? '存在' : '消失', flag: pPresent ? '' : '异常' });
        measurements.push({ label: 'QRS 额面电轴', value: `${axis}°`, flag: this._axisFlag(axis) });
        measurements.push({ label: 'QRS 振幅', value: `${qrsAmp.toFixed(1)} mV`, flag: highVoltage ? '高电压' : '' });

        if (stEl > 0) {
            findings.push({ text: `ST 段抬高 ${(stEl * 10).toFixed(1)} mm`, severity: 'abnormal' });
        }
        if (stDep < 0) {
            findings.push({ text: `ST 段压低 ${Math.abs(stDep * 10).toFixed(1)} mm`, severity: 'abnormal' });
        }
        if (hasQWave) {
            const leads = params.qWave?.leads?.join(',') || '';
            findings.push({ text: `病理性 Q 波 (${leads})`, severity: 'abnormal' });
        }
        if (tInv && !paced && !vtach) findings.push({ text: 'T 波倒置', severity: 'abnormal' });
        if (tPeaked) findings.push({ text: 'T 波高尖', severity: 'abnormal' });
        if (tFlat) findings.push({ text: 'T 波低平', severity: 'borderline' });
        if (uWave) findings.push({ text: 'U 波明显', severity: 'borderline' });
        if (brugada) findings.push({ text: `Brugada 波 (${brugada})`, severity: 'abnormal' });
        if (v1DomR) findings.push({ text: 'V1 导联 R 波优势', severity: 'abnormal' });
        if (highVoltage && !paced) findings.push({ text: '左室高电压', severity: 'borderline' });
        if (strain) findings.push({ text: 'ST-T 劳损样改变', severity: 'abnormal' });
        if (qrsNotching) findings.push({ text: 'QRS 波切迹', severity: 'borderline' });
        if (rbbb) findings.push({ text: '右束支传导阻滞形态', severity: 'abnormal' });
        if (qrsWide && !rbbb && !paced && !vtach) findings.push({ text: 'QRS 增宽 (≥120ms)', severity: 'abnormal' });

        const rhythmDiag = this._rhythmDiagnosis(rhythmType, hr);
        if (rhythmDiag) findings.unshift(rhythmDiag);

        if (afib) findings.push({ text: 'P 波消失，代以 f 波，RR 间期绝对不等', severity: 'abnormal' });
        if (vtach) findings.push({ text: '宽 QRS 心动过速，房室分离', severity: 'abnormal' });
        if (vfib) findings.push({ text: '无规律心室颤动波', severity: 'critical' });
        if (chb) findings.push({ text: 'P 波与 QRS 波完全无关（房室分离）', severity: 'abnormal' });
        if (torsades) findings.push({ text: 'QRS 波尖端围绕基线扭转', severity: 'critical' });
        if (sinusArr) findings.push({ text: 'PP 间期随呼吸周期性变化', severity: 'borderline' });

        let conclusion = '正常心电图';
        const criticalCount = findings.filter(f => f.severity === 'critical').length;
        const abnormalCount = findings.filter(f => f.severity === 'abnormal').length;
        if (criticalCount > 0) conclusion = '危急异常心电图';
        else if (abnormalCount > 0) conclusion = '异常心电图';
        else {
            const borderlineCount = findings.filter(f => f.severity === 'borderline').length;
            if (borderlineCount > 0) conclusion = '大致正常心电图（边界性改变）';
        }

        return { measurements, findings, conclusion, timestamp: new Date().toISOString() };
    }

    _bazett(qt, hr) {
        const rr = 60 / hr;
        return Math.round(qt / Math.sqrt(rr));
    }

    _rateFlag(hr) {
        if (hr < 60) return '↓ 心动过缓';
        if (hr > 100) return '↑ 心动过速';
        return '';
    }

    _qtcFlag(qtc) {
        if (qtc > 460) return '↑ 延长';
        if (qtc < 340) return '↓ 缩短';
        return '';
    }

    _axisFlag(axis) {
        if (axis < -30) return '← 左偏';
        if (axis > 90) return '→ 右偏';
        if (axis >= -30 && axis <= 90) return '';
        return '';
    }

    _rhythmDiagnosis(type, hr) {
        const map = {
            'sinus': hr < 60 ? { text: '窦性心动过缓', severity: 'borderline' }
                   : hr > 100 ? { text: '窦性心动过速', severity: 'borderline' }
                   : { text: '窦性心律', severity: 'normal' },
            'atrial_fibrillation': { text: '心房颤动', severity: 'abnormal' },
            'atrial_flutter': { text: '心房扑动', severity: 'abnormal' },
            'ventricular': { text: '室性心动过速', severity: 'critical' },
            'ventricular_fibrillation': { text: '心室颤动', severity: 'critical' },
            'paced': { text: '心室起搏心律', severity: 'borderline' },
            'complete_heart_block': { text: 'III°房室传导阻滞', severity: 'abnormal' },
            'torsades': { text: '尖端扭转型室性心动过速', severity: 'critical' },
            'sinus_with_pvc': { text: '窦性心律伴室性早搏', severity: 'abnormal' },
            'sinus_arrhythmia': { text: '窦性心律不齐', severity: 'borderline' },
            'sinus_with_wenckebach': { text: 'II°I型房室传导阻滞（文氏）', severity: 'abnormal' },
            'sinus_with_mobitz2': { text: 'II°II型房室传导阻滞（Mobitz II）', severity: 'abnormal' },
        };
        return map[type] || null;
    }
}

export const ecgAnalyzer = new ECGAnalyzer();

export const ECG_LIMITS = {
    heartRate:     { min: 20,   max: 300,  label: '心率(bpm)' },
    qrsDuration:   { min: 40,   max: 300,  label: 'QRS时限(ms)' },
    qtInterval:    { min: 180,  max: 800,  label: 'QT间期(ms)' },
    qrsAmplitude:  { min: 0.05, max: 6,    label: 'QRS振幅(mV)' },
    tAmplitude:    { min: 0,    max: 2.5,  label: 'T波振幅(mV)' },
    stElevation:   { min: -0.5, max: 1.5,  label: 'ST抬高(mV)' },
    stDepression:  { min: -1.5, max: 0,    label: 'ST压低(mV)' },
    pointMvAbs:    { max: 5,    label: '数据点振幅绝对值(mV)' },
    pointTime:     { max: 3.0,  label: '数据点时间(s)' },
    curveMinPoints:{ min: 6,    label: '最少数据点数' },
    curveMinTime:  { min: 0.4,  label: '最少时间跨度(s)' },
};

export const VALID_LEADS = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6'];
export const VALID_TOOLS = ['drawLeadCurve', 'drawRhythmStrip', 'initRender', 'writeInterpretation', 'writeLeadDescriptions'];

export function validateToolCall(call) {
    const errors = [];
    if (!call || typeof call !== 'object') return ['tool_call 必须是有效对象'];
    if (!VALID_TOOLS.includes(call.tool)) {
        errors.push(`不支持的工具: ${call.tool}`);
        return errors;
    }
    switch (call.tool) {
        case 'initRender': {
            const g = call.gain;
            if (g !== undefined && ![5, 10, 20].includes(g)) errors.push(`增益只能为 5,10,20`);
            const s = call.paperSpeed;
            if (s !== undefined && ![12.5, 25, 50].includes(s)) errors.push(`走纸速度只能为 12.5,25,50`);
            break;
        }
        case 'drawLeadCurve': {
            if (!VALID_LEADS.includes(call.lead)) { errors.push(`无效导联: ${call.lead}`); break; }
            if (!Array.isArray(call.points) || call.points.length < ECG_LIMITS.curveMinPoints.min) {
                errors.push(`points 至少需要 ${ECG_LIMITS.curveMinPoints.min} 个点`);
                break;
            }
            let prevT = -1;
            for (let i = 0; i < call.points.length; i++) {
                const pt = call.points[i];
                if (!Array.isArray(pt) || pt.length < 2) { errors.push(`points[${i}] 必须是 [t, mV] 数组`); continue; }
                const t = pt[0], mv = pt[1];
                if (typeof t !== 'number' || t < 0) errors.push(`points[${i}].t 必须 >= 0`);
                if (t > ECG_LIMITS.pointTime.max) errors.push(`points[${i}].t 超出范围`);
                if (typeof mv !== 'number') errors.push(`points[${i}].mV 必须是数字`);
                if (Math.abs(mv) > ECG_LIMITS.pointMvAbs.max) errors.push(`points[${i}].mV 超出范围`);
                if (t <= prevT) errors.push(`points[${i}].t 必须严格递增`);
                prevT = t;
            }
            const timeSpan = call.points[call.points.length - 1][0];
            if (timeSpan < ECG_LIMITS.curveMinTime.min) {
                errors.push(`时间跨度 ${timeSpan.toFixed(2)}s 小于最小要求 ${ECG_LIMITS.curveMinTime.min}s`);
            }
            break;
        }
        case 'writeInterpretation': {
            if (typeof call.text !== 'string' || call.text.length < 10) errors.push('解读文本至少10字符');
            break;
        }
        case 'writeLeadDescriptions': {
            if (!call.descriptions || typeof call.descriptions !== 'object') { errors.push('缺少 descriptions'); break; }
            for (const [lead, desc] of Object.entries(call.descriptions)) {
                if (!VALID_LEADS.includes(lead)) errors.push(`无效导联: ${lead}`);
                if (typeof desc !== 'string' || desc.length < 3) errors.push(`${lead} 描述至少3字符`);
            }
            break;
        }
    }
    return errors;
}

export function buildToolSchemaDescription() {
    return `你是一位资深心电生理学专家。根据用户描述的生理病理状态，生成心电图绘制工具调用数组（JSON数组格式）。

请严格只输出 JSON 数组，不要包含任何其他文本或 markdown 标记。

工具调用顺序自由，但请完成以下所有任务后将 complete 设为 true：

□ 1. initRender - 初始化画布、设置心率和节律类型
□ 2. drawLeadCurve ×12 - 为12导联各绘制波形（I,II,III,aVR,aVL,aVF,V1-V6）
□ 3. drawRhythmStrip - 绘制底部节律条
□ 4. writeInterpretation - 书写AI临床解读
□ 5. writeLeadDescriptions - 为每个导联书写描述

---
initRender:
{ "tool": "initRender", "paperSpeed": 25, "gain": 10, "rhythmType": "sinus", "params": { "heartRate": 72, "qrsDuration": 90, "qtInterval": 390, "qrsAxis": 30 } }
paperSpeed: 12.5|25|50, gain: 5|10|20
rhythmType: "sinus"|"atrial_fibrillation"|"atrial_flutter"|"ventricular"|"paced"|"complete_heart_block"|"ventricular_fibrillation"|"torsades"|"sinus_with_pvc"|"sinus_arrhythmia"|"sinus_with_wenckebach"|"sinus_with_mobitz2"

drawLeadCurve:
{ "tool": "drawLeadCurve", "lead": "I", "points": [[0,0],[0.03,0.06],[0.08,-0.1],[0.12,1.5],[0.16,-0.2],[0.22,0.0],[0.28,0.02],[0.34,0.35],[0.42,0]] }
points: [[t秒,mV],...] 至少6点、时间>=0.4s、振幅-5~+5mV、系统自动Catmull-Rom平滑

drawRhythmStrip:
{ "tool": "drawRhythmStrip", "lead": "II" }

writeInterpretation:
{ "tool": "writeInterpretation", "text": "完整临床解读文本" }

writeLeadDescriptions:
{ "tool": "writeLeadDescriptions", "descriptions": {"I":"...","II":"...",...}}`;
}

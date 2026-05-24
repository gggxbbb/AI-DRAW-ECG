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
    curveMinPoints:{ min: 12,    label: '最少数据点数' },
    curveMinTime:  { min: 0.5,  label: '最少时间跨度(s)' },
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
    return `你是一位资深心电生理学专家。根据用户描述的生理病理状态，生成标准12导联心电图绘制工具调用数组。

输出规则：必须输出完整的 JSON 数组，不省略任何字段，不使用 markdown 代码块。

重要：请提供足够详细的数据点和描述。不要为了简洁而简化波形细节。每个导联的真实心电图包含 P波、QRS波群、ST段、T波，有时还有 U波；请确保每个波形特征都通过足够多的数据点精确表达。

---
工具调用清单（完成全部5项）：

□ 1. initRender - 初始化
□ 2. drawLeadCurve ×12 - 12导联波形，每导联至少12个数据点
□ 3. drawRhythmStrip - 节律条
□ 4. writeInterpretation - 临床解读（200-500字，包含所有关键发现）
□ 5. writeLeadDescriptions - 12导联各一段描述

---
initRender:
{ "tool": "initRender", "paperSpeed": 25, "gain": 10, "rhythmType": "sinus", "params": { "heartRate": 72, "qrsDuration": 90, "qtInterval": 390, "qrsAxis": 30 } }
paperSpeed: 12.5|25|50, gain: 5|10|20
rhythmType: 完整写出 "sinus"|"atrial_fibrillation"|"atrial_flutter"|"ventricular"|"paced"|"complete_heart_block"|"ventricular_fibrillation"|"torsades"|"sinus_with_pvc"|"sinus_arrhythmia"|"sinus_with_wenckebach"|"sinus_with_mobitz2"

drawLeadCurve 两种模式：

a) 单周期模式（窦性心律等规则节律）：
{ "tool": "drawLeadCurve", "lead": "I", "points": [[t0,mV0],...] }
系统自动重复该周期填满导联面板。

b) 多搏动模式（传导阻滞、早搏等不规则节律）：
{ "tool": "drawLeadCurve", "lead": "II",
  "beats": [
    { "onset": 0.00, "points": [[0,0],[0.03,0.06],...,[0.45,0]] },
    { "onset": 0.90, "points": [[0,0],[0.03,0.06],...,[0.50,0]] },
    { "onset": 1.85, "points": [[0,0]] }
  ]
}
onset 是该搏动在面板上的起始时间（秒），必须递增且覆盖 0~2.5s。
每个 beat.points 格式同单周期模式：t0=0，后续 t 递增，跨度 0.5~1.5s。

points 数组要求：
- 描述单个心搏周期，系统会自动重复填充整个导联面板
- points[0][0] 必须为 0（时间起点），后续 t 严格递增
- 时间跨度 0.5 ~ 1.5s（对应心率 40-120 bpm 的 RR 间期）
- 所有 t 值不得超过 1.5s
- 至少12个点，推荐15-20个点以充分描绘完整的 P-QRS-ST-T-U 波形

drawRhythmStrip:
{ "tool": "drawRhythmStrip", "lead": "II" }

writeInterpretation:
{ "tool": "writeInterpretation", "text": "完整临床解读，包含心律分析、间期测量、电轴判断、ST-T改变描述、异常发现、鉴别诊断和最终结论，200-500字" }

writeLeadDescriptions:
{ "tool": "writeLeadDescriptions", "descriptions": { "I": "详细描述P-QRS-T各波形特征...", "II": "...", ... "V6": "..." } }
每个导联描述至少30字`;
}

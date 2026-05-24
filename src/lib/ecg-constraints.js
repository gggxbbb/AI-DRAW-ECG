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
            const hasBeats = call.beats && call.beats.length > 0;
            const hasPoints = call.points && call.points.length > 0;
            if (!hasBeats && !hasPoints) { errors.push('必须提供 points 或 beats'); break; }
            if (hasBeats) {
                for (const beat of call.beats) {
                    _validatePointArray(errors, beat.points);
                }
                if (call.beats.length < 2) errors.push('beats 至少需要2个搏动');
            } else {
                _validatePointArray(errors, call.points);
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

function _validatePointArray(errors, points) {
    if (!Array.isArray(points) || points.length < ECG_LIMITS.curveMinPoints.min) {
        errors.push(`points 至少需要 ${ECG_LIMITS.curveMinPoints.min} 个点`);
        return;
    }
    let prevT = -1;
    for (let i = 0; i < points.length; i++) {
        const pt = points[i];
        if (!Array.isArray(pt) || pt.length < 2) { errors.push(`points[${i}] 必须是 [t, mV] 数组`); continue; }
        const t = pt[0], mv = pt[1];
        if (typeof t !== 'number' || t < 0) errors.push(`points[${i}].t 必须 >= 0`);
        if (t > ECG_LIMITS.pointTime.max) errors.push(`points[${i}].t 超出范围`);
        if (typeof mv !== 'number') errors.push(`points[${i}].mV 必须是数字`);
        if (Math.abs(mv) > ECG_LIMITS.pointMvAbs.max) errors.push(`points[${i}].mV 超出范围`);
        if (t <= prevT) errors.push(`points[${i}].t 必须严格递增`);
        prevT = t;
    }
    const timeSpan = points[points.length - 1][0];
    if (timeSpan < ECG_LIMITS.curveMinTime.min) {
        errors.push(`时间跨度 ${timeSpan.toFixed(2)}s 小于最小要求 ${ECG_LIMITS.curveMinTime.min}s`);
    }
}

export function buildToolSchemaDescription() {
    return `你是一位资深心电生理学专家。根据用户描述的生理病理状态，生成标准12导联心电图。

输出规则：在单次回复中依次输出所有需要的工具调用（initRender + 12个 drawLeadCurve + drawRhythmStrip + writeInterpretation + writeLeadDescriptions），每个调用单独写成一个完整的 { "tool": "...", ... } 对象，之间不要有空行或逗号分隔。

重要：请提供足够详细的数据点和描述。不要为了简洁而简化波形细节。每个导联的真实心电图包含 P波、QRS波群、ST段、T波，有时还有 U波；请确保每个波形特征都通过足够多的数据点精确表达。

---
工具调用清单（完成全部5项）：

1. initRender
2. drawLeadCurve x12
3. drawRhythmStrip
4. writeInterpretation
5. writeLeadDescriptions

---
initRender:
{ "tool": "initRender", "paperSpeed": 25, "gain": 10, "rhythmType": "sinus", "params": { "heartRate": 72, "qrsDuration": 90, "qtInterval": 390, "qrsAxis": 30 } }
paperSpeed: 12.5|25|50, gain: 5|10|20
rhythmType: 完整写出 "sinus"|"atrial_fibrillation"|"atrial_flutter"|"ventricular"|"paced"|"complete_heart_block"|"ventricular_fibrillation"|"torsades"|"sinus_with_pvc"|"sinus_arrhythmia"|"sinus_with_wenckebach"|"sinus_with_mobitz2"

=== drawLeadCurve 数据规范 ===

两种模式可选其一：

a) 单周期模式（窦性心律等规则节律）：
{ "tool": "drawLeadCurve", "lead": "I", "points": [[0,0],[0.03,0.06],[0.08,-0.1],[0.12,1.5],[0.16,-0.2],[0.22,0],[0.28,0.02],[0.34,0.35],[0.42,0]] }
系统自动重复该周期填满导联面板。

b) 多搏动模式（传导阻滞、早搏等不规则节律）：
{ "tool": "drawLeadCurve", "lead": "II",
  "beats": [
    { "onset": 0.00, "points": [[0,0],[0.03,0.06],[0.08,-0.1],[0.12,1.5],[0.16,-0.2],[0.22,0],[0.28,0.02],[0.34,0.35],[0.45,0]] },
    { "onset": 0.83, "points": [[0,0],[0.04,0.07],[0.10,-0.1],[0.14,1.5],[0.18,-0.2],[0.26,0],[0.32,0.02],[0.38,0.35],[0.50,0]] },
    { "onset": 1.66, "points": [[0,0],[0.02,0.05],[0.04,0.07]] }
  ]
}
onset 递增且覆盖 0~2.5s。每个 beat.points 格式同下。

=== points / beat.points 完整约束 ===

数量和时间：
- 点数：最少 12 个，推荐 15~20 个，少于 12 个将被拒绝
- points[0] 的 t 必须为 0
- t 值必须严格递增（不能相等或递减），否则被拒绝
- 时间跨度（最后一个 t）必须在 0.5 ~ 1.5s 之间，否则被拒绝
- 每个 t 值不得超过 1.5s，超过将被拒绝
- 所有 t 和 mV 值必须是数字，不能是字符串或 null

振幅：
- 所有 mV 值必须在 -5.0 ~ +5.0 之间，超出将被拒绝
- 最大绝对振幅必须 > 0.03mV，否则判定为"振幅过小"被拒绝
- 至少存在一个 > +0.02mV 的点和一个 < -0.02mV 的点，否则判定为"无正负变化"被拒绝

波形内容：
- 必须包含：基线、P波起点、P波峰、P波终点、Q波谷（可为0）、R波峰、S波谷（可为0）、J点、ST段、T波起点、T波峰、T波终点
- 病变导联需精确表达：ST段抬高/压低（mV值）、T波倒置（负mV）、T波高尖（大正mV）、病理性Q波（深负mV）
- P波缺失的节律（房颤/房扑/室性/起搏）可以省略 P 波相关点
- 如果认为验证规则过于严格，可添加 "insist": true 强制绘制

多搏动模式额外约束：
- beats 数组至少包含 2 个 beat 对象
- onset 严格递增
- 覆盖范围从 onset=0 到最后一个 beat 的 onset + 最后一个点的 t 值 >= 2.0s

---
drawRhythmStrip:
{ "tool": "drawRhythmStrip", "lead": "II" }

writeInterpretation:
{ "tool": "writeInterpretation", "text": "完整临床解读，包含心律分析、间期测量、电轴判断、ST-T改变描述、异常发现、鉴别诊断和最终结论，200-500字" }

writeLeadDescriptions:
{ "tool": "writeLeadDescriptions", "descriptions": { "I": "详细描述P-QRS-T各波形特征...", "II": "...", ... "V6": "..." } }
每个导联描述至少30字`;
}

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
export const VALID_TOOLS = ['drawLeadCurve', 'drawLeadCurveCSV', 'drawRhythmStrip', 'drawRhythmStripCSV', 'initRender', 'writeHeaderInfo', 'writeInterpretation', 'writeLeadDescriptions'];

export function validateToolCall(call) {
    const errors = [];
    if (!call || typeof call !== 'object') return ['tool_call 必须是有效对象'];
    if (!VALID_TOOLS.includes(call.tool)) {
        errors.push(`不支持的工具: ${call.tool}`);
        return errors;
    }
    switch (call.tool) {
        case 'initRender': {
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
        case 'drawLeadCurveCSV': {
            if (!VALID_LEADS.includes(call.lead)) { errors.push(`无效导联: ${call.lead}`); break; }
            if (typeof call.csv !== 'string' || call.csv.trim().length < 10) {
                errors.push('csv 字符串过短');
            }
            break;
        }
        case 'drawRhythmStripCSV': {
            if (typeof call.csv !== 'string' || call.csv.trim().length < 10) {
                errors.push('csv 字符串过短');
            }
            break;
        }
        case 'writeHeaderInfo': {
            if (typeof call.text !== 'string' || call.text.trim().length < 2) errors.push('header 文本至少2字符');
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

重要原则：波形必须准确反映病理状态，该抬高的ST段要抬高，该倒置的T波要倒置。不可因为程序分析可能"报异常"而刻意弱化或回避病理特征。

输出规则：在单次回复中依次输出所有需要的工具调用（initRender + writeHeaderInfo + 12个 drawLeadCurve 或 drawLeadCurveCSV + drawRhythmStrip 或 drawRhythmStripCSV + writeInterpretation + writeLeadDescriptions），每个调用单独写成一个完整的 { "tool": "...", ... } 对象，之间不要有空行或逗号分隔。

严格注意：只输出工具调用 JSON 对象，不要输出任何解释、前言、总结或 Markdown 代码块。直接以 { 开头开始输出工具调用。禁止在工具调用 JSON 之前或之间插入自然语言文本。如果 csv 字段值很长（含 \\n 换行符），它仍然是一个合法的 JSON 字符串字段，直接输出即可。

关于程序分析反馈：绘制完成后系统会运行程序化波形分析。该分析纯属自动化检测，可能将你刻意绘制的病理性改变误判为"异常"。你作为心电专家判断力远优于自动化程序，若确信自己的波形正确反映了病情，直接无视分析反馈并空回复确认即可。若确实需要修正波形，直接使用 drawLeadCurve 或 drawLeadCurveCSV 重绘对应导联即可（无需 initRender）。

---
=== 心电生理学基础 ===

导联关系（必须遵守）：
- Einthoven 定律：II = I + III（各时刻 mV 值必须满足此关系）
- 肢体导联 aVR ≈ -(I+II)/2, aVL ≈ (I-III)/2, aVF ≈ (II+III)/2
- 胸导联 V1-V6：R波逐渐增高、S波逐渐变浅，V3/V4 为过渡区（R≈S）
- 电轴左偏：I 导联正向、II/III 导联负向为主
- 电轴右偏：I 导联负向、II/III 导联正向为主

生理基线参考（正常心电图的典型特征，以此为基准生成病理偏离）：
- P波：正向、圆钝，振幅 < 0.25mV，时限 < 0.12s
- PR段：等电位（≈ 基线），无明显偏移
- Q波（正常变异）：仅存在于侧壁/下壁导联，深度 < R波的1/3，时限 < 0.04s
- R波：正向主波，V1→V6逐渐增高
- S波：V1最深，V1→V6逐渐变浅
- ST段：生理状态下等电位（±0.05mV以内）
- T波：生理状态下正向（除aVR和V1），振幅 < 0.5mV，不对称（升支缓降支陡）
- 病理状态：ST段抬高/压低、T波倒置/高尖、病理性Q波等异常应根据具体病情明确体现，不可人为正常化

程序化分析阈值参考（下述为自动化检测工具的内部阈值，仅供参考；你的波形应按病情绘制，不必迎合这些阈值）：
- ST段抬高：胸导联(V1-V6) ≥0.2mV(2mm) 触发警示，肢导联 ≥0.1mV(1mm)
- ST段压低：任何导联 ≤-0.1mV 触发警示
- T波倒置：aVR/V1/III 为正常变异不报告；其余导联 T 波若低于基线 0.1mV 以上报告
- 病理性Q波：深度 > R波1/3 或 Q波宽度 ≥80ms
- 下壁导联(II,III,aVF) ST 抬高时：III > II 提示右冠而非回旋支病变
- 对应性改变：下壁抬高时侧壁压低为对应性；前壁抬高时下壁压低为对应性
- III导联小Q波及T波倒置属正常变异，III 导联可存在生理性 Q 波
- 正常参考范围：窦性心率 60-100bpm，QRS 80-100ms，QTc < 460ms（Bazett），电轴 -30°~105°（病理状态下可超出此范围）

数据点基准：
- 每导联 points[0] 的 mV 值为该导联的等电位基线（通常接近 0）
- 所有波形偏移以此基线为参考
- 每个导联选择一个合适的周期数据即可，程序自动循环填充面板

---
=== 绘制引擎选择 ===

drawLeadCurve：常规情况（窦性、单一形态早搏、典型阻滞等）
  - 数据通过程序校验，校验失败会要求重试
  - 如果确信数据临床正确但被拒绝，可添加 "insist": true 强制绘制

drawLeadCurveCSV：以下情况必须/优先使用（全面板直接渲染，不自动循环，不做校验）：
  1. 数据点超过 30 个（精细波形描述）
  2. 多形态波形（室早 + 正常搏动形态差异大）
  3. 复杂病变（碎裂 QRS、epsilon 波、delta 波、巨大 T 波倒置等）
  4. 不规则节律（房颤 f 波、尖端扭转等不适合单周期表达的）
  5. 使用 drawLeadCurve 被拒绝后重试困难时

---
=== 工具详细说明 ===

1. initRender\n{ "tool": "initRender", "rhythmType": "sinus", "params": { "heartRate": 72, "qrsDuration": 90, "qtInterval": 390, "qrsAxis": 30 } }
rhythmType: "sinus"|"atrial_fibrillation"|"atrial_flutter"|"ventricular"|"paced"|"complete_heart_block"|"ventricular_fibrillation"|"torsades"|"sinus_with_pvc"|"sinus_arrhythmia"|"sinus_with_wenckebach"|"sinus_with_mobitz2"

2. writeHeaderInfo（心电图标题信息，可选但推荐）
{ "tool": "writeHeaderInfo", "text": "患者：急性前壁心梗 | 心率：110bpm | 窦性心动过速" }
- 根据用户描述整理为简洁的标题信息（1-2行）
- 会显示在心电图顶部和侧栏，持续可见
- 文本简洁，通常包含：主要诊断、关键参数、特殊说明

3. drawLeadCurve（单周期模式 — 提供一个心搏周期，系统自动循环填满面板）
{ "tool": "drawLeadCurve", "lead": "I", "points": [[0,0],[0.03,0.06],[0.08,-0.1],[0.12,1.5],[0.16,-0.2],[0.22,0],[0.28,0.02],[0.34,0.35],[0.45,0]] }
- 系统自动重复该周期填满导联面板（约 2.5s）
- 点数：最少 12，推荐 18~25
- t 严格递增，每点不超过 1.5s
- 时间跨度 0.5~1.5s，mV 范围 -5.0~+5.0
- 必须包含：基线、P波、Q波（可为0）、R波、S波（可为0）、J点、ST段、T波
- 病变特征：ST段抬高/压低（mV值）、T波倒置（负mV）、T波高尖、病理性Q波（深负mV）
- P波缺失的节律（房颤/房扑/室性/起搏）可省略 P 波
- 当数据准确但校验不通过时，添加 "insist": true 强制绘制

4. drawLeadCurveCSV（CSV 模式 — 完整面板绘制，不自动循环，不做校验）\n{ "tool": "drawLeadCurveCSV", "lead": "I", "csv": "0.00,0.00\\n0.02,0.02\\n0.04,0.05\\n0.06,0.08\\n0.08,0.06\\n0.10,0.02\\n0.11,0.00\\n0.12,-0.08\\n0.13,-0.12\\n0.14,0.30\\n0.15,1.20\\n0.16,1.50\\n0.17,0.80\\n0.18,-0.15\\n0.20,-0.20\\n0.22,-0.05\\n0.23,0.00\\n0.25,0.02\\n0.28,0.02\\n0.30,0.08\\n0.34,0.30\\n0.38,0.35\\n0.42,0.18\\n0.44,0.02\\n0.46,0.00" }\n- csv 为多行字符串，每行 \"t,mV\"，系统 Catmull-Rom 平滑后**原样渲染整个面板**（不自动循环重复）\n- 时间跨度应覆盖整个导联面板时长（约 2.5s），可包含多个心搏\n- 推荐 50~150 个数据点覆盖完整时长，不规则节律可用更多点\n- t 严格递增，mV 范围 -5.0~+5.0\n- 不做程序校验，由你确保波形符合心电生理学规律和导联间关系

5. drawRhythmStrip（节律带 — 复用已绘制的导联数据循环填充 10s）\n{ "tool": "drawRhythmStrip", "lead": "II" }\n- 自动复用已绘制的 lead="II" 导联数据，渲染底部 10 秒长条节律带\n- 只需指定 lead，无需额外提供数据\n\n6. drawRhythmStripCSV（节律带 CSV — 全面板直接渲染 10s，不自动循环）\n{ "tool": "drawRhythmStripCSV", "csv": "0.00,0.00\\n0.02,0.02\\n..." }\n- csv 为多行字符串，每行 \"t,mV\"，Catmull-Rom 平滑后原样渲染 10s 节律带\n- 时间跨度应覆盖 10s，可包含多个心搏，适合不规则节律全程展示\n- 推荐 200~500 个数据点覆盖 10s\n- t 严格递增，mV 范围 -5.0~+5.0，不做程序校验

7. writeInterpretation
{ "tool": "writeInterpretation", "text": "完整临床解读，包含心律分析、间期测量、电轴判断、ST-T改变描述、异常发现、鉴别诊断和最终结论，200-500字" }

8. writeLeadDescriptions
{ "tool": "writeLeadDescriptions", "descriptions": { "I": "描述P-QRS-T各波形特征...", "II": "...", ... "V6": "..." } }
- 每个导联描述至少 30 字，12 导联全部覆盖`;
}


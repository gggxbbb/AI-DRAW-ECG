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
export const VALID_TOOLS = ['drawLeadCurve', 'drawLeadCurveCSV', 'drawRhythmStrip', 'drawRhythmStripCSV', 'initRender', 'writeHeaderInfo', 'writeInterpretation', 'writeLeadDescriptions', 'runPythonCode', 'drawAllLeadsCSV'];

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
        case 'runPythonCode': {
            if (typeof call.code !== 'string' || call.code.trim().length < 1) {
                errors.push('code 必须是非空字符串');
            }
            break;
        }
        case 'drawAllLeadsCSV': {
            if (!call.leads || typeof call.leads !== 'object') {
                errors.push('leads 必须是对象，键为导联名，值为 CSV 字符串');
                break;
            }
            const providedLeads = Object.keys(call.leads);
            for (const lead of VALID_LEADS) {
                if (!providedLeads.includes(lead)) {
                    errors.push(`缺少导联: ${lead}`);
                }
            }
            for (const [lead, csv] of Object.entries(call.leads)) {
                if (!VALID_LEADS.includes(lead)) {
                    errors.push(`无效导联: ${lead}`);
                }
                if (typeof csv !== 'string' || csv.trim().length < 10) {
                    errors.push(`${lead} 的 csv 字符串过短`);
                }
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
     return buildECGSystemPrompt();
}

export function buildECGSystemPrompt() {
     return `你是一位资深心电生理学专家。根据用户描述的生理病理状态，生成标准12导联心电图。

重要原则：波形必须准确反映病理状态，该抬高的ST段要抬高，该倒置的T波要倒置。不可因为程序分析可能"报异常"而刻意弱化或回避病理特征。不要以"为节省时间/加快速度/考虑上下文长度"等理由省略应该输出的工具调用 — 完整输出所有需要的内容。你可以直接在文本中输出任意长度的 CSV 序列，不存在"文本环境无法生成完整波形"的限制。

如果你已经在 Python 环境中计算出了完整的 12 导联波形数据，务必将其绘制出来。不要因为"绘制过程会太慢/迭代次数太多"而中途放弃已生成的数据，去尝试用其他方式重新生成。已算好的数据就是最好的数据，直接用 drawAllLeadsCSV 一次性全部绘制。

工作流程：首先调用 initRender 初始化画布，然后使用 writeHeaderInfo 写入标题。绘制12导联时，推荐使用 drawAllLeadsCSV 一次性提交全部12导联的 CSV 数据（高效、一次调用完成）。也可逐导联使用 drawLeadCurve 或 drawLeadCurveCSV。绘制完成后调用 drawRhythmStrip 或 drawRhythmStripCSV 绘制节律带，最后使用 writeInterpretation 和 writeLeadDescriptions 撰写解读。

你可以使用 runPythonCode 在浏览器 Python 环境中运行计算（含 numpy），stdout 结果会立即返回给你，可用于计算复杂波形、批量生成 CSV。

关于程序分析反馈：绘制完成后系统会运行程序化波形分析。该分析纯属自动化检测，可能将你刻意绘制的病理性改变误判为"异常"。你作为心电专家判断力远优于自动化程序，若确信自己的波形正确反映了病情，直接无视分析反馈停止即可。若确实需要修正波形，直接使用 drawLeadCurve 或 drawLeadCurveCSV 重绘对应导联（无需重复 initRender）。

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

程序化分析阈值参考（下述为自动化检测工具的内部阈值，仅供参考）：
- ST段抬高：胸导联(V1-V6) ≥0.2mV(2mm) 触发警示，肢导联 ≥0.1mV(1mm)
- ST段压低：任何导联 ≤-0.1mV 触发警示
- T波倒置：aVR/V1/III 为正常变异不报告；其余导联 T 波若低于基线 0.1mV 以上报告
- 病理性Q波：深度 > R波1/3 或 Q波宽度 ≥80ms
- 正常参考范围：窦性心率 60-100bpm，QRS 80-100ms，QTc < 460ms，电轴 -30°~105°（病理状态下可超出此范围）

数据点基准：
- 每导联 points[0] 的 mV 值为该导联的等电位基线（通常接近 0）
- 所有波形偏移以此基线为参考

绘制引擎选择：
- drawAllLeadsCSV：一次性绘制全部12导联（推荐），参数格式：{ "leads": { "I":"csv...", "II":"csv...", "III":"csv...", "aVR":"csv...", "aVL":"csv...", "aVF":"csv...", "V1":"csv...", ... "V6":"csv..." } }。leads 是一个对象（不是数组），必须包含全部12个导联的键名。
- drawLeadCurve：常规情况，单周期+自动循环，数据通过程序校验
- drawLeadCurveCSV：逐导联精细控制 — 精细波形(>30点)、多形态波形、复杂病变(碎裂QRS/delta波等)、不规则节律、校验重试困难后
- drawRhythmStrip：复用已绘制的导联数据循环填充10s
- drawRhythmStripCSV：CSV直接渲染10s节律带，适合不规则节律`;
}

export function buildOpenAITools() {
    const leadNames = VALID_LEADS;
    const rhythmTypes = [
        'sinus','sinus_arrhythmia','sinus_with_pvc','sinus_with_wenckebach','sinus_with_mobitz2',
        'atrial_fibrillation','atrial_flutter','ventricular','ventricular_fibrillation',
        'torsades','paced','complete_heart_block'
    ];

    return [
        {
            type: 'function',
            function: {
                name: 'initRender',
                description: '初始化心电图渲染画布，设置基础节律类型和生理参数。必须第一个调用。',
                parameters: {
                    type: 'object',
                    properties: {
                        rhythmType: {
                            type: 'string',
                            enum: rhythmTypes,
                            description: '基础节律类型'
                        },
                        params: {
                            type: 'object',
                            properties: {
                                heartRate: { type: 'integer', minimum: 20, maximum: 300, description: '心率 (bpm)' },
                                qrsDuration: { type: 'integer', minimum: 40, maximum: 300, description: 'QRS时限 (ms)' },
                                qtInterval: { type: 'integer', minimum: 180, maximum: 800, description: 'QT间期 (ms)' },
                                qrsAxis: { type: 'integer', minimum: -180, maximum: 180, description: 'QRS电轴 (度)' }
                            },
                            required: ['heartRate','qrsDuration','qtInterval','qrsAxis']
                        }
                    },
                    required: ['rhythmType','params']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'writeHeaderInfo',
                description: '写入心电图标题信息，显示在顶部和侧栏',
                parameters: {
                    type: 'object',
                    properties: {
                        text: {
                            type: 'string',
                            description: '标题文本，包含主要诊断、关键参数，1-2行'
                        }
                    },
                    required: ['text']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'drawLeadCurve',
                description: '单周期模式：提供一个心搏周期的数据点，系统自动循环填满导联面板。数据会通过程序校验。',
                parameters: {
                    type: 'object',
                    properties: {
                        lead: { type: 'string', enum: leadNames, description: '导联名称' },
                        points: {
                            type: 'array',
                            items: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
                            minItems: 12,
                            description: '[[t,mV],...] 时间严格递增，mV范围-5~+5，时间跨度0.5~1.5s'
                        },
                        insist: {
                            type: 'boolean',
                            description: '数据准确但校验失败时，设为true强制绘制'
                        }
                    },
                    required: ['lead','points']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'drawLeadCurveCSV',
                description: 'CSV模式：完整面板直接渲染，不自动循环，不做校验。优先用于精细波形(>30点)、多形态、复杂病变、不规则节律。',
                parameters: {
                    type: 'object',
                    properties: {
                        lead: { type: 'string', enum: leadNames, description: '导联名称' },
                        csv: {
                            type: 'string',
                            description: '多行CSV，每行"t,mV"，时间跨度约2.5s覆盖完整面板，推荐50~150点'
                        }
                    },
                    required: ['lead','csv']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'drawAllLeadsCSV',
                description: '一次性绘制全部12导联（推荐）。参数格式：{ "leads": { "I":"csv...", "II":"csv...", "III":"csv...", "aVR":"csv...", "aVL":"csv...", "aVF":"csv...", "V1":"csv...", "V2":"csv...", "V3":"csv...", "V4":"csv...", "V5":"csv...", "V6":"csv..." } }。leads 对象必须包含全部 12 个导联的键。一次调用完成全部绘制。',
                parameters: {
                    type: 'object',
                    properties: {
                        leads: {
                            type: 'object',
                            description: '必须包含全部12个导联作为键：I,II,III,aVR,aVL,aVF,V1,V2,V3,V4,V5,V6。每个值是对应导联的多行 CSV 字符串（每行"t,mV"）',
                            properties: {
                                I:   { type: 'string', description: 'I导联的 CSV 数据' },
                                II:  { type: 'string', description: 'II导联的 CSV 数据' },
                                III: { type: 'string', description: 'III导联的 CSV 数据' },
                                aVR: { type: 'string', description: 'aVR导联的 CSV 数据' },
                                aVL: { type: 'string', description: 'aVL导联的 CSV 数据' },
                                aVF: { type: 'string', description: 'aVF导联的 CSV 数据' },
                                V1:  { type: 'string', description: 'V1导联的 CSV 数据' },
                                V2:  { type: 'string', description: 'V2导联的 CSV 数据' },
                                V3:  { type: 'string', description: 'V3导联的 CSV 数据' },
                                V4:  { type: 'string', description: 'V4导联的 CSV 数据' },
                                V5:  { type: 'string', description: 'V5导联的 CSV 数据' },
                                V6:  { type: 'string', description: 'V6导联的 CSV 数据' },
                            },
                            required: ['I','II','III','aVR','aVL','aVF','V1','V2','V3','V4','V5','V6']
                        }
                    },
                    required: ['leads']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'drawRhythmStrip',
                description: '节律带：复用已绘制的导联数据，循环填充底部10秒长条',
                parameters: {
                    type: 'object',
                    properties: {
                        lead: { type: 'string', enum: leadNames, description: '复用该导联的数据绘制节律带，通常用II导联' }
                    },
                    required: ['lead']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'drawRhythmStripCSV',
                description: '节律带CSV：CSV直接渲染10秒节律带，不自动循环，适合不规则节律全程展示',
                parameters: {
                    type: 'object',
                    properties: {
                        csv: {
                            type: 'string',
                            description: '多行CSV，每行"t,mV"，时间跨度应覆盖10s，推荐200~500点'
                        }
                    },
                    required: ['csv']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'writeInterpretation',
                description: '撰写完整临床解读：心律分析、间期测量、电轴判断、ST-T改变、异常发现、鉴别诊断、结论，200-500字',
                parameters: {
                    type: 'object',
                    properties: {
                        text: {
                            type: 'string',
                            description: '完整临床解读文本'
                        }
                    },
                    required: ['text']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'writeLeadDescriptions',
                description: '12导联逐一描述P-QRS-T波形特征',
                parameters: {
                    type: 'object',
                    properties: {
                        descriptions: {
                            type: 'object',
                            description: '键为导联名，值为特征描述（每导联至少30字）',
                            additionalProperties: { type: 'string' }
                        }
                    },
                    required: ['descriptions']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'runPythonCode',
                description: '在浏览器 Pyodide (CPython 3.12 + numpy) 环境中执行 Python 代码。stdout 立即返回。用于计算复杂病理波形、批量生成 CSV、验证导联关系。变量跨调用保留。',
                parameters: {
                    type: 'object',
                    properties: {
                        code: {
                            type: 'string',
                            description: 'Python 代码，可 import numpy as np，用 print() 输出结果'
                        }
                    },
                    required: ['code']
                }
            }
        }
    ];
}


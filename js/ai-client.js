// AI Client - Handles communication with AI API endpoints
// Supports OpenAI-compatible API format (OpenAI, DeepSeek, Claude via API, etc.)

class AIClient {
    constructor() {
        this.endpoint = '';
        this.token = '';
        this.model = 'gpt-4o';
        this.temperature = 0.3;
        this.maxTokens = 4096;
    }

    configure(endpoint, token, model, temperature = 0.3) {
        this.endpoint = endpoint.trim();
        this.token = token.trim();
        this.model = model.trim();
        this.temperature = temperature;
    }

    async testConnection() {
        if (!this.endpoint || !this.token) {
            throw new Error('请先配置API Endpoint和Token');
        }

        try {
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`,
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        { role: 'user', content: 'ping' }
                    ],
                    max_tokens: 10,
                    temperature: 0,
                }),
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            return {
                success: true,
                model: data.model || this.model,
            };
        } catch (err) {
            throw new Error(`连接失败: ${err.message}`);
        }
    }

    buildECGPrompt(condition, additionalParams) {
        const leadInfo = `当前导联：II导联（可根据需求扩展到其他导联）`;

        const systemPrompt = `你是一位资深的心电生理学专家和临床心脏病学专家。你的任务是根据用户描述的生理病理状态，生成一份详细、科学准确的心电图参数配置，用于在Canvas上渲染真实的心电波形。

请严格遵循以下规则：

1. **输出格式**：必须返回有效的JSON对象，不要包含任何markdown代码块标记、解释或额外文本。

2. **JSON结构**：返回的JSON必须包含以下字段（根据疾病类型，某些字段可为null）：
{
  "heartRate": <心率bpm, number>,
  "rhythm": "<regular|irregularly_irregular|sinus_arrhythmia|chaotic|av_dissociation>",
  "rhythmType": "<sinus|atrial_fibrillation|atrial_flutter|atrial|ventricular|paced|complete_heart_block|ventricular_fibrillation|sinus_with_pvc|sinus_with_wenckebach|sinus_with_mobitz2|torsades>",
  "prInterval": <PR间期ms, number或null>,
  "qrsDuration": <QRS时限ms, number或null>,
  "qtInterval": <QT间期ms, number或null>,
  "qtcInterval": <QTc间期ms, number或null>,
  "pAmplitude": <P波振幅mV, number>,
  "pDuration": <P波时限ms, number>,
  "pPresent": <true|false>,
  "pLowAmplitude": <true|false>,
  "pAxis": <P波电轴角度, number或null>,
  "qrsAmplitude": <QRS波振幅mV, number或null>,
  "qrsAxis": <QRS波电轴角度, number或null>,
  "qrsDuration": <QRS时限ms, number>,
  "qrsNotching": <true|false>,  // R波切迹（LBBB特征）
  "qrsMorphology": "<normal|wide_bizarre|paced_lbbb>",  // QRS形态
  "rbbbRsrPattern": <true|false>,  // RBBB的rsR'型
  "terminalR": <终末R'波振幅mV, number或null>,
  "sWaveBroad": <true|false>,  // S波增宽
  "rWaveProminent": { "leads": ["V1","V2"], "duration": <number秒>, "amplitude": <number mV> } 或 null,
  "tAmplitude": <T波振幅mV, number>,
  "tDuration": <T波时限ms, number或null>,
  "tInverted": <true|false>,
  "tPeaked": <true|false>,
  "tFlattened": <true|false>,
  "tLowAmplitude": <true|false>,
  "tUprightProminent": <true|false>,
  "tTall": <true|false>,
  "tInvertedDeep": <true|false>,
  "tBiphasic": <true|false>,
  "tNotched": <true|false>,
  "tBroadBased": <true|false>,
  "tDirection": "<normal|opposite>",
  "tInvertedV1V3": <true|false>,
  "twaveShape": "<asymmetric|symmetric_peaked|symmetric_deep_inverted|peaked_symmetric_tented|opposite_qrs|lv_strain|rv_strain|brugada_inverted|flat_u_wave|flat_inverted|asymmetric_tall|asymmetric_large|tall_upright|broad_biphasic_notched|deep_symmetric_inverted|twisting>",
  "stElevation": <ST段抬高值mV, number>,
  "stDepression": <ST段压低值mV, number(负数)>,
  "stSlope": "<flat|upsloping|downsloping|horizontal>",
  "stShape": "<coved_upward|concave_upward|straight|horizontal_depression>",
  "stDiscordant": <true|false>,  // 继发性ST-T改变
  "stDifficult": <true|false>,  // ST段难以辨认
  "stDiffuse": <true|false>,  // 弥漫性ST改变
  "stSegmentProlonged": <true|false>,  // ST段延长（低钙）
  "stShort": <true|false>,  // ST段缩短（高钙）
  "prDepression": <PR段压低mV, number或null>,
  "jPointElevation": <J点抬高mV, number或null>,
  "jWave": { "amplitude": <number mV>, "slurring": <true|false> } 或 null,
  "qWave": { "depth": <number mV>, "duration": <number 秒>, "leads": ["V1","V2"] } 或 null,
  "reciprocalChanges": { "leads": ["I","aVL"], "stDepression": <number mV> } 或 null,
  "uWavePresent": <true|false>,
  "uWaveProminent": <true|false>,
  "uWaveAmplitude": <U波振幅mV, number或null>,
  "fibrillationWaves": { "amplitude": <number mV>, "frequency": <number bpm> } 或 null,
  "flutterWaves": { "amplitude": <number mV>, "frequency": <number bpm>, "conductionRatio": <number> } 或 null,
  "respiratoryVariation": <呼吸变异心率bpm, number或null>,  // 用于窦性心律不齐
  "rrVariation": { "min": <number秒>, "max": <number秒> } 或 null,  // 用于房颤
  "pvcFrequency": <室早频率次/分, number或null>,
  "pvcQrsDuration": <室早QRS时限ms, number或null>,
  "pvcMorphology": "<uniform|multiform>",
  "prBaseInterval": <文氏基础PR间期ms, number或null>,
  "prIncrement": <文氏每次增量ms, number或null>,
  "droppedBeatEvery": <每次脱落间隔心搏数, number或null>,
  "atrialRate": <心房率bpm(三度AVB), number或null>,
  "junctionalQrs": <true|false>,  // 交界性逸搏QRS
  "ventricularRate": <心室率bpm, number或null>,
  "paceSpike": { "amplitude": <number mV>, "duration": <number ms> } 或 null,
  "vfAmplitude": { "coarse": <true|false>, "irregular": <true> } 或 null,
  "torsadesEnvelope": <true|false>,
  "brugadaPattern": "<type1|type2>",
  "highVoltage": <true|false>,
  "leftAtrialEnlargement": <true|false>,
  "pPulmonale": <true|false>,
  "strainPattern": <true|false>,
  "v1DominantR": <true|false>,
  "v1RAmplitude": <V1导联R波振幅mV, number或null>,
  "sWaveLeadI": <true|false>,  // 肺栓塞SI
  "qWaveLeadIII": <true|false>,  // 肺栓塞QIII
  "tInvertedLeadIII": <true|false>,  // 肺栓塞TIII
  "rbbbIncomplete": <true|false>,  // 不完全RBBB
  "axis": <电轴角度, number或null>,
  "qrsAxis": <QRS波额面电轴角度°, number>,  // 必须提供，用于12导联投影计算
  "pAxis": <P波电轴角度°, number或null>,
  "tAxis": <T波电轴角度°, number或null>,
  "leadsInvolved": ["V2","V3"] 或 null
}

3. **电轴参数（12导联渲染必需）**：
- qrsAxis：QRS额面电轴，正常范围-30°到+90°。左偏<-30°（LBBB、左前分支阻滞），右偏>+90°（RVH、肺栓塞）
- pAxis：P波电轴，正常30°-70°
- tAxis：T波电轴，正常与QRS方向相近
- 系统使用hexaxial参考系统将心电向量投影到各肢体导联
- 胸导联使用R波递增/S波递减模型（V1 rS型 → V6 qR型）
- 心率、间期、振幅数值必须符合临床病理生理学规律
- 正常值参考：PR 120-200ms, QRS 60-110ms, QTc <440ms(男)/<460ms(女), P波振幅0.05-0.25mV
- ST段抬高/压低以mV为单位（10mm/mV标准增益时1mm=0.1mV）
- 不同疾病有其特征性的参数组合，必须准确反映
- 间期之间必须协调：PR < RR, QT < RR, QRS < QT

4. **特殊节律处理**：
- 房颤：rhythm="irregularly_irregular", rhythmType="atrial_fibrillation", pPresent=false, 设置fibrillationWaves和rrVariation
- 房扑：rhythmType="atrial_flutter", pPresent=false, 设置flutterWaves(频率、传导比例)
- 室速：rhythmType="ventricular", qrsDuration≥120, tDirection="opposite"
- 室颤：rhythmType="ventricular_fibrillation", 设置vfAmplitude
- 尖端扭转：rhythmType="torsades", torsadesEnvelope=true
- 三度AVB：rhythmType="complete_heart_block", 心房率>心室率, rhythm="av_dissociation"
- 起搏心律：rhythmType="paced", pPresent=false, paceSpike设置
- 室早：rhythmType="sinus_with_pvc", pvcFrequency和pvcQrsDuration
- 文氏：rhythmType="sinus_with_wenckebach", prBaseInterval, prIncrement, droppedBeatEvery
- Mobitz II：rhythmType="sinus_with_mobitz2", prInterval固定, droppedBeatEvery
- 窦性心律不齐：rhythmType="sinus_arrhythmia", respiratoryVariation设定

5. **T波形态参数(twaveShape)**：
- 正常：asymmetric（不对称）
- 高钾：peaked_symmetric_tented（高尖对称帐篷状）
- 心梗超急性期：symmetric_peaked
- 心梗亚急性期：symmetric_deep_inverted或deep_symmetric_inverted
- LBBB/室速/起搏：opposite_qrs（与QRS主波相反）
- 左室劳损：lv_strain
- 右室劳损：rv_strain
- Brugada：brugada_inverted
- 低钾：flat_u_wave
- Wellens：deep_symmetric_inverted

6. **ST段形态参数(stShape)**：
- 急性STEMI：coved_upward（穹窿型）
- 心包炎/早期复极：concave_upward（凹面向上）
- 心内膜下缺血：horizontal_depression（水平压低）
- 正常变异：straight`;

        const userPrompt = `请根据以下生理病理描述，生成12导联心电图参数配置JSON。系统将根据qrsAxis/pAxis/tAxis在hexaxial参考系上投影出各肢体导联波形，胸导联使用R波递增模型。

**患者描述**：${condition}
${additionalParams ? `\n**补充参数**：${additionalParams}` : ''}

请生成科学准确的12导联ECG参数JSON。确保：
- 提供正确的qrsAxis值（必需），并可选提供pAxis和tAxis
- 参数反映该疾病的典型心电图特征
- MI需指定qWave的导联范围（leads数组）以在多导联显示对应ST改变
- 数值在病理生理学合理范围内
- 如果描述不够详细，基于典型表现推断合理数值`;

        return { systemPrompt, userPrompt };
    }

    async generateECG(condition, additionalParams = '') {
        if (!this.endpoint || !this.token) {
            throw new Error('请先配置API Endpoint和Token');
        }

        const { systemPrompt, userPrompt } = this.buildECGPrompt(condition, additionalParams);

        try {
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`,
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt },
                    ],
                    max_tokens: this.maxTokens,
                    temperature: this.temperature,
                }),
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                const errMsg = errData.error?.message || `HTTP ${response.status}: ${response.statusText}`;

                if (response.status === 401 || response.status === 403) {
                    throw new Error(`认证失败: ${errMsg}`);
                }
                if (response.status === 429) {
                    throw new Error(`请求频率超限: ${errMsg}`);
                }
                throw new Error(`API错误 (${response.status}): ${errMsg}`);
            }

            const data = await response.json();

            let content = '';
            if (data.choices && data.choices[0]) {
                content = data.choices[0].message?.content || '';
            } else if (data.content) {
                // Some APIs return content directly
                content = data.content;
            } else {
                throw new Error('无法解析AI响应格式');
            }

            const params = this.parseResponse(content);
            return {
                params,
                rawResponse: content,
                model: data.model || this.model,
                usage: data.usage || null,
            };
        } catch (err) {
            if (err.message.includes('API错误') || err.message.includes('认证') ||
                err.message.includes('请求频率') || err.message.includes('无法解析')) {
                throw err;
            }
            throw new Error(`网络请求失败: ${err.message}`);
        }
    }

    parseResponse(content) {
        // Try to extract JSON from various response formats
        let jsonStr = content.trim();

        // Remove markdown code blocks
        const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (codeBlockMatch) {
            jsonStr = codeBlockMatch[1];
        }

        // Try to find JSON object in the text
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            jsonStr = jsonMatch[0];
        }

        try {
            const params = JSON.parse(jsonStr);

            // Validate and set defaults for critical fields
            params.heartRate = params.heartRate || 72;
            params.rhythm = params.rhythm || 'regular';
            params.rhythmType = params.rhythmType || 'sinus';
            params.qrsDuration = params.qrsDuration || 90;
            params.qtInterval = params.qtInterval || 390;

            // Ensure P wave present unless explicitly set to false
            if (params.pPresent === undefined) {
                params.pPresent = !(
                    params.rhythmType === 'atrial_fibrillation' ||
                    params.rhythmType === 'atrial_flutter' ||
                    params.rhythmType === 'ventricular' ||
                    params.rhythmType === 'ventricular_fibrillation' ||
                    params.rhythmType === 'paced'
                );
            }

            // Ensure qrsAmplitude
            if (!params.qrsAmplitude && params.qrsAmplitude !== 0) {
                params.qrsAmplitude = 1.5;
            }

            // Ensure tAmplitude
            if (params.tAmplitude === undefined) {
                params.tAmplitude = 0.3;
            }

            // Merge with default template values for missing fields
            const defaults = {
                pAmplitude: 0.15,
                pDuration: 90,
                stElevation: 0,
                stDepression: 0,
                stSlope: 'flat',
                twaveShape: 'asymmetric',
            };

            for (const [key, value] of Object.entries(defaults)) {
                if (params[key] === undefined) {
                    params[key] = value;
                }
            }

            return params;
        } catch (e) {
            throw new Error(`AI响应解析失败，请确认模型返回了有效的JSON格式。原始响应: ${content.substring(0, 200)}...`);
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIClient;
}

import { parseToolCallsFromAIResponse } from './tool-executor';
import { buildToolSchemaDescription } from './ecg-constraints';

export class AIClient {
    constructor() {
        this.endpoint = '';
        this.token = '';
        this.model = 'gpt-4o';
        this.temperature = 0.3;
        this.maxTokens = 8192;
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

    async generateECGToolsStream(condition, additionalParams, onToolCall) {
        if (!this.endpoint || !this.token) {
            throw new Error('请先配置API Endpoint和Token');
        }

        const systemPrompt = buildToolSchemaDescription();
        const userPrompt = `请根据以下生理病理描述，生成心电图绘制工具调用数组。

**患者描述**：${condition}
${additionalParams ? `\n**补充参数**：${additionalParams}` : ''}

 要求：
- 必须按顺序: initRender -> drawLeadCurve(x12) -> drawRhythmStrip -> writeInterpretation -> writeLeadDescriptions
- drawLeadCurve 为每个导联提供完整心搏周期的关键数据点，肢体导联振幅符合电轴投影，胸导联R波V1->V6递增`;

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
                    stream: true,
                }),
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                const errMsg = errData.error?.message || `HTTP ${response.status}`;
                throw new Error(`API错误: ${errMsg}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let toolCallIndex = 0;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const data = line.slice(6);
                    if (data === '[DONE]') break;

                    try {
                        const parsed = JSON.parse(data);
                        const content = parsed.choices?.[0]?.delta?.content || '';
                        if (!content) continue;

                        buffer += content;

                        let braceDepth = 0;
                        let inString = false;
                        let escapeNext = false;
                        let objectStart = -1;
                        let foundCount = 0;

                        for (let i = 0; i < buffer.length; i++) {
                            const ch = buffer[i];
                            if (escapeNext) { escapeNext = false; continue; }
                            if (ch === '\\') { escapeNext = true; continue; }
                            if (ch === '"') { inString = !inString; continue; }
                            if (inString) continue;

                            if (ch === '[' || ch === ']' || ch === ',' || ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t') continue;

                            if (ch === '{') {
                                if (braceDepth === 0) objectStart = i;
                                braceDepth++;
                            } else if (ch === '}') {
                                braceDepth--;
                                if (braceDepth === 0 && objectStart >= 0) {
                                    const objStr = buffer.slice(objectStart, i + 1);
                                    try {
                                        const toolCall = JSON.parse(objStr);
                                        foundCount++;
                                        onToolCall(toolCall, toolCallIndex++);
                                    } catch (e) {
                                        // incomplete JSON, keep buffering
                                    }
                                }
                            }
                        }

                        if (foundCount > 0) {
                            const lastBrace = buffer.lastIndexOf('}');
                            if (lastBrace >= 0) buffer = buffer.slice(lastBrace + 1);
                        }
                    } catch (e) {
                        // skip unparseable SSE lines
                    }
                }
            }
        } catch (err) {
            throw new Error(`流式传输失败: ${err.message}`);
        }
    }

    async generateECGTools(condition, additionalParams = '') {
        if (!this.endpoint || !this.token) {
            throw new Error('请先配置API Endpoint和Token');
        }

        const systemPrompt = buildToolSchemaDescription();

        const userPrompt = `请根据以下生理病理描述，生成心电图绘制工具调用数组。

**患者描述**：${condition}
${additionalParams ? `\n**补充参数**：${additionalParams}` : ''}

要求：
- 必须包含 draw12Lead 工具调用，leads 对象中包含全部12导联
- 每个导联包含3个等间距心搏（心率为 heartRate = 60/onset间距）
- 12个导联的 beat onset 时间必须完全一致
- 不同导联使用不同的 qrsAmplitude、stElevation 等参数反映该疾病的导联特异性改变
- 肢体导联的振幅参数应符合电轴投影规律
- 胸导联的R波应从 V1 到 V6 递增`;

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
                content = data.content;
            } else {
                throw new Error('无法解析AI响应格式');
            }

            const toolCalls = parseToolCallsFromAIResponse(content);

            return {
                toolCalls,
                rawResponse: content,
                model: data.model || this.model,
                usage: data.usage || null,
            };
        } catch (err) {
            if (err.message.includes('API错误') || err.message.includes('认证') ||
                err.message.includes('请求频率') || err.message.includes('无法解析')) {
                throw err;
            }
            if (err.message.includes('解析')) {
                throw err;
            }
            throw new Error(`网络请求失败: ${err.message}`);
        }
    }

    parseResponse(content) {
        let jsonStr = content.trim();

        const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (codeBlockMatch) {
            jsonStr = codeBlockMatch[1];
        }

        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            jsonStr = jsonMatch[0];
        }

        try {
            const params = JSON.parse(jsonStr);

            params.heartRate = params.heartRate || 72;
            params.rhythm = params.rhythm || 'regular';
            params.rhythmType = params.rhythmType || 'sinus';
            params.qrsDuration = params.qrsDuration || 90;
            params.qtInterval = params.qtInterval || 390;

            if (params.pPresent === undefined) {
                params.pPresent = !(
                    params.rhythmType === 'atrial_fibrillation' ||
                    params.rhythmType === 'atrial_flutter' ||
                    params.rhythmType === 'ventricular' ||
                    params.rhythmType === 'ventricular_fibrillation' ||
                    params.rhythmType === 'paced'
                );
            }

            if (!params.qrsAmplitude && params.qrsAmplitude !== 0) {
                params.qrsAmplitude = 1.5;
            }

            if (params.tAmplitude === undefined) {
                params.tAmplitude = 0.3;
            }

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

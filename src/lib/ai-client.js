import { parseToolCallsFromAIResponse } from './tool-executor';
import { buildToolSchemaDescription } from './ecg-constraints';

export class AIClient {
    constructor() {
        this.endpoint = '';
        this.token = '';
        this.model = 'gpt-4o';
        this.temperature = 0.3;
        this.maxTokens = 8192;
        this._abortController = null;
    }

    configure(endpoint, token, model, temperature = 0.3) {
        this.endpoint = endpoint.trim();
        this.token = token.trim();
        this.model = model.trim();
        this.temperature = temperature;
    }

    async testConnection() {
        if (!this.endpoint || !this.token) throw new Error('请先配置API Endpoint和Token');
        try {
            const resp = await fetch(this.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
                body: JSON.stringify({ model: this.model, messages: [{ role: 'user', content: 'ping' }], max_tokens: 10, temperature: 0 }),
            });
            if (!resp.ok) { const e = await resp.json().catch(() => ({})); throw new Error(e.error?.message || `HTTP ${resp.status}`); }
            const d = await resp.json();
            return { success: true, model: d.model || this.model };
        } catch (err) { throw new Error(`连接失败: ${err.message}`); }
    }

    abort() {
        if (this._abortController) {
            this._abortController.abort();
            this._abortController = null;
        }
    }

    async streamCall(messages, onReasoning, onToolCall, reasoningEffort) {
        if (!this.endpoint || !this.token) throw new Error('请先配置API Endpoint和Token');

        this._abortController = new AbortController();
        const body = { model: this.model, messages, max_tokens: this.maxTokens, temperature: this.temperature, stream: true };
        if (reasoningEffort) body.reasoning_effort = reasoningEffort;

        const resp = await fetch(this.endpoint, {
            method: 'POST',
            signal: this._abortController.signal,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
            body: JSON.stringify(body),
        });
        if (!resp.ok) {
            const e = await resp.json().catch(() => ({}));
            throw new Error(`API错误: ${e.error?.message || `HTTP ${resp.status}`}`);
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let toolIndex = 0;
        let usage = null;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });

            for (const line of chunk.split('\n')) {
                if (!line.startsWith('data: ')) continue;
                const data = line.slice(6);
                if (data === '[DONE]') break;
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.usage) usage = parsed.usage;
                    const delta = parsed.choices?.[0]?.delta;
                    if (!delta) continue;

                    const reasoning = delta.reasoning_content;
                    if (reasoning && onReasoning) onReasoning(reasoning, 'reasoning');

                    const content = delta.content;
                    if (!content) continue;
                    if (onReasoning) onReasoning(content, 'content');
                    buffer += content;

                    let braceDepth = 0, inString = false, esc = false, objStart = -1, found = 0;
                    for (let i = 0; i < buffer.length; i++) {
                        const ch = buffer[i];
                        if (esc) { esc = false; continue; }
                        if (ch === '\\') { esc = true; continue; }
                        if (ch === '"') { inString = !inString; continue; }
                        if (inString) continue;
                        if ('[ ],\n\r\t'.includes(ch)) continue;
                        if (ch === '{') { if (braceDepth === 0) objStart = i; braceDepth++; }
                        else if (ch === '}') {
                            braceDepth--;
                            if (braceDepth === 0 && objStart >= 0) {
                                try {
                                    const obj = JSON.parse(buffer.slice(objStart, i + 1));
                                    found++;
                                    onToolCall(obj, toolIndex++);
                                } catch (e) {}
                            }
                        }
                    }
                    if (found > 0) {
                        const lb = buffer.lastIndexOf('}');
                        if (lb >= 0) buffer = buffer.slice(lb + 1);
                    }
                } catch (e) {}
            }
        }
        return { toolIndex, usage };
    }

    async generateMultiRound(condition, additionalParams, onReasoning, onToolCall, onProgress, reasoningEffort) {
        const systemPrompt = buildToolSchemaDescription();
        let messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `请根据以下生理病理描述生成12导联心电图，依次输出全部工具调用。\n\n患者描述：${condition}${additionalParams ? `\n补充参数：${additionalParams}` : ''}` },
        ];

        let remaining = null;
        let errors = [];
        let round = 0;
        let analysisRound = false;

        while (round < 5) {
            round++;
            onProgress({ type: 'round', round, messages });

            let totalTools = 0;
            const roundTools = [];
            let totalUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
            try {
                const result = await this.streamCall(messages, onReasoning, (tool, idx) => {
                    totalTools++;
                    roundTools.push(tool);
                    onToolCall(tool, idx, round);
                }, reasoningEffort);
                if (result.usage) {
                    totalUsage.prompt_tokens += result.usage.prompt_tokens || 0;
                    totalUsage.completion_tokens += result.usage.completion_tokens || 0;
                    totalUsage.total_tokens += result.usage.total_tokens || 0;
                }
                onProgress({ type: 'usage', ...totalUsage });
            } catch (err) {
                if (err && err.name === 'AbortError') return { success: false, rounds: round, aborted: true };
                throw err;
            }

            onProgress({ type: 'roundDone', round, count: totalTools });

            const status = onProgress({ type: 'getStatus' });
            if (status && status.complete && !status.analysisFeedback) return { success: true, rounds: round };

            const remainingTasks = status ? status.remaining : [];
            const roundErrors = status ? status.errors : [];
            const analysisFeedback = status ? status.analysisFeedback : null;

            if (remainingTasks.length === 0 && !analysisFeedback) {
                if (roundErrors.length > 0) {
                    messages.push({ role: 'assistant', content: JSON.stringify(roundTools) });
                    messages.push({ role: 'user', content: `以下工具调用失败:\n${roundErrors.join('\n')}\n仅重新生成失败的工具，不要重复已成功的其他工具。` });
                } else {
                    return { success: true, rounds: round };
                }
            } else if (remainingTasks.length === 0 && analysisFeedback) {
                if (analysisRound) {
                    return { success: true, rounds: round };
                }
                analysisRound = true;
                messages.push({ role: 'assistant', content: JSON.stringify(roundTools) });
                messages.push({ role: 'user', content: `所有工具已完成，程序分析结果（仅供AI参考，确信正确可直接无视）：\n\n${analysisFeedback}\n\n如果以上结论与病情相符，空回复确认。仅当波形明显有误时才需修正重绘。` });
            } else {
                const ctx = status?.context;
                const isWritingOnly = remainingTasks.every(t =>
                    t.includes('writeInterpretation') || t.includes('writeLeadDescriptions')
                );
                let contextNote = '';
                if (isWritingOnly && ctx?.params) {
                    const p = ctx.params;
                    const rMap = {
                        'sinus':'窦性心律','sinus_arrhythmia':'窦性心律不齐','atrial_fibrillation':'心房颤动',
                        'atrial_flutter':'心房扑动','ventricular':'室性心动过速','paced':'心室起搏',
                        'complete_heart_block':'III°AVB','ventricular_fibrillation':'心室颤动','torsades':'尖端扭转',
                        'sinus_with_pvc':'窦性+室早','sinus_with_wenckebach':'II°I型AVB','sinus_with_mobitz2':'II°II型AVB',
                    };
                    contextNote = `\n\n心电图上下文：\n患者描述：${condition}\n心律：${rMap[p.rhythmType]||p.rhythmType} | 心率：${p.heartRate}bpm | QRS：${p.qrsDuration}ms | QT：${p.qtInterval}ms | 电轴：${p.qrsAxis}°\n已绘制：${ctx.leadsDone?.join(',')||'全部12导联'}\n标题：${ctx.headerInfo||'无'}\n\n请根据以上参数和已绘制的波形数据，为这幅心电图撰写临床解读和导联描述。`;
                }
                if (totalTools === 0) {
                    if (analysisRound && status && status.complete) {
                        return { success: true, rounds: round };
                    }
                    messages.push({ role: 'user', content: `上一轮你没有任何工具调用。你必须直接输出 JSON 工具调用对象，不要输出解释文字。立即开始：\n\n1. initRender\n2. drawLeadCurve x12\n3. drawRhythmStrip\n4. writeInterpretation\n5. writeLeadDescriptions\n\n以 { 开头直接输出。` });
                } else {
                    messages.push({ role: 'assistant', content: JSON.stringify(roundTools) });
                    const alreadyDone = remainingTasks.length > 0
                        ? `\n\n重要：已完成的任务（initRender、已绘制的导联）无需重复。只输出上方 ☐ 标记的缺失项，不要重新生成整个心电图。`
                        : '';
                    messages.push({ role: 'user', content: `任务未完，仅输出缺失项：\n${remainingTasks.map(t => '□ ' + t).join('\n')}${contextNote}${alreadyDone}\n${
                        roundErrors.length ? '\n错误:\n' + roundErrors.join('\n') + '\n仅重新生成失败的工具。' : ''
                    }` });
                }
            }
        }
        return { success: false, rounds: round, error: '达到最大重试次数' };
    }
}

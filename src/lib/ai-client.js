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

    async streamCall(messages, onReasoning, onToolCall) {
        if (!this.endpoint || !this.token) throw new Error('请先配置API Endpoint和Token');

        const resp = await fetch(this.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
            body: JSON.stringify({ model: this.model, messages, max_tokens: this.maxTokens, temperature: this.temperature, stream: true }),
        });
        if (!resp.ok) {
            const e = await resp.json().catch(() => ({}));
            throw new Error(`API错误: ${e.error?.message || `HTTP ${resp.status}`}`);
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let toolIndex = 0;

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
        return toolIndex;
    }

    async generateMultiRound(condition, additionalParams, onReasoning, onToolCall, onProgress) {
        const systemPrompt = buildToolSchemaDescription();
        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `请根据以下生理病理描述生成心电图。\n\n患者描述：${condition}${additionalParams ? `\n补充参数：${additionalParams}` : ''}\n\n使用工具调用完成任务清单` },
        ];

        let remaining = null;
        let errors = [];
        let round = 0;

        while (round < 5) {
            round++;
            onProgress({ type: 'round', round, messages });

            let totalTools = 0;
            const roundTools = [];
            await this.streamCall(messages, onReasoning, (tool, idx) => {
                totalTools++;
                roundTools.push(tool);
                onToolCall(tool, idx, round);
            });

            onProgress({ type: 'roundDone', round, count: totalTools });

            const status = onProgress({ type: 'getStatus' });
            if (status && status.complete) return { success: true, rounds: round };

            const remainingTasks = status ? status.remaining : [];
            const roundErrors = status ? status.errors : [];

            if (remainingTasks.length === 0) {
                if (roundErrors.length > 0) {
                    messages.push({ role: 'assistant', content: JSON.stringify(roundTools) });
                    messages.push({ role: 'user', content: `以下工具调用失败:\n${roundErrors.join('\n')}\n请重新生成正确的内容。` });
                } else {
                    return { success: true, rounds: round };
                }
            } else {
                messages.push({ role: 'assistant', content: JSON.stringify(roundTools) });
                messages.push({
                    role: 'user',
                    content: `任务清单中以下项目尚未完成:\n${remainingTasks.map(t => '□ ' + t).join('\n')}\n${
                        roundErrors.length ? '\n错误:\n' + roundErrors.join('\n') : ''
                    }\n请继续完成剩余任务。`,
                });
            }
        }
        return { success: false, rounds: round, error: '达到最大重试次数' };
    }
}

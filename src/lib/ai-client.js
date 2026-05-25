import OpenAI from 'openai';
import { buildECGSystemPrompt, buildOpenAITools } from './ecg-constraints';

function normalizeToolCall(tc) {
    const args = tc.function.parsed_arguments || {};
    const out = { tool: tc.function.name, _toolCallId: tc.id };
    for (const [k, v] of Object.entries(args)) {
        out[k] = v;
    }
    return out;
}

export class AIClient {
    constructor() {
        this.endpoint = '';
        this.token = '';
        this.model = 'gpt-4o';
        this.temperature = 0.3;
        this.maxTokens = 32768;
        this.client = null;
        this._abortController = null;
    }

    configure(endpoint, token, model, temperature = 0.3) {
        this.endpoint = endpoint.trim();
        this.token = token.trim();
        this.model = model.trim();
        this.temperature = temperature;
        this.client = new OpenAI({
            apiKey: this.token,
            baseURL: this.endpoint || undefined,
            dangerouslyAllowBrowser: true,
        });
    }

    async testConnection() {
        if (!this.client) throw new Error('请先配置API Endpoint和Token');
        try {
            const resp = await this.client.chat.completions.create({
                model: this.model,
                messages: [{ role: 'user', content: 'ping' }],
                max_tokens: 10,
                temperature: 0,
            });
            return { success: true, model: resp.model || this.model };
        } catch (err) {
            throw new Error(`连接失败: ${err.message}`);
        }
    }

    abort() {
        if (this._abortController) {
            this._abortController.abort();
            this._abortController = null;
        }
    }

    async streamCall(messages, onReasoning, onChunk, opts = {}) {
        if (!this.client) throw new Error('请先配置API Endpoint和Token');

        const body = {
            model: this.model,
            messages,
            max_tokens: this.maxTokens,
            temperature: this.temperature,
            stream: true,
        };
        if (opts.reasoningEffort) body.reasoning_effort = opts.reasoningEffort;
        if (opts.tools) body.tools = opts.tools;

        this._abortController = new AbortController();
        body.signal = this._abortController.signal;

        const stream = await this.client.chat.completions.create(body);

        let fullContent = '';
        let fullReasoning = '';
        const toolCallsAcc = [];
        let usage = null;

        for await (const chunk of stream) {
            if (chunk.usage) usage = chunk.usage;

            const delta = chunk.choices?.[0]?.delta;
            if (!delta) continue;

            if (delta.reasoning_content) {
                fullReasoning += delta.reasoning_content;
                if (onReasoning) onReasoning(delta.reasoning_content, 'reasoning');
            }

            if (delta.content) {
                if (onReasoning) onReasoning(delta.content, 'content');
                fullContent += delta.content;
                if (onChunk) onChunk(delta.content);
            }

            if (delta.tool_calls) {
                for (const tcDelta of delta.tool_calls) {
                    const idx = tcDelta.index;
                    if (!toolCallsAcc[idx]) {
                        toolCallsAcc[idx] = { id: '', type: 'function', function: { name: '', arguments: '' } };
                    }
                    const acc = toolCallsAcc[idx];
                    if (tcDelta.id) acc.id = tcDelta.id;
                    if (tcDelta.type) acc.type = tcDelta.type;
                    if (tcDelta.function?.name) acc.function.name = tcDelta.function.name;
                    if (tcDelta.function?.arguments) acc.function.arguments += tcDelta.function.arguments;
                }
            }
        }

        if (toolCallsAcc.length > 0) {
            for (const tc of toolCallsAcc) {
                try {
                    tc.function.parsed_arguments = JSON.parse(tc.function.arguments);
                } catch (e) {
                    tc.function.parsed_arguments = {};
                }
            }
        }

        const usageOut = usage ? {
            prompt_tokens: usage.prompt_tokens || 0,
            completion_tokens: usage.completion_tokens || 0,
            total_tokens: usage.total_tokens || 0,
        } : null;

        return {
            content: fullContent.trim(),
            reasoning: fullReasoning.trim() || null,
            toolCalls: toolCallsAcc.length > 0 ? toolCallsAcc : null,
            usage: usageOut,
        };
    }

    async agentLoop(condition, additionalParams, onReasoning, executeTool, onProgress, reasoningEffort) {
        if (!this.client) throw new Error('请先配置API Endpoint和Token');

        const systemPrompt = buildECGSystemPrompt();
        const tools = buildOpenAITools();

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `请根据以下生理病理描述生成12导联心电图。\n\n患者描述：${condition}${additionalParams ? `\n补充参数：${additionalParams}` : ''}` },
        ];

        let iteration = 0;
        const maxIterations = 80;
        let correctionRounds = 0;
        const maxCorrections = 2;

        while (iteration < maxIterations) {
            iteration++;
            onProgress({ type: 'iteration', iteration });

            let result;
            try {
                result = await this.streamCall(messages, onReasoning, null, {
                    reasoningEffort: reasoningEffort || undefined,
                    tools,
                });
            } catch (err) {
                if (err && err.name === 'AbortError') return { success: false, iterations: iteration, aborted: true };
                throw err;
            }

            if (result.usage) {
                onProgress({
                    type: 'usage',
                    prompt_tokens: result.usage.prompt_tokens,
                    completion_tokens: result.usage.completion_tokens,
                    total_tokens: result.usage.total_tokens,
                });
            }

            if (result.toolCalls && result.toolCalls.length > 0) {
                const assistantMsg = {
                    role: 'assistant',
                    content: result.content || null,
                    tool_calls: result.toolCalls.map(tc => ({
                        id: tc.id,
                        type: tc.type,
                        function: {
                            name: tc.function.name,
                            arguments: tc.function.arguments,
                        },
                    })),
                };
                if (result.reasoning) assistantMsg.reasoning_content = result.reasoning;
                messages.push(assistantMsg);

                let totalTools = 0;
                for (const tc of result.toolCalls) {
                    const normalized = normalizeToolCall(tc);
                    totalTools++;
                    onProgress({ type: 'toolStart', toolCall: normalized, iteration });
                    const execResult = await executeTool(normalized);
                    onProgress({ type: 'toolEnd', toolCall: normalized, result: execResult, iteration });
                    messages.push({
                        role: 'tool',
                        tool_call_id: tc.id,
                        name: tc.function.name,
                        content: JSON.stringify(execResult),
                    });
                }

                onProgress({ type: 'iterationDone', iteration, toolCount: totalTools });

                const status = onProgress({ type: 'getStatus' });
                if (status && !status.complete) continue;

                if (status?.analysisFeedback && correctionRounds < maxCorrections) {
                    correctionRounds++;
                    messages.push({
                        role: 'user',
                        content: `所有工具已完成，程序自动分析结果如下（仅供参考，纯属自动化检测，无法替代临床判断）：\n\n${status.analysisFeedback}\n\n程序分析可能将你刻意绘制的病理性改变误报为"异常"。如果你确信这些波形正确反映了病情，无需操作，直接停止。仅当你认为波形确实画错了（与病情不符）时才修正：直接使用 drawLeadCurve 或 drawLeadCurveCSV 重绘对应导联（画布已就绪，无需 initRender）。`,
                    });
                    continue;
                }

                if (status?.analysisFeedback) {
                    return { success: true, iterations: iteration };
                }

                if (status?.complete) {
                    return { success: true, iterations: iteration };
                }

                continue;
            }

            const status = onProgress({ type: 'getStatus' });

            if (status?.analysisFeedback && correctionRounds < maxCorrections && status.complete) {
                correctionRounds++;
                if (result.content || result.reasoning) {
                    const am = { role: 'assistant', content: result.content || null };
                    if (result.reasoning) am.reasoning_content = result.reasoning;
                    messages.push(am);
                }
                messages.push({
                    role: 'user',
                    content: `程序自动分析结果如下（仅供参考）：\n\n${status.analysisFeedback}\n\n如果你确信波形正确反映了病情，无需操作。仅当你认为波形需要修正时才调用工具重绘。`,
                });
                continue;
            }

            if (status?.complete || status?.analysisFeedback) {
                return { success: true, iterations: iteration };
            }

            const remaining = status?.remaining || [];
            if (remaining.length > 0) {
                if (result.content || result.reasoning) {
                    const am = { role: 'assistant', content: result.content || null };
                    if (result.reasoning) am.reasoning_content = result.reasoning;
                    messages.push(am);
                }
                messages.push({
                    role: 'user',
                    content: `任务未完成，请继续。缺失项：\n${remaining.map(t => '□ ' + t).join('\n')}`,
                });
                continue;
            }

            return { success: true, iterations: iteration };
        }

        return { success: false, iterations: iteration, error: '达到最大迭代次数' };
    }
}

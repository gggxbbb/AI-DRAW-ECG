import { validateToolCall } from './ecg-constraints';

export class ToolExecutor {
    constructor(renderer) {
        this.renderer = renderer;
        this.storedParams = {};
        this.leadCount = 0;
        this.leadNames = [];
    }

    executeSingle(toolCall, onLeadRendered) {
        const errors = validateToolCall(toolCall);
        if (errors.length > 0) {
            return { success: false, errors };
        }

        switch (toolCall.tool) {
            case 'initRender': {
                this.storedParams = {
                    heartRate: toolCall.params?.heartRate || 72,
                    qrsDuration: toolCall.params?.qrsDuration || 90,
                    qtInterval: toolCall.params?.qtInterval || 390,
                    qrsAxis: toolCall.params?.qrsAxis ?? 30,
                    rhythmType: toolCall.rhythmType || 'sinus',
                };
                this.leadCount = 0;
                this.leadNames = [];
                this.aiInterpretation = null;
                this.aiLeadDescriptions = null;
                this.renderer.setPaperSpeed(toolCall.paperSpeed || 25);
                this.renderer.setGain(toolCall.gain || 10);
                this.renderer.renderInit(this.storedParams);
                return { success: true, action: 'init' };
            }
            case 'drawLeadCurve': {
                if (!this.storedParams || Object.keys(this.storedParams).length === 0) {
                    return { success: false, errors: ['必须先调用 initRender'] };
                }
                const points = toolCall.points;
                const valid = this._validateDrawnCurve(toolCall.lead, points);
                if (!valid.ok) {
                    return { success: false, errors: [`${toolCall.lead} 导联验证失败: ${valid.reason}，请重新生成`] };
                }
                this.renderer.renderLeadCurve(toolCall.lead, points, this.storedParams);
                this.leadCount++;
                this.leadNames.push(toolCall.lead);
                if (onLeadRendered) onLeadRendered(toolCall.lead, this.leadCount);
                return { success: true, action: 'drawLeadCurve', lead: toolCall.lead, count: this.leadCount };
            }
            case 'drawRhythmStrip': {
                if (this.leadCount < 12) {
                    return { success: false, errors: [`只绘制了 ${this.leadCount}/12 个导联`] };
                }
                const lead = toolCall.lead || 'II';
                this.renderer.renderRhythmCurve(lead, this.storedParams);
                return { success: true, action: 'drawRhythmStrip' };
            }
            case 'writeInterpretation': {
                if (this.leadCount < 12) {
                    return { success: false, errors: ['必须先完成12导联绘制'] };
                }
                this.aiInterpretation = toolCall.text;
                return { success: true, action: 'writeInterpretation' };
            }
            case 'writeLeadDescriptions': {
                if (!this.aiInterpretation) {
                    return { success: false, errors: ['必须先调用 writeInterpretation'] };
                }
                this.aiLeadDescriptions = toolCall.descriptions;
                return { success: true, action: 'writeLeadDescriptions', complete: true };
            }
        }
        return { success: false, errors: [`未知工具: ${toolCall.tool}`] };
    }

    _validateDrawnCurve(lead, points) {
        if (!points || points.length < 6) {
            return { ok: false, reason: '数据点不足' };
        }
        let maxAbs = 0;
        let hasPositive = false;
        let hasNegative = false;
        for (const pt of points) {
            const mv = pt[1];
            maxAbs = Math.max(maxAbs, Math.abs(mv));
            if (mv > 0.02) hasPositive = true;
            if (mv < -0.02) hasNegative = true;
        }
        if (maxAbs < 0.03) return { ok: false, reason: '振幅过小，可能为直线' };
        if (!hasPositive && !hasNegative) return { ok: false, reason: '波形无正负变化' };
        const timeSpan = points[points.length - 1][0] - points[0][0];
        if (timeSpan < 0.3) return { ok: false, reason: '时间跨度不足' };
        return { ok: true };
    }

    execute(toolCalls) {
        const results = [];
        const errors = [];
        if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
            return { success: false, errors: ['toolCalls 必须是非空数组'] };
        }
        for (let i = 0; i < toolCalls.length; i++) {
            const result = this.executeSingle(toolCalls[i]);
            results.push(result);
            if (!result.success) errors.push(`[#${i}] ${result.errors.join('; ')}`);
            if (result.complete) break;
        }
        return errors.length > 0
            ? { success: false, errors, results }
            : { success: true, results, params: this.storedParams };
    }
}

export function parseToolCallsFromAIResponse(content) {
    let text = content.trim();
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) text = codeBlockMatch[1];
    const arrayMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (arrayMatch) text = arrayMatch[0];
    try {
        const calls = JSON.parse(text);
        if (!Array.isArray(calls)) throw new Error('AI响应不是数组格式');
        return calls;
    } catch (e) {
        throw new Error(`无法解析AI工具调用: ${e.message}`);
    }
}

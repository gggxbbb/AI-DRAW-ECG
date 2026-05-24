import { validateToolCall } from './ecg-constraints';

export class ToolExecutor {
    constructor(renderer) {
        this.renderer = renderer;
        this.storedParams = {};
        this.leadCount = 0;
        this.leadNames = [];
        this.initDone = false;
        this.rhythmDone = false;
        this.interpDone = false;
        this.descriptionsDone = false;
        this.aiInterpretation = null;
        this.aiLeadDescriptions = null;
    }

    getRemainingTasks() {
        const tasks = [];
        if (!this.initDone) tasks.push('调用 initRender 初始化画布');
        const allLeads = ['I','II','III','aVR','aVL','aVF','V1','V2','V3','V4','V5','V6'];
        const missing = allLeads.filter(l => !this.leadNames.includes(l));
        if (missing.length) tasks.push(`drawLeadCurve 缺少导联: ${missing.join(',')}`);
        if (!this.rhythmDone) tasks.push('调用 drawRhythmStrip 绘制节律条');
        if (!this.interpDone) tasks.push('调用 writeInterpretation 书写AI解读');
        if (!this.descriptionsDone) tasks.push('调用 writeLeadDescriptions 书写导联描述');
        return tasks;
    }

    get isComplete() {
        return this.leadCount >= 12 && this.initDone && this.rhythmDone && this.interpDone && this.descriptionsDone;
    }

    executeSingle(toolCall, onLeadRendered) {
        const errors = validateToolCall(toolCall);
        if (errors.length > 0) return { success: false, errors };

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
                this.initDone = true;
                this.rhythmDone = false;
                this.interpDone = false;
                this.descriptionsDone = false;
                this.renderer.setPaperSpeed(toolCall.paperSpeed || 25);
                this.renderer.setGain(toolCall.gain || 10);
                this.renderer.renderInit(this.storedParams);
                return { success: true, action: 'init' };
            }
            case 'drawLeadCurve': {
                if (!this.initDone) return { success: false, errors: ['请先调用 initRender'] };
                if (this.leadNames.includes(toolCall.lead)) return { success: false, errors: [`${toolCall.lead} 导联已绘制`] };
                const points = toolCall.points;
                const valid = this._validateCurve(toolCall.lead, points);
                if (!valid.ok) return { success: false, errors: [`${toolCall.lead} 导联验证失败: ${valid.reason}`] };
                this.renderer.renderLeadCurve(toolCall.lead, points, this.storedParams);
                this.leadCount++;
                this.leadNames.push(toolCall.lead);
                if (onLeadRendered) onLeadRendered(toolCall.lead, this.leadCount);
                return { success: true, action: 'drawLeadCurve', lead: toolCall.lead, count: this.leadCount };
            }
            case 'drawRhythmStrip': {
                if (this.leadCount < 12) return { success: false, errors: [`只完成 ${this.leadCount}/12 个导联`] };
                this.renderer.renderRhythmCurve(toolCall.lead || 'II', this.storedParams);
                this.rhythmDone = true;
                return { success: true, action: 'drawRhythmStrip' };
            }
            case 'writeInterpretation': {
                if (this.leadCount < 12) return { success: false, errors: ['请先完成12导联绘制'] };
                this.aiInterpretation = toolCall.text;
                this.interpDone = true;
                return { success: true, action: 'writeInterpretation' };
            }
            case 'writeLeadDescriptions': {
                if (!this.interpDone) return { success: false, errors: ['请先完成 writeInterpretation'] };
                this.aiLeadDescriptions = toolCall.descriptions;
                this.descriptionsDone = true;
                return { success: true, action: 'writeLeadDescriptions', complete: true };
            }
        }
        return { success: false, errors: [`未知工具: ${toolCall.tool}`] };
    }

    _validateCurve(lead, points) {
        if (!points || points.length < 6) return { ok: false, reason: '数据点不足(需>=6)' };
        let maxAbs = 0, hasPos = false, hasNeg = false;
        for (const pt of points) {
            const mv = pt[1];
            maxAbs = Math.max(maxAbs, Math.abs(mv));
            if (mv > 0.02) hasPos = true;
            if (mv < -0.02) hasNeg = true;
        }
        if (maxAbs < 0.03) return { ok: false, reason: '振幅过小' };
        if (!hasPos && !hasNeg) return { ok: false, reason: '波形无正负变化' };
        if (points[points.length - 1][0] - points[0][0] < 0.3) return { ok: false, reason: '时间跨度不足' };
        return { ok: true };
    }
}

export function parseToolCallsFromAIResponse(content) {
    let text = content.trim();
    const m = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (m) text = m[1];
    const a = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (a) text = a[0];
    try { const c = JSON.parse(text); if (!Array.isArray(c)) throw new Error('非数组'); return c; }
    catch (e) { throw new Error(`解析失败: ${e.message}`); }
}

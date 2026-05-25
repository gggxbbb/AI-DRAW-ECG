import { validateToolCall } from './ecg-constraints';
import { pyodideRuntime } from './pyodide-runtime';

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
        this.headerInfo = null;
        this.programmaticAnalysis = null;
        this.rhythmConsistency = null;
        this.lastPythonOutput = null;
    }

    getRemainingTasks() {
        const tasks = [];
        if (!this.initDone) tasks.push('调用 initRender 初始化画布');
        const allLeads = ['I','II','III','aVR','aVL','aVF','V1','V2','V3','V4','V5','V6'];
        const missing = allLeads.filter(l => !this.leadNames.includes(l));
        if (missing.length) tasks.push(`drawLeadCurve 缺少导联: ${missing.join(',')}`);
        if (!this.rhythmDone) tasks.push('调用 drawRhythmStrip 或 drawRhythmStripCSV 绘制节律条');
        if (!this.interpDone) tasks.push('调用 writeInterpretation 书写AI解读');
        if (!this.descriptionsDone) tasks.push('调用 writeLeadDescriptions 书写导联描述');
        return tasks;
    }

    get isComplete() {
        return this.leadCount >= 12 && this.initDone && this.rhythmDone && this.interpDone && this.descriptionsDone;
    }

    async executeSingle(toolCall, onLeadRendered) {
        const errors = validateToolCall(toolCall);
        if (errors.length > 0) return { success: false, errors };

        switch (toolCall.tool) {
            case 'initRender': {
                if (this.initDone) this.redrawRound = true;
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
                this.renderer._headerText = null;
        this.programmaticAnalysis = null;
        this.rhythmConsistency = null;
        this.headerInfo = null;
        this.redrawRound = false;
                this.renderer.renderInit(this.storedParams);
                return { success: true, action: 'init' };
            }
            case 'drawLeadCurve': {
                if (!this.initDone) return { success: false, errors: ['请先调用 initRender'] };
                const hasBeats = toolCall.beats && toolCall.beats.length > 0;
                const hasPoints = toolCall.points && toolCall.points.length > 0;
                if (!hasBeats && !hasPoints) return { success: false, errors: ['必须提供 points 或 beats'] };
                let valid = { ok: true, reason: '' };
                if (hasBeats) {
                    for (const beat of toolCall.beats) {
                        valid = this._validateCurve(toolCall.lead, beat.points);
                        if (!valid.ok) break;
                    }
                } else {
                    valid = this._validateCurve(toolCall.lead, toolCall.points);
                }
                if (!valid.ok) {
                    if (toolCall.insist) {
                        this.renderer.renderLeadCurve(toolCall.lead, toolCall, this.storedParams);
                        if (!this.leadNames.includes(toolCall.lead)) {
                            this.leadCount++;
                            this.leadNames.push(toolCall.lead);
                        }
                        if (onLeadRendered) onLeadRendered(toolCall.lead, this.leadCount);
                        return { success: true, action: 'drawLeadCurve', lead: toolCall.lead, count: this.leadCount, warned: true, warning: valid.reason };
                    }
                    return { success: false, errors: [`${toolCall.lead} 导联验证失败: ${valid.reason}（可添加 "insist": true 强制执行）`] };
                }
                const isRedraw = this.leadNames.includes(toolCall.lead);
                this.renderer.renderLeadCurve(toolCall.lead, toolCall, this.storedParams);
                if (!isRedraw) {
                    this.leadCount++;
                    this.leadNames.push(toolCall.lead);
                }
                if (onLeadRendered) onLeadRendered(toolCall.lead, this.leadCount);
                return { success: true, action: 'drawLeadCurve', lead: toolCall.lead, count: this.leadCount, redraw: isRedraw };
            }
            case 'drawRhythmStrip': {
                if (this.leadCount < 12) return { success: false, errors: [`只完成 ${this.leadCount}/12 个导联`] };
                this.renderer.renderRhythmCurve(toolCall.lead || 'II', this.storedParams);
                this.rhythmDone = true;
                return { success: true, action: 'drawRhythmStrip' };
            }
            case 'drawRhythmStripCSV': {
                if (this.leadCount < 12) return { success: false, errors: [`只完成 ${this.leadCount}/12 个导联`] };
                const parsed = this._parseCSVPoints(toolCall.csv);
                if (!parsed.ok) return { success: false, errors: [`节律带CSV解析失败: ${parsed.reason}`] };
                this.renderer.renderRhythmCurveCSV(parsed.points, this.storedParams);
                this.rhythmDone = true;
                return { success: true, action: 'drawRhythmStripCSV' };
            }
            case 'drawLeadCurveCSV': {
                if (!this.initDone) return { success: false, errors: ['请先调用 initRender'] };
                const parsed = this._parseCSVPoints(toolCall.csv);
                if (!parsed.ok) return { success: false, errors: [`${toolCall.lead} CSV解析失败: ${parsed.reason}`] };
                const isRedraw = this.leadNames.includes(toolCall.lead);
                this.renderer.renderLeadCurveCSV(toolCall.lead, parsed.points, this.storedParams);
                if (!isRedraw) {
                    this.leadCount++;
                    this.leadNames.push(toolCall.lead);
                }
                if (onLeadRendered) onLeadRendered(toolCall.lead, this.leadCount);
                return { success: true, action: 'drawLeadCurveCSV', lead: toolCall.lead, count: this.leadCount, redraw: isRedraw };
            }
            case 'drawAllLeadsCSV': {
                if (!this.initDone) return { success: false, errors: ['请先调用 initRender'] };
                let leadsObj = toolCall.leads;
                if (!leadsObj || typeof leadsObj !== 'object') {
                    const directLeads = {};
                    for (const l of ['I','II','III','aVR','aVL','aVF','V1','V2','V3','V4','V5','V6']) {
                        if (typeof toolCall[l] === 'string' && toolCall[l].trim().length >= 10) {
                            directLeads[l] = toolCall[l];
                        }
                    }
                    if (Object.keys(directLeads).length >= 11) {
                        leadsObj = directLeads;
                    } else {
                        return { success: false, errors: ['leads 必须是对象（{ "I":"csv...", "II":"csv...", ... }），不是数组，不是顶层单独字段'] };
                    }
                }
                const errors = [];
                const parsedLeads = [];
                for (const [lead, csv] of Object.entries(leadsObj)) {
                    const parsed = this._parseCSVPoints(csv);
                    if (!parsed.ok) {
                        errors.push(`${lead}: CSV解析失败 - ${parsed.reason}`);
                        continue;
                    }
                    parsedLeads.push({ lead, points: parsed.points });
                }
                if (errors.length > 0) return { success: false, errors };
                for (const { lead, points } of parsedLeads) {
                    this.renderer.renderLeadCurveCSV(lead, points, this.storedParams);
                    if (!this.leadNames.includes(lead)) {
                        this.leadCount++;
                        this.leadNames.push(lead);
                    }
                    if (onLeadRendered) onLeadRendered(lead, this.leadCount);
                }
                return { success: true, action: 'drawAllLeadsCSV', count: this.leadCount, leads: [...this.leadNames] };
            }
            case 'writeHeaderInfo': {
                this.headerInfo = toolCall.text;
                if (this.renderer._layout) {
                    this.renderer.drawHeaderText(toolCall.text);
                }
                return { success: true, action: 'writeHeaderInfo' };
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
            case 'runPythonCode': {
                pyodideRuntime.setContext(this, this.renderer);
                const result = await pyodideRuntime.run(toolCall.code);
                this.lastPythonOutput = result;
                return { success: true, action: 'runPythonCode', result };
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

    _parseCSVPoints(csv) {
        const lines = csv.trim().split(/\r?\n/);
        if (lines.length < 4) return { ok: false, reason: '数据行不足(需>=4)' };
        const points = [];
        for (const line of lines) {
            const parts = line.trim().split(',');
            if (parts.length < 2) continue;
            const t = parseFloat(parts[0]);
            const mv = parseFloat(parts[1]);
            if (isNaN(t) || isNaN(mv)) continue;
            points.push([t, mv]);
        }
        if (points.length < 4) return { ok: false, reason: '有效数据点不足(需>=4)' };
        const timeSpan = points[points.length - 1][0] - points[0][0];
        if (timeSpan < 0.1) return { ok: false, reason: '时间跨度不足' };
        return { ok: true, points };
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

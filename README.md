# AI ECG Generator

基于 AI（LLM）的 12 导联智能心电图生成系统。用户输入生理病理描述，AI 通过工具调用生成标准 12 导联心电图报告，支持流式逐导联实时绘制。

## 预览

- 左侧：AI 配置、生理病理描述输入、显示选项、程序分析 + AI 解读 + 导联描述
- 右侧：统一底纹格子纸，实时流式绘制 12 导联 + 节律条

## 技术栈

| 层 | 技术 |
|---|------|
| 前端框架 | React 18 + Vite 4 |
| 渲染引擎 | Canvas 2D API + Catmull-Rom 样条平滑 |
| AI 通信 | OpenAI 兼容 API（SSE 流式传输） |
| 状态管理 | React Context + useReducer |

## 快速开始

```bash
npm install
npm run dev
```

浏览器打开 `http://localhost:3000`。

## 使用方式

1. 展开 **AI 配置**，填入 API Endpoint、Token、Model
2. 在 **生理病理描述** 中输入疾病名称或临床表现
3. 点击 **生成心电图**

AI 通过 5 类工具调用完成绘制：

| 工具 | 说明 |
|------|------|
| `initRender` | 初始化画布、设置心率、节律、电轴 |
| `drawLeadCurve` ×12 | 用数据点绘制每个导联波形（Catmull-Rom 平滑） |
| `drawRhythmStrip` | 绘制底部 10 秒节律条 |
| `writeInterpretation` | AI 书写临床解读 |
| `writeLeadDescriptions` | 为 12 导联各写一句描述 |

## 约束与校验

AI 返回的每导联数据点经过多层校验：

- 振幅范围 –5 ~ +5 mV
- 至少 6 个数据点，时间跨度 ≥ 0.4s
- 必须有正负极性变化（排除直线）
- 相邻点间距递增检查

校验失败时自动将错误反馈给 AI 进行重试，最多 5 轮。

## 程序化分析

非 AI 的分析器 (`ecg-analyzer.js`) 逐导联分析实际波形数据：

- ST 段抬高/压低定位（下壁/前壁/侧壁 + 对应性改变）
- T 波倒置检测
- 病理性 Q 波识别
- 心率、QRS 时限、QT/QTc、电轴测量
- 四级结论：正常 / 大致正常 / 异常 / 危急

## 支持的 API

任何 OpenAI 兼容接口均可使用，包括：

- OpenAI (GPT-4o / GPT-4)
- DeepSeek (V3 / R1 / V4)
- Anthropic Claude (via API)
- 本地模型（Ollama / vLLM / LM Studio）

推荐使用 DeepSeek V4 以获得最佳中文心电学推理效果。

## 部署

在线访问：**[ecg.gxb.pub](https://ecg.gxb.pub)**

部署于 [Cloudflare Pages](https://pages.cloudflare.com)，通过 Git 连接自动构建：

| 配置项 | 值 |
|--------|-----|
| 构建命令 | `npm run build` |
| 输出目录 | `dist` |
| 框架预设 | Vite |

```bash
# 手动部署
npm run build
npx wrangler pages deploy dist --project-name=ecg
```

## 项目结构

```
src/
  main.jsx                    # 入口
  App.jsx                     # 根组件
  index.css                   # 样式
  lib/
    ecg-renderer.js           # Canvas 渲染引擎
    ecg-constants.js          # 医学正常值、导联定义
    ecg-constraints.js        # 工具定义、校验规则、AI prompt
    ecg-analyzer.js           # 程序化心电图分析器
    ai-client.js              # API 通信、SSE 流式解析、多轮重试
    tool-executor.js          # 工具执行器、状态追踪
    ECGContext.jsx            # React 状态管理
  components/
    ECGDisplay.jsx            # Canvas 画布 + 工具栏
    AIConfigSection.jsx       # AI 配置面板
    ConditionInput.jsx        # 输入框 + 生成按钮
    DisplayOptionsSection.jsx # 走纸速度、增益、网格
    InterpretationSection.jsx # 程序分析 + AI 解读 + 导联描述
    RawOutput.jsx             # AI 推理过程实时展示
    Toast.jsx                 # 通知组件
```

## License

MIT

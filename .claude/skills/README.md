# AI 短剧 / 漫剧创作 Skill 套件（drama-skills）

一套面向编剧、漫剧工作室和编导的 AI 短剧/漫剧创作工作流，共 **8 个 skill**，
把一个点子或一部长篇材料，一路做成 **分集剧本 → 资产设定 → 图片提示词 →
分镜关键帧 → 视频提示词 → 独立审查**，全程用同一套创作者决策、来源引用与
连续性契约衔接。

- **产出是文本**：剧本、设定、提示词、审查记录。
- **刻意不含生图/生视频**：不调用任何图片、视频或音频生成接口，无需 API key，
  提示词先落进文件、由人确认后再送去生成，避免预算浪费。
- 已随本仓库安装到 `.claude/skills/` 下，在 **Claude Code 打开本仓库即可直接调用**。

来源：<https://github.com/worldwonderer/drama-skills>（MIT，见 `LICENSE`），
安装于 2026-08-02，suite 版本 0.2.0。环境需 **Python 3.10+**（本环境为 3.11 ✓）。

## 八个技能

| 技能 | 职责 |
|---|---|
| `short-drama` | 入口路由：初始化、继续、状态、异常恢复、接受/审查生命周期与交付 |
| `short-drama-develop` | 小说/长材料的可追溯改编、故事引擎、分集地图、导演阐述、题材与钩子手册 |
| `short-drama-write` | 单集目标、因果节拍、可拍剧本与规范化 |
| `short-drama-assets` | 人物/造型、地点/视图、道具/状态与连续性决策 |
| `short-drama-image-prompts` | 角色、场景、道具参考板提示词与定点修改说明 |
| `short-drama-storyboard` | 原文落实、镜头目的、场面调度、连续性边界与冻结关键帧 |
| `short-drama-video-prompts` | 单镜头内的动作、表演、摄影、声音、起止状态与补拍说明 |
| `short-drama-review` | 结构校验、带证据的内容审查、制作质量检查与独立审查结论 |

## 快速开始（在 Claude Code 里直接说）

```
# 1. 新建项目
用 short-drama 初始化一个都市打脸题材的短剧项目，竖屏 9:16

# 2. 写第一集
用 short-drama-write 写第 1 集：外卖员在高档餐厅被经理羞辱，亮出集团董事身份

# 3. 拆资产、写提示词与分镜
用 short-drama-assets 从第 1 集拆人物/场景/道具
用 short-drama-image-prompts 为已接受的资产写参考图提示词
用 short-drama-storyboard 给第 1 集做分镜
用 short-drama-video-prompts 把分镜逐镜翻译成视频提示词

# 4. 独立审查
用 short-drama-review 审查第 1 集的剧本与提示词
```

也可以不写前缀，直接用自然语言描述要做什么，agent 会自动路由到对应 skill。

## 校验完整性

```bash
python3 .claude/skills/short-drama/scripts/suite_verify.py .claude/skills/short-drama
```

---
name: tracememo-template-contributor
description: 将日报截图、设计稿、HTML/CSS、React/Vue 页面或现有日报项目转换为 TraceMemo 日报模板。用户要求制作、适配、复刻、转换或投稿 TraceMemo 模板，或希望根据截图生成 TraceMemo 模板并预览/提交审核时使用。
---

# TraceMemo Template Contributor

## 目标与边界

你负责把一张日报长图、HTML/CSS 页面、React/Vue 项目、设计稿截图或纯文字风格说明，适配成 TraceMemo 的日报展示模板。截图是完整的一等输入：从视觉层级拆解布局，但不要从截图臆造数据字段或运行时能力。

模板只排版 TraceMemo 已产生的数据，不是插件系统。不要修改 TraceMemo 主程序，也不要新增业务字段、AI prompt、外部 API、JavaScript 业务逻辑、iframe、Node/IPC 或网络依赖。

## 工作流

### Understand → Map

先读取原始输入及其资源，盘点页面骨架（header、统计、话题、重要消息、聊天、待办、问题、footer）、视觉系统、图片、CSS、脚本、数据和外部依赖。输入只有截图或文字时，将无法从证据确定的内容列为假设，不要阻塞在不影响首版版式的细节上。

只有缺失信息会阻止实现，或不同选择会明显改变最终设计时才询问。普通视觉细节和可合理推断的内容使用明确假设完成首版，并在 preview 交付时说明。

再读取仓库当前的 `CONTRIBUTING.md`、相关 validator、build/preview 脚本、fixture、manifest 和相近的正式模板；它们才是 source of truth。把原日报能力分成：可直接映射、可用已有模块近似、当前不支持，并向用户说明视觉或能力取舍。详细判断见 [references/migration-guide.md](references/migration-guide.md)。

### Build → Validate

在 `templates/<id>/<version>/` 生成当前规范要求的 `manifest.json`、`template.html` 和必要的包内 `assets/`。优先保留原设计的布局、色彩、卡片关系、字体层级、信息密度及对应的移动端/桌面端特征，而不是为方便转换改成另一套普通模板。

只使用当前公布的占位符和静态 HTML/CSS。移除不支持能力；对不能一比一迁移的内容，清楚写出差异并采用最接近的展示方案。

验证只使用虚构数据。复用当前仓库的 fixture、validator、打包和预览流程，并检查完整与稀疏数据、长中文/英文/数字、HTML 特殊字符、可选模块隐藏和横向溢出。现有工具若只枚举已有模板，先运行它们作为仓库基线；再对候选模板执行等效的针对性检查和真实渲染，且在结果中明确该覆盖范围，不能把基线通过说成候选模板已通过。

聊天内容必须实际验收，不以 PNG 文件存在为准：在桌面和目标手机宽度检查小尺寸头像、昵称、时间、气泡/正文、长昵称、长消息、多条和多人消息、无头像 fallback、换行、横向溢出，以及图片消息不会被当作头像。完成后实际查看生成的 preview。

### Preview → Iterate

先查找仓库当前是否明确公布了 Template Preview / Submission Service。若有，读取它的当前文档和配置并优先使用；不要在此 Skill 中写死 endpoint 或 schema。

若服务不存在（当前默认），使用本地/GitHub fallback：clone 仓库，构建模板，以虚构 fixture 运行 validator 和 preview，并进行目视检查。展示这张正式 demo 数据的长图给用户。用户不满意时修改并重新预览；如果用户明确要求“先给我预览”或“我满意再提交”，停在此处等待确认。

### Submit → Review

用户明确说“满意”“提交审核”“帮我提 PR”时进入投稿。若用户一开始已明确说“做好后直接提交 PR”或“完成后帮我提 PR”，GitHub 写操作已预授权：仍必须完成 Build → Validate → Preview，并由 AI 实际检查、修复明显问题，但无需在最后重复询问是否创建 PR。先阅读 [references/submission-fallback.md](references/submission-fallback.md)。没有官方服务时，GitHub 是 submission fallback：有源仓库写权限时推送独立分支并向 `main` 提 PR；无写权限但已登录 GitHub 时 fork 后提 PR；没有 GitHub 写能力时仍交付 PR-ready 变更、预览、标题和描述以及最短下一步。

绝不直接或 force push `main`，不自行修改正式 catalog，不覆盖已发布版本，也不上传真实聊天数据、头像、密钥或 AI 工作日志。

## 输出要求

先给用户兼容性结论和仍需确认的事项，再给文件变更和验证证据。交付时写明模板名称、ID、版本、设计来源、输入类型、主要视觉结构、映射/未迁移能力、validator/preview 结果，以及虚构数据和未使用真实聊天数据的声明。

最终自检见 [references/review-checklist.md](references/review-checklist.md)。

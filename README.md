# TraceMemo 日报模板社区

[→ TraceMemo 主项目](https://github.com/Wxw-Gu/TraceMemo)

本仓库提供 TraceMemo 日报模板的可编辑源码、预览图、虚构 fixture、可安装 ZIP 和模板目录。模板只负责把 TraceMemo 已生成的日报数据排版成适合阅读和分享的页面，不新增分析字段，也不修改 AI 提示词。

## 兼容提示

模板功能依赖 TraceMemo 的模板支持（协议 `1.0`、占位符接口 `1`）。在 TraceMemo 正式发布这项能力前，本仓库不宣称兼容任何已发布的 TraceMemo 版本；请以主项目发布说明为准。

## 当前模板

| ID | 版本 | 名称 | 适用场景 |
| --- | --- | --- | --- |
| `community.github.tracememo.quickread` | `1.0.0` | 极简速读 | 手机单栏，先看摘要、结论和行动项 |
| `community.github.tracememo.paperdaily` | `1.0.1` | 纸上日报 | 手机报纸式编辑版，突出标题、话题和引语 |
| `community.github.tracememo.teamboard` | `1.0.0` | 团队看板 | 桌面宽屏多栏看板，适合团队复盘和归档 |

目录中的当前版本提供 `manifest.json`、`template.html` 和预览图。安装包不包含 JavaScript、外链资源或模板目录外的文件；示例文字、昵称和群名均为虚构数据，并会在页面中标明示例用途。

## 🤖 使用 AI 制作 TraceMemo 模板

打开 [TraceMemo Template Contributor](https://github.com/Wxw-Gu/TraceMemo-Templates/tree/main/skills/tracememo-template-contributor) 目录并复制当前 GitHub URL，直接发给能够读取 GitHub 仓库的 Codex、ChatGPT 或其他 AI。AI 会读取其中的 `SKILL.md` 和 references，再读取本仓库当前的贡献规范、模板示例和校验工具，帮助你把日报项目转换成 TraceMemo 模板、生成真实预览，并在你满意后提交审核。

你可以这样告诉 AI：

> 请读取这个 TraceMemo Template Contributor Skill，把我当前项目里的日报转换成 TraceMemo 模板，生成预览；我确认满意后帮我提交审核。

也可以从零开始：

> 请读取这个 Skill，根据我提供的日报截图制作一个极简科技风 TraceMemo 模板，生成真实预览；满意后帮我提交审核。

GitHub Skill 目录是主要分发入口；支持标准 Skill 安装的客户端也可以将该目录作为 Skill 使用。是否能直接读取 GitHub URL 取决于客户端能力，不代表所有客户端都会自动安装。

## 在 TraceMemo 中使用

在 TraceMemo 中依次打开：日报 → 今日日报 → 日报模板 → 模板市场。选择喜欢的模板并安装即可。具体入口名称和可用版本以[主项目](https://github.com/Wxw-Gu/TraceMemo)为准。

## 仓库内容

```text
templates/<id>/<version>/  可编辑 manifest、template.html 和包内预览图
packages/<id>/<version>/   单模板安装 ZIP（不是 GitHub 源码 ZIP）
previews/                  由实际模板渲染生成的 PNG
fixtures/                  虚构日报输入，用于预览和检查
catalog/v1/index.json      正式模板目录
catalog/v1/drafts/         投稿审核用的草稿目录
scripts/                   预览、打包、目录和结构校验工具
```

草稿目录只用于提交前审核，未完成 TraceMemo 实际安装和渲染验收的版本不会进入正式目录。

## 制作和投稿模板

模板作者应为每个版本提供 `manifest.json` 和 `template.html`，只使用 TraceMemo 已公布的 text、html、class 占位符，并遵守安全安装边界。提交前运行结构校验、预览、打包和目录检查，再通过 Pull Request 投稿。完整的 manifest 字段、HTML 限制、fixture 要求和发布流程见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可

模板、fixture 和仓库工具按 [MIT](LICENSE) 许可发布。该许可只覆盖本仓库新增的原创内容，不改变 TraceMemo 或第三方资产的原有许可。

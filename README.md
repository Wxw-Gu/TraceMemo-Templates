# TraceMemo 日报模板社区

[→ TraceMemo 主项目](https://github.com/Wxw-Gu/TraceMemo)

这里是 TraceMemo 的日报模板社区。

你可以直接在 TraceMemo 模板市场中安装现有模板，也可以把自己的日报截图、网页或前端项目交给 AI，让它转换成 TraceMemo 模板并通过 Pull Request 投稿到本仓库。

模板只负责把 TraceMemo 已生成的日报数据排版成适合阅读、归档和分享的页面，不新增分析字段，也不修改 AI 提示词。

---

## 🤖 用 AI 制作并投稿你的模板

你不需要了解 `manifest`、占位符、ZIP、SHA256 或 catalog。

准备好下面任意一种内容即可：

- 一张日报长图
- 一个日报网页
- HTML / CSS 页面
- React / Vue 前端项目
- 一份设计稿截图
- 一个你想实现的日报风格描述

然后把它交给 Codex、ChatGPT 或其他能够读取 GitHub 仓库的 AI。

### 第一步：把 Skill 发给 AI

打开：

[TraceMemo Template Contributor](https://github.com/Wxw-Gu/TraceMemo-Templates/tree/main/skills/tracememo-template-contributor)

复制这个 GitHub 链接，然后连同你的截图、网页或项目一起发送给 AI。

如果你提供的是日报截图，可以直接复制下面这段：

> 读取这个 Skill：  
> https://github.com/Wxw-Gu/TraceMemo-Templates/tree/main/skills/tracememo-template-contributor
>
> 根据我提供的这张日报长图制作一个新的 TraceMemo 日报模板，并生成真实预览给我看。
>
> 我确认满意后，请把模板以 Pull Request 的方式提交到 TraceMemo-Templates，等待审核。

如果你提供的是现有网页或前端项目，可以这样说：

> 读取这个 Skill：  
> https://github.com/Wxw-Gu/TraceMemo-Templates/tree/main/skills/tracememo-template-contributor
>
> 根据我提供的日报项目制作一个新的 TraceMemo 日报模板，尽量保留原来的视觉设计，并生成真实预览给我看。
>
> 我确认满意后，请把模板以 Pull Request 的方式提交到 TraceMemo-Templates，等待审核。

### 第二步：查看真实预览

AI 会读取本仓库当前的：

- TraceMemo 模板规范
- 模板示例
- fixture
- 校验工具
- 预览与打包流程

然后把你的设计映射到 TraceMemo 当前已经支持的日报数据中。

完成后，AI 会使用虚构日报数据生成实际预览。

你只需要判断：

> 这个模板是不是我想要的效果？

如果还不满意，可以直接告诉 AI：

> 继续调整，重新生成预览。

你可以反复修改，直到版式满意。

### 第三步：提交 Pull Request

满意后直接告诉 AI：

> 满意，提交 PR。

如果 AI 已具备 GitHub 权限，它会创建独立分支或 Fork，并向：

**[Wxw-Gu/TraceMemo-Templates](https://github.com/Wxw-Gu/TraceMemo-Templates)**

提交 Pull Request。

Pull Request 中会包含模板源码、预览图和安装包，并说明：

- 模板名称与版本
- 设计来源
- TraceMemo 数据映射
- 预览效果
- 校验结果
- 兼容性说明
- 未支持或无法迁移的能力

如果当前 AI 没有 GitHub 写入权限，它仍然会把模板准备到可以提交 PR 的状态，并告诉你下一步需要做什么。

### 第四步：审核与发布

Pull Request 创建后，模板会进入社区审核流程。

维护者会检查：

- 模板结构与安全边界
- TraceMemo 数据兼容性
- 桌面 / 手机布局
- 长文本与空数据
- 头像、昵称、聊天消息等复杂内容
- 实际安装与渲染结果
- 模板预览质量

审核通过后，模板可以合并进入本仓库。

普通模板合并后会自动正式发布，其他 TraceMemo 用户就可以在模板市场中看到、安装并使用你的模板。

完整流程：

**你的截图 / 项目 → AI 制作模板 → 真实预览 → 提交 PR → 社区审核 → Merge 后自动发布 → 其他用户安装使用**

> 维护者可为特殊 PR 添加 `hold-publish`，使源码合并但暂不上架；普通投稿不需要关心这个内部流程。

---

## 📦 当前模板

| ID                                       | 版本    | 名称         | 适用场景                                       |
| ---------------------------------------- | ------- | ------------ | ---------------------------------------------- |
| `community.github.tracememo.quickread`   | `1.0.0` | 极简速读     | 手机单栏，先看摘要、结论和行动项               |
| `community.github.tracememo.paperdaily`  | `1.0.1` | 纸上日报     | 手机报纸式编辑版，突出标题、话题和引语         |
| `community.github.tracememo.teamboard`   | `1.0.0` | 团队看板     | 桌面宽屏多栏看板，适合团队复盘和归档           |
| `community.github.wxw-gu.mountain-daily` | `1.0.0` | 山水协作日报 | 山水主题桌面协作日报，适合整理多人讨论与行动项 |
| `community.github.wxw-gu.neon-command-daily` | `1.0.2` | 霓光指挥日报 | 霓光主题桌面指挥日报，突出讨论、重点消息与行动项 |

所有正式模板都会提供：

- 可编辑模板源码
- 模板预览图
- 可安装 ZIP
- TraceMemo 模板市场条目

安装包不包含 JavaScript、外链资源或模板目录之外的文件。

仓库中的示例文字、昵称、群名和测试头像均使用虚构数据，不应包含真实聊天记录或隐私信息。

---

## 🧩 在 TraceMemo 中使用

打开 TraceMemo：

**日报 → 今日日报 → 日报模板 → 模板市场**

选择喜欢的模板后点击安装，即可在日报中选择并使用。

市场模板使用 TraceMemo 已生成的同一份日报数据，因此更换模板只改变展示方式，不会重新定义日报分析逻辑。

具体入口名称和支持版本请以：

[TraceMemo 主项目](https://github.com/Wxw-Gu/TraceMemo)

的当前版本为准。

---

## 🛠️ 手动制作模板

如果你希望自己开发模板，也可以直接按照仓库规范制作。

每个模板版本位于：

```text
templates/<template-id>/<version>/
```

典型结构：

```text
templates/<template-id>/<version>/
├── manifest.json
├── template.html
├── preview.png
└── assets/
```

模板只能使用 TraceMemo 当前公开的数据占位符和静态 HTML / CSS。

模板不是插件系统，不应依赖：

- JavaScript 业务逻辑
- iframe
- Node / IPC
- 外部 API
- 外部网络资源
- 自定义 AI Prompt
- TraceMemo 尚未提供的数据字段

完整的：

- manifest 规范
- placeholder 规则
- HTML / CSS 安全限制
- fixture 要求
- 预览流程
- ZIP 打包规则
- Pull Request 要求
- 正式发布流程

请阅读：

[CONTRIBUTING.md](CONTRIBUTING.md)

---

## 📁 仓库结构

```text
templates/<id>/<version>/      模板可编辑源码
packages/<id>/<version>/       可安装模板 ZIP
previews/                      模板市场与审核使用的预览 PNG
fixtures/                      虚构日报测试数据
docs/fragment-ui-contract.md   生产 fragment 的稳定 UI contract
skills/                        AI 模板制作与投稿 Skill
catalog/v1/index.json          TraceMemo 正式模板市场目录
catalog/v1/drafts/             发布与审核流程使用的草稿目录
catalog/v1/publish-metadata.json
                               自动发布维护的当前正式版本 allowlist
scripts/                       校验、预览、打包和 catalog 工具
```

每个模板版本还包含用于市场展示的 `market.json`；它不进入安装包。

普通模板源码合并后会自动进入 TraceMemo 模板市场。维护者仍可在合并前添加 `hold-publish`，让模板只进入仓库、暂不上架。

---

## 🔄 投稿与发布流程

社区模板采用：

```text
制作模板
    ↓
生成真实预览
    ↓
提交 Pull Request
    ↓
自动结构与安全校验
    ↓
维护者审核
    ↓
合并模板源码
    ↓
自动正式发布
    ↓
进入 TraceMemo 模板市场
```

模板作者通常只需要负责：

**制作 → 预览 → Pull Request**

正式 catalog 与市场上架由仓库自动发布机制处理；作者不需要编辑 catalog 文件。

---

## 🔒 安全与隐私

社区模板是静态展示模板。

模板不得：

- 执行 JavaScript
- 加载 iframe
- 使用事件处理器执行代码
- 请求外部 API
- 引用外部网络资源
- 访问 TraceMemo 本地运行时能力
- 在投稿包或 fixture 中携带真实微信聊天记录
- 在投稿包或 fixture 中携带真实联系人头像
- 携带 Token、API Key 或其他密钥

投稿、测试和预览应使用虚构 fixture 数据。

模板在 TraceMemo 实际运行时，可以展示 TraceMemo 已提供并允许模板使用的真实日报数据；仓库中的投稿、测试和预览数据则必须保持虚构和脱敏。

---

## 🔗 相关链接

- [TraceMemo 主项目](https://github.com/Wxw-Gu/TraceMemo)
- [TraceMemo Template Contributor Skill](https://github.com/Wxw-Gu/TraceMemo-Templates/tree/main/skills/tracememo-template-contributor)
- [模板贡献规范](CONTRIBUTING.md)
- [正式模板目录](catalog/v1/index.json)

---

## 兼容提示

模板功能依赖 TraceMemo 的模板协议 `1.0` 和占位符接口 `1`。

TraceMemo 主项目仍可能继续调整模板能力，因此具体兼容版本、安装入口和可用功能请以 TraceMemo 当前发布说明为准。

---

## 许可

模板、fixture、Skill 和仓库工具按 [MIT](LICENSE) 许可发布。

该许可只覆盖本仓库新增的原创内容，不改变 TraceMemo 或第三方资产原有的许可。

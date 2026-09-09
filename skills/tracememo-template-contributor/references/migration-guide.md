# 日报迁移指南

这份指南解释如何把已有日报项目迁移为 TraceMemo 模板。字段、占位符、允许的 HTML/CSS 和尺寸限制会随仓库变化；每次迁移都必须先读取当前工作区的 `CONTRIBUTING.md`、validator、build/preview 脚本、fixture、manifest 和至少一个相近模板。本文件只描述判断方法，不复制协议清单。

## 1. 盘点原日报

先在原项目中建立一份事实清单：

- 页面骨架：标题、日期/群名、摘要、统计、话题、消息、引语、问答、行动项、未解决项和页脚的顺序与层级；
- 视觉系统：宽度、断点、网格、间距、字体、颜色、边框、头像裁切和图片比例；
- 数据入口：静态 JSON、构建时数据、浏览器运行时 API、AI 生成字段或用户输入；
- 依赖和能力：JavaScript、事件处理、表单、iframe、外部图片/字体/样式、网络请求、localStorage、动态计算和自定义业务逻辑；
- 版权与隐私：素材来源、许可、是否含真实群名、昵称、头像、消息或密钥。

截图只能证明呈现结果，不能证明数据结构或交互。无法确认的地方要标记为假设，不要把猜测写成模板字段。

## 2. 读取仓库规则

建议按这个顺序读取当前仓库：

1. `CONTRIBUTING.md`：目录布局、ID/版本、占位符分类、安全边界、fixture 和投稿约束；
2. `scripts/validate-structure.cjs`：仓库实际检查的 manifest、占位符和 HTML/CSS 边界；
3. `scripts/render-previews.cjs` 及需要时的生产预览脚本：当前 fixture 如何替换数据、预览如何生成；
4. `scripts/build-packages.cjs`：安装包实际包含哪些文件；
5. `fixtures/`、现有 `templates/` 和 manifest：字段形状、空模块处理、头像/消息布局和响应式实现参考；若 fixture 写在 preview/生产探针脚本中，也将该脚本作为 fixture source；
6. `.github/workflows/validate.yml`：投稿 CI 的真实入口。

若这些文件与本 Skill 或原项目说明冲突，以当前仓库文件和 TraceMemo 当前实现为准。必要时读取相邻 TraceMemo checkout 的对应协议源码，但不要修改那个仓库。

## 3. 建立兼容性矩阵

逐项写出原功能、证据、处理方式和风险。至少覆盖：

| 原功能 | 处理判断 | 典型做法 |
| --- | --- | --- |
| 静态版式和 CSS | 可直接映射 | 保留结构和样式，只把固定文字换成现有占位符 |
| 摘要、话题、消息、引语、行动项等 | 直接映射或近似 | 复用当前 html 占位符和空模块 class；不增加新字段 |
| 复杂卡片或特殊分组 | 近似实现 | 用现有模块的静态结构表达，记录视觉差异 |
| JS 交互、运行时 API、AI 调用、登录、表单 | 不支持 | 删除；把最终可读状态做成静态 HTML |
| 外部图片、字体、iframe、网络数据 | 不支持 | 使用包内合规资源、系统字体或纯 CSS；否则移除并记录 |

模板是展示层。不能因为原项目需要数据就扩展 TraceMemo 主程序、manifest 业务字段或 AI prompt；缺少数据时宁可隐藏模块、显示现有空状态，或请求用户调整预期。

## 4. 生成模板

在 `templates/<id>/<version>/` 创建当前仓库要求的 `manifest.json`、`template.html`、`market.json` 和必要的 `assets/`。`market.json` 只提供市场 description/tags，不进入安装 ZIP。ID、版本、入口、协议和 capture 参数都从当前示例和 validator 推导，不要照抄旧版本的值。模板 HTML 应：

- 使用静态 HTML/CSS；占位符按当前定义的 text、html、class 类型放在允许的位置；
- 对长中文、英文、数字和 HTML 特殊字符保留换行与溢出空间；
- 让消息头像、昵称、时间、正文和备注在缺失头像或超长昵称时仍可读；
- 对可选模块使用当前仓库的空状态 class/片段，不留下空标题、空边框或多余间距；
- 只引用包内 `assets/` 中符合仓库限制的图片，避免 CSS 外链和隐式资源请求。

保持原设计优先体现在层级、比例、留白、字体气质和颜色关系；无法支持的交互不要用危险或隐蔽的替代逻辑伪造。

## 5. 验证和预览

从仓库根目录运行当前的结构检查、预览和打包命令。例如仓库提供下列脚本时：

```bash
node scripts/validate-structure.cjs
node scripts/render-previews.cjs
node scripts/build-packages.cjs
```

先确认这些脚本是否已包含候选模板的 ID/版本。固定枚举既有模板的脚本仍应作为仓库基线执行，但不能证明新模板已被覆盖；按脚本的真实检查项对候选模板补做同等结构检查和渲染，并在投稿说明中如实记录。不要为了让脚本绿灯而把候选模板伪装成已有模板。

如果仓库或 TraceMemo checkout 提供生产安装/导出探针，也运行对应命令，并设置其要求的 `TRACEMEMO_ROOT`。检查命令输出和生成文件，而不是只看退出码。预览必须使用虚构 fixture，实际打开 PNG 或 HTML 检查：

- 完整数据和稀疏/空模块状态；
- 长中文、长英文、长数字、`<>&"` 等特殊字符；
- 头像缺失、头像存在、超长昵称和多条消息；
- 页面宽度是否与 manifest capture 一致，是否横向溢出、裁切、重叠、空标题或不可读文本；
- 图片是否确实来自模板包，HTML 是否没有脚本、事件、iframe、外链或目录外读取。

若只有仓库共享 fixture，使用其中的完整数据和 `sparse` 数据设计两次渲染；不要把用户真实日报复制进 fixture。生成 preview 后要做目视检查，必要时用浏览器开发者工具或 Playwright 计算 `scrollWidth` 与 viewport 宽度。

## 6. 投稿交付

交付内容应包含：

1. 模板源码路径和版本；
2. preview 路径及其实际渲染方式；
3. 运行过的 validator、preview、build/生产探针命令和结果；
4. 兼容性矩阵中被移除或近似的功能；
5. 建议 PR title，例如 `feat(template): add <name> daily report template`；
6. PR description，包含目标 TraceMemo 版本/commit、设计来源与许可、使用的虚构 fixture、验证结果和已知限制。

不要在第一版自动编辑正式 `catalog/`。只有用户已明确授权投稿，才按 `CONTRIBUTING.md` 的流程处理目录和远程协作；GitHub fallback 的具体分支、fork 与 PR 行为见 [submission-fallback.md](submission-fallback.md)。

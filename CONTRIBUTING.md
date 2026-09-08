# 贡献日报模板

## 制作规范

1. 在 `templates/<template-id>/<version>/` 提供 `manifest.json`、`template.html`；需要图片时只放入包内 `assets/`。
2. ID 必须符合 `community.github.<作者>.<名称>`；版本使用三段 semver，不得使用 `builtin.` 命名空间。
3. `protocolVersion`、`interfaceVersion` 和目标 TraceMemo 版本必须匹配。请在 PR 描述中写明对应的 TraceMemo commit 或已发布版本。
4. 只使用 TraceMemo 已公布的占位符。text、html、class 三类占位符不能混用；不要把占位符放进 `style`、URL、事件属性或未知标签。
5. 禁止 JavaScript、iframe、外链、表单、事件属性、CSS `@import` 和读取模板目录外文件。图片只能是包内 PNG/JPEG/WebP。
6. 同时检查完整数据、缺少可选模块、长中文/数字/HTML 特殊字符三类 fixture；不要上传真实聊天记录、头像、日报或 API Key。

## 本地检查

需要 Node.js 18+、系统 `zip` 与 `unzip`，以及用于截图的 Playwright。默认从相邻的 TraceMemo checkout 查找 Playwright，也可以通过 `TRACEMEMO_ROOT` 指定路径。

```bash
node scripts/validate-structure.cjs
node scripts/render-previews.cjs
node scripts/build-packages.cjs
CATALOG_COMMIT=<40-char-commit> node scripts/generate-catalog.cjs
node scripts/validate-structure.cjs --catalog
```

投稿 CI 只读取源码并执行固定仓库工具，不运行投稿模板中的脚本或安装命令。安全安装和真实 PNG 导出由维护者在固定 TraceMemo 版本、临时数据目录和虚构数据中完成。

## 目录和发布

`templates/` 是投稿模板源码的完整集合；模板源码存在不代表已经进入模板市场。`catalog/v1/drafts/index.json` 是 review 目录：用于记录尚未完成 TraceMemo 实际安装、重启恢复、HTML/PNG 导出和远端哈希核对的投稿版本。它和正式 catalog 都可以只引用源码集合中的一部分版本，有真实的审核用途，不是内部工作日志。

完成维护者验收后，在已经提交源码、安装包和预览图的 commit 上生成正式目录：

```bash
CATALOG_COMMIT=<commit-A> CATALOG_PUBLISH=1 node scripts/generate-catalog.cjs
node scripts/validate-structure.cjs --catalog
```

正式目录的 `source.commit`、下载 URL、预览 URL、ZIP 大小和 SHA-256 必须固定到同一个源码/产物 commit。已发布版本不可覆盖；修改请增加新版本，并重新生成对应的安装包、预览和目录条目。

## 提交流程

提交 Pull Request 前请确认：

- `manifest.json` 的 ID、版本、协议和入口字段正确；
- 三类 fixture 下都没有横向溢出、空模块残留或不可读文本；
- ZIP 只包含 manifest、入口 HTML、预览图及声明的包内资源；
- 结构校验和目录哈希校验通过；
- PR 描述包含目标 TraceMemo 版本、模板截图和必要的兼容说明。

维护者会检查版式、安全边界、manifest/ZIP 一致性，并在固定 TraceMemo 版本中完成实际安装和渲染验收。通过后，条目才会从草稿目录进入 `catalog/v1/index.json`。

## 许可

提交内容默认按 [MIT](LICENSE) 发布。提交第三方素材时，必须同时说明其原有许可，并确认可以随模板分发。

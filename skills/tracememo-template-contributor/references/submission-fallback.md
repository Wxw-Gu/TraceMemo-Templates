# 投稿与 GitHub fallback

官方 Template Preview / Submission Service 已在当前仓库明确提供时，先读取其文档、配置和返回字段，再按该服务的流程处理草稿、预览和提交。不要猜测服务 URL、draft ID、认证方式或请求格式。

当前没有可用官方服务时，先完成本地模板、虚构数据 preview 与验证，再根据用户的投稿授权检查 GitHub 能力：仓库是否为 Git worktree、`gh` 是否存在且已认证、当前 GitHub 用户，以及是否可向源仓库创建分支。所有判断都基于命令的实际输出。

## 可写源仓库

在独立分支提交模板和必要的投稿产物，推送该分支并向 `Wxw-Gu/TraceMemo-Templates:main` 创建 PR。分支名应清晰且不使用 `main`；不 force push，也不直接推送 `main`。

## 需要 fork

当用户没有源仓库写权限但 `gh` 已登录时，fork `Wxw-Gu/TraceMemo-Templates`，在 fork 的独立分支提交并推送，然后从 fork 分支向源仓库 `main` 创建 PR。保留用户已有的工作树改动，不覆盖他人提交。

## 无 GitHub 写能力

不要因此放弃模板制作。交付 PR-ready 工作树、可审查 preview、验证证据，并给出 PR title 和 description；只说明完成投稿所需的最短一步（例如登录 `gh` 或在 GitHub 网页 fork 后开 PR）。

建议 PR title 为 `feat: 新增 <模板名称> 日报模板`。PR description 至少写明模板名称、template ID、version、设计来源、输入类型（screenshot / HTML / React / Vue / text）、主要视觉结构、TraceMemo 映射及未迁移部分、validator 结果、preview、虚构数据声明和未使用真实聊天数据声明。不要修改正式 catalog、草稿 catalog、`publish-metadata.json`、其他作者模板或已发布版本。PR 合并后由仓库自动发布流程决定是否上架；Contributor 不负责该决定。

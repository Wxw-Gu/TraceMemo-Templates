# Production Fragment UI Contract

TraceMemo 会在导出前把真实日报 fragment 注入模板。模板的 preview 只能说明静态页面效果；投稿前还必须用 TraceMemo production renderer 检查这些 fragment。

本 contract 适用于 `interfaceVersion: "1"`，是追加能力：既有历史 class 会继续保留，不需要升级 manifest。

## 稳定语义 class

不要根据 DOM 层级猜测消息、头像或昵称。TraceMemo 在生产 fragment 上追加以下 `tm-*` class：

| 角色 | class |
| --- | --- |
| 任意生产 fragment | `tm-fragment` |
| 话题与参与者列表 | `tm-topic-card`、`tm-topic-card__participants` |
| 参与者与昵称 | `tm-participant`、`tm-participant__name` |
| 消息与消息正文 | `tm-message`、`tm-message__body`、`tm-message__meta`、`tm-message__author`、`tm-message__time`、`tm-message__text`、`tm-message__note` |
| 重要消息 / 引语消息 | `tm-message--important`、`tm-message--quote` |
| 头像 | `tm-avatar`、`tm-avatar--hero`、`tm-avatar--message`、`tm-avatar--participant`、`tm-avatar--ranking` |
| fallback 头像 | `tm-avatar--fallback` |
| 引语、待办、未解决、问答 | `tm-quote`、`tm-todo-card`、`tm-unresolved-card`、`tm-qa-card` |
| 其他现有 fragment | `tm-reversal-card`、`tm-voice-card`、`tm-ranking-item` |

旧 class（如 `important-card`、`avatar`、`chat-msg`、`chat-avatar`、`person-chip`）仍存在，供已发布模板兼容；新模板优先使用上表的语义 selector。

## 头像与受保护几何

真实图片与 fallback 都是同一个 `img.tm-avatar`，都具备正方形、`object-fit: cover`、不可 shrink 和受限尺寸。模板可用变量选择主题尺寸和圆角：

```css
:root {
  --tm-avatar-message-size: 34px;      /* 最终限制为 28–44px */
  --tm-avatar-participant-size: 22px;  /* 最终限制为 18–28px */
  --tm-avatar-ranking-size: 26px;      /* 最终限制为 20–34px */
  --tm-avatar-hero-size: 40px;         /* 最终限制为 28–56px */
  --tm-avatar-radius: 50%;
  --tm-message-gap: 8px;
  --tm-participant-gap: 4px;
}
```

边框、阴影、背景、颜色和圆形/圆角均可主题化。头像最大尺寸、长宽比、消息正文最小宽度、昵称/时间/正文换行，以及移动端主内容单栏属于系统保护范围。保护只覆盖 production fragment；不会把模板的整体视觉系统锁死。

因此宽泛规则如 `img { width: 100%; }` 不会把 production avatar 放大。此类 selector 仍不推荐：它可能影响模板自己的插图。

## 推荐与避免

```css
/* 推荐：按语义主题化 */
.tm-message--important { background: #fff; }
.tm-message__author { color: #1d3652; }
.tm-avatar--message { box-shadow: 0 0 0 2px #cde7ff; }

/* 不推荐：依赖旧层级或误伤所有图片 */
.important-card > img { width: 100%; }
img { width: 100%; }
section img { height: auto; }
```

不要把模板自己的图片与 `tm-avatar` 混为一谈；模板图片继续使用包内 `assets/`，生产导出会内联这些资源。

## 必做验收

在 1000px 与 430px 用 TraceMemo production renderer 检查：

- 普通图片头像、单字/多字 fallback、长昵称、长正文、多人参与者；
- 重要消息、引语、TODO、未解决、QA 以及空 optional 模块；
- `scrollWidth <= viewportWidth`、头像框范围、头像与正文不重叠、正文宽度大于零；
- 无外部网络请求、无 broken image，并实际打开完整 PNG。

本仓库的 `node scripts/validate-production-fragments.cjs` 使用相邻 TraceMemo checkout 的共享 fixture 和真实 `exportGroupReport` 路径完成这些检查。必要时设置 `TRACEMEMO_ROOT`；它不是第二套手写 fragment DOM。

#!/usr/bin/env node
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const crypto = require('node:crypto')
const { execFileSync } = require('node:child_process')
const { pathToFileURL } = require('node:url')

const root = path.resolve(__dirname, '..')
const tmRoot = process.env.TRACEMEMO_ROOT || path.resolve(root, '..', 'TraceMemo')
const version = process.env.TEMPLATE_VERSION || '1.0.1'
const id = process.env.TEMPLATE_ID || 'community.github.tracememo.paperdaily'
const sourceDir = path.join(root, 'templates', id, version)
const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tracememo-paperdaily-preview-output-'))
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'tracememo-paperdaily-preview-user-'))
const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'tracememo-paperdaily-preview-package-'))
const packagePath = path.join(staging, `${id}-${version}.zip`)
const evidenceDir = path.join(root, '.tmp', `${id.replaceAll('.', '-')}-production-preview-${version}`)

const fixture = {
  overview: '虚构多人日报：接口排查与上线准备。',
  hero: { headline: '多人对话版式验收', summary: '使用虚构头像、长昵称和长文本检查纸上日报。', keyTakeaway: '消息内容应保持可读并在窄屏内换行。', pendingNote: '', statusLine: '包含重要消息、人物对话和话题参与者。' },
  topics: [{ title: '头像与消息排版', timeRange: '09:20-11:05', heat: '高', participants: ['阿宇', '超长昵称示例用户（含 & < >）', '老周', '小李'], summary: '检查参与者标签、消息气泡和长文本的边界。', conclusions: [{ text: '头像固定尺寸，正文区域独立换行。' }], keywords: ['头像', '气泡', '换行'] }],
  resources: [],
  importantMessages: [
    { sender: '阿宇', time: '10:41', content: '先别回滚，接口能通。', note: '重要消息一' },
    { sender: '超长昵称示例用户（含 & < >）', time: '11:02', content: '这是一段较长的虚构聊天内容，用来确认正文不会被头像挤压，也不会产生横向溢出。', note: '重要消息二' }
  ],
  quotes: [{ messages: [
    { sender: '阿宇', content: '我以为接口炸了，但现在看更像是缓存和配置问题。' },
    { sender: '老周', content: '先清缓存再复测，保留完整上下文，不要截断对话。' },
    { sender: '超长昵称示例用户（含 & < >）', content: '长昵称和长正文都应该自然换行，头像仍然保持小尺寸。' }
  ], note: '人物对话使用统一消息气泡，不伪造左右双方。' }],
  qa: [], todos: [{ task: '补齐排版验收记录', owner: '小李', deadline: '今晚', topic: '模板' }],
  unresolved: [], storylines: [], reversals: [], participantChains: [],
  analytics: { topicHeat: [], activeTimeline: '09:20-11:05', topSpeakers: [], voiceLeaderboard: [] },
  keywords: ['头像', '日报'], media: { gallery: [], voiceHighlights: [], funBadges: [] },
  sectionMeta: {
    topics: { enabled: true, importance: 1, confidence: 1, totalCount: 1, displayedCount: 1 },
    importantMessages: { enabled: true, importance: 1, confidence: 1, totalCount: 2, displayedCount: 2 },
    moments: { enabled: true, importance: 1, confidence: 1, totalCount: 1, displayedCount: 1 },
    actions: { enabled: true, importance: 1, confidence: 1, totalCount: 1, displayedCount: 1 },
    qa: { enabled: false, importance: 0, confidence: 1, totalCount: 0, displayedCount: 0 },
    resources: { enabled: false, importance: 0, confidence: 1, totalCount: 0, displayedCount: 0 }
  },
  summaryStats: { messageCount: 12, activeUsers: 4, topicCount: 1, mediaCount: 0, imageCount: 0, voiceCount: 0, stickerCount: 0, conclusionCount: 1, todoCount: 1, unresolvedCount: 0 }
}

const metadata = {
  groupName: '虚构纸上日报验收组', reportDate: '2026-09-07', dateRange: '09:20-11:05', messageCount: 12,
  activeUsers: 4, timeSpan: '2 h', generatedAt: '2026-09-07 12:00', recordNote: 'fixture', footerNote: '不对应真实聊天记录。',
  heroParticipants: ['阿宇', '老周'], avatars: {}, reportMode: 'full'
}

const manifest = JSON.parse(fs.readFileSync(path.join(sourceDir, 'manifest.json'), 'utf8'))
manifest.templateVersion = version
fs.mkdirSync(staging, { recursive: true })
fs.writeFileSync(path.join(staging, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
fs.copyFileSync(path.join(sourceDir, manifest.entry), path.join(staging, manifest.entry))
// 安装器需要一个有效预览图；最终预览由 TM 导出结果覆盖。
fs.copyFileSync(path.join(sourceDir, manifest.preview), path.join(staging, manifest.preview))
if (fs.existsSync(path.join(sourceDir, 'assets'))) fs.cpSync(path.join(sourceDir, 'assets'), path.join(staging, 'assets'), { recursive: true })
const packageFiles = ['manifest.json', manifest.entry, manifest.preview]
if (fs.existsSync(path.join(staging, 'assets'))) packageFiles.push('assets')
execFileSync('zip', ['-X', '-q', '-r', packagePath, ...packageFiles], { cwd: staging })

const electronExecutable = require(require.resolve('electron', { paths: [path.join(tmRoot, 'node_modules')] }))
const playwright = require(require.resolve('playwright', { paths: [path.join(tmRoot, 'node_modules')] }))
const { _electron: electron } = playwright

const main = async () => {
  fs.mkdirSync(evidenceDir, { recursive: true })
  let app
  try {
    app = await electron.launch({ executablePath: electronExecutable, args: [path.join(tmRoot, 'out', 'main', 'reportTemplateTest.js')], env: { ...process.env, TRACEMEMO_TEMPLATE_TEST_USER_DATA: userData, TRACEMEMO_REPORT_OUTPUT_DIR: outputDir } })
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    const installed = await page.evaluate(async (p) => window.api.installReportTemplate(p), packagePath)
    if (!installed.success || installed.template?.id !== id || installed.template?.version !== version) throw new Error(`安装失败：${JSON.stringify(installed)}`)
    const exported = await page.evaluate(async (request) => window.api.exportGroupReport(request), { templateRef: { id, version }, report: fixture, metadata })
    if (!exported.success || !exported.htmlPath || !exported.pngPath) throw new Error(`导出失败：${JSON.stringify(exported)}`)
    const browser = await playwright.chromium.launch({ headless: true })
    const inspectPage = async (width) => {
      const page = await browser.newPage({ viewport: { width, height: 1200 }, deviceScaleFactor: 1 })
      await page.goto(pathToFileURL(exported.htmlPath).href)
      await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete))
      const metrics = await page.evaluate(() => ({ bodyWidth: document.body.getBoundingClientRect().width, scrollWidth: document.documentElement.scrollWidth }))
      await page.close()
      if (metrics.scrollWidth > width + 1) throw new Error(`${width}px 页面横向溢出：${JSON.stringify(metrics)}`)
      return metrics
    }
    const desktop = await inspectPage(manifest.capture.width)
    const mobile = await inspectPage(430)
    const htmlPath = path.join(evidenceDir, `${id}-${version}.html`)
    const pngPath = path.join(evidenceDir, `${id}-${version}.png`)
    fs.copyFileSync(exported.htmlPath, htmlPath)
    fs.copyFileSync(exported.pngPath, pngPath)
    const exportedPage = await browser.newPage({ viewport: { width: 430, height: 1200 }, deviceScaleFactor: 1 })
    await exportedPage.goto(pathToFileURL(exported.htmlPath).href)
    await exportedPage.waitForFunction(() => Array.from(document.images).every((image) => image.complete))
    const details = await exportedPage.evaluate(() => {
      const read = (selector) => {
        const element = document.querySelector(selector)
        if (!element) return null
        const style = getComputedStyle(element)
        const rect = element.getBoundingClientRect()
        return { width: rect.width, height: rect.height, display: style.display, maxWidth: style.maxWidth, objectFit: style.objectFit, overflowWrap: style.overflowWrap }
      }
      return { avatar: read('.important-card .avatar'), chatAvatar: read('.chat-avatar'), personAvatar: read('.person-chip img'), chatName: read('.chat-name'), bubble: read('.chat-bubble') }
    })
    if (id === 'community.github.tracememo.paperdaily') {
      if (!details.avatar || Math.round(details.avatar.width) !== 34 || Math.round(details.avatar.height) !== 34) throw new Error(`重要消息头像尺寸异常：${JSON.stringify(details.avatar)}`)
      if (!details.chatAvatar || Math.round(details.chatAvatar.width) !== 34 || Math.round(details.chatAvatar.height) !== 34) throw new Error(`对话头像尺寸异常：${JSON.stringify(details.chatAvatar)}`)
      if (!details.personAvatar || Math.round(details.personAvatar.width) !== 22 || Math.round(details.personAvatar.height) !== 22) throw new Error(`参与者头像尺寸异常：${JSON.stringify(details.personAvatar)}`)
      if (!details.bubble || details.bubble.display !== 'block' || details.bubble.overflowWrap === 'normal') throw new Error(`消息气泡样式异常：${JSON.stringify(details.bubble)}`)
    }
    const metrics = { desktop, mobile, details }
    const png = fs.readFileSync(exported.pngPath)
    if (png.readUInt32BE(16) !== manifest.capture.width) throw new Error(`导出 PNG 宽度不匹配：${png.readUInt32BE(16)}`)
    fs.copyFileSync(exported.pngPath, path.join(sourceDir, manifest.preview))
    fs.copyFileSync(exported.pngPath, path.join(root, 'previews', `${id}-${version}.png`))
    fs.writeFileSync(path.join(evidenceDir, 'metrics.json'), JSON.stringify({ id, version, installed: installed.template, export: exported, metrics }, null, 2) + '\n')
    await exportedPage.close()
    await browser.close()
    console.log(JSON.stringify({ id, version, htmlPath, pngPath, metrics }, null, 2))
  } finally {
    if (app) await app.close().catch(() => undefined)
    fs.rmSync(outputDir, { recursive: true, force: true })
    fs.rmSync(userData, { recursive: true, force: true })
    fs.rmSync(staging, { recursive: true, force: true })
  }
}

main().catch((error) => { console.error(error?.stack || error); process.exitCode = 1 })

#!/usr/bin/env node
/*
 * Run the community packages through TraceMemo's built reportTemplateTest
 * entry. This is an integration probe, not a second installer or protocol
 * validator: the package is accepted and rendered only by TraceMemo itself.
 */
const fs = require('node:fs')
const crypto = require('node:crypto')
const os = require('node:os')
const path = require('node:path')

const tmRoot = path.resolve(process.env.TRACEMEMO_ROOT || path.join(__dirname, '..', '..', 'TraceMemo'))
const root = path.resolve(__dirname, '..')
const requestedCommit = process.env.TEMPLATE_COMMIT || null
const evidenceRoot = path.resolve(
  process.env.TM_TEMPLATE_EVIDENCE_DIR || path.join(root, '.tmp', `tm-production-${new Date().toISOString().replace(/[:.]/g, '-')}`)
)
const electronExecutable = require(require.resolve('electron', { paths: [path.join(tmRoot, 'node_modules')] }))
const playwrightModule = require.resolve('playwright', { paths: [path.join(tmRoot, 'node_modules')] })
const { _electron: electron } = require(playwrightModule)

const ids = [
  'community.github.tracememo.quickread',
  'community.github.tracememo.paperdaily',
  'community.github.tracememo.teamboard'
]

const fixture = {
  overview: '虚构日报概览：接口排查和版本升级是今天主线。',
  hero: {
    headline: '接口排查和版本升级是今天主线',
    summary: '白天主要围绕接口异常、升级节奏和上线安排展开。',
    keyTakeaway: '问题更像缓存与配置，而不是服务端故障。',
    pendingNote: '测试环境接口文档和回滚方案仍需补齐。',
    statusLine: '今日形成 3 个结论，2 个待办。'
  },
  topics: [
    {
      title: 'GPT 接口异常排查 <&>',
      timeRange: '09:20-11:05',
      heat: '高',
      participants: ['阿宇', '老周'],
      summary: '问题收敛到缓存与环境配置。',
      conclusion: '先清缓存再复测。',
      keywords: ['接口', '缓存']
    },
    {
      title: '版本升级节奏',
      timeRange: '11:40-12:20',
      heat: '中',
      participants: ['小李'],
      summary: '先补兼容性清单，再决定升级窗口。',
      conclusions: [{ text: '先列旧组件清单。' }],
      keywords: ['升级']
    }
  ],
  resources: [{ title: '回滚说明', description: '虚构资源，仅用于模板渲染。', sender: '老周' }],
  importantMessages: [
    { sender: '阿宇', time: '10:41', content: '先别回滚，接口能通。', note: '稳定了排查方向。' },
    { sender: '老周', time: '11:02', content: '像是缓存没清掉。', note: '收敛到本地环境。' }
  ],
  quotes: [
    {
      messages: [
        { sender: '阿宇', content: '我以为接口炸了。' },
        { sender: '老周', content: '先清缓存再复测。' }
      ],
      note: '从回滚争论切到最小验证。'
    }
  ],
  qa: [{ question: '接口是不是服务端挂了？', answer: '不是，当前更像缓存问题。', answerer: '老周' }],
  todos: [{ task: '补测试环境接口文档', owner: '小李', deadline: '今晚', topic: '接口' }],
  unresolved: [{ question: '缓存问题根因是什么？', owner: '阿宇', status: '待跟进', note: '等待复测。', lastDiscussedAt: '11:05' }],
  storylines: [],
  reversals: [],
  participantChains: [],
  analytics: {
    topicHeat: [{ topic: '接口', score: 0.9 }],
    activeTimeline: '09:20-19:48',
    topSpeakers: [{ name: '阿宇', count: 12 }, { name: '老周', count: 9 }],
    voiceLeaderboard: []
  },
  keywords: ['接口', '缓存', '升级'],
  media: { gallery: [], voiceHighlights: [], funBadges: [] },
  sectionMeta: {
    topics: { enabled: true, importance: 1, confidence: 1, totalCount: 2, displayedCount: 2 },
    importantMessages: { enabled: true, importance: 1, confidence: 1, totalCount: 2, displayedCount: 2 },
    moments: { enabled: true, importance: 1, confidence: 1, totalCount: 1, displayedCount: 1 },
    actions: { enabled: true, importance: 1, confidence: 1, totalCount: 2, displayedCount: 2 },
    qa: { enabled: true, importance: 1, confidence: 1, totalCount: 1, displayedCount: 1 },
    resources: { enabled: true, importance: 1, confidence: 1, totalCount: 1, displayedCount: 1 }
  },
  summaryStats: {
    messageCount: 382,
    activeUsers: 47,
    topicCount: 2,
    mediaCount: 0,
    imageCount: 0,
    voiceCount: 0,
    stickerCount: 0,
    conclusionCount: 2,
    todoCount: 1,
    unresolvedCount: 1
  }
}

const metadata = {
  groupName: '虚构验收组',
  reportDate: '2026-09-07',
  dateRange: '09:20-19:48',
  messageCount: 382,
  activeUsers: 47,
  timeSpan: '10 h',
  generatedAt: '2026-09-07 22:18',
  recordNote: '虚构数据：仅用于模板生产验收。',
  footerNote: '不对应真实聊天记录。',
  heroParticipants: ['阿宇', '老周'],
  avatars: {},
  reportMode: 'full'
}

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'))
const sha256 = (filePath) => crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
const pngInfo = (filePath) => {
  const bytes = fs.readFileSync(filePath)
  if (bytes.readUInt32BE(0) !== 0x89504e47 || bytes.readUInt32BE(4) !== 0x0d0a1a0a) throw new Error(`不是 PNG：${filePath}`)
  return { bytes: bytes.length, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}
const validateLocalBaseline = () => {
  const catalog = readJson(path.join(root, 'catalog', 'v1', 'drafts', 'index.json'))
  const commit = requestedCommit || catalog.source?.commit || 'WORKTREE_PENDING'
  if (requestedCommit && catalog.source?.commit !== requestedCommit) throw new Error(`草稿目录 commit 不是 ${requestedCommit}`)
  if (catalog.status !== 'draft' || catalog.templates.length !== ids.length) throw new Error('草稿目录不是三条 draft 条目')
  const published = readJson(path.join(root, 'catalog', 'v1', 'index.json'))
  if (published.schemaVersion !== '1' || published.status !== 'published' || !Array.isArray(published.templates)) throw new Error('正式目录字段不完整')
  const entries = {}
  for (const catalogEntry of catalog.templates) {
    const { id, version } = catalogEntry
    if (!ids.includes(id) || entries[id]) throw new Error(`草稿目录包含未知或重复模板：${id}`)
    const manifestPath = path.join(root, 'templates', id, version, 'manifest.json')
    const manifest = readJson(manifestPath)
    if (manifest.protocolVersion !== '1.0' || manifest.interfaceVersion !== '1' || manifest.kind !== 'daily-report' || manifest.templateVersion !== version) {
      throw new Error(`${id}: manifest 协议字段不匹配`)
    }
    const packagePath = path.join(root, 'packages', id, version, `${id}-${version}.zip`)
    const local = { sizeBytes: fs.statSync(packagePath).size, sha256: sha256(packagePath) }
    if (!catalogEntry || catalogEntry.sizeBytes !== local.sizeBytes || catalogEntry.sha256 !== local.sha256) {
      throw new Error(`${id}: 草稿目录大小或 SHA-256 不匹配`)
    }
    entries[id] = { manifest, packagePath, version, ...local, catalog: catalogEntry }
  }
  return { commit, entries }
}

const reportRequest = (id, version) => ({
  templateRef: { id, version },
  metadata,
  report: fixture
})

const main = async () => {
  fs.mkdirSync(evidenceRoot, { recursive: true })
  const { commit, entries } = validateLocalBaseline()
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'tracememo-template-production-user-'))
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tracememo-template-production-output-'))
  const results = []
  let app
  const launch = () => electron.launch({
    executablePath: electronExecutable,
    args: [path.join(tmRoot, 'out', 'main', 'reportTemplateTest.js')],
    env: {
      ...process.env,
      TRACEMEMO_TEMPLATE_TEST_USER_DATA: userData,
      TRACEMEMO_REPORT_OUTPUT_DIR: outputDir
    }
  })
  try {
    app = await launch()
    let page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    for (const id of ids) {
      const entry = entries[id]
      const installed = await page.evaluate(async (packagePath) => window.api.installReportTemplate(packagePath), entry.packagePath)
      if (!installed.success || installed.template?.id !== id || installed.template?.version !== entry.version) {
        throw new Error(`${id}: 安装失败：${JSON.stringify(installed)}`)
      }
      results.push({ id, version: entry.version, manifest: entry.manifest, package: entry.catalog, localPackage: { sizeBytes: entry.sizeBytes, sha256: entry.sha256 }, install: installed })
    }
    await app.close()
    app = await launch()
    page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    const listed = await page.evaluate(() => window.api.listReportTemplates())
    for (const result of results) {
      const recovered = listed.find((item) => item.id === result.id && item.version === result.version && item.source === 'installed')
      if (!recovered) throw new Error(`${result.id}: 重启后未恢复安装记录`)
      result.recovery = { source: recovered.source, entryPathExists: fs.existsSync(recovered.entryPath), packagePath: recovered.packagePath }
      if (!result.recovery.entryPathExists) throw new Error(`${result.id}: 重启后 entryPath 不存在`)
      const exported = await page.evaluate(async (request) => window.api.exportGroupReport(request), reportRequest(result.id, result.version))
      if (!exported.success || !exported.htmlPath || !exported.pngPath) throw new Error(`${result.id}: 导出失败：${JSON.stringify(exported)}`)
      const html = fs.readFileSync(exported.htmlPath, 'utf8')
      if (!html.includes('虚构验收组日报') || !html.includes('Content-Security-Policy')) throw new Error(`${result.id}: HTML 内容或 CSP 缺失`)
      const png = pngInfo(exported.pngPath)
      if (png.bytes <= 1000 || png.width !== result.manifest.capture.width || png.height < 800 || png.height > result.manifest.capture.maxHeight) throw new Error(`${result.id}: PNG 尺寸或字节无效：${JSON.stringify(png)}`)
      const safeName = result.id.replaceAll('.', '-')
      const htmlEvidence = path.join(evidenceRoot, `${safeName}-${result.version}.html`)
      const pngEvidence = path.join(evidenceRoot, `${safeName}-${result.version}.png`)
      fs.copyFileSync(exported.htmlPath, htmlEvidence)
      fs.copyFileSync(exported.pngPath, pngEvidence)
      result.export = { htmlPath: htmlEvidence, pngPath: pngEvidence, htmlBytes: Buffer.byteLength(html), png, htmlSha256: sha256(htmlEvidence), pngSha256: sha256(pngEvidence) }
      const removed = await page.evaluate(async ({ id, version }) => window.api.uninstallReportTemplate(id, version), { id: result.id, version: result.version })
      if (!removed.success) throw new Error(`${result.id}: 卸载失败：${JSON.stringify(removed)}`)
      if (!fs.existsSync(htmlEvidence) || !fs.existsSync(pngEvidence) || pngInfo(pngEvidence).bytes <= 1000) throw new Error(`${result.id}: 卸载后导出证据不可独立读取`)
      result.uninstall = { success: true, standaloneHtmlReadable: fs.readFileSync(htmlEvidence, 'utf8').includes('虚构验收组日报'), standalonePng: pngInfo(pngEvidence) }
    }
    fs.writeFileSync(path.join(evidenceRoot, 'results.json'), JSON.stringify({ tmRoot, templateCommit: commit, userDataRemoved: true, outputDirRemoved: true, generatedAt: new Date().toISOString(), results }, null, 2) + '\n')
    console.log(JSON.stringify({ evidenceRoot, templateCommit: commit, results }, null, 2))
  } finally {
    if (app) await app.close().catch(() => undefined)
    fs.rmSync(outputDir, { recursive: true, force: true })
    fs.rmSync(userData, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error?.stack || error)
  process.exitCode = 1
})

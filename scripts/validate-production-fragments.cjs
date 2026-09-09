#!/usr/bin/env node
/*
 * Render the published packages through TraceMemo's actual report renderer.
 * This intentionally does not duplicate fragment HTML in this repository:
 * the fixture is owned by TraceMemo and every checked DOM node comes from
 * exportGroupReport after installation.
 */
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const root = path.resolve(__dirname, '..')
const tmRoot = path.resolve(process.env.TRACEMEMO_ROOT || path.join(root, '..', 'TraceMemo'))
const fixturePath = path.join(tmRoot, 'tests', 'fixtures', 'report-template-production-fragments.json')
const evidenceRoot = path.resolve(
  process.env.TM_FRAGMENT_EVIDENCE_DIR ||
    path.join(root, '.tmp', `production-fragments-${new Date().toISOString().replace(/[:.]/g, '-')}`)
)
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))
const electronExecutable = require(require.resolve('electron', { paths: [path.join(tmRoot, 'node_modules')] }))
const playwright = require(require.resolve('playwright', { paths: [path.join(tmRoot, 'node_modules')] }))
const { _electron: electron, chromium } = playwright
const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/
const templateIdPattern = /^community\.github\.[a-z0-9-]+\.[a-z0-9-]+$/

const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

const pngInfo = (filePath) => {
  const bytes = fs.readFileSync(filePath)
  assert(bytes.readUInt32BE(0) === 0x89504e47 && bytes.readUInt32BE(4) === 0x0d0a1a0a, `不是 PNG：${filePath}`)
  return { bytes: bytes.length, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

const sourceEntry = (entry) => {
  const sourceDir = path.join(root, 'templates', entry.id, entry.version)
  const manifest = JSON.parse(fs.readFileSync(path.join(sourceDir, 'manifest.json'), 'utf8'))
  const packagePath = path.join(root, 'packages', entry.id, entry.version, `${entry.id}-${entry.version}.zip`)
  assert(fs.existsSync(packagePath), `${entry.id}@${entry.version}: 缺少 ZIP`)
  return { ...entry, sourceDir, manifest, packagePath }
}

const compareVersions = (left, right) => {
  const [a, b] = [left, right].map((value) => value.split('-')[0].split('.').map(Number))
  for (let index = 0; index < 3; index += 1) if (a[index] !== b[index]) return a[index] - b[index]
  return left.localeCompare(right)
}

const retiredVersions = () => {
  const retired = JSON.parse(fs.readFileSync(path.join(root, 'catalog', 'v1', 'retired-versions.json'), 'utf8'))
  return new Set(Object.entries(retired.templates || {}).flatMap(([id, versions]) => Object.keys(versions).map((version) => `${id}@${version}`)))
}

const sourceTemplates = () => {
  const retired = retiredVersions()
  return fs.readdirSync(path.join(root, 'templates'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .flatMap((id) => {
      assert(templateIdPattern.test(id), `templates/${id}: 无效模板 ID`)
      return fs.readdirSync(path.join(root, 'templates', id), { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort(compareVersions)
        .map((version) => {
          assert(semverPattern.test(version), `templates/${id}/${version}: 无效版本`)
          return { id, version }
        })
        .filter(({ version }) => !retired.has(`${id}@${version}`))
    })
}

const inspectAt = async (browser, htmlPath, id, version, width) => {
  const page = await browser.newPage({ viewport: { width, height: 1200 }, deviceScaleFactor: 1 })
  const externalRequests = []
  const failedResponses = []
  page.on('request', (request) => {
    if (/^https?:/i.test(request.url())) externalRequests.push(request.url())
  })
  page.on('response', (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`)
  })
  try {
    await page.goto(pathToFileURL(htmlPath).href)
    await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete))
    const metrics = await page.evaluate(() => {
      const rectangle = (element) => {
        const box = element.getBoundingClientRect()
        return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height }
      }
      const overlaps = (first, second) =>
        first.left < second.right && first.right > second.left && first.top < second.bottom && first.bottom > second.top
      return {
        scrollWidth: document.documentElement.scrollWidth,
        overflowing: Array.from(document.querySelectorAll('body *'))
          .map((element) => ({ tag: element.tagName, classes: element.className, right: rectangle(element).right, left: rectangle(element).left }))
          .filter((element) => element.right > window.innerWidth + 1 || element.left < -1)
          .slice(0, 8),
        images: Array.from(document.images).map((image) => ({ src: image.src, naturalWidth: image.naturalWidth, complete: image.complete })),
        avatars: Array.from(document.querySelectorAll('img.tm-avatar')).map((image) => {
          const style = getComputedStyle(image)
          return { classes: image.className, display: style.display, objectFit: style.objectFit, box: rectangle(image) }
        }),
        messages: Array.from(document.querySelectorAll('.tm-message')).map((message) => {
          const avatar = message.querySelector('img.tm-avatar')
          const body = message.querySelector('.tm-message__body')
          const author = message.querySelector('.tm-message__author')
          const timestamp = message.querySelector('.tm-message__time')
          return {
            message: rectangle(message),
            avatar: avatar ? rectangle(avatar) : null,
            body: body ? rectangle(body) : null,
            authorTimestampOverlap: author && timestamp ? overlaps(rectangle(author), rectangle(timestamp)) : false
          }
        }),
        fallbackCount: document.querySelectorAll('.tm-avatar--fallback').length,
        contractStyle: Boolean(document.querySelector('#tm-production-fragment-contract'))
      }
    })
    assert(metrics.contractStyle, `${id}@${version}: 缺少 production fragment contract`)
    assert(metrics.scrollWidth <= width + 1, `${id}@${version}: ${width}px 横向溢出 (${metrics.scrollWidth}px): ${JSON.stringify(metrics.overflowing)}`)
    assert(metrics.images.every((image) => image.complete && image.naturalWidth > 0), `${id}@${version}: 存在损坏图片`)
    assert(metrics.fallbackCount > 0, `${id}@${version}: fixture 未渲染 fallback avatar`)
    for (const avatar of metrics.avatars) {
      if (avatar.display === 'none') continue // 已发布模板可选择隐藏头像；仍保留 contract DOM。
      assert(avatar.box.width > 0 && avatar.box.height > 0, `${id}@${version}: avatar 为 0x0`)
      assert(Math.abs(avatar.box.width - avatar.box.height) <= 1, `${id}@${version}: avatar 非正方形`)
      assert(avatar.objectFit === 'cover', `${id}@${version}: avatar 未使用 object-fit: cover`)
      if (avatar.classes.includes('tm-avatar--message')) assert(avatar.box.width >= 28 && avatar.box.width <= 44, `${id}@${version}: message avatar 尺寸越界 ${avatar.box.width}px`)
      if (avatar.classes.includes('tm-avatar--participant')) assert(avatar.box.width >= 18 && avatar.box.width <= 28, `${id}@${version}: participant avatar 尺寸越界 ${avatar.box.width}px`)
    }
    for (const message of metrics.messages) {
      assert(message.body && message.body.width > 0, `${id}@${version}: message 正文无可用宽度`)
      assert(message.body.right <= width + 1, `${id}@${version}: message 正文越出 viewport`)
      assert(!message.authorTimestampOverlap, `${id}@${version}: nickname 与 timestamp 重叠`)
      if (message.avatar) {
        const separated = message.avatar.right <= message.body.left + 1 || message.body.right <= message.avatar.left + 1
        assert(separated, `${id}@${version}: avatar 挤压正文`)
      }
    }
    assert(externalRequests.length === 0, `${id}@${version}: 禁止外部网络请求 ${externalRequests.join(', ')}`)
    assert(failedResponses.length === 0, `${id}@${version}: 资源加载失败 ${failedResponses.join(', ')}`)
    const screenshot = path.join(evidenceRoot, `${id.replaceAll('.', '-')}-${version}-${width}.png`)
    await page.screenshot({ path: screenshot, fullPage: true })
    return { width, screenshot, metrics }
  } finally {
    await page.close()
  }
}

const main = async () => {
  assert(fixture.metadata && fixture.report, `缺少 TraceMemo fixture：${fixturePath}`)
  fs.mkdirSync(evidenceRoot, { recursive: true })
  const entries = sourceTemplates().map(sourceEntry)
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'tracememo-production-fragments-user-'))
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tracememo-production-fragments-output-'))
  let app
  let browser
  try {
    app = await electron.launch({
      executablePath: electronExecutable,
      args: [path.join(tmRoot, 'out', 'main', 'reportTemplateTest.js')],
      env: { ...process.env, TRACEMEMO_TEMPLATE_TEST_USER_DATA: userData, TRACEMEMO_REPORT_OUTPUT_DIR: outputDir }
    })
    const appPage = await app.firstWindow()
    await appPage.waitForLoadState('domcontentloaded')
    browser = await chromium.launch({ headless: true })
    const results = []
    for (const entry of entries) {
      const installed = await appPage.evaluate((packagePath) => window.api.installReportTemplate(packagePath), entry.packagePath)
      assert(installed.success, `${entry.id}@${entry.version}: 安装失败 ${installed.error || ''}`)
      const exported = await appPage.evaluate(
        ({ id, version, metadata, report }) => window.api.exportGroupReport({ templateRef: { id, version }, metadata, report }),
        { id: entry.id, version: entry.version, ...fixture }
      )
      assert(exported.success && exported.htmlPath && exported.pngPath, `${entry.id}@${entry.version}: 导出失败 ${exported.error || ''}`)
      const html = fs.readFileSync(exported.htmlPath, 'utf8')
      assert(html.includes('tm-production-fragment-contract'), `${entry.id}@${entry.version}: 导出 HTML 缺少 contract`)
      assert(!html.includes('assets/'), `${entry.id}@${entry.version}: 包内 assets 未被内联到导出 HTML`)
      const png = pngInfo(exported.pngPath)
      assert(png.width === entry.manifest.capture.width && png.bytes > 1000, `${entry.id}@${entry.version}: 导出 PNG 异常`)
      const desktop = await inspectAt(browser, exported.htmlPath, entry.id, entry.version, 1000)
      const mobile = await inspectAt(browser, exported.htmlPath, entry.id, entry.version, 430)
      results.push({ id: entry.id, version: entry.version, export: { htmlPath: exported.htmlPath, pngPath: exported.pngPath, png }, desktop, mobile })
    }
    fs.writeFileSync(path.join(evidenceRoot, 'results.json'), JSON.stringify({ fixturePath, tmRoot, results }, null, 2) + '\n')
    console.log(JSON.stringify({ validated: results.map(({ id, version }) => `${id}@${version}`), evidenceRoot }, null, 2))
  } finally {
    if (browser) await browser.close().catch(() => undefined)
    if (app) await app.close().catch(() => undefined)
    fs.rmSync(userData, { recursive: true, force: true })
    fs.rmSync(outputDir, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error?.stack || error)
  process.exitCode = 1
})

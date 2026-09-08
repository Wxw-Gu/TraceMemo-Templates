#!/usr/bin/env node
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const { execFileSync } = require('node:child_process')
const tmRoot = process.env.TRACEMEMO_ROOT || path.resolve(root, '..', 'TraceMemo')
const fixture = JSON.parse(fs.readFileSync(path.join(root, 'fixtures', 'daily-report.json'), 'utf8'))
const templates = [
  ['community.github.tracememo.quickread', 430],
  ['community.github.tracememo.paperdaily', 430],
  ['community.github.tracememo.teamboard', 1440]
]

const esc = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
const html = {
  topics: fixture.topics.map((item) => `<article class="topic"><div class="topic-head"><h3>${esc(item.title)}</h3><span class="heat">${esc(item.heat)}热 · ${esc(item.time)}</span></div><p>${esc(item.summary)}</p><div class="conclusion">结论：${esc(item.conclusion)}</div><small>${esc(item.participants)}</small></article>`).join(''),
  messages: fixture.messages.map((item) => `<article class="message"><time>${esc(item.time)}</time><div><strong>${esc(item.sender)}</strong><p>${esc(item.content)}</p><small>${esc(item.note)}</small></div></article>`).join(''),
  quotes: `<blockquote class="quote">“${esc(fixture.quotes[0].text)}”<br>${esc(fixture.quotes[0].reply)}<small>${esc(fixture.quotes[0].note)}</small></blockquote>`,
  todos: fixture.todos.map((item) => `<article class="action"><b>${esc(item.task)}</b><div>${esc(item.owner)} · ${esc(item.deadline)}</div></article>`).join(''),
  unresolved: fixture.unresolved.map((item) => `<article class="action unresolved"><b>${esc(item.question)}</b><div>${esc(item.owner)} · ${esc(item.status)}</div></article>`).join(''),
  qa: fixture.qa.map((item) => `<div><b>Q：${esc(item.question)}</b><br>A：${esc(item.answer)} · ${esc(item.answerer)}</div>`).join('')
}
const values = {
  REPORT_TITLE: `${fixture.metadata.groupName}日报`, REPORT_DATE: fixture.metadata.reportDate, GROUP_NAME: fixture.metadata.groupName, DATE_RANGE: fixture.metadata.dateRange,
  RECORD_NOTE: fixture.metadata.recordNote, GENERATED_AT: fixture.metadata.generatedAt, FOOTER_NOTE: '示例数据仅用于模板预览。',
  HERO_HEADLINE: fixture.summary.headline, HERO_SUMMARY: fixture.summary.overview, HERO_TAKEAWAY: fixture.summary.takeaway, HERO_PENDING: fixture.summary.pending, HERO_STATUS_LINE: fixture.summary.statusLine,
  MESSAGE_COUNT: fixture.stats.messages, ACTIVE_USERS: fixture.stats.activeUsers, TIME_SPAN: fixture.stats.timeSpan, TOPIC_COUNT: fixture.stats.topics, MEDIA_COUNT: fixture.stats.media, CONCLUSION_COUNT: fixture.stats.conclusions, TODO_COUNT: fixture.stats.todos, UNRESOLVED_COUNT: fixture.stats.unresolved,
  TEMPLATE_CLASS: '', REPORT_MODE_CLASS: 'full', TEMPLATE_LABEL: '社区模板', TEMPLATE_NAME: 'TraceMemo',
  HERO_AVATARS: '', TOPIC_CARDS: html.topics, IMPORTANT_MESSAGES: html.messages, QUOTE_BLOCKS: html.quotes, QA_CARDS: html.qa, RESOURCE_ITEMS: '', TODO_CARDS: html.todos, UNRESOLVED_CARDS: html.unresolved,
  HERO_AVATAR_CLASS: 'empty-section', HERO_STATUS_EMPTY_CLASS: '', HERO_TAKEAWAY_EMPTY_CLASS: '', HERO_PENDING_EMPTY_CLASS: '', TOPICS_EMPTY_CLASS: '', MESSAGES_EMPTY_CLASS: '', QUOTES_EMPTY_CLASS: '', ACTIONS_EMPTY_CLASS: '', QA_EMPTY_CLASS: ''
}

function renderTemplate(source) {
  let output = source
  for (const [key, value] of Object.entries(values)) {
    const kind = new Set(['TOPIC_CARDS', 'IMPORTANT_MESSAGES', 'QUOTE_BLOCKS', 'QA_CARDS', 'RESOURCE_ITEMS', 'TODO_CARDS', 'UNRESOLVED_CARDS']).has(key) ? String(value || '') : esc(value)
    output = output.replaceAll(`{{${key}}}`, kind)
  }
  return output.replace(/\{\{[A-Z0-9_]+\}\}/g, '')
}

async function main() {
  let playwright
  try { playwright = require(path.join(tmRoot, 'node_modules', 'playwright')) } catch (error) {
    console.error(`找不到 Playwright，请设置 TRACEMEMO_ROOT 指向 TraceMemo checkout：${error.message}`)
    process.exit(1)
  }
  const outputDir = path.join(root, 'previews')
  fs.mkdirSync(outputDir, { recursive: true })
  const browser = await playwright.chromium.launch({ headless: true })
  try {
    for (const [id, width] of templates) {
      if (id === 'community.github.tracememo.paperdaily' && fs.existsSync(path.join(root, 'templates', id, '1.0.1', 'template.html'))) {
        execFileSync(process.execPath, [path.join(__dirname, 'render-paperdaily-production-preview.cjs')], { stdio: 'inherit', env: { ...process.env, TEMPLATE_VERSION: '1.0.1' } })
        continue
      }
      const sourcePath = path.join(root, 'templates', id, '1.0.0', 'template.html')
      const htmlPath = path.join(root, '.tmp', `${id}.html`)
      fs.mkdirSync(path.dirname(htmlPath), { recursive: true })
      fs.writeFileSync(htmlPath, renderTemplate(fs.readFileSync(sourcePath, 'utf8')))
      const page = await browser.newPage({ viewport: { width, height: 1200 }, deviceScaleFactor: 1 })
      await page.goto(`file://${htmlPath}`)
      await page.screenshot({ path: path.join(outputDir, `${id}.png`), fullPage: true })
      await page.close()
      fs.rmSync(htmlPath, { force: true })
      console.log(`rendered previews/${id}.png`)
    }
  } finally { await browser.close() }
}
main().catch((error) => { console.error(error); process.exit(1) })

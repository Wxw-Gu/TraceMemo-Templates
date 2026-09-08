#!/usr/bin/env node
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

const root = path.resolve(__dirname, '..')
const repo = 'Wxw-Gu/TraceMemo-Templates'
const ids = ['community.github.tracememo.quickread', 'community.github.tracememo.paperdaily', 'community.github.tracememo.teamboard']
const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/
const placeholderKinds = {
  text: new Set(['REPORT_TITLE','REPORT_DATE','GROUP_NAME','DATE_RANGE','RECORD_NOTE','OVERVIEW','HERO_HEADLINE','HERO_SUMMARY','HERO_TAKEAWAY','HERO_PENDING','HERO_STATUS_LINE','MESSAGE_COUNT','ACTIVE_USERS','TIME_SPAN','TOPIC_COUNT','MEDIA_COUNT','CONCLUSION_COUNT','TODO_COUNT','UNRESOLVED_COUNT','GENERATED_AT','FOOTER_NOTE','TEMPLATE_LABEL','TEMPLATE_NAME']),
  html: new Set(['HERO_AVATARS','TOPIC_CARDS','IMPORTANT_MESSAGES','QUOTE_BLOCKS','QA_CARDS','RESOURCE_ITEMS','TODO_CARDS','UNRESOLVED_CARDS','TOPICS_MORE_NOTE','MESSAGES_MORE_NOTE']),
  class: new Set(['TEMPLATE_CLASS','REPORT_MODE_CLASS','HERO_AVATAR_CLASS','HERO_STATUS_EMPTY_CLASS','HERO_TAKEAWAY_EMPTY_CLASS','HERO_PENDING_EMPTY_CLASS','TOPICS_EMPTY_CLASS','MESSAGES_EMPTY_CLASS','QUOTES_EMPTY_CLASS','ACTIONS_EMPTY_CLASS','QA_EMPTY_CLASS'])
}
const allPlaceholders = new Map(Object.entries(placeholderKinds).flatMap(([kind, keys]) => [...keys].map((key) => [key, kind])))

const compareVersions = (left, right) => {
  const parse = (value) => value.split('-')[0].split('.').map(Number)
  const a = parse(left)
  const b = parse(right)
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index]
  }
  return left.localeCompare(right)
}

const versionsFor = (id) => fs.readdirSync(path.join(root, 'templates', id), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && semverPattern.test(entry.name))
  .map((entry) => entry.name)
  .sort(compareVersions)

const previewNameFor = (id, version) => {
  const candidates = [`${id}-${version}.png`, `${id}.png`]
  const name = candidates.find((candidate) => fs.existsSync(path.join(root, 'previews', candidate)))
  if (!name) throw new Error(`${id}@${version}: 缺少预览图`)
  return name
}

const validateTemplate = (id, version) => {
  const dir = path.join(root, 'templates', id, version)
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'))
  if (manifest.protocolVersion !== '1.0' || manifest.interfaceVersion !== '1' || manifest.kind !== 'daily-report') throw new Error(`${id}@${version}: 协议字段不匹配`)
  if (manifest.id !== id || !/^community\.github\.[a-z0-9-]+\.[a-z0-9-]+$/.test(manifest.id)) throw new Error(`${id}@${version}: ID 不符合 TM 规则`)
  if (manifest.templateVersion !== version || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(manifest.templateVersion)) throw new Error(`${id}@${version}: 版本不是 semver 或目录不一致`)
  if (!manifest.entry || !fs.existsSync(path.join(dir, manifest.entry))) throw new Error(`${id}@${version}: 缺少入口文件`)
  const html = fs.readFileSync(path.join(dir, manifest.entry), 'utf8')
  for (const [, key] of html.matchAll(/\{\{([A-Z0-9_]+)\}\}/g)) if (!allPlaceholders.has(key)) throw new Error(`${id}@${version}: 未知占位符 ${key}`)
  if (/<script\b|\s+on[a-z]+\s*=|<iframe\b|@import\b|https?:\/\//i.test(html)) throw new Error(`${id}@${version}: 含不允许的脚本或外链`)
  const packagePath = path.join(root, 'packages', id, version, `${id}-${version}.zip`)
  if (fs.existsSync(packagePath) && fs.statSync(packagePath).size === 0) throw new Error(`${id}@${version}: ZIP 为空`)
  return manifest
}

const manifests = new Map()
for (const id of ids) {
  const versions = versionsFor(id)
  if (versions.length === 0) throw new Error(`${id}: 没有模板版本`)
  for (const version of versions) manifests.set(`${id}@${version}`, validateTemplate(id, version))
}

const validateCatalog = (source, catalog, expectedStatus) => {
  if (catalog.schemaVersion !== '1' || catalog.status !== expectedStatus || !Array.isArray(catalog.templates) || catalog.templates.length !== ids.length) {
    throw new Error(`${source}: 目录字段或条目数量不正确`)
  }
  if (catalog.source?.repository !== repo || !/^[0-9a-f]{40}$/.test(catalog.source?.commit || '')) throw new Error(`${source}: source.commit 必须是当前固定提交 SHA`)
  const seen = new Set()
  for (const entry of catalog.templates) {
    if (!ids.includes(entry.id) || seen.has(entry.id)) throw new Error(`${source}: 未知或重复模板 ${entry.id}`)
    seen.add(entry.id)
    if (entry.status !== expectedStatus) throw new Error(`${entry.id}: 目录状态不是 ${expectedStatus}`)
    const manifest = manifests.get(`${entry.id}@${entry.version}`)
    if (!manifest) throw new Error(`${source}: ${entry.id}@${entry.version} 不存在于模板源码`)
    if (entry.interfaceVersion !== manifest.interfaceVersion || entry.version !== manifest.templateVersion) throw new Error(`${entry.id}: 目录版本或接口版本不匹配`)
    const packagePath = path.join(root, 'packages', entry.id, entry.version, `${entry.id}-${entry.version}.zip`)
    if (!fs.existsSync(packagePath)) throw new Error(`${entry.id}: 缺少目录引用的 ZIP`)
    const stat = fs.statSync(packagePath)
    const digest = crypto.createHash('sha256').update(fs.readFileSync(packagePath)).digest('hex')
    if (entry.sha256 !== digest || entry.sizeBytes !== stat.size) throw new Error(`${entry.id}: 目录哈希或大小不一致`)
    const expectedDownload = `https://raw.githubusercontent.com/${repo}/${catalog.source.commit}/packages/${entry.id}/${entry.version}/${entry.id}-${entry.version}.zip`
    const expectedPreview = `https://raw.githubusercontent.com/${repo}/${catalog.source.commit}/previews/${previewNameFor(entry.id, entry.version)}`
    if (entry.download !== expectedDownload || entry.preview !== expectedPreview) throw new Error(`${entry.id}: 下载或预览 URL 没有固定到 source.commit`)
  }
}

if (process.argv.includes('--catalog')) {
  const draft = JSON.parse(fs.readFileSync(path.join(root, 'catalog', 'v1', 'drafts', 'index.json'), 'utf8'))
  const published = JSON.parse(fs.readFileSync(path.join(root, 'catalog', 'v1', 'index.json'), 'utf8'))
  validateCatalog('草稿目录', draft, 'draft')
  validateCatalog('正式目录', published, 'published')
  if (draft.source.commit !== published.source.commit) throw new Error('草稿和正式目录必须引用同一个 source.commit')
}

console.log(`validated ${ids.length} templates across ${[...manifests.keys()].length} versions${process.argv.includes('--catalog') ? ' and catalog' : ''}`)

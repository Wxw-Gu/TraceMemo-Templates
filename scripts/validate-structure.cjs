#!/usr/bin/env node
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { execFileSync } = require('node:child_process')

const root = path.resolve(__dirname, '..')
const repo = 'Wxw-Gu/TraceMemo-Templates'
const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/
const templateIdPattern = /^community\.github\.[a-z0-9-]+\.[a-z0-9-]+$/
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

const sourceTemplates = () => {
  const templatesRoot = path.join(root, 'templates')
  const ids = fs.readdirSync(templatesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()

  if (ids.length === 0) throw new Error('templates/: 没有模板源码')

  return ids.map((id) => {
    if (!templateIdPattern.test(id)) throw new Error(`templates/${id}: 模板 ID 不符合 TM 规则`)
    const versions = fs.readdirSync(path.join(templatesRoot, id), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort(compareVersions)
    if (versions.length === 0) throw new Error(`templates/${id}: 没有模板版本`)
    for (const version of versions) {
      if (!semverPattern.test(version)) throw new Error(`templates/${id}/${version}: 版本不是 semver`)
    }
    return { id, versions }
  })
}

const safeRelativePath = (value) => typeof value === 'string' && value.length > 0 &&
  !path.isAbsolute(value) && !value.split(/[\\/]/).includes('..') && !value.includes('\\')

const sourceFilesInAssets = (templateDir) => {
  const assetsDir = path.join(templateDir, 'assets')
  if (!fs.existsSync(assetsDir)) return []
  const files = []
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const filePath = path.join(dir, entry.name)
      if (entry.isDirectory()) visit(filePath)
      else if (entry.isFile()) files.push(path.relative(templateDir, filePath).split(path.sep).join('/'))
      else throw new Error(`${path.relative(root, filePath)}: assets 只能包含普通文件或目录`)
    }
  }
  visit(assetsDir)
  return files.sort()
}

const validatePackage = (id, version, templateDir, manifest) => {
  const packagePath = path.join(root, 'packages', id, version, `${id}-${version}.zip`)
  if (!fs.existsSync(packagePath)) throw new Error(`${id}@${version}: 缺少安装包`)
  if (fs.statSync(packagePath).size === 0) throw new Error(`${id}@${version}: ZIP 为空`)

  let entries
  try {
    entries = execFileSync('unzip', ['-Z', '-1', packagePath], { encoding: 'utf8' })
      .split(/\r?\n/)
      .filter(Boolean)
  } catch (error) {
    throw new Error(`${id}@${version}: 无法读取 ZIP 内容：${error.message}`)
  }
  if (entries.length !== new Set(entries).size) throw new Error(`${id}@${version}: ZIP 包含重复文件`)
  if (entries.some((entry) => !safeRelativePath(entry))) throw new Error(`${id}@${version}: ZIP 包含不安全路径`)

  const assetFiles = sourceFilesInAssets(templateDir)
  const expectedFiles = ['manifest.json', manifest.entry, manifest.preview, ...assetFiles]
  const expected = new Set(expectedFiles)
  if (expected.size !== expectedFiles.length) throw new Error(`${id}@${version}: manifest 的入口或预览文件重复`)
  const files = entries.filter((entry) => !entry.endsWith('/'))
  for (const file of expected) {
    if (!files.includes(file)) throw new Error(`${id}@${version}: ZIP 缺少 ${file}`)
  }
  for (const file of files) {
    if (!expected.has(file)) throw new Error(`${id}@${version}: ZIP 包含未声明文件 ${file}`)
  }
  for (const directory of entries.filter((entry) => entry.endsWith('/'))) {
    if (!directory.startsWith('assets/') || !assetFiles.some((file) => file.startsWith(directory))) {
      throw new Error(`${id}@${version}: ZIP 包含未声明目录 ${directory}`)
    }
  }
  for (const file of expected) {
    const archived = execFileSync('unzip', ['-p', packagePath, file])
    const source = fs.readFileSync(path.join(templateDir, file))
    if (!archived.equals(source)) throw new Error(`${id}@${version}: ZIP 中的 ${file} 与模板源码不一致`)
  }
  return packagePath
}

const previewNameFor = (id, version) => {
  const candidates = [`${id}-${version}.png`, `${id}.png`]
  const name = candidates.find((candidate) => fs.existsSync(path.join(root, 'previews', candidate)))
  if (!name) throw new Error(`${id}@${version}: 缺少预览图`)
  return name
}

const validateTemplate = (id, version) => {
  const dir = path.join(root, 'templates', id, version)
  const manifestPath = path.join(dir, 'manifest.json')
  if (!fs.existsSync(manifestPath)) throw new Error(`${id}@${version}: 缺少 manifest.json`)
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  if (manifest.protocolVersion !== '1.0' || manifest.interfaceVersion !== '1' || manifest.kind !== 'daily-report') throw new Error(`${id}@${version}: 协议字段不匹配`)
  if (manifest.id !== id || !templateIdPattern.test(manifest.id)) throw new Error(`${id}@${version}: ID 不符合 TM 规则`)
  if (manifest.templateVersion !== version || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(manifest.templateVersion)) throw new Error(`${id}@${version}: 版本不是 semver 或目录不一致`)
  if (!safeRelativePath(manifest.entry) || !fs.existsSync(path.join(dir, manifest.entry))) throw new Error(`${id}@${version}: 缺少入口文件`)
  if (!safeRelativePath(manifest.preview) || !fs.existsSync(path.join(dir, manifest.preview))) throw new Error(`${id}@${version}: 缺少预览图`)
  const html = fs.readFileSync(path.join(dir, manifest.entry), 'utf8')
  for (const [, key] of html.matchAll(/\{\{([A-Z0-9_]+)\}\}/g)) if (!allPlaceholders.has(key)) throw new Error(`${id}@${version}: 未知占位符 ${key}`)
  if (/<script\b|\s+on[a-z]+\s*=|<iframe\b|@import\b|https?:\/\//i.test(html)) throw new Error(`${id}@${version}: 含不允许的脚本或外链`)
  const previewName = previewNameFor(id, version)
  const packagePath = validatePackage(id, version, dir, manifest)
  return { manifest, packagePath, previewName }
}

const manifests = new Map()
const discoveredTemplates = sourceTemplates()
for (const { id, versions } of discoveredTemplates) {
  for (const version of versions) manifests.set(`${id}@${version}`, validateTemplate(id, version))
}

const validateCatalog = (source, catalog, expectedStatus) => {
  if (catalog.schemaVersion !== '1' || catalog.status !== expectedStatus || !Array.isArray(catalog.templates)) {
    throw new Error(`${source}: 目录字段不正确`)
  }
  if (catalog.source?.repository !== repo || !/^[0-9a-f]{40}$/.test(catalog.source?.commit || '')) throw new Error(`${source}: source.commit 必须是当前固定提交 SHA`)
  const seen = new Set()
  for (const entry of catalog.templates) {
    if (seen.has(entry.id)) throw new Error(`${source}: 重复模板 ${entry.id}`)
    seen.add(entry.id)
    if (entry.status !== expectedStatus) throw new Error(`${entry.id}: 目录状态不是 ${expectedStatus}`)
    const sourceTemplate = manifests.get(`${entry.id}@${entry.version}`)
    if (!sourceTemplate) throw new Error(`${source}: ${entry.id}@${entry.version} 不存在于模板源码`)
    const { manifest, packagePath, previewName } = sourceTemplate
    if (entry.interfaceVersion !== manifest.interfaceVersion || entry.version !== manifest.templateVersion) throw new Error(`${entry.id}: 目录版本或接口版本不匹配`)
    const stat = fs.statSync(packagePath)
    const digest = crypto.createHash('sha256').update(fs.readFileSync(packagePath)).digest('hex')
    if (entry.sha256 !== digest || entry.sizeBytes !== stat.size) throw new Error(`${entry.id}: 目录哈希或大小不一致`)
    const expectedDownload = `https://raw.githubusercontent.com/${repo}/${catalog.source.commit}/packages/${entry.id}/${entry.version}/${entry.id}-${entry.version}.zip`
    const expectedPreview = `https://raw.githubusercontent.com/${repo}/${catalog.source.commit}/previews/${previewName}`
    if (entry.download !== expectedDownload || entry.preview !== expectedPreview) throw new Error(`${entry.id}: 下载或预览 URL 没有固定到 source.commit`)
  }
}

if (process.argv.includes('--catalog')) {
  const draft = JSON.parse(fs.readFileSync(path.join(root, 'catalog', 'v1', 'drafts', 'index.json'), 'utf8'))
  const published = JSON.parse(fs.readFileSync(path.join(root, 'catalog', 'v1', 'index.json'), 'utf8'))
  validateCatalog('草稿目录', draft, 'draft')
  validateCatalog('正式目录', published, 'published')
}

console.log(`validated ${discoveredTemplates.length} templates across ${[...manifests.keys()].length} versions${process.argv.includes('--catalog') ? ' and catalog' : ''}`)

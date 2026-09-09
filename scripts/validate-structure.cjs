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
  text: new Set(['REPORT_TITLE','REPORT_DATE','GROUP_NAME','DATE_RANGE','RECORD_NOTE','OVERVIEW','HERO_HEADLINE','HERO_SUMMARY','HERO_TAKEAWAY','HERO_PENDING','HERO_STATUS_LINE','MESSAGE_COUNT','ACTIVE_USERS','TIME_SPAN','TOPIC_COUNT','MEDIA_COUNT','CONCLUSION_COUNT','TODO_COUNT','UNRESOLVED_COUNT','ACTIVITY_TIMELINE','GENERATED_AT','FOOTER_NOTE','TEMPLATE_LABEL','TEMPLATE_NAME']),
  html: new Set(['HERO_AVATARS','TOPIC_CARDS','IMPORTANT_MESSAGES','QUOTE_BLOCKS','QA_CARDS','RESOURCE_ITEMS','TODO_CARDS','UNRESOLVED_CARDS','STORYLINE_CARDS','REVERSAL_CARDS','CHAIN_CARDS','VISION_CARDS','VOICE_CARDS','VOICE_RANK_CARDS','BADGE_CARDS','RANK_ITEMS','HEAT_BARS','CLOUD_TAGS','TOPICS_MORE_NOTE','MESSAGES_MORE_NOTE','QUOTES_MORE_NOTE','ACTIONS_MORE_NOTE','QA_MORE_NOTE','RESOURCES_MORE_NOTE','STORYLINES_MORE_NOTE','REVERSALS_MORE_NOTE','CHAINS_MORE_NOTE','VISION_MORE_NOTE','VOICE_MORE_NOTE','VOICE_RANK_MORE_NOTE','BADGES_MORE_NOTE','KEYWORDS_MORE_NOTE']),
  class: new Set(['TEMPLATE_CLASS','REPORT_MODE_CLASS','HERO_AVATAR_CLASS','HERO_STATUS_EMPTY_CLASS','HERO_TAKEAWAY_EMPTY_CLASS','HERO_PENDING_EMPTY_CLASS','TOPICS_EMPTY_CLASS','MESSAGES_EMPTY_CLASS','QUOTES_EMPTY_CLASS','ACTIONS_EMPTY_CLASS','QA_EMPTY_CLASS','RESOURCES_EMPTY_CLASS','STORYLINES_EMPTY_CLASS','REVERSALS_EMPTY_CLASS','CHAINS_EMPTY_CLASS','VISION_EMPTY_CLASS','VOICE_EMPTY_CLASS','VOICE_RANK_EMPTY_CLASS','BADGES_EMPTY_CLASS','KEYWORDS_EMPTY_CLASS','ANALYTICS_EMPTY_CLASS','TODO_EMPTY_CLASS','UNRESOLVED_EMPTY_CLASS'])
}
const allPlaceholders = new Map(Object.entries(placeholderKinds).flatMap(([kind, keys]) => [...keys].map((key) => [key, kind])))
const allowedTags = new Set(['html','head','body','meta','title','style','main','section','article','header','footer','div','span','p','h1','h2','h3','h4','b','strong','em','i','small','ul','ol','li','table','thead','tbody','tr','th','td','img','br'])
const allowedAttrs = new Set(['class','id','title','aria-hidden','aria-label','alt','width','height','role','content','charset','name','src'])
const allowedAssetExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp'])
const retiredVersionsPath = path.join(root, 'catalog', 'v1', 'retired-versions.json')
const publishMetadataPath = path.join(root, 'catalog', 'v1', 'publish-metadata.json')

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

const retiredVersions = () => {
  if (!fs.existsSync(retiredVersionsPath)) return new Set()
  const retired = JSON.parse(fs.readFileSync(retiredVersionsPath, 'utf8'))
  if (retired.schemaVersion !== '1' || !retired.templates || typeof retired.templates !== 'object') {
    throw new Error('catalog/v1/retired-versions.json: 格式不正确')
  }
  const versions = new Set()
  for (const [id, entries] of Object.entries(retired.templates)) {
    if (!templateIdPattern.test(id) || !entries || typeof entries !== 'object' || Array.isArray(entries)) {
      throw new Error(`catalog/v1/retired-versions.json: 无效模板 ${id}`)
    }
    for (const [version, detail] of Object.entries(entries)) {
      if (!semverPattern.test(version) || !detail || typeof detail !== 'object' || typeof detail.reason !== 'string' || !detail.reason.trim()) {
        throw new Error(`catalog/v1/retired-versions.json: ${id}@${version} 缺少撤回原因`)
      }
      versions.add(`${id}@${version}`)
    }
  }
  return versions
}

const validateMarket = (id, version, dir) => {
  const marketPath = path.join(dir, 'market.json')
  if (!fs.existsSync(marketPath)) throw new Error(`${id}@${version}: 缺少 market.json`)
  const market = JSON.parse(fs.readFileSync(marketPath, 'utf8'))
  const invalidText = (value, maxLength) => typeof value !== 'string' || !value.trim() || value.length > maxLength ||
    /[<>]/.test(value) || /\b(?:javascript|data):/i.test(value)
  if (!market || typeof market !== 'object' || Array.isArray(market) || Object.keys(market).some((key) => !['description', 'tags'].includes(key)) ||
    invalidText(market.description, 160) || !Array.isArray(market.tags) || market.tags.length === 0 || market.tags.length > 8 ||
    market.tags.some((tag) => invalidText(tag, 24)) || new Set(market.tags.map((tag) => tag.trim())).size !== market.tags.length) {
    throw new Error(`${id}@${version}: market.json 的 description 或 tags 不合法`)
  }
  return { description: market.description.trim(), tags: market.tags.map((tag) => tag.trim()) }
}

const publishMetadata = () => {
  const metadata = JSON.parse(fs.readFileSync(publishMetadataPath, 'utf8'))
  if (metadata.schemaVersion !== '1' || !metadata.templates || typeof metadata.templates !== 'object' || Array.isArray(metadata.templates)) {
    throw new Error('catalog/v1/publish-metadata.json: 格式不正确')
  }
  const templates = new Map()
  for (const [id, entry] of Object.entries(metadata.templates)) {
    if (!templateIdPattern.test(id) || !entry || typeof entry !== 'object' || Array.isArray(entry) || !semverPattern.test(entry.version) ||
      Object.keys(entry).some((key) => key !== 'version')) {
      throw new Error(`catalog/v1/publish-metadata.json: ${id} 必须只声明有效的 version`)
    }
    templates.set(id, entry.version)
  }
  return templates
}

const validateTemplateHtml = (html, fileName) => {
  const placeholders = [...html.matchAll(/\{\{([A-Z0-9_]+)\}\}/g)].map((match) => match[1])
  for (const key of placeholders) {
    if (!allPlaceholders.has(key)) throw new Error(`${fileName}: 未知占位符 ${key}`)
  }

  const tagPattern = /<\/?([A-Za-z][A-Za-z0-9-]*)([^<>]*)>/g
  for (const match of html.matchAll(tagPattern)) {
    const tag = match[1].toLowerCase()
    const source = match[0]
    if (!allowedTags.has(tag)) throw new Error(`${fileName}: 不允许标签 <${tag}>`)
    if (source.startsWith('</')) continue
    const attrs = match[2] || ''
    const attrPattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
    for (const attr of attrs.matchAll(attrPattern)) {
      const name = attr[1].toLowerCase()
      const value = attr[2] ?? attr[3] ?? attr[4] ?? ''
      // parseFragment 会忽略完整文档的 html/head/body 包装属性；保留 lang 以免静态目录校验误拒绝这些包装标签。
      if (!allowedAttrs.has(name) && !(tag === 'html' && name === 'lang') || name.startsWith('on')) {
        throw new Error(`${fileName}: 不允许属性 ${name}`)
      }
      if (/\{\{[A-Z0-9_]+\}\}/.test(value)) {
        const keys = [...value.matchAll(/\{\{([A-Z0-9_]+)\}\}/g)].map((placeholder) => placeholder[1])
        if (name !== 'class' || keys.some((key) => allPlaceholders.get(key) !== 'class')) {
          throw new Error(`${fileName}: 占位符不能出现在 ${name} 属性中`)
        }
      }
      if (name === 'src') {
        const assetPath = path.posix.normalize(value.replace(/\\/g, '/'))
        if (!assetPath.startsWith('assets/') || !allowedAssetExtensions.has(path.posix.extname(assetPath).toLowerCase())) {
          throw new Error(`${fileName}: src 只允许 assets/ 下的 PNG/JPEG/WebP`)
        }
      }
    }
  }

  for (const match of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
    const css = match[1]
    if (/\{\{[A-Z0-9_]+\}\}/.test(css)) throw new Error(`${fileName}: 占位符不能出现在 style 中`)
    if (/@import\b/i.test(css)) throw new Error(`${fileName}: 不允许 CSS @import`)
    if (/url\(\s*['"]?\s*(?:https?:|file:|data:|javascript:)/i.test(css)) {
      throw new Error(`${fileName}: CSS 包含危险资源 URL`)
    }
    if (/(?:^|[;}\n])\s*(?:\*|img|[A-Za-z][\w-]*(?:\s+[A-Za-z][\w-]*)*\s+img)\s*\{[^}]*\b(?:width|height)\s*:/i.test(css)) {
      console.warn(`${fileName}: 警告：宽泛图片尺寸 selector 可能误伤模板插图；production avatar 会受 contract 保护，但请优先使用语义 selector`)
    }
  }
}

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
  const market = validateMarket(id, version, dir)
  const html = fs.readFileSync(path.join(dir, manifest.entry), 'utf8')
  validateTemplateHtml(html, `${id}@${version}/${manifest.entry}`)
  const previewName = previewNameFor(id, version)
  const packagePath = validatePackage(id, version, dir, manifest)
  return { manifest, packagePath, previewName, market }
}

const manifests = new Map()
const discoveredTemplates = sourceTemplates()
const retired = retiredVersions()
const publishedVersions = publishMetadata()
const validateRetired = process.env.VALIDATE_RETIRED === '1'
for (const { id, versions } of discoveredTemplates) {
  for (const version of versions) {
    const key = `${id}@${version}`
    if (retired.has(key) && !validateRetired) continue
    manifests.set(key, validateTemplate(id, version))
  }
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
    if (retired.has(`${entry.id}@${entry.version}`)) throw new Error(`${source}: ${entry.id}@${entry.version} 已撤回，不能出现在 catalog`)
    const { manifest, packagePath, previewName, market } = sourceTemplate
    if (entry.interfaceVersion !== manifest.interfaceVersion || entry.version !== manifest.templateVersion) throw new Error(`${entry.id}: 目录版本或接口版本不匹配`)
    if (entry.description !== market.description || JSON.stringify(entry.tags) !== JSON.stringify(market.tags)) throw new Error(`${entry.id}: 目录市场文案与 market.json 不一致`)
    const stat = fs.statSync(packagePath)
    const digest = crypto.createHash('sha256').update(fs.readFileSync(packagePath)).digest('hex')
    if (entry.sha256 !== digest || entry.sizeBytes !== stat.size) throw new Error(`${entry.id}: 目录哈希或大小不一致`)
    const expectedDownload = `https://raw.githubusercontent.com/${repo}/${catalog.source.commit}/packages/${entry.id}/${entry.version}/${entry.id}-${entry.version}.zip`
    const expectedPreview = `https://raw.githubusercontent.com/${repo}/${catalog.source.commit}/previews/${previewName}`
    if (entry.download !== expectedDownload || entry.preview !== expectedPreview) throw new Error(`${entry.id}: 下载或预览 URL 没有固定到 source.commit`)
  }
  if (expectedStatus === 'published') {
    if (seen.size !== publishedVersions.size) throw new Error(`${source}: 与 publish-metadata 的发布条目数量不一致`)
    for (const [id, version] of publishedVersions) {
      if (retired.has(`${id}@${version}`)) throw new Error(`${source}: ${id}@${version} 已撤回，不能发布`)
      if (!manifests.has(`${id}@${version}`)) throw new Error(`${source}: ${id}@${version} 不存在于模板源码`)
      if (!seen.has(id) || catalog.templates.find((entry) => entry.id === id)?.version !== version) {
        throw new Error(`${source}: ${id}@${version} 与 publish-metadata 不一致`)
      }
    }
  }
}

if (process.argv.includes('--catalog')) {
  const draft = JSON.parse(fs.readFileSync(path.join(root, 'catalog', 'v1', 'drafts', 'index.json'), 'utf8'))
  const published = JSON.parse(fs.readFileSync(path.join(root, 'catalog', 'v1', 'index.json'), 'utf8'))
  validateCatalog('草稿目录', draft, 'draft')
  validateCatalog('正式目录', published, 'published')
}

console.log(`validated ${discoveredTemplates.length} templates across ${[...manifests.keys()].length} versions${retired.size && !validateRetired ? ` (${retired.size} retired skipped)` : ''}${process.argv.includes('--catalog') ? ' and catalog' : ''}`)

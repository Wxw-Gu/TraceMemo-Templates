#!/usr/bin/env node
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

const root = path.resolve(__dirname, '..')
const repo = 'Wxw-Gu/TraceMemo-Templates'
const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/
const templateIdPattern = /^community\.github\.[a-z0-9-]+\.[a-z0-9-]+$/
const commit = process.env.CATALOG_COMMIT || 'DRAFT_COMMIT_PENDING'
const generatedAt = process.env.CATALOG_GENERATED_AT || new Date().toISOString()
const publish = process.env.CATALOG_PUBLISH === '1'

if (publish && !/^[0-9a-f]{40}$/.test(commit)) {
  throw new Error('正式目录必须通过 CATALOG_COMMIT 提供 40 位提交 SHA')
}

const safeRelativePath = (value) => typeof value === 'string' && value.length > 0 &&
  !path.isAbsolute(value) && !value.split(/[\\/]/).includes('..') && !value.includes('\\')

const publishMetadataPath = path.join(root, 'catalog', 'v1', 'publish-metadata.json')
const publishMetadata = JSON.parse(fs.readFileSync(publishMetadataPath, 'utf8'))
if (publishMetadata.schemaVersion !== '1' || !publishMetadata.templates || typeof publishMetadata.templates !== 'object') {
  throw new Error('catalog/v1/publish-metadata.json: 元数据格式不正确')
}

const metadataFor = (id) => {
  const metadata = publishMetadata.templates[id]
  if (!metadata || !semverPattern.test(metadata.version) || typeof metadata.description !== 'string' || !metadata.description.trim() ||
    !Array.isArray(metadata.tags) || metadata.tags.length === 0 || metadata.tags.some((tag) => typeof tag !== 'string' || !tag.trim())) {
    throw new Error(`${id}: 缺少有效的 catalog version、description 或 tags 元数据`)
  }
  return { version: metadata.version, description: metadata.description, tags: metadata.tags }
}

const discoverTemplateIds = () => {
  const templatesRoot = path.join(root, 'templates')
  const ids = fs.readdirSync(templatesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((id) => templateIdPattern.test(id))
    .sort()
  if (ids.length === 0) throw new Error('templates/: 没有可发布的模板源码')
  return new Set(ids)
}

const publishableTemplate = ({ id, version }) => {
  const templateDir = path.join(root, 'templates', id, version)
  const manifestPath = path.join(templateDir, 'manifest.json')
  if (!fs.existsSync(manifestPath)) throw new Error(`${id}@${version}: 缺少 manifest.json`)
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  if (manifest.id !== id || manifest.templateVersion !== version || manifest.protocolVersion !== '1.0' ||
    manifest.interfaceVersion !== '1' || manifest.kind !== 'daily-report') {
    throw new Error(`${id}@${version}: manifest 协议或目录字段不匹配`)
  }
  if (!safeRelativePath(manifest.entry) || !fs.existsSync(path.join(templateDir, manifest.entry))) {
    throw new Error(`${id}@${version}: 缺少入口文件`)
  }
  if (!safeRelativePath(manifest.preview) || !fs.existsSync(path.join(templateDir, manifest.preview))) {
    throw new Error(`${id}@${version}: 缺少模板预览图`)
  }
  if (!manifest.name || !manifest.author?.name || !manifest.platform || !manifest.license?.spdx) {
    throw new Error(`${id}@${version}: manifest 缺少 catalog 所需字段`)
  }
  const packagePath = path.join(root, 'packages', id, version, `${id}-${version}.zip`)
  if (!fs.existsSync(packagePath) || fs.statSync(packagePath).size === 0) throw new Error(`${id}@${version}: 缺少非空安装包`)
  const previewCandidates = [`${id}-${version}.png`, `${id}.png`]
  const previewName = previewCandidates.find((name) => fs.existsSync(path.join(root, 'previews', name)))
  if (!previewName) throw new Error(`${id}@${version}: 缺少市场预览图`)
  return { id, version, manifest, packagePath, previewName, metadata: metadataFor(id) }
}

const discoveredTemplateIds = discoverTemplateIds()
const current = Object.keys(publishMetadata.templates)
  .sort()
  .map((id) => {
    if (!discoveredTemplateIds.has(id)) throw new Error(`${id}: publish-metadata 指向不存在的模板源码`)
    const metadata = metadataFor(id)
    return publishableTemplate({ id, version: metadata.version })
  })

const buildEntries = (status) => current.map(({ id, version, manifest, packagePath, previewName, metadata }) => {
  const bytes = fs.readFileSync(packagePath)
  return {
    id: manifest.id,
    version: manifest.templateVersion,
    interfaceVersion: manifest.interfaceVersion,
    name: manifest.name,
    description: metadata.description,
    author: manifest.author.name,
    platform: manifest.platform,
    tags: metadata.tags,
    license: manifest.license.spdx,
    minAppVersion: manifest.minAppVersion || null,
    download: `https://raw.githubusercontent.com/${repo}/${commit}/packages/${id}/${version}/${id}-${version}.zip`,
    sizeBytes: bytes.length,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    preview: `https://raw.githubusercontent.com/${repo}/${commit}/previews/${previewName}`,
    publishedAt: status === 'published' ? generatedAt : null,
    status
  }
})

const buildCatalog = (status) => ({
  schemaVersion: '1',
  generatedAt,
  source: { repository: repo, commit },
  status,
  templates: buildEntries(status)
})

const draftTarget = path.join(root, 'catalog', 'v1', 'drafts', 'index.json')
fs.mkdirSync(path.dirname(draftTarget), { recursive: true })
fs.writeFileSync(draftTarget, `${JSON.stringify(buildCatalog('draft'), null, 2)}\n`)

if (publish) {
  const publishedTarget = path.join(root, 'catalog', 'v1', 'index.json')
  fs.mkdirSync(path.dirname(publishedTarget), { recursive: true })
  fs.writeFileSync(publishedTarget, `${JSON.stringify(buildCatalog('published'), null, 2)}\n`)
  console.log(`wrote ${path.relative(root, publishedTarget)} and ${path.relative(root, draftTarget)} at ${commit}`)
} else {
  console.log(`wrote ${path.relative(root, draftTarget)}; formal catalog unchanged`)
}

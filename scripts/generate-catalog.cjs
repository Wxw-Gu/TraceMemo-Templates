#!/usr/bin/env node
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

const root = path.resolve(__dirname, '..')
const repo = 'Wxw-Gu/TraceMemo-Templates'
const ids = [
  'community.github.tracememo.quickread',
  'community.github.tracememo.paperdaily',
  'community.github.tracememo.teamboard'
]
const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/
const commit = process.env.CATALOG_COMMIT || 'DRAFT_COMMIT_PENDING'
const generatedAt = process.env.CATALOG_GENERATED_AT || new Date().toISOString()
const publish = process.env.CATALOG_PUBLISH === '1'

if (publish && !/^[0-9a-f]{40}$/.test(commit)) {
  throw new Error('正式目录必须通过 CATALOG_COMMIT 提供 40 位提交 SHA')
}

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

const descriptionFor = (id) => id.endsWith('quickread')
  ? '手机单栏，先看摘要、结论和行动项。'
  : id.endsWith('paperdaily')
    ? '手机报纸式编辑版，突出标题、话题和引语。'
    : '桌面宽屏多栏看板，适合团队复盘和归档。'

const tagsFor = (id, platform) => platform === 'desktop'
  ? ['桌面', '看板', '复盘']
  : ['手机', id.endsWith('quickread') ? '速读' : '编辑版']

const findCurrent = (id) => {
  const versions = versionsFor(id).reverse()
  for (const version of versions) {
    const templateDir = path.join(root, 'templates', id, version)
    const manifestPath = path.join(templateDir, 'manifest.json')
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    const packagePath = path.join(root, 'packages', id, version, `${id}-${version}.zip`)
    if (!fs.existsSync(packagePath)) continue
    const previewCandidates = [`${id}-${version}.png`, `${id}.png`]
    const previewName = previewCandidates.find((name) => fs.existsSync(path.join(root, 'previews', name)))
    if (!previewName) throw new Error(`${id}@${version}: 缺少预览图`)
    return { id, version, manifest, packagePath, previewName }
  }
  throw new Error(`${id}: 没有同时存在源码和安装包的有效版本`)
}

const current = ids.map(findCurrent)

const buildEntries = (status) => current.map(({ id, version, manifest, packagePath, previewName }) => {
  const bytes = fs.readFileSync(packagePath)
  return {
    id: manifest.id,
    version: manifest.templateVersion,
    interfaceVersion: manifest.interfaceVersion,
    name: manifest.name,
    description: descriptionFor(id),
    author: manifest.author.name,
    platform: manifest.platform,
    tags: tagsFor(id, manifest.platform),
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

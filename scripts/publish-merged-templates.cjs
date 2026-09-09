#!/usr/bin/env node
/*
 * Publish only template versions reported by one already-merged PR's files API.
 * This script never commits or pushes. The GitHub workflow owns those steps.
 */
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const root = path.resolve(process.env.TEMPLATE_REPO_ROOT || path.join(__dirname, '..'))
const templateIdPattern = /^community\.github\.[a-z0-9-]+\.[a-z0-9-]+$/
const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/

const option = (name) => {
  const index = process.argv.indexOf(name)
  return index === -1 ? null : process.argv[index + 1]
}
const changedFilesPath = option('--changed-files')
const catalogCommit = option('--catalog-commit')
const dryRun = process.argv.includes('--dry-run')
const hold = process.argv.includes('--hold')

if (!changedFilesPath || !catalogCommit || !/^[0-9a-f]{40}$/.test(catalogCommit)) {
  throw new Error('用法：publish-merged-templates.cjs --changed-files <PR files JSON> --catalog-commit <40 位 SHA> [--hold] [--dry-run]')
}

const run = (command, args, cwd = root, options = {}) => execFileSync(command, args, {
  cwd,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
  ...options
})

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'))
const writeJson = (filePath, value) => fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
const repoPath = (...parts) => path.join(root, ...parts)
const gitFileExists = (commit, relativePath) => {
  try {
    run('git', ['cat-file', '-e', `${commit}:${relativePath}`])
    return true
  } catch {
    return false
  }
}

const collectTargets = () => {
  const payload = readJson(path.resolve(root, changedFilesPath))
  const changed = Array.isArray(payload) ? payload : payload.files
  if (!Array.isArray(changed) || changed.some((entry) => typeof (typeof entry === 'string' ? entry : entry?.filename) !== 'string')) {
    throw new Error('PR changed-files JSON 格式不正确')
  }
  const targets = new Map()
  for (const entry of changed) {
    const file = typeof entry === 'string' ? entry : entry.filename
    const match = /^(?:templates|packages)\/([^/]+)\/([^/]+)\//.exec(file) ||
      /^previews\/(community\.github\.[a-z0-9-]+\.[a-z0-9-]+)-(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\.png$/.exec(file)
    if (!match) continue
    const [, id, version] = match
    if (!templateIdPattern.test(id) || !semverPattern.test(version)) {
      throw new Error(`变更路径不是合法模板版本：${file}`)
    }
    targets.set(`${id}@${version}`, { id, version })
  }
  return [...targets.values()].sort((left, right) => `${left.id}@${left.version}`.localeCompare(`${right.id}@${right.version}`))
}

const retired = () => {
  const source = readJson(repoPath('catalog', 'v1', 'retired-versions.json'))
  return new Set(Object.entries(source.templates || {}).flatMap(([id, versions]) => Object.keys(versions).map((version) => `${id}@${version}`)))
}

const assertArtifactCommitContains = ({ id, version }) => {
  const templateDir = repoPath('templates', id, version)
  const manifest = readJson(path.join(templateDir, 'manifest.json'))
  const previewCandidates = [`${id}-${version}.png`, `${id}.png`]
  const previewName = previewCandidates.find((name) => fs.existsSync(repoPath('previews', name)))
  const required = [
    `templates/${id}/${version}/manifest.json`,
    `templates/${id}/${version}/${manifest.entry}`,
    `templates/${id}/${version}/${manifest.preview}`,
    `templates/${id}/${version}/market.json`,
    `packages/${id}/${version}/${id}-${version}.zip`,
    previewName && `previews/${previewName}`
  ]
  for (const relativePath of required) {
    if (!relativePath || !gitFileExists(catalogCommit, relativePath)) {
      throw new Error(`${id}@${version}: CATALOG_COMMIT ${catalogCommit} 不包含 ${relativePath || '市场预览图'}`)
    }
  }
}

const copyRepository = (destination) => {
  fs.cpSync(root, destination, {
    recursive: true,
    filter: (source) => !['.git', '.tmp', 'node_modules'].includes(path.basename(source))
  })
}

const main = () => {
  const targets = collectTargets()
  if (targets.length === 0) {
    console.log('no template source versions changed; catalog unchanged')
    return
  }
  if (hold) {
    console.log(`hold-publish: skipped ${targets.map(({ id, version }) => `${id}@${version}`).join(', ')}`)
    return
  }

  const withdrawn = retired()
  const metadataPath = repoPath('catalog', 'v1', 'publish-metadata.json')
  const metadata = readJson(metadataPath)
  if (metadata.schemaVersion !== '1' || !metadata.templates || typeof metadata.templates !== 'object') {
    throw new Error('catalog/v1/publish-metadata.json: 格式不正确')
  }
  const ids = new Set()
  for (const target of targets) {
    const key = `${target.id}@${target.version}`
    if (withdrawn.has(key)) throw new Error(`${key}: 已撤回版本不能自动发布`)
    if (ids.has(target.id)) throw new Error(`${target.id}: 一次合并不能自动发布两个版本`)
    ids.add(target.id)
    if (metadata.templates[target.id]?.version === target.version) {
      throw new Error(`${key}: 已发布版本不可覆盖；请使用新版本`)
    }
  }

  // First validate the merged source and packages without changing the worktree.
  run(process.execPath, ['scripts/validate-structure.cjs'])
  for (const target of targets) assertArtifactCommitContains(target)

  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tracememo-template-publish-'))
  try {
    copyRepository(temporaryRoot)
    const temporaryMetadataPath = path.join(temporaryRoot, 'catalog', 'v1', 'publish-metadata.json')
    const prospectiveMetadata = readJson(temporaryMetadataPath)
    for (const { id, version } of targets) prospectiveMetadata.templates[id] = { version }
    writeJson(temporaryMetadataPath, prospectiveMetadata)

    const timestamp = new Date().toISOString()
    run(process.execPath, ['scripts/generate-catalog.cjs'], temporaryRoot, {
      env: { ...process.env, CATALOG_COMMIT: catalogCommit, CATALOG_GENERATED_AT: timestamp, CATALOG_PUBLISH: '1' }
    })
    run(process.execPath, ['scripts/validate-structure.cjs'], temporaryRoot)
    run(process.execPath, ['scripts/validate-structure.cjs', '--catalog'], temporaryRoot)

    if (!dryRun) {
      for (const relativePath of [
        'catalog/v1/publish-metadata.json',
        'catalog/v1/index.json',
        'catalog/v1/drafts/index.json'
      ]) {
        fs.copyFileSync(path.join(temporaryRoot, relativePath), repoPath(relativePath))
      }
      run('git', ['diff', '--check'])
    }
    console.log(JSON.stringify({
      published: targets.map(({ id, version }) => `${id}@${version}`),
      catalogCommit,
      changed: dryRun ? [] : ['catalog/v1/publish-metadata.json', 'catalog/v1/index.json', 'catalog/v1/drafts/index.json'],
      dryRun
    }, null, 2))
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true })
  }
}

main()

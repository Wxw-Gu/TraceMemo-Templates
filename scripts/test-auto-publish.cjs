#!/usr/bin/env node
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const sourceRoot = path.resolve(__dirname, '..')
const templateIdPattern = /^community\.github\.[a-z0-9-]+\.[a-z0-9-]+$/
const results = []

const run = (command, args, cwd, options = {}) => execFileSync(command, args, {
  cwd,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
  ...options
})
const json = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'))
const writeJson = (filePath, value) => fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
const git = (root, ...args) => run('git', args, root).trim()
const commit = (root, message) => {
  git(root, 'add', '-A')
  git(root, 'commit', '-q', '-m', message)
  return git(root, 'rev-parse', 'HEAD')
}

const createRepo = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tracememo-template-auto-publish-test-'))
  fs.cpSync(sourceRoot, root, {
    recursive: true,
    filter: (source) => !['.git', '.tmp', 'node_modules'].includes(path.basename(source))
  })
  run('git', ['init', '-q'], root)
  git(root, 'config', 'user.name', 'test')
  git(root, 'config', 'user.email', 'test@example.invalid')
  const base = commit(root, 'baseline')
  return { root, base }
}

const addTemplate = (root, id, version, options = {}) => {
  assert(templateIdPattern.test(id), `invalid fixture id: ${id}`)
  const source = path.join(root, 'templates', 'community.github.tracememo.quickread', '1.0.0')
  const target = path.join(root, 'templates', id, version)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.cpSync(source, target, { recursive: true })
  const manifestPath = path.join(target, 'manifest.json')
  const manifest = json(manifestPath)
  manifest.id = id
  manifest.name = `Test ${id}`
  manifest.templateVersion = version
  writeJson(manifestPath, manifest)
  if (options.market === false) fs.rmSync(path.join(target, 'market.json'))
  else writeJson(path.join(target, 'market.json'), { description: `Test ${id} ${version}`, tags: ['test', 'auto-publish'] })
  if (options.preview !== false) {
    fs.copyFileSync(path.join(target, manifest.preview), path.join(root, 'previews', `${id}-${version}.png`))
  }
  if (options.package !== false) {
    const packageDir = path.join(root, 'packages', id, version)
    fs.mkdirSync(packageDir, { recursive: true })
    run('zip', ['-X', '-q', '-r', path.join(packageDir, `${id}-${version}.zip`), 'manifest.json', manifest.entry, manifest.preview], target)
  }
}

const publish = (root, base, head, extra = []) => run(process.execPath, [
  path.join(root, 'scripts', 'publish-merged-templates.cjs'),
  '--changed-files', (() => {
    const file = path.join(root, 'publish-pr-files.json')
    const files = git(root, 'diff', '--name-only', '--no-renames', base, head)
      .split(/\r?\n/)
      .filter(Boolean)
      .map((filename) => ({ filename, status: 'modified' }))
    writeJson(file, { files })
    return file
  })(),
  '--catalog-commit', head,
  ...extra
], root, { env: { ...process.env, TEMPLATE_REPO_ROOT: root } })

const catalogEntry = (root, id) => json(path.join(root, 'catalog', 'v1', 'index.json')).templates.find((entry) => entry.id === id)
const publishPathPolicy = (files) => {
  const id = 'community\\.github\\.[a-z0-9-]+\\.[a-z0-9-]+'
  const version = '\\d+\\.\\d+\\.\\d+(?:-[0-9A-Za-z.-]+)?'
  const template = new RegExp(`^templates/(${id})/(${version})/(?:manifest\\.json|template\\.html|preview\\.png|market\\.json|assets/.+)$`)
  const packageFile = new RegExp(`^packages/(${id})/(${version})/\\1-\\2\\.zip$`)
  const preview = new RegExp(`^previews/(${id})-(${version})\\.png$`)
  const templateVersions = new Set()
  const relatedVersions = []
  const rejected = []
  for (const filename of files) {
    const templateMatch = template.exec(filename)
    if (templateMatch) {
      templateVersions.add(`${templateMatch[1]}@${templateMatch[2]}`)
      continue
    }
    const relatedMatch = packageFile.exec(filename) || preview.exec(filename)
    if (relatedMatch) {
      relatedVersions.push(`${relatedMatch[1]}@${relatedMatch[2]}`)
      continue
    }
    rejected.push(filename)
  }
  for (const target of relatedVersions) {
    if (!templateVersions.has(target)) rejected.push(`${target}: package/preview 没有同一 PR 的模板源码`)
  }
  if (templateVersions.size === 0) rejected.push('未发现 templates/<id>/<version>/ 投稿源码')
  return { accepted: rejected.length === 0, rejected }
}
const expectFailure = (fn, message) => {
  assert.throws(fn, (error) => error.message.includes(message), `expected failure containing: ${message}`)
}
const expectFailureWithoutCatalogWrite = (root, fn, message) => {
  const files = ['catalog/v1/publish-metadata.json', 'catalog/v1/index.json', 'catalog/v1/drafts/index.json']
  const before = new Map(files.map((file) => [file, fs.readFileSync(path.join(root, file), 'utf8')]))
  expectFailure(fn, message)
  for (const file of files) assert.equal(fs.readFileSync(path.join(root, file), 'utf8'), before.get(file), `${file} changed after failed publish`)
}
const scenario = (name, fn) => {
  const { root, base } = createRepo()
  try {
    fn(root, base)
    results.push({ name, passed: true })
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
}

scenario('A normal exact version', (root, base) => {
  const id = 'community.github.example.demo'
  addTemplate(root, id, '1.0.0')
  const head = commit(root, 'add demo')
  publish(root, base, head)
  const entry = catalogEntry(root, id)
  assert.equal(entry.version, '1.0.0')
  assert.equal(entry.sizeBytes, fs.statSync(path.join(root, 'packages', id, '1.0.0', `${id}-1.0.0.zip`)).size)
  assert.equal(entry.sha256.length, 64)
})

scenario('B does not select a higher semver', (root, base) => {
  const id = 'community.github.example.versioned'
  addTemplate(root, id, '1.0.0')
  addTemplate(root, id, '1.1.0')
  addTemplate(root, id, '2.0.0')
  const sourceBase = commit(root, 'existing unpublished versions')
  const marketPath = path.join(root, 'templates', id, '1.0.0', 'market.json')
  const market = json(marketPath)
  market.description = 'Only 1.0.0 entered this merge'
  writeJson(marketPath, market)
  const head = commit(root, 'publish only 1.0.0 source change')
  publish(root, sourceBase, head)
  assert.equal(catalogEntry(root, id).version, '1.0.0')
})

scenario('C multiple template versions', (root, base) => {
  const first = 'community.github.example.alpha'
  const second = 'community.github.example.beta'
  addTemplate(root, first, '1.0.0')
  addTemplate(root, second, '1.2.0')
  const head = commit(root, 'add two templates')
  publish(root, base, head)
  assert.equal(catalogEntry(root, first).version, '1.0.0')
  assert.equal(catalogEntry(root, second).version, '1.2.0')
})

scenario('D hold-publish leaves source unpublished', (root, base) => {
  const id = 'community.github.example.hold'
  addTemplate(root, id, '1.0.0')
  const head = commit(root, 'add held template')
  publish(root, base, head, ['--hold'])
  assert.equal(catalogEntry(root, id), undefined)
  assert.equal(fs.existsSync(path.join(root, 'templates', id, '1.0.0', 'manifest.json')), true)
})

scenario('E retired version cannot return to catalog', (root, base) => {
  const template = path.join(root, 'templates', 'community.github.wxw-gu.neon-command-daily', '1.0.0', 'template.html')
  fs.appendFileSync(template, '\n<!-- merge simulation -->\n')
  const head = commit(root, 'touch retired source')
  expectFailureWithoutCatalogWrite(root, () => publish(root, base, head), '已撤回版本不能自动发布')
})

scenario('F missing market.json fails before catalog write', (root, base) => {
  addTemplate(root, 'community.github.example.nomarket', '1.0.0', { market: false })
  const head = commit(root, 'add missing market metadata')
  expectFailureWithoutCatalogWrite(root, () => publish(root, base, head), '缺少 market.json')
})

scenario('G missing package fails before catalog write', (root, base) => {
  addTemplate(root, 'community.github.example.nopackage', '1.0.0', { package: false })
  const head = commit(root, 'add missing package')
  expectFailureWithoutCatalogWrite(root, () => publish(root, base, head), '缺少安装包')
})

scenario('G missing preview fails before catalog write', (root, base) => {
  addTemplate(root, 'community.github.example.nopreview', '1.0.0', { preview: false })
  const head = commit(root, 'add missing preview')
  expectFailureWithoutCatalogWrite(root, () => publish(root, base, head), '缺少预览图')
})

scenario('H catalog-only bot commit does not publish', (root, base) => {
  const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'publish-templates.yml'), 'utf8')
  assert.match(workflow, /pull_request_target:/)
  assert.match(workflow, /types: \[closed\]/)
  assert.doesNotMatch(workflow, /^\s*push:/m)
  assert.ok(workflow.indexOf('Reject non-template paths before checkout') < workflow.indexOf('Checkout merged main only after path validation'))
  const catalogPath = path.join(root, 'catalog', 'v1', 'index.json')
  const catalog = json(catalogPath)
  catalog.generatedAt = '2026-09-09T00:00:00.000Z'
  writeJson(catalogPath, catalog)
  const head = commit(root, 'catalog bot commit')
  const output = publish(root, base, head)
  assert.match(output, /no template source versions changed/)
})

scenario('I existing catalog entries remain, including neon 1.0.2', (root, base) => {
  const id = 'community.github.example.keepcurrent'
  addTemplate(root, id, '1.0.0')
  const head = commit(root, 'add one more template')
  publish(root, base, head)
  assert.equal(catalogEntry(root, 'community.github.wxw-gu.neon-command-daily').version, '1.0.2')
  assert.equal(catalogEntry(root, 'community.github.tracememo.paperdaily').version, '1.0.1')
})

scenario('J queued A then B keeps both catalog entries', (root, base) => {
  const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'publish-templates.yml'), 'utf8')
  assert.match(workflow, /group: tracememo-template-publish/)
  assert.match(workflow, /cancel-in-progress: false/)
  assert.match(workflow, /queue: max/)
  assert.match(workflow, /TraceMemo-Publish-Bot: true/)

  const first = 'community.github.example.a'
  addTemplate(root, first, '1.0.0')
  const firstMerge = commit(root, 'merge PR A source')
  publish(root, base, firstMerge)
  git(root, 'add', '-A')
  git(root, 'commit', '-q', '-m', 'chore: 发布社区模板', '-m', 'TraceMemo-Publish-Bot: true')
  const firstCatalogCommit = git(root, 'rev-parse', 'HEAD')
  assert.equal(catalogEntry(root, first).version, '1.0.0')

  const second = 'community.github.example.b'
  addTemplate(root, second, '1.0.0')
  const secondMerge = commit(root, 'merge PR B source')
  publish(root, firstCatalogCommit, secondMerge)
  assert.equal(catalogEntry(root, first).version, '1.0.0')
  assert.equal(catalogEntry(root, second).version, '1.0.0')
  assert.equal(json(path.join(root, 'catalog', 'v1', 'index.json')).source.commit, secondMerge)
})

scenario('K template PR with scripts change is rejected before publish', (root, base) => {
  const id = 'community.github.example.scriptblocked'
  addTemplate(root, id, '1.0.0')
  fs.appendFileSync(path.join(root, 'scripts', 'generate-catalog.cjs'), '\n// forbidden PR change\n')
  const head = commit(root, 'template plus script')
  const files = git(root, 'diff', '--name-only', '--no-renames', base, head).split(/\r?\n/).filter(Boolean)
  const before = fs.readFileSync(path.join(root, 'catalog', 'v1', 'index.json'), 'utf8')
  const decision = publishPathPolicy(files)
  assert.equal(decision.accepted, false)
  assert.ok(decision.rejected.includes('scripts/generate-catalog.cjs'))
  assert.equal(fs.readFileSync(path.join(root, 'catalog', 'v1', 'index.json'), 'utf8'), before)
})

scenario('L template PR with workflow change is rejected before publish', (root, base) => {
  const id = 'community.github.example.workflowblocked'
  addTemplate(root, id, '1.0.0')
  fs.appendFileSync(path.join(root, '.github', 'workflows', 'validate.yml'), '\n# forbidden PR change\n')
  const head = commit(root, 'template plus workflow')
  const files = git(root, 'diff', '--name-only', '--no-renames', base, head).split(/\r?\n/).filter(Boolean)
  const decision = publishPathPolicy(files)
  assert.equal(decision.accepted, false)
  assert.ok(decision.rejected.includes('.github/workflows/validate.yml'))
})

scenario('M pure template PR remains publishable', (root, base) => {
  const id = 'community.github.example.allowed'
  addTemplate(root, id, '1.0.0')
  const head = commit(root, 'pure template PR')
  const files = git(root, 'diff', '--name-only', '--no-renames', base, head).split(/\r?\n/).filter(Boolean)
  assert.equal(publishPathPolicy(files).accepted, true)
  publish(root, base, head)
  assert.equal(catalogEntry(root, id).version, '1.0.0')
})

console.log(JSON.stringify({ passed: results.length, results }, null, 2))

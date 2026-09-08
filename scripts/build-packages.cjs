#!/usr/bin/env node
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const root = path.resolve(__dirname, '..')
const ids = ['community.github.tracememo.quickread', 'community.github.tracememo.paperdaily', 'community.github.tracememo.teamboard']
const epoch = '198001010000'
const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/

const compareVersions = (left, right) => {
  const parse = (value) => value.split('-')[0].split('.').map(Number)
  const a = parse(left)
  const b = parse(right)
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index]
  }
  return left.localeCompare(right)
}

const latestVersion = (id) => fs.readdirSync(path.join(root, 'templates', id), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && semverPattern.test(entry.name))
  .map((entry) => entry.name)
  .sort(compareVersions)
  .at(-1)

for (const id of ids) {
  const version = latestVersion(id)
  if (!version) throw new Error(`${id}: 找不到模板版本`)
  const source = path.join(root, 'templates', id, version)
  const versionedPreview = path.join(root, 'previews', `${id}-${version}.png`)
  const genericPreview = path.join(root, 'previews', `${id}.png`)
  const preview = fs.existsSync(versionedPreview) ? versionedPreview : genericPreview
  const packageDir = path.join(root, 'packages', id, version)
  const output = path.join(packageDir, `${id}-${version}.zip`)
  if (!fs.existsSync(preview)) throw new Error(`缺少预览图，请先运行 render-previews.cjs：${preview}`)
  fs.mkdirSync(packageDir, { recursive: true })
  fs.copyFileSync(preview, path.join(source, 'preview.png'))
  for (const file of ['manifest.json', 'template.html', 'preview.png']) execFileSync('touch', ['-t', epoch, path.join(source, file)])
  fs.rmSync(output, { force: true })
  execFileSync('zip', ['-X', '-q', output, 'manifest.json', 'template.html', 'preview.png'], { cwd: source })
  console.log(`built packages/${id}/${version}/${id}-${version}.zip (${fs.statSync(output).size} bytes)`)
}

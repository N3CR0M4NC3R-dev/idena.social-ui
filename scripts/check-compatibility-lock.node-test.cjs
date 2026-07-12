const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const {verifyCompatibilityLock} = require('./check-compatibility-lock.cjs')

const root = path.resolve(__dirname, '..')
const lock = JSON.parse(
  fs.readFileSync(path.join(root, 'compatibility/stack-lock.json'), 'utf8')
)
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const packageLock = JSON.parse(
  fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8')
)

test('social UI pins the reviewed SDK archive and integrity', () => {
  assert.doesNotThrow(() => verifyCompatibilityLock(lock, pkg, packageLock))
})

test('SDK source drift is rejected', () => {
  const changed = structuredClone(pkg)
  changed.dependencies['idena-sdk-js-lite'] =
    'https://github.com/ubiubi18/idena-sdk-js-lite/archive/main.tar.gz'
  assert.throws(
    () => verifyCompatibilityLock(lock, changed, packageLock),
    /does not use the locked SDK source/
  )
})

test('missing archive integrity is rejected', () => {
  const changed = structuredClone(packageLock)
  delete changed.packages['node_modules/idena-sdk-js-lite'].integrity
  assert.throws(
    () => verifyCompatibilityLock(lock, pkg, changed),
    /lacks the locked SDK archive integrity/
  )
})

#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const LOCK_PATH = path.join(ROOT, 'compatibility', 'stack-lock.json')
const PACKAGE_PATH = path.join(ROOT, 'package.json')
const PACKAGE_LOCK_PATH = path.join(ROOT, 'package-lock.json')

function readJson(filePath) {
  const metadata = fs.lstatSync(filePath)
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error(`${path.basename(filePath)} must be a regular file`)
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function verifyCompatibilityLock(lock, pkg, packageLock) {
  if (
    lock.schema !== 1 ||
    lock.status !== 'candidate' ||
    lock.chainInvariants?.consensusChangesAllowed !== false
  ) {
    throw new Error('Unexpected compatibility lock identity')
  }
  const commit = lock.consumerPins?.['idena-social-ui']?.['idena-sdk-js-lite']
  const component = (lock.components || []).find(
    (item) => item.name === 'idena-sdk-js-lite'
  )
  if (!/^[0-9a-f]{40}$/.test(commit || '') || component?.commit !== commit) {
    throw new Error('Compatibility lock contains an invalid SDK pin')
  }

  const expectedUrl = `https://github.com/ubiubi18/idena-sdk-js-lite/archive/${commit}.tar.gz`
  if (pkg.dependencies?.['idena-sdk-js-lite'] !== expectedUrl) {
    throw new Error('Social UI package does not use the locked SDK source')
  }
  if (packageLock.packages?.['']?.dependencies?.['idena-sdk-js-lite'] !== expectedUrl) {
    throw new Error('Package lock root SDK pin does not match package.json')
  }
  const installed = packageLock.packages?.['node_modules/idena-sdk-js-lite']
  if (
    installed?.resolved !== expectedUrl ||
    !/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(installed.integrity || '')
  ) {
    throw new Error('Package lock lacks the locked SDK archive integrity')
  }
}

function main() {
  verifyCompatibilityLock(
    readJson(LOCK_PATH),
    readJson(PACKAGE_PATH),
    readJson(PACKAGE_LOCK_PATH)
  )
  console.log('Social UI compatibility lock passed')
}

if (require.main === module) main()

module.exports = {verifyCompatibilityLock}

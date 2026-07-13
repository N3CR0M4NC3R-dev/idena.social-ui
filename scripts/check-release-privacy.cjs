#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const {execFileSync} = require('child_process')

const SCANNED_PREFIXES = ['.github/', 'public/', 'scripts/', 'src/']

const SCANNED_FILES = new Set([
  '.env.example',
  'index.html',
  'package.json',
  'README.md',
  'vite.config.ts',
])

const SKIPPED_EXTENSIONS = new Set([
  '.bin',
  '.gif',
  '.ico',
  '.jpg',
  '.jpeg',
  '.lock',
  '.map',
  '.pdf',
  '.png',
  '.webp',
])

const CHECKS = [
  {
    name: 'macOS home path',
    regex:
      /(?<![A-Za-z0-9._@/-])\/Users\/(?!\$USER\b|\$HOME\b|Shared\b)[A-Za-z0-9._-]+/g,
  },
  {
    name: 'Windows home path',
    regex:
      /(?<![A-Za-z0-9._@/-])[A-Za-z]:\\Users\\(?!%USERNAME%\\|%USERPROFILE%\\)[^\\\s`'"]+/g,
  },
  {
    name: 'Linux home path',
    regex:
      /(?<![A-Za-z0-9._@/-])\/home\/(?!\$USER\b|\$HOME\b|runner\b|ubuntu\b)[A-Za-z0-9._-]+/g,
  },
  {
    name: 'OpenAI-like secret key',
    regex: /\bsk-(?!test\b|test-|custom\b|custom-)[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    name: 'Google API key',
    regex: /\bAIza[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    name: 'GitHub token',
    regex:
      /\b(?:gh[pousr]_[A-Za-z0-9_]{36,}|github_pat_[A-Za-z0-9_]{22,}_[A-Za-z0-9_]{59,})\b/g,
  },
  {
    name: 'AWS access key id',
    regex: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
  },
  {
    name: 'Slack token',
    regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  },
  {
    name: 'npm token',
    regex: /\bnpm_[A-Za-z0-9]{36}\b/g,
  },
  {
    name: 'JWT-like token',
    regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  },
  {
    name: 'private key block',
    regex:
      /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  },
  {
    name: 'contextual secret literal',
    regex:
      /\b(?:apiKey|api_key|privateKey|private_key|secret|token|password)\b\s*[:=]\s*['"`](?!test\b|test-|example\b|changeme\b|idena-restricted-node-key\b)[A-Za-z0-9_./+=-]{32,}['"`]/gi,
  },
  {
    name: 'sensitive browser storage read',
    regex:
      /(?:localStorage|sessionStorage)\.getItem\(\s*['"`](?:nodeKey|encryptedPrivateKey|password|saveEncryptedKey|savePassword)['"`]\s*\)/g,
  },
  {
    name: 'sensitive browser storage write',
    regex:
      /(?:localStorage|sessionStorage)\.setItem\(\s*['"`](?:nodeKey|encryptedPrivateKey|password|saveEncryptedKey|savePassword)['"`]\s*,/g,
  },
]

function maskValue(value) {
  const singleLine = String(value).replace(/\s+/g, ' ')
  if (singleLine.length <= 12) return '[redacted]'
  return `${singleLine.slice(0, 4)}...[redacted:${
    singleLine.length
  }]...${singleLine.slice(-4)}`
}

function listTrackedFiles() {
  return execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard'],
    {encoding: 'utf8'}
  )
    .split('\n')
    .map(entry => entry.trim())
    .filter(Boolean)
}

function shouldScan(filePath) {
  if (SCANNED_FILES.has(filePath)) return true
  if (!SCANNED_PREFIXES.some(prefix => filePath.startsWith(prefix))) {
    return false
  }
  return !SKIPPED_EXTENSIONS.has(path.extname(filePath).toLowerCase())
}

function inspectFile(filePath) {
  if (!fs.existsSync(filePath)) return []

  const content = fs.readFileSync(filePath, 'utf8')
  const fileFindings = []

  for (const check of CHECKS) {
    check.regex.lastIndex = 0
    let match = check.regex.exec(content)
    while (match) {
      const line = content.slice(0, match.index).split('\n').length
      fileFindings.push({
        check: check.name,
        filePath,
        line,
        value: match[0],
      })
      match = check.regex.exec(content)
    }
  }

  return fileFindings
}

const findings = listTrackedFiles()
  .filter(shouldScan)
  .flatMap(filePath => inspectFile(filePath))

if (findings.length > 0) {
  console.error('Release privacy check failed:')
  for (const finding of findings) {
    console.error(
      `- ${finding.filePath}:${finding.line} ${finding.check}: ${maskValue(
        finding.value
      )}`
    )
  }
  process.exit(1)
}

console.log('Release privacy check passed.')

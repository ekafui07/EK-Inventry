#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const testDir = path.join(__dirname, 'backend');
const outputFile = path.join(__dirname, 'test-execution-output.txt');

let output = '';

function log(msg) {
  output += msg + '\n';
  console.log(msg);
}

try {
  log('===== STEP 1: Check git status =====');
  const status = execSync('git status --short', { cwd: __dirname, encoding: 'utf8' });
  log(status || '(no changes)');
  
  log('\n===== STEP 2: Show app.js changes =====');
  const diff = execSync('git diff frontend/app.js', { cwd: __dirname, encoding: 'utf8' });
  log(diff.substring(0, 2000) + (diff.length > 2000 ? '\n... (truncated)' : ''));
  
  log('\n===== STEP 3: Running test-frontend-checks.js =====');
  try {
    const result = execSync('node test-frontend-checks.js', {
      cwd: testDir,
      encoding: 'utf8',
      stdio: 'pipe'
    });
    log(result);
    log('\n✅ TEST PASSED');
  } catch (e) {
    log(e.stdout || '');
    log(e.stderr || '');
    log(`\n❌ TEST FAILED (exit code: ${e.status})`);
  }
  
} catch (e) {
  log(`ERROR: ${e.message}`);
  log(e.stdout || '');
  log(e.stderr || '');
}

fs.writeFileSync(outputFile, output);
console.log(`\nOutput saved to: ${outputFile}`);

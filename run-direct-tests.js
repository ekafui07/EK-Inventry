#!/usr/bin/env node
/**
 * Direct test executor - runs tests without shell interference
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function runTest(testFile, name) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Running: ${name}`);
  console.log(`File: ${testFile}`);
  console.log('='.repeat(60));
  
  try {
    const output = execSync(`node "${testFile}"`, {
      cwd: path.dirname(testFile),
      encoding: 'utf8',
      stdio: ['inherit', 'pipe', 'pipe'],
      maxBuffer: 10 * 1024 * 1024  // 10MB buffer
    });
    
    console.log(output);
    console.log(`\n✅ ${name} PASSED`);
    return true;
  } catch (error) {
    console.log(error.stdout || '');
    console.log(error.stderr || '');
    console.log(`\n❌ ${name} FAILED`);
    console.log(`Exit code: ${error.status}`);
    return false;
  }
}

async function main() {
  const backendDir = path.join(__dirname, '..', '..', 'backend');
  
  const tests = [
    {
      file: path.join(backendDir, 'test-frontend-checks.js'),
      name: 'Frontend Checks (with 8-case regression)'
    }
  ];
  
  const results = {};
  
  for (const test of tests) {
    results[test.name] = runTest(test.file, test.name);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  
  for (const [name, passed] of Object.entries(results)) {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status}: ${name}`);
  }
  
  const allPassed = Object.values(results).every(r => r);
  process.exit(allPassed ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

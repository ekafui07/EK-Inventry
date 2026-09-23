#!/usr/bin/env node
/**
 * Test wrapper script that bypasses terminal paging issues
 * Runs test-frontend-checks.js and outputs results to a file
 */

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const testFile = path.join(__dirname, 'test-frontend-checks.js');
const outputFile = path.join(__dirname, 'test-results-frontend.txt');

console.log(`[WRAPPER] Running test-frontend-checks.js...`);
console.log(`[WRAPPER] Output will be saved to: ${outputFile}`);

// Run the test and capture output
const child = childProcess.spawnSync('node', [testFile], {
  encoding: 'utf8',
  cwd: __dirname,
  stdio: ['inherit', 'pipe', 'pipe']
});

// Write results to file
const results = {
  timestamp: new Date().toISOString(),
  exitCode: child.status,
  stdout: child.stdout,
  stderr: child.stderr,
  success: child.status === 0
};

fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));

// Also write a human-readable version
const readableFile = path.join(__dirname, 'test-results-frontend-readable.txt');
const readableOutput = `
TEST RUN: Frontend Checks
TIME: ${results.timestamp}
EXIT CODE: ${results.exitCode}
STATUS: ${results.success ? '✅ PASSED' : '❌ FAILED'}

===== STDOUT =====
${results.stdout}

===== STDERR =====
${results.stderr}
`;

fs.writeFileSync(readableFile, readableOutput);

console.log(`[WRAPPER] Results saved to:`);
console.log(`  - ${outputFile}`);
console.log(`  - ${readableFile}`);
console.log(`[WRAPPER] Exit code: ${results.exitCode}`);
console.log(`[WRAPPER] Status: ${results.success ? 'PASSED ✅' : 'FAILED ❌'}`);

process.exit(results.exitCode);

const { spawnSync } = require('child_process');
const path = require('path');

const testSuites = [
  { name: 'Phase 2: Concurrency & Lock Serialization', file: 'test-phase2-concurrency.js' },
  { name: 'Phase 1: Security, XSS & Ban Enforcement', file: 'test-phase1-security.js' },
  { name: 'Root Admin Audit Trail & Category Filters', file: 'test-audit-trail.js' },
  { name: 'Double-Booking & Range Overlap Boundary Math', file: 'test-double-booking.js' },
  { name: 'Staff Lifecycle, Navigation & Privilege Escalation', file: 'test-staff-flow.js' },
  { name: 'Authentication & RBAC Policy Protection', file: 'test-auth-rbac.js' },
  { name: 'Comprehensive Pre-Deployment Integration Suite', file: 'test-comprehensive.js' },
  { name: 'Frontend Privacy, Form Resets & Invoice Checks', file: 'test-frontend-checks.js' }
];

console.log('================================================================');
console.log('🚀 EK GEARFLOW - UNIFIED TEST SUITE RUNNER');
console.log('================================================================\n');

const results = [];
let overallPassed = true;

for (const suite of testSuites) {
  process.stdout.write(`⏳ Running [${suite.name}] ... `);
  const start = Date.now();
  const res = spawnSync('node', [suite.file], {
    cwd: __dirname,
    stdio: 'pipe',
    encoding: 'utf8'
  });
  const duration = ((Date.now() - start) / 1000).toFixed(2);

  if (res.status === 0) {
    console.log(`✅ PASSED (${duration}s)`);
    results.push({ name: suite.name, file: suite.file, status: 'PASSED', duration });
  } else {
    console.log(`❌ FAILED (${duration}s)`);
    console.error('\n--- Failure Output ---');
    console.error(res.stdout || '');
    console.error(res.stderr || '');
    console.error('----------------------\n');
    results.push({ name: suite.name, file: suite.file, status: 'FAILED', duration });
    overallPassed = false;
    break;
  }
}

console.log('\n================================================================');
console.log('📊 TEST EXECUTION SUMMARY');
console.log('================================================================');
console.table(results);

if (overallPassed) {
  console.log('🎉 ALL TEST SUITES PASSED WITH 100% COMPLIANCE! ZERO REGRESSIONS.');
  process.exit(0);
} else {
  console.error('❌ SOME TEST SUITES ENCOUNTERED FAILURES.');
  process.exit(1);
}

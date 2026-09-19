const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

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

function checkServerListening(port = 3000) {
  return new Promise(resolve => {
    const req = http.get(`http://127.0.0.1:${port}/api/gear`, { timeout: 800 }, res => {
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForServer(port = 3000, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    const ok = await checkServerListening(port);
    if (ok) return true;
    await new Promise(r => setTimeout(r, 150));
  }
  return false;
}

async function runAllSuites() {
  console.log('================================================================');
  console.log('🚀 EK GEARFLOW - UNIFIED TEST SUITE RUNNER');
  console.log('================================================================\n');

  const mockPath = path.join(__dirname, 'db-mock.json');
  let mockBackup = null;
  if (fs.existsSync(mockPath)) {
    try {
      mockBackup = fs.readFileSync(mockPath);
    } catch (e) {}
  }

  let serverProc = null;
  const isListening = await checkServerListening(3000);

  if (!isListening) {
    process.stdout.write('⚡ Starting dedicated test server process on port 3000... ');
    serverProc = spawn('node', ['index.js'], {
      cwd: __dirname,
      stdio: 'ignore',
      detached: false
    });
    const ready = await waitForServer(3000);
    if (!ready) {
      if (serverProc) serverProc.kill('SIGKILL');
      throw new Error('Test server failed to start within timeout.');
    }
    console.log('Ready.\n');
  } else {
    console.log('⚡ Detected active server on port 3000. Running tests against it.\n');
  }

  const cleanup = () => {
    if (serverProc && !serverProc.killed) {
      try {
        serverProc.kill('SIGTERM');
      } catch (e) {}
    }
    if (mockBackup !== null) {
      try {
        fs.writeFileSync(mockPath, mockBackup);
      } catch (e) {}
    }
  };

  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(1); });
  process.on('SIGTERM', () => { cleanup(); process.exit(1); });

  const results = [];
  let overallPassed = true;

  try {
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
  } finally {
    if (serverProc && !serverProc.killed) {
      process.stdout.write('\n🛑 Terminating test server process... ');
      serverProc.kill('SIGTERM');
      console.log('Done.');
    }
    if (mockBackup !== null) {
      try {
        fs.writeFileSync(mockPath, mockBackup);
      } catch (e) {}
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
}

runAllSuites().catch(err => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});

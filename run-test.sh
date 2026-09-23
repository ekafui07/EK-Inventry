#!/bin/bash
set -e

cd /home/ekafui07/EK-Inventry

echo "===== TESTING GIT STATUS ====="
git status --short 2>&1 || true

echo ""
echo "===== RUNNING FRONTEND CHECKS TEST ====="
cd backend
node test-frontend-checks.js 2>&1
TEST_RESULT=$?

echo ""
echo "TEST EXIT CODE: $TEST_RESULT"
exit $TEST_RESULT

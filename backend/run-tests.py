#!/usr/bin/env python3
"""
Direct subprocess execution of Node tests, bypassing shell issues
"""

import subprocess
import json
import sys
from pathlib import Path

def run_test(test_file, output_file):
    """Execute Node test file and capture all output"""
    try:
        print(f"[PYTHON] Executing: node {test_file}")
        
        result = subprocess.run(
            ['node', str(test_file)],
            capture_output=True,
            text=True,
            timeout=60,
            cwd=str(Path(__file__).parent)
        )
        
        output_data = {
            'success': result.returncode == 0,
            'exit_code': result.returncode,
            'stdout': result.stdout,
            'stderr': result.stderr
        }
        
        # Write JSON output
        with open(output_file, 'w') as f:
            json.dump(output_data, f, indent=2)
        
        # Print to console
        print(f"[PYTHON] Exit code: {result.returncode}")
        print(f"[PYTHON] Success: {output_data['success']}")
        print("\n===== TEST OUTPUT =====\n")
        print(result.stdout)
        if result.stderr:
            print("\n===== ERRORS =====\n")
            print(result.stderr)
        
        return result.returncode
        
    except subprocess.TimeoutExpired:
        print("[PYTHON] ERROR: Test timeout after 60 seconds")
        return 124
    except Exception as e:
        print(f"[PYTHON] ERROR: {e}")
        return 1

if __name__ == '__main__':
    script_dir = Path(__file__).parent
    test_file = script_dir / 'test-frontend-checks.js'
    output_file = script_dir / 'test-results.json'
    
    exit_code = run_test(test_file, output_file)
    print(f"\n[PYTHON] Results written to: {output_file}")
    sys.exit(exit_code)

#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 Running Lexara Engage Tests...\n');

// Change to homepage directory
process.chdir(path.join(__dirname));

// Run tests using pnpm
const testProcess = spawn('pnpm', ['test'], {
  stdio: 'inherit',
  shell: true
});

testProcess.on('error', (error) => {
  console.error('Failed to run tests:', error);
  process.exit(1);
});

testProcess.on('exit', (code) => {
  if (code === 0) {
    console.log('\n✅ Tests completed successfully!');
  } else {
    console.log('\n❌ Tests failed with exit code:', code);
  }
  process.exit(code);
});
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
let failed = false;

function resolve(relativePath) {
  return path.join(root, relativePath);
}

function exists(relativePath) {
  return fs.existsSync(resolve(relativePath));
}

function readFile(relativePath) {
  return fs.readFileSync(resolve(relativePath), 'utf8');
}

function pass(message) {
  console.log(`PASS ${message}`);
}

function fail(message) {
  console.error(`FAIL ${message}`);
  failed = true;
}

function check(condition, message) {
  if (condition) {
    pass(message);
  } else {
    fail(message);
  }
}

const builtServiceWorkerPath = 'dist/service-worker.js';
const registerSwPath = 'dist/registerSW.js';

check(exists('dist/index.html'), 'dist/index.html exists');
check(exists(registerSwPath), 'dist/registerSW.js exists');
check(exists(builtServiceWorkerPath), 'dist/service-worker.js exists');
check(!exists('dist/sw.js'), 'Legacy dist/sw.js is not emitted');

if (exists(builtServiceWorkerPath)) {
  const serviceWorkerOutput = readFile(builtServiceWorkerPath);
  check(/addEventListener\(["']push["']/.test(serviceWorkerOutput), 'Built service worker contains push listener');
  check(/showNotification/.test(serviceWorkerOutput), 'Built service worker contains showNotification');
  check(/addEventListener\(["']notificationclick["']/.test(serviceWorkerOutput), 'Built service worker contains notificationclick listener');
  check(/sek_push_open/.test(serviceWorkerOutput), 'Built service worker preserves sek_push_open tracking');
  check(/precache/i.test(serviceWorkerOutput), 'Built service worker contains precache output');
}

if (failed) {
  console.error('\nRelease output verification failed.');
  process.exit(1);
}

console.log('\nRelease output verification passed.');

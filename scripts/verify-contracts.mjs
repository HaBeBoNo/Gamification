import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
let failed = false;

function readFile(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
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

function findApiHandlerForPath(routePath) {
  const base = routePath.replace(/^\/api\//, '');
  const candidates = [
    `api/${base}.js`,
    `api/${base}.ts`,
    `api/${base}.mjs`,
    `api/${base}/index.js`,
    `api/${base}/index.ts`,
    `api/${base}/index.mjs`,
  ];
  return candidates.find((candidate) => exists(candidate)) || null;
}

const viteConfig = readFile('vite.config.js');
const vercelConfig = JSON.parse(readFile('vercel.json'));
const webPushSource = readFile('src/lib/webPush.ts');
const serviceWorkerSource = readFile('src/service-worker.js');
const pushRouteSource = readFile('api/send-push.js');
const pushClientSource = readFile('src/lib/sendPush.ts');
const supabasePushSource = readFile('supabase/functions/send-push/index.ts');
const pushCronSource = readFile('api/push-cron.js');

const swStrategyMatch = viteConfig.match(/strategies:\s*['"]([^'"]+)['"]/);
const swFilenameMatch = viteConfig.match(/filename:\s*['"]([^'"]+)['"]/);
const swRegistrationMatch = webPushSource.match(/register\(\s*['"]([^'"]+)['"]\s*\)/);

const serviceWorkerFilename = swFilenameMatch?.[1] || '';
const serviceWorkerPath = serviceWorkerFilename ? `/${serviceWorkerFilename}` : '';
const registeredPath = swRegistrationMatch?.[1] || '';

check(swStrategyMatch?.[1] === 'injectManifest', 'VitePWA uses injectManifest strategy');
check(Boolean(serviceWorkerFilename), 'VitePWA declares an explicit service worker filename');
check(exists('src/service-worker.js'), 'Source service worker exists in src/');
check(registeredPath === serviceWorkerPath, 'Client push registration path matches VitePWA service worker filename');

const serviceWorkerHeaders = Array.isArray(vercelConfig.headers)
  ? vercelConfig.headers.find((entry) => entry?.source === serviceWorkerPath)
  : null;

check(Boolean(serviceWorkerHeaders), 'vercel.json includes headers for the active service worker path');
check(
  Boolean(serviceWorkerHeaders?.headers?.some((header) => header.key === 'Cache-Control' && String(header.value).includes('no-cache'))),
  'Active service worker path is marked no-cache in vercel.json',
);
check(
  Boolean(serviceWorkerHeaders?.headers?.some((header) => header.key === 'Service-Worker-Allowed' && header.value === '/')),
  'Active service worker path includes Service-Worker-Allowed: /',
);
check(
  !Array.isArray(vercelConfig.headers) || !vercelConfig.headers.some((entry) => entry?.source === '/sw.js'),
  'Legacy /sw.js header mapping has been removed',
);
check(!exists('public/sw.js'), 'Legacy public/sw.js file is removed');

check(/addEventListener\(\s*['"]push['"]/.test(serviceWorkerSource), 'Source service worker listens for push events');
check(/showNotification/.test(serviceWorkerSource), 'Source service worker calls showNotification');
check(/addEventListener\(\s*['"]notificationclick['"]/.test(serviceWorkerSource), 'Source service worker listens for notification clicks');
check(/sek_push_open/.test(serviceWorkerSource), 'Notification click handler marks sek_push_open');

for (const payloadKey of ['title', 'body', 'url', 'exclude_member', 'target_member_keys']) {
  check(pushClientSource.includes(payloadKey), `Client push sender includes payload key "${payloadKey}"`);
  check(pushRouteSource.includes(payloadKey), `Vercel push route includes payload key "${payloadKey}"`);
  check(supabasePushSource.includes(payloadKey), `Supabase push function includes payload key "${payloadKey}"`);
}

check(/\/api\/send-push/.test(pushClientSource), 'Client push sender targets the Vercel /api/send-push route');
check(/functions\.invoke\(\s*['"]send-push['"]/.test(pushClientSource), 'Client push sender has Supabase send-push fallback');
check(/calendar-reminders/.test(pushCronSource), 'push-cron invokes the calendar-reminders function');

const cronEntries = Array.isArray(vercelConfig.crons) ? vercelConfig.crons : [];
check(cronEntries.length > 0, 'vercel.json declares cron jobs');
for (const cron of cronEntries) {
  const routePath = String(cron?.path || '');
  const handler = findApiHandlerForPath(routePath);
  check(Boolean(handler), `Cron route ${routePath} resolves to a handler file`);
}

if (failed) {
  console.error('\nContract verification failed.');
  process.exit(1);
}

console.log('\nAll source contracts passed.');

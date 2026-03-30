/**
 * Gym PWA - Puppeteer Screenshot & Console Capture Script
 * QA Test: captures screenshots and ALL console output from http://localhost:3000
 */

const puppeteer = require('puppeteer');

const BASE_URL = 'http://localhost:3000';
const SCREENSHOTS = [
  '/tmp/gym-pwa-screenshot-1.png',
  '/tmp/gym-pwa-screenshot-2.png',
  '/tmp/gym-pwa-screenshot-3.png',
];

async function run() {
  console.log('=== GYM PWA PUPPETEER QA TEST ===\n');

  const consoleLogs = [];
  const consoleErrors = [];
  const networkFailures = [];
  const pageErrors = [];

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  // Capture ALL console messages
  page.on('console', (msg) => {
    const entry = {
      type: msg.type(),
      text: msg.text(),
      location: msg.location(),
    };
    consoleLogs.push(entry);
    if (msg.type() === 'error') {
      consoleErrors.push(entry);
    }
  });

  // Capture uncaught page errors
  page.on('pageerror', (err) => {
    pageErrors.push({ message: err.message, stack: err.stack });
  });

  // Capture failed network requests
  page.on('requestfailed', (req) => {
    networkFailures.push({
      url: req.url(),
      method: req.method(),
      failure: req.failure()?.errorText || 'unknown',
      resourceType: req.resourceType(),
    });
  });

  // ── STAGE 1: Initial page load ──────────────────────────────────────────────
  console.log(`[Stage 1] Navigating to ${BASE_URL} ...`);
  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  } catch (e) {
    console.error(`[Stage 1] Navigation error: ${e.message}`);
  }

  await page.screenshot({ path: SCREENSHOTS[0], fullPage: true });
  console.log(`[Stage 1] Screenshot saved: ${SCREENSHOTS[0]}`);

  const title1 = await page.title();
  const url1 = page.url();
  console.log(`[Stage 1] Page title: "${title1}"`);
  console.log(`[Stage 1] Current URL: ${url1}`);

  // ── STAGE 2: Wait 3 s for JS to fully load ──────────────────────────────────
  console.log('\n[Stage 2] Waiting 3 seconds for JS to load ...');
  await new Promise((r) => setTimeout(r, 3000));

  await page.screenshot({ path: SCREENSHOTS[1], fullPage: true });
  console.log(`[Stage 2] Screenshot saved: ${SCREENSHOTS[1]}`);

  const title2 = await page.title();
  console.log(`[Stage 2] Page title: "${title2}"`);

  // Find and print ALL buttons
  const buttons = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button, [role="button"], a.btn, input[type="button"], input[type="submit"]'));
    return btns.map((b) => ({
      tag: b.tagName,
      text: (b.innerText || b.value || '').trim().replace(/\s+/g, ' '),
      id: b.id || null,
      classes: b.className || null,
      visible: b.offsetParent !== null,
    }));
  });

  console.log(`\n[Stage 2] Found ${buttons.length} button(s) on page:`);
  buttons.forEach((b, i) => {
    console.log(`  [${i}] <${b.tag}> text="${b.text}" id="${b.id}" classes="${b.classes}" visible=${b.visible}`);
  });

  // Print visible page text (first 500 chars)
  const bodyText = await page.evaluate(() => document.body?.innerText?.trim().replace(/\s+/g, ' ').slice(0, 500));
  console.log(`\n[Stage 2] Visible page text (first 500 chars):\n  "${bodyText}"`);

  // ── STAGE 3: Click "Start Empty Workout" if it exists ───────────────────────
  console.log('\n[Stage 3] Looking for "Start Empty Workout" button ...');

  const targetButton = buttons.find(
    (b) => b.text.toLowerCase().includes('start empty workout') || b.text.toLowerCase().includes('empty workout')
  );

  if (targetButton) {
    console.log(`[Stage 3] Found button: "${targetButton.text}" — clicking ...`);
    try {
      // Try clicking by text content
      await page.evaluate((text) => {
        const all = Array.from(document.querySelectorAll('button, [role="button"], a.btn, input[type="button"]'));
        const match = all.find((b) => (b.innerText || b.value || '').includes(text));
        if (match) match.click();
      }, targetButton.text);
    } catch (e) {
      console.error(`[Stage 3] Click error: ${e.message}`);
    }
  } else {
    console.log('[Stage 3] "Start Empty Workout" button NOT found. Listing all button texts again:');
    buttons.forEach((b) => console.log(`  - "${b.text}"`));
  }

  await new Promise((r) => setTimeout(r, 2000));

  await page.screenshot({ path: SCREENSHOTS[2], fullPage: true });
  console.log(`[Stage 3] Screenshot saved: ${SCREENSHOTS[2]}`);

  const title3 = await page.title();
  const url3 = page.url();
  console.log(`[Stage 3] Page title: "${title3}"`);
  console.log(`[Stage 3] Current URL: ${url3}`);

  // Print buttons after click
  const buttons3 = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button, [role="button"], a.btn, input[type="button"], input[type="submit"]'));
    return btns.map((b) => ({
      tag: b.tagName,
      text: (b.innerText || b.value || '').trim().replace(/\s+/g, ' '),
      id: b.id || null,
      classes: b.className || null,
      visible: b.offsetParent !== null,
    }));
  });
  console.log(`\n[Stage 3] Found ${buttons3.length} button(s) after click:`);
  buttons3.forEach((b, i) => {
    console.log(`  [${i}] <${b.tag}> text="${b.text}" id="${b.id}" classes="${b.classes}" visible=${b.visible}`);
  });

  await browser.close();

  // ── SUMMARY REPORT ──────────────────────────────────────────────────────────
  console.log('\n\n============================');
  console.log('=== CONSOLE MESSAGES LOG ===');
  console.log('============================');
  if (consoleLogs.length === 0) {
    console.log('(none)');
  } else {
    consoleLogs.forEach((entry, i) => {
      const loc = entry.location?.url
        ? ` [${entry.location.url}:${entry.location.lineNumber}]`
        : '';
      console.log(`  [${i}] [${entry.type.toUpperCase()}]${loc} ${entry.text}`);
    });
  }

  console.log('\n============================');
  console.log('=== CONSOLE ERRORS ONLY ===');
  console.log('============================');
  if (consoleErrors.length === 0) {
    console.log('(none)');
  } else {
    consoleErrors.forEach((entry, i) => {
      const loc = entry.location?.url
        ? ` [${entry.location.url}:${entry.location.lineNumber}]`
        : '';
      console.log(`  [${i}] [ERROR]${loc} ${entry.text}`);
    });
  }

  console.log('\n============================');
  console.log('=== UNCAUGHT PAGE ERRORS ===');
  console.log('============================');
  if (pageErrors.length === 0) {
    console.log('(none)');
  } else {
    pageErrors.forEach((entry, i) => {
      console.log(`  [${i}] ${entry.message}`);
      if (entry.stack) console.log(`       Stack: ${entry.stack}`);
    });
  }

  console.log('\n============================');
  console.log('=== NETWORK FAILURES ===');
  console.log('============================');
  if (networkFailures.length === 0) {
    console.log('(none)');
  } else {
    networkFailures.forEach((entry, i) => {
      console.log(`  [${i}] [${entry.method}] ${entry.url} — ${entry.failure} (${entry.resourceType})`);
    });
  }

  console.log('\n=== TEST COMPLETE ===');
  
  if (pageErrors.length > 0) {
    console.error(`\nFAIL: ${pageErrors.length} uncaught page errors found.`);
    process.exit(1);
  }

  if (consoleErrors.length > 0) {
    const hasCritical = consoleErrors.some(e => e.text.includes('ReferenceError') || e.text.includes('Error'));
    if (hasCritical) {
      console.error(`\nFAIL: ${consoleErrors.length} console errors found.`);
      process.exit(1);
    }
  }

  const criticalFailures = networkFailures.filter(f => f.url.startsWith(BASE_URL));
  if (criticalFailures.length > 0) {
    console.error(`\nFAIL: ${criticalFailures.length} critical network failures to local server.`);
    process.exit(1);
  }

  console.log('\nPASS: No critical errors found.');
}

run().catch((err) => {
  console.error('Fatal error running Puppeteer test:', err);
  process.exit(1);
});

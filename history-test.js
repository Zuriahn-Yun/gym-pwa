const puppeteer = require('puppeteer');

async function testHistory() {
  console.log('=== HISTORY RENDERING TEST ===');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  // 1. Inject Login Session directly
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    window.__MOCK_USER = {
      id: '5b2711de-4d6c-4024-a707-4fecc31eaa69',
      email: 'zuriahnyun1@gmail.com'
    };
    // Force re-navigate with the mock user
    window.location.hash = '#/history';
  });

  // 2. Navigate to History
  console.log('Navigating to History...');
  await page.goto('http://localhost:3000/#/history', { waitUntil: 'networkidle2' });
  
  // Wait for initial render
  await page.waitForSelector('.calendar-view', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 2000));

  // 3. Go to Feb (click prev twice)
  console.log('Waiting for calendar navigation buttons...');
  await page.waitForSelector('#prev-month', { timeout: 15000 });
  
  console.log('Clicking Prev Month (to March)...');
  await page.click('#prev-month');
  await new Promise(r => setTimeout(r, 3000));
  
  await page.waitForSelector('#prev-month');
  console.log('Clicking Prev Month (to February)...');
  await page.click('#prev-month');
  
  // Wait for final data load
  await new Promise(r => setTimeout(r, 10000));

  // 4. Verify results
  const results = await page.evaluate(() => {
    return {
      title: document.querySelector('.page-title')?.innerText,
      sessions: document.querySelectorAll('.session-card').length,
      debug: document.querySelector('#history-debug')?.textContent,
      month: document.querySelector('.calendar-header h2')?.innerText,
      dots: document.querySelectorAll('.calendar-day.has-workout').length
    };
  });

  console.log(`Current Month: ${results.month}`);
  console.log(`Found ${results.sessions} session cards on page.`);
  console.log(`Found ${results.dots} calendar dots.`);
  console.log(`Debug Footer: ${results.debug}`);

  await page.screenshot({ path: '/tmp/history-test.png' });

  await browser.close();

  if (results.sessions > 0 || results.dots > 0) {
    console.log('PASS: History rendered successfully.');
    process.exit(0);
  } else {
    console.error('FAIL: No workouts appeared in history.');
    process.exit(1);
  }
}

testHistory().catch(err => {
  console.error(err);
  process.exit(1);
});

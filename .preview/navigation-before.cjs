const { chromium } = require('C:/Users/sami1/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');
const common = { live: true, has_documents: true, chips: [], document_count: 1 };
const agents = [
  { ...common, key: 'mortgage_guidelines', slug: 'mortgage', name: 'Fannie Mae' },
  { ...common, key: 'fha_handbook', slug: 'fha', name: 'FHA' },
];
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage();
    let documents = 0, me = 0;
    page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents++; });
    await page.route('**/api/v1/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/auth/me')) me++;
      await route.fulfill({ json: path.endsWith('/auth/me') ? { full_name: 'Test User', email: 'test@example.test' } : path.endsWith('/agents') ? agents : [] });
    });
    await page.goto('http://localhost:3000/category/mortgage');
    const scope = page.getByRole('button', { name: 'Agent scope' });
    await scope.waitFor();
    await page.evaluate(() => { window.navigationSentinel = {}; window.originalSidebar = document.querySelector('aside[aria-label="Main navigation"]'); });
    const before = { documents, me };
    await scope.click();
    await page.getByRole('option', { name: 'FHA', exact: true }).click();
    await page.waitForURL('**/category/fha');
    await scope.waitFor();
    await page.waitForLoadState('networkidle');
    console.log(JSON.stringify({ before, after: { documents, me }, ...await page.evaluate(() => ({ sameDocument: !!window.navigationSentinel, sameSidebar: window.originalSidebar === document.querySelector('aside[aria-label="Main navigation"]') })) }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

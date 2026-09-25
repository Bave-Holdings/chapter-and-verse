/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require('C:/Users/sami1/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');
const assert = require('node:assert/strict');

const timestamp = '2026-09-24T08:13:00Z';
const question = 'Can gift funds be used for the down payment on a Fannie Mae loan?';
const labels = ['B3-4.3-04: Personal Gifts', 'Minimum Borrower Contribution Requirements', 'Documentation Requirements', 'Verifying Donor Availability of Funds and Transfer of Gift Funds'];
const sources = labels.map((label, index) => ({
  index: index + 1, document_id: 'guide', doc_name: 'Fannie Mae Selling Guide.pdf', page_number: 212 + index,
  section_id: 'B3-4.3-04', sub_section_id: index ? `${label}: ${label}` : label,
  citation_url: `/api/v1/documents/guide/file#page=${212 + index}`,
  cited_passages: [{claim: 'Gift funds', passage: 'A borrower may use funds received as a personal gift from an acceptable donor.', page_number: 212 + index}],
}));
const presentation = {
  scope: {label: 'Fannie Mae personal gift funds', detail: 'Use of personal gifts for down payment, closing costs, or reserves under the cited Fannie Mae guidance.', not_found: false},
  verdict: {type: 'clear', kicker: 'Verdict', text: 'Yes, personal gift funds may be used, subject to occupancy, donor, and minimum-contribution rules.', reason: 'Gift funds may be used for all or part of the down payment when the property is a principal residence or second home, the donor is acceptable, and any minimum borrower contribution requirement is met. Gifts are not allowed on investment properties.', source_ids: [1]},
  borrower_script: 'Yes. On a Fannie Mae loan, personal gift funds can be used for the down payment if the property is a principal residence or second home, the donor is acceptable, and the applicable minimum borrower contribution rule is satisfied. Investment-property gifts are not allowed. A signed gift letter and proof the funds are available or transferred are required.',
  key_callout: 'The key limitation is the minimum borrower contribution rule: some scenarios allow all needed funds to come from a gift, while a 2- to 4-unit principal residence or second home over 80% LTV/CLTV/HCLTV requires 5% from the borrower’s own funds first.',
  statuses: [
    {type: 'clear', item: 'Personal gift funds', reason: 'A borrower secured by a principal residence or second home may use personal gifts from an acceptable donor for all or part of the down payment, closing costs, or reserves, subject to minimum contribution requirements.', source_ids: [1]},
    {type: 'clear', item: '1-unit principal residence', reason: 'No borrower own-funds contribution is required, even when LTV/CLTV/HCLTV is over 80%; all funds needed may come from a gift.', source_ids: [2]},
    {type: 'clear', item: 'Principal residence or second home at 80% or less', reason: 'No borrower own-funds contribution is required; all funds needed to complete the transaction may come from a gift.', source_ids: [2]},
    {type: 'fixable', item: 'Gift documentation', reason: 'A signed gift letter must be obtained, and donor availability or transfer of the funds must be verified as required.', source_ids: [3, 4]},
    {type: 'blocker', item: '2- to 4-unit principal residence or second home over 80%', reason: 'The borrower must contribute 5% from their own funds first; after that, gifts may supplement the down payment, closing costs, and reserves.', source_ids: [2]},
  ],
  steps: [
    {title: 'Apply the minimum-contribution rule', bullets: ['1-unit principal residence: no borrower own-funds contribution is required, even over 80%; all funds needed may come from a gift.', 'Principal residence or second home at 80% LTV/CLTV/HCLTV or less: no borrower own-funds contribution is required; all funds may come from a gift.', '2- to 4-unit principal residence or second home over 80%: borrower must contribute 5% from their own funds first; gift funds may supplement after that.'], stop_if: null, watch_out: null, source_ids: [2]},
    {title: 'Obtain and verify gift documentation', bullets: ['Obtain a signed gift letter with the gift amount, no-repayment statement, donor contact information, and relationship.', 'Verify donor availability or transfer of the funds as required.'], stop_if: null, watch_out: null, source_ids: [3, 4]},
  ],
  plan_b: [], easiest_fix: null,
  donts: [{text: 'Do not use gifts on an investment property.', source_ids: [1]}, {text: 'Do not skip the 5% borrower own-funds contribution for a 2- to 4-unit principal residence or second home over 80% LTV/CLTV/HCLTV.', source_ids: [2]}],
  documents: [{label: 'Signed gift letter with gift amount, no-repayment statement, donor name, address, telephone number, and relationship to the borrower', source_ids: [3]}, {label: 'Verification that sufficient gift funds are in the donor’s account or have been transferred to the borrower, closing agent, or settlement', source_ids: [4]}],
  next_fact_needed: null, verify_line: null,
};
const user = {id: 'review-user', full_name: 'Test Account', email: 'review@example.test', role: 'user', created_at: timestamp};
const agent = {key: 'mortgage_guidelines', slug: 'mortgage', name: 'Mortgage', live: true, kb_label: 'Selling Guide', empty_title: 'Ask mortgage', empty_sub: '', placeholder: 'Message...', chips: [], document_count: 1, pages_ingested: 10, total_pages: 10, has_documents: true};
const chat = {id: 'review-chat', user_id: user.id, agent_key: agent.key, title: question, created_at: timestamp, updated_at: timestamp};
const baseMessage = {chat_id: chat.id, status: 'answered', analysis: null, audit_id: null, created_at: timestamp, ui_state: {completed_step_ids: [], checked_document_ids: []}};
const messages = [{...baseMessage, id: 'question', role: 'user', content: question, sources: [], presentation: null}, {...baseMessage, id: 'answer', role: 'assistant', content: '', sources, presentation}];

(async () => {
  const browser = await chromium.launch({channel: 'chrome', headless: true});
  try {
    for (const width of [1920, 1512, 1280, 1100, 900, 390, 320]) {
      const page = await browser.newPage({viewport: {width, height: width < 500 ? 844 : 1000}, deviceScaleFactor: 1});
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/api/v1/**', async route => {
        const path = new URL(route.request().url()).pathname;
        let body;
        if (path === '/api/v1/auth/me') body = user;
        else if (path === '/api/v1/agents') body = [agent];
        else if (path === '/api/v1/chats/review-chat') body = {...chat, messages};
        else if (path === '/api/v1/chats') body = [chat];
        else if (path.endsWith('/ui-state')) body = {message_id: 'answer', ui_state: route.request().postDataJSON()};
        else throw new Error(`Unexpected API request: ${path}`);
        await route.fulfill({json: body});
      });
      await page.goto('http://localhost:3002/category/mortgage?chat=review-chat');
      await page.getByRole('article', {name: 'Answer'}).waitFor();
      await page.keyboard.press('Escape');
      await page.evaluate(() => document.fonts.ready);
      const log = page.getByRole('log');
      await log.evaluate(el => { el.scrollTop = 0; });
      await page.screenshot({path: `.preview/review-${width}-top.png`});
      const layout = await page.evaluate(() => {
        const answer = document.querySelector('.cv-answer');
        const cite = answer.querySelector('.cv-cite');
        const composer = document.querySelector('input[aria-label="Write a message"]').closest('form');
        const log = document.querySelector('[role="log"]');
        return {
          documentWidth: document.documentElement.scrollWidth, viewport: innerWidth,
          answerWidth: answer.getBoundingClientRect().width,
          citationFont: getComputedStyle(cite).fontSize,
          badgeIconWidth: answer.querySelector('.cv-badge svg').getBoundingClientRect().width,
          logWidth: log.clientWidth, logScrollWidth: log.scrollWidth,
          composerBottom: composer.getBoundingClientRect().bottom, height: innerHeight,
          overflowingChips: [...answer.querySelectorAll('.cv-cite')].filter(el => el.getBoundingClientRect().right > el.closest('.cv-cites').getBoundingClientRect().right + 1).length,
        };
      });
      assert(layout.documentWidth <= width, `Page overflow: ${JSON.stringify(layout)}`);
      assert(layout.logScrollWidth <= layout.logWidth, `Conversation overflow: ${JSON.stringify(layout)}`);
      assert.equal(layout.citationFont, '12px');
      assert.equal(layout.badgeIconWidth, 14);
      assert.equal(layout.overflowingChips, 0);
      assert(layout.composerBottom <= layout.height);
      await page.locator('.cv-status').evaluate(el => el.scrollIntoView({block: 'start'}));
      await page.screenshot({path: `.preview/review-${width}-status.png`});
      await page.locator('.cv-checklist').evaluate(el => el.scrollIntoView({block: 'start'}));
      await page.screenshot({path: `.preview/review-${width}-checklist.png`});
      const chip = page.locator('.cv-checklist .cv-cite').first();
      const label = await chip.innerText();
      await chip.click();
      const panel = page.getByRole('complementary', {name: 'Citation details'});
      await panel.waitFor();
      assert.equal(await panel.getByRole('tab', {selected: true}).innerText(), label);
      const box = await panel.boundingBox();
      assert.equal(box.y, 0);
      assert.equal(box.height, width < 500 ? 844 : 1000);
      assert.equal(await page.locator('.cv-checklist input').first().isChecked(), false);
      await log.evaluate(el => { el.scrollTop = 0; });
      await page.screenshot({path: `.preview/review-${width}-panel.png`});
      await page.getByRole('button', {name: 'Close citation details'}).click();
      await page.locator('.cv-checklist label').first().click();
      assert.equal(await page.locator('.cv-checklist input').first().isChecked(), true);
      assert.deepEqual(errors, []);
      console.log(JSON.stringify({width, ...layout, panel: 'passed'}));
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode = 1;});

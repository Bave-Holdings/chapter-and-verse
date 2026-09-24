/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require('C:/Users/sami1/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const timestamp = '2026-09-24T08:00:00Z';
const user = {id:'design-user', full_name:'Syed Ahmed',email:'syed@example.test',role:'user',created_at:timestamp};
const base = {live:true,empty_title:'',empty_sub:'',placeholder:'',document_count:1,pages_ingested:100,total_pages:100,has_documents:true};
const agents = [
  {...base,key:'mortgage_guidelines',slug:'mortgage',name:'Mortgage',kb_label:'Fannie Mae',chips:["What’s the max DTI on a conventional loan?",'What income documentation qualifies for Non-QM?']},
  {...base,key:'fha_handbook',slug:'fha',name:'FHA',kb_label:'FHA',chips:['How is self-employment income calculated?']},
  {...base,key:'investment',slug:'investment',name:'Investment',kb_label:'Investment',chips:["What’s the target asset allocation range?"]},
  {...base,key:'compliance',slug:'compliance',name:'Compliance',kb_label:'Compliance',chips:['Do I need pre-clearance to trade individual stocks?']},
  {...base,key:'hr',slug:'hr',name:'HR',kb_label:'HR',chips:[],live:false},
];
const sources = [
  {index:1,document_id:'hud',doc_name:'HUD Handbook 4000.1.pdf',page_number:212,section_id:'II.A.4.c',sub_section_id:'Self-employment income',document_version:'2026.2',citation_url:'/api/v1/documents/hud/file#page=212',cited_passages:[{claim:'Income requirements',passage:'FHA permits income from self-employment when the borrower has been self-employed for at least two years, or between one and two years with prior experience in the same line of work.',page_number:212}]},
  {index:2,document_id:'overlay',doc_name:'Credit Policy 4.2.pdf',page_number:2,section_id:'4.2',sub_section_id:null,source_kind:'overlay',citation_url:'/api/v1/documents/overlay/file#page=2',cited_passages:[{claim:'Firm overlay',passage:'Apply the firm overlay after reviewing the agency guidance.',page_number:2}]},
];
const chat = {id:'figma-chat',user_id:user.id,agent_key:'fha_handbook',title:'FHA self-employed, 18 months',created_at:timestamp,updated_at:timestamp};
const messages = [
  {id:'q1',chat_id:chat.id,role:'user',content:'Can I use self-employment income with 18 months of history?',sources:[],created_at:timestamp},
  {id:'a1',chat_id:chat.id,role:'assistant',content:'Self-employment income may qualify with prior experience in the same line of work. Review the agency requirements and your firm’s overlay. [1] [2]',sources,audit_id:'audit',created_at:timestamp},
];

(async()=>{
  const browser = await chromium.launch({channel:'chrome',headless:true});
  try {
    for (const width of [1280, 768, 390]) {
      const page = await browser.newPage({viewport:{width,height:width<500?844:980}});
      const errors=[];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/api/v1/**', async route=>{
        const path=new URL(route.request().url()).pathname;
        let json;
        if(path==='/api/v1/auth/me') json=user;
        else if(path==='/api/v1/agents') json=agents;
        else if(path==='/api/v1/chats') json=[chat];
        else if(path==='/api/v1/chats/figma-chat') json={...chat,messages};
        else throw new Error(`Unexpected API request: ${path}`);
        await route.fulfill({json});
      });
      for (const [label,path] of [['home','/home'],['chat','/category/fha?chat=figma-chat'],['profile','/profile'],['login','/login'],['signup','/'],['forgot','/forgot-password']]) {
        await page.goto('http://localhost:3000'+path);
        if(['home','chat','profile'].includes(label)) await page.locator('button[aria-label="Open navigation"]').waitFor({state:'attached'});
        if(label==='chat') {
          await page.getByRole('log').waitFor();
          if(await page.getByRole('button',{name:'Close categories and history'}).isVisible()) await page.getByRole('button',{name:'Close categories and history'}).click();
        }
        await page.evaluate(()=>document.fonts.ready);
        await page.locator('img:visible').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
        await page.screenshot({path:`.preview/figma-${label}-${width}.png`,animations:'disabled'});
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${label}: overflow at ${width}`);
        if(label==='chat') {
          if(width === 1280) {
            const downloadEvent = page.waitForEvent('download');
            await page.getByRole('button',{name:'Export conversation'}).click();
            const download = await downloadEvent;
            await download.saveAs('.preview/export-review.json');
            const exported = JSON.parse(fs.readFileSync('.preview/export-review.json','utf8'));
            assert.equal(exported.messages[1].sources[0].document_id,'hud');
            assert.equal(exported.messages[0].content,messages[0].content);
          }
          await page.getByRole('button',{name:'Show source 1',exact:true}).click();
          await page.getByRole('complementary',{name:'Citation details'}).waitFor();
          await page.screenshot({path:`.preview/figma-citation-${width}.png`});
          assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`citation: overflow at ${width}`);
          await page.getByRole('tab',{name:'Credit Policy 4.2'}).click();
          await page.getByText('Apply the firm overlay after reviewing the agency guidance.').waitFor();
          await page.keyboard.press('Escape');
        }
        if(label==='home' && width===390) {
          await page.getByRole('button',{name:'Open navigation'}).click();
          await page.screenshot({path:'.preview/figma-navigation-390.png'});
          await page.getByRole('button',{name:'Close navigation'}).click();
        }
      }
      assert.deepEqual(errors,[],`Browser errors at ${width}`);
      console.log(`Checked home, chat, citations, profile, login, signup, reset at ${width}px`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});

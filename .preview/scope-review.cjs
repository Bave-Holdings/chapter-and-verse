/* eslint-disable @typescript-eslint/no-require-imports */
const {chromium}=require('C:/Users/sami1/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');
const assert=require('node:assert/strict');
const timestamp='2026-09-24T08:00:00Z';
const common={live:true,empty_title:'',empty_sub:'',placeholder:'',document_count:1,pages_ingested:1,total_pages:1,has_documents:true};
const agents=[
 {...common,key:'mortgage_guidelines',slug:'mortgage',name:'Mortgage',kb_label:'Fannie Mae',chips:['What is the maximum DTI?']},
 {...common,key:'fha_handbook',slug:'fha',name:'FHA',kb_label:'FHA',chips:['What are the income requirements?']},
 {...common,key:'compliance',slug:'compliance',name:'Compliance',kb_label:'Compliance',chips:['What is the current policy?']},
];
const chats=Array.from({length:12},(_,i)=>({id:'chat-'+i,user_id:'user',agent_key:agents[i%3].key,title:['Fannie Mae','FHA','Compliance'][i%3]+' conversation '+i,created_at:timestamp,updated_at:'2026-09-'+String(24-i).padStart(2,'0')+'T08:00:00Z'}));
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  for(const width of [1512,1280,900,768,390,320]) {
   const page=await browser.newPage({viewport:{width,height:width<768?844:980}});
   const errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/api/v1/**',async route=>{
    const url=new URL(route.request().url());
    let json;
    if(url.pathname==='/api/v1/auth/me')json={id:'user',full_name:'Syed Ahmed',email:'syed@example.test',role:'user',created_at:timestamp};
    else if(url.pathname==='/api/v1/agents')json=agents;
    else if(url.pathname==='/api/v1/chats')json=chats.filter(chat=>chat.agent_key===url.searchParams.get('agent_key'));
    else if(url.pathname.startsWith('/api/v1/chats/')) {
     const chat=chats.find(chat=>chat.id===url.pathname.split('/').pop());
     assert(chat);
     json={...chat,messages:[{id:'question-'+chat.id,chat_id:chat.id,role:'user',content:'Question for '+chat.agent_key,sources:[],created_at:timestamp}]};
    } else throw new Error('Unexpected request '+url.pathname);
    await route.fulfill({json});
   });
   await page.goto('http://localhost:3000/category/mortgage');
   const scope=page.getByRole('button',{name:'Agent scope'});
   await scope.waitFor();
   assert.match(await scope.textContent(),/Fannie Mae/);
   assert.equal(await page.getByRole('button',{name:/Collapse sidebar|Expand sidebar/}).count(),0);
   assert.equal(await page.getByRole('complementary',{name:/category drawer/i}).count(),0);
   await scope.click();
   await page.getByRole('listbox',{name:'Agent scope options'}).waitFor();
   await page.screenshot({path:'.preview/scope-menu-open-'+width+'.png'});
   await page.getByRole('option',{name:'FHA'}).click();
   await page.waitForURL('**/category/fha');
   assert.match(await scope.textContent(),/FHA/);
   if(width<768)await page.getByRole('button',{name:'Open navigation'}).click();
   const nav=width<768?page.getByRole('dialog',{name:'Navigation'}):page.getByRole('complementary',{name:'Main navigation'});
   const history=nav.getByRole('region',{name:'Recent conversations'});
   await history.getByRole('button',{name:'Fannie Mae conversation 0',exact:true}).waitFor();
   assert.equal(await history.locator('button[aria-pressed]').count(),12);
   await page.screenshot({path:'.preview/scope-navigation-'+width+'.png'});
   await history.getByRole('button',{name:'Fannie Mae conversation 9',exact:true}).click();
   await page.waitForURL('**/category/mortgage?chat=chat-9');
   await page.getByRole('log').getByText('Question for mortgage_guidelines').waitFor();
   assert.match(await scope.textContent(),/Fannie Mae/);
   if(width<768)await page.getByRole('button',{name:'Open navigation'}).click();
   await history.getByRole('button',{name:'FHA conversation 1',exact:true}).click();
   await page.waitForURL('**/category/fha?chat=chat-1');
   await page.getByRole('log').getByText('Question for fha_handbook').waitFor();
   assert.match(await scope.textContent(),/FHA/);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   const sidebarVisible=await page.getByRole('complementary',{name:'Main navigation'}).isVisible();
   assert.equal(sidebarVisible,width>=768);
   await page.screenshot({path:'.preview/scope-chat-'+width+'.png'});
   assert.deepEqual(errors,[]);
   console.log('Scope switching, 12 combined chats, cross-scope navigation and layout passed at '+width+'px');
   await page.close();
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

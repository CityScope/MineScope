import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const {readSession,viewUrl,defaultEndpoint}=createRequire(import.meta.url)('../dist/session.js');
const sessionSource=readFileSync(new URL('../dist/session.js',import.meta.url),'utf8');

test('one session consumes both service keys before assets and preserves unrelated URL state',()=>{
  const {session,cleanUrl}=readSession('https://example.org/MineScope/?view=3d&unityKey=old#unityKey=unity-example&tableKey=table-example');
  assert.equal(session.unityKey,'unity-example');assert.equal(session.table.apiKey,'table-example');assert.equal(session.table.endpoint,defaultEndpoint);
  assert.equal(cleanUrl,'https://example.org/MineScope/?view=3d');
  const legacy=readSession('https://example.org/MineScope/?tableKey=table-example&unityKey=unity-example#map');
  assert.equal(legacy.cleanUrl,'https://example.org/MineScope/#map');
  assert.equal(readSession('https://example.org/#tableKey=bad%0Akey&unityKey='+ 'x'.repeat(513)).session.table.apiKey,'');
  assert.equal(readSession('https://example.org/#unityKey='+ 'x'.repeat(513)).session.unityKey,'');
});
test('all three views retain runtime access using fragments and the Pages base path',()=>{
  const {session}=readSession('https://example.org/MineScope/#unityKey=unity-example&tableKey=table-example');
  for(const [view,path]of [['community','/MineScope/'],['table','/MineScope/scenario/'],['dashboard','/MineScope/dashboard/']]){
    const url=new URL(viewUrl('https://example.org/MineScope/',view,session));
    assert.equal(url.pathname,path);assert.equal(url.search,'');
    assert.equal(new URLSearchParams(url.hash.slice(1)).get('unityKey'),'unity-example');
    assert.equal(new URLSearchParams(url.hash.slice(1)).get('tableKey'),'table-example');
  }
  assert.throws(()=>viewUrl('https://example.org/MineScope/','unknown',session));
});
test('phone invitations omit Unity access and retain the table transport configuration',()=>{
  const {session}=readSession('https://example.org/#unityKey=unity-example&tableKey=table-example&tableSocket=wss%3A%2F%2Frelay.example%2Fws');
  const invited=new URL(viewUrl('https://example.org/MineScope/','table',session,{participant:true}));
  const keys=new URLSearchParams(invited.hash.slice(1));
  assert.equal(keys.has('unityKey'),false);assert.equal(keys.get('tableKey'),'table-example');assert.equal(keys.get('tableSocket'),'wss://relay.example/ws');
});
test('native view links retain session access for middle-click and open-in-new-tab',()=>{
  const {session}=readSession('https://example.org/MineScope/#unityKey=unity-example&tableKey=table-example');
  const created=[];
  const element=tag=>({tag,children:[],dataset:{},append(...nodes){this.children.push(...nodes);},setAttribute(name,value){this[name]=value;},contains(){return false;}});
  const context=vm.createContext({window:{MineScopeSession:{urlFor:(view,options)=>viewUrl('https://example.org/MineScope/',view,session,options)}},document:{body:{dataset:{appView:'table'}},createElement(tag){const node=element(tag);created.push(node);return node;},querySelector(){return {replaceWith(){}};},addEventListener(){}},URL});
  vm.runInContext(readFileSync(new URL('../dist/view-menu.js',import.meta.url),'utf8'),context);
  const links=created.filter(node=>node.tag==='a');assert.equal(links.length,3);
  for(const link of links){
    const url=new URL(link.href),fragment=new URLSearchParams(url.hash.slice(1));
    assert.equal(fragment.get('tableKey'),'table-example');assert.equal(fragment.get('unityKey'),'unity-example');assert.equal(url.search,'');
    assert.equal(link.referrerPolicy,'no-referrer');assert.equal(link.rel,'noopener noreferrer');
  }
});
test('the blocking session script and existing config scripts preserve access when storage is unavailable',()=>{
  const root={location:{href:'https://example.org/MineScope/#unityKey=unity-example&tableKey=table-example'},history:{state:null,replaceState(_state,_title,url){root.location.href=url;}}};
  const context=vm.createContext({window:root,document:{currentScript:{src:'https://example.org/MineScope/session.js'}},URL,URLSearchParams});
  for(const file of ['session.js','unity-config.js','scenario/table-config.js'])vm.runInContext(readFileSync(new URL('../dist/'+file,import.meta.url),'utf8'),context);
  assert.equal(root.location.href,'https://example.org/MineScope/');assert.equal(root.MineScopeUnityConfig.key,'unity-example');assert.equal(root.MineScopeScenarioConfig.apiKey,'table-example');
  assert.ok(root.MineScopeSession.urlFor('dashboard').includes('#unityKey=unity-example&tableKey=table-example'));
});
test('pasting a session fragment into an already open view activates it',()=>{
  const listeners={};let reloads=0;
  const root={location:{href:'https://example.org/MineScope/dashboard/',hash:'',reload(){reloads++;}},addEventListener(name,fn){listeners[name]=fn;},history:{}};
  const context=vm.createContext({window:root,document:{currentScript:{src:'https://example.org/MineScope/session.js'}},URL,URLSearchParams});
  vm.runInContext(sessionSource,context);
  root.location.hash='#map';listeners.hashchange();assert.equal(reloads,0);
  root.location.hash='#tableKey=table-example';listeners.hashchange();assert.equal(reloads,1);
});
test('the embedded TV table inherits only table access in memory without an authenticated iframe URL',()=>{
  const table={transport:'minescope',endpoint:defaultEndpoint,apiKey:'table-example'};
  const host={MineScopeSession:{table,unityKey:'unity-example'}};
  const root={parent:host,frameElement:{getAttribute:()=> 'true'},location:{href:'https://example.org/MineScope/scenario/?display=tv'},history:{}};
  const html={dataset:{}};
  const context=vm.createContext({window:root,document:{documentElement:html,currentScript:{src:'https://example.org/MineScope/session.js'}},URL,URLSearchParams});
  vm.runInContext(sessionSource,context);
  assert.equal(root.MineScopeSession.displayOnly,true);assert.equal(root.MineScopeScenarioConfig.apiKey,'table-example');assert.equal(root.MineScopeUnityConfig.key,'');
  assert.equal(root.location.href,'https://example.org/MineScope/scenario/?display=tv');assert.equal(html.dataset.tableDisplay,'true');
});

function savedBrowserSession(href,storage,provided={}){
  const root={...provided,location:{href},history:{state:null,replaceState(_state,_title,url){root.location.href=url;}}};
  Object.defineProperty(root,'localStorage',{get:()=>typeof storage==='function'?storage():storage});
  const context=vm.createContext({window:root,document:{documentElement:{dataset:{}},currentScript:{src:'https://example.org/MineScope/session.js'}},URL,URLSearchParams});
  vm.runInContext(sessionSource,context);
  return root;
}
function memoryStorage(){
  const values=new Map();
  return {values,writes:0,removals:0,getItem:key=>values.get(key)??null,setItem(key,value){this.writes++;values.set(key,value);},removeItem(key){this.removals++;values.delete(key);}};
}
test('a launch link saves both keys and all views restore them after refresh and reopening',()=>{
  const storage=memoryStorage();
  const first=savedBrowserSession('https://example.org/MineScope/#tableKey=table-example&unityKey=unity-example',storage);
  assert.equal(first.location.href,'https://example.org/MineScope/');assert.equal(storage.values.size,1);
  for(const path of ['','scenario/','dashboard/']){
    const reopened=savedBrowserSession('https://example.org/MineScope/'+path,storage);
    assert.equal(reopened.MineScopeScenarioConfig.apiKey,'table-example');assert.equal(reopened.MineScopeUnityConfig.key,'unity-example');
    assert.equal(reopened.location.href,'https://example.org/MineScope/'+path);
    const qr=new URL(reopened.MineScopeSession.urlFor('table',{participant:true}));
    assert.equal(new URLSearchParams(qr.hash.slice(1)).get('tableKey'),'table-example');
    assert.equal(new URLSearchParams(qr.hash.slice(1)).has('unityKey'),false);
  }
});
test('a new launch key replaces the saved key and keeps the other service connected',()=>{
  const storage=memoryStorage();
  savedBrowserSession('https://example.org/MineScope/#tableKey=old-table&unityKey=old-unity',storage);
  savedBrowserSession('https://example.org/MineScope/scenario/#tableKey=new-table',storage);
  const refreshed=savedBrowserSession('https://example.org/MineScope/dashboard/',storage);
  assert.equal(refreshed.MineScopeScenarioConfig.apiKey,'new-table');assert.equal(refreshed.MineScopeUnityConfig.key,'old-unity');
  savedBrowserSession('https://example.org/MineScope/?unityKey=new-unity',storage);
  assert.equal(savedBrowserSession('https://example.org/MineScope/',storage).MineScopeUnityConfig.key,'new-unity');
});
test('unchanged refreshes and view switches do not write to local storage',()=>{
  const storage=memoryStorage();
  savedBrowserSession('https://example.org/MineScope/',storage);
  assert.equal(storage.writes,0);assert.equal(storage.removals,0);
  savedBrowserSession('https://example.org/MineScope/#tableKey=table-example&unityKey=unity-example',storage);
  assert.equal(storage.writes,1);
  for(const path of ['scenario/','dashboard/',''])savedBrowserSession('https://example.org/MineScope/'+path,storage);
  assert.equal(storage.writes,1);assert.equal(storage.removals,0);
  savedBrowserSession('https://example.org/MineScope/#tableKey=new-table',storage);
  assert.equal(storage.writes,2);
});
test('explicit empty keys clear saved access without touching workshop notes',()=>{
  const storage=memoryStorage();storage.setItem('minescope-notes-v1','workshop notes');
  savedBrowserSession('https://example.org/MineScope/#tableKey=table-example&unityKey=unity-example',storage);
  const cleared=savedBrowserSession('https://example.org/MineScope/#tableKey=&unityKey=',storage);
  assert.equal(cleared.MineScopeScenarioConfig.apiKey,'');assert.equal(cleared.MineScopeUnityConfig.key,'');
  assert.equal(storage.values.size,1);assert.equal(storage.getItem('minescope-notes-v1'),'workshop notes');
  assert.equal(savedBrowserSession('https://example.org/MineScope/',storage).MineScopeScenarioConfig.apiKey,'');
});
test('saved transport settings survive refresh and are isolated by deployment base path',()=>{
  const storage=memoryStorage();
  savedBrowserSession('https://example.org/MineScope/#tableKey=table-example&tableTransport=table-v1&tableSocket=wss%3A%2F%2Frelay.example%2Fws',storage);
  const refreshed=savedBrowserSession('https://example.org/MineScope/scenario/',storage);
  assert.equal(refreshed.MineScopeScenarioConfig.endpoint,'wss://relay.example/ws');assert.equal(refreshed.MineScopeScenarioConfig.transport,'table-v1');
  const otherContext=vm.createContext({window:{location:{href:'https://example.org/OtherApp/'},localStorage:storage,history:{}},document:{currentScript:{src:'https://example.org/OtherApp/session.js'}},URL,URLSearchParams});
  vm.runInContext(sessionSource,otherContext);
  assert.equal(otherContext.window.MineScopeScenarioConfig.apiKey,'');
});
test('corrupt or invalid saved data and blocked storage do not prevent a keyed launch',()=>{
  for(const raw of ['{broken','null',JSON.stringify({version:9,unityKey:'ignored'}),JSON.stringify({version:1,unityKey:'bad\nkey',table:{apiKey:'x'.repeat(513)}})]){
    const storage=memoryStorage();storage.setItem('minescope-connection-v1:/MineScope/',raw);
    const empty=savedBrowserSession('https://example.org/MineScope/',storage);
    assert.equal(empty.MineScopeUnityConfig.key,'');assert.equal(empty.MineScopeScenarioConfig.apiKey,'');
  }
  for(const storage of [()=>{throw new Error('Storage blocked');},{getItem(){throw new Error('Read blocked');},setItem(){throw new Error('Quota exceeded');}}]){
    const keyed=savedBrowserSession('https://example.org/MineScope/#tableKey=table-example&unityKey=unity-example',storage);
    assert.equal(keyed.MineScopeScenarioConfig.apiKey,'table-example');assert.equal(keyed.MineScopeUnityConfig.key,'unity-example');
    assert.equal(keyed.location.href,'https://example.org/MineScope/');
  }
});
test('invalid saved endpoint settings fall back without losing valid service keys',()=>{
  for(const endpoint of ['invalid endpoint','https://relay.example/ws','wss://user:password@relay.example/ws']){
    const storage=memoryStorage();
    storage.setItem('minescope-connection-v1:/MineScope/',JSON.stringify({version:1,unityKey:'unity-example',table:{apiKey:'table-example',endpoint,transport:'unsupported'}}));
    const reopened=savedBrowserSession('https://example.org/MineScope/',storage);
    assert.equal(reopened.MineScopeUnityConfig.key,'unity-example');assert.equal(reopened.MineScopeScenarioConfig.apiKey,'table-example');
    assert.equal(reopened.MineScopeScenarioConfig.endpoint,defaultEndpoint);assert.equal(reopened.MineScopeScenarioConfig.transport,'minescope');
  }
});
test('the display iframe neither restores Unity access nor overwrites saved parent access',()=>{
  const storage=memoryStorage();
  savedBrowserSession('https://example.org/MineScope/#tableKey=saved-table&unityKey=saved-unity',storage);
  const before=Array.from(storage.values.entries());
  const embedded=savedBrowserSession('https://example.org/MineScope/scenario/?display=tv',storage,{parent:{MineScopeSession:{table:{apiKey:'parent-table',endpoint:defaultEndpoint,transport:'minescope'}}},frameElement:{getAttribute:()=> 'true'}});
  assert.equal(embedded.MineScopeScenarioConfig.apiKey,'parent-table');assert.equal(embedded.MineScopeUnityConfig.key,'');
  assert.deepEqual(Array.from(storage.values.entries()),before);
});

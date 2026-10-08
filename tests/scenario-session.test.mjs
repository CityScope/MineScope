import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const {readSession,viewUrl,defaultEndpoint}=createRequire(import.meta.url)('../dist/session.js');

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
test('the blocking session script and existing config scripts preserve access without storage',()=>{
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
  vm.runInContext(readFileSync(new URL('../dist/session.js',import.meta.url),'utf8'),context);
  root.location.hash='#map';listeners.hashchange();assert.equal(reloads,0);
  root.location.hash='#tableKey=table-example';listeners.hashchange();assert.equal(reloads,1);
});
test('the embedded TV table inherits only table access in memory without an authenticated iframe URL',()=>{
  const table={transport:'minescope',endpoint:defaultEndpoint,apiKey:'table-example'};
  const host={MineScopeSession:{table,unityKey:'unity-example'}};
  const root={parent:host,frameElement:{getAttribute:()=> 'true'},location:{href:'https://example.org/MineScope/scenario/?display=tv'},history:{}};
  const html={dataset:{}};
  const context=vm.createContext({window:root,document:{documentElement:html,currentScript:{src:'https://example.org/MineScope/session.js'}},URL,URLSearchParams});
  vm.runInContext(readFileSync(new URL('../dist/session.js',import.meta.url),'utf8'),context);
  assert.equal(root.MineScopeSession.displayOnly,true);assert.equal(root.MineScopeScenarioConfig.apiKey,'table-example');assert.equal(root.MineScopeUnityConfig.key,'');
  assert.equal(root.location.href,'https://example.org/MineScope/scenario/?display=tv');assert.equal(html.dataset.tableDisplay,'true');
});

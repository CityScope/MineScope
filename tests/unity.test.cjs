const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createClient}=require('../dist/unity.js');
const createSender=options=>createClient(options).sendLocation;

function setup(response={ok:true,status:200,json:async()=>({delivered:1})}){
  const requests=[];
  const send=createSender({getKey:()=> 'test-only-key',fetch:async(url,options)=>{requests.push({url,options});return response;}});
  return {send,requests};
}
test('supported locations send only the documented scene event and authenticate in a header',async()=>{
  const {send,requests}=setup();
  for(const id of ['los-choros','trapiche'])assert.deepEqual(await send(id),{status:'sent',delivered:1});
  assert.equal(requests.length,2);
  for(const [index,{url,options}] of requests.entries()){
    assert.equal(url,'https://mining.mistermatti.com/events');
    assert.equal(options.method,'POST');
    assert.equal(options.headers.Authorization,'Bearer test-only-key');
    assert.equal(options.headers['Content-Type'],'application/json');
    assert.deepEqual(JSON.parse(options.body),{name:'site.load',payload:{site:['LosChoros_Diorama','ElTrapiche_Diorama'][index]}});
    assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');
    assert.ok(!options.body.includes('test-only-key'));
  }
});
test('unmatched locations and missing credentials never send a request',async()=>{
  const {send,requests}=setup();
  for(const id of ['choros','totoralillo','higuera','negrillo','all','toString',undefined])assert.equal((await send(id)).status,'unsupported');
  const noKey=createSender({getKey:()=>'',fetch:async()=>assert.fail('Must not send without a key')});
  assert.equal((await noKey('trapiche')).status,'no-key');assert.equal(requests.length,0);
});
test('each repeated location selection sends exactly one message',async()=>{
  const {send,requests}=setup();await send('trapiche');await send('trapiche');assert.equal(requests.length,2);
});
test('zero listeners is reported without claiming Unity executed the event',async()=>{
  const {send}=setup({ok:true,status:200,json:async()=>({delivered:0})});
  assert.deepEqual(await send('trapiche'),{status:'offline',delivered:0});
});
test('rejected keys and invalid server responses are handled without retries',async()=>{
  for(const response of [{ok:false,status:401},{ok:false,status:403},{ok:false,status:500},{ok:true,status:200,json:async()=>({})}]){
    const {send,requests}=setup(response);
    const result=await send('trapiche');
    assert.equal(result.status,[401,403].includes(response.status)?'unauthorized':'error');
    assert.equal(requests.length,1);
  }
});
test('network errors and timeouts resolve without blocking the map or retrying',async()=>{
  let calls=0;
  const broken=createSender({getKey:()=> 'test-only-key',fetch:async()=>{calls++;throw Error('Network');}});
  assert.equal((await broken('trapiche')).status,'error');assert.equal(calls,1);
  const slow=createSender({getKey:()=> 'test-only-key',timeout:10,fetch:async(url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('Timeout')),{once:true}))});
  assert.equal((await slow('trapiche')).status,'error');
});

test('startup verifies authentication without sending a scene event',async()=>{
 const requests=[];
 const client=createClient({getKey:()=> 'test-only-key',fetch:async(url,options)=>{
  requests.push({url,options});
  return {ok:false,status:400,json:async()=>({error:'expected {"name": "<event name>", "payload": <any JSON, optional>}'})};
 }});
 assert.deepEqual(await client.checkConnection(),{status:'ready'});
 assert.equal(requests.length,1);
 assert.equal(requests[0].options.headers.Authorization,'Bearer test-only-key');
 assert.deepEqual(JSON.parse(requests[0].options.body),{});
});
test('connection check never treats auth failures, server errors or unexpected replies as ready',async()=>{
 for(const status of [200,400,401,403,500]){
  const client=createClient({getKey:()=> 'test-only-key',fetch:async()=>({ok:status===200,status,json:async()=>({error:'unexpected',delivered:1})})});
  assert.deepEqual(await client.checkConnection(),{status:[401,403].includes(status)?'unauthorized':'error'});
 }
});
test('default client has no credential and sends no request',async()=>{
 const client=createClient({fetch:async()=>assert.fail('No key must not contact the server')});
 assert.equal((await client.sendLocation('trapiche')).status,'no-key');
 assert.equal((await client.checkConnection()).status,'no-key');
});

const {readConfig}=require('../dist/unity-config.js');
test('URL key is read, decoded, and removed while preserving other URL state',()=>{
 assert.deepEqual(readConfig('https://example.org/MineScope/?view=3d&unityKey=sample%2Bkey#map'),{
  key:'sample+key',cleanUrl:'https://example.org/MineScope/?view=3d#map'
 });
 assert.deepEqual(readConfig('https://example.org/MineScope/#unityKey=sample-key'),{
  key:'sample-key',cleanUrl:'https://example.org/MineScope/'
 });
});
test('missing and invalid URL keys never fall back to an embedded credential',()=>{
 for(const value of ['', '?unityKey=', '?unityKey=bad%0Aheader', '?unityKey='+ 'a'.repeat(513)]){
  assert.equal(readConfig('https://example.org/MineScope/'+value).key,'');
 }
 assert.deepEqual(readConfig('https://example.org/MineScope/?unityKey=one&unityKey=two'),{
  key:'one',cleanUrl:'https://example.org/MineScope/'
 });
});

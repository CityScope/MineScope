import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultWindBearing,normalizeBearing,windDirection,windLabel,dustDensity,fillDustProfile,profileHeightRange} from '../dist/scenario/wind.mjs';

test('wind bearings follow north-up table coordinates and wrap across north',()=>{
  for(const [bearing,x,z] of [[0,0,-1],[90,1,0],[180,0,1],[270,-1,0]]){
    const direction=windDirection(bearing);
    assert.ok(Math.abs(direction.x-x)<1e-12);
    assert.ok(Math.abs(direction.z-z)<1e-12);
  }
  assert.equal(normalizeBearing(360),0);assert.equal(normalizeBearing(-90),270);
  assert.equal(normalizeBearing(NaN),defaultWindBearing);
  assert.equal(windLabel(360),'0° N');assert.equal(windLabel(125),'125° SE');
});

test('the dust profile follows the new wind direction over ridges without rebuilding its buffer',()=>{
  const width=9,height=5,data=new Uint8Array(width*height*4),origin={x:1,z:2};
  const hill=(x,z)=>.8+Math.max(0,x-2)+Math.max(0,1-z)*2;
  const decode=(i,j)=>(data[(j*width+i)*4]*256+data[(j*width+i)*4+1])/65535*profileHeightRange;
  assert.equal(fillDustProfile(data,width,height,origin,90,hill),data);
  assert.ok(decode(width-1,2)>4,'Eastward dust rises over the ridge to the east');
  fillDustProfile(data,width,height,origin,180,hill);
  assert.ok(Math.abs(decode(width-1,2)-.8)<.001,'Southward dust follows the lower ground');
  fillDustProfile(data,width,height,origin,0,hill);
  assert.ok(decode(width-1,2)>8,'Northward dust follows the taller northern ridge');
});

test('funded dust mitigation reduces the plume, while an unfunded request leaves it unchanged',()=>{
  const make=strength=>({base:{community:62},strength:{dust:strength}});
  const noProtection=dustDensity(make(0));
  assert.ok(dustDensity(make(1))<noProtection*.3);
  assert.ok(dustDensity(make(.5))>dustDensity(make(1)));
  assert.ok(dustDensity(make(.5))<noProtection);
  assert.equal(dustDensity({...make(0),protections:['dust']}),noProtection);
});

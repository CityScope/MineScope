import test from 'node:test';
import assert from 'node:assert/strict';
import {corners,dimensions,bounds,projectedCorners,normalizedToGeo,geoToNormalized,geoToLocal,localToGeo} from '../dist/scenario/extent.mjs';
import {sampleGrid,clipSegment,projectFeatures,lineSegments,flowPath} from '../dist/scenario/geography-core.mjs';
import {decodeTerrarium,mercatorPixel} from '../dist/scenario/geography.mjs';

test('the four supplied corners map to the physical corners',()=>{
  for(const [id,u,v] of [['NW',0,0],['NE',1,0],['SE',1,1],['SW',0,1]]) {
    const p=normalizedToGeo({u,v});assert.ok(Math.abs(p.lat-corners[id].lat)<1e-8);assert.ok(Math.abs(p.lon-corners[id].lon)<1e-8);
    const q=geoToNormalized(corners[id]);assert.ok(Math.abs(q.u-u)<1e-10);assert.ok(Math.abs(q.v-v)<1e-10);
  }
  assert.ok(bounds.width/bounds.depth>1&&bounds.width/bounds.depth<1.01);
  assert.ok(dimensions.widthKm>47.2&&dimensions.widthKm<47.4);assert.ok(dimensions.depthKm>47&&dimensions.depthKm<47.1);
});
test('UTM agrees with an independent EPSG:32719 reference',()=>{
  // Computed with PROJ from the user-authored NW corner.
  assert.ok(Math.abs(projectedCorners.NW.x-258740.22652967888)<.01);
  assert.ok(Math.abs(projectedCorners.NW.y-6771671.121841114)<.01);
});
test('geographic positions round trip across the supplied GeoJSON rectangle',()=>{
  for(let u=0;u<=1;u+=.1)for(let v=0;v<=1;v+=.1){const p=normalizedToGeo({u,v}),q=geoToNormalized(p);assert.ok(Math.abs(q.u-u)<1e-7);assert.ok(Math.abs(q.v-v)<1e-7);const local=geoToLocal(p),again=localToGeo(local);assert.ok(Math.abs(again.lat-p.lat)<1e-7);}
});
test('all points on each table edge follow the exact GeoJSON latitude or longitude',()=>{
  for(let t=0;t<=1;t+=.1) {
    assert.equal(normalizedToGeo({u:t,v:0}).lat,-29.160639);
    assert.equal(normalizedToGeo({u:t,v:1}).lat,-29.585199);
    assert.equal(normalizedToGeo({u:0,v:t}).lon,-71.480437);
    assert.equal(normalizedToGeo({u:1,v:t}).lon,-70.993245);
  }
});
test('DEM sampling preserves orientation and bilinear elevation',()=>{
  const g={width:2,height:2,data:new Float32Array([100,200,300,400])};
  assert.equal(sampleGrid(g,-bounds.width/2,-bounds.depth/2),100);assert.equal(sampleGrid(g,bounds.width/2,bounds.depth/2),400);assert.equal(sampleGrid(g,0,0),250);
  assert.equal(decodeTerrarium(128,0,0),0);assert.equal(decodeTerrarium(137,219,68),2523.265625);
  assert.ok(mercatorPixel(corners.NW,12).y<mercatorPixel(corners.SW,12).y);
});
test('geographic lines are clipped without flattening their crossings',()=>{
  const segment=clipSegment({x:-30,z:0},{x:30,z:0});assert.ok(Math.abs(segment[0].x+11)<1e-10);assert.ok(Math.abs(segment[1].x-11)<1e-10);
  assert.equal(clipSegment({x:-30,z:20},{x:30,z:20}),null);
  const features=projectFeatures({features:[{geometry:{type:'LineString',coordinates:[[corners.NW.lon,corners.NW.lat],[corners.SE.lon,corners.SE.lat]]},properties:{NOMBRE:'fixture'}}]});
  assert.equal(features[0].properties.NOMBRE,'fixture');assert.equal(lineSegments(features).length,2);
});
test('downhill projection stops at sinks and the boundary',()=>{
  const path=flowPath({x:0,z:0},(x,z)=>100+x*10,200);assert.ok(path.length>1);for(let i=1;i<path.length;i++)assert.ok(path[i].x<path[i-1].x);
  assert.equal(flowPath({x:0,z:0},()=>100).length,1);
});

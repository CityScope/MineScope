import test from 'node:test';
import assert from 'node:assert/strict';
import {allocateFund,interventions,fundTotal} from '../dist/scenario/funding.mjs';

test('site costs and selected protections draw from one finite fund',()=>{
  const f=allocateFund(40,['water','habitat']);
  assert.equal(f.total,fundTotal);assert.equal(f.site,9.2);
  assert.equal(f.protection,5.95);assert.equal(f.remaining,4.85);
  assert.equal(f.allocations.water.fraction,1);assert.equal(f.allocations.dust.requested,false);
});
test('limited money funds requests in selection order, including a partial allocation',()=>{
  const f=allocateFund(80,['water','habitat','dust']);
  assert.equal(f.allocations.water.amount,2.8);
  assert.equal(f.allocations.habitat.amount,.8);
  assert.ok(Math.abs(f.allocations.habitat.fraction-.8/3.15)<1e-12);
  assert.equal(f.allocations.dust.amount,0);
  assert.equal(f.remaining,0);
  const reordered=allocateFund(80,['dust','water']);
  assert.equal(reordered.allocations.dust.fraction,1);
  assert.equal(reordered.allocations.water.amount,1.85);
});
test('removal releases money and moving to a cheaper site restores waiting allocations',()=>{
  const selected=['water','habitat','dust'],high=allocateFund(80,selected),low=allocateFund(20,selected);
  assert.equal(low.allocations.habitat.fraction,1);assert.equal(low.allocations.dust.fraction,1);
  assert.ok(low.remaining>0);assert.equal(high.allocations.dust.amount,0);
  const removed=allocateFund(80,['habitat']);
  assert.equal(removed.allocations.habitat.fraction,1);assert.ok(removed.remaining>0);
  assert.equal(removed.allocations.water.amount,0);
});
test('all allocations conserve money and cannot exceed the fund',()=>{
  for(let index=0;index<=100;index+=.25) {
    const f=allocateFund(index,interventions.map(i=>i.id));
    assert.ok(f.remaining>=0);assert.ok(Math.abs(f.site+f.protection+f.remaining-f.total)<1e-9);
    for(const a of Object.values(f.allocations))assert.ok(a.amount>=0&&a.amount<=a.cost&&a.fraction>=0&&a.fraction<=1);
  }
  const exhausted=allocateFund(100,['water']);assert.equal(exhausted.allocations.water.fraction,0);
  assert.equal(exhausted.remaining,0);assert.equal(exhausted.site,fundTotal);
  const duplicate=allocateFund(40,['water','water','unknown']);assert.equal(duplicate.protection,2.8);
});

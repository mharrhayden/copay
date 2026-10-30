import test from 'node:test';
import assert from 'node:assert/strict';
import { getProduct } from './products.js';
import { getBrackets, getDefaultVoucherPolicy } from './cohorts.js';
import { selectBracket, bracketForOop, createSubfillSchedule, continuationProbability, generatePatient, voucherBenefit, calculateRevenue, simulateYear } from './simulation.js';
import { getStartMonthDistribution, selectStartMonth } from './start-month.js';
import { getSubfillWeights } from './subfill-distributions.js';
import { getPersistenceCurve } from './persistence.js';
import { runDistributionQc } from './qc.js';
import { createCohortRun, addPatientToRun, cohortRevenue, simulatePatientBatch } from './batch.js';
import { buildPatientQc, buildMostPopulatedCohortMatrix } from './patient-qc.js';
import { missingModelInputs, hasPatientData } from './model-readiness.js';
const brackets = getBrackets('qulipta');
const policy = getDefaultVoucherPolicy('qulipta');
const get = id => brackets.find(bracket => bracket.id === id);
const draws = (...values) => () => values.length ? values.shift() : 0.999999;

test('Qulipta keeps all 16 supplied cohort amounts, rates and GTN ranges distinct from Ubrelvy', () => {
  assert.equal(brackets.length, 16);
  assert.deepEqual(brackets.map(b => b.oopCents), [0,348,929,1452,1927,2454,4001,7281,14455,23672,33943,47769,55151,64345,94839,111404]);
  assert.deepEqual(brackets.map(b => b.abandonmentBasisPoints), [790,1205,1532,2357,2668,2668,3139,5000,5959,7452,8147,8167,8167,8294,8294,8985]);
  assert.deepEqual(brackets.map(b => b.surpriseDropoffBasisPoints), [0,667,1193,1205,1534,1534,1790,2628,2828,3620,3620,3812,4607,4607,4974,5911]);
  assert.deepEqual(brackets.map(b => b.gtnRatePercent), [66,66,66,66,66,66,66,59,59,59,59,59,48,48,48,48]);
  assert.equal(get('Q').label, '$1,000+');
  assert.equal(bracketForOop(100000,'qulipta').id, 'P');
  assert.equal(bracketForOop(100001,'qulipta').id, 'Q');
  assert.equal(bracketForOop(130001,'qulipta').id, 'Q');
  assert.equal(bracketForOop(130001,'ubrelvy').id, 'R');
});

test('99.9% supplied starting distribution normalizes without dropping or inflating a cohort', () => {
  const expected = [0,33,26,27,42,73,424,124,73,24,11,12,22,17,8,83];
  assert.deepEqual(brackets.map(b => b.weight), expected);
  assert.equal(expected.reduce((a,b) => a+b),999);
  const counts = new Map(brackets.map(b => [b.id,0]));
  for (let ticket=0;ticket<999;ticket++) {
    const bracket=selectBracket((ticket+0.5)/999,'qulipta');
    counts.set(bracket.id,counts.get(bracket.id)+1);
  }
  assert.deepEqual([...counts.values()],expected);
});

test('Qulipta New and Continuing monthly starts match the supplied 2025 tables', () => {
  for (const [type,expected] of Object.entries({new:[793,763,820,849,809,791,857,850,872,975,815,806],continuing:[6209,1701,1020,408,202,140,99,73,55,44,28,20]})) {
    const distribution = getStartMonthDistribution(type,'qulipta');
    assert.deepEqual(distribution.map(m=>Math.round(m.sourcePercent*100)),expected);
    const total=expected.reduce((a,b)=>a+b);
    const counts=Array(12).fill(0);
    for(let ticket=0;ticket<total;ticket++)counts[selectStartMonth((ticket+0.5)/total,type,'qulipta').month-1]++;
    assert.deepEqual(counts,expected);
  }
});

test('Qulipta New persistence reproduces the supplied cumulative curves including nonzero fill 12', () => {
  assert.deepEqual(getPersistenceCurve(get('A'),'new'),[100,77,54,39,29,22,16,11,8,5,3,1]);
  assert.deepEqual(getPersistenceCurve(get('Q'),'new'),[100,31,22,15,11,8,6,4,3,2,1,0]);
  for(const bracket of brackets){
    let remaining=1;
    for(let fill=2;fill<=12;fill++){
      remaining*=continuationProbability(bracket,fill,'new');
      assert.ok(Math.abs(remaining-bracket.retention[fill-1]/100)<1e-12);
    }
  }
});

test('Qulipta New source paths preserve supplied marginals and never rise across all 16 cohorts', () => {
  assert.equal(getSubfillWeights('new','qulipta').B.A[1],3992);
  assert.equal(getSubfillWeights('new','qulipta').B.A[2],6509);
  for(const bracket of brackets){
    const qc=runDistributionQc(bracket,10000,'new');
    assert.equal(qc.increasingPaths,0,bracket.id);
    assert.ok(qc.maxDifferencePp<=0.010000001,bracket.id);
  }
});

test('Qulipta uses its own fixed WAC, standard cap, EB rule and annual maximum', () => {
  const product=getProduct('qulipta');
  assert.equal(product.wacCents,126480);
  assert.equal(product.standardBuydownCents,50000);
  assert.equal(product.annualBuydownCapCents,700000);
  assert.equal(product.expandedBenefitFills,2);
  assert.equal(voucherBenefit(111404,1,true,'qulipta').effectiveOopCents,0);
  assert.equal(voucherBenefit(111404,3,true,'qulipta').buydownCents,50000);
  assert.equal(voucherBenefit(111404,3,true,'qulipta',100).buydownCents,100);
  const patient={productId:'qulipta',bracket:get('G'),fillCount:2,programSpendCents:8002,voucherFillCount:2};
  const revenue=calculateRevenue(patient);
  assert.equal(revenue.revenueCents,252960);
  assert.equal(revenue.gtnDeductionCents,166954);
  assert.equal(revenue.cogsCents,2530);
  assert.equal(revenue.tfCents,1300);
  assert.equal(revenue.netRevenueLessCogsTfCents,74174);
});

test('Qulipta eligibility can exclude expensive cohorts; assistance changes first-fill behavior before abandonment', () => {
  const make=policy=>generatePatient(1,policy,draws(0.999,0.5),()=>0.99999,()=>0,'new','qulipta');
  const eligible=make(policy);
  const ineligible=make({eligibleCohortIds:['A','B']});
  assert.equal(eligible.bracket.id,'Q');
  assert.equal(eligible.fills[0].behaviorBracket.id,'A');
  assert.equal(eligible.outcome,'Filled');
  assert.equal(ineligible.fills[0].behaviorBracket.id,'Q');
  assert.equal(ineligible.outcome,'Abandoned');
  assert.equal(ineligible.programSpendCents,0);
});

test('Qulipta can reach fill 12, applies recurring surprise, respects annual balance and December cutoff', () => {
  const schedule=createSubfillSchedule(get('Q'),()=>0.99999,'new');
  const clinical=[0.99,0];for(let fill=3;fill<=12;fill++)clinical.push(0,0.99);
  const fills=simulateYear(get('Q'),policy,draws(...clinical),schedule);
  assert.equal(fills.filter(f=>f.filled).length,12);
  assert.equal(fills[2].effectiveOopCents,61404);
  assert.equal(fills[2].oopBracket.id,'O');
  assert.equal(fills[2].surpriseDropoffProbability,0.4607);
  assert.equal(fills[3].copaySurprise,true);
  const spend=fills.reduce((n,f)=>n+f.voucherCostCents,0);
  assert.equal(spend,700000);
  assert.ok(fills.every(f=>f.annualSupportAfterCents>=0));
  const december=simulateYear(get('Q'),policy,()=>0.99,schedule,12,'new','qulipta');
  assert.equal(december.filter(f=>f.filled).length,1);
  assert.ok(december.slice(1).every(f=>!f.attempted&&f.voucherCostCents===0));
});

test('Qulipta batch totals reconcile and never use Ubrelvy comparison benchmarks', async () => {
  const run=await simulatePatientBatch({patientCount:1000,policy,patientType:'new',productId:'qulipta',random:()=>0.5,yieldControl:async()=>{}});
  assert.equal(run.cohorts.length,16);
  assert.equal(run.startMonthStats.productId,'qulipta');
  const financial=cohortRevenue(run);
  assert.equal(financial.totals.patientCount,1000);
  assert.equal(financial.totals.netRevenueCents,financial.totals.revenuePostGtnCents-financial.totals.programSpendCents);
  const qc=buildPatientQc(run);
  assert.equal(qc.total.benchmark,null);
  assert.ok(qc.rows.every(row=>row.benchmark===null&&row.differences.scripts===null));
  assert.equal(buildMostPopulatedCohortMatrix(run).reconciles,true);
  const ubrelvy=createCohortRun(getDefaultVoucherPolicy('ubrelvy'));
  const patient=generatePatient(1,policy,()=>0.5,()=>0.5,()=>0,'new','qulipta');
  assert.throws(()=>addPatientToRun(ubrelvy,patient),/product/);
});

test('Qulipta Continuing is ready and uses its supplied persistence rather than New or Ubrelvy curves', () => {
  assert.equal(hasPatientData('qulipta','new'),true);
  assert.equal(hasPatientData('qulipta','continuing'),true);
  assert.deepEqual(missingModelInputs('qulipta','new'),[]);
  assert.deepEqual(missingModelInputs('qulipta','continuing'),[]);
  assert.equal(getSubfillWeights('continuing','qulipta').B.A[1],4699);
  assert.deepEqual(getPersistenceCurve(get('A'),'continuing'),[100,96,93,83,76,70,64,57,51,46,37,22]);
  assert.deepEqual(getPersistenceCurve(get('Q'),'continuing'),[100,60,47,40,35,32,28,26,23,20,16,9]);
  assert.notEqual(getPersistenceCurve(get('A'),'continuing'),getPersistenceCurve(get('A'),'new'));
  assert.deepEqual(brackets.map(b=>getPersistenceCurve(b,'continuing')[1]),[96,92,90,89,90,87,86,86,77,77,79,78,79,66,58,60]);
  assert.deepEqual(brackets.map(b=>getPersistenceCurve(b,'continuing')[11]),[22,21,22,21,20,20,17,16,15,15,13,12,11,11,10,9]);
  for(const bracket of brackets){
    const curve=getPersistenceCurve(bracket,'continuing');
    assert.ok(Object.isFrozen(curve));
    let surviving=1;
    for(let fill=2;fill<=12;fill++){
      assert.ok(curve[fill-1]<=curve[fill-2]);
      surviving*=continuationProbability(bracket,fill,'continuing');
      assert.ok(Math.abs(surviving-curve[fill-1]/100)<1e-12);
    }
  }
});

test('Qulipta Continuing subfill table preserves all source marginals and never uses the New table', () => {
  const continuing=getSubfillWeights('continuing','qulipta');
  const newWeights=getSubfillWeights('new','qulipta');
  assert.notEqual(continuing,newWeights);
  assert.equal(Object.keys(continuing).length,16);
  assert.equal(continuing.B.A[1],4699);
  assert.equal(continuing.B.A[2],8650);
  assert.equal(newWeights.B.A[1],3992);
  assert.ok(Object.isFrozen(continuing));
  for(const bracket of brackets){
    const qc=runDistributionQc(bracket,10000,'continuing');
    assert.equal(qc.increasingPaths,0,bracket.id);
    assert.ok(qc.maxDifferencePp<=0.010000001,bracket.id);
    assert.equal(qc.counts[0][bracket.id],10000);
  }
});


test('same clinical draws follow the separate Qulipta New and Continuing persistence curves', () => {
  const make=type=>generatePatient(1,policy,draws(0.4,0.99,0.85),()=>0.999999,()=>0,type,'qulipta');
  const fresh=make('new');
  const continuing=make('continuing');
  assert.equal(fresh.fillCount,1);
  assert.equal(continuing.fillCount,2);
  assert.equal(continuing.patientType,'continuing');
  assert.equal(continuing.fills[1].persistenceType,'continuing');
  assert.equal(continuing.fills[1].cohortRetentionPercent,96);
  assert.equal(continuing.fills[1].persistenceProbability,0.96);
  assert.equal(continuing.fills[2].persistenceProbability,93/96);
  assert.equal(continuing.programSpendCents,8002);
  const december=generatePatient(1,policy,draws(0.4,0.99),()=>0.999999,()=>0.999999,'continuing','qulipta');
  assert.equal(december.startMonth,12);
  assert.equal(december.fillCount,1);
  assert.ok(december.fills.slice(1).every(f=>!f.attempted&&f.voucherCostCents===0));
});

test('Qulipta Continuing batch reconciles clinical outcomes, calendar QC, benefits and fixed-price financials', async () => {
  let seed=20251030;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const run=await simulatePatientBatch({patientCount:1000,policy,patientType:'continuing',productId:'qulipta',random,yieldControl:async()=>{}});
  assert.equal(run.patientCount,1000);
  assert.equal(run.cohorts.length,16);
  assert.equal(run.startMonthStats.patientType,'continuing');
  assert.equal(run.startMonthStats.outsideYearFills,0);
  assert.equal(run.startMonthStats.fillLimitViolations,0);
  const money=cohortRevenue(run).totals;
  assert.equal(money.patientCount,1000);
  assert.ok(money.fillCount>money.patientsFilling);
  assert.ok(money.programSpendCents<=1000*700000);
  assert.equal(money.revenueCents,money.fillCount*126480);
  assert.equal(money.netRevenueCents,money.revenuePostGtnCents-money.programSpendCents);
  assert.equal(buildPatientQc(run).total.actual.scripts,money.fillCount);
  assert.equal(buildMostPopulatedCohortMatrix(run).reconciles,true);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { products, getProduct } from './products.js';
import { demoData } from './demo-data.js';
import { getBrackets, getDefaultVoucherPolicy } from './cohorts.js';
import { getPersistenceCurve } from './persistence.js';
import { getSubfillWeights } from './subfill-distributions.js';
import { getStartMonthDistribution, selectStartMonth } from './start-month.js';
import { selectBracket, selectOutcome, continuationProbability, bracketForOop, createSubfillSchedule, simulateYear, generatePatient, voucherBenefit, calculateRevenue } from './simulation.js';
import { runDistributionQc } from './qc.js';
import { createCohortRun, addPatientToRun, cohortRevenue, simulatePatientBatch } from './batch.js';
import { buildPatientQc, buildMostPopulatedCohortMatrix } from './patient-qc.js';
import { missingModelInputs } from './model-readiness.js';
const randomSource = seed => () => { seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; };
const draws = (...values) => () => values.length ? values.shift() : .999999;

test('generic catalog retains the program design and independent immutable product inputs', () => {
  assert.deepEqual(Object.keys(products),['product-x','product-y']);
  assert.deepEqual(Object.values(products).map(p=>p.name),['Product X','Product Y']);
  for(const [id,product] of Object.entries(products)) {
    assert.equal(product.expandedBenefitFills,2);
    assert.equal(product.annualBuydownCapCents,700000);
    assert.equal(product.standardBuydownCents,id==='product-x'?58267:50000);
    assert.ok(Number.isSafeInteger(product.wacCents)&&product.wacCents>0);
    assert.ok(Object.isFrozen(product));
    assert.ok(Object.isFrozen(demoData[id].subfills.new));
  }
});

for(const productId of Object.keys(products)) {
  const brackets=getBrackets(productId);
  const policy=getDefaultVoucherPolicy(productId);
  test(`${productId}: illustrative averages stay inside the unchanged cohort boundaries`, () => {
    assert.equal(brackets.length,productId==='product-x'?17:16);
    assert.equal(brackets[0].oopCents,0);
    for(const b of brackets) {
      assert.equal(bracketForOop(b.oopCents,productId).id,b.id);
      assert.ok(Number.isSafeInteger(b.oopCents));
      assert.ok(Number.isInteger(b.gtnRatePercent)&&b.gtnRatePercent>0&&b.gtnRatePercent<100);
    }
    assert.equal(bracketForOop(500,productId).id,'B');
    assert.equal(bracketForOop(501,productId).id,'C');
    assert.equal(bracketForOop(130001,productId).id,productId==='product-x'?'R':'Q');
  });
  test(`${productId}: every probability ticket matches the normalized starting distribution`, () => {
    const total=brackets.reduce((sum,b)=>sum+b.weight,0);
    assert.equal(total,1000);
    const counts=Object.fromEntries(brackets.map(b=>[b.id,0]));
    for(let i=0;i<total;i++)counts[selectBracket((i+.5)/total,productId).id]++;
    for(const b of brackets)assert.equal(counts[b.id],b.weight);
  });
  test(`${productId}: initial abandonment matches each basis-point probability`, () => {
    for(const b of brackets){
      let count=0;
      for(let i=0;i<10000;i++)if(selectOutcome(b,(i+.5)/10000)==='Abandoned')count++;
      assert.equal(count,b.abandonmentBasisPoints);
      assert.ok(b.surpriseDropoffBasisPoints>=0&&b.surpriseDropoffBasisPoints<10000);
    }
    assert.equal(brackets[0].surpriseDropoffBasisPoints,0);
  });
  test(`${productId}: EB, standard support, partial offers and annual balance follow the program rules`, () => {
    assert.equal(voucherBenefit(200000,1,true,productId).buydownCents,200000);
    assert.equal(voucherBenefit(200000,2,true,productId).effectiveOopCents,0);
    assert.equal(voucherBenefit(200000,3,true,productId).buydownCents,getProduct(productId).standardBuydownCents);
    assert.equal(voucherBenefit(200000,3,true,productId,71).buydownCents,71);
    assert.equal(voucherBenefit(200000,3,false,productId).buydownCents,0);
    assert.equal(voucherBenefit(800000,1,true,productId).buydownCents,700000);
    assert.throws(()=>voucherBenefit(100,1,true,productId,-1),RangeError);
  });
  test(`${productId}: assisted first-fill decisions and recurring surprise incur spend only when filled`, () => {
    const b=brackets.at(-1);
    const schedule=createSubfillSchedule(b,()=>.999999,'continuing');
    const constant=schedule.map(fill=>({...fill,initialOopCents:b.oopCents,preVoucherBracket:b}));
    const fills=simulateYear(b,policy,draws(.999,0,0,0),constant,1,'continuing',productId);
    assert.equal(fills[0].behaviorBracket.id,'A');
    assert.equal(fills[0].filled,true);
    assert.equal(fills[1].filled,true);
    assert.equal(fills[2].status,'Copay surprise');
    assert.equal(fills[2].voucherCostCents,0);
    assert.ok(fills.slice(3).every(f=>!f.attempted&&f.voucherCostCents===0));
    const noAssistance=simulateYear(b,{eligibleCohortIds:[]},()=>0,constant,1,'continuing',productId);
    assert.equal(noAssistance[0].status,'Abandoned');
    assert.ok(noAssistance.every(f=>f.voucherCostCents===0));
  });
  test(`${productId}: completed partial voucher exhausts the annual cap; later fills incur no voucher fee`, () => {
    const b=brackets.at(-1);
    const schedule=createSubfillSchedule(b,()=>.999999,'continuing').map(f=>({...f,initialOopCents:b.oopCents}));
    const values=[.999,0];for(let i=3;i<=12;i++)values.push(0,.999);
    const fills=simulateYear(b,policy,draws(...values),schedule,1,'continuing',productId);
    assert.equal(fills.filter(f=>f.filled).length,12);
    assert.equal(fills.reduce((sum,f)=>sum+f.voucherCostCents,0),700000);
    assert.ok(fills.some(f=>f.filled&&f.buydownCents>0&&f.buydownCents<f.scheduledBuydownCents));
    assert.equal(fills.at(-1).annualSupportAfterCents,0);
    assert.ok(fills.filter(f=>f.annualSupportBeforeCents===0).every(f=>!f.voucherOffered));
    const voucherCount=fills.filter(f=>f.filled&&f.voucherOffered).length;
    const money=calculateRevenue({productId,bracket:b,fillCount:12,programSpendCents:700000,voucherFillCount:voucherCount});
    assert.equal(money.tfCents,voucherCount*650);
  });
  for(const type of ['new','continuing']) {
    test(`${productId} ${type}: readiness, distinct distributions and cumulative persistence are valid`, () => {
      assert.deepEqual(missingModelInputs(productId,type),[]);
      assert.notEqual(getSubfillWeights('new',productId),getSubfillWeights('continuing',productId));
      for(const b of brackets) {
        const curve=getPersistenceCurve(b,type);
        assert.equal(curve.length,12);assert.equal(curve[0],100);
        let surviving=1;
        for(let fill=2;fill<=12;fill++) {
          assert.ok(curve[fill-1]>=0&&curve[fill-1]<=curve[fill-2]);
          surviving*=continuationProbability(b,fill,type);
          assert.ok(Math.abs(surviving-curve[fill-1]/100)<1e-12);
        }
      }
    });
    test(`${productId} ${type}: exhaustive cost-path QC preserves monthly marginals without increases`, () => {
      for(const b of brackets) {
        const weights=getSubfillWeights(type,productId)[b.id];
        for(let m=0;m<12;m++)assert.equal(Object.values(weights).reduce((sum,values)=>sum+values[m],0),10000);
        const result=runDistributionQc(b,10000,type);
        assert.equal(result.increasingPaths,0);
        assert.ok(result.maxDifferencePp<=.010000001);
        assert.equal(result.counts[0][b.id],10000);
      }
    });
    test(`${productId} ${type}: monthly starting weights normalize and select the right calendar opportunities`, () => {
      const distribution=getStartMonthDistribution(type,productId);
      assert.equal(distribution.length,12);
      assert.ok(Math.abs(distribution.reduce((sum,m)=>sum+m.probability,0)-1)<1e-12);
      const counts=Array(12).fill(0);
      for(let i=0;i<10000;i++)counts[selectStartMonth((i+.5)/10000,type,productId).month-1]++;
      assert.deepEqual(counts,demoData[productId].months[type]);
      const patient=generatePatient(1,policy,draws(.4,.999),()=>.999999,()=>.999999,type,productId);
      assert.equal(patient.startMonth,12);assert.equal(patient.fillCount,1);
      assert.ok(patient.fills.slice(1).every(f=>f.status==='Outside year'&&!f.attempted&&f.voucherCostCents===0));
    });
    test(`${productId} ${type}: seeded batch ledgers, revenue, fees, QC and calendar matrix reconcile`, async () => {
      const random=randomSource(7314);
      const run=createCohortRun(policy,type,productId);
      let scripts=0,spend=0,vouchers=0;
      for(let i=0;i<600;i++) {
        const patient=generatePatient(i+1,policy,random,random,random,type,productId);
        assert.equal(patient.productId,productId);
        assert.ok(patient.fillCount<=patient.maxFillsInYear);
        let balance=700000;
        for(const fill of patient.fills) {
          assert.equal(fill.annualSupportBeforeCents,balance);
          balance-=fill.voucherCostCents;
          assert.equal(fill.annualSupportAfterCents,balance);
          assert.ok(balance>=0);
          if(fill.filled)assert.ok(fill.inYear&&fill.attempted);
        }
        assert.equal(patient.programSpendCents,700000-balance);
        assert.ok(Object.isFrozen(patient.voucherPolicy.eligibleCohortIds));
        scripts+=patient.fillCount;spend+=patient.programSpendCents;vouchers+=patient.voucherFillCount;
        addPatientToRun(run,patient);
      }
      const totals=cohortRevenue(run).totals;
      assert.equal(totals.patientCount,600);assert.equal(totals.fillCount,scripts);
      assert.equal(totals.revenueCents,scripts*getProduct(productId).wacCents);
      assert.equal(totals.programSpendCents,spend);assert.equal(totals.tfCents,vouchers*650);
      assert.equal(totals.cogsCents,scripts*Math.floor((getProduct(productId).wacCents+50)/100));
      assert.equal(totals.netRevenueCents,totals.revenuePostGtnCents-spend);
      assert.equal(totals.netRevenueLessCogsTfCents,totals.netRevenueCents-totals.cogsCents-totals.tfCents);
      assert.equal(buildPatientQc(run).total.actual.scripts,scripts);
      assert.equal(buildMostPopulatedCohortMatrix(run).reconciles,true);
      assert.equal(run.startMonthStats.outsideYearFills,0);assert.equal(run.startMonthStats.fillLimitViolations,0);
      if(productId==='product-y')assert.equal(buildPatientQc(run).total.benchmark,null);
    });
  }
}

test('invalid inputs and cross-product aggregation fail explicitly', async () => {
  for(const invalid of [-1,1,NaN,Infinity])assert.throws(()=>selectBracket(invalid),RangeError);
  assert.throws(()=>bracketForOop(-1),RangeError);
  const run=createCohortRun(getDefaultVoucherPolicy('product-x'));
  const patient=generatePatient(1,getDefaultVoucherPolicy('product-y'),()=>.5,()=>.5,()=>0,'new','product-y');
  assert.throws(()=>addPatientToRun(run,patient),/product/);
  await assert.rejects(simulatePatientBatch({patientCount:0,policy:getDefaultVoucherPolicy()}),RangeError);
});

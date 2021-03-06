// ignore the lint error of not having a function call.
// Mocha actually uses property getters as function calls (like .empty) and lint see those as errors by default
/*jshint -W030 */
var expect = require('chai').expect;
var RDBHistogram = require('../src/rdb-histogram');
var MockDate = require('mockdate');
var util = require('util');

describe("rolling histogram", function () {

  after(function () { MockDate.reset(); });


  it("should work as a regular histogram in a short timeframe", function() {
    var histogram = new RDBHistogram();
    for (var i=1; i < 101; i++)
      histogram.update(i);
    var stats = histogram.toJSON();
    expect(stats.count).to.be.equal(100);
    expect(stats.min).to.be.equal(1);
    expect(stats.max).to.be.equal(100);
    expect(stats.median).to.be.within(49, 51);
    expect(stats.p75).to.be.within(74, 76);
    expect(stats.p95).to.be.within(94, 96);
    expect(stats.p99).to.be.within(98, 100);
    expect(stats.p999).to.be.within(99, 100);
  });

  it("should retain all measurements within 1 minute", function() {
    MockDate.set("1/1/2000 00:00:00");
    var histogram = new RDBHistogram();
    for (var i=1; i < 101; i++)
      histogram.update(i);

    MockDate.set("1/1/2000 00:01:00");

    var stats = histogram.toJSON();
    expect(stats.count).to.be.equal(100);
    expect(stats.min).to.be.equal(1);
    expect(stats.max).to.be.equal(100);
    expect(stats.median).to.be.within(49, 51);
    expect(stats.p75).to.be.within(74, 76);
    expect(stats.p95).to.be.within(94, 96);
    expect(stats.p99).to.be.within(98, 100);
    expect(stats.p999).to.be.within(99, 100);
  });

  it("should consider all data points in 1 minute history as the same given uniform behavior, with default config (minValue = 1)", function() {
    MockDate.set("1/1/2000 00:00:00");
    var histogram = new RDBHistogram();
    for (var i=1; i < 100; i++) {
      if (i < 25)
        MockDate.set("1/1/2000 00:00:05");
      else if (i < 50)
        MockDate.set("1/1/2000 00:00:20");
      else if (i < 75)
        MockDate.set("1/1/2000 00:00:35");
      else
        MockDate.set("1/1/2000 00:00:50");
      // the *13 % 100 is required to make sure the distribution is uniform and consistent across the 1 minute
      histogram.update((i*13)%100);
    }

    MockDate.set("1/1/2000 00:01:00");

    var stats = histogram.toJSON();

    expect(stats.count).to.be.equal(99);
    expect(stats.numBuckets).to.be.equal(60);
    expect(stats.min).to.be.equal(1);
    expect(stats.max).to.be.equal(99);
    expect(stats.median).to.be.within(49, 51);
    expect(stats.p75).to.be.within(73, 77);
    expect(stats.p95).to.be.within(93, 97);
    expect(stats.p99).to.be.within(97, 99);
    expect(stats.p999).to.be.within(97, 99);
  });

  it("should consider all data points in 1 minute history as the same given uniform behavior - with config minValue = 1", function() {
    MockDate.set("1/1/2000 00:00:00");
    var histogram = new RDBHistogram({minValue: 1});
    for (var i=1; i < 100; i++) {
      if (i < 25)
        MockDate.set("1/1/2000 00:00:05");
      else if (i < 50)
        MockDate.set("1/1/2000 00:00:20");
      else if (i < 75)
        MockDate.set("1/1/2000 00:00:35");
      else
        MockDate.set("1/1/2000 00:00:50");
      // the *13 % 100 is required to make sure the distribution is uniform and consistent across the 1 minute
      histogram.update((i*13)%100);
    }

    MockDate.set("1/1/2000 00:01:00");

    var stats = histogram.toJSON();

    expect(stats.count).to.be.equal(99);
    expect(stats.numBuckets).to.be.equal(60);
    expect(stats.min).to.be.equal(1);
    expect(stats.max).to.be.equal(99);
    expect(stats.median).to.be.within(49, 51);
    expect(stats.p75).to.be.within(73, 77);
    expect(stats.p95).to.be.within(93, 97);
    expect(stats.p99).to.be.within(97, 99);
    expect(stats.p999).to.be.within(97, 99);
  });

  it("should focus on the percentiles after 15 seconds, with config minValue = 1", function() {
    MockDate.set("1/1/2000 00:00:00");
    var histogram = new RDBHistogram({minValue: 1});
    for (var i=1; i < 100; i++) {
      histogram.update((i*13)%100);
    }
    MockDate.set("1/1/2000 00:00:20");
    histogram.update(50);

    var focusBuckets = histogram.current.focusBuckets;
    expect(histogram.current.bucketBounds(focusBuckets[0])).to.be.deep.equal([39, 63]);
    expect(histogram.current.bucketBounds(focusBuckets[1])).to.be.deep.equal([63, 100]);
  });

  it("should focus on the percentiles after 15 seconds, with default config (minValue = 0.01)", function() {
    MockDate.set("1/1/2000 00:00:00");
    var histogram = new RDBHistogram();
    for (var i=1; i < 100; i++) {
      histogram.update((i*13)%100);
    }
    MockDate.set("1/1/2000 00:00:20");
    histogram.update(50);

    var focusBuckets = histogram.current.focusBuckets;
    expect(histogram.current.bucketBounds(focusBuckets[0])).to.be.deep.equal([3981, 6309]);
    expect(histogram.current.bucketBounds(focusBuckets[1])).to.be.deep.equal([6309, 10000]);
  });

  it("should clear all measurements within 1 minute and 15 seconds", function() {
    MockDate.set("1/1/2000 00:00:00");
    var histogram = new RDBHistogram();
    for (var i=1; i < 101; i++)
      histogram.update(i);

    MockDate.set("1/1/2000 00:01:16");

    var stats = histogram.toJSON();
    expect(stats.count).to.be.equal(0);
    expect(stats.min).to.be.undefined;
    expect(stats.max).to.be.undefined;
    expect(stats.median).to.be.undefined;
    expect(stats.p75).to.be.undefined;
    expect(stats.p95).to.be.undefined;
    expect(stats.p99).to.be.undefined;
    expect(stats.p999).to.be.undefined;
  });

  it("should work if all values are below the minValue - all should be within bucket 0", function() {
    MockDate.set("1/1/2000 00:00:00");
    var histogram = new RDBHistogram({minValue: 1});
    for (var i=1; i < 50; i++) {
      histogram.update(((i*13)%100)/100);
    }
    MockDate.set("1/1/2000 00:00:20");
    for (i=50; i < 100; i++) {
      histogram.update(((i*13)%100)/100);
    }

    var focusBuckets = histogram.current.focusBuckets;
    expect(focusBuckets.length).to.be.equal(1);
    expect(histogram.current.bucketBounds(focusBuckets[0])).to.be.deep.equal([0, 1]);
  });

});


function normalRand() {
  // making a gaussian distribution from the linear distribution
  return (Math.random() + Math.random() + Math.random() + Math.random() + Math.random() +
    Math.random() + Math.random() + Math.random() + Math.random() + Math.random()) / 10;
}

function model1() {
  // a model with gaussian distribution
  return normalRand()*1000 + 10;
}

function model2() {
  // a model with linear distribution
  return Math.random() * 1000 + 10;
}

function model3() {
  // a model with the percentiles at different ranges
  // medain and p75 -> [40,50]
  // p95 -> [60, 70]
  // p99 -> [70, 80]
  // p999 -> [80, 90]
  var group = Math.random()*200;
  if (group < 92*2)
    return 40 + normalRand()*10;
  else if (group < (92+6)*2)
    return 60 + normalRand()*10;
  else if (group < (92+6+1.5)*2)
    return 70 + normalRand()*10;
  else
    return 80 + normalRand()*10;
}

function model4() {
  // a model with a spiky model
  // 20% for small spike
  // 3 % for large spike
  var value = normalRand()*1000 + 10;
  if (Math.random() > 0.8)
    value += normalRand()*10000;
  if (Math.random() > 0.97)
    value += normalRand()*100000;
  return value;
}

function model5() {
  return normalRand()/10;
}


describe("rolling histogram end 2 end", function () {

  function end2end(model, properties, accuracyPercent, accuracyFixed) {
    accuracyPercent = accuracyPercent || 0.05; // default accuracy
    accuracyFixed = accuracyFixed || 0;
    MockDate.set("1/1/2000 00:00:00");
    var values = [];
    function store(value) {
      values.push(value);
      return value;
    }
    var i;
    var histogram = new RDBHistogram(properties);
    for (i=0; i < 10000; i++)
      histogram.update(model());

    MockDate.set("1/1/2000 00:00:16");
    for (i=0; i < 10000; i++)
      histogram.update(store(model()));

    MockDate.set("1/1/2000 00:00:31");
    for (i=0; i < 10000; i++)
      histogram.update(store(model()));

    MockDate.set("1/1/2000 00:00:46");
    for (i=0; i < 10000; i++)
      histogram.update(store(model()));

    MockDate.set("1/1/2000 00:01:01");
    for (i=0; i < 10000; i++)
      histogram.update(store(model()));

    MockDate.set("1/1/2000 00:01:16");

    values.sort(function(a,b) {return a-b;});


    var max = values.reduce(function(agg, val) {return Math.max(agg, val);}, 0);
    var min = values.reduce(function(agg, val) {return Math.min(agg, val);}, 100000000);
    var median = values[Math.round(values.length/2)];
    var p75 = values[Math.round(values.length * 0.75)];
    var p95 = values[Math.round(values.length * 0.95)];
    var p99 = values[Math.round(values.length * 0.99)];
    var p999 = values[Math.round(values.length * 0.999)];

    var stats = histogram.toJSON();
    expect(stats.count).to.be.equal(values.length);
    expect(stats.min).to.be.equal(min);
    expect(stats.max).to.be.equal(max);
    var lowAcc = 1-accuracyPercent;
    var highAcc = 1+accuracyPercent;
    var accFixed = accuracyFixed;
    expect(stats.median).to.be.within(median * lowAcc - accFixed, median * highAcc + accFixed);
    expect(stats.p75).to.be.within(   p75    * lowAcc - accFixed, p75    * highAcc + accFixed);
    expect(stats.p95).to.be.within(   p95    * lowAcc - accFixed, p95    * highAcc + accFixed);
    expect(stats.p99).to.be.within(   p99    * lowAcc - accFixed, p99    * highAcc + accFixed);
    expect(stats.p999).to.be.within(  p999   * lowAcc - accFixed, p999   * highAcc + accFixed);
  }

  // 10% accuracy comes from default config of the histogram of 5 buckets and 5 sub-buckets
  // meaning accuracy of 10^(1/25) ~ 1.1 ~ 10%
  it("compute percentiles within 10% accuracy (+-5%) for gaussian model after 1:15 minute", function() {
    end2end(model1);
  });

  it("compute percentiles within 10% accuracy (+-5%) for linear model after 1:15 minute", function() {
    end2end(model2);
  });

  it("compute percentiles within 10% accuracy (+-5%) for model 3 after 1:15 minute", function() {
    end2end(model3);
  });

  it("compute percentiles within 10% accuracy (+-5%) for model 4 after 1:15 minute", function() {
    end2end(model4);
  });

  // 2.5% accuracy comes from config of the histogram of 10 buckets and 10 sub-buckets
  // meaning accuracy of 10^(1/100) ~ 1.023 ~ 2.5%
  it("compute percentiles within 2.5% accuracy (+-1.25%) for model 1 after 1:15 minute", function() {
    end2end(model1, {
      mainScale: 10,
      subScale: 10},
    0.0125);
  });

  it("compute percentiles within 0.2 accuracy (deviding the range 0..minValue=1 to 5 buckets of 0.2) for a gaussian model where all values are below the configured minValue after 1:15 minute", function() {
    end2end(model5, {minValue: 1}, 0, 0.2);
  });
});







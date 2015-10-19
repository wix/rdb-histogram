// ignore the lint error of not having a function call.
// Mocha actually uses property getters as function calls (like .empty) and lint see those as errors by default
/*jshint -W030 */
var expect = require('chai').expect;
var RollingHistogram = require('../src/rolling-histogram');
var MockDate = require('mockdate');
var util = require('util');

describe("rolling histogram", function () {

  after(function () { MockDate.reset(); });


  it("should work as a regular histogram in a short timeframe", function() {
    var histogram = new RollingHistogram();
    for (var i=0; i < 101; i++)
      histogram.update(i);
    var stats = histogram.toJSON();
    expect(stats.count).to.be.equal(101);
    expect(stats.min).to.be.equal(0);
    expect(stats.max).to.be.equal(100);
    expect(stats.median).to.be.within(49, 51);
    expect(stats.p75).to.be.within(74, 76);
    expect(stats.p95).to.be.within(94, 96);
    expect(stats.p99).to.be.within(98, 100);
    expect(stats.p999).to.be.within(99, 100);
  });

  it("should retain all measurements within 1 minute", function() {
    MockDate.set("1/1/2000 00:00:00");
    var histogram = new RollingHistogram();
    for (var i=0; i < 101; i++)
      histogram.update(i);

    MockDate.set("1/1/2000 00:01:00");

    var stats = histogram.toJSON();
    expect(stats.count).to.be.equal(101);
    expect(stats.min).to.be.equal(0);
    expect(stats.max).to.be.equal(100);
    expect(stats.median).to.be.within(49, 51);
    expect(stats.p75).to.be.within(74, 76);
    expect(stats.p95).to.be.within(94, 96);
    expect(stats.p99).to.be.within(98, 100);
    expect(stats.p999).to.be.within(99, 100);
  });

  it("should consider all data points in 1 minute history as the same given no change in behavior", function() {
    MockDate.set("1/1/2000 00:00:00");
    var histogram = new RollingHistogram();
    for (var i=0; i < 100; i++) {
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
    expect(stats.count).to.be.equal(100);
    expect(stats.min).to.be.equal(0);
    expect(stats.max).to.be.equal(99);
    expect(stats.median).to.be.within(49, 51);
    expect(stats.p75).to.be.within(73, 77);
    expect(stats.p95).to.be.within(93, 97);
    expect(stats.p99).to.be.within(97, 99);
    expect(stats.p999).to.be.within(97, 99);
  });

  it("should focus on the percentiles after 15 seconds", function() {
    MockDate.set("1/1/2000 00:00:00");
    var histogram = new RollingHistogram();
    for (var i=0; i < 100; i++) {
      histogram.update((i*13)%100);
    }
    MockDate.set("1/1/2000 00:00:20");
    histogram.update(50);

    var focusBuckets = histogram.current.focusBuckets;
    expect(histogram.current.bucketBounds(focusBuckets[0])).to.be.deep.equal([39, 63]);
    expect(histogram.current.bucketBounds(focusBuckets[1])).to.be.deep.equal([63, 100]);
  });

  it("should clear all measurements within 1 minute and 15 seconds", function() {
    MockDate.set("1/1/2000 00:00:00");
    var histogram = new RollingHistogram();
    for (var i=0; i < 101; i++)
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

});







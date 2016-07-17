"use strict";

const assert = require('chai').assert;
const AMF = require('../src/amf.js');

describe('Array', () => {
  describe("amf.js", () => {
    it('can parse integer 6', () => {
      let buf = AMF.makeArrayBuffer('04 06');
      assert.equal(AMF.deserialize(buf), 6);
    });

    it('can parse string "hi"', () => {
      let buf = AMF.makeArrayBuffer('06 05 68 69');
      assert.equal(AMF.deserialize(buf), "hi");
    });

    it('can parse utf-8 string "⑥⑥⑥"', () => {
      let buf = AMF.makeArrayBuffer('06 13 e2 91 a5 e2 91 a5 e2 91 a5');
      assert.equal(AMF.deserialize(buf), "⑥⑥⑥");
    });

    it('can parse dynamic object { him: 3 }', () => {
      let buf = AMF.makeArrayBuffer('0a 0b 01 07 68 69 6d 04 03 01');
      console.log(
      'buf', buf);
      assert.deepEqual(AMF.deserialize(buf), { him: 3 });
    });

    it('can parse reference strings { hi: "hi" }', () => {
      let buf = AMF.makeArrayBuffer('0a 0b 01 05 68 69 06 00 01');
      assert.deepEqual(AMF.deserialize(buf), { hi: "hi" });
    });

    it('can parse undefined', () => {
      let buf = AMF.makeArrayBuffer('00');
      assert.equal(AMF.deserialize(buf), undefined);
    });

    it('can parse null', () => {
      let buf = AMF.makeArrayBuffer('01');
      assert.equal(AMF.deserialize(buf), null);
    });

    it('can parse false', () => {
      let buf = AMF.makeArrayBuffer('02');
      assert.equal(AMF.deserialize(buf), false);
    });

    it('can parse true', () => {
      let buf = AMF.makeArrayBuffer('03');
      assert.equal(AMF.deserialize(AMF.makeArrayBuffer('03')), true);
    });

    it('can parse double 15.24', () => {
      let buf = AMF.makeArrayBuffer('05 40 2e 7a e1 47 ae 14 7b');
      assert.equal(AMF.deserialize(buf), 15.24);
    });
  });
});

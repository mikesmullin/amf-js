"use strict";

const assert = require('chai').assert;
const AMF = require('../src/amf.js');

describe('Array', () => {
  describe("amf.js", () => {
    it('can parse integer 6', () => {
      let buf = AMF.makeArrayBuffer('04 06');
      assert.equal(AMF.deserialize(buf), 6);
    });

    it('can parse variable-length unsigned integer 2^28 - 1', () => {
      let buf = AMF.makeArrayBuffer('04 bf ff ff ff');
      assert.equal(AMF.deserialize(buf), Math.pow(2,28)-1);
    });

    it('can parse variable-length unsigned integer 2^29 - 1', () => {
      let buf = AMF.makeArrayBuffer('04 ff ff ff ff');
      assert.equal(AMF.deserialize(buf), Math.pow(2,29)-1);
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

    it('can parse date', () => {
      let buf = AMF.makeArrayBuffer('08 01 42 75 5f a3 77 83 20 00');
      let d = AMF.deserialize(buf);
      assert.equal(typeof d, 'object');
      assert.equal(d.constructor.name, 'Date');
      assert.equal(d.getTime(), 1468781787186);
    });

    it('can parse array', () => {
      let buf = AMF.makeArrayBuffer('09 09 01 04 01 04 02 04 03 04 04');
      assert.deepEqual(AMF.deserialize(buf), [1,2,3,4]);
    });

    it('can parse self-referencing object', () => {
      let buf = AMF.makeArrayBuffer(
        '0a 0b 01 09 6e 75 6d 31 04 01 09 6f 62 6a 32 0a 01 09 6e 75 6d 32 04 02010973656c660a0001');
      var o = {
        num1: 1,
        obj2: {
          num2: 2
        }
      }
      o.self = o;
      assert.deepEqual(AMF.deserialize(buf), o);
    });

    it('can parse ByteArray', () => {
      let buf = AMF.makeArrayBuffer('0c 07 01 02 03');
      assert.deepEqual(AMF.deserialize(buf), new Uint8Array(AMF.makeArrayBuffer('01 02 03')));
    });
  });
});

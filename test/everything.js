"use strict";

const assert = require('chai').assert;
const AMF = require('../src/amf.js');

describe('Array', () => {
  describe("amf.js", () => {
    it('can parse integer 6', () => {
      let buf = AMF.makeArrayBuffer([0x04, 0x06]);
      let d = new AMF.Deserializer(buf);
      assert.equal(d.deserialize(), 6);
    });

    it('can parse string "hi"', () => {
      let buf = AMF.makeArrayBuffer([0x06, 0x05, 0x68, 0x69]);
      let d = new AMF.Deserializer(buf);
      assert.equal(d.deserialize(), "hi");
    });

    it('can parse utf-8 string "⑥⑥⑥"', () => {
      let buf = AMF.makeArrayBuffer([0x06, 0x13, 0xe2, 0x91, 0xa5, 0xe2, 0x91, 0xa5, 0xe2, 0x91, 0xa5]);
      let d = new AMF.Deserializer(buf);
      assert.equal(d.deserialize(), "⑥⑥⑥");
    });

    it('can parse dynamic object { him: 3 }', () => {
      let buf = AMF.makeArrayBuffer([0x0a, 0x0b, 0x01, 0x07, 0x68, 0x69, 0x6d, 0x04, 0x03, 0x01]);
      let d = new AMF.Deserializer(buf);
      assert.deepEqual(d.deserialize(), { him: 3 });
    });

    it('can parse reference strings { hi: "hi" }', () => {
      let buf = AMF.makeArrayBuffer([0x0a, 0x0b, 0x01, 0x05, 0x68, 0x69, 0x06, 0x00, 0x01]);
      let d = new AMF.Deserializer(buf);
      assert.deepEqual(d.deserialize(), { hi: "hi" });
    });

    it('can parse undefined', () => {
      let buf = AMF.makeArrayBuffer([0x00]);
      let d = new AMF.Deserializer(buf);
      assert.equal(d.deserialize(), undefined);
    });

    it('can parse null', () => {
      let buf = AMF.makeArrayBuffer([0x01]);
      let d = new AMF.Deserializer(buf);
      assert.equal(d.deserialize(), null);
    });

    it('can parse false', () => {
      let buf = AMF.makeArrayBuffer([0x02]);
      let d = new AMF.Deserializer(buf);
      assert.equal(d.deserialize(), false);
    });

    it('can parse true', () => {
      let buf = AMF.makeArrayBuffer([0x03]);
      let d = new AMF.Deserializer(buf);
      assert.equal(d.deserialize(), true);
    });

    it('can parse double 15.24', () => {
      let buf = AMF.makeArrayBuffer([0x05, 0x40, 0x2e, 0x7a, 0xe1, 0x47, 0xae, 0x14, 0x7b]);
      let d = new AMF.Deserializer(buf);
      assert.equal(d.deserialize(), 15.24);
    });
  });
});

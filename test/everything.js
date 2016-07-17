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
  });
});

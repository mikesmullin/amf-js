"use strict";

const assert = require('chai').assert;
const AMF = require('../src/amf.js');

describe('Array', () => {
  describe('#indexOf()', () => {
    it('should return -1 when the value is not present', () => {
      assert.equal(-1, [1,2,3].indexOf(5));
      assert.equal(-1, [1,2,3].indexOf(0));
    });
  });

  describe("amf.js", () => {
    it("has a class", () => {
      AMF.hi();
    });
  });
});

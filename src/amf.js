var AMF = (function(){var AMF = {
  // Values according to the DataView.set*() API.

  LITTLE_ENDIAN: true,
  BIG_ENDIAN: false,


  // Type Markers

  // These markers also represent a value.

  AMF3_UNDEFINED: 0x00,
  AMF3_NULL: 0x01,
  AMF3_FALSE: 0x02,
  AMF3_TRUE: 0x03,

  // These markers represent a following value.

  AMF3_INT: 0x04,
  AMF3_DOUBLE: 0x05,
  AMF3_STRING: 0x06,
  AMF3_XML_DOC: 0x07,
  AMF3_DATE: 0x08,
  AMF3_ARRAY: 0x09,
  AMF3_OBJECT: 0x0A,
  AMF3_XML: 0x0B,
  AMF3_BYTE_ARRAY: 0x0C,
  AMF3_VECTOR_INT: 0x0D,
  AMF3_VECTOR_UINT: 0x0E,
  AMF3_VECTOR_DOUBLE: 0x0F,
  AMF3_VECTOR_OBJECT: 0x10,
  AMF3_DICTIONARY: 0x11,


  // Miscellaneous

  OBJECT_DYNAMIC: 0x00,

  REFERENCE_BIT: 0x01,

  MIN_2_BYTE_INT: 0x80,
  MIN_3_BYTE_INT: 0x4000,
  MIN_4_BYTE_INT: 0x200000,

  MAX_INT: 0xFFFFFFF,      // (2 ^ 28) - 1
  MIN_INT: -0x10000000,     // (-2 ^ 28)


  // Debugging

  // @param a:ArrayBuffer - bytes
  //   ex: [0x06, 0x05, 0x68, 0x69] // "hi"
  makeArrayBuffer: function(a) {
    var a2 = new Uint8Array(a.length);
    for (var i=0; i<a.length; i++) {
      a2[i] = a[i];
    }
    return a2.buffer;
  },

  hexDump: function(v, log) {
    var r = '';
    var byte = function(v, i) {
      return ('00' + new DataView(v).getUint8(i).toString(16)).substr(-2) + ' ';
    };
    switch (typeof v) {
      case 'string':
      case 'number':
        var hex = v.toString(16);
        hex = ((1 === hex.length % 2) ? '0' : '') + hex;
        r += hex.replace(/[0-9a-f]{2}/ig, '$& ');
        break;
      case 'undefined':
        r += 'undefined';
        break;
      case 'object':
        if (null === v) {
          r += '<null>';
          break;
        }
        switch (v.constructor.name) {
          case 'ArrayBuffer':
            for (var i=0; i<v.byteLength; i++) {
              r += byte(v, i);
            }
            break;
          default:
            r += '<unsupported type: object:'+ v.constructor.name +'>';
            break;
        }
        break;
      default:
        r += '<unsupported type: '+ typeof v +'>';
        break;
    }
    if (log) console.log('hexDump: '+ r);
    return r;
  },


  // Deserialization

  Deserializer: function(arrayBuffer) {
    var buf = arrayBuffer;
    var pos = 0;

    var readByte = function() {
      return new DataView(buf)
        .getUint8(pos++, 1);
    };

    var assert = function(expected, actual) {
      if (expected !== actual)
        throw new Error("expected "+ AMF.hexDump(expected) +", "+
          "but got "+ AMF.hexDump(actual) +
          " at position "+ (pos - 1) +".");
    };

    this.deserialize = function() {
      switch (readByte()) {
        case AMF.AMF3_INT:
          return readInt();
          break;

        case AMF.AMF3_STRING:
          return readString();
          break;

        default:
          throw new Error("Unrecognized type marker "+ AMF.hexDump(b) +". Cannot proceed with deserialization.");
          break;
      }
    };


    var readInt = function() {
      var result = 0;

      var n = 0;
      var b = readByte();
      while ((b & 0x80) !== 0 && n < 3) {
        result <<= 7;
        result |= (b & 0x7F);
        b = readByte();
        n++;
      }
      if (n < 3) {
        result <<= 7;
        result |= b;
      } else {
        result <<= 8;
        result |= b;
        if ((result & 0x10000000) !== 0) {
          result |= 0xE0000000;
        }
      }

      return result;
    };

    var readString = function() {
      var reference = readInt();

      if ((reference & AMF.REFERENCE_BIT) === 0) {
        reference >>= AMF.REFERENCE_BIT;

        return this.referenceStore.getByReference(reference, ReferenceStore.TYPE_STRING);
      }

      var length = reference >> AMF.REFERENCE_BIT;
      var string = utf8.decode(this.stream.readRawBytes(length));
      this.referenceStore.addReference(string, ReferenceStore.TYPE_STRING);

      return string;
    };
  }
};

return AMF; })();

module.exports = AMF;

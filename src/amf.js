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
    var byte = function(v) {
      return ('00' + v.toString(16)).substr(-2) + ' ';
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
          case 'Uint8Array':
            for (var i=0; i<v.length; i++) {
              r += byte(v[i]);
            }
            break;
          case 'ArrayBuffer':
            for (var i=0; i<v.byteLength; i++) {
              r += byte(new DataView(v).getUint8(i));
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
    var _this = this;

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
      var b = readByte();
      switch (b) {
        case AMF.AMF3_UNDEFINED:
          return undefined;
        case AMF.AMF3_NULL:
          return null;
        case AMF.AMF3_FALSE:
          return false;
        case AMF.AMF3_TRUE:
          return true;
        case AMF.AMF3_INT:
          return readInt();
        case AMF.AMF3_DOUBLE:
          return readDouble();
        case AMF.AMF3_STRING:
          return readString();
        case AMF.AMF3_OBJECT:
          return readObject();
        default:
          throw new Error("Unrecognized type marker "+ AMF.hexDump(b) +". Cannot proceed with deserialization.");
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

    var readDouble = function() {
      var f = new DataView(buf)
        .getFloat64(pos, AMF.BIG_ENDIAN);
      pos += 8;
      return f;
    };

    var stringReferences = [];
    var readString = function() {
      var reference = readInt();
      if (0 === (reference & AMF.REFERENCE_BIT)) {
        reference >>= AMF.REFERENCE_BIT;
        s = stringReferences[reference];
        return s;
      }
      var length = reference >> AMF.REFERENCE_BIT;
      var data = new Uint8Array(buf, pos, length);
      var string = decodeURIComponent(
        AMF.hexDump(data).replace(/\s+/g, '')
          .replace(/[0-9a-f]{2}/g, '%$&'));
      if (length > 0) {
        stringReferences.push(string);
      }
      pos += length;
      return string;
    };

    var objectReferences = [];
    var clsAliases = {};
    var merge = function(instance, data) {
      try {
        for (var key in data) {
          var val = data[key];
          instance[key] = val;
        }
      } catch(e) {
        // some properties may not be public
        throw new Error("Property '" + key + "' cannot be set on instance '" + (typeof instance) + "'");
      }
    };
    var readObject = function() {
      var reference = readInt();
      if (0 === (reference & AMF.REFERENCE_BIT)) {
        reference >>= AMF.REFERENCE_BIT;
        return objectReferences[reference];
      }

      var clsAlias = readString();

      // add a new reference at this stage - essential to handle self-referencing objects
      var instance = {};
      objectReferences.push(instance);

      // collect all properties into hash
      var data = {};
      var property = readString();
      while (property.length) {
        data[property] = _this.deserialize();
        property = readString();
      }

      // when clsAlias is given, initialization of an existing type is implied
      if (clsAlias && clsAlias.length > 0) {
        var classType = clsAliases[clsAlias];
        if (!classType) {
          throw new Error('Class ' + clsAlias + ' cannot be found. Consider registering a class alias.');
        }
        instance = new classType;
        if ('importData' in instance &&
          'function' == typeof instance.importData)
        {
          instance.importData(data);
        } else {
          merge(instance, data);
        }
      } else {
        merge(instance, data);
      }

      return instance;
    };
  }
};

return AMF; })();

module.exports = AMF;

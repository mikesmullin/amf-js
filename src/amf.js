(function() {
  // Type Markers

  // These markers also represent a value.

  var AMF3_UNDEFINED = 0x00;
  var AMF3_NULL = 0x01;
  var AMF3_FALSE = 0x02;
  var AMF3_TRUE = 0x03;

  // These markers represent a following value.

  var AMF3_INT = 0x04;
  var AMF3_DOUBLE = 0x05;
  var AMF3_STRING = 0x06;
  var AMF3_XML_DOC = 0x07;
  var AMF3_DATE = 0x08;
  var AMF3_ARRAY = 0x09;
  var AMF3_OBJECT = 0x0A;
  var AMF3_XML = 0x0B;
  var AMF3_BYTE_ARRAY = 0x0C;
  var AMF3_VECTOR_INT = 0x0D;
  var AMF3_VECTOR_UINT = 0x0E;
  var AMF3_VECTOR_DOUBLE = 0x0F;
  var AMF3_VECTOR_OBJECT = 0x10;
  var AMF3_DICTIONARY = 0x11;

  var AMF = {
    deserialize: function(buf) {
      return new AMF.Deserializer(buf).deserialize();
    },

    Deserializer: function(buf) {
      this.pos = 0;
      this.flags = 0;
      this.ref = null;
      this.buf = buf;
      this.stringReferences = [];
      this.objectReferences = [];
      this.traitReferences = [];
      this.clsNameMap = {};
    },

    // Debugging

    // @param a:ArrayBuffer - bytes
    //   ex: [0x06, 0x05, 0x68, 0x69] // "hi"
    makeArrayBuffer: function(s) {
      s = s.replace(/\s+/g, '');
      var a2 = new Uint8Array(s.length/2);
      for (var i=0; i<s.length/2; i++) {
        a2[i] = parseInt(s.substr(i*2,2), 16);
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
              var dv = new DataView(v);
              for (var i=0; i<v.byteLength; i++) {
                r += byte(dv.getUint8(i));
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
    }
  };
  var proto = AMF.Deserializer.prototype;

  proto.isReference = function(map, dontReadIntFirst) {
    this.ref = null;
    if (!dontReadIntFirst) {
      this.flags = this.readInt();
    }
    var isRef = !this.popFlag();
    if (isRef) {
      var index = this.flags; // remaining bits are uint
      this.ref = map[index];
    }
    return isRef;
  };

  proto.popFlag = function() {
    var r = !!(this.flags & 1);
    this.flags >>= 1;
    return r;
  };

  proto.readByte = function() {
    var b = new DataView(this.buf)
      .getUint8(this.pos++, 1);
    return b;
  };

  proto.assert = function(expected, actual) {
    if (expected !== actual)
      throw new Error("expected "+ AMF.hexDump(expected) +", "+
        "but got "+ AMF.hexDump(actual) +
        " at position "+ (this.pos - 1) +".");
  };

  // Variable-Length Unsigned 29-bit Integer Encoding
  proto.readInt = function() {
    var result = 0, varLen = 0;
    while (((b = this.readByte()) & 0x80) !== 0 && varLen++ < 3) {
      result <<= 7;
      result |= (b & 0x7F);
    }
    // NOTICE: the docs claim the maximum range of U29 is 2^29-1
    //         but after testing AS3 its clear the implementation
    //         limit is actually 2^28-1. probably they leave room
    //         in the 4th octet for a flag, when they don't need to.
    //         our implementation will correctly support larger numbers,
    //         even though it will probably never receive any.
    result <<= (varLen < 3 ? 7: 8);
    result |= b;
    return result;
  };

  proto.readDouble = function() {
    var f = new DataView(this.buf)
      .getFloat64(this.pos, false); // big endian
    this.pos += 8;
    return f;
  };

  proto.readString = function() {
    if (this.isReference(this.stringReferences)) return this.ref;
    var length = this.flags; // remaining bits are uint
    var string = '';
    if (length > 0) {
      var bytes = new Uint8Array(this.buf, this.pos, length);
      string = decodeURIComponent(
        AMF.hexDump(bytes).replace(/\s+/g, '')
          .replace(/[0-9a-f]{2}/g, '%$&'));
      this.pos += length;
      this.stringReferences.push(string);
    }
    return string;
  };

  proto.readDate = function() {
    if (this.isReference(this.objectReferences)) return this.ref;
    var millisSinceEpoch = this.readDouble();
    var date = new Date(millisSinceEpoch);
    this.objectReferences.push(date);
    return date;
  };

  proto.readArray = function() {
    if (this.isReference(this.objectReferences)) return this.ref;
    var size = this.flags; // remaining bits are uint
    var arr = [];
    this.objectReferences.push(arr);

    var key = this.readString();
    while (key.length > 0) {
      arr[key] = this.deserialize();
      key = this.readString();
    }

    for (var i=0; i<size; i++) {
      arr.push(this.deserialize());
    }

    return arr;
  };

  proto.readObject = function() {
    if (this.isReference(this.objectReferences)) return this.ref;
    // only object instances beyond here
    var instance = {};
    this.objectReferences.push(instance);

    // flag operation order is important here
    var traits;
    var isTraitReference = this.isReference(this.traitReferences, true);
    if (isTraitReference) {
      traits = this.ref;
    } else {
      traits = {
        isExternallySerialized: this.popFlag(),
        isDynamicObject: this.popFlag(),
        sealedMemberCount: this.flags, // remaining bits are unit
        clsName: this.readString(),
        sealedMemberNames: []
      };
      this.traitReferences.push(traits);

      if (traits.isExternallySerialized) {
        throw new Error("External class serialization not supported at present.");

        //// when clsName is given, initialization of an existing type is implied
        //if (clsName && clsName.length > 0) {
        //  var classType = clsNameMap[clsName];
        //  if (!classType) {
        //    throw new Error('Class ' + clsName + ' cannot be found. Consider registering a class alias.');
        //  }
        //  instance = new classType;
        //  if ('importData' in instance &&
        //    'function' == typeof instance.importData)
        //  {
        //    instance.importData(data);
        //  } else {
        //    merge(instance, data);
        //  }
        //}
        //return someObjectCreatedExternally;
      }
      // only non-external beyond here

      // collect sealed member names
      for (var i=0; i<traits.sealedMemberCount; i++) {
        traits.sealedMemberNames.push(this.readString());
      }
    }

    // collect sealed member values
    for (var i=0; i<traits.sealedMemberCount; i++) {
      instance[traits.sealedMemberNames[i]] = this.deserialize();
    }

    if (traits.isDynamicObject) {
      // collect dynamic members
      var property = this.readString();
      // key value pairs
      while (property.length) {
        instance[property] = this.deserialize();
        property = this.readString();
      }
    }

    return instance;
  };

  proto.readByteArray = function() {
    if (this.isReference(this.objectReferences)) return this.ref;
    var length = this.flags; // remaining bits are uint
    var bytes = new ArrayBuffer(length);
    if (length > 0) {
      var dv = new DataView(bytes);
      for (var i=0; i<length; i++) {
        dv.setUint8(i, this.readByte());
      }
      this.objectReferences.push(bytes);
    }
    // this Uint8Array isn't necessary but is
    // nicer for console.log() and JSON.stringify()
    return new Uint8Array(bytes);
  };

  proto.deserialize = function() {
    var b = this.readByte();
    switch (b) {
      case AMF3_UNDEFINED:
        return undefined;
      case AMF3_NULL:
        return null;
      case AMF3_FALSE:
        return false;
      case AMF3_TRUE:
        return true;
      case AMF3_INT:
        return this.readInt();
      case AMF3_DOUBLE:
        return this.readDouble();
      case AMF3_STRING:
        return this.readString();
      case AMF3_XML_DOC:
        throw new Error("xml-doc-marker value-type not implemented.");
      case AMF3_DATE:
        return this.readDate();
      case AMF3_ARRAY:
        return this.readArray();
      case AMF3_OBJECT:
        return this.readObject();
      case AMF3_XML:
        throw new Error("xml-marker value-type not implemented.");
      case AMF3_BYTE_ARRAY:
        return this.readByteArray();
      case AMF3_VECTOR_INT:
        throw new Error("vector-int-marker value-type not implemented.");
      case AMF3_VECTOR_UINT:
        throw new Error("vector-uint-marker value-type not implemented.");
      case AMF3_VECTOR_DOUBLE:
        throw new Error("vector-double-marker value-type not implemented.");
      case AMF3_VECTOR_OBJECT:
        throw new Error("vector-object-marker value-type not implemented.");
      case AMF3_DICTIONARY:
        throw new Error("dictionary-marker value-type not implemented.");
      default:
        throw new Error("Unrecognized type marker "+ AMF.hexDump(b) +". Cannot proceed with deserialization.");
    }
  };

  if ('function' === typeof define) // Require.JS
    return define(function(require, exports, module) { return module.exports = AMF; });
  else if ('function' === typeof require && typeof exports === typeof module) // Node.JS
    return module.exports = AMF;
  window.AMF = AMF; // Browser
})();

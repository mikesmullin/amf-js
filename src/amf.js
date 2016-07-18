var AMF = (function(){var AMF = {
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
  AMF3_XML_DOC: 0x07, // not implemented
  AMF3_DATE: 0x08,
  AMF3_ARRAY: 0x09,
  AMF3_OBJECT: 0x0A,
  AMF3_XML: 0x0B, // not implemented
  AMF3_BYTE_ARRAY: 0x0C,
  AMF3_VECTOR_INT: 0x0D, // not implemented
  AMF3_VECTOR_UINT: 0x0E, // not implemented
  AMF3_VECTOR_DOUBLE: 0x0F, // not implemented
  AMF3_VECTOR_OBJECT: 0x10, // not implemented
  AMF3_DICTIONARY: 0x11, // not implemented


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

  deserialize: function(buf) {
    var pos = 0;
    var flags = 0;
    var ref = null;

    var isReference = function(map, dontReadIntFirst) {
      ref = null;
      if (!dontReadIntFirst) {
        flags = readInt();
      }
      var isRef = !popFlag();
      if (isRef) {
        var index = flags; // remaining bits are uint
        ref = map[index];
      }
      return isRef;
    };

    var popFlag = function() {
      var r = !!(flags & 1);
      flags >>= 1;
      return r;
    };

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

    // Variable-Length Unsigned 29-bit Integer Encoding
    var readInt = function() {
      var result = 0, varLen = 0;
      while (((b = readByte()) & 0x80) !== 0 && varLen++ < 3) {
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

    var readDouble = function() {
      var f = new DataView(buf)
        .getFloat64(pos, false); // big endian
      pos += 8;
      return f;
    };

    var stringReferences = [];
    var readString = function() {
      if (isReference(stringReferences)) return ref;
      var length = flags; // remaining bits are uint
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
    var readDate = function() {
      if (isReference(objectReferences)) return ref;
      var millisSinceEpoch = readDouble();
      var date = new Date(millisSinceEpoch);
      objectReferences.push(date);
      return date;
    };

    var readArray = function() {
      if (isReference(objectReferences)) return ref;
      var size = flags; // remaining bits are uint
      var arr = [];
      objectReferences.push(arr);

      var key = readString();
      while (key.length > 0) {
        arr[key] = deserialize();
        key = readString();
      }

      for (var i=0; i<size; i++) {
        arr.push(deserialize());
      }

      return arr;
    };

    var traitReferences = [];
    var clsNameMap = {};
    var readObject = function() {
      debugger;
      if (isReference(objectReferences)) return ref;
      // only object instances beyond here

      var traits;
      if (isReference(traitReferences, true)) traits = flags = ref;
      else traitReferences.push(traits); // TODO: may need to save more in here, like the static member names

      var externalSerialization = popFlag();
      if (externalSerialization) {
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

      var dynamicObject = popFlag();
      var sealedMemberCount = flags; // remaining bits are unit

      var clsName = readString();

      // add a new reference at this stage - essential to handle self-referencing objects
      var instance = {};
      objectReferences.push(instance);

      if (sealedMemberCount > 0) {
        // collect sealed members
        // list of names first
        var sealedMemberNames = [];
        for (var i=0; i<sealedMemberCount; i++) {
          sealedMemberNames.push(readString());
        }
        // then list of values
        for (var i=0; i<sealedMemberCount; i++) {
          instance[sealedMemberNames[i]] = deserialize();
        }
      }

      if (dynamicObject) {
        // collect dynamic members
        var property = readString();
        console.log({
          pos: pos,
          objectReference: ref,
          traits: traits,
          externalSerialization: externalSerialization,
          dynamicObject: dynamicObject,
          sealedMemberCount: sealedMemberCount,
          clsName: clsName,
          sealedMemberNames: sealedMemberNames,
          instance: instance,
          property: property
        });
        // key value pairs
        while (property.length) {
          instance[property] = deserialize();
          property = readString();
        }
      }

      return instance;
    };

    var deserialize = function() {
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
        case AMF.AMF3_DATE:
          return readDate();
        case AMF.AMF3_ARRAY:
          return readArray();
        case AMF.AMF3_OBJECT:
          return readObject();
        default:
          throw new Error("Unrecognized type marker "+ AMF.hexDump(b) +". Cannot proceed with deserialization.");
      }
    }

    return deserialize();
  }
};

return AMF; })();

module.exports = AMF;

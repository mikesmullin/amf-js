# AMF.JS

This project uses the modern Javascript Typed Array specification (e.g, ArrayBuffer, U8intArray, DataView, etc.).

Designed for browsers or Node.JS.

## Errata

### Inspiration

- [infomaniac-amf/js](https://github.com/infomaniac-amf/js)

### Everything you need to know about the data structure:

- [AMF0 Spec](http://download.macromedia.com/pub/labs/amf/amf0_spec_121207.pdf)
- [AMF3 Spec](http://wwwimages.adobe.com/www.adobe.com/content/dam/Adobe/en/devnet/amf/pdf/amf-file-format-spec.pdf)
- [Action Message Format on Wikipedia](https://en.wikipedia.org/wiki/Action_Message_Format)

### Understanding [A]BNF frequently referenced throughout the spec:

- [Augmented Backus Naur Form](https://en.wikipedia.org/wiki/Augmented_Backus%E2%80%93Naur_Form)
- [Backus Naur Form](https://en.wikipedia.org/wiki/Backus%E2%80%93Naur_Form)

### Reverse-engineering via ActionScript 3:

AS3 Object serialization:

```actionscript
import com.hurlant.util.Hex;
import flash.utils.ByteArray;

// ...

public function serialize():void {
  var o:Object = new Object();
  o.name = "John Doe";
  var byteArray:ByteArray = new ByteArray();
  byteArray.writeObject(o);
  trace("serialized: "+ Hex.fromArray(byteArray));
}
```

AS3 Object deserialization:

```actionscript
import com.hurlant.util.Hex;
import flash.utils.ByteArray;

// ...

public function dumpObj(oObj:Object, sPrefix:String = ""):void {
  sPrefix == "" ? sPrefix = "---" : sPrefix += "---";
  for (var i:* in oObj) {
    trace(sPrefix, i + " : " + oObj[i], "  ");
    if (typeof(oObj[i]) == "object") dumpObj(oObj[i], sPrefix);
  }
}

public function deserialize():void {
  var byteArray:ByteArray = new ByteArrray();
  // ... fill with bytes ...
  var o:Object = byteArray.readObject();
  trace("deserialized: "+ this.name +" hex= "+ Hex.fromArray(ba));
  dumpObj(o);
}
```

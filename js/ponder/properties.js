define(["d3", "./utils"], function (d3, utils) {
  /*
   * Module variables
   */

  /*
   * Helper functions
   */

  // Number formatter with variable precision based on number magnitude
  function format_number(n) {
    if (Number.isInteger(n)) {
      if (n < 100000) {
        return n;
      } else {
        return n.toPrecision(4);
      }
    } else {
      if (n < 10000) {
        return n.toPrecision(4);
      } else {
        return n.toPrecision(3);
      }
    }
  }

  // Returns a formatter function for values of the given type.
  function formatter_for_type(typ) {
    if (typ == "number") {
      return format_number;
    } else if (Array.isArray(typ)) { // compound types
      // TODO: HERE
      return function (v) { return "" + v; };
    } else { // anything else:
      return function (v) { return "" + v; };
    }
  }

  // Decides the type of a field given an example value. Types are objects with
  // the following keys:
  //
  //   kind
  //     The basic kind of value. The possible kinds are:
  //
  //       unknown
  //       undefined
  //       null
  //       object
  //       number
  //       string
  //       tensor
  //       map
  //
  //   value_type
  //     For "tensor" values, the type of each value
  //
  //   dimensions
  //     For "tensor" values, an array of dimension extents
  //
  //   subtypes
  //     For "map" values, a map from keys to field subtypes
  //
  function assess_type(value) {
    if (Array.isArray(value)) {
      var dimension = value.length;
      // compute subtype
      var subtype;
      if (dimension > 0) {
        subtype = assess_type(value[0]);
      } else {
        subtype = { "kind": "undefined" };
      }
      for (var i = 1; i < dimension; ++i) {
        subtype = combined_type(subtype, assess_type(value[i]));
      }

      // merge tensor subtype dimensions to flatten tensor types:
      if (subtype.kind === "tensor") {
        return {
          "kind": "tensor",
          "value_type": subtype.value_type,
          "dimensions": [dimension].concat(subtype.dimensions)
        }
      } else { // or just return 1D tensor:
        return {
          "kind": "tensor",
          "value_type": subtype,
          "dimensions": [ dimension ],
        };
      }
    } else if (typeof value === "object") {
      if (value === null) {
        return { "kind": "null" };
      }
      var subtypes = {};
      var anykeys = false;
      for (var k in value) {
        if (value.hasOwnProperty(k)) {
          subtypes[k] = assess_type(value[k]);
          anykeys = true;
        }
      }
      if (anykeys) {
        return { "kind": "map", "subtypes": subtypes };
      } else {
        return { "kind": "object" };
      }
    } else if (typeof value === "string") {
      return { "kind": "string" };
    } else if (typeof value === "number") {
      return { "kind": "number" };
    } else if (value === undefined) {
      return { "kind": "undefined" };
    } else { // an unknown type
      return { "kind": "unknown" };
    }
  }

  // Computes a combined type for two types ot (original type) and nt (new
  // type). The combined type can hold values from either subtype.
  function combined_type(ot, nt) {
    if (utils.is_equal(ot, nt)) {
      return ot;
    } else {
      if (ot.kind === "undefined") { // beats nothing
        return nt;
      } else if (ot.kind === "unknown") { // beats everything
        return ot;
      } else if (ot.kind === "null") { // beats only 'undefined'
        if (nt.kind === "undefined") {
          return ot;
        } else {
          return nt;
        }
      } else if (ot.kind === "number") {
        if (
          nt.kind === "undefined"
       || nt.kind === "null"
       || nt.kind === "number") {
          // missing/compatible value(s)
          return ot;
        } else { // can't combine
          return { "kind": "unknown" };
        }
      } else if (ot.kind === "string") {
        if (
          nt.kind === "undefined"
       || nt.kind === "null"
       || nt.kind === "string"
        ) { // subsume (or compatible)
          return ot;
        } else { // can't combine
          return { "kind": "unknown" };
        }
      } else if (ot.kind === "object") {
        if (nt.kind === "undefined" || nt.kind === "null") {
          return ot;
        } else {
          return { "kind": "unknown" };
        }
      } else if (ot.kind === "map") {
        if (nt.kind === "undefined" || nt.kind === "null") {
          return ot;
        } else if (Array.isArray(nt) && nt[0] == "map") { // combine subtypes!
          var subtypes = ot.subtypes;
          var nst = nt.subtypes;
          var cst = {};
          for (var k in subtypes) {
            if (subtypes.hasOwnProperty(k)) {
              if (nst.hasOwnProperty(k)) {
                cst[k] = combined_type(subtypes[k], nst[k]);
              } else {
                cst[k] = subtypes[k];
              }
            }
          }
          for (var k in nst) {
            if (nst.hasOwnProperty(k) && !subtypes.hasOwnProperty(k)) {
              cst[k] = nst[k];
            }
          }
          return { "kind": "map", "subtypes": cst };
        } else {
          return { "kind": "unknown" };
        }
      } else if (ot.kind === "tensor") {
        if (nt.kind === "undefined" || nt.kind === "null") {
          return ot;
        } else {
          if (utils.is_equal(ot.dimensions, nt.dimensions)) {
            return {
              "kind": "tensor",
              "dimensions": ot.dimensions,
              "value_type": combined_type(ot.value_type, nt.value_type)
            };
          // TODO: Tensors of different dimensions subsuming each other?
          } else {
            return { "kind": "unknown" };
          }
        }
      } else { // um... !?!
        console.warn("Unknown type during combination: '" + ot + "'");
        return { "kind": "unknown" };
      }
    }
  }

  /*
   * Core functions
   */

  // Uses an index (of the kind returned by property_indices) to retrieve a
  // value from an item.
  function get_value(item, index) {
    if (index == undefined) {
      return undefined;
    }
    var val = item;
    for (var i = 0; i < index.length; ++i) {
      try {
        val = val[index[i]];
      } catch (error) {
        return undefined;
      }
    }
    return val;
  }

  // Converts an index into a human-readable string.
  function index__string(index) {
    var result = "";
    for (var i = 0; i < index.length; ++i) {
      var idx = index[i];
      if (typeof idx === "string") {
        result += "." + idx;
      } else { // number
        result += ":" + idx;
      }
    }
    return result;
  }

  // Converts a property index string back into an index.
  function string__index(index_str) {
    var state = undefined;
    var sub = "";
    var result = [];
    for (var i = 0; i < index_str.length; ++i) {
      chr = index_str[i];
      if (state === undefined) {
        if (chr == ":") {
          state = "number";
        } else { // anything else (should be ".")
          state = "string";
        }
      } else if (state === "string") {
        if (chr == ":") {
          result.push(sub);
          sub = "";
          state = "number";
        } else if (chr == ".") {
          result.push(sub);
          sub = "";
          state = "string";
        } else {
          sub += chr;
        }
      } else if (state === "number") {
        if (chr == ":") {
          result.push(Number.parseInt(sub));
          sub = "";
          state = "number";
        } else if (chr == ".") {
          result.push(Number.parseInt(sub));
          sub = "";
          state = "string";
        } else {
          sub += chr;
        }
      }
    }
    if (state == "number") {
      result.push(Number.parseInt(sub));
    } else {
      result.push(sub);
    }

    return result;
  }

  // Returns an array of all possible indexes for the given type. Each index is
  // a tuple of keys to be applied to a data item to get a value out. The given
  // name is used as the initial index in this array.
  function property_indices(name, type) {
    var options = [];
    if (type.kind === "map") {
      var subtypes = type.subtypes;
      for (var k in subtypes) {
        if (subtypes.hasOwnProperty(k)) {
          var sub_indices = property_indices(k, subtypes[k]);
          for (var j = 0; j < sub_indices.length; ++j) {
            var si = sub_indices[j];
            var keys = si[0];
            options.push([ name ].concat(keys));
          }
        }
      }
    } else if (type.kind === "tensor") {
      if (type.dimensions.length > 1) {
        var sub_indices = property_indices(
          "ignored",
          {
            "kind": tensor,
            "value_type": type.value_type,
            "dimensions": type.dimensions.slice(1),
          }
        );
      } else {
        var sub_indices = property_indices("ignored", type.value_type);
      }
      for (var i = 0; i < type.dimensions[0]; ++i) {
        for (var j = 0; j < sub_indices.length; ++j) {
          var si = sub_indices[j];
          var keys = si[0];
          options.push([name, i].concat(keys.slice(1)));
        }
      }
    } else if (type.kind === "number" || type.kind === "string") {
      options.push([ name ]);
    } else {
      options.push([ name ]);
    }
    return options;
  }

  // Returns an array of all indices of a dictionary of properties (such as
  // that returned by assess_properties). Each possible index is paired with a
  // domain value if one is available, or undefined.
  function all_indices(properties) {
    var result = [];
    for (var k in properties) {
      if (properties.hasOwnProperty(k)) {
        var prp = properties[k];
        result = result.concat(property_indices(prp.name, prp.type));
      }
    }
    return result;
  }

  // Looks at ALL the data and returns a dictionary of detected properties.
  // Each property is an object with the following fields:
  //
  //   name
  //     The key for this property in each item.
  //   type
  //     The type of the property. May be a compound type.
  //
  function assess_properties(data) {
    var properties = {};
    // TODO: This is slow!!!
    // Allow properties input separately?
    // Do this in a web worker asynchronously?
    for (var i = 0; i < data.length; ++i) {
      var d = data[i];
      // TODO: Worry about attribute ordering here?
      for (var k in d) {
        if (d.hasOwnProperty(k)) {
          var prp;
          if (properties.hasOwnProperty(k)) {
            prp = properties[k];
            prp.type = combined_type(prp.type, assess_type(d[k]));
          } else {
            prp = {};
            prp.name = k;
            prp.type = assess_type(d[k]);
            properties[k] = prp;
          }
        }
      }
    }
    return properties;
  }

  return {
    "format_number": format_number,
    "formatter_for_type": formatter_for_type,
    "get_value": get_value,
    "assess_type": assess_type,
    "combined_type": combined_type,
    "index__string": index__string,
    "string__index": string__index,
    "property_indices": property_indices,
    "all_indices": all_indices,
    "assess_properties": assess_properties,
  };
});

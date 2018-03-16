define(["d3", "./utils"], function (d3, utils) {
  /*
   * Module variables
   */

  /*
   * Helper functions
   */

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

  // Decides the type of a field given an example value.
  function assess_type(value) {
    if (Array.isArray(value)) {
      var subtype = assess_type(value[0]);
      var dimension = value.length;
      if (Array.isArray(subtype)) {
        if (subtype[0] == "tensor") {
          subtype = [ "tensor", [ dimension ] + subtype[1], subtype[2] ];
        }
      }
      return [ "tensor", [ dimension ], subtype ];
    } else if (typeof value === "object") {
      var subtypes = {};
      var anykeys = false;
      for (var k in value) {
        if (value.hasOwnProperty(k)) {
          subtypes[k] = assess_type(value[k]);
          anykeys = true;
        }
      }
      if (anykeys) {
        return [ "map", subtypes ];
      } else {
        return "object";
      }
    } else if (typeof value === "string") {
      return "string";
    } else if (typeof value === "number") {
      return "number";
    } else { // an unknown type (e.g., if value is undefined)
      return "unknown";
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
    if (Array.isArray(type)) {
      var options = [];
      if (type[0] == "map") { // a map
        var tkeys = type[1];
        for (var k in tkeys) {
          if (tkeys.hasOwnProperty(k)) {
            var sub_indices = property_indices(k, tkeys[k]);
            options.push([ name ].concat(sub_indices));
          }
        }
      } else { // a tensor:
        if (type[1].length > 1) {
          var sub_indices = property_indices(
            "ignored",
            [type[0], type[1].slice(1), type[2]]
          );
        } else {
          var sub_indices = property_indices("ignored", type[2]);
        }
        for (var i = 0; i < type[1][0]; ++i) {
          options.push([name, i].concat(sub_indices.slice(1)));
        }
      }
      return options;
    } else {
      return [ [ name ] ];
    }
  }

  // Returns an array of all indices of a list of properties.
  function all_indices(properties) {
    var result = [];
    for (var i = 0; i < properties.length; ++i) {
      var prp = properties[i];
      result = result.concat(property_indices(prp.name, prp.type));
    }
    return result;
  }

  // Looks at the data (mostly just the first item) and returns a list of
  // detected properties. Each property is an object with the following fields:
  //
  //   name
  //     The key for this property in each item.
  //   type
  //     The type of the property. May be a compound type.
  //   formatter
  //     A function that takes a value and returns a string to display to the
  //     user to represent that value.
  //
  function assess_properties(data) {
    var first = data[0];
    var results = [];
    // TODO: Worry about attribute ordering here?
    for (var k in first) {
      if (first.hasOwnProperty(k)) {
        var prp = {};
        prp.name = k;
        prp.type = assess_type(first[k]);
        prp.formatter = formatter_for_type(prp.type);
        results.push(prp);
      }
    }
    return results;
  }

  return {
    "format_number": format_number,
    "get_value": get_value,
    "index__string": index__string,
    "string__index": string__index,
    "property_indices": property_indices,
    "all_indices": all_indices,
    "assess_properties": assess_properties,
  };
});

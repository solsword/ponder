define(["d3/d3", "./utils"], function (d3, utils) {
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

  // Returns an array of possible indexing schemes for the given property. The
  // first element of each is just the key for that property, while the second
  // is an array, possibly empty, of index values to be used sequentially.
  function property_indexables(prp) {
    var t = prp.type;
    if (Array.isArray(t)) {
      var options = [];
      if (t[0] == "map") {
        var tkeys = t[1];
        // TODO: Tensors inside maps?!?
        for (var k in tkeys) {
          if (tkeys.hasOwnProperty(k)) {
            options.push([ prp.name, k ]);
          }
        }
      } else { // a tensor; enumerate all possible indexings
        var tdim = t[1].reduce((accum, val) => accum * val, 1);
        function darray(tidx) {
          var result = [];
          for (var i = 0; i < t[1].length; ++i) {
            var dm = t[1][i];
            result.push(tidx % dm);
            tidx = Math.floor(tidx / dm);
          }
          return result;
        }
        for (var tidx = 0; tidx < tdim; ++tidx) {
          var ia = darray(tidx);
          options.push([ prp.name, ia ]);
        }
      }
      return options;
    } else {
      return [ prp.name, [] ];
    }
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
    for (var k in first) {
      if (first.hasOwnProperty(k)) {
        var prp = {};
        prp.name = k;
        prp.type = assess_type(first[k]);
        prp.formatter = formatter_for_type(prp.type);
        results.push(prp);
      }
    }
  }

  return {
    "format_number": format_number,
    "property_indexables": property_indexables,
    "assess_properties": assess_properties,
  };
});

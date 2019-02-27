import * as utils from "./utils.js";

/*
 * Helper functions
 */

// Number formatter with variable precision based on number magnitude. The
// optional nan_subst argument will be returned for NaN arguments (the
// default is the string "NaN").
export function format_number(n, nan_subst) {
  if (Number.isInteger(n)) {
    if (n < 100000) {
      return n;
    } else {
      return n.toPrecision(4);
    }
  } else if (Number.isFinite(n)) {
    if (n < 1000) {
      return n.toPrecision(4);
    } else if (n < 10000) {
      return n.toPrecision(5);
    } else if (n < 100000) {
      return n.toPrecision(6);
    } else {
      return n.toPrecision(3);
    }
  } else {
    return nan_subst || "NaN";
  }
}

// Type -> string conversion
export function format_type(t) {
  if (t.kind == "tensor") {
    let dims = "";
    for (let i = 0; i < t.dimensions.length; ++i) {
      dims += t.dimensions[i];
      if (i < t.dimensions.length - 1) {
        dims += "×";
      }
    }
    return format_type(t.value_type) + "[" + dims + "]";
  } else {
    return t.kind
  }
}

// Returns a formatter function for values of the given type.
export function formatter_for_type(typ) {
  if (typ.kind === "number") {
    return format_number;
  } else if (typ.kind === "tensor") { // tensors
    // TODO: HERE
    return function (v) { return "" + v; };
  } else if (typ.kind === "map") { // maps
    // TODO: HERE
    return function (v) { return "" + v; };
  } else { // anything else:
    return function (v) { return "" + v; };
  }
}

// Given a dimensions list and an array of indices, unrolls the array into a
// flat index (an integer).
export function unroll_index(dimensions, seq_idx) {
  var flat_idx = 0;
  var stride = 1;
  for (let i = dimensions.length - 1; i >= 0; --i) {
    flat_idx += seq_idx[i] * stride;
    sride *= dimensions[i];
  }
  return flat_idx;
}

// Given a dimensions list and a flat index, rolls the index up into an array
// of indices.
export function rollup_index(dimensions, flat_idx) {
  var seq_idx = [];
  for (let i = dimensions.length - 1; i >= 0; --i) {
    var dim = dimensions[i];
    seq_idx.push(flat_idx % dim);
    flat_idx = Math.floor(flat_idx / dim);
  }
  return seq_idx.reverse();
}

// Takes an Array of type objects, and returns a type object for a tensor
// with those subtypes.
export function array_type(subtypes) {
  let dimension = subtypes.length;
  var joint_subtype = { "kind": "undefined" };
  if (subtypes.length > 0) {
    joint_subtype = subtypes[0];
  }
  for (var i = 1; i < dimension; ++i) {
    joint_subtype = combined_type(joint_subtype, subtypes[i]);
  }

  // merge tensor subtype dimensions to flatten tensor types:
  if (joint_subtype.kind === "tensor") {
    return {
      "kind": "tensor",
      "value_type": joint_subtype.value_type,
      "subtypes": subtypes,
      "dimensions": [dimension].concat(joint_subtype.dimensions)
    }
  } else { // or just return 1D tensor:
    return {
      "kind": "tensor",
      "value_type": joint_subtype,
      "subtypes": subtypes,
      "dimensions": [ dimension ],
    };
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
//       number
//       string
//       tensor
//       map
//
//   value_type
//     For "tensor" values, the common type for all values. May be abstract
//     (like "unknown" if there's a mix of strings and numbers), but
//     "subtypes" will list individual types for each item.
//
//   dimensions
//     For "tensor" values, an array of dimension extents.
//
//   subtypes
//     For "map" values, a map from keys to field subtypes. For "tensor
//     values, an array of individual subtypes.
//
export function assess_type(value) {
  if (Array.isArray(value)) {
    var dimension = value.length;
    // compute subtypes
    var subtypes = [];
    for (var i = 0; i < dimension; ++i) {
      subtypes.push(assess_type(value[i]));
    }
    return array_type(subtypes);
  } else if (typeof value === "object") {
    if (value === null) {
      return { "kind": "null" };
    }
    var subtypes = {};
    for (var k in value) {
      if (value.hasOwnProperty(k)) {
        subtypes[k] = assess_type(value[k]);
      }
    }
    return { "kind": "map", "subtypes": subtypes };
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
export function combined_type(ot, nt) {
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
    } else if (ot.kind === "map") {
      if (nt.kind === "undefined" || nt.kind === "null") {
        return ot;
      } else if (nt.kind === "map") { // combine subtypes!
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
          cst = [];
          for (let i = 0; i < ot.subtypes.length; ++i) {
            // (we know length is equal because dimensions are equal)
            // TODO: Worry about non-square tensors?
            cst.push(combined_type(ot.subtypes[i], nt.subtypes[i]));
          }
          return {
            "kind": "tensor",
            "dimensions": ot.dimensions,
            "value_type": combined_type(ot.value_type, nt.value_type),
            "subtypes": cst,
          };
        } else {
          // TODO: Tensors of different dimensions subsuming each other?
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

// Turns fields into a mapping from field names to indices
export function fmap(fields) {
  var result = {};
  for (let i = 0; i < fields.length; ++i) {
    result[fields[i]] = i;
  }
  return result;
}

// Uses an index (of the kind returned by property_indices) to retrieve a
// value from a record. Also requires a field mapping (see fmap, above).
export function get_value(fmap, record, index) {
  if (index === undefined) {
    return undefined;
  }
  var idx = fmap[index[0]];
  if (idx === undefined) {
    return undefined; // invalid field!
  }
  var val = record[idx];
  for (var i = 1; i < index.length; ++i) {
    try {
      val = val[index[i]];
    } catch (error) {
      return undefined;
    }
  }
  return val;
}

// Puts a value into a record. Doesn't do any type checking or domain updates
// (see the dataset module for that). Throws an error on failure.
export function put_value(fmap, types, record, index, value) {
  if (index === undefined) {
    throw "Index undefined.";
  }
  var idx = fmap[index[0]];
  if (idx === undefined) {
    throw "Invalid field.";
  }

  if (index.length == 1) {
    record[idx] = value;
    return;
  }

  var here = record[idx];
  if (here == undefined) {
    var typ = get_type(types, [ index[0] ]);
    if (typ.kind === "tensor") {
      var fresh = [];
      record[idx] = fresh;
      here = fresh;
    } else if (typ.kind === "map") {
      var fresh = {};
      record[idx] = fresh;
      here = fresh;
    } else { // can't construct a non-container
      console.error(typ);
      throw (
        "Unconstructable missing intermediate type: " + index[0] + "→" + typ
      );
    }
  }
  for (var i = 1; i < index.length - 1; ++i) {
    var next = here[index[i]];
    if (next == undefined) {
      var typ = get_type(types, index.slice(0, i));
      if (typ.kind === "tensor") {
        var fresh = [];
        here[index[i]] = fresh;
        here = fresh;
      } else if (typ.kind === "map") {
        var fresh = {};
        here[index[i]] = fresh;
        here = fresh;
      } else { // can't construct a non-container
        console.error(typ);
        throw (
          "Unconstructable missing intermediate type: "
        + index.slice(0, i) + "→" + typ
        );
      }
    } else {
      here = next;
    }
  }
  here[index[index.length - 1]] = value;
}

// Retrieves the type of the item at the given index from a types map.
export function get_type(types, index) {
  if (index == undefined) {
    return { "kind": "unknown" };
  }
  var result = types[index[0]];
  for (var i = 1; i < index.length; ++i) {
    try {
      result = result.subtypes[index[i]];
    } catch (error) {
      return { "kind": "unknown" };
    }
  }
  return result;
}

// Retrieves the domain of the item at the given index from a domains map.
export function get_domain(domains, index) {
  if (index == undefined) {
    return undefined;
  }
  var key = index__string(index);
  return domains[key];
}

// Converts an index into a human-readable string.
export function index__string(index) {
  if (index == undefined) {
    return "undefined";
  }
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
export function string__index(index_str) {
  var state = undefined;
  var sub = "";
  var result = [];
  for (var i = 0; i < index_str.length; ++i) {
    let chr = index_str[i];
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
export function property_indices(name, type) {
  var options = [ [ name ] ];
  if (type.kind === "map") {
    var subtypes = type.subtypes;
    for (var k in subtypes) {
      if (subtypes.hasOwnProperty(k)) {
        var sub_indices = property_indices(k, subtypes[k]);
        for (var j = 0; j < sub_indices.length; ++j) {
          var si = sub_indices[j];
          options.push([ name ].concat(si));
        }
      }
    }
  } else if (type.kind === "tensor") {
    for (let i = 0; i < type.subtypes.length; ++i) {
      var sub_indices = property_indices("ignored", type.subtypes[i]);
      for (let j = 0; j < sub_indices.length; ++j) {
        var si = sub_indices[j];
        options.push([name, i].concat(si.slice(1, si.length)));
      }
    }
  } // otherwise we're already done
  return options;
}

// Returns an array containing all indices exactly one-step below the given
// index (which should have the given type).
export function sub_indices(index, type) {
  options = [];
  if (type.kind == "tensor") {
    for (let i = 0; i < type.dimensions[0]; ++i) {
      options.push(index.concat([i]));
    }
  } else if (type.kind == "map") {
    for (let k of Object.keys(type.subtypes)) {
      options.push(index.concat([k]));
    }
  }
  return options;
}

// Returns an array of all indices of a dictionary of properties (such as
// that returned by assess_properties). Each possible index is paired with a
// domain value if one is available, or undefined.
export function all_indices(properties) {
  var result = [];
  for (var k in properties) {
    if (properties.hasOwnProperty(k)) {
      var typ = properties[k];
      result = result.concat(property_indices(k, typ));
    }
  }
  return result;
}

// Looks at ALL the records and returns a dictionary of detected properties.
// Each entry maps a field name to the type of that field (see assess_type).
export function assess_properties(fields, records) {
  var properties = {};
  // TODO: This in a web worker asynchronously?
  for (let i = 0; i < records.length; ++i) {
    let d = records[i];
    for (let j = 0; j < d.length; ++j) {
      let k = fields[j];
      let val = d[j];
      let typ = assess_type(val);

      if (properties.hasOwnProperty(k)) {
        properties[k] = combined_type(properties[k], typ);
      } else {
        properties[k] = typ;
      }
    }
  }
  return properties;
}

// Using the output of assess_properties, this function assesses the domain
// of each numeric or string property identified, finding min & max for
// numeric properties and value frequencies for string properties. All other
// property types have undefined domains.
export function assess_domains(fields, records, types) {
  var result = {}
  var indices = all_indices(types);
  var fm = fmap(fields);

  for (let i = 0; i < indices.length; ++i) {
    let ind = indices[i];
    let k = index__string(ind);
    let typ = get_type(types, ind);
    if (typ.kind === "number") {
      for (let j = 0; j < records.length; ++j) {
        let r = records[j];
        let val = get_value(fm, r, ind);
        if (val === undefined) {
          val = 0;
        }
        if (result.hasOwnProperty(k)) {
          let d = result[k];
          if (val < d[0]) {
            result[k] = [val, d[1]];
          } else if (val > d[1]) {
            result[k] = [d[0], val];
          }
        } else {
          result[k] = [ val, val ]
        }
      }
    } else if (typ.kind === "string") {
      for (let j = 0; j < records.length; ++j) {
        let r = records[j];
        let val = get_value(fm, r, ind);
        if (val === undefined) {
          val = "«missing»";
        }
        if (result.hasOwnProperty(k)) {
          let d = result[k];
          if (d.hasOwnProperty(val)) {
            d[val] += 1;
          } else {
            d[val] = 1;
          }
        } else {
          result[k] = {};
          result[k][val] = 1;
        }
      }
    } else {
      result[k] = undefined;
    }
  }
  return result;
}

import * as utils from "./utils.js";
import * as prp from "./properties.js";
import * as v from "./vector.js";

/*
 * Module variables
 */

export var DEFAULT_OUTLIER_ALLOWANCE = 3;

/*
 * Dataset functions
 */

// Gets the name of a field, using an alias if it has one.
export function get_name(dataset, index) {
  var base = prp.index__string(index);
  if (dataset.aliases.hasOwnProperty(base)) {
    return dataset.aliases[base];
  } else {
    return base;
  }
}

// Gets the name of a field, using an alias if it has one. For nested fields,
// just uses the last part of the name, or the last several parts if the last
// parts of the index are numerical.
export function get_short_name(dataset, index) {
  var base = prp.index__string(index);
  if (dataset.aliases.hasOwnProperty(base)) {
    return dataset.aliases[base];
  } else {
    var shrt = [];
    for (let i = index.length - 1; i >= 0; --i) {
      shrt.push(index[i]);
      if (Number.isNaN(+index[i])) {
        break;
      }
    }
    return prp.index__string(shrt.reverse());
  }
}

// Gets the name of a subfield inner of superfield outer, using an alias if
// available, but otherwise discarding the name of the superfield.
export function get_inner_name(dataset, outer, inner) {
  var combined = outer.concat(inner);
  var cstr = prp.index__string(combined);
  if (dataset.aliases.hasOwnProperty(cstr)) {
    return dataset.aliases[cstr];
  } else {
    return prp.index__string(inner);
  }
}

// Gets a canonical name for an index that's been modified so that it can be
// used as part of the name for another index.
export function get_name_substitute(dataset, index) {
  let name = get_name(dataset, index);
  if (name[0] == '.' || name[0] == ':') {
    name = name.slice(1);
  }
  return name.replace(/[.:]/g, "→");
}

export function get_record(dataset, nth) {
  return dataset.records[nth];
}

export function get_field(dataset, record, index) {
  return prp.get_value(dataset.fmap, record, index);
}

// Fuses values from a multiple records at a single index into a single
// value, according to the type of index used. Numeric fields return the mean
// among the given records, while string fields return a frequency map from
// values to counts. Tensor and map fields recursively fuse their individual
// indices/keys.
export function fuse_values(dataset, records, index) {
  let typ = get_type(dataset, index);
  if (typ.kind == "number") { // compute mean
    let values = records.map(r => get_field(dataset, r, index));
    return values.reduce((a, b) => a + b, 0) / records.length;
    // this might be NaN, but that's okay

  } else if (typ.kind == "string") { // compute count-map
    let vmap = {};
    records.forEach(function (r) {
      let val = "" + get_field(dataset, r, index);
      if (vmap.hasOwnProperty(val)) {
        vmap[val] += 1;
      } else {
        vmap[val] = 1;
      }
    });
    return vmap;

  } else if (typ.kind == "tensor") { // recurse
    let fused = [];
    let si = prp.sub_indices(index, typ);
    for (let i = 0; i < si.length; ++i) {
      fused.push(fuse_values(dataset, records, si[i]));
    }
    return fused;

  } else if (typ.kind == "map") { // recurse
    let fused = {};
    let si = prp.sub_indices(index, typ);
    for (let i = 0; i < si.length; ++i) {
      let sub = si[i];
      let k = sub.slice(sub.length - 1)[0];
      fused[k] = fuse_values(dataset, records, sub);
    }
    return fused;
  }
}

// Returns the type value for a fusion of values from the given index. Note
// that this may have to scan the entire dataset to determine possible keys
// for fused string indices.
export function fused_type(dataset, index) {
  let typ = get_type(dataset, index);
  if (typ == undefined) {
    console.warn("Unknown index '" + index + "' in fused_type.");
    return { "kind": "undefined" };
  } else if (typ.kind == "number") {
    return { "kind": "number" };
  } else if (typ.kind == "string") {
    let keys = new Set();
    dataset.records.forEach(function (r) {
      keys.add(get_field(dataset, r, index));
    });
    let subtypes = {};
    keys.forEach(function (key) {
      subtypes[key] = { "kind": "number" };
    });
    return {
      "kind": "map",
      "subtypes": subtypes
    }
  } else if (typ.kind == "tensor") {
    let fused = [];
    let vt = { "kind": "undefined" };
    let si = prp.sub_indices(index, typ);
    for (let i = 0; i < si.length; ++i) {
      ft = fused_type(dataset, si[i]);
      fused.push(ft);
      if (ft.kind == "tensor") {
        vt = prp.combined_type(vt, ft.value_type);
      } else {
        vt = prp.combined_type(vt, ft);
      }
    }
    return {
      "kind": "tensor",
      "dimensions": typ.dimensions,
      "value_type": vt,
      "subtypes": fused
    };
  } else if (typ.kind == "map") {
    let fused = {};
    let si = prp.sub_indices(index, typ);
    for (let i = 0; i < si.length; ++i) {
      let sub = si[i];
      let k = sub.slice(sub.length - 1)[0];
      fused[k] = fused_type(dataset, sub);
    }
    return {
      "kind": "map",
      "subtypes": fused
    };
  } else {
    console.warn("Unexpected fusion target type for field '" + index + "'.");
    console.warn(typ);
    return { "kind": "undefined" };
  }
}

// Updates the domain(s) under the given index which has gained the given new
// value.
function update_domain(dataset, index, value) {
  var typ = get_type(dataset, index);
  if (typ.kind === "number") {
    var si = prp.index__string(index);
    var old_dom = get_domain(dataset, index);
    if (value < old_dom[0]) {
      dataset.domains[si] = [ value, old_dom[1] ];
    } else if (value > old_dom[1]) {
      dataset.domains[si] = [old_dom[0], value ];
    }
  } else if (typ.kind === "string") {
    var si = prp.index__string(index);
    var old_dom = get_domain(dataset, index);
    var old_count = old_dom[old_val];
    if (old_count == 1) {
      delete dataset.domains[si][old_val];
    } else {
      dataset.domains[si][old_val] -= 1;
    }
    if (old_dom.hasOwnProperty(value)) {
      old_dom[value] += 1;
    } else {
      old_dom[value] = 1;
    }
  } else if (typ.kind === "tensor") {
    for (let i = 0; i < typ.dimensions[0]; ++i) {
      var ni = index.concat([i]);
      update_domain(dataset, ni, value[i]);
    }
  } else if (typ.kind === "map") {
    var old_dom = get_domain(dataset, index);
    for (let k in old_dom) {
      if (old_dom.hasOwnProperty(k)) {
        var ni = index.concat([k]);
        update_domain(dataset, ni, value[k]);
      }
    }
  } // else no domain to worry about
}

// Throws an error on failure (e.g., type mismatch).
export function set_field(dataset, record, index, value) {
  var old_val = get_field(dataset, record, index);
  var old_typ = get_type(dataset, index);
  var new_typ = prp.assess_type(value);
  var comb_typ = prp.combined_type(old_typ, new_typ);
  if (!utils.is_equal(old_typ, comb_typ)) {
    console.warn([old_typ, new_typ, comb_typ]);
    console.warn([dataset, record, index, value]);
    throw "Type mismsatch while assigning to field.";
  }

  // put in the value
  prp.put_value(dataset.fmap, dataset.types, record, index, value);

  // update domain if necessary
  update_domain(dataset, index, value);
}

export function has_field(dataset, index) {
  return dataset.imap.hasOwnProperty(prp.index__string(index));
}

// Adds a new field (or subfield, if "parent_index" isn't undefined) to the
// dataset. Note that initial domains for the type will be set to [0, 0] or
// empty as appropriate.
export function add_field(dataset, parent_index, name, type) {
  if (parent_index === undefined) {
    dataset.fields.push(name);
    dataset.fmap[name] = dataset.fields.length - 1;
    dataset.types[name] = type;
    var pis = prp.property_indices(name, type);
    for (let i = 0; i < pis.length; ++i) {
      var pi = pis[i];
      var str_idx = prp.index__string(pi)
      var sub_typ = get_type(dataset, pi);

      // fix the indices and index map:
      dataset.imap[str_idx] = pi;
      dataset.indices.push(pi);

      // add an empty domain:
      if (sub_typ.kind === "number") {
        dataset.domains[str_idx] = [ 0, 0 ];
      } else if (sub_typ.kind === "string") {
        dataset.domains[str_idx] = {};
      }
    }
  } else {
    var pt = get_type(dataset, parent_index);
    if (pt.kind != "map") {
      console.error("Can't add a subfield to a non-map field!");
      return;
    }
    pt.subtypes[name] = type;
    var pis = prp.property_indices(name, type);
    for (let i = 0; i < pis.length; ++i) {
      var pi = pis[i];
      var sub_idx = parent_index.concat(pi);
      var str_idx = prp.index__string(sub_idx)
      var sub_typ = get_type(dataset, sub_idx);

      // fix the indices and index map:
      dataset.imap[str_idx] = sub_idx;
      dataset.indices.push(sub_idx);

      // add an empty domain:
      if (sub_typ.kind === "number") {
        dataset.domains[str_idx] = [ 0, 0 ];
      } else if (sub_typ.kind === "string") {
        dataset.domains[str_idx] = {};
      }
    }
  }
}

export function get_type(dataset, index) {
  return prp.get_type(dataset.types, index);
}

export function get_domain(dataset, index) {
  return prp.get_domain(dataset.domains, index);
}

export function all_indices(dataset) {
  return dataset.indices;
}

export function lookup_index(dataset, string) {
  for (var k in dataset.aliases) {
    if (dataset.aliases.hasOwnProperty(k) && dataset.aliases[k] == string) {
      return dataset.imap[k];
    }
  }
  return dataset.imap[string];
}

export function aliased_indices(dataset) {
  return dataset.indices.filter(
    idx => dataset.aliases.hasOwnProperty(prp.index__string(idx))
  );
}

// Returns an array of strings naming each index, where aliased indices are
// given only by their aliased names.
export function index_names(dataset) {
  var result = [];
  for (let i = 0; i < dataset.indices.length; ++i) {
    var idx = dataset.indices[i];
    var si = prp.index__string(idx);
    if (dataset.aliases.hasOwnProperty(si)) {
      result.push(dataset.aliases[si]);
    } else {
      result.push(si);
    }
  }
  return result;
}

// Returns a type value for a pure-numeric tensor with n entries.
export function numeric_vector_type(n) {
  var result = {
    "kind": "tensor",
    "value_type": { "kind": "number" },
    "dimensions": [ n ],
    "subtypes": []
  };
  for (let i = 0; i < n; ++i) {
    result.subtypes.push({ "kind": "number" });
  }
  return result;
}

// Returns the nth field of the given kind (e.g., "numeric", "string", etc.).
// If n is larger than the number of such fields, it will wrap around, but if
// there are no such fields, it will return undefined. An array of multiple
// kinds can be passed, in which case any of them match, and the nth field
// across all given kinds is returned; kind can also be left undefined, in
// which case all fields will match. Finally, kind may be a function, in
// which case it will be called with each index should return true or false
// to count that index or not.
export function nth_of_kind(dataset, kind, n) {
  while (n >= 0) {
    var st_n = n;
    for (let i = 0; i < dataset.indices.length; ++i) {
      var ind = dataset.indices[i];
      var typ = get_type(dataset, ind);
      if (
        kind == undefined
     || (
          typeof(kind) == "function"
       && kind(ind)
        )
     || (
          Array.isArray(kind)
       && kind.indexOf(typ.kind) >= 0
        )
     || typ.kind === kind
      ) {
        n -= 1;
        if (n < 0) {
          return ind;
        }
      }
    }
    if (st_n == n) {
      return undefined;
    }
  }
}

/*
 * Processing functions
 */

// Helper function that processes a CSV field from a raw string into a value.
export function process_csv_field(raw) {
  var fv = raw;

  // check if it's quoted and unquote if it is
  var quoted = false;
  if (fv[0] == '"') {
    fv = utils.unquote(fv);
    quoted = true;
  }

  // convert empty fields and numbers
  if (!quoted && fv == "") { // convert empty strings to undefined
    fv = undefined;
  } else if (!quoted) {
    // try to convert to a number
    var n = +fv;
    if (!Number.isNaN(n)) {
      fv = n;
    }
  }

  return fv;
}

// Guesses a separator character for the given string. If it doesn't find any
// of the possible separator characters before encountering a newline (or the
// end of the string) it just returns newline.
export function guess_sep(string) {
  var look_for = "\t,|:/\\.+ -_*#@!$%^&~`";
  var found = [];
  for (let i = 0; i < string.length; ++i) {
    if (string[i] == "\n") {
      break;
    } else {
      var idx = look_for.indexOf(string[i])
      if (idx >= 0) {
        found[idx] = true;
      }
    }
  }
  for (let i = 0; i < look_for.length; ++i) {
    if (found[i]) {
      return look_for[i];
    }
  }
  return "\n";
 }

// Transforms a string containing the data from a CSV file into a JSON object
// suitable for passing into the preprocess_data function. Sep indicates the
// separator character, which defaults to ',' (it must be a single
// character). Entries that can be are converted to numbers, and blanks are
// converted to undefined. Empty strings can be given using a pair of double
// quotes. Any field that starts with a double quote as the first character
// is considered a quoted field, and will not be converted to either
// undefined or a numeric value, but the quotes will be removed and any
// escaped quotes or backslashes inside will be unescaped.
export function gulp_csv(string, sep) {
  if (sep == undefined) {
    sep = ",";
  }

  if (sep == "\\") {
    sep = "\\\\";
  }
  var restring = (
    "(\"(\\\\\"|[^\"])*\"[" + sep + "\n])" // a quoted field
  + "|([^" + sep + "\n]*[" + sep + "\n])" // or an unquoted field
  );

  var fieldre = new RegExp(restring);

  // row results
  var rows = [];
  var row = [];
  rows.push(row);

  var m = fieldre.exec(string);
  while (m != null) {
    var ms = m[0]; // match string
    var ml = ms.length; // match length
    // chop off the match
    string = string.slice(ml);

    // find the field value
    var fv = process_csv_field(ms.slice(0, ml-1));

    // push our value onto the current row
    row.push(fv);

    // if this field ends its row, create a new row for further values
    if (ms[ml-1] == "\n") {
      row = [];
      rows.push(row);
    }

    // find the next match
    m = fieldre.exec(string);
  }
  // one last value: the remainder of the string up to EOF
  fv = process_csv_field(string);
  row.push(fv);

  let fields = rows[0];
  let records = rows.slice(1);

  return {
    "fields": fields,
    "records": records,
  };
}

// Takes an array of record objects (themselves arrays of field values) and
// looks for columns containing strings that contain comma-, colon-, or
// semicolon-separated values. When it finds such a column, it transforms
// entries in that column into either Arrays of numbers (if the separated
// strings can all be parsed as numbers) or maps from string values to 0 (for
// missing) or 1 (for present).
function split_string_records(records) {
  let splittable = {};
  for (let row of records) {
    for (let col = 0; col < row.length; ++col) {
      let val = row[col];
      if (typeof val === "string") {
        if (/[,;:]/.exec(val)) {
          let vals = val.split(/[,;:]/);
          let allnum = true;
          for (let subval of vals) {
            let numeric;
            if (subval == '') {
              numeric = undefined;
            } else {
              numeric = +subval;
              if (Number.isNaN(numeric)) {
                allnum = false;
                break;
              }
            }
          }
          if (allnum && !splittable.hasOwnProperty(col)) {
            splittable[col] = 'num'
          } else {
            if (!splittable.hasOwnProperty(col) || splittable[col] == 'num') {
              splittable[col] = {};
            }
            for (let v of vals) {
              splittable[col][v] = 1;
            }
          }
        }
      }
    }
  }
  let fresh = [];
  for (let row of records) {
    let frow = [];
    fresh.push(frow);
    for (let col = 0; col < row.length; ++col) {
      if (splittable[col] == 'num') {
        let vals = row[col].split(/[,;:]/);
        frow[col] = vals.map(x => +x);
      } else if (splittable[col]) {
        let vals = row[col].split(/[,;:]/);
        frow[col] = {};
        for (let key of Object.keys(splittable[col])) {
          frow[col][key] = 0;
        }
        for (let val of vals) {
          frow[col][val] = 1;
        }
      } else {
        frow.push(row[col]);
      }
    }
  }
  return fresh;
}

// Takes in a partially-complete data object with at least 'fields' and
// 'records' defined. If split_strings is given as true, looks for strings
// that are really comma-, colon- or semicolon-separated lists and makes them
// into maps from string values to 1 or 0, or into tensors of numbers if they
// contain numbers. Returns a completed data object with the following
// fields:
//
//  aliases
//    A mappping from index strings to aliases for those indices.
//  glosses
//    A mappping from index strings to mappings from values to glosses for
//    those values.
//  types
//    A mapping from base field names (not full indices) to field types.
//  domains
//    A mapping from index strings to domains for those indices.
//  imap
//    A mapping from index strings to index objects.
//  indices
//    An array of all possible indices of the data.
//  fmap
//    A mapping from field names to field indices.
//  fields
//    An array of field names.
//  records
//    An array of records, each of which is an array of objects. The entries
//    in each record correspond to the field names.
//
export function preprocess_data(data, split_strings) {
  var fields, records, aliases, glosses;
  fields = data.fields;
  records = data.records;
  aliases = data.aliases || {};
  glosses = data.glosses || {};

  if (split_strings) {
    records = split_string_records(data.records);
  }

  var types;
  if (data.hasOwnProperty("types")) {
    types = data.types;
  } else {
    types = prp.assess_properties(fields, records);
  }

  var domains;
  if (data.hasOwnProperty("domains")) {
    domains = data.domains;
  } else {
    domains = prp.assess_domains(fields, records, types);
  }

  var fmap = prp.fmap(fields);
  var indices = prp.all_indices(types);

  var imap = {};
  for (let i = 0; i < indices.length; ++i) {
    imap[prp.index__string(indices[i])] = indices[i];
  }
  for (let k in aliases) {
    if (aliases.hasOwnProperty(k)) {
      imap[aliases[k]] = prp.string__index(k);
    }
  }

  var bundle = {
    "aliases": aliases,
    "glosses": glosses,
    "types": types,
    "domains": domains,
    "imap": imap,
    "indices": indices,
    "fmap": fmap,
    "fields": fields,
    "records": records,
  }

  return bundle;
}

// Checks whether a dataset has all of the necessary keys for full
// functionality (doesn't check values, however). Returns a list of missing
// keys, or an empty list if none are missing.
export function missing_keys(dataset) {
  var missing = [];
  var required = [
    "types",
    "domains",
    "imap",
    "indices",
    "fmap",
    "fields",
    "records",
  ];
  for (let i = 0; i < required.length; ++i) {
    var key = required[i];
    if (!dataset.hasOwnProperty(key)) {
      missing.push(key);
    }
  }
  return missing;
}

// Figures out a numerical domain for the given index, and returns an object
// with the following keys:
//
//   getter
//     A function that takes a data record an returns a numerical value for
//     the given index.
//   domain
//     An array of two numbers: the minimum and maximum numerical values that
//     might be returned by the accessor.
//
// If the input index doesn't have a domain, the resulting getter will always
// return 0 and the domain will be [0, 0].
//
// The optional undefined_as_zero parameter defaults to true, and causes
// undefined values to map to zero instead of returning undefined.
export function numerical_transform(dataset, index, undefined_as_zero) {
  if (undefined_as_zero == undefined) {
    undefined_as_zero = true;
  }
  var dom = get_domain(dataset, index);
  if (dom == undefined) { // give up
    return {
      "getter": d => 0,
      "domain": [0, 0]
    };
  } else if (Array.isArray(dom)) { // numerical range
    return {
      "getter": function (d) {
        var v = get_field(dataset, d, index);
        if (v === undefined && undefined_as_zero) {
          return 0;
        } else {
          return v;
        }
      },
      "domain": dom
    };
  } else { // must be a string domain containing counts
    var values = Object.keys(dom);
    values.sort();
    var vmap = {}; 
    for (let i = 0; i < values.length; ++i) {
      vmap[values[i]] = i;
    }
    return {
      "getter": d => vmap[get_field(dataset, d, index)],
      "domain": [ 0, values.length - 1 ]
    };
  }
}

// Creates and returns an outlier model of the given field, which is an
// object with the following properties:
//
//   mean
//     The mean of the numerical transform of the field.
//   sd
//     The standard deviation of the numerical transform of the field.
//   normalized
//     A function that, given a record, returns a value between 0 and 1 for
//     non-outliers, and values below 0 or above 1 for outliers.
//
// The model is a simple Gaussian.
//
// The allowance variable controls how many standard deviations are
// considered enough for an item to be an outlier, and defaults to
// DEFAULT_OUTLIER_ALLOWANCE.
//
// The count_missing variable defaults to true and controls whether missing
// values are counted as zeros or skipped.
//
// Reference for incremental variance algorithm:
//   https://en.wikipedia.org/wiki/Algorithms_for_calculating_variance#Online_algorithm
export function outlier_model(dataset, index, allowance, count_missing) {
  if (allowance == undefined) { allowance = DEFAULT_OUTLIER_ALLOWANCE; }
  if (count_missing == undefined) { count_missing = true; }
  var mean = 0;
  var m2 = 0; // aggregate squared distance from mean
  var count = 0;
  var nt = numerical_transform(dataset, index, count_missing);
  for (let i = 0; i < dataset.records.length; ++i) {
    var r = dataset.records[i];
    var val = nt.getter(r);
    if (val == undefined) {
      continue;
    }

    // incremental
    count += 1;
    var delta = val - mean;
    mean += delta / count;
    var delta2 = val - mean;
    m2 += delta * delta2;
  }
  var variance = m2 / (dataset.records.length - 1);
  var sd = Math.sqrt(variance);

  var lower = nt.domain[0];
  var upper = nt.domain[1];

  if (mean - allowance * sd > lower) {
    lower = mean - allowance * sd;
  }

  if (mean + allowance * sd < upper) {
    upper = mean + allowance * sd;
  }

  return {
    "mean": mean,
    "sd": sd,
    "normalized": function (d) {
      var val = nt.getter(d);
      return (val - lower) / (upper - lower);
    },
  }
}

// Returns a function that maps from records to flat vectors containing the
// information from the given property. The return value has two properties:
//
//   getter
//     Function to extract a vector value from a record.
//
//   dimensions
//     Integer number of entries in each resulting vector.
//
// For numeric and string properties, it returns length-1 vectors containing
// the results of numerical_transform. For tensors, it flattens the tensor
// into a long vector, where each entry is the result of a
// numerical_transform on the item type for that tensor. For maps, it treats
// each value in the keys domain as an entry in the vector and transforms
// associated values using numerical_transform. (Note that multilayer maps
// are not flattened TODO: that?). For items of unknown type, it returns a
// length-zero vector regardless of the data value.
export function vector_transform(dataset, index) {
  var typ = get_type(dataset, index);
  if (typ === undefined) {
    console.warn("Undefined type in vector_transform for index " + index);
    return {
      "getter": d => [],
      "dimensions": 0
    };
  } else if (typ.kind === "number" || typ.kind === "string") {
    var nt = numerical_transform(dataset, index);
    return {
      "getter": d => [ nt.getter(d) ],
      "dimensions": 1,
    };
  } else if (typ.kind === "tensor") {
    var dims = typ.dimensions;
    var tdim = dims.reduce((a, b) => a * b, 1);
    function conv_index(idx) {
      var result = [];
      for (let i = dims.length - 1; i >= 0; --i) {
        var d = dims[i];
        result[i] = idx % d;
        idx = Math.floor(idx / d);
      }
      return result;
    }
    var getters = [];
    for (let i = 0; i < tdim; ++i) {
      var nt = numerical_transform(dataset, index.concat(conv_index(i)));
      getters.push(nt.getter);
    }
    return {
      "getter": function (d) {
        var result = [];
        for (let i = 0; i < tdim; ++i) {
          result.push(getters[i](d));
        }
        return result;
      },
      "dimensions": tdim
    };
  } else if (typ.kind === "map") {
    var subs = typ.subtypes;
    var keys = Object.keys(subs);
    var dim = keys.length;
    var getters = [];
    for (let i = 0; i < dim; ++i) {
      var k = keys[i];
      var nt = numerical_transform(dataset, index.concat([k]));
      getters.push(nt.getter);
    }
    return {
      "getter": function (d) {
        var result = [];
        for (let i = 0; i < dim; ++i) {
          result.push(getters[i](d));
        }
        return result;
      },
      "dimensions": dim
    };
  } else {
    return {
      "getter": d => [],
      "dimensions": 0
    };
  }
}

// Figures out a categorical domain for the given index, and returns an object
// with the following keys:
//
//   getter
//     A function that takes a data record and a category index and returns
//     a numeric value for the given index, or undefined if the given data
//     record has no value for that index.
//   n_categories
//     The number of categories. The getter will return undefined for
//     category index arguments not in [0, n_categories)
//   labels
//     An array of string labels that's n_categories items long.
//
// For numeric and string fields, each distinct possible value becomes a
// category, and each record returns 1 for the category to which it belongs
// and undefined for all other categories. For tensors, each possible
// flattened sub-index is a category, returning the value in that entry of
// the tensor. For maps, each key is a category, returning the value for that
// key.
export function categorical_transform(dataset, index) {
  var typ = get_type(dataset, index);
  if (typ.kind == "tensor") { // TODO: recursive transforms?
    var tdim = typ.dimensions.reduce((a, b) => a * b, 1);
    var labels = [];
    for (let i = 0; i < tdim; ++i) {
      var seq_idx = prp.rollup_index(typ.dimensions, i);
      labels.push(get_short_name(dataset, index.concat(seq_idx)))
    }
    return {
      "getter": function (d, idx) {
        var seq_idx = prp.rollup_index(typ.dimensions, idx);
        return get_field(dataset, d, index.concat(seq_idx));
      },
      "n_categories": tdim,
      "labels": labels,
    };
  } else if (typ.kind == "map") { // TODO: recursive transforms?
    var categories = Object.keys(typ.subtypes).sort();
    var cat_indices = [];
    for (let i = 0; i < categories.length; ++i) {
      cat_indices[categories[i]] = i;
    }
    return {
      "getter": function (d, idx) {
        var cat = categories[idx];
        if (cat == undefined) {
          return undefined;
        } else {
          return get_field(dataset, d, index.concat([cat]));
        }
      },
      "n_categories": categories.length,
      "labels": categories.map(
        c => get_short_name(dataset, index.concat([c]))
      ),
    };
  } else { // number or string
    var sorter;
    var val_indices;
    if (typ.kind == "number") {
      sorter = (a, b) => a - b;
      val_indices = {};
      for (let i = 0; i < dataset.records.length; ++i) {
        val_indices[get_field(dataset, dataset.records[i], index)] = true;
      }
    } else {
      sorter = undefined;
      var dom = get_domain(dataset, index);
      val_indices = Object.assign({}, dom);
    }

    var skeys = Object.keys(val_indices).sort(sorter);
    for (let i = 0; i < skeys.length; ++i) {
      val_indices[skeys[i]] = i;
    }
    return {
      "getter": function (d, i) {
        if (i == val_indices[get_field(dataset, d, index)]) {
          return 1;
        } else {
          return undefined;
        }
      },
      "n_categories": skeys.length,
      "labels": skeys,
    };
  }
}

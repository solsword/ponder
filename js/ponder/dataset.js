define(
["./utils", "./properties"],
function (utils, prp) {
  /*
   * Module variables
   */

  var DEFAULT_OUTLIER_ALLOWANCE = 3;

  /*
   * Dataset functions
   */

  function get_name(dataset, index) {
    var base = prp.index__string(index);
    if (dataset.aliases.hasOwnProperty(base)) {
      return dataset.aliases[base];
    } else {
      return base;
    }
  }

  function get_record(dataset, nth) {
    return dataset.records[nth];
  }

  function get_field(dataset, record, index) {
    return prp.get_value(dataset.fmap, record, index);
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
  function set_field(dataset, record, index, value) {
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

  function has_field(dataset, index) {
    return dataset.imap.hasOwnProperty(prp.index__string(index));
  }

  // Adds a new field (or subfield, if "parent_index" isn't undefined) to the
  // dataset. Note that initial domains for the type will be set to [0, 0] or
  // empty as appropriate.
  function add_field(dataset, parent_index, name, type) {
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

  function get_type(dataset, index) {
    return prp.get_type(dataset.types, index);
  }

  function get_domain(dataset, index) {
    return prp.get_domain(dataset.domains, index);
  }

  function all_indices(dataset) {
    return dataset.indices;
  }

  function lookup_index(dataset, string) {
    for (var k in dataset.aliases) {
      if (dataset.aliases.hasOwnProperty(k) && dataset.aliases[k] == string) {
        return dataset.imap[k];
      }
    }
    return dataset.imap[string];
  }

  function aliased_indices(dataset) {
    return dataset.indices.filter(
      idx => dataset.aliases.hasOwnProperty(prp.index__string(idx))
    );
  }

  // Returns an array of strings naming each index, where aliased indices are
  // given only by their aliased names.
  function index_names(dataset) {
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

  // Returns the nth field of the given kind (e.g., "numeric", "string", etc.).
  // If n is larger than the number of such fields, it will wrap around, but if
  // there are no such fields, it will return undefined.
  function nth_of_kind(dataset, kind, n) {
    while (n >= 0) {
      var st_n = n;
      for (let i = 0; i < dataset.indices.length; ++i) {
        var ind = dataset.indices[i];
        if (get_type(dataset, ind).kind === kind) {
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
  function process_csv_field(raw) {
    var fv = raw;

    // check if it's quoted and unquote if it is
    var quoted = false;
    if (fv[0] == '"') {
      fv = utils.unqote(fv)
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
  function guess_sep(string) {
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

  // Transforms a string containing the data from a CSV file into a JSON array
  // suitable for passing into the preprocess_data function. Sep indicates the
  // separator character, which defaults to ',' (it must be a single
  // character). Entries that can be are converted to numbers, and blanks are
  // converted to undefined. Empty strings can be given using a pair of double
  // quotes. Any field that starts with a double quote as the first character
  // is considered a quoted field, and will not be converted to either
  // undefined or a numeric value, but the quotes will be removed and any
  // escaped quotes or backslashes inside will be unescaped.
  function gulp_csv(string, sep) {
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

    return rows;
  }

  // Takes in data as either an array of records (including a one-row header
  // for field names) or a partially-complete data object with at least
  // 'fields' and 'records' defined. Returns a completed data object with the
  // following fields:
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
  function preprocess_data(data) {
    var fields, records, aliases, glosses;
    if (Array.isArray(data)) { // flat array of data: read fields from header
      fields = data[0];
      records = data.slice(1);
      aliases = {};
      glosses = {};
    } else {
      fields = data.fields;
      records = data.records;
      aliases = data.aliases;
      glosses = data.glosses;
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
  function missing_keys(dataset) {
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
  function numerical_transform(dataset, index, undefined_as_zero) {
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
  // considered enough for an item to be an outlier, an defaults to
  // DEFAULT_OUTLIER_ALLOWANCE.
  //
  // The count_missing variable defaults to true and controls whether missing
  // values are counted as zeros or skipped.
  //
  // Reference for incremental variance algorithm:
  //   https://en.wikipedia.org/wiki/Algorithms_for_calculating_variance#Online_algorithm
  function outlier_model(dataset, index, allowance, count_missing) {
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
  function vector_transform(dataset, index) {
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
      var tdim = dims.reduce((a, b) => a * b);
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
  //     A function that takes a data record an returns an integer value for
  //     the given index.
  //   count
  //     The number of categories. Integer values returned by the getter will
  //     be in [0, count)
  //   labels
  //     An array of string labels that's count items long.
  //
  // Undefined values will get put in a category of their own.
  //
  function categorical_transform(dataset, index) {
    var typ = get_type(dataset, index);
    var sorter;
    if (typ.kind == "number") {
      sorter = (a, b) => a - b;
    } else {
      sorter = undefined;
    }

    var val_indices;
    if (typ.kind == "string") {
      var dom = get_domain(dataset, index);
      val_indices = Object.assign({}, dom);
    } else {
      val_indices = {};
      for (let i = 0; i < dataset.records.length; ++i) {
        val_indices[get_field(dataset, dataset.records[i], index)] = true;
      }
    }

    var skeys = Object.keys(val_indices).sort(sorter);
    for (let i = 0; i < skeys.length; ++i) {
      val_indices[skeys[i]] = i;
    }
    return {
      "getter": function (d) {
        return val_indices[get_field(dataset, d, index)];
      },
      "count": skeys.length,
      "labels": skeys,
    };
  }

  return {
    "DEFAULT_OUTLIER_ALLOWANCE": DEFAULT_OUTLIER_ALLOWANCE,
    "get_name": get_name,
    "get_record": get_record,
    "get_field": get_field,
    "has_field": has_field,
    "add_field": add_field,
    "set_field": set_field,
    "get_type": get_type,
    "get_domain": get_domain,
    "all_indices": all_indices,
    "lookup_index": lookup_index,
    "aliased_indices": aliased_indices,
    "index_names": index_names,
    "nth_of_kind": nth_of_kind,
    "process_csv_field": process_csv_field,
    "guess_sep": guess_sep,
    "gulp_csv": gulp_csv,
    "preprocess_data": preprocess_data,
    "missing_keys": missing_keys,
    "numerical_transform": numerical_transform,
    "outlier_model": outlier_model,
    "vector_transform": vector_transform,
    "categorical_transform": categorical_transform,
  };
});

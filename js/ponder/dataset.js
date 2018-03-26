define(
["./utils", "./properties"],
function (utils, prp) {
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
  function numerical_transform(dataset, index) {
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
          if (v === undefined) {
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

  return {
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
    "preprocess_data": preprocess_data,
    "missing_keys": missing_keys,
    "numerical_transform": numerical_transform,
    "vector_transform": vector_transform,
  };
});

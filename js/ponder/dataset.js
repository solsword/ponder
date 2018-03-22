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

  return {
    "get_name": get_name,
    "get_record": get_record,
    "get_field": get_field,
    "get_type": get_type,
    "get_domain": get_domain,
    "all_indices": all_indices,
    "lookup_index": lookup_index,
    "aliased_indices": aliased_indices,
    "index_names": index_names,
    "nth_of_kind": nth_of_kind,
    "preprocess_data": preprocess_data,
    "missing_keys": missing_keys,
  };
});

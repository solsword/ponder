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

  function aliased_indices(dataset) {
    return dataset.indices.filter(
      idx => dataset.aliases.hasOwnProperty(prp.index__string(idx))
    );
  }

  /*
   * Processing functions
   */

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

    var bundle = {
      "aliases": aliases,
      "glosses": glosses,
      "types": types,
      "domains": domains,
      "indices": indices,
      "fmap": fmap,
      "fields": fields,
      "records": records,
    }

    return bundle;
  }

  return {
    "get_name": get_name,
    "get_record": get_record,
    "get_field": get_field,
    "get_type": get_type,
    "get_domain": get_domain,
    "all_indices": all_indices,
    "aliased_indices": aliased_indices,
    "preprocess_data": preprocess_data,
  };
});

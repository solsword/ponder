define(
["d3", "./utils", "./dataset"],
function (d3, utils, ds) {

  // A filter that compares a field against a reference value using a
  // user-specified comparator.
  function ComparisonFilter(dataset, index, comparator, value) {
    this.data = dataset;
    this.set_index(index);
    this.set_comparator(comparator);
    this.set_value(value);
  }

  // static applicability check
  ComparisonFilter.applicable_to = function (dataset, index) {
    var typ = ds.get_type(dataset, index);
    return typ.kind == "number" || typ.kind == "string";
  }

  ComparisonFilter.prototype.set_index = function (index) {
    if (typeof index === "string") {
      index = ds.lookup_index(this.data, index);
    }
    this.index = index;
  }

  // Default accept function accepts everything
  ComparisonFilter.prototype.accept = function (record) { return true; }

  // Sets the comparator, building an accept function that dictates record
  // acceptance.
  ComparisonFilter.prototype.set_comparator = function (comparator) {
    this.comparator = comparator;
    if (comparator == "<") {
      this.accept = function (record) {
        return ds.get_field(this.data, record, this.index) < this.value;
      }
    } else if (comparator == "<=") {
      this.accept = function (record) {
        return ds.get_field(this.data, record, this.index) <= this.value;
      }
    } else if (comparator == ">") {
      this.accept = function (record) {
        return ds.get_field(this.data, record, this.index) > this.value;
      }
    } else if (comparator == ">=") {
      this.accept = function (record) {
        return ds.get_field(this.data, record, this.index) >= this.value;
      }
    } else if (comparator == "==") {
      this.accept = function (record) {
        return ds.get_field(this.data, record, this.index) == this.value;
      }
    } else if (comparator == "!=") {
      this.accept = function (record) {
        return ds.get_field(this.data, record, this.index) != this.value;
      }
    }
  }

  // Sets the value, casting to number or string as appropriate
  ComparisonFilter.prototype.set_value = function (value) {
    var dt = ds.get_type(this.data, this.index);
    if (dt.kind == "number") {
      if (typeof value == "number") {
        this.value = value;
      } else {
        this.value = Number.parseFloat(value);
      }
    } else {
      this.value = "" + value;
    }
  }

  // Just calls the accept function (see set_comparator).
  ComparisonFilter.prototype.filter = function (records) {
    var results = [];
    for (let i = 0; i < records.length; ++i) {
      var r = records[i];
      var val = ds.get_field(this.data, r, this.index);
      if (this.accept(val)) {
        results.push(r);
      }
    }

    return results;
  }

  // A filter that accepts values from a given set for a given field.
  function ValueSetFilter(dataset, index, acceptable_values) {
    this.data = dataset;
    this.index = index;
    this.acceptable = acceptable_values;
  }

  // static applicability check
  ValueSetFilter.applicable_to = function (dataset, index) {
    var typ = ds.get_type(dataset, index);
    return typ.kind == "number" || typ.kind == "string";
  }

  ValueSetFilter.prototype.set_index = function (index) {
    if (typeof index === "string") {
      index = ds.lookup_index(this.data, index);
    }
    this.index = index;
  }

  // Augments the dataset by adding the designated field to every record.
  ValueSetFilter.prototype.filter = function (records) {
    var results = [];
    for (let i = 0; i < records.length; ++i) {
      var r = records[i];
      var val = ds.get_field(this.data, r, this.index);
      if (this.acceptable.indexOf(val) >= 0) {
        results.push(r);
      }
    }

    return results;
  }

  return {
    "ValueSetFilter": ValueSetFilter,
    "ComparisonFilter": ComparisonFilter,
  };
});

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
    if (typeof index == "string") { index = ds.lookup_index(dataset, index); }
    var typ = ds.get_type(dataset, index);
    return typ.kind == "number" || typ.kind == "string";
  }

  ComparisonFilter.prototype.set_index = function (index) {
    if (typeof index === "string") {
      index = ds.lookup_index(this.data, index);
    }
    this.index = index;
    this.nt = ds.numerical_transform(this.data, this.index, false);
  }

  // Default accept function accepts everything
  ComparisonFilter.prototype.accept = function (record) { return true; }

  // Sets the comparator, building an accept function that dictates record
  // acceptance.
  ComparisonFilter.prototype.set_comparator = function (comparator) {
    this.comparator = comparator;
    if (comparator == "<") {
      this.accept = function (value) {
        return value < this.value;
      }
    } else if (comparator == "<=") {
      this.accept = function (value) {
        return value <= this.value;
      }
    } else if (comparator == ">") {
      this.accept = function (value) {
        return value > this.value;
      }
    } else if (comparator == ">=") {
      this.accept = function (value) {
        return value >= this.value;
      }
    } else if (comparator == "==") {
      this.accept = function (value) {
        return value == this.value;
      }
    } else if (comparator == "!=") {
      this.accept = function (value) {
        return value != this.value;
      }
    }
  }

  // Sets the value, casting it to a number
  ComparisonFilter.prototype.set_value = function (value) {
    var dt = ds.get_type(this.data, this.index);
    if (typeof value == "number") {
      this.value = value;
    } else {
      this.value = Number.parseFloat(value);
    }
  }

  // Just calls the accept function (see set_comparator).
  ComparisonFilter.prototype.filter = function (records) {
    var results = [];
    for (let i = 0; i < records.length; ++i) {
      var r = records[i];
      var val = this.nt.getter(r);
      if (this.accept(val)) {
        results.push(r);
      }
    }

    return results;
  }

  // A filter that accepts values from a given set for a given field.
  function ValueSetFilter(dataset, index) {
    this.data = dataset;
    this.set_index(index);
    this.acceptable = new Set();
    for (let i = 0; i < this.ct.n_categories; ++i) {
      this.acceptable.add(i);
    }
  }

  // static applicability check
  ValueSetFilter.applicable_to = function (dataset, index) {
    return true;
  }

  ValueSetFilter.prototype.set_index = function (index) {
    if (typeof index === "string") {
      index = ds.lookup_index(this.data, index);
    }
    this.index = index;
    this.ct = ds.categorical_transform(this.data, this.index);
  }

  ValueSetFilter.prototype.set_accept = function (idx_or_label, accept) {
    var idx;
    if (typeof idx_or_label == "string") {
      idx = this.ct.labels.indexOf(idx_or_label);
      if (idx < 0) {
        console.warn("Unknown value for filter: '" + idx_or_label + "'")
      }
    } else {
      idx = idx_or_label;
    }
    if (accept) {
      this.acceptable.add(idx);
    } else {
      this.acceptable.delete(idx);
    }
  }

  ValueSetFilter.prototype.will_accept = function (idx_or_label, accept) {
    var idx;
    if (typeof idx_or_label == "string") {
      idx = this.ct.labels.indexOf(idx_or_label);
      if (idx < 0) {
        console.warn("Unknown value for filter: '" + idx_or_label + "'")
      }
    } else {
      idx = idx_or_label;
    }
    return this.acceptable.has(idx);
  }

  // Augments the dataset by adding the designated field to every record.
  ValueSetFilter.prototype.filter = function (records) {
    var results = [];
    for (let i = 0; i < records.length; ++i) {
      var r = records[i];
      var matches = false;
      var the_filter = this;
      this.acceptable.forEach(function (idx) {
        var val = the_filter.ct.getter(r, idx);
        if (val > 0) {
          matches = true;
        }
      });
      if (matches) {
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
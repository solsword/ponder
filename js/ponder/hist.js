define(
["d3", "./utils", "./dataset", "./properties", "./viz"],
function (d3, utils, ds, prp, viz) {

  // Default margin value (fraction of total frame reserved)
  var DEFAULT_MARGIN = 0.04;

  // Default # of bins to use
  var DEFAULT_BINS = 10;

  // Creates a histogram of values in the given field using just the given
  // records from the given dataset. If normalize is given and true, histogram
  // values will be normalized between 0 and 1. Normalize may also take on the
  // special values "count" (count each key as 1 even if the field has keys and
  // values) and "average" (compute average value for each key when the field
  // has keys and values). These special values are treated as true if the
  // field isn't a map, and "count" mode is entered automatically if the target
  // field has any non-numeric keys.
  //
  // If the target field is numeric, a binned histogram will be created using
  // the given number of bins (or DEFAULT_BINS) spread out over the full range
  // of the field in the dataset (not just the records given). If a domain is
  // given, that domain is used instead (should be an array of [ min, max ]),
  // or if domain is given as "auto" the domain of the given records will be
  // used.
  //
  // If the target field is a string field, counts for each distinct value will
  // be tallied.
  //
  // If the target field is a map from strings to numbers, the sum for each key
  // will be computed across the given records, and that will form the
  // histogram.
  //
  // If margin isn't given, it will default to DEFAULT_MARGIN.
  function create_histogram(
    id,
    dataset,
    records,
    field,
    normalize,
    bins,
    domain,
    margin
  ) {
    var result = {
      "id": id,
      "data": dataset,
      "records": records,
      "normalize": normalize,
      "bins": bins,
      "margin": margin,
    };

    var ft = ds.get_type(dataset, field);
    var counts = {};
    if (ft.kind === "number") {
      var dom;
      if (bins === undefined) { bins = DEFAULT_BINS; }
      result.bins = bins;
      if (domain === undefined) {
        dom = ds.get_domain(dataset, field);
      } else if (domain === "auto") {
        dom = [undefined, undefined];
        for (let i = 0; i < records.length; ++i) {
          var val = ds.get_field(dataset, records[i], field);
          if (dom[0] === undefined || dom[0] > val) { dom[0] = val; }
          if (dom[1] === undefined || dom[1] < val) { dom[1] = val; }
        }
      } else {
        dom = domain;
      }
      result.domain = dom;
      var bs = (dom[1] - dom[0]) / bins;
      var bin_names = [];
      for (let i = 0; i < bins; ++i) {
        bin_names.push(
          "" + (dom[0] + bs * i).toPrecision(2) + "–"
        + (dom[0] + bs * (i + 1)).toPrecision(2)
        );
      }
      for (let i = 0; i < records.length; ++i) {
        var val = ds.get_field(dataset, records[i], field);
        var bin = Math.floor((val - dom[0]) / bs);
        var bn = bin_names[bin];
        if (counts.hasOwnProperty(bn)) {
          counts[bn] += 1;
        } else {
          counts[bn] = 1;
        }
      }
    } else if (ft.kind === "string") {
      for (let i = 0; i < records.length; ++i) {
        var val = ds.get_field(dataset, records[i], field);
        if (counts.hasOwnProperty(val)) {
          counts[val] += 1;
        } else {
          counts[val] = 1;
        }
      }
    } else if (ft.kind === "map") {
      var all_numeric = true;
      for (var k in ft.subtypes) {
        if (ft.subtypes.hasOwnProperty(k)) {
          if (ft.subtypes[k].kind != "number") {
            all_numeric = false;
            break;
          }
        }
      }
      var mode = "sum";
      if (normalize == "count" || !all_numeric) {
        mode = "count";
        // TODO: Some way to ask for normalized counts of numeric maps?
        if (all_numeric) {
          normalize = false;
        }
      } else if (normalize == "average") {
        mode = "average";
        normalize = false;
      }
      for (let i = 0; i < records.length; ++i) {
        var val = ds.get_field(dataset, records[i], field);
        for (var k in val) {
          if (val.hasOwnProperty(k)) {
            if (mode === "count") {
              if (counts.hasOwnProperty(k)) {
                counts[k] += 1;
              } else {
                counts[k] = 1;
              }
            } else {
              var sv = val[k];
              if (counts.hasOwnProperty(k)) {
                counts[k] += sv;
              } else {
                counts[k] = sv;
              }
            }
          }
        }
      }
      if (mode === "average") {
        for (var k in counts) {
          if (counts.hasOwnProperty(k)) {
            counts[k] /= records.length;
          }
        }
      }
    } else {
      console.error("Don't know how to make a histogram out of: " + ft);
      return undefined;
    }
    if (normalize) {
      var mx = undefined;
      // find max
      for (var k in counts) {
        if (counts.hasOwnProperty(k)) {
          var val = counts[k];
          if (mx == undefined || val > mx) {
            mx = val;
          }
        }
      }
      // divide by max
      for (var k in counts) {
        if (counts.hasOwnProperty(k)) {
          counts[k] /= mx;
        }
      }
    }
    // Put counts into th result:
    result.counts = counts;

    return result;
  }

  return {
  };
});

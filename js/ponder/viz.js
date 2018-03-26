define(
["d3", "./utils", "./quadtree", "./properties"],
function (d3, utils, qt, prp) {
  /*
   * Module variables:
   */

  // Resolution at which to cut off quadtree recursion for drawing.
  DEFAULT_MIN_RESOLUTION = undefined;

  // Default color scale
  DEFAULT_COLOR_SCALE = d3.interpolateMagma;

  // The non-breaking space character
  NBSP = "\u00A0";

  // The radius of outlier points in a quadtree visualization
  QT_OUTLIER_RADIUS = 1;

  // Radius used for quadtree points when points_allowed is set to undefined.
  QT_POINT_RADIUS = 1.5;

  /*
   * Data transformation functions
   */

  // TODO: Get rid of this now that we have Histogram?
  // Given an array-of-values or map-of-values->counts field, creates bars for
  // a histogram showing the sum of each value. If 'just_tally' is given with a
  // map field, the map values are ignored and 1 unit is counted for each time
  // a key appears.
  function value_sums(items, field, just_tally) {
    var counts = {};
    for (var i = 0; i < items.length; ++i) {
      var it = items[i];
      var fv = it[field];
      if (fv != undefined) { // ignore missing fields
        if (Array.isArray(fv)) {
          for (var j = 0; j < fv.lenth; ++j) {
            var val = fv[j];
            var k = "" + val;
            if (counts.hasOwnProperty(k)) {
              counts[k] += 1;
            } else {
              counts[k] = 1;
            }
          }
        } else if (typeof fv === 'object') {
          for (var val in fv) {
            if (fv.hasOwnProperty(val)) {
              if (counts.hasOwnProperty(val)) {
                if (just_tally) {
                  counts[val] += 1;
                } else {
                  counts[val] += fv[val];
                }
              } else {
                if (just_tally) {
                  counts[val] = 1;
                } else {
                  counts[val] = fv[val];
                }
              }
            }
          }
        } // else ignore this item
      }
    }
    return counts;
  }

  /*
   * Drawing functions
   */

  // Replaces the contents of the given SVG element with a visualization of the
  // given quadtree. The color_scale and min_resolution arguments are optional,
  // and will default to DEFAULT_COLOR_SCALE and DEFAULT_MIN_RESOLUTION if not
  // supplied. The default mode draws a centroid circle for each quadtree leaf
  // colored according to the number of points in that leaf. If as_rects is
  // given as other than undefined, each quadtree node will instead be shaded
  // according to its density. If color_by is defined, then color values will
  // be the result of that function applied to each data point (or averaged
  // over results for each point within a region). The combination of color_by
  // and as_rects = true may be slow. Note that when color_by is not given and
  // as_rects is off, the point size scales slightly with density to somewhat
  // enhance perceptual accuracy of density among points, although of course
  // there's still some distortion. This size scaling is disabled when color_by
  // is given. Use as_rects for a less-biased view of density. The labels
  // argument can be given to supply labels for each item, but should usually
  // only be used when the data is sparse. Labels from multiple items are
  // combined according to a most-frequent scheme, and an asterisk is appended
  // if the labels being combined aren't all identical. If there's a tie for
  // most-frequent, just an asterisk is used. Labels are ignored completely
  // when as_rects is true.
  function draw_quadtree(
    element,
    tree,
    color_scale,
    min_resolution,
    as_rects,
    color_by,
    labels
  ) {
    if (color_scale === undefined) {
      color_scale = DEFAULT_COLOR_SCALE;
    }

    if (min_resolution === undefined) {
      min_resolution = DEFAULT_MIN_RESOLUTION;
    }

    var base_density;
    if (min_resolution != undefined) {
      base_density = 1 / (min_resolution * min_resolution * 4);
    } else {
      base_density = undefined;
    }

    var text = tree.extent;
    var tw = text[1][0] - text[0][0]
    var th = text[1][1] - text[0][1]
    var tarea = tw * th;

    // All rectangles
    var rects = qt.density_areas(
      tree,
      min_resolution,
      base_density,
      true // min-as-zero
    );

    if (as_rects) { // shade density over rectangles
      if (color_by === undefined) {
        function color_for(d) {
          return color_scale(d.relative_density);
        }
      } else {
        var color_values_cache = qt.local_values(
            tree,
          function (item) { return [ color_by(item) ]; }
        );

        function color_for(d) {
          return color_scale(color_values_cache["" + d.extent][0]);
        }
      }

      // get rid of any old point data
      element.selectAll("circle").remove();
      // set up region data
      element.selectAll("rect").exit().remove();
      element.selectAll("rect")
        .data(rects)
      .enter().append("rect")
        .attr("class", "region")
        .attr("x", d => d.extent[0][0])
        .attr("y", d => d.extent[0][1])
        .attr(
          "width",
          function (d) {
            var e = d.extent;
            return e[1][0] - e[0][0];
          }
        )
        .attr(
          "height",
          function (d) {
            var e = d.extent;
            return e[1][1] - e[0][1];
          }
        )
        .attr("fill", color_for);

    } else { // draw points (the default)
      // get rid of any old region data
      element.selectAll("rect").remove();

      // figure out coloring
      if (color_by === undefined) {
        function color_for(d) {
          return color_scale(d.relative_density);
        }
        function radius_of(d) {
          // TODO: Decide
          //return QT_POINT_RADIUS * (1 + d.relative_density);
          return QT_POINT_RADIUS;
        }
      } else {
        function color_for(d) {
          var items = qt.node_items(d.node);
          var c = 0;
          for (var i = 0; i < items.length; ++i) {
            c += color_by(items[i]);
          }
          c /= items.length;
          return color_scale(c);
        }
        var radius_of = QT_POINT_RADIUS;
      }

      // Just the leaves
      var leaves = rects.filter(rect => rect.is_leaf);
      //*
      element.selectAll("circle").exit().remove();
      element.selectAll("circle")
        .data(leaves)
      .enter().append("circle")
        .attr("class", "point")
        .attr("cx", d => d.centroid[0] || 0)
        .attr("cy", d => d.centroid[1] || 0)
        .attr("r", radius_of)
        .attr("fill", color_for);

      if (labels != undefined) {
        function label_for(d) {
          var items = qt.node_items(d.node);
          if (items.length == 1) {
            return "" + labels(items[0]);
          } else {
            var frequencies = {};
            var winner = undefined;
            for (var i = 0; i < items.length; ++i) {
              var l = "" + labels(items[i]);
              if (frequencies.hasOwnProperty(l)) {
                frequencies[l] += 1;
              } else {
                frequencies[l] = 1;
              }
              if (winner === undefined || frequencies[winner] < frequencies[l]) {
                winner = l;
              }
            }
            var tied = false;
            var count = 0;
            for (var k in frequencies) {
              if (frequencies.hasOwnProperty(k)) {
                if (frequencies[k] == frequencies[winner] && k != winner) {
                  count += 1;
                  tied = true;
                }
              }
            }
            if (tied) {
              return "*";
            } else if (count == 1) {
              return winner;
            } else {
              return winner + "*";
            }
          }
        }
        element.selectAll("text").exit().remove();
        element.selectAll("text")
          .data(leaves)
        .enter().append("text")
          .attr("class", "label")
          .attr("x", d => d.centroid[0])
          .attr("y", d => d.centroid[1])
          .attr("fill", color_for)
          .attr("dominant-baseline", "auto")
          .attr("text-anchor", "start")
          .text(d => label_for(d));
      }
    }
  }

  // Draws a horizontal histogram with value labels on the left, sorting bars
  // by their height. Optional parameters:
  //    bar_limit
  //      Crops off bars beyond the limit. Missing = no limit. A value of
  //      ~30-50 is suggested to avoid text overlap. Can give explicitly as
  //      'undefined' if you want to pass other optional options.
  //    color_scale (defaults to DEFAULT_COLOR_SCALE)
  //      Used to color the bars
  //    normalize
  //      If it's a single value, each count is divided. Pass the number of
  //      source items here to graph averages instead of total counts. Can also
  //      be a map from values to numbers to use a different divisor for each
  //      value. Defaults to 1 (no normalization).
  function draw_histogram(
    element,
    counts,
    bar_limit,
    color_scale,
    sort,
    normalize
  ) {
    if (color_scale === undefined) {
      color_scale = DEFAULT_COLOR_SCALE;
    }

    if (normalize === undefined) {
      normalize = 1;
    }

    if (typeof normalize === "object") {
      function bar_value(value) {
        var nv = normalize[value];
        if (Number.isFinite(nv) && nv != 0) {
          return counts[value] / nv;
        } else {
          return NaN;
        }
      }
      function bar_label(value) {
        return NBSP + prp.format_number(bar_value(value)) +"×"+normalize[value];
      }
    } else {
      function bar_value(value) {
        var nv = normalize;
        if (Number.isFinite(nv) && nv != 0) {
          return counts[value] / nv;
        } else {
          return NaN;
        }
      }
      if (normalize == 1) {
        function bar_label(value) {
          return NBSP + prp.format_number(bar_value(value));
        }
      } else {
        function bar_label(value) {
          return NBSP + prp.format_number(bar_value(value)) + "×" + normalize;
        }
      }
    }

    // clear out any old stuff:
    element.selectAll("*").remove();

    var pairs = [];
    var max = undefined;
    for (var key in counts) {
      if (counts.hasOwnProperty(key)) {
        var bv = bar_value(key);
        pairs.push([key, bv]);
        if (max === undefined || max < bv) {
          max = bv;
        }
      }
    }

    // reverse sort order to put largest bars first
    if (sort) {
      pairs.sort((a, b) => -(a[1] - b[1]));
    } else {
      // TODO: Better domain-based sorting?
      pairs.sort((a, b) => a[0] < b[0] ? -1: 1);
    }

    if (bar_limit != undefined) {
      pairs = pairs.slice(0, bar_limit);
    }

    var eh = element.attr("height"); // element height
    var pad = 0.02 * eh; // 2% padding on top and bottom

    var bh = (eh - 2*pad) / pairs.length; // bar height
    var bpad = 0.03 * bh; // 3% padding for each bar
    var bih = bh - 2*bpad; // bar inner height

    var ew = element.attr("width");
    var bx = ew * 0.25 // 25% for value labels
    var bw = ew * 0.65; // 75% width (save extra 10% for count labels)

    function bar_width(d) {
      if (Number.isFinite(d[1]) && Number.isFinite(max) && max > 0) {
        return bw * (d[1] / max)
      } else {
        return 0;
      }
    }

    var bargroup = element.selectAll("g")
      .data(pairs)
      .enter()
      .append("g")
        .attr("class", "bar_group")
        .attr(
          "transform",
          function(d, i) {
            var y = pad + i * bh;
            return "translate(0," + y + ")"
          }
        );
    bargroup.append("rect") // the bar itself
      .attr("class", "bar")
      .attr("x", bx)
      .attr("y", bpad)
      .attr("width", bar_width)
      .attr("height", bih)
      .attr("fill", function(d) { return color_scale(d[1]/max); });
    bargroup.append("text") // value label before bar
      .attr("class", "label")
      .attr("x", bx)
      .attr("y", bpad + bih/2)
      .attr("dominant-baseline", "middle")
      .attr("text-anchor", "end")
      .text(function(d) { return "" + d[0] + NBSP; });
    bargroup.append("text") // count label at end of bar
      .attr("class", "label")
      .attr("x", function (d) { return bx + bar_width(d) } )
      .attr("y", bpad + bih/2)
      .attr("dominant-baseline", "middle")
      .attr("text-anchor", "start")
      .text(function(d) { return bar_label(d[0]); });
  }

  return {
    "value_sums": value_sums,
    "draw_quadtree": draw_quadtree,
    "draw_histogram": draw_histogram,
  };
});

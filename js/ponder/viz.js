define(["d3/d3", "./utils", "./quadtree"], function (d3, utils, qt) {
  /*
   * Module variables:
   */

  // Resolution at which to cut off quadtree recursion for drawing.
  DEFAULT_MIN_RESOLUTION = 1;

  // Default color scale
  DEFAULT_COLOR_SCALE = d3.interpolateMagma;

  // The non-breaking space character
  NBSP = "\u00A0";

  // The radius of outlier points in a quadtree visualization
  QT_OUTLIER_RADIUS = 1;

  // Radius used for quadtree points when points_allowed is set to undefined.
  QT_POINT_RADIUS = 1.5;

  /*
   * Helper functions
   */

  function format_number(n) {
    if (Number.isInteger(n)) {
      if (n < 100000) {
        return n;
      } else {
        return n.toPrecision(4);
      }
    } else {
      if (n < 10000) {
        return n.toPrecision(4);
      } else {
        return n.toPrecision(3);
      }
    }
  }

  /*
   * Data transformation functions
   */

  // Given an array-of-values or map-of-values->counts field, creates bars for
  // a histogram showing the sum of each value. If 'just_tally' is given with a
  // map field, the map values are ignored and 1 unit is counted for each time
  // a key appears.
  function value_sums(items, field, just_tally) {
    var counts = {};
    for (var i = 0; i < items.length; ++i) { var it = items[i];
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
  // supplied. points_allowed may also be left out, in which case each leaf of
  // the quadtree will draw a single point, and so the quadtree's build-in
  // resolution will be the only limit.
  function draw_quadtree(
    element,
    tree,
    color_scale,
    min_resolution,
    points_allowed
  ) {
    if (color_scale == undefined) {
      color_scale = DEFAULT_COLOR_SCALE;
    }

    if (min_resolution == undefined) {
      min_resolution = DEFAULT_MIN_RESOLUTION;
    }

    // clear out any old stuff:
    element.selectAll("*").remove();

    var text = tree.extent;
    var tw = text[1][0] - text[0][0]
    var th = text[1][1] - text[0][1]
    var tarea = tw * th;
    var low_density_threshold = points_allowed / tarea;

    var rects = qt.density_areas(
      tree,
      min_resolution,
      1/(min_resolution * min_resolution * 4)
    );
    for (var i = 0; i < rects.length; ++i) {
      var r = rects[i];

      var ext = r[0];
      var den = r[1];
      var cen = r[2];
      var node = r[3];

      var abs_den = den[0];
      var rel_den = den[1];

      var x = ext[0][0];
      var y = ext[0][1];
      var w = ext[1][0] - ext[0][0];
      var h = ext[1][1] - ext[0][1];

      // Draw individual points if the density is low enough and we're at a
      // leaf node:
      if (points_allowed == undefined) {
        var c = color_scale(rel_den);
        var x = cen[0];
        var y = cen[1];
        element.append("circle")
          .attr("class", "point")
          .attr("cx", x)
          .attr("cy", y)
          .attr("r", QT_POINT_RADIUS * (1 + rel_den))
          .attr("fill", c);
      } else {
        var c = color_scale(rel_den);
        element.append("rect")
          .attr("class", "density_rectangle")
          .attr("x", x)
          .attr("y", y)
          .attr("width", w)
          .attr("height", h)
          .attr("fill", c);
        if (abs_den < low_density_threshold && node.hasOwnProperty("items")) {
          var pc = color_scale(1.0);
          var items = node.items;
          for (var j = 0; j < items.length; ++j) {
            var it = items[j];
            var x = tree.getx(it);
            var y = tree.gety(it);
            element.append("circle")
              .attr("class", "point")
              .attr("cx", x)
              .attr("cy", y)
              .attr("r", QT_OUTLIER_RADIUS)
              .attr("fill", pc);
          }
        }
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
  function draw_histogram(element, counts, bar_limit, color_scale, normalize) {
    if (color_scale == undefined) {
      color_scale = DEFAULT_COLOR_SCALE;
    }

    if (normalize == undefined) {
      normalize = 1;
    }

    if (typeof normalize === "object") {
      function bar_value(value) {
        return counts[value] / normalize[value];
      }
      function bar_label(value) {
        return NBSP + format_number(bar_value(value)) + "×" + normalize[value];
      }
    } else {
      function bar_value(value) {
        return counts[value] / normalize;
      }
      if (normalize == 1) {
        function bar_label(value) {
          return NBSP + format_number(bar_value(value));
        }
      } else {
        function bar_label(value) {
          return NBSP + format_number(bar_value(value)) + "×" + normalize;
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
        if (max == undefined || max < bv) {
          max = bv;
        }
      }
    }

    // reverse sort order to put largest bars first
    pairs.sort(function (a, b) { return -(a[1] - b[1]); });

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
      .attr("width", function (d) { return bw * (d[1] / max) } )
      .attr("height", bih)
      .attr("fill", function(d) { return color_scale(d[1]/max); });
    bargroup.append("text") // value label before bar
      .attr("class", "label")
      .attr("x", bx)
      .attr("y", bpad + bih/2)
      .attr("dominant-baseline", "middle")
      .style("text-anchor", "end")
      .text(function(d) { return "" + d[0] + NBSP; });
    bargroup.append("text") // count label at end of bar
      .attr("class", "label")
      .attr("x", function (d) { return bx + bw * (d[1] / max) } )
      .attr("y", bpad + bih/2)
      .attr("dominant-baseline", "middle")
      .style("text-anchor", "start")
      .text(function(d) { return bar_label(d[0]); });
  }

  return {
    "value_sums": value_sums,
    "draw_quadtree": draw_quadtree,
    "draw_histogram": draw_histogram,
  };
});

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

  // Computes a table layout with room at the top and left for the given
  // labels. The default padding (surrounding the whole table) is 0.02, while
  // the default margins are 0.15 each. Returns an object with the following
  // fields:
  //
  //   padding:
  //     Padding amount on all sides. By default 0.02 * min(width, height).
  //   cl_height:
  //     Height reserved for column labels.
  //   rl_width:
  //     Width reserved for row labels.
  //   content_top:
  //     Distance from outer border to top of content (padding + cl_height).
  //   content_left:
  //     Distance from border to left edge of content (padding + rl_width).
  //   content_width,
  //   content_height:
  //     Width and height of content area.
  //   cell_width,
  //   cell_height:
  //     Width and height of content cells.
  //   cl_font_size,
  //   rl_font_size:
  //     Font size TODO!strings for the column and row labels.
  //   cell_font_size:
  //     Font size for the cells.
  //     TODO: HERE!
  function compute_layout(
    row_labels,
    col_labels,
    padding,
    row_margin,
    col_margin
  ) {
    if (padding == undefined) {
      padding = 0.02;
    }

    var n_rows = row_labels.length;
    var n_cols = col_labels.length;

    var eh = element.attr("height"); // element height
    var ew = element.attr("width"); // element width

    var pad = padding * Math.min(eh, ew);

    var cl_height;
    if (n_cols > 0) {
      cl_height = 0.15 * eh; // starting value
    } else {
      cl_height = 0;
    }
    var rl_width;
    if (n_rows > 0) {
      rl_width = 0.15 * ew; // starting value
    } else {
      rl_width = 0;
    }

    var ch; // cell height
    if (n_rows > 0) {
      ch = (eh - 2*pad - cl_height) / n_rows;
    } else {
      ch = eh - 2*pad - cl_height;
    }
    var rl_font_size = (ch * 0.96) + "px";

    var cw; // cell width
    if (n_cols > 0) {
      cw = (ew - 2*pad - rl_width) / n_cols;
    } else {
      cw = (ew - 2*pad - rl_width);
    }
    var cl_font_size = (cw * 0.96) + "px";
  }

  function compute_labeled_layout(row_labels, col_labels, padding) {
    while (true) { // iterate to convergence
      // evaluate space requirements at current font size:
      var required_width = undefined;
      var required_height = undefined;
      for (let i = 0; i < n_rows; ++i) {
        var lt = row_labels[i];
        var ts = utils.get_text_size(lt, rl_font_size);
        if (required_width == undefined || required_width < ts.width) {
          required_width = ts.width;
        }
      }
      for (let i = 0; i < n_cols; ++i) {
        var lt = col_labels[i];
        var ts = utils.get_text_size(lt, cl_font_size);
        if (required_height == undefined || required_height < ts.height) {
          required_height = ts.height;
        }
      }

      //if (required_width < 
      // TODO: HERE
    }
  }

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
  // over results for each point within a region). The special values "density"
  // and "standardized" will use relative or standardized density values from
  // the tree. The combination of color_by and as_rects = true may be slow.
  // Note that when color_by is not given and as_rects is off, the point size
  // scales slightly with density to somewhat enhance perceptual accuracy of
  // density among points, although of course there's still some distortion.
  // This size scaling is disabled when color_by is given. Use as_rects for a
  // less-biased view of density. The labels argument can be given to supply
  // labels for each item, but should usually only be used when the data is
  // sparse. Labels from multiple items are combined according to a
  // most-frequent scheme, and an asterisk is appended if the labels being
  // combined aren't all identical. If there's a tie for most-frequent, just an
  // asterisk is used. Labels are ignored completely when as_rects is true.
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

    if (color_by === undefined) {
      color_by = "density";
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
      if (color_by === "density") {
        function color_for(d) {
          return color_scale(d.relative_density);
        }
      } else if (color_by === "standardized") {
        function color_for(d) {
          return color_scale(d.standard_density);
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
      if (color_by === "density") {
        function color_for(d) {
          return color_scale(d.relative_density);
        }
      } else if (color_by === "standardized") {
        function color_for(d) {
          return color_scale(d.standard_density);
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
        .attr("r", QT_POINT_RADIUS)
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
                count += 1;
                if (frequencies[k] == frequencies[winner] && k != winner) {
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
          .attr("x", d => d.centroid[0] + 3)
          .attr("y", d => d.centroid[1] - 3)
          .attr("fill", color_for)
          .attr("dominant-baseline", "auto")
          .attr("text-anchor", "start")
          .text(d => label_for(d));
      }
    }
  }

  // Draws a horizontal histogram with value labels on the left, sorting bars
  // by their height. Optional parameters:
  //    ordering
  //      Specifies the natural ordering of the bins (ignored if sort is
  //      given).
  //    bar_limit
  //      Crops off bars beyond the limit. Missing = no limit. A value of
  //      ~30-50 is suggested to avoid text overlap. Can give explicitly as
  //      'undefined' if you want to pass other optional options.
  //    color_scale (defaults to DEFAULT_COLOR_SCALE)
  //      Used to color the bars
  //    sort
  //      Sort the bars by their values from highest to lowest.
  //    normalize
  //      If it's a single value, each count is divided. Pass the number of
  //      source items here to graph averages instead of total counts. Can also
  //      be a map from values to numbers to use a different divisor for each
  //      value. Defaults to 1 (no normalization).
  function draw_histogram(
    element,
    counts,
    ordering,
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
        return "" + prp.format_number(bar_value(value)) +"×"+normalize[value];
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
          return "" + prp.format_number(bar_value(value));
        }
      } else {
        function bar_label(value) {
          return "" + prp.format_number(bar_value(value)) + "×" + normalize;
        }
      }
    }

    // clear out any old stuff:
    element.selectAll("*").remove();

    var pairs = [];
    var min = undefined;
    var max = undefined;
    var iterate_over = ordering || Object.keys(counts);
    for (let i = 0; i < iterate_over.length; ++i) {
      var key = iterate_over[i];
      if (counts.hasOwnProperty(key)) {
        var bv = bar_value(key);
        pairs.push([key, bv]);
        if (max === undefined || max < bv) {
          max = bv;
        }
        if (min === undefined || min > bv) {
          min = bv;
        }
      }
    }

    if (sort) {
      // reverse sort order to put largest bars first
      pairs.sort((a, b) => -(a[1] - b[1]));
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
    var lx = ew * 0.25 // 25% for value labels
    var bx;
    var bw;

    // set min to 0 if it's larger than 0, and provide extra space for labels
    // on the left:
    if (min > 0) {
      min = 0;
      bx = ew * 0.25 // 25% for value labels
      bw = ew * 0.65; // 75% width (save extra 10% for count labels)
    } else {
      bx = ew * 0.35 // 25% for value labels + 10% for left-hand counts
      bw = ew * 0.55; // 65% width (extra 10% for right-hand counts)
    }


    // x-value for zero
    var zero_x = bx + bw * (0 - min) / (max - min)

    function bar_width(d) {
      if (
        Number.isFinite(d[1])
     && Number.isFinite(max)
     && Number.isFinite(min)
     && max > min
      ) {
        return bw * Math.abs(d[1]) / (max - min);
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
      .attr("x", d => (d[1] >= 0 ? zero_x : zero_x - bar_width(d)))
      .attr("y", bpad)
      .attr("width", bar_width)
      .attr("height", bih)
      .attr("fill", function(d) { return color_scale(d[1]/max); });
    bargroup.append("text") // value label before bar
      .attr("class", "label")
      .attr("x", lx)
      .attr("y", bpad + bih/2)
      .attr("dominant-baseline", "middle")
      .attr("text-anchor", "end")
      .text(function(d) { return "" + d[0] + NBSP; });
    bargroup.append("text") // count label at end of bar
      .attr("class", "label")
      .attr(
        "x",
        d => d[1] >= 0 ? zero_x + bar_width(d) : zero_x - bar_width(d)
      )
      .attr("y", bpad + bih/2)
      .attr("dominant-baseline", "middle")
      .attr("text-anchor", d => d[1] >= 0 ? "start" : "end")
      .text(d => d[1] >= 0 ? NBSP + bar_label(d[0]) : bar_label(d[0]) + NBSP);
  }

  // Draws a matrix with row and column labels, where each cell displays a
  // color according to the value from a matrix. If label color isn't given,
  // labels aren't shown; the default missing color is white.
  function draw_matrix(
    element,
    matrix,
    counts,
    stdevs,
    val_domain,
    col_labels,
    row_labels,
    color_scale,
    missing_color,
    label_color,
  ) {
    if (color_scale === undefined) {
      color_scale = DEFAULT_COLOR_SCALE;
    }

    missing_color = missing_color || "#ffffff";

    if (val_domain == undefined) {
      var lower = 0;
      var upper = 1;
    } else {
      var lower = val_domain[0];
      var upper = val_domain[1];
    }

    function nv(val) {
      if (lower == upper) {
        return val;
      } else {
        return (val - lower) / (upper - lower);
      }
    }

    // clear out any old stuff:
    element.selectAll("*").remove();

    var items = [];
    var n_cols = matrix.length;
    var n_rows = 0;
    for (let c = 0; c < matrix.length; ++c) {
      if (matrix[c] != undefined) {
        for (let r = 0; r < matrix[c].length; ++r) {
          if (r+1 > n_rows) {
            n_rows = r+1;
          }
          var val = matrix[c][r];
          items.push([[c, r], val, nv(val)]);
        }
      }
    }

    var eh = element.attr("height"); // element height
    var vpad = 0.02 * eh; // 2% padding on top and bottom
    var vlbls = 0.15 * eh; // 15% for labels

    var ch; // cell height
    if (n_rows > 0) {
      ch = (eh - 2*vpad - vlbls) / n_rows;
    } else {
      ch = eh - 2*vpad - vlbls;
    }
    var cvpad = 0.03 * ch; // 3% padding for each cell
    var cih = ch - 2*cvpad; // bar inner height

    var ew = element.attr("width"); // element width
    var hpad = 0.02 * eh; // 2% padding on sides
    var hlbls = 0.15 * eh; // 15% for labels

    var cw; // cell width
    if (n_cols > 0) {
      cw = (ew - 2*hpad - hlbls) / n_cols;
    } else {
      cw = (ew - 2*hpad - hlbls);
    }
    var chpad = 0.03 * cw; // 3% padding for each cell
    var ciw = cw - 2*chpad; // bar inner height

    element.selectAll("text.row") // row label at left
      .data(row_labels)
    .enter().append("text")
      .attr("class", "row label")
      .attr("x", hpad + hlbls)
      .attr("y", (d, i) => vpad + vlbls + i * ch + ch/2)
      .attr("dominant-baseline", "middle")
      .attr("text-anchor", "end")
      .attr("font-size", Math.min(18, cih) + "px")
      .text(d => d + NBSP);

    element.selectAll("text.column")
      .data(col_labels)
    .enter().append("text")
      .attr("class", "column label")
      .attr("x", 0)
      .attr("y", 0)
      .attr("transform", function (d, i) {
        var x = hpad + hlbls + i * cw + cw/2;
        var y = vpad + vlbls;
        return "translate(" + x + "," + y + "), rotate(90)";
      })
      .attr("dominant-baseline", "middle")
      .attr("text-anchor", "end")
      .attr("font-size", Math.min(18, ciw) + "px")
      .text(d => d + NBSP);

    var cellgroup = element.selectAll("g")
      .data(items)
    .enter().append("g")
      .attr("class", "cell_group")
      .attr(
        "transform",
        function(d) {
          var c = d[0][0];
          var r = d[0][1];
          var x = hpad + hlbls + c * cw;
          var y = vpad + vlbls + r * ch;
          return "translate(" + x + "," + y + ")"
        }
      );
    cellgroup.append("rect") // the cell itself
      .attr("class", "bar")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", cw)
      .attr("height", ch)
      .attr("fill", function(d) {
        var val = d[2];
        if (val == undefined || Number.isNaN(val)) {
          return missing_color;
        } else {
          return color_scale(val);
        }
      });
    if (label_color != undefined) {
      cellgroup.append("text") // value label inside cell
        .attr("class", "label")
        .attr("x", cw/2)
        .attr("y", ch/2)
        .attr("font-size", Math.min(18, cih) + "px")
        .attr("dominant-baseline", "middle")
        .attr("text-anchor", "middle")
        .text(function(d) { return prp.format_number(d[1], "∙"); });
    }
  }

  return {
    "value_sums": value_sums,
    "draw_quadtree": draw_quadtree,
    "draw_histogram": draw_histogram,
    "draw_matrix": draw_matrix,
  };
});

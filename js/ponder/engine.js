define(
[
  "d3",
  "d3-scale-chromatic",
  "./utils",
  "./dataset",
  "./view",
  "./quadtree",
  "./viz",
  "./properties"
],
function (d3, d3sc, utils, ds, vw, qt, viz, prp) {
  /*
   * Module variables:
   */

  // Milliseconds to wait during active polling.
  var THUNK_MS = 75;

  // The current dataset
  var DATA;

  // Attributes extracted from the current dataset 
  var PROPERTIES;
  // Map from index strings to attribute entries
  var INDEX_MAP = {};

  // Whether to use density rectangles or point approximations
  var SHOW_DENSITY = false;

  // Which attributes to use for x- and y-axes:
  var X_INDEX = undefined;
  var Y_INDEX = undefined;
  // The domains of those attributes
  var X_DOMAIN = undefined;
  var Y_DOMAIN = undefined;

  // What to use for labels
  var LABEL_INDEX = undefined;

  // Spatial resolution constraints (in screen pixels):
  var MIN_RADIUS = 0.5; // how small the lens can be
  var MIN_REGION_SIDE = 1; // when to stop building quadtree
  var MAX_REGION_DISTORTION = 8; // when to rebuild quadtree
  var VIZ_RESOLUTION = 1; // min pixels per visualization unit

  // Visualization limits
  var HIST_BAR_LIMIT = 30; // max # of bars

  // Which property to use for point colors
  var COLOR_BY = undefined;
  var COLOR_DOMAIN = undefined;

  // Mouse scroll correction factors:
  var PIXELS_PER_LINE = 18;
  var LINES_PER_PAGE = 40;
  var SCROLL_FACTOR = 10; // pixels of scroll per 1% radius adjust

  // Max # of values to show during preprocessing
  var MAX_SHOW_VALUES = 6;

  // Margin inside SVG:
  var MARGIN = 30;

  // Padding in the domain (% of normal range)
  var DPAD = 0.05;

  // Selections
  var HOVERED;
  var SELECTED;

  // The current view for the left window
  var LEFT_VIEW;

  // Scales
  var LEFT_X_SCALE;
  var LEFT_Y_SCALE;
  var RIGHT_X_SCALE;
  var RIGHT_Y_SCALE;

  // DOM objects
  var LEFT_WINDOW;
  var RIGHT_WINDOW;
  var LEFT_CONTROLS;
  var RIGHT_CONTROLS;

  // Whether windows have been constructed yet
  var LEFT_WINDOW_READY = false;
  var RIGHT_WINDOW_READY = false;

  // The lens circle & shadow
  var LENS;
  var SHADOW;

  // Color transforms
  var LEFT_COLOR_SCALE;
  var LEFT_START_COLOR;
  var LEFT_END_COLOR;
  var LEFT_GRADIENT = undefined;
  var RIGHT_COLOR_SCALE;
  var RIGHT_START_COLOR = d3.rgb(193, 201, 248);
  var RIGHT_END_COLOR = d3.rgb(0, 8, 52);
  var COLOR_VALUE;

  // Preset gradients
  var CAT_SCHEMES = [
    [ "cat10", d3sc.schemeCategory10 ],
    [ "accent", d3sc.schemeAccent ],
    [ "dark2", d3sc.schemeDark2 ],
    [ "paired", d3sc.schemePaired ],
    [ "pastel1", d3sc.schemePastel1 ],
    [ "pastel2", d3sc.schemePastel2 ],
    [ "set1", d3sc.schemeSet1 ],
    [ "set2", d3sc.schemeSet2 ],
    [ "set3", d3sc.schemeSet3 ],
  ];
  var DV_GRADIENTS = [
    [ "brbg", d3sc.interpolateBrBG ],
    [ "prgn", d3sc.interpolatePRGn ],
    [ "piyg", d3sc.interpolatePiYG ],
    [ "puor", d3sc.interpolatePuOr ],
    [ "rdbu", d3sc.interpolateRdBu ],
    [ "rdgy", d3sc.interpolateRdGy ],
    [ "rdlybu", d3sc.interpolateRdYlBu ],
    [ "rdylgn", d3sc.interpolateRdYlGn ],
    [ "spectral", d3sc.interpolateSpectral ],
  ];
  var SQ_GRADIENTS = [
    [ "gr", d3sc.interpolateGreys ],
    [ "ge", d3sc.interpolateGreens ],
    [ "or", d3sc.interpolateOranges ],
    [ "rd", d3sc.interpolateReds ],
    [ "pu", d3sc.interpolatePurples ],
    [ "bu", d3sc.interpolateBlues ],
    [ "viridis", d3sc.interpolateViridis ],
    [ "inferno", d3sc.interpolateInferno ],
    [ "magma", d3sc.interpolateMagma ],
    [ "plasma", d3sc.interpolatePlasma ],
    [ "warm", d3sc.interpolateWarm ],
    [ "cubehelix", d3sc.interpolateCubehelixDefault ],
    [ "ylgn", d3sc.interpolateYlGn ],
    [ "gnbu", d3sc.interpolateGnBu ],
    [ "pubu", d3sc.interpolatePuBu ],
    [ "purd", d3sc.interpolatePuRd ],
    [ "rdpu", d3sc.interpolateRdPu ],
    [ "orrd", d3sc.interpolateOrRd ],
    [ "pubugn", d3sc.interpolatePuBuGn ],
    [ "ylgnbu", d3sc.interpolateYlGnBu ],
    [ "ylorrd", d3sc.interpolateYlOrRd ],
  ];
  var CYC_GRADIENTS = [
    [ "rainbow", d3sc.interpolateRainbow ],
  ];
  // List of all possible gradient types
  var GTYPES = [
    CAT_SCHEMES,
    DV_GRADIENTS,
    SQ_GRADIENTS,
    CYC_GRADIENTS
  ];

  /*
   * Helper functions
   */

  function x_value(d) {
    var val = prp.get_value(d, X_INDEX);
    if (val == undefined) {
      return 0;
    } else {
      return val;
    }
  };
  function y_value(d) {
    var val = prp.get_value(d, Y_INDEX);
    if (val == undefined) {
      return 0;
    } else {
      return val;
    }
  }

  function get_left_extent() {
    var xr = LEFT_X_SCALE.range();
    var yr = LEFT_Y_SCALE.range();
    return [
      [ xr[0], yr[1] ],
      [ xr[1], yr[0] ],
    ];
  }

  function get_right_extent() {
    var xr = RIGHT_X_SCALE.range();
    var yr = RIGHT_Y_SCALE.range();
    return [
      [ xr[0], yr[1] ],
      [ xr[1], yr[0] ],
    ];
  }

  /*
   * Core functions
   */

  function get_items_in_circle(tree, cx, cy, r) {
    var region = [[cx - r, cy - r], [cx + r, cy + r]]
    var candidates = qt.in_region(
      tree,
      region
    );
    var selected = [];
    for (var i = 0; i < candidates.length; ++i) {
      var it = candidates[i];
      var x = tree.getx(it);
      var y = tree.gety(it);
      var dx = x - cx;
      var dy = y - cy;
      if (Math.sqrt(dx * dx + dy * dy) <= r) {
        selected.push(it);
      }
    }
    return selected;
  }

  function update_hovered() {
    var cx = utils.get_n_attr(SHADOW, "cx");
    var cy = utils.get_n_attr(SHADOW, "cy");
    var r = utils.get_n_attr(SHADOW, "r");
    HOVERED = get_items_in_circle(QUADTREE, cx, cy, r);
  }

  function update_selected() {
    if (LENS == undefined) {
      SELECTED = [];
    } else {
      var cx = utils.get_n_attr(LENS, "cx");
      var cy = utils.get_n_attr(LENS, "cy");
      var r = utils.get_n_attr(LENS, "r");
      SELECTED = get_items_in_circle(QUADTREE, cx, cy, r);
    }
  }

  // Rebuilds the quadtree using the current DATA. X_INDEX and Y_INDEX globals
  // control how X and Y values are derived.
  function rebuild_quadtree() {
    function getx(d) { return LEFT_X_SCALE(x_value(d)); };
    function gety(d) { return LEFT_Y_SCALE(y_value(d)); };
    QUADTREE = qt.build_quadtree(
      DATA,
      get_left_extent(),
      getx,
      gety,
      MIN_REGION_SIDE
    );
  }

  function update_left_window() {
    if (!LEFT_WINDOW_READY) { return; }

    update_left_range();

    if (LENS != undefined) {
      var lens_x = utils.get_n_attr(LENS, "cx");
      var lens_y = utils.get_n_attr(LENS, "cy");
      var lens_r = utils.get_n_attr(LENS, "r");
    } else {
      var lens_x = 70;
      var lens_y = 70;
      var lens_r = 20;
    }
    if (SHADOW != undefined) {
      var shadow_x = utils.get_n_attr(SHADOW, "cx");
      var shadow_y = utils.get_n_attr(SHADOW, "cy");
      var shadow_r = utils.get_n_attr(SHADOW, "r");
    } else {
      var shadow_x = 70;
      var shadow_y = 70;
      var shadow_r = 20;
    }

    // Draw the quadtree:
    var dplot = d3.select("#qt_density");
    dplot.selectAll("*").remove();
    var color_by;
    if (COLOR_BY == undefined) {
      color_by = undefined;
    } else {
      color_by = COLOR_VALUE;
    }
    var labels;
    if (LABEL_INDEX == undefined) {
      var labels = undefined
    } else {
      labels = function (d) {
        return prp.get_value(d, LABEL_INDEX);
      }
    }
    viz.draw_quadtree(
      dplot,
      QUADTREE,
      LEFT_COLOR_SCALE,
      VIZ_RESOLUTION,
      SHOW_DENSITY,
      color_by,
      labels
    );

    // Add lenses last!
    dplot.append("g")
      .attr("id", "lens_group");

    // TODO: Disentangle these!
    LENS = d3.select("#lens_group").append("circle")
      .attr("id", "lens")
      .attr("cx", lens_x)
      .attr("cy", lens_y)
      .attr("r", lens_r)
      .attr("z-index", "10");

    SHADOW = d3.select("#lens_group").append("circle")
      .attr("id", "lens_shadow")
      .attr("cx", shadow_x)
      .attr("cy", shadow_y)
      .attr("r", shadow_r)
      .attr("z-index", "10");
  }

  function update_right_window() {
    if (!RIGHT_WINDOW_READY) { return; }
    // Collect items:
    var items = SELECTED;

    RIGHT_CONTROLS.selectAll("#sel_count")
      .text(SELECTED.length + " items selected");

    // TODO: Give user control over which info & how?
    // Extract & transform data:
    //var counts = viz.value_sums(items, "stuff");
    //var normalize = viz.value_sums(items, "stuff", true); // just tally
    //var counts = viz.value_sums(items, "activity");
    //var normalize = viz.value_sums(items, "activity", true); // just tally
    var counts = viz.value_sums(items, "purchased");
    var normalize = viz.value_sums(items, "purchased", true); // just tally

    // Display info:
    viz.draw_histogram(
      d3.select("#details_graph"),
      counts,
      HIST_BAR_LIMIT,
      function(t) { return RIGHT_COLOR_SCALE(t); },
      //1
      items.length
      //normalize
    );
  }

  /*
   * Event handlers
   */

  function resize() {
    LEFT_X_SCALE.range([0, utils.get_width(LEFT_WINDOW) - 2*MARGIN]);
    LEFT_Y_SCALE.range([utils.get_height(LEFT_WINDOW) - 2*MARGIN, 0]);
    RIGHT_X_SCALE.range([0, utils.get_width(RIGHT_WINDOW) - 2*MARGIN]);
    RIGHT_Y_SCALE.range([utils.get_height(RIGHT_WINDOW) - 2*MARGIN, 0]);
    update_left_window();
    update_right_window();
  }

  function left_motion() {
    var coords = d3.mouse(this);

    if (SHADOW != undefined) {
      SHADOW.attr("cx", coords[0] - MARGIN);
      SHADOW.attr("cy", coords[1] - MARGIN);
    }
  }

  function left_click() {
    if (LENS != undefined) {
      // Update the lens
      LENS.attr("cx", SHADOW.attr("cx"));
      LENS.attr("cy", SHADOW.attr("cy"));
      LENS.attr("r", SHADOW.attr("r"));

      // Update selection & right window
      update_selected();
      update_right_window();
      // TODO: Not this! (DEBUG)
      update_left_window();
    }
  }

  function left_scroll() {
    var e = d3.event;
    e.preventDefault();

    var unit = e.deltaMode;
    var dx = e.deltaX;
    var dy = e.deltaY;

    if (unit == 1) {
      dx *= PIXELS_PER_LINE;
      dy *= PIXELS_PER_LINE;
    } else if (unit == 2) {
      dx *= PIXELS_PER_LINE * LINES_PER_PAGE;
      dy *= PIXELS_PER_LINE * LINES_PER_PAGE;
    }

    if (SHADOW != undefined) {
      var r = utils.get_n_attr(SHADOW, "r");
      r *= (1 + 0.01 * dy / SCROLL_FACTOR);
      if (r < MIN_RADIUS) {
        r = MIN_RADIUS;
      }
      SHADOW.attr("r", r);
    }
  }

  function file_chosen() {
    setTimeout(eventually_process_uploaded_file, 50, d3.select(this));
  }

  function pre_file_chosen() {
    d3.select("#export_button").attr("disabled", true);
    d3.select("#download_button").attr("disabled", true);
    d3.select("#download_link").attr("href", "");
    d3.select("#names_table")
      .style("display", "none")
      .selectAll("tbody>tr").remove();
    d3.select("#output_bin")
      .attr("disabled", true)
      .text("");
    setTimeout(eventually_preprocess_uploaded_file, 50, d3.select(this));
  }

  function eventually_process_uploaded_file(element) {
    var files = element.node().files;
    if (files === null || files === undefined || files.length < 1) {
      setTimeout(eventually_process_uploaded_file, THUNK_MS, element);
    } else {
      var first = files[0];
      var fr = new FileReader();
      fr.onload = function (e) {
        var file_text = e.target.result;
        // TODO: Multiple formats?!?
        var json = JSON.parse(file_text);
        populate_data(json);
      };
      fr.readAsText(first);
    }
  }

  function eventually_preprocess_uploaded_file(element) {
    var files = element.node().files;
    if (files === null || files === undefined || files.length < 1) {
      setTimeout(eventually_preprocess_uploaded_file, THUNK_MS, element);
    } else {
      var first = files[0];
      var fr = new FileReader();
      fr.onload = function (e) {
        var file_text = e.target.result;
        // TODO: Multiple formats?!?
        var json = JSON.parse(file_text);
        preprocess_data(json);
      };
      fr.readAsText(first);
    }
  }

  function density_box_checked() {
    SHOW_DENSITY = !this.checked;
    update_left_window();
  }

  function left_cattr_selected() {
    var val = utils.get_selected_value(this);
    if (val == "density") {
      COLOR_BY = undefined;
      COLOR_DOMAIN = undefined;
    } else {
      var entry = INDEX_MAP[val];
      COLOR_BY = entry[0];
      COLOR_DOMAIN = entry[1];
    }
    update_left_window();
  }

  function left_start_color_selected() {
    LEFT_START_COLOR = this.value;
    update_left_window();
  }

  function left_end_color_selected() {
    LEFT_END_COLOR = this.value;
    update_left_window();
  }

  function left_gradient_selected() {
    var val = utils.get_selected_value(this);
    if (val === "custom") {
      LEFT_GRADIENT = d3.interpolateCubehelix(LEFT_START_COLOR, LEFT_END_COLOR);
      LEFT_COLOR_SCALE = t => LEFT_GRADIENT(t);
      d3.select("#left_gradient_demo")
        .style("background", utils.css_gradient("to right", LEFT_GRADIENT));
      d3.select("#left_custom_gradient").style("display", "inline");
    } else {
      d3.select("#left_custom_gradient").style("display", "none");
      var selected = undefined;
      for (var i = 0; i < GTYPES.length; ++i) {
        var gt = GTYPES[i];
        for (var j = 0; j < gt.length; ++j) {
          var opt = gt[j];
          if (opt[0] === val) {
            selected = opt;
            break;
          }
        }
        if (selected != undefined) {
          break;
        }
      }

      if (selected == undefined) {
        console.error("Invaild gradient selection: '" + val + "'");
        LEFT_GRADIENT = d3.interpolateCubehelix(
          LEFT_START_COLOR,
          LEFT_END_COLOR
        );
        LEFT_COLOR_SCALE = t => LEFT_GRADIENT(t);
        d3.select("#left_gradient_demo")
          .style("background", utils.css_gradient("to right", LEFT_GRADIENT));
      } else {
        // TODO: Legend?!?
        LEFT_GRADIENT = selected[1];
        if (Array.isArray(LEFT_GRADIENT)) {
          LEFT_COLOR_SCALE = function(t) {
            var i = Math.floor(t);
            // TODO: Cycle instead of clamp?
            if (i < 0) { i = 0; }
            if (i > LEFT_GRADIENT.length - 1) { i = LEFT_GRADIENT.length - 1; }
            return LEFT_GRADIENT[i];
          };
          d3.select("#left_gradient_demo")
            .style("background", utils.css_scheme("to right", LEFT_GRADIENT));
        } else {
          LEFT_COLOR_SCALE = t => LEFT_GRADIENT(t);
          d3.select("#left_gradient_demo")
            .style("background", utils.css_gradient("to right", LEFT_GRADIENT));
        }
      }
    }
    update_left_window();
  }

  function left_x_selected() {
    var val = this.value;
    var entry = INDEX_MAP[val];
    X_INDEX = entry[0];
    X_DOMAIN = entry[1];
    update_left_range();

    rebuild_quadtree();

    update_left_window();
  }

  function left_y_selected() {
    var val = this.value;
    var entry = INDEX_MAP[val];
    Y_INDEX = entry[0];
    Y_DOMAIN = entry[1];

    rebuild_quadtree();

    update_left_window();
  }

  function left_label_selected() {
    var val = this.value;
    if (val === "none") {
      LABEL_INDEX = undefined;
    } else {
      var entry = INDEX_MAP[val];
      LABEL_INDEX = entry[0];
    }

    update_left_window();
  }

  function set_names(dataset) {
    var np = d3.select("#names_panel");
    var nrows = np.select("table>tbody>tr");
    nrows.each(function (d) {
      var row = d3.select(this);
      var ai = row.select(".alias_input");
      var skey = ai.attr("id").slice(5);
      var sval = ai.attr("value");
      if (sval != undefined && sval != "") {
        dataset.aliases[skey] = sval;
      }
    })
    
    var pkg = JSON.stringify(dataset);

    d3.select("#output_bin")
      .attr("disabled", null)
      .text(pkg)
      .on("click touchstart", function () { this.select(); });

    d3.select("#download_button")
      .attr("disabled", null)
      .on(
        "mousedown touchstart",
        function () {
          var link = d3.select("#download_link");
          link.attr(
            "href",
            "data:text/json;charset=utf-8," + encodeURIComponent(pkg)
          )
          .attr("download", "data.json");
          // TODO: Use original name?
        }
      );
  }

  /*
   * Setup functions
   */

  // Called after data is loaded
  function populate_data(data) {
    LEFT_START_COLOR = d3.select("#left_start_color").attr("value");
    LEFT_END_COLOR = d3.select("#left_end_color").attr("value");

    resize();

    // Set global
    DATA = data;

    // Update controls
    update_controls(data);

    // Rebuild the quadtree
    rebuild_quadtree();

    // Update the selection
    update_selected();

    // Reset right window:
    RIGHT_WINDOW.selectAll("*").remove();

    // the details_graph shows details on the contents of the lens
    RIGHT_WINDOW.append("g")
      .attr("id", "details_graph")
      .attr("class", "graph")
      .attr(
        "transform",
        "translate(" + MARGIN + "," + MARGIN + ")"
      )
      .attr("width", utils.get_width(RIGHT_WINDOW) - 2*MARGIN)
      .attr("height", utils.get_height(RIGHT_WINDOW) - 2*MARGIN);

    RIGHT_WINDOW_READY = true;

    // Update the right window using the starting lens
    update_right_window();
  }

  function preprocess_data(data) {
    var np = d3.select("#names_panel");
    np.select("#loading_message").style("display", "block");

    window.setTimeout(function () {
      var dataset = ds.preprocess_data(data);

      var ntb = np.select("table>tbody");
      ntb.selectAll("tr").exit().remove();
      var newrow = ntb.selectAll("tr")
          .data(dataset.indices)
        .enter().append("tr");
      newrow.append("td")
        .attr("class", "attr_index")
        .text(d => prp.index__string(d));
      newrow.append("td")
        .attr("class", "attr_type")
        .text(d => prp.format_type(ds.get_type(dataset, d)));
      newrow.append("td")
        .attr("class", "attr_alias")
        .append("input")
          .attr("type", "text")
          .attr("class", "alias_input")
          .attr("id", d=> "alias" + prp.index__string(d))
          .attr("value", function(d) {
            let si = prp.index__string(d);
            if (dataset.aliases.hasOwnProperty(si)) {
              return dataset.aliases[si];
            } else {
              return "";
            }
          });
      newrow.append("td")
        .attr("class", "attr_domain")
        .text(function (d) {
          let si = prp.index__string(d);
          if (dataset.domains.hasOwnProperty(si)) {
            let dom = dataset.domains[si];
            if (dom === undefined) {
              return ""
            } else if (Array.isArray(dom)) {
              return (
                "" + prp.format_number(dom[0]) + "–" + prp.format_number(dom[1])
              );
            } else {
              var keys = Object.keys(dom);
              var count = keys.length;
              if (count <= MAX_SHOW_VALUES) {
                var result = ""
                for (let i = 0; i < count; ++i) {
                  let k = keys[i];
                  let c = dom[k];
                  result += k + "×" + prp.format_number(c);
                  if (i < count - 1) {
                    result += ", ";
                  }
                }
                return result;
              } else {
                return "<" + prp.format_number(count) + " values>";
              }
            }
          } else {
            return "";
          }
        });

      np.select("#names_table").style("display", "table");
      np.select("#loading_message").style("display", "none");
      np.select("#export_button")
        .attr("disabled", null)
        .on("click touchstart", function () { set_names(dataset); });
    }, 0);
  }

  // Updates the ranges of the left-hand plot
  function update_left_range() {
    var xd = X_DOMAIN;
    var xmin, xmax, ymin, ymax;
    if (X_DOMAIN == undefined) {
      xmin = -1;
      xmax = 1;
    } else {
      if (X_DOMAIN instanceof Set) {
        xmin = 0;
        xmax = X_DOMAIN.size;
      } else {
        xmin = X_DOMAIN[0];
        xmax = X_DOMAIN[1];
      }
    }
    if (Y_DOMAIN == undefined) {
      ymin = -1;
      ymax = 1;
    } else {
      if (Y_DOMAIN instanceof Set) {
        ymin = 0;
        ymax = Y_DOMAIN.size;
      } else {
        ymin = Y_DOMAIN[0];
        ymax = Y_DOMAIN[1];
      }
    }
    var xr = xmax - xmin;
    var yr = ymax - ymin;
    LEFT_X_SCALE.domain([xmin - DPAD * xr, xmax + DPAD * xr]);
    LEFT_Y_SCALE.domain([ymin - DPAD * yr, ymax + DPAD * yr]);

    d3.select("#left_x_axis")
      .call(d3.axisBottom(LEFT_X_SCALE));

    d3.select("#left_y_axis")
      .call(d3.axisLeft(LEFT_Y_SCALE));
  }

  // Updates things like selectable options based on data types. Uses the
  // global DATA value.
  function update_controls() {
    // Analyze properties of the data
    PROPERTIES = prp.assess_properties(DATA);

    var indices = prp.all_indices(PROPERTIES);

    INDEX_MAP = {};
    var attributes = [];
    for (var i = 0; i < indices.length; ++i) {
      var ind = indices[i];
      var keys = ind[0];
      var domain = ind[1];
      var istr = prp.index__string(keys);
      attributes.push([istr, keys, domain]);
      INDEX_MAP[istr] = [keys, domain];
    }

    X_INDEX = attributes[0][1];
    X_DOMAIN = attributes[0][2];
    Y_INDEX = attributes[1][1];
    Y_DOMAIN = attributes[1][2];

    update_left_range();

    var with_default = [ "default" ].concat(attributes);
    var lcs = d3.select("#left_color_select");
    lcs.selectAll("option").exit().remove();
    lcs.selectAll("option")
      .data(with_default)
    .enter().append("option")
      .attr(
        "value",
        function (d) {
          if (d === "default") {
            return "density";
          } else {
            return d[0];
          }
        }
      )
      .text(
        function (d) {
          if (d === "default") {
            return "density (default)";
          } else {
            return d[0];
          }
        }
      );
    lcs.selectAll("option").filter(d => d === "default").attr("selected", true);

    var lxs = d3.select("#left_x_select");
    lxs.selectAll("option").exit().remove();
    lxs.selectAll("option")
      .data(attributes)
    .enter().append("option")
      .attr("value", d => d[0])
      .text(d => d[0]);
    lxs.selectAll("option").filter((d, i) => i == 0).attr("selected", true);

    var lys = d3.select("#left_y_select");
    lys.selectAll("option").exit().remove();
    lys.selectAll("option")
      .data(attributes)
    .enter().append("option")
      .attr("value", d => d[0])
      .text(d => d[0]);
    lys.selectAll("option").filter((d, i) => i == 1).attr("selected", true);

    with_default = [ "default" ].concat(attributes);
    var lls = d3.select("#left_label_select");
    lls.selectAll("option").exit().remove();
    lls.selectAll("option")
      .data(with_default)
    .enter().append("option")
      .attr(
        "value",
        function (d) {
          if (d === "default") {
            return "none";
          } else {
            return d[0];
          }
        }
      )
      .text(
        function (d) {
          if (d === "default") {
            return "none (default)";
          } else {
            return d[0];
          }
        }
      );
    lls.selectAll("option").filter(d => d === "default").attr("selected", true);
  }

  // Main setup
  function do_viz() {
    LEFT_WINDOW = d3.select("#left_window");
    RIGHT_WINDOW = d3.select("#right_window");
    LEFT_CONTROLS = d3.select("#left_controls");
    RIGHT_CONTROLS = d3.select("#right_controls");

    RIGHT_X_SCALE = d3.scaleLinear().range(
      [0, utils.get_width(RIGHT_WINDOW) - 2*MARGIN]
    );
    RIGHT_Y_SCALE = d3.scaleLinear().range(
      [utils.get_height(RIGHT_WINDOW) - 2*MARGIN, 0]
    );

    // TODO: Get rid of these!
    RIGHT_COLOR_SCALE = function(t) {
      return d3.interpolate(RIGHT_START_COLOR, RIGHT_END_COLOR)(t);
    };
    COLOR_VALUE = function(d) {
      if (COLOR_DOMAIN instanceof Set) {
        // TODO: HERE!
        return prp.get_value(d, COLOR_BY);
      } else if (Array.isArray(COLOR_DOMAIN)) {
        var val = prp.get_value(d, COLOR_BY);
        return (val - COLOR_DOMAIN[0]) / (COLOR_DOMAIN[1] - COLOR_DOMAIN[0]);
      } else { // (bad) default
        return prp.get_value(d, COLOR_BY);
      }
    };

    // Placeholder text
    LEFT_WINDOW.append("text")
      .attr("class", "label")
      .attr("x", utils.get_width(LEFT_WINDOW)/2)
      .attr("y", utils.get_height(LEFT_WINDOW)/2)
      .style("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .text("No data (choose a file to analyze above)");

    // bind events:
    d3.select(window)
      .on("resize", resize);
    LEFT_WINDOW
      .on("click", left_click)
      .on("mousemove", left_motion)
      .on("mousewheel", left_scroll);

    // controls:
    d3.select("#data_file")
      .on("change", file_chosen)
      .on(
        "click touchstart",
        function () { d3.select(this).attr("value", ""); }
      );

    // TODO: Move these to view code!
    d3.select("#show_density_checkbox").on("change", density_box_checked);

    d3.select("#left_color_select").on("change", left_cattr_selected);
    d3.select("#left_start_color").on("change", left_start_color_selected);
    d3.select("#left_end_color").on("change", left_end_color_selected);

    d3.select("#left_gradient_select").on("change", left_gradient_selected);
    var lcg = d3.select("#left_categorical_schemes")
    lcg.selectAll("option").exit().remove();
    lcg.selectAll("option")
      .data(CAT_SCHEMES)
    .enter().append("option")
      .attr("class", "gradient_option")
      .attr("value", d => d[0])
      .style("background", d => utils.css_scheme("to right", d[1]))
      .text(d => d[0]);
    var ldg = d3.select("#left_diverging_gradients")
    ldg.selectAll("option").exit().remove();
    ldg.selectAll("option")
      .data(DV_GRADIENTS)
    .enter().append("option")
      .attr("class", "gradient_option")
      .attr("value", d => d[0])
      .style("background", d => utils.css_gradient("to right", d[1]))
      .text(d => d[0]);
    var lsg = d3.select("#left_sequential_gradients")
    lsg.selectAll("option").exit().remove();
    lsg.selectAll("option")
      .data(SQ_GRADIENTS)
    .enter().append("option")
      .attr("class", "gradient_option")
      .attr("value", d => d[0])
      .style("background", d => utils.css_gradient("to right", d[1]))
      .text(d => d[0]);
    var lcg = d3.select("#left_cyclical_gradients")
    lcg.selectAll("option").exit().remove();
    lcg.selectAll("option")
      .data(CYC_GRADIENTS)
    .enter().append("option")
      .attr("class", "gradient_option")
      .attr("value", d => d[0])
      .style("background", d => utils.css_gradient("to right", d[1]))
      .text(d => d[0]);

    d3.select("#left_x_select").on("change", left_x_selected);
    d3.select("#left_y_select").on("change", left_y_selected);

    d3.select("#left_label_select").on("change", left_label_selected);
  }

  // Alternate main for pre.html preprocessing page.
  function handle_preprocessing() {
    // controls:
    d3.select("#data_file")
      .on("change", pre_file_chosen)
      .on(
        "click touchstart",
        function () { d3.select(this).attr("value", ""); }
      );

    // TODO: Select-all on click in textarea?
  }

  function initiate_download() {
    // TOOD: HERE
    console.log("DOWN");
  }

  return {
    "do_viz": do_viz,
    "handle_preprocessing": handle_preprocessing,
  };
});

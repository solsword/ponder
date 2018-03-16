define(
[
  "d3",
  "d3-scale-chromatic",
  "./utils",
  "./quadtree",
  "./viz",
  "./properties"
],
function (d3, d3sc, utils, qt, viz, prp) {
  /*
   * Module variables:
   */

  // Milliseconds to wait during active polling.
  var THUNK_MS = 75;

  // The data:
  var DXRANGE = [ undefined, undefined ];
  var DYRANGE = [ undefined, undefined ];

  // The current dataset
  var DATA;

  // Whether to use density rectangles or point approximations
  var SHOW_DENSITY = false;

  // Which attributes to use for x- and y-axes:
  var X_INDEX = undefined;
  var Y_INDEX = undefined;

  // Spatial resolution constraints (in screen pixels):
  var MIN_RADIUS = 0.5; // how small the lens can be
  var MIN_REGION_SIDE = 1; // when to stop building quadtree
  var MAX_REGION_DISTORTION = 8; // when to rebuild quadtree
  var VIZ_RESOLUTION = 1; // min pixels per visualization unit

  // Visualization limits
  var HIST_BAR_LIMIT = 30; // max # of bars

  // Which property to use for point colors
  var COLOR_BY = undefined;

  // Mouse scroll correction factors:
  var PIXELS_PER_LINE = 18;
  var LINES_PER_PAGE = 40;
  var SCROLL_FACTOR = 10; // pixels of scroll per 1% radius adjust

  // Margin inside SVG:
  var MARGIN = 30;

  // Padding in the domain (% of normal range)
  var DPAD = 0.05;

  // The quadtree:
  var QUADTREE;

  // Selections
  var HOVERED;
  var SELECTED;

  // Scales
  var LEFT_X_SCALE;
  var LEFT_Y_SCALE;
  var RIGHT_X_SCALE;
  var RIGHT_Y_SCALE;

  // Color transforms
  var LEFT_COLOR_SCALE;
  var LEFT_START_COLOR = d3.select("#left_start_color").attr("value");
  var LEFT_END_COLOR = d3.select("#left_end_color").attr("value");
  var RIGHT_COLOR_SCALE;
  var RIGHT_START_COLOR = d3.rgb(193, 201, 248);
  var RIGHT_END_COLOR = d3.rgb(0, 8, 52);
  var COLOR_VALUE;

  // DOM objects
  var LEFT_WINDOW;
  var RIGHT_WINDOW;
  var LEFT_CONTROLS;
  var RIGHT_CONTROLS;

  // The lens circle & shadow
  var LENS;
  var SHADOW;

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
    viz.draw_quadtree(
      dplot,
      QUADTREE,
      LEFT_COLOR_SCALE,
      VIZ_RESOLUTION,
      SHOW_DENSITY,
      undefined
      /* DEBUG
      function (d) {
        var cx = lens_x;
        var cy = lens_y;
        var r = lens_r;
        var x = QUADTREE.getx(d);
        var y = QUADTREE.gety(d);
        if (
          x >= cx - r && x <= cx + r
       && y >= cy - r && y <= cy + r
       && r*r >= (x - cx) * (x - cx) + (y - cy) * (y - cy)
        ) {
          return 1;
        } else {
          return 0;
        }
      }
      // */
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
    setTimeout(eventually_process_uploaded_file, 100, d3.select(this));
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

  function density_box_checked() {
    SHOW_DENSITY = !this.checked;
    update_left_window();
  }

  function left_cattr_selected() {
    var val = utils.get_selected_value(this);
    // TODO: HERE
  }

  function left_start_color_selected() {
    LEFT_START_COLOR = this.value;
    update_left_window();
  }

  function left_end_color_selected() {
    LEFT_END_COLOR = this.value;
    update_left_window();
  }

  function left_x_selected() {
    var val = this.value;
    X_INDEX = prp.string__index(val);
    update_left_range();

    rebuild_quadtree();

    update_left_window();
  }

  function left_y_selected() {
    var val = this.value;
    Y_INDEX = prp.string__index(val);
    update_left_range();

    rebuild_quadtree();

    update_left_window();
  }

  /*
   * Setup functions
   */

  // Called after data is loaded
  function populate_data(data) {
    resize();

    // Set global
    DATA = data;

    // Update controls
    update_controls(data);

    // Rebuild the quadtree
    rebuild_quadtree();

    // Update the selection
    update_selected();

    // Reset left window:
    LEFT_WINDOW.selectAll("*").remove();

    // x-axis:
    LEFT_WINDOW.append("g")
      .attr("id", "left_x_axis")
      .attr("class", "x axis")
      .attr(
        "transform",
        "translate(" + MARGIN + ","
      + (utils.get_height(LEFT_WINDOW) - MARGIN) + ")"
      )
      .call(d3.axisBottom(LEFT_X_SCALE))
    .append("text")
      .attr("class", "label")
      .attr("x", utils.get_width(LEFT_WINDOW) - 2 * MARGIN)
      .attr("y", -MARGIN/3)
      .style("text-anchor", "end")
      .text("X");

    // y-axis
    LEFT_WINDOW.append("g")
      .attr("id", "left_y_axis")
      .attr("class", "y axis")
      .attr(
        "transform",
        "translate(" + MARGIN + "," + MARGIN + ")"
      )
      .call(d3.axisLeft(LEFT_Y_SCALE))
    .append("text")
      .attr("class", "label")
      .attr("transform", "rotate(-90)")
      .attr("y", MARGIN/3)
      .attr("dy", ".71em")
      .style("text-anchor", "end")
      .text("Y");

    LEFT_WINDOW.append("g")
      .attr("id", "qt_density")
      .attr("class", "density_plot")
      .attr(
        "transform",
        "translate(" + MARGIN + "," + MARGIN + ")"
      );

    // Heavy lifting for left window
    update_left_window();

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

    // Update the right window using the starting lens
    update_right_window();
  }

  // Updates the ranges of the left-hand plot
  function update_left_range() {
    DXRANGE[0] = d3.min(DATA, x_value);
    DXRANGE[1] = d3.max(DATA, x_value);
    DYRANGE[0] = d3.min(DATA, y_value);
    DYRANGE[1] = d3.max(DATA, y_value);
    var xr = DXRANGE[1] - DXRANGE[0];
    var yr = DYRANGE[1] - DYRANGE[0];
    LEFT_X_SCALE.domain([DXRANGE[0] - DPAD * xr, DXRANGE[1] + DPAD * xr]);
    LEFT_Y_SCALE.domain([DYRANGE[0] - DPAD * yr, DYRANGE[1] + DPAD * yr]);

    d3.select("#left_x_axis")
      .call(d3.axisBottom(LEFT_X_SCALE));

    d3.select("#left_y_axis")
      .call(d3.axisLeft(LEFT_Y_SCALE));
  }

  // Updates things like selectable options based on data types. Uses the
  // global DATA value.
  function update_controls() {
    // Analyze properties of the data
    var properties = prp.assess_properties(DATA);

    var indices = prp.all_indices(properties);

    var attributes = [];
    for (var i = 0; i < indices.length; ++i) {
      var ind = indices[i];
      attributes.push([prp.index__string(ind), ind]);
    }

    X_INDEX = attributes[0][1];
    Y_INDEX = attributes[1][1];

    update_left_range();

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
  }

  // Main setup
  function do_viz() {
    LEFT_WINDOW = d3.select("#left_window");
    RIGHT_WINDOW = d3.select("#right_window");
    LEFT_CONTROLS = d3.select("#left_controls");
    RIGHT_CONTROLS = d3.select("#right_controls");

    LEFT_X_SCALE = d3.scaleLinear().range(
      [0, utils.get_width(LEFT_WINDOW) - 2*MARGIN]
    );
    LEFT_Y_SCALE = d3.scaleLinear().range(
      [utils.get_height(LEFT_WINDOW) - 2*MARGIN, 0]
    );
    RIGHT_X_SCALE = d3.scaleLinear().range(
      [0, utils.get_width(RIGHT_WINDOW) - 2*MARGIN]
    );
    RIGHT_Y_SCALE = d3.scaleLinear().range(
      [utils.get_height(RIGHT_WINDOW) - 2*MARGIN, 0]
    );

    /* TODO: Something about this mess
    // Max 12 colors
    DISC_COLOR_SCALE = d3.scaleOrdinal(d3.schemePaired);
    //CONT_COLOR_SCALE = d3.interpolateViridis;
    //CONT_COLOR_SCALE = d3.interpolateBlues; // missing?!?
    CONT_COLOR_SCALE = function(t) {
      // TODO: Try a log-transform here? (or for some uses?)
      //return d3.interpolateInferno(1-t);
      //return d3.interpolateInferno(t);
      return d3.interpolate(SCALE_LIGHT_END, SCALE_DARK_END)(t);
      //return d3.interpolate(SCALE_DARK_END, SCALE_LIGHT_END)(t);
    }
    */
    LEFT_COLOR_SCALE = function(t) {
      return d3.interpolate(LEFT_START_COLOR, LEFT_END_COLOR)(t);
    };
    RIGHT_COLOR_SCALE = function(t) {
      return d3.interpolate(RIGHT_START_COLOR, RIGHT_END_COLOR)(t);
    };
    COLOR_VALUE = function(d) {
      return prp.get_value(d, COLOR_BY);
    };

    // Placeholder text
    LEFT_WINDOW.append("text")
      .attr("class", "label")
      .attr("x", utils.get_width(LEFT_WINDOW)/2)
      .attr("y", utils.get_height(LEFT_WINDOW)/2)
      .style("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .text("No data (choose a file to analyze below)");

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

    d3.select("#show_density_checkbox").on("change", density_box_checked);

    d3.select("#left_color_select").on("change", left_cattr_selected);
    d3.select("#left_start_color").on("change", left_start_color_selected);
    d3.select("#left_end_color").on("change", left_end_color_selected);

    d3.select("#left_x_select").on("change", left_x_selected);
    d3.select("#left_y_select").on("change", left_y_selected);
  }

  return {
    "do_viz": do_viz,
  };
});

define(
["d3/d3", "./utils", "./quadtree", "./viz", "./properties"],
function (d3, utils, qt, viz, prp) {
  /*
   * Module variables:
   */

  // The data:
  var DXRANGE = [ undefined, undefined ];
  var DYRANGE = [ undefined, undefined ];

  // Which properties to use for x- and y-axes:
  var X_PROP = "coords";
  var X_PROP_INDEX = 0;
  var Y_PROP = "coords";
  var Y_PROP_INDEX = 1;

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

  // Scales
  var LEFT_X_SCALE;
  var LEFT_Y_SCALE;
  var RIGHT_X_SCALE;
  var RIGHT_Y_SCALE;

  // Color transforms
  var LEFT_COLOR_SCALE;
  var LEFT_START_COLOR = d3.rgb(193, 201, 248);
  var LEFT_END_COLOR = d3.rgb(0, 8, 52);
  var RIGHT_COLOR_SCALE;
  var RIGHT_START_COLOR = d3.rgb(193, 201, 248);
  var RIGHT_END_COLOR = d3.rgb(0, 8, 52);
  var COLOR_VALUE;

  // Color constants:
  // TODO: Pick a scheme, or let the user decide!
  // cream/blue
  //var SCALE_LIGHT_END = d3.rgb(255, 245, 230);
  //var SCALE_DARK_END = d3.rgb(0, 40, 190);
  // cream/maroon
  //var SCALE_LIGHT_END = d3.rgb(255, 245, 230);
  //var SCALE_DARK_END = d3.rgb(64, 7, 0);
  // sky/dark blue
  //var SCALE_LIGHT_END = d3.rgb(242, 249, 255);
  //var SCALE_DARK_END = d3.rgb(0, 8, 52);
  // light/dark blue
  //var SCALE_LIGHT_END = d3.rgb(193, 201, 248);
  //var SCALE_DARK_END = d3.rgb(0, 8, 52);

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
    if (X_PROP == undefined) {
      return 0;
    } else {
      var val = d[X_PROP];
    }
    if (X_PROP_INDEX == undefined) {
      return val;
    } else {
      return val[X_PROP_INDEX];
    }
  };
  function y_value(d) {
    if (Y_PROP == undefined) {
      return 0;
    } else {
      var val = d[Y_PROP];
    }
    if (Y_PROP_INDEX == undefined) {
      return val;
    } else {
      return val[Y_PROP_INDEX];
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
      QUADTREE,
      region
    );
    var selected = [];
    for (var i = 0; i < candidates.length; ++i) {
      var it = candidates[i];
      var x = QUADTREE.getx(it);
      var y = QUADTREE.gety(it);
      var dx = x - cx;
      var dy = y - cy;
      if (Math.sqrt(dx * dx + dy * dy) <= r) {
        selected.push(it);
      }
    }
    return selected;
  }

  function get_hovered() {
    var cx = utils.get_n_attr(SHADOW, "cx");
    var cy = utils.get_n_attr(SHADOW, "cy");
    var r = utils.get_n_attr(SHADOW, "r");
    return get_items_in_circle(QUADTREE, cx, cy, r);
  }

  function get_selected() {
    var cx = utils.get_n_attr(LENS, "cx");
    var cy = utils.get_n_attr(LENS, "cy");
    var r = utils.get_n_attr(LENS, "r");
    return get_items_in_circle(QUADTREE, cx, cy, r);
  }

  function update_left_window() {
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
    viz.draw_quadtree(
      dplot,
      QUADTREE,
      function(t) {return d3.interpolate(LEFT_START_COLOR, LEFT_END_COLOR)(t);},
      VIZ_RESOLUTION,
      false,
      undefined
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
    var items = get_selected();

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

      update_right_window();
    }
  }

  function left_scroll() {
    var e = d3.event;

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
    // TODO: HERE
    X_PROP = val;
    X_PROP_INDEX = 
    x_value = function (d) {

    };
    update_left_window();
  function x_value(d) {
    if (X_PROP == undefined) {
      return 0;
    } else {
      var val = d[X_PROP];
    }
    if (X_PROP_INDEX == undefined) {
      return val;
    } else {
      return val[X_PROP_INDEX];
    }
  };
  }

  function left_y_selected() {
  }

  /*
   * Setup functions
   */

  // Called after data is loaded
  function populate_data(data) {
    resize();

    DXRANGE[0] = d3.min(data, x_value);
    DXRANGE[1] = d3.max(data, x_value);
    DYRANGE[0] = d3.min(data, y_value);
    DYRANGE[1] = d3.max(data, y_value);
    var xr = DXRANGE[1] - DXRANGE[0];
    var yr = DYRANGE[1] - DYRANGE[0];
    LEFT_X_SCALE.domain([DXRANGE[0] - DPAD * xr, DXRANGE[1] + DPAD * xr]);
    LEFT_Y_SCALE.domain([DYRANGE[0] - DPAD * yr, DYRANGE[1] + DPAD * yr]);

    // Reset left window:
    LEFT_WINDOW.selectAll("*").remove();

    // x-axis:
    LEFT_WINDOW.append("g")
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

    // Build a quadtree:
    function getx(d) { return LEFT_X_SCALE(x_value(d)); };
    function gety(d) { return LEFT_Y_SCALE(y_value(d)); };
    QUADTREE = qt.build_quadtree(
      data,
      get_left_extent(),
      getx,
      gety,
      MIN_REGION_SIDE
    );

    LEFT_WINDOW.append("g")
      .attr("id", "qt_density")
      .attr("class", "density_plot")
      .attr(
        "transform",
        "translate(" + MARGIN + "," + MARGIN + ")"
      );

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

    update_controls(data);
  }

  // Updates things like selectable options based on data types.
  function update_controls() {
    // Analyze properties of the data
    var properties = prp.assess_properties(data);

    d3.select("#left_x_select").exit().remove();
    d3.select("#left_x_select")
      .data(properties)
    .enter().append("option")
      .attr("value", function (d) { d.name; });

    d3.select("#left_y_select").exit().remove();
    d3.select("#left_y_select")
      .data(properties)
    .enter().append("option")
      .attr("value", function (d) { d.name; });
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
      if (COLOR_BY != undefined && d.hasOwnProperty(COLOR_BY)) {
        return d[COLOR_BY];
      } else {
        return undefined;
      }
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

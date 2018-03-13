
define(
["d3/d3", "./utils", "./quadtree", "./viz"],
function (d3, utils, qt, viz) {
  /*
   * Module variables:
   */

  // The data:
  var DATA;
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
  var POINTS_ALLOWED = 512; // How many points we allow to be drawn on average

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
  var DISC_COLOR_SCALE;
  var CONT_COLOR_SCALE;
  var COLOR_VALUE;

  // Windows
  var LEFT_WINDOW;
  var RIGHT_WINDOW;

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

    SHADOW.attr("cx", coords[0] - MARGIN);
    SHADOW.attr("cy", coords[1] - MARGIN);
  }

  function left_click() {
    // Update the lens
    LENS.attr("cx", SHADOW.attr("cx"));
    LENS.attr("cy", SHADOW.attr("cy"));
    LENS.attr("r", SHADOW.attr("r"));

    // Collect items:
    var items = get_selected();

    // TODO: Give user control over which info & how?
    // Extract & transform data:
    //var counts = viz.value_counts(items, "stuff");
    //var counts = viz.value_counts(items, "activity");
    var counts = viz.value_counts(items, "purchased");

    // Display info:
    viz.draw_histogram(
      d3.select("#details_graph"),
      counts,
      HIST_BAR_LIMIT,
      function(t) { return CONT_COLOR_SCALE(1-t); }
      //function(t) { return CONT_COLOR_SCALE(t); }
    );
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

    var r = utils.get_n_attr(SHADOW, "r");
    r *= (1 + 0.01 * dy / SCROLL_FACTOR);
    if (r < MIN_RADIUS) {
      r = MIN_RADIUS;
    }
    SHADOW.attr("r", r);
  }

  /*
   * Setup functions
   */

  // Called after data is loaded
  function finish_setup() {
    resize();

    DXRANGE[0] = d3.min(DATA, x_value);
    DXRANGE[1] = d3.max(DATA, x_value);
    DYRANGE[0] = d3.min(DATA, y_value);
    DYRANGE[1] = d3.max(DATA, y_value);
    var xr = DXRANGE[1] - DXRANGE[0];
    var yr = DYRANGE[1] - DYRANGE[0];
    LEFT_X_SCALE.domain([DXRANGE[0] - DPAD * xr, DXRANGE[1] + DPAD * xr]);
    LEFT_Y_SCALE.domain([DYRANGE[0] - DPAD * yr, DYRANGE[1] + DPAD * yr]);

    // Left graph:

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
      .attr("class", "x axis")
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

    // Draw dots:
    /*
    LEFT_WINDOW.selectAll(".dot")
      .data(DATA)
    .enter().append("circle")
      .attr("class", "dot")
      .attr("r", 1)
      .attr("cx", function (d) { return MARGIN + LEFT_X_SCALE(x_value(d)) })
      .attr("cy", function (d) { return MARGIN + LEFT_Y_SCALE(y_value(d)) })
      .style("fill", function (d) { return COLOR_SCALE(COLOR_VALUE(d)); });
    // */

    // Build a quadtree:
    function getx(d) { return LEFT_X_SCALE(x_value(d)); };
    function gety(d) { return LEFT_Y_SCALE(y_value(d)); };
    QUADTREE = qt.build_quadtree(
      DATA,
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

    // Draw the quadtree:
    var dplot = d3.select("#qt_density");
    viz.draw_quadtree(
      dplot,
      QUADTREE,
      CONT_COLOR_SCALE,
      VIZ_RESOLUTION,
      POINTS_ALLOWED
    );

    // Add lenses last!
    dplot.append("g")
      .attr("id", "lens_group");

    LENS = d3.select("#lens_group").append("circle")
      .attr("id", "lens")
      .attr("cx", "70")
      .attr("cy", "70")
      .attr("r", "20")
      .attr("z-index", "10");

    SHADOW = d3.select("#lens_group").append("circle")
      .attr("id", "lens_shadow")
      .attr("cx", "70")
      .attr("cy", "70")
      .attr("r", "20")
      .attr("z-index", "10");

    // Right graph:

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
  }

  // Main setup
  function do_viz(data_url) {
    LEFT_WINDOW = d3.select("#left_window");
    RIGHT_WINDOW = d3.select("#right_window");

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

    // Max 12 colors
    DISC_COLOR_SCALE = d3.scaleOrdinal(d3.schemePaired);
    //CONT_COLOR_SCALE = d3.interpolateViridis;
    //CONT_COLOR_SCALE = d3.interpolateBlues; // missing?!?
    CONT_COLOR_SCALE = function(t) {
      //return d3.interpolateInferno(1-t);
      //return d3.interpolateInferno(t);
      return d3.interpolate(d3.rgb(255, 245, 230), d3.rgb(0, 40, 190))(t);
    }
    COLOR_VALUE = function(d) {
      if (COLOR_BY != undefined && d.hasOwnProperty(COLOR_BY)) {
        return d[COLOR_BY];
      } else {
        return undefined;
      }
    };

    // Load data:
    d3.json(data_url, function (error, json) {
      if (error) {
        throw error;
      } else {
        DATA = json;

        finish_setup();
      }
    });

    // bind events:
    d3.select(window)
      .on("resize", resize);
    LEFT_WINDOW
      .on("click", left_click)
      .on("mousemove", left_motion)
      .on("mousewheel", left_scroll);
  }

  return {
    "do_viz": do_viz,
  };
});

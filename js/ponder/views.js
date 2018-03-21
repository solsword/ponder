define(
[
  "d3",
  "d3-scale-chromatic",
  "./utils",
  "./quadtree",
  "./dataset",
  "./properties",
  "./viz"
],
function (d3, d3sc, utils, qt, ds, prp, viz) {

  //////////////////////
  // Shared constants //
  //////////////////////

  // Padding in the domain (% of normal range)
  var DOMAIN_PADDING = 0.03;

  // Mouse scroll correction factors:
  var PIXELS_PER_LINE = 18;
  var LINES_PER_PAGE = 40;
  var SCROLL_FACTOR = 10; // pixels of scroll per 1% radius adjust

  //////////////////
  // SelectWidget //
  //////////////////

  // A select box that includes the given options (preceded by the given text).
  // The callback will be called with the selected value as an argument
  // whenever the user selects a new option.
  function SelectWidget(
    label,
    options,
    default_option,
    callback
  ) {
    this.label = label;
    this.options = options;
    this.default_option = default_option || this.options[0];
    this.callback = callback;
  }

  SelectWidget.prototype.put_controls = function (node) {
    var row = node.append("div").attr("class", "controls_row");
    row.text(this.label);
    var select = row.append("select")
      .on("change", function () { // set new axis, re-bind, and re-draw
        if (this.callback) {
          this.callback(utils.get_selected_value(this));
        }
      });
    select.selectAll("option")
      .data(this.options)
    .enter().append("option")
      .attr("value", d => d)
      .text(d => d);
    select.selectAll("option")
      .filter(d => d == this.default_option)
      .attr("selected", true);
  }

  /////////////////
  // ColorWidget //
  /////////////////

  // Available preset color schemes & gradients:
  var CAT_SCHEMES = {
    "cat10": d3sc.schemeCategory10,
    "accent": d3sc.schemeAccent,
    "dark2": d3sc.schemeDark2,
    "paired": d3sc.schemePaired,
    "pastel1": d3sc.schemePastel1,
    "pastel2": d3sc.schemePastel2,
    "set1": d3sc.schemeSet1,
    "set2": d3sc.schemeSet2,
    "set3": d3sc.schemeSet3,
  };
  var DV_GRADIENTS = {
    "brbg": d3sc.interpolateBrBG,
    "prgn": d3sc.interpolatePRGn,
    "piyg": d3sc.interpolatePiYG,
    "puor": d3sc.interpolatePuOr,
    "rdbu": d3sc.interpolateRdBu,
    "rdgy": d3sc.interpolateRdGy,
    "rdlybu": d3sc.interpolateRdYlBu,
    "rdylgn": d3sc.interpolateRdYlGn,
    "spectral": d3sc.interpolateSpectral,
  };
  var SQ_GRADIENTS = {
    "gr": d3sc.interpolateGreys,
    "ge": d3sc.interpolateGreens,
    "or": d3sc.interpolateOranges,
    "rd": d3sc.interpolateReds,
    "pu": d3sc.interpolatePurples,
    "bu": d3sc.interpolateBlues,
    "viridis": d3sc.interpolateViridis,
    "inferno": d3sc.interpolateInferno,
    "magma": d3sc.interpolateMagma,
    "plasma": d3sc.interpolatePlasma,
    "warm": d3sc.interpolateWarm,
    "cubehelix": d3sc.interpolateCubehelixDefault,
    "ylgn": d3sc.interpolateYlGn,
    "gnbu": d3sc.interpolateGnBu,
    "pubu": d3sc.interpolatePuBu,
    "purd": d3sc.interpolatePuRd,
    "rdpu": d3sc.interpolateRdPu,
    "orrd": d3sc.interpolateOrRd,
    "pubugn": d3sc.interpolatePuBuGn,
    "ylgnbu": d3sc.interpolateYlGnBu,
    "ylorrd": d3sc.interpolateYlOrRd,
  };
  var CYC_GRADIENTS = {
    "rainbow": d3sc.interpolateRainbow,
  };
  // Map of all possible gradients:
  var ALL_GRADIENTS = Object.assign(
    {},
    CAT_SCHEMES,
    DV_GRADIENTS,
    SQ_GRADIENTS,
    CYC_GRADIENTS
  );

  // A color selection widget that can add itself to an element, react to user
  // input on the added controls, and supply a color interpolation function. A
  // callback may be supplied which will be called with the widget as an
  // argument whenever the user changes the color or gradient selected.
  function ColorWidget(
    default_selection,
    default_color,
    default_custom_start,
    default_custom_end,
    callback
  ) {
    this.default_selection = default_selection;
    this.flat_color = default_color;
    this.custom_gradient_start = default_custom_start;
    this.custom_gradient_end = default_custom_end;

    if (default_selection == "flat") {
      this.set_color(default_color);
    } if (ALL_GRADIENTS.hasOwnProperty(default_selection)) {
      this.set_color(ALL_GRADIENTS[default_selection]);
    } else {
      this.set_color(default_selection);
    }
  }

  // Sets the color function for the widget. The special value "custom" can be
  // used to fall back to a gradient between the default custom start/end.
  ColorWidget.prototype.set_color = function(color) {
    if (color === "custom") {
      this.color = d3.interpolateCubehelix(
        this.custom_gradient_start,
        this.custom_gradient_end
      );
    } else if (typeof color === "string") {
      this.color = function(t) { return color; };
    } else if (Array.isArray(color)) {
      this.color = function (t) {
        var i = Math.floor(t);
        // TODO: Cycle instead of clamp?
        if (i < 0) { i = 0; }
        if (i > color.length - 1) { i = color.length - 1; }
        return color[i];
      };
    } else { // hopefully it's an interpolation function?
      this.color = color;
    }
  }

  ColorWidget.prototype.put_controls = function (node) {
    var row = node.append("div").attr("class", "controls_row");
    row.text("Color scale: ");
    // custom option
    var cs_select = row.append("select");
    cs_select.append("option")
      .attr("value", "flat")
      .text("flat");
    cs_select.append("option")
      .attr("value", "custom")
      .attr("selected", true)
      .text("custom");
    // grouped options
    var cat_group = cs_select.append("optgroup")
      .attr("label", "Categorical");
    cat_group.selectAll("option")
      .data(Object.keys(CAT_SCHEMES))
    .enter().append("option")
      .attr("value", d => d)
      .text(d => d);
    var dv_group = cs_select.append("optgroup")
      .attr("label", "Diverging");
    dv_group.selectAll("option")
      .data(Object.keys(DV_GRADIENTS))
    .enter().append("option")
      .attr("value", d => d)
      .text(d => d);
    var sq_group = cs_select.append("optgroup")
      .attr("label", "Sequential");
    sq_group.selectAll("option")
      .data(Object.keys(SQ_GRADIENTS))
    .enter().append("option")
      .attr("value", d => d)
      .text(d => d);
    var cyc_group = cs_select.append("optgroup")
      .attr("label", "Cyclical");
    cyc_group.selectAll("option")
      .data(Object.keys(CYC_GRADIENTS))
    .enter().append("option")
      .attr("value", d => d)
      .text(d => d);

    // custom flat color picker
    var cs_flat = row.append("input")
      .attr("type", "color")
      .attr("value", this.flat_color)
      .style("display", "none");

    // custom gradient color pickers
    var cs_custom = row.append("span");
    cs_custom.append("span").text("( ");
    var cg_start = cs_custom.append("input")
      .attr("type", "color")
      .attr("value", this.custom_gradient_start);
    cs_custom.append("span").text(" to ");
    var cg_end = cs_custom.append("input")
      .attr("type", "color")
      .attr("value", this.custom_gradient_end);
    cs_custom.append("span").text(" )");

    // gradient demo
    var cs_demo = row.append("span")
      .attr("class", "gradient_demo");

    // Color scale select:
    cs_select.on("change", function () {
      var sel = utils.get_selected_value(this);
      if (sel === "flat") {
        cs_flat.style("display", "inline");
        cs_custom.style("display", "none");
        this.set_color(this.flat_color);
      } else if (sel === "custom") {
        cs_flat.style("display", "none");
        cs_custom.style("display", "inline");
        this.set_color("custom");
      } else {
        cs_flat.style("display", "none");
        cs_custom.style("display", "none");
        this.set_color(ALL_GRADIENTS[sel]);
      }
      cs_demo.style(
        "background",
        utils.css_gradient("to right", this.color)
      );
      if (this.callback) { this.callback(this); }
    });

    cs_flat.on("change", function () {
      this.flat_color = this.value;
      this.set_color(this.flat_color);
      cs_demo.style(
        "background",
        utils.css_gradient("to right", this.color)
      );
      if (this.callback) { this.callback(this); }
    })

    // Custom gradient color select:
    cg_start.on("change", function () {
      this.custom_gradient_start = this.value;
      this.set_color("custom");
      cs_demo.style(
        "background",
        utils.css_gradient("to right", this.color)
      );
      if (this.callback) { this.callback(this); }
    });
    cg_end.on("change", function () {
      this.custom_gradient_end = this.value;
      this.set_color("custom");
      cs_demo.style(
        "background",
        utils.css_gradient("to right", this.color)
      );
      if (this.callback) { this.callback(this); }
    });
  }

  //////////////
  // LensView //
  //////////////

  // Minimum size of a quadtree cell (in SVG units ~= screen pixels)
  var DEFAULT_RESOLUTION = 1;

  // Minimum radius of the lens in SVG units (~= screen pixels)
  var MIN_LENS_RADIUS = 0.5;

  // Creates a new lens view of the given dataset.
  //
  // Note that after creating a view, it must be bound to a frame before it can
  // be drawn or its controls can be used, and if the x_index or y_index
  // weren't given, they need to be set first.
  function LensView(id, dataset, x_index, y_index) {
    this.id = id;
    this.data = dataset;
    this.show_density = false;
    this.selected = [];
    this.selection_listeners = [];

    var inames = ds.index_names(this.data);

    this.x_selector = new SelectWidget(
      "X-axis: ",
      inames,
      ds.get_name(this.data, x_index),
      function (iname) {
        this.set_x_axis(iname);
        this.rebind();
        this.draw();
      }
    );

    this.y_selector = new SelectWidget(
      "Y-axis: ",
      inames,
      ds.get_name(this.data, y_index),
      function (iname) {
        this.set_y_axis(iname);
        this.rebind();
        this.draw();
      }
    );

    this.color_prop_selector = new SelectWidget(
      "Color by: ",
      ["density (default)"].concat(inames),
      "density (default)",
      function (iname) {
        if (iname === "density (default)") {
          this.set_color_property(undefined);
        } else {
          this.set_color_property(iname);
        }
        this.draw();
      }
    );

    this.color_widget = new ColorWidget(
      "custom",
      "#000",
      "#f0e8c8",
      "#631200",
      function () { this.draw(); }
    );

    this.label_selector = new SelectWidget(
      "Labels: ",
      ["none"].concat(inames),
      "none",
      function (iname) {
        if (iname == "none") {
          this.set_labels(undefined);
        } else {
          this.set_labels(iname);
        }
        this.draw();
      }
    );

    this.set_x_axis(x_index);
    this.set_y_axis(y_index);
  }


  // Binds the given view to the given frame, setting up variables required to
  // draw the view, which will be drawn into the given frame when draw()
  // is called. If the frame changes size, this function can safely be called
  // again to update the view (and then draw should also be called again).
  // If not given, the min_resolution parameter (which controls the minimum
  // size of a quadtree cell in SVG units ~= screen pixels) will use the
  // existing resolution if one has already been specified or
  // DEFAULT_RESOLUTION if not.
  LensView.prototype.bind_frame = function(frame, min_resolution) {
    this.frame = frame;

    var fw = utils.get_width(frame);
    var fh = utils.get_height(frame);

    var xr = this.x_domain[1] - this.x_domain[0];
    var yr = this.y_domain[1] - this.y_domain[0];
    this.x_scale = d3.scaleLinear()
      .range([0, fw])
      .domain([
          this.x_domain[0] - DOMAIN_PADDING * xr,
          this.x_domain[1] + DOMAIN_PADDING * xr
      ]);
    this.y_scale = d3.scaleLinear()
      .range([fh, 0])
      .domain([
        this.y_domain[0] - DOMAIN_PADDING * yr,
        this.y_domain[1] + DOMAIN_PADDING * yr
      ]);

    this.view_x = d => this.x_scale(this.raw_x(d));
    this.view_y = d => this.y_scale(this.raw_y(d));

    // build a quadtree in the view space:
    var min_side = min_resolution;
    if (min_side === undefined) {
      if (this.resolution != undefined) {
        min_side = this.resolution;
      } else {
        min_side = DEFAULT_RESOLUTION;
      }
    }
    this.resolution = min_side;

    this.tree = qt.build_quadtree(
      this.data,
      [ 0, 0, fw, fh ],
      this.view_x,
      this.view_y,
      min_side
    );

    // set up default lens & shadow:
    this.lens = { "x": fw/2, "y": fh/2, "r": 20, "node": undefined };
    this.shadow = { "x": fw/2, "y": fh/2, "r": 20, "node": undefined };

    this.update_selection();
  }

  // Rebinds a view to the same frame it's already bound to.
  LensView.prototype.rebind = function() {
    if (this.frame === undefined) {
      console.error("Can't rebind an unbound view!");
      console.error(this);
    } else {
      this.bind_frame(this.frame, this.resolution);
    }
  }

  // Removes the contents of the given DOM node and replaces them with the
  // controls for this view.
  LensView.prototype.put_controls = function(node) {
    node.selectAll("*").remove();
    var row = node.append("div").attr("class", "controls_row");
    row.append("input")
      .attr("type", "checkbox")
      .attr("checked", true)
      .on("change", function () {
        this.show_density = !this.checked;
        this.draw(); // redraw
      });
    row.text("Show point approximation (instead of density)");

    this.x_selector.put_controls(node);
    this.y_selector.put_controls(node);

    this.color_prop_selector.put_controls(node);

    // color scale select
    this.color_widget.put_controls(node);

    this.label_selector.put_controls(node);
  }

  // Draws the given view into its bound frame (see bind_frame). Also sets up
  // some event bindings on the frame.
  LensView.prototype.draw = function() {

    // Reset the frame:
    this.frame.selectAll("*").remove();

    var fw = utils.get_width(this.frame);
    var fh = utils.get_height(this.frame);

    // x-axis:
    this.frame.append("g")
      .attr("id", this.id + "_x_axis")
      .attr("class", "x axis")
      .attr(
        "transform",
        "translate(0," + fh + ")"
      )
      .call(d3.axisBottom(this.x_scale))
    .append("text")
      .attr("class", "label")
      .attr("x", fw * 0.98)
      .attr("y", -fh * 0.02)
      .style("text-anchor", "end")
      .text(ds.get_name(this.data, this.x_index));

    // y-axis
    this.frame.append("g")
      .attr("id", this.id + "_y_axis")
      .attr("class", "y axis")
      .call(d3.axisLeft(this.y_scale))
    .append("text")
      .attr("class", "label")
      .attr("transform", "rotate(-90)")
      .attr("y", fw * 0.02)
      .attr("dy", ".71em")
      .style("text-anchor", "end")
      .text(ds.get_name(this.data, this.y_index));

    var dplot = this.frame.append("g")
      .attr("id", "qt_density")
      .attr("class", "density_plot");

    viz.draw_quadtree(
      dplot,
      this.tree,
      this.color_widget.color,
      this.resolution,
      this.show_density,
      this.c_value,
      this.get_label
    );

    // Add the lenses last
    dplot.append("g")
      .attr("id", "lens_group");

    this.lens.node = dplot.select("#lens_group").append("circle")
      .attr("id", this.id + "_lens")
      .attr("cx", this.lens.x)
      .attr("cy", this.lens.y)
      .attr("r", this.lens.r)
      .attr("z-index", "10");

    this.shadow.node = dplot.select("#shadow_group").append("circle")
      .attr("id", this.id + "_shadow")
      .attr("cx", this.shadow.x)
      .attr("cy", this.shadow.y)
      .attr("r", this.shadow.r)
      .attr("z-index", "10");

    // Lens tracking:
    this.frame.on("mousemove touchmove", function () {
      var coords = d3.mouse(this);

      if (this.shadow.node != undefined) {
        this.shadow.x = coords[0];
        this.shadow.y = coords[1];
        this.shadow.node.attr("cx", this.shadow.x);
        this.shadow.node.attr("cy", this.shadow.y);
      }
    });

    this.frame.on("mousewheel", function () {
      var e = d3.event;
      e.preventDefault();

      if (this.shadow.node != undefined) {
        // convert scroll units:
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

        // update shadow radius:
        this.shadow.r *= (1 + 0.01 * dy / SCROLL_FACTOR);
        if (this.shadow.r < MIN_LENS_RADIUS) {
          this.shadow.r = MIN_LENS_RADIUS;
        }
        SHADOW.attr("r", this.shadow.r);
      }
    });

    this.frame.on("click touchstart", function () {
      this.lens.x = this.shadow.x;
      this.lens.y = this.shadow.y;
      this.lens.r = this.shadow.r;

      if (this.lens.node != undefined) {
        // Update the lens
        this.lens.node.attr("cx", this.lens.x);
        this.lens.node.attr("cy", this.lens.y);
        this.lens.node.attr("r", this.lens.r);

        this.update_selection();
      }
    });
  }

  // Subscribe a callback to trigger on selection updates. Callbacks receive
  // two arguments: an array of selected items, and the entire view object.
  LensView.prototype.subscribe_to_selection = function(callback) {
    view.selection_listeners.push(callback);
  }

  // Cancel a callback
  LensView.prototype.cancel_subscription = function(callback) {
    var i;
    for (i = 0; i < this.selection_listeners.length; ++i) {
      if (this.selection_listeners[i] === callback) {
        break;
      }
    }
    if (i < this.selection_listeners.length) {
      this.selection_listeners.spilce(i,1);
    }
  }

  // Updates the "selected" property of the view according to the current lens
  // position.
  LensView.prototype.update_selection = function() {
    if (this.lens == undefined) {
      this.selected = [];
    } else {
      this.selected = qt.in_circle(
        this.tree,
        this.lens.x,
        this.lens.y,
        this.lens.r
      );
    }
    for (let i = 0; i < this.selection_listeners.length; ++i) {
      this.selection_listeners[i](this.selected, this);
    }
  }

  // Sets the color function for the view. The special value "custom" can be
  // used to fall back to the custom_gradient_[start|end] values.
  LensView.prototype.set_color = function(color) {
    if (color === "custom") {
      this.color = d3.interpolateCubehelix(
        this.custom_gradient_start,
        this.custom_gradient_end
      );
    } else if (typeof color === "string") {
      this.color = function(t) { return color; };
    } else if (Array.isArray(color)) {
      this.color = function (t) {
        var i = Math.floor(t);
        // TODO: Cycle instead of clamp?
        if (i < 0) { i = 0; }
        if (i > color.length - 1) { i = color.length - 1; }
        return color[i];
      };
    } else {
      this.color = color;
    }
  }

  // Sets the coloring property for a view; use 'undefined' as the index to
  // revert to default coloring (by point density).
  LensView.prototype.set_color_property = function(c_index) {
    if (typeof c_index === "string") {
      c_index = ds.lookup_index(this.data, c_index);
    }
    this.c_index = c_index;
    if (c_index === undefined) {
      var nt = numerical_transform(this.data, c_index);
      this.c_value =
        d => (nt.getter(d) - nt.domain[0]) / (nt.domain[1] - nt.domain[0]);
    } else {
      this.c_value = undefined;
    }
  }

  // Pass true to turn density-regions mode on, and false to use points (the
  // default).
  LensView.prototype.set_density_mode = function(on) {
    this.show_density = on;
  }

  // Turns on labels using the given index for the view. Turn them off by
  // passing undefined as l_index.
  LensView.prototype.set_labels = function(l_index) {
    if (typeof l_index === "string") {
      l_index = ds.lookup_index(this.data, l_index);
    }
    this.l_index = l_index;
    if (l_index != undefined) {
      this.get_label = d => ds.get_field(this.data, d, this.l_index);
    } else {
      this.get_label = undefined;
    }
  }

  // Figures out a numerical domain for the given index, and returns an object
  // with the following keys:
  //
  //   getter
  //     A function that takes a data record an returns a numerical value for
  //     the given index.
  //   domain
  //     An array of two numbers: the minimum and maximum numerical values that
  //     might be returned by the accessor.
  //
  // If the input index doesn't have a domain, the resulting getter will always
  // return 0 and the domain will be [0, 0].
  function numerical_transform(dataset, index) {
    var dom = ds.get_domain(dataset, index);
    if (dom == undefined) { // give up
      return {
        "getter": d => 0,
        "domain": [0, 0]
      };
    } else if (Array.isArray(dom)) { // numerical range
      return {
        "getter": d => ds.get_field(dataset, d, index),
        "domain": dom
      };
    } else { // must be a string domain containing counts
      var values = Object.keys(dom);
      values.sort();
      var vmap = {}; 
      for (let i = 0; i < values.length; ++i) {
        vmap[values[i]] = i;
      }
      return {
        "getter": d => vmap[ds.get_field(dataset, d, index)],
        "domain": [ 0, values.length - 1 ]
      };
    }
  }

  // Replaces the old x-axis of the domain. Usually requires re-binding the
  // domain to its frame afterwards.
  LensView.prototype.set_x_axis = function(x_index) {
    if (typeof x_index === "string") {
      x_index = ds.lookup_index(this.data, x_index);
    }
    this.x_index = x_index;
    this.x_type = ds.get_type(this.data, x_index);

    var nx = numerical_transform(this.data, x_index);
    this.x_domain = nx.domain;
    this.raw_x = nx.getter;
  }

  // Same as above for the y-axis.
  LensView.prototype.set_y_axis = function(y_index) {
    if (typeof y_index === "string") {
      y_index = ds.lookup_index(this.data, y_index);
    }
    this.y_index = y_index;
    this.y_type = ds.get_type(this.data, y_index);

    var ny = numerical_transform(this.data, y_index);
    this.y_domain = ny.domain;
    this.raw_y = ny.getter;
  }

  ///////////////
  // Histogram //
  ///////////////

  // Default # of bins to use
  var DEFAULT_BINS = 10;

  // Limit on # of bars to display (bars are sorted by length, so smallest bars
  // will be cut off).
  var DEFAULT_BAR_LIMIT = 30;

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
  // If bar_limit isn't given, it will default to DEFAULT_BAR_LIMIT.
  function Histogram(
    id,
    dataset,
    records,
    field,
    normalize,
    bins,
    domain,
    bar_limit
  ) {
    this.id = id;
    this.data = dataset;
    this.records = records;
    this.normalize = normalize;
    this.bins = bins;
    this.bar_limit = bar_limit || DEFAULT_BAR_LIMIT;

    // set up widgets:
    this.color_widget = new ColorWidget(
      "flat",
      "#6688cc",
      "#f0e8c8",
      "#631200",
      function () { this.draw(); }
    );

    var inames = ds.index_names(this.data);
    this.field_selector = new SelectWidget(
      "Field: ",
      inames,
      this.field,
      function (iname) {
        this.set_field(iname);
        this.draw();
      }
    )

    this.compute_counts();
  }

  // Reassigns the field for this histogram. Triggers a recount of the
  // histogram bin values.
  Histogram.prototype.set_field = function (field) {
    if (typeof field === "string") {
      field = ds.lookup_index(this.data, field);
    }
    this.field = field;
    this.compute_counts();
  }

  // Reassigns the record set for this histogram. Triggers a recount of the
  // histogram bin values.
  Histogram.prototype.set_records = function (records) {
    this.records = records;
    this.compute_counts();
  }

  // (Re-)computes the counts for this histogram.
  Histogram.prototype.compute_counts = function () {
    var ft = ds.get_type(this.data, this.field);
    this.counts = {};
    if (ft.kind === "number") {
      var dom;
      if (bins === undefined) { bins = DEFAULT_BINS; }
      this.bins = bins;
      if (domain === undefined) {
        dom = ds.get_domain(this.data, this.field);
      } else if (domain === "auto") {
        dom = [undefined, undefined];
        for (let i = 0; i < this.records.length; ++i) {
          var val = ds.get_field(this.data, this.records[i], this.field);
          if (dom[0] === undefined || dom[0] > val) { dom[0] = val; }
          if (dom[1] === undefined || dom[1] < val) { dom[1] = val; }
        }
      } else {
        dom = domain;
      }
      this.domain = dom;
      var bs = (dom[1] - dom[0]) / bins;
      var bin_names = [];
      for (let i = 0; i < bins; ++i) {
        bin_names.push(
          "" + (dom[0] + bs * i).toPrecision(2) + "–"
        + (dom[0] + bs * (i + 1)).toPrecision(2)
        );
      }
      for (let i = 0; i < this.records.length; ++i) {
        var val = ds.get_field(this.data, this.records[i], this.field);
        var bin = Math.floor((val - dom[0]) / bs);
        var bn = bin_names[bin];
        if (this.counts.hasOwnProperty(bn)) {
          this.counts[bn] += 1;
        } else {
          this.counts[bn] = 1;
        }
      }
    } else if (ft.kind === "string") {
      for (let i = 0; i < records.length; ++i) {
        var val = ds.get_field(this.data, this.records[i], this.field);
        if (this.counts.hasOwnProperty(val)) {
          this.counts[val] += 1;
        } else {
          this.counts[val] = 1;
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
        var val = ds.get_field(this.data, this.records[i], this.field);
        for (var k in val) {
          if (val.hasOwnProperty(k)) {
            if (mode === "count") {
              if (this.counts.hasOwnProperty(k)) {
                this.counts[k] += 1;
              } else {
                this.counts[k] = 1;
              }
            } else {
              var sv = val[k];
              if (this.counts.hasOwnProperty(k)) {
                this.counts[k] += sv;
              } else {
                this.counts[k] = sv;
              }
            }
          }
        }
      }
      if (mode === "average") {
        for (var k in this.counts) {
          if (this.counts.hasOwnProperty(k)) {
            this.counts[k] /= this.records.length;
          }
        }
      }
    } else {
      console.error("Don't know how to make a histogram out of:")
      console.error(ft);
      this.counts = undefined;
      return;
    }

    if (normalize) {
      var mx = undefined;
      // find max
      for (var k in this.counts) {
        if (this.counts.hasOwnProperty(k)) {
          var val = this.counts[k];
          if (mx == undefined || val > mx) {
            mx = val;
          }
        }
      }
      // divide by max
      for (var k in this.counts) {
        if (this.counts.hasOwnProperty(k)) {
          this.counts[k] /= mx;
        }
      }
    }
  }

  Histogram.prototype.bind_frame = function (frame) {
    this.frame = frame;
  }

  Histogram.prototype.draw = function() {
    // Reset the frame:
    this.frame.selectAll("*").remove();

    var fw = utils.get_width(this.frame);
    var fh = utils.get_height(this.frame);

    viz.draw_histogram(
      this.frame,
      this.counts,
      this.bar_limit,
      this.color_widget.color
    )
  }

  Histogram.prototype.put_controls = function (node) {
    node.selectAll("*").remove();
    this.field_selector.put_controls(node);
    this.color_widget.put_controls(node);
  }

  return {
    "LensView": LensView,
    "Histogram": Histogram,
  };
});

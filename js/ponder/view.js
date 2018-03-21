define(
["d3", "./utils", "./quadtree", "./dataset", "./properties", "./viz"],
function (d3, utils, qt, ds, prp, viz) {

  // Default margin value (fraction of total frame reserved)
  var DEFAULT_MARGIN = 0.04;

  // Padding in the domain (% of normal range)
  var DOMAIN_PADDING = 0.03;

  // Minimum size of a quadtree cell (in SVG units ~= screen pixels)
  var DEFAULT_RESOLUTION = 1;

  // Default color gradient
  var DEFAULT_GRADIENT = t => d3.interpolateCubehelix("#f0e8c8", "#631200")(t);

  // Mouse scroll correction factors:
  var PIXELS_PER_LINE = 18;
  var LINES_PER_PAGE = 40;
  var SCROLL_FACTOR = 10; // pixels of scroll per 1% radius adjust

  // Minimum radius of the lens in SVG units (~= screen pixels)
  var MIN_LENS_RADIUS = 0.5;

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
  // List of all possible gradient types
  var GTYPES = [
    CAT_SCHEMES,
    DV_GRADIENTS,
    SQ_GRADIENTS,
    CYC_GRADIENTS
  ];


  // Binds the given view to the given frame, setting up variables required to
  // draw the view, which will be drawn into the given frame when draw_view()
  // is called. If the frame changes size, this function can safely be called
  // again to update the view (and then draw_view should also be called again).
  // If not given, the max_resolution parameter (which controls the minimum
  // size of a quadtree cell in SVG units ~= screen pixels) will use
  // DEFAULT_RESOLUTION.
  function bind_frame(view, frame, min_resolution) {
    var fw = utils.get_width(frame);
    var fh = utils.get_height(frame);
    view.frame = frame;

    var xr = view.x_domain[1] - view.x_domain[0];
    var yr = view.y_domain[1] - view.y_domain[0];
    view.x_scale = d3.scaleLinear()
      .range([0, fw - 2*view.margin*fw])
      .domain([
          view.x_domain[0] - DOMAIN_PADDING * xr,
          view.x_domain[1] + DOMAIN_PADDING * xr
      ]);
    view.y_scale = d3.scaleLinear()
      .range([fh - 2*view.margin*fh, 0])
      .domain([
        view.y_domain[0] - DOMAIN_PADDING * yr,
        view.y_domain[1] + DOMAIN_PADDING * yr
      ]);

    view.view_x = d => view.x_scale(view.raw_x(d));
    view.view_y = d => view.y_scale(view.raw_y(d));

    // build a quadtree in the view space:
    var min_side = min_resolution;
    if (min_side === undefined) { min_side = DEFAULT_RESOLUTION; }
    view.resolution = min_side;

    view.tree = qt.build_quadtree(
      view.data,
      [ 0, 0, fw - 2*view.margin*fw, fh - 2*view.margin*fh ],
      view.view_x,
      view.view_y,
      min_side
    );

    // set up default lens & shadow:
    view.lens = { "x": fw/2, "y": fh/2, "r": 20, "node": undefined };
    view.shadow = { "x": fw/2, "y": fh/2, "r": 20, "node": undefined };

    update_selection(view);
  }

  // Rebinds a view to the same frame it's already bound to.
  function rebind(view) {
    if (view.frame === undefined) {
      console.error("Can't rebind an unbound view!");
      console.error(view);
    } else {
      bind_frame(view, view.frame, view.resolution);
    }
  }

  // Removes the contents of the given DOM node and replaces them with the
  // controls for this view.
  function put_controls(view, node) {
    node.selectAll("*").remove();
    var row = node.append("div").attr("class", "controls_row");
    row.append("input")
      .attr("type", "checkbox")
      .attr("checked", true)
      .on("change", function () {
        view.show_density = !this.checked;
        draw_view(view); // redraw
      });
    row.text("Show point approximation (instead of density)");

    row = node.append("div").attr("class", "controls_row");
    row.text("X-axis: ");
    var x_select = row.append("select")
      .on("change", function () { // set new axis, re-bind, and re-draw
        var sel = utils.get_selected_value(this);
        set_x_axis(view, sel);
        rebind(view);
        draw_view(view);
      });
    x_select.selectAll("option")
      .data(ds.index_names(view.data))
    .enter().append("option")
      .attr("value", d => d)
      .text(d => d);
    x_select.selectAll("option")
      .filter(d => d == ds.lookup_index(view.data, view.x_index))
      .attr("selected", true);

    row = node.append("div").attr("class", "controls_row");
    row.text("Y-axis: ");
    var y_select = row.append("select")
      .on("change", function () { // set new axis, re-bind, and re-draw
        var sel = utils.get_selected_value(this);
        set_y_axis(view, sel);
        rebind(view);
        draw_view(view);
      });
    y_select.selectAll("option")
      .data(ds.index_names(view.data))
    .enter().append("option")
      .attr("value", d => d)
      .text(d => d);
    y_select.selectAll("option")
      .filter(d => d == ds.lookup_index(view.data, view.y_index))
      .attr("selected", true);

    row = node.append("div").attr("class", "controls_row");
    row.text("Color by: ");
    var c_select = row.append("select")
      .on("change", function () {
        var sel = utils.get_selected_value(this);
        if (sel === "default") {
          set_color_scheme(view, undefined);
        } else {
          set_color_scheme(view, sel);
        }
        // no need to rebind over a color change
        draw_view(view);
      });
    c_select.selectAll("option")
      .data([ "default" ].concat(ds.index_names(view.data)))
    .enter().append("option")
      .attr("value", d => d)
      .text(d => d === "default" ? "density (default)" : d);
    c_select.selectAll("option")
      .filter(d => d == ds.lookup_index(view.data, view.c_index))
      .attr("selected", true);

    row = node.append("div").attr("class", "controls_row");
    
    // color scale select
    row.text("Color scale: ");
    // custom option
    var cs_select = row.append("select");
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

    // custom gradient color pickers
    var cs_custom = row.append("span");
    cs_custom.append("span").text("( ");
    var cg_start = cs_custom.append("input")
      .attr("type", "color")
      .attr("value", view.custom_gradient_start);
    cs_custom.append("span").text(" to ");
    var cg_end = cs_custom.append("input")
      .attr("type", "color")
      .attr("value", view.custom_gradient_end);
    cs_custom.append("span").text(" )");

    // gradient demo
    var cs_demo = row.append("span")
      .attr("class", "gradient_demo");

    // Color scale select:
    cs_select.on("change", function () {
      var sel = utils.get_selected_value(this);
      if (sel === "custom") {
        cs_custom.style("display", "inline");
        set_gradient(view, "custom");
      } else {
        cs_custom.style("display", "none");
        var grad = undefined;
        for (let i = 0; i < GTYPES.length; ++i) {
          var candidates = GTYPES[i];
          for (var k in candidates) {
            if (candidates.hasOwnProperty(k) && sel == k) {
              grad = candidates[k];
              break;
            }
          }
          if (grad != undefined) {
            break;
          }
        }
        set_gradient(view, grad);
      }
      cs_demo.style(
        "background",
        utils.css_gradient("to right", view.gradient)
      );
      draw_view(view);
    });

    // Custom gradient color select:
    cg_start.on("change", function () {
      view.custom_gradient_start = utils.get_selected_value(this);
      set_gradient(view, "custom");
      cs_demo.style(
        "background",
        utils.css_gradient("to right", view.gradient)
      );
      draw_view(view);
    });
    cg_end.on("change", function () {
      view.custom_gradient_end = utils.get_selected_value(this);
      set_gradient(view, "custom");
      cs_demo.style(
        "background",
        utils.css_gradient("to right", view.gradient)
      );
      draw_view(view);
    });

    row = node.append("div").attr("class", "controls_row");
    row.text("Labels: ");
    var l_select = row.append("select")
      .on("change", function () {
        var sel = utils.get_selected_value(this);
        if (sel == "none") {
          set_labels(view, undefined);
        } else {
          set_labels(view, sel);
        }
        draw_view(view);
      });
    l_select.selectAll("option")
      .data([ "none" ].concat(ds.index_names(view.data)))
    .enter().append("option")
      .attr("value", d => d)
      .text(d => d === "none" ? "none (default)" : d);
    l_select.selectAll("option")
      .filter(d => d == ds.lookup_index(view.data, view.l_index))
      .attr("selected", true);
  }

  // Draws the given view into its bound frame (see bind_frame). Also sets up
  // some event bindings on the frame.
  function draw_view(view) {

    // Reset the frame:
    view.frame.selectAll("*").remove();

    var fw = utils.get_width(view.frame);
    var fh = utils.get_height(view.frame);

    // x-axis:
    view.frame.append("g")
      .attr("id", view.id + "_x_axis")
      .attr("class", "x axis")
      .attr(
        "transform",
        "translate(" + view.margin + "," + (fh - view.margin) + ")"
      )
      .call(d3.axisBottom(view.x_scale))
    .append("text")
      .attr("class", "label")
      .attr("x", fw - 2 * view.margin)
      .attr("y", -view.margin/3)
      .style("text-anchor", "end")
      .text(ds.get_name(view.data, view.x_index));

    // y-axis
    view.frame.append("g")
      .attr("id", view.id + "_y_axis")
      .attr("class", "y axis")
      .attr(
        "transform",
        "translate(" + view.margin + "," + view.margin + ")"
      )
      .call(d3.axisLeft(view.y_scale))
    .append("text")
      .attr("class", "label")
      .attr("transform", "rotate(-90)")
      .attr("y", view.margin/3)
      .attr("dy", ".71em")
      .style("text-anchor", "end")
      .text(ds.get_name(view.data, view.y_index));

    var dplot = view.frame.append("g")
      .attr("id", "qt_density")
      .attr("class", "density_plot")
      .attr(
        "transform",
        "translate(" + view.margin + "," + view.margin + ")"
      );

    viz.draw_quadtree(
      dplot,
      view.tree,
      view.gradient || DEFAULT_GRADIENT,
      view.resolution,
      view.show_density,
      view.c_value,
      view.get_label
    );

    // Add the lenses last
    dplot.append("g")
      .attr("id", "lens_group");

    view.lens.node = dplot.select("#lens_group").append("circle")
      .attr("id", view.id + "_lens")
      .attr("cx", view.lens.x)
      .attr("cy", view.lens.y)
      .attr("r", view.lens.r)
      .attr("z-index", "10");

    view.shadow.node = dplot.select("#shadow_group").append("circle")
      .attr("id", view.id + "_shadow")
      .attr("cx", view.shadow.x)
      .attr("cy", view.shadow.y)
      .attr("r", view.shadow.r)
      .attr("z-index", "10");

    // Lens tracking:
    view.frame.on("mousemove touchmove", function () {
      var coords = d3.mouse(this);

      if (view.shadow.node != undefined) {
        view.shadow.x = coords[0] - view.margin;
        view.shadow.y = coords[1] - view.margin;
        view.shadow.node.attr("cx", view.shadow.x);
        view.shadow.node.attr("cy", view.shadow.y);
      }
    });

    view.frame.on("mousewheel", function () {
      var e = d3.event;
      e.preventDefault();

      if (view.shadow.node != undefined) {
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
        view.shadow.r *= (1 + 0.01 * dy / SCROLL_FACTOR);
        if (view.shadow.r < MIN_LENS_RADIUS) {
          view.shadow.r = MIN_LENS_RADIUS;
        }
        SHADOW.attr("r", view.shadow.r);
      }
    }

    view.frame.on("click touchstart", function () {
      view.lens.x = view.shadow.x;
      view.lens.y = view.shadow.y;
      view.lens.r = view.shadow.r;

      if (view.lens.node != undefined) {
        // Update the lens
        view.lens.node.attr("cx", view.lens.x);
        view.lens.node.attr("cy", view.lens.y);
        view.lens.node.attr("r", view.lens.r);

        update_selection(view);
      }
    });
  }

  // Subscribe a callback to trigger on selection updates. Callbacks receive
  // two arguments: an array of selected items, and the entire view object.
  function subscribe_to_selection(view, callback) {
    view.selection_listeners.push(callback);
  }

  // Cancel a callback
  function cancel_subscription(view, callback) {
    var i;
    for (i = 0; i < view.selection_listeners.length; ++i) {
      if (view[i] === callback) {
        break;
      }
    }
    if (i < view.selection_listeners.length) {
      view.spilce(i,1);
    }
  }

  // Updates the "selected" property of the view according to the current lens
  // position.
  function update_selection(view) {
    if (view.lens == undefined) {
      view.selected = [];
    } else {
      view.selected = qt.in_circle(
        view.tree,
        view.lens.x,
        view.lens.y,
        view.lens.r
      );
    }
    for (let i = 0; i < view.selection_listeners.length; ++i) {
      view.selection_listeners[i](view.selected, view);
    }
  }

  // Sets the gradient function for the view. The special value "custom" can be
  // used to fall back to the custom_gradient_[start|end] values.
  function set_gradient(view, gradient) {
    if (gradient === "custom") {
      view.gradient = d3.interpolateCubehelix(
        view.custom_gradient_start,
        view.custom_gradient_end
      );
    } else if (Array.isArray(gradient)) {
      view.gradient = function (t) {
        var i = Math.floor(t);
        // TODO: Cycle instead of clamp?
        if (i < 0) { i = 0; }
        if (i > gradient.length - 1) { i = gradient.length - 1; }
        return gradient[i];
      };
    } else {
      view.gradient = gradient;
    }
  }

  // Sets the coloring scheme for a view; use 'undefined' as the index to
  // revert to default coloring (by point density).
  function set_color_scheme(view, c_index) {
    if (typeof c_index === "string") {
      c_index = ds.lookup_index(view.data, c_index);
    }
    view.c_index = c_index;
    if (c_index === undefined) {
      var nt = numerical_transform(view.data, c_index);
      view.c_value =
        d => (nt.getter(d) - nt.domain[0]) / (nt.domain[1] - nt.domain[0]);
    } else {
      view.c_value = undefined;
    }
  }

  // Pass true to turn density-regions mode on, and false to use points (the
  // default).
  function set_density_mode(view, on) {
    view.show_density = on;
  }

  // Turns on labels using the given index for the view. Turn them off by
  // passing undefined as l_index.
  function set_labels(view, l_index) {
    if (typeof l_index === "string") {
      l_index = ds.lookup_index(view.data, l_index);
    }
    view.l_index = l_index;
    if (l_index != undefined) {
      view.get_label = d => ds.get_field(view.data, d, view.l_index);
    } else {
      view.get_label = undefined;
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
  function set_x_axis(view, x_index) {
    if (typeof x_index === "string") {
      x_index = ds.lookup_index(view.data, x_index);
    }
    view.x_index = x_index;
    view.x_type = ds.get_type(view.data, x_index);

    var nx = numerical_transform(dataset, x_index);
    view.x_domian = nx.domain;
    view.raw_x = nx.getter;
  }

  // Same as above for the y-axis.
  function set_y_axis(view, y_index) {
    if (typeof y_index === "string") {
      y_index = ds.lookup_index(view.data, y_index);
    }
    view.y_index = y_index;
    view.y_type = ds.get_type(view.data, y_index);

    var ny = numerical_transform(dataset, y_index);
    view.y_domian = ny.domain;
    view.raw_y = ny.getter;
  }

  // Creates a new view of the given dataset. The margin argument is optional
  // and specifies a fraction of the frame that should be used for the margin
  // when the view is drawn. DEFAULT_MARGIN will be used if an explicit margin
  // isn't given.
  //
  // Note that after creating a view, it must be bound to a frame before it can
  // be drawn or its controls can be used, and if the x_index or y_index
  // weren't given, they need to be set first.
  function create_view(id, dataset, x_index, y_index, margin) {
    if (margin === undefined) { margin = DEFAULT_MARGIN; }
    var result = {
      "id": id,
      "data": dataset,
      "show_density": false,
      "margin": margin,
      "selected": [],
      "selection_listeners": [],
      "custom_gradient_start": "#f0e8c8",
      "custom_gradient_end": "#631200",
    };

    if (x_index != undefined) {
      set_x_axis(result, x_index);
    }
    if (y_index != undefined) {
      set_y_axis(result, y_index);
    }

    return result;
  }

  return {
    "bind_frame": bind_frame,
    "put_controls": put_controls,
    "draw_view": draw_view,
    "update_selection": update_selection,
    "set_color_scheme": set_color_scheme,
    "set_density_mode": set_density_mode,
    "set_labels": set_labels,
    "numerical_transform": numerical_transform,
    "set_x_axis": set_x_axis, 
    "set_y_axis": set_y_axis, 
    "create_view": create_view, 
  };
});

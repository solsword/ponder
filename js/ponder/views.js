define(
[
  "d3",
  "d3-scale-chromatic",
  "./utils",
  "./quadtree",
  "./dataset",
  "./properties",
  "./filters",
  "./viz"
],
function (d3, d3sc, utils, qt, ds, prp, fl, viz) {

  //////////////////////
  // Shared constants //
  //////////////////////

  // Padding in the domain (% of normal range)
  var DOMAIN_PADDING = 0.03;

  // Mouse scroll correction factors:
  var PIXELS_PER_LINE = 18;
  var LINES_PER_PAGE = 40;
  var SCROLL_FACTOR = 10; // pixels of scroll per 1% radius adjust

  // Regex for finding an integer in a string:
  var FIND_INT = /[0-9]+/

  // Threshold for using textbox selection for multiple values
  var LOTS_OF_VALUES_THRESHOLD = 7;

  // Milliseconds to wait after focusout event before closing a menu
  var MENU_TIMEOUT_HACK = 180;

  ////////////////
  // BaseWidget //
  ////////////////
  // Shared widget functionality

  function BaseWidget() {
    this.node == undefined;
  }

  BaseWidget.prototype.put_controls = function (node, insert_before) {
    if (this.node == undefined) {
      if (node.classed("controls_row") || node.classed("controls_span")) {
        if (insert_before) {
          this.node = node.insert(
            "span",
            insert_before
          ).attr("class", "controls_span");
        } else {
          this.node = node.append("span").attr("class", "controls_span");
        }
      } else {
        if (insert_before) {
          this.node = node.insert(
            "div",
            insert_before
          ).attr("class", "controls_row");
        } else {
          this.node = node.append("div").attr("class", "controls_row");
        }
      }
    } else {
      this.node.selectAll("*").remove();
    }
  }

  BaseWidget.prototype.remove = function () {
    if (this.node) { this.node.remove(); }
    this.node = undefined;
  }

  BaseWidget.prototype.enable = function () {
    this.node.selectAll("input, select, textarea").attr("disabled", null);
  }

  BaseWidget.prototype.disable = function () {
    this.node.selectAll("input, select, textarea").attr("disabled", true);
  }

  BaseWidget.prototype.trigger_callback = function (...args) {
    if (this.callback) {
      this.callback.apply(this, args);
    }
  }

  ////////////////
  // HelpWidget //
  ////////////////

  // A question-mark symbol that when hovered will display a message and when
  // clicked will display a pop-up with that message.
  function HelpWidget(text) {
    BaseWidget.call(this);
    this.text = text;
    this.callback = undefined;
  }

  HelpWidget.prototype = Object.create(BaseWidget.prototype);
  HelpWidget.prototype.constructor = HelpWidget;

  HelpWidget.prototype.put_controls = function (node, insert_before) {
    Object.getPrototypeOf(
      HelpWidget.prototype
    ).put_controls.call(this, node, insert_before);
    var the_widget = this;
    var text;
    if (typeof this.text === "function") {
      text = this.text();
    } else {
      text = this.text;
    }
    var button = this.node.append("a")
      .attr("class", "gray_button button")
      .text("?")
      .on("mouseover", function () {
        var bbox = utils.get_bbox(the_widget.node);
        console.log(bbox);
        if (the_widget.popup) {
          the_widget.popup.remove();
          the_widget.popup = undefined;
        }
        the_widget.popup = d3.select("body").append("div")
          .attr("class", "help")
          .style("top", bbox.y + "px")
          .style("left", bbox.x + "px")
          .style("position", "absolute")
          .text(text)
          .on("mouseout", function () {
            if (the_widget.popup) {
              the_widget.popup.remove();
              the_widget.popup = undefined;
            }
          });
      })
      .on("click touchend", function () {
        if (the_widget.popup) {
          the_widget.popup.remove();
          the_widget.popup = undefined;
        }
        // TODO: HERE
        // the_widget.trigger_callback();
      });
  }

  //////////////////
  // ButtonWidget //
  //////////////////

  // A button with the given label.
  // The callback will be called whenever the button is activated.
  function ButtonWidget(
    label,
    callback
  ) {
    BaseWidget.call(this);
    this.label = label;
    this.callback = callback;
  }

  ButtonWidget.prototype = Object.create(BaseWidget.prototype);
  ButtonWidget.prototype.constructor = ButtonWidget;

  ButtonWidget.prototype.put_controls = function (node, insert_before) {
    Object.getPrototypeOf(
      ButtonWidget.prototype
    ).put_controls.call(this, node, insert_before);
    var the_widget = this;
    var ltext;
    if (typeof this.label === "function") {
      ltext = this.label(this);
    } else {
      ltext = this.label;
    }
    var button = this.node.append("input")
      .attr("type", "button")
      .attr("value", ltext)
      .on("click touchend", function () {
        the_widget.trigger_callback();
      });
  }

  //////////////////
  // ToggleWidget //
  //////////////////

  // A check box followed by the given text.
  // The callback will be called with either true or false whenever the box is
  // toggled.
  function ToggleWidget(
    label,
    default_on,
    callback
  ) {
    BaseWidget.call(this);
    this.label = label;
    this.default_on = default_on;
    this.callback = callback;
  }

  ToggleWidget.prototype = Object.create(BaseWidget.prototype);
  ToggleWidget.prototype.constructor = ToggleWidget;

  ToggleWidget.prototype.put_controls = function (node, insert_before) {
    Object.getPrototypeOf(
      ToggleWidget.prototype
    ).put_controls.call(this, node, insert_before);
    var the_widget = this;
    var select = this.node.append("input")
      .attr("type", "checkbox")
      .on("change", function () {
        the_widget.trigger_callback(this.checked);
      });
    if (this.default_on) {
      select.attr("checked", true);
    }
    var ltext;
    if (typeof this.label === "function") {
      ltext = this.label(this);
    } else {
      ltext = this.label;
    }
    this.node.append("span")
      .attr("class", "label")
      .text(ltext);
  }

  //////////////////
  // SelectWidget //
  //////////////////

  // A select box that includes the given options (preceded by the given
  // label). The callback will be called with the selected value as an argument
  // whenever the user selects a new option.
  function SelectWidget(
    label,
    options,
    default_option,
    callback
  ) {
    BaseWidget.call(this);
    this.label = label;
    this.options = options;
    this.default_option = default_option || undefined;
    this.callback = callback;
  }

  SelectWidget.prototype = Object.create(BaseWidget.prototype);
  SelectWidget.prototype.constructor = SelectWidget;

  SelectWidget.prototype.put_controls = function (node, insert_before) {
    Object.getPrototypeOf(
      SelectWidget.prototype
    ).put_controls.call(this, node, insert_before);
    var ltext;
    if (typeof this.label === "function") {
      ltext = this.label(this);
    } else {
      ltext = this.label;
    }
    this.node.text(ltext);
    var the_widget = this;
    var opts;
    if (typeof this.options === "function") {
      opts = this.options(this);
    } else {
      opts = this.options;
    }
    var dopt;
    if (typeof this.default_option === "function") {
      dopt = this.default_option(this);
    } else if (this.default_option != undefined) {
      dopt = this.default_option;
    } else {
      dopt = this.options[0];
    }
    var select = this.node.append("select")
      .on("change", function () {
        the_widget.trigger_callback(utils.get_selected_value(this));
      });
    select.selectAll("option").exit().remove();
    select.selectAll("option")
      .data(opts)
    .enter().append("option")
      .attr("value", d => d)
      .text(d => d);
    select.selectAll("option")
      .filter(d => d == dopt)
      .attr("selected", true);
  }

  //////////////////////
  // TextSelectWidget //
  //////////////////////

  // An input box that drops down options and completes matching ones from
  // typed text (preceded by the given label). The callback will be called with
  // the selected value as an argument whenever the user selects a new option;
  // if given, the option_names are displayed to the user instead of the option
  // values. The always_blank optional flag controls whether the widget blanks
  // on selection or displays the selected value.
  function TextSelectWidget(
    label,
    options,
    default_option,
    callback,
    option_names,
    always_blank
  ) {
    BaseWidget.call(this);
    this.label = label;
    this.options = options;
    this.option_names = option_names;
    this.default_option = default_option || undefined;
    this.callback = callback;
    this.always_blank = always_blank || false;
    this.node = undefined;
    this.input = undefined;
    this.matches = undefined;
    this.display_text = undefined;
    var def;
    if (typeof this.default_option == "function") {
      def = this.default_option(this);
    } else {
      def = this.default_option;
    }
    if (def) {
      var opts;
      if (typeof this.options == "function") {
        opts = this.options(this);
      } else {
        opts = this.options;
      }
      let di = opts.indexOf(def);

      if (di >= 0) {
        var onames;
        if (typeof this.option_names == "function") {
          onames = this.option_names(this);
        } else if (this.option_names) {
          onames = this.option_names;
        } else {
          onames = opts.map(x => "" + x);
        }

        this.display_text = onames[di];
      }
    }
    this.highlighted_index = 0;
    this.displayed_options = [];
  }

  TextSelectWidget.prototype = Object.create(BaseWidget.prototype);
  TextSelectWidget.prototype.constructor = TextSelectWidget;

  TextSelectWidget.prototype.cleanup = function () {
    if (this.display_text && !this.always_blank) {
      this.input.property("value", this.display_text);
    } else {
      this.input.property("value", "");
    }
    this.input.node().blur();
    this.highlighted_index = 0;
    this.displayed_options = undefined;

    if (this.matches) {
      this.matches.remove();
      this.matches = undefined;
    }
  }

  TextSelectWidget.prototype.designate = function (value, display) {
    this.display_text = display;
    this.trigger_callback(value);
  }

  TextSelectWidget.prototype.put_controls = function (node, insert_before) {
    Object.getPrototypeOf(
      TextSelectWidget.prototype
    ).put_controls.call(this, node, insert_before);
    var the_widget = this;
    var ltext;
    if (typeof this.label === "function") {
      ltext = this.label(this);
    } else {
      ltext = this.label;
    }
    this.node.text(ltext);

    var opts;
    if (typeof this.options === "function") {
      opts = this.options(this);
    } else {
      opts = this.options;
    }
    var onames;
    if (typeof this.option_names === "function") {
      onames = this.option_names(this);
    } else if (this.option_names) {
      onames = this.option_names;
    } else {
      onames = opts.map(x => "" + x);
    }
    var dopt;
    if (typeof this.default_option === "function") {
      dopt = this.default_option(this);
    } else if (this.default_option != undefined) {
      dopt = this.default_option;
    } else {
      dopt = this.options[0];
    }
    this.input = this.node.append("input")
      .attr("type", "text")
      .attr("class", "field_select")
      .property("value", this.display_text || "")
      .on("focusout", function () {
        var evt = d3.event;
        if (evt.relatedTarget != null) {
          the_widget.cleanup();
        } else {
          // TODO: A better solution to this!?!
          window.setTimeout(
            function () { the_widget.cleanup(); },
            MENU_TIMEOUT_HACK
          );
        }
      })
      .on("focusin keyup", function () {
        var evt = d3.event;
        if (evt.type == "focusin") {
          the_widget.input.property("value", "");
          the_widget.highlighted_index = 0;
        }

        // compute and store displayed options:
        var sofar = utils.get_text_value(the_widget.input.node());
        var fragments = sofar.split(" ");
        var possibilities = Array.from({length: opts.length}, (x,i) => i);
        if (sofar != "") {
          for (let fr of fragments) {
            var subset = new Set(
              utils.text_match_indices(onames, fr)
            );
            var next = [];
            for (let i = 0; i < possibilities.length; ++i) {
              if (subset.has(possibilities[i])) {
                next.push(possibilities[i]);
              }
            }
            possibilities = next;
          }
        }
        the_widget.displayed_options = possibilities;

        if (evt.key && possibilities.length > 0) {
          if (evt.key == "Enter") {
            // select currently-highlighted element
            let di = the_widget.displayed_options[the_widget.highlighted_index];
            the_widget.designate(opts[di], onames[di]);
            the_widget.cleanup();
            return; // no further processing
          } else if (evt.key == "ArrowDown") {
            if (the_widget.displayed_options.length > 0) {
              the_widget.highlighted_index += 1;
              the_widget.highlighted_index %=
                the_widget.displayed_options.length;
            } else {
              the_widget.highlighted_index = 0;
            }
          } else if (evt.key === "ArrowUp") {
            if (the_widget.displayed_options.length > 0) {
              the_widget.highlighted_index += (
                the_widget.displayed_options.length - 1
              );
              the_widget.highlighted_index %=
                the_widget.displayed_options.length;
            } else {
              the_widget.highlighted_index = 0;
            }
          }
        }
        // now re-filter options
        if (the_widget.matches === undefined) {
          the_widget.matches = the_widget.node.insert(
            "div",
            ".field_select + *"
          );
          the_widget.matches.attr("class", "matchbox");
        } else {
          the_widget.matches.selectAll("*").remove();
        }
        if (the_widget.displayed_options.length == 0) {
          the_widget.matches.append("span")
            .attr("class", "match_empty")
            .text("<no matches>");
        } else {
          the_widget.matches.selectAll("*").remove();
          the_widget.matches.selectAll("a")
            .data(
              the_widget.displayed_options.map(oi => [opts[oi], onames[oi]])
            )
          .enter().append("a")
            .attr(
              "class",
              (d, i) => (
                i == the_widget.highlighted_index ?
                  "match_item selected"
                : "match_item"
              )
            )
            .text(d => d[1])
            .on("click touchend", function (d) {
              the_widget.designate(d[0], d[1]);
              the_widget.cleanup();
            });
        }
      });
  }

  /////////////////
  // ColorWidget //
  /////////////////

  // A color selection widget that just selects a single color. The callback
  // will be called with the color selected (an HTML RGB string) as the first
  // argument.
  function ColorWidget(label, default_color, callback) {
    BaseWidget.call(this);
    this.label = label;
    this.callback = callback;
    this.color = undefined;

    this.set_color(default_color);
  }

  ColorWidget.prototype = Object.create(BaseWidget.prototype);
  ColorWidget.prototype.constructor = ColorWidget;

  // Sets the color function for the widget.
  ColorWidget.prototype.set_color = function(color) {
    this.color = color;
  }

  // Adds the widget to a node.
  ColorWidget.prototype.put_controls = function (node, insert_before) {
    Object.getPrototypeOf(
      ColorWidget.prototype
    ).put_controls.call(this, node, insert_before);
    this.node.text(this.label);
    // custom flat color picker
    var the_widget = this;
    this.node.append("input")
      .attr("class", "spaced_inline")
      .attr("type", "color")
      .attr("value", this.color)
    .on("change", function () {
      the_widget.set_color(this.value);
      the_widget.trigger_callback(this.value);
    });
  }

  //////////////////////
  // ColorScaleWidget //
  //////////////////////

  // Available preset color schemes & gradients:
  // TODO: Return 0--1 shifted divided gradients instead of integer schemes!
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
  function ColorScaleWidget(
    default_selection,
    default_color,
    default_custom_start,
    default_custom_end,
    callback
  ) {
    BaseWidget.call(this);
    this.default_selection = default_selection;
    this.flat_color = default_color;
    this.custom_gradient_start = default_custom_start;
    this.custom_gradient_end = default_custom_end;
    this.callback = callback;

    if (default_selection == "flat") {
      this.set_color(default_color);
    } else if (ALL_GRADIENTS.hasOwnProperty(default_selection)) {
      this.set_color(ALL_GRADIENTS[default_selection]);
    } else {
      this.set_color(default_selection);
    }
  }

  ColorScaleWidget.prototype = Object.create(BaseWidget.prototype);
  ColorScaleWidget.prototype.constructor = ColorScaleWidget;

  // Sets the color function for the widget. The special value "custom" can be
  // used to fall back to a gradient between the default custom start/end.
  ColorScaleWidget.prototype.set_color = function(color) {
    if (color === "custom") {
      this.color = d3.interpolateCubehelix(
        this.custom_gradient_start,
        this.custom_gradient_end
      );
    } else {
      this.color = color;
    }
  }

  // Get the domain of the color gradient function for this widget. Returned as
  // an array of start/end numbers.
  ColorScaleWidget.prototype.get_domain = function () {
    if (typeof this.color === "string") {
      return [ 0, 0 ];
    } else {
      return [ 0, 1 ];
    }
  }

  // Extracts a gradient function 
  ColorScaleWidget.prototype.get_gradient = function () {
    if (typeof this.color === "string") {
      return x => this.color;
    } else if (Array.isArray(this.color)) {
      var the_widget = this;
      return function (t) {
        var i = Math.floor(the_widget.color.length * t);
        if (i < 0) { i = 0; }
        if (i > the_widget.color.length - 1) {
          i = the_widget.color.length - 1;
        }
        return the_widget.color[i];
      };
    } else { // hopefully should be a gradient already
      return this.color;
    }
  }

  // Extracts a CSS background style property
  ColorScaleWidget.prototype.get_css_gradient = function () {
    if (typeof this.color === "string") {
      return this.color;
    } else if (Array.isArray(this.color)) {
      return utils.css_scheme("to right", this.color);
    } else { // hopefully should be a gradient already
      return utils.css_gradient("to right", this.color);
    }
  }

  ColorScaleWidget.prototype.put_controls = function (node, insert_before) {
    Object.getPrototypeOf(
      ColorScaleWidget.prototype
    ).put_controls.call(this, node, insert_before);
    this.node.text("Color scale: ");
    // custom option
    var cs_select = this.node.append("select");
    cs_select.append("option")
      .attr("value", "flat")
      .text("flat");
    cs_select.append("option")
      .attr("value", "custom")
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
    // Set default
    var the_widget = this;
    cs_select.selectAll("option")
      .filter(function() { return this.value == the_widget.default_selection; })
      .attr("selected", true);

    // custom flat color picker
    var cs_flat = this.node.append("input")
      .attr("class", "spaced_inline")
      .attr("type", "color")
      .attr("value", this.flat_color);

    if (this.default_selection != "flat") {
      cs_flat.style("display", "none");
    }

    // custom gradient color pickers
    var cs_custom = this.node.append("span")
      .attr("class", "spaced_inline");
    cs_custom.append("span").text("( ");
    var cg_start = cs_custom.append("input")
      .attr("type", "color")
      .attr("value", this.custom_gradient_start);
    cs_custom.append("span").text(" to ");
    var cg_end = cs_custom.append("input")
      .attr("type", "color")
      .attr("value", this.custom_gradient_end);
    cs_custom.append("span").text(" )");

    if (this.default_selection != "custom") {
      cs_custom.style("display", "none");
    }

    // gradient demo
    var cs_demo = this.node.append("span")
      .attr("class", "gradient_demo")
      .style("background", the_widget.get_css_gradient());

    // Color scale select:
    var the_widget = this;
    cs_select.on("change", function () {
      var sel = utils.get_selected_value(this);
      if (sel === "flat") {
        cs_flat.style("display", "inline");
        cs_custom.style("display", "none");
        the_widget.set_color(the_widget.flat_color);
      } else if (sel === "custom") {
        cs_flat.style("display", "none");
        cs_custom.style("display", "inline");
        the_widget.set_color("custom");
      } else {
        cs_flat.style("display", "none");
        cs_custom.style("display", "none");
        the_widget.set_color(ALL_GRADIENTS[sel]);
      }
      cs_demo.style("background", the_widget.get_css_gradient());
      the_widget.trigger_callback();
    });

    cs_flat.on("change", function () {
      the_widget.flat_color = this.value;
      the_widget.set_color(the_widget.flat_color);
      cs_demo.style("background", the_widget.get_css_gradient());
      the_widget.trigger_callback();
    })

    // Custom gradient color select:
    cg_start.on("change", function () {
      the_widget.custom_gradient_start = this.value;
      the_widget.set_color("custom");
      cs_demo.style("background", the_widget.get_css_gradient());
      the_widget.trigger_callback();
    });
    cg_end.on("change", function () {
      the_widget.custom_gradient_end = this.value;
      the_widget.set_color("custom");
      cs_demo.style("background", the_widget.get_css_gradient());
      the_widget.trigger_callback();
    });
  }

  ///////////////////////
  // MultiselectWidget //
  ///////////////////////

  // A widget that allows selecting from multiple option sets before triggering
  // some action with a button. The callback will be called with an array of
  // option values the same length as the provided array of option sets.
  // Defaults may be given as 'undefined' to use the first option from each
  // option set as that set's default. Each label precedes the corresponding
  // selector.
  function MultiselectWidget(
    button_text,
    labels,
    option_sets,
    defaults,
    callback
  ) {
    BaseWidget.call(this);
    this.button_text = button_text;
    this.labels = labels;
    this.option_sets = option_sets;
    this.defaults = defaults || [];
    this.callback = callback;
  }

  MultiselectWidget.prototype = Object.create(BaseWidget.prototype);
  MultiselectWidget.prototype.constructor = MultiselectWidget;

  MultiselectWidget.prototype.put_controls = function (node, insert_before) {
    Object.getPrototypeOf(
      MultiselectWidget.prototype
    ).put_controls.call(this, node, insert_before);
    if (this.node == undefined) {
      this.node = node.append("div").attr("class", "controls_row");
    } else {
      this.node.selectAll("*").remove();
    }
    var the_widget = this;
    for (let i = 0; i < this.option_sets.length; ++i) {
      var lbl = this.labels[i];
      if (typeof lbl === "function") { lbl = lbl(this); }
      var opts = this.option_sets[i];
      if (typeof opts === "function") { opts = opts(this); }
      var def = this.defaults[i];
      if (typeof def === "function") { def = def(this); }

      // label
      this.node.append("span")
        .attr("class", "label")
        .text(lbl);

      // select
      var select = this.node.append("select")
        .attr("class", "multiselect");

      // options
      select.selectAll("option")
        .data(opts)
      .enter().append("option")
        .attr("value", d => d)
        .text(d => d);

      // Select the default if there is one:
      select.selectAll("option").filter(d => d == def)
        .attr("selected", true);
    }
    // The activation button
    this.node.append("span").text(" ");
    var btext = this.button_text;
    if (typeof btext === "function") { btext = btext(this); }
    this.node.append("input")
      .attr("type", "button")
      .attr("value", btext)
      .on("click touchend", function () {
        var values = [];
        the_widget.node.selectAll("select").each(function (d) {
          values.push(utils.get_selected_value(this));
        });
        the_widget.trigger_callback(values);
      });
  }

  ///////////////////////////////
  // ComparisonFilter Controls //
  ///////////////////////////////

  // Controls for a ComparisonFilter. The callback will be called with the
  // entire object as an argument after every parameter change.
  function ComparisonFilterControls(dataset, callback, default_index) {
    BaseWidget.call(this);
    if (default_index == undefined) {
      default_index = ds.nth_of_kind(
        dataset,
        idx => fl.ComparisonFilter.applicable_to(dataset, idx),
        0
      ) || ds.nth_of_kind(dataset, undefined, 0);
    }
    this.filter = new fl.ComparisonFilter(dataset, default_index, "==", 0);
    this.data = dataset;
    var the_controls = this;
    this.selector = new TextSelectWidget(
      "Compare: ",
      function () {
        return ds.index_names(the_controls.data)
          .filter(
            idx =>
              fl.ComparisonFilter.applicable_to(the_controls.filter.data, idx)
          );
      }, // options
      function () { return ds.get_name(the_controls.data, default_index); },
      function (selected) { the_controls.set_index(selected); }
    );
    this.active = true;
    this.callback = callback;
  }

  ComparisonFilterControls.prototype = Object.create(BaseWidget.prototype);
  ComparisonFilterControls.prototype.constructor = ComparisonFilterControls;

  ComparisonFilterControls.prototype.set_index = function (selection) {
    this.filter.set_index(selection);
    this.trigger_callback();
  }

  ComparisonFilterControls.prototype.set_cmp = function (selection) {
    this.filter.set_comparator(selection);
    this.trigger_callback();
  }

  ComparisonFilterControls.prototype.set_value = function (value) {
    this.filter.set_value(value);
    this.trigger_callback();
  }

  ComparisonFilterControls.prototype.set_active = function (active) {
    this.active = active;
    if (this.active) {
      this.node.classed("disabled", false);
      this.selector.enable();
      this.node.selectAll(".filter_control").attr("disabled", null);
    } else {
      this.node.classed("disabled", true);
      this.selector.disable();
      this.node.selectAll(".filter_control").attr("disabled", true);
    }
    this.trigger_callback();
  }

  ComparisonFilterControls.prototype.remove = function () {
    this.selector.remove();
    Object.getPrototypeOf(
      ComparisonFilterControls.prototype
    ).remove.call(this);
  }

  ComparisonFilterControls.prototype.put_controls = function (
    node,
    insert_before
  ) {
    Object.getPrototypeOf(
      ComparisonFilterControls.prototype
    ).put_controls.call(this, node, insert_before);
    var the_controls = this;

    // toggle checkbox:
    this.node.append("input")
      .attr("type", "checkbox")
      .attr("checked", this.active ? true : null)
      .on("change", function () {
        the_controls.set_active(this.checked)
      });

    // initial text:
    this.selector.remove();
    this.selector.put_controls(this.node);

    // bit of padding
    this.node.append("span").text(" ")

    // comparator select
    var cmp_select = this.node.append("select")
      .attr("class", "filter_control")
      .on("change", function () {
        the_controls.set_cmp(utils.get_selected_value(this));
      });
    cmp_select.selectAll("option").exit().remove();
    cmp_select.selectAll("option")
      .data([ "==", "!=", "<", "<=", ">", ">=" ])
    .enter().append("option")
      .attr("value", d => d)
      .text(d => d);
    cmp_select.selectAll("option")
      .filter(d => d == the_controls.filter.comparator)
      .attr("selected", true);

    // bit of padding
    this.node.append("span").text(" ")

    // value select
    var cmp_select = this.node.append("input")
      .attr("class", "filter_control short_text")
      .attr("type", "text")
      .attr("value", the_controls.filter.value)
      .on("change", function () {
        the_controls.set_value(utils.get_text_value(this));
      });
  }

  ComparisonFilterControls.prototype.apply_filter = function (records) {
    if (this.active) {
      return this.filter.filter(records);
    } else {
      return records;
    }
  }

  ComparisonFilterControls.prototype.matching_indices = function (records) {
    if (this.active) {
      return this.filter.matching_indices(records);
    } else {
      return new Set(Array.from({length: records.length}, (x,i) => i));
    }
  }

  ComparisonFilterControls.prototype.config_string = function () {
    return this.filter.repr();
  }

  /////////////////////////////
  // ValueSetFilter Controls //
  /////////////////////////////

  // Controls for a ValueSetFilter. The callback will be called with the
  // entire object as an argument after every parameter change.
  function ValueSetFilterControls(dataset, callback, default_index) {
    BaseWidget.call(this);
    if (default_index == undefined) {
      default_index = ds.nth_of_kind(
        dataset,
        idx => fl.ValueSetFilter.applicable_to(dataset, idx),
        0
      ) || ds.nth_of_kind(dataset, undefined, 0);
    }
    this.data = dataset;
    this.filter = new fl.ValueSetFilter(dataset, default_index, []);
    var the_controls = this;
    this.selector = new TextSelectWidget(
      "",
      function () {
        return ds.index_names(the_controls.data)
          .filter(
            idx =>
              fl.ValueSetFilter.applicable_to(the_controls.filter.data, idx)
          );
      }, // options
      function () { return ds.get_name(the_controls.data, default_index); },
      function (selected) { the_controls.set_index(selected); }
    );
    this.active = true;
    this.callback = callback;
  }

  ValueSetFilterControls.prototype = Object.create(BaseWidget.prototype);
  ValueSetFilterControls.prototype.constructor = ValueSetFilterControls;

  ValueSetFilterControls.prototype.set_index = function (selection) {
    this.filter.set_index(selection);
    this.refresh_values(); // triggers callback
  }

  ValueSetFilterControls.prototype.set_accept = function(idx_or_string, accept){
    this.filter.set_accept(idx_or_string, accept);
    this.trigger_callback(); // don't necessarily need to refresh values
  }

  ValueSetFilterControls.prototype.set_active = function (active) {
    this.active = active;
    if (this.active) {
      this.node.attr("class", "controls_row");
      this.node.selectAll(".filter_control").attr("disabled", null);
    } else {
      this.node.attr("class", "controls_row disabled");
      this.node.selectAll(".filter_control").attr("disabled", true);
    }
    this.trigger_callback();
  }

  ValueSetFilterControls.prototype.refresh_values = function () {
    this.items_div.selectAll("*").remove();

    // Pick up values and labels from the filter's categorical transform
    var n_values = this.filter.ct.n_categories;
    var v_labels = this.filter.ct.labels;

    var the_controls = this;
    if (n_values <= LOTS_OF_VALUES_THRESHOLD) {
      this.selectors_div = this.items_div.append("div");
      this.selectors_div.attr("class", "scrolling");
      for (let i = 0; i < n_values; ++i) {
        this.selectors_div.append("input")
          .attr("type", "checkbox")
          .attr("checked", the_controls.filter.will_accept(i) ? true : null)
          .on("change", function () {
            the_controls.set_accept(i, this.checked);
          });

        // label
        this.selectors_div.append("span").text(" " + v_labels[i]);
        this.selectors_div.append("br");
      }
    } else { // too many values to use checkboxes
      this.selectors_div = this.items_div.append("div");
      this.selectors_div.attr("class", "selected_values scrolling");

      for (let i = 0; i < n_values; ++i) {
        if (the_controls.filter.will_accept(i)) {
          let match_item = this.selectors_div.append("span");
          match_item
            .attr("class", "match_item")
            .append("a")
              .attr("class", "re_button button")
              .text("×")
              .on("click touchend", function () {
                the_controls.set_accept(i, false);
                the_controls.refresh_values();
              })
          match_item.append("span").text(v_labels[i] + " ");
          match_item.append("br");
        }
      }

      if (this.add_selector) { this.add_selector.remove(); }

      var unsel = [];
      var unames = [];
      for (let i = 0; i < n_values; ++i) {
        if (!this.filter.will_accept(i)) {
          unsel.push(i);
          unames.push(v_labels[i]);
        }
      }

      this.add_selector = new TextSelectWidget(
        "+ ", // add a value
        unsel, // N integers
        undefined, // no default value
        function (selected) {
          var sel = Number.parseInt(selected);
          if (!the_controls.filter.will_accept(sel)) {
            the_controls.set_accept(sel, true);
            the_controls.refresh_values();
          }
        }, // callback
        unames, // option labels
        true // always blank the input on select
      );
      this.add_selector.put_controls(this.items_div);
    }

    // trigger a callback on refresh
    this.trigger_callback();
  }

  ValueSetFilterControls.prototype.put_controls = function (
    node,
    insert_before
  ) {
    Object.getPrototypeOf(
      ValueSetFilterControls.prototype
    ).put_controls.call(this, node, insert_before);
    var the_controls = this;

    // toggle checkbox:
    this.node.append("input")
      .attr("type", "checkbox")
      .attr("checked", this.active ? true : null)
      .on("change", function () {
        the_controls.set_active(this.checked)
      });

    // initial text:
    this.node.append("span")
      .attr("class", "label")
      .text("Accept values (");

    this.node.append("a").text("all")
      .on("click touchend", function () {
        the_controls.filter.accept_all();
        the_controls.refresh_values();
      });

    this.node.append("span").attr("class", "label").text("/");

    this.node.append("a").text("none")
      .on("click touchend", function () {
        the_controls.filter.accept_none();
        the_controls.refresh_values();
      });

    this.node.append("span").attr("class", "label").text(")");

    this.selector.remove();
    this.selector.put_controls(this.node);

    // bit of padding
    this.node.append("span").text(" ")

    this.items_div = this.node.append("div");

    // comparator select
    this.refresh_values();
  }

  ValueSetFilterControls.prototype.apply_filter = function (records) {
    if (this.active) {
      return this.filter.filter(records);
    } else {
      return records;
    }
  }

  ValueSetFilterControls.prototype.matching_indices = function (records) {
    if (this.active) {
      return this.filter.matching_indices(records);
    } else {
      return new Set(Array.from({length: records.length}, (x,i) => i));
    }
  }

  ValueSetFilterControls.prototype.config_string = function () {
    return this.filter.repr();
  }


  //////////////////////////
  // MultiFilter Controls //
  //////////////////////////

  // Available filter types
  var FILTER_TYPES = {
    "select…": ValueSetFilterControls,
    "compare…": ComparisonFilterControls,
  }

  // Controls for multiple filters that can be added or removed. The callback
  // will be called (without arguments) after every parameter change.
  function MultiFilterControls(dataset, callback) {
    BaseWidget.call(this);
    this.data = dataset;
    this.filters = [];
    this.callback = callback;
  }

  MultiFilterControls.prototype = Object.create(BaseWidget.prototype);
  MultiFilterControls.prototype.constructor = MultiFilterControls;

  MultiFilterControls.prototype.remove_filter = function (i) {
    this.filters[i].remove();
    this.filters.splice(i, 1);
    this.trigger_callback();
    if (this.node) { this.put_controls(); } // refresh controls if required
  }

  MultiFilterControls.prototype.add_filter = function (key) {
    var ft = FILTER_TYPES[key];
    var the_controls = this;
    this.filters.push(
      new ft(this.data, function () { the_controls.trigger_callback(); })
    );
    this.trigger_callback();
    if (this.node) { this.put_controls(); } // refresh controls if required
  }

  MultiFilterControls.prototype.put_controls = function (node, insert_before) {
    Object.getPrototypeOf(
      MultiFilterControls.prototype
    ).put_controls.call(this, node, insert_before);
    var the_controls = this;
    let tab = this.node.append("table").attr("class", "subfilters");
    for (let i = 0; i < this.filters.length; ++i) {
      let ctl = this.filters[i];
      ctl.remove(); // just in case
      let row = tab.append("tr").attr("class", "subfilter_row");
      row.append("td")
        .attr("class", "subfilter_action")
        .append("a")
          .attr("class", "red_button button")
          .text("×")
          .on("click touchend", function () { the_controls.remove_filter(i); });
      let sub = row.append("td").attr("class", "subfilter");
      ctl.put_controls(sub);
    }

    // add filter row:
    let row = tab.append("tr").attr("class", "subfilter_row");
    let sfa = row.append("td").attr("class", "subfilter_action");
    let pl_link = sfa.append("a")
        .attr("class", "blue_button button")
        .text("+");

    let sub = row.append("td").attr("class", "subfilter");
    var fts = sub.append("select");
    fts.selectAll("option")
      .data(Object.keys(FILTER_TYPES))
    .enter().append("option")
      .attr("value", d => d)
      .text(d => d);

    pl_link.on(
      "click touchend",
      function () {
        the_controls.add_filter(utils.get_selected_value(fts.node()));
      }
    );
  }

  MultiFilterControls.prototype.apply_filter = function (records) {
    records = records.slice();
    this.filters.forEach(function (ctl) {
      records = ctl.apply_filter(records);
    });
    return records;
  }

  MultiFilterControls.prototype.matching_indices = function (records) {
    var result = new Set(Array.from({length: records.length}, (x,i) => i));
    this.filters.forEach(function (ctl) {
      var fset = ctl.matching_indices(records);
      result = new Set([...result].filter(x => fset.has(x)));
    });
    return result;
  }

  MultiFilterControls.prototype.config_string = function () {
    return this.filters.map(ctl => ctl.config_string()).join(";");
  }

  //////////////////
  // Generic View //
  //////////////////

  function View(id, dataset, controls) {
    this.id = id;
    this.data = dataset;
    this.controls = controls || [];
    this.frame = undefined;
    this.controls_node = undefined;
  }

  // default does nothing
  View.prototype.update_size = function(fw, fh) {}

  // bind to a frame
  View.prototype.bind_frame = function(frame) {
    this.frame = frame;

    var fw = utils.get_width(frame);
    var fh = utils.get_height(frame);

    this.update_size(fw, fh);
  }

  // re-bind to an already bound frame
  View.prototype.rebind = function () {
    if (this.frame === undefined) {
      console.error("Can't rebind an unbound view!");
      console.error(this);
    } else {
      this.bind_frame(this.frame);
    }
  }

  // put our controls somewhere
  View.prototype.put_controls = function(node, insert_before) {
    if (node != undefined) {
      this.controls_node = node;
    } else {
      node = this.controls_node;
    }
    for (let i = 0; i < this.controls.length; ++i) {
      this.controls[i].put_controls(node, insert_before);
    }
  }

  View.prototype.remove_controls = function () {
    this.controls.forEach(function (c) {
      c.remove();
    });
  }

  // default does nothing
  View.prototype.draw = function() {}

  //////////////
  // LensView //
  //////////////

  // Minimum size of a quadtree cell (in SVG units ~= screen pixels)
  var DEFAULT_RESOLUTION = 4;

  // Minimum radius of the lens in SVG units (~= screen pixels)
  var MIN_LENS_RADIUS = 0.5;

  // Creates a new lens view of the given dataset.
  //
  // Note that after creating a view, it must be bound to a frame before it can
  // be drawn or its controls can be used, and if the x_index or y_index
  // weren't given, they need to be set first.
  function LensView(id, dataset, x_index, y_index) {
    View.call(this, id, dataset);
    this.show_density = false;
    this.hide_labels = false;
    this.selected = [];
    this.selection_listeners = [];
    this.separate_outliers = true;

    this.set_x_axis(x_index);
    this.set_y_axis(y_index);

    var the_view = this;

    this.controls.push(
      new ToggleWidget(
        "Hide selection count & axis labels",
        false,
        function (yes) {
          the_view.hide_labels = yes;
          the_view.draw(); // redraw
        }
      )
    );

    this.controls.push(
      new ToggleWidget(
        "Show point approximation (instead of density)",
        true,
        function (yes) {
          the_view.show_density = !yes;
          the_view.draw(); // redraw
        }
      )
    );

    this.controls.push(
      new SelectWidget(
        "Resolution: ",
        [2, 4, 8, 16, 32, 64],
        DEFAULT_RESOLUTION,
        function (value) {
          the_view.set_resolution(Number.parseInt(value));
          the_view.rebind();
          the_view.draw();
        }
      )
    );

    this.controls.push(
      new TextSelectWidget(
        "X-axis: ",
        function () { return ds.index_names(the_view.data); },
        function () { return ds.get_name(the_view.data, the_view.x_index); },
        function (iname) {
          the_view.set_x_axis(iname);
          the_view.rebind();
          the_view.draw();
        }
      )
    );

    this.controls.push(
      new TextSelectWidget(
        "Y-axis: ",
        function () { return ds.index_names(the_view.data); },
        function () { return ds.get_name(the_view.data, the_view.y_index); },
        function (iname) {
          the_view.set_y_axis(iname);
          the_view.rebind();
          the_view.draw();
        }
      )
    );

    this.controls.push(
      new TextSelectWidget(
        "Color by: ",
        function () {
          return ["density (default)"].concat(ds.index_names(the_view.data));
        },
        function () {
          if (the_view.c_index != undefined) {
            return ds.get_name(the_view.data, the_view.c_index);
          } else {
            return "density (default)";
          }
        },
        function (iname) {
          if (iname === "density (default)") {
            the_view.set_color_property(undefined);
          } else {
            the_view.set_color_property(iname);
          }
          the_view.draw();
        }
      )
    );

    this.color_widget = new ColorScaleWidget(
      "custom",
      "#000",
      "#ffb900", //"#a8ff00",
      "#303850",
      function () { the_view.draw(); }
    );
    this.controls.push(this.color_widget);

    this.controls.push(
      new TextSelectWidget(
        "Labels: ",
        function () {
          return ["none"].concat(ds.index_names(the_view.data));
        },
        function () {
          if (the_view.l_index != undefined) {
            return ds.get_name(the_view.data, the_view.l_index);
          } else {
            return "none";
          }
        },
        function (iname) {
          if (iname == "none") {
            the_view.set_labels(undefined);
          } else {
            the_view.set_labels(iname);
          }
          the_view.draw();
        }
      )
    );

    this.controls.push(
      new ToggleWidget(
        "Color outliers separately",
        true,
        function (yes) {
          the_view.separate_outliers = yes;
          if (the_view.c_index == undefined) {
            if (yes) {
              the_view.c_value = "standardized";
            } else {
              the_view.c_value = "density";
            }
          }
          the_view.draw(); // redraw
        }
      )
    );

    this.outlier_color_widget = new ColorWidget(
      "Outlier color:",
      "#a8ff00", // "#cc77ff",
      function (color) { the_view.draw(); }
    );
    this.controls.push(this.outlier_color_widget);
  }

  LensView.prototype = Object.create(View.prototype);
  LensView.prototype.constructor = LensView;


  // Updates the size; called when the frame is (re)bound.
  LensView.prototype.update_size = function(fw, fh) {
    var xr = this.x_domain[1] - this.x_domain[0];
    var yr = this.y_domain[1] - this.y_domain[0];
    if (xr == 0) { xr = 1; }
    if (yr == 0) { yr = 1; }
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
    if (this.resolution === undefined) {
      this.resolution = DEFAULT_RESOLUTION;
    }

    this.tree = qt.build_quadtree(
      this.data.records,
      [ [0, 0], [fw, fh] ],
      this.view_x,
      this.view_y,
      this.resolution
    );

    // set up default lens & shadow:
    this.lens = { "x": fw/2, "y": fh/2, "r": 20, "node": undefined };
    this.shadow = { "x": fw/2, "y": fh/2, "r": 20, "node": undefined };

    this.update_selection();
  }

  // Draws the given view into its bound frame (see bind_frame). Also sets up
  // some event bindings on the frame.
  LensView.prototype.draw = function() {

    // Reset the frame:
    this.frame.selectAll("*").remove();

    var fw = utils.get_width(this.frame);
    var fh = utils.get_height(this.frame);
    
    // quadtree first so that axes + labels go on top
    var dplot = this.frame.append("g")
      .attr("id", "qt_density")
      .attr("class", "density_plot");

    var the_view = this;

    viz.draw_quadtree(
      dplot,
      this.tree,
      function (v) {
        var dom = the_view.color_widget.get_domain();
        if (dom[0] <= v && v <= dom[1]) {
          return the_view.color_widget.get_gradient()(v);
        } else {
          return the_view.outlier_color_widget.color
        }
      },
      this.resolution,
      this.show_density,
      this.c_value,
      this.get_label
    );

    // selection count label
    var scl = this.frame.append("text")
      .attr("id", "select_count_label")
      .attr("class", "label")
      .attr("x", fw * 0.99)
      .attr("y", fh * 0.01)
      .style("text-anchor", "end")
      .style("dominant-baseline", "hanging")
      .text(this.selected.length + " items selected");

    if (this.hide_labels) { scl.style("display", "none"); }

    // x-axis:
    var xa = this.frame.append("g")
      .attr("id", this.id + "_x_axis")
      .attr("class", "x axis")
      .attr(
        "transform",
        "translate(0," + fh + ")"
      )
      .call(d3.axisBottom(this.x_scale))
    var xl = xa.append("text")
      .attr("class", "label")
      .attr("x", fw * 0.99)
      .attr("y", -fh * 0.01)
      .style("text-anchor", "end")
      .text(ds.get_name(this.data, this.x_index));

    if (this.hide_labels) { xl.style("display", "none"); }

    // y-axis
    var ya = this.frame.append("g")
      .attr("id", this.id + "_y_axis")
      .attr("class", "y axis")
      .call(d3.axisLeft(this.y_scale))
    var yl = ya.append("text")
      .attr("class", "label")
      .attr("transform", "rotate(-90)")
      .attr("x", -fw * 0.01)
      .attr("y", fw * 0.01)
      .style("text-anchor", "end")
      .style("dominant-baseline", "hanging")
      .text(ds.get_name(this.data, this.y_index));

    if (this.hide_labels) { yl.style("display", "none"); }

    // Add the lenses last
    dplot.append("g")
      .attr("id", "lens_group");

    this.lens.node = dplot.select("#lens_group").append("circle")
      .attr("id", this.id + "_lens")
      .attr("class", "lens")
      .attr("cx", this.lens.x)
      .attr("cy", this.lens.y)
      .attr("r", this.lens.r)
      .attr("z-index", "10");

    this.shadow.node = dplot.select("#lens_group").append("circle")
      .attr("id", this.id + "_shadow")
      .attr("class", "lens_shadow")
      .attr("cx", this.shadow.x)
      .attr("cy", this.shadow.y)
      .attr("r", this.shadow.r)
      .attr("z-index", "10");

    // Lens tracking:
    var svg = this.frame.node();
    while (svg.nodeName != "svg" && svg.parentNode) {
      svg = svg.parentNode;
    }
    svg = d3.select(svg);
    var the_view = this;
    svg.on("mousemove touchmove", function () {
      var coords = d3.mouse(the_view.frame.node());

      if (the_view.shadow.node != undefined) {
        the_view.shadow.x = coords[0];
        the_view.shadow.y = coords[1];
        the_view.shadow.node.attr("cx", the_view.shadow.x);
        the_view.shadow.node.attr("cy", the_view.shadow.y);
      }
    });

    svg.on("click touchend", function () {
      the_view.lens.x = the_view.shadow.x;
      the_view.lens.y = the_view.shadow.y;
      the_view.lens.r = the_view.shadow.r;

      if (the_view.lens.node != undefined) {
        // Update the lens
        the_view.lens.node.attr("cx", the_view.lens.x);
        the_view.lens.node.attr("cy", the_view.lens.y);
        the_view.lens.node.attr("r", the_view.lens.r);

        the_view.update_selection();
      }
    });

    svg.on("mousewheel", function () {
      var e = d3.event;
      e.preventDefault();

      if (the_view.shadow.node != undefined) {
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
        the_view.shadow.r *= (1 + 0.01 * dy / SCROLL_FACTOR);
        if (the_view.shadow.r < MIN_LENS_RADIUS) {
          the_view.shadow.r = MIN_LENS_RADIUS;
        }
        the_view.shadow.node.attr("r", the_view.shadow.r);
      }
    });
  }

  // Subscribe a callback to trigger on selection updates. Callbacks receive
  // two arguments: an array of selected items, and the entire view object.
  LensView.prototype.subscribe_to_selection = function(callback) {
    this.selection_listeners.push(callback);
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
    // Update selection count label
    this.frame.select("#select_count_label")
      .text(this.selected.length + " items selected");
  }

  // Sets the coloring property for a view; use 'undefined' as the index to
  // revert to default coloring (by point density).
  LensView.prototype.set_color_property = function(c_index) {
    if (typeof c_index === "string") {
      c_index = ds.lookup_index(this.data, c_index);
    }
    this.c_index = c_index;
    if (c_index != undefined) {
      if (this.separate_outliers) {
        var om = ds.outlier_model(this.data, c_index);
        this.c_value = function (d) {
          return om.normalized(d);
        };
      } else {
        var nt = ds.numerical_transform(this.data, c_index);
        this.c_value = function (d) {
          return (nt.getter(d) - nt.domain[0]) / (nt.domain[1] - nt.domain[0]);
        };
      }
    } else {
      if (this.separate_outliers) {
        this.c_value = "standardized";
      } else {
        this.c_value = "density";
      }
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

  // Sets the grid resolution. Call rebind afterwards to rebuild the quadtree.
  LensView.prototype.set_resolution = function (res) {
    if (typeof res === "string") {
      res = Number.parseInt(res);
    }
    this.resolution = res;
  }

  // Replaces the old x-axis of the domain. Usually requires re-binding the
  // domain to its frame afterwards.
  LensView.prototype.set_x_axis = function(x_index) {
    if (typeof x_index === "string") {
      x_index = ds.lookup_index(this.data, x_index);
    }
    this.x_index = x_index;
    this.x_type = ds.get_type(this.data, x_index);

    var nx = ds.numerical_transform(this.data, x_index);
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

    var ny = ds.numerical_transform(this.data, y_index);
    this.y_domain = ny.domain;
    this.raw_y = ny.getter;
  }

  ///////////////
  // Histogram //
  ///////////////

  // Default # of bins to use when the data doesn't suggest a number
  var DEFAULT_BINS = 10;

  // Maximum number of discrete values to bin as exact values instead of using
  // numerical ranges.
  var MAX_DISCRETE_BINS = 30;

  // Creates a histogram of values in the given field using just the given
  // records from the given dataset.
  //
  // See "set_flags" for possible keys in the flags object (it can be left
  // undefined to use defaults).
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
  // If bar_limit isn't given, it will default to no limit.
  function Histogram(
    id,
    dataset,
    records,
    field,
    flags,
    bins,
    domain,
    bar_limit
  ) {
    View.call(this, id, dataset);
    this.records = records;
    this.bins = bins;
    this.domain = domain;
    this.bar_limit = bar_limit;

    this.flags = {
      "force_counts": false,
      "average": false,
      "normalize": false,
      "sort": false,
    }

    // set field & mode and compute counts
    this.set_flags(flags);
    this.set_field(field);
    this.update();

    // set up widgets:
    var the_view = this;

    this.controls.push(
      new TextSelectWidget(
        "Field: ",
        function () { return ds.index_names(the_view.data); },
        function () { return ds.get_name(the_view.data, the_view.field) },
        function (iname) {
          the_view.set_field(iname);
          the_view.update();
          the_view.draw();
        }
      )
    );

    this.controls.push(
      new ToggleWidget(
        "Sort by largest first (otherwise use natural order)",
        this.flags.sort,
        function (yes) {
          the_view.flags.sort = yes;
          the_view.update();
          the_view.draw();
        }
      )
    )

    this.controls.push(
      new ToggleWidget(
        "Count non-zero/non-missing values (even when values could be summed)",
        this.flags.force_counts,
        function (yes) {
          the_view.flags.force_counts = yes;
          the_view.update();
          the_view.draw();
        }
      )
    );

    this.controls.push(
      new ToggleWidget(
        "Average values in bins (instead of summing them)",
        this.flags.average,
        function (yes) {
          the_view.flags.average = yes;
          the_view.update();
          the_view.draw();
        }
      )
    );

    this.controls.push(
      new ToggleWidget(
        "Normalzie values (relative to largest)",
        this.flags.normalize,
        function (yes) {
          the_view.flags.normalize = yes;
          the_view.update();
          the_view.draw();
        }
      )
    );

    var limit_options = [
      "<no limit>", 1, 3, 5, 10, 20, 30, 50, 100
    ]
    if (this.bar_limit && limit_options.indexOf(this.bar_limit) == -1) {
      var nopts = ["<no limit>"];
      for (let i = 1; i < limit_options.length; ++i) {
        var next = limit_options[i];
        if (this.bar_limit < next) {
          nopts.push(this.bar_limit);
        }
        nopts.push(next);
      }
      limit_options = nopts;
    }
    this.controls.push(
      new SelectWidget(
        "Show only the top: ",
        limit_options,
        (this.bar_limit || "<no limit>") + "",
        function (selected) {
          var bl;
          if (selected == "<no limit>") {
            bl = undefined;
          } else {
            bl = Number.parseInt(selected);
          }
          the_view.bar_limit = bl;
          the_view.update();
          the_view.draw();
        }
      )
    );

    var bins_options = [
      "<auto>", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 30, 50, 100
    ]
    this.controls.push(
      new SelectWidget(
        "Number of bins: ",
        bins_options,
        (this.bins || "<auto>") + "",
        function (selected) {
          var bn;
          if (selected == "<auto>") {
            bn = undefined;
          } else {
            bn = Number.parseInt(selected);
          }
          the_view.bins = bn;
          the_view.update();
          the_view.draw();
        }
      )
    );

    this.color_widget = new ColorScaleWidget(
      "flat",
      "#6688cc",
      "#f0e8c8",
      "#631200",
      function () { the_view.draw(); }
    );
    this.controls.push(this.color_widget);
  }

  Histogram.prototype = Object.create(View.prototype);
  Histogram.prototype.constructor = Histogram;

  // Reassigns the field for this histogram. update should be called
  // afterwards.
  Histogram.prototype.set_field = function (field) {
    if (typeof field === "string") {
      field = ds.lookup_index(this.data, field);
    }
    this.field = field;
  }

  // Reassigns the record set for this histogram. update should be called to
  // update the counts.
  Histogram.prototype.set_records = function (records) {
    this.records = records;
  }

  // Changes the counting mode. Flags should be an object with some or all of
  // the following keys:
  //
  // force_counts
  //   Whether to force counts or use values when available.
  // average
  //   Whether to average or sum values.
  // normalize
  //   Whether to normalize results.
  // sort
  //   Whether to sort by bar length or not.
  //
  // Call update afterwards.
  Histogram.prototype.set_flags = function (flags) {
    if (flags === undefined) { flags = {} };
    this.flags = Object.assign(this.flags, flags);
  }

  // (Re-)computes the counts for this histogram.
  Histogram.prototype.compute_counts = function () {
    var ft = ds.get_type(this.data, this.field);
    this.counts = {};
    var bins = this.bins;
    if (ft.kind === "number") {
      var dom;
      var used_discrete = false;
      if (bins == undefined) {
        // count distinct values to see if there are only a few
        var discrete_names = [];
        var discrete_count = 0;
        var discrete = {};
        for (let i = 0; i < this.records.length; ++i) {
          var val = ds.get_field(this.data, this.records[i], this.field);
          if (discrete.hasOwnProperty(val)) {
            discrete[val] += 1;
          } else {
            discrete_count += 1;
            discrete_names.push(val)
            discrete[val] = 1;
          }
        }
        if (discrete_count <= MAX_DISCRETE_BINS) {
          discrete_names.sort((a, b) => a - b);
          this.counts = discrete;
          this.bin_names = discrete_names;
          used_discrete = true;
        }
      }

      if (!used_discrete) { // if the discrete attempt failed
        bins = bins || DEFAULT_BINS;
        if (this.domain === undefined) {
          dom = ds.get_domain(this.data, this.field);
        } else if (this.domain === "auto") {
          dom = [undefined, undefined];
          for (let i = 0; i < this.records.length; ++i) {
            var val = ds.get_field(this.data, this.records[i], this.field);
            if (dom[0] === undefined || dom[0] > val) { dom[0] = val; }
            if (dom[1] === undefined || dom[1] < val) { dom[1] = val; }
          }
        } else {
          dom = this.domain;
        }
        var bs = (dom[1] - dom[0]) / bins;
        this.bin_names = [];
        for (let i = 0; i < bins; ++i) {
          this.bin_names.push(
            "" + (dom[0] + bs * i).toPrecision(2) + "–"
          + (dom[0] + bs * (i + 1)).toPrecision(2)
          );
        }
        for (let i = 0; i < this.records.length; ++i) {
          var val = ds.get_field(this.data, this.records[i], this.field);
          var bin;
          if (val == dom[0] + bs * bins) {
            bin = bins-1; // let the last bin be inclusive
          } else {
            bin = Math.floor((val - dom[0]) / bs);
          }
          var bn = this.bin_names[bin];
          if (this.counts.hasOwnProperty(bn)) {
            this.counts[bn] += 1;
          } else {
            this.counts[bn] = 1;
          }
        }
      }
    } else if (ft.kind === "string") {
      this.bin_names = [];
      bin_ints = true;
      for (let i = 0; i < this.records.length; ++i) {
        var val = ds.get_field(this.data, this.records[i], this.field);
        if (this.counts.hasOwnProperty(val)) {
          this.counts[val] += 1;
        } else {
          this.bin_names.push(val);
          var match = val.match(FIND_INT)
          if (match == null) {
            bin_ints = false;
          }
          this.counts[val] = 1;
        }
      }
      if (bin_ints) {
        this.bin_names.sort(
          (a, b) =>
            Number.parseInt(a.match(FIND_INT)[0])
          - Number.parseInt(b.match(FIND_INT)[0])
        );
      } else {
        this.bin_names.sort();
      }
    } else if (ft.kind === "tensor" && ft.value_type.kind === "number") {
      // tensor of numbers
      this.bin_names = [];
      var tdim = ft.dimensions.reduce((a, b) => a * b);
      for (let j = 0; j < tdim; ++j) {
        seq_idx = prp.rollup_index(ft.dimensions, j);
        this.bin_names.push(ds.get_inner_name(this.data, this.field, seq_idx));
      }
      for (let i = 0; i < this.records.length; ++i) {
        for (let j = 0; j < tdim; ++j) {
          var seq_idx = prp.rollup_index(ft.dimensions, j);
          var full_idx = this.field.concat(seq_idx);
          var val = ds.get_field(
            this.data,
            this.records[i],
            full_idx
          );
          var key = ds.get_name(this.data, full_idx);
          if (this.flags.force_counts) {
            if (this.counts.hasOwnProperty(key)) {
              this.counts[key] += 1;
            } else {
              this.counts[key] = 1;
            }
          } else {
            if (this.counts.hasOwnProperty(key)) {
              this.counts[key] += val;
            } else {
              this.counts[key] = val;
            }
          }
        }
      }
    } else if (ft.kind === "tensor") {
      // TODO: HERE?!
      console.warn("Unmanageable tensor type");
      console.warn(ft);
    } else if (ft.kind === "map") {
      this.bin_names = [];
      var all_numeric = true;
      for (var k in ft.subtypes) {
        if (ft.subtypes.hasOwnProperty(k)) {
          if (ft.subtypes[k].kind != "number") {
            all_numeric = false;
            break;
          }
        }
      }
      for (let i = 0; i < this.records.length; ++i) {
        var val = ds.get_field(this.data, this.records[i], this.field);
        for (var k in val) {
          if (val.hasOwnProperty(k)) {
            var name = ds.get_inner_name(this.data, this.field, [ k ]);
            if (val[k] != undefined && val[k] != null && val[k] != 0) {
              if (this.flags.force_counts || !all_numeric) {
                if (this.counts.hasOwnProperty(name)) {
                  this.counts[name] += 1;
                } else {
                  this.bin_names.push(name);
                  this.counts[name] = 1;
                }
              } else {
                var sv = val[k];
                if (this.counts.hasOwnProperty(name)) {
                  this.counts[name] += sv;
                } else {
                  this.bin_names.push(name);
                  this.counts[name] = sv;
                }
              }
            }
          }
        }
      }
    } else {
      // Don't know how to make a histogram out of that...
      this.bin_names = [];
      this.counts = undefined;
    }

    if (this.flags.average) {
      for (var k in this.counts) {
        if (this.counts.hasOwnProperty(k)) {
          this.counts[k] /= this.records.length;
        }
      }
    }

    if (this.flags.normalize) {
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

  // update alias
  Histogram.prototype.update = Histogram.prototype.compute_counts;

  Histogram.prototype.draw = function() {
    // Reset the frame:
    this.frame.selectAll("*").remove();

    if (this.counts === undefined) {
      this.frame.append("text")
        .attr("id", this.id + "_placeholder")
        .attr("class", "label")
        .attr("x", utils.get_width(this.frame)/2)
        .attr("y", utils.get_height(this.frame)/2)
        .style("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .text(
          "Don't know how to create a histogram for: '"
        + ds.get_name(this.data, this.field) + "'"
        );
    } else {

      var fw = utils.get_width(this.frame);
      var fh = utils.get_height(this.frame);

      viz.draw_histogram(
        this.frame,
        this.counts,
        this.bin_names,
        this.bar_limit,
        this.color_widget.get_gradient(),
        this.flags.sort,
      );
    }
  }

  ////////////
  // Matrix //
  ////////////

  function Matrix(id, dataset, records, cols_field, rows_field, vals_field) {
    View.call(this, id, dataset);
    this.records = records || this.data.records;

    this.set_cols(cols_field);
    this.set_rows(rows_field);
    this.set_value(vals_field);

    this.update();

    var the_view = this;

    this.controls.push(
      new TextSelectWidget(
        "Rows: ",
        function () { return ["none"].concat(ds.index_names(the_view.data)); },
        function () { return ds.get_name(the_view.data, the_view.rows_field); },
        function (iname) {
          if (iname == "none") {
            the_view.set_rows(undefined);
          } else {
            the_view.set_rows(iname);
          }
          the_view.update();
          the_view.rebind();
          the_view.draw();
        }
      )
    );

    this.controls.push(
      new TextSelectWidget(
        "Columns: ",
        function () { return ["none"].concat(ds.index_names(the_view.data)); },
        function () { return ds.get_name(the_view.data, the_view.cols_field); },
        function (iname) {
          if (iname == "none") {
            the_view.set_cols(undefined);
          } else {
            the_view.set_cols(iname);
          }
          the_view.update();
          the_view.rebind();
          the_view.draw();
        }
      )
    );

    this.controls.push(
      new TextSelectWidget(
        "Value: ",
        function () { return ["none"].concat(ds.index_names(the_view.data)); },
        function () { return ds.get_name(the_view.data, the_view.vals_field); },
        function (iname) {
          if (iname == "none") {
            the_view.set_value(undefined);
          } else {
            the_view.set_value(iname);
          }
          the_view.update();
          the_view.rebind();
          the_view.draw();
        }
      )
    );

    this.color_scale_widget = new ColorScaleWidget(
      "custom",
      "#6688cc",
      "#ffd1fe",
      "#ffdf00",
      function () { the_view.draw(); }
    );
    this.controls.push(this.color_scale_widget);

    this.label_color_widget = new ColorWidget(
      "Label color: ",
      "#000000",
      function () { the_view.draw(); }
    );
    this.controls.push(this.label_color_widget);

    this.missing_color_widget = new ColorWidget(
      "Missing color: ",
      "#ffffff",
      function () { the_view.draw(); }
    );
    this.controls.push(this.missing_color_widget);
  }

  Matrix.prototype = Object.create(View.prototype);
  Matrix.prototype.constructor = Matrix;

  // Updates the row mapping; call update afterwards.
  Matrix.prototype.set_rows = function (index) {
    if (index == undefined) {
      this.rows_field = undefined;
      this.n_rows = 1;
      this.row_labels = [ "" ];
      this.rows_getter = (d, i) => i == 0 ? 1 : undefined;
    } else {
      if (typeof index === "string") {
        index = ds.lookup_index(this.data, index);
      }
      this.rows_field = index;

      var cx = ds.categorical_transform(this.data, index);
      this.n_rows = cx.n_categories;
      this.row_labels = cx.labels;
      this.rows_getter = cx.getter;
    }
  }

  // Updates the column mapping; call update afterwards.
  Matrix.prototype.set_cols = function (index) {
    if (index == undefined) {
      this.cols_field = undefined;
      this.n_cols = 1;
      this.col_labels = [ "" ];
      this.cols_getter = (d, i) => i == 0 ? 1 : undefined;
    } else {
      if (typeof index === "string") {
        index = ds.lookup_index(this.data, index);
      }
      this.cols_field = index;

      var cx = ds.categorical_transform(this.data, index);
      this.n_cols = cx.n_categories;
      this.col_labels = cx.labels;
      this.cols_getter = cx.getter;
    }
  }

  // Updates the value mapping; call update afterwards.
  Matrix.prototype.set_value = function (index) {
    if (typeof index === "string") {
      index = ds.lookup_index(this.data, index);
    }
    this.vals_field = index;

    if (index == undefined) {
      this.val_domain = [1, 1];
      this.get_val = d => 1;
    } else {
      var nx = ds.numerical_transform(this.data, index);
      this.val_domain = nx.domain;
      this.get_val = nx.getter;
    }
  }

  // Updates the records; call update afterwards.
  Matrix.prototype.set_records = function (records) {
    this.records = records;
  }

  // Computes the matrix values by multiplying categorical values from the row
  // and column fields. If either value is undefined for a record, that record
  // won't contribute to that cell.
  Matrix.prototype.compute_matrix = function () {
    this.matrix = [[]];
    this.counts = [[]];
    this.stdevs = [[]];

    this.full_domain = [undefined, undefined];

    for (let i = 0; i < this.records.length; ++i) {
      var r = this.records[i];
      var val = this.get_val(r);

      for (let col = 0; col < this.n_cols; ++col) {
        if (this.counts[col] == undefined) {
          this.counts[col] = [];
          this.matrix[col] = [];
          this.stdevs[col] = [];
        }
        var cv = this.cols_getter(r, col);
        if (cv == undefined) {
          continue;
        }
        for (let row = 0; row < this.n_rows; ++row) {
          var rv = this.rows_getter(r, row);
          if (rv == undefined) {
            continue;
          }
          var cell_val = cv * rv * val
          if (
            this.full_domain[0] == undefined
         || cell_val < this.full_domain[0]
          ) {
            this.full_domain[0] = cell_val;
          }
          if (
            this.full_domain[1] == undefined
         || cell_val > this.full_domain[1]
          ) {
            this.full_domain[1] = cell_val;
          }
          var nc;
          if (this.counts[col][row] == undefined) {
            nc = 1;
            this.counts[col][row] = nc;
            this.matrix[col][row] = cell_val;
            this.stdevs[col][row] = 0;
          } else {
            nc = this.counts[col][row] + 1;
            this.counts[col][row] = nc;
            var om = this.matrix[col][row];
            var delta = cell_val - om;
            var nm = om + delta / nc
            var d2 = cell_val - nm; 
            this.matrix[col][row] = nm;
            this.stdevs[col][row] += delta * d2;
          }
        }
      }
    }

    // everything might be empty:
    this.empty_rows = new Set(Array.from({length: this.n_rows}, (x,i) => i));
    this.empty_cols = new Set(Array.from({length: this.n_cols}, (x,i) => i));

    // polish standard deviations, fill in missing counts as zeros, and find
    // empty rows/columns
    for (let c = 0; c < this.n_cols; ++c) {
      for (let r = 0; r < this.n_rows; ++r) {
        if (this.counts[c] == undefined) {
          this.counts[c] = [];
          this.matrix[c] = [];
          this.stdevs[c] = [];
        }
        var cv = this.counts[c][r];
        if (cv == undefined) {
          this.counts[c][r] = 0;
          this.matrix[c][r] = NaN;
          this.stdevs[c][r] = NaN;
        } else {
          this.empty_cols.delete(c);
          this.empty_rows.delete(r);
          if (cv > 1) {
            var sv = this.stdevs[c][r];
            this.stdevs[c][r] = Math.sqrt(sv / (cv - 1));
          } else {
            this.stdevs[c][r] = 0;
          }
        }
      }
    }
  }

  // update alias
  Matrix.prototype.update = Matrix.prototype.compute_matrix;

  Matrix.prototype.draw = function() {
    // Reset the frame:
    this.frame.selectAll("*").remove();

    var reduced_col_labels = this.col_labels.filter(
      (x, i) => !this.empty_cols.has(i)
    );
    var reduced_row_labels = this.row_labels.filter(
      (x, i) => !this.empty_rows.has(i)
    );

    var reduced_matrix = [];
    for (var c = 0; c < this.n_cols; ++c) {
      if (this.empty_cols.has(c)) { continue; }
      var this_col = [];
      reduced_matrix.push(this_col);
      for (var r = 0; r < this.n_rows; ++r) {
        if (this.empty_rows.has(r)) { continue; }
        this_col.push(this.matrix[c][r]);
      }
    }

    viz.draw_matrix(
      this.frame,
      reduced_matrix,
      /*
      this.counts,
      this.stdevs,
      */
      this.full_domain,
      reduced_col_labels,
      reduced_row_labels,
      this.color_scale_widget.get_gradient(),
      this.missing_color_widget.color,
      this.label_color_widget.color,
    );
  }

  ////////////////////
  // Module Exports //
  ////////////////////

  return {
    "BaseWidget": BaseWidget,
    "ToggleWidget": ToggleWidget,
    "HelpWidget": HelpWidget,
    "ButtonWidget": ButtonWidget,
    "SelectWidget": SelectWidget,
    "TextSelectWidget": TextSelectWidget,
    "ColorScaleWidget": ColorScaleWidget,
    "MultiselectWidget": MultiselectWidget,
    "ComparisonFilterControls": ComparisonFilterControls,
    "ValueSetFilterControls": ValueSetFilterControls,
    "MultiFilterControls": MultiFilterControls,
    "View": View,
    "LensView": LensView,
    "Histogram": Histogram,
    "Matrix": Matrix,
  };
});

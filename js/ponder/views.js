define(
[
  "d3",
  "d3-scale-chromatic",
  "./utils",
  "./quadtree",
  "./dataset",
  "./properties",
  "./filters",
  "./viz",
  "./vector"
],
function (d3, d3sc, utils, qt, ds, prp, fl, viz, v) {

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

  // Width (in pixels) that help text boxes will attempt to clear from the
  // right side of the screen during pre-placement adjustments.
  var HELP_CLEAR_WIDTH = 240;

  // Minimum margin between help boxes and the edges of the page.
  var HELP_MARGIN = 3;

  // Factor used for zooming with the scroll wheel.
  var ZOOM_FACTOR = 0.1;

  ////////////////
  // BaseWidget //
  ////////////////
  // Shared widget functionality

  function BaseWidget() {
    this.node == undefined;
  }

  BaseWidget.prototype.put_controls = function (node, insert_before) {
    if (node != this.node && node != undefined && this.node != undefined) {
      this.remove();
    }
    if (this.node == undefined) {
      if (node == undefined) { return false; } // we have nowhere to go
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
    return true; // placed successfully
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
    if (
      !Object.getPrototypeOf(
        HelpWidget.prototype
      ).put_controls.call(this, node, insert_before)
    ) { return false; };
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
        if (the_widget.popup) {
          the_widget.popup.remove();
          the_widget.popup = undefined;
        }
        var html = d3.select("html").node();
        let scroll_x = html.scrollLeft;
        let scroll_y = html.scrollTop;
        let el_top = bbox.y + scroll_y;
        let el_left = bbox.x + scroll_x;
        let orig_bottom = html.scrollHeight;
        let orig_right = html.scrollWidth;
        if (el_left + HELP_CLEAR_WIDTH > orig_right - HELP_MARGIN) {
          el_left = orig_right - HELP_MARGIN - HELP_CLEAR_WIDTH;
        }
        the_widget.popup = d3.select("body").append("div")
          .attr("class", "help")
          .style("top", el_top + "px")
          .style("left", el_left + "px")
          .style("position", "absolute")
          .text(text)
          .on("mouseout", function () {
            if (the_widget.popup) {
              the_widget.popup.remove();
              the_widget.popup = undefined;
            }
          });
        let sh = the_widget.popup.node().scrollHeight;
        if (sh >= orig_bottom - 2*HELP_MARGIN) { // to big to fit
          the_widget.popup.style("top", HELP_MARGIN + "px");
        } else if (el_top + sh > orig_bottom - HELP_MARGIN) {
          the_widget.popup.style("top", "");
          the_widget.popup.style("bottom", (HELP_MARGIN - scroll_y) + "px");
        }
        let sw = the_widget.popup.node().scrollWidth;
        if (sw >= orig_right - 2*HELP_MARGIN) { // to big to fit
          the_widget.popup.style("left", HELP_MARGIN + "px");
        } else if (el_left + sw > orig_right - HELP_MARGIN) {
          the_widget.popup.style("left", "");
          the_widget.popup.style("right", (HELP_MARGIN - scroll_x) + "px");
        }
      });
    return true;
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
    if (
      !Object.getPrototypeOf(
        ButtonWidget.prototype
      ).put_controls.call(this, node, insert_before)
    ) { return false };
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
    return true;
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
    if (
      !Object.getPrototypeOf(
        ToggleWidget.prototype
      ).put_controls.call(this, node, insert_before)
    ) { return false; }
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
    return true;
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
    if (
      !Object.getPrototypeOf(
        SelectWidget.prototype
      ).put_controls.call(this, node, insert_before)
    ) { return false; }
    var ltext;
    if (typeof this.label === "function") {
      ltext = this.label(this);
    } else {
      ltext = this.label;
    }
    this.node.append("span").attr("class", "label").text(ltext);
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
    return true;
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
    if (
      !Object.getPrototypeOf(
        TextSelectWidget.prototype
      ).put_controls.call(this, node, insert_before)
    ) { return false; }
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
    return true;
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
    if (
      !Object.getPrototypeOf(
        ColorWidget.prototype
      ).put_controls.call(this, node, insert_before)
    ) { return false; }
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
    return true;
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
    if (
      !Object.getPrototypeOf(
        ColorScaleWidget.prototype
      ).put_controls.call(this, node, insert_before)
    ) { return false; }
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
    return true;
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
    if (
      !Object.getPrototypeOf(
        MultiselectWidget.prototype
      ).put_controls.call(this, node, insert_before)
    ) { return false; }
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
    return true;
  }

  /////////////////////
  // SetSelectWidget //
  /////////////////////

  // A widget that allows selecting a subset of items from a list. The callback
  // will be called with a Set of selected values whenever the selection
  // changes. The default is no items selected.
  function SetSelectWidget(label, items, callback) {
    BaseWidget.call(this);
    this.label = label;
    this.selected = new Set();
    if (typeof items === "function") {
      this.items = items();
    } else {
      this.items = items;
    }
    var the_controls = this;
    this.callback = callback;
  }

  SetSelectWidget.prototype = Object.create(BaseWidget.prototype);
  SetSelectWidget.prototype.constructor = SetSelectWidget;

  SetSelectWidget.prototype.select = function (item) {
    this.selected.add(item);
    this.trigger_callback(this.selected);
  }

  SetSelectWidget.prototype.deselect = function (item) {
    this.selected.delete(item);
    this.trigger_callback(this.selected);
  }

  SetSelectWidget.prototype.refresh_values = function () {
    this.items_div.selectAll("*").remove();

    var the_controls = this;
    if (this.items.length <= LOTS_OF_VALUES_THRESHOLD) {
      this.selectors_div = this.items_div.append("div");
      this.selectors_div.attr("class", "scrolling");
      for (let item of this.items) {
        this.selectors_div.append("input")
          .attr("type", "checkbox")
          .attr("checked", the_controls.selected.has(item) ? true : null)
          .on("change", function () {
            if (this.checked) {
              the_controls.select(item);
            } else {
              the_controls.deselect(item);
            }
          });

        // label
        this.selectors_div.append("span").text(" " + item);
        this.selectors_div.append("br");
      }
    } else { // too many values to use checkboxes
      this.selectors_div = this.items_div.append("div");
      this.selectors_div.attr("class", "selected_values scrolling");

      for (let item of this.items) {
        if (the_controls.selected.has(item)) {
          let match_item = this.selectors_div.append("span");
          match_item
            .attr("class", "match_item")
            .append("a")
              .attr("class", "red_button button")
              .text("×")
              .on("click touchend", function () {
                the_controls.deselect(item);
                match_item.remove();
              })
          match_item.append("span").text(item + " ");
          match_item.append("br");
        }
      }

      if (this.add_selector) { this.add_selector.remove(); }

      var unsel = [];
      for (let item of this.items) {
        if (!this.selected.has(item)) {
          unsel.push(item);
        }
      }

      this.add_selector = new TextSelectWidget(
        "+ ", // add a value
        unsel, // unselected items
        undefined, // no default value
        function (selected) {
          if (!the_controls.selected.has(selected)) {
            the_controls.select(selected);
            the_controls.refresh_values();
          }
        }, // callback
        undefined, // no alternate labels
        true // always blank the input on select
      );
      this.add_selector.put_controls(this.items_div);
    }
  }

  SetSelectWidget.prototype.put_controls = function (
    node,
    insert_before
  ) {
    if (
      !Object.getPrototypeOf(
        SetSelectWidget.prototype
      ).put_controls.call(this, node, insert_before)
    ) { return false; }
    var the_controls = this;

    // initial text:
    this.node.append("span")
      .attr("class", "label")
      .text(this.label + " (");

    this.node.append("a").text("all")
      .on("click touchend", function () {
        for (let item of the_controls.items) {
          the_controls.selected.add(item);
        }
        the_controls.trigger_callback(the_controls.selected);
        the_controls.refresh_values();
      });

    this.node.append("span").attr("class", "label").text("/");

    this.node.append("a").text("none")
      .on("click touchend", function () {
        the_controls.selected = new Set();
        the_controls.trigger_callback(the_controls.selected);
        the_controls.refresh_values();
      });

    this.node.append("span").attr("class", "label").text(")");

    // bit of padding
    this.node.append("span").text(" ")

    this.items_div = this.node.append("div");

    // comparator select
    this.refresh_values();
    return true;
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
    if (
      !Object.getPrototypeOf(
        ComparisonFilterControls.prototype
      ).put_controls.call(this, node, insert_before)
    ) { return false; }
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
    return true;
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
              .attr("class", "red_button button")
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
    if (
      !Object.getPrototypeOf(
        ValueSetFilterControls.prototype
      ).put_controls.call(this, node, insert_before)
    ) { return false; }
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
    return true;
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
  // TODO: Avoid locking up the page when the default select target index has
  // too many values to create a categorical map of in a reasonable amount of
  // time.
  function MultiFilterControls(dataset, callback, label) {
    BaseWidget.call(this);
    this.data = dataset;
    if (label == undefined) {
      this.label = "Criteria:";
    } else {
      this.label = label;
    }
    this.filters = [];
    this.callback = callback;
    this.help = new HelpWidget(
      "This control allows you to specify a set of filtering criteria. Use "
    + "the '+' button to add a new filter block (results must pass each block "
    + "to pass the combined filter). Filter blocks either 'select' a set of "
    + "accepted values, or 'compare' numerical values against a threshold "
    + "using a specific comparison operation. The field used in each block "
    + "can be selected independently, and added blocks may also be removed by "
    + "clicking the 'x' button on their left-hand side."
    );
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
    if (
      !Object.getPrototypeOf(
        MultiFilterControls.prototype
      ).put_controls.call(this, node, insert_before)
    ) { return false; }
    let ltext;
    if (typeof this.label === "function") {
      ltext = this.label();
    } else {
      ltext = this.label;
    }
    this.node.append("span")
      .attr("class", "label")
      .text(ltext);
    this.help.put_controls(this.node);
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
    return true;
  }

  MultiFilterControls.prototype.remove = function () {
    this.help.remove();
    Object.getPrototypeOf(MultiFilterControls.prototype).remove.call(this);
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

  function View(id, dataset, controls, help) {
    this.id = id;
    this.data = dataset;
    this.controls = controls || [];
    this.help = help || [];
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
      if (this.controls_node != undefined) {
        this.remove_controls();
      }
      this.controls_node = node;
    } else {
      if (this.controls_node == undefined) {
        return false; // nowhere to go
      }
      node = this.controls_node;
    }
    for (let i = 0; i < this.controls.length; ++i) {
      this.controls[i].put_controls(node, insert_before);
      if (this.help[i]) {
        this.controls[i].node.append("span").text(viz.NBSP);
        this.help[i].remove();
        this.help[i].put_controls(this.controls[i].node);
      }
    }
    return true;
  }

  View.prototype.remove_controls = function () {
    this.controls.forEach(function (c) {
      c.remove();
    });
    this.help.forEach(function (h) {
      h.remove();
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
    this.tool = "zoom";
    this.drag_start = undefined;
    this.drag_current = undefined;
    this.drag_end = undefined;
    this.selected = [];
    this.selection_listeners = [];
    this.separate_outliers = true;
    this.display_label = undefined;
    this.size = undefined;
    this.viewport = { // these are in data-coordinates, not view-coordinates
      "min_x": undefined,
      "max_x": undefined,
      "min_y": undefined,
      "max_y": undefined,
    };

    // set up axes and establish default viewport:
    this.set_x_axis(x_index);
    this.set_y_axis(y_index);
    this.reset_viewport();

    var the_view = this;

    this.controls.push(
      new SelectWidget(
        "Tool: ",
        [ "zoom", "select" ],
        "zoom",
        function (value) {
          the_view.set_tool(value);
        }
      )
    );

    this.help.push(
      new HelpWidget(
        "Choose whether to use the mouse to select items, or to zoom in or "
      + "out. In select mode, the mouse moves the selection cursor, and the "
      + "scroll wheel changes its size. Click to update the current selection "
      + "region, which will limit which records are displayed in the right "
      + "pane (unless 'Select all' is checked in the middle). In zoom mode, "
      + "drag down to zoom in to a specific region, or drag up to zoom out "
      + "(such that the current region will fit in the box created after the "
      + "zoom-out). The scroll wheel can also be used while zooming to zoom in "
      + "or out of the center of the viewport by a fixed amount. Clicking "
      + "without dragging in zoom mode will reset the zoom to the default, and "
      + "scrolling while the mouse is over the x- or y-axis will zoom only "
      + "that axis."
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

    this.help.push(
      new HelpWidget(
        "This controls which field is used to determine the x-coordinate of "
      + "each data point. The axis will automatically scale to include the "
      + "full range of the data. Text fields are automatically converted to "
      + "numeric values by mapping unique text values to different integers, "
      + "but tensor and map fields just give 0 for every point (generally, you "
      + "should select a subfield from a tensor or map)."
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

    this.help.push(
      new HelpWidget(
        "This controls which field is used to determine the y-coordinate of "
      + "each data point. See the help for the x-axis for more details."
      )
    );

    this.controls.push(
      new TextSelectWidget(
        "Display: ",
        function () {
          return ["<count>"].concat(ds.index_names(the_view.data));
        },
        function () {
          if (the_view.d_index == undefined) {
            return "<count>";
          } else {
            return ds.get_name(the_view.data, the_view.d_index);
          }
        },
        function (iname) {
          if (iname == "<count>") {
            the_view.set_display(undefined);
          } else {
            the_view.set_display(iname);
          }
          the_view.draw();
        }
      )
    );

    this.help.push(
      new HelpWidget(
        "Sets the value to be displayed in the upper-right corner of the graph "
      + "based on the selected items. The default shows how many items are "
      + "selected, but a summary of any field can be displayed. When too many "
      + "items are selected with different values for the chosen field, a '*' "
      + "will be displayed, but when there are three or fewer distince values "
      + "among selected items, they will be displayed along with their counts. "
      + "Additionally, if there are up to three vaules which are similarly "
      + "frequent and all much more frequent than the next-most-frequent "
      + "value, these will be displayed along with a '*'. Use the right-hand "
      + "viewing pane if you need more detailed information about selected "
      + "records."
      )
    );

    this.controls.push(
      new TextSelectWidget(
        "Labels: ",
        function () {
          return ["<none>"].concat(ds.index_names(the_view.data));
        },
        function () {
          if (the_view.l_index == undefined) {
            return "<none>";
          } else {
            return ds.get_name(the_view.data, the_view.l_index);
          }
        },
        function (iname) {
          if (iname == "<none>") {
            the_view.set_labels(undefined);
          } else {
            the_view.set_labels(iname);
          }
          the_view.draw();
        }
      )
    );

    this.help.push(
      new HelpWidget(
        "Sets the field to be used as the label for each point. Note that when "
      + "there are many points, labels will overlap and won't really be "
      + "useful. When multiple grouped points have different label values, if "
      + "there's one value that comprises a majority that value will be shown "
      + "folloed by a '*', otherwise just a '*' will be shown for that point. "
      + "Set this to 'none' to disable labels."
      )
    );

    this.controls.push(
      new TextSelectWidget(
        "Color by: ",
        function () {
          return ["<density>"].concat(ds.index_names(the_view.data));
        },
        function () {
          if (the_view.c_index != undefined) {
            return ds.get_name(the_view.data, the_view.c_index);
          } else {
            return "<density>";
          }
        },
        function (iname) {
          if (iname === "<density>") {
            the_view.set_color_property(undefined);
          } else {
            the_view.set_color_property(iname);
          }
          the_view.draw();
        }
      )
    );

    this.help.push(
      new HelpWidget(
        "This sets the field that will be used to determine the color of each "
      + "point. The default is to use the relative density of each point-group "
      + "as the color key, which may result in flat coloring if your points "
      + "are sparse enough that none get grouped together. Non-numeric fields "
      + "are mapped to numeric values using the same rules as for the axes "
      + "(see the x-axis help). Then the whole value range is normalized to "
      + "between 0 and 1, and mapped to the color scale chosen below. Outlier "
      + "coloring changes this slightly (see below)."
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

    this.help.push(
      new HelpWidget(
        "Controls the color scale used to interpret the color value selected "
      + "above. You can choose a pre-set scale, or define your own by picking "
      + "two endpoint colors (the gradient used is a cube helix gradient). Use "
      + "'flat' if you don't want color variation."
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

    this.help.push(
      new HelpWidget(
        "This toggles whether the color scale is mapped to the full range of "
      + "values from the color-by field, or whether only inlier values are "
      + "mapped. If toggled, values more than three standard deviations from "
      + "the mean of the selected field will use a different color (specified "
      + "below) and only values within that range will me mapped to the color "
      + "scale. This is useful when, for example, a single extremely-dense "
      + "point washes out the colors for the rest of the graph (using "
      + "density-based coloring)."
      )
    );

    this.outlier_color_widget = new ColorWidget(
      "Outlier color:",
      "#a8ff00", // "#cc77ff",
      function (color) { the_view.draw(); }
    );
    this.controls.push(this.outlier_color_widget);

    this.help.push(
      new HelpWidget(
        "This sets the color used for outlier points, if the above option for "
      + "separate outlier colors is enabled."
      )
    );

    this.controls.push(
      new ToggleWidget(
        "Hide axis labels and display text",
        false,
        function (yes) {
          the_view.hide_labels = yes;
          the_view.draw(); // redraw
        }
      )
    );

    this.help.push(
      new HelpWidget(
        "Hiding the text at the edges of the graph can help when it overlaps "
      + "with points that are placed near the edges."
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

    this.help.push(
      new HelpWidget(
        "By default, multiple nearby points are shown as a single point with a "
      + "density value. If you uncheck this, you can view the raw regions used "
      + "to compute densities, which is only really useful for very dense data "
      + "sets. To avoid grouping points, set a smaller resolution value below."
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

    this.help.push(
      new HelpWidget(
        "This selector controls the resolution at which points are grouped. "
      + "Use smaller values to see more data points, and to avoid grouping. "
      + "The points are drawn at a size of 2 units, so the smallest available "
      + "resolution is 2. The units are screen units, and are independent of "
      + "the current graph axis units."
      )
    );
  }

  LensView.prototype = Object.create(View.prototype);
  LensView.prototype.constructor = LensView;

  // Updates the current tool. Hides the selection shadow when not in selection
  // mode.
  LensView.prototype.set_tool = function(tool) {
    this.tool = tool;
    if (tool == "zoom") {
      if (this.shadow.node != undefined) {
        this.shadow.node.classed("invisible", true);
      }
    } else {
      if (this.shadow.node != undefined) {
        this.shadow.node.classed("invisible", false);
      }
    }

    // reset & hide the dragbox on tool change no matter what
    let db = this.dragbox;
    db.sx = undefined;
    db.sy = undefined;
    db.ex = undefined;
    db.ey = undefined;
    if (db.node != undefined) {
      db.node.classed("invisible", true);
    }
  }

  // Updates the size; called when the frame is (re)bound.
  LensView.prototype.update_size = function(fw, fh) {
    this.size = [fw, fh];
    this.x_scale = d3.scaleLinear()
      .range([0, fw])
      .domain([this.viewport.min_x, this.viewport.max_x]);
    this.y_scale = d3.scaleLinear()
      .range([fh, 0])
      .domain([this.viewport.min_y, this.viewport.max_y]);

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
    this.lens = { "x": 0, "y": fh, "r": 10, "node": undefined };
    this.shadow = { "x": 0, "y": fh, "r": 10, "node": undefined };

    // set up default dragbox:
    this.dragbox = {
      "sx": undefined, "sy": undefined,
      "ex": undefined, "ey": undefined,
      "node": undefined
    };

    // Update selection to include items under default lens
    this.update_selection();
  }

  // Resets the viewport to encompass the full x and y domains of the current
  // indices. The x- and y-axes may be reset individually (pass true for each
  // axis you want to reset). Passing false, false does nothing, and passing no
  // arguments is the same as passing true, true.
  LensView.prototype.reset_viewport = function(x, y) {
    if (x == undefined && y == undefined) {
      x = true;
      y = true;
    }
    if (x) {
      let xr = this.x_domain[1] - this.x_domain[0];
      if (xr == 0) { xr = 1; }
      this.viewport.min_x = this.x_domain[0] - DOMAIN_PADDING * xr;
      this.viewport.max_x = this.x_domain[1] + DOMAIN_PADDING * xr
    }
    if (y) {
      let yr = this.y_domain[1] - this.y_domain[0];
      if (yr == 0) { yr = 1; }
      this.viewport.min_y = this.y_domain[0] - DOMAIN_PADDING * yr;
      this.viewport.max_y = this.y_domain[1] + DOMAIN_PADDING * yr
    }
    if (this.size) {
      this.update_size(this.size[0], this.size[1]);
      this.draw();
    }
  }

  // Zooms in (or out, if mag is false) so that either the given x, y, w, h box
  // becomes the new edges of the viewport, or if zooming out, so that the
  // current viewport edges become the edges of that box within an expanded
  // viewport. If the w and h values are left out, then the r_or_x and r_or_y
  // values are treated as a ratios with respect to the current viewport
  // width/height, and a box size is calculated based on those ratios (which
  // should always be between 0 and 1, exclusive). When zooming using only
  // ratios, the zoom always goes into or out of the center of the viewport.
  LensView.prototype.zoom = function(mag, r_or_x, r_or_y, w, h) {
    let x;
    let y;
    if (w == undefined) { // ratio-based
      // scaled width and height:
      // TODO: Is there some padding to adjust for here?
      w = r_or_x * this.size[0];
      h = r_or_y * this.size[1];

      // the x and y that center that box:
      x = this.size[0]/2 - w/2;
      y = this.size[1]/2 - h/2;
    } else {
      x = r_or_x;
      y = r_or_y;
    }
    if (w == 0 || h == 0) { // ignore this invalid zoom command
      return;
    }
    if (mag) {
      // TODO: Is there some padding to adjust for here?
      this.viewport.min_x = this.x_scale.invert(x);
      this.viewport.max_x = this.x_scale.invert(x + w);
      this.viewport.min_y = this.y_scale.invert(y + h);
      this.viewport.max_y = this.y_scale.invert(y);
    } else {
      let rw = this.size[0] / w;
      let rh = this.size[1] / h;
      let cx = this.x_scale.invert(x + w/2);
      let cy = this.y_scale.invert(y + h/2);
      let axis_w = this.viewport.max_x - this.viewport.min_x;
      let axis_h = this.viewport.max_y - this.viewport.min_y;
      let new_axw = axis_w * rw;
      let new_axh = axis_h * rh;
      this.viewport.min_x = cx - new_axw/2;
      this.viewport.max_x = cx + new_axw/2;
      this.viewport.min_y = cy - new_axh/2;
      this.viewport.max_y = cy + new_axh/2;
    }
    // apply viewport changes and redraw
    this.update_size(this.size[0], this.size[1]);
    this.draw();
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

    // display label
    this.display_label = this.frame.append("text")
      .attr("id", "select_count_label")
      .attr("class", "label")
      .attr("x", fw * 0.99)
      .attr("y", fh * 0.01)
      .style("text-anchor", "end")
      .style("dominant-baseline", "hanging");
    this.update_display();

    if (this.hide_labels) { this.display_label.style("display", "none"); }

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

    // Add the lenses & dragbox last
    let tools = dplot.append("g")
      .attr("id", "tools_group");

    this.lens.node = tools.append("circle")
      .attr("id", this.id + "_lens")
      .attr("class", "lens")
      .attr("cx", this.lens.x)
      .attr("cy", this.lens.y)
      .attr("r", this.lens.r)
      .attr("z-index", "10");

    this.shadow.node = tools.append("circle")
      .attr("id", this.id + "_shadow")
      .attr("class", "lens_shadow")
      .attr("cx", this.shadow.x)
      .attr("cy", this.shadow.y)
      .attr("r", this.shadow.r)
      .attr("z-index", "10");

    this.dragbox.node = tools.append("rect")
      .attr("id", this.id + "_dragbox")
      .attr("class", "dragbox invisible")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", 0)
      .attr("height", 0)
      .attr("z-index", "11");

    // Lens tracking:
    var svg = this.frame.node();
    while (svg.nodeName != "svg" && svg.parentNode) {
      svg = svg.parentNode;
    }
    svg = d3.select(svg);
    var the_view = this;
    svg.on("mousedown touchstart", function () {
      var e = d3.event;
      if (e.button != undefined && e.button > 0) {
        return; // don't trigger for non-primary buttons
      }
      var coords = d3.mouse(the_view.frame.node());
      the_view.drag_start = coords;
      let db = the_view.dragbox;
      if (the_view.tool == "zoom") {
        db.sx = coords[0];
        db.sy = coords[1];
        if (db.node != undefined) {
          db.node.classed("invisible", false);
        }
      }
    });

    svg.on("mousemove touchmove", function () {
      var coords = d3.mouse(the_view.frame.node());
      the_view.drag_current = coords;

      if (the_view.tool == "zoom") {
        let db = the_view.dragbox;
        if (db.sx != undefined && db.sy != undefined) {
          db.ex = coords[0];
          db.ey = coords[1];
          if (the_view.dragbox.node != undefined) {
            db.node.attr("x", Math.min(db.sx, db.ex));
            db.node.attr("y", Math.min(db.sy, db.ey));
            db.node.attr("width", Math.abs(db.ex - db.sx));
            db.node.attr("height", Math.abs(db.ey - db.sy));
            if (db.ey < db.sy) { // upwards = zoom out
              db.node.classed("inverted", true);
            } else {
              db.node.classed("inverted", false);
            }
          }
        } // else don't update endpoint
      } else if (the_view.tool == "select") {
        if (the_view.shadow.node != undefined) {
          the_view.shadow.x = coords[0];
          the_view.shadow.y = coords[1];
          the_view.shadow.node.attr("cx", the_view.shadow.x);
          the_view.shadow.node.attr("cy", the_view.shadow.y);
        }
      }
    });

    svg.on("click touchend", function () {
      if (the_view.tool == "zoom") {
        let db = the_view.dragbox;
        if (db.sx != undefined && db.sy != undefined) {
          if (
            db.ex == undefined
         || db.ey == undefined
         || db.ex == db.sx
         || db.ey == db.sy
          ) { // zero-width or no-movement: reset view
            the_view.reset_viewport();
          } else {
            // compute start + size
            let sx = Math.min(db.sx, db.ex);
            let sy = Math.min(db.sy, db.ey);
            let bw = Math.abs(db.ex - db.sx);
            let bh = Math.abs(db.ey - db.sy);
            // zoom in or out depending on whether box goes up or down
            the_view.zoom(db.ey > db.sy, sx, sy, bw, bh);
          }
        }
        // unbind start/end values
        db.sx = undefined;
        db.ex = undefined;
        db.sy = undefined;
        db.ey = undefined;
        // hide dragbox
        if (db.node != undefined) {
          db.node.classed("invisible", true);
        }
      } else if (the_view.tool == "select") {
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
      }
    });

    svg.on("mousewheel", function () {
      var e = d3.event;
      e.preventDefault();

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

      if (the_view.tool == "zoom") { // zoom in/out from center of viewport
        if (dy != 0) { // dx is ignored
          let lines = dy / PIXELS_PER_LINE;
          let factor = 1 - ZOOM_FACTOR;
          let ratio = Math.pow(factor, Math.abs(lines));
          // Detect hovering over axes:
          let coords = d3.mouse(the_view.frame.node());
          let mx = the_view.x_scale.invert(coords[0]);
          let my = the_view.y_scale.invert(coords[1]);
          let left = mx < the_view.viewport.min_x;
          let bottom = my < the_view.viewport.min_y;
          if (left && !bottom) { // hovering over y-axis
            the_view.zoom(lines < 0, 1, ratio); // scale y only
          } else if (bottom && !left) { // hovering over x-axis
            the_view.zoom(lines < 0, ratio, 1); // scale x only
          } else { // on graph or in corner
            the_view.zoom(lines < 0, ratio, ratio);
          }
        }
      } else if (the_view.tool == "select") { // change lens size
        if (the_view.shadow.node != undefined) {

          // update shadow radius:
          the_view.shadow.r *= (1 + 0.01 * dy / SCROLL_FACTOR);
          if (the_view.shadow.r < MIN_LENS_RADIUS) {
            the_view.shadow.r = MIN_LENS_RADIUS;
          }
          the_view.shadow.node.attr("r", the_view.shadow.r);
        }
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

    // Update our display value
    this.update_display();
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

  // Sets the index to use for the display value. Reset to use just selected
// item count by passing undefined as d_index.
  LensView.prototype.set_display = function(d_index) {
    if (typeof d_index === "string") {
      d_index = ds.lookup_index(this.data, d_index);
    }
    this.d_index = d_index;
  }

  LensView.prototype.update_display = function() {
    if (this.display_label == undefined) {
      return;
    }

    let dtext = "undefined";
    if (this.d_index == undefined) {
      dtext = this.selected.length + " items selected";
    } else if (this.selected.length == 0) {
      dtext = "";
    } else {
      let d_type = ds.get_type(this.data, this.d_index);
      let fval = ds.fuse_values(this.data, this.selected, this.d_index);
      if (d_type.kind == "number") {
        dtext = fval.toPrecision(4);
        if (this.selected.length > 1) {
          dtext = "avg " + dtext;
        }
      } else if (d_type.kind == "tensor" && d_type.value_type.kind == "number"){
        let td = v.tensor_total_dimension(fval);
        if (td <= utils.A_FEW) {
          let flat = v.flatten(fval);
          dtext = "[" + flat.map(v => v.toPrecision(3)).join(", ") + "]";
          if (this.selected.length > 1) {
            dtext = "avg " + dtext;
          }
        } else {
          dtext = "<" + td + "-dimensional>";
        }
      } else { // strings, maps, and non-numeric tensors
        dtext = utils.dominance_summary(fval);
      }
    }
    this.display_label.text(dtext);
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
    this.reset_viewport(true, false); // reset the x-axis viewport
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
    this.reset_viewport(false, true); // reset the y-axis viewport
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

    this.help.push(
      new HelpWidget(
        "Which field to make a histogram from. If a numeric field is selected, "
      + "by default 10 bins will be arranged across its full range and the "
      + "bars will represent records falling into each bin (missing values "
      + "will be treated as zeros). If there are fewer than 30 distinct "
      + "values, however, or when the field selected is a text field, each bar "
      + "will represent a distinct value. When a tensor or map field is "
      + "selected, each bar will represent a single dimension/subfield of that "
      + "tensor/map, with bar lengths being the sum of values in that "
      + "dimension rather than a count of records with values in a range."
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

    this.help.push(
      new HelpWidget(
        "Toggle to sort bars by their length instead of using the default "
      + "ordering (roughly smallest-value to largest-value for bin labels)."
      )
    );

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

    this.help.push(
      new HelpWidget(
        "For tensor and map fields, values are normally summed in each "
      + "dimension/subfield and those sums are used for bar values. When this "
      + "is toggled, instead each value is just counted as a 1 if it is "
      + "non-zero (and not missing) or a 0 if it is missing or has the value "
      + "0. This has no effect for numeric or text fields."
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

    this.help.push(
      new HelpWidget(
        "This toggle causes values in each bin to be averaged across all "
      + "records instead of added up. For numeric and text fields, effectively "
      + "computes the percentage falling into each category. For vectors and "
      + "maps, each bar will be the average for one dimension/subfield."
      )
    );

    this.controls.push(
      new ToggleWidget(
        "Normalize values (relative to largest)",
        this.flags.normalize,
        function (yes) {
          the_view.flags.normalize = yes;
          the_view.update();
          the_view.draw();
        }
      )
    );

    this.help.push(
      new HelpWidget(
        "Does not affect how bar values are computed, but just expresses the "
      + "displayed numbers in terms of the length fo the longest bar. Note "
      + "that for numeric and text fields, using averaging (see above) will "
      + "produce percentages, which is another form of normalization."
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

    this.help.push(
      new HelpWidget(
        "When there are many bins, the text may become too small to read. This "
      + "option (best combined with sorting) will hide off bars beyond the "
      + "selected limit so that the remaining bars can be read clearly."
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

    this.help.push(
      new HelpWidget(
        "Use this to specify the number of bins to use, which also turns off "
      + "the automatic grouping for fields with fewer than 30 distinct values. "
      + "Note, however, that ranges with no data will always be hidden, so "
      + "there will never be more bars shown than distinct values in the data. "
      + "This control has no effect for tensor or map fields, where the number "
      + "of bins is always equal to the number of dimensions/subfields."
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

    this.help.push(
      new HelpWidget(
        "When set to a value other than 'flat,' each bar will be colored "
      + "according to its length relative to the longest bar. You can choose a "
      + "pre-defined scale or create your own custom scale by selecting two "
      + "endpoint colosr. The gradient used for custom scales is a cube-helix "
      + "gradient."
      )
    );
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
      var tdim = ft.dimensions.reduce((a, b) => a * b, 1);
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
          var key = this.bin_names[j];
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
    } else if (ft.kind === "tensor") { // get repr and treat as string
      this.bin_names = [];
      for (let i = 0; i < this.records.length; ++i) {
        let val = ds.get_field(this.data, this.records[i], this.field);
        let repr = v.repr(v.flatten(val));
        if (this.counts.hasOwnProperty(repr)) {
          this.counts[repr] += 1;
        } else {
          this.bin_names.push(repr);
          this.counts[repr] = 1;
        }
      }
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
      console.warn("Bad data type for histogram.");
      console.warn(this.field);
      console.warn(ft);
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
    this.just_count = false;
    this.color_full_range = false;

    this.set_cols(cols_field);
    this.set_rows(rows_field);
    this.set_value(vals_field);

    this.update();

    var the_view = this;

    this.controls.push(
      new TextSelectWidget(
        "Rows: ",
        function () { return ["<none>"].concat(ds.index_names(the_view.data));},
        function () {
          if (the_view.rows_field == undefined) {
            return "<none>";
          } else {
            return ds.get_name(the_view.data, the_view.rows_field);
          }
        },
        function (iname) {
          if (iname == "<none>") {
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

    this.help.push(
      new HelpWidget(
        "Select the field that you want to use for the rows. Numeric or text "
      + "fields are converted to a category vector using a 1-hot encoding "
      + "where their value is a 1 among a vector with slots for each possible "
      + "value in the dataset, and the rest of those slots are undefined (not "
      + "zero). Tensor or map fields are interpreted as a category vector "
      + "where each dimension/subfield is a category, and values in each "
      + "dimension/subfield are the vector components. To build a matrix, for "
      + "each cell of the table, the category values for the row and column "
      + "fields for that cell are multiplied together, and the result is "
      + "multiplied by the value field (if there is one). If either the row or "
      + "column membership is undefined, the cell in question will be skipped "
      + "for this record; otherwise the result is added to the cell in "
      + "question, and after values from all records have been summed, the "
      + "result is divided by the nubmer of contributing records (which may "
      + "differ between cells). So for example, using a text field 'gender' "
      + "for columns and a tensor for rows would show the average value for "
      + "each component of that tensor separated according to the gender "
      + "values. To display interactions, use text/numeric fields for both "
      + "rows and columns and the (numeric) field of interest as the 'value.'"
      )
    );

    this.controls.push(
      new TextSelectWidget(
        "Columns: ",
        function () { return ["<none>"].concat(ds.index_names(the_view.data));},
        function () {
          if (the_view.cols_field == undefined) {
            return "<none>";
          } else {
            return ds.get_name(the_view.data, the_view.cols_field);
          }
        },
        function (iname) {
          if (iname == "<none>") {
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

    this.help.push(
      new HelpWidget(
        "Select the field to use for column vectors. See the help for 'Rows' "
      + "for a description of how the matrix is constructed."
      )
    );

    this.controls.push(
      new TextSelectWidget(
        "Value: ",
        function () { return ["<none>"].concat(ds.index_names(the_view.data));},
        function () {
          if (the_view.vals_field == undefined) {
            return "<none>";
          } else {
            return ds.get_name(the_view.data, the_view.vals_field);
          }
        },
        function (iname) {
          if (iname == "<none>") {
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

    this.help.push(
      new HelpWidget(
        "Select the field to use for values. See the help for 'Rows' for the "
      + "details of matrix construction. Note that this is only really useful "
      + "when both rows and columns are 1-hot vectors (i.e., numeric or string "
      + "fields). Set this to 'none' to just use row and column vectors in the "
      + "matrix without multiplying in any other values."
      )
    );

    this.controls.push(
      new ToggleWidget(
        "Count records (instead of averaging values)",
        this.just_count,
        function (yes) {
          the_view.just_count = yes;
          the_view.update();
          the_view.draw();
        }
      )
    );

    this.help.push(
      new HelpWidget(
        "Causes the matrix to just display the number of records that have "
      + "non-missing values for each cell, instead of multiplying "
      + "row/column/value numbers and computing averages. When this is active, "
      + "the 'Value' field is ignored entirely."
      )
    );

    this.controls.push(
      new ToggleWidget(
        "Color using full range (instead of range of averages)",
        this.color_full_range,
        function (yes) {
          the_view.color_full_range = yes;
          the_view.update();
          the_view.draw();
        }
      )
    );

    this.help.push(
      new HelpWidget(
        "Causes colors to be determined based on the full range of values from "
      + "individual records, instead of from the range of averages actually "
      + "displayed in the table."
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

    this.help.push(
      new HelpWidget(
        "This sets the color scale used to color each matrix cell. Normally, "
      + "the endpoints of the scale are mapped to the minimum and maximum "
      + "non-missing values in the table, but see the toggle above."
      )
    );

    this.label_color_widget = new ColorWidget(
      "Label color: ",
      "#000000",
      function () { the_view.draw(); }
    );
    this.controls.push(this.label_color_widget);

    this.help.push(
      new HelpWidget(
        "This controls the color used for the text labels within the matrix "
      + "(but not the row/column labels)."
      )
    );

    this.missing_color_widget = new ColorWidget(
      "Missing color: ",
      "#ffffff",
      function () { the_view.draw(); }
    );
    this.controls.push(this.missing_color_widget);

    this.help.push(
      new HelpWidget(
        "This controls the color used for the background of cells which have "
      + "no data. This can happen when using 1-hot vectors for rows and "
      + "columns if there aren't any (selected, filtered) records that have a "
      + "certain pair of attribute values."
      )
    );
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
      if (!this.just_count) {
        var val = this.get_val(r);
      }

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
          if (this.just_count) {
            var nc;
            if (this.counts[col][row] != undefined) {
              nc = this.counts[col][row] + 1;
              this.counts[col][row] = nc;
              this.matrix[col][row] = nc;
            } else {
              nc = 1;
              this.counts[col][row] = nc;
              this.matrix[col][row] = nc;
            }
          } else { // actually worry about values
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
    }

    this.avg_domain = [undefined, undefined];

    // everything might be empty:
    this.empty_rows = new Set(Array.from({length: this.n_rows}, (x,i) => i));
    this.empty_cols = new Set(Array.from({length: this.n_cols}, (x,i) => i));

    // polish standard deviations or fill in domain, fill in missing counts as
    // zeros, and find empty rows/columns
    for (let c = 0; c < this.n_cols; ++c) {
      for (let r = 0; r < this.n_rows; ++r) {
        if (this.counts[c] == undefined) {
          this.counts[c] = [];
          this.matrix[c] = [];
          this.stdevs[c] = [];
        }
        var cv = this.counts[c][r];
        if (cv == undefined) { // no records contributed here
          this.counts[c][r] = 0;
          this.matrix[c][r] = NaN;
          this.stdevs[c][r] = NaN;
          if (this.just_count) { // update domains and set matrix if counting
            this.matrix[c][r] = 0;
            if (this.full_domain[0] == undefined || this.full_domain[0] > 0) {
              this.full_domain[0] = 0;
            }
            if (this.full_domain[1] == undefined || this.full_domain[1] < 0) {
              this.full_domain[1] = 0;
            }
          }
        } else { // there's a value here
          this.empty_cols.delete(c);
          this.empty_rows.delete(r);
          if (cv > 1) {
            var sv = this.stdevs[c][r];
            this.stdevs[c][r] = Math.sqrt(sv / (cv - 1));
          } else {
            this.stdevs[c][r] = 0;
          }
          // update average domain
          if (this.just_count) {
            if (this.avg_domain[0] == undefined || this.avg_domain[0] > cv) {
              this.avg_domain[0] = cv;
            }
            if (this.avg_domain[1] == undefined || this.avg_domain[1] < cv) {
              this.avg_domain[1] = cv;
            }
          } else {
            let val = this.matrix[c][r];
            if (this.avg_domain[0] == undefined || this.avg_domain[0] > val) {
              this.avg_domain[0] = val;
            }
            if (this.avg_domain[1] == undefined || this.avg_domain[1] < val) {
              this.avg_domain[1] = val;
            }
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

    let domain = this.avg_domain;
    if (!this.just_count && this.color_full_range) {
      domain = this.full_domain;
    }

    viz.draw_matrix(
      this.frame,
      reduced_matrix,
      /*
      this.counts,
      this.stdevs,
      */
      domain,
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
    "SetSelectWidget": SetSelectWidget,
    "ComparisonFilterControls": ComparisonFilterControls,
    "ValueSetFilterControls": ValueSetFilterControls,
    "MultiFilterControls": MultiFilterControls,
    "View": View,
    "LensView": LensView,
    "Histogram": Histogram,
    "Matrix": Matrix,
  };
});

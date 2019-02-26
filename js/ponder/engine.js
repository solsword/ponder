define(
[
  "d3",
  "./utils",
  "./dataset",
  "./views",
  "./transforms",
  "./quadtree",
  "./viz",
  "./properties",
  "./json"
],
function (d3, utils, ds, vw, tf, qt, viz, prp, json) {
  /*
   * Module variables:
   */

  // Milliseconds to wait during active polling.
  var THUNK_MS = 75;

  // Default margin value (fraction of total frame reserved)
  var MARGIN = 0.06;

  // Max # of values to show during preprocessing
  var MAX_SHOW_VALUES = 6;

  // The current views for the left and right windows
  var LEFT_VIEW = undefined;
  var RIGHT_VIEW = undefined;
  var SAVED_VIEWS = {};

  // The right-pane mode select widget
  var RIGHT_SELECT = undefined;

  // The transformation widget
  var TRANSFORM_SELECT = undefined;
  var CURRENT_TRANSFORM = undefined;
  var SAVED_TRANSFORMS = {};

  // Available transforms:
  var AVAILABLE_TRANSFORMS = {
    "reify": tf.Reify,
    "combine": tf.Combine,
    "group": tf.Group,
    "circularize": tf.Circularize,
    "differentiate": tf.Differentiate,
    // TODO: Add this back in once implemented!
    // "PCA": tf.PCA,
  }

  // The lens toggle
  var LENS_TOGGLE = undefined;
  var IGNORE_SELECTION = true;

  // The filter widget
  var FILTER = undefined;

  // DOM objects
  var LEFT_WINDOW;
  var LEFT_FRAME;
  var LEFT_CONTROLS;
  var RIGHT_WINDOW;
  var RIGHT_FRAME;
  var RIGHT_CONTROLS;

  /*
   * Event handlers
   */

  function resize() {
    var lw = utils.get_width(LEFT_WINDOW);
    var lhm = lw * MARGIN;
    var lh = utils.get_height(LEFT_WINDOW);
    var lvm = lh * MARGIN;
    LEFT_FRAME.attr("width", lw - 2*lhm).attr("height", lh - 2*lvm);

    var rw = utils.get_width(RIGHT_WINDOW);
    var rhm = lw * MARGIN;
    var rh = utils.get_height(RIGHT_WINDOW);
    var rvm = lh * MARGIN;
    RIGHT_FRAME.attr("width", rw - 2*rhm).attr("height", rh - 2*rvm);

    if (LEFT_VIEW && LEFT_VIEW.frame) {
      LEFT_VIEW.rebind();
      LEFT_VIEW.draw();
    }
    if (RIGHT_VIEW && RIGHT_VIEW.frame) {
      RIGHT_VIEW.rebind();
      RIGHT_VIEW.draw();
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
        try {
          var jobj = json.parse(file_text);
        } catch (e) {
          var jobj = { "error": true };
        }
        populate_data(jobj);
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
        preprocess_data(e.target.result);
      };
      fr.readAsText(first);
    }
  }

  function set_names(dataset) {
    var np = d3.select("#names_panel");
    var nrows = np.selectAll("#names_table>tbody>tr");
    nrows.each(function (d) {
      var row = d3.select(this);
      var ai = row.select(".alias_input");
      var skey = ai.attr("id").slice(5);
      var sval = ai.node().value;
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
          var blob = new Blob([pkg], {type: "text/json;charset=utf-8"});
          var ourl = URL.createObjectURL(blob);
          var orig_name = d3.select("#data_file").node().value;
          var base = orig_name.split(/[\\\/]/).pop();
          if (base.search(/\./) >= 0) {
            var bits = base.split(".");
            bits.pop();
            base = bits.join(".");
          }
          var link = d3.select("#download_link");
          link.attr("href", ourl)
          .attr("download", base + "-processed.json");
        }
      );
  }

  function set_right_mode(data, mode) {
    if (RIGHT_VIEW != undefined) {
      RIGHT_VIEW.frame.selectAll("*").remove();
      RIGHT_VIEW.remove_controls();
    }
    if (SAVED_VIEWS.hasOwnProperty(mode)) {
      RIGHT_VIEW = SAVED_VIEWS[mode];
    } else if (mode == "histogram") {
      RIGHT_VIEW = new vw.Histogram(
        "right",
        data,
        [], // selection gets updated below
        ds.nth_of_kind(data, "map", 0) || ds.nth_of_kind(data, "number", 0),
      );
    } else if (mode == "matrix") {
      RIGHT_VIEW = new vw.Matrix(
        "right",
        data,
        [], // selection gets updated below
        ds.nth_of_kind(data, "string", 0) || ds.nth_of_kind(data, "tensor", 0),
        ds.nth_of_kind(data, "string", 1) || ds.nth_of_kind(data, "tensor", 1),
        undefined,
      );
    } else {
      console.warn("Invalid mode argument to set_right_mode: '" + mode + "'");
    }
    SAVED_VIEWS[mode] = RIGHT_VIEW;

    RIGHT_VIEW.bind_frame(RIGHT_FRAME);
    RIGHT_VIEW.put_controls(RIGHT_CONTROLS);
    RIGHT_WINDOW.select("#right_placeholder").style("display", "none");
    update_selection(data) // triggers redraw
  }

  function update_selection(dataset) {
    var selected;
    var filtered;
    if (IGNORE_SELECTION) {
      selected = dataset.records;
    } else {
      selected = LEFT_VIEW.selected;
    }
    if (FILTER) {
      filtered = FILTER.apply_filter(selected);
    } else {
      filtered = selected;
    }

    // Update selection count
    var nsel = selected.length;
    var nfil = filtered.length;

    var sc = d3.select("#selcount")
    sc.selectAll(".sel_display").remove()
    sc.append("span")
      .attr("class", "sel_display")
      .text(nsel + " selected » " + nfil + " filtered")

    RIGHT_VIEW.set_records(filtered);
    RIGHT_VIEW.update();
    RIGHT_VIEW.draw();
  }

  function transform_named(data, name) {
    var transform = undefined;
    if (SAVED_TRANSFORMS.hasOwnProperty(name)) {
      transform = SAVED_TRANSFORMS[name];
    } else if (AVAILABLE_TRANSFORMS.hasOwnProperty(name)) {
      transform = new AVAILABLE_TRANSFORMS[name](
        data,
        function () { // callback
          TRANSFORM_SELECT.put_controls();
          LEFT_VIEW.put_controls();
          RIGHT_VIEW.put_controls();
        }
      );
      SAVED_TRANSFORMS[name] = transform;
    } else {
      console.warn("Request for unknown transformation type '" + name + "'.");
    }
    return transform;
  }

  /*
   * Setup functions
   */

  // Called after data is loaded
  function populate_data(data) {
    var mk = ds.missing_keys(data);
    if (mk.length > 0) {
      LEFT_WINDOW.select("#left_placeholder")
        .text("Invalid data file. Did you run the preprocessor? (see console)");
      console.error("Invalid data file. Missing keys:")
      console.error(mk);
      console.error("Data object:")
      console.error(data);
      return;
    }

    // Names of each data property:
    var inames = ds.index_names(data);

    // right window mode select
    if (RIGHT_SELECT != undefined) {
      RIGHT_SELECT.help.remove();
      RIGHT_SELECT.remove();
    }
    RIGHT_SELECT = new vw.SelectWidget(
      "Right pane mode: ",
      ["histogram", "matrix"],
      "histogram",
      function (selected) {
        set_right_mode(data, selected)
      }
    );

    RIGHT_SELECT.put_controls(d3.select("#top_panel"));
    RIGHT_SELECT.help = new vw.HelpWidget(
      "Use this to select which graph mode will be used for the right-hand "
    + "viewing pane. Options will be saved when switching modes. 'Histogram' "
    + "mode is useful to quickly view the data, while 'matrix' mode can be "
    + "used to make detailed comparisons between multiple categories."
    );
    RIGHT_SELECT.node.append("span").text(viz.NBSP);
    RIGHT_SELECT.help.put_controls(RIGHT_SELECT.node);

    // the lens toggle
    if (LENS_TOGGLE != undefined) {
      LENS_TOGGLE.help.remove();
      LENS_TOGGLE.remove();
    }
    LENS_TOGGLE = new vw.ToggleWidget(
      "Select all",
      true,
      function (ignore) {
        IGNORE_SELECTION = ignore;
        update_selection(data)
      }
    );
    LENS_TOGGLE.put_controls(d3.select("#selcount"));
    LENS_TOGGLE.node.append("span").text(viz.NBSP);
    LENS_TOGGLE.help = new vw.HelpWidget(
      "Toggle this to ignore the selection circle from the left-hand view and "
    + "count all records as selected. The numbers below show how many records "
    + "are currently selected, and how many of those pass the specified "
    + "filter(s)."
    );
    LENS_TOGGLE.help.put_controls(LENS_TOGGLE.node);

    // transforms
    let trf = d3.select("#transform");
    trf.selectAll("*").remove();
    trf.classed("collapsed", true);
    let thead = trf.append("div").attr("class", "controls_row");
    let tcollapse = thead.append("a");
    tcollapse.attr("class", "black_button button")
      .text("▾")
      .on("click touchend", function () {
        if (tcollapse.node().innerText == "▾") {
          tcollapse.text("–");
          trf.classed("collapsed", false);
        } else {
          tcollapse.text("▾");
          trf.classed("collapsed", true);
        }
      });
    thead.append("span").attr("class", "label").text("Transform:");
    var thelp = new vw.HelpWidget(
      "Expand this panel to access data transformation options. "
    + "Select a transformation type and the settings for that type will appear "
    + "along with specific help for that type. When applied, each transform "
    + "will make new data fields available for selection in all of the places "
    + "that a data field can be used. Some transforms may take a bit of time "
    + "to complete depending on the size of the dataset."
    );
    thelp.put_controls(thead);
    let tbody = undefined;

    if (TRANSFORM_SELECT != undefined) {
      TRANSFORM_SELECT.remove();
    }
    let tfoptions = Array.from(Object.keys(AVAILABLE_TRANSFORMS));
    TRANSFORM_SELECT = new vw.TextSelectWidget(
      "Transformation: ",
      tfoptions, // options
      tfoptions[0], // default
      function (selected) {
        if (CURRENT_TRANSFORM) {
          CURRENT_TRANSFORM.remove();
        }
        CURRENT_TRANSFORM = transform_named(data, selected);
        // tbody.selectAll("*").remove();
        CURRENT_TRANSFORM.put_controls(tbody);
      }
    );
    TRANSFORM_SELECT.put_controls(trf)
    tbody = trf.append("div");
    CURRENT_TRANSFORM = transform_named(
      data,
      Object.keys(AVAILABLE_TRANSFORMS)[0]
    );
    CURRENT_TRANSFORM.put_controls(tbody);

    let flt = d3.select("#filters");
    flt.attr("class", "control_panel collapsed");
    let fhead = flt.append("div").attr("class", "controls_row");
    let fcollapse = fhead.append("a");
    fcollapse.attr("class", "black_button button")
      .text("▾")
      .on("click touchend", function () {
        if (fcollapse.node().innerText == "▾") {
          fcollapse.text("–");
          flt.attr("class", "control_panel");
        } else {
          fcollapse.text("▾");
          flt.attr("class", "control_panel collapsed");
        }
      });
    fhead.append("span").attr("class", "label").text("Filter:");
    var fhelp = new vw.HelpWidget(
      "Expand this panel to access data filtering options. The selected "
    + "filters will be applied to the data from the left-hand graph before "
    + "it is displayed in the right-hand graph. The filter will be applied to "
    + "selected items, and the number of selected and filtered items is shown "
    + "above."
    );
    fhelp.put_controls(fhead);

    // filters
    if (FILTER != undefined) {
      FILTER.remove();
    }
    FILTER = new vw.MultiFilterControls(
      data,
      function () { update_selection(data); }
    );

    FILTER.put_controls(flt);

    // left view
    if (LEFT_VIEW != undefined) {
      d3.select("#left_controls").selectAll("*").remove();
    }
    LEFT_VIEW = new vw.LensView(
      "left",
      data,
      ds.nth_of_kind(data, "number", 0),
      ds.nth_of_kind(data, "number", 1),
    );
    LEFT_VIEW.bind_frame(LEFT_FRAME);
    LEFT_VIEW.put_controls(LEFT_CONTROLS);
    LEFT_WINDOW.select("#left_placeholder").style("display", "none");
    LEFT_VIEW.draw();

    // right view
    var hdefault = ds.nth_of_kind(data, "map", 0);
    if (hdefault === undefined) {
      hdefault = ds.nth_of_kind(data, "string", 0);
    }
    if (hdefault === undefined) {
      hdefault = ds.nth_of_kind(data, "number", 2);
    }
    if (hdefault === undefined) {
      hdefault = data.indices[0];
    }
    if (RIGHT_VIEW != undefined) {
      d3.select("#right_controls").selectAll("*").remove();
    }

    set_right_mode(data, "histogram")

    update_selection(data);

    // hook view together
    LEFT_VIEW.subscribe_to_selection(function (items) {
      update_selection(data);
    });
  }

  function preprocess_data(raw_data) {
    var np = d3.select("#names_panel");
    np.select("#loading_message").style("display", "block");

    window.setTimeout(function () {
      console.log("Data loaded; processing...");
      var jobj;
      let from_csv = false;
      try {
        jobj = json.parse(raw_data);
        console.log("Detected JSON input...");
      } catch (e) {
        console.warn(e);
        console.log("Falling back to CSV/TSV input...");
        var sep = ds.guess_sep(raw_data);
        console.log("Guessed separator is '" + sep + "'...");
        jobj = ds.gulp_csv(raw_data, sep);
        from_csv = true;
      }

      console.log("Found " + jobj.records.length + " records.");
      console.log("Fields are:");
      console.log(jobj.fields);
      var dataset = ds.preprocess_data(jobj, from_csv);

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

  // Main setup
  function do_viz() {
    var upload_help = new vw.HelpWidget(
      "The preprocessor can accept CSV and TSV files, but the visualizer needs "
    + "extra information about data fileds and types. Upload a file there "
    + "first and download the result to upload here. Note that all processing "
    + "and visualization is handled locally in your browser; neither page "
    + "connects to an external server."
    );
    upload_help.put_controls(d3.select("#top_controls_row"));
    LEFT_WINDOW = d3.select("#left_window");
    var lw = utils.get_width(LEFT_WINDOW);
    var lhm = lw * MARGIN;
    var lh = utils.get_height(LEFT_WINDOW);
    var lvm = lh * MARGIN;
    LEFT_FRAME = LEFT_WINDOW.append("g")
      .attr("class", "frame")
      .attr("transform", "translate(" + lhm + "," + lvm + ")")
      .attr("width", lw - 2*lhm)
      .attr("height", lh - 2*lvm);
    RIGHT_WINDOW = d3.select("#right_window");
    var rw = utils.get_width(RIGHT_WINDOW);
    var rhm = lw * MARGIN;
    var rh = utils.get_height(RIGHT_WINDOW);
    var rvm = lh * MARGIN;
    RIGHT_FRAME = RIGHT_WINDOW.append("g")
      .attr("class", "frame")
      .attr("transform", "translate(" + rhm + "," + rvm + ")")
      .attr("width", rw - 2*rhm)
      .attr("height", rh - 2*rvm);
    LEFT_CONTROLS = d3.select("#left_controls");
    RIGHT_CONTROLS = d3.select("#right_controls");

    // Placeholder text
    LEFT_WINDOW.append("text")
      .attr("id", "left_placeholder")
      .attr("class", "label")
      .attr("x", utils.get_width(LEFT_WINDOW)/2)
      .attr("y", utils.get_height(LEFT_WINDOW)/2)
      .style("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .text("No data (choose a file to analyze above)");

    RIGHT_WINDOW.append("text")
      .attr("id", "right_placeholder")
      .attr("class", "label")
      .attr("x", utils.get_width(LEFT_WINDOW)/2)
      .attr("y", utils.get_height(LEFT_WINDOW)/2)
      .style("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .text("No data (waiting on main frame)");

    // resize event:
    d3.select(window).on("resize", resize);

    // data file selected:
    d3.select("#data_file")
      .on("change", file_chosen)
      .on(
        "click touchstart",
        function () { d3.select(this).attr("value", ""); }
      );
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
  }

  return {
    "do_viz": do_viz,
    "handle_preprocessing": handle_preprocessing,
  };
});

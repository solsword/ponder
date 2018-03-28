define(
[
  "d3",
  "./utils",
  "./dataset",
  "./views",
  "./transforms",
  "./quadtree",
  "./viz",
  "./properties"
],
function (d3, utils, ds, vw, tf, qt, viz, prp) {
  /*
   * Module variables:
   */

  // Milliseconds to wait during active polling.
  var THUNK_MS = 75;

  // Default margin value (fraction of total frame reserved)
  var MARGIN = 0.04;

  // Max # of values to show during preprocessing
  var MAX_SHOW_VALUES = 6;

  // The current views for the left and right windows
  var LEFT_VIEW = undefined;
  var RIGHT_VIEW = undefined;

  // The transformation widget
  var TRANSFORMER = undefined;

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
          var json = JSON.parse(file_text);
        } catch (error) {
          var json = { "error": true };
        }
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

    // extra transform option
    if (TRANSFORMER != undefined) {
      TRANSFORMER.node.remove();
    }
    TRANSFORMER = new vw.MultiselectWidget(
      "Apply",
      ["Compute transform: ", " of property "],
      [["circularize"], function () {
        var inames = ds.index_names(data);
        var result = [];
        for (let i = 0; i < inames.length; ++i) {
          var inm = inames[i];
          if (tf.Circularize.applicable_to(data, ds.lookup_index(data, inm))) {
            result.push(inm);
          }
        }
        return result;
      }],
      undefined,
      function (selected) {
        if (selected[0] == "circularize") {
          var dataset = LEFT_VIEW.data; // TODO: Better here!
          var index = ds.lookup_index(dataset, selected[1]);
          var circ = new tf.Circularize(
            dataset,
            index
          );
          circ.apply()
          // Update controls
          TRANSFORMER.put_controls();
          LEFT_VIEW.put_controls();
          RIGHT_VIEW.put_controls();
        } else {
          console.log(selected);
          // TODO: HERE
        }
      }
    );

    TRANSFORMER.put_controls(d3.select("#top_panel"));

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
    RIGHT_VIEW = new vw.Histogram(
      "right",
      data,
      LEFT_VIEW.selected,
      ds.nth_of_kind(data, "map", 0),
    );
    RIGHT_VIEW.bind_frame(RIGHT_FRAME);
    RIGHT_VIEW.put_controls(RIGHT_CONTROLS);
    RIGHT_WINDOW.select("#right_placeholder").style("display", "none");
    RIGHT_VIEW.draw();

    // hook view together
    LEFT_VIEW.subscribe_to_selection(function (items) {
      RIGHT_VIEW.set_records(items);
      RIGHT_VIEW.compute_counts();
      RIGHT_VIEW.draw();
    });
  }

  function preprocess_data(raw_data) {
    var np = d3.select("#names_panel");
    np.select("#loading_message").style("display", "block");

    window.setTimeout(function () {
      try {
        var json = JSON.parse(raw_data);
      } catch (error) {
        var sep = ds.guess_sep(raw_data);
        var json = ds.gulp_csv(raw_data, sep);
      }

      var dataset = ds.preprocess_data(json);

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

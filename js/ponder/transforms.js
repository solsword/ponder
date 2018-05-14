define(
["d3", "./utils", "./dataset", "./views", "./vector"],
function (d3, utils, ds, vw, v) {

  function BaseTransform(dataset, callback, default_index, result_type) {
    vw.BaseWidget.call(this);
    this.data = dataset;
    this.callback = callback;
    this.set_index(default_index);
    var the_tf = this;
    this.selector = new vw.TextSelectWidget(
      "Field: ",
      function () {
        return the_tf.applicable.map(
          idx => ds.get_name(the_tf.data, idx)
        );
      },
      function () { return ds.get_name(the_tf.data, the_tf.index); },
      function (iname) {
        the_tf.set_index(iname);
      }
    );
    this.apply_button = new vw.ButtonWidget(
      "Apply",
      function () {
        the_tf.apply();
        the_tf.trigger_callback();
      }
    );
    this.result_type = result_type || { "kind": "number" };
  }

  BaseTransform.prototype = Object.create(vw.BaseWidget.prototype);
  BaseTransform.prototype.constructor = BaseTransform;

  // Static applicability check (default -> pass everything)
  BaseTransform.applicable_to = function (dataset, index) { return true; }

  // Get name of this transform (even when inherited)
  BaseTransform.prototype.name = function () {
    return Object.getPrototypeOf(this).constructor.name.toLowerCase();
  }

  BaseTransform.prototype.result_index = function () {
    return [ "__" + this.name() + "__", this.result_subindex() ];
  }

  BaseTransform.prototype.result_subindex = function () {
    return this.index.join("").replace(/[.:]/g, "→");
  }

  // set the index
  BaseTransform.prototype.set_index = function (index) {
    if (typeof index == "string") { index = ds.lookup_index(this.data, index); }
    var apl_fcn = Object.getPrototypeOf(this).constructor.applicable_to;
    this.applicable = ds.all_indices(this.data).filter(
      idx => apl_fcn(this.data, idx)
    );
    this.index = index || this.applicable[0];
  }

  // Default implementation just returns 0
  BaseTransform.prototype.value_for = function (record) { return 0; }

  BaseTransform.prototype.apply = function () {
    if (!ds.has_field(this.data, this.result_index())) {
      this.add_field();
    }
    for (let i = 0; i < this.data.records.length; ++i) {
      var r = this.data.records[i];
      ds.set_field(
        this.data,
        r,
        this.result_index(),
        this.value_for(r, i)
      );
    }
  }

  // Remove controls
  BaseTransform.prototype.remove = function () {
    Object.getPrototypeOf(BaseTransform.prototype).remove.call(this);
    this.selector.remove();
    this.apply_button.remove();
  }

  // Put controls in place
  BaseTransform.prototype.put_controls = function (node, insert_before) {
    Object.getPrototypeOf(
      BaseTransform.prototype
    ).put_controls.call(this, node, insert_before);
    this.selector.put_controls(this.node);
    this.apply_button.put_controls(this.node);
    this.apply_button.node.classed("transform_apply_button", true);
  }

  BaseTransform.prototype.add_field = function () {
    var fn = "__" + this.name() + "__";
    if (!ds.has_field(this.data, [ fn ])) {
      ds.add_field(this.data, undefined, fn, {"kind": "map", "subtypes": {}},);
    }
    var ri = this.result_index();
    var si = this.result_subindex();
    if (!ds.has_field(this.data, ri)) {
      ds.add_field(this.data, [ fn ], si, this.result_type);
    }
  }


  // Object to manage a reification operation
  // Reify adds a binary field corresponding to a filter set. Unlike other
  // transforms it doesn't target an index.
  function Reify(dataset, callback) {
    BaseTransform.call(
      this,
      dataset,
      callback,
      undefined,
      { "kind": "number" }
    );
    var the_tf = this;
    this.label = undefined;
    this.filter = undefined;
    this.filter = new vw.MultiFilterControls(
      this.data,
      function () { the_tf.update_filter(); }
    );
    this.records = this.data.records;
    this.update_filter();
  }

  Reify.prototype = Object.create(BaseTransform.prototype);
  Reify.prototype.constructor = Reify;

  // Static applicability check
  Reify.applicable_to = function (dataset, index) { return true; }

  Reify.prototype.set_index = function (index) {
    this.applicable = [];
    return;
  }

  // Put controls in place
  Reify.prototype.put_controls = function (node, insert_before) {
    Object.getPrototypeOf(
      Reify.prototype
    ).put_controls.call(this, node, insert_before);
    this.selector.remove(); // get rid of index selector
    // add label
    this.label = this.node.insert("span", ".transform_apply_button")
      .attr("class", "label")
      .text("Filter settings:");
    // add filter controls
    this.filter.put_controls(this.node, ".transform_apply_button");
  }

  Reify.prototype.remove = function () {
    this.filter.remove();
    if (this.label) {
      this.label.remove();
    }
    Object.getPrototypeOf(Reify.prototype).remove.call(this);
  }

  Reify.prototype.update_filter = function () {
    if (this.filter == undefined) { return; }
    this.matches = this.filter.matching_indices(this.data.records);
  }

  Reify.prototype.value_for = function (record, index) {
    return +(this.matches.has(index));
  }

  Reify.prototype.result_subindex = function () {
    return this.filter.config_string();
  }


  // Create an object to manage a circularize operation. The callback will be
  // called with the entire object as an argument when the transform is
  // applied.
  function Circularize(dataset, callback, default_index) {
    BaseTransform.call(
      this,
      dataset,
      callback,
      default_index,
      ds.numeric_vector_type(2)
    );
  }

  Circularize.prototype = Object.create(BaseTransform.prototype);
  Circularize.prototype.constructor = Circularize;

  // TODO: sort dimensions for better circularization?

  // Static applicability check
  Circularize.applicable_to = function (dataset, index) {
    if (typeof index == "string") { index = ds.lookup_index(dataset, index); }
    var typ = ds.get_type(dataset, index);
    return typ.kind == "tensor" || typ.kind == "map";
  }

  Circularize.prototype.set_index = function (index) {
    Object.getPrototypeOf(Circularize.prototype).set_index.call(this, index);
    this.vt = ds.vector_transform(this.data, this.index);
  }

  // put_controls is inherited

  // Value for a record defines the core of the transformation
  Circularize.prototype.value_for = function (record) {
    var n_poles = this.vt.dimensions;
    var vec = this.vt.getter(record);
    var norm = v.softnorm(vec);
    var ns = norm.reduce((a, b) => Math.abs(a) + Math.abs(b));
    var r = [0, 0];
    for (let i = 0; i < n_poles; ++i) {
      var pc = this.pole_coordinates(i);
      r[0] += pc[0] * norm[i];
      r[1] += pc[1] * norm[i];
    }
    var result = [r[0] / ns, r[1] / ns];
    return result;
  }

  // Returns the linearized index for the ith pole, which dictates that pole's
  // pole coordinates (with a bit of trig). See pole_coordinates below for
  // details of where things are placed.
  Circularize.prototype.pole_index = function (i) {
    var n_poles = this.vt.dimensions;
    var step;
    if (n_poles <= 6) {
      step = 1;
    } else {
      step = Math.ceil(n_poles / 6);
    }
    var steps_around = Math.floor(n_poles / step);
    var leftovers = n_poles % step;

    if (n_poles - i <= leftovers) {
      return i;
    }

    var which_cycle = Math.floor(i / steps_around);
    var cycle_steps = i % steps_around;

    return which_cycle + step * cycle_steps;
  }

  // Returns the coordinates for the ith pole. The poles for each dimension are
  // arranged in a circle (hence the name of the transformation) such that the
  // most popular pole is at the top (actually at [0, 1], which might be the
  // bottom for y=down coordinates), and sequentially less-popular poles are
  // each 1/6th of the way clockwise around the circle (or as near as can be to
  // that position according to the number of poles). Exact zero vectors are
  // placed in the center of the circle; when the number of items is less than
  // 12, the items are just placed sequentially around the circle.
  Circularize.prototype.pole_coordinates = function (i) {
    var n_poles = this.vt.dimensions;
    var pi = this.pole_index(i);
    var step_size = 2 * Math.PI / n_poles;
    var theta = (Math.PI / 2) - step_size * pi;
    return [ Math.cos(theta), Math.sin(theta) ];
  }


  // Object to manage a differentiate operation
  function Differentiate(dataset, callback, default_index) {
    BaseTransform.call(
      this,
      dataset,
      callback,
      default_index,
      ds.numeric_vector_type(2)
    );
    var the_tf = this;
    this.first_label = undefined;
    this.second_label = undefined;
    this.first_index_filters = undefined;
    this.second_index_filters = undefined;
    this.first_index_filters = new vw.MultiFilterControls(
      this.data,
      function () { the_tf.update_first(); }
    );
    this.second_index_filters = new vw.MultiFilterControls(
      this.data,
      function () { the_tf.update_second(); }
    );
    this.first_records = this.data.records;
    this.second_records = this.data.records;
    this.update_first();
    this.update_second();
  }

  Differentiate.prototype = Object.create(BaseTransform.prototype);
  Differentiate.prototype.constructor = Differentiate;

  // Static applicability check
  Differentiate.applicable_to = function (dataset, index) {
    if (typeof index == "string") { index = ds.lookup_index(dataset, index); }
    var typ = ds.get_type(dataset, index);
    return typ.kind == "tensor" || typ.kind == "map";
  }

  Differentiate.prototype.set_index = function (index) {
    Object.getPrototypeOf(Differentiate.prototype).set_index.call(this, index);
    this.vt = ds.vector_transform(this.data, this.index);
  }

  // Put controls in place
  Differentiate.prototype.put_controls = function (node) {
    Object.getPrototypeOf(Differentiate.prototype).put_controls.call(this,node);
    // add first label
    this.first_label = this.node.insert("span", ".transform_apply_button")
      .attr("class", "label")
      .text("Origin filter:");
    this.first_index_filters.put_controls(this.node, ".transform_apply_button");
    this.second_label = this.node.insert("span", ".transform_apply_button")
      .attr("class", "label")
      .text("Endpoint filter:");
    this.second_index_filters.put_controls(
      this.node,
      ".transform_apply_button"
    );
  }

  Differentiate.prototype.remove = function () {
    if (this.first_label) { this.first_label.remove(); }
    if (this.first_index_filters) { this.first_index_filters.remove(); }
    if (this.second_label) { this.second_label.remove(); }
    if (this.second_index_filters) { this.second_index_filters.remove(); }
    Object.getPrototypeOf(Differentiate.prototype).remove.call(this);
  }

  Differentiate.prototype.update_first = function () {
    if (this.first_index_filters == undefined) { return; }
    this.first_records = this.first_index_filters.apply_filter(
      this.data.records
    );
    this.start_vectors = this.first_records.map(r => this.vt.getter(r));
    this.start_locus = this.start_vectors[0].slice();
    for (let i = 1; i < this.start_vectors.length; ++i) {
      let vec = this.start_vectors[i];
      v.add_into(this.start_locus, vec);
    }
    v.scale_by(this.start_locus, 1/this.start_vectors.length);
    if (this.start_locus && this.end_locus) {
      this.axis = v.sub(this.end_locus, this.start_locus);
    }
  }

  Differentiate.prototype.update_second = function () {
    if (this.second_index_filters == undefined) { return; }
    this.second_records = this.second_index_filters.apply_filter(
      this.data.records
    );
    this.end_vectors = this.second_records.map(r => this.vt.getter(r));
    this.end_locus = this.end_vectors[0].slice();
    for (let i = 1; i < this.end_vectors.length; ++i) {
      let vec = this.end_vectors[i];
      v.add_into(this.end_locus, vec);
    }
    v.scale_by(this.end_locus, 1/this.end_vectors.length);
    if (this.start_locus && this.end_locus) {
      this.axis = v.sub(this.end_locus, this.start_locus);
    }
  }
  
  Differentiate.prototype.value_for = function (record) {
    var vec = this.vt.getter(record);
    var rvec = v.sub(vec, this.start_locus);
    return [v.pmag(rvec, this.axis), v.ldist(rvec, this.axis)];
  }

  Differentiate.prototype.result_subindex = function () {
    return (
      this.index.join("").replace(/[.:]/g, "→")
    + "("
    + this.first_index_filters.config_string()
    + "⇒"
    + this.second_index_filters.config_string()
    + ")"
    );
  }


  // Object to manage a PCA operation
  function PCA(dataset, callback) {
    BaseTransform.call(
      this,
      dataset,
      callback,
      undefined,
      undefined // number of eigenvalues is dynamic
    );
    console.warn("PCA is not implemented yet!");
  }

  PCA.prototype = Object.create(BaseTransform.prototype);
  PCA.prototype.constructor = PCA;

  // Static applicability check
  PCA.applicable_to = function (dataset, index) {
    if (typeof index == "string") { index = ds.lookup_index(dataset, index); }
    var typ = ds.get_type(dataset, index);
    return typ.kind == "tensor" || typ.kind == "map";
  }

  PCA.prototype.set_index = function (index) {
    Object.getPrototypeOf(PCA.prototype).set_index.call(this, index);
    this.vt = ds.vector_transform(dataset, this.index);
    // TODO: do the PCA here
    // Don't forget to set eig_count
    this.eig_count = 1;
  }

  PCA.prototype.value_for = function (record) {
    // TODO: Use the PCA results here!
    // can we just project onto eigenvectors?
    // no, because they aren't orthogonal, right?
    return v.origin(this.eig_count);
  }

  PCA.prototype.apply = function () {
    this.result_type = ds.numeric_vector_type(this.eig_count);
    Object.getPrototypeOf(PCA.prototype).apply.call(this);
  }

  return {
    "Reify": Reify,
    "Circularize": Circularize,
    "Differentiate": Differentiate,
    "PCA": PCA,
  };
});

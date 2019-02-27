import * as d3 from "../node_modules/d3/index.js";
import * as pca from "../node_modules/ml-pca/src/pca.js";
let PCA = pca.default;
import * as utils from "./utils.js";
import * as ds from "./dataset.js";
import * as vw from "./views.js";
import * as v from "./vector.js";
import * as prp from "./properties.js";

function BaseTransform(dataset, callback, default_index, result_type) {
  vw.BaseWidget.call(this);
  this.data = dataset;
  this.callback = callback;
  this.result_type = result_type || { "kind": "number" };
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
  return ds.get_name_substitute(this.data, this.index);
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
  if (this.help) {
    this.help.remove();
  }
  this.selector.remove();
  this.apply_button.remove();
}

// Put controls in place
BaseTransform.prototype.put_controls = function (node, insert_before) {
  Object.getPrototypeOf(
    BaseTransform.prototype
  ).put_controls.call(this, node, insert_before);
  this.selector.put_controls(this.node);
  this.selector.node.classed("transform_selector", true);
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
export function Reify(dataset, callback) {
  BaseTransform.call(
    this,
    dataset,
    callback,
    undefined,
    { "kind": "number" }
  );
  var the_tf = this;
  this.filter = undefined;
  this.filter = new vw.MultiFilterControls(
    this.data,
    function () { the_tf.update_filter(); }
  );
  this.records = this.data.records;
  this.update_filter();
  this.help = new vw.HelpWidget(
    "This transform adds a numeric field to the dataset that has a value "
  + "of 0 or 1 depending on whether a filter passes. You can use it to bake "
  + "complex filters into the data to make filtering/displaying it simpler."
  );
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
  // add label with help
  this.node.insert("span", ".transform_apply_button")
    .attr("class", "bold label")
    .text("Reify ");
  this.help.put_controls(this.node, ".transform_apply_button");
  this.node.insert("br", ".transform_apply_button");
  // add filter controls
  this.filter.put_controls(this.node, ".transform_apply_button");
}

Reify.prototype.remove = function () {
  this.filter.remove();
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
export function Circularize(dataset, callback, default_index) {
  BaseTransform.call(
    this,
    dataset,
    callback,
    default_index,
    ds.numeric_vector_type(2)
  );
  this.help = new vw.HelpWidget(
    "Circularize applies to a vector-valued field, and produces a new "
  + "2-dimensional vector field as follows: First, each dimension of the "
  + "original vector is assigned a point along the edge of the unit circle. "
  + "Next, each vector is mapped to a weighted average of those points "
  + "according to its normalized values along each dimension. Points that "
  + "are similar in the multidimensional space will be mapped to similar "
  + "places in the 2D space, although other non-similar points could also "
  + "overlap by coincidence. Using the new dimensions as x- and y- axes for "
  + "the lens view plus a histogram view of the original multidimensional "
  + "field should provide insight as to what got mapped where."
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

Circularize.prototype.put_controls = function (node, insert_before) {
  Object.getPrototypeOf(
    Circularize.prototype
  ).put_controls.call(this, node, insert_before);
  this.node.insert("span", ".transform_selector")
    .attr("class", "bold label")
    .text("Circularize ");
  this.help.put_controls(this.node, ".transform_selector");
  this.node.insert("br", ".transform_selector");
}

Circularize.prototype.remove = function() {
  Object.getPrototypeOf(Circularize.prototype).remove.call(this);
}

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
export function Differentiate(dataset, callback, default_index) {
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
    function () { the_tf.update_first(); },
    "Origin criteria:"
  );
  this.second_index_filters = new vw.MultiFilterControls(
    this.data,
    function () { the_tf.update_second(); },
    "Endpoint criteria:"
  );
  this.first_records = this.data.records;
  this.second_records = this.data.records;
  this.update_first();
  this.update_second();
  this.help = new vw.HelpWidget(
    "Differentiate applies to a multidimensional field and produces a "
  + "2-dimensional field by projecting onto an artificial axis created by "
  + "drawing a line between the average vectors of two distinct subsets of "
  + "the data. This requires that the user specify two different filters, "
  + "each of which identifies a subset of the original data (the union of "
  + "these subsets doesn't have to be the full dataset). The first dimension "
  + "of the result is the projection of each multidimensional point onto "
  + "the line that intersects the average points of each selected subset, "
  + "with a value of '0' at the start of that line and a value of '1' at the "
  + "end (points before the start and after the end get negative and more-"
  + "positive values). The second dimension of the result is the Euclidean "
  + "distance in the multidimensional space from the point being mapped to "
  + "the target line."
  );
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
  this.node.insert("span", ".transform_selector")
    .attr("class", "bold label")
    .text("Differentiate ");
  this.help.put_controls(this.node, ".transform_selector");
  this.node.insert("br", ".transform_selector");
  // add first label
  this.first_index_filters.put_controls(this.node, ".transform_apply_button");
  this.second_index_filters.put_controls(this.node,".transform_apply_button");
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
  if (this.first_records.length == 0) { return; }
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
  if (this.second_records.length == 0) { return; }
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
    ds.get_name_substitute(this.data, this.index)
  + "("
  + this.first_index_filters.config_string()
  + "⇒"
  + this.second_index_filters.config_string()
  + ")"
  );
}


// Object to manage a combine operation
// Combine adds new field to the dataset which combines values from one field
// across all records that share values in a second field.
// TODO: Allow grouping by multiple fields
// TODO: Allow specifying (multiple?) weight indices
export function Combine(dataset, callback, default_index) {
  BaseTransform.call(
    this,
    dataset,
    callback,
    default_index,
    undefined // will be filled in by set_index
  );
  var the_tf = this;
  this.set_group_by();
  this.across = new vw.SetSelectWidget(
    "Group by ",
    ds.all_indices(this.data).map(idx => ds.get_name(the_tf.data, idx)),
    function (selected) {
      the_tf.set_group_by(selected);
    }
  );
  this.help = new vw.HelpWidget(
    "This transform adds a field to the dataset that combines values from "
  + "the target field across records that have the same value for each of "
  + "the given 'group by' field(s). For numbers, the mean is used, while "
  + "text fields generate a map of value-counts. Tensors and maps fuse their "
  + "individual sub-fields recursively."
  );
}

Combine.prototype = Object.create(BaseTransform.prototype);
Combine.prototype.constructor = Combine;

// Static applicability check
Combine.applicable_to = function (dataset, index) { return true; }

Combine.prototype.set_index = function (index) {
  Object.getPrototypeOf(Combine.prototype).set_index.call(this, index);
  this.result_type = ds.fused_type(this.data, this.index);
  this.stale = true;
}

// Put controls in place
Combine.prototype.put_controls = function (node, insert_before) {
  Object.getPrototypeOf(
    Combine.prototype
  ).put_controls.call(this, node, insert_before);
  // add label with help
  this.node.insert("span", ".transform_apply_button")
    .attr("class", "bold label")
    .text("Combine ");
  this.help.put_controls(this.node, ".transform_apply_button");
  this.node.insert("br", ".transform_apply_button");
  // add 'group by' control
  this.across.put_controls(this.node, ".transform_apply_button");
}

Combine.prototype.remove = function () {
  this.across.remove();
  Object.getPrototypeOf(Combine.prototype).remove.call(this);
}

Combine.prototype.set_group_by = function (selected) {
  if (selected == undefined) {
    this.group_by = [];
  } else {
    let indices = [];
    for (let str of selected) {
      indices.push(ds.lookup_index(this.data, str));
    }
    this.group_by = indices;
  }
  this.group_values = {};
  this.stale = true;
}

Combine.prototype.key_for = function (r) {
  let key = "";
  for (let idx of this.group_by) {
    key += "`" + ds.get_field(this.data, r, idx);
  }
  return key;
}

Combine.prototype.compute_group_values = function () {
  var the_tf = this;
  // build an index map
  this.grouped_records = {}
  this.data.records.forEach(function (r) {
    let key = the_tf.key_for(r);
    if (the_tf.grouped_records.hasOwnProperty(key)) {
      the_tf.grouped_records[key].push(r);
    } else {
      the_tf.grouped_records[key] = [ r ];
    }
  });
  // compute values for each group
  this.group_values = {};
  for (let k of Object.keys(this.grouped_records)) {
    let records = this.grouped_records[k];
    this.group_values[k] = ds.fuse_values(this.data, records, this.index);
  }
  this.stale = false;
}

Combine.prototype.value_for = function (record) {
  let key = this.key_for(record);
  if (this.stale) {
    this.compute_group_values();
  }

  return this.group_values[key]; // might be undefined; that's okay
}

Combine.prototype.result_subindex = function () {
  return (
    ds.get_name_substitute(this.data, this.index)
  + "_by_"
  + this.group_by.map(idx => ds.get_name_substitute(this.data, idx)).join(';')
  );
}

// Object to manage a group operation
// Group adds a new vector field to the dataset which combines values from
// one or more other fields.
export function Group(dataset, callback, default_index) {
  BaseTransform.call(
    this,
    dataset,
    callback,
    undefined,
    undefined // will be filled in by set_index
  );
  var the_tf = this;
  this.set_group();
  this.targets = new vw.SetSelectWidget(
    "Group fields ",
    ds.all_indices(this.data).map(idx => ds.get_name(the_tf.data, idx)),
    function (selected) {
      the_tf.set_group(selected);
    }
  );
  this.help = new vw.HelpWidget(
    "This transform adds a field to the dataset that combines values from "
  + "several other fields into a single vector field."
  );
}

Group.prototype = Object.create(BaseTransform.prototype);
Group.prototype.constructor = Group;

// Static applicability check
Group.applicable_to = function (dataset, index) { return true; }

Group.prototype.set_index = function (index) {
  this.applicable = [];
  return;
}

// Put controls in place
Group.prototype.put_controls = function (node, insert_before) {
  Object.getPrototypeOf(
    Group.prototype
  ).put_controls.call(this, node, insert_before);
  this.selector.remove(); // get rid of index selector
  // add label with help
  this.node.insert("span", ".transform_apply_button")
    .attr("class", "bold label")
    .text("Group ");
  this.help.put_controls(this.node, ".transform_apply_button");
  this.node.insert("br", ".transform_apply_button");
  // add 'group by' control
  this.targets.put_controls(this.node, ".transform_apply_button");
}

Group.prototype.remove = function () {
  this.targets.remove();
  Object.getPrototypeOf(Group.prototype).remove.call(this);
}

Group.prototype.set_group = function (selected) {
  if (selected == undefined) {
    this.group_by = [];
    this.result_type = { "kind": "undefined" };
  } else {
    let indices = [];
    let subtypes = [];
    for (let str of selected) {
      let idx = ds.lookup_index(this.data, str);
      indices.push(idx);
      subtypes.push(ds.get_type(this.data, idx));
    }
    this.group_by = indices;
    this.result_type = prp.array_type(subtypes);
  }
}

Group.prototype.value_for = function (record) {
  let value = [];
  for (let idx of this.group_by) {
    value.push(ds.get_field(this.data, record, idx));
  }
  return value;
}

Group.prototype.result_subindex = function () {
  return this.group_by.map(
    idx => ds.get_name_substitute(this.data, idx)
  ).join(';');
}



// Object to manage a PCA operation
export function PCATransform(dataset, callback) {
  BaseTransform.call(
    this,
    dataset,
    callback,
    undefined,
    undefined // number of eigenvalues is dynamic
  );
}

PCATransform.prototype = Object.create(BaseTransform.prototype);
PCATransform.prototype.constructor = PCATransform;

// Static applicability check
PCATransform.applicable_to = function (dataset, index) {
  if (typeof index == "string") { index = ds.lookup_index(dataset, index); }
  var typ = ds.get_type(dataset, index);
  return typ.kind == "tensor" || typ.kind == "map";
}

PCATransform.prototype.set_index = function (index) {
  Object.getPrototypeOf(PCATransform.prototype).set_index.call(this, index);
  this.vt = ds.vector_transform(this.data, this.index);

  let vectors = this.data.records.map(r => this.vt.getter(r));

  console.log(PCA);
  this.pca = new PCA(vectors);

  // Figure out result type:
  this.result_type = ds.numeric_vector_type(this.pca.getEigenvalues().length);
}

PCATransform.prototype.value_for = function (record) {
  return this.pca.predict([this.vt.getter(record)])[0];
}

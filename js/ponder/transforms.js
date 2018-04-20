define(
["d3", "./utils", "./dataset"],
function (d3, utils, ds) {
  // TODO: sort dimensions for better circularization?

  // Create an object to manage a circularize operation
  function Circularize(dataset, index) {
    this.data = dataset;
    this.index = index;
    this.result_index = [
      "__circularized__",
      index.join("").replace(/[.:]/g, "→")
    ];
    this.vt = ds.vector_transform(dataset, index);
  }

  // Static applicability check
  Circularize.applicable_to = function (dataset, index) {
    var vt = ds.vector_transform(dataset, index);
    return vt.dimensions > 1;
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

  Circularize.prototype.get_coords = function (record) {
    var n_poles = this.vt.dimensions;
    var vec = this.vt.getter(record);
    var norm = utils.normalize_vector(vec);
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

  Circularize.prototype.add_field = function () {
    if (!ds.has_field(this.data, [ "__circularized__" ])) {
      ds.add_field(
        this.data,
        undefined,
        "__circularized__",
        { "kind": "map", "subtypes": {} },
      );
    }
    if (!ds.has_field(this.data, this.result_index)) {
      ds.add_field(
        this.data,
        [ "__circularized__" ],
        this.result_index[1],
        {
          "kind": "tensor",
          "value_type": { "kind": "number" },
          "dimensions": [ 2 ],
          "subtypes": [
            { "kind": "number" },
            { "kind": "number" },
          ]
        }
      );
    }
  }

  // Augments the dataset by adding the designated field to every record.
  Circularize.prototype.apply = function () {
    if (!ds.has_field(this.data, this.result_index)) {
      this.add_field();
    }
    for (let i = 0; i < this.data.records.length; ++i) {
      var r = this.data.records[i];
      ds.set_field(
        this.data,
        r,
        this.result_index,
        this.get_coords(r)
      );
    }
  }

  return {
    "Circularize": Circularize,
  };
});

define(
["d3", "./utils", "./quadtree", "./dataset", "./properties"],
function (d3, utils, qt, ds, prp) {

  function create_view(dataset, x_index, y_index) {
    if (typeof x_index === "string") { x_index = prp.string__index(x_index); }
    if (typeof y_index === "string") { y_index = prp.string__index(y_index); }
    var result = {
      "data": dataset
      "x": x_index,
      "y": y_index,
      "records": dataset.records,
      "x_type": ds.get_type(dataset, x_index),
      "y_type": ds.get_type(dataset, y_index),
    };

    var xd = ds.get_domain(dataset, x_index);
    var yd = ds.get_domain(dataset, y_index);

    if (result.x_type.kind === "string") {
      result.x_counts = xd;
      xd = [ 0, xd.length ]
      // TODO: HERE
    }
    // TODO: Correct string domains
    
    result.x_domain = xd;
    result.y_domain = yd;

    function getx(d) { return ds.get_field(dataset, d, x_index); };
    function gety(d) { return ds.get_field(dataset, d, y_index); };

     j


    return result;
  }

  return {
    create_view(dataset, 
  };
});

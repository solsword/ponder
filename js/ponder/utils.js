define(["d3/d3"], function (d3) {

  /*
   * Helper functions
   */

  function get_bbox(obj) {
    var node = obj.node();
    var box;
    if (node.getBoundingClientRect != undefined) {
      return node.getBoundingClientRect()
    } else if (node.getBBox != undefined) {
      return node.getBBox()
    } else {
      console.warn("Can't find bounding box of:");
      console.warn(node);
      return undefined;
    }
  }

  function get_width(obj) {
    return get_bbox(obj).width;
  }

  function get_height(obj) {
    return get_bbox(obj).height;
  }

  function get_n_attr(obj, attr) {
    return Number.parseFloat(obj.attr(attr));
  }

  function get_selected_value(select) {
    return select.options[select.selectedIndex].value;
  }

  return {
    "get_bbox": get_bbox,
    "get_width": get_width,
    "get_height": get_height,
    "get_n_attr": get_n_attr,
    "get_selected_value": get_selected_value,
  };
});

define(["d3"], function (d3) {
  /*
   * Module variables
   */

  // Tolerable floating point rounding error
  var EPSILON = 1e-12;

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

  function average_vectors(vector_list, weights) {
    var result = [];
    for (var j = 0; j < vector_list[0].length; ++j) {
      var val = 0;
      var denom = 0;
      for (var i = 0; i < vector_list.length; ++i) {
        if (weights == undefined) {
          val += vector_list[i][j];
          denom += 1;
        } else {
          val += vector_list[i][j] * weights[i];
          denom += weights[i];
        }
      }
      if (denom == 0) {
        return undefined; // no items!
      }
      val /= denom;
      result.push(val);
    }
    return result;
  }

  // Test for deep equality (through arrays and objects)
  function is_equal(a, b) {
    if (Array.isArray(a)) {
      if (Array.isArray(b)) {
        if (a.length != b.length) {
          return false;
        }
        for (var i = 0; i < a.length; ++i) {
          if (!is_equal(a[i], b[i])) {
            return false;
          }
        }
        return true;
      } else {
        return false;
      }
    } else if (typeof a === "object") {
      if (typeof b === "object") {
        // keys & values match:
        for (var k in a) {
          if (a.hasOwnProperty(k)) {
            if (!b.hasOwnProperty(k)) {
              return false;
            }
            if (!is_equal(a[k], b[k])) {
              return false;
            }
          }
        }
        // extra keys in b?
        for (var k in b) {
          if (b.hasOwnProperty(k)) {
            if (!a.hasOwnProperty(k)) {
              return false;
            }
          }
        }
        return true;
      } else {
        return false;
      }
    } else {
      return a === b;
    }
  }

  // Test for deep equality (through arrays and objects). Also allows floating
  // point values to differ slightly (their ratio must be less than EPSILON).
  function is_fp_equal(a, b) {
    if (Array.isArray(a)) {
      if (Array.isArray(b)) {
        if (a.length != b.length) {
          return false;
        }
        for (var i = 0; i < a.length; ++i) {
          if (!is_fp_equal(a[i], b[i])) {
            return false;
          }
        }
        return true;
      } else {
        return false;
      }
    } else if (typeof a === "object") {
      if (typeof b === "object") {
        // keys & values match:
        for (var k in a) {
          if (a.hasOwnProperty(k)) {
            if (!b.hasOwnProperty(k)) {
              return false;
            }
            if (!is_fp_equal(a[k], b[k])) {
              return false;
            }
          }
        }
        // extra keys in b?
        for (var k in b) {
          if (b.hasOwnProperty(k)) {
            if (!a.hasOwnProperty(k)) {
              return false;
            }
          }
        }
        return true;
      } else {
        return false;
      }
    } else if (typeof a === "number") {
      if (typeof b != "number") {
        return false;
      }
      if (Number.isNaN(a)) {
        return Number.isNaN(b);
      } else {
        delta = Math.abs(1.0 - (a / b));
        return delta < EPSILON;
      }
    } else {
      return a === b;
    }
  }

  // Creates a deep copy of an object. Useful for freezing things.
  // (!) Recurses forever on cyclic structures
  function deep_copy(obj) {
    if (Array.isArray(obj)) {
      var result = [];
      for (var i = 0; i < obj.length; ++i) {
        result.push(deep_copy(obj[i]))
      }
      return result;
    } else if (typeof obj === "object") {
      if (obj === null) {
        return null;
      } else {
        var result = {};
        for (var k in obj) {
          if (obj.hasOwnProperty(k)) {
            result[k] = deep_copy(obj[k]);
          }
        }
        return result;
      }
    } else {
      return obj;
    }
  }

  // Returns a list of strings describing the difference(s) between objects a
  // and b, or an empty list if there aren't any.
  function diff(a, b) {
    var results = [];
    if (Array.isArray(a)) {
      if (Array.isArray(b)) {
        if (a.length != b.length) {
          results.push(
            "A is length " + a.length + " but B is length " + b.length
          );
        }
        for (var i = 0; i < a.length; ++i) {
          var diffs = diff(a[i], b[i]);
          for (var j = 0; j < diffs.length; ++j) {
            results.push("At index " + i + ": " + diffs[j]);
          }
        }
        return results;
      } else {
        return [ "A is an array but B is not." ];
      }
    } else if (a === null) {
      if (b != null) {
        return [ "A is null but B is not." ];
      }
      return [];
    } else if (typeof a === "object") {
      if (b === null) {
        return [ "A is an object but B is null." ];
      } else if (typeof b === "object") {
        // keys & values match:
        for (var k in a) {
          if (a.hasOwnProperty(k)) {
            if (!b.hasOwnProperty(k)) {
              results.push("A has a key '" + k + "' but B does not.");
            }
            var diffs = diff(a[k], b[k]);
            for (var j = 0; j < diffs.length; ++j) {
              results.push("At key '" + k + "': " + diffs[j]);
            }
          }
        }
        // extra keys in b?
        for (var k in b) {
          if (b.hasOwnProperty(k)) {
            if (!a.hasOwnProperty(k)) {
              results.push("B has a key '" + k + "' but A does not.");
            }
          }
        }
        return results;
      } else {
        return [ "A is an object but B is not." ];
      }
    } else {
      if (a != b) {
        return [ "A (" + a + ") != B (" + b + ")" ];
      } else {
        return [];
      }
    }
  }

  return {
    "EPSILON": EPSILON,
    "get_bbox": get_bbox,
    "get_width": get_width,
    "get_height": get_height,
    "get_n_attr": get_n_attr,
    "get_selected_value": get_selected_value,
    "average_vectors": average_vectors,
    "is_equal": is_equal,
    "is_fp_equal": is_fp_equal,
    "deep_copy": deep_copy,
    "diff": diff,
  };
});

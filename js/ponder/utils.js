import * as d3 from "../node_modules/d3/index.js";

/*
 * Module variables
 */

// Tolerable floating point rounding error
export var EPSILON = 1e-12;

// Cutoff for displaying a few values
export var A_FEW = 3;

// Cutoff for values being considered similar (fraction of the smaller)
var SIMILAR_FRACTION = 0.1;

// Default number of stops for creating CSS gradient backgrounds
var DEFAULT_GRADIENT_STOPS = 24;

// Our initial guess for font size
var FONT_SIZE_GUESS = 22;

// Max tries to guess appropriate font size
var MAX_FONT_SIZE_GUESSES = 100;

// Tolerance for font sizing (in fractions of target size)
var FONT_SIZE_TOLERANCE = 0.02;

// Out-of-DOM SVG for testing font sizes
var FONT_SIZE_ARENA;

/*
 * Helper functions
 */

// Modulus which only returns positive values.
export function posmod(n, b) {
  return ((n % b) + b) % b;
}

export function get_bbox(obj) {
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

export function get_width(obj) {
  if (obj.attr) {
    var aw = get_n_attr(obj, "width");
    if (aw) { return aw; }
  }
  return get_bbox(obj).width;
}

export function get_height(obj) {
  if (obj.attr) {
    var ah = get_n_attr(obj, "height");
    if (ah) { return ah; }
  }
  return get_bbox(obj).height;
}

export function get_n_attr(obj, attr) {
  return Number.parseFloat(obj.attr(attr));
}

export function get_selected_value(select) {
  return select.options[select.selectedIndex].value;
}

export function get_text_value(text_input) {
  return text_input.value;
}

export function average_vectors(vector_list, weights) {
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
export function is_equal(a, b) {
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
export function is_fp_equal(a, b) {
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
      return Math.abs(1.0 - (a / b)) < EPSILON;
    }
  } else {
    return a === b;
  }
}

// Creates a deep copy of an object. Useful for freezing things.
// (!) Recurses forever on cyclic structures
export function deep_copy(obj) {
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
export function diff(a, b) {
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

// Returns a CSS background property gradient value for the given color
// interpolation function (or color array). n_stops is optional and defaults
// to DEFAULT_GRADIENT_STOPS.
//
// If the function/array value is given as undefined, just returns black, and
// if given as a string, just returns that string.
export function css_gradient(direction, fcn_or_array, n_stops) {
  if (n_stops == undefined) {
    n_stops = DEFAULT_GRADIENT_STOPS;
  }
  var colors;
  if (fcn_or_array === undefined) {
    return "black";
  } else if (typeof fcn_or_array === "string") {
    return fcn_or_array;
  } else if (Array.isArray(fcn_or_array)) { // an array
    colors = fcn_or_array;
  } else { // must be an interpolation function
    colors = [];
    for (var i = 0; i <= n_stops; ++i) {
      colors.push(fcn_or_array(i/n_stops));
    }
  }
  var val = "linear-gradient(" + direction + ","
  for (var i = 0; i < colors.length; ++i) {
    val += colors[i];
    if (i < colors.length - 1) {
      val += ",";
    }
  }
  val += ")";
  return val;
}

// Returns a CSS background property gradient value for the given color list,
// which uses hard stops to create a sequence of colors blocks with hard
// edges instead of an actual gradient. n_stops is optional and defaults to
// DEFAULT_GRADIENT_STOPS.
//
// If the function/array value is given as undefined, just returns black, and
// if given as a string, just returns that string.
export function css_scheme(direction, fcn_or_array, n_stops) {
  if (n_stops == undefined) {
    n_stops = DEFAULT_GRADIENT_STOPS;
  }
  var colors;
  if (fcn_or_array === undefined) {
    return "black";
  } else if (typeof fcn_or_array === "string") {
    return fcn_or_array;
  } else if (Array.isArray(fcn_or_array)) {
    colors = fcn_or_array;
  } else { // must be an interpolation function
    colors = [];
    for (var i = 0; i <= n_stops; ++i) {
      colors.push(fcn_or_array(i/n_stops));
    }
  }
  var val = "linear-gradient(" + direction + ","
  var pct = 100 / colors.length;
  for (var i = 0; i < colors.length; ++i) {
    if (i > 0) {
      val += colors[i] + " " + (pct * i) + "%,";
    }
    val += colors[i] + " " + (pct * (i + 1)) + "%";
    if (i < colors.length - 1) {
      val += ",";
    }
  }
  val += ")";
  return val;
}

// Takes a string that starts and ends with quote characters and returns the
// raw string, unescaping any escaped backslashes and/or quotes inside.
export function unquote(string) {
  var qc = string[0];
  var inner = string.slice(1, string.length - 1);
  var result = new Array(inner.length);
  for (let i = 0; i < inner.length; ++i) {
    if (inner[i] == "\\" && inner[i+1] == qc) {
      result.push(qc);
      i += 1;
    } else if (inner[i] == "\\" && inner[i+1] == "\\") {
      result.push("\\");
      i += 1;
    } else {
      result.push(inner[i]);
    }
  }
  return result.join("");
}

export function get_text_size(string, font_size) {
  // Determines the bounding box of the given string in the given font size
  // (in pixels).
  if (FONT_SIZE_ARENA == undefined) {
    FONT_SIZE_ARENA = d3.select("body")
      .append("svg")
      .attr("opacity", 0)
      .attr("width", 0)
      .attr("height", 0);
  }
  var t = FONT_SIZE_ARENA.append("text")
    .text(string)
    .attr("font-size", font_size + "px");

  var result = t.node().getBBox();
  //var result = t.node().getBoundingClientRect();
  /*
  var result = {
    "height": font_size,
    "width": t.node().getComputedTextLength()
  }
  */

  t.remove();

  return result;
}

var SIZE_MODELS = [];
var TEXT_PROTO_SHORT = "Yj";
var TEXT_PROTO_MEDIUM = "Mij1ƒAnligy0";
var TEXT_PROTO_LONG = "Multilingual Internationalization";
var SIZES = [4, 8, 12, 18, 36];

export function get_approx_text_size(string, font_size) {
  // Faster approximate text sizing. Tends to overestimate both width and
  // height a bit (especially height if the input text has no descenders).
  // It can however also underestimate, usually when the text contains many
  // wide characters (or a really tall one, for height).
  if (SIZE_MODELS.length == 0) {
    var models_short = []
    var models_medium = []
    var models_long = []
    for (let size of SIZES) {
      models_short.push(get_text_size(TEXT_PROTO_SHORT, size));
      models_medium.push(get_text_size(TEXT_PROTO_MEDIUM, size));
      models_long.push(get_text_size(TEXT_PROTO_LONG, size));
    }
    SIZE_MODELS.push(models_short);
    SIZE_MODELS.push(models_medium);
    SIZE_MODELS.push(models_long);
  }

  // figure out string length anchors
  var slr = string.length / TEXT_PROTO_SHORT.length;
  var mlr = string.length / TEXT_PROTO_MEDIUM.length;
  var llr = string.length / TEXT_PROTO_LONG.length;
  if (slr <= 1) {
    var lower = SIZE_MODELS[0];
    var upper = undefined;
    var li = 0;
    var ui = undefined;
    var interp = slr;
  } else if (mlr <= 1) {
    var lower = SIZE_MODELS[0];
    var upper = SIZE_MODELS[1];
    var li = 0;
    var ui = 1;
    var interp = (
      (string.length - TEXT_PROTO_SHORT.length)
    / (TEXT_PROTO_MEDIUM.length - TEXT_PROTO_SHORT.length)
    );
  } else if (llr <= 1) {
    var lower = SIZE_MODELS[1];
    var upper = SIZE_MODELS[2];
    var li = 1;
    var ui = 2;
    var interp = (
      (string.length - TEXT_PROTO_MEDIUM.length)
    / (TEXT_PROTO_LONG.length - TEXT_PROTO_MEDIUM.length)
    );
  } else {
    var lower = SIZE_MODELS[2];
    var li = 2;
    var ui = undefined;
    var upper = undefined;
    var interp = llr;
  }

  // figure out font-size anchors
  if (font_size < 4) {
    var t = font_size/4;
    var left = 0;
    var right = undefined;
  } else if (font_size < 8) {
    var t = (font_size - 4)/4;
    var left = 0;
    var right = 1;
  } else if (font_size < 12) {
    var t = (font_size - 8)/4;
    var left = 1;
    var right = 2;
  } else if (font_size < 18) {
    var t = (font_size - 12)/6;
    var left = 2;
    var right = 3;
  } else if (font_size < 36) {
    var t = (font_size - 18)/18;
    var left = 3;
    var right = 4;
  } else {
    var t = font_size/36;
    var left = 4;
    var right = undefined;
  }

  // figure out what to return via double interpolation:
  if (upper == undefined) {
    if (right == undefined) {
      return {
        "width": interp * t * lower[left].width,
        "height": t * lower[left].height
      };
    } else {
      return {
        "width": interp*((1-t) * lower[left].width + t * lower[right].width),
        "height": ((1-t) * lower[left].height + t * lower[right].height)
      };
    }
  } else {
    if (right == undefined) {
      var lit = t * lower[left].width;
      var uit = t * upper[left].width;
      return {
        "width": (1-interp) * lit + interp * uit,
        "height": t * lower[left].height
      };
    } else {
      var lit = ((1-t) * lower[left].width + t * lower[right].width)
      var uit = ((1-t) * upper[left].width + t * upper[right].width)
      return {
        "width": (1-interp) * lit + interp * uit,
        "height": ((1-t) * lower[left].height + t * lower[right].height)
      };
    }
  }
}

export function font_size_for(bbox, string, margin) {
  // Determines the largest font size such that the given text can fit into
  // the given bounding box with the given margin (in percent; default is 2%).
  if (margin == undefined) {
    margin = 0.02;
  }
  var mx_w = bbox.width * (1 - margin/100);
  var mx_h = bbox.height * (1 - margin/100);

  var guess = undefined;
  var next_guess = FONT_SIZE_GUESS;
  var guess_size = undefined;
  var i = 0;
  while (true) {
    i += 1;
    if (i > MAX_FONT_SIZE_GUESSES) {
      break;
    }
    // check our next guess
    guess = next_guess
    guess_size = get_approx_text_size(string, guess);

    // compute error in fractional terms
    let err_w = mx_w / guess_size.width;
    let err_h = mx_h / guess_size.height;
    // bit of overcorrection to avoid too smooth an approach from above
    if (err_w < 1 && err_w > 1 - FONT_SIZE_TOLERANCE) {
      err_w -= FONT_SIZE_TOLERANCE/2;
    }
    if (err_h < 1 && err_h > 1 - FONT_SIZE_TOLERANCE) {
      err_h -= FONT_SIZE_TOLERANCE/2;
    }
    // next guess
    next_guess = Math.min(err_w * guess, err_h * guess);
    // check if we've converged
    if (err_w > 1 && err_h > 1) { // possibly acceptable
      if (err_w - 1 < FONT_SIZE_TOLERANCE || err_h - 1 < FONT_SIZE_TOLERANCE){
        // good enough
        break;
      }
    }
  }
  return guess;
}

// https://stackoverflow.com/questions/3446170/escape-string-for-use-in-javascript-regex
function escape_regex(str) {
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

export function text_match_indices(options, fragment) {
  var results = [];
  var fre = new RegExp(escape_regex(("" + fragment).toLowerCase()));
  for (let i = 0; i < options.length; ++i) {
    var test_against = options[i].toLowerCase();
    if (fre.exec(test_against) != null) {
      results.push(i);
    }
  }
  return results;
}

export function dominance_summary(frequencies) {
  let pairs = [];
  Object.keys(frequencies).forEach(function (k) {
    pairs.push([k, frequencies[k]]);
  });
  if (pairs.length <= A_FEW) {
    return pairs.map(p => p[0] + '×' + p[1]).join('/');
  }
  pairs.sort((a, b) => a[1] - b[1]);
  var cutoff;
  for (cutoff = 0; cutoff < pairs.length - 1; ++cutoff) {
    if (pairs[cutoff][1] >= 2*pairs[cutoff+1][1]) {
      // > 2x the next item: we dominate
      break;
    } else if (
      pairs[cutoff][1] > (1 + SIMILAR_FRACTION) * pairs[cutoff+1][1]
    ) {
      // too large to be similar to the next item, but we don't dominate
      cutoff = undefined;
      break;
    } // else we're similar; continue
  }
  if (cutoff < A_FEW) { // undefined won't be
    dominant = pairs.slice(0, cutoff+1);
    return dominant.map(p => p[0] + '×' + p[1]).join('/') + ' *';
  }
  return '*'; // no way to define dominant values
}

import * as utils from "./utils.js";

/*
 * Module variables:
 */

// Default limit on quadtree resolution
export var DEFAULT_RESOLUTION_LIMIT = 1;

// Special object indicating children should be ignored during recursive
// visits.
export var IGNORE_CHILDREN = {};

// Default number of standard deviations before being considered an outlier.
var DEFAULT_OUTLIER_ALLOWANCE = 3;

/*
 * Helper functions
 */

// True or false does the region contain the point?
export function region_contains(region, x, y) {
  return (
    x >= region[0][0]
 && x <= region[1][0]
 && y >= region[0][1]
 && y <= region[1][1]
  );
}

// True or false does the region entirely contain the sub-region?
export function region_envolops(region, sub_region) {
  return (
    region[0][0] <= sub_region[0][0]
 && region[0][1] <= sub_region[0][1]
 && region[1][0] >= sub_region[1][0]
 && region[1][1] >= sub_region[1][1]
  )
}

// Which quadrant is (x, y) in?
//
//     0 | 1
//     --+--
//     2 | 3
//
export function quad_index(extent, x, y) {
  var w = extent[1][0] - extent[0][0];
  var h = extent[1][1] - extent[0][1];
  var right = x >= extent[0][0] + w/2;
  var bottom = y >= extent[0][1] + h/2;
  return right + 2*bottom;
}

// Which quadrant(s) does [[minx, miny], [maxx, maxy]] touch?
//
//     0 | 1
//     --+--
//     2 | 3
//
// Returns an ordered array (e.g., [0, 1] or [1, 3]). The array will be empty
// if the region doesn't overlap the given extent at all.
export function quad_indices(extent, region) {
  if (
    region[1][0] < extent[0][0]
 || region[1][1] < extent[0][1]
 || region[0][0] > extent[1][0]
 || region[0][1] > extent[1][1]
  ) { // region doesn't overlap extent at all:
    return [];
  }

  var w = extent[1][0] - extent[0][0];
  var h = extent[1][1] - extent[0][1];
  var west = (region[0][0] <= extent[0][0] + w/2);
  var east = (region[1][0] >= extent[0][0] + w/2);
  var north = (region[0][1] <= extent[0][1] + h/2);
  var south = (region[1][1] >= extent[0][1] + h/2);
  var result = [];
  if (west && north) { result.push(0); }
  if (east && north) { result.push(1); }
  if (west && south) { result.push(2); }
  if (east && south) { result.push(3); }
  return result;
}

// The extent of the qi-th sub-quadrant.
export function sub_extent(extent, qi) {
  var w = extent[1][0] - extent[0][0];
  var h = extent[1][1] - extent[0][1];
  if (qi == 0) {
    return [
      [extent[0][0], extent[0][1]],
      [extent[0][0] + w/2, extent[0][1] + h/2]
    ];
  } else if (qi == 1) {
    return [
      [extent[0][0] + w/2, extent[0][1]],
      [extent[1][0], extent[0][1] + h/2]
    ];
  } else if (qi == 2) {
    return [
      [extent[0][0], extent[0][1] + h/2],
      [extent[0][0] + w/2, extent[1][1]]
    ];
  } else if (qi == 3) {
    return [
      [extent[0][0] + w/2, extent[0][1] + h/2],
      [extent[1][0], extent[1][1]]
    ];
  } else {
    console.warn("Invalid subindex: " + qi);
    return undefined;
  }
}

/*
 * Core functions
 */

// Helper for build_quadtree that adds a single data item
export function add_to_quadrant(
  node,
  extent,
  item,
  x, y,
  getx, gety,
  resolution_limit
) {
  if (!region_contains(extent, x, y)) {
    return; // ignore this out-of-bounds point.
  }
  node.count += 1; // we're adding this value somewhere in here
  if (node.count == 1) { // base case: we're at an empty node
    node.items = [ item ];
  } else if (node.hasOwnProperty("children")) { // recurse somewhere
    var qi = quad_index(extent, x, y);
    var s_ext = sub_extent(extent, qi);
    var child = node.children[qi];
    if (child == null) { // quadrant was empty
      node.children[qi] = { "count": 1, "items": [ item ] };
    } else { // add to quadrant recursively
      add_to_quadrant(
        child,
        s_ext,
        item,
        x, y,
        getx, gety,
        resolution_limit
      );
    }
  } else { // want to split this node; it has items, not children
    var w = extent[1][0] - extent[0][0];
    var h = extent[1][1] - extent[0][1];
    if (w < resolution_limit || h < resolution_limit) {
      // can't split, just grow
      node.items.push(item);
    } else { // need to add resolution here
      // first check location of other item (must be exactly 1 or at worst
      // stacked copies):
      var oi = node.items[0];
      var ox = getx(oi);
      var oy = gety(oi);
      var oq = quad_index(extent, ox, oy);
      if (ox == x && oy == y) { // A duplicate! Splitting won't help.
        node.items.push(item);
      } else { // not a duplicate: let's split
        node.children = [ null, null, null, null ];
        // insert new child node containing other item:
        node.children[oq] = { "count": node.count - 1, "items": node.items };
        delete node.items; // change this node into a children node
        // now insert us into that node or another new one:
        var qi = quad_index(extent, x, y);
        if (qi == oq) {
          add_to_quadrant(
            node.children[qi],
            sub_extent(extent, qi),
            item,
            x, y,
            getx, gety,
            resolution_limit
          );
        } else {
          node.children[qi] = { "count": 1, "items": [ item ] };
        }
      }
    }
  }
}

// Finds the nearest item in this quadrant, or returns undefined if there
// isn't one. Radius may be omitted, in which case no limit is used. Ties are
// broken by insertion and/or quadrant order. Returns an array of two things:
// the item found, and the distance to that item (both are undefined if there
// is no item).
function find_nearest_in_quadrant(node, extent, x, y, getx, gety, radius) {
  var result = undefined;
  var best = undefined;
  if (node.hasOwnProperty("children")) { // recurse
    if (radius == undefined) { 
      var quads_touched = [ 0, 1, 2, 3 ];
    } else {
      var quads_touched = quad_indices(
        extent,
        [ [x - radius, y - radius], [x + radius, y + radius] ]
      );
    }
    var max_viable = best;
    if (max_viable == undefined) { max_viable = radius; }
    // First recurse into containing quadrant:
    var fq = quad_index(extent, x, y);
    var fc = node.children[fq];
    if (fc != null) {
      var niq = find_nearest_in_quadrant(
        fc,
        sub_extent(extent, fq),
        x, y,
        getx, gety,
        max_viable
      );
      if (niq[0] != undefined && (best == undefined || niq[1] < best)) {
        result = niq[0];
        best = niq[1];
        max_viable = best;
      }
    }
    for (var i = 0; i < quads_touched.length; ++i) {
      var qi = quads_touched[i];
      if (qi == fq) {
        continue; // skip containing quadrant that we already handled
      }
      var child = node.children[qi];
      if (child != null) { // quadrant isn't empty
        var max_viable = best;
        if (max_viable == undefined) {
          max_viable = radius;
        }
        var niq = find_nearest_in_quadrant(
          child,
          sub_extent(extent, qi),
          x, y,
          getx, gety,
          max_viable
        );
        if (niq[0] != undefined && (best == undefined || niq[1] < best)) {
          result = niq[0];
          best = niq[1];
          max_viable = best;
        }
      }
    }
  } else { // else base case: find nearest item w/in radius
    for (var i = 0; i < node.items.length; ++i) {
      var item = node.items[i];
      var ix = getx(item);
      var iy = gety(item);
      var dx = x - ix;
      var dy = y - iy;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (
        (radius == undefined || dist <= radius)
     && (best == undefined || dist < best)
      ) {
        result = item;
        best = dist;
      }
    }
  }
  return [result, best];
}

// Returns an array of all of the items in the given node.
function all_items_in_quadrant(node) {
  var results = [];
  if (node == null) {
    return [];
  } else if (node.hasOwnProperty("children")) { // recurse
    for (var i = 0; i < node.children.length; ++i) {
      results = results.concat(all_items_in_quadrant(node.children[i]));
    }
  } else {
    results = results.concat(node.items);
  }
  return results;
}

// Finds all items that fall into the given region within the given quadrant.
// Returns a (possibly empty) array.
function find_any_in_quadrant(node, extent, region, getx, gety) {
  var results = [];
  if (node.hasOwnProperty("children")) { // recurse
    var quads_touched = quad_indices(extent, region);
    if (quads_touched.length == 4 && region_envolops(region, extent)) {
      // just include all nodes from enveloped quadrants
      results = results.concat(all_items_in_quadrant(node));
    } else {
      // otherwise carefully recurse
      for (var i = 0; i < quads_touched.length; ++i) {
        var qi = quads_touched[i];
        var child = node.children[qi];
        if (child != null) { // quadrant isn't empty
          results = results.concat(
            find_any_in_quadrant(
              node.children[qi],
              sub_extent(extent, qi),
              region,
              getx, gety
            )
          );
        }
      }
    }
  } else if (node.hasOwnProperty("items")) {
    // else base case: find all items w/in region
    for (var i = 0; i < node.count; ++i) {
      var item = node.items[i];
      var ix = getx(item);
      var iy = gety(item);
      if (region_contains(region, ix, iy)) {
        results.push(item);
      }
    }
  } else { // default for an empty tree: return an empty list
    return [];
  }
  return results;
}

// Calls the given function on each node in the quadtree, passing in the node
// object and the extent of that node. The traversal is in pre-order, so
// larger nodes are visited first, unless "post_order" is given as 'true,' in
// which case smaller nodes are visited first (it may be omitted).
function visit_each_node(node, extent, fcn, post_order) {
  var check = undefined;
  if (!post_order) {
    check = fcn(node, extent);
  }
  if (check != IGNORE_CHILDREN && node.hasOwnProperty("children")) {
    for (var i = 0; i < node.children.length; ++i) {
      var child = node.children[i];
      if (child != null) {
        visit_each_node(child, sub_extent(extent, i), fcn, post_order);
      }
    }
  }
  if (post_order) {
    fcn(node, extent);
  }
}

// Quadtree builder that handles duplicate points and respects a resolution
// limit (unlike d3 builtin quadtrees). Stores indices into the data array,
// not data items. Default resolution limit is defined in this module as
// DEFAULT_RESOLUTION_LIMIT. getx and gety should be accessor functions that
// take a datum and return a number. Items outside the given extents will be
// grouped into edge/corner quadrants nearest their actual position.
export function build_quadtree(data, extent, getx, gety, resolution_limit) {
  if (resolution_limit == undefined) {
    resolution_limit = DEFAULT_RESOLUTION_LIMIT;
  }
  var root = { "count": 0 };
  for (var i = 0; i < data.length; ++i) {
    var d = data[i];
    var x = getx(d);
    var y = gety(d);
    add_to_quadrant(root, extent, d, x, y, getx, gety, resolution_limit);
  }
  return {
    "extent": extent,
    "root": root,
    "getx": getx,
    "gety": gety,
    "resolution_limit": resolution_limit
  };
}

// Adds the given item to the given quadtree. Uses the quadtree's baked-in
// getx and gety functions to compute item coordinates.
export function add_item(tree, item) {
  add_to_quadrant(
    tree.root,
    tree.extent,
    item,
    tree.getx(item), tree.gety(item),
    tree.getx, tree.gety,
    tree.resolution_limit
  );
}

// Returns the nearest item in the quadtree, or undefined if the quadtree is
// empty, or if a distance limit is given and nothing is near enough. The
// radius argument may be omitted.
export function nearest(tree, x, y, radius) {
  var root = tree.root;
  if (root.count == 0) {
    return undefined;
  }
  return find_nearest_in_quadrant(
    root,
    tree.extent,
    x, y,
    tree.getx, tree.gety,
    radius
  )[0];
}

// Returns a list of items in the given region, which should be given as a
// pair of x, y arrays specifying the lower-left and upper-right corners of a
// box (in standard x -> right y -> top coordinates).
export function in_region(tree, region) {
  return find_any_in_quadrant(
    tree.root,
    tree.extent,
    region,
    tree.getx,
    tree.gety
  );
}

// Returns a list of items within the given circle, defined by its center x,
// center y, and radius.
export function in_circle(tree, cx, cy, r) {
  var region = [[cx - r, cy - r], [cx + r, cy + r]]
  var candidates = in_region(
    tree,
    region
  );
  var selected = [];
  for (var i = 0; i < candidates.length; ++i) {
    var it = candidates[i];
    var x = tree.getx(it);
    var y = tree.gety(it);
    var dx = x - cx;
    var dy = y - cy;
    if (Math.sqrt(dx * dx + dy * dy) <= r) {
      selected.push(it);
    }
  }
  return selected;
}

// Iterates over the given quadtree and returns an array of all items in the
// tree. Order is based on quad tree quadrant ordering & order of insertion
// within leaves.
export function all_items(tree) {
  return node_items(tree.root);
}

// Works like all_items, but accepts a single node rather than only an entire
// tree, and returns items within that node.
export function node_items(node) {
  var result = [];
  visit_each_node(
    node,
    [[0, 0], [0, 0]], // extent doesn't matter
    function (node) {
      if (node.hasOwnProperty("items")) {
        result = result.concat(node.items);
      }
    }
  );
  return result;
}

// Calls the given function on each node in the given quadtree. Nodes have a
// count, and have either a list of "items," or a list of "nodes." Node lists
// always contain four items, in NW, NE, SW, SE order, but some of those may
// be null if there are no items in a particular sub-quadrant. The visit
// function also receives a second argument containing the coordinate extent
// of the node being visited. The 'post_order' argument may be omitted, but
// if given as 'true,' then smaller nodes are visited before larger nodes
// (and south-eastern nodes before north-western nodes), instead of the
// default, where larger nodes (and north-western nodes) are visited first.
// Note that the visit function may return the special value IGNORE_CHILDREN
// to prevent further recursion into child notes, although for obvious
// reasons, this only works when post_order is omitted or false.
export function visit(tree, fcn, post_order) {
  visit_each_node(tree.root, tree.extent, fcn, post_order);
}

// Computes the density of a quadtree node. Density is computed as as 1/2
// count / mean distance-to-centroid for leaf nodes. For non-leaf nodes, we
// just use count / w*h. If the mean distance-to-centroid is zero, we fall
// back on the count divided by the area of a square the size of the
// resolution limit of the tree.
function compute_density(tree, node, extent, centroid) {
  if (node.count == 0) {
    return 0;
  }
  var density;
  var w = extent[1][0] - extent[0][0];
  var h = extent[1][1] - extent[0][1];
  var cx = centroid[0];
  var cy = centroid[1];
  if (node.hasOwnProperty("children")) {
    density = node.count / (w * h);
  } else {
    var mean_r = 0;
    for (var i = 0; i < node.count; ++i) {
      var it = node.items[i];
      var dx = tree.getx(it) - cx;
      var dy = tree.gety(it) - cy;
      var r = Math.sqrt(dx * dx + dy * dy);
      mean_r += r;
    }
    var rl = tree.resolution_limit;
    if (mean_r < Math.SQRT2 * rl) {
      density = node.count / (rl * rl);
    } else {
      density = node.count / (2 * Math.PI * mean_r * mean_r);
    }
  }
  return density;
}

// Returns a list of area objects, which contain extent, density, relative
// density, standardized density, centroid, leaf, and quadtree node
// information. Areas overlap, and larger (containing) areas come earlier in
// the list, so that they can be drawn in order. This method returns one area
// for each node in the tree.
//
// The max_resolution argument is optional, but if given, no rectangles
// smaller than that in either dimension will be returned.
//
// The base_density is also optional, but if given, it establishes a default
// base density value, which will be used as the max density unless a denser
// region exists.
//
// The outlier_allowance value is optional, and will default to
// DEFAULT_OUTLIER_ALLOWANCE. It sets the number of standard deviations away
// from the mean before a leaf density is considered an outlier. This in turn
// is used to set limits on the standardized density that are more
// restrictive than those for simple relative density (but which are then
// violated by outlier points).
//
// TODO: Interactions between max_resolution and density calculations!!!
// (max-rez-capped nodes may have children & thus use incorrect density
// estimate.)
//
// Results for a 1x1 region with points at:
//   (0.6, 0.6),
//   (0.8, 0.6),
//   (0.8, 0.7)
// would look like:
//
// [
//   {
//     "extent": [[0, 0], [1, 1]],
//     "density": 3,
//     "relative_density": 0.09375,
//     "standard_density": 0.09375,
//     "centroid": [0.7333333333333334, 0.6333333333333333],
//     "is_leaf": false,
//     "node": <omitted from example>
//   },
//
//   {
//     "extent": [[0.5, 0.5], [1, 1]],
//     "density": 3,
//     "relative_density": 0.375,
//     "standard_density": 0.375,
//     "centroid": [0.7333333333333334, 0.6333333333333333],
//     "is_leaf": false,
//     "node": <omitted from example>
//   },
//
//   {
//     "extent": [[0.5, 0.5], [0.75, 0.75]],
//     "density": 1,
//     "relative_density": 0.5,
//     "standard_density": 0.5,
//     "centroid": [0.6, 0.6],
//     "is_leaf": true,
//     "node": <omitted from example>
//   },
//   {
//     "extent": [[0.75, 0.5], [1, 0.75]],
//     "density": 2,
//     "relative_density": 1,
//     "standard_density": 1,
//     "centroid": [0.8, 0.65],
//     "is_leaf": true,
//     "node": <omitted from example>
//   }
// ]
//
export function density_areas(
  tree,
  max_resolution,
  base_density,
  min_as_zero,
  outlier_allowance
) {
  if (outlier_allowance == undefined) {
    outlier_allowance = DEFAULT_OUTLIER_ALLOWANCE;
  }
  var results = [];
  var max_density = base_density;
  var min_density = undefined;
  var leaf_density_mean = 0;
  var leaf_density_m2 = 0;
  var leaf_count = 0;
  var centroids = {};
  // First visit: post-order to determine max density and compute centroids
  visit(
    tree,
    function (node, extent) {
      // TODO: Is this too slow without the use of IGNORE_CHILDREN for
      // 100,000+ node data where the max_resolution is supposed to help
      // things?

      // centroid
      if (node.hasOwnProperty("children")) {
        var cx = 0;
        var cy = 0;
        for (var i = 0; i < node.children.length; ++i) {
          var k = "" + sub_extent(extent, i);
          if (centroids.hasOwnProperty(k)) {
            var cen = centroids[k];
            cx += cen[0] * node.children[i].count;
            cy += cen[1] * node.children[i].count;
          } // otherwise must have been an empty child
        }
        cx /= node.count;
        cy /= node.count;
        centroids["" + extent] = [cx, cy];
      } else if (node.count > 0) {
        var cx = 0;
        var cy = 0;
        for (var i = 0; i < node.count; ++i) {
          var it = node.items[i];
          cx += tree.getx(it);
          cy += tree.gety(it);
        }
        cx /= node.count;
        cy /= node.count;
        centroids["" + extent] = [cx, cy];
      } // else don't add a centroid at all

      // density
      var w = extent[1][0] - extent[0][0];
      var h = extent[1][1] - extent[0][1];
      if (
        max_resolution == undefined
     || (w >= max_resolution && h >= max_resolution)
      ) {
        var density = compute_density(tree, node, extent, [cx, cy]);
        if (max_density == undefined || density > max_density) {
          max_density = density;
        }
        if (min_density == undefined || density < min_density) {
          min_density = density;
        }

        if (
          w/2 < max_resolution
       || h/2 < max_resolution
       || !node.hasOwnProperty("children")
        ) { // it's a natural or forced leaf
          leaf_count += 1;
          var delta = density - leaf_density_mean;
          leaf_density_mean += delta / leaf_count;
          var delta2 = density - leaf_density_mean;
          leaf_density_m2 += delta * delta2;
        }
      } // otherwise skip density calculation
    },
    true // post-order traversal
  );

  var leaf_density_sd = Math.sqrt(leaf_density_m2 / (leaf_count - 1));

  var lower = leaf_density_mean - outlier_allowance * leaf_density_sd;
  var upper = leaf_density_mean + outlier_allowance * leaf_density_sd;

  var ll = min_density;
  if (min_as_zero) {
    ll = 0;
  }
  if (ll > lower) {
    lower = ll;
  }

  if (max_density < upper) {
    upper = max_density;
  }

  visit(
    tree,
    function (node, extent) {
      var w = extent[1][0] - extent[0][0];
      var h = extent[1][1] - extent[0][1];
      var is_leaf = (
        w < 2*max_resolution
     || h < 2*max_resolution
     || node.hasOwnProperty("items")
      );
      if (w < max_resolution || h < max_resolution) { // undefined works
        return IGNORE_CHILDREN; // doesn't count
      }
      var centroid = centroids["" + extent];
      var density = compute_density(tree, node, extent, centroid);
      // TODO: Which of these? Add a switch?
      if (min_as_zero) {
        var rel_density = density / max_density;
      } else {
        var rel_density = (density-min_density) / (max_density-min_density);
      }
      var std_density = (density - lower) / (upper - lower);
      results.push(
        {
          "extent": extent,
          "density": density,
          "relative_density": rel_density,
          "standard_density": std_density,
          "centroid": centroid,
          "is_leaf": is_leaf,
          "node": node
        }
      );
    }
  );
  return results;
}

// A generalization of density_areas, local_values can compute any custom set
// of values from individual items and then collect averages up the tree.
// It returns a mapping from stringified extents to value vectors, which for
// nodes with single items, is the result of calling the values_function on
// that item (that function must return an array). For nodes with multiple
// items, each value in the values list is averaged across items in that
// node.
export function local_values(tree, values_function, max_resolution) {
  return node_values(tree.root, tree.extent, values_function, max_resolution);
}

// Version of local_values that applies to an individual node instead of an
// entire tree. Requires an extent to create an accurate cache.
export function node_values(node, extent, values_function, max_resolution) {
  results = [];
  var cache = {};
  // Visit post-order so that cache slots will be filled.
  visit_each_node(
    node,
    extent,
    function (node, extent) {
      var result;
      var ret;
      var w = extent[1][0] - extent[0][0];
      var h = extent[1][1] - extent[0][1];
      if (
        w < max_resolution
     || h < max_resolution
     || node.hasOwnProperty("items")
      ) { // a leaf node
        var items = node_items(node);
        var values_list = items.map(values_function);
        result = utils.average_vectors(values_list);
        // no need to recurse further (we already did in node_items):
        ret = IGNORE_CHILDREN;
      } else {
        var sub_values = [];
        var sub_weights = [];
        for (var i = 0; i < node.children.length; ++i) {
          var k = "" + sub_extent(extent, i);
          if (cache.hasOwnProperty(k)) {
            sub_values.push(cache[k]);
            sub_weights.push(node.children[i].count);
          } // otherwise must have been an empty child
        }
        result = utils.average_vectors(sub_values, sub_weights);
        ret = null;
      }
      cache["" + extent] = result;
      return ret;
    },
    true // post-order traversal
  );
  return cache;
}

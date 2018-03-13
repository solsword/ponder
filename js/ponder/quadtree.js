define([], function () {
  /*
   * Module variables:
   */

  // Default limit on quadtree resolution
  var DEFAULT_RESOLUTION_LIMIT = 1;

  // Special object indicating children should be ignored during recursive
  // visits.
  var IGNORE_CHILDREN = {};

  /*
   * Helper functions
   */

  // True or false does the region contain the point?
  function region_contains(region, x, y) {
    return (
      x >= region[0][0]
   && x <= region[1][0]
   && y >= region[0][1]
   && y <= region[1][1]
    );
  }

  // True or false does the region entirely contain the sub-region?
  function region_envolops(region, sub_region) {
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
  function quad_index(extent, x, y) {
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
  function quad_indices(extent, region) {
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
  function sub_extent(extent, qi) {
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
  function add_to_quadrant(
    node,
    extent,
    item,
    x, y,
    getx, gety,
    resolution_limit
  ) {
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
          var tq = quad_index(extent, x, y);
          if (tq == oq) {
            add_to_quadrant(
              node.children[tq],
              sub_extent(extent, tq),
              item,
              x, y,
              getx, gety,
              resolution_limit
            );
          } else {
            node.children[tq] = { "count": 1, "items": [ item ] };
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
      var quads_touched = quad_indices(
        extent,
        [ [x - radius, y - radius], [x + radius, y + radius] ]
      );
      var max_viable = best;
      if (max_viable == undefined) { max_viable = radius; }
      // First recurse into containing quadrant:
      var fq = quad_index(extent, x, y);
      var fc = node.children(fq);
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
    } else { // else base case: find all items w/in region
      for (var i = 0; i < node.items.length; ++i) {
        var item = node.items[i];
        var ix = getx(item);
        var iy = gety(item);
        if (region_contains(region, ix, iy)) {
          results.push(item);
        }
      }
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
          visit_each_node(child, sub_extent(extent, i), fcn);
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
  function build_quadtree(data, extent, getx, gety, resolution_limit) {
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
  function add_item(tree, item) {
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
  function nearest(tree, x, y, radius) {
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
    );
  }

  // Returns a list of items in the given region, which should be given as a
  // pair of x, y arrays specifying the lower-left and upper-right corners of a
  // box (in standard x -> right y -> top coordinates).
  function in_region(tree, region) {
    return find_any_in_quadrant(
      tree.root,
      tree.extent,
      region,
      tree.getx,
      tree.gety
    );
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
  function visit(tree, fcn, post_order) {
    visit_each_node(tree.root, tree.extent, fcn, post_order);
  }

  // Returns a list of rectangles paired with density and relative (0--1)
  // density values, along with references to the quadtree nodes they came
  // from. Rectangles overlap, and larger (containing) rectangles come earlier
  // in the list, so that they can be drawn in order. This method returns one
  // rectangle for each node in the tree. The max_resolution argument is
  // optional, but if given, so rectangles smaller than that in either
  // dimension will be returned. The base_density is also optional, but if
  // given, it establishes a default base density value, which will be used as
  // the max density unless a denser region exists.
  //
  // Results might look like:
  //
  // [
  //   [
  //     [[0, 0], [1, 1]],
  //     [3, 0.09375],
  //     <node>
  //   ],
  //
  //   [
  //     [[0.5, 0.5], [1, 1]],
  //     [3, 0.375],
  //     <node>
  //   ],
  //
  //   [
  //     [[0.5, 0.5], [0.75, 0.75]],
  //     [1, 0.5],
  //     <node>
  //   ],
  //   [
  //     [[0.75, 0.5], [1, 0.75]],
  //     [2, 1],
  //     <node>
  //   ]
  // ]
  //
  function density_areas(tree, max_resolution, base_density) {
    results = [];
    var max_density = base_density;
    visit(
      tree,
      function (node, extent) {
        var w = extent[1][0] - extent[0][0];
        var h = extent[1][1] - extent[0][1];
        if (w < max_resolution || h < max_resolution) { // undefined works
          return IGNORE_CHILDREN; // doesn't count
        }
        var density = node.count / (w * h);
        if (max_density == undefined || density > max_density) {
          max_density = density;
        }
      }
    );
    visit(
      tree,
      function (node, extent) {
        var w = extent[1][0] - extent[0][0];
        var h = extent[1][1] - extent[0][1];
        if (w < max_resolution || h < max_resolution) { // undefined works
          return IGNORE_CHILDREN; // doesn't count
        }
        var density = node.count / (w * h);
        var rel_density = density / max_density;
        results.push(
          [
            extent,
            [density, rel_density],
            node
          ]
        );
      }
    );
    return results;
  }

  return {
    "DEFAULT_RESOLUTION_LIMIT": DEFAULT_RESOLUTION_LIMIT,
    "IGNORE_CHILDREN": IGNORE_CHILDREN,
    "build_quadtree": build_quadtree,
    "add_item": add_item,
    "nearest": nearest,
    "in_region": in_region,
    "visit": visit,
    "density_areas": density_areas,
  };
});

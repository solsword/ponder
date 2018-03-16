define(["../utils", "../unit", "../quadtree"], function (utils, unit, qt) {
  /*
   * Test functions
   */

  region_contains_tests = [
    unit.equals_test(qt.region_contains([[0, 0], [1, 1]], 0.5, 0.5), true),
    unit.equals_test(qt.region_contains([[0, 0], [1, 1]], 1.5, 0.5), false),
    unit.equals_test(qt.region_contains([[0, 0], [1, 1]], 0, 0), true),
    unit.equals_test(qt.region_contains([[0, 0], [1, 1]], 0, 0.5), true),
    unit.equals_test(qt.region_contains([[0, 0], [1, 1]], 1, 1), true),
    unit.equals_test(qt.region_contains([[0, 0], [1, 1]], 1, 1.5), false),
    unit.equals_test(qt.region_contains([[0, 0], [1, 1]], 8, 8), false),
  ];

  region_envolops_tests = [
    unit.equals_test(
      qt.region_envolops([[0, 0], [1, 1]], [[0, 0], [1, 1]]),
      true
    ),
    unit.equals_test(
      qt.region_envolops([[0, 0], [1, 1]], [[0.5, 0.5], [1.5, 1.5]]),
      false
    ),
    unit.equals_test(
      qt.region_envolops([[0, 0], [1, 1]], [[0.5, 0.5], [0.75, 0.75]]),
      true
    ),
    unit.equals_test(
      qt.region_envolops([[1, 1], [2, 2]], [[0.5, 0.5], [0.75, 0.75]]),
      false
    ),
    unit.equals_test(
      qt.region_envolops([[1, 1], [2, 2]], [[0.5, 0.5], [1.5, 1.5]]),
      false
    ),
    unit.equals_test(
      qt.region_envolops([[1, 1], [2, 2]], [[1.1, 1.1], [1.9, 1.9]]),
      true
    ),
    unit.equals_test(
      qt.region_envolops([[1, 1], [2, 2]], [[1.9, 1.1], [1.95, 1.15]]),
      true
    ),
  ];

  quad_index_tests = [
    unit.equals_test(qt.quad_index([[0, 0], [1, 1]], 0, 0), 0),
    unit.equals_test(qt.quad_index([[0, 0], [1, 1]], 1, 0), 1),
    unit.equals_test(qt.quad_index([[0, 0], [1, 1]], 0, 1), 2),
    unit.equals_test(qt.quad_index([[0, 0], [1, 1]], 1, 1), 3),
    unit.equals_test(qt.quad_index([[0, 0], [1, 1]], 0.25, 0.25), 0),
    unit.equals_test(qt.quad_index([[0, 0], [1, 1]], 0.75, 0.25), 1),
    unit.equals_test(qt.quad_index([[0, 0], [1, 1]], 0.25, 0.75), 2),
    unit.equals_test(qt.quad_index([[0, 0], [1, 1]], 0.75, 0.75), 3),
    unit.equals_test(qt.quad_index([[0, 0], [1, 1]], 0.5, 0.25), 1),
    unit.equals_test(qt.quad_index([[0, 0], [1, 1]], 0.5, 0.5), 3),
    unit.equals_test(qt.quad_index([[0, 0], [1, 1]], 0.25, 0.5), 2),
    unit.equals_test(qt.quad_index([[0, 0], [1, 1]], -1, 0), 0),
    unit.equals_test(qt.quad_index([[0, 0], [1, 1]], 0, -1), 0),
    unit.equals_test(qt.quad_index([[0, 0], [1, 1]], -1, -1), 0),
    unit.equals_test(qt.quad_index([[0, 0], [1, 1]], 0.25, -1), 0),
    unit.equals_test(qt.quad_index([[0, 0], [1, 1]], 0.75, -1), 1),
    unit.equals_test(qt.quad_index([[0, 0], [1, 1]], 1.75, 0.25), 1),
    unit.equals_test(qt.quad_index([[0, 0], [1, 1]], -1, 0.75), 2),
    unit.equals_test(qt.quad_index([[0, 0], [1, 1]], 0.25, 1.5), 2),
    unit.equals_test(qt.quad_index([[0, 0], [1, 1]], 1.25, 0.75), 3),
    unit.equals_test(qt.quad_index([[0, 0], [1, 1]], 0.75, 1.25), 3),
    unit.equals_test(qt.quad_index([[0, 0], [1, 1]], 1.5, 1.5), 3),
  ];

  quad_indices_tests = [
    unit.equals_test(
      qt.quad_indices([[0, 0], [1, 1]], [[0, 0], [0.25, 0.25]]),
      [ 0 ]
    ),
    unit.equals_test(
      qt.quad_indices([[0, 0], [1, 1]], [[0, 0], [0.75, 0.25]]),
      [ 0, 1 ]
    ),
    unit.equals_test(
      qt.quad_indices([[0, 0], [1, 1]], [[0, 0], [0.25, 0.75]]),
      [ 0, 2 ]
    ),
    unit.equals_test(
      qt.quad_indices([[0, 0], [1, 1]], [[0, 0], [0.75, 0.75]]),
      [ 0, 1, 2, 3 ]
    ),
    unit.equals_test(
      qt.quad_indices([[0, 0], [1, 1]], [[0.5, 0], [0.75, 0.5]]),
      [ 0, 1, 2, 3 ]
    ),
    unit.equals_test(
      qt.quad_indices([[0, 0], [1, 1]], [[0.6, 0], [0.75, 0.6]]),
      [ 1, 3 ]
    ),
    unit.equals_test(
      qt.quad_indices([[0, 0], [1, 1]], [[0.5, 0], [0.75, 0.25]]),
      [ 0, 1 ]
    ),
    unit.equals_test(
      qt.quad_indices([[0, 0], [1, 1]], [[0.6, 0], [0.75, 0.25]]),
      [ 1 ]
    ),
    unit.equals_test(
      qt.quad_indices([[0, 0], [1, 1]], [[1.5, 1.5], [2, 2]]),
      [ ]
    ),
    unit.equals_test(
      qt.quad_indices([[0, 0], [1, 1]], [[1, 1], [2, 2]]),
      [ 3 ]
    ),
    unit.equals_test(
      qt.quad_indices([[0, 0], [1, 1]], [[-1, -1], [-0.5, -0.5]]),
      [ ]
    ),
    unit.equals_test(
      qt.quad_indices([[0, 0], [1, 1]], [[0.25, -0.5], [0.75, -0.25]]),
      [ ]
    ),
    unit.equals_test(
      qt.quad_indices([[0, 0], [1, 1]], [[0.25, 1.5], [0.75, 2]]),
      [ ]
    ),
    unit.equals_test(
      qt.quad_indices([[0, 0], [1, 1]], [[-1, -1], [2, 2]]),
      [ 0, 1, 2, 3 ]
    ),
  ];

  sub_extent_tests = [
    unit.equals_test(
      qt.sub_extent([[0, 0], [1, 1]], 0),
      [[0, 0], [0.5, 0.5]]
    ),
    unit.equals_test(
      qt.sub_extent([[0, 0], [1, 1]], 1),
      [[0.5, 0], [1, 0.5]]
    ),
    unit.equals_test(
      qt.sub_extent([[0, 0], [1, 1]], 2),
      [[0, 0.5], [0.5, 1]]
    ),
    unit.equals_test(
      qt.sub_extent([[0, 0], [1, 1]], 3),
      [[0.5, 0.5], [1, 1]]
    ),
    unit.equals_test(
      qt.sub_extent([[0.2, 0.2], [1.4, 1.4]], 1),
      [[0.8, 0.2], [1.4, 0.8]]
    ),
    unit.equals_test(
      qt.sub_extent([[0.2, 0.2], [1.4, 1.4]], 3),
      [[0.8, 0.8], [1.4, 1.4]]
    ),
    unit.fp_equals_test(
      qt.sub_extent([[0.2, 0.3], [1.0, 0.9]], 0),
      [[0.2, 0.3], [0.6, 0.6]]
    ),
    unit.fp_equals_test(
      qt.sub_extent([[0.2, 0.3], [1.0, 0.9]], 2),
      [[0.2, 0.6], [0.6, 0.9]]
    ),
  ];

  // Setup for further tests:
  function getx (d) { return d.x; };
  function gety (d) { return d.y; };
  var test_tree = qt.build_quadtree(
    [
      { "x": 1, "y": 1, "pr": 1 },
      { "x": 3, "y": 7, "pr": 2 },
      { "x": 1.1, "y": 6, "pr": 3 },
      { "x": 9, "y": 9, "pr": 4 },
      { "x": 7.5, "y": 7.5, "pr": 5 },
    ],
    [[0, 0], [10, 10]],
    getx,
    gety,
    1
  );

  build_quadtree_tests = [
    unit.equals_test(
      utils.deep_copy(test_tree),
      {
        "extent": [[0, 0], [10, 10]],
        "getx": getx,
        "gety": gety,
        "resolution_limit": 1,
        "root": {
          "count": 5,
          "children": [
            { "count": 1, "items": [ { "x": 1, "y": 1, "pr": 1 } ] },
            null,
            {
              "count": 2,
              "children": [
                { "count": 1, "items": [ { "x": 1.1, "y": 6, "pr": 3 } ] },
                { "count": 1, "items": [ { "x": 3, "y": 7, "pr": 2 } ] },
                null,
                null,
              ]
            },
            {
              "count": 2,
              "children": [
                null,
                null,
                null,
                {
                  "count": 2,
                  "children": [
                    { "count": 1, "items": [ { "x": 7.5, "y": 7.5, "pr": 5 } ]},
                    null,
                    null,
                    { "count": 1, "items": [ { "x": 9, "y": 9, "pr": 4 } ] },
                  ]
                }
              ]
            }
          ]
        },
      }
    ),
  ];

  // Add two items:
  qt.add_item(test_tree, {"x": 3, "y": 3, "pr": 17});
  qt.add_item(test_tree, {"x": 3, "y": 3.1, "pr": 18});
  qt.add_item(test_tree, {"x": 3, "y": 3.1, "pr": 19});

  var add_item_tests = [
    unit.equals_test(
      utils.deep_copy(test_tree),
      {
        "extent": [[0, 0], [10, 10]],
        "getx": getx,
        "gety": gety,
        "resolution_limit": 1,
        "root": {
          "count": 8,
          "children": [
            {
              "count": 4,
              "children": [
                { "count": 1, "items": [ { "x": 1, "y": 1, "pr": 1 } ] },
                null,
                null,
                {
                  "count": 3,
                  "children": [
                    {
                      "count": 3,
                      "children": [
                        {
                          "count": 3,
                          "items": [
                            {"x": 3, "y": 3, "pr": 17},
                            {"x": 3, "y": 3.1, "pr": 18},
                            {"x": 3, "y": 3.1, "pr": 19},
                          ]
                        },
                        null,
                        null,
                        null,
                      ]
                    },
                    null,
                    null,
                    null,
                  ]
                }
              ]
            },
            null,
            {
              "count": 2,
              "children": [
                { "count": 1, "items": [ { "x": 1.1, "y": 6, "pr": 3 } ] },
                { "count": 1, "items": [ { "x": 3, "y": 7, "pr": 2 } ] },
                null,
                null,
              ]
            },
            {
              "count": 2,
              "children": [
                null,
                null,
                null,
                {
                  "count": 2,
                  "children": [
                    { "count": 1, "items": [ { "x": 7.5, "y": 7.5, "pr": 5 } ]},
                    null,
                    null,
                    { "count": 1, "items": [ { "x": 9, "y": 9, "pr": 4 } ] },
                  ]
                }
              ]
            }
          ]
        },
      }
    ),
  ];

  var tt = utils.deep_copy(test_tree);
  var nearest_tests = [
    unit.equals_test( // 0
      qt.nearest(tt, 1, 1, 0.5),
      { "x": 1, "y": 1, "pr": 1 }
    ),
    unit.equals_test( // 1
      qt.nearest(tt, 1, 1, 0),
      { "x": 1, "y": 1, "pr": 1 }
    ),
    unit.equals_test( // 2
      qt.nearest(tt, 1, 1, 20),
      { "x": 1, "y": 1, "pr": 1 }
    ),
    unit.equals_test( // 3
      qt.nearest(tt, 1, 1),
      { "x": 1, "y": 1, "pr": 1 }
    ),
    unit.equals_test( // 4
      qt.nearest(tt, 1, 1, undefined),
      { "x": 1, "y": 1, "pr": 1 }
    ),
    unit.equals_test( // 5
      qt.nearest(tt, -20, -20, undefined),
      { "x": 1, "y": 1, "pr": 1 }
    ),
    unit.equals_test( // 6
      qt.nearest(tt, -20, 4.9, undefined),
      { "x": 1.1, "y": 6, "pr": 3 }
    ),
    unit.equals_test( // 7
      qt.nearest(tt, -20, 5.1, undefined),
      { "x": 1.1, "y": 6, "pr": 3 }
    ),
    unit.equals_test( // 8
      qt.nearest(tt, 2, 2),
      { "x": 1, "y": 1, "pr": 1 }
    ),
    unit.equals_test( // 9
      qt.nearest(tt, 2.1, 2),
      { "x": 3, "y": 3, "pr": 17 }
    ),
    unit.equals_test( // 10
      qt.nearest(tt, 3, 3),
      { "x": 3, "y": 3, "pr": 17 }
    ),
    unit.equals_test( // 11
      qt.nearest(tt, 3.1, 3.1),
      { "x": 3, "y": 3.1, "pr": 18 }
    ),
    unit.equals_test( // 12
      qt.nearest(tt, 4, 4),
      { "x": 3, "y": 3.1, "pr": 18 }
    ),
    unit.equals_test( // 13
      qt.nearest(tt, 4, 4, 0.1),
      undefined
    ),
    unit.equals_test( // 14
      qt.nearest(tt, 0, 1, 1),
      { "x": 1, "y": 1, "pr": 1 }
    ),
    unit.equals_test( // 15
      qt.nearest(tt, 0, 1, 0.9999),
      undefined
    ),
  ];

  var in_region_tests = [
    unit.equals_test( // 0
      qt.in_region(tt, [[0, 0], [2, 2]]),
      [ { "x": 1, "y": 1, "pr": 1 } ]
    ),
    unit.equals_test( // 1
      qt.in_region(tt, [[0, 0], [0.9, 0.9]]),
      [ ]
    ),
    unit.equals_test( // 2
      qt.in_region(tt, [[0, 0], [3, 3]]),
      [
        { "x": 1, "y": 1, "pr": 1 },
        { "x": 3, "y": 3, "pr": 17 },
      ]
    ),
    unit.equals_test( // 3
      qt.in_region(tt, [[0, 0], [4, 4]]),
      [
        { "x": 1, "y": 1, "pr": 1 },
        { "x": 3, "y": 3, "pr": 17 },
        { "x": 3, "y": 3.1, "pr": 18 },
        { "x": 3, "y": 3.1, "pr": 19 },
      ]
    ),
    unit.equals_test( // 4
      qt.in_region(tt, [[4.5, 4.5], [5.5, 5.5]]),
      [ ]
    ),
    unit.equals_test( // 5
      qt.in_region(tt, [[0, 0], [10, 10]]),
      [
        { "x": 1, "y": 1, "pr": 1 },
        { "x": 3, "y": 3, "pr": 17 },
        { "x": 3, "y": 3.1, "pr": 18 },
        { "x": 3, "y": 3.1, "pr": 19 },
        { "x": 1.1, "y": 6, "pr": 3 },
        { "x": 3, "y": 7, "pr": 2 },
        { "x": 7.5, "y": 7.5, "pr": 5 },
        { "x": 9, "y": 9, "pr": 4 },
      ]
    ),
    unit.equals_test( // 6
      qt.in_region(tt, [[-10, -10], [20, 20]]),
      [
        { "x": 1, "y": 1, "pr": 1 },
        { "x": 3, "y": 3, "pr": 17 },
        { "x": 3, "y": 3.1, "pr": 18 },
        { "x": 3, "y": 3.1, "pr": 19 },
        { "x": 1.1, "y": 6, "pr": 3 },
        { "x": 3, "y": 7, "pr": 2 },
        { "x": 7.5, "y": 7.5, "pr": 5 },
        { "x": 9, "y": 9, "pr": 4 },
      ]
    ),
    unit.equals_test( // 7
      qt.in_region(tt, [[2.95, 3.05], [3.05, 3.15]]),
      [
        { "x": 3, "y": 3.1, "pr": 18 },
        { "x": 3, "y": 3.1, "pr": 19 },
      ]
    ),
    unit.equals_test( // 8
      qt.in_region(tt, [[2.95, 3.05], [20, 20]]),
      [
        { "x": 3, "y": 3.1, "pr": 18 },
        { "x": 3, "y": 3.1, "pr": 19 },
        { "x": 3, "y": 7, "pr": 2 },
        { "x": 7.5, "y": 7.5, "pr": 5 },
        { "x": 9, "y": 9, "pr": 4 },
      ]
    ),
    unit.equals_test( // 9
      qt.in_region(tt, [[0.5, 5], [10, 10]]),
      [
        { "x": 1.1, "y": 6, "pr": 3 },
        { "x": 3, "y": 7, "pr": 2 },
        { "x": 7.5, "y": 7.5, "pr": 5 },
        { "x": 9, "y": 9, "pr": 4 },
      ]
    ),
    unit.equals_test( // 10
      qt.in_region(tt, [[-0.5, -0.5], [10.5, 10.5]]),
      [
        { "x": 1, "y": 1, "pr": 1 },
        { "x": 3, "y": 3, "pr": 17 },
        { "x": 3, "y": 3.1, "pr": 18 },
        { "x": 3, "y": 3.1, "pr": 19 },
        { "x": 1.1, "y": 6, "pr": 3 },
        { "x": 3, "y": 7, "pr": 2 },
        { "x": 7.5, "y": 7.5, "pr": 5 },
        { "x": 9, "y": 9, "pr": 4 },
      ]
    ),
  ];

  // Test visit in pre- and post-order and truncated:
  var vresults = [];
  qt.visit(tt, function (node, extent) { vresults.push(extent) });

  // post-order
  var presults = [];
  qt.visit(tt, function (node, extent) { presults.push(extent) }, true);

  // truncated
  var tresults = [];
  qt.visit(
    tt,
    function (node, extent) {
      tresults.push(extent);
      if (extent[1][0] - extent[0][0] <= 2.5) { // width <= 2.5
        return qt.IGNORE_CHILDREN;
      }
    }
  );

  var visit_tests = [
    unit.equals_test(
      vresults,
      [
        [[0, 0], [10, 10]],
        [[0, 0], [5, 5]],
        [[0, 0], [2.5, 2.5]],
        [[2.5, 2.5], [5, 5]],
        [[2.5, 2.5], [3.75, 3.75]],
        [[2.5, 2.5], [3.125, 3.125]],
        [[0, 5], [5, 10]],
        [[0, 5], [2.5, 7.5]],
        [[2.5, 5], [5, 7.5]],
        [[5, 5], [10, 10]],
        [[7.5, 7.5], [10, 10]],
        [[7.5, 7.5], [8.75, 8.75]],
        [[8.75, 8.75], [10, 10]],
      ]
    ),
    unit.equals_test(
      presults,
      [
        [[0, 0], [2.5, 2.5]],
        [[2.5, 2.5], [3.125, 3.125]],
        [[2.5, 2.5], [3.75, 3.75]],
        [[2.5, 2.5], [5, 5]],
        [[0, 0], [5, 5]],

        [[0, 5], [2.5, 7.5]],
        [[2.5, 5], [5, 7.5]],
        [[0, 5], [5, 10]],

        [[7.5, 7.5], [8.75, 8.75]],
        [[8.75, 8.75], [10, 10]],
        [[7.5, 7.5], [10, 10]],
        [[5, 5], [10, 10]],

        [[0, 0], [10, 10]],
      ]
    ),
    unit.equals_test(
      tresults,
      [
        [[0, 0], [10, 10]],
        [[0, 0], [5, 5]],
        [[0, 0], [2.5, 2.5]],
        [[2.5, 2.5], [5, 5]],
        [[0, 5], [5, 10]],
        [[0, 5], [2.5, 7.5]],
        [[2.5, 5], [5, 7.5]],
        [[5, 5], [10, 10]],
        [[7.5, 7.5], [10, 10]],
      ]
    ),
  ];

  var das = qt.density_areas(tt, 2.5); //density areas
  var mxd = 3/(2.5*2.5); // max local density
  var mnd = 8/100;
  var rdd = mxd - mnd;

  var density_areas_tests = [
    unit.equals_test(
      das,
      [
        {
          "extent": [[0, 0], [10, 10]],
          "density": 8/100,
          "relative_density": (8/100 - mnd)/rdd,
          "centroid": [3.825, 4.9625],
          "is_leaf": false,
          "node": tt.root
        },
        {
          "extent": [[0, 0], [5, 5]],
          "density": 4/25,
          "relative_density": (4/25 - mnd)/rdd,
          "centroid": [2.5, 2.55],
          "is_leaf": false,
          "node": tt.root.children[0]
        },
        {
          "extent": [[0, 0], [2.5, 2.5]],
          "density": 1/6.25,
          "relative_density": (1/6.25 - mnd)/rdd,
          "centroid": [1, 1],
          "is_leaf": true,
          "node": tt.root.children[0].children[0]
        },
        {
          "extent": [[2.5, 2.5], [5, 5]],
          "density": 3/6.25,
          "relative_density": (3/6.25 - mnd)/rdd,
          "centroid": [3, 3.0666666666666664],
          "is_leaf": true,
          "node": tt.root.children[0].children[3]
        },
        {
          "extent": [[0, 5], [5, 10]],
          "density": 2/25,
          "relative_density": (2/25 - mnd)/rdd,
          "centroid": [2.05, 6.5],
          "is_leaf": false,
          "node": tt.root.children[2]
        },
        {
          "extent": [[0, 5], [2.5, 7.5]],
          "density": 1/6.25,
          "relative_density": (1/6.25 - mnd)/rdd,
          "centroid": [1.1, 6],
          "is_leaf": true,
          "node": tt.root.children[2].children[0]
        },
        {
          "extent": [[2.5, 5], [5, 7.5]],
          "density": 1/6.25,
          "relative_density": (1/6.25 - mnd)/rdd,
          "centroid": [3, 7],
          "is_leaf": true,
          "node": tt.root.children[2].children[1]
        },
        {
          "extent": [[5, 5], [10, 10]],
          "density": 2/25,
          "relative_density": (2/25 - mnd)/rdd,
          "centroid": [8.25, 8.25],
          "is_leaf": false,
          "node": tt.root.children[3]
        },
        {
          "extent": [[7.5, 7.5], [10, 10]],
          "density": 2/6.25,
          "relative_density": (2/6.25 - mnd)/rdd,
          "centroid": [8.25, 8.25],
          "is_leaf": true,
          "node": tt.root.children[3].children[3]
        },
      ]
    ),
  ];

  return {
    "suites": {
      "region_contains": region_contains_tests,
      "region_envolops": region_envolops_tests,
      "quad_index_tests": quad_index_tests,
      "quad_indices_tests": quad_indices_tests,
      "sub_extent_tests": sub_extent_tests,
      "build_quadtree_tests": build_quadtree_tests,
      "add_item_tests": add_item_tests,
      "nearest_tests": nearest_tests,
      "in_region_tests": in_region_tests,
      "visit_tests": visit_tests,
      "density_areas_tests": density_areas_tests,
    }
  };
});

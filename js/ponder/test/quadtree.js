define(["../unit", "../quadtree"], function (unit, qt) {
  /*
   * Module variables:
   */

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
      { "x": 2, "y": 6, "pr": 3 },
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
      unit.deep_copy(test_tree),
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
                { "count": 1, "items": [ { "x": 2, "y": 6, "pr": 3 } ] },
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

  console.log(unit.deep_copy(test_tree));

  var add_item_tests = [
    unit.equals_test(
      unit.deep_copy(test_tree),
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
                { "count": 1, "items": [ { "x": 2, "y": 6, "pr": 3 } ] },
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

  var nearest_tests = [
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
    }
  };
});

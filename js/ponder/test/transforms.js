import * as unit from "../unit.js";
import * as tf from "../transforms.js";

/*
 * Test functions
 */

var dataset = {
  "types": [
    {
      "kind": "map",
      "subtypes": {
        "a": { "kind": "number" },
        "b": { "kind": "string" }
      }
    }
  ],
  "domains": {
    ".test": undefined,
    ".test.a": [ 0, 1 ],
    ".test.b": { "foo": 2, "bar": 1 },
  },
  "imap": {
    ".test": [ "test" ],
    ".test.a": [ "test", "a" ],
    ".test.b": [ "test", "b" ]
  },
  "indices": [
    [ "test" ],
    [ "test", "a" ],
    [ "test", "b" ],
  ],
  "fmap": { "test": 0 },
  "fields": [ "test" ],
  "records": [
    [ { "a": 1, "b": "foo" } ],
    [ { "a": 0, "b": "foo" } ],
    [ { "a": 0.5, "b": "bar" } ],
  ]
}

var circularise_tests = [
  function test_index_fulfillment() {
    for (let n_items = 1; n_items < 1000; ++n_items) {
      var fake_obj = {
        "vt": { "dimensions": n_items },
      };
      var found = {};
      for (let i = 0; i < n_items; ++i) {
        var pi = tf.Circularize.prototype.pole_index.call(fake_obj, i);
        var k = "" + pi;
        if (found.hasOwnProperty(k)) {
          return (
            "Failure (" + n_items + " items):\nBoth " + found[k] + " and "
          + i + " map to index " + pi + "!"
          );
        } else {
          found[k] = i;
        }
      }
      for (let i = 0; i < n_items; ++i) {
        if (!found.hasOwnProperty("" + i)) {
          return (
            "Failure (@" + n_items + " items):\nNo index was mapped to "
          + i + "!"
          );
        }
      }
    }
    return unit.SUCCESS;
  },
];

export var suites = { "circularise_tests": circularise_tests };

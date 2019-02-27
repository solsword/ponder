/*
 * unit.js
 *
 * Unit testing framework.
 */

import * as utils from "./utils.js";

/*
 * Module data
 */

// Constant for success:
export var SUCCESS = {};

/*
 * Helpers
 */

/*
 * Unit test definitions:
 */
export function equals_test(a, b) {
  return function () {
    if (utils.is_equal(a, b)) {
      return SUCCESS;
    } else {
      return "Failure:\n" + utils.diff(a, b).join("\n");
    }
  }
}

export function fp_equals_test(a, b) {
  return function () {
    if (utils.is_fp_equal(a, b)) {
      return SUCCESS;
    } else {
      return "Failure:\n" + utils.diff(a, b).join("\n");
    }
  }
}

/*
 * Suite machinery:
 */
export function run_suites(name, suites) {
  console.log("Running test suites for module '" + name + "'...");
  var count = 0;
  var passed = 0;
  for (var sname in suites) {
    if (suites.hasOwnProperty(sname)) {
      var suite = suites[sname];
      var status = "passed";
      console.log("  Running suite '" + sname + "'...");
      for (var  i = 0; i < suite.length; ++i) {
        var result = suite[i]();
        if (result != SUCCESS) {
          console.log("    Test #" + i + " failed:")
          console.error(result);
          status = "FAILED";
        }
      }
      console.log("  ...suite '" + sname + "' " + status + ".");
      if (status == "passed") {
        passed += 1;
      }
      count += 1;
    }
  }
  console.log(
    "...passed " + passed + "/" + count + " suites for module '" + name + ".'"
  );
}

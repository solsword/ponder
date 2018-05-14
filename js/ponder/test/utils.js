define(["../unit", "../utils"], function (unit, utils) {
  /*
   * Test functions
   */

  var KNOWN_SIZES = {
    "ace": [
      [ 12, [19.48, 17]],
      [ 24, [38.51, 33]],
      [ 48, [77.03, 65]],
      [ 96, [154.08, 131]],
      [ 128, [205.44, 175]],
    ],
    "Millenium Falcon": [
      [ 12, [95.69, 17]],
      [ 24, [191.39, 33]],
      [ 48, [382.80, 65]],
      [ 96, [765.59, 131]],
      [ 128, [1020.80, 175]],
    ],
    "women ": [
      [ 27.4, [103.2, 37]],
      [ 34.32, [129.28, 47]],
    ]
  };

  var APPROX_EXACT = {
    "Yj": [ 4, 8, 12, 18, 36 ],
    "Mij1ƒAnligy0": [ 4, 8, 12, 18, 36 ],
    "Multilingual Internationalization": [ 4, 8, 12, 18, 36 ],
  }

  var APPROX_SIZES = {
    "ace": [
      [  4, [7.16, 5]],
      [  8, [13.31, 11]],
      [ 12, [19.48, 17]],
      [ 24, [38.52, 33]],
      [ 36, [57.77, 49]],
      [ 48, [77.03, 65]],
      [ 72, [115.55, 98]],
      [ 96, [154.08, 131]],
      [ 128, [205.44, 175]],
    ],
    "Millenium Falcon": [
      [  4, [32.42, 5]],
      [  8, [63.84, 11]],
      [ 12, [95.69, 17]],
      [ 24, [191.39, 33]],
      [ 36, [287.09, 49]],
      [ 48, [382.80, 65]],
      [ 72, [574.19, 98]],
      [ 96, [765.60, 131]],
      [ 128, [1020.80, 175]],
    ],
    "women ": [
      [ 27.4, [103.2, 37]],
      [ 34.32, [129.28, 47]],
    ]
  }

  font_size_tests = [
    function test_get_text_size() {
      for (var s of Object.keys(KNOWN_SIZES)) {
        var ks = KNOWN_SIZES[s];
        for (var sz of ks) {
          ts = utils.get_text_size(s, sz[0]);
          if (
            Math.abs(ts.width - sz[1][0]) > 0.01
         || Math.abs(ts.height - sz[1][1]) > 0.01
          ) {
            return (
              "Fail: " + sz[0] + "px -/> " + sz[1][0] + "×" + sz[1][1]
            + " (" + ts.width + "×" + ts.height + ")"
            );
          }
        }
      }
      return unit.SUCCESS;
    },

    function test_get_approx_text_size() {
      for (var s of Object.keys(APPROX_EXACT)) {
        var ks = APPROX_EXACT[s];
        for (var sz of ks) {
          // TODO: HERE
          ts = utils.get_text_size(s, sz);
          ats = utils.get_approx_text_size(s, sz);
          if (
            Math.abs(ts.width - ats.width) > 0.01
         || Math.abs(ts.height - ats.height) > 0.01
          ) {
            return (
              "Approx Exact Fail: " + sz + "px -/> " + ts.width + "×" +ts.height
            + " (" + ats.width + "×" + ats.height + ")"
            );
          }
        }
      }
      for (var s of Object.keys(APPROX_SIZES)) {
        var ks = APPROX_SIZES[s];
        for (var sz of ks) {
          ts = utils.get_text_size(s, sz[0]);
          if (
            Math.abs(ts.width - sz[1][0]) > 0.01
         || Math.abs(ts.height - sz[1][1]) > 0.01
          ) {
            return (
              "Approx Fail: " + sz[0] + "px -/> " + sz[1][0] + "×" + sz[1][1]
            + " (" + ts.width + "×" + ts.height + ")"
            );
          }
        }
      }
      return unit.SUCCESS;
    },
    function test_font_size_for() {
      return unit.SUCCESS;
    }
  ];

  return {
    "suites": {
      "font_size_tests": font_size_tests,
    }
  };
});

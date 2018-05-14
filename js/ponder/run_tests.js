define(
[
  "./unit",
  "./test/utils",
  "./test/quadtree",
  "./test/properties",
  "./test/transforms"
],
function (unit, utt, qtt, prt, tft) {
  function run() {
    unit.run_suites("utils", utt.suites);
    unit.run_suites("quadtree", qtt.suites);
    unit.run_suites("properties", prt.suites);
    unit.run_suites("transforms", tft.suites);
  }

  return { "run": run };
});

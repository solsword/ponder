define(
["./unit", "./test/quadtree", "./test/properties"],
function (unit, qtt, prt) {
  function run() {
    unit.run_suites("quadtree", qtt.suites);
    unit.run_suites("properties", prt.suites);
  }

  return { "run": run };
});

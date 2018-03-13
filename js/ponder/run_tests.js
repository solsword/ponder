define(["./unit", "./test/quadtree"], function (unit, qtt) {
  function run() {
    unit.run_suites("quadtree", qtt.suites);
  }

  return { "run": run };
});

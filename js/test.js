requirejs.config({
  baseURL: "js/",
});

requirejs(
  ["ponder/run_tests"],
  function(run_tests) {
    run_tests.run();
  }
);

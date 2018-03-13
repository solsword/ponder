requirejs.config({
  baseURL: "js/",
});

requirejs(
  ["ponder/engine"],
  function(engine) {
    engine.do_viz("data/test.json")
    //engine.do_viz("data/spending-data-EUW.json")
  }
);

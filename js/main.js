requirejs.config({
  baseURL: "js/",
});

requirejs(
  ["ponder/engine"],
  function(engine) {
    engine.do_viz()
  }
);

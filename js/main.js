requirejs.config({
  baseURL: "js/",
  map: { // THIS IS BULLSHIT
    "*": {
      "d3": "js/node_modules/d3/build/d3.js",
      "d3-interpolate": "js/node_modules/d3-interpolate/build/d3-interpolate.js",
      "d3-color": "js/node_modules/d3-color/build/d3-color.js",
      "d3-scale-chromatic": "js/node_modules/d3-scale-chromatic/dist/d3-scale-chromatic.js",
    }
  }
});

requirejs(
  ["ponder/engine"],
  function(engine) {
    engine.do_viz()
  }
);

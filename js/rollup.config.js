import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';

export default {
  input: 'main.js',
  context: 'help',
  output: {
    file: 'main-bundle.js',
    format: 'iife'
  },
  plugins: [
    resolve({
      module: true,
      browser: true,
      main: false,
      sourceMap: 'inline',
      modulesOnly: false,
      customResolveOptions: {
        moduleDirectory: 'node_modules'
      },
    }),
    commonjs({
      sourceMap: 'inline',
      exclude: [ 'node_modules/ml-matrix/**' ],
      namedExports: {
        'd3-scale-chromatic': [
          "schemeCategory10",
          "schemeAccent",
          "schemeDark2",
          "schemePaired",
          "schemePastel1",
          "schemePastel2",
          "schemeSet1",
          "schemeSet2",
          "schemeSet3",
          "interpolateBrBG",
          "interpolatePRGn",
          "interpolatePiYG",
          "interpolatePuOr",
          "interpolateRdBu",
          "interpolateRdGy",
          "interpolateRdYlBu",
          "interpolateRdYlGn",
          "interpolateSpectral",
          "interpolateGreys",
          "interpolateGreens",
          "interpolateOranges",
          "interpolateReds",
          "interpolatePurples",
          "interpolateBlues",
          "interpolateViridis",
          "interpolateInferno",
          "interpolateMagma",
          "interpolatePlasma",
          "interpolateWarm",
          "interpolateCubehelixDefault",
          "interpolateYlGn",
          "interpolateGnBu",
          "interpolatePuBu",
          "interpolatePuRd",
          "interpolateRdPu",
          "interpolateOrRd",
          "interpolatePuBuGn",
          "interpolateYlGnBu",
          "interpolateYlOrRd",
          "interpolateRainbow",
        ]
      },
    }),
  ]
};

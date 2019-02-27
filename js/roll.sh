#!/bin/sh
rollup -c rollup.config.js -m inline
patch main-bundle.js pca-matrix-import.patch
rollup -c rollup.config.js -m inline -i pre.js -o pre-bundle.js -f iife
rollup -c rollup.config.js -m inline -i test.js -o test-bundle.js -f iife

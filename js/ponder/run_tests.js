import * as unit from "./unit.js";
import * as utt from "./test/utils.js";
import * as qtt from "./test/quadtree.js";
import * as prt from "./test/properties.js";
import * as tft from "./test/transforms.js";

export function run() {
  unit.run_suites("utils", utt.suites);
  unit.run_suites("quadtree", qtt.suites);
  unit.run_suites("properties", prt.suites);
  unit.run_suites("transforms", tft.suites);
}

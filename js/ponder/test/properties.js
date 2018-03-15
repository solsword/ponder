define(["../unit", "../properties"], function (unit, prp) {
  /*
   * Test functions
   */

  index_strings_tests = [
    unit.equals_test(prp.index__string(["foo", "bar", 0]), ".foo.bar:0"),
    unit.equals_test(prp.index__string(["foo", 17, "bar"]), ".foo:17.bar"),
    unit.equals_test(prp.index__string([281, "a", "b"]), ":281.a.b"),
    unit.equals_test(prp.string__index(".foo.bar:0"), ["foo", "bar", 0]),
    unit.equals_test(prp.string__index(".foo:17.bar"), ["foo", 17, "bar"]),
    unit.equals_test(prp.string__index(":281.a.b"), [281, "a", "b"]),
  ];

  return {
    "suites": {
      "index_strings_tests": index_strings_tests,
    }
  };
});

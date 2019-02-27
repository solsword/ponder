(function () {
  'use strict';

  function ascending(a, b) {
    return a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN;
  }

  function bisector(compare) {
    if (compare.length === 1) compare = ascendingComparator(compare);
    return {
      left: function(a, x, lo, hi) {
        if (lo == null) lo = 0;
        if (hi == null) hi = a.length;
        while (lo < hi) {
          var mid = lo + hi >>> 1;
          if (compare(a[mid], x) < 0) lo = mid + 1;
          else hi = mid;
        }
        return lo;
      },
      right: function(a, x, lo, hi) {
        if (lo == null) lo = 0;
        if (hi == null) hi = a.length;
        while (lo < hi) {
          var mid = lo + hi >>> 1;
          if (compare(a[mid], x) > 0) hi = mid;
          else lo = mid + 1;
        }
        return lo;
      }
    };
  }

  function ascendingComparator(f) {
    return function(d, x) {
      return ascending(f(d), x);
    };
  }

  var ascendingBisect = bisector(ascending);
  var bisectRight = ascendingBisect.right;

  var e10 = Math.sqrt(50),
      e5 = Math.sqrt(10),
      e2 = Math.sqrt(2);

  function ticks(start, stop, count) {
    var reverse,
        i = -1,
        n,
        ticks,
        step;

    stop = +stop, start = +start, count = +count;
    if (start === stop && count > 0) return [start];
    if (reverse = stop < start) n = start, start = stop, stop = n;
    if ((step = tickIncrement(start, stop, count)) === 0 || !isFinite(step)) return [];

    if (step > 0) {
      start = Math.ceil(start / step);
      stop = Math.floor(stop / step);
      ticks = new Array(n = Math.ceil(stop - start + 1));
      while (++i < n) ticks[i] = (start + i) * step;
    } else {
      start = Math.floor(start * step);
      stop = Math.ceil(stop * step);
      ticks = new Array(n = Math.ceil(start - stop + 1));
      while (++i < n) ticks[i] = (start - i) / step;
    }

    if (reverse) ticks.reverse();

    return ticks;
  }

  function tickIncrement(start, stop, count) {
    var step = (stop - start) / Math.max(0, count),
        power = Math.floor(Math.log(step) / Math.LN10),
        error = step / Math.pow(10, power);
    return power >= 0
        ? (error >= e10 ? 10 : error >= e5 ? 5 : error >= e2 ? 2 : 1) * Math.pow(10, power)
        : -Math.pow(10, -power) / (error >= e10 ? 10 : error >= e5 ? 5 : error >= e2 ? 2 : 1);
  }

  function tickStep(start, stop, count) {
    var step0 = Math.abs(stop - start) / Math.max(0, count),
        step1 = Math.pow(10, Math.floor(Math.log(step0) / Math.LN10)),
        error = step0 / step1;
    if (error >= e10) step1 *= 10;
    else if (error >= e5) step1 *= 5;
    else if (error >= e2) step1 *= 2;
    return stop < start ? -step1 : step1;
  }

  var slice = Array.prototype.slice;

  function identity(x) {
    return x;
  }

  var top = 1,
      right = 2,
      bottom = 3,
      left = 4,
      epsilon = 1e-6;

  function translateX(x) {
    return "translate(" + (x + 0.5) + ",0)";
  }

  function translateY(y) {
    return "translate(0," + (y + 0.5) + ")";
  }

  function number(scale) {
    return function(d) {
      return +scale(d);
    };
  }

  function center(scale) {
    var offset = Math.max(0, scale.bandwidth() - 1) / 2; // Adjust for 0.5px offset.
    if (scale.round()) offset = Math.round(offset);
    return function(d) {
      return +scale(d) + offset;
    };
  }

  function entering() {
    return !this.__axis;
  }

  function axis(orient, scale) {
    var tickArguments = [],
        tickValues = null,
        tickFormat = null,
        tickSizeInner = 6,
        tickSizeOuter = 6,
        tickPadding = 3,
        k = orient === top || orient === left ? -1 : 1,
        x = orient === left || orient === right ? "x" : "y",
        transform = orient === top || orient === bottom ? translateX : translateY;

    function axis(context) {
      var values = tickValues == null ? (scale.ticks ? scale.ticks.apply(scale, tickArguments) : scale.domain()) : tickValues,
          format = tickFormat == null ? (scale.tickFormat ? scale.tickFormat.apply(scale, tickArguments) : identity) : tickFormat,
          spacing = Math.max(tickSizeInner, 0) + tickPadding,
          range = scale.range(),
          range0 = +range[0] + 0.5,
          range1 = +range[range.length - 1] + 0.5,
          position = (scale.bandwidth ? center : number)(scale.copy()),
          selection = context.selection ? context.selection() : context,
          path = selection.selectAll(".domain").data([null]),
          tick = selection.selectAll(".tick").data(values, scale).order(),
          tickExit = tick.exit(),
          tickEnter = tick.enter().append("g").attr("class", "tick"),
          line = tick.select("line"),
          text = tick.select("text");

      path = path.merge(path.enter().insert("path", ".tick")
          .attr("class", "domain")
          .attr("stroke", "#000"));

      tick = tick.merge(tickEnter);

      line = line.merge(tickEnter.append("line")
          .attr("stroke", "#000")
          .attr(x + "2", k * tickSizeInner));

      text = text.merge(tickEnter.append("text")
          .attr("fill", "#000")
          .attr(x, k * spacing)
          .attr("dy", orient === top ? "0em" : orient === bottom ? "0.71em" : "0.32em"));

      if (context !== selection) {
        path = path.transition(context);
        tick = tick.transition(context);
        line = line.transition(context);
        text = text.transition(context);

        tickExit = tickExit.transition(context)
            .attr("opacity", epsilon)
            .attr("transform", function(d) { return isFinite(d = position(d)) ? transform(d) : this.getAttribute("transform"); });

        tickEnter
            .attr("opacity", epsilon)
            .attr("transform", function(d) { var p = this.parentNode.__axis; return transform(p && isFinite(p = p(d)) ? p : position(d)); });
      }

      tickExit.remove();

      path
          .attr("d", orient === left || orient == right
              ? "M" + k * tickSizeOuter + "," + range0 + "H0.5V" + range1 + "H" + k * tickSizeOuter
              : "M" + range0 + "," + k * tickSizeOuter + "V0.5H" + range1 + "V" + k * tickSizeOuter);

      tick
          .attr("opacity", 1)
          .attr("transform", function(d) { return transform(position(d)); });

      line
          .attr(x + "2", k * tickSizeInner);

      text
          .attr(x, k * spacing)
          .text(format);

      selection.filter(entering)
          .attr("fill", "none")
          .attr("font-size", 10)
          .attr("font-family", "sans-serif")
          .attr("text-anchor", orient === right ? "start" : orient === left ? "end" : "middle");

      selection
          .each(function() { this.__axis = position; });
    }

    axis.scale = function(_) {
      return arguments.length ? (scale = _, axis) : scale;
    };

    axis.ticks = function() {
      return tickArguments = slice.call(arguments), axis;
    };

    axis.tickArguments = function(_) {
      return arguments.length ? (tickArguments = _ == null ? [] : slice.call(_), axis) : tickArguments.slice();
    };

    axis.tickValues = function(_) {
      return arguments.length ? (tickValues = _ == null ? null : slice.call(_), axis) : tickValues && tickValues.slice();
    };

    axis.tickFormat = function(_) {
      return arguments.length ? (tickFormat = _, axis) : tickFormat;
    };

    axis.tickSize = function(_) {
      return arguments.length ? (tickSizeInner = tickSizeOuter = +_, axis) : tickSizeInner;
    };

    axis.tickSizeInner = function(_) {
      return arguments.length ? (tickSizeInner = +_, axis) : tickSizeInner;
    };

    axis.tickSizeOuter = function(_) {
      return arguments.length ? (tickSizeOuter = +_, axis) : tickSizeOuter;
    };

    axis.tickPadding = function(_) {
      return arguments.length ? (tickPadding = +_, axis) : tickPadding;
    };

    return axis;
  }

  function axisBottom(scale) {
    return axis(bottom, scale);
  }

  function axisLeft(scale) {
    return axis(left, scale);
  }

  var noop = {value: function() {}};

  function dispatch() {
    for (var i = 0, n = arguments.length, _ = {}, t; i < n; ++i) {
      if (!(t = arguments[i] + "") || (t in _)) throw new Error("illegal type: " + t);
      _[t] = [];
    }
    return new Dispatch(_);
  }

  function Dispatch(_) {
    this._ = _;
  }

  function parseTypenames(typenames, types) {
    return typenames.trim().split(/^|\s+/).map(function(t) {
      var name = "", i = t.indexOf(".");
      if (i >= 0) name = t.slice(i + 1), t = t.slice(0, i);
      if (t && !types.hasOwnProperty(t)) throw new Error("unknown type: " + t);
      return {type: t, name: name};
    });
  }

  Dispatch.prototype = dispatch.prototype = {
    constructor: Dispatch,
    on: function(typename, callback) {
      var _ = this._,
          T = parseTypenames(typename + "", _),
          t,
          i = -1,
          n = T.length;

      // If no callback was specified, return the callback of the given type and name.
      if (arguments.length < 2) {
        while (++i < n) if ((t = (typename = T[i]).type) && (t = get(_[t], typename.name))) return t;
        return;
      }

      // If a type was specified, set the callback for the given type and name.
      // Otherwise, if a null callback was specified, remove callbacks of the given name.
      if (callback != null && typeof callback !== "function") throw new Error("invalid callback: " + callback);
      while (++i < n) {
        if (t = (typename = T[i]).type) _[t] = set(_[t], typename.name, callback);
        else if (callback == null) for (t in _) _[t] = set(_[t], typename.name, null);
      }

      return this;
    },
    copy: function() {
      var copy = {}, _ = this._;
      for (var t in _) copy[t] = _[t].slice();
      return new Dispatch(copy);
    },
    call: function(type, that) {
      if ((n = arguments.length - 2) > 0) for (var args = new Array(n), i = 0, n, t; i < n; ++i) args[i] = arguments[i + 2];
      if (!this._.hasOwnProperty(type)) throw new Error("unknown type: " + type);
      for (t = this._[type], i = 0, n = t.length; i < n; ++i) t[i].value.apply(that, args);
    },
    apply: function(type, that, args) {
      if (!this._.hasOwnProperty(type)) throw new Error("unknown type: " + type);
      for (var t = this._[type], i = 0, n = t.length; i < n; ++i) t[i].value.apply(that, args);
    }
  };

  function get(type, name) {
    for (var i = 0, n = type.length, c; i < n; ++i) {
      if ((c = type[i]).name === name) {
        return c.value;
      }
    }
  }

  function set(type, name, callback) {
    for (var i = 0, n = type.length; i < n; ++i) {
      if (type[i].name === name) {
        type[i] = noop, type = type.slice(0, i).concat(type.slice(i + 1));
        break;
      }
    }
    if (callback != null) type.push({name: name, value: callback});
    return type;
  }

  var xhtml = "http://www.w3.org/1999/xhtml";

  var namespaces = {
    svg: "http://www.w3.org/2000/svg",
    xhtml: xhtml,
    xlink: "http://www.w3.org/1999/xlink",
    xml: "http://www.w3.org/XML/1998/namespace",
    xmlns: "http://www.w3.org/2000/xmlns/"
  };

  function namespace(name) {
    var prefix = name += "", i = prefix.indexOf(":");
    if (i >= 0 && (prefix = name.slice(0, i)) !== "xmlns") name = name.slice(i + 1);
    return namespaces.hasOwnProperty(prefix) ? {space: namespaces[prefix], local: name} : name;
  }

  function creatorInherit(name) {
    return function() {
      var document = this.ownerDocument,
          uri = this.namespaceURI;
      return uri === xhtml && document.documentElement.namespaceURI === xhtml
          ? document.createElement(name)
          : document.createElementNS(uri, name);
    };
  }

  function creatorFixed(fullname) {
    return function() {
      return this.ownerDocument.createElementNS(fullname.space, fullname.local);
    };
  }

  function creator(name) {
    var fullname = namespace(name);
    return (fullname.local
        ? creatorFixed
        : creatorInherit)(fullname);
  }

  function none() {}

  function selector(selector) {
    return selector == null ? none : function() {
      return this.querySelector(selector);
    };
  }

  function selection_select(select) {
    if (typeof select !== "function") select = selector(select);

    for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, subgroup = subgroups[j] = new Array(n), node, subnode, i = 0; i < n; ++i) {
        if ((node = group[i]) && (subnode = select.call(node, node.__data__, i, group))) {
          if ("__data__" in node) subnode.__data__ = node.__data__;
          subgroup[i] = subnode;
        }
      }
    }

    return new Selection(subgroups, this._parents);
  }

  function empty() {
    return [];
  }

  function selectorAll(selector) {
    return selector == null ? empty : function() {
      return this.querySelectorAll(selector);
    };
  }

  function selection_selectAll(select) {
    if (typeof select !== "function") select = selectorAll(select);

    for (var groups = this._groups, m = groups.length, subgroups = [], parents = [], j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
        if (node = group[i]) {
          subgroups.push(select.call(node, node.__data__, i, group));
          parents.push(node);
        }
      }
    }

    return new Selection(subgroups, parents);
  }

  var matcher = function(selector) {
    return function() {
      return this.matches(selector);
    };
  };

  if (typeof document !== "undefined") {
    var element = document.documentElement;
    if (!element.matches) {
      var vendorMatches = element.webkitMatchesSelector
          || element.msMatchesSelector
          || element.mozMatchesSelector
          || element.oMatchesSelector;
      matcher = function(selector) {
        return function() {
          return vendorMatches.call(this, selector);
        };
      };
    }
  }

  var matcher$1 = matcher;

  function selection_filter(match) {
    if (typeof match !== "function") match = matcher$1(match);

    for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, subgroup = subgroups[j] = [], node, i = 0; i < n; ++i) {
        if ((node = group[i]) && match.call(node, node.__data__, i, group)) {
          subgroup.push(node);
        }
      }
    }

    return new Selection(subgroups, this._parents);
  }

  function sparse(update) {
    return new Array(update.length);
  }

  function selection_enter() {
    return new Selection(this._enter || this._groups.map(sparse), this._parents);
  }

  function EnterNode(parent, datum) {
    this.ownerDocument = parent.ownerDocument;
    this.namespaceURI = parent.namespaceURI;
    this._next = null;
    this._parent = parent;
    this.__data__ = datum;
  }

  EnterNode.prototype = {
    constructor: EnterNode,
    appendChild: function(child) { return this._parent.insertBefore(child, this._next); },
    insertBefore: function(child, next) { return this._parent.insertBefore(child, next); },
    querySelector: function(selector) { return this._parent.querySelector(selector); },
    querySelectorAll: function(selector) { return this._parent.querySelectorAll(selector); }
  };

  function constant(x) {
    return function() {
      return x;
    };
  }

  var keyPrefix = "$"; // Protect against keys like “__proto__”.

  function bindIndex(parent, group, enter, update, exit, data) {
    var i = 0,
        node,
        groupLength = group.length,
        dataLength = data.length;

    // Put any non-null nodes that fit into update.
    // Put any null nodes into enter.
    // Put any remaining data into enter.
    for (; i < dataLength; ++i) {
      if (node = group[i]) {
        node.__data__ = data[i];
        update[i] = node;
      } else {
        enter[i] = new EnterNode(parent, data[i]);
      }
    }

    // Put any non-null nodes that don’t fit into exit.
    for (; i < groupLength; ++i) {
      if (node = group[i]) {
        exit[i] = node;
      }
    }
  }

  function bindKey(parent, group, enter, update, exit, data, key) {
    var i,
        node,
        nodeByKeyValue = {},
        groupLength = group.length,
        dataLength = data.length,
        keyValues = new Array(groupLength),
        keyValue;

    // Compute the key for each node.
    // If multiple nodes have the same key, the duplicates are added to exit.
    for (i = 0; i < groupLength; ++i) {
      if (node = group[i]) {
        keyValues[i] = keyValue = keyPrefix + key.call(node, node.__data__, i, group);
        if (keyValue in nodeByKeyValue) {
          exit[i] = node;
        } else {
          nodeByKeyValue[keyValue] = node;
        }
      }
    }

    // Compute the key for each datum.
    // If there a node associated with this key, join and add it to update.
    // If there is not (or the key is a duplicate), add it to enter.
    for (i = 0; i < dataLength; ++i) {
      keyValue = keyPrefix + key.call(parent, data[i], i, data);
      if (node = nodeByKeyValue[keyValue]) {
        update[i] = node;
        node.__data__ = data[i];
        nodeByKeyValue[keyValue] = null;
      } else {
        enter[i] = new EnterNode(parent, data[i]);
      }
    }

    // Add any remaining nodes that were not bound to data to exit.
    for (i = 0; i < groupLength; ++i) {
      if ((node = group[i]) && (nodeByKeyValue[keyValues[i]] === node)) {
        exit[i] = node;
      }
    }
  }

  function selection_data(value, key) {
    if (!value) {
      data = new Array(this.size()), j = -1;
      this.each(function(d) { data[++j] = d; });
      return data;
    }

    var bind = key ? bindKey : bindIndex,
        parents = this._parents,
        groups = this._groups;

    if (typeof value !== "function") value = constant(value);

    for (var m = groups.length, update = new Array(m), enter = new Array(m), exit = new Array(m), j = 0; j < m; ++j) {
      var parent = parents[j],
          group = groups[j],
          groupLength = group.length,
          data = value.call(parent, parent && parent.__data__, j, parents),
          dataLength = data.length,
          enterGroup = enter[j] = new Array(dataLength),
          updateGroup = update[j] = new Array(dataLength),
          exitGroup = exit[j] = new Array(groupLength);

      bind(parent, group, enterGroup, updateGroup, exitGroup, data, key);

      // Now connect the enter nodes to their following update node, such that
      // appendChild can insert the materialized enter node before this node,
      // rather than at the end of the parent node.
      for (var i0 = 0, i1 = 0, previous, next; i0 < dataLength; ++i0) {
        if (previous = enterGroup[i0]) {
          if (i0 >= i1) i1 = i0 + 1;
          while (!(next = updateGroup[i1]) && ++i1 < dataLength);
          previous._next = next || null;
        }
      }
    }

    update = new Selection(update, parents);
    update._enter = enter;
    update._exit = exit;
    return update;
  }

  function selection_exit() {
    return new Selection(this._exit || this._groups.map(sparse), this._parents);
  }

  function selection_merge(selection) {

    for (var groups0 = this._groups, groups1 = selection._groups, m0 = groups0.length, m1 = groups1.length, m = Math.min(m0, m1), merges = new Array(m0), j = 0; j < m; ++j) {
      for (var group0 = groups0[j], group1 = groups1[j], n = group0.length, merge = merges[j] = new Array(n), node, i = 0; i < n; ++i) {
        if (node = group0[i] || group1[i]) {
          merge[i] = node;
        }
      }
    }

    for (; j < m0; ++j) {
      merges[j] = groups0[j];
    }

    return new Selection(merges, this._parents);
  }

  function selection_order() {

    for (var groups = this._groups, j = -1, m = groups.length; ++j < m;) {
      for (var group = groups[j], i = group.length - 1, next = group[i], node; --i >= 0;) {
        if (node = group[i]) {
          if (next && next !== node.nextSibling) next.parentNode.insertBefore(node, next);
          next = node;
        }
      }
    }

    return this;
  }

  function selection_sort(compare) {
    if (!compare) compare = ascending$1;

    function compareNode(a, b) {
      return a && b ? compare(a.__data__, b.__data__) : !a - !b;
    }

    for (var groups = this._groups, m = groups.length, sortgroups = new Array(m), j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, sortgroup = sortgroups[j] = new Array(n), node, i = 0; i < n; ++i) {
        if (node = group[i]) {
          sortgroup[i] = node;
        }
      }
      sortgroup.sort(compareNode);
    }

    return new Selection(sortgroups, this._parents).order();
  }

  function ascending$1(a, b) {
    return a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN;
  }

  function selection_call() {
    var callback = arguments[0];
    arguments[0] = this;
    callback.apply(null, arguments);
    return this;
  }

  function selection_nodes() {
    var nodes = new Array(this.size()), i = -1;
    this.each(function() { nodes[++i] = this; });
    return nodes;
  }

  function selection_node() {

    for (var groups = this._groups, j = 0, m = groups.length; j < m; ++j) {
      for (var group = groups[j], i = 0, n = group.length; i < n; ++i) {
        var node = group[i];
        if (node) return node;
      }
    }

    return null;
  }

  function selection_size() {
    var size = 0;
    this.each(function() { ++size; });
    return size;
  }

  function selection_empty() {
    return !this.node();
  }

  function selection_each(callback) {

    for (var groups = this._groups, j = 0, m = groups.length; j < m; ++j) {
      for (var group = groups[j], i = 0, n = group.length, node; i < n; ++i) {
        if (node = group[i]) callback.call(node, node.__data__, i, group);
      }
    }

    return this;
  }

  function attrRemove(name) {
    return function() {
      this.removeAttribute(name);
    };
  }

  function attrRemoveNS(fullname) {
    return function() {
      this.removeAttributeNS(fullname.space, fullname.local);
    };
  }

  function attrConstant(name, value) {
    return function() {
      this.setAttribute(name, value);
    };
  }

  function attrConstantNS(fullname, value) {
    return function() {
      this.setAttributeNS(fullname.space, fullname.local, value);
    };
  }

  function attrFunction(name, value) {
    return function() {
      var v = value.apply(this, arguments);
      if (v == null) this.removeAttribute(name);
      else this.setAttribute(name, v);
    };
  }

  function attrFunctionNS(fullname, value) {
    return function() {
      var v = value.apply(this, arguments);
      if (v == null) this.removeAttributeNS(fullname.space, fullname.local);
      else this.setAttributeNS(fullname.space, fullname.local, v);
    };
  }

  function selection_attr(name, value) {
    var fullname = namespace(name);

    if (arguments.length < 2) {
      var node = this.node();
      return fullname.local
          ? node.getAttributeNS(fullname.space, fullname.local)
          : node.getAttribute(fullname);
    }

    return this.each((value == null
        ? (fullname.local ? attrRemoveNS : attrRemove) : (typeof value === "function"
        ? (fullname.local ? attrFunctionNS : attrFunction)
        : (fullname.local ? attrConstantNS : attrConstant)))(fullname, value));
  }

  function defaultView(node) {
    return (node.ownerDocument && node.ownerDocument.defaultView) // node is a Node
        || (node.document && node) // node is a Window
        || node.defaultView; // node is a Document
  }

  function styleRemove(name) {
    return function() {
      this.style.removeProperty(name);
    };
  }

  function styleConstant(name, value, priority) {
    return function() {
      this.style.setProperty(name, value, priority);
    };
  }

  function styleFunction(name, value, priority) {
    return function() {
      var v = value.apply(this, arguments);
      if (v == null) this.style.removeProperty(name);
      else this.style.setProperty(name, v, priority);
    };
  }

  function selection_style(name, value, priority) {
    return arguments.length > 1
        ? this.each((value == null
              ? styleRemove : typeof value === "function"
              ? styleFunction
              : styleConstant)(name, value, priority == null ? "" : priority))
        : styleValue(this.node(), name);
  }

  function styleValue(node, name) {
    return node.style.getPropertyValue(name)
        || defaultView(node).getComputedStyle(node, null).getPropertyValue(name);
  }

  function propertyRemove(name) {
    return function() {
      delete this[name];
    };
  }

  function propertyConstant(name, value) {
    return function() {
      this[name] = value;
    };
  }

  function propertyFunction(name, value) {
    return function() {
      var v = value.apply(this, arguments);
      if (v == null) delete this[name];
      else this[name] = v;
    };
  }

  function selection_property(name, value) {
    return arguments.length > 1
        ? this.each((value == null
            ? propertyRemove : typeof value === "function"
            ? propertyFunction
            : propertyConstant)(name, value))
        : this.node()[name];
  }

  function classArray(string) {
    return string.trim().split(/^|\s+/);
  }

  function classList(node) {
    return node.classList || new ClassList(node);
  }

  function ClassList(node) {
    this._node = node;
    this._names = classArray(node.getAttribute("class") || "");
  }

  ClassList.prototype = {
    add: function(name) {
      var i = this._names.indexOf(name);
      if (i < 0) {
        this._names.push(name);
        this._node.setAttribute("class", this._names.join(" "));
      }
    },
    remove: function(name) {
      var i = this._names.indexOf(name);
      if (i >= 0) {
        this._names.splice(i, 1);
        this._node.setAttribute("class", this._names.join(" "));
      }
    },
    contains: function(name) {
      return this._names.indexOf(name) >= 0;
    }
  };

  function classedAdd(node, names) {
    var list = classList(node), i = -1, n = names.length;
    while (++i < n) list.add(names[i]);
  }

  function classedRemove(node, names) {
    var list = classList(node), i = -1, n = names.length;
    while (++i < n) list.remove(names[i]);
  }

  function classedTrue(names) {
    return function() {
      classedAdd(this, names);
    };
  }

  function classedFalse(names) {
    return function() {
      classedRemove(this, names);
    };
  }

  function classedFunction(names, value) {
    return function() {
      (value.apply(this, arguments) ? classedAdd : classedRemove)(this, names);
    };
  }

  function selection_classed(name, value) {
    var names = classArray(name + "");

    if (arguments.length < 2) {
      var list = classList(this.node()), i = -1, n = names.length;
      while (++i < n) if (!list.contains(names[i])) return false;
      return true;
    }

    return this.each((typeof value === "function"
        ? classedFunction : value
        ? classedTrue
        : classedFalse)(names, value));
  }

  function textRemove() {
    this.textContent = "";
  }

  function textConstant(value) {
    return function() {
      this.textContent = value;
    };
  }

  function textFunction(value) {
    return function() {
      var v = value.apply(this, arguments);
      this.textContent = v == null ? "" : v;
    };
  }

  function selection_text(value) {
    return arguments.length
        ? this.each(value == null
            ? textRemove : (typeof value === "function"
            ? textFunction
            : textConstant)(value))
        : this.node().textContent;
  }

  function htmlRemove() {
    this.innerHTML = "";
  }

  function htmlConstant(value) {
    return function() {
      this.innerHTML = value;
    };
  }

  function htmlFunction(value) {
    return function() {
      var v = value.apply(this, arguments);
      this.innerHTML = v == null ? "" : v;
    };
  }

  function selection_html(value) {
    return arguments.length
        ? this.each(value == null
            ? htmlRemove : (typeof value === "function"
            ? htmlFunction
            : htmlConstant)(value))
        : this.node().innerHTML;
  }

  function raise() {
    if (this.nextSibling) this.parentNode.appendChild(this);
  }

  function selection_raise() {
    return this.each(raise);
  }

  function lower() {
    if (this.previousSibling) this.parentNode.insertBefore(this, this.parentNode.firstChild);
  }

  function selection_lower() {
    return this.each(lower);
  }

  function selection_append(name) {
    var create = typeof name === "function" ? name : creator(name);
    return this.select(function() {
      return this.appendChild(create.apply(this, arguments));
    });
  }

  function constantNull() {
    return null;
  }

  function selection_insert(name, before) {
    var create = typeof name === "function" ? name : creator(name),
        select = before == null ? constantNull : typeof before === "function" ? before : selector(before);
    return this.select(function() {
      return this.insertBefore(create.apply(this, arguments), select.apply(this, arguments) || null);
    });
  }

  function remove() {
    var parent = this.parentNode;
    if (parent) parent.removeChild(this);
  }

  function selection_remove() {
    return this.each(remove);
  }

  function selection_cloneShallow() {
    return this.parentNode.insertBefore(this.cloneNode(false), this.nextSibling);
  }

  function selection_cloneDeep() {
    return this.parentNode.insertBefore(this.cloneNode(true), this.nextSibling);
  }

  function selection_clone(deep) {
    return this.select(deep ? selection_cloneDeep : selection_cloneShallow);
  }

  function selection_datum(value) {
    return arguments.length
        ? this.property("__data__", value)
        : this.node().__data__;
  }

  var filterEvents = {};

  var event = null;

  if (typeof document !== "undefined") {
    var element$1 = document.documentElement;
    if (!("onmouseenter" in element$1)) {
      filterEvents = {mouseenter: "mouseover", mouseleave: "mouseout"};
    }
  }

  function filterContextListener(listener, index, group) {
    listener = contextListener(listener, index, group);
    return function(event) {
      var related = event.relatedTarget;
      if (!related || (related !== this && !(related.compareDocumentPosition(this) & 8))) {
        listener.call(this, event);
      }
    };
  }

  function contextListener(listener, index, group) {
    return function(event1) {
      var event0 = event; // Events can be reentrant (e.g., focus).
      event = event1;
      try {
        listener.call(this, this.__data__, index, group);
      } finally {
        event = event0;
      }
    };
  }

  function parseTypenames$1(typenames) {
    return typenames.trim().split(/^|\s+/).map(function(t) {
      var name = "", i = t.indexOf(".");
      if (i >= 0) name = t.slice(i + 1), t = t.slice(0, i);
      return {type: t, name: name};
    });
  }

  function onRemove(typename) {
    return function() {
      var on = this.__on;
      if (!on) return;
      for (var j = 0, i = -1, m = on.length, o; j < m; ++j) {
        if (o = on[j], (!typename.type || o.type === typename.type) && o.name === typename.name) {
          this.removeEventListener(o.type, o.listener, o.capture);
        } else {
          on[++i] = o;
        }
      }
      if (++i) on.length = i;
      else delete this.__on;
    };
  }

  function onAdd(typename, value, capture) {
    var wrap = filterEvents.hasOwnProperty(typename.type) ? filterContextListener : contextListener;
    return function(d, i, group) {
      var on = this.__on, o, listener = wrap(value, i, group);
      if (on) for (var j = 0, m = on.length; j < m; ++j) {
        if ((o = on[j]).type === typename.type && o.name === typename.name) {
          this.removeEventListener(o.type, o.listener, o.capture);
          this.addEventListener(o.type, o.listener = listener, o.capture = capture);
          o.value = value;
          return;
        }
      }
      this.addEventListener(typename.type, listener, capture);
      o = {type: typename.type, name: typename.name, value: value, listener: listener, capture: capture};
      if (!on) this.__on = [o];
      else on.push(o);
    };
  }

  function selection_on(typename, value, capture) {
    var typenames = parseTypenames$1(typename + ""), i, n = typenames.length, t;

    if (arguments.length < 2) {
      var on = this.node().__on;
      if (on) for (var j = 0, m = on.length, o; j < m; ++j) {
        for (i = 0, o = on[j]; i < n; ++i) {
          if ((t = typenames[i]).type === o.type && t.name === o.name) {
            return o.value;
          }
        }
      }
      return;
    }

    on = value ? onAdd : onRemove;
    if (capture == null) capture = false;
    for (i = 0; i < n; ++i) this.each(on(typenames[i], value, capture));
    return this;
  }

  function dispatchEvent(node, type, params) {
    var window = defaultView(node),
        event = window.CustomEvent;

    if (typeof event === "function") {
      event = new event(type, params);
    } else {
      event = window.document.createEvent("Event");
      if (params) event.initEvent(type, params.bubbles, params.cancelable), event.detail = params.detail;
      else event.initEvent(type, false, false);
    }

    node.dispatchEvent(event);
  }

  function dispatchConstant(type, params) {
    return function() {
      return dispatchEvent(this, type, params);
    };
  }

  function dispatchFunction(type, params) {
    return function() {
      return dispatchEvent(this, type, params.apply(this, arguments));
    };
  }

  function selection_dispatch(type, params) {
    return this.each((typeof params === "function"
        ? dispatchFunction
        : dispatchConstant)(type, params));
  }

  var root = [null];

  function Selection(groups, parents) {
    this._groups = groups;
    this._parents = parents;
  }

  function selection() {
    return new Selection([[document.documentElement]], root);
  }

  Selection.prototype = selection.prototype = {
    constructor: Selection,
    select: selection_select,
    selectAll: selection_selectAll,
    filter: selection_filter,
    data: selection_data,
    enter: selection_enter,
    exit: selection_exit,
    merge: selection_merge,
    order: selection_order,
    sort: selection_sort,
    call: selection_call,
    nodes: selection_nodes,
    node: selection_node,
    size: selection_size,
    empty: selection_empty,
    each: selection_each,
    attr: selection_attr,
    style: selection_style,
    property: selection_property,
    classed: selection_classed,
    text: selection_text,
    html: selection_html,
    raise: selection_raise,
    lower: selection_lower,
    append: selection_append,
    insert: selection_insert,
    remove: selection_remove,
    clone: selection_clone,
    datum: selection_datum,
    on: selection_on,
    dispatch: selection_dispatch
  };

  function select(selector) {
    return typeof selector === "string"
        ? new Selection([[document.querySelector(selector)]], [document.documentElement])
        : new Selection([[selector]], root);
  }

  function sourceEvent() {
    var current = event, source;
    while (source = current.sourceEvent) current = source;
    return current;
  }

  function point(node, event) {
    var svg = node.ownerSVGElement || node;

    if (svg.createSVGPoint) {
      var point = svg.createSVGPoint();
      point.x = event.clientX, point.y = event.clientY;
      point = point.matrixTransform(node.getScreenCTM().inverse());
      return [point.x, point.y];
    }

    var rect = node.getBoundingClientRect();
    return [event.clientX - rect.left - node.clientLeft, event.clientY - rect.top - node.clientTop];
  }

  function mouse(node) {
    var event = sourceEvent();
    if (event.changedTouches) event = event.changedTouches[0];
    return point(node, event);
  }

  function define$1(constructor, factory, prototype) {
    constructor.prototype = factory.prototype = prototype;
    prototype.constructor = constructor;
  }

  function extend(parent, definition) {
    var prototype = Object.create(parent.prototype);
    for (var key in definition) prototype[key] = definition[key];
    return prototype;
  }

  function Color() {}

  var darker = 0.7;
  var brighter = 1 / darker;

  var reI = "\\s*([+-]?\\d+)\\s*",
      reN = "\\s*([+-]?\\d*\\.?\\d+(?:[eE][+-]?\\d+)?)\\s*",
      reP = "\\s*([+-]?\\d*\\.?\\d+(?:[eE][+-]?\\d+)?)%\\s*",
      reHex3 = /^#([0-9a-f]{3})$/,
      reHex6 = /^#([0-9a-f]{6})$/,
      reRgbInteger = new RegExp("^rgb\\(" + [reI, reI, reI] + "\\)$"),
      reRgbPercent = new RegExp("^rgb\\(" + [reP, reP, reP] + "\\)$"),
      reRgbaInteger = new RegExp("^rgba\\(" + [reI, reI, reI, reN] + "\\)$"),
      reRgbaPercent = new RegExp("^rgba\\(" + [reP, reP, reP, reN] + "\\)$"),
      reHslPercent = new RegExp("^hsl\\(" + [reN, reP, reP] + "\\)$"),
      reHslaPercent = new RegExp("^hsla\\(" + [reN, reP, reP, reN] + "\\)$");

  var named = {
    aliceblue: 0xf0f8ff,
    antiquewhite: 0xfaebd7,
    aqua: 0x00ffff,
    aquamarine: 0x7fffd4,
    azure: 0xf0ffff,
    beige: 0xf5f5dc,
    bisque: 0xffe4c4,
    black: 0x000000,
    blanchedalmond: 0xffebcd,
    blue: 0x0000ff,
    blueviolet: 0x8a2be2,
    brown: 0xa52a2a,
    burlywood: 0xdeb887,
    cadetblue: 0x5f9ea0,
    chartreuse: 0x7fff00,
    chocolate: 0xd2691e,
    coral: 0xff7f50,
    cornflowerblue: 0x6495ed,
    cornsilk: 0xfff8dc,
    crimson: 0xdc143c,
    cyan: 0x00ffff,
    darkblue: 0x00008b,
    darkcyan: 0x008b8b,
    darkgoldenrod: 0xb8860b,
    darkgray: 0xa9a9a9,
    darkgreen: 0x006400,
    darkgrey: 0xa9a9a9,
    darkkhaki: 0xbdb76b,
    darkmagenta: 0x8b008b,
    darkolivegreen: 0x556b2f,
    darkorange: 0xff8c00,
    darkorchid: 0x9932cc,
    darkred: 0x8b0000,
    darksalmon: 0xe9967a,
    darkseagreen: 0x8fbc8f,
    darkslateblue: 0x483d8b,
    darkslategray: 0x2f4f4f,
    darkslategrey: 0x2f4f4f,
    darkturquoise: 0x00ced1,
    darkviolet: 0x9400d3,
    deeppink: 0xff1493,
    deepskyblue: 0x00bfff,
    dimgray: 0x696969,
    dimgrey: 0x696969,
    dodgerblue: 0x1e90ff,
    firebrick: 0xb22222,
    floralwhite: 0xfffaf0,
    forestgreen: 0x228b22,
    fuchsia: 0xff00ff,
    gainsboro: 0xdcdcdc,
    ghostwhite: 0xf8f8ff,
    gold: 0xffd700,
    goldenrod: 0xdaa520,
    gray: 0x808080,
    green: 0x008000,
    greenyellow: 0xadff2f,
    grey: 0x808080,
    honeydew: 0xf0fff0,
    hotpink: 0xff69b4,
    indianred: 0xcd5c5c,
    indigo: 0x4b0082,
    ivory: 0xfffff0,
    khaki: 0xf0e68c,
    lavender: 0xe6e6fa,
    lavenderblush: 0xfff0f5,
    lawngreen: 0x7cfc00,
    lemonchiffon: 0xfffacd,
    lightblue: 0xadd8e6,
    lightcoral: 0xf08080,
    lightcyan: 0xe0ffff,
    lightgoldenrodyellow: 0xfafad2,
    lightgray: 0xd3d3d3,
    lightgreen: 0x90ee90,
    lightgrey: 0xd3d3d3,
    lightpink: 0xffb6c1,
    lightsalmon: 0xffa07a,
    lightseagreen: 0x20b2aa,
    lightskyblue: 0x87cefa,
    lightslategray: 0x778899,
    lightslategrey: 0x778899,
    lightsteelblue: 0xb0c4de,
    lightyellow: 0xffffe0,
    lime: 0x00ff00,
    limegreen: 0x32cd32,
    linen: 0xfaf0e6,
    magenta: 0xff00ff,
    maroon: 0x800000,
    mediumaquamarine: 0x66cdaa,
    mediumblue: 0x0000cd,
    mediumorchid: 0xba55d3,
    mediumpurple: 0x9370db,
    mediumseagreen: 0x3cb371,
    mediumslateblue: 0x7b68ee,
    mediumspringgreen: 0x00fa9a,
    mediumturquoise: 0x48d1cc,
    mediumvioletred: 0xc71585,
    midnightblue: 0x191970,
    mintcream: 0xf5fffa,
    mistyrose: 0xffe4e1,
    moccasin: 0xffe4b5,
    navajowhite: 0xffdead,
    navy: 0x000080,
    oldlace: 0xfdf5e6,
    olive: 0x808000,
    olivedrab: 0x6b8e23,
    orange: 0xffa500,
    orangered: 0xff4500,
    orchid: 0xda70d6,
    palegoldenrod: 0xeee8aa,
    palegreen: 0x98fb98,
    paleturquoise: 0xafeeee,
    palevioletred: 0xdb7093,
    papayawhip: 0xffefd5,
    peachpuff: 0xffdab9,
    peru: 0xcd853f,
    pink: 0xffc0cb,
    plum: 0xdda0dd,
    powderblue: 0xb0e0e6,
    purple: 0x800080,
    rebeccapurple: 0x663399,
    red: 0xff0000,
    rosybrown: 0xbc8f8f,
    royalblue: 0x4169e1,
    saddlebrown: 0x8b4513,
    salmon: 0xfa8072,
    sandybrown: 0xf4a460,
    seagreen: 0x2e8b57,
    seashell: 0xfff5ee,
    sienna: 0xa0522d,
    silver: 0xc0c0c0,
    skyblue: 0x87ceeb,
    slateblue: 0x6a5acd,
    slategray: 0x708090,
    slategrey: 0x708090,
    snow: 0xfffafa,
    springgreen: 0x00ff7f,
    steelblue: 0x4682b4,
    tan: 0xd2b48c,
    teal: 0x008080,
    thistle: 0xd8bfd8,
    tomato: 0xff6347,
    turquoise: 0x40e0d0,
    violet: 0xee82ee,
    wheat: 0xf5deb3,
    white: 0xffffff,
    whitesmoke: 0xf5f5f5,
    yellow: 0xffff00,
    yellowgreen: 0x9acd32
  };

  define$1(Color, color, {
    displayable: function() {
      return this.rgb().displayable();
    },
    toString: function() {
      return this.rgb() + "";
    }
  });

  function color(format) {
    var m;
    format = (format + "").trim().toLowerCase();
    return (m = reHex3.exec(format)) ? (m = parseInt(m[1], 16), new Rgb((m >> 8 & 0xf) | (m >> 4 & 0x0f0), (m >> 4 & 0xf) | (m & 0xf0), ((m & 0xf) << 4) | (m & 0xf), 1)) // #f00
        : (m = reHex6.exec(format)) ? rgbn(parseInt(m[1], 16)) // #ff0000
        : (m = reRgbInteger.exec(format)) ? new Rgb(m[1], m[2], m[3], 1) // rgb(255, 0, 0)
        : (m = reRgbPercent.exec(format)) ? new Rgb(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, 1) // rgb(100%, 0%, 0%)
        : (m = reRgbaInteger.exec(format)) ? rgba(m[1], m[2], m[3], m[4]) // rgba(255, 0, 0, 1)
        : (m = reRgbaPercent.exec(format)) ? rgba(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, m[4]) // rgb(100%, 0%, 0%, 1)
        : (m = reHslPercent.exec(format)) ? hsla(m[1], m[2] / 100, m[3] / 100, 1) // hsl(120, 50%, 50%)
        : (m = reHslaPercent.exec(format)) ? hsla(m[1], m[2] / 100, m[3] / 100, m[4]) // hsla(120, 50%, 50%, 1)
        : named.hasOwnProperty(format) ? rgbn(named[format])
        : format === "transparent" ? new Rgb(NaN, NaN, NaN, 0)
        : null;
  }

  function rgbn(n) {
    return new Rgb(n >> 16 & 0xff, n >> 8 & 0xff, n & 0xff, 1);
  }

  function rgba(r, g, b, a) {
    if (a <= 0) r = g = b = NaN;
    return new Rgb(r, g, b, a);
  }

  function rgbConvert(o) {
    if (!(o instanceof Color)) o = color(o);
    if (!o) return new Rgb;
    o = o.rgb();
    return new Rgb(o.r, o.g, o.b, o.opacity);
  }

  function rgb(r, g, b, opacity) {
    return arguments.length === 1 ? rgbConvert(r) : new Rgb(r, g, b, opacity == null ? 1 : opacity);
  }

  function Rgb(r, g, b, opacity) {
    this.r = +r;
    this.g = +g;
    this.b = +b;
    this.opacity = +opacity;
  }

  define$1(Rgb, rgb, extend(Color, {
    brighter: function(k) {
      k = k == null ? brighter : Math.pow(brighter, k);
      return new Rgb(this.r * k, this.g * k, this.b * k, this.opacity);
    },
    darker: function(k) {
      k = k == null ? darker : Math.pow(darker, k);
      return new Rgb(this.r * k, this.g * k, this.b * k, this.opacity);
    },
    rgb: function() {
      return this;
    },
    displayable: function() {
      return (0 <= this.r && this.r <= 255)
          && (0 <= this.g && this.g <= 255)
          && (0 <= this.b && this.b <= 255)
          && (0 <= this.opacity && this.opacity <= 1);
    },
    toString: function() {
      var a = this.opacity; a = isNaN(a) ? 1 : Math.max(0, Math.min(1, a));
      return (a === 1 ? "rgb(" : "rgba(")
          + Math.max(0, Math.min(255, Math.round(this.r) || 0)) + ", "
          + Math.max(0, Math.min(255, Math.round(this.g) || 0)) + ", "
          + Math.max(0, Math.min(255, Math.round(this.b) || 0))
          + (a === 1 ? ")" : ", " + a + ")");
    }
  }));

  function hsla(h, s, l, a) {
    if (a <= 0) h = s = l = NaN;
    else if (l <= 0 || l >= 1) h = s = NaN;
    else if (s <= 0) h = NaN;
    return new Hsl(h, s, l, a);
  }

  function hslConvert(o) {
    if (o instanceof Hsl) return new Hsl(o.h, o.s, o.l, o.opacity);
    if (!(o instanceof Color)) o = color(o);
    if (!o) return new Hsl;
    if (o instanceof Hsl) return o;
    o = o.rgb();
    var r = o.r / 255,
        g = o.g / 255,
        b = o.b / 255,
        min = Math.min(r, g, b),
        max = Math.max(r, g, b),
        h = NaN,
        s = max - min,
        l = (max + min) / 2;
    if (s) {
      if (r === max) h = (g - b) / s + (g < b) * 6;
      else if (g === max) h = (b - r) / s + 2;
      else h = (r - g) / s + 4;
      s /= l < 0.5 ? max + min : 2 - max - min;
      h *= 60;
    } else {
      s = l > 0 && l < 1 ? 0 : h;
    }
    return new Hsl(h, s, l, o.opacity);
  }

  function hsl(h, s, l, opacity) {
    return arguments.length === 1 ? hslConvert(h) : new Hsl(h, s, l, opacity == null ? 1 : opacity);
  }

  function Hsl(h, s, l, opacity) {
    this.h = +h;
    this.s = +s;
    this.l = +l;
    this.opacity = +opacity;
  }

  define$1(Hsl, hsl, extend(Color, {
    brighter: function(k) {
      k = k == null ? brighter : Math.pow(brighter, k);
      return new Hsl(this.h, this.s, this.l * k, this.opacity);
    },
    darker: function(k) {
      k = k == null ? darker : Math.pow(darker, k);
      return new Hsl(this.h, this.s, this.l * k, this.opacity);
    },
    rgb: function() {
      var h = this.h % 360 + (this.h < 0) * 360,
          s = isNaN(h) || isNaN(this.s) ? 0 : this.s,
          l = this.l,
          m2 = l + (l < 0.5 ? l : 1 - l) * s,
          m1 = 2 * l - m2;
      return new Rgb(
        hsl2rgb(h >= 240 ? h - 240 : h + 120, m1, m2),
        hsl2rgb(h, m1, m2),
        hsl2rgb(h < 120 ? h + 240 : h - 120, m1, m2),
        this.opacity
      );
    },
    displayable: function() {
      return (0 <= this.s && this.s <= 1 || isNaN(this.s))
          && (0 <= this.l && this.l <= 1)
          && (0 <= this.opacity && this.opacity <= 1);
    }
  }));

  /* From FvD 13.37, CSS Color Module Level 3 */
  function hsl2rgb(h, m1, m2) {
    return (h < 60 ? m1 + (m2 - m1) * h / 60
        : h < 180 ? m2
        : h < 240 ? m1 + (m2 - m1) * (240 - h) / 60
        : m1) * 255;
  }

  var deg2rad = Math.PI / 180;
  var rad2deg = 180 / Math.PI;

  var Kn = 18,
      Xn = 0.950470, // D65 standard referent
      Yn = 1,
      Zn = 1.088830,
      t0 = 4 / 29,
      t1 = 6 / 29,
      t2 = 3 * t1 * t1,
      t3 = t1 * t1 * t1;

  function labConvert(o) {
    if (o instanceof Lab) return new Lab(o.l, o.a, o.b, o.opacity);
    if (o instanceof Hcl) {
      var h = o.h * deg2rad;
      return new Lab(o.l, Math.cos(h) * o.c, Math.sin(h) * o.c, o.opacity);
    }
    if (!(o instanceof Rgb)) o = rgbConvert(o);
    var b = rgb2xyz(o.r),
        a = rgb2xyz(o.g),
        l = rgb2xyz(o.b),
        x = xyz2lab((0.4124564 * b + 0.3575761 * a + 0.1804375 * l) / Xn),
        y = xyz2lab((0.2126729 * b + 0.7151522 * a + 0.0721750 * l) / Yn),
        z = xyz2lab((0.0193339 * b + 0.1191920 * a + 0.9503041 * l) / Zn);
    return new Lab(116 * y - 16, 500 * (x - y), 200 * (y - z), o.opacity);
  }

  function lab(l, a, b, opacity) {
    return arguments.length === 1 ? labConvert(l) : new Lab(l, a, b, opacity == null ? 1 : opacity);
  }

  function Lab(l, a, b, opacity) {
    this.l = +l;
    this.a = +a;
    this.b = +b;
    this.opacity = +opacity;
  }

  define$1(Lab, lab, extend(Color, {
    brighter: function(k) {
      return new Lab(this.l + Kn * (k == null ? 1 : k), this.a, this.b, this.opacity);
    },
    darker: function(k) {
      return new Lab(this.l - Kn * (k == null ? 1 : k), this.a, this.b, this.opacity);
    },
    rgb: function() {
      var y = (this.l + 16) / 116,
          x = isNaN(this.a) ? y : y + this.a / 500,
          z = isNaN(this.b) ? y : y - this.b / 200;
      y = Yn * lab2xyz(y);
      x = Xn * lab2xyz(x);
      z = Zn * lab2xyz(z);
      return new Rgb(
        xyz2rgb( 3.2404542 * x - 1.5371385 * y - 0.4985314 * z), // D65 -> sRGB
        xyz2rgb(-0.9692660 * x + 1.8760108 * y + 0.0415560 * z),
        xyz2rgb( 0.0556434 * x - 0.2040259 * y + 1.0572252 * z),
        this.opacity
      );
    }
  }));

  function xyz2lab(t) {
    return t > t3 ? Math.pow(t, 1 / 3) : t / t2 + t0;
  }

  function lab2xyz(t) {
    return t > t1 ? t * t * t : t2 * (t - t0);
  }

  function xyz2rgb(x) {
    return 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
  }

  function rgb2xyz(x) {
    return (x /= 255) <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  }

  function hclConvert(o) {
    if (o instanceof Hcl) return new Hcl(o.h, o.c, o.l, o.opacity);
    if (!(o instanceof Lab)) o = labConvert(o);
    var h = Math.atan2(o.b, o.a) * rad2deg;
    return new Hcl(h < 0 ? h + 360 : h, Math.sqrt(o.a * o.a + o.b * o.b), o.l, o.opacity);
  }

  function hcl(h, c, l, opacity) {
    return arguments.length === 1 ? hclConvert(h) : new Hcl(h, c, l, opacity == null ? 1 : opacity);
  }

  function Hcl(h, c, l, opacity) {
    this.h = +h;
    this.c = +c;
    this.l = +l;
    this.opacity = +opacity;
  }

  define$1(Hcl, hcl, extend(Color, {
    brighter: function(k) {
      return new Hcl(this.h, this.c, this.l + Kn * (k == null ? 1 : k), this.opacity);
    },
    darker: function(k) {
      return new Hcl(this.h, this.c, this.l - Kn * (k == null ? 1 : k), this.opacity);
    },
    rgb: function() {
      return labConvert(this).rgb();
    }
  }));

  var A = -0.14861,
      B = +1.78277,
      C = -0.29227,
      D = -0.90649,
      E = +1.97294,
      ED = E * D,
      EB = E * B,
      BC_DA = B * C - D * A;

  function cubehelixConvert(o) {
    if (o instanceof Cubehelix) return new Cubehelix(o.h, o.s, o.l, o.opacity);
    if (!(o instanceof Rgb)) o = rgbConvert(o);
    var r = o.r / 255,
        g = o.g / 255,
        b = o.b / 255,
        l = (BC_DA * b + ED * r - EB * g) / (BC_DA + ED - EB),
        bl = b - l,
        k = (E * (g - l) - C * bl) / D,
        s = Math.sqrt(k * k + bl * bl) / (E * l * (1 - l)), // NaN if l=0 or l=1
        h = s ? Math.atan2(k, bl) * rad2deg - 120 : NaN;
    return new Cubehelix(h < 0 ? h + 360 : h, s, l, o.opacity);
  }

  function cubehelix(h, s, l, opacity) {
    return arguments.length === 1 ? cubehelixConvert(h) : new Cubehelix(h, s, l, opacity == null ? 1 : opacity);
  }

  function Cubehelix(h, s, l, opacity) {
    this.h = +h;
    this.s = +s;
    this.l = +l;
    this.opacity = +opacity;
  }

  define$1(Cubehelix, cubehelix, extend(Color, {
    brighter: function(k) {
      k = k == null ? brighter : Math.pow(brighter, k);
      return new Cubehelix(this.h, this.s, this.l * k, this.opacity);
    },
    darker: function(k) {
      k = k == null ? darker : Math.pow(darker, k);
      return new Cubehelix(this.h, this.s, this.l * k, this.opacity);
    },
    rgb: function() {
      var h = isNaN(this.h) ? 0 : (this.h + 120) * deg2rad,
          l = +this.l,
          a = isNaN(this.s) ? 0 : this.s * l * (1 - l),
          cosh = Math.cos(h),
          sinh = Math.sin(h);
      return new Rgb(
        255 * (l + a * (A * cosh + B * sinh)),
        255 * (l + a * (C * cosh + D * sinh)),
        255 * (l + a * (E * cosh)),
        this.opacity
      );
    }
  }));

  function constant$1(x) {
    return function() {
      return x;
    };
  }

  function linear(a, d) {
    return function(t) {
      return a + t * d;
    };
  }

  function exponential(a, b, y) {
    return a = Math.pow(a, y), b = Math.pow(b, y) - a, y = 1 / y, function(t) {
      return Math.pow(a + t * b, y);
    };
  }

  function hue(a, b) {
    var d = b - a;
    return d ? linear(a, d > 180 || d < -180 ? d - 360 * Math.round(d / 360) : d) : constant$1(isNaN(a) ? b : a);
  }

  function gamma(y) {
    return (y = +y) === 1 ? nogamma : function(a, b) {
      return b - a ? exponential(a, b, y) : constant$1(isNaN(a) ? b : a);
    };
  }

  function nogamma(a, b) {
    var d = b - a;
    return d ? linear(a, d) : constant$1(isNaN(a) ? b : a);
  }

  var interpolateRgb = (function rgbGamma(y) {
    var color = gamma(y);

    function rgb$1(start, end) {
      var r = color((start = rgb(start)).r, (end = rgb(end)).r),
          g = color(start.g, end.g),
          b = color(start.b, end.b),
          opacity = nogamma(start.opacity, end.opacity);
      return function(t) {
        start.r = r(t);
        start.g = g(t);
        start.b = b(t);
        start.opacity = opacity(t);
        return start + "";
      };
    }

    rgb$1.gamma = rgbGamma;

    return rgb$1;
  })(1);

  function array(a, b) {
    var nb = b ? b.length : 0,
        na = a ? Math.min(nb, a.length) : 0,
        x = new Array(na),
        c = new Array(nb),
        i;

    for (i = 0; i < na; ++i) x[i] = interpolateValue(a[i], b[i]);
    for (; i < nb; ++i) c[i] = b[i];

    return function(t) {
      for (i = 0; i < na; ++i) c[i] = x[i](t);
      return c;
    };
  }

  function date(a, b) {
    var d = new Date;
    return a = +a, b -= a, function(t) {
      return d.setTime(a + b * t), d;
    };
  }

  function interpolateNumber(a, b) {
    return a = +a, b -= a, function(t) {
      return a + b * t;
    };
  }

  function object(a, b) {
    var i = {},
        c = {},
        k;

    if (a === null || typeof a !== "object") a = {};
    if (b === null || typeof b !== "object") b = {};

    for (k in b) {
      if (k in a) {
        i[k] = interpolateValue(a[k], b[k]);
      } else {
        c[k] = b[k];
      }
    }

    return function(t) {
      for (k in i) c[k] = i[k](t);
      return c;
    };
  }

  var reA = /[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g,
      reB = new RegExp(reA.source, "g");

  function zero(b) {
    return function() {
      return b;
    };
  }

  function one(b) {
    return function(t) {
      return b(t) + "";
    };
  }

  function interpolateString(a, b) {
    var bi = reA.lastIndex = reB.lastIndex = 0, // scan index for next number in b
        am, // current match in a
        bm, // current match in b
        bs, // string preceding current number in b, if any
        i = -1, // index in s
        s = [], // string constants and placeholders
        q = []; // number interpolators

    // Coerce inputs to strings.
    a = a + "", b = b + "";

    // Interpolate pairs of numbers in a & b.
    while ((am = reA.exec(a))
        && (bm = reB.exec(b))) {
      if ((bs = bm.index) > bi) { // a string precedes the next number in b
        bs = b.slice(bi, bs);
        if (s[i]) s[i] += bs; // coalesce with previous string
        else s[++i] = bs;
      }
      if ((am = am[0]) === (bm = bm[0])) { // numbers in a & b match
        if (s[i]) s[i] += bm; // coalesce with previous string
        else s[++i] = bm;
      } else { // interpolate non-matching numbers
        s[++i] = null;
        q.push({i: i, x: interpolateNumber(am, bm)});
      }
      bi = reB.lastIndex;
    }

    // Add remains of b.
    if (bi < b.length) {
      bs = b.slice(bi);
      if (s[i]) s[i] += bs; // coalesce with previous string
      else s[++i] = bs;
    }

    // Special optimization for only a single match.
    // Otherwise, interpolate each of the numbers and rejoin the string.
    return s.length < 2 ? (q[0]
        ? one(q[0].x)
        : zero(b))
        : (b = q.length, function(t) {
            for (var i = 0, o; i < b; ++i) s[(o = q[i]).i] = o.x(t);
            return s.join("");
          });
  }

  function interpolateValue(a, b) {
    var t = typeof b, c;
    return b == null || t === "boolean" ? constant$1(b)
        : (t === "number" ? interpolateNumber
        : t === "string" ? ((c = color(b)) ? (b = c, interpolateRgb) : interpolateString)
        : b instanceof color ? interpolateRgb
        : b instanceof Date ? date
        : Array.isArray(b) ? array
        : typeof b.valueOf !== "function" && typeof b.toString !== "function" || isNaN(b) ? object
        : interpolateNumber)(a, b);
  }

  function interpolateRound(a, b) {
    return a = +a, b -= a, function(t) {
      return Math.round(a + b * t);
    };
  }

  var degrees = 180 / Math.PI;

  var identity$1 = {
    translateX: 0,
    translateY: 0,
    rotate: 0,
    skewX: 0,
    scaleX: 1,
    scaleY: 1
  };

  function decompose(a, b, c, d, e, f) {
    var scaleX, scaleY, skewX;
    if (scaleX = Math.sqrt(a * a + b * b)) a /= scaleX, b /= scaleX;
    if (skewX = a * c + b * d) c -= a * skewX, d -= b * skewX;
    if (scaleY = Math.sqrt(c * c + d * d)) c /= scaleY, d /= scaleY, skewX /= scaleY;
    if (a * d < b * c) a = -a, b = -b, skewX = -skewX, scaleX = -scaleX;
    return {
      translateX: e,
      translateY: f,
      rotate: Math.atan2(b, a) * degrees,
      skewX: Math.atan(skewX) * degrees,
      scaleX: scaleX,
      scaleY: scaleY
    };
  }

  var cssNode,
      cssRoot,
      cssView,
      svgNode;

  function parseCss(value) {
    if (value === "none") return identity$1;
    if (!cssNode) cssNode = document.createElement("DIV"), cssRoot = document.documentElement, cssView = document.defaultView;
    cssNode.style.transform = value;
    value = cssView.getComputedStyle(cssRoot.appendChild(cssNode), null).getPropertyValue("transform");
    cssRoot.removeChild(cssNode);
    value = value.slice(7, -1).split(",");
    return decompose(+value[0], +value[1], +value[2], +value[3], +value[4], +value[5]);
  }

  function parseSvg(value) {
    if (value == null) return identity$1;
    if (!svgNode) svgNode = document.createElementNS("http://www.w3.org/2000/svg", "g");
    svgNode.setAttribute("transform", value);
    if (!(value = svgNode.transform.baseVal.consolidate())) return identity$1;
    value = value.matrix;
    return decompose(value.a, value.b, value.c, value.d, value.e, value.f);
  }

  function interpolateTransform(parse, pxComma, pxParen, degParen) {

    function pop(s) {
      return s.length ? s.pop() + " " : "";
    }

    function translate(xa, ya, xb, yb, s, q) {
      if (xa !== xb || ya !== yb) {
        var i = s.push("translate(", null, pxComma, null, pxParen);
        q.push({i: i - 4, x: interpolateNumber(xa, xb)}, {i: i - 2, x: interpolateNumber(ya, yb)});
      } else if (xb || yb) {
        s.push("translate(" + xb + pxComma + yb + pxParen);
      }
    }

    function rotate(a, b, s, q) {
      if (a !== b) {
        if (a - b > 180) b += 360; else if (b - a > 180) a += 360; // shortest path
        q.push({i: s.push(pop(s) + "rotate(", null, degParen) - 2, x: interpolateNumber(a, b)});
      } else if (b) {
        s.push(pop(s) + "rotate(" + b + degParen);
      }
    }

    function skewX(a, b, s, q) {
      if (a !== b) {
        q.push({i: s.push(pop(s) + "skewX(", null, degParen) - 2, x: interpolateNumber(a, b)});
      } else if (b) {
        s.push(pop(s) + "skewX(" + b + degParen);
      }
    }

    function scale(xa, ya, xb, yb, s, q) {
      if (xa !== xb || ya !== yb) {
        var i = s.push(pop(s) + "scale(", null, ",", null, ")");
        q.push({i: i - 4, x: interpolateNumber(xa, xb)}, {i: i - 2, x: interpolateNumber(ya, yb)});
      } else if (xb !== 1 || yb !== 1) {
        s.push(pop(s) + "scale(" + xb + "," + yb + ")");
      }
    }

    return function(a, b) {
      var s = [], // string constants and placeholders
          q = []; // number interpolators
      a = parse(a), b = parse(b);
      translate(a.translateX, a.translateY, b.translateX, b.translateY, s, q);
      rotate(a.rotate, b.rotate, s, q);
      skewX(a.skewX, b.skewX, s, q);
      scale(a.scaleX, a.scaleY, b.scaleX, b.scaleY, s, q);
      a = b = null; // gc
      return function(t) {
        var i = -1, n = q.length, o;
        while (++i < n) s[(o = q[i]).i] = o.x(t);
        return s.join("");
      };
    };
  }

  var interpolateTransformCss = interpolateTransform(parseCss, "px, ", "px)", "deg)");
  var interpolateTransformSvg = interpolateTransform(parseSvg, ", ", ")", ")");

  var rho = Math.SQRT2;

  function cubehelix$1(hue) {
    return (function cubehelixGamma(y) {
      y = +y;

      function cubehelix$1(start, end) {
        var h = hue((start = cubehelix(start)).h, (end = cubehelix(end)).h),
            s = nogamma(start.s, end.s),
            l = nogamma(start.l, end.l),
            opacity = nogamma(start.opacity, end.opacity);
        return function(t) {
          start.h = h(t);
          start.s = s(t);
          start.l = l(Math.pow(t, y));
          start.opacity = opacity(t);
          return start + "";
        };
      }

      cubehelix$1.gamma = cubehelixGamma;

      return cubehelix$1;
    })(1);
  }

  var cubehelix$2 = cubehelix$1(hue);
  var cubehelixLong = cubehelix$1(nogamma);

  var frame = 0, // is an animation frame pending?
      timeout = 0, // is a timeout pending?
      interval = 0, // are any timers active?
      pokeDelay = 1000, // how frequently we check for clock skew
      taskHead,
      taskTail,
      clockLast = 0,
      clockNow = 0,
      clockSkew = 0,
      clock = typeof performance === "object" && performance.now ? performance : Date,
      setFrame = typeof window === "object" && window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : function(f) { setTimeout(f, 17); };

  function now() {
    return clockNow || (setFrame(clearNow), clockNow = clock.now() + clockSkew);
  }

  function clearNow() {
    clockNow = 0;
  }

  function Timer() {
    this._call =
    this._time =
    this._next = null;
  }

  Timer.prototype = timer.prototype = {
    constructor: Timer,
    restart: function(callback, delay, time) {
      if (typeof callback !== "function") throw new TypeError("callback is not a function");
      time = (time == null ? now() : +time) + (delay == null ? 0 : +delay);
      if (!this._next && taskTail !== this) {
        if (taskTail) taskTail._next = this;
        else taskHead = this;
        taskTail = this;
      }
      this._call = callback;
      this._time = time;
      sleep();
    },
    stop: function() {
      if (this._call) {
        this._call = null;
        this._time = Infinity;
        sleep();
      }
    }
  };

  function timer(callback, delay, time) {
    var t = new Timer;
    t.restart(callback, delay, time);
    return t;
  }

  function timerFlush() {
    now(); // Get the current time, if not already set.
    ++frame; // Pretend we’ve set an alarm, if we haven’t already.
    var t = taskHead, e;
    while (t) {
      if ((e = clockNow - t._time) >= 0) t._call.call(null, e);
      t = t._next;
    }
    --frame;
  }

  function wake() {
    clockNow = (clockLast = clock.now()) + clockSkew;
    frame = timeout = 0;
    try {
      timerFlush();
    } finally {
      frame = 0;
      nap();
      clockNow = 0;
    }
  }

  function poke() {
    var now = clock.now(), delay = now - clockLast;
    if (delay > pokeDelay) clockSkew -= delay, clockLast = now;
  }

  function nap() {
    var t0, t1 = taskHead, t2, time = Infinity;
    while (t1) {
      if (t1._call) {
        if (time > t1._time) time = t1._time;
        t0 = t1, t1 = t1._next;
      } else {
        t2 = t1._next, t1._next = null;
        t1 = t0 ? t0._next = t2 : taskHead = t2;
      }
    }
    taskTail = t0;
    sleep(time);
  }

  function sleep(time) {
    if (frame) return; // Soonest alarm already set, or will be.
    if (timeout) timeout = clearTimeout(timeout);
    var delay = time - clockNow; // Strictly less than if we recomputed clockNow.
    if (delay > 24) {
      if (time < Infinity) timeout = setTimeout(wake, time - clock.now() - clockSkew);
      if (interval) interval = clearInterval(interval);
    } else {
      if (!interval) clockLast = clock.now(), interval = setInterval(poke, pokeDelay);
      frame = 1, setFrame(wake);
    }
  }

  function timeout$1(callback, delay, time) {
    var t = new Timer;
    delay = delay == null ? 0 : +delay;
    t.restart(function(elapsed) {
      t.stop();
      callback(elapsed + delay);
    }, delay, time);
    return t;
  }

  var emptyOn = dispatch("start", "end", "interrupt");
  var emptyTween = [];

  var CREATED = 0;
  var SCHEDULED = 1;
  var STARTING = 2;
  var STARTED = 3;
  var RUNNING = 4;
  var ENDING = 5;
  var ENDED = 6;

  function schedule(node, name, id, index, group, timing) {
    var schedules = node.__transition;
    if (!schedules) node.__transition = {};
    else if (id in schedules) return;
    create(node, id, {
      name: name,
      index: index, // For context during callback.
      group: group, // For context during callback.
      on: emptyOn,
      tween: emptyTween,
      time: timing.time,
      delay: timing.delay,
      duration: timing.duration,
      ease: timing.ease,
      timer: null,
      state: CREATED
    });
  }

  function init(node, id) {
    var schedule = get$1(node, id);
    if (schedule.state > CREATED) throw new Error("too late; already scheduled");
    return schedule;
  }

  function set$1(node, id) {
    var schedule = get$1(node, id);
    if (schedule.state > STARTING) throw new Error("too late; already started");
    return schedule;
  }

  function get$1(node, id) {
    var schedule = node.__transition;
    if (!schedule || !(schedule = schedule[id])) throw new Error("transition not found");
    return schedule;
  }

  function create(node, id, self) {
    var schedules = node.__transition,
        tween;

    // Initialize the self timer when the transition is created.
    // Note the actual delay is not known until the first callback!
    schedules[id] = self;
    self.timer = timer(schedule, 0, self.time);

    function schedule(elapsed) {
      self.state = SCHEDULED;
      self.timer.restart(start, self.delay, self.time);

      // If the elapsed delay is less than our first sleep, start immediately.
      if (self.delay <= elapsed) start(elapsed - self.delay);
    }

    function start(elapsed) {
      var i, j, n, o;

      // If the state is not SCHEDULED, then we previously errored on start.
      if (self.state !== SCHEDULED) return stop();

      for (i in schedules) {
        o = schedules[i];
        if (o.name !== self.name) continue;

        // While this element already has a starting transition during this frame,
        // defer starting an interrupting transition until that transition has a
        // chance to tick (and possibly end); see d3/d3-transition#54!
        if (o.state === STARTED) return timeout$1(start);

        // Interrupt the active transition, if any.
        // Dispatch the interrupt event.
        if (o.state === RUNNING) {
          o.state = ENDED;
          o.timer.stop();
          o.on.call("interrupt", node, node.__data__, o.index, o.group);
          delete schedules[i];
        }

        // Cancel any pre-empted transitions. No interrupt event is dispatched
        // because the cancelled transitions never started. Note that this also
        // removes this transition from the pending list!
        else if (+i < id) {
          o.state = ENDED;
          o.timer.stop();
          delete schedules[i];
        }
      }

      // Defer the first tick to end of the current frame; see d3/d3#1576.
      // Note the transition may be canceled after start and before the first tick!
      // Note this must be scheduled before the start event; see d3/d3-transition#16!
      // Assuming this is successful, subsequent callbacks go straight to tick.
      timeout$1(function() {
        if (self.state === STARTED) {
          self.state = RUNNING;
          self.timer.restart(tick, self.delay, self.time);
          tick(elapsed);
        }
      });

      // Dispatch the start event.
      // Note this must be done before the tween are initialized.
      self.state = STARTING;
      self.on.call("start", node, node.__data__, self.index, self.group);
      if (self.state !== STARTING) return; // interrupted
      self.state = STARTED;

      // Initialize the tween, deleting null tween.
      tween = new Array(n = self.tween.length);
      for (i = 0, j = -1; i < n; ++i) {
        if (o = self.tween[i].value.call(node, node.__data__, self.index, self.group)) {
          tween[++j] = o;
        }
      }
      tween.length = j + 1;
    }

    function tick(elapsed) {
      var t = elapsed < self.duration ? self.ease.call(null, elapsed / self.duration) : (self.timer.restart(stop), self.state = ENDING, 1),
          i = -1,
          n = tween.length;

      while (++i < n) {
        tween[i].call(null, t);
      }

      // Dispatch the end event.
      if (self.state === ENDING) {
        self.on.call("end", node, node.__data__, self.index, self.group);
        stop();
      }
    }

    function stop() {
      self.state = ENDED;
      self.timer.stop();
      delete schedules[id];
      for (var i in schedules) return; // eslint-disable-line no-unused-vars
      delete node.__transition;
    }
  }

  function interrupt(node, name) {
    var schedules = node.__transition,
        schedule,
        active,
        empty = true,
        i;

    if (!schedules) return;

    name = name == null ? null : name + "";

    for (i in schedules) {
      if ((schedule = schedules[i]).name !== name) { empty = false; continue; }
      active = schedule.state > STARTING && schedule.state < ENDING;
      schedule.state = ENDED;
      schedule.timer.stop();
      if (active) schedule.on.call("interrupt", node, node.__data__, schedule.index, schedule.group);
      delete schedules[i];
    }

    if (empty) delete node.__transition;
  }

  function selection_interrupt(name) {
    return this.each(function() {
      interrupt(this, name);
    });
  }

  function tweenRemove(id, name) {
    var tween0, tween1;
    return function() {
      var schedule = set$1(this, id),
          tween = schedule.tween;

      // If this node shared tween with the previous node,
      // just assign the updated shared tween and we’re done!
      // Otherwise, copy-on-write.
      if (tween !== tween0) {
        tween1 = tween0 = tween;
        for (var i = 0, n = tween1.length; i < n; ++i) {
          if (tween1[i].name === name) {
            tween1 = tween1.slice();
            tween1.splice(i, 1);
            break;
          }
        }
      }

      schedule.tween = tween1;
    };
  }

  function tweenFunction(id, name, value) {
    var tween0, tween1;
    if (typeof value !== "function") throw new Error;
    return function() {
      var schedule = set$1(this, id),
          tween = schedule.tween;

      // If this node shared tween with the previous node,
      // just assign the updated shared tween and we’re done!
      // Otherwise, copy-on-write.
      if (tween !== tween0) {
        tween1 = (tween0 = tween).slice();
        for (var t = {name: name, value: value}, i = 0, n = tween1.length; i < n; ++i) {
          if (tween1[i].name === name) {
            tween1[i] = t;
            break;
          }
        }
        if (i === n) tween1.push(t);
      }

      schedule.tween = tween1;
    };
  }

  function transition_tween(name, value) {
    var id = this._id;

    name += "";

    if (arguments.length < 2) {
      var tween = get$1(this.node(), id).tween;
      for (var i = 0, n = tween.length, t; i < n; ++i) {
        if ((t = tween[i]).name === name) {
          return t.value;
        }
      }
      return null;
    }

    return this.each((value == null ? tweenRemove : tweenFunction)(id, name, value));
  }

  function tweenValue(transition, name, value) {
    var id = transition._id;

    transition.each(function() {
      var schedule = set$1(this, id);
      (schedule.value || (schedule.value = {}))[name] = value.apply(this, arguments);
    });

    return function(node) {
      return get$1(node, id).value[name];
    };
  }

  function interpolate(a, b) {
    var c;
    return (typeof b === "number" ? interpolateNumber
        : b instanceof color ? interpolateRgb
        : (c = color(b)) ? (b = c, interpolateRgb)
        : interpolateString)(a, b);
  }

  function attrRemove$1(name) {
    return function() {
      this.removeAttribute(name);
    };
  }

  function attrRemoveNS$1(fullname) {
    return function() {
      this.removeAttributeNS(fullname.space, fullname.local);
    };
  }

  function attrConstant$1(name, interpolate, value1) {
    var value00,
        interpolate0;
    return function() {
      var value0 = this.getAttribute(name);
      return value0 === value1 ? null
          : value0 === value00 ? interpolate0
          : interpolate0 = interpolate(value00 = value0, value1);
    };
  }

  function attrConstantNS$1(fullname, interpolate, value1) {
    var value00,
        interpolate0;
    return function() {
      var value0 = this.getAttributeNS(fullname.space, fullname.local);
      return value0 === value1 ? null
          : value0 === value00 ? interpolate0
          : interpolate0 = interpolate(value00 = value0, value1);
    };
  }

  function attrFunction$1(name, interpolate, value) {
    var value00,
        value10,
        interpolate0;
    return function() {
      var value0, value1 = value(this);
      if (value1 == null) return void this.removeAttribute(name);
      value0 = this.getAttribute(name);
      return value0 === value1 ? null
          : value0 === value00 && value1 === value10 ? interpolate0
          : interpolate0 = interpolate(value00 = value0, value10 = value1);
    };
  }

  function attrFunctionNS$1(fullname, interpolate, value) {
    var value00,
        value10,
        interpolate0;
    return function() {
      var value0, value1 = value(this);
      if (value1 == null) return void this.removeAttributeNS(fullname.space, fullname.local);
      value0 = this.getAttributeNS(fullname.space, fullname.local);
      return value0 === value1 ? null
          : value0 === value00 && value1 === value10 ? interpolate0
          : interpolate0 = interpolate(value00 = value0, value10 = value1);
    };
  }

  function transition_attr(name, value) {
    var fullname = namespace(name), i = fullname === "transform" ? interpolateTransformSvg : interpolate;
    return this.attrTween(name, typeof value === "function"
        ? (fullname.local ? attrFunctionNS$1 : attrFunction$1)(fullname, i, tweenValue(this, "attr." + name, value))
        : value == null ? (fullname.local ? attrRemoveNS$1 : attrRemove$1)(fullname)
        : (fullname.local ? attrConstantNS$1 : attrConstant$1)(fullname, i, value + ""));
  }

  function attrTweenNS(fullname, value) {
    function tween() {
      var node = this, i = value.apply(node, arguments);
      return i && function(t) {
        node.setAttributeNS(fullname.space, fullname.local, i(t));
      };
    }
    tween._value = value;
    return tween;
  }

  function attrTween(name, value) {
    function tween() {
      var node = this, i = value.apply(node, arguments);
      return i && function(t) {
        node.setAttribute(name, i(t));
      };
    }
    tween._value = value;
    return tween;
  }

  function transition_attrTween(name, value) {
    var key = "attr." + name;
    if (arguments.length < 2) return (key = this.tween(key)) && key._value;
    if (value == null) return this.tween(key, null);
    if (typeof value !== "function") throw new Error;
    var fullname = namespace(name);
    return this.tween(key, (fullname.local ? attrTweenNS : attrTween)(fullname, value));
  }

  function delayFunction(id, value) {
    return function() {
      init(this, id).delay = +value.apply(this, arguments);
    };
  }

  function delayConstant(id, value) {
    return value = +value, function() {
      init(this, id).delay = value;
    };
  }

  function transition_delay(value) {
    var id = this._id;

    return arguments.length
        ? this.each((typeof value === "function"
            ? delayFunction
            : delayConstant)(id, value))
        : get$1(this.node(), id).delay;
  }

  function durationFunction(id, value) {
    return function() {
      set$1(this, id).duration = +value.apply(this, arguments);
    };
  }

  function durationConstant(id, value) {
    return value = +value, function() {
      set$1(this, id).duration = value;
    };
  }

  function transition_duration(value) {
    var id = this._id;

    return arguments.length
        ? this.each((typeof value === "function"
            ? durationFunction
            : durationConstant)(id, value))
        : get$1(this.node(), id).duration;
  }

  function easeConstant(id, value) {
    if (typeof value !== "function") throw new Error;
    return function() {
      set$1(this, id).ease = value;
    };
  }

  function transition_ease(value) {
    var id = this._id;

    return arguments.length
        ? this.each(easeConstant(id, value))
        : get$1(this.node(), id).ease;
  }

  function transition_filter(match) {
    if (typeof match !== "function") match = matcher$1(match);

    for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, subgroup = subgroups[j] = [], node, i = 0; i < n; ++i) {
        if ((node = group[i]) && match.call(node, node.__data__, i, group)) {
          subgroup.push(node);
        }
      }
    }

    return new Transition(subgroups, this._parents, this._name, this._id);
  }

  function transition_merge(transition) {
    if (transition._id !== this._id) throw new Error;

    for (var groups0 = this._groups, groups1 = transition._groups, m0 = groups0.length, m1 = groups1.length, m = Math.min(m0, m1), merges = new Array(m0), j = 0; j < m; ++j) {
      for (var group0 = groups0[j], group1 = groups1[j], n = group0.length, merge = merges[j] = new Array(n), node, i = 0; i < n; ++i) {
        if (node = group0[i] || group1[i]) {
          merge[i] = node;
        }
      }
    }

    for (; j < m0; ++j) {
      merges[j] = groups0[j];
    }

    return new Transition(merges, this._parents, this._name, this._id);
  }

  function start(name) {
    return (name + "").trim().split(/^|\s+/).every(function(t) {
      var i = t.indexOf(".");
      if (i >= 0) t = t.slice(0, i);
      return !t || t === "start";
    });
  }

  function onFunction(id, name, listener) {
    var on0, on1, sit = start(name) ? init : set$1;
    return function() {
      var schedule = sit(this, id),
          on = schedule.on;

      // If this node shared a dispatch with the previous node,
      // just assign the updated shared dispatch and we’re done!
      // Otherwise, copy-on-write.
      if (on !== on0) (on1 = (on0 = on).copy()).on(name, listener);

      schedule.on = on1;
    };
  }

  function transition_on(name, listener) {
    var id = this._id;

    return arguments.length < 2
        ? get$1(this.node(), id).on.on(name)
        : this.each(onFunction(id, name, listener));
  }

  function removeFunction(id) {
    return function() {
      var parent = this.parentNode;
      for (var i in this.__transition) if (+i !== id) return;
      if (parent) parent.removeChild(this);
    };
  }

  function transition_remove() {
    return this.on("end.remove", removeFunction(this._id));
  }

  function transition_select(select) {
    var name = this._name,
        id = this._id;

    if (typeof select !== "function") select = selector(select);

    for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, subgroup = subgroups[j] = new Array(n), node, subnode, i = 0; i < n; ++i) {
        if ((node = group[i]) && (subnode = select.call(node, node.__data__, i, group))) {
          if ("__data__" in node) subnode.__data__ = node.__data__;
          subgroup[i] = subnode;
          schedule(subgroup[i], name, id, i, subgroup, get$1(node, id));
        }
      }
    }

    return new Transition(subgroups, this._parents, name, id);
  }

  function transition_selectAll(select) {
    var name = this._name,
        id = this._id;

    if (typeof select !== "function") select = selectorAll(select);

    for (var groups = this._groups, m = groups.length, subgroups = [], parents = [], j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
        if (node = group[i]) {
          for (var children = select.call(node, node.__data__, i, group), child, inherit = get$1(node, id), k = 0, l = children.length; k < l; ++k) {
            if (child = children[k]) {
              schedule(child, name, id, k, children, inherit);
            }
          }
          subgroups.push(children);
          parents.push(node);
        }
      }
    }

    return new Transition(subgroups, parents, name, id);
  }

  var Selection$1 = selection.prototype.constructor;

  function transition_selection() {
    return new Selection$1(this._groups, this._parents);
  }

  function styleRemove$1(name, interpolate) {
    var value00,
        value10,
        interpolate0;
    return function() {
      var value0 = styleValue(this, name),
          value1 = (this.style.removeProperty(name), styleValue(this, name));
      return value0 === value1 ? null
          : value0 === value00 && value1 === value10 ? interpolate0
          : interpolate0 = interpolate(value00 = value0, value10 = value1);
    };
  }

  function styleRemoveEnd(name) {
    return function() {
      this.style.removeProperty(name);
    };
  }

  function styleConstant$1(name, interpolate, value1) {
    var value00,
        interpolate0;
    return function() {
      var value0 = styleValue(this, name);
      return value0 === value1 ? null
          : value0 === value00 ? interpolate0
          : interpolate0 = interpolate(value00 = value0, value1);
    };
  }

  function styleFunction$1(name, interpolate, value) {
    var value00,
        value10,
        interpolate0;
    return function() {
      var value0 = styleValue(this, name),
          value1 = value(this);
      if (value1 == null) value1 = (this.style.removeProperty(name), styleValue(this, name));
      return value0 === value1 ? null
          : value0 === value00 && value1 === value10 ? interpolate0
          : interpolate0 = interpolate(value00 = value0, value10 = value1);
    };
  }

  function transition_style(name, value, priority) {
    var i = (name += "") === "transform" ? interpolateTransformCss : interpolate;
    return value == null ? this
            .styleTween(name, styleRemove$1(name, i))
            .on("end.style." + name, styleRemoveEnd(name))
        : this.styleTween(name, typeof value === "function"
            ? styleFunction$1(name, i, tweenValue(this, "style." + name, value))
            : styleConstant$1(name, i, value + ""), priority);
  }

  function styleTween(name, value, priority) {
    function tween() {
      var node = this, i = value.apply(node, arguments);
      return i && function(t) {
        node.style.setProperty(name, i(t), priority);
      };
    }
    tween._value = value;
    return tween;
  }

  function transition_styleTween(name, value, priority) {
    var key = "style." + (name += "");
    if (arguments.length < 2) return (key = this.tween(key)) && key._value;
    if (value == null) return this.tween(key, null);
    if (typeof value !== "function") throw new Error;
    return this.tween(key, styleTween(name, value, priority == null ? "" : priority));
  }

  function textConstant$1(value) {
    return function() {
      this.textContent = value;
    };
  }

  function textFunction$1(value) {
    return function() {
      var value1 = value(this);
      this.textContent = value1 == null ? "" : value1;
    };
  }

  function transition_text(value) {
    return this.tween("text", typeof value === "function"
        ? textFunction$1(tweenValue(this, "text", value))
        : textConstant$1(value == null ? "" : value + ""));
  }

  function transition_transition() {
    var name = this._name,
        id0 = this._id,
        id1 = newId();

    for (var groups = this._groups, m = groups.length, j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
        if (node = group[i]) {
          var inherit = get$1(node, id0);
          schedule(node, name, id1, i, group, {
            time: inherit.time + inherit.delay + inherit.duration,
            delay: 0,
            duration: inherit.duration,
            ease: inherit.ease
          });
        }
      }
    }

    return new Transition(groups, this._parents, name, id1);
  }

  var id = 0;

  function Transition(groups, parents, name, id) {
    this._groups = groups;
    this._parents = parents;
    this._name = name;
    this._id = id;
  }

  function transition(name) {
    return selection().transition(name);
  }

  function newId() {
    return ++id;
  }

  var selection_prototype = selection.prototype;

  Transition.prototype = transition.prototype = {
    constructor: Transition,
    select: transition_select,
    selectAll: transition_selectAll,
    filter: transition_filter,
    merge: transition_merge,
    selection: transition_selection,
    transition: transition_transition,
    call: selection_prototype.call,
    nodes: selection_prototype.nodes,
    node: selection_prototype.node,
    size: selection_prototype.size,
    empty: selection_prototype.empty,
    each: selection_prototype.each,
    on: transition_on,
    attr: transition_attr,
    attrTween: transition_attrTween,
    style: transition_style,
    styleTween: transition_styleTween,
    text: transition_text,
    remove: transition_remove,
    tween: transition_tween,
    delay: transition_delay,
    duration: transition_duration,
    ease: transition_ease
  };

  function cubicInOut(t) {
    return ((t *= 2) <= 1 ? t * t * t : (t -= 2) * t * t + 2) / 2;
  }

  var pi = Math.PI;

  var tau = 2 * Math.PI;

  var defaultTiming = {
    time: null, // Set on use.
    delay: 0,
    duration: 250,
    ease: cubicInOut
  };

  function inherit(node, id) {
    var timing;
    while (!(timing = node.__transition) || !(timing = timing[id])) {
      if (!(node = node.parentNode)) {
        return defaultTiming.time = now(), defaultTiming;
      }
    }
    return timing;
  }

  function selection_transition(name) {
    var id,
        timing;

    if (name instanceof Transition) {
      id = name._id, name = name._name;
    } else {
      id = newId(), (timing = defaultTiming).time = now(), name = name == null ? null : name + "";
    }

    for (var groups = this._groups, m = groups.length, j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
        if (node = group[i]) {
          schedule(node, name, id, i, group, timing || inherit(node, id));
        }
      }
    }

    return new Transition(groups, this._parents, name, id);
  }

  selection.prototype.interrupt = selection_interrupt;
  selection.prototype.transition = selection_transition;

  var pi$1 = Math.PI;

  var pi$2 = Math.PI;

  var prefix = "$";

  function Map() {}

  Map.prototype = map.prototype = {
    constructor: Map,
    has: function(key) {
      return (prefix + key) in this;
    },
    get: function(key) {
      return this[prefix + key];
    },
    set: function(key, value) {
      this[prefix + key] = value;
      return this;
    },
    remove: function(key) {
      var property = prefix + key;
      return property in this && delete this[property];
    },
    clear: function() {
      for (var property in this) if (property[0] === prefix) delete this[property];
    },
    keys: function() {
      var keys = [];
      for (var property in this) if (property[0] === prefix) keys.push(property.slice(1));
      return keys;
    },
    values: function() {
      var values = [];
      for (var property in this) if (property[0] === prefix) values.push(this[property]);
      return values;
    },
    entries: function() {
      var entries = [];
      for (var property in this) if (property[0] === prefix) entries.push({key: property.slice(1), value: this[property]});
      return entries;
    },
    size: function() {
      var size = 0;
      for (var property in this) if (property[0] === prefix) ++size;
      return size;
    },
    empty: function() {
      for (var property in this) if (property[0] === prefix) return false;
      return true;
    },
    each: function(f) {
      for (var property in this) if (property[0] === prefix) f(this[property], property.slice(1), this);
    }
  };

  function map(object, f) {
    var map = new Map;

    // Copy constructor.
    if (object instanceof Map) object.each(function(value, key) { map.set(key, value); });

    // Index array by numeric index or specified key function.
    else if (Array.isArray(object)) {
      var i = -1,
          n = object.length,
          o;

      if (f == null) while (++i < n) map.set(i, object[i]);
      else while (++i < n) map.set(f(o = object[i], i, object), o);
    }

    // Convert object to map.
    else if (object) for (var key in object) map.set(key, object[key]);

    return map;
  }

  function Set$1() {}

  var proto = map.prototype;

  Set$1.prototype = set$2.prototype = {
    constructor: Set$1,
    has: proto.has,
    add: function(value) {
      value += "";
      this[prefix + value] = value;
      return this;
    },
    remove: proto.remove,
    clear: proto.clear,
    values: proto.keys,
    size: proto.size,
    empty: proto.empty,
    each: proto.each
  };

  function set$2(object, f) {
    var set = new Set$1;

    // Copy constructor.
    if (object instanceof Set$1) object.each(function(value) { set.add(value); });

    // Otherwise, assume it’s an array.
    else if (object) {
      var i = -1, n = object.length;
      if (f == null) while (++i < n) set.add(object[i]);
      else while (++i < n) set.add(f(object[i], i, object));
    }

    return set;
  }

  var EOL = {},
      EOF = {},
      QUOTE = 34,
      NEWLINE = 10,
      RETURN = 13;

  function objectConverter(columns) {
    return new Function("d", "return {" + columns.map(function(name, i) {
      return JSON.stringify(name) + ": d[" + i + "]";
    }).join(",") + "}");
  }

  function customConverter(columns, f) {
    var object = objectConverter(columns);
    return function(row, i) {
      return f(object(row), i, columns);
    };
  }

  // Compute unique columns in order of discovery.
  function inferColumns(rows) {
    var columnSet = Object.create(null),
        columns = [];

    rows.forEach(function(row) {
      for (var column in row) {
        if (!(column in columnSet)) {
          columns.push(columnSet[column] = column);
        }
      }
    });

    return columns;
  }

  function dsv(delimiter) {
    var reFormat = new RegExp("[\"" + delimiter + "\n\r]"),
        DELIMITER = delimiter.charCodeAt(0);

    function parse(text, f) {
      var convert, columns, rows = parseRows(text, function(row, i) {
        if (convert) return convert(row, i - 1);
        columns = row, convert = f ? customConverter(row, f) : objectConverter(row);
      });
      rows.columns = columns || [];
      return rows;
    }

    function parseRows(text, f) {
      var rows = [], // output rows
          N = text.length,
          I = 0, // current character index
          n = 0, // current line number
          t, // current token
          eof = N <= 0, // current token followed by EOF?
          eol = false; // current token followed by EOL?

      // Strip the trailing newline.
      if (text.charCodeAt(N - 1) === NEWLINE) --N;
      if (text.charCodeAt(N - 1) === RETURN) --N;

      function token() {
        if (eof) return EOF;
        if (eol) return eol = false, EOL;

        // Unescape quotes.
        var i, j = I, c;
        if (text.charCodeAt(j) === QUOTE) {
          while (I++ < N && text.charCodeAt(I) !== QUOTE || text.charCodeAt(++I) === QUOTE);
          if ((i = I) >= N) eof = true;
          else if ((c = text.charCodeAt(I++)) === NEWLINE) eol = true;
          else if (c === RETURN) { eol = true; if (text.charCodeAt(I) === NEWLINE) ++I; }
          return text.slice(j + 1, i - 1).replace(/""/g, "\"");
        }

        // Find next delimiter or newline.
        while (I < N) {
          if ((c = text.charCodeAt(i = I++)) === NEWLINE) eol = true;
          else if (c === RETURN) { eol = true; if (text.charCodeAt(I) === NEWLINE) ++I; }
          else if (c !== DELIMITER) continue;
          return text.slice(j, i);
        }

        // Return last token before EOF.
        return eof = true, text.slice(j, N);
      }

      while ((t = token()) !== EOF) {
        var row = [];
        while (t !== EOL && t !== EOF) row.push(t), t = token();
        if (f && (row = f(row, n++)) == null) continue;
        rows.push(row);
      }

      return rows;
    }

    function format(rows, columns) {
      if (columns == null) columns = inferColumns(rows);
      return [columns.map(formatValue).join(delimiter)].concat(rows.map(function(row) {
        return columns.map(function(column) {
          return formatValue(row[column]);
        }).join(delimiter);
      })).join("\n");
    }

    function formatRows(rows) {
      return rows.map(formatRow).join("\n");
    }

    function formatRow(row) {
      return row.map(formatValue).join(delimiter);
    }

    function formatValue(text) {
      return text == null ? ""
          : reFormat.test(text += "") ? "\"" + text.replace(/"/g, "\"\"") + "\""
          : text;
    }

    return {
      parse: parse,
      parseRows: parseRows,
      format: format,
      formatRows: formatRows
    };
  }

  var csv = dsv(",");

  var tsv = dsv("\t");

  function tree_add(d) {
    var x = +this._x.call(null, d),
        y = +this._y.call(null, d);
    return add(this.cover(x, y), x, y, d);
  }

  function add(tree, x, y, d) {
    if (isNaN(x) || isNaN(y)) return tree; // ignore invalid points

    var parent,
        node = tree._root,
        leaf = {data: d},
        x0 = tree._x0,
        y0 = tree._y0,
        x1 = tree._x1,
        y1 = tree._y1,
        xm,
        ym,
        xp,
        yp,
        right,
        bottom,
        i,
        j;

    // If the tree is empty, initialize the root as a leaf.
    if (!node) return tree._root = leaf, tree;

    // Find the existing leaf for the new point, or add it.
    while (node.length) {
      if (right = x >= (xm = (x0 + x1) / 2)) x0 = xm; else x1 = xm;
      if (bottom = y >= (ym = (y0 + y1) / 2)) y0 = ym; else y1 = ym;
      if (parent = node, !(node = node[i = bottom << 1 | right])) return parent[i] = leaf, tree;
    }

    // Is the new point is exactly coincident with the existing point?
    xp = +tree._x.call(null, node.data);
    yp = +tree._y.call(null, node.data);
    if (x === xp && y === yp) return leaf.next = node, parent ? parent[i] = leaf : tree._root = leaf, tree;

    // Otherwise, split the leaf node until the old and new point are separated.
    do {
      parent = parent ? parent[i] = new Array(4) : tree._root = new Array(4);
      if (right = x >= (xm = (x0 + x1) / 2)) x0 = xm; else x1 = xm;
      if (bottom = y >= (ym = (y0 + y1) / 2)) y0 = ym; else y1 = ym;
    } while ((i = bottom << 1 | right) === (j = (yp >= ym) << 1 | (xp >= xm)));
    return parent[j] = node, parent[i] = leaf, tree;
  }

  function addAll(data) {
    var d, i, n = data.length,
        x,
        y,
        xz = new Array(n),
        yz = new Array(n),
        x0 = Infinity,
        y0 = Infinity,
        x1 = -Infinity,
        y1 = -Infinity;

    // Compute the points and their extent.
    for (i = 0; i < n; ++i) {
      if (isNaN(x = +this._x.call(null, d = data[i])) || isNaN(y = +this._y.call(null, d))) continue;
      xz[i] = x;
      yz[i] = y;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }

    // If there were no (valid) points, inherit the existing extent.
    if (x1 < x0) x0 = this._x0, x1 = this._x1;
    if (y1 < y0) y0 = this._y0, y1 = this._y1;

    // Expand the tree to cover the new points.
    this.cover(x0, y0).cover(x1, y1);

    // Add the new points.
    for (i = 0; i < n; ++i) {
      add(this, xz[i], yz[i], data[i]);
    }

    return this;
  }

  function tree_cover(x, y) {
    if (isNaN(x = +x) || isNaN(y = +y)) return this; // ignore invalid points

    var x0 = this._x0,
        y0 = this._y0,
        x1 = this._x1,
        y1 = this._y1;

    // If the quadtree has no extent, initialize them.
    // Integer extent are necessary so that if we later double the extent,
    // the existing quadrant boundaries don’t change due to floating point error!
    if (isNaN(x0)) {
      x1 = (x0 = Math.floor(x)) + 1;
      y1 = (y0 = Math.floor(y)) + 1;
    }

    // Otherwise, double repeatedly to cover.
    else if (x0 > x || x > x1 || y0 > y || y > y1) {
      var z = x1 - x0,
          node = this._root,
          parent,
          i;

      switch (i = (y < (y0 + y1) / 2) << 1 | (x < (x0 + x1) / 2)) {
        case 0: {
          do parent = new Array(4), parent[i] = node, node = parent;
          while (z *= 2, x1 = x0 + z, y1 = y0 + z, x > x1 || y > y1);
          break;
        }
        case 1: {
          do parent = new Array(4), parent[i] = node, node = parent;
          while (z *= 2, x0 = x1 - z, y1 = y0 + z, x0 > x || y > y1);
          break;
        }
        case 2: {
          do parent = new Array(4), parent[i] = node, node = parent;
          while (z *= 2, x1 = x0 + z, y0 = y1 - z, x > x1 || y0 > y);
          break;
        }
        case 3: {
          do parent = new Array(4), parent[i] = node, node = parent;
          while (z *= 2, x0 = x1 - z, y0 = y1 - z, x0 > x || y0 > y);
          break;
        }
      }

      if (this._root && this._root.length) this._root = node;
    }

    // If the quadtree covers the point already, just return.
    else return this;

    this._x0 = x0;
    this._y0 = y0;
    this._x1 = x1;
    this._y1 = y1;
    return this;
  }

  function tree_data() {
    var data = [];
    this.visit(function(node) {
      if (!node.length) do data.push(node.data); while (node = node.next)
    });
    return data;
  }

  function tree_extent(_) {
    return arguments.length
        ? this.cover(+_[0][0], +_[0][1]).cover(+_[1][0], +_[1][1])
        : isNaN(this._x0) ? undefined : [[this._x0, this._y0], [this._x1, this._y1]];
  }

  function Quad(node, x0, y0, x1, y1) {
    this.node = node;
    this.x0 = x0;
    this.y0 = y0;
    this.x1 = x1;
    this.y1 = y1;
  }

  function tree_find(x, y, radius) {
    var data,
        x0 = this._x0,
        y0 = this._y0,
        x1,
        y1,
        x2,
        y2,
        x3 = this._x1,
        y3 = this._y1,
        quads = [],
        node = this._root,
        q,
        i;

    if (node) quads.push(new Quad(node, x0, y0, x3, y3));
    if (radius == null) radius = Infinity;
    else {
      x0 = x - radius, y0 = y - radius;
      x3 = x + radius, y3 = y + radius;
      radius *= radius;
    }

    while (q = quads.pop()) {

      // Stop searching if this quadrant can’t contain a closer node.
      if (!(node = q.node)
          || (x1 = q.x0) > x3
          || (y1 = q.y0) > y3
          || (x2 = q.x1) < x0
          || (y2 = q.y1) < y0) continue;

      // Bisect the current quadrant.
      if (node.length) {
        var xm = (x1 + x2) / 2,
            ym = (y1 + y2) / 2;

        quads.push(
          new Quad(node[3], xm, ym, x2, y2),
          new Quad(node[2], x1, ym, xm, y2),
          new Quad(node[1], xm, y1, x2, ym),
          new Quad(node[0], x1, y1, xm, ym)
        );

        // Visit the closest quadrant first.
        if (i = (y >= ym) << 1 | (x >= xm)) {
          q = quads[quads.length - 1];
          quads[quads.length - 1] = quads[quads.length - 1 - i];
          quads[quads.length - 1 - i] = q;
        }
      }

      // Visit this point. (Visiting coincident points isn’t necessary!)
      else {
        var dx = x - +this._x.call(null, node.data),
            dy = y - +this._y.call(null, node.data),
            d2 = dx * dx + dy * dy;
        if (d2 < radius) {
          var d = Math.sqrt(radius = d2);
          x0 = x - d, y0 = y - d;
          x3 = x + d, y3 = y + d;
          data = node.data;
        }
      }
    }

    return data;
  }

  function tree_remove(d) {
    if (isNaN(x = +this._x.call(null, d)) || isNaN(y = +this._y.call(null, d))) return this; // ignore invalid points

    var parent,
        node = this._root,
        retainer,
        previous,
        next,
        x0 = this._x0,
        y0 = this._y0,
        x1 = this._x1,
        y1 = this._y1,
        x,
        y,
        xm,
        ym,
        right,
        bottom,
        i,
        j;

    // If the tree is empty, initialize the root as a leaf.
    if (!node) return this;

    // Find the leaf node for the point.
    // While descending, also retain the deepest parent with a non-removed sibling.
    if (node.length) while (true) {
      if (right = x >= (xm = (x0 + x1) / 2)) x0 = xm; else x1 = xm;
      if (bottom = y >= (ym = (y0 + y1) / 2)) y0 = ym; else y1 = ym;
      if (!(parent = node, node = node[i = bottom << 1 | right])) return this;
      if (!node.length) break;
      if (parent[(i + 1) & 3] || parent[(i + 2) & 3] || parent[(i + 3) & 3]) retainer = parent, j = i;
    }

    // Find the point to remove.
    while (node.data !== d) if (!(previous = node, node = node.next)) return this;
    if (next = node.next) delete node.next;

    // If there are multiple coincident points, remove just the point.
    if (previous) return (next ? previous.next = next : delete previous.next), this;

    // If this is the root point, remove it.
    if (!parent) return this._root = next, this;

    // Remove this leaf.
    next ? parent[i] = next : delete parent[i];

    // If the parent now contains exactly one leaf, collapse superfluous parents.
    if ((node = parent[0] || parent[1] || parent[2] || parent[3])
        && node === (parent[3] || parent[2] || parent[1] || parent[0])
        && !node.length) {
      if (retainer) retainer[j] = node;
      else this._root = node;
    }

    return this;
  }

  function removeAll(data) {
    for (var i = 0, n = data.length; i < n; ++i) this.remove(data[i]);
    return this;
  }

  function tree_root() {
    return this._root;
  }

  function tree_size() {
    var size = 0;
    this.visit(function(node) {
      if (!node.length) do ++size; while (node = node.next)
    });
    return size;
  }

  function tree_visit(callback) {
    var quads = [], q, node = this._root, child, x0, y0, x1, y1;
    if (node) quads.push(new Quad(node, this._x0, this._y0, this._x1, this._y1));
    while (q = quads.pop()) {
      if (!callback(node = q.node, x0 = q.x0, y0 = q.y0, x1 = q.x1, y1 = q.y1) && node.length) {
        var xm = (x0 + x1) / 2, ym = (y0 + y1) / 2;
        if (child = node[3]) quads.push(new Quad(child, xm, ym, x1, y1));
        if (child = node[2]) quads.push(new Quad(child, x0, ym, xm, y1));
        if (child = node[1]) quads.push(new Quad(child, xm, y0, x1, ym));
        if (child = node[0]) quads.push(new Quad(child, x0, y0, xm, ym));
      }
    }
    return this;
  }

  function tree_visitAfter(callback) {
    var quads = [], next = [], q;
    if (this._root) quads.push(new Quad(this._root, this._x0, this._y0, this._x1, this._y1));
    while (q = quads.pop()) {
      var node = q.node;
      if (node.length) {
        var child, x0 = q.x0, y0 = q.y0, x1 = q.x1, y1 = q.y1, xm = (x0 + x1) / 2, ym = (y0 + y1) / 2;
        if (child = node[0]) quads.push(new Quad(child, x0, y0, xm, ym));
        if (child = node[1]) quads.push(new Quad(child, xm, y0, x1, ym));
        if (child = node[2]) quads.push(new Quad(child, x0, ym, xm, y1));
        if (child = node[3]) quads.push(new Quad(child, xm, ym, x1, y1));
      }
      next.push(q);
    }
    while (q = next.pop()) {
      callback(q.node, q.x0, q.y0, q.x1, q.y1);
    }
    return this;
  }

  function defaultX(d) {
    return d[0];
  }

  function tree_x(_) {
    return arguments.length ? (this._x = _, this) : this._x;
  }

  function defaultY(d) {
    return d[1];
  }

  function tree_y(_) {
    return arguments.length ? (this._y = _, this) : this._y;
  }

  function quadtree(nodes, x, y) {
    var tree = new Quadtree(x == null ? defaultX : x, y == null ? defaultY : y, NaN, NaN, NaN, NaN);
    return nodes == null ? tree : tree.addAll(nodes);
  }

  function Quadtree(x, y, x0, y0, x1, y1) {
    this._x = x;
    this._y = y;
    this._x0 = x0;
    this._y0 = y0;
    this._x1 = x1;
    this._y1 = y1;
    this._root = undefined;
  }

  function leaf_copy(leaf) {
    var copy = {data: leaf.data}, next = copy;
    while (leaf = leaf.next) next = next.next = {data: leaf.data};
    return copy;
  }

  var treeProto = quadtree.prototype = Quadtree.prototype;

  treeProto.copy = function() {
    var copy = new Quadtree(this._x, this._y, this._x0, this._y0, this._x1, this._y1),
        node = this._root,
        nodes,
        child;

    if (!node) return copy;

    if (!node.length) return copy._root = leaf_copy(node), copy;

    nodes = [{source: node, target: copy._root = new Array(4)}];
    while (node = nodes.pop()) {
      for (var i = 0; i < 4; ++i) {
        if (child = node.source[i]) {
          if (child.length) nodes.push({source: child, target: node.target[i] = new Array(4)});
          else node.target[i] = leaf_copy(child);
        }
      }
    }

    return copy;
  };

  treeProto.add = tree_add;
  treeProto.addAll = addAll;
  treeProto.cover = tree_cover;
  treeProto.data = tree_data;
  treeProto.extent = tree_extent;
  treeProto.find = tree_find;
  treeProto.remove = tree_remove;
  treeProto.removeAll = removeAll;
  treeProto.root = tree_root;
  treeProto.size = tree_size;
  treeProto.visit = tree_visit;
  treeProto.visitAfter = tree_visitAfter;
  treeProto.x = tree_x;
  treeProto.y = tree_y;

  var initialAngle = Math.PI * (3 - Math.sqrt(5));

  // Computes the decimal coefficient and exponent of the specified number x with
  // significant digits p, where x is positive and p is in [1, 21] or undefined.
  // For example, formatDecimal(1.23) returns ["123", 0].
  function formatDecimal(x, p) {
    if ((i = (x = p ? x.toExponential(p - 1) : x.toExponential()).indexOf("e")) < 0) return null; // NaN, ±Infinity
    var i, coefficient = x.slice(0, i);

    // The string returned by toExponential either has the form \d\.\d+e[-+]\d+
    // (e.g., 1.2e+3) or the form \de[-+]\d+ (e.g., 1e+3).
    return [
      coefficient.length > 1 ? coefficient[0] + coefficient.slice(2) : coefficient,
      +x.slice(i + 1)
    ];
  }

  function exponent(x) {
    return x = formatDecimal(Math.abs(x)), x ? x[1] : NaN;
  }

  function formatGroup(grouping, thousands) {
    return function(value, width) {
      var i = value.length,
          t = [],
          j = 0,
          g = grouping[0],
          length = 0;

      while (i > 0 && g > 0) {
        if (length + g + 1 > width) g = Math.max(1, width - length);
        t.push(value.substring(i -= g, i + g));
        if ((length += g + 1) > width) break;
        g = grouping[j = (j + 1) % grouping.length];
      }

      return t.reverse().join(thousands);
    };
  }

  function formatNumerals(numerals) {
    return function(value) {
      return value.replace(/[0-9]/g, function(i) {
        return numerals[+i];
      });
    };
  }

  function formatDefault(x, p) {
    x = x.toPrecision(p);

    out: for (var n = x.length, i = 1, i0 = -1, i1; i < n; ++i) {
      switch (x[i]) {
        case ".": i0 = i1 = i; break;
        case "0": if (i0 === 0) i0 = i; i1 = i; break;
        case "e": break out;
        default: if (i0 > 0) i0 = 0; break;
      }
    }

    return i0 > 0 ? x.slice(0, i0) + x.slice(i1 + 1) : x;
  }

  var prefixExponent;

  function formatPrefixAuto(x, p) {
    var d = formatDecimal(x, p);
    if (!d) return x + "";
    var coefficient = d[0],
        exponent = d[1],
        i = exponent - (prefixExponent = Math.max(-8, Math.min(8, Math.floor(exponent / 3))) * 3) + 1,
        n = coefficient.length;
    return i === n ? coefficient
        : i > n ? coefficient + new Array(i - n + 1).join("0")
        : i > 0 ? coefficient.slice(0, i) + "." + coefficient.slice(i)
        : "0." + new Array(1 - i).join("0") + formatDecimal(x, Math.max(0, p + i - 1))[0]; // less than 1y!
  }

  function formatRounded(x, p) {
    var d = formatDecimal(x, p);
    if (!d) return x + "";
    var coefficient = d[0],
        exponent = d[1];
    return exponent < 0 ? "0." + new Array(-exponent).join("0") + coefficient
        : coefficient.length > exponent + 1 ? coefficient.slice(0, exponent + 1) + "." + coefficient.slice(exponent + 1)
        : coefficient + new Array(exponent - coefficient.length + 2).join("0");
  }

  var formatTypes = {
    "": formatDefault,
    "%": function(x, p) { return (x * 100).toFixed(p); },
    "b": function(x) { return Math.round(x).toString(2); },
    "c": function(x) { return x + ""; },
    "d": function(x) { return Math.round(x).toString(10); },
    "e": function(x, p) { return x.toExponential(p); },
    "f": function(x, p) { return x.toFixed(p); },
    "g": function(x, p) { return x.toPrecision(p); },
    "o": function(x) { return Math.round(x).toString(8); },
    "p": function(x, p) { return formatRounded(x * 100, p); },
    "r": formatRounded,
    "s": formatPrefixAuto,
    "X": function(x) { return Math.round(x).toString(16).toUpperCase(); },
    "x": function(x) { return Math.round(x).toString(16); }
  };

  // [[fill]align][sign][symbol][0][width][,][.precision][type]
  var re = /^(?:(.)?([<>=^]))?([+\-\( ])?([$#])?(0)?(\d+)?(,)?(\.\d+)?([a-z%])?$/i;

  function formatSpecifier(specifier) {
    return new FormatSpecifier(specifier);
  }

  formatSpecifier.prototype = FormatSpecifier.prototype; // instanceof

  function FormatSpecifier(specifier) {
    if (!(match = re.exec(specifier))) throw new Error("invalid format: " + specifier);

    var match,
        fill = match[1] || " ",
        align = match[2] || ">",
        sign = match[3] || "-",
        symbol = match[4] || "",
        zero = !!match[5],
        width = match[6] && +match[6],
        comma = !!match[7],
        precision = match[8] && +match[8].slice(1),
        type = match[9] || "";

    // The "n" type is an alias for ",g".
    if (type === "n") comma = true, type = "g";

    // Map invalid types to the default format.
    else if (!formatTypes[type]) type = "";

    // If zero fill is specified, padding goes after sign and before digits.
    if (zero || (fill === "0" && align === "=")) zero = true, fill = "0", align = "=";

    this.fill = fill;
    this.align = align;
    this.sign = sign;
    this.symbol = symbol;
    this.zero = zero;
    this.width = width;
    this.comma = comma;
    this.precision = precision;
    this.type = type;
  }

  FormatSpecifier.prototype.toString = function() {
    return this.fill
        + this.align
        + this.sign
        + this.symbol
        + (this.zero ? "0" : "")
        + (this.width == null ? "" : Math.max(1, this.width | 0))
        + (this.comma ? "," : "")
        + (this.precision == null ? "" : "." + Math.max(0, this.precision | 0))
        + this.type;
  };

  function identity$2(x) {
    return x;
  }

  var prefixes = ["y","z","a","f","p","n","µ","m","","k","M","G","T","P","E","Z","Y"];

  function formatLocale(locale) {
    var group = locale.grouping && locale.thousands ? formatGroup(locale.grouping, locale.thousands) : identity$2,
        currency = locale.currency,
        decimal = locale.decimal,
        numerals = locale.numerals ? formatNumerals(locale.numerals) : identity$2,
        percent = locale.percent || "%";

    function newFormat(specifier) {
      specifier = formatSpecifier(specifier);

      var fill = specifier.fill,
          align = specifier.align,
          sign = specifier.sign,
          symbol = specifier.symbol,
          zero = specifier.zero,
          width = specifier.width,
          comma = specifier.comma,
          precision = specifier.precision,
          type = specifier.type;

      // Compute the prefix and suffix.
      // For SI-prefix, the suffix is lazily computed.
      var prefix = symbol === "$" ? currency[0] : symbol === "#" && /[boxX]/.test(type) ? "0" + type.toLowerCase() : "",
          suffix = symbol === "$" ? currency[1] : /[%p]/.test(type) ? percent : "";

      // What format function should we use?
      // Is this an integer type?
      // Can this type generate exponential notation?
      var formatType = formatTypes[type],
          maybeSuffix = !type || /[defgprs%]/.test(type);

      // Set the default precision if not specified,
      // or clamp the specified precision to the supported range.
      // For significant precision, it must be in [1, 21].
      // For fixed precision, it must be in [0, 20].
      precision = precision == null ? (type ? 6 : 12)
          : /[gprs]/.test(type) ? Math.max(1, Math.min(21, precision))
          : Math.max(0, Math.min(20, precision));

      function format(value) {
        var valuePrefix = prefix,
            valueSuffix = suffix,
            i, n, c;

        if (type === "c") {
          valueSuffix = formatType(value) + valueSuffix;
          value = "";
        } else {
          value = +value;

          // Perform the initial formatting.
          var valueNegative = value < 0;
          value = formatType(Math.abs(value), precision);

          // If a negative value rounds to zero during formatting, treat as positive.
          if (valueNegative && +value === 0) valueNegative = false;

          // Compute the prefix and suffix.
          valuePrefix = (valueNegative ? (sign === "(" ? sign : "-") : sign === "-" || sign === "(" ? "" : sign) + valuePrefix;
          valueSuffix = (type === "s" ? prefixes[8 + prefixExponent / 3] : "") + valueSuffix + (valueNegative && sign === "(" ? ")" : "");

          // Break the formatted value into the integer “value” part that can be
          // grouped, and fractional or exponential “suffix” part that is not.
          if (maybeSuffix) {
            i = -1, n = value.length;
            while (++i < n) {
              if (c = value.charCodeAt(i), 48 > c || c > 57) {
                valueSuffix = (c === 46 ? decimal + value.slice(i + 1) : value.slice(i)) + valueSuffix;
                value = value.slice(0, i);
                break;
              }
            }
          }
        }

        // If the fill character is not "0", grouping is applied before padding.
        if (comma && !zero) value = group(value, Infinity);

        // Compute the padding.
        var length = valuePrefix.length + value.length + valueSuffix.length,
            padding = length < width ? new Array(width - length + 1).join(fill) : "";

        // If the fill character is "0", grouping is applied after padding.
        if (comma && zero) value = group(padding + value, padding.length ? width - valueSuffix.length : Infinity), padding = "";

        // Reconstruct the final output based on the desired alignment.
        switch (align) {
          case "<": value = valuePrefix + value + valueSuffix + padding; break;
          case "=": value = valuePrefix + padding + value + valueSuffix; break;
          case "^": value = padding.slice(0, length = padding.length >> 1) + valuePrefix + value + valueSuffix + padding.slice(length); break;
          default: value = padding + valuePrefix + value + valueSuffix; break;
        }

        return numerals(value);
      }

      format.toString = function() {
        return specifier + "";
      };

      return format;
    }

    function formatPrefix(specifier, value) {
      var f = newFormat((specifier = formatSpecifier(specifier), specifier.type = "f", specifier)),
          e = Math.max(-8, Math.min(8, Math.floor(exponent(value) / 3))) * 3,
          k = Math.pow(10, -e),
          prefix = prefixes[8 + e / 3];
      return function(value) {
        return f(k * value) + prefix;
      };
    }

    return {
      format: newFormat,
      formatPrefix: formatPrefix
    };
  }

  var locale;
  var format;
  var formatPrefix;

  defaultLocale({
    decimal: ".",
    thousands: ",",
    grouping: [3],
    currency: ["$", ""]
  });

  function defaultLocale(definition) {
    locale = formatLocale(definition);
    format = locale.format;
    formatPrefix = locale.formatPrefix;
    return locale;
  }

  function precisionFixed(step) {
    return Math.max(0, -exponent(Math.abs(step)));
  }

  function precisionPrefix(step, value) {
    return Math.max(0, Math.max(-8, Math.min(8, Math.floor(exponent(value) / 3))) * 3 - exponent(Math.abs(step)));
  }

  function precisionRound(step, max) {
    step = Math.abs(step), max = Math.abs(max) - step;
    return Math.max(0, exponent(max) - exponent(step)) + 1;
  }

  // Adds floating point numbers with twice the normal precision.
  // Reference: J. R. Shewchuk, Adaptive Precision Floating-Point Arithmetic and
  // Fast Robust Geometric Predicates, Discrete & Computational Geometry 18(3)
  // 305–363 (1997).
  // Code adapted from GeographicLib by Charles F. F. Karney,
  // http://geographiclib.sourceforge.net/

  function adder() {
    return new Adder;
  }

  function Adder() {
    this.reset();
  }

  Adder.prototype = {
    constructor: Adder,
    reset: function() {
      this.s = // rounded value
      this.t = 0; // exact error
    },
    add: function(y) {
      add$1(temp, y, this.t);
      add$1(this, temp.s, this.s);
      if (this.s) this.t += temp.t;
      else this.s = temp.t;
    },
    valueOf: function() {
      return this.s;
    }
  };

  var temp = new Adder;

  function add$1(adder, a, b) {
    var x = adder.s = a + b,
        bv = x - a,
        av = x - bv;
    adder.t = (a - av) + (b - bv);
  }

  var pi$3 = Math.PI;

  var areaRingSum = adder();

  var areaSum = adder();

  var deltaSum = adder();

  var sum = adder();

  var lengthSum = adder();

  var areaSum$1 = adder(),
      areaRingSum$1 = adder();

  var lengthSum$1 = adder();

  // Returns the 2D cross product of AB and AC vectors, i.e., the z-component of

  var array$1 = Array.prototype;

  var map$1 = array$1.map;
  var slice$1 = array$1.slice;

  function constant$2(x) {
    return function() {
      return x;
    };
  }

  function number$1(x) {
    return +x;
  }

  var unit = [0, 1];

  function deinterpolateLinear(a, b) {
    return (b -= (a = +a))
        ? function(x) { return (x - a) / b; }
        : constant$2(b);
  }

  function deinterpolateClamp(deinterpolate) {
    return function(a, b) {
      var d = deinterpolate(a = +a, b = +b);
      return function(x) { return x <= a ? 0 : x >= b ? 1 : d(x); };
    };
  }

  function reinterpolateClamp(reinterpolate) {
    return function(a, b) {
      var r = reinterpolate(a = +a, b = +b);
      return function(t) { return t <= 0 ? a : t >= 1 ? b : r(t); };
    };
  }

  function bimap(domain, range, deinterpolate, reinterpolate) {
    var d0 = domain[0], d1 = domain[1], r0 = range[0], r1 = range[1];
    if (d1 < d0) d0 = deinterpolate(d1, d0), r0 = reinterpolate(r1, r0);
    else d0 = deinterpolate(d0, d1), r0 = reinterpolate(r0, r1);
    return function(x) { return r0(d0(x)); };
  }

  function polymap(domain, range, deinterpolate, reinterpolate) {
    var j = Math.min(domain.length, range.length) - 1,
        d = new Array(j),
        r = new Array(j),
        i = -1;

    // Reverse descending domains.
    if (domain[j] < domain[0]) {
      domain = domain.slice().reverse();
      range = range.slice().reverse();
    }

    while (++i < j) {
      d[i] = deinterpolate(domain[i], domain[i + 1]);
      r[i] = reinterpolate(range[i], range[i + 1]);
    }

    return function(x) {
      var i = bisectRight(domain, x, 1, j) - 1;
      return r[i](d[i](x));
    };
  }

  function copy(source, target) {
    return target
        .domain(source.domain())
        .range(source.range())
        .interpolate(source.interpolate())
        .clamp(source.clamp());
  }

  // deinterpolate(a, b)(x) takes a domain value x in [a,b] and returns the corresponding parameter t in [0,1].
  // reinterpolate(a, b)(t) takes a parameter t in [0,1] and returns the corresponding domain value x in [a,b].
  function continuous(deinterpolate, reinterpolate) {
    var domain = unit,
        range = unit,
        interpolate = interpolateValue,
        clamp = false,
        piecewise,
        output,
        input;

    function rescale() {
      piecewise = Math.min(domain.length, range.length) > 2 ? polymap : bimap;
      output = input = null;
      return scale;
    }

    function scale(x) {
      return (output || (output = piecewise(domain, range, clamp ? deinterpolateClamp(deinterpolate) : deinterpolate, interpolate)))(+x);
    }

    scale.invert = function(y) {
      return (input || (input = piecewise(range, domain, deinterpolateLinear, clamp ? reinterpolateClamp(reinterpolate) : reinterpolate)))(+y);
    };

    scale.domain = function(_) {
      return arguments.length ? (domain = map$1.call(_, number$1), rescale()) : domain.slice();
    };

    scale.range = function(_) {
      return arguments.length ? (range = slice$1.call(_), rescale()) : range.slice();
    };

    scale.rangeRound = function(_) {
      return range = slice$1.call(_), interpolate = interpolateRound, rescale();
    };

    scale.clamp = function(_) {
      return arguments.length ? (clamp = !!_, rescale()) : clamp;
    };

    scale.interpolate = function(_) {
      return arguments.length ? (interpolate = _, rescale()) : interpolate;
    };

    return rescale();
  }

  function tickFormat(domain, count, specifier) {
    var start = domain[0],
        stop = domain[domain.length - 1],
        step = tickStep(start, stop, count == null ? 10 : count),
        precision;
    specifier = formatSpecifier(specifier == null ? ",f" : specifier);
    switch (specifier.type) {
      case "s": {
        var value = Math.max(Math.abs(start), Math.abs(stop));
        if (specifier.precision == null && !isNaN(precision = precisionPrefix(step, value))) specifier.precision = precision;
        return formatPrefix(specifier, value);
      }
      case "":
      case "e":
      case "g":
      case "p":
      case "r": {
        if (specifier.precision == null && !isNaN(precision = precisionRound(step, Math.max(Math.abs(start), Math.abs(stop))))) specifier.precision = precision - (specifier.type === "e");
        break;
      }
      case "f":
      case "%": {
        if (specifier.precision == null && !isNaN(precision = precisionFixed(step))) specifier.precision = precision - (specifier.type === "%") * 2;
        break;
      }
    }
    return format(specifier);
  }

  function linearish(scale) {
    var domain = scale.domain;

    scale.ticks = function(count) {
      var d = domain();
      return ticks(d[0], d[d.length - 1], count == null ? 10 : count);
    };

    scale.tickFormat = function(count, specifier) {
      return tickFormat(domain(), count, specifier);
    };

    scale.nice = function(count) {
      if (count == null) count = 10;

      var d = domain(),
          i0 = 0,
          i1 = d.length - 1,
          start = d[i0],
          stop = d[i1],
          step;

      if (stop < start) {
        step = start, start = stop, stop = step;
        step = i0, i0 = i1, i1 = step;
      }

      step = tickIncrement(start, stop, count);

      if (step > 0) {
        start = Math.floor(start / step) * step;
        stop = Math.ceil(stop / step) * step;
        step = tickIncrement(start, stop, count);
      } else if (step < 0) {
        start = Math.ceil(start * step) / step;
        stop = Math.floor(stop * step) / step;
        step = tickIncrement(start, stop, count);
      }

      if (step > 0) {
        d[i0] = Math.floor(start / step) * step;
        d[i1] = Math.ceil(stop / step) * step;
        domain(d);
      } else if (step < 0) {
        d[i0] = Math.ceil(start * step) / step;
        d[i1] = Math.floor(stop * step) / step;
        domain(d);
      }

      return scale;
    };

    return scale;
  }

  function linear$1() {
    var scale = continuous(deinterpolateLinear, interpolateNumber);

    scale.copy = function() {
      return copy(scale, linear$1());
    };

    return linearish(scale);
  }

  var t0$1 = new Date,
      t1$1 = new Date;

  function newInterval(floori, offseti, count, field) {

    function interval(date) {
      return floori(date = new Date(+date)), date;
    }

    interval.floor = interval;

    interval.ceil = function(date) {
      return floori(date = new Date(date - 1)), offseti(date, 1), floori(date), date;
    };

    interval.round = function(date) {
      var d0 = interval(date),
          d1 = interval.ceil(date);
      return date - d0 < d1 - date ? d0 : d1;
    };

    interval.offset = function(date, step) {
      return offseti(date = new Date(+date), step == null ? 1 : Math.floor(step)), date;
    };

    interval.range = function(start, stop, step) {
      var range = [], previous;
      start = interval.ceil(start);
      step = step == null ? 1 : Math.floor(step);
      if (!(start < stop) || !(step > 0)) return range; // also handles Invalid Date
      do range.push(previous = new Date(+start)), offseti(start, step), floori(start);
      while (previous < start && start < stop);
      return range;
    };

    interval.filter = function(test) {
      return newInterval(function(date) {
        if (date >= date) while (floori(date), !test(date)) date.setTime(date - 1);
      }, function(date, step) {
        if (date >= date) {
          if (step < 0) while (++step <= 0) {
            while (offseti(date, -1), !test(date)) {} // eslint-disable-line no-empty
          } else while (--step >= 0) {
            while (offseti(date, +1), !test(date)) {} // eslint-disable-line no-empty
          }
        }
      });
    };

    if (count) {
      interval.count = function(start, end) {
        t0$1.setTime(+start), t1$1.setTime(+end);
        floori(t0$1), floori(t1$1);
        return Math.floor(count(t0$1, t1$1));
      };

      interval.every = function(step) {
        step = Math.floor(step);
        return !isFinite(step) || !(step > 0) ? null
            : !(step > 1) ? interval
            : interval.filter(field
                ? function(d) { return field(d) % step === 0; }
                : function(d) { return interval.count(0, d) % step === 0; });
      };
    }

    return interval;
  }

  var millisecond = newInterval(function() {
    // noop
  }, function(date, step) {
    date.setTime(+date + step);
  }, function(start, end) {
    return end - start;
  });

  // An optimized implementation for this simple case.
  millisecond.every = function(k) {
    k = Math.floor(k);
    if (!isFinite(k) || !(k > 0)) return null;
    if (!(k > 1)) return millisecond;
    return newInterval(function(date) {
      date.setTime(Math.floor(date / k) * k);
    }, function(date, step) {
      date.setTime(+date + step * k);
    }, function(start, end) {
      return (end - start) / k;
    });
  };
  var milliseconds = millisecond.range;

  var durationSecond = 1e3;
  var durationMinute = 6e4;
  var durationHour = 36e5;
  var durationDay = 864e5;
  var durationWeek = 6048e5;

  var second = newInterval(function(date) {
    date.setTime(Math.floor(date / durationSecond) * durationSecond);
  }, function(date, step) {
    date.setTime(+date + step * durationSecond);
  }, function(start, end) {
    return (end - start) / durationSecond;
  }, function(date) {
    return date.getUTCSeconds();
  });
  var seconds = second.range;

  var minute = newInterval(function(date) {
    date.setTime(Math.floor(date / durationMinute) * durationMinute);
  }, function(date, step) {
    date.setTime(+date + step * durationMinute);
  }, function(start, end) {
    return (end - start) / durationMinute;
  }, function(date) {
    return date.getMinutes();
  });
  var minutes = minute.range;

  var hour = newInterval(function(date) {
    var offset = date.getTimezoneOffset() * durationMinute % durationHour;
    if (offset < 0) offset += durationHour;
    date.setTime(Math.floor((+date - offset) / durationHour) * durationHour + offset);
  }, function(date, step) {
    date.setTime(+date + step * durationHour);
  }, function(start, end) {
    return (end - start) / durationHour;
  }, function(date) {
    return date.getHours();
  });
  var hours = hour.range;

  var day = newInterval(function(date) {
    date.setHours(0, 0, 0, 0);
  }, function(date, step) {
    date.setDate(date.getDate() + step);
  }, function(start, end) {
    return (end - start - (end.getTimezoneOffset() - start.getTimezoneOffset()) * durationMinute) / durationDay;
  }, function(date) {
    return date.getDate() - 1;
  });
  var days = day.range;

  function weekday(i) {
    return newInterval(function(date) {
      date.setDate(date.getDate() - (date.getDay() + 7 - i) % 7);
      date.setHours(0, 0, 0, 0);
    }, function(date, step) {
      date.setDate(date.getDate() + step * 7);
    }, function(start, end) {
      return (end - start - (end.getTimezoneOffset() - start.getTimezoneOffset()) * durationMinute) / durationWeek;
    });
  }

  var sunday = weekday(0);
  var monday = weekday(1);
  var tuesday = weekday(2);
  var wednesday = weekday(3);
  var thursday = weekday(4);
  var friday = weekday(5);
  var saturday = weekday(6);

  var sundays = sunday.range;

  var month = newInterval(function(date) {
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
  }, function(date, step) {
    date.setMonth(date.getMonth() + step);
  }, function(start, end) {
    return end.getMonth() - start.getMonth() + (end.getFullYear() - start.getFullYear()) * 12;
  }, function(date) {
    return date.getMonth();
  });
  var months = month.range;

  var year = newInterval(function(date) {
    date.setMonth(0, 1);
    date.setHours(0, 0, 0, 0);
  }, function(date, step) {
    date.setFullYear(date.getFullYear() + step);
  }, function(start, end) {
    return end.getFullYear() - start.getFullYear();
  }, function(date) {
    return date.getFullYear();
  });

  // An optimized implementation for this simple case.
  year.every = function(k) {
    return !isFinite(k = Math.floor(k)) || !(k > 0) ? null : newInterval(function(date) {
      date.setFullYear(Math.floor(date.getFullYear() / k) * k);
      date.setMonth(0, 1);
      date.setHours(0, 0, 0, 0);
    }, function(date, step) {
      date.setFullYear(date.getFullYear() + step * k);
    });
  };
  var years = year.range;

  var utcMinute = newInterval(function(date) {
    date.setUTCSeconds(0, 0);
  }, function(date, step) {
    date.setTime(+date + step * durationMinute);
  }, function(start, end) {
    return (end - start) / durationMinute;
  }, function(date) {
    return date.getUTCMinutes();
  });
  var utcMinutes = utcMinute.range;

  var utcHour = newInterval(function(date) {
    date.setUTCMinutes(0, 0, 0);
  }, function(date, step) {
    date.setTime(+date + step * durationHour);
  }, function(start, end) {
    return (end - start) / durationHour;
  }, function(date) {
    return date.getUTCHours();
  });
  var utcHours = utcHour.range;

  var utcDay = newInterval(function(date) {
    date.setUTCHours(0, 0, 0, 0);
  }, function(date, step) {
    date.setUTCDate(date.getUTCDate() + step);
  }, function(start, end) {
    return (end - start) / durationDay;
  }, function(date) {
    return date.getUTCDate() - 1;
  });
  var utcDays = utcDay.range;

  function utcWeekday(i) {
    return newInterval(function(date) {
      date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 7 - i) % 7);
      date.setUTCHours(0, 0, 0, 0);
    }, function(date, step) {
      date.setUTCDate(date.getUTCDate() + step * 7);
    }, function(start, end) {
      return (end - start) / durationWeek;
    });
  }

  var utcSunday = utcWeekday(0);
  var utcMonday = utcWeekday(1);
  var utcTuesday = utcWeekday(2);
  var utcWednesday = utcWeekday(3);
  var utcThursday = utcWeekday(4);
  var utcFriday = utcWeekday(5);
  var utcSaturday = utcWeekday(6);

  var utcSundays = utcSunday.range;

  var utcMonth = newInterval(function(date) {
    date.setUTCDate(1);
    date.setUTCHours(0, 0, 0, 0);
  }, function(date, step) {
    date.setUTCMonth(date.getUTCMonth() + step);
  }, function(start, end) {
    return end.getUTCMonth() - start.getUTCMonth() + (end.getUTCFullYear() - start.getUTCFullYear()) * 12;
  }, function(date) {
    return date.getUTCMonth();
  });
  var utcMonths = utcMonth.range;

  var utcYear = newInterval(function(date) {
    date.setUTCMonth(0, 1);
    date.setUTCHours(0, 0, 0, 0);
  }, function(date, step) {
    date.setUTCFullYear(date.getUTCFullYear() + step);
  }, function(start, end) {
    return end.getUTCFullYear() - start.getUTCFullYear();
  }, function(date) {
    return date.getUTCFullYear();
  });

  // An optimized implementation for this simple case.
  utcYear.every = function(k) {
    return !isFinite(k = Math.floor(k)) || !(k > 0) ? null : newInterval(function(date) {
      date.setUTCFullYear(Math.floor(date.getUTCFullYear() / k) * k);
      date.setUTCMonth(0, 1);
      date.setUTCHours(0, 0, 0, 0);
    }, function(date, step) {
      date.setUTCFullYear(date.getUTCFullYear() + step * k);
    });
  };
  var utcYears = utcYear.range;

  function localDate(d) {
    if (0 <= d.y && d.y < 100) {
      var date = new Date(-1, d.m, d.d, d.H, d.M, d.S, d.L);
      date.setFullYear(d.y);
      return date;
    }
    return new Date(d.y, d.m, d.d, d.H, d.M, d.S, d.L);
  }

  function utcDate(d) {
    if (0 <= d.y && d.y < 100) {
      var date = new Date(Date.UTC(-1, d.m, d.d, d.H, d.M, d.S, d.L));
      date.setUTCFullYear(d.y);
      return date;
    }
    return new Date(Date.UTC(d.y, d.m, d.d, d.H, d.M, d.S, d.L));
  }

  function newYear(y) {
    return {y: y, m: 0, d: 1, H: 0, M: 0, S: 0, L: 0};
  }

  function formatLocale$1(locale) {
    var locale_dateTime = locale.dateTime,
        locale_date = locale.date,
        locale_time = locale.time,
        locale_periods = locale.periods,
        locale_weekdays = locale.days,
        locale_shortWeekdays = locale.shortDays,
        locale_months = locale.months,
        locale_shortMonths = locale.shortMonths;

    var periodRe = formatRe(locale_periods),
        periodLookup = formatLookup(locale_periods),
        weekdayRe = formatRe(locale_weekdays),
        weekdayLookup = formatLookup(locale_weekdays),
        shortWeekdayRe = formatRe(locale_shortWeekdays),
        shortWeekdayLookup = formatLookup(locale_shortWeekdays),
        monthRe = formatRe(locale_months),
        monthLookup = formatLookup(locale_months),
        shortMonthRe = formatRe(locale_shortMonths),
        shortMonthLookup = formatLookup(locale_shortMonths);

    var formats = {
      "a": formatShortWeekday,
      "A": formatWeekday,
      "b": formatShortMonth,
      "B": formatMonth,
      "c": null,
      "d": formatDayOfMonth,
      "e": formatDayOfMonth,
      "f": formatMicroseconds,
      "H": formatHour24,
      "I": formatHour12,
      "j": formatDayOfYear,
      "L": formatMilliseconds,
      "m": formatMonthNumber,
      "M": formatMinutes,
      "p": formatPeriod,
      "Q": formatUnixTimestamp,
      "s": formatUnixTimestampSeconds,
      "S": formatSeconds,
      "u": formatWeekdayNumberMonday,
      "U": formatWeekNumberSunday,
      "V": formatWeekNumberISO,
      "w": formatWeekdayNumberSunday,
      "W": formatWeekNumberMonday,
      "x": null,
      "X": null,
      "y": formatYear,
      "Y": formatFullYear,
      "Z": formatZone,
      "%": formatLiteralPercent
    };

    var utcFormats = {
      "a": formatUTCShortWeekday,
      "A": formatUTCWeekday,
      "b": formatUTCShortMonth,
      "B": formatUTCMonth,
      "c": null,
      "d": formatUTCDayOfMonth,
      "e": formatUTCDayOfMonth,
      "f": formatUTCMicroseconds,
      "H": formatUTCHour24,
      "I": formatUTCHour12,
      "j": formatUTCDayOfYear,
      "L": formatUTCMilliseconds,
      "m": formatUTCMonthNumber,
      "M": formatUTCMinutes,
      "p": formatUTCPeriod,
      "Q": formatUnixTimestamp,
      "s": formatUnixTimestampSeconds,
      "S": formatUTCSeconds,
      "u": formatUTCWeekdayNumberMonday,
      "U": formatUTCWeekNumberSunday,
      "V": formatUTCWeekNumberISO,
      "w": formatUTCWeekdayNumberSunday,
      "W": formatUTCWeekNumberMonday,
      "x": null,
      "X": null,
      "y": formatUTCYear,
      "Y": formatUTCFullYear,
      "Z": formatUTCZone,
      "%": formatLiteralPercent
    };

    var parses = {
      "a": parseShortWeekday,
      "A": parseWeekday,
      "b": parseShortMonth,
      "B": parseMonth,
      "c": parseLocaleDateTime,
      "d": parseDayOfMonth,
      "e": parseDayOfMonth,
      "f": parseMicroseconds,
      "H": parseHour24,
      "I": parseHour24,
      "j": parseDayOfYear,
      "L": parseMilliseconds,
      "m": parseMonthNumber,
      "M": parseMinutes,
      "p": parsePeriod,
      "Q": parseUnixTimestamp,
      "s": parseUnixTimestampSeconds,
      "S": parseSeconds,
      "u": parseWeekdayNumberMonday,
      "U": parseWeekNumberSunday,
      "V": parseWeekNumberISO,
      "w": parseWeekdayNumberSunday,
      "W": parseWeekNumberMonday,
      "x": parseLocaleDate,
      "X": parseLocaleTime,
      "y": parseYear,
      "Y": parseFullYear,
      "Z": parseZone,
      "%": parseLiteralPercent
    };

    // These recursive directive definitions must be deferred.
    formats.x = newFormat(locale_date, formats);
    formats.X = newFormat(locale_time, formats);
    formats.c = newFormat(locale_dateTime, formats);
    utcFormats.x = newFormat(locale_date, utcFormats);
    utcFormats.X = newFormat(locale_time, utcFormats);
    utcFormats.c = newFormat(locale_dateTime, utcFormats);

    function newFormat(specifier, formats) {
      return function(date) {
        var string = [],
            i = -1,
            j = 0,
            n = specifier.length,
            c,
            pad,
            format;

        if (!(date instanceof Date)) date = new Date(+date);

        while (++i < n) {
          if (specifier.charCodeAt(i) === 37) {
            string.push(specifier.slice(j, i));
            if ((pad = pads[c = specifier.charAt(++i)]) != null) c = specifier.charAt(++i);
            else pad = c === "e" ? " " : "0";
            if (format = formats[c]) c = format(date, pad);
            string.push(c);
            j = i + 1;
          }
        }

        string.push(specifier.slice(j, i));
        return string.join("");
      };
    }

    function newParse(specifier, newDate) {
      return function(string) {
        var d = newYear(1900),
            i = parseSpecifier(d, specifier, string += "", 0),
            week, day$1;
        if (i != string.length) return null;

        // If a UNIX timestamp is specified, return it.
        if ("Q" in d) return new Date(d.Q);

        // The am-pm flag is 0 for AM, and 1 for PM.
        if ("p" in d) d.H = d.H % 12 + d.p * 12;

        // Convert day-of-week and week-of-year to day-of-year.
        if ("V" in d) {
          if (d.V < 1 || d.V > 53) return null;
          if (!("w" in d)) d.w = 1;
          if ("Z" in d) {
            week = utcDate(newYear(d.y)), day$1 = week.getUTCDay();
            week = day$1 > 4 || day$1 === 0 ? utcMonday.ceil(week) : utcMonday(week);
            week = utcDay.offset(week, (d.V - 1) * 7);
            d.y = week.getUTCFullYear();
            d.m = week.getUTCMonth();
            d.d = week.getUTCDate() + (d.w + 6) % 7;
          } else {
            week = newDate(newYear(d.y)), day$1 = week.getDay();
            week = day$1 > 4 || day$1 === 0 ? monday.ceil(week) : monday(week);
            week = day.offset(week, (d.V - 1) * 7);
            d.y = week.getFullYear();
            d.m = week.getMonth();
            d.d = week.getDate() + (d.w + 6) % 7;
          }
        } else if ("W" in d || "U" in d) {
          if (!("w" in d)) d.w = "u" in d ? d.u % 7 : "W" in d ? 1 : 0;
          day$1 = "Z" in d ? utcDate(newYear(d.y)).getUTCDay() : newDate(newYear(d.y)).getDay();
          d.m = 0;
          d.d = "W" in d ? (d.w + 6) % 7 + d.W * 7 - (day$1 + 5) % 7 : d.w + d.U * 7 - (day$1 + 6) % 7;
        }

        // If a time zone is specified, all fields are interpreted as UTC and then
        // offset according to the specified time zone.
        if ("Z" in d) {
          d.H += d.Z / 100 | 0;
          d.M += d.Z % 100;
          return utcDate(d);
        }

        // Otherwise, all fields are in local time.
        return newDate(d);
      };
    }

    function parseSpecifier(d, specifier, string, j) {
      var i = 0,
          n = specifier.length,
          m = string.length,
          c,
          parse;

      while (i < n) {
        if (j >= m) return -1;
        c = specifier.charCodeAt(i++);
        if (c === 37) {
          c = specifier.charAt(i++);
          parse = parses[c in pads ? specifier.charAt(i++) : c];
          if (!parse || ((j = parse(d, string, j)) < 0)) return -1;
        } else if (c != string.charCodeAt(j++)) {
          return -1;
        }
      }

      return j;
    }

    function parsePeriod(d, string, i) {
      var n = periodRe.exec(string.slice(i));
      return n ? (d.p = periodLookup[n[0].toLowerCase()], i + n[0].length) : -1;
    }

    function parseShortWeekday(d, string, i) {
      var n = shortWeekdayRe.exec(string.slice(i));
      return n ? (d.w = shortWeekdayLookup[n[0].toLowerCase()], i + n[0].length) : -1;
    }

    function parseWeekday(d, string, i) {
      var n = weekdayRe.exec(string.slice(i));
      return n ? (d.w = weekdayLookup[n[0].toLowerCase()], i + n[0].length) : -1;
    }

    function parseShortMonth(d, string, i) {
      var n = shortMonthRe.exec(string.slice(i));
      return n ? (d.m = shortMonthLookup[n[0].toLowerCase()], i + n[0].length) : -1;
    }

    function parseMonth(d, string, i) {
      var n = monthRe.exec(string.slice(i));
      return n ? (d.m = monthLookup[n[0].toLowerCase()], i + n[0].length) : -1;
    }

    function parseLocaleDateTime(d, string, i) {
      return parseSpecifier(d, locale_dateTime, string, i);
    }

    function parseLocaleDate(d, string, i) {
      return parseSpecifier(d, locale_date, string, i);
    }

    function parseLocaleTime(d, string, i) {
      return parseSpecifier(d, locale_time, string, i);
    }

    function formatShortWeekday(d) {
      return locale_shortWeekdays[d.getDay()];
    }

    function formatWeekday(d) {
      return locale_weekdays[d.getDay()];
    }

    function formatShortMonth(d) {
      return locale_shortMonths[d.getMonth()];
    }

    function formatMonth(d) {
      return locale_months[d.getMonth()];
    }

    function formatPeriod(d) {
      return locale_periods[+(d.getHours() >= 12)];
    }

    function formatUTCShortWeekday(d) {
      return locale_shortWeekdays[d.getUTCDay()];
    }

    function formatUTCWeekday(d) {
      return locale_weekdays[d.getUTCDay()];
    }

    function formatUTCShortMonth(d) {
      return locale_shortMonths[d.getUTCMonth()];
    }

    function formatUTCMonth(d) {
      return locale_months[d.getUTCMonth()];
    }

    function formatUTCPeriod(d) {
      return locale_periods[+(d.getUTCHours() >= 12)];
    }

    return {
      format: function(specifier) {
        var f = newFormat(specifier += "", formats);
        f.toString = function() { return specifier; };
        return f;
      },
      parse: function(specifier) {
        var p = newParse(specifier += "", localDate);
        p.toString = function() { return specifier; };
        return p;
      },
      utcFormat: function(specifier) {
        var f = newFormat(specifier += "", utcFormats);
        f.toString = function() { return specifier; };
        return f;
      },
      utcParse: function(specifier) {
        var p = newParse(specifier, utcDate);
        p.toString = function() { return specifier; };
        return p;
      }
    };
  }

  var pads = {"-": "", "_": " ", "0": "0"},
      numberRe = /^\s*\d+/, // note: ignores next directive
      percentRe = /^%/,
      requoteRe = /[\\^$*+?|[\]().{}]/g;

  function pad(value, fill, width) {
    var sign = value < 0 ? "-" : "",
        string = (sign ? -value : value) + "",
        length = string.length;
    return sign + (length < width ? new Array(width - length + 1).join(fill) + string : string);
  }

  function requote(s) {
    return s.replace(requoteRe, "\\$&");
  }

  function formatRe(names) {
    return new RegExp("^(?:" + names.map(requote).join("|") + ")", "i");
  }

  function formatLookup(names) {
    var map = {}, i = -1, n = names.length;
    while (++i < n) map[names[i].toLowerCase()] = i;
    return map;
  }

  function parseWeekdayNumberSunday(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 1));
    return n ? (d.w = +n[0], i + n[0].length) : -1;
  }

  function parseWeekdayNumberMonday(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 1));
    return n ? (d.u = +n[0], i + n[0].length) : -1;
  }

  function parseWeekNumberSunday(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 2));
    return n ? (d.U = +n[0], i + n[0].length) : -1;
  }

  function parseWeekNumberISO(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 2));
    return n ? (d.V = +n[0], i + n[0].length) : -1;
  }

  function parseWeekNumberMonday(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 2));
    return n ? (d.W = +n[0], i + n[0].length) : -1;
  }

  function parseFullYear(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 4));
    return n ? (d.y = +n[0], i + n[0].length) : -1;
  }

  function parseYear(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 2));
    return n ? (d.y = +n[0] + (+n[0] > 68 ? 1900 : 2000), i + n[0].length) : -1;
  }

  function parseZone(d, string, i) {
    var n = /^(Z)|([+-]\d\d)(?::?(\d\d))?/.exec(string.slice(i, i + 6));
    return n ? (d.Z = n[1] ? 0 : -(n[2] + (n[3] || "00")), i + n[0].length) : -1;
  }

  function parseMonthNumber(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 2));
    return n ? (d.m = n[0] - 1, i + n[0].length) : -1;
  }

  function parseDayOfMonth(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 2));
    return n ? (d.d = +n[0], i + n[0].length) : -1;
  }

  function parseDayOfYear(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 3));
    return n ? (d.m = 0, d.d = +n[0], i + n[0].length) : -1;
  }

  function parseHour24(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 2));
    return n ? (d.H = +n[0], i + n[0].length) : -1;
  }

  function parseMinutes(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 2));
    return n ? (d.M = +n[0], i + n[0].length) : -1;
  }

  function parseSeconds(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 2));
    return n ? (d.S = +n[0], i + n[0].length) : -1;
  }

  function parseMilliseconds(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 3));
    return n ? (d.L = +n[0], i + n[0].length) : -1;
  }

  function parseMicroseconds(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 6));
    return n ? (d.L = Math.floor(n[0] / 1000), i + n[0].length) : -1;
  }

  function parseLiteralPercent(d, string, i) {
    var n = percentRe.exec(string.slice(i, i + 1));
    return n ? i + n[0].length : -1;
  }

  function parseUnixTimestamp(d, string, i) {
    var n = numberRe.exec(string.slice(i));
    return n ? (d.Q = +n[0], i + n[0].length) : -1;
  }

  function parseUnixTimestampSeconds(d, string, i) {
    var n = numberRe.exec(string.slice(i));
    return n ? (d.Q = (+n[0]) * 1000, i + n[0].length) : -1;
  }

  function formatDayOfMonth(d, p) {
    return pad(d.getDate(), p, 2);
  }

  function formatHour24(d, p) {
    return pad(d.getHours(), p, 2);
  }

  function formatHour12(d, p) {
    return pad(d.getHours() % 12 || 12, p, 2);
  }

  function formatDayOfYear(d, p) {
    return pad(1 + day.count(year(d), d), p, 3);
  }

  function formatMilliseconds(d, p) {
    return pad(d.getMilliseconds(), p, 3);
  }

  function formatMicroseconds(d, p) {
    return formatMilliseconds(d, p) + "000";
  }

  function formatMonthNumber(d, p) {
    return pad(d.getMonth() + 1, p, 2);
  }

  function formatMinutes(d, p) {
    return pad(d.getMinutes(), p, 2);
  }

  function formatSeconds(d, p) {
    return pad(d.getSeconds(), p, 2);
  }

  function formatWeekdayNumberMonday(d) {
    var day = d.getDay();
    return day === 0 ? 7 : day;
  }

  function formatWeekNumberSunday(d, p) {
    return pad(sunday.count(year(d), d), p, 2);
  }

  function formatWeekNumberISO(d, p) {
    var day = d.getDay();
    d = (day >= 4 || day === 0) ? thursday(d) : thursday.ceil(d);
    return pad(thursday.count(year(d), d) + (year(d).getDay() === 4), p, 2);
  }

  function formatWeekdayNumberSunday(d) {
    return d.getDay();
  }

  function formatWeekNumberMonday(d, p) {
    return pad(monday.count(year(d), d), p, 2);
  }

  function formatYear(d, p) {
    return pad(d.getFullYear() % 100, p, 2);
  }

  function formatFullYear(d, p) {
    return pad(d.getFullYear() % 10000, p, 4);
  }

  function formatZone(d) {
    var z = d.getTimezoneOffset();
    return (z > 0 ? "-" : (z *= -1, "+"))
        + pad(z / 60 | 0, "0", 2)
        + pad(z % 60, "0", 2);
  }

  function formatUTCDayOfMonth(d, p) {
    return pad(d.getUTCDate(), p, 2);
  }

  function formatUTCHour24(d, p) {
    return pad(d.getUTCHours(), p, 2);
  }

  function formatUTCHour12(d, p) {
    return pad(d.getUTCHours() % 12 || 12, p, 2);
  }

  function formatUTCDayOfYear(d, p) {
    return pad(1 + utcDay.count(utcYear(d), d), p, 3);
  }

  function formatUTCMilliseconds(d, p) {
    return pad(d.getUTCMilliseconds(), p, 3);
  }

  function formatUTCMicroseconds(d, p) {
    return formatUTCMilliseconds(d, p) + "000";
  }

  function formatUTCMonthNumber(d, p) {
    return pad(d.getUTCMonth() + 1, p, 2);
  }

  function formatUTCMinutes(d, p) {
    return pad(d.getUTCMinutes(), p, 2);
  }

  function formatUTCSeconds(d, p) {
    return pad(d.getUTCSeconds(), p, 2);
  }

  function formatUTCWeekdayNumberMonday(d) {
    var dow = d.getUTCDay();
    return dow === 0 ? 7 : dow;
  }

  function formatUTCWeekNumberSunday(d, p) {
    return pad(utcSunday.count(utcYear(d), d), p, 2);
  }

  function formatUTCWeekNumberISO(d, p) {
    var day = d.getUTCDay();
    d = (day >= 4 || day === 0) ? utcThursday(d) : utcThursday.ceil(d);
    return pad(utcThursday.count(utcYear(d), d) + (utcYear(d).getUTCDay() === 4), p, 2);
  }

  function formatUTCWeekdayNumberSunday(d) {
    return d.getUTCDay();
  }

  function formatUTCWeekNumberMonday(d, p) {
    return pad(utcMonday.count(utcYear(d), d), p, 2);
  }

  function formatUTCYear(d, p) {
    return pad(d.getUTCFullYear() % 100, p, 2);
  }

  function formatUTCFullYear(d, p) {
    return pad(d.getUTCFullYear() % 10000, p, 4);
  }

  function formatUTCZone() {
    return "+0000";
  }

  function formatLiteralPercent() {
    return "%";
  }

  function formatUnixTimestamp(d) {
    return +d;
  }

  function formatUnixTimestampSeconds(d) {
    return Math.floor(+d / 1000);
  }

  var locale$1;
  var timeFormat;
  var timeParse;
  var utcFormat;
  var utcParse;

  defaultLocale$1({
    dateTime: "%x, %X",
    date: "%-m/%-d/%Y",
    time: "%-I:%M:%S %p",
    periods: ["AM", "PM"],
    days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    shortDays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    shortMonths: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  });

  function defaultLocale$1(definition) {
    locale$1 = formatLocale$1(definition);
    timeFormat = locale$1.format;
    timeParse = locale$1.parse;
    utcFormat = locale$1.utcFormat;
    utcParse = locale$1.utcParse;
    return locale$1;
  }

  var isoSpecifier = "%Y-%m-%dT%H:%M:%S.%LZ";

  function formatIsoNative(date) {
    return date.toISOString();
  }

  var formatIso = Date.prototype.toISOString
      ? formatIsoNative
      : utcFormat(isoSpecifier);

  function parseIsoNative(string) {
    var date = new Date(string);
    return isNaN(date) ? null : date;
  }

  var parseIso = +new Date("2000-01-01T00:00:00.000Z")
      ? parseIsoNative
      : utcParse(isoSpecifier);

  function colors(s) {
    return s.match(/.{6}/g).map(function(x) {
      return "#" + x;
    });
  }

  colors("1f77b4ff7f0e2ca02cd627289467bd8c564be377c27f7f7fbcbd2217becf");

  colors("393b795254a36b6ecf9c9ede6379398ca252b5cf6bcedb9c8c6d31bd9e39e7ba52e7cb94843c39ad494ad6616be7969c7b4173a55194ce6dbdde9ed6");

  colors("3182bd6baed69ecae1c6dbefe6550dfd8d3cfdae6bfdd0a231a35474c476a1d99bc7e9c0756bb19e9ac8bcbddcdadaeb636363969696bdbdbdd9d9d9");

  colors("1f77b4aec7e8ff7f0effbb782ca02c98df8ad62728ff98969467bdc5b0d58c564bc49c94e377c2f7b6d27f7f7fc7c7c7bcbd22dbdb8d17becf9edae5");

  cubehelixLong(cubehelix(300, 0.5, 0.0), cubehelix(-240, 0.5, 1.0));

  var warm = cubehelixLong(cubehelix(-100, 0.75, 0.35), cubehelix(80, 1.50, 0.8));

  var cool = cubehelixLong(cubehelix(260, 0.75, 0.35), cubehelix(80, 1.50, 0.8));

  var rainbow = cubehelix();

  function ramp(range) {
    var n = range.length;
    return function(t) {
      return range[Math.max(0, Math.min(n - 1, Math.floor(t * n)))];
    };
  }

  ramp(colors("44015444025645045745055946075a46085c460a5d460b5e470d60470e6147106347116447136548146748166848176948186a481a6c481b6d481c6e481d6f481f70482071482173482374482475482576482677482878482979472a7a472c7a472d7b472e7c472f7d46307e46327e46337f463480453581453781453882443983443a83443b84433d84433e85423f854240864241864142874144874045884046883f47883f48893e49893e4a893e4c8a3d4d8a3d4e8a3c4f8a3c508b3b518b3b528b3a538b3a548c39558c39568c38588c38598c375a8c375b8d365c8d365d8d355e8d355f8d34608d34618d33628d33638d32648e32658e31668e31678e31688e30698e306a8e2f6b8e2f6c8e2e6d8e2e6e8e2e6f8e2d708e2d718e2c718e2c728e2c738e2b748e2b758e2a768e2a778e2a788e29798e297a8e297b8e287c8e287d8e277e8e277f8e27808e26818e26828e26828e25838e25848e25858e24868e24878e23888e23898e238a8d228b8d228c8d228d8d218e8d218f8d21908d21918c20928c20928c20938c1f948c1f958b1f968b1f978b1f988b1f998a1f9a8a1e9b8a1e9c891e9d891f9e891f9f881fa0881fa1881fa1871fa28720a38620a48621a58521a68522a78522a88423a98324aa8325ab8225ac8226ad8127ad8128ae8029af7f2ab07f2cb17e2db27d2eb37c2fb47c31b57b32b67a34b67935b77937b87838b9773aba763bbb753dbc743fbc7340bd7242be7144bf7046c06f48c16e4ac16d4cc26c4ec36b50c46a52c56954c56856c66758c7655ac8645cc8635ec96260ca6063cb5f65cb5e67cc5c69cd5b6ccd5a6ece5870cf5773d05675d05477d1537ad1517cd2507fd34e81d34d84d44b86d54989d5488bd6468ed64590d74393d74195d84098d83e9bd93c9dd93ba0da39a2da37a5db36a8db34aadc32addc30b0dd2fb2dd2db5de2bb8de29bade28bddf26c0df25c2df23c5e021c8e020cae11fcde11dd0e11cd2e21bd5e21ad8e219dae319dde318dfe318e2e418e5e419e7e419eae51aece51befe51cf1e51df4e61ef6e620f8e621fbe723fde725"));

  var magma = ramp(colors("00000401000501010601010802010902020b02020d03030f03031204041405041606051806051a07061c08071e0907200a08220b09240c09260d0a290e0b2b100b2d110c2f120d31130d34140e36150e38160f3b180f3d19103f1a10421c10441d11471e114920114b21114e22115024125325125527125829115a2a115c2c115f2d11612f116331116533106734106936106b38106c390f6e3b0f703d0f713f0f72400f74420f75440f764510774710784910784a10794c117a4e117b4f127b51127c52137c54137d56147d57157e59157e5a167e5c167f5d177f5f187f601880621980641a80651a80671b80681c816a1c816b1d816d1d816e1e81701f81721f817320817521817621817822817922827b23827c23827e24828025828125818326818426818627818827818928818b29818c29818e2a81902a81912b81932b80942c80962c80982d80992d809b2e7f9c2e7f9e2f7fa02f7fa1307ea3307ea5317ea6317da8327daa337dab337cad347cae347bb0357bb2357bb3367ab5367ab73779b83779ba3878bc3978bd3977bf3a77c03a76c23b75c43c75c53c74c73d73c83e73ca3e72cc3f71cd4071cf4070d0416fd2426fd3436ed5446dd6456cd8456cd9466bdb476adc4869de4968df4a68e04c67e24d66e34e65e44f64e55064e75263e85362e95462ea5661eb5760ec5860ed5a5fee5b5eef5d5ef05f5ef1605df2625df2645cf3655cf4675cf4695cf56b5cf66c5cf66e5cf7705cf7725cf8745cf8765cf9785df9795df97b5dfa7d5efa7f5efa815ffb835ffb8560fb8761fc8961fc8a62fc8c63fc8e64fc9065fd9266fd9467fd9668fd9869fd9a6afd9b6bfe9d6cfe9f6dfea16efea36ffea571fea772fea973feaa74feac76feae77feb078feb27afeb47bfeb67cfeb77efeb97ffebb81febd82febf84fec185fec287fec488fec68afec88cfeca8dfecc8ffecd90fecf92fed194fed395fed597fed799fed89afdda9cfddc9efddea0fde0a1fde2a3fde3a5fde5a7fde7a9fde9aafdebacfcecaefceeb0fcf0b2fcf2b4fcf4b6fcf6b8fcf7b9fcf9bbfcfbbdfcfdbf"));

  var inferno = ramp(colors("00000401000501010601010802010a02020c02020e03021004031204031405041706041907051b08051d09061f0a07220b07240c08260d08290e092b10092d110a30120a32140b34150b37160b39180c3c190c3e1b0c411c0c431e0c451f0c48210c4a230c4c240c4f260c51280b53290b552b0b572d0b592f0a5b310a5c320a5e340a5f3609613809623909633b09643d09653e0966400a67420a68440a68450a69470b6a490b6a4a0c6b4c0c6b4d0d6c4f0d6c510e6c520e6d540f6d550f6d57106e59106e5a116e5c126e5d126e5f136e61136e62146e64156e65156e67166e69166e6a176e6c186e6d186e6f196e71196e721a6e741a6e751b6e771c6d781c6d7a1d6d7c1d6d7d1e6d7f1e6c801f6c82206c84206b85216b87216b88226a8a226a8c23698d23698f24699025689225689326679526679727669827669a28659b29649d29649f2a63a02a63a22b62a32c61a52c60a62d60a82e5fa92e5eab2f5ead305dae305cb0315bb1325ab3325ab43359b63458b73557b93556ba3655bc3754bd3853bf3952c03a51c13a50c33b4fc43c4ec63d4dc73e4cc83f4bca404acb4149cc4248ce4347cf4446d04545d24644d34743d44842d54a41d74b3fd84c3ed94d3dda4e3cdb503bdd513ade5238df5337e05536e15635e25734e35933e45a31e55c30e65d2fe75e2ee8602de9612bea632aeb6429eb6628ec6726ed6925ee6a24ef6c23ef6e21f06f20f1711ff1731df2741cf3761bf37819f47918f57b17f57d15f67e14f68013f78212f78410f8850ff8870ef8890cf98b0bf98c0af98e09fa9008fa9207fa9407fb9606fb9706fb9906fb9b06fb9d07fc9f07fca108fca309fca50afca60cfca80dfcaa0ffcac11fcae12fcb014fcb216fcb418fbb61afbb81dfbba1ffbbc21fbbe23fac026fac228fac42afac62df9c72ff9c932f9cb35f8cd37f8cf3af7d13df7d340f6d543f6d746f5d949f5db4cf4dd4ff4df53f4e156f3e35af3e55df2e661f2e865f2ea69f1ec6df1ed71f1ef75f1f179f2f27df2f482f3f586f3f68af4f88ef5f992f6fa96f8fb9af9fc9dfafda1fcffa4"));

  var plasma = ramp(colors("0d088710078813078916078a19068c1b068d1d068e20068f2206902406912605912805922a05932c05942e05952f059631059733059735049837049938049a3a049a3c049b3e049c3f049c41049d43039e44039e46039f48039f4903a04b03a14c02a14e02a25002a25102a35302a35502a45601a45801a45901a55b01a55c01a65e01a66001a66100a76300a76400a76600a76700a86900a86a00a86c00a86e00a86f00a87100a87201a87401a87501a87701a87801a87a02a87b02a87d03a87e03a88004a88104a78305a78405a78606a68707a68808a68a09a58b0aa58d0ba58e0ca48f0da4910ea3920fa39410a29511a19613a19814a099159f9a169f9c179e9d189d9e199da01a9ca11b9ba21d9aa31e9aa51f99a62098a72197a82296aa2395ab2494ac2694ad2793ae2892b02991b12a90b22b8fb32c8eb42e8db52f8cb6308bb7318ab83289ba3388bb3488bc3587bd3786be3885bf3984c03a83c13b82c23c81c33d80c43e7fc5407ec6417dc7427cc8437bc9447aca457acb4679cc4778cc4977cd4a76ce4b75cf4c74d04d73d14e72d24f71d35171d45270d5536fd5546ed6556dd7566cd8576bd9586ada5a6ada5b69db5c68dc5d67dd5e66de5f65de6164df6263e06363e16462e26561e26660e3685fe4695ee56a5de56b5de66c5ce76e5be76f5ae87059e97158e97257ea7457eb7556eb7655ec7754ed7953ed7a52ee7b51ef7c51ef7e50f07f4ff0804ef1814df1834cf2844bf3854bf3874af48849f48948f58b47f58c46f68d45f68f44f79044f79143f79342f89441f89540f9973ff9983ef99a3efa9b3dfa9c3cfa9e3bfb9f3afba139fba238fca338fca537fca636fca835fca934fdab33fdac33fdae32fdaf31fdb130fdb22ffdb42ffdb52efeb72dfeb82cfeba2cfebb2bfebd2afebe2afec029fdc229fdc328fdc527fdc627fdc827fdca26fdcb26fccd25fcce25fcd025fcd225fbd324fbd524fbd724fad824fada24f9dc24f9dd25f8df25f8e125f7e225f7e425f6e626f6e826f5e926f5eb27f4ed27f3ee27f3f027f2f227f1f426f1f525f0f724f0f921"));

  var pi$4 = Math.PI;

  function sign(x) {
    return x < 0 ? -1 : 1;
  }

  // Calculate the slopes of the tangents (Hermite-type interpolation) based on
  // the following paper: Steffen, M. 1990. A Simple Method for Monotonic
  // Interpolation in One Dimension. Astronomy and Astrophysics, Vol. 239, NO.
  // NOV(II), P. 443, 1990.
  function slope3(that, x2, y2) {
    var h0 = that._x1 - that._x0,
        h1 = x2 - that._x1,
        s0 = (that._y1 - that._y0) / (h0 || h1 < 0 && -0),
        s1 = (y2 - that._y1) / (h1 || h0 < 0 && -0),
        p = (s0 * h1 + s1 * h0) / (h0 + h1);
    return (sign(s0) + sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0;
  }

  // Calculate a one-sided slope.
  function slope2(that, t) {
    var h = that._x1 - that._x0;
    return h ? (3 * (that._y1 - that._y0) / h - t) / 2 : t;
  }

  // According to https://en.wikipedia.org/wiki/Cubic_Hermite_spline#Representations
  // "you can express cubic Hermite interpolation in terms of cubic Bézier curves
  // with respect to the four values p0, p0 + m0 / 3, p1 - m1 / 3, p1".
  function point$1(that, t0, t1) {
    var x0 = that._x0,
        y0 = that._y0,
        x1 = that._x1,
        y1 = that._y1,
        dx = (x1 - x0) / 3;
    that._context.bezierCurveTo(x0 + dx, y0 + dx * t0, x1 - dx, y1 - dx * t1, x1, y1);
  }

  function MonotoneX(context) {
    this._context = context;
  }

  MonotoneX.prototype = {
    areaStart: function() {
      this._line = 0;
    },
    areaEnd: function() {
      this._line = NaN;
    },
    lineStart: function() {
      this._x0 = this._x1 =
      this._y0 = this._y1 =
      this._t0 = NaN;
      this._point = 0;
    },
    lineEnd: function() {
      switch (this._point) {
        case 2: this._context.lineTo(this._x1, this._y1); break;
        case 3: point$1(this, this._t0, slope2(this, this._t0)); break;
      }
      if (this._line || (this._line !== 0 && this._point === 1)) this._context.closePath();
      this._line = 1 - this._line;
    },
    point: function(x, y) {
      var t1 = NaN;

      x = +x, y = +y;
      if (x === this._x1 && y === this._y1) return; // Ignore coincident points.
      switch (this._point) {
        case 0: this._point = 1; this._line ? this._context.lineTo(x, y) : this._context.moveTo(x, y); break;
        case 1: this._point = 2; break;
        case 2: this._point = 3; point$1(this, slope2(this, t1 = slope3(this, x, y)), t1); break;
        default: point$1(this, this._t0, t1 = slope3(this, x, y)); break;
      }

      this._x0 = this._x1, this._x1 = x;
      this._y0 = this._y1, this._y1 = y;
      this._t0 = t1;
    }
  };

  function MonotoneY(context) {
    this._context = new ReflectContext(context);
  }

  (MonotoneY.prototype = Object.create(MonotoneX.prototype)).point = function(x, y) {
    MonotoneX.prototype.point.call(this, y, x);
  };

  function ReflectContext(context) {
    this._context = context;
  }

  ReflectContext.prototype = {
    moveTo: function(x, y) { this._context.moveTo(y, x); },
    closePath: function() { this._context.closePath(); },
    lineTo: function(x, y) { this._context.lineTo(y, x); },
    bezierCurveTo: function(x1, y1, x2, y2, x, y) { this._context.bezierCurveTo(y1, x1, y2, x2, y, x); }
  };

  // Cutoff for displaying a few values
  var A_FEW = 3;

  // Cutoff for values being considered similar (fraction of the smaller)
  var SIMILAR_FRACTION = 0.1;

  // Default number of stops for creating CSS gradient backgrounds
  var DEFAULT_GRADIENT_STOPS = 24;

  // Our initial guess for font size
  var FONT_SIZE_GUESS = 22;

  // Max tries to guess appropriate font size
  var MAX_FONT_SIZE_GUESSES = 100;

  // Tolerance for font sizing (in fractions of target size)
  var FONT_SIZE_TOLERANCE = 0.02;

  // Out-of-DOM SVG for testing font sizes
  var FONT_SIZE_ARENA;

  function get_bbox(obj) {
    var node = obj.node();
    if (node.getBoundingClientRect != undefined) {
      return node.getBoundingClientRect()
    } else if (node.getBBox != undefined) {
      return node.getBBox()
    } else {
      console.warn("Can't find bounding box of:");
      console.warn(node);
      return undefined;
    }
  }

  function get_width(obj) {
    if (obj.attr) {
      var aw = get_n_attr(obj, "width");
      if (aw) { return aw; }
    }
    return get_bbox(obj).width;
  }

  function get_height(obj) {
    if (obj.attr) {
      var ah = get_n_attr(obj, "height");
      if (ah) { return ah; }
    }
    return get_bbox(obj).height;
  }

  function get_n_attr(obj, attr) {
    return Number.parseFloat(obj.attr(attr));
  }

  function get_selected_value(select) {
    return select.options[select.selectedIndex].value;
  }

  function get_text_value(text_input) {
    return text_input.value;
  }

  function average_vectors(vector_list, weights) {
    var result = [];
    for (var j = 0; j < vector_list[0].length; ++j) {
      var val = 0;
      var denom = 0;
      for (var i = 0; i < vector_list.length; ++i) {
        if (weights == undefined) {
          val += vector_list[i][j];
          denom += 1;
        } else {
          val += vector_list[i][j] * weights[i];
          denom += weights[i];
        }
      }
      if (denom == 0) {
        return undefined; // no items!
      }
      val /= denom;
      result.push(val);
    }
    return result;
  }

  // Test for deep equality (through arrays and objects)
  function is_equal(a, b) {
    if (Array.isArray(a)) {
      if (Array.isArray(b)) {
        if (a.length != b.length) {
          return false;
        }
        for (var i = 0; i < a.length; ++i) {
          if (!is_equal(a[i], b[i])) {
            return false;
          }
        }
        return true;
      } else {
        return false;
      }
    } else if (typeof a === "object") {
      if (typeof b === "object") {
        // keys & values match:
        for (var k in a) {
          if (a.hasOwnProperty(k)) {
            if (!b.hasOwnProperty(k)) {
              return false;
            }
            if (!is_equal(a[k], b[k])) {
              return false;
            }
          }
        }
        // extra keys in b?
        for (var k in b) {
          if (b.hasOwnProperty(k)) {
            if (!a.hasOwnProperty(k)) {
              return false;
            }
          }
        }
        return true;
      } else {
        return false;
      }
    } else {
      return a === b;
    }
  }

  // Returns a CSS background property gradient value for the given color
  // interpolation function (or color array). n_stops is optional and defaults
  // to DEFAULT_GRADIENT_STOPS.
  //
  // If the function/array value is given as undefined, just returns black, and
  // if given as a string, just returns that string.
  function css_gradient(direction, fcn_or_array, n_stops) {
    if (n_stops == undefined) {
      n_stops = DEFAULT_GRADIENT_STOPS;
    }
    var colors;
    if (fcn_or_array === undefined) {
      return "black";
    } else if (typeof fcn_or_array === "string") {
      return fcn_or_array;
    } else if (Array.isArray(fcn_or_array)) { // an array
      colors = fcn_or_array;
    } else { // must be an interpolation function
      colors = [];
      for (var i = 0; i <= n_stops; ++i) {
        colors.push(fcn_or_array(i/n_stops));
      }
    }
    var val = "linear-gradient(" + direction + ",";
    for (var i = 0; i < colors.length; ++i) {
      val += colors[i];
      if (i < colors.length - 1) {
        val += ",";
      }
    }
    val += ")";
    return val;
  }

  // Returns a CSS background property gradient value for the given color list,
  // which uses hard stops to create a sequence of colors blocks with hard
  // edges instead of an actual gradient. n_stops is optional and defaults to
  // DEFAULT_GRADIENT_STOPS.
  //
  // If the function/array value is given as undefined, just returns black, and
  // if given as a string, just returns that string.
  function css_scheme(direction, fcn_or_array, n_stops) {
    if (n_stops == undefined) {
      n_stops = DEFAULT_GRADIENT_STOPS;
    }
    var colors;
    if (fcn_or_array === undefined) {
      return "black";
    } else if (typeof fcn_or_array === "string") {
      return fcn_or_array;
    } else if (Array.isArray(fcn_or_array)) {
      colors = fcn_or_array;
    } else { // must be an interpolation function
      colors = [];
      for (var i = 0; i <= n_stops; ++i) {
        colors.push(fcn_or_array(i/n_stops));
      }
    }
    var val = "linear-gradient(" + direction + ",";
    var pct = 100 / colors.length;
    for (var i = 0; i < colors.length; ++i) {
      if (i > 0) {
        val += colors[i] + " " + (pct * i) + "%,";
      }
      val += colors[i] + " " + (pct * (i + 1)) + "%";
      if (i < colors.length - 1) {
        val += ",";
      }
    }
    val += ")";
    return val;
  }

  function get_text_size(string, font_size) {
    // Determines the bounding box of the given string in the given font size
    // (in pixels).
    if (FONT_SIZE_ARENA == undefined) {
      FONT_SIZE_ARENA = select("body")
        .append("svg")
        .attr("opacity", 0)
        .attr("width", 0)
        .attr("height", 0);
    }
    var t = FONT_SIZE_ARENA.append("text")
      .text(string)
      .attr("font-size", font_size + "px");

    var result = t.node().getBBox();
    //var result = t.node().getBoundingClientRect();
    /*
    var result = {
      "height": font_size,
      "width": t.node().getComputedTextLength()
    }
    */

    t.remove();

    return result;
  }

  var SIZE_MODELS = [];
  var TEXT_PROTO_SHORT = "Yj";
  var TEXT_PROTO_MEDIUM = "Mij1ƒAnligy0";
  var TEXT_PROTO_LONG = "Multilingual Internationalization";
  var SIZES = [4, 8, 12, 18, 36];

  function get_approx_text_size(string, font_size) {
    // Faster approximate text sizing. Tends to overestimate both width and
    // height a bit (especially height if the input text has no descenders).
    // It can however also underestimate, usually when the text contains many
    // wide characters (or a really tall one, for height).
    if (SIZE_MODELS.length == 0) {
      var models_short = [];
      var models_medium = [];
      var models_long = [];
      for (let size of SIZES) {
        models_short.push(get_text_size(TEXT_PROTO_SHORT, size));
        models_medium.push(get_text_size(TEXT_PROTO_MEDIUM, size));
        models_long.push(get_text_size(TEXT_PROTO_LONG, size));
      }
      SIZE_MODELS.push(models_short);
      SIZE_MODELS.push(models_medium);
      SIZE_MODELS.push(models_long);
    }

    // figure out string length anchors
    var slr = string.length / TEXT_PROTO_SHORT.length;
    var mlr = string.length / TEXT_PROTO_MEDIUM.length;
    var llr = string.length / TEXT_PROTO_LONG.length;
    if (slr <= 1) {
      var lower = SIZE_MODELS[0];
      var upper = undefined;
      var interp = slr;
    } else if (mlr <= 1) {
      var lower = SIZE_MODELS[0];
      var upper = SIZE_MODELS[1];
      var interp = (
        (string.length - TEXT_PROTO_SHORT.length)
      / (TEXT_PROTO_MEDIUM.length - TEXT_PROTO_SHORT.length)
      );
    } else if (llr <= 1) {
      var lower = SIZE_MODELS[1];
      var upper = SIZE_MODELS[2];
      var interp = (
        (string.length - TEXT_PROTO_MEDIUM.length)
      / (TEXT_PROTO_LONG.length - TEXT_PROTO_MEDIUM.length)
      );
    } else {
      var lower = SIZE_MODELS[2];
      var upper = undefined;
      var interp = llr;
    }

    // figure out font-size anchors
    if (font_size < 4) {
      var t = font_size/4;
      var left = 0;
      var right = undefined;
    } else if (font_size < 8) {
      var t = (font_size - 4)/4;
      var left = 0;
      var right = 1;
    } else if (font_size < 12) {
      var t = (font_size - 8)/4;
      var left = 1;
      var right = 2;
    } else if (font_size < 18) {
      var t = (font_size - 12)/6;
      var left = 2;
      var right = 3;
    } else if (font_size < 36) {
      var t = (font_size - 18)/18;
      var left = 3;
      var right = 4;
    } else {
      var t = font_size/36;
      var left = 4;
      var right = undefined;
    }

    // figure out what to return via double interpolation:
    if (upper == undefined) {
      if (right == undefined) {
        return {
          "width": interp * t * lower[left].width,
          "height": t * lower[left].height
        };
      } else {
        return {
          "width": interp*((1-t) * lower[left].width + t * lower[right].width),
          "height": ((1-t) * lower[left].height + t * lower[right].height)
        };
      }
    } else {
      if (right == undefined) {
        var lit = t * lower[left].width;
        var uit = t * upper[left].width;
        return {
          "width": (1-interp) * lit + interp * uit,
          "height": t * lower[left].height
        };
      } else {
        var lit = ((1-t) * lower[left].width + t * lower[right].width);
        var uit = ((1-t) * upper[left].width + t * upper[right].width);
        return {
          "width": (1-interp) * lit + interp * uit,
          "height": ((1-t) * lower[left].height + t * lower[right].height)
        };
      }
    }
  }

  function font_size_for(bbox, string, margin) {
    // Determines the largest font size such that the given text can fit into
    // the given bounding box with the given margin (in percent; default is 2%).
    if (margin == undefined) {
      margin = 0.02;
    }
    var mx_w = bbox.width * (1 - margin/100);
    var mx_h = bbox.height * (1 - margin/100);

    var guess = undefined;
    var next_guess = FONT_SIZE_GUESS;
    var guess_size = undefined;
    var i = 0;
    while (true) {
      i += 1;
      if (i > MAX_FONT_SIZE_GUESSES) {
        break;
      }
      // check our next guess
      guess = next_guess;
      guess_size = get_approx_text_size(string, guess);

      // compute error in fractional terms
      err_w = mx_w / guess_size.width;
      err_h = mx_h / guess_size.height;
      // bit of overcorrection to avoid too smooth an approach from above
      if (err_w < 1 && err_w > 1 - FONT_SIZE_TOLERANCE) {
        err_w -= FONT_SIZE_TOLERANCE/2;
      }
      if (err_h < 1 && err_h > 1 - FONT_SIZE_TOLERANCE) {
        err_h -= FONT_SIZE_TOLERANCE/2;
      }
      // next guess
      next_guess = Math.min(err_w * guess, err_h * guess);
      // check if we've converged
      if (err_w > 1 && err_h > 1) { // possibly acceptable
        if (err_w - 1 < FONT_SIZE_TOLERANCE || err_h - 1 < FONT_SIZE_TOLERANCE){
          // good enough
          break;
        }
      }
    }
    return guess;
  }

  // https://stackoverflow.com/questions/3446170/escape-string-for-use-in-javascript-regex
  function escape_regex(str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
  }

  function text_match_indices(options, fragment) {
    var results = [];
    var fre = new RegExp(escape_regex(("" + fragment).toLowerCase()));
    for (let i = 0; i < options.length; ++i) {
      var test_against = options[i].toLowerCase();
      if (fre.exec(test_against) != null) {
        results.push(i);
      }
    }
    return results;
  }

  function dominance_summary(frequencies) {
    let pairs = [];
    Object.keys(frequencies).forEach(function (k) {
      pairs.push([k, frequencies[k]]);
    });
    if (pairs.length <= A_FEW) {
      return pairs.map(p => p[0] + '×' + p[1]).join('/');
    }
    pairs.sort((a, b) => a[1] - b[1]);
    var cutoff;
    for (cutoff = 0; cutoff < pairs.length - 1; ++cutoff) {
      if (pairs[cutoff][1] >= 2*pairs[cutoff+1][1]) {
        // > 2x the next item: we dominate
        break;
      } else if (
        pairs[cutoff][1] > (1 + SIMILAR_FRACTION) * pairs[cutoff+1][1]
      ) {
        // too large to be similar to the next item, but we don't dominate
        cutoff = undefined;
        break;
      } // else we're similar; continue
    }
    if (cutoff < A_FEW) { // undefined won't be
      dominant = pairs.slice(0, cutoff+1);
      return dominant.map(p => p[0] + '×' + p[1]).join('/') + ' *';
    }
    return '*'; // no way to define dominant values
  }

  /*
   * Helper functions
   */

  // Number formatter with variable precision based on number magnitude. The
  // optional nan_subst argument will be returned for NaN arguments (the
  // default is the string "NaN").
  function format_number(n, nan_subst) {
    if (Number.isInteger(n)) {
      if (n < 100000) {
        return n;
      } else {
        return n.toPrecision(4);
      }
    } else if (Number.isFinite(n)) {
      if (n < 1000) {
        return n.toPrecision(4);
      } else if (n < 10000) {
        return n.toPrecision(5);
      } else if (n < 100000) {
        return n.toPrecision(6);
      } else {
        return n.toPrecision(3);
      }
    } else {
      return nan_subst || "NaN";
    }
  }

  // Given a dimensions list and a flat index, rolls the index up into an array
  // of indices.
  function rollup_index(dimensions, flat_idx) {
    var seq_idx = [];
    for (let i = dimensions.length - 1; i >= 0; --i) {
      var dim = dimensions[i];
      seq_idx.push(flat_idx % dim);
      flat_idx = Math.floor(flat_idx / dim);
    }
    return seq_idx.reverse();
  }

  // Takes an Array of type objects, and returns a type object for a tensor
  // with those subtypes.
  function array_type(subtypes) {
    let dimension = subtypes.length;
    var joint_subtype = { "kind": "undefined" };
    if (subtypes.length > 0) {
      joint_subtype = subtypes[0];
    }
    for (var i = 1; i < dimension; ++i) {
      joint_subtype = combined_type(joint_subtype, subtypes[i]);
    }

    // merge tensor subtype dimensions to flatten tensor types:
    if (joint_subtype.kind === "tensor") {
      return {
        "kind": "tensor",
        "value_type": joint_subtype.value_type,
        "subtypes": subtypes,
        "dimensions": [dimension].concat(joint_subtype.dimensions)
      }
    } else { // or just return 1D tensor:
      return {
        "kind": "tensor",
        "value_type": joint_subtype,
        "subtypes": subtypes,
        "dimensions": [ dimension ],
      };
    }
  }

  // Decides the type of a field given an example value. Types are objects with
  // the following keys:
  //
  //   kind
  //     The basic kind of value. The possible kinds are:
  //
  //       unknown
  //       undefined
  //       null
  //       number
  //       string
  //       tensor
  //       map
  //
  //   value_type
  //     For "tensor" values, the common type for all values. May be abstract
  //     (like "unknown" if there's a mix of strings and numbers), but
  //     "subtypes" will list individual types for each item.
  //
  //   dimensions
  //     For "tensor" values, an array of dimension extents.
  //
  //   subtypes
  //     For "map" values, a map from keys to field subtypes. For "tensor
  //     values, an array of individual subtypes.
  //
  function assess_type(value) {
    if (Array.isArray(value)) {
      var dimension = value.length;
      // compute subtypes
      var subtypes = [];
      for (var i = 0; i < dimension; ++i) {
        subtypes.push(assess_type(value[i]));
      }
      return array_type(subtypes);
    } else if (typeof value === "object") {
      if (value === null) {
        return { "kind": "null" };
      }
      var subtypes = {};
      for (var k in value) {
        if (value.hasOwnProperty(k)) {
          subtypes[k] = assess_type(value[k]);
        }
      }
      return { "kind": "map", "subtypes": subtypes };
    } else if (typeof value === "string") {
      return { "kind": "string" };
    } else if (typeof value === "number") {
      return { "kind": "number" };
    } else if (value === undefined) {
      return { "kind": "undefined" };
    } else { // an unknown type
      return { "kind": "unknown" };
    }
  }

  // Computes a combined type for two types ot (original type) and nt (new
  // type). The combined type can hold values from either subtype.
  function combined_type(ot, nt) {
    if (is_equal(ot, nt)) {
      return ot;
    } else {
      if (ot.kind === "undefined") { // beats nothing
        return nt;
      } else if (ot.kind === "unknown") { // beats everything
        return ot;
      } else if (ot.kind === "null") { // beats only 'undefined'
        if (nt.kind === "undefined") {
          return ot;
        } else {
          return nt;
        }
      } else if (ot.kind === "number") {
        if (
          nt.kind === "undefined"
       || nt.kind === "null"
       || nt.kind === "number") {
          // missing/compatible value(s)
          return ot;
        } else { // can't combine
          return { "kind": "unknown" };
        }
      } else if (ot.kind === "string") {
        if (
          nt.kind === "undefined"
       || nt.kind === "null"
       || nt.kind === "string"
        ) { // subsume (or compatible)
          return ot;
        } else { // can't combine
          return { "kind": "unknown" };
        }
      } else if (ot.kind === "map") {
        if (nt.kind === "undefined" || nt.kind === "null") {
          return ot;
        } else if (nt.kind === "map") { // combine subtypes!
          var subtypes = ot.subtypes;
          var nst = nt.subtypes;
          var cst = {};
          for (var k in subtypes) {
            if (subtypes.hasOwnProperty(k)) {
              if (nst.hasOwnProperty(k)) {
                cst[k] = combined_type(subtypes[k], nst[k]);
              } else {
                cst[k] = subtypes[k];
              }
            }
          }
          for (var k in nst) {
            if (nst.hasOwnProperty(k) && !subtypes.hasOwnProperty(k)) {
              cst[k] = nst[k];
            }
          }
          return { "kind": "map", "subtypes": cst };
        } else {
          return { "kind": "unknown" };
        }
      } else if (ot.kind === "tensor") {
        if (nt.kind === "undefined" || nt.kind === "null") {
          return ot;
        } else {
          if (is_equal(ot.dimensions, nt.dimensions)) {
            cst = [];
            for (let i = 0; i < ot.subtypes.length; ++i) {
              // (we know length is equal because dimensions are equal)
              // TODO: Worry about non-square tensors?
              cst.push(combined_type(ot.subtypes[i], nt.subtypes[i]));
            }
            return {
              "kind": "tensor",
              "dimensions": ot.dimensions,
              "value_type": combined_type(ot.value_type, nt.value_type),
              "subtypes": cst,
            };
          } else {
            // TODO: Tensors of different dimensions subsuming each other?
            return { "kind": "unknown" };
          }
        }
      } else { // um... !?!
        console.warn("Unknown type during combination: '" + ot + "'");
        return { "kind": "unknown" };
      }
    }
  }

  // Uses an index (of the kind returned by property_indices) to retrieve a
  // value from a record. Also requires a field mapping (see fmap, above).
  function get_value(fmap, record, index) {
    if (index === undefined) {
      return undefined;
    }
    var idx = fmap[index[0]];
    if (idx === undefined) {
      return undefined; // invalid field!
    }
    var val = record[idx];
    for (var i = 1; i < index.length; ++i) {
      try {
        val = val[index[i]];
      } catch (error) {
        return undefined;
      }
    }
    return val;
  }

  // Puts a value into a record. Doesn't do any type checking or domain updates
  // (see the dataset module for that). Throws an error on failure.
  function put_value(fmap, types, record, index, value) {
    if (index === undefined) {
      throw "Index undefined.";
    }
    var idx = fmap[index[0]];
    if (idx === undefined) {
      throw "Invalid field.";
    }

    if (index.length == 1) {
      record[idx] = value;
      return;
    }

    var here = record[idx];
    if (here == undefined) {
      var typ = get_type(types, [ index[0] ]);
      if (typ.kind === "tensor") {
        var fresh = [];
        record[idx] = fresh;
        here = fresh;
      } else if (typ.kind === "map") {
        var fresh = {};
        record[idx] = fresh;
        here = fresh;
      } else { // can't construct a non-container
        console.error(typ);
        throw (
          "Unconstructable missing intermediate type: " + index[0] + "→" + typ
        );
      }
    }
    for (var i = 1; i < index.length - 1; ++i) {
      var next = here[index[i]];
      if (next == undefined) {
        var typ = get_type(types, index.slice(0, i));
        if (typ.kind === "tensor") {
          var fresh = [];
          here[index[i]] = fresh;
          here = fresh;
        } else if (typ.kind === "map") {
          var fresh = {};
          here[index[i]] = fresh;
          here = fresh;
        } else { // can't construct a non-container
          console.error(typ);
          throw (
            "Unconstructable missing intermediate type: "
          + index.slice(0, i) + "→" + typ
          );
        }
      } else {
        here = next;
      }
    }
    here[index[index.length - 1]] = value;
  }

  // Retrieves the type of the item at the given index from a types map.
  function get_type(types, index) {
    if (index == undefined) {
      return { "kind": "unknown" };
    }
    var result = types[index[0]];
    for (var i = 1; i < index.length; ++i) {
      try {
        result = result.subtypes[index[i]];
      } catch (error) {
        return { "kind": "unknown" };
      }
    }
    return result;
  }

  // Retrieves the domain of the item at the given index from a domains map.
  function get_domain(domains, index) {
    if (index == undefined) {
      return undefined;
    }
    var key = index__string(index);
    return domains[key];
  }

  // Converts an index into a human-readable string.
  function index__string(index) {
    if (index == undefined) {
      return "undefined";
    }
    var result = "";
    for (var i = 0; i < index.length; ++i) {
      var idx = index[i];
      if (typeof idx === "string") {
        result += "." + idx;
      } else { // number
        result += ":" + idx;
      }
    }
    return result;
  }

  // Returns an array of all possible indexes for the given type. Each index is
  // a tuple of keys to be applied to a data item to get a value out. The given
  // name is used as the initial index in this array.
  function property_indices(name, type) {
    var options = [ [ name ] ];
    if (type.kind === "map") {
      var subtypes = type.subtypes;
      for (var k in subtypes) {
        if (subtypes.hasOwnProperty(k)) {
          var sub_indices = property_indices(k, subtypes[k]);
          for (var j = 0; j < sub_indices.length; ++j) {
            var si = sub_indices[j];
            options.push([ name ].concat(si));
          }
        }
      }
    } else if (type.kind === "tensor") {
      for (let i = 0; i < type.subtypes.length; ++i) {
        var sub_indices = property_indices("ignored", type.subtypes[i]);
        for (let j = 0; j < sub_indices.length; ++j) {
          var si = sub_indices[j];
          options.push([name, i].concat(si.slice(1, si.length)));
        }
      }
    } // otherwise we're already done
    return options;
  }

  // Returns an array containing all indices exactly one-step below the given
  // index (which should have the given type).
  function sub_indices(index, type) {
    options = [];
    if (type.kind == "tensor") {
      for (let i = 0; i < type.dimensions[0]; ++i) {
        options.push(index.concat([i]));
      }
    } else if (type.kind == "map") {
      for (let k of Object.keys(type.subtypes)) {
        options.push(index.concat([k]));
      }
    }
    return options;
  }

  // Default precision for vector representations:
  var DEFAULT_REPR_PRECISION = 3;

  // Returns the total dimension of a tensor
  function tensor_total_dimension(t) {
    if (!Array.isArray(t)) {
      return undefined;
    }
    let result = 1;
    while (Array.isArray(t)) {
      result *= t.length;
      t = t[0];
    }
    return result;
  }

  // Gets a value from a tensor using a flat index i, which should be between
  // zero and the total dimension of the tensor minus one.
  function get_flat(t, i) {
    if (!Array.isArray(t)) {
      return undefined;
    }
    if (Array.isArray(t[0])) {
      let subdim = tensor_total_dimension(t[0]);
      let idx = Math.floor(t / subdim);
      return get_flat(t[idx], i % subdim);
    } else {
      return t[i];
    }
  }

  // Returns a flattened version of the given tensor.
  function flatten(t) {
    let td = tensor_total_dimension(t);
    let result = [];
    for (let i = 0; i < td; ++i) {
      result.push(get_flat(t, i));
    }
    return result;
  }

  function add_into(a, b) {
    for (let i = 0; i < a.length; ++i) {
      a[i] += b[i];
    }
  }

  function sub(a, b) { // a - b
    var result = [];
    for (let i = 0; i < a.length; ++i) {
      result.push(a[i] - b[i]);
    }
    return result;
  }

  function scale_by(a, S) {
    for (let i = 0; i < a.length; ++i) {
      a[i] *= S;
    }
  }

  function dot(a, b) {
    var result = 0;
    for (let i = 0; i < a.length; ++i) {
      result += a[i] * b[i];
    }
    return result;
  }

  function mag(a) {
    var result = 0;
    for (let i = 0; i < a.length; ++i) {
      let x = a[i];
      result += x*x;
    }
    return Math.sqrt(result);
  }

  function pmag(a, b) { // magnitude of the projection of a onto b
    let mb = mag(b);
    if (mb == 0) {
      return 0;
    } else {
      return dot(a, b)/mb; // scalar projection
    }
  }

  function ldist(a, b) { // distance from point a to line b
    let mb = mag(b);
    if (mb == 0) { // distance to point
      return mag(sub(a, b));
    }
    let ma = mag(a);
    let sc = dot(a, b)/mb; // scalar projection
    return Math.sqrt(ma*ma - sc*sc);
  }

  function softnorm(a) { // scales so that the longest component is 1
    var max = undefined;
    for (let i = 0; i < a.length; ++i) {
      var val = Math.abs(a[i]);
      if (max === undefined || val > max) {
        max = val;
      }
    }
    if (max == 0) {
      return a.slice();
    }
    result = [];
    for (let i = 0; i < a.length; ++i) {
      result[i] = a[i] / max;
    }
    return result;
  }

  function repr(t, precision) {
    if (precision == undefined) {
      precision = DEFAULT_REPR_PRECISION;
    }
    if (Array.isArray(t)) {
      return '[' + t.map(x => repr(x, precision)).join(", ") + ']';
    } else {
      if (t.toPrecision) {
        return t.toPrecision(precision);
      } else {
        return "" + t;
      }
    }
  }

  /*
   * Module variables
   */

  var DEFAULT_OUTLIER_ALLOWANCE = 3;

  /*
   * Dataset functions
   */

  // Gets the name of a field, using an alias if it has one.
  function get_name(dataset, index) {
    var base = index__string(index);
    if (dataset.aliases.hasOwnProperty(base)) {
      return dataset.aliases[base];
    } else {
      return base;
    }
  }

  // Gets the name of a field, using an alias if it has one. For nested fields,
  // just uses the last part of the name, or the last several parts if the last
  // parts of the index are numerical.
  function get_short_name(dataset, index) {
    var base = index__string(index);
    if (dataset.aliases.hasOwnProperty(base)) {
      return dataset.aliases[base];
    } else {
      var shrt = [];
      for (let i = index.length - 1; i >= 0; --i) {
        shrt.push(index[i]);
        if (Number.isNaN(+index[i])) {
          break;
        }
      }
      return index__string(shrt.reverse());
    }
  }

  // Gets the name of a subfield inner of superfield outer, using an alias if
  // available, but otherwise discarding the name of the superfield.
  function get_inner_name(dataset, outer, inner) {
    var combined = outer.concat(inner);
    var cstr = index__string(combined);
    if (dataset.aliases.hasOwnProperty(cstr)) {
      return dataset.aliases[cstr];
    } else {
      return index__string(inner);
    }
  }

  // Gets a canonical name for an index that's been modified so that it can be
  // used as part of the name for another index.
  function get_name_substitute(dataset, index) {
    let name = get_name(dataset, index);
    if (name[0] == '.' || name[0] == ':') {
      name = name.slice(1);
    }
    return name.replace(/[.:]/g, "→");
  }

  function get_field(dataset, record, index) {
    return get_value(dataset.fmap, record, index);
  }

  // Fuses values from a multiple records at a single index into a single
  // value, according to the type of index used. Numeric fields return the mean
  // among the given records, while string fields return a frequency map from
  // values to counts. Tensor and map fields recursively fuse their individual
  // indices/keys.
  function fuse_values(dataset, records, index) {
    let typ = get_type$1(dataset, index);
    if (typ.kind == "number") { // compute mean
      let values = records.map(r => get_field(dataset, r, index));
      return values.reduce((a, b) => a + b, 0) / records.length;
      // this might be NaN, but that's okay

    } else if (typ.kind == "string") { // compute count-map
      let vmap = {};
      records.forEach(function (r) {
        let val = "" + get_field(dataset, r, index);
        if (vmap.hasOwnProperty(val)) {
          vmap[val] += 1;
        } else {
          vmap[val] = 1;
        }
      });
      return vmap;

    } else if (typ.kind == "tensor") { // recurse
      let fused = [];
      let si = sub_indices(index, typ);
      for (let i = 0; i < si.length; ++i) {
        fused.push(fuse_values(dataset, records, si[i]));
      }
      return fused;

    } else if (typ.kind == "map") { // recurse
      let fused = {};
      let si = sub_indices(index, typ);
      for (let i = 0; i < si.length; ++i) {
        let sub = si[i];
        let k = sub.slice(sub.length - 1)[0];
        fused[k] = fuse_values(dataset, records, sub);
      }
      return fused;
    }
  }

  // Returns the type value for a fusion of values from the given index. Note
  // that this may have to scan the entire dataset to determine possible keys
  // for fused string indices.
  function fused_type(dataset, index) {
    let typ = get_type$1(dataset, index);
    if (typ == undefined) {
      console.warn("Unknown index '" + index + "' in fused_type.");
      return { "kind": "undefined" };
    } else if (typ.kind == "number") {
      return { "kind": "number" };
    } else if (typ.kind == "string") {
      let keys = new Set();
      dataset.records.forEach(function (r) {
        keys.add(get_field(dataset, r, index));
      });
      let subtypes = {};
      keys.forEach(function (key) {
        subtypes[key] = { "kind": "number" };
      });
      return {
        "kind": "map",
        "subtypes": subtypes
      }
    } else if (typ.kind == "tensor") {
      let fused = [];
      let vt = { "kind": "undefined" };
      let si = sub_indices(index, typ);
      for (let i = 0; i < si.length; ++i) {
        ft = fused_type(dataset, si[i]);
        fused.push(ft);
        if (ft.kind == "tensor") {
          vt = combined_type(vt, ft.value_type);
        } else {
          vt = combined_type(vt, ft);
        }
      }
      return {
        "kind": "tensor",
        "dimensions": typ.dimensions,
        "value_type": vt,
        "subtypes": fused
      };
    } else if (typ.kind == "map") {
      let fused = {};
      let si = sub_indices(index, typ);
      for (let i = 0; i < si.length; ++i) {
        let sub = si[i];
        let k = sub.slice(sub.length - 1)[0];
        fused[k] = fused_type(dataset, sub);
      }
      return {
        "kind": "map",
        "subtypes": fused
      };
    } else {
      console.warn("Unexpected fusion target type for field '" + index + "'.");
      console.warn(typ);
      return { "kind": "undefined" };
    }
  }

  // Updates the domain(s) under the given index which has gained the given new
  // value.
  function update_domain(dataset, index, value) {
    var typ = get_type$1(dataset, index);
    if (typ.kind === "number") {
      var si = index__string(index);
      var old_dom = get_domain$1(dataset, index);
      if (value < old_dom[0]) {
        dataset.domains[si] = [ value, old_dom[1] ];
      } else if (value > old_dom[1]) {
        dataset.domains[si] = [old_dom[0], value ];
      }
    } else if (typ.kind === "string") {
      var si = index__string(index);
      var old_dom = get_domain$1(dataset, index);
      var old_count = old_dom[old_val];
      if (old_count == 1) {
        delete dataset.domains[si][old_val];
      } else {
        dataset.domains[si][old_val] -= 1;
      }
      if (old_dom.hasOwnProperty(value)) {
        old_dom[value] += 1;
      } else {
        old_dom[value] = 1;
      }
    } else if (typ.kind === "tensor") {
      for (let i = 0; i < typ.dimensions[0]; ++i) {
        var ni = index.concat([i]);
        update_domain(dataset, ni, value[i]);
      }
    } else if (typ.kind === "map") {
      var old_dom = get_domain$1(dataset, index);
      for (let k in old_dom) {
        if (old_dom.hasOwnProperty(k)) {
          var ni = index.concat([k]);
          update_domain(dataset, ni, value[k]);
        }
      }
    } // else no domain to worry about
  }

  // Throws an error on failure (e.g., type mismatch).
  function set_field(dataset, record, index, value) {
    var old_val = get_field(dataset, record, index);
    var old_typ = get_type$1(dataset, index);
    var new_typ = assess_type(value);
    var comb_typ = combined_type(old_typ, new_typ);
    if (!is_equal(old_typ, comb_typ)) {
      console.warn([old_typ, new_typ, comb_typ]);
      console.warn([dataset, record, index, value]);
      throw "Type mismsatch while assigning to field.";
    }

    // put in the value
    put_value(dataset.fmap, dataset.types, record, index, value);

    // update domain if necessary
    update_domain(dataset, index, value);
  }

  function has_field(dataset, index) {
    return dataset.imap.hasOwnProperty(index__string(index));
  }

  // Adds a new field (or subfield, if "parent_index" isn't undefined) to the
  // dataset. Note that initial domains for the type will be set to [0, 0] or
  // empty as appropriate.
  function add_field(dataset, parent_index, name, type) {
    if (parent_index === undefined) {
      dataset.fields.push(name);
      dataset.fmap[name] = dataset.fields.length - 1;
      dataset.types[name] = type;
      var pis = property_indices(name, type);
      for (let i = 0; i < pis.length; ++i) {
        var pi = pis[i];
        var str_idx = index__string(pi);
        var sub_typ = get_type$1(dataset, pi);

        // fix the indices and index map:
        dataset.imap[str_idx] = pi;
        dataset.indices.push(pi);

        // add an empty domain:
        if (sub_typ.kind === "number") {
          dataset.domains[str_idx] = [ 0, 0 ];
        } else if (sub_typ.kind === "string") {
          dataset.domains[str_idx] = {};
        }
      }
    } else {
      var pt = get_type$1(dataset, parent_index);
      if (pt.kind != "map") {
        console.error("Can't add a subfield to a non-map field!");
        return;
      }
      pt.subtypes[name] = type;
      var pis = property_indices(name, type);
      for (let i = 0; i < pis.length; ++i) {
        var pi = pis[i];
        var sub_idx = parent_index.concat(pi);
        var str_idx = index__string(sub_idx);
        var sub_typ = get_type$1(dataset, sub_idx);

        // fix the indices and index map:
        dataset.imap[str_idx] = sub_idx;
        dataset.indices.push(sub_idx);

        // add an empty domain:
        if (sub_typ.kind === "number") {
          dataset.domains[str_idx] = [ 0, 0 ];
        } else if (sub_typ.kind === "string") {
          dataset.domains[str_idx] = {};
        }
      }
    }
  }

  function get_type$1(dataset, index) {
    return get_type(dataset.types, index);
  }

  function get_domain$1(dataset, index) {
    return get_domain(dataset.domains, index);
  }

  function all_indices(dataset) {
    return dataset.indices;
  }

  function lookup_index(dataset, string) {
    for (var k in dataset.aliases) {
      if (dataset.aliases.hasOwnProperty(k) && dataset.aliases[k] == string) {
        return dataset.imap[k];
      }
    }
    return dataset.imap[string];
  }

  // Returns an array of strings naming each index, where aliased indices are
  // given only by their aliased names.
  function index_names(dataset) {
    var result = [];
    for (let i = 0; i < dataset.indices.length; ++i) {
      var idx = dataset.indices[i];
      var si = index__string(idx);
      if (dataset.aliases.hasOwnProperty(si)) {
        result.push(dataset.aliases[si]);
      } else {
        result.push(si);
      }
    }
    return result;
  }

  // Returns a type value for a pure-numeric tensor with n entries.
  function numeric_vector_type(n) {
    var result = {
      "kind": "tensor",
      "value_type": { "kind": "number" },
      "dimensions": [ n ],
      "subtypes": []
    };
    for (let i = 0; i < n; ++i) {
      result.subtypes.push({ "kind": "number" });
    }
    return result;
  }

  // Returns the nth field of the given kind (e.g., "numeric", "string", etc.).
  // If n is larger than the number of such fields, it will wrap around, but if
  // there are no such fields, it will return undefined. An array of multiple
  // kinds can be passed, in which case any of them match, and the nth field
  // across all given kinds is returned; kind can also be left undefined, in
  // which case all fields will match. Finally, kind may be a function, in
  // which case it will be called with each index should return true or false
  // to count that index or not.
  function nth_of_kind(dataset, kind, n) {
    while (n >= 0) {
      var st_n = n;
      for (let i = 0; i < dataset.indices.length; ++i) {
        var ind = dataset.indices[i];
        var typ = get_type$1(dataset, ind);
        if (
          kind == undefined
       || (
            typeof(kind) == "function"
         && kind(ind)
          )
       || (
            Array.isArray(kind)
         && kind.indexOf(typ.kind) >= 0
          )
       || typ.kind === kind
        ) {
          n -= 1;
          if (n < 0) {
            return ind;
          }
        }
      }
      if (st_n == n) {
        return undefined;
      }
    }
  }

  // Checks whether a dataset has all of the necessary keys for full
  // functionality (doesn't check values, however). Returns a list of missing
  // keys, or an empty list if none are missing.
  function missing_keys(dataset) {
    var missing = [];
    var required = [
      "types",
      "domains",
      "imap",
      "indices",
      "fmap",
      "fields",
      "records",
    ];
    for (let i = 0; i < required.length; ++i) {
      var key = required[i];
      if (!dataset.hasOwnProperty(key)) {
        missing.push(key);
      }
    }
    return missing;
  }

  // Figures out a numerical domain for the given index, and returns an object
  // with the following keys:
  //
  //   getter
  //     A function that takes a data record an returns a numerical value for
  //     the given index.
  //   domain
  //     An array of two numbers: the minimum and maximum numerical values that
  //     might be returned by the accessor.
  //
  // If the input index doesn't have a domain, the resulting getter will always
  // return 0 and the domain will be [0, 0].
  //
  // The optional undefined_as_zero parameter defaults to true, and causes
  // undefined values to map to zero instead of returning undefined.
  function numerical_transform(dataset, index, undefined_as_zero) {
    if (undefined_as_zero == undefined) {
      undefined_as_zero = true;
    }
    var dom = get_domain$1(dataset, index);
    if (dom == undefined) { // give up
      return {
        "getter": d => 0,
        "domain": [0, 0]
      };
    } else if (Array.isArray(dom)) { // numerical range
      return {
        "getter": function (d) {
          var v = get_field(dataset, d, index);
          if (v === undefined && undefined_as_zero) {
            return 0;
          } else {
            return v;
          }
        },
        "domain": dom
      };
    } else { // must be a string domain containing counts
      var values = Object.keys(dom);
      values.sort();
      var vmap = {}; 
      for (let i = 0; i < values.length; ++i) {
        vmap[values[i]] = i;
      }
      return {
        "getter": d => vmap[get_field(dataset, d, index)],
        "domain": [ 0, values.length - 1 ]
      };
    }
  }

  // Creates and returns an outlier model of the given field, which is an
  // object with the following properties:
  //
  //   mean
  //     The mean of the numerical transform of the field.
  //   sd
  //     The standard deviation of the numerical transform of the field.
  //   normalized
  //     A function that, given a record, returns a value between 0 and 1 for
  //     non-outliers, and values below 0 or above 1 for outliers.
  //
  // The model is a simple Gaussian.
  //
  // The allowance variable controls how many standard deviations are
  // considered enough for an item to be an outlier, and defaults to
  // DEFAULT_OUTLIER_ALLOWANCE.
  //
  // The count_missing variable defaults to true and controls whether missing
  // values are counted as zeros or skipped.
  //
  // Reference for incremental variance algorithm:
  //   https://en.wikipedia.org/wiki/Algorithms_for_calculating_variance#Online_algorithm
  function outlier_model(dataset, index, allowance, count_missing) {
    if (allowance == undefined) { allowance = DEFAULT_OUTLIER_ALLOWANCE; }
    if (count_missing == undefined) { count_missing = true; }
    var mean = 0;
    var m2 = 0; // aggregate squared distance from mean
    var count = 0;
    var nt = numerical_transform(dataset, index, count_missing);
    for (let i = 0; i < dataset.records.length; ++i) {
      var r = dataset.records[i];
      var val = nt.getter(r);
      if (val == undefined) {
        continue;
      }

      // incremental
      count += 1;
      var delta = val - mean;
      mean += delta / count;
      var delta2 = val - mean;
      m2 += delta * delta2;
    }
    var variance = m2 / (dataset.records.length - 1);
    var sd = Math.sqrt(variance);

    var lower = nt.domain[0];
    var upper = nt.domain[1];

    if (mean - allowance * sd > lower) {
      lower = mean - allowance * sd;
    }

    if (mean + allowance * sd < upper) {
      upper = mean + allowance * sd;
    }

    return {
      "mean": mean,
      "sd": sd,
      "normalized": function (d) {
        var val = nt.getter(d);
        return (val - lower) / (upper - lower);
      },
    }
  }

  // Returns a function that maps from records to flat vectors containing the
  // information from the given property. The return value has two properties:
  //
  //   getter
  //     Function to extract a vector value from a record.
  //
  //   dimensions
  //     Integer number of entries in each resulting vector.
  //
  // For numeric and string properties, it returns length-1 vectors containing
  // the results of numerical_transform. For tensors, it flattens the tensor
  // into a long vector, where each entry is the result of a
  // numerical_transform on the item type for that tensor. For maps, it treats
  // each value in the keys domain as an entry in the vector and transforms
  // associated values using numerical_transform. (Note that multilayer maps
  // are not flattened TODO: that?). For items of unknown type, it returns a
  // length-zero vector regardless of the data value.
  function vector_transform(dataset, index) {
    var typ = get_type$1(dataset, index);
    if (typ === undefined) {
      console.warn("Undefined type in vector_transform for index " + index);
      return {
        "getter": d => [],
        "dimensions": 0
      };
    } else if (typ.kind === "number" || typ.kind === "string") {
      var nt = numerical_transform(dataset, index);
      return {
        "getter": d => [ nt.getter(d) ],
        "dimensions": 1,
      };
    } else if (typ.kind === "tensor") {
      var dims = typ.dimensions;
      var tdim = dims.reduce((a, b) => a * b, 1);
      function conv_index(idx) {
        var result = [];
        for (let i = dims.length - 1; i >= 0; --i) {
          var d = dims[i];
          result[i] = idx % d;
          idx = Math.floor(idx / d);
        }
        return result;
      }
      var getters = [];
      for (let i = 0; i < tdim; ++i) {
        var nt = numerical_transform(dataset, index.concat(conv_index(i)));
        getters.push(nt.getter);
      }
      return {
        "getter": function (d) {
          var result = [];
          for (let i = 0; i < tdim; ++i) {
            result.push(getters[i](d));
          }
          return result;
        },
        "dimensions": tdim
      };
    } else if (typ.kind === "map") {
      var subs = typ.subtypes;
      var keys = Object.keys(subs);
      var dim = keys.length;
      var getters = [];
      for (let i = 0; i < dim; ++i) {
        var k = keys[i];
        var nt = numerical_transform(dataset, index.concat([k]));
        getters.push(nt.getter);
      }
      return {
        "getter": function (d) {
          var result = [];
          for (let i = 0; i < dim; ++i) {
            result.push(getters[i](d));
          }
          return result;
        },
        "dimensions": dim
      };
    } else {
      return {
        "getter": d => [],
        "dimensions": 0
      };
    }
  }

  // Figures out a categorical domain for the given index, and returns an object
  // with the following keys:
  //
  //   getter
  //     A function that takes a data record and a category index and returns
  //     a numeric value for the given index, or undefined if the given data
  //     record has no value for that index.
  //   n_categories
  //     The number of categories. The getter will return undefined for
  //     category index arguments not in [0, n_categories)
  //   labels
  //     An array of string labels that's n_categories items long.
  //
  // For numeric and string fields, each distinct possible value becomes a
  // category, and each record returns 1 for the category to which it belongs
  // and undefined for all other categories. For tensors, each possible
  // flattened sub-index is a category, returning the value in that entry of
  // the tensor. For maps, each key is a category, returning the value for that
  // key.
  function categorical_transform(dataset, index) {
    var typ = get_type$1(dataset, index);
    if (typ.kind == "tensor") { // TODO: recursive transforms?
      var tdim = typ.dimensions.reduce((a, b) => a * b, 1);
      var labels = [];
      for (let i = 0; i < tdim; ++i) {
        var seq_idx = rollup_index(typ.dimensions, i);
        labels.push(get_short_name(dataset, index.concat(seq_idx)));
      }
      return {
        "getter": function (d, idx) {
          var seq_idx = rollup_index(typ.dimensions, idx);
          return get_field(dataset, d, index.concat(seq_idx));
        },
        "n_categories": tdim,
        "labels": labels,
      };
    } else if (typ.kind == "map") { // TODO: recursive transforms?
      var categories = Object.keys(typ.subtypes).sort();
      var cat_indices = [];
      for (let i = 0; i < categories.length; ++i) {
        cat_indices[categories[i]] = i;
      }
      return {
        "getter": function (d, idx) {
          var cat = categories[idx];
          if (cat == undefined) {
            return undefined;
          } else {
            return get_field(dataset, d, index.concat([cat]));
          }
        },
        "n_categories": categories.length,
        "labels": categories.map(
          c => get_short_name(dataset, index.concat([c]))
        ),
      };
    } else { // number or string
      var sorter;
      var val_indices;
      if (typ.kind == "number") {
        sorter = (a, b) => a - b;
        val_indices = {};
        for (let i = 0; i < dataset.records.length; ++i) {
          val_indices[get_field(dataset, dataset.records[i], index)] = true;
        }
      } else {
        sorter = undefined;
        var dom = get_domain$1(dataset, index);
        val_indices = Object.assign({}, dom);
      }

      var skeys = Object.keys(val_indices).sort(sorter);
      for (let i = 0; i < skeys.length; ++i) {
        val_indices[skeys[i]] = i;
      }
      return {
        "getter": function (d, i) {
          if (i == val_indices[get_field(dataset, d, index)]) {
            return 1;
          } else {
            return undefined;
          }
        },
        "n_categories": skeys.length,
        "labels": skeys,
      };
    }
  }

  // https://d3js.org/d3-scale-chromatic/ v1.3.3 Copyright 2018 Mike Bostock
  (function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('d3-interpolate'), require('d3-color')) :
  typeof define === 'function' && define.amd ? define(['exports', 'd3-interpolate', 'd3-color'], factory) :
  (factory((global.d3 = global.d3 || {}),global.d3,global.d3));
  }(undefined, (function (exports,d3Interpolate,d3Color) {
  function colors(specifier) {
    var n = specifier.length / 6 | 0, colors = new Array(n), i = 0;
    while (i < n) colors[i] = "#" + specifier.slice(i * 6, ++i * 6);
    return colors;
  }

  var category10 = colors("1f77b4ff7f0e2ca02cd627289467bd8c564be377c27f7f7fbcbd2217becf");

  var Accent = colors("7fc97fbeaed4fdc086ffff99386cb0f0027fbf5b17666666");

  var Dark2 = colors("1b9e77d95f027570b3e7298a66a61ee6ab02a6761d666666");

  var Paired = colors("a6cee31f78b4b2df8a33a02cfb9a99e31a1cfdbf6fff7f00cab2d66a3d9affff99b15928");

  var Pastel1 = colors("fbb4aeb3cde3ccebc5decbe4fed9a6ffffcce5d8bdfddaecf2f2f2");

  var Pastel2 = colors("b3e2cdfdcdaccbd5e8f4cae4e6f5c9fff2aef1e2cccccccc");

  var Set1 = colors("e41a1c377eb84daf4a984ea3ff7f00ffff33a65628f781bf999999");

  var Set2 = colors("66c2a5fc8d628da0cbe78ac3a6d854ffd92fe5c494b3b3b3");

  var Set3 = colors("8dd3c7ffffb3bebadafb807280b1d3fdb462b3de69fccde5d9d9d9bc80bdccebc5ffed6f");

  function ramp(scheme) {
    return d3Interpolate.interpolateRgbBasis(scheme[scheme.length - 1]);
  }

  var scheme = new Array(3).concat(
    "d8b365f5f5f55ab4ac",
    "a6611adfc27d80cdc1018571",
    "a6611adfc27df5f5f580cdc1018571",
    "8c510ad8b365f6e8c3c7eae55ab4ac01665e",
    "8c510ad8b365f6e8c3f5f5f5c7eae55ab4ac01665e",
    "8c510abf812ddfc27df6e8c3c7eae580cdc135978f01665e",
    "8c510abf812ddfc27df6e8c3f5f5f5c7eae580cdc135978f01665e",
    "5430058c510abf812ddfc27df6e8c3c7eae580cdc135978f01665e003c30",
    "5430058c510abf812ddfc27df6e8c3f5f5f5c7eae580cdc135978f01665e003c30"
  ).map(colors);

  var BrBG = ramp(scheme);

  var scheme$1 = new Array(3).concat(
    "af8dc3f7f7f77fbf7b",
    "7b3294c2a5cfa6dba0008837",
    "7b3294c2a5cff7f7f7a6dba0008837",
    "762a83af8dc3e7d4e8d9f0d37fbf7b1b7837",
    "762a83af8dc3e7d4e8f7f7f7d9f0d37fbf7b1b7837",
    "762a839970abc2a5cfe7d4e8d9f0d3a6dba05aae611b7837",
    "762a839970abc2a5cfe7d4e8f7f7f7d9f0d3a6dba05aae611b7837",
    "40004b762a839970abc2a5cfe7d4e8d9f0d3a6dba05aae611b783700441b",
    "40004b762a839970abc2a5cfe7d4e8f7f7f7d9f0d3a6dba05aae611b783700441b"
  ).map(colors);

  var PRGn = ramp(scheme$1);

  var scheme$2 = new Array(3).concat(
    "e9a3c9f7f7f7a1d76a",
    "d01c8bf1b6dab8e1864dac26",
    "d01c8bf1b6daf7f7f7b8e1864dac26",
    "c51b7de9a3c9fde0efe6f5d0a1d76a4d9221",
    "c51b7de9a3c9fde0eff7f7f7e6f5d0a1d76a4d9221",
    "c51b7dde77aef1b6dafde0efe6f5d0b8e1867fbc414d9221",
    "c51b7dde77aef1b6dafde0eff7f7f7e6f5d0b8e1867fbc414d9221",
    "8e0152c51b7dde77aef1b6dafde0efe6f5d0b8e1867fbc414d9221276419",
    "8e0152c51b7dde77aef1b6dafde0eff7f7f7e6f5d0b8e1867fbc414d9221276419"
  ).map(colors);

  var PiYG = ramp(scheme$2);

  var scheme$3 = new Array(3).concat(
    "998ec3f7f7f7f1a340",
    "5e3c99b2abd2fdb863e66101",
    "5e3c99b2abd2f7f7f7fdb863e66101",
    "542788998ec3d8daebfee0b6f1a340b35806",
    "542788998ec3d8daebf7f7f7fee0b6f1a340b35806",
    "5427888073acb2abd2d8daebfee0b6fdb863e08214b35806",
    "5427888073acb2abd2d8daebf7f7f7fee0b6fdb863e08214b35806",
    "2d004b5427888073acb2abd2d8daebfee0b6fdb863e08214b358067f3b08",
    "2d004b5427888073acb2abd2d8daebf7f7f7fee0b6fdb863e08214b358067f3b08"
  ).map(colors);

  var PuOr = ramp(scheme$3);

  var scheme$4 = new Array(3).concat(
    "ef8a62f7f7f767a9cf",
    "ca0020f4a58292c5de0571b0",
    "ca0020f4a582f7f7f792c5de0571b0",
    "b2182bef8a62fddbc7d1e5f067a9cf2166ac",
    "b2182bef8a62fddbc7f7f7f7d1e5f067a9cf2166ac",
    "b2182bd6604df4a582fddbc7d1e5f092c5de4393c32166ac",
    "b2182bd6604df4a582fddbc7f7f7f7d1e5f092c5de4393c32166ac",
    "67001fb2182bd6604df4a582fddbc7d1e5f092c5de4393c32166ac053061",
    "67001fb2182bd6604df4a582fddbc7f7f7f7d1e5f092c5de4393c32166ac053061"
  ).map(colors);

  var RdBu = ramp(scheme$4);

  var scheme$5 = new Array(3).concat(
    "ef8a62ffffff999999",
    "ca0020f4a582bababa404040",
    "ca0020f4a582ffffffbababa404040",
    "b2182bef8a62fddbc7e0e0e09999994d4d4d",
    "b2182bef8a62fddbc7ffffffe0e0e09999994d4d4d",
    "b2182bd6604df4a582fddbc7e0e0e0bababa8787874d4d4d",
    "b2182bd6604df4a582fddbc7ffffffe0e0e0bababa8787874d4d4d",
    "67001fb2182bd6604df4a582fddbc7e0e0e0bababa8787874d4d4d1a1a1a",
    "67001fb2182bd6604df4a582fddbc7ffffffe0e0e0bababa8787874d4d4d1a1a1a"
  ).map(colors);

  var RdGy = ramp(scheme$5);

  var scheme$6 = new Array(3).concat(
    "fc8d59ffffbf91bfdb",
    "d7191cfdae61abd9e92c7bb6",
    "d7191cfdae61ffffbfabd9e92c7bb6",
    "d73027fc8d59fee090e0f3f891bfdb4575b4",
    "d73027fc8d59fee090ffffbfe0f3f891bfdb4575b4",
    "d73027f46d43fdae61fee090e0f3f8abd9e974add14575b4",
    "d73027f46d43fdae61fee090ffffbfe0f3f8abd9e974add14575b4",
    "a50026d73027f46d43fdae61fee090e0f3f8abd9e974add14575b4313695",
    "a50026d73027f46d43fdae61fee090ffffbfe0f3f8abd9e974add14575b4313695"
  ).map(colors);

  var RdYlBu = ramp(scheme$6);

  var scheme$7 = new Array(3).concat(
    "fc8d59ffffbf91cf60",
    "d7191cfdae61a6d96a1a9641",
    "d7191cfdae61ffffbfa6d96a1a9641",
    "d73027fc8d59fee08bd9ef8b91cf601a9850",
    "d73027fc8d59fee08bffffbfd9ef8b91cf601a9850",
    "d73027f46d43fdae61fee08bd9ef8ba6d96a66bd631a9850",
    "d73027f46d43fdae61fee08bffffbfd9ef8ba6d96a66bd631a9850",
    "a50026d73027f46d43fdae61fee08bd9ef8ba6d96a66bd631a9850006837",
    "a50026d73027f46d43fdae61fee08bffffbfd9ef8ba6d96a66bd631a9850006837"
  ).map(colors);

  var RdYlGn = ramp(scheme$7);

  var scheme$8 = new Array(3).concat(
    "fc8d59ffffbf99d594",
    "d7191cfdae61abdda42b83ba",
    "d7191cfdae61ffffbfabdda42b83ba",
    "d53e4ffc8d59fee08be6f59899d5943288bd",
    "d53e4ffc8d59fee08bffffbfe6f59899d5943288bd",
    "d53e4ff46d43fdae61fee08be6f598abdda466c2a53288bd",
    "d53e4ff46d43fdae61fee08bffffbfe6f598abdda466c2a53288bd",
    "9e0142d53e4ff46d43fdae61fee08be6f598abdda466c2a53288bd5e4fa2",
    "9e0142d53e4ff46d43fdae61fee08bffffbfe6f598abdda466c2a53288bd5e4fa2"
  ).map(colors);

  var Spectral = ramp(scheme$8);

  var scheme$9 = new Array(3).concat(
    "e5f5f999d8c92ca25f",
    "edf8fbb2e2e266c2a4238b45",
    "edf8fbb2e2e266c2a42ca25f006d2c",
    "edf8fbccece699d8c966c2a42ca25f006d2c",
    "edf8fbccece699d8c966c2a441ae76238b45005824",
    "f7fcfde5f5f9ccece699d8c966c2a441ae76238b45005824",
    "f7fcfde5f5f9ccece699d8c966c2a441ae76238b45006d2c00441b"
  ).map(colors);

  var BuGn = ramp(scheme$9);

  var scheme$a = new Array(3).concat(
    "e0ecf49ebcda8856a7",
    "edf8fbb3cde38c96c688419d",
    "edf8fbb3cde38c96c68856a7810f7c",
    "edf8fbbfd3e69ebcda8c96c68856a7810f7c",
    "edf8fbbfd3e69ebcda8c96c68c6bb188419d6e016b",
    "f7fcfde0ecf4bfd3e69ebcda8c96c68c6bb188419d6e016b",
    "f7fcfde0ecf4bfd3e69ebcda8c96c68c6bb188419d810f7c4d004b"
  ).map(colors);

  var BuPu = ramp(scheme$a);

  var scheme$b = new Array(3).concat(
    "e0f3dba8ddb543a2ca",
    "f0f9e8bae4bc7bccc42b8cbe",
    "f0f9e8bae4bc7bccc443a2ca0868ac",
    "f0f9e8ccebc5a8ddb57bccc443a2ca0868ac",
    "f0f9e8ccebc5a8ddb57bccc44eb3d32b8cbe08589e",
    "f7fcf0e0f3dbccebc5a8ddb57bccc44eb3d32b8cbe08589e",
    "f7fcf0e0f3dbccebc5a8ddb57bccc44eb3d32b8cbe0868ac084081"
  ).map(colors);

  var GnBu = ramp(scheme$b);

  var scheme$c = new Array(3).concat(
    "fee8c8fdbb84e34a33",
    "fef0d9fdcc8afc8d59d7301f",
    "fef0d9fdcc8afc8d59e34a33b30000",
    "fef0d9fdd49efdbb84fc8d59e34a33b30000",
    "fef0d9fdd49efdbb84fc8d59ef6548d7301f990000",
    "fff7ecfee8c8fdd49efdbb84fc8d59ef6548d7301f990000",
    "fff7ecfee8c8fdd49efdbb84fc8d59ef6548d7301fb300007f0000"
  ).map(colors);

  var OrRd = ramp(scheme$c);

  var scheme$d = new Array(3).concat(
    "ece2f0a6bddb1c9099",
    "f6eff7bdc9e167a9cf02818a",
    "f6eff7bdc9e167a9cf1c9099016c59",
    "f6eff7d0d1e6a6bddb67a9cf1c9099016c59",
    "f6eff7d0d1e6a6bddb67a9cf3690c002818a016450",
    "fff7fbece2f0d0d1e6a6bddb67a9cf3690c002818a016450",
    "fff7fbece2f0d0d1e6a6bddb67a9cf3690c002818a016c59014636"
  ).map(colors);

  var PuBuGn = ramp(scheme$d);

  var scheme$e = new Array(3).concat(
    "ece7f2a6bddb2b8cbe",
    "f1eef6bdc9e174a9cf0570b0",
    "f1eef6bdc9e174a9cf2b8cbe045a8d",
    "f1eef6d0d1e6a6bddb74a9cf2b8cbe045a8d",
    "f1eef6d0d1e6a6bddb74a9cf3690c00570b0034e7b",
    "fff7fbece7f2d0d1e6a6bddb74a9cf3690c00570b0034e7b",
    "fff7fbece7f2d0d1e6a6bddb74a9cf3690c00570b0045a8d023858"
  ).map(colors);

  var PuBu = ramp(scheme$e);

  var scheme$f = new Array(3).concat(
    "e7e1efc994c7dd1c77",
    "f1eef6d7b5d8df65b0ce1256",
    "f1eef6d7b5d8df65b0dd1c77980043",
    "f1eef6d4b9dac994c7df65b0dd1c77980043",
    "f1eef6d4b9dac994c7df65b0e7298ace125691003f",
    "f7f4f9e7e1efd4b9dac994c7df65b0e7298ace125691003f",
    "f7f4f9e7e1efd4b9dac994c7df65b0e7298ace125698004367001f"
  ).map(colors);

  var PuRd = ramp(scheme$f);

  var scheme$g = new Array(3).concat(
    "fde0ddfa9fb5c51b8a",
    "feebe2fbb4b9f768a1ae017e",
    "feebe2fbb4b9f768a1c51b8a7a0177",
    "feebe2fcc5c0fa9fb5f768a1c51b8a7a0177",
    "feebe2fcc5c0fa9fb5f768a1dd3497ae017e7a0177",
    "fff7f3fde0ddfcc5c0fa9fb5f768a1dd3497ae017e7a0177",
    "fff7f3fde0ddfcc5c0fa9fb5f768a1dd3497ae017e7a017749006a"
  ).map(colors);

  var RdPu = ramp(scheme$g);

  var scheme$h = new Array(3).concat(
    "edf8b17fcdbb2c7fb8",
    "ffffcca1dab441b6c4225ea8",
    "ffffcca1dab441b6c42c7fb8253494",
    "ffffccc7e9b47fcdbb41b6c42c7fb8253494",
    "ffffccc7e9b47fcdbb41b6c41d91c0225ea80c2c84",
    "ffffd9edf8b1c7e9b47fcdbb41b6c41d91c0225ea80c2c84",
    "ffffd9edf8b1c7e9b47fcdbb41b6c41d91c0225ea8253494081d58"
  ).map(colors);

  var YlGnBu = ramp(scheme$h);

  var scheme$i = new Array(3).concat(
    "f7fcb9addd8e31a354",
    "ffffccc2e69978c679238443",
    "ffffccc2e69978c67931a354006837",
    "ffffccd9f0a3addd8e78c67931a354006837",
    "ffffccd9f0a3addd8e78c67941ab5d238443005a32",
    "ffffe5f7fcb9d9f0a3addd8e78c67941ab5d238443005a32",
    "ffffe5f7fcb9d9f0a3addd8e78c67941ab5d238443006837004529"
  ).map(colors);

  var YlGn = ramp(scheme$i);

  var scheme$j = new Array(3).concat(
    "fff7bcfec44fd95f0e",
    "ffffd4fed98efe9929cc4c02",
    "ffffd4fed98efe9929d95f0e993404",
    "ffffd4fee391fec44ffe9929d95f0e993404",
    "ffffd4fee391fec44ffe9929ec7014cc4c028c2d04",
    "ffffe5fff7bcfee391fec44ffe9929ec7014cc4c028c2d04",
    "ffffe5fff7bcfee391fec44ffe9929ec7014cc4c02993404662506"
  ).map(colors);

  var YlOrBr = ramp(scheme$j);

  var scheme$k = new Array(3).concat(
    "ffeda0feb24cf03b20",
    "ffffb2fecc5cfd8d3ce31a1c",
    "ffffb2fecc5cfd8d3cf03b20bd0026",
    "ffffb2fed976feb24cfd8d3cf03b20bd0026",
    "ffffb2fed976feb24cfd8d3cfc4e2ae31a1cb10026",
    "ffffccffeda0fed976feb24cfd8d3cfc4e2ae31a1cb10026",
    "ffffccffeda0fed976feb24cfd8d3cfc4e2ae31a1cbd0026800026"
  ).map(colors);

  var YlOrRd = ramp(scheme$k);

  var scheme$l = new Array(3).concat(
    "deebf79ecae13182bd",
    "eff3ffbdd7e76baed62171b5",
    "eff3ffbdd7e76baed63182bd08519c",
    "eff3ffc6dbef9ecae16baed63182bd08519c",
    "eff3ffc6dbef9ecae16baed64292c62171b5084594",
    "f7fbffdeebf7c6dbef9ecae16baed64292c62171b5084594",
    "f7fbffdeebf7c6dbef9ecae16baed64292c62171b508519c08306b"
  ).map(colors);

  var Blues = ramp(scheme$l);

  var scheme$m = new Array(3).concat(
    "e5f5e0a1d99b31a354",
    "edf8e9bae4b374c476238b45",
    "edf8e9bae4b374c47631a354006d2c",
    "edf8e9c7e9c0a1d99b74c47631a354006d2c",
    "edf8e9c7e9c0a1d99b74c47641ab5d238b45005a32",
    "f7fcf5e5f5e0c7e9c0a1d99b74c47641ab5d238b45005a32",
    "f7fcf5e5f5e0c7e9c0a1d99b74c47641ab5d238b45006d2c00441b"
  ).map(colors);

  var Greens = ramp(scheme$m);

  var scheme$n = new Array(3).concat(
    "f0f0f0bdbdbd636363",
    "f7f7f7cccccc969696525252",
    "f7f7f7cccccc969696636363252525",
    "f7f7f7d9d9d9bdbdbd969696636363252525",
    "f7f7f7d9d9d9bdbdbd969696737373525252252525",
    "fffffff0f0f0d9d9d9bdbdbd969696737373525252252525",
    "fffffff0f0f0d9d9d9bdbdbd969696737373525252252525000000"
  ).map(colors);

  var Greys = ramp(scheme$n);

  var scheme$o = new Array(3).concat(
    "efedf5bcbddc756bb1",
    "f2f0f7cbc9e29e9ac86a51a3",
    "f2f0f7cbc9e29e9ac8756bb154278f",
    "f2f0f7dadaebbcbddc9e9ac8756bb154278f",
    "f2f0f7dadaebbcbddc9e9ac8807dba6a51a34a1486",
    "fcfbfdefedf5dadaebbcbddc9e9ac8807dba6a51a34a1486",
    "fcfbfdefedf5dadaebbcbddc9e9ac8807dba6a51a354278f3f007d"
  ).map(colors);

  var Purples = ramp(scheme$o);

  var scheme$p = new Array(3).concat(
    "fee0d2fc9272de2d26",
    "fee5d9fcae91fb6a4acb181d",
    "fee5d9fcae91fb6a4ade2d26a50f15",
    "fee5d9fcbba1fc9272fb6a4ade2d26a50f15",
    "fee5d9fcbba1fc9272fb6a4aef3b2ccb181d99000d",
    "fff5f0fee0d2fcbba1fc9272fb6a4aef3b2ccb181d99000d",
    "fff5f0fee0d2fcbba1fc9272fb6a4aef3b2ccb181da50f1567000d"
  ).map(colors);

  var Reds = ramp(scheme$p);

  var scheme$q = new Array(3).concat(
    "fee6cefdae6be6550d",
    "feeddefdbe85fd8d3cd94701",
    "feeddefdbe85fd8d3ce6550da63603",
    "feeddefdd0a2fdae6bfd8d3ce6550da63603",
    "feeddefdd0a2fdae6bfd8d3cf16913d948018c2d04",
    "fff5ebfee6cefdd0a2fdae6bfd8d3cf16913d948018c2d04",
    "fff5ebfee6cefdd0a2fdae6bfd8d3cf16913d94801a636037f2704"
  ).map(colors);

  var Oranges = ramp(scheme$q);

  var cubehelix = d3Interpolate.interpolateCubehelixLong(d3Color.cubehelix(300, 0.5, 0.0), d3Color.cubehelix(-240, 0.5, 1.0));

  var warm = d3Interpolate.interpolateCubehelixLong(d3Color.cubehelix(-100, 0.75, 0.35), d3Color.cubehelix(80, 1.50, 0.8));

  var cool = d3Interpolate.interpolateCubehelixLong(d3Color.cubehelix(260, 0.75, 0.35), d3Color.cubehelix(80, 1.50, 0.8));

  var c = d3Color.cubehelix();

  function rainbow(t) {
    if (t < 0 || t > 1) t -= Math.floor(t);
    var ts = Math.abs(t - 0.5);
    c.h = 360 * t - 100;
    c.s = 1.5 - 1.5 * ts;
    c.l = 0.8 - 0.9 * ts;
    return c + "";
  }

  var c$1 = d3Color.rgb(),
      pi_1_3 = Math.PI / 3,
      pi_2_3 = Math.PI * 2 / 3;

  function sinebow(t) {
    var x;
    t = (0.5 - t) * Math.PI;
    c$1.r = 255 * (x = Math.sin(t)) * x;
    c$1.g = 255 * (x = Math.sin(t + pi_1_3)) * x;
    c$1.b = 255 * (x = Math.sin(t + pi_2_3)) * x;
    return c$1 + "";
  }

  function ramp$1(range) {
    var n = range.length;
    return function(t) {
      return range[Math.max(0, Math.min(n - 1, Math.floor(t * n)))];
    };
  }

  var viridis = ramp$1(colors("44015444025645045745055946075a46085c460a5d460b5e470d60470e6147106347116447136548146748166848176948186a481a6c481b6d481c6e481d6f481f70482071482173482374482475482576482677482878482979472a7a472c7a472d7b472e7c472f7d46307e46327e46337f463480453581453781453882443983443a83443b84433d84433e85423f854240864241864142874144874045884046883f47883f48893e49893e4a893e4c8a3d4d8a3d4e8a3c4f8a3c508b3b518b3b528b3a538b3a548c39558c39568c38588c38598c375a8c375b8d365c8d365d8d355e8d355f8d34608d34618d33628d33638d32648e32658e31668e31678e31688e30698e306a8e2f6b8e2f6c8e2e6d8e2e6e8e2e6f8e2d708e2d718e2c718e2c728e2c738e2b748e2b758e2a768e2a778e2a788e29798e297a8e297b8e287c8e287d8e277e8e277f8e27808e26818e26828e26828e25838e25848e25858e24868e24878e23888e23898e238a8d228b8d228c8d228d8d218e8d218f8d21908d21918c20928c20928c20938c1f948c1f958b1f968b1f978b1f988b1f998a1f9a8a1e9b8a1e9c891e9d891f9e891f9f881fa0881fa1881fa1871fa28720a38620a48621a58521a68522a78522a88423a98324aa8325ab8225ac8226ad8127ad8128ae8029af7f2ab07f2cb17e2db27d2eb37c2fb47c31b57b32b67a34b67935b77937b87838b9773aba763bbb753dbc743fbc7340bd7242be7144bf7046c06f48c16e4ac16d4cc26c4ec36b50c46a52c56954c56856c66758c7655ac8645cc8635ec96260ca6063cb5f65cb5e67cc5c69cd5b6ccd5a6ece5870cf5773d05675d05477d1537ad1517cd2507fd34e81d34d84d44b86d54989d5488bd6468ed64590d74393d74195d84098d83e9bd93c9dd93ba0da39a2da37a5db36a8db34aadc32addc30b0dd2fb2dd2db5de2bb8de29bade28bddf26c0df25c2df23c5e021c8e020cae11fcde11dd0e11cd2e21bd5e21ad8e219dae319dde318dfe318e2e418e5e419e7e419eae51aece51befe51cf1e51df4e61ef6e620f8e621fbe723fde725"));

  var magma = ramp$1(colors("00000401000501010601010802010902020b02020d03030f03031204041405041606051806051a07061c08071e0907200a08220b09240c09260d0a290e0b2b100b2d110c2f120d31130d34140e36150e38160f3b180f3d19103f1a10421c10441d11471e114920114b21114e22115024125325125527125829115a2a115c2c115f2d11612f116331116533106734106936106b38106c390f6e3b0f703d0f713f0f72400f74420f75440f764510774710784910784a10794c117a4e117b4f127b51127c52137c54137d56147d57157e59157e5a167e5c167f5d177f5f187f601880621980641a80651a80671b80681c816a1c816b1d816d1d816e1e81701f81721f817320817521817621817822817922827b23827c23827e24828025828125818326818426818627818827818928818b29818c29818e2a81902a81912b81932b80942c80962c80982d80992d809b2e7f9c2e7f9e2f7fa02f7fa1307ea3307ea5317ea6317da8327daa337dab337cad347cae347bb0357bb2357bb3367ab5367ab73779b83779ba3878bc3978bd3977bf3a77c03a76c23b75c43c75c53c74c73d73c83e73ca3e72cc3f71cd4071cf4070d0416fd2426fd3436ed5446dd6456cd8456cd9466bdb476adc4869de4968df4a68e04c67e24d66e34e65e44f64e55064e75263e85362e95462ea5661eb5760ec5860ed5a5fee5b5eef5d5ef05f5ef1605df2625df2645cf3655cf4675cf4695cf56b5cf66c5cf66e5cf7705cf7725cf8745cf8765cf9785df9795df97b5dfa7d5efa7f5efa815ffb835ffb8560fb8761fc8961fc8a62fc8c63fc8e64fc9065fd9266fd9467fd9668fd9869fd9a6afd9b6bfe9d6cfe9f6dfea16efea36ffea571fea772fea973feaa74feac76feae77feb078feb27afeb47bfeb67cfeb77efeb97ffebb81febd82febf84fec185fec287fec488fec68afec88cfeca8dfecc8ffecd90fecf92fed194fed395fed597fed799fed89afdda9cfddc9efddea0fde0a1fde2a3fde3a5fde5a7fde7a9fde9aafdebacfcecaefceeb0fcf0b2fcf2b4fcf4b6fcf6b8fcf7b9fcf9bbfcfbbdfcfdbf"));

  var inferno = ramp$1(colors("00000401000501010601010802010a02020c02020e03021004031204031405041706041907051b08051d09061f0a07220b07240c08260d08290e092b10092d110a30120a32140b34150b37160b39180c3c190c3e1b0c411c0c431e0c451f0c48210c4a230c4c240c4f260c51280b53290b552b0b572d0b592f0a5b310a5c320a5e340a5f3609613809623909633b09643d09653e0966400a67420a68440a68450a69470b6a490b6a4a0c6b4c0c6b4d0d6c4f0d6c510e6c520e6d540f6d550f6d57106e59106e5a116e5c126e5d126e5f136e61136e62146e64156e65156e67166e69166e6a176e6c186e6d186e6f196e71196e721a6e741a6e751b6e771c6d781c6d7a1d6d7c1d6d7d1e6d7f1e6c801f6c82206c84206b85216b87216b88226a8a226a8c23698d23698f24699025689225689326679526679727669827669a28659b29649d29649f2a63a02a63a22b62a32c61a52c60a62d60a82e5fa92e5eab2f5ead305dae305cb0315bb1325ab3325ab43359b63458b73557b93556ba3655bc3754bd3853bf3952c03a51c13a50c33b4fc43c4ec63d4dc73e4cc83f4bca404acb4149cc4248ce4347cf4446d04545d24644d34743d44842d54a41d74b3fd84c3ed94d3dda4e3cdb503bdd513ade5238df5337e05536e15635e25734e35933e45a31e55c30e65d2fe75e2ee8602de9612bea632aeb6429eb6628ec6726ed6925ee6a24ef6c23ef6e21f06f20f1711ff1731df2741cf3761bf37819f47918f57b17f57d15f67e14f68013f78212f78410f8850ff8870ef8890cf98b0bf98c0af98e09fa9008fa9207fa9407fb9606fb9706fb9906fb9b06fb9d07fc9f07fca108fca309fca50afca60cfca80dfcaa0ffcac11fcae12fcb014fcb216fcb418fbb61afbb81dfbba1ffbbc21fbbe23fac026fac228fac42afac62df9c72ff9c932f9cb35f8cd37f8cf3af7d13df7d340f6d543f6d746f5d949f5db4cf4dd4ff4df53f4e156f3e35af3e55df2e661f2e865f2ea69f1ec6df1ed71f1ef75f1f179f2f27df2f482f3f586f3f68af4f88ef5f992f6fa96f8fb9af9fc9dfafda1fcffa4"));

  var plasma = ramp$1(colors("0d088710078813078916078a19068c1b068d1d068e20068f2206902406912605912805922a05932c05942e05952f059631059733059735049837049938049a3a049a3c049b3e049c3f049c41049d43039e44039e46039f48039f4903a04b03a14c02a14e02a25002a25102a35302a35502a45601a45801a45901a55b01a55c01a65e01a66001a66100a76300a76400a76600a76700a86900a86a00a86c00a86e00a86f00a87100a87201a87401a87501a87701a87801a87a02a87b02a87d03a87e03a88004a88104a78305a78405a78606a68707a68808a68a09a58b0aa58d0ba58e0ca48f0da4910ea3920fa39410a29511a19613a19814a099159f9a169f9c179e9d189d9e199da01a9ca11b9ba21d9aa31e9aa51f99a62098a72197a82296aa2395ab2494ac2694ad2793ae2892b02991b12a90b22b8fb32c8eb42e8db52f8cb6308bb7318ab83289ba3388bb3488bc3587bd3786be3885bf3984c03a83c13b82c23c81c33d80c43e7fc5407ec6417dc7427cc8437bc9447aca457acb4679cc4778cc4977cd4a76ce4b75cf4c74d04d73d14e72d24f71d35171d45270d5536fd5546ed6556dd7566cd8576bd9586ada5a6ada5b69db5c68dc5d67dd5e66de5f65de6164df6263e06363e16462e26561e26660e3685fe4695ee56a5de56b5de66c5ce76e5be76f5ae87059e97158e97257ea7457eb7556eb7655ec7754ed7953ed7a52ee7b51ef7c51ef7e50f07f4ff0804ef1814df1834cf2844bf3854bf3874af48849f48948f58b47f58c46f68d45f68f44f79044f79143f79342f89441f89540f9973ff9983ef99a3efa9b3dfa9c3cfa9e3bfb9f3afba139fba238fca338fca537fca636fca835fca934fdab33fdac33fdae32fdaf31fdb130fdb22ffdb42ffdb52efeb72dfeb82cfeba2cfebb2bfebd2afebe2afec029fdc229fdc328fdc527fdc627fdc827fdca26fdcb26fccd25fcce25fcd025fcd225fbd324fbd524fbd724fad824fada24f9dc24f9dd25f8df25f8e125f7e225f7e425f6e626f6e826f5e926f5eb27f4ed27f3ee27f3f027f2f227f1f426f1f525f0f724f0f921"));

  exports.schemeCategory10 = category10;
  exports.schemeAccent = Accent;
  exports.schemeDark2 = Dark2;
  exports.schemePaired = Paired;
  exports.schemePastel1 = Pastel1;
  exports.schemePastel2 = Pastel2;
  exports.schemeSet1 = Set1;
  exports.schemeSet2 = Set2;
  exports.schemeSet3 = Set3;
  exports.interpolateBrBG = BrBG;
  exports.schemeBrBG = scheme;
  exports.interpolatePRGn = PRGn;
  exports.schemePRGn = scheme$1;
  exports.interpolatePiYG = PiYG;
  exports.schemePiYG = scheme$2;
  exports.interpolatePuOr = PuOr;
  exports.schemePuOr = scheme$3;
  exports.interpolateRdBu = RdBu;
  exports.schemeRdBu = scheme$4;
  exports.interpolateRdGy = RdGy;
  exports.schemeRdGy = scheme$5;
  exports.interpolateRdYlBu = RdYlBu;
  exports.schemeRdYlBu = scheme$6;
  exports.interpolateRdYlGn = RdYlGn;
  exports.schemeRdYlGn = scheme$7;
  exports.interpolateSpectral = Spectral;
  exports.schemeSpectral = scheme$8;
  exports.interpolateBuGn = BuGn;
  exports.schemeBuGn = scheme$9;
  exports.interpolateBuPu = BuPu;
  exports.schemeBuPu = scheme$a;
  exports.interpolateGnBu = GnBu;
  exports.schemeGnBu = scheme$b;
  exports.interpolateOrRd = OrRd;
  exports.schemeOrRd = scheme$c;
  exports.interpolatePuBuGn = PuBuGn;
  exports.schemePuBuGn = scheme$d;
  exports.interpolatePuBu = PuBu;
  exports.schemePuBu = scheme$e;
  exports.interpolatePuRd = PuRd;
  exports.schemePuRd = scheme$f;
  exports.interpolateRdPu = RdPu;
  exports.schemeRdPu = scheme$g;
  exports.interpolateYlGnBu = YlGnBu;
  exports.schemeYlGnBu = scheme$h;
  exports.interpolateYlGn = YlGn;
  exports.schemeYlGn = scheme$i;
  exports.interpolateYlOrBr = YlOrBr;
  exports.schemeYlOrBr = scheme$j;
  exports.interpolateYlOrRd = YlOrRd;
  exports.schemeYlOrRd = scheme$k;
  exports.interpolateBlues = Blues;
  exports.schemeBlues = scheme$l;
  exports.interpolateGreens = Greens;
  exports.schemeGreens = scheme$m;
  exports.interpolateGreys = Greys;
  exports.schemeGreys = scheme$n;
  exports.interpolatePurples = Purples;
  exports.schemePurples = scheme$o;
  exports.interpolateReds = Reds;
  exports.schemeReds = scheme$p;
  exports.interpolateOranges = Oranges;
  exports.schemeOranges = scheme$q;
  exports.interpolateCubehelixDefault = cubehelix;
  exports.interpolateRainbow = rainbow;
  exports.interpolateWarm = warm;
  exports.interpolateCool = cool;
  exports.interpolateSinebow = sinebow;
  exports.interpolateViridis = viridis;
  exports.interpolateMagma = magma;
  exports.interpolateInferno = inferno;
  exports.interpolatePlasma = plasma;

  Object.defineProperty(exports, '__esModule', { value: true });

  })));

  var d3sc = /*#__PURE__*/Object.freeze({

  });

  /*
   * Module variables:
   */

  // Default limit on quadtree resolution
  var DEFAULT_RESOLUTION_LIMIT = 1;

  // Special object indicating children should be ignored during recursive
  // visits.
  var IGNORE_CHILDREN = {};

  // Default number of standard deviations before being considered an outlier.
  var DEFAULT_OUTLIER_ALLOWANCE$1 = 3;

  /*
   * Helper functions
   */

  // True or false does the region contain the point?
  function region_contains(region, x, y) {
    return (
      x >= region[0][0]
   && x <= region[1][0]
   && y >= region[0][1]
   && y <= region[1][1]
    );
  }

  // True or false does the region entirely contain the sub-region?
  function region_envolops(region, sub_region) {
    return (
      region[0][0] <= sub_region[0][0]
   && region[0][1] <= sub_region[0][1]
   && region[1][0] >= sub_region[1][0]
   && region[1][1] >= sub_region[1][1]
    )
  }

  // Which quadrant is (x, y) in?
  //
  //     0 | 1
  //     --+--
  //     2 | 3
  //
  function quad_index(extent, x, y) {
    var w = extent[1][0] - extent[0][0];
    var h = extent[1][1] - extent[0][1];
    var right = x >= extent[0][0] + w/2;
    var bottom = y >= extent[0][1] + h/2;
    return right + 2*bottom;
  }

  // Which quadrant(s) does [[minx, miny], [maxx, maxy]] touch?
  //
  //     0 | 1
  //     --+--
  //     2 | 3
  //
  // Returns an ordered array (e.g., [0, 1] or [1, 3]). The array will be empty
  // if the region doesn't overlap the given extent at all.
  function quad_indices(extent, region) {
    if (
      region[1][0] < extent[0][0]
   || region[1][1] < extent[0][1]
   || region[0][0] > extent[1][0]
   || region[0][1] > extent[1][1]
    ) { // region doesn't overlap extent at all:
      return [];
    }

    var w = extent[1][0] - extent[0][0];
    var h = extent[1][1] - extent[0][1];
    var west = (region[0][0] <= extent[0][0] + w/2);
    var east = (region[1][0] >= extent[0][0] + w/2);
    var north = (region[0][1] <= extent[0][1] + h/2);
    var south = (region[1][1] >= extent[0][1] + h/2);
    var result = [];
    if (west && north) { result.push(0); }
    if (east && north) { result.push(1); }
    if (west && south) { result.push(2); }
    if (east && south) { result.push(3); }
    return result;
  }

  // The extent of the qi-th sub-quadrant.
  function sub_extent(extent, qi) {
    var w = extent[1][0] - extent[0][0];
    var h = extent[1][1] - extent[0][1];
    if (qi == 0) {
      return [
        [extent[0][0], extent[0][1]],
        [extent[0][0] + w/2, extent[0][1] + h/2]
      ];
    } else if (qi == 1) {
      return [
        [extent[0][0] + w/2, extent[0][1]],
        [extent[1][0], extent[0][1] + h/2]
      ];
    } else if (qi == 2) {
      return [
        [extent[0][0], extent[0][1] + h/2],
        [extent[0][0] + w/2, extent[1][1]]
      ];
    } else if (qi == 3) {
      return [
        [extent[0][0] + w/2, extent[0][1] + h/2],
        [extent[1][0], extent[1][1]]
      ];
    } else {
      console.warn("Invalid subindex: " + qi);
      return undefined;
    }
  }

  /*
   * Core functions
   */

  // Helper for build_quadtree that adds a single data item
  function add_to_quadrant(
    node,
    extent,
    item,
    x, y,
    getx, gety,
    resolution_limit
  ) {
    if (!region_contains(extent, x, y)) {
      return; // ignore this out-of-bounds point.
    }
    node.count += 1; // we're adding this value somewhere in here
    if (node.count == 1) { // base case: we're at an empty node
      node.items = [ item ];
    } else if (node.hasOwnProperty("children")) { // recurse somewhere
      var qi = quad_index(extent, x, y);
      var s_ext = sub_extent(extent, qi);
      var child = node.children[qi];
      if (child == null) { // quadrant was empty
        node.children[qi] = { "count": 1, "items": [ item ] };
      } else { // add to quadrant recursively
        add_to_quadrant(
          child,
          s_ext,
          item,
          x, y,
          getx, gety,
          resolution_limit
        );
      }
    } else { // want to split this node; it has items, not children
      var w = extent[1][0] - extent[0][0];
      var h = extent[1][1] - extent[0][1];
      if (w < resolution_limit || h < resolution_limit) {
        // can't split, just grow
        node.items.push(item);
      } else { // need to add resolution here
        // first check location of other item (must be exactly 1 or at worst
        // stacked copies):
        var oi = node.items[0];
        var ox = getx(oi);
        var oy = gety(oi);
        var oq = quad_index(extent, ox, oy);
        if (ox == x && oy == y) { // A duplicate! Splitting won't help.
          node.items.push(item);
        } else { // not a duplicate: let's split
          node.children = [ null, null, null, null ];
          // insert new child node containing other item:
          node.children[oq] = { "count": node.count - 1, "items": node.items };
          delete node.items; // change this node into a children node
          // now insert us into that node or another new one:
          var qi = quad_index(extent, x, y);
          if (qi == oq) {
            add_to_quadrant(
              node.children[qi],
              sub_extent(extent, qi),
              item,
              x, y,
              getx, gety,
              resolution_limit
            );
          } else {
            node.children[qi] = { "count": 1, "items": [ item ] };
          }
        }
      }
    }
  }

  // Returns an array of all of the items in the given node.
  function all_items_in_quadrant(node) {
    var results = [];
    if (node == null) {
      return [];
    } else if (node.hasOwnProperty("children")) { // recurse
      for (var i = 0; i < node.children.length; ++i) {
        results = results.concat(all_items_in_quadrant(node.children[i]));
      }
    } else {
      results = results.concat(node.items);
    }
    return results;
  }

  // Finds all items that fall into the given region within the given quadrant.
  // Returns a (possibly empty) array.
  function find_any_in_quadrant(node, extent, region, getx, gety) {
    var results = [];
    if (node.hasOwnProperty("children")) { // recurse
      var quads_touched = quad_indices(extent, region);
      if (quads_touched.length == 4 && region_envolops(region, extent)) {
        // just include all nodes from enveloped quadrants
        results = results.concat(all_items_in_quadrant(node));
      } else {
        // otherwise carefully recurse
        for (var i = 0; i < quads_touched.length; ++i) {
          var qi = quads_touched[i];
          var child = node.children[qi];
          if (child != null) { // quadrant isn't empty
            results = results.concat(
              find_any_in_quadrant(
                node.children[qi],
                sub_extent(extent, qi),
                region,
                getx, gety
              )
            );
          }
        }
      }
    } else if (node.hasOwnProperty("items")) {
      // else base case: find all items w/in region
      for (var i = 0; i < node.count; ++i) {
        var item = node.items[i];
        var ix = getx(item);
        var iy = gety(item);
        if (region_contains(region, ix, iy)) {
          results.push(item);
        }
      }
    } else { // default for an empty tree: return an empty list
      return [];
    }
    return results;
  }

  // Calls the given function on each node in the quadtree, passing in the node
  // object and the extent of that node. The traversal is in pre-order, so
  // larger nodes are visited first, unless "post_order" is given as 'true,' in
  // which case smaller nodes are visited first (it may be omitted).
  function visit_each_node(node, extent, fcn, post_order) {
    var check = undefined;
    if (!post_order) {
      check = fcn(node, extent);
    }
    if (check != IGNORE_CHILDREN && node.hasOwnProperty("children")) {
      for (var i = 0; i < node.children.length; ++i) {
        var child = node.children[i];
        if (child != null) {
          visit_each_node(child, sub_extent(extent, i), fcn, post_order);
        }
      }
    }
    if (post_order) {
      fcn(node, extent);
    }
  }

  // Quadtree builder that handles duplicate points and respects a resolution
  // limit (unlike d3 builtin quadtrees). Stores indices into the data array,
  // not data items. Default resolution limit is defined in this module as
  // DEFAULT_RESOLUTION_LIMIT. getx and gety should be accessor functions that
  // take a datum and return a number. Items outside the given extents will be
  // grouped into edge/corner quadrants nearest their actual position.
  function build_quadtree(data, extent, getx, gety, resolution_limit) {
    if (resolution_limit == undefined) {
      resolution_limit = DEFAULT_RESOLUTION_LIMIT;
    }
    var root = { "count": 0 };
    for (var i = 0; i < data.length; ++i) {
      var d = data[i];
      var x = getx(d);
      var y = gety(d);
      add_to_quadrant(root, extent, d, x, y, getx, gety, resolution_limit);
    }
    return {
      "extent": extent,
      "root": root,
      "getx": getx,
      "gety": gety,
      "resolution_limit": resolution_limit
    };
  }

  // Returns a list of items in the given region, which should be given as a
  // pair of x, y arrays specifying the lower-left and upper-right corners of a
  // box (in standard x -> right y -> top coordinates).
  function in_region(tree, region) {
    return find_any_in_quadrant(
      tree.root,
      tree.extent,
      region,
      tree.getx,
      tree.gety
    );
  }

  // Returns a list of items within the given circle, defined by its center x,
  // center y, and radius.
  function in_circle(tree, cx, cy, r) {
    var region = [[cx - r, cy - r], [cx + r, cy + r]];
    var candidates = in_region(
      tree,
      region
    );
    var selected = [];
    for (var i = 0; i < candidates.length; ++i) {
      var it = candidates[i];
      var x = tree.getx(it);
      var y = tree.gety(it);
      var dx = x - cx;
      var dy = y - cy;
      if (Math.sqrt(dx * dx + dy * dy) <= r) {
        selected.push(it);
      }
    }
    return selected;
  }

  // Works like all_items, but accepts a single node rather than only an entire
  // tree, and returns items within that node.
  function node_items(node) {
    var result = [];
    visit_each_node(
      node,
      [[0, 0], [0, 0]], // extent doesn't matter
      function (node) {
        if (node.hasOwnProperty("items")) {
          result = result.concat(node.items);
        }
      }
    );
    return result;
  }

  // Calls the given function on each node in the given quadtree. Nodes have a
  // count, and have either a list of "items," or a list of "nodes." Node lists
  // always contain four items, in NW, NE, SW, SE order, but some of those may
  // be null if there are no items in a particular sub-quadrant. The visit
  // function also receives a second argument containing the coordinate extent
  // of the node being visited. The 'post_order' argument may be omitted, but
  // if given as 'true,' then smaller nodes are visited before larger nodes
  // (and south-eastern nodes before north-western nodes), instead of the
  // default, where larger nodes (and north-western nodes) are visited first.
  // Note that the visit function may return the special value IGNORE_CHILDREN
  // to prevent further recursion into child notes, although for obvious
  // reasons, this only works when post_order is omitted or false.
  function visit(tree, fcn, post_order) {
    visit_each_node(tree.root, tree.extent, fcn, post_order);
  }

  // Computes the density of a quadtree node. Density is computed as as 1/2
  // count / mean distance-to-centroid for leaf nodes. For non-leaf nodes, we
  // just use count / w*h. If the mean distance-to-centroid is zero, we fall
  // back on the count divided by the area of a square the size of the
  // resolution limit of the tree.
  function compute_density(tree, node, extent, centroid) {
    if (node.count == 0) {
      return 0;
    }
    var density;
    var w = extent[1][0] - extent[0][0];
    var h = extent[1][1] - extent[0][1];
    var cx = centroid[0];
    var cy = centroid[1];
    if (node.hasOwnProperty("children")) {
      density = node.count / (w * h);
    } else {
      var mean_r = 0;
      for (var i = 0; i < node.count; ++i) {
        var it = node.items[i];
        var dx = tree.getx(it) - cx;
        var dy = tree.gety(it) - cy;
        var r = Math.sqrt(dx * dx + dy * dy);
        mean_r += r;
      }
      var rl = tree.resolution_limit;
      if (mean_r < Math.SQRT2 * rl) {
        density = node.count / (rl * rl);
      } else {
        density = node.count / (2 * Math.PI * mean_r * mean_r);
      }
    }
    return density;
  }

  // Returns a list of area objects, which contain extent, density, relative
  // density, standardized density, centroid, leaf, and quadtree node
  // information. Areas overlap, and larger (containing) areas come earlier in
  // the list, so that they can be drawn in order. This method returns one area
  // for each node in the tree.
  //
  // The max_resolution argument is optional, but if given, no rectangles
  // smaller than that in either dimension will be returned.
  //
  // The base_density is also optional, but if given, it establishes a default
  // base density value, which will be used as the max density unless a denser
  // region exists.
  //
  // The outlier_allowance value is optional, and will default to
  // DEFAULT_OUTLIER_ALLOWANCE. It sets the number of standard deviations away
  // from the mean before a leaf density is considered an outlier. This in turn
  // is used to set limits on the standardized density that are more
  // restrictive than those for simple relative density (but which are then
  // violated by outlier points).
  //
  // TODO: Interactions between max_resolution and density calculations!!!
  // (max-rez-capped nodes may have children & thus use incorrect density
  // estimate.)
  //
  // Results for a 1x1 region with points at:
  //   (0.6, 0.6),
  //   (0.8, 0.6),
  //   (0.8, 0.7)
  // would look like:
  //
  // [
  //   {
  //     "extent": [[0, 0], [1, 1]],
  //     "density": 3,
  //     "relative_density": 0.09375,
  //     "standard_density": 0.09375,
  //     "centroid": [0.7333333333333334, 0.6333333333333333],
  //     "is_leaf": false,
  //     "node": <omitted from example>
  //   },
  //
  //   {
  //     "extent": [[0.5, 0.5], [1, 1]],
  //     "density": 3,
  //     "relative_density": 0.375,
  //     "standard_density": 0.375,
  //     "centroid": [0.7333333333333334, 0.6333333333333333],
  //     "is_leaf": false,
  //     "node": <omitted from example>
  //   },
  //
  //   {
  //     "extent": [[0.5, 0.5], [0.75, 0.75]],
  //     "density": 1,
  //     "relative_density": 0.5,
  //     "standard_density": 0.5,
  //     "centroid": [0.6, 0.6],
  //     "is_leaf": true,
  //     "node": <omitted from example>
  //   },
  //   {
  //     "extent": [[0.75, 0.5], [1, 0.75]],
  //     "density": 2,
  //     "relative_density": 1,
  //     "standard_density": 1,
  //     "centroid": [0.8, 0.65],
  //     "is_leaf": true,
  //     "node": <omitted from example>
  //   }
  // ]
  //
  function density_areas(
    tree,
    max_resolution,
    base_density,
    min_as_zero,
    outlier_allowance
  ) {
    if (outlier_allowance == undefined) {
      outlier_allowance = DEFAULT_OUTLIER_ALLOWANCE$1;
    }
    results = [];
    var max_density = base_density;
    var min_density = undefined;
    var leaf_density_mean = 0;
    var leaf_density_m2 = 0;
    var leaf_count = 0;
    var centroids = {};
    // First visit: post-order to determine max density and compute centroids
    visit(
      tree,
      function (node, extent) {
        // TODO: Is this too slow without the use of IGNORE_CHILDREN for
        // 100,000+ node data where the max_resolution is supposed to help
        // things?

        // centroid
        if (node.hasOwnProperty("children")) {
          var cx = 0;
          var cy = 0;
          for (var i = 0; i < node.children.length; ++i) {
            var k = "" + sub_extent(extent, i);
            if (centroids.hasOwnProperty(k)) {
              var cen = centroids[k];
              cx += cen[0] * node.children[i].count;
              cy += cen[1] * node.children[i].count;
            } // otherwise must have been an empty child
          }
          cx /= node.count;
          cy /= node.count;
          centroids["" + extent] = [cx, cy];
        } else if (node.count > 0) {
          var cx = 0;
          var cy = 0;
          for (var i = 0; i < node.count; ++i) {
            var it = node.items[i];
            cx += tree.getx(it);
            cy += tree.gety(it);
          }
          cx /= node.count;
          cy /= node.count;
          centroids["" + extent] = [cx, cy];
        } // else don't add a centroid at all

        // density
        var w = extent[1][0] - extent[0][0];
        var h = extent[1][1] - extent[0][1];
        if (
          max_resolution == undefined
       || (w >= max_resolution && h >= max_resolution)
        ) {
          var density = compute_density(tree, node, extent, [cx, cy]);
          if (max_density == undefined || density > max_density) {
            max_density = density;
          }
          if (min_density == undefined || density < min_density) {
            min_density = density;
          }

          if (
            w/2 < max_resolution
         || h/2 < max_resolution
         || !node.hasOwnProperty("children")
          ) { // it's a natural or forced leaf
            leaf_count += 1;
            var delta = density - leaf_density_mean;
            leaf_density_mean += delta / leaf_count;
            var delta2 = density - leaf_density_mean;
            leaf_density_m2 += delta * delta2;
          }
        } // otherwise skip density calculation
      },
      true // post-order traversal
    );

    var leaf_density_sd = Math.sqrt(leaf_density_m2 / (leaf_count - 1));

    var lower = leaf_density_mean - outlier_allowance * leaf_density_sd;
    var upper = leaf_density_mean + outlier_allowance * leaf_density_sd;

    var ll = min_density;
    if (min_as_zero) {
      ll = 0;
    }
    if (ll > lower) {
      lower = ll;
    }

    if (max_density < upper) {
      upper = max_density;
    }

    visit(
      tree,
      function (node, extent) {
        var w = extent[1][0] - extent[0][0];
        var h = extent[1][1] - extent[0][1];
        var is_leaf = (
          w < 2*max_resolution
       || h < 2*max_resolution
       || node.hasOwnProperty("items")
        );
        if (w < max_resolution || h < max_resolution) { // undefined works
          return IGNORE_CHILDREN; // doesn't count
        }
        var centroid = centroids["" + extent];
        var density = compute_density(tree, node, extent, centroid);
        // TODO: Which of these? Add a switch?
        if (min_as_zero) {
          var rel_density = density / max_density;
        } else {
          var rel_density = (density-min_density) / (max_density-min_density);
        }
        var std_density = (density - lower) / (upper - lower);
        results.push(
          {
            "extent": extent,
            "density": density,
            "relative_density": rel_density,
            "standard_density": std_density,
            "centroid": centroid,
            "is_leaf": is_leaf,
            "node": node
          }
        );
      }
    );
    return results;
  }

  // A generalization of density_areas, local_values can compute any custom set
  // of values from individual items and then collect averages up the tree.
  // It returns a mapping from stringified extents to value vectors, which for
  // nodes with single items, is the result of calling the values_function on
  // that item (that function must return an array). For nodes with multiple
  // items, each value in the values list is averaged across items in that
  // node.
  function local_values(tree, values_function, max_resolution) {
    return node_values(tree.root, tree.extent, values_function, max_resolution);
  }

  // Version of local_values that applies to an individual node instead of an
  // entire tree. Requires an extent to create an accurate cache.
  function node_values(node, extent, values_function, max_resolution) {
    results = [];
    var cache = {};
    // Visit post-order so that cache slots will be filled.
    visit_each_node(
      node,
      extent,
      function (node, extent) {
        var result;
        var ret;
        var w = extent[1][0] - extent[0][0];
        var h = extent[1][1] - extent[0][1];
        if (
          w < max_resolution
       || h < max_resolution
       || node.hasOwnProperty("items")
        ) { // a leaf node
          var items = node_items(node);
          var values_list = items.map(values_function);
          result = average_vectors(values_list);
          // no need to recurse further (we already did in node_items):
          ret = IGNORE_CHILDREN;
        } else {
          var sub_values = [];
          var sub_weights = [];
          for (var i = 0; i < node.children.length; ++i) {
            var k = "" + sub_extent(extent, i);
            if (cache.hasOwnProperty(k)) {
              sub_values.push(cache[k]);
              sub_weights.push(node.children[i].count);
            } // otherwise must have been an empty child
          }
          result = average_vectors(sub_values, sub_weights);
          ret = null;
        }
        cache["" + extent] = result;
        return ret;
      },
      true // post-order traversal
    );
    return cache;
  }

  function BaseFilter(dataset, index) {
    this.data = dataset;
    this.set_index(index);
  }

  BaseFilter.prototype.set_index = function (index) {
    if (typeof index === "string") {
      index = lookup_index(this.data, index);
    }
    this.index = index;
  };

  BaseFilter.prototype.filter = function (records) {
    return this.matching_pairs(records).map(x => x[1]);
  };

  BaseFilter.prototype.matching_indices = function (records) {
    return new Set(this.matching_pairs(records).map(x => x[0]));
  };


  // A filter that compares a field against a reference value using a
  // user-specified comparator.
  function ComparisonFilter(dataset, index, comparator, value) {
    BaseFilter.call(this, dataset, index);
    this.set_comparator(comparator);
    this.set_value(value);
  }

  ComparisonFilter.prototype = Object.create(BaseFilter.prototype);
  ComparisonFilter.prototype.constructor = ComparisonFilter;

  // static applicability check
  ComparisonFilter.applicable_to = function (dataset, index) {
    if (typeof index == "string") { index = lookup_index(dataset, index); }
    var typ = get_type$1(dataset, index);
    return typ.kind == "number" || typ.kind == "string";
  };

  ComparisonFilter.prototype.set_index = function (index) {
    Object.getPrototypeOf(
      ComparisonFilter.prototype
    ).set_index.call(this, index);
    this.nt = numerical_transform(this.data, this.index, false);
  };

  // Default accept function accepts everything
  ComparisonFilter.prototype.accept = function (record) { return true; };

  // Sets the comparator, building an accept function that dictates record
  // acceptance.
  ComparisonFilter.prototype.set_comparator = function (comparator) {
    this.comparator = comparator;
    if (comparator == "<") {
      this.accept = function (value) {
        return value < this.value;
      };
    } else if (comparator == "<=") {
      this.accept = function (value) {
        return value <= this.value;
      };
    } else if (comparator == ">") {
      this.accept = function (value) {
        return value > this.value;
      };
    } else if (comparator == ">=") {
      this.accept = function (value) {
        return value >= this.value;
      };
    } else if (comparator == "==") {
      this.accept = function (value) {
        return value == this.value;
      };
    } else if (comparator == "!=") {
      this.accept = function (value) {
        return value != this.value;
      };
    }
  };

  // Sets the value, casting it to a number
  ComparisonFilter.prototype.set_value = function (value) {
    var dt = get_type$1(this.data, this.index);
    if (typeof value == "number") {
      this.value = value;
    } else {
      this.value = Number.parseFloat(value);
    }
  };

  ComparisonFilter.prototype.repr = function () {
    return (
      "#"
    + get_name(this.data, this.index)
    + this.comparator
    + this.value
    );
  };

  // Just calls the accept function (see set_comparator).
  ComparisonFilter.prototype.matching_pairs = function(records) {
    var results = [];
    for (let i = 0; i < records.length; ++i) {
      var r = records[i];
      var val = this.nt.getter(r);
      if (this.accept(val)) {
        results.push([i, r]);
      }
    }

    return results;
  };


  // A filter that accepts values from a given set for a given field.
  function ValueSetFilter(dataset, index) {
    BaseFilter.call(this, dataset, index);
  }

  ValueSetFilter.prototype = Object.create(BaseFilter.prototype);
  ValueSetFilter.prototype.constructor = ValueSetFilter;

  // static applicability check
  ValueSetFilter.applicable_to = function (dataset, index) {
    return true;
  };

  ValueSetFilter.prototype.accept_all = function () {
    this.acceptable = new Set();
    for (let i = 0; i < this.ct.n_categories; ++i) {
      this.acceptable.add(i);
    }
  };

  ValueSetFilter.prototype.accept_none = function () {
    this.acceptable = new Set();
  };

  ValueSetFilter.prototype.set_index = function (index) {
    Object.getPrototypeOf(
      ValueSetFilter.prototype
    ).set_index.call(this, index);
    this.ct = categorical_transform(this.data, this.index);
    this.accept_all();
  };

  ValueSetFilter.prototype.set_accept = function (idx_or_label, accept) {
    var idx;
    if (typeof idx_or_label == "string") {
      idx = this.ct.labels.indexOf(idx_or_label);
      if (idx < 0) {
        console.warn("Unknown value for filter: '" + idx_or_label + "'");
      }
    } else {
      idx = idx_or_label;
    }
    if (accept) {
      this.acceptable.add(idx);
    } else {
      this.acceptable.delete(idx);
    }
  };

  ValueSetFilter.prototype.will_accept = function (idx_or_label, accept) {
    var idx;
    if (typeof idx_or_label == "string") {
      idx = this.ct.labels.indexOf(idx_or_label);
      if (idx < 0) {
        console.warn("Unknown value for filter: '" + idx_or_label + "'");
      }
    } else {
      idx = idx_or_label;
    }
    return this.acceptable.has(idx);
  };

  ValueSetFilter.prototype.repr = function () {
    return (
      "□"
    + get_name(this.data, this.index)
    + "∈{"
    + this.ct.labels.filter((x, i) => this.acceptable.has(i)).join("|")
    + "}"
    );
  };

  // Augments the dataset by adding the designated field to every record.
  ValueSetFilter.prototype.matching_pairs = function (records) {
    var results = [];
    for (let i = 0; i < records.length; ++i) {
      var r = records[i];
      var matches = false;
      var the_filter = this;
      this.acceptable.forEach(function (idx) {
        var val = the_filter.ct.getter(r, idx);
        if (val > 0) {
          matches = true;
        }
      });
      if (matches) {
        results.push([i, r]);
      }
    }

    return results;
  };

  /*
   * Module variables:
   */

  // Resolution at which to cut off quadtree recursion for drawing.
  var DEFAULT_MIN_RESOLUTION = undefined;

  // Default color scale
  var DEFAULT_COLOR_SCALE = magma;

  // The non-breaking space character
  var NBSP = "\u00A0";

  // Radius used for quadtree points when points_allowed is set to undefined.
  var QT_POINT_RADIUS = 1.5;

  // Font size above which we back off a bit for aesthetics
  var HUGE_FONT_SIZE = 24;

  // Computes a table layout with room at the top and left for the given
  // labels. The default padding (surrounding the whole table) is 0.02, while
  // the default row and column margins are 0.05 each. The default label size
  // is 0.15, which reserves 15% of the width (height) for row (column) labels.
  // Returns an object with the following fields:
  //
  //   padding:
  //     Padding amount on all sides. By default 0.02 * min(width, height).
  //   cl_height:
  //     Height reserved for column labels.
  //   rl_width:
  //     Width reserved for row labels.
  //   content_top:
  //     Distance from outer border to top of content (padding + cl_height).
  //   content_left:
  //     Distance from border to left edge of content (padding + rl_width).
  //   content_width,
  //   content_height:
  //     Width and height of content area.
  //   cell_width,
  //   cell_height:
  //     Width and height of content cells.
  //   cl_font_size,
  //   rl_font_size:
  //     Font sizes for the column and row labels.
  //   cell_font_size:
  //     Font size for the cells.
  function compute_matrix_layout(
    element,
    row_labels,
    col_labels,
    values,
    padding,
    label_size,
    row_margin,
    col_margin
  ) {
    if (padding == undefined) {
      padding = 0.02;
    }

    if (label_size == undefined) {
      label_size = 0.15;
    }

    if (row_margin == undefined) {
      row_margin = 0.05;
    }
    if (col_margin == undefined) {
      col_margin = 0.05;
    }

    var n_rows = row_labels.length;
    var n_cols = col_labels.length;

    var eh = element.attr("height"); // element height
    var ew = element.attr("width"); // element width

    //   padding:
    //     Padding amount on all sides. By default 0.02 * min(width, height).
    var pad = padding * Math.min(eh, ew);
    var result = { "padding": pad };

    //   cl_height:
    //     Height reserved for column labels.
    if (n_cols > 0) {
      result.cl_height = label_size * eh;
    } else {
      result.cl_height = 0;
    }
    //   rl_width:
    //     Width reserved for row labels.
    if (n_rows > 0) {
      result.rl_width = label_size * ew;
    } else {
      result.rl_width = 0;
    }

    //   content_top:
    //     Distance from outer border to top of content (padding + cl_height).
    //   content_left:
    //     Distance from border to left edge of content (padding + rl_width).
    //   content_width,
    //   content_height:
    //     Width and height of content area.
    result.content_top = result.cl_height + result.padding;
    result.content_left = result.rl_width + result.padding;
    result.content_height = eh - result.content_top - result.padding;
    result.content_width = ew - result.content_left - result.padding;

    //   cell_width,
    //   cell_height:
    //     Width and height of content cells.
    if (n_rows > 0) {
      result.cell_height = result.content_height / n_rows;
    } else {
      result.cell_height = result.content_height;
    }

    if (n_cols > 0) {
      result.cell_width = result.content_width / n_cols;
    } else {
      result.cell_width = result.content_width;
    }

    //   cl_font_size,
    //   rl_font_size:
    //     Font sizes for the column and row labels.
    result.cl_font_size = undefined;
    var col_label_box = { // column labels are drawn sideways
      "width": result.cl_height,
      "height": result.cell_width
    };
    for (let cl of col_labels) {
      let fs = font_size_for(col_label_box, cl);
      if (result.cl_font_size == undefined || fs < result.cl_font_size) {
        result.cl_font_size = fs;
      }
    }

    result.rl_font_size = undefined;
    var row_label_box = {
      "width": result.rl_width,
      "height": result.cell_height
    };
    for (let rl of row_labels) {
      let fs = font_size_for(row_label_box, rl);
      if (result.rl_font_size == undefined || fs < result.rl_font_size) {
        result.rl_font_size = fs;
      }
    }

    //   cell_font_size:
    //     Font size for the cells.
    result.cell_font_size = undefined;
    var cell_box = {
      "width": result.cell_width * (1 - 2*col_margin),
      "height": result.cell_height * (1 - 2*row_margin)
    };
    for (let v of values) {
      let fs = font_size_for(cell_box, "" + v);
      if (result.cell_font_size == undefined || fs < result.cell_font_size) {
        result.cell_font_size = fs;
      }
    }

    // scale back excessive font sizes:
    if (result.cl_font_size >= HUGE_FONT_SIZE) {
      result.cl_font_size = (
        HUGE_FONT_SIZE
      + (result.cl_font_size - HUGE_FONT_SIZE) * 0.6
      );
    }
    if (result.rl_font_size >= HUGE_FONT_SIZE) {
      result.rl_font_size = (
        HUGE_FONT_SIZE
      + (result.rl_font_size - HUGE_FONT_SIZE) * 0.6
      );
    }
    if (result.cell_font_size >= HUGE_FONT_SIZE) {
      result.cell_font_size = (
        HUGE_FONT_SIZE
      + (result.cell_font_size - HUGE_FONT_SIZE) * 0.6
      );
    }

    return result;
  }

  /*
   * Drawing functions
   */

  // Replaces the contents of the given SVG element with a visualization of the
  // given quadtree. The color_scale and min_resolution arguments are optional,
  // and will default to DEFAULT_COLOR_SCALE and DEFAULT_MIN_RESOLUTION if not
  // supplied. The default mode draws a centroid circle for each quadtree leaf
  // colored according to the number of points in that leaf. If as_rects is
  // given as other than undefined, each quadtree node will instead be shaded
  // according to its density. If color_by is defined, then color values will
  // be the result of that function applied to each data point (or averaged
  // over results for each point within a region). The special values "density"
  // and "standardized" will use relative or standardized density values from
  // the tree. The combination of color_by and as_rects = true may be slow.
  // Note that when color_by is not given and as_rects is off, the point size
  // scales slightly with density to somewhat enhance perceptual accuracy of
  // density among points, although of course there's still some distortion.
  // This size scaling is disabled when color_by is given. Use as_rects for a
  // less-biased view of density. The labels argument can be given to supply
  // labels for each item, but should usually only be used when the data is
  // sparse. Labels from multiple items are combined according to a
  // most-frequent scheme, and an asterisk is appended if the labels being
  // combined aren't all identical. If there's a tie for most-frequent, just an
  // asterisk is used. Labels are ignored completely when as_rects is true.
  function draw_quadtree(
    element,
    tree,
    color_scale,
    min_resolution,
    as_rects,
    color_by,
    labels
  ) {
    if (color_scale === undefined) {
      color_scale = DEFAULT_COLOR_SCALE;
    }

    if (min_resolution === undefined) {
      min_resolution = DEFAULT_MIN_RESOLUTION;
    }

    if (color_by === undefined) {
      color_by = "density";
    }

    var base_density;
    if (min_resolution != undefined) {
      base_density = 1 / (min_resolution * min_resolution * 4);
    } else {
      base_density = undefined;
    }

    var text = tree.extent;
    var tw = text[1][0] - text[0][0];
    var th = text[1][1] - text[0][1];

    // All rectangles
    var rects = density_areas(
      tree,
      min_resolution,
      base_density,
      true // min-as-zero
    );

    if (as_rects) { // shade density over rectangles
      if (color_by === "density") {
        function color_for(d) {
          return color_scale(d.relative_density);
        }
      } else if (color_by === "standardized") {
        function color_for(d) {
          return color_scale(d.standard_density);
        }
      } else {
        var color_values_cache = local_values(
            tree,
          function (item) { return [ color_by(item) ]; }
        );

        function color_for(d) {
          return color_scale(color_values_cache["" + d.extent][0]);
        }
      }

      // get rid of any old point data
      element.selectAll("circle").remove();
      // set up region data
      element.selectAll("rect").exit().remove();
      element.selectAll("rect")
        .data(rects)
      .enter().append("rect")
        .attr("class", "region")
        .attr("x", d => d.extent[0][0])
        .attr("y", d => d.extent[0][1])
        .attr(
          "width",
          function (d) {
            var e = d.extent;
            return e[1][0] - e[0][0];
          }
        )
        .attr(
          "height",
          function (d) {
            var e = d.extent;
            return e[1][1] - e[0][1];
          }
        )
        .attr("fill", color_for);

    } else { // draw points (the default)
      // get rid of any old region data
      element.selectAll("rect").remove();

      // figure out coloring
      if (color_by === "density") {
        function color_for(d) {
          return color_scale(d.relative_density);
        }
      } else if (color_by === "standardized") {
        function color_for(d) {
          return color_scale(d.standard_density);
        }
      } else {
        function color_for(d) {
          var items = node_items(d.node);
          var c = 0;
          for (var i = 0; i < items.length; ++i) {
            c += color_by(items[i]);
          }
          c /= items.length;
          return color_scale(c);
        }
      }

      // Just the leaves
      var leaves = rects.filter(rect => rect.is_leaf);
      //*
      element.selectAll("circle").exit().remove();
      element.selectAll("circle")
        .data(leaves)
      .enter().append("circle")
        .attr("class", "point")
        .attr("cx", d => d.centroid[0] || 0)
        .attr("cy", d => d.centroid[1] || 0)
        .attr("r", QT_POINT_RADIUS)
        .attr("fill", color_for);

      if (labels != undefined) {
        function label_for(d) {
          var items = node_items(d.node);
          if (items.length == 1) {
            return "" + labels(items[0]);
          } else {
            var frequencies = {};
            for (var i = 0; i < items.length; ++i) {
              var l = "" + labels(items[i]);
              if (frequencies.hasOwnProperty(l)) {
                frequencies[l] += 1;
              } else {
                frequencies[l] = 1;
              }
            }
            return dominance_summary(frequencies);
          }
        }
        element.selectAll("text").exit().remove();
        element.selectAll("text")
          .data(leaves)
        .enter().append("text")
          .attr("class", "label")
          .attr("x", d => d.centroid[0] + 3)
          .attr("y", d => d.centroid[1] - 3)
          .attr("fill", color_for)
          .attr("dominant-baseline", "auto")
          .attr("text-anchor", "start")
          .text(d => label_for(d));
      }
    }
  }

  // Draws a horizontal histogram with value labels on the left, sorting bars
  // by their height. Optional parameters:
  //    ordering
  //      Specifies the natural ordering of the bins (ignored if sort is
  //      given).
  //    bar_limit
  //      Crops off bars beyond the limit. Missing = no limit. A value of
  //      ~30-50 is suggested to avoid text overlap. Can give explicitly as
  //      'undefined' if you want to pass other optional options.
  //    color_scale (defaults to DEFAULT_COLOR_SCALE)
  //      Used to color the bars
  //    sort
  //      Sort the bars by their values from highest to lowest.
  //    normalize
  //      If it's a single value, each count is divided. Pass the number of
  //      source items here to graph averages instead of total counts. Can also
  //      be a map from values to numbers to use a different divisor for each
  //      value. Defaults to 1 (no normalization).
  function draw_histogram(
    element,
    counts,
    ordering,
    bar_limit,
    color_scale,
    sort,
    normalize
  ) {
    if (color_scale === undefined) {
      color_scale = DEFAULT_COLOR_SCALE;
    }

    if (normalize === undefined) {
      normalize = 1;
    }

    if (typeof normalize === "object") {
      function bar_value(value) {
        var nv = normalize[value];
        if (Number.isFinite(nv) && nv != 0) {
          return counts[value] / nv;
        } else {
          return NaN;
        }
      }
      function bar_label(value) {
        return "" + format_number(bar_value(value)) +"×"+normalize[value];
      }
    } else {
      function bar_value(value) {
        var nv = normalize;
        if (Number.isFinite(nv) && nv != 0) {
          return counts[value] / nv;
        } else {
          return NaN;
        }
      }
      if (normalize == 1) {
        function bar_label(value) {
          return "" + format_number(bar_value(value));
        }
      } else {
        function bar_label(value) {
          return "" + format_number(bar_value(value)) + "×" + normalize;
        }
      }
    }

    // clear out any old stuff:
    element.selectAll("*").remove();

    var pairs = [];
    var min = undefined;
    var max = undefined;
    var iterate_over = ordering || Object.keys(counts);
    for (let i = 0; i < iterate_over.length; ++i) {
      var key = iterate_over[i];
      if (counts.hasOwnProperty(key)) {
        var bv = bar_value(key);
        pairs.push([key, bv]);
        if (max === undefined || max < bv) {
          max = bv;
        }
        if (min === undefined || min > bv) {
          min = bv;
        }
      }
    }

    if (sort) {
      // reverse sort order to put largest bars first
      pairs.sort((a, b) => -(a[1] - b[1]));
    }

    if (bar_limit != undefined) {
      pairs = pairs.slice(0, bar_limit);
    }

    var eh = element.attr("height"); // element height
    var pad = 0.02 * eh; // 2% padding on top and bottom

    var bh = (eh - 2*pad) / pairs.length; // bar height
    var bpad = 0.03 * bh; // 3% padding for each bar
    var bih = bh - 2*bpad; // bar inner height

    var ew = element.attr("width");
    var lx = ew * 0.20; // 20% for value labels
    var lw = lx - 0.02 * ew;
    var blw = ew * 0.1; // 10% for bar labels
    var bx;
    var bw;

    // set min to 0 if it's larger than 0, and provide extra space for labels
    // on the left:
    if (min > 0) {
      min = 0;
      // bars stat where value labels are
      bx = lx;
      // subtract bar start, bar label width, and right margin
      bw = ew - bx - blw - 0.02 * ew;
    } else {
      // bars stat where value labels are, plus room for count labels
      bx = lx + blw;
      // subtract bar start, bar label width, and right margin
      bw = ew - bx - blw - 0.02 * ew;
    }

    // compute label sizes:
    var value_label_box = { "width": lw, "height": bh };
    var count_label_box = { "width": blw, "height": bh };
    
    function value_label(d) {
      return "" + d[0] + NBSP;
    }

    var value_fs = undefined;
    var count_fs = undefined;
    for (var p of pairs) {
      var fs = font_size_for(value_label_box, value_label(p));
      if (value_fs == undefined || fs < value_fs) {
        value_fs = fs;
      }
      var fs = font_size_for(count_label_box, bar_label(p[0]) + NBSP);
      if (count_fs == undefined || fs < count_fs) {
        count_fs = fs;
      }
    }

    // x-value for zero
    var zero_x = bx + bw * (0 - min) / (max - min);

    function bar_width(d) {
      if (
        Number.isFinite(d[1])
     && Number.isFinite(max)
     && Number.isFinite(min)
     && max > min
      ) {
        return bw * Math.abs(d[1]) / (max - min);
      } else {
        return 0;
      }
    }

    var bargroup = element.selectAll("g")
      .data(pairs)
      .enter()
      .append("g")
        .attr("class", "bar_group")
        .attr(
          "transform",
          function(d, i) {
            var y = pad + i * bh;
            return "translate(0," + y + ")"
          }
        );
    bargroup.append("rect") // the bar itself
      .attr("class", "bar")
      .attr("x", d => (d[1] >= 0 ? zero_x : zero_x - bar_width(d)))
      .attr("y", bpad)
      .attr("width", bar_width)
      .attr("height", bih)
      .attr("fill", function(d) { return color_scale(d[1]/max); });
    bargroup.append("text") // value label before bar
      .attr("class", "label")
      .attr("x", lx)
      .attr("y", bpad + bih/2)
      .attr("dominant-baseline", "middle")
      .attr("text-anchor", "end")
      .attr("font-size", value_fs + "px")
      .text(d => value_label(d));
    bargroup.append("text") // count label at end of bar
      .attr("class", "label")
      .attr(
        "x",
        d => d[1] >= 0 ? zero_x + bar_width(d) : zero_x - bar_width(d)
      )
      .attr("y", bpad + bih/2)
      .attr("dominant-baseline", "middle")
      .attr("text-anchor", d => d[1] >= 0 ? "start" : "end")
      .attr("font-size", count_fs + "px")
      .text(d => d[1] >= 0 ? NBSP + bar_label(d[0]) : bar_label(d[0]) + NBSP);
  }

  // Draws a matrix with row and column labels, where each cell displays a
  // color according to the value from a matrix. If label color isn't given,
  // labels aren't shown; the default missing color is white.
  function draw_matrix(
    element,
    matrix,
    /*
    counts,
    stdevs,
    */
    val_domain,
    col_labels,
    row_labels,
    color_scale,
    missing_color,
    label_color
  ) {
    if (color_scale === undefined) {
      color_scale = DEFAULT_COLOR_SCALE;
    }

    missing_color = missing_color || "#ffffff";

    if (val_domain == undefined) {
      var lower = 0;
      var upper = 1;
    } else {
      var lower = val_domain[0];
      var upper = val_domain[1];
    }

    function nv(val) {
      if (lower == upper) {
        return val;
      } else {
        return (val - lower) / (upper - lower);
      }
    }

    // clear out any old stuff:
    element.selectAll("*").remove();

    var items = [];
    var n_cols = matrix.length;
    for (let c = 0; c < matrix.length; ++c) {
      if (matrix[c] != undefined) {
        for (let r = 0; r < matrix[c].length; ++r) {
          var val = matrix[c][r];
          items.push([[c, r], val, nv(val)]);
        }
      }
    }

    function display_value(d) {
      return format_number(d[1], "∙");
    }

    // add spacing before computing layout!
    row_labels = row_labels.map(x => x + NBSP);
    col_labels = col_labels.map(x => x + NBSP);

    var layout = compute_matrix_layout(
      element,
      row_labels,
      col_labels,
      items.map(it => display_value(it))
    );

    var ch = layout.cell_height;
    var cw = layout.cell_width;

    element.selectAll("text.row") // row label at left
      .data(row_labels)
    .enter().append("text")
      .attr("class", "row label")
      .attr("x", layout.content_left)
      .attr("y", (d, i) => layout.content_top + i * ch + ch/2)
      .attr("dominant-baseline", "middle")
      .attr("text-anchor", "end")
      .attr("font-size", layout.rl_font_size + "px")
      .text(d => d);

    element.selectAll("text.column")
      .data(col_labels)
    .enter().append("text")
      .attr("class", "column label")
      .attr("x", 0)
      .attr("y", 0)
      .attr("transform", function (d, i) {
        var x = layout.content_left + i * cw + cw/2;
        var y = layout.content_top;
        return "translate(" + x + "," + y + "), rotate(90)";
      })
      .attr("dominant-baseline", "middle")
      .attr("text-anchor", "end")
      .attr("font-size", layout.cl_font_size + "px")
      .text(d => d);

    var cellgroup = element.selectAll("g")
      .data(items)
    .enter().append("g")
      .attr("class", "cell_group")
      .attr(
        "transform",
        function(d) {
          var c = d[0][0];
          var r = d[0][1];
          var x = layout.content_left + c * cw;
          var y = layout.content_top + r * ch;
          return "translate(" + x + "," + y + ")"
        }
      );
    cellgroup.append("rect") // the cell itself
      .attr("class", "bar")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", cw)
      .attr("height", ch)
      .attr("fill", function(d) {
        var val = d[2];
        if (val == undefined || Number.isNaN(val)) {
          return missing_color;
        } else {
          return color_scale(val);
        }
      });
    if (label_color != undefined) {
      cellgroup.append("text") // value label inside cell
        .attr("class", "label")
        .attr("x", cw/2)
        .attr("y", ch/2)
        .attr("font-size", layout.cell_font_size + "px")
        .attr("dominant-baseline", "middle")
        .attr("text-anchor", "middle")
        .style("fill", label_color)
        .text(display_value);
    }
  }

  //////////////////////
  // Shared constants //
  //////////////////////

  // Padding in the domain (% of normal range)
  var DOMAIN_PADDING = 0.03;

  // Mouse scroll correction factors:
  var PIXELS_PER_LINE = 18;
  var LINES_PER_PAGE = 40;
  var SCROLL_FACTOR = 10; // pixels of scroll per 1% radius adjust

  // Regex for finding an integer in a string:
  var FIND_INT = /[0-9]+/;

  // Threshold for using textbox selection for multiple values
  var LOTS_OF_VALUES_THRESHOLD = 7;

  // Milliseconds to wait after focusout event before closing a menu
  var MENU_TIMEOUT_HACK = 180;

  // Width (in pixels) that help text boxes will attempt to clear from the
  // right side of the screen during pre-placement adjustments.
  var HELP_CLEAR_WIDTH = 240;

  // Minimum margin between help boxes and the edges of the page.
  var HELP_MARGIN = 3;

  // Factor used for zooming with the scroll wheel.
  var ZOOM_FACTOR = 0.1;

  ////////////////
  // BaseWidget //
  ////////////////
  // Shared widget functionality

  function BaseWidget() {
    this.node == undefined;
  }

  BaseWidget.prototype.put_controls = function (node, insert_before) {
    if (node != this.node && node != undefined && this.node != undefined) {
      this.remove();
    }
    if (this.node == undefined) {
      if (node == undefined) { return false; } // we have nowhere to go
      if (node.classed("controls_row") || node.classed("controls_span")) {
        if (insert_before) {
          this.node = node.insert(
            "span",
            insert_before
          ).attr("class", "controls_span");
        } else {
          this.node = node.append("span").attr("class", "controls_span");
        }
      } else {
        if (insert_before) {
          this.node = node.insert(
            "div",
            insert_before
          ).attr("class", "controls_row");
        } else {
          this.node = node.append("div").attr("class", "controls_row");
        }
      }
    } else {
      this.node.selectAll("*").remove();
    }
    return true; // placed successfully
  };

  BaseWidget.prototype.remove = function () {
    if (this.node) { this.node.remove(); }
    this.node = undefined;
  };

  BaseWidget.prototype.enable = function () {
    this.node.selectAll("input, select, textarea").attr("disabled", null);
  };

  BaseWidget.prototype.disable = function () {
    this.node.selectAll("input, select, textarea").attr("disabled", true);
  };

  BaseWidget.prototype.trigger_callback = function (...args) {
    if (this.callback) {
      this.callback.apply(this, args);
    }
  };

  ////////////////
  // HelpWidget //
  ////////////////

  // A question-mark symbol that when hovered will display a message and when
  // clicked will display a pop-up with that message.
  function HelpWidget(text) {
    BaseWidget.call(this);
    this.text = text;
    this.callback = undefined;
  }

  HelpWidget.prototype = Object.create(BaseWidget.prototype);
  HelpWidget.prototype.constructor = HelpWidget;

  HelpWidget.prototype.put_controls = function (node, insert_before) {
    if (
      !Object.getPrototypeOf(
        HelpWidget.prototype
      ).put_controls.call(this, node, insert_before)
    ) { return false; }  var the_widget = this;
    var text;
    if (typeof this.text === "function") {
      text = this.text();
    } else {
      text = this.text;
    }
    var button = this.node.append("a")
      .attr("class", "gray_button button")
      .text("?")
      .on("mouseover", function () {
        var bbox = get_bbox(the_widget.node);
        if (the_widget.popup) {
          the_widget.popup.remove();
          the_widget.popup = undefined;
        }
        var html = select("html").node();
        let scroll_x = html.scrollLeft;
        let scroll_y = html.scrollTop;
        let el_top = bbox.y + scroll_y;
        let el_left = bbox.x + scroll_x;
        let orig_bottom = html.scrollHeight;
        let orig_right = html.scrollWidth;
        if (el_left + HELP_CLEAR_WIDTH > orig_right - HELP_MARGIN) {
          el_left = orig_right - HELP_MARGIN - HELP_CLEAR_WIDTH;
        }
        the_widget.popup = select("body").append("div")
          .attr("class", "help")
          .style("top", el_top + "px")
          .style("left", el_left + "px")
          .style("position", "absolute")
          .text(text)
          .on("mouseout", function () {
            if (the_widget.popup) {
              the_widget.popup.remove();
              the_widget.popup = undefined;
            }
          });
        let sh = the_widget.popup.node().scrollHeight;
        if (sh >= orig_bottom - 2*HELP_MARGIN) { // to big to fit
          the_widget.popup.style("top", HELP_MARGIN + "px");
        } else if (el_top + sh > orig_bottom - HELP_MARGIN) {
          the_widget.popup.style("top", "");
          the_widget.popup.style("bottom", (HELP_MARGIN - scroll_y) + "px");
        }
        let sw = the_widget.popup.node().scrollWidth;
        if (sw >= orig_right - 2*HELP_MARGIN) { // to big to fit
          the_widget.popup.style("left", HELP_MARGIN + "px");
        } else if (el_left + sw > orig_right - HELP_MARGIN) {
          the_widget.popup.style("left", "");
          the_widget.popup.style("right", (HELP_MARGIN - scroll_x) + "px");
        }
      });
    return true;
  };

  //////////////////
  // ButtonWidget //
  //////////////////

  // A button with the given label.
  // The callback will be called whenever the button is activated.
  function ButtonWidget(
    label,
    callback
  ) {
    BaseWidget.call(this);
    this.label = label;
    this.callback = callback;
  }

  ButtonWidget.prototype = Object.create(BaseWidget.prototype);
  ButtonWidget.prototype.constructor = ButtonWidget;

  ButtonWidget.prototype.put_controls = function (node, insert_before) {
    if (
      !Object.getPrototypeOf(
        ButtonWidget.prototype
      ).put_controls.call(this, node, insert_before)
    ) { return false }  var the_widget = this;
    var ltext;
    if (typeof this.label === "function") {
      ltext = this.label(this);
    } else {
      ltext = this.label;
    }
    var button = this.node.append("input")
      .attr("type", "button")
      .attr("value", ltext)
      .on("click touchend", function () {
        the_widget.trigger_callback();
      });
    return true;
  };

  //////////////////
  // ToggleWidget //
  //////////////////

  // A check box followed by the given text.
  // The callback will be called with either true or false whenever the box is
  // toggled.
  function ToggleWidget(
    label,
    default_on,
    callback
  ) {
    BaseWidget.call(this);
    this.label = label;
    this.default_on = default_on;
    this.callback = callback;
  }

  ToggleWidget.prototype = Object.create(BaseWidget.prototype);
  ToggleWidget.prototype.constructor = ToggleWidget;

  ToggleWidget.prototype.put_controls = function (node, insert_before) {
    if (
      !Object.getPrototypeOf(
        ToggleWidget.prototype
      ).put_controls.call(this, node, insert_before)
    ) { return false; }
    var the_widget = this;
    var select = this.node.append("input")
      .attr("type", "checkbox")
      .on("change", function () {
        the_widget.trigger_callback(this.checked);
      });
    if (this.default_on) {
      select.attr("checked", true);
    }
    var ltext;
    if (typeof this.label === "function") {
      ltext = this.label(this);
    } else {
      ltext = this.label;
    }
    this.node.append("span")
      .attr("class", "label")
      .text(ltext);
    return true;
  };

  //////////////////
  // SelectWidget //
  //////////////////

  // A select box that includes the given options (preceded by the given
  // label). The callback will be called with the selected value as an argument
  // whenever the user selects a new option.
  function SelectWidget(
    label,
    options,
    default_option,
    callback
  ) {
    BaseWidget.call(this);
    this.label = label;
    this.options = options;
    this.default_option = default_option || undefined;
    this.callback = callback;
  }

  SelectWidget.prototype = Object.create(BaseWidget.prototype);
  SelectWidget.prototype.constructor = SelectWidget;

  SelectWidget.prototype.put_controls = function (node, insert_before) {
    if (
      !Object.getPrototypeOf(
        SelectWidget.prototype
      ).put_controls.call(this, node, insert_before)
    ) { return false; }
    var ltext;
    if (typeof this.label === "function") {
      ltext = this.label(this);
    } else {
      ltext = this.label;
    }
    this.node.append("span").attr("class", "label").text(ltext);
    var the_widget = this;
    var opts;
    if (typeof this.options === "function") {
      opts = this.options(this);
    } else {
      opts = this.options;
    }
    var dopt;
    if (typeof this.default_option === "function") {
      dopt = this.default_option(this);
    } else if (this.default_option != undefined) {
      dopt = this.default_option;
    } else {
      dopt = this.options[0];
    }
    var select = this.node.append("select")
      .on("change", function () {
        the_widget.trigger_callback(get_selected_value(this));
      });
    select.selectAll("option").exit().remove();
    select.selectAll("option")
      .data(opts)
    .enter().append("option")
      .attr("value", d => d)
      .text(d => d);
    select.selectAll("option")
      .filter(d => d == dopt)
      .attr("selected", true);
    return true;
  };

  //////////////////////
  // TextSelectWidget //
  //////////////////////

  // An input box that drops down options and completes matching ones from
  // typed text (preceded by the given label). The callback will be called with
  // the selected value as an argument whenever the user selects a new option;
  // if given, the option_names are displayed to the user instead of the option
  // values. The always_blank optional flag controls whether the widget blanks
  // on selection or displays the selected value.
  function TextSelectWidget(
    label,
    options,
    default_option,
    callback,
    option_names,
    always_blank
  ) {
    BaseWidget.call(this);
    this.label = label;
    this.options = options;
    this.option_names = option_names;
    this.default_option = default_option || undefined;
    this.callback = callback;
    this.always_blank = always_blank || false;
    this.node = undefined;
    this.input = undefined;
    this.matches = undefined;
    this.display_text = undefined;
    var def;
    if (typeof this.default_option == "function") {
      def = this.default_option(this);
    } else {
      def = this.default_option;
    }
    if (def) {
      var opts;
      if (typeof this.options == "function") {
        opts = this.options(this);
      } else {
        opts = this.options;
      }
      let di = opts.indexOf(def);

      if (di >= 0) {
        var onames;
        if (typeof this.option_names == "function") {
          onames = this.option_names(this);
        } else if (this.option_names) {
          onames = this.option_names;
        } else {
          onames = opts.map(x => "" + x);
        }

        this.display_text = onames[di];
      }
    }
    this.highlighted_index = 0;
    this.displayed_options = [];
  }

  TextSelectWidget.prototype = Object.create(BaseWidget.prototype);
  TextSelectWidget.prototype.constructor = TextSelectWidget;

  TextSelectWidget.prototype.cleanup = function () {
    if (this.display_text && !this.always_blank) {
      this.input.property("value", this.display_text);
    } else {
      this.input.property("value", "");
    }
    this.input.node().blur();
    this.highlighted_index = 0;
    this.displayed_options = undefined;

    if (this.matches) {
      this.matches.remove();
      this.matches = undefined;
    }
  };

  TextSelectWidget.prototype.designate = function (value, display) {
    this.display_text = display;
    this.trigger_callback(value);
  };

  TextSelectWidget.prototype.put_controls = function (node, insert_before) {
    if (
      !Object.getPrototypeOf(
        TextSelectWidget.prototype
      ).put_controls.call(this, node, insert_before)
    ) { return false; }
    var the_widget = this;
    var ltext;
    if (typeof this.label === "function") {
      ltext = this.label(this);
    } else {
      ltext = this.label;
    }
    this.node.text(ltext);

    var opts;
    if (typeof this.options === "function") {
      opts = this.options(this);
    } else {
      opts = this.options;
    }
    var onames;
    if (typeof this.option_names === "function") {
      onames = this.option_names(this);
    } else if (this.option_names) {
      onames = this.option_names;
    } else {
      onames = opts.map(x => "" + x);
    }
    var dopt;
    if (typeof this.default_option === "function") {
      dopt = this.default_option(this);
    } else if (this.default_option != undefined) {
      dopt = this.default_option;
    } else {
      dopt = this.options[0];
    }
    this.input = this.node.append("input")
      .attr("type", "text")
      .attr("class", "field_select")
      .property("value", this.display_text || "")
      .on("focusout", function () {
        var evt = event;
        if (evt.relatedTarget != null) {
          the_widget.cleanup();
        } else {
          // TODO: A better solution to this!?!
          window.setTimeout(
            function () { the_widget.cleanup(); },
            MENU_TIMEOUT_HACK
          );
        }
      })
      .on("focusin keyup", function () {
        var evt = event;
        if (evt.type == "focusin") {
          the_widget.input.property("value", "");
          the_widget.highlighted_index = 0;
        }

        // compute and store displayed options:
        var sofar = get_text_value(the_widget.input.node());
        var fragments = sofar.split(" ");
        var possibilities = Array.from({length: opts.length}, (x,i) => i);
        if (sofar != "") {
          for (let fr of fragments) {
            var subset = new Set(
              text_match_indices(onames, fr)
            );
            var next = [];
            for (let i = 0; i < possibilities.length; ++i) {
              if (subset.has(possibilities[i])) {
                next.push(possibilities[i]);
              }
            }
            possibilities = next;
          }
        }
        the_widget.displayed_options = possibilities;

        if (evt.key && possibilities.length > 0) {
          if (evt.key == "Enter") {
            // select currently-highlighted element
            let di = the_widget.displayed_options[the_widget.highlighted_index];
            the_widget.designate(opts[di], onames[di]);
            the_widget.cleanup();
            return; // no further processing
          } else if (evt.key == "ArrowDown") {
            if (the_widget.displayed_options.length > 0) {
              the_widget.highlighted_index += 1;
              the_widget.highlighted_index %=
                the_widget.displayed_options.length;
            } else {
              the_widget.highlighted_index = 0;
            }
          } else if (evt.key === "ArrowUp") {
            if (the_widget.displayed_options.length > 0) {
              the_widget.highlighted_index += (
                the_widget.displayed_options.length - 1
              );
              the_widget.highlighted_index %=
                the_widget.displayed_options.length;
            } else {
              the_widget.highlighted_index = 0;
            }
          }
        }
        // now re-filter options
        if (the_widget.matches === undefined) {
          the_widget.matches = the_widget.node.insert(
            "div",
            ".field_select + *"
          );
          the_widget.matches.attr("class", "matchbox");
        } else {
          the_widget.matches.selectAll("*").remove();
        }
        if (the_widget.displayed_options.length == 0) {
          the_widget.matches.append("span")
            .attr("class", "match_empty")
            .text("<no matches>");
        } else {
          the_widget.matches.selectAll("*").remove();
          the_widget.matches.selectAll("a")
            .data(
              the_widget.displayed_options.map(oi => [opts[oi], onames[oi]])
            )
          .enter().append("a")
            .attr(
              "class",
              (d, i) => (
                i == the_widget.highlighted_index ?
                  "match_item selected"
                : "match_item"
              )
            )
            .text(d => d[1])
            .on("click touchend", function (d) {
              the_widget.designate(d[0], d[1]);
              the_widget.cleanup();
            });
        }
      });
    return true;
  };

  /////////////////
  // ColorWidget //
  /////////////////

  // A color selection widget that just selects a single color. The callback
  // will be called with the color selected (an HTML RGB string) as the first
  // argument.
  function ColorWidget(label, default_color, callback) {
    BaseWidget.call(this);
    this.label = label;
    this.callback = callback;
    this.color = undefined;

    this.set_color(default_color);
  }

  ColorWidget.prototype = Object.create(BaseWidget.prototype);
  ColorWidget.prototype.constructor = ColorWidget;

  // Sets the color function for the widget.
  ColorWidget.prototype.set_color = function(color) {
    this.color = color;
  };

  // Adds the widget to a node.
  ColorWidget.prototype.put_controls = function (node, insert_before) {
    if (
      !Object.getPrototypeOf(
        ColorWidget.prototype
      ).put_controls.call(this, node, insert_before)
    ) { return false; }
    this.node.text(this.label);
    // custom flat color picker
    var the_widget = this;
    this.node.append("input")
      .attr("class", "spaced_inline")
      .attr("type", "color")
      .attr("value", this.color)
    .on("change", function () {
      the_widget.set_color(this.value);
      the_widget.trigger_callback(this.value);
    });
    return true;
  };

  //////////////////////
  // ColorScaleWidget //
  //////////////////////

  // Available preset color schemes & gradients:
  // TODO: Return 0--1 shifted divided gradients instead of integer schemes!
  var CAT_SCHEMES = {
    "cat10": undefined,
    "accent": undefined,
    "dark2": undefined,
    "paired": undefined,
    "pastel1": undefined,
    "pastel2": undefined,
    "set1": undefined,
    "set2": undefined,
    "set3": undefined,
  };
  var DV_GRADIENTS = {
    "brbg": undefined,
    "prgn": undefined,
    "piyg": undefined,
    "puor": undefined,
    "rdbu": undefined,
    "rdgy": undefined,
    "rdlybu": undefined,
    "rdylgn": undefined,
    "spectral": undefined,
  };
  var SQ_GRADIENTS = {
    "gr": undefined,
    "ge": undefined,
    "or": undefined,
    "rd": undefined,
    "pu": undefined,
    "bu": undefined,
    "viridis": undefined,
    "inferno": undefined,
    "magma": undefined,
    "plasma": undefined,
    "warm": undefined,
    "cubehelix": undefined,
    "ylgn": undefined,
    "gnbu": undefined,
    "pubu": undefined,
    "purd": undefined,
    "rdpu": undefined,
    "orrd": undefined,
    "pubugn": undefined,
    "ylgnbu": undefined,
    "ylorrd": undefined,
  };
  var CYC_GRADIENTS = {
    "rainbow": undefined,
  };
  // Map of all possible gradients:
  var ALL_GRADIENTS = Object.assign(
    {},
    CAT_SCHEMES,
    DV_GRADIENTS,
    SQ_GRADIENTS,
    CYC_GRADIENTS
  );

  // A color selection widget that can add itself to an element, react to user
  // input on the added controls, and supply a color interpolation function. A
  // callback may be supplied which will be called with the widget as an
  // argument whenever the user changes the color or gradient selected.
  function ColorScaleWidget(
    default_selection,
    default_color,
    default_custom_start,
    default_custom_end,
    callback
  ) {
    BaseWidget.call(this);
    this.default_selection = default_selection;
    this.flat_color = default_color;
    this.custom_gradient_start = default_custom_start;
    this.custom_gradient_end = default_custom_end;
    this.callback = callback;

    if (default_selection == "flat") {
      this.set_color(default_color);
    } else if (ALL_GRADIENTS.hasOwnProperty(default_selection)) {
      this.set_color(ALL_GRADIENTS[default_selection]);
    } else {
      this.set_color(default_selection);
    }
  }

  ColorScaleWidget.prototype = Object.create(BaseWidget.prototype);
  ColorScaleWidget.prototype.constructor = ColorScaleWidget;

  // Sets the color function for the widget. The special value "custom" can be
  // used to fall back to a gradient between the default custom start/end.
  ColorScaleWidget.prototype.set_color = function(color) {
    if (color === "custom") {
      this.color = cubehelix$2(
        this.custom_gradient_start,
        this.custom_gradient_end
      );
    } else {
      this.color = color;
    }
  };

  // Get the domain of the color gradient function for this widget. Returned as
  // an array of start/end numbers.
  ColorScaleWidget.prototype.get_domain = function () {
    if (typeof this.color === "string") {
      return [ 0, 0 ];
    } else {
      return [ 0, 1 ];
    }
  };

  // Extracts a gradient function 
  ColorScaleWidget.prototype.get_gradient = function () {
    if (typeof this.color === "string") {
      return x => this.color;
    } else if (Array.isArray(this.color)) {
      var the_widget = this;
      return function (t) {
        var i = Math.floor(the_widget.color.length * t);
        if (i < 0) { i = 0; }
        if (i > the_widget.color.length - 1) {
          i = the_widget.color.length - 1;
        }
        return the_widget.color[i];
      };
    } else { // hopefully should be a gradient already
      return this.color;
    }
  };

  // Extracts a CSS background style property
  ColorScaleWidget.prototype.get_css_gradient = function () {
    if (typeof this.color === "string") {
      return this.color;
    } else if (Array.isArray(this.color)) {
      return css_scheme("to right", this.color);
    } else { // hopefully should be a gradient already
      return css_gradient("to right", this.color);
    }
  };

  ColorScaleWidget.prototype.put_controls = function (node, insert_before) {
    if (
      !Object.getPrototypeOf(
        ColorScaleWidget.prototype
      ).put_controls.call(this, node, insert_before)
    ) { return false; }
    this.node.text("Color scale: ");
    // custom option
    var cs_select = this.node.append("select");
    cs_select.append("option")
      .attr("value", "flat")
      .text("flat");
    cs_select.append("option")
      .attr("value", "custom")
      .text("custom");
    // grouped options
    var cat_group = cs_select.append("optgroup")
      .attr("label", "Categorical");
    cat_group.selectAll("option")
      .data(Object.keys(CAT_SCHEMES))
    .enter().append("option")
      .attr("value", d => d)
      .text(d => d);
    var dv_group = cs_select.append("optgroup")
      .attr("label", "Diverging");
    dv_group.selectAll("option")
      .data(Object.keys(DV_GRADIENTS))
    .enter().append("option")
      .attr("value", d => d)
      .text(d => d);
    var sq_group = cs_select.append("optgroup")
      .attr("label", "Sequential");
    sq_group.selectAll("option")
      .data(Object.keys(SQ_GRADIENTS))
    .enter().append("option")
      .attr("value", d => d)
      .text(d => d);
    var cyc_group = cs_select.append("optgroup")
      .attr("label", "Cyclical");
    cyc_group.selectAll("option")
      .data(Object.keys(CYC_GRADIENTS))
    .enter().append("option")
      .attr("value", d => d)
      .text(d => d);
    // Set default
    var the_widget = this;
    cs_select.selectAll("option")
      .filter(function() { return this.value == the_widget.default_selection; })
      .attr("selected", true);

    // custom flat color picker
    var cs_flat = this.node.append("input")
      .attr("class", "spaced_inline")
      .attr("type", "color")
      .attr("value", this.flat_color);

    if (this.default_selection != "flat") {
      cs_flat.style("display", "none");
    }

    // custom gradient color pickers
    var cs_custom = this.node.append("span")
      .attr("class", "spaced_inline");
    cs_custom.append("span").text("( ");
    var cg_start = cs_custom.append("input")
      .attr("type", "color")
      .attr("value", this.custom_gradient_start);
    cs_custom.append("span").text(" to ");
    var cg_end = cs_custom.append("input")
      .attr("type", "color")
      .attr("value", this.custom_gradient_end);
    cs_custom.append("span").text(" )");

    if (this.default_selection != "custom") {
      cs_custom.style("display", "none");
    }

    // gradient demo
    var cs_demo = this.node.append("span")
      .attr("class", "gradient_demo")
      .style("background", the_widget.get_css_gradient());

    // Color scale select:
    var the_widget = this;
    cs_select.on("change", function () {
      var sel = get_selected_value(this);
      if (sel === "flat") {
        cs_flat.style("display", "inline");
        cs_custom.style("display", "none");
        the_widget.set_color(the_widget.flat_color);
      } else if (sel === "custom") {
        cs_flat.style("display", "none");
        cs_custom.style("display", "inline");
        the_widget.set_color("custom");
      } else {
        cs_flat.style("display", "none");
        cs_custom.style("display", "none");
        the_widget.set_color(ALL_GRADIENTS[sel]);
      }
      cs_demo.style("background", the_widget.get_css_gradient());
      the_widget.trigger_callback();
    });

    cs_flat.on("change", function () {
      the_widget.flat_color = this.value;
      the_widget.set_color(the_widget.flat_color);
      cs_demo.style("background", the_widget.get_css_gradient());
      the_widget.trigger_callback();
    });

    // Custom gradient color select:
    cg_start.on("change", function () {
      the_widget.custom_gradient_start = this.value;
      the_widget.set_color("custom");
      cs_demo.style("background", the_widget.get_css_gradient());
      the_widget.trigger_callback();
    });
    cg_end.on("change", function () {
      the_widget.custom_gradient_end = this.value;
      the_widget.set_color("custom");
      cs_demo.style("background", the_widget.get_css_gradient());
      the_widget.trigger_callback();
    });
    return true;
  };

  ///////////////////////
  // MultiselectWidget //
  ///////////////////////

  // A widget that allows selecting from multiple option sets before triggering
  // some action with a button. The callback will be called with an array of
  // option values the same length as the provided array of option sets.
  // Defaults may be given as 'undefined' to use the first option from each
  // option set as that set's default. Each label precedes the corresponding
  // selector.
  function MultiselectWidget(
    button_text,
    labels,
    option_sets,
    defaults,
    callback
  ) {
    BaseWidget.call(this);
    this.button_text = button_text;
    this.labels = labels;
    this.option_sets = option_sets;
    this.defaults = defaults || [];
    this.callback = callback;
  }

  MultiselectWidget.prototype = Object.create(BaseWidget.prototype);
  MultiselectWidget.prototype.constructor = MultiselectWidget;

  MultiselectWidget.prototype.put_controls = function (node, insert_before) {
    if (
      !Object.getPrototypeOf(
        MultiselectWidget.prototype
      ).put_controls.call(this, node, insert_before)
    ) { return false; }
    if (this.node == undefined) {
      this.node = node.append("div").attr("class", "controls_row");
    } else {
      this.node.selectAll("*").remove();
    }
    var the_widget = this;
    for (let i = 0; i < this.option_sets.length; ++i) {
      var lbl = this.labels[i];
      if (typeof lbl === "function") { lbl = lbl(this); }
      var opts = this.option_sets[i];
      if (typeof opts === "function") { opts = opts(this); }
      var def = this.defaults[i];
      if (typeof def === "function") { def = def(this); }

      // label
      this.node.append("span")
        .attr("class", "label")
        .text(lbl);

      // select
      var select = this.node.append("select")
        .attr("class", "multiselect");

      // options
      select.selectAll("option")
        .data(opts)
      .enter().append("option")
        .attr("value", d => d)
        .text(d => d);

      // Select the default if there is one:
      select.selectAll("option").filter(d => d == def)
        .attr("selected", true);
    }
    // The activation button
    this.node.append("span").text(" ");
    var btext = this.button_text;
    if (typeof btext === "function") { btext = btext(this); }
    this.node.append("input")
      .attr("type", "button")
      .attr("value", btext)
      .on("click touchend", function () {
        var values = [];
        the_widget.node.selectAll("select").each(function (d) {
          values.push(get_selected_value(this));
        });
        the_widget.trigger_callback(values);
      });
    return true;
  };

  /////////////////////
  // SetSelectWidget //
  /////////////////////

  // A widget that allows selecting a subset of items from a list. The callback
  // will be called with a Set of selected values whenever the selection
  // changes. The default is no items selected.
  function SetSelectWidget(label, items, callback) {
    BaseWidget.call(this);
    this.label = label;
    this.selected = new Set();
    if (typeof items === "function") {
      this.items = items();
    } else {
      this.items = items;
    }
    this.callback = callback;
  }

  SetSelectWidget.prototype = Object.create(BaseWidget.prototype);
  SetSelectWidget.prototype.constructor = SetSelectWidget;

  SetSelectWidget.prototype.select = function (item) {
    this.selected.add(item);
    this.trigger_callback(this.selected);
  };

  SetSelectWidget.prototype.deselect = function (item) {
    this.selected.delete(item);
    this.trigger_callback(this.selected);
  };

  SetSelectWidget.prototype.refresh_values = function () {
    this.items_div.selectAll("*").remove();

    var the_controls = this;
    if (this.items.length <= LOTS_OF_VALUES_THRESHOLD) {
      this.selectors_div = this.items_div.append("div");
      this.selectors_div.attr("class", "scrolling");
      for (let item of this.items) {
        this.selectors_div.append("input")
          .attr("type", "checkbox")
          .attr("checked", the_controls.selected.has(item) ? true : null)
          .on("change", function () {
            if (this.checked) {
              the_controls.select(item);
            } else {
              the_controls.deselect(item);
            }
          });

        // label
        this.selectors_div.append("span").text(" " + item);
        this.selectors_div.append("br");
      }
    } else { // too many values to use checkboxes
      this.selectors_div = this.items_div.append("div");
      this.selectors_div.attr("class", "selected_values scrolling");

      for (let item of this.items) {
        if (the_controls.selected.has(item)) {
          let match_item = this.selectors_div.append("span");
          match_item
            .attr("class", "match_item")
            .append("a")
              .attr("class", "red_button button")
              .text("×")
              .on("click touchend", function () {
                the_controls.deselect(item);
                match_item.remove();
              });
          match_item.append("span").text(item + " ");
          match_item.append("br");
        }
      }

      if (this.add_selector) { this.add_selector.remove(); }

      var unsel = [];
      for (let item of this.items) {
        if (!this.selected.has(item)) {
          unsel.push(item);
        }
      }

      this.add_selector = new TextSelectWidget(
        "+ ", // add a value
        unsel, // unselected items
        undefined, // no default value
        function (selected) {
          if (!the_controls.selected.has(selected)) {
            the_controls.select(selected);
            the_controls.refresh_values();
          }
        }, // callback
        undefined, // no alternate labels
        true // always blank the input on select
      );
      this.add_selector.put_controls(this.items_div);
    }
  };

  SetSelectWidget.prototype.put_controls = function (
    node,
    insert_before
  ) {
    if (
      !Object.getPrototypeOf(
        SetSelectWidget.prototype
      ).put_controls.call(this, node, insert_before)
    ) { return false; }
    var the_controls = this;

    // initial text:
    this.node.append("span")
      .attr("class", "label")
      .text(this.label + " (");

    this.node.append("a").text("all")
      .on("click touchend", function () {
        for (let item of the_controls.items) {
          the_controls.selected.add(item);
        }
        the_controls.trigger_callback(the_controls.selected);
        the_controls.refresh_values();
      });

    this.node.append("span").attr("class", "label").text("/");

    this.node.append("a").text("none")
      .on("click touchend", function () {
        the_controls.selected = new Set();
        the_controls.trigger_callback(the_controls.selected);
        the_controls.refresh_values();
      });

    this.node.append("span").attr("class", "label").text(")");

    // bit of padding
    this.node.append("span").text(" ");

    this.items_div = this.node.append("div");

    // comparator select
    this.refresh_values();
    return true;
  };


  ///////////////////////////////
  // ComparisonFilter Controls //
  ///////////////////////////////

  // Controls for a ComparisonFilter. The callback will be called with the
  // entire object as an argument after every parameter change.
  function ComparisonFilterControls(dataset, callback, default_index) {
    BaseWidget.call(this);
    if (default_index == undefined) {
      default_index = nth_of_kind(
        dataset,
        idx => ComparisonFilter.applicable_to(dataset, idx),
        0
      ) || nth_of_kind(dataset, undefined, 0);
    }
    this.filter = new ComparisonFilter(dataset, default_index, "==", 0);
    this.data = dataset;
    var the_controls = this;
    this.selector = new TextSelectWidget(
      "Compare: ",
      function () {
        return index_names(the_controls.data)
          .filter(
            idx =>
              ComparisonFilter.applicable_to(the_controls.filter.data, idx)
          );
      }, // options
      function () { return get_name(the_controls.data, default_index); },
      function (selected) { the_controls.set_index(selected); }
    );
    this.active = true;
    this.callback = callback;
  }

  ComparisonFilterControls.prototype = Object.create(BaseWidget.prototype);
  ComparisonFilterControls.prototype.constructor = ComparisonFilterControls;

  ComparisonFilterControls.prototype.set_index = function (selection) {
    this.filter.set_index(selection);
    this.trigger_callback();
  };

  ComparisonFilterControls.prototype.set_cmp = function (selection) {
    this.filter.set_comparator(selection);
    this.trigger_callback();
  };

  ComparisonFilterControls.prototype.set_value = function (value) {
    this.filter.set_value(value);
    this.trigger_callback();
  };

  ComparisonFilterControls.prototype.set_active = function (active) {
    this.active = active;
    if (this.active) {
      this.node.classed("disabled", false);
      this.selector.enable();
      this.node.selectAll(".filter_control").attr("disabled", null);
    } else {
      this.node.classed("disabled", true);
      this.selector.disable();
      this.node.selectAll(".filter_control").attr("disabled", true);
    }
    this.trigger_callback();
  };

  ComparisonFilterControls.prototype.remove = function () {
    this.selector.remove();
    Object.getPrototypeOf(
      ComparisonFilterControls.prototype
    ).remove.call(this);
  };

  ComparisonFilterControls.prototype.put_controls = function (
    node,
    insert_before
  ) {
    if (
      !Object.getPrototypeOf(
        ComparisonFilterControls.prototype
      ).put_controls.call(this, node, insert_before)
    ) { return false; }
    var the_controls = this;

    // toggle checkbox:
    this.node.append("input")
      .attr("type", "checkbox")
      .attr("checked", this.active ? true : null)
      .on("change", function () {
        the_controls.set_active(this.checked);
      });

    // initial text:
    this.selector.remove();
    this.selector.put_controls(this.node);

    // bit of padding
    this.node.append("span").text(" ");

    // comparator select
    var cmp_select = this.node.append("select")
      .attr("class", "filter_control")
      .on("change", function () {
        the_controls.set_cmp(get_selected_value(this));
      });
    cmp_select.selectAll("option").exit().remove();
    cmp_select.selectAll("option")
      .data([ "==", "!=", "<", "<=", ">", ">=" ])
    .enter().append("option")
      .attr("value", d => d)
      .text(d => d);
    cmp_select.selectAll("option")
      .filter(d => d == the_controls.filter.comparator)
      .attr("selected", true);

    // bit of padding
    this.node.append("span").text(" ");

    // value select
    var cmp_select = this.node.append("input")
      .attr("class", "filter_control short_text")
      .attr("type", "text")
      .attr("value", the_controls.filter.value)
      .on("change", function () {
        the_controls.set_value(get_text_value(this));
      });
    return true;
  };

  ComparisonFilterControls.prototype.apply_filter = function (records) {
    if (this.active) {
      return this.filter.filter(records);
    } else {
      return records;
    }
  };

  ComparisonFilterControls.prototype.matching_indices = function (records) {
    if (this.active) {
      return this.filter.matching_indices(records);
    } else {
      return new Set(Array.from({length: records.length}, (x,i) => i));
    }
  };

  ComparisonFilterControls.prototype.config_string = function () {
    return this.filter.repr();
  };

  /////////////////////////////
  // ValueSetFilter Controls //
  /////////////////////////////

  // Controls for a ValueSetFilter. The callback will be called with the
  // entire object as an argument after every parameter change.
  function ValueSetFilterControls(dataset, callback, default_index) {
    BaseWidget.call(this);
    if (default_index == undefined) {
      default_index = nth_of_kind(
        dataset,
        idx => ValueSetFilter.applicable_to(dataset, idx),
        0
      ) || nth_of_kind(dataset, undefined, 0);
    }
    this.data = dataset;
    this.filter = new ValueSetFilter(dataset, default_index, []);
    var the_controls = this;
    this.selector = new TextSelectWidget(
      "",
      function () {
        return index_names(the_controls.data)
          .filter(
            idx =>
              ValueSetFilter.applicable_to(the_controls.filter.data, idx)
          );
      }, // options
      function () { return get_name(the_controls.data, default_index); },
      function (selected) { the_controls.set_index(selected); }
    );
    this.active = true;
    this.callback = callback;
  }

  ValueSetFilterControls.prototype = Object.create(BaseWidget.prototype);
  ValueSetFilterControls.prototype.constructor = ValueSetFilterControls;

  ValueSetFilterControls.prototype.set_index = function (selection) {
    this.filter.set_index(selection);
    this.refresh_values(); // triggers callback
  };

  ValueSetFilterControls.prototype.set_accept = function(idx_or_string, accept){
    this.filter.set_accept(idx_or_string, accept);
    this.trigger_callback(); // don't necessarily need to refresh values
  };

  ValueSetFilterControls.prototype.set_active = function (active) {
    this.active = active;
    if (this.active) {
      this.node.attr("class", "controls_row");
      this.node.selectAll(".filter_control").attr("disabled", null);
    } else {
      this.node.attr("class", "controls_row disabled");
      this.node.selectAll(".filter_control").attr("disabled", true);
    }
    this.trigger_callback();
  };

  ValueSetFilterControls.prototype.refresh_values = function () {
    this.items_div.selectAll("*").remove();

    // Pick up values and labels from the filter's categorical transform
    var n_values = this.filter.ct.n_categories;
    var v_labels = this.filter.ct.labels;

    var the_controls = this;
    if (n_values <= LOTS_OF_VALUES_THRESHOLD) {
      this.selectors_div = this.items_div.append("div");
      this.selectors_div.attr("class", "scrolling");
      for (let i = 0; i < n_values; ++i) {
        this.selectors_div.append("input")
          .attr("type", "checkbox")
          .attr("checked", the_controls.filter.will_accept(i) ? true : null)
          .on("change", function () {
            the_controls.set_accept(i, this.checked);
          });

        // label
        this.selectors_div.append("span").text(" " + v_labels[i]);
        this.selectors_div.append("br");
      }
    } else { // too many values to use checkboxes
      this.selectors_div = this.items_div.append("div");
      this.selectors_div.attr("class", "selected_values scrolling");

      for (let i = 0; i < n_values; ++i) {
        if (the_controls.filter.will_accept(i)) {
          let match_item = this.selectors_div.append("span");
          match_item
            .attr("class", "match_item")
            .append("a")
              .attr("class", "red_button button")
              .text("×")
              .on("click touchend", function () {
                the_controls.set_accept(i, false);
                the_controls.refresh_values();
              });
          match_item.append("span").text(v_labels[i] + " ");
          match_item.append("br");
        }
      }

      if (this.add_selector) { this.add_selector.remove(); }

      var unsel = [];
      var unames = [];
      for (let i = 0; i < n_values; ++i) {
        if (!this.filter.will_accept(i)) {
          unsel.push(i);
          unames.push(v_labels[i]);
        }
      }

      this.add_selector = new TextSelectWidget(
        "+ ", // add a value
        unsel, // N integers
        undefined, // no default value
        function (selected) {
          var sel = Number.parseInt(selected);
          if (!the_controls.filter.will_accept(sel)) {
            the_controls.set_accept(sel, true);
            the_controls.refresh_values();
          }
        }, // callback
        unames, // option labels
        true // always blank the input on select
      );
      this.add_selector.put_controls(this.items_div);
    }

    // trigger a callback on refresh
    this.trigger_callback();
  };

  ValueSetFilterControls.prototype.put_controls = function (
    node,
    insert_before
  ) {
    if (
      !Object.getPrototypeOf(
        ValueSetFilterControls.prototype
      ).put_controls.call(this, node, insert_before)
    ) { return false; }
    var the_controls = this;

    // toggle checkbox:
    this.node.append("input")
      .attr("type", "checkbox")
      .attr("checked", this.active ? true : null)
      .on("change", function () {
        the_controls.set_active(this.checked);
      });

    // initial text:
    this.node.append("span")
      .attr("class", "label")
      .text("Accept values (");

    this.node.append("a").text("all")
      .on("click touchend", function () {
        the_controls.filter.accept_all();
        the_controls.refresh_values();
      });

    this.node.append("span").attr("class", "label").text("/");

    this.node.append("a").text("none")
      .on("click touchend", function () {
        the_controls.filter.accept_none();
        the_controls.refresh_values();
      });

    this.node.append("span").attr("class", "label").text(")");

    this.selector.remove();
    this.selector.put_controls(this.node);

    // bit of padding
    this.node.append("span").text(" ");

    this.items_div = this.node.append("div");

    // comparator select
    this.refresh_values();
    return true;
  };

  ValueSetFilterControls.prototype.apply_filter = function (records) {
    if (this.active) {
      return this.filter.filter(records);
    } else {
      return records;
    }
  };

  ValueSetFilterControls.prototype.matching_indices = function (records) {
    if (this.active) {
      return this.filter.matching_indices(records);
    } else {
      return new Set(Array.from({length: records.length}, (x,i) => i));
    }
  };

  ValueSetFilterControls.prototype.config_string = function () {
    return this.filter.repr();
  };


  //////////////////////////
  // MultiFilter Controls //
  //////////////////////////

  // Available filter types
  var FILTER_TYPES = {
    "select…": ValueSetFilterControls,
    "compare…": ComparisonFilterControls,
  };

  // Controls for multiple filters that can be added or removed. The callback
  // will be called (without arguments) after every parameter change.
  // TODO: Avoid locking up the page when the default select target index has
  // too many values to create a categorical map of in a reasonable amount of
  // time.
  function MultiFilterControls(dataset, callback, label) {
    BaseWidget.call(this);
    this.data = dataset;
    if (label == undefined) {
      this.label = "Criteria:";
    } else {
      this.label = label;
    }
    this.filters = [];
    this.callback = callback;
    this.help = new HelpWidget(
      "This control allows you to specify a set of filtering criteria. Use "
    + "the '+' button to add a new filter block (results must pass each block "
    + "to pass the combined filter). Filter blocks either 'select' a set of "
    + "accepted values, or 'compare' numerical values against a threshold "
    + "using a specific comparison operation. The field used in each block "
    + "can be selected independently, and added blocks may also be removed by "
    + "clicking the 'x' button on their left-hand side."
    );
  }

  MultiFilterControls.prototype = Object.create(BaseWidget.prototype);
  MultiFilterControls.prototype.constructor = MultiFilterControls;

  MultiFilterControls.prototype.remove_filter = function (i) {
    this.filters[i].remove();
    this.filters.splice(i, 1);
    this.trigger_callback();
    if (this.node) { this.put_controls(); } // refresh controls if required
  };

  MultiFilterControls.prototype.add_filter = function (key) {
    var ft = FILTER_TYPES[key];
    var the_controls = this;
    this.filters.push(
      new ft(this.data, function () { the_controls.trigger_callback(); })
    );
    this.trigger_callback();
    if (this.node) { this.put_controls(); } // refresh controls if required
  };

  MultiFilterControls.prototype.put_controls = function (node, insert_before) {
    if (
      !Object.getPrototypeOf(
        MultiFilterControls.prototype
      ).put_controls.call(this, node, insert_before)
    ) { return false; }
    let ltext;
    if (typeof this.label === "function") {
      ltext = this.label();
    } else {
      ltext = this.label;
    }
    this.node.append("span")
      .attr("class", "label")
      .text(ltext);
    this.help.put_controls(this.node);
    var the_controls = this;
    let tab = this.node.append("table").attr("class", "subfilters");
    for (let i = 0; i < this.filters.length; ++i) {
      let ctl = this.filters[i];
      ctl.remove(); // just in case
      let row = tab.append("tr").attr("class", "subfilter_row");
      row.append("td")
        .attr("class", "subfilter_action")
        .append("a")
          .attr("class", "red_button button")
          .text("×")
          .on("click touchend", function () { the_controls.remove_filter(i); });
      let sub = row.append("td").attr("class", "subfilter");
      ctl.put_controls(sub);
    }

    // add filter row:
    let row = tab.append("tr").attr("class", "subfilter_row");
    let sfa = row.append("td").attr("class", "subfilter_action");
    let pl_link = sfa.append("a")
        .attr("class", "blue_button button")
        .text("+");

    let sub = row.append("td").attr("class", "subfilter");
    var fts = sub.append("select");
    fts.selectAll("option")
      .data(Object.keys(FILTER_TYPES))
    .enter().append("option")
      .attr("value", d => d)
      .text(d => d);

    pl_link.on(
      "click touchend",
      function () {
        the_controls.add_filter(get_selected_value(fts.node()));
      }
    );
    return true;
  };

  MultiFilterControls.prototype.remove = function () {
    this.help.remove();
    Object.getPrototypeOf(MultiFilterControls.prototype).remove.call(this);
  };

  MultiFilterControls.prototype.apply_filter = function (records) {
    records = records.slice();
    this.filters.forEach(function (ctl) {
      records = ctl.apply_filter(records);
    });
    return records;
  };

  MultiFilterControls.prototype.matching_indices = function (records) {
    var result = new Set(Array.from({length: records.length}, (x,i) => i));
    this.filters.forEach(function (ctl) {
      var fset = ctl.matching_indices(records);
      result = new Set([...result].filter(x => fset.has(x)));
    });
    return result;
  };

  MultiFilterControls.prototype.config_string = function () {
    return this.filters.map(ctl => ctl.config_string()).join(";");
  };

  //////////////////
  // Generic View //
  //////////////////

  function View(id, dataset, controls, help) {
    this.id = id;
    this.data = dataset;
    this.controls = controls || [];
    this.help = help || [];
    this.frame = undefined;
    this.controls_node = undefined;
  }

  // default does nothing
  View.prototype.update_size = function(fw, fh) {};

  // bind to a frame
  View.prototype.bind_frame = function(frame) {
    this.frame = frame;

    var fw = get_width(frame);
    var fh = get_height(frame);

    this.update_size(fw, fh);
  };

  // re-bind to an already bound frame
  View.prototype.rebind = function () {
    if (this.frame === undefined) {
      console.error("Can't rebind an unbound view!");
      console.error(this);
    } else {
      this.bind_frame(this.frame);
    }
  };

  // put our controls somewhere
  View.prototype.put_controls = function(node, insert_before) {
    if (node != undefined) {
      if (this.controls_node != undefined) {
        this.remove_controls();
      }
      this.controls_node = node;
    } else {
      if (this.controls_node == undefined) {
        return false; // nowhere to go
      }
      node = this.controls_node;
    }
    for (let i = 0; i < this.controls.length; ++i) {
      this.controls[i].put_controls(node, insert_before);
      if (this.help[i]) {
        this.controls[i].node.append("span").text(NBSP);
        this.help[i].remove();
        this.help[i].put_controls(this.controls[i].node);
      }
    }
    return true;
  };

  View.prototype.remove_controls = function () {
    this.controls.forEach(function (c) {
      c.remove();
    });
    this.help.forEach(function (h) {
      h.remove();
    });
  };

  // default does nothing
  View.prototype.draw = function() {};

  //////////////
  // LensView //
  //////////////

  // Minimum size of a quadtree cell (in SVG units ~= screen pixels)
  var DEFAULT_RESOLUTION = 4;

  // Minimum radius of the lens in SVG units (~= screen pixels)
  var MIN_LENS_RADIUS = 0.5;

  // Creates a new lens view of the given dataset.
  //
  // Note that after creating a view, it must be bound to a frame before it can
  // be drawn or its controls can be used, and if the x_index or y_index
  // weren't given, they need to be set first.
  function LensView(id, dataset, x_index, y_index) {
    View.call(this, id, dataset);
    this.show_density = false;
    this.hide_labels = false;
    this.tool = "zoom";
    this.drag_start = undefined;
    this.drag_current = undefined;
    this.drag_end = undefined;
    this.selected = [];
    this.selection_listeners = [];
    this.separate_outliers = true;
    this.display_label = undefined;
    this.size = undefined;
    this.viewport = { // these are in data-coordinates, not view-coordinates
      "min_x": undefined,
      "max_x": undefined,
      "min_y": undefined,
      "max_y": undefined,
    };

    // set up axes and establish default viewport:
    this.set_x_axis(x_index);
    this.set_y_axis(y_index);
    this.reset_viewport();

    var the_view = this;

    this.controls.push(
      new SelectWidget(
        "Tool: ",
        [ "zoom", "select" ],
        "zoom",
        function (value) {
          the_view.set_tool(value);
        }
      )
    );

    this.help.push(
      new HelpWidget(
        "Choose whether to use the mouse to select items, or to zoom in or "
      + "out. In select mode, the mouse moves the selection cursor, and the "
      + "scroll wheel changes its size. Click to update the current selection "
      + "region, which will limit which records are displayed in the right "
      + "pane (unless 'Select all' is checked in the middle). In zoom mode, "
      + "drag down to zoom in to a specific region, or drag up to zoom out "
      + "(such that the current region will fit in the box created after the "
      + "zoom-out). The scroll wheel can also be used while zooming to zoom in "
      + "or out of the center of the viewport by a fixed amount. Clicking "
      + "without dragging in zoom mode will reset the zoom to the default, and "
      + "scrolling while the mouse is over the x- or y-axis will zoom only "
      + "that axis."
      )
    );

    this.controls.push(
      new TextSelectWidget(
        "X-axis: ",
        function () { return index_names(the_view.data); },
        function () { return get_name(the_view.data, the_view.x_index); },
        function (iname) {
          the_view.set_x_axis(iname);
          the_view.rebind();
          the_view.draw();
        }
      )
    );

    this.help.push(
      new HelpWidget(
        "This controls which field is used to determine the x-coordinate of "
      + "each data point. The axis will automatically scale to include the "
      + "full range of the data. Text fields are automatically converted to "
      + "numeric values by mapping unique text values to different integers, "
      + "but tensor and map fields just give 0 for every point (generally, you "
      + "should select a subfield from a tensor or map)."
      )
    );

    this.controls.push(
      new TextSelectWidget(
        "Y-axis: ",
        function () { return index_names(the_view.data); },
        function () { return get_name(the_view.data, the_view.y_index); },
        function (iname) {
          the_view.set_y_axis(iname);
          the_view.rebind();
          the_view.draw();
        }
      )
    );

    this.help.push(
      new HelpWidget(
        "This controls which field is used to determine the y-coordinate of "
      + "each data point. See the help for the x-axis for more details."
      )
    );

    this.controls.push(
      new TextSelectWidget(
        "Display: ",
        function () {
          return ["<count>"].concat(index_names(the_view.data));
        },
        function () {
          if (the_view.d_index == undefined) {
            return "<count>";
          } else {
            return get_name(the_view.data, the_view.d_index);
          }
        },
        function (iname) {
          if (iname == "<count>") {
            the_view.set_display(undefined);
          } else {
            the_view.set_display(iname);
          }
          the_view.draw();
        }
      )
    );

    this.help.push(
      new HelpWidget(
        "Sets the value to be displayed in the upper-right corner of the graph "
      + "based on the selected items. The default shows how many items are "
      + "selected, but a summary of any field can be displayed. When too many "
      + "items are selected with different values for the chosen field, a '*' "
      + "will be displayed, but when there are three or fewer distince values "
      + "among selected items, they will be displayed along with their counts. "
      + "Additionally, if there are up to three vaules which are similarly "
      + "frequent and all much more frequent than the next-most-frequent "
      + "value, these will be displayed along with a '*'. Use the right-hand "
      + "viewing pane if you need more detailed information about selected "
      + "records."
      )
    );

    this.controls.push(
      new TextSelectWidget(
        "Labels: ",
        function () {
          return ["<none>"].concat(index_names(the_view.data));
        },
        function () {
          if (the_view.l_index == undefined) {
            return "<none>";
          } else {
            return get_name(the_view.data, the_view.l_index);
          }
        },
        function (iname) {
          if (iname == "<none>") {
            the_view.set_labels(undefined);
          } else {
            the_view.set_labels(iname);
          }
          the_view.draw();
        }
      )
    );

    this.help.push(
      new HelpWidget(
        "Sets the field to be used as the label for each point. Note that when "
      + "there are many points, labels will overlap and won't really be "
      + "useful. When multiple grouped points have different label values, if "
      + "there's one value that comprises a majority that value will be shown "
      + "folloed by a '*', otherwise just a '*' will be shown for that point. "
      + "Set this to 'none' to disable labels."
      )
    );

    this.controls.push(
      new TextSelectWidget(
        "Color by: ",
        function () {
          return ["<density>"].concat(index_names(the_view.data));
        },
        function () {
          if (the_view.c_index != undefined) {
            return get_name(the_view.data, the_view.c_index);
          } else {
            return "<density>";
          }
        },
        function (iname) {
          if (iname === "<density>") {
            the_view.set_color_property(undefined);
          } else {
            the_view.set_color_property(iname);
          }
          the_view.draw();
        }
      )
    );

    this.help.push(
      new HelpWidget(
        "This sets the field that will be used to determine the color of each "
      + "point. The default is to use the relative density of each point-group "
      + "as the color key, which may result in flat coloring if your points "
      + "are sparse enough that none get grouped together. Non-numeric fields "
      + "are mapped to numeric values using the same rules as for the axes "
      + "(see the x-axis help). Then the whole value range is normalized to "
      + "between 0 and 1, and mapped to the color scale chosen below. Outlier "
      + "coloring changes this slightly (see below)."
      )
    );

    this.color_widget = new ColorScaleWidget(
      "custom",
      "#000",
      "#ffb900", //"#a8ff00",
      "#303850",
      function () { the_view.draw(); }
    );
    this.controls.push(this.color_widget);

    this.help.push(
      new HelpWidget(
        "Controls the color scale used to interpret the color value selected "
      + "above. You can choose a pre-set scale, or define your own by picking "
      + "two endpoint colors (the gradient used is a cube helix gradient). Use "
      + "'flat' if you don't want color variation."
      )
    );

    this.controls.push(
      new ToggleWidget(
        "Color outliers separately",
        true,
        function (yes) {
          the_view.separate_outliers = yes;
          if (the_view.c_index == undefined) {
            if (yes) {
              the_view.c_value = "standardized";
            } else {
              the_view.c_value = "density";
            }
          }
          the_view.draw(); // redraw
        }
      )
    );

    this.help.push(
      new HelpWidget(
        "This toggles whether the color scale is mapped to the full range of "
      + "values from the color-by field, or whether only inlier values are "
      + "mapped. If toggled, values more than three standard deviations from "
      + "the mean of the selected field will use a different color (specified "
      + "below) and only values within that range will me mapped to the color "
      + "scale. This is useful when, for example, a single extremely-dense "
      + "point washes out the colors for the rest of the graph (using "
      + "density-based coloring)."
      )
    );

    this.outlier_color_widget = new ColorWidget(
      "Outlier color:",
      "#a8ff00", // "#cc77ff",
      function (color) { the_view.draw(); }
    );
    this.controls.push(this.outlier_color_widget);

    this.help.push(
      new HelpWidget(
        "This sets the color used for outlier points, if the above option for "
      + "separate outlier colors is enabled."
      )
    );

    this.controls.push(
      new ToggleWidget(
        "Hide axis labels and display text",
        false,
        function (yes) {
          the_view.hide_labels = yes;
          the_view.draw(); // redraw
        }
      )
    );

    this.help.push(
      new HelpWidget(
        "Hiding the text at the edges of the graph can help when it overlaps "
      + "with points that are placed near the edges."
      )
    );

    this.controls.push(
      new ToggleWidget(
        "Show point approximation (instead of density)",
        true,
        function (yes) {
          the_view.show_density = !yes;
          the_view.draw(); // redraw
        }
      )
    );

    this.help.push(
      new HelpWidget(
        "By default, multiple nearby points are shown as a single point with a "
      + "density value. If you uncheck this, you can view the raw regions used "
      + "to compute densities, which is only really useful for very dense data "
      + "sets. To avoid grouping points, set a smaller resolution value below."
      )
    );

    this.controls.push(
      new SelectWidget(
        "Resolution: ",
        [2, 4, 8, 16, 32, 64],
        DEFAULT_RESOLUTION,
        function (value) {
          the_view.set_resolution(Number.parseInt(value));
          the_view.rebind();
          the_view.draw();
        }
      )
    );

    this.help.push(
      new HelpWidget(
        "This selector controls the resolution at which points are grouped. "
      + "Use smaller values to see more data points, and to avoid grouping. "
      + "The points are drawn at a size of 2 units, so the smallest available "
      + "resolution is 2. The units are screen units, and are independent of "
      + "the current graph axis units."
      )
    );
  }

  LensView.prototype = Object.create(View.prototype);
  LensView.prototype.constructor = LensView;

  // Updates the current tool. Hides the selection shadow when not in selection
  // mode.
  LensView.prototype.set_tool = function(tool) {
    this.tool = tool;
    if (tool == "zoom") {
      if (this.shadow.node != undefined) {
        this.shadow.node.classed("invisible", true);
      }
    } else {
      if (this.shadow.node != undefined) {
        this.shadow.node.classed("invisible", false);
      }
    }

    // reset & hide the dragbox on tool change no matter what
    let db = this.dragbox;
    db.sx = undefined;
    db.sy = undefined;
    db.ex = undefined;
    db.ey = undefined;
    if (db.node != undefined) {
      db.node.classed("invisible", true);
    }
  };

  // Updates the size; called when the frame is (re)bound.
  LensView.prototype.update_size = function(fw, fh) {
    this.size = [fw, fh];
    this.x_scale = linear$1()
      .range([0, fw])
      .domain([this.viewport.min_x, this.viewport.max_x]);
    this.y_scale = linear$1()
      .range([fh, 0])
      .domain([this.viewport.min_y, this.viewport.max_y]);

    this.view_x = d => this.x_scale(this.raw_x(d));
    this.view_y = d => this.y_scale(this.raw_y(d));

    // build a quadtree in the view space:
    if (this.resolution === undefined) {
      this.resolution = DEFAULT_RESOLUTION;
    }

    this.tree = build_quadtree(
      this.data.records,
      [ [0, 0], [fw, fh] ],
      this.view_x,
      this.view_y,
      this.resolution
    );

    // set up default lens & shadow:
    this.lens = { "x": 0, "y": fh, "r": 10, "node": undefined };
    this.shadow = { "x": 0, "y": fh, "r": 10, "node": undefined };

    // set up default dragbox:
    this.dragbox = {
      "sx": undefined, "sy": undefined,
      "ex": undefined, "ey": undefined,
      "node": undefined
    };

    // Update selection to include items under default lens
    this.update_selection();
  };

  // Resets the viewport to encompass the full x and y domains of the current
  // indices. The x- and y-axes may be reset individually (pass true for each
  // axis you want to reset). Passing false, false does nothing, and passing no
  // arguments is the same as passing true, true.
  LensView.prototype.reset_viewport = function(x, y) {
    if (x == undefined && y == undefined) {
      x = true;
      y = true;
    }
    if (x) {
      let xr = this.x_domain[1] - this.x_domain[0];
      if (xr == 0) { xr = 1; }
      this.viewport.min_x = this.x_domain[0] - DOMAIN_PADDING * xr;
      this.viewport.max_x = this.x_domain[1] + DOMAIN_PADDING * xr;
    }
    if (y) {
      let yr = this.y_domain[1] - this.y_domain[0];
      if (yr == 0) { yr = 1; }
      this.viewport.min_y = this.y_domain[0] - DOMAIN_PADDING * yr;
      this.viewport.max_y = this.y_domain[1] + DOMAIN_PADDING * yr;
    }
    if (this.size) {
      this.update_size(this.size[0], this.size[1]);
      this.draw();
    }
  };

  // Zooms in (or out, if mag is false) so that either the given x, y, w, h box
  // becomes the new edges of the viewport, or if zooming out, so that the
  // current viewport edges become the edges of that box within an expanded
  // viewport. If the w and h values are left out, then the r_or_x and r_or_y
  // values are treated as a ratios with respect to the current viewport
  // width/height, and a box size is calculated based on those ratios (which
  // should always be between 0 and 1, exclusive). When zooming using only
  // ratios, the zoom always goes into or out of the center of the viewport.
  LensView.prototype.zoom = function(mag, r_or_x, r_or_y, w, h) {
    let x;
    let y;
    if (w == undefined) { // ratio-based
      // scaled width and height:
      // TODO: Is there some padding to adjust for here?
      w = r_or_x * this.size[0];
      h = r_or_y * this.size[1];

      // the x and y that center that box:
      x = this.size[0]/2 - w/2;
      y = this.size[1]/2 - h/2;
    } else {
      x = r_or_x;
      y = r_or_y;
    }
    if (w == 0 || h == 0) { // ignore this invalid zoom command
      return;
    }
    if (mag) {
      // TODO: Is there some padding to adjust for here?
      this.viewport.min_x = this.x_scale.invert(x);
      this.viewport.max_x = this.x_scale.invert(x + w);
      this.viewport.min_y = this.y_scale.invert(y + h);
      this.viewport.max_y = this.y_scale.invert(y);
    } else {
      let rw = this.size[0] / w;
      let rh = this.size[1] / h;
      let cx = this.x_scale.invert(x + w/2);
      let cy = this.y_scale.invert(y + h/2);
      let axis_w = this.viewport.max_x - this.viewport.min_x;
      let axis_h = this.viewport.max_y - this.viewport.min_y;
      let new_axw = axis_w * rw;
      let new_axh = axis_h * rh;
      this.viewport.min_x = cx - new_axw/2;
      this.viewport.max_x = cx + new_axw/2;
      this.viewport.min_y = cy - new_axh/2;
      this.viewport.max_y = cy + new_axh/2;
    }
    // apply viewport changes and redraw
    this.update_size(this.size[0], this.size[1]);
    this.draw();
  };

  // Draws the given view into its bound frame (see bind_frame). Also sets up
  // some event bindings on the frame.
  LensView.prototype.draw = function() {

    // Reset the frame:
    this.frame.selectAll("*").remove();

    var fw = get_width(this.frame);
    var fh = get_height(this.frame);
    
    // quadtree first so that axes + labels go on top
    var dplot = this.frame.append("g")
      .attr("id", "qt_density")
      .attr("class", "density_plot");

    var the_view = this;

    draw_quadtree(
      dplot,
      this.tree,
      function (v) {
        var dom = the_view.color_widget.get_domain();
        if (dom[0] <= v && v <= dom[1]) {
          return the_view.color_widget.get_gradient()(v);
        } else {
          return the_view.outlier_color_widget.color
        }
      },
      this.resolution,
      this.show_density,
      this.c_value,
      this.get_label
    );

    // display label
    this.display_label = this.frame.append("text")
      .attr("id", "select_count_label")
      .attr("class", "label")
      .attr("x", fw * 0.99)
      .attr("y", fh * 0.01)
      .style("text-anchor", "end")
      .style("dominant-baseline", "hanging");
    this.update_display();

    if (this.hide_labels) { this.display_label.style("display", "none"); }

    // x-axis:
    var xa = this.frame.append("g")
      .attr("id", this.id + "_x_axis")
      .attr("class", "x axis")
      .attr(
        "transform",
        "translate(0," + fh + ")"
      )
      .call(axisBottom(this.x_scale));
    var xl = xa.append("text")
      .attr("class", "label")
      .attr("x", fw * 0.99)
      .attr("y", -fh * 0.01)
      .style("text-anchor", "end")
      .text(get_name(this.data, this.x_index));

    if (this.hide_labels) { xl.style("display", "none"); }

    // y-axis
    var ya = this.frame.append("g")
      .attr("id", this.id + "_y_axis")
      .attr("class", "y axis")
      .call(axisLeft(this.y_scale));
    var yl = ya.append("text")
      .attr("class", "label")
      .attr("transform", "rotate(-90)")
      .attr("x", -fw * 0.01)
      .attr("y", fw * 0.01)
      .style("text-anchor", "end")
      .style("dominant-baseline", "hanging")
      .text(get_name(this.data, this.y_index));

    if (this.hide_labels) { yl.style("display", "none"); }

    // Add the lenses & dragbox last
    let tools = dplot.append("g")
      .attr("id", "tools_group");

    this.lens.node = tools.append("circle")
      .attr("id", this.id + "_lens")
      .attr("class", "lens")
      .attr("cx", this.lens.x)
      .attr("cy", this.lens.y)
      .attr("r", this.lens.r)
      .attr("z-index", "10");

    this.shadow.node = tools.append("circle")
      .attr("id", this.id + "_shadow")
      .attr("class", "lens_shadow")
      .attr("cx", this.shadow.x)
      .attr("cy", this.shadow.y)
      .attr("r", this.shadow.r)
      .attr("z-index", "10");

    this.dragbox.node = tools.append("rect")
      .attr("id", this.id + "_dragbox")
      .attr("class", "dragbox invisible")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", 0)
      .attr("height", 0)
      .attr("z-index", "11");

    // Lens tracking:
    var svg = this.frame.node();
    while (svg.nodeName != "svg" && svg.parentNode) {
      svg = svg.parentNode;
    }
    svg = select(svg);
    var the_view = this;
    svg.on("mousedown touchstart", function () {
      var e = event;
      if (e.button != undefined && e.button > 0) {
        return; // don't trigger for non-primary buttons
      }
      var coords = mouse(the_view.frame.node());
      the_view.drag_start = coords;
      let db = the_view.dragbox;
      if (the_view.tool == "zoom") {
        db.sx = coords[0];
        db.sy = coords[1];
        if (db.node != undefined) {
          db.node.classed("invisible", false);
        }
      }
    });

    svg.on("mousemove touchmove", function () {
      var coords = mouse(the_view.frame.node());
      the_view.drag_current = coords;

      if (the_view.tool == "zoom") {
        let db = the_view.dragbox;
        if (db.sx != undefined && db.sy != undefined) {
          db.ex = coords[0];
          db.ey = coords[1];
          if (the_view.dragbox.node != undefined) {
            db.node.attr("x", Math.min(db.sx, db.ex));
            db.node.attr("y", Math.min(db.sy, db.ey));
            db.node.attr("width", Math.abs(db.ex - db.sx));
            db.node.attr("height", Math.abs(db.ey - db.sy));
            if (db.ey < db.sy) { // upwards = zoom out
              db.node.classed("inverted", true);
            } else {
              db.node.classed("inverted", false);
            }
          }
        } // else don't update endpoint
      } else if (the_view.tool == "select") {
        if (the_view.shadow.node != undefined) {
          the_view.shadow.x = coords[0];
          the_view.shadow.y = coords[1];
          the_view.shadow.node.attr("cx", the_view.shadow.x);
          the_view.shadow.node.attr("cy", the_view.shadow.y);
        }
      }
    });

    svg.on("click touchend", function () {
      if (the_view.tool == "zoom") {
        let db = the_view.dragbox;
        if (db.sx != undefined && db.sy != undefined) {
          if (
            db.ex == undefined
         || db.ey == undefined
         || db.ex == db.sx
         || db.ey == db.sy
          ) { // zero-width or no-movement: reset view
            the_view.reset_viewport();
          } else {
            // compute start + size
            let sx = Math.min(db.sx, db.ex);
            let sy = Math.min(db.sy, db.ey);
            let bw = Math.abs(db.ex - db.sx);
            let bh = Math.abs(db.ey - db.sy);
            // zoom in or out depending on whether box goes up or down
            the_view.zoom(db.ey > db.sy, sx, sy, bw, bh);
          }
        }
        // unbind start/end values
        db.sx = undefined;
        db.ex = undefined;
        db.sy = undefined;
        db.ey = undefined;
        // hide dragbox
        if (db.node != undefined) {
          db.node.classed("invisible", true);
        }
      } else if (the_view.tool == "select") {
        the_view.lens.x = the_view.shadow.x;
        the_view.lens.y = the_view.shadow.y;
        the_view.lens.r = the_view.shadow.r;

        if (the_view.lens.node != undefined) {
          // Update the lens
          the_view.lens.node.attr("cx", the_view.lens.x);
          the_view.lens.node.attr("cy", the_view.lens.y);
          the_view.lens.node.attr("r", the_view.lens.r);

          the_view.update_selection();
        }
      }
    });

    svg.on("mousewheel", function () {
      var e = event;
      e.preventDefault();

      // convert scroll units:
      var unit = e.deltaMode;
      var dx = e.deltaX;
      var dy = e.deltaY;

      if (unit == 1) {
        dx *= PIXELS_PER_LINE;
        dy *= PIXELS_PER_LINE;
      } else if (unit == 2) {
        dx *= PIXELS_PER_LINE * LINES_PER_PAGE;
        dy *= PIXELS_PER_LINE * LINES_PER_PAGE;
      }

      if (the_view.tool == "zoom") { // zoom in/out from center of viewport
        if (dy != 0) { // dx is ignored
          let lines = dy / PIXELS_PER_LINE;
          let factor = 1 - ZOOM_FACTOR;
          let ratio = Math.pow(factor, Math.abs(lines));
          // Detect hovering over axes:
          let coords = mouse(the_view.frame.node());
          let mx = the_view.x_scale.invert(coords[0]);
          let my = the_view.y_scale.invert(coords[1]);
          let left = mx < the_view.viewport.min_x;
          let bottom = my < the_view.viewport.min_y;
          if (left && !bottom) { // hovering over y-axis
            the_view.zoom(lines < 0, 1, ratio); // scale y only
          } else if (bottom && !left) { // hovering over x-axis
            the_view.zoom(lines < 0, ratio, 1); // scale x only
          } else { // on graph or in corner
            the_view.zoom(lines < 0, ratio, ratio);
          }
        }
      } else if (the_view.tool == "select") { // change lens size
        if (the_view.shadow.node != undefined) {

          // update shadow radius:
          the_view.shadow.r *= (1 + 0.01 * dy / SCROLL_FACTOR);
          if (the_view.shadow.r < MIN_LENS_RADIUS) {
            the_view.shadow.r = MIN_LENS_RADIUS;
          }
          the_view.shadow.node.attr("r", the_view.shadow.r);
        }
      }
    });
  };

  // Subscribe a callback to trigger on selection updates. Callbacks receive
  // two arguments: an array of selected items, and the entire view object.
  LensView.prototype.subscribe_to_selection = function(callback) {
    this.selection_listeners.push(callback);
  };

  // Cancel a callback
  LensView.prototype.cancel_subscription = function(callback) {
    var i;
    for (i = 0; i < this.selection_listeners.length; ++i) {
      if (this.selection_listeners[i] === callback) {
        break;
      }
    }
    if (i < this.selection_listeners.length) {
      this.selection_listeners.spilce(i,1);
    }
  };

  // Updates the "selected" property of the view according to the current lens
  // position.
  LensView.prototype.update_selection = function() {
    if (this.lens == undefined) {
      this.selected = [];
    } else {
      this.selected = in_circle(
        this.tree,
        this.lens.x,
        this.lens.y,
        this.lens.r
      );
    }
    for (let i = 0; i < this.selection_listeners.length; ++i) {
      this.selection_listeners[i](this.selected, this);
    }

    // Update our display value
    this.update_display();
  };

  // Sets the coloring property for a view; use 'undefined' as the index to
  // revert to default coloring (by point density).
  LensView.prototype.set_color_property = function(c_index) {
    if (typeof c_index === "string") {
      c_index = lookup_index(this.data, c_index);
    }
    this.c_index = c_index;
    if (c_index != undefined) {
      if (this.separate_outliers) {
        var om = outlier_model(this.data, c_index);
        this.c_value = function (d) {
          return om.normalized(d);
        };
      } else {
        var nt = numerical_transform(this.data, c_index);
        this.c_value = function (d) {
          return (nt.getter(d) - nt.domain[0]) / (nt.domain[1] - nt.domain[0]);
        };
      }
    } else {
      if (this.separate_outliers) {
        this.c_value = "standardized";
      } else {
        this.c_value = "density";
      }
    }
  };

  // Pass true to turn density-regions mode on, and false to use points (the
  // default).
  LensView.prototype.set_density_mode = function(on) {
    this.show_density = on;
  };

  // Turns on labels using the given index for the view. Turn them off by
  // passing undefined as l_index.
  LensView.prototype.set_labels = function(l_index) {
    if (typeof l_index === "string") {
      l_index = lookup_index(this.data, l_index);
    }
    this.l_index = l_index;
    if (l_index != undefined) {
      this.get_label = d => get_field(this.data, d, this.l_index);
    } else {
      this.get_label = undefined;
    }
  };

  // Sets the index to use for the display value. Reset to use just selected
  // item count by passing undefined as d_index.
  LensView.prototype.set_display = function(d_index) {
    if (typeof d_index === "string") {
      d_index = lookup_index(this.data, d_index);
    }
    this.d_index = d_index;
  };

  LensView.prototype.update_display = function() {
    if (this.display_label == undefined) {
      return;
    }

    let dtext = "undefined";
    if (this.d_index == undefined) {
      dtext = this.selected.length + " items selected";
    } else if (this.selected.length == 0) {
      dtext = "";
    } else {
      let d_type = get_type$1(this.data, this.d_index);
      let fval = fuse_values(this.data, this.selected, this.d_index);
      if (d_type.kind == "number") {
        dtext = fval.toPrecision(4);
        if (this.selected.length > 1) {
          dtext = "avg " + dtext;
        }
      } else if (d_type.kind == "tensor" && d_type.value_type.kind == "number"){
        let td = tensor_total_dimension(fval);
        if (td <= A_FEW) {
          let flat = flatten(fval);
          dtext = "[" + flat.map(v => v.toPrecision(3)).join(", ") + "]";
          if (this.selected.length > 1) {
            dtext = "avg " + dtext;
          }
        } else {
          dtext = "<" + td + "-dimensional>";
        }
      } else { // strings, maps, and non-numeric tensors
        dtext = dominance_summary(fval);
      }
    }
    this.display_label.text(dtext);
  };

  // Sets the grid resolution. Call rebind afterwards to rebuild the quadtree.
  LensView.prototype.set_resolution = function (res) {
    if (typeof res === "string") {
      res = Number.parseInt(res);
    }
    this.resolution = res;
  };

  // Replaces the old x-axis of the domain. Usually requires re-binding the
  // domain to its frame afterwards.
  LensView.prototype.set_x_axis = function(x_index) {
    if (typeof x_index === "string") {
      x_index = lookup_index(this.data, x_index);
    }
    this.x_index = x_index;
    this.x_type = get_type$1(this.data, x_index);

    var nx = numerical_transform(this.data, x_index);
    this.x_domain = nx.domain;
    this.raw_x = nx.getter;
    this.reset_viewport(true, false); // reset the x-axis viewport
  };

  // Same as above for the y-axis.
  LensView.prototype.set_y_axis = function(y_index) {
    if (typeof y_index === "string") {
      y_index = lookup_index(this.data, y_index);
    }
    this.y_index = y_index;
    this.y_type = get_type$1(this.data, y_index);

    var ny = numerical_transform(this.data, y_index);
    this.y_domain = ny.domain;
    this.raw_y = ny.getter;
    this.reset_viewport(false, true); // reset the y-axis viewport
  };

  ///////////////
  // Histogram //
  ///////////////

  // Default # of bins to use when the data doesn't suggest a number
  var DEFAULT_BINS = 10;

  // Maximum number of discrete values to bin as exact values instead of using
  // numerical ranges.
  var MAX_DISCRETE_BINS = 30;

  // Creates a histogram of values in the given field using just the given
  // records from the given dataset.
  //
  // See "set_flags" for possible keys in the flags object (it can be left
  // undefined to use defaults).
  //
  // If the target field is numeric, a binned histogram will be created using
  // the given number of bins (or DEFAULT_BINS) spread out over the full range
  // of the field in the dataset (not just the records given). If a domain is
  // given, that domain is used instead (should be an array of [ min, max ]),
  // or if domain is given as "auto" the domain of the given records will be
  // used.
  //
  // If the target field is a string field, counts for each distinct value will
  // be tallied.
  //
  // If the target field is a map from strings to numbers, the sum for each key
  // will be computed across the given records, and that will form the
  // histogram.
  //
  // If bar_limit isn't given, it will default to no limit.
  function Histogram(
    id,
    dataset,
    records,
    field,
    flags,
    bins,
    domain,
    bar_limit
  ) {
    View.call(this, id, dataset);
    this.records = records;
    this.bins = bins;
    this.domain = domain;
    this.bar_limit = bar_limit;

    this.flags = {
      "force_counts": false,
      "average": false,
      "normalize": false,
      "sort": false,
    };

    // set field & mode and compute counts
    this.set_flags(flags);
    this.set_field(field);
    this.update();

    // set up widgets:
    var the_view = this;

    this.controls.push(
      new TextSelectWidget(
        "Field: ",
        function () { return index_names(the_view.data); },
        function () { return get_name(the_view.data, the_view.field) },
        function (iname) {
          the_view.set_field(iname);
          the_view.update();
          the_view.draw();
        }
      )
    );

    this.help.push(
      new HelpWidget(
        "Which field to make a histogram from. If a numeric field is selected, "
      + "by default 10 bins will be arranged across its full range and the "
      + "bars will represent records falling into each bin (missing values "
      + "will be treated as zeros). If there are fewer than 30 distinct "
      + "values, however, or when the field selected is a text field, each bar "
      + "will represent a distinct value. When a tensor or map field is "
      + "selected, each bar will represent a single dimension/subfield of that "
      + "tensor/map, with bar lengths being the sum of values in that "
      + "dimension rather than a count of records with values in a range."
      )
    );

    this.controls.push(
      new ToggleWidget(
        "Sort by largest first (otherwise use natural order)",
        this.flags.sort,
        function (yes) {
          the_view.flags.sort = yes;
          the_view.update();
          the_view.draw();
        }
      )
    );

    this.help.push(
      new HelpWidget(
        "Toggle to sort bars by their length instead of using the default "
      + "ordering (roughly smallest-value to largest-value for bin labels)."
      )
    );

    this.controls.push(
      new ToggleWidget(
        "Count non-zero/non-missing values (even when values could be summed)",
        this.flags.force_counts,
        function (yes) {
          the_view.flags.force_counts = yes;
          the_view.update();
          the_view.draw();
        }
      )
    );

    this.help.push(
      new HelpWidget(
        "For tensor and map fields, values are normally summed in each "
      + "dimension/subfield and those sums are used for bar values. When this "
      + "is toggled, instead each value is just counted as a 1 if it is "
      + "non-zero (and not missing) or a 0 if it is missing or has the value "
      + "0. This has no effect for numeric or text fields."
      )
    );

    this.controls.push(
      new ToggleWidget(
        "Average values in bins (instead of summing them)",
        this.flags.average,
        function (yes) {
          the_view.flags.average = yes;
          the_view.update();
          the_view.draw();
        }
      )
    );

    this.help.push(
      new HelpWidget(
        "This toggle causes values in each bin to be averaged across all "
      + "records instead of added up. For numeric and text fields, effectively "
      + "computes the percentage falling into each category. For vectors and "
      + "maps, each bar will be the average for one dimension/subfield."
      )
    );

    this.controls.push(
      new ToggleWidget(
        "Normalize values (relative to largest)",
        this.flags.normalize,
        function (yes) {
          the_view.flags.normalize = yes;
          the_view.update();
          the_view.draw();
        }
      )
    );

    this.help.push(
      new HelpWidget(
        "Does not affect how bar values are computed, but just expresses the "
      + "displayed numbers in terms of the length fo the longest bar. Note "
      + "that for numeric and text fields, using averaging (see above) will "
      + "produce percentages, which is another form of normalization."
      )
    );

    var limit_options = [
      "<no limit>", 1, 3, 5, 10, 20, 30, 50, 100
    ];
    if (this.bar_limit && limit_options.indexOf(this.bar_limit) == -1) {
      var nopts = ["<no limit>"];
      for (let i = 1; i < limit_options.length; ++i) {
        var next = limit_options[i];
        if (this.bar_limit < next) {
          nopts.push(this.bar_limit);
        }
        nopts.push(next);
      }
      limit_options = nopts;
    }
    this.controls.push(
      new SelectWidget(
        "Show only the top: ",
        limit_options,
        (this.bar_limit || "<no limit>") + "",
        function (selected) {
          var bl;
          if (selected == "<no limit>") {
            bl = undefined;
          } else {
            bl = Number.parseInt(selected);
          }
          the_view.bar_limit = bl;
          the_view.update();
          the_view.draw();
        }
      )
    );

    this.help.push(
      new HelpWidget(
        "When there are many bins, the text may become too small to read. This "
      + "option (best combined with sorting) will hide off bars beyond the "
      + "selected limit so that the remaining bars can be read clearly."
      )
    );

    var bins_options = [
      "<auto>", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 30, 50, 100
    ];
    this.controls.push(
      new SelectWidget(
        "Number of bins: ",
        bins_options,
        (this.bins || "<auto>") + "",
        function (selected) {
          var bn;
          if (selected == "<auto>") {
            bn = undefined;
          } else {
            bn = Number.parseInt(selected);
          }
          the_view.bins = bn;
          the_view.update();
          the_view.draw();
        }
      )
    );

    this.help.push(
      new HelpWidget(
        "Use this to specify the number of bins to use, which also turns off "
      + "the automatic grouping for fields with fewer than 30 distinct values. "
      + "Note, however, that ranges with no data will always be hidden, so "
      + "there will never be more bars shown than distinct values in the data. "
      + "This control has no effect for tensor or map fields, where the number "
      + "of bins is always equal to the number of dimensions/subfields."
      )
    );

    this.color_widget = new ColorScaleWidget(
      "flat",
      "#6688cc",
      "#f0e8c8",
      "#631200",
      function () { the_view.draw(); }
    );
    this.controls.push(this.color_widget);

    this.help.push(
      new HelpWidget(
        "When set to a value other than 'flat,' each bar will be colored "
      + "according to its length relative to the longest bar. You can choose a "
      + "pre-defined scale or create your own custom scale by selecting two "
      + "endpoint colosr. The gradient used for custom scales is a cube-helix "
      + "gradient."
      )
    );
  }

  Histogram.prototype = Object.create(View.prototype);
  Histogram.prototype.constructor = Histogram;

  // Reassigns the field for this histogram. update should be called
  // afterwards.
  Histogram.prototype.set_field = function (field) {
    if (typeof field === "string") {
      field = lookup_index(this.data, field);
    }
    this.field = field;
  };

  // Reassigns the record set for this histogram. update should be called to
  // update the counts.
  Histogram.prototype.set_records = function (records) {
    this.records = records;
  };

  // Changes the counting mode. Flags should be an object with some or all of
  // the following keys:
  //
  // force_counts
  //   Whether to force counts or use values when available.
  // average
  //   Whether to average or sum values.
  // normalize
  //   Whether to normalize results.
  // sort
  //   Whether to sort by bar length or not.
  //
  // Call update afterwards.
  Histogram.prototype.set_flags = function (flags) {
    if (flags === undefined) { flags = {}; }  this.flags = Object.assign(this.flags, flags);
  };

  // (Re-)computes the counts for this histogram.
  Histogram.prototype.compute_counts = function () {
    var ft = get_type$1(this.data, this.field);
    this.counts = {};
    var bins = this.bins;
    if (ft.kind === "number") {
      var dom;
      var used_discrete = false;
      if (bins == undefined) {
        // count distinct values to see if there are only a few
        var discrete_names = [];
        var discrete_count = 0;
        var discrete = {};
        for (let i = 0; i < this.records.length; ++i) {
          var val = get_field(this.data, this.records[i], this.field);
          if (discrete.hasOwnProperty(val)) {
            discrete[val] += 1;
          } else {
            discrete_count += 1;
            discrete_names.push(val);
            discrete[val] = 1;
          }
        }
        if (discrete_count <= MAX_DISCRETE_BINS) {
          discrete_names.sort((a, b) => a - b);
          this.counts = discrete;
          this.bin_names = discrete_names;
          used_discrete = true;
        }
      }

      if (!used_discrete) { // if the discrete attempt failed
        bins = bins || DEFAULT_BINS;
        if (this.domain === undefined) {
          dom = get_domain$1(this.data, this.field);
        } else if (this.domain === "auto") {
          dom = [undefined, undefined];
          for (let i = 0; i < this.records.length; ++i) {
            var val = get_field(this.data, this.records[i], this.field);
            if (dom[0] === undefined || dom[0] > val) { dom[0] = val; }
            if (dom[1] === undefined || dom[1] < val) { dom[1] = val; }
          }
        } else {
          dom = this.domain;
        }
        var bs = (dom[1] - dom[0]) / bins;
        this.bin_names = [];
        for (let i = 0; i < bins; ++i) {
          this.bin_names.push(
            "" + (dom[0] + bs * i).toPrecision(2) + "–"
          + (dom[0] + bs * (i + 1)).toPrecision(2)
          );
        }
        for (let i = 0; i < this.records.length; ++i) {
          var val = get_field(this.data, this.records[i], this.field);
          var bin;
          if (val == dom[0] + bs * bins) {
            bin = bins-1; // let the last bin be inclusive
          } else {
            bin = Math.floor((val - dom[0]) / bs);
          }
          var bn = this.bin_names[bin];
          if (this.counts.hasOwnProperty(bn)) {
            this.counts[bn] += 1;
          } else {
            this.counts[bn] = 1;
          }
        }
      }
    } else if (ft.kind === "string") {
      this.bin_names = [];
      bin_ints = true;
      for (let i = 0; i < this.records.length; ++i) {
        var val = get_field(this.data, this.records[i], this.field);
        if (this.counts.hasOwnProperty(val)) {
          this.counts[val] += 1;
        } else {
          this.bin_names.push(val);
          var match = val.match(FIND_INT);
          if (match == null) {
            bin_ints = false;
          }
          this.counts[val] = 1;
        }
      }
      if (bin_ints) {
        this.bin_names.sort(
          (a, b) =>
            Number.parseInt(a.match(FIND_INT)[0])
          - Number.parseInt(b.match(FIND_INT)[0])
        );
      } else {
        this.bin_names.sort();
      }
    } else if (ft.kind === "tensor" && ft.value_type.kind === "number") {
      // tensor of numbers
      this.bin_names = [];
      var tdim = ft.dimensions.reduce((a, b) => a * b, 1);
      for (let j = 0; j < tdim; ++j) {
        seq_idx = rollup_index(ft.dimensions, j);
        this.bin_names.push(get_inner_name(this.data, this.field, seq_idx));
      }
      for (let i = 0; i < this.records.length; ++i) {
        for (let j = 0; j < tdim; ++j) {
          var seq_idx = rollup_index(ft.dimensions, j);
          var full_idx = this.field.concat(seq_idx);
          var val = get_field(
            this.data,
            this.records[i],
            full_idx
          );
          var key = this.bin_names[j];
          if (this.flags.force_counts) {
            if (this.counts.hasOwnProperty(key)) {
              this.counts[key] += 1;
            } else {
              this.counts[key] = 1;
            }
          } else {
            if (this.counts.hasOwnProperty(key)) {
              this.counts[key] += val;
            } else {
              this.counts[key] = val;
            }
          }
        }
      }
    } else if (ft.kind === "tensor") { // get repr and treat as string
      this.bin_names = [];
      for (let i = 0; i < this.records.length; ++i) {
        let val = get_field(this.data, this.records[i], this.field);
        let repr$1 = repr(flatten(val));
        if (this.counts.hasOwnProperty(repr$1)) {
          this.counts[repr$1] += 1;
        } else {
          this.bin_names.push(repr$1);
          this.counts[repr$1] = 1;
        }
      }
    } else if (ft.kind === "map") {
      this.bin_names = [];
      var all_numeric = true;
      for (var k in ft.subtypes) {
        if (ft.subtypes.hasOwnProperty(k)) {
          if (ft.subtypes[k].kind != "number") {
            all_numeric = false;
            break;
          }
        }
      }
      for (let i = 0; i < this.records.length; ++i) {
        var val = get_field(this.data, this.records[i], this.field);
        for (var k in val) {
          if (val.hasOwnProperty(k)) {
            var name = get_inner_name(this.data, this.field, [ k ]);
            if (val[k] != undefined && val[k] != null && val[k] != 0) {
              if (this.flags.force_counts || !all_numeric) {
                if (this.counts.hasOwnProperty(name)) {
                  this.counts[name] += 1;
                } else {
                  this.bin_names.push(name);
                  this.counts[name] = 1;
                }
              } else {
                var sv = val[k];
                if (this.counts.hasOwnProperty(name)) {
                  this.counts[name] += sv;
                } else {
                  this.bin_names.push(name);
                  this.counts[name] = sv;
                }
              }
            }
          }
        }
      }
    } else {
      // Don't know how to make a histogram out of that...
      console.warn("Bad data type for histogram.");
      console.warn(this.field);
      console.warn(ft);
      this.bin_names = [];
      this.counts = undefined;
    }

    if (this.flags.average) {
      for (var k in this.counts) {
        if (this.counts.hasOwnProperty(k)) {
          this.counts[k] /= this.records.length;
        }
      }
    }

    if (this.flags.normalize) {
      var mx = undefined;
      // find max
      for (var k in this.counts) {
        if (this.counts.hasOwnProperty(k)) {
          var val = this.counts[k];
          if (mx == undefined || val > mx) {
            mx = val;
          }
        }
      }
      // divide by max
      for (var k in this.counts) {
        if (this.counts.hasOwnProperty(k)) {
          this.counts[k] /= mx;
        }
      }
    }
  };

  // update alias
  Histogram.prototype.update = Histogram.prototype.compute_counts;

  Histogram.prototype.draw = function() {
    // Reset the frame:
    this.frame.selectAll("*").remove();

    if (this.counts === undefined) {
      this.frame.append("text")
        .attr("id", this.id + "_placeholder")
        .attr("class", "label")
        .attr("x", get_width(this.frame)/2)
        .attr("y", get_height(this.frame)/2)
        .style("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .text(
          "Don't know how to create a histogram for: '"
        + get_name(this.data, this.field) + "'"
        );
    } else {

      var fw = get_width(this.frame);
      var fh = get_height(this.frame);

      draw_histogram(
        this.frame,
        this.counts,
        this.bin_names,
        this.bar_limit,
        this.color_widget.get_gradient(),
        this.flags.sort,
      );
    }
  };

  ////////////
  // Matrix //
  ////////////

  function Matrix(id, dataset, records, cols_field, rows_field, vals_field) {
    View.call(this, id, dataset);
    this.records = records || this.data.records;
    this.just_count = false;
    this.color_full_range = false;

    this.set_cols(cols_field);
    this.set_rows(rows_field);
    this.set_value(vals_field);

    this.update();

    var the_view = this;

    this.controls.push(
      new TextSelectWidget(
        "Rows: ",
        function () { return ["<none>"].concat(index_names(the_view.data));},
        function () {
          if (the_view.rows_field == undefined) {
            return "<none>";
          } else {
            return get_name(the_view.data, the_view.rows_field);
          }
        },
        function (iname) {
          if (iname == "<none>") {
            the_view.set_rows(undefined);
          } else {
            the_view.set_rows(iname);
          }
          the_view.update();
          the_view.rebind();
          the_view.draw();
        }
      )
    );

    this.help.push(
      new HelpWidget(
        "Select the field that you want to use for the rows. Numeric or text "
      + "fields are converted to a category vector using a 1-hot encoding "
      + "where their value is a 1 among a vector with slots for each possible "
      + "value in the dataset, and the rest of those slots are undefined (not "
      + "zero). Tensor or map fields are interpreted as a category vector "
      + "where each dimension/subfield is a category, and values in each "
      + "dimension/subfield are the vector components. To build a matrix, for "
      + "each cell of the table, the category values for the row and column "
      + "fields for that cell are multiplied together, and the result is "
      + "multiplied by the value field (if there is one). If either the row or "
      + "column membership is undefined, the cell in question will be skipped "
      + "for this record; otherwise the result is added to the cell in "
      + "question, and after values from all records have been summed, the "
      + "result is divided by the nubmer of contributing records (which may "
      + "differ between cells). So for example, using a text field 'gender' "
      + "for columns and a tensor for rows would show the average value for "
      + "each component of that tensor separated according to the gender "
      + "values. To display interactions, use text/numeric fields for both "
      + "rows and columns and the (numeric) field of interest as the 'value.'"
      )
    );

    this.controls.push(
      new TextSelectWidget(
        "Columns: ",
        function () { return ["<none>"].concat(index_names(the_view.data));},
        function () {
          if (the_view.cols_field == undefined) {
            return "<none>";
          } else {
            return get_name(the_view.data, the_view.cols_field);
          }
        },
        function (iname) {
          if (iname == "<none>") {
            the_view.set_cols(undefined);
          } else {
            the_view.set_cols(iname);
          }
          the_view.update();
          the_view.rebind();
          the_view.draw();
        }
      )
    );

    this.help.push(
      new HelpWidget(
        "Select the field to use for column vectors. See the help for 'Rows' "
      + "for a description of how the matrix is constructed."
      )
    );

    this.controls.push(
      new TextSelectWidget(
        "Value: ",
        function () { return ["<none>"].concat(index_names(the_view.data));},
        function () {
          if (the_view.vals_field == undefined) {
            return "<none>";
          } else {
            return get_name(the_view.data, the_view.vals_field);
          }
        },
        function (iname) {
          if (iname == "<none>") {
            the_view.set_value(undefined);
          } else {
            the_view.set_value(iname);
          }
          the_view.update();
          the_view.rebind();
          the_view.draw();
        }
      )
    );

    this.help.push(
      new HelpWidget(
        "Select the field to use for values. See the help for 'Rows' for the "
      + "details of matrix construction. Note that this is only really useful "
      + "when both rows and columns are 1-hot vectors (i.e., numeric or string "
      + "fields). Set this to 'none' to just use row and column vectors in the "
      + "matrix without multiplying in any other values."
      )
    );

    this.controls.push(
      new ToggleWidget(
        "Count records (instead of averaging values)",
        this.just_count,
        function (yes) {
          the_view.just_count = yes;
          the_view.update();
          the_view.draw();
        }
      )
    );

    this.help.push(
      new HelpWidget(
        "Causes the matrix to just display the number of records that have "
      + "non-missing values for each cell, instead of multiplying "
      + "row/column/value numbers and computing averages. When this is active, "
      + "the 'Value' field is ignored entirely."
      )
    );

    this.controls.push(
      new ToggleWidget(
        "Color using full range (instead of range of averages)",
        this.color_full_range,
        function (yes) {
          the_view.color_full_range = yes;
          the_view.update();
          the_view.draw();
        }
      )
    );

    this.help.push(
      new HelpWidget(
        "Causes colors to be determined based on the full range of values from "
      + "individual records, instead of from the range of averages actually "
      + "displayed in the table."
      )
    );

    this.color_scale_widget = new ColorScaleWidget(
      "custom",
      "#6688cc",
      "#ffd1fe",
      "#ffdf00",
      function () { the_view.draw(); }
    );
    this.controls.push(this.color_scale_widget);

    this.help.push(
      new HelpWidget(
        "This sets the color scale used to color each matrix cell. Normally, "
      + "the endpoints of the scale are mapped to the minimum and maximum "
      + "non-missing values in the table, but see the toggle above."
      )
    );

    this.label_color_widget = new ColorWidget(
      "Label color: ",
      "#000000",
      function () { the_view.draw(); }
    );
    this.controls.push(this.label_color_widget);

    this.help.push(
      new HelpWidget(
        "This controls the color used for the text labels within the matrix "
      + "(but not the row/column labels)."
      )
    );

    this.missing_color_widget = new ColorWidget(
      "Missing color: ",
      "#ffffff",
      function () { the_view.draw(); }
    );
    this.controls.push(this.missing_color_widget);

    this.help.push(
      new HelpWidget(
        "This controls the color used for the background of cells which have "
      + "no data. This can happen when using 1-hot vectors for rows and "
      + "columns if there aren't any (selected, filtered) records that have a "
      + "certain pair of attribute values."
      )
    );
  }

  Matrix.prototype = Object.create(View.prototype);
  Matrix.prototype.constructor = Matrix;

  // Updates the row mapping; call update afterwards.
  Matrix.prototype.set_rows = function (index) {
    if (index == undefined) {
      this.rows_field = undefined;
      this.n_rows = 1;
      this.row_labels = [ "" ];
      this.rows_getter = (d, i) => i == 0 ? 1 : undefined;
    } else {
      if (typeof index === "string") {
        index = lookup_index(this.data, index);
      }
      this.rows_field = index;

      var cx = categorical_transform(this.data, index);
      this.n_rows = cx.n_categories;
      this.row_labels = cx.labels;
      this.rows_getter = cx.getter;
    }
  };

  // Updates the column mapping; call update afterwards.
  Matrix.prototype.set_cols = function (index) {
    if (index == undefined) {
      this.cols_field = undefined;
      this.n_cols = 1;
      this.col_labels = [ "" ];
      this.cols_getter = (d, i) => i == 0 ? 1 : undefined;
    } else {
      if (typeof index === "string") {
        index = lookup_index(this.data, index);
      }
      this.cols_field = index;

      var cx = categorical_transform(this.data, index);
      this.n_cols = cx.n_categories;
      this.col_labels = cx.labels;
      this.cols_getter = cx.getter;
    }
  };

  // Updates the value mapping; call update afterwards.
  Matrix.prototype.set_value = function (index) {
    if (typeof index === "string") {
      index = lookup_index(this.data, index);
    }
    this.vals_field = index;

    if (index == undefined) {
      this.val_domain = [1, 1];
      this.get_val = d => 1;
    } else {
      var nx = numerical_transform(this.data, index);
      this.val_domain = nx.domain;
      this.get_val = nx.getter;
    }
  };

  // Updates the records; call update afterwards.
  Matrix.prototype.set_records = function (records) {
    this.records = records;
  };

  // Computes the matrix values by multiplying categorical values from the row
  // and column fields. If either value is undefined for a record, that record
  // won't contribute to that cell.
  Matrix.prototype.compute_matrix = function () {
    this.matrix = [[]];
    this.counts = [[]];
    this.stdevs = [[]];

    this.full_domain = [undefined, undefined];

    for (let i = 0; i < this.records.length; ++i) {
      var r = this.records[i];
      if (!this.just_count) {
        var val = this.get_val(r);
      }

      for (let col = 0; col < this.n_cols; ++col) {
        if (this.counts[col] == undefined) {
          this.counts[col] = [];
          this.matrix[col] = [];
          this.stdevs[col] = [];
        }
        var cv = this.cols_getter(r, col);
        if (cv == undefined) {
          continue;
        }
        for (let row = 0; row < this.n_rows; ++row) {
          var rv = this.rows_getter(r, row);
          if (rv == undefined) {
            continue;
          }
          if (this.just_count) {
            var nc;
            if (this.counts[col][row] != undefined) {
              nc = this.counts[col][row] + 1;
              this.counts[col][row] = nc;
              this.matrix[col][row] = nc;
            } else {
              nc = 1;
              this.counts[col][row] = nc;
              this.matrix[col][row] = nc;
            }
          } else { // actually worry about values
            var cell_val = cv * rv * val;
            if (
              this.full_domain[0] == undefined
              || cell_val < this.full_domain[0]
            ) {
              this.full_domain[0] = cell_val;
            }
            if (
              this.full_domain[1] == undefined
              || cell_val > this.full_domain[1]
            ) {
              this.full_domain[1] = cell_val;
            }
            var nc;
            if (this.counts[col][row] == undefined) {
              nc = 1;
              this.counts[col][row] = nc;
              this.matrix[col][row] = cell_val;
              this.stdevs[col][row] = 0;
            } else {
              nc = this.counts[col][row] + 1;
              this.counts[col][row] = nc;
              var om = this.matrix[col][row];
              var delta = cell_val - om;
              var nm = om + delta / nc;
              var d2 = cell_val - nm; 
              this.matrix[col][row] = nm;
              this.stdevs[col][row] += delta * d2;
            }
          }
        }
      }
    }

    this.avg_domain = [undefined, undefined];

    // everything might be empty:
    this.empty_rows = new Set(Array.from({length: this.n_rows}, (x,i) => i));
    this.empty_cols = new Set(Array.from({length: this.n_cols}, (x,i) => i));

    // polish standard deviations or fill in domain, fill in missing counts as
    // zeros, and find empty rows/columns
    for (let c = 0; c < this.n_cols; ++c) {
      for (let r = 0; r < this.n_rows; ++r) {
        if (this.counts[c] == undefined) {
          this.counts[c] = [];
          this.matrix[c] = [];
          this.stdevs[c] = [];
        }
        var cv = this.counts[c][r];
        if (cv == undefined) { // no records contributed here
          this.counts[c][r] = 0;
          this.matrix[c][r] = NaN;
          this.stdevs[c][r] = NaN;
          if (this.just_count) { // update domains and set matrix if counting
            this.matrix[c][r] = 0;
            if (this.full_domain[0] == undefined || this.full_domain[0] > 0) {
              this.full_domain[0] = 0;
            }
            if (this.full_domain[1] == undefined || this.full_domain[1] < 0) {
              this.full_domain[1] = 0;
            }
          }
        } else { // there's a value here
          this.empty_cols.delete(c);
          this.empty_rows.delete(r);
          if (cv > 1) {
            var sv = this.stdevs[c][r];
            this.stdevs[c][r] = Math.sqrt(sv / (cv - 1));
          } else {
            this.stdevs[c][r] = 0;
          }
          // update average domain
          if (this.just_count) {
            if (this.avg_domain[0] == undefined || this.avg_domain[0] > cv) {
              this.avg_domain[0] = cv;
            }
            if (this.avg_domain[1] == undefined || this.avg_domain[1] < cv) {
              this.avg_domain[1] = cv;
            }
          } else {
            let val = this.matrix[c][r];
            if (this.avg_domain[0] == undefined || this.avg_domain[0] > val) {
              this.avg_domain[0] = val;
            }
            if (this.avg_domain[1] == undefined || this.avg_domain[1] < val) {
              this.avg_domain[1] = val;
            }
          }
        }
      }
    }
  };

  // update alias
  Matrix.prototype.update = Matrix.prototype.compute_matrix;

  Matrix.prototype.draw = function() {
    // Reset the frame:
    this.frame.selectAll("*").remove();

    var reduced_col_labels = this.col_labels.filter(
      (x, i) => !this.empty_cols.has(i)
    );
    var reduced_row_labels = this.row_labels.filter(
      (x, i) => !this.empty_rows.has(i)
    );

    var reduced_matrix = [];
    for (var c = 0; c < this.n_cols; ++c) {
      if (this.empty_cols.has(c)) { continue; }
      var this_col = [];
      reduced_matrix.push(this_col);
      for (var r = 0; r < this.n_rows; ++r) {
        if (this.empty_rows.has(r)) { continue; }
        this_col.push(this.matrix[c][r]);
      }
    }

    let domain = this.avg_domain;
    if (!this.just_count && this.color_full_range) {
      domain = this.full_domain;
    }

    draw_matrix(
      this.frame,
      reduced_matrix,
      /*
      this.counts,
      this.stdevs,
      */
      domain,
      reduced_col_labels,
      reduced_row_labels,
      this.color_scale_widget.get_gradient(),
      this.missing_color_widget.color,
      this.label_color_widget.color,
    );
  };

  const matrixLib = require('ml-matrix');
  const Matrix$1 = matrixLib.Matrix;
  const EVD = matrixLib.EVD;
  const SVD = matrixLib.SVD;
  const Stat = require('ml-stat/matrix');
  const mean = Stat.mean;
  const stdev = Stat.standardDeviation;

  const defaultOptions = {
      isCovarianceMatrix: false,
      center: true,
      scale: false
  };

  /**
   * Creates new PCA (Principal Component Analysis) from the dataset
   * @param {Matrix} dataset - dataset or covariance matrix
   * @param {Object} options
   * @param {boolean} [options.isCovarianceMatrix=false] - true if the dataset is a covariance matrix
   * @param {boolean} [options.center=true] - should the data be centered (subtract the mean)
   * @param {boolean} [options.scale=false] - should the data be scaled (divide by the standard deviation)
   * */
  class PCA {
      constructor(dataset, options) {
          if (dataset === true) {
              const model = options;
              this.center = model.center;
              this.scale = model.scale;
              this.means = model.means;
              this.stdevs = model.stdevs;
              this.U = Matrix$1.checkMatrix(model.U);
              this.S = model.S;
              return;
          }

          options = Object.assign({}, defaultOptions, options);

          this.center = false;
          this.scale = false;
          this.means = null;
          this.stdevs = null;

          if (options.isCovarianceMatrix) { // user provided a covariance matrix instead of dataset
              this._computeFromCovarianceMatrix(dataset);
              return;
          }

          var useCovarianceMatrix;
          if (typeof options.useCovarianceMatrix === 'boolean') {
              useCovarianceMatrix = options.useCovarianceMatrix;
          } else {
              useCovarianceMatrix = dataset.length > dataset[0].length;
          }

          if (useCovarianceMatrix) { // user provided a dataset but wants us to compute and use the covariance matrix
              dataset = this._adjust(dataset, options);
              const covarianceMatrix = dataset.transposeView().mmul(dataset).div(dataset.rows - 1);
              this._computeFromCovarianceMatrix(covarianceMatrix);
          } else {
              dataset = this._adjust(dataset, options);
              var svd = new SVD(dataset, {
                  computeLeftSingularVectors: false,
                  computeRightSingularVectors: true,
                  autoTranspose: true
              });

              this.U = svd.rightSingularVectors;

              const singularValues = svd.diagonal;
              const eigenvalues = new Array(singularValues.length);
              for (var i = 0; i < singularValues.length; i++) {
                  eigenvalues[i] = singularValues[i] * singularValues[i] / (dataset.length - 1);
              }
              this.S = eigenvalues;
          }
      }

      /**
       * Load a PCA model from JSON
       * @param {Object} model
       * @return {PCA}
       */
      static load(model) {
          if (model.name !== 'PCA')
              throw new RangeError('Invalid model: ' + model.name);
          return new PCA(true, model);
      }


      /**
       * Project the dataset into the PCA space
       * @param {Matrix} dataset
       * @param {Object} options
       * @return {Matrix} dataset projected in the PCA space
       */
      predict(dataset, options = {}) {
          const {
             nComponents = this.U.columns
          } = options;

          dataset = new Matrix$1(dataset);
          if (this.center) {
              dataset.subRowVector(this.means);
              if (this.scale) {
                  dataset.divRowVector(this.stdevs);
              }
          }

          var predictions = dataset.mmul(this.U);
          return predictions.subMatrix(0, predictions.rows - 1, 0, nComponents - 1);
      }

      /**
       * Returns the proportion of variance for each component
       * @return {[number]}
       */
      getExplainedVariance() {
          var sum = 0;
          for (var i = 0; i < this.S.length; i++) {
              sum += this.S[i];
          }
          return this.S.map(value => value / sum);
      }

      /**
       * Returns the cumulative proportion of variance
       * @return {[number]}
       */
      getCumulativeVariance() {
          var explained = this.getExplainedVariance();
          for (var i = 1; i < explained.length; i++) {
              explained[i] += explained[i - 1];
          }
          return explained;
      }

      /**
       * Returns the Eigenvectors of the covariance matrix
       * @returns {Matrix}
       */
      getEigenvectors() {
          return this.U;
      }

      /**
       * Returns the Eigenvalues (on the diagonal)
       * @returns {[number]}
       */
      getEigenvalues() {
          return this.S;
      }

      /**
       * Returns the standard deviations of the principal components
       * @returns {[number]}
       */
      getStandardDeviations() {
          return this.S.map(x => Math.sqrt(x));
      }

      /**
       * Returns the loadings matrix
       * @return {Matrix}
       */
      getLoadings() {
          return this.U.transpose();
      }

      /**
       * Export the current model to a JSON object
       * @return {Object} model
       */
      toJSON() {
          return {
              name: 'PCA',
              center: this.center,
              scale: this.scale,
              means: this.means,
              stdevs: this.stdevs,
              U: this.U,
              S: this.S,
          };
      }

      _adjust(dataset, options) {
          this.center = !!options.center;
          this.scale = !!options.scale;

          dataset = new Matrix$1(dataset);

          if (this.center) {
              const means = mean(dataset);
              const stdevs = this.scale ? stdev(dataset, means, true) : null;
              this.means = means;
              dataset.subRowVector(means);
              if (this.scale) {
                  for (var i = 0; i < stdevs.length; i++) {
                      if (stdevs[i] === 0) {
                          throw new RangeError('Cannot scale the dataset (standard deviation is zero at index ' + i);
                      }
                  }
                  this.stdevs = stdevs;
                  dataset.divRowVector(stdevs);
              }
          }

          return dataset;
      }

      _computeFromCovarianceMatrix(dataset) {
          const evd = new EVD(dataset, {assumeSymmetric: true});
          this.U = evd.eigenvectorMatrix;
          for (var i = 0; i < this.U.length; i++) {
              this.U[i].reverse();
          }
          this.S = evd.realEigenvalues.reverse();
      }
  }

  module.exports = PCA;

  function BaseTransform(dataset, callback, default_index, result_type) {
    BaseWidget.call(this);
    this.data = dataset;
    this.callback = callback;
    this.result_type = result_type || { "kind": "number" };
    this.set_index(default_index);
    var the_tf = this;
    this.selector = new TextSelectWidget(
      "Field: ",
      function () {
        return the_tf.applicable.map(
          idx => get_name(the_tf.data, idx)
        );
      },
      function () { return get_name(the_tf.data, the_tf.index); },
      function (iname) {
        the_tf.set_index(iname);
      }
    );
    this.apply_button = new ButtonWidget(
      "Apply",
      function () {
        the_tf.apply();
        the_tf.trigger_callback();
      }
    );
  }

  BaseTransform.prototype = Object.create(BaseWidget.prototype);
  BaseTransform.prototype.constructor = BaseTransform;

  // Static applicability check (default -> pass everything)
  BaseTransform.applicable_to = function (dataset, index) { return true; };

  // Get name of this transform (even when inherited)
  BaseTransform.prototype.name = function () {
    return Object.getPrototypeOf(this).constructor.name.toLowerCase();
  };

  BaseTransform.prototype.result_index = function () {
    return [ "__" + this.name() + "__", this.result_subindex() ];
  };

  BaseTransform.prototype.result_subindex = function () {
    return get_name_substitute(this.data, this.index);
  };

  // set the index
  BaseTransform.prototype.set_index = function (index) {
    if (typeof index == "string") { index = lookup_index(this.data, index); }
    var apl_fcn = Object.getPrototypeOf(this).constructor.applicable_to;
    this.applicable = all_indices(this.data).filter(
      idx => apl_fcn(this.data, idx)
    );
    this.index = index || this.applicable[0];
  };

  // Default implementation just returns 0
  BaseTransform.prototype.value_for = function (record) { return 0; };

  BaseTransform.prototype.apply = function () {
    if (!has_field(this.data, this.result_index())) {
      this.add_field();
    }
    for (let i = 0; i < this.data.records.length; ++i) {
      var r = this.data.records[i];
      set_field(
        this.data,
        r,
        this.result_index(),
        this.value_for(r, i)
      );
    }
  };

  // Remove controls
  BaseTransform.prototype.remove = function () {
    Object.getPrototypeOf(BaseTransform.prototype).remove.call(this);
    if (this.help) {
      this.help.remove();
    }
    this.selector.remove();
    this.apply_button.remove();
  };

  // Put controls in place
  BaseTransform.prototype.put_controls = function (node, insert_before) {
    Object.getPrototypeOf(
      BaseTransform.prototype
    ).put_controls.call(this, node, insert_before);
    this.selector.put_controls(this.node);
    this.selector.node.classed("transform_selector", true);
    this.apply_button.put_controls(this.node);
    this.apply_button.node.classed("transform_apply_button", true);
  };

  BaseTransform.prototype.add_field = function () {
    var fn = "__" + this.name() + "__";
    if (!has_field(this.data, [ fn ])) {
      add_field(this.data, undefined, fn, {"kind": "map", "subtypes": {}},);
    }
    var ri = this.result_index();
    var si = this.result_subindex();
    if (!has_field(this.data, ri)) {
      add_field(this.data, [ fn ], si, this.result_type);
    }
  };


  // Object to manage a reification operation
  // Reify adds a binary field corresponding to a filter set. Unlike other
  // transforms it doesn't target an index.
  function Reify(dataset, callback) {
    BaseTransform.call(
      this,
      dataset,
      callback,
      undefined,
      { "kind": "number" }
    );
    var the_tf = this;
    this.filter = undefined;
    this.filter = new MultiFilterControls(
      this.data,
      function () { the_tf.update_filter(); }
    );
    this.records = this.data.records;
    this.update_filter();
    this.help = new HelpWidget(
      "This transform adds a numeric field to the dataset that has a value "
    + "of 0 or 1 depending on whether a filter passes. You can use it to bake "
    + "complex filters into the data to make filtering/displaying it simpler."
    );
  }

  Reify.prototype = Object.create(BaseTransform.prototype);
  Reify.prototype.constructor = Reify;

  // Static applicability check
  Reify.applicable_to = function (dataset, index) { return true; };

  Reify.prototype.set_index = function (index) {
    this.applicable = [];
    return;
  };

  // Put controls in place
  Reify.prototype.put_controls = function (node, insert_before) {
    Object.getPrototypeOf(
      Reify.prototype
    ).put_controls.call(this, node, insert_before);
    this.selector.remove(); // get rid of index selector
    // add label with help
    this.node.insert("span", ".transform_apply_button")
      .attr("class", "bold label")
      .text("Reify ");
    this.help.put_controls(this.node, ".transform_apply_button");
    this.node.insert("br", ".transform_apply_button");
    // add filter controls
    this.filter.put_controls(this.node, ".transform_apply_button");
  };

  Reify.prototype.remove = function () {
    this.filter.remove();
    Object.getPrototypeOf(Reify.prototype).remove.call(this);
  };

  Reify.prototype.update_filter = function () {
    if (this.filter == undefined) { return; }
    this.matches = this.filter.matching_indices(this.data.records);
  };

  Reify.prototype.value_for = function (record, index) {
    return +(this.matches.has(index));
  };

  Reify.prototype.result_subindex = function () {
    return this.filter.config_string();
  };


  // Create an object to manage a circularize operation. The callback will be
  // called with the entire object as an argument when the transform is
  // applied.
  function Circularize(dataset, callback, default_index) {
    BaseTransform.call(
      this,
      dataset,
      callback,
      default_index,
      numeric_vector_type(2)
    );
    this.help = new HelpWidget(
      "Circularize applies to a vector-valued field, and produces a new "
    + "2-dimensional vector field as follows: First, each dimension of the "
    + "original vector is assigned a point along the edge of the unit circle. "
    + "Next, each vector is mapped to a weighted average of those points "
    + "according to its normalized values along each dimension. Points that "
    + "are similar in the multidimensional space will be mapped to similar "
    + "places in the 2D space, although other non-similar points could also "
    + "overlap by coincidence. Using the new dimensions as x- and y- axes for "
    + "the lens view plus a histogram view of the original multidimensional "
    + "field should provide insight as to what got mapped where."
    );
  }

  Circularize.prototype = Object.create(BaseTransform.prototype);
  Circularize.prototype.constructor = Circularize;

  // TODO: sort dimensions for better circularization?

  // Static applicability check
  Circularize.applicable_to = function (dataset, index) {
    if (typeof index == "string") { index = lookup_index(dataset, index); }
    var typ = get_type$1(dataset, index);
    return typ.kind == "tensor" || typ.kind == "map";
  };

  Circularize.prototype.set_index = function (index) {
    Object.getPrototypeOf(Circularize.prototype).set_index.call(this, index);
    this.vt = vector_transform(this.data, this.index);
  };

  Circularize.prototype.put_controls = function (node, insert_before) {
    Object.getPrototypeOf(
      Circularize.prototype
    ).put_controls.call(this, node, insert_before);
    this.node.insert("span", ".transform_selector")
      .attr("class", "bold label")
      .text("Circularize ");
    this.help.put_controls(this.node, ".transform_selector");
    this.node.insert("br", ".transform_selector");
  };

  Circularize.prototype.remove = function() {
    Object.getPrototypeOf(Circularize.prototype).remove.call(this);
  };

  // Value for a record defines the core of the transformation
  Circularize.prototype.value_for = function (record) {
    var n_poles = this.vt.dimensions;
    var vec = this.vt.getter(record);
    var norm = softnorm(vec);
    var ns = norm.reduce((a, b) => Math.abs(a) + Math.abs(b));
    var r = [0, 0];
    for (let i = 0; i < n_poles; ++i) {
      var pc = this.pole_coordinates(i);
      r[0] += pc[0] * norm[i];
      r[1] += pc[1] * norm[i];
    }
    var result = [r[0] / ns, r[1] / ns];
    return result;
  };

  // Returns the linearized index for the ith pole, which dictates that pole's
  // pole coordinates (with a bit of trig). See pole_coordinates below for
  // details of where things are placed.
  Circularize.prototype.pole_index = function (i) {
    var n_poles = this.vt.dimensions;
    var step;
    if (n_poles <= 6) {
      step = 1;
    } else {
      step = Math.ceil(n_poles / 6);
    }
    var steps_around = Math.floor(n_poles / step);
    var leftovers = n_poles % step;

    if (n_poles - i <= leftovers) {
      return i;
    }

    var which_cycle = Math.floor(i / steps_around);
    var cycle_steps = i % steps_around;

    return which_cycle + step * cycle_steps;
  };

  // Returns the coordinates for the ith pole. The poles for each dimension are
  // arranged in a circle (hence the name of the transformation) such that the
  // most popular pole is at the top (actually at [0, 1], which might be the
  // bottom for y=down coordinates), and sequentially less-popular poles are
  // each 1/6th of the way clockwise around the circle (or as near as can be to
  // that position according to the number of poles). Exact zero vectors are
  // placed in the center of the circle; when the number of items is less than
  // 12, the items are just placed sequentially around the circle.
  Circularize.prototype.pole_coordinates = function (i) {
    var n_poles = this.vt.dimensions;
    var pi = this.pole_index(i);
    var step_size = 2 * Math.PI / n_poles;
    var theta = (Math.PI / 2) - step_size * pi;
    return [ Math.cos(theta), Math.sin(theta) ];
  };


  // Object to manage a differentiate operation
  function Differentiate(dataset, callback, default_index) {
    BaseTransform.call(
      this,
      dataset,
      callback,
      default_index,
      numeric_vector_type(2)
    );
    var the_tf = this;
    this.first_label = undefined;
    this.second_label = undefined;
    this.first_index_filters = undefined;
    this.second_index_filters = undefined;
    this.first_index_filters = new MultiFilterControls(
      this.data,
      function () { the_tf.update_first(); },
      "Origin criteria:"
    );
    this.second_index_filters = new MultiFilterControls(
      this.data,
      function () { the_tf.update_second(); },
      "Endpoint criteria:"
    );
    this.first_records = this.data.records;
    this.second_records = this.data.records;
    this.update_first();
    this.update_second();
    this.help = new HelpWidget(
      "Differentiate applies to a multidimensional field and produces a "
    + "2-dimensional field by projecting onto an artificial axis created by "
    + "drawing a line between the average vectors of two distinct subsets of "
    + "the data. This requires that the user specify two different filters, "
    + "each of which identifies a subset of the original data (the union of "
    + "these subsets doesn't have to be the full dataset). The first dimension "
    + "of the result is the projection of each multidimensional point onto "
    + "the line that intersects the average points of each selected subset, "
    + "with a value of '0' at the start of that line and a value of '1' at the "
    + "end (points before the start and after the end get negative and more-"
    + "positive values). The second dimension of the result is the Euclidean "
    + "distance in the multidimensional space from the point being mapped to "
    + "the target line."
    );
  }

  Differentiate.prototype = Object.create(BaseTransform.prototype);
  Differentiate.prototype.constructor = Differentiate;

  // Static applicability check
  Differentiate.applicable_to = function (dataset, index) {
    if (typeof index == "string") { index = lookup_index(dataset, index); }
    var typ = get_type$1(dataset, index);
    return typ.kind == "tensor" || typ.kind == "map";
  };

  Differentiate.prototype.set_index = function (index) {
    Object.getPrototypeOf(Differentiate.prototype).set_index.call(this, index);
    this.vt = vector_transform(this.data, this.index);
  };

  // Put controls in place
  Differentiate.prototype.put_controls = function (node) {
    Object.getPrototypeOf(Differentiate.prototype).put_controls.call(this,node);
    this.node.insert("span", ".transform_selector")
      .attr("class", "bold label")
      .text("Differentiate ");
    this.help.put_controls(this.node, ".transform_selector");
    this.node.insert("br", ".transform_selector");
    // add first label
    this.first_index_filters.put_controls(this.node, ".transform_apply_button");
    this.second_index_filters.put_controls(this.node,".transform_apply_button");
  };

  Differentiate.prototype.remove = function () {
    if (this.first_label) { this.first_label.remove(); }
    if (this.first_index_filters) { this.first_index_filters.remove(); }
    if (this.second_label) { this.second_label.remove(); }
    if (this.second_index_filters) { this.second_index_filters.remove(); }
    Object.getPrototypeOf(Differentiate.prototype).remove.call(this);
  };

  Differentiate.prototype.update_first = function () {
    if (this.first_index_filters == undefined) { return; }
    this.first_records = this.first_index_filters.apply_filter(
      this.data.records
    );
    if (this.first_records.length == 0) { return; }
    this.start_vectors = this.first_records.map(r => this.vt.getter(r));
    this.start_locus = this.start_vectors[0].slice();
    for (let i = 1; i < this.start_vectors.length; ++i) {
      let vec = this.start_vectors[i];
      add_into(this.start_locus, vec);
    }
    scale_by(this.start_locus, 1/this.start_vectors.length);
    if (this.start_locus && this.end_locus) {
      this.axis = sub(this.end_locus, this.start_locus);
    }
  };

  Differentiate.prototype.update_second = function () {
    if (this.second_index_filters == undefined) { return; }
    this.second_records = this.second_index_filters.apply_filter(
      this.data.records
    );
    if (this.second_records.length == 0) { return; }
    this.end_vectors = this.second_records.map(r => this.vt.getter(r));
    this.end_locus = this.end_vectors[0].slice();
    for (let i = 1; i < this.end_vectors.length; ++i) {
      let vec = this.end_vectors[i];
      add_into(this.end_locus, vec);
    }
    scale_by(this.end_locus, 1/this.end_vectors.length);
    if (this.start_locus && this.end_locus) {
      this.axis = sub(this.end_locus, this.start_locus);
    }
  };

  Differentiate.prototype.value_for = function (record) {
    var vec = this.vt.getter(record);
    var rvec = sub(vec, this.start_locus);
    return [pmag(rvec, this.axis), ldist(rvec, this.axis)];
  };

  Differentiate.prototype.result_subindex = function () {
    return (
      get_name_substitute(this.data, this.index)
    + "("
    + this.first_index_filters.config_string()
    + "⇒"
    + this.second_index_filters.config_string()
    + ")"
    );
  };


  // Object to manage a combine operation
  // Combine adds new field to the dataset which combines values from one field
  // across all records that share values in a second field.
  // TODO: Allow grouping by multiple fields
  // TODO: Allow specifying (multiple?) weight indices
  function Combine(dataset, callback, default_index) {
    BaseTransform.call(
      this,
      dataset,
      callback,
      default_index,
      undefined // will be filled in by set_index
    );
    var the_tf = this;
    this.set_group_by();
    this.across = new SetSelectWidget(
      "Group by ",
      all_indices(this.data).map(idx => get_name(the_tf.data, idx)),
      function (selected) {
        the_tf.set_group_by(selected);
      }
    );
    this.help = new HelpWidget(
      "This transform adds a field to the dataset that combines values from "
    + "the target field across records that have the same value for each of "
    + "the given 'group by' field(s). For numbers, the mean is used, while "
    + "text fields generate a map of value-counts. Tensors and maps fuse their "
    + "individual sub-fields recursively."
    );
  }

  Combine.prototype = Object.create(BaseTransform.prototype);
  Combine.prototype.constructor = Combine;

  // Static applicability check
  Combine.applicable_to = function (dataset, index) { return true; };

  Combine.prototype.set_index = function (index) {
    Object.getPrototypeOf(Combine.prototype).set_index.call(this, index);
    this.result_type = fused_type(this.data, this.index);
    this.stale = true;
  };

  // Put controls in place
  Combine.prototype.put_controls = function (node, insert_before) {
    Object.getPrototypeOf(
      Combine.prototype
    ).put_controls.call(this, node, insert_before);
    // add label with help
    this.node.insert("span", ".transform_apply_button")
      .attr("class", "bold label")
      .text("Combine ");
    this.help.put_controls(this.node, ".transform_apply_button");
    this.node.insert("br", ".transform_apply_button");
    // add 'group by' control
    this.across.put_controls(this.node, ".transform_apply_button");
  };

  Combine.prototype.remove = function () {
    this.across.remove();
    Object.getPrototypeOf(Combine.prototype).remove.call(this);
  };

  Combine.prototype.set_group_by = function (selected) {
    if (selected == undefined) {
      this.group_by = [];
    } else {
      let indices = [];
      for (let str of selected) {
        indices.push(lookup_index(this.data, str));
      }
      this.group_by = indices;
    }
    this.group_values = {};
    this.stale = true;
  };

  Combine.prototype.key_for = function (r) {
    let key = "";
    for (let idx of this.group_by) {
      key += "`" + get_field(this.data, r, idx);
    }
    return key;
  };

  Combine.prototype.compute_group_values = function () {
    var the_tf = this;
    // build an index map
    this.grouped_records = {};
    this.data.records.forEach(function (r) {
      let key = the_tf.key_for(r);
      if (the_tf.grouped_records.hasOwnProperty(key)) {
        the_tf.grouped_records[key].push(r);
      } else {
        the_tf.grouped_records[key] = [ r ];
      }
    });
    // compute values for each group
    this.group_values = {};
    for (let k of Object.keys(this.grouped_records)) {
      let records = this.grouped_records[k];
      this.group_values[k] = fuse_values(this.data, records, this.index);
    }
    this.stale = false;
  };

  Combine.prototype.value_for = function (record) {
    let key = this.key_for(record);
    if (this.stale) {
      this.compute_group_values();
    }

    return this.group_values[key]; // might be undefined; that's okay
  };

  Combine.prototype.result_subindex = function () {
    return (
      get_name_substitute(this.data, this.index)
    + "_by_"
    + this.group_by.map(idx => get_name_substitute(this.data, idx)).join(';')
    );
  };

  // Object to manage a group operation
  // Group adds a new vector field to the dataset which combines values from
  // one or more other fields.
  function Group(dataset, callback, default_index) {
    BaseTransform.call(
      this,
      dataset,
      callback,
      undefined,
      undefined // will be filled in by set_index
    );
    var the_tf = this;
    this.set_group();
    this.targets = new SetSelectWidget(
      "Group fields ",
      all_indices(this.data).map(idx => get_name(the_tf.data, idx)),
      function (selected) {
        the_tf.set_group(selected);
      }
    );
    this.help = new HelpWidget(
      "This transform adds a field to the dataset that combines values from "
    + "several other fields into a single vector field."
    );
  }

  Group.prototype = Object.create(BaseTransform.prototype);
  Group.prototype.constructor = Group;

  // Static applicability check
  Group.applicable_to = function (dataset, index) { return true; };

  Group.prototype.set_index = function (index) {
    this.applicable = [];
    return;
  };

  // Put controls in place
  Group.prototype.put_controls = function (node, insert_before) {
    Object.getPrototypeOf(
      Group.prototype
    ).put_controls.call(this, node, insert_before);
    this.selector.remove(); // get rid of index selector
    // add label with help
    this.node.insert("span", ".transform_apply_button")
      .attr("class", "bold label")
      .text("Group ");
    this.help.put_controls(this.node, ".transform_apply_button");
    this.node.insert("br", ".transform_apply_button");
    // add 'group by' control
    this.targets.put_controls(this.node, ".transform_apply_button");
  };

  Group.prototype.remove = function () {
    this.targets.remove();
    Object.getPrototypeOf(Group.prototype).remove.call(this);
  };

  Group.prototype.set_group = function (selected) {
    if (selected == undefined) {
      this.group_by = [];
      this.result_type = { "kind": "undefined" };
    } else {
      let indices = [];
      let subtypes = [];
      for (let str of selected) {
        let idx = lookup_index(this.data, str);
        indices.push(idx);
        subtypes.push(get_type$1(this.data, idx));
      }
      this.group_by = indices;
      this.result_type = prp.array_type(subtypes);
    }
  };

  Group.prototype.value_for = function (record) {
    let value = [];
    for (let idx of this.group_by) {
      value.push(get_field(this.data, record, idx));
    }
    return value;
  };

  Group.prototype.result_subindex = function () {
    return this.group_by.map(
      idx => get_name_substitute(this.data, idx)
    ).join(';');
  };



  // Object to manage a PCA operation
  function PCA$1(dataset, callback) {
    BaseTransform.call(
      this,
      dataset,
      callback,
      undefined,
      undefined // number of eigenvalues is dynamic
    );
    console.warn("PCA is not implemented yet!");
  }

  PCA$1.prototype = Object.create(BaseTransform.prototype);
  PCA$1.prototype.constructor = PCA$1;

  // Static applicability check
  PCA$1.applicable_to = function (dataset, index) {
    if (typeof index == "string") { index = lookup_index(dataset, index); }
    var typ = get_type$1(dataset, index);
    return typ.kind == "tensor" || typ.kind == "map";
  };

  PCA$1.prototype.set_index = function (index) {
    Object.getPrototypeOf(PCA$1.prototype).set_index.call(this, index);
    this.vt = vector_transform(dataset, this.index);

    let vectors = this.data.records.map(r => this.vt.getter(r));

    this.pca = new undefined(vectors);

    // Figure out result type:
    this.result_type = numeric_vector_type(this.pca.getEigenvalues().length);
  };

  PCA$1.prototype.value_for = function (record) {
    return this.pca.predict([this.vt.getter(record)])[0];
  };

  // copied from https://github.com/Canop/JSON.parseMore, which was adapted
  // from Crockford's JSON.parse (https://github.com/douglascrockford/JSON-js)
  // This version adds support for NaN, -Infinity and Infinity.
  // Modified into an object-oriented package.

  var ESCAPE = {
    '"':  '"',
    '\\': '\\',
    '/':  '/',
    b:  '\b',
    f:  '\f',
    n:  '\n',
    r:  '\r',
    t:  '\t'
  };

  function ParseState(text) {
    this.text = text;
    this.error = undefined;
    this.at = 0;
    if (text.length > 0) {
      this.ch = text[0];
    } else {
      this.ch = undefined;
    }
  }

  ParseState.prototype.throwError = function(m) {
    this.error = m;
    throw {
      name: "SyntaxError",
      message: m,
      at: this.at,
      text: this.text
    };
  };

  ParseState.prototype.next = function() {
    this.at += 1;
    this.ch = this.text.charAt(this.at);
    return this.ch;
  };

  ParseState.prototype.check = function (c) {
    if (c !== this.ch) {
      this.throwError("Expected '" + c + "' instead of '" + this.ch + "'");
    }
    this.next();
  };

  ParseState.prototype.number = function () {
    var string = '';
    if (this.ch === '-') {
      string = '-';
      this.check('-');
    }
    if (this.ch === 'I') {
      this.check('I');
      this.check('n');
      this.check('f');
      this.check('i');
      this.check('n');
      this.check('i');
      this.check('t');
      this.check('y');
      if (string === '-') {
        return -Infinity;
      } else {
        return Infinity;
      }
    }
    while (this.ch >= '0' && this.ch <= '9') {
      string += this.ch;
      this.next();
    }
    if (this.ch === '.') {
      string += '.';
      while (this.next() && this.ch >= '0' && this.ch <= '9') {
        string += this.ch;
      }
    }
    if (this.ch === 'e' || this.ch === 'E') {
      string += this.ch;
      this.next();
      if (this.ch === '-' || this.ch === '+') {
        string += this.ch;
        this.next();
      }
      while (this.ch >= '0' && this.ch <= '9') {
        string += this.ch;
        this.next();
      }
    }
    return +string;
  };

  ParseState.prototype.string = function () {
    var hex,
      i,
      string = '',
      uffff;
    if (this.ch === '"') {
      while (this.next()) {
        if (this.ch === '"') {
          this.next();
          return string;
        }
        if (this.ch === '\\') {
          this.next();
          if (this.ch === 'u') {
            uffff = 0;
            for (i = 0; i < 4; i ++) {
              hex = parseInt(this.next(), 16);
              if (!isFinite(hex)) {
                break;
              }
              uffff = uffff * 16 + hex;
            }
            string += String.fromCharCode(uffff);
          } else if (ESCAPE[this.ch]) {
            string += ESCAPE[this.ch];
          } else {
            break;
          }
        } else {
          string += this.ch;
        }
      }
    }
    this.throwError("Bad string");
  };

  ParseState.prototype.white = function () { // Skip whitespace.
    while (this.ch && this.ch <= ' ') {
      this.next();
    }
  };

  ParseState.prototype.word = function () {
    switch (this.ch) {
    case 't':
      this.check('t');
      this.check('r');
      this.check('u');
      this.check('e');
      return true;
    case 'f':
      this.check('f');
      this.check('a');
      this.check('l');
      this.check('s');
      this.check('e');
      return false;
    case 'n':
      this.check('n');
      this.check('u');
      this.check('l');
      this.check('l');
      return null;
    case 'N':
      this.check('N');
      this.check('a');
      this.check('N');
      return NaN;
    case 'I':
      this.check('I');
      this.check('n');
      this.this.check('f');
      this.check('i');
      this.check('n');
      this.check('i');
      this.check('t');
      this.check('y');
      return Infinity;
    }
    this.throwError("Unexpected '" + this.ch + "'");
  };

  ParseState.prototype.array = function () {
    var array = [];
    if (this.ch === '[') {
      this.check('[');
      this.white();
      if (this.ch === ']') {
        this.check(']');
        return array;   // empty array
      }
      while (this.ch) {
        array.push(this.value());
        this.white();
        if (this.ch === ']') {
          this.check(']');
          return array;
        }
        this.check(',');
        this.white();
      }
    }
    this.throwError("Bad array");
  };

  ParseState.prototype.object = function () {
    var key, object = {};
    if (this.ch === '{') {
      this.check('{');
      this.white();
      if (this.ch === '}') {
        this.check('}');
        return object;   // empty object
      }
      while (this.ch) {
        key = this.string();
        this.white();
        this.check(':');
        if (Object.hasOwnProperty.call(object, key)) {
          this.throwError('Duplicate key "' + key + '"');
        }
        object[key] = this.value();
        this.white();
        if (this.ch === '}') {
          this.check('}');
          return object;
        }
        this.check(',');
        this.white();
      }
    }
    this.throwError("Bad object");
  };

  ParseState.prototype.value = function () {
    this.white();
    switch (this.ch) {
      case '{':
        return this.object();
      case '[':
        return this.array();
      case '"':
        return this.string();
      case '-':
        return this.number();
      default:
        return this.ch >= '0' && this.ch <= '9' ? this.number() : this.word();
    }
  };

  function walk(holder, key, reviver) {
    let value = holder[key];
    if (value && typeof value === 'object') {
      for (let k in value) {
        if (Object.prototype.hasOwnProperty.call(value, k)) {
          let v = walk(value, k, reviver);
          if (v !== undefined) {
            value[k] = v;
          } else {
            delete value[k];
          }
        }
      }
    }
    return reviver.call(holder, key, value);
  }

  function parse(source, reviver){
    var result;
    var ps = new ParseState(source);
    result = ps.value();
    ps.white();
    if (ps.ch) {
      throw {
        name: "SyntaxError",
        message: "Leftover input.",
      };
    }
    if (typeof reviver === "function") {
      return walk({'': result}, '', reviver);
    } else {
      return result;
    }
  }

  // TODO: Implement NaN/Infinity-preserving stringify?

  /*
   * Module variables:
   */

  // Milliseconds to wait during active polling.
  var THUNK_MS = 75;

  // Default margin value (fraction of total frame reserved)
  var MARGIN = 0.06;

  // The current views for the left and right windows
  var LEFT_VIEW = undefined;
  var RIGHT_VIEW = undefined;
  var SAVED_VIEWS = {};

  // The right-pane mode select widget
  var RIGHT_SELECT = undefined;

  // The transformation widget
  var TRANSFORM_SELECT = undefined;
  var CURRENT_TRANSFORM = undefined;
  var SAVED_TRANSFORMS = {};

  // Available transforms:
  var AVAILABLE_TRANSFORMS = {
    "reify": Reify,
    "combine": Combine,
    "group": Group,
    "circularize": Circularize,
    "differentiate": Differentiate,
    "PCA": PCA$1,
  };

  // The lens toggle
  var LENS_TOGGLE = undefined;
  var IGNORE_SELECTION = true;

  // The filter widget
  var FILTER = undefined;

  // DOM objects
  var LEFT_WINDOW;
  var LEFT_FRAME;
  var LEFT_CONTROLS;
  var RIGHT_WINDOW;
  var RIGHT_FRAME;
  var RIGHT_CONTROLS;

  /*
   * Event handlers
   */

  function resize() {
    var lw = get_width(LEFT_WINDOW);
    var lhm = lw * MARGIN;
    var lh = get_height(LEFT_WINDOW);
    var lvm = lh * MARGIN;
    LEFT_FRAME.attr("width", lw - 2*lhm).attr("height", lh - 2*lvm);

    var rw = get_width(RIGHT_WINDOW);
    var rhm = lw * MARGIN;
    var rh = get_height(RIGHT_WINDOW);
    var rvm = lh * MARGIN;
    RIGHT_FRAME.attr("width", rw - 2*rhm).attr("height", rh - 2*rvm);

    if (LEFT_VIEW && LEFT_VIEW.frame) {
      LEFT_VIEW.rebind();
      LEFT_VIEW.draw();
    }
    if (RIGHT_VIEW && RIGHT_VIEW.frame) {
      RIGHT_VIEW.rebind();
      RIGHT_VIEW.draw();
    }
  }

  function file_chosen() {
    setTimeout(eventually_process_uploaded_file, 50, select(this));
  }

  function eventually_process_uploaded_file(element) {
    var files = element.node().files;
    if (files === null || files === undefined || files.length < 1) {
      setTimeout(eventually_process_uploaded_file, THUNK_MS, element);
    } else {
      var first = files[0];
      var fr = new FileReader();
      fr.onload = function (e) {
        var file_text = e.target.result;
        try {
          var jobj = parse(file_text);
        } catch (e) {
          var jobj = { "error": true };
        }
        populate_data(jobj);
      };
      fr.readAsText(first);
    }
  }

  function set_right_mode(data, mode) {
    if (RIGHT_VIEW != undefined) {
      RIGHT_VIEW.frame.selectAll("*").remove();
      RIGHT_VIEW.remove_controls();
    }
    if (SAVED_VIEWS.hasOwnProperty(mode)) {
      RIGHT_VIEW = SAVED_VIEWS[mode];
    } else if (mode == "histogram") {
      RIGHT_VIEW = new Histogram(
        "right",
        data,
        [], // selection gets updated below
        nth_of_kind(data, "map", 0) || nth_of_kind(data, "number", 0),
      );
    } else if (mode == "matrix") {
      RIGHT_VIEW = new Matrix(
        "right",
        data,
        [], // selection gets updated below
        nth_of_kind(data, "string", 0) || nth_of_kind(data, "tensor", 0),
        nth_of_kind(data, "string", 1) || nth_of_kind(data, "tensor", 1),
        undefined,
      );
    } else {
      console.warn("Invalid mode argument to set_right_mode: '" + mode + "'");
    }
    SAVED_VIEWS[mode] = RIGHT_VIEW;

    RIGHT_VIEW.bind_frame(RIGHT_FRAME);
    RIGHT_VIEW.put_controls(RIGHT_CONTROLS);
    RIGHT_WINDOW.select("#right_placeholder").style("display", "none");
    update_selection(data); // triggers redraw
  }

  function update_selection(dataset) {
    var selected;
    var filtered;
    if (IGNORE_SELECTION) {
      selected = dataset.records;
    } else {
      selected = LEFT_VIEW.selected;
    }
    if (FILTER) {
      filtered = FILTER.apply_filter(selected);
    } else {
      filtered = selected;
    }

    // Update selection count
    var nsel = selected.length;
    var nfil = filtered.length;

    var sc = select("#selcount");
    sc.selectAll(".sel_display").remove();
    sc.append("span")
      .attr("class", "sel_display")
      .text(nsel + " selected » " + nfil + " filtered");

    RIGHT_VIEW.set_records(filtered);
    RIGHT_VIEW.update();
    RIGHT_VIEW.draw();
  }

  function transform_named(data, name) {
    var transform = undefined;
    if (SAVED_TRANSFORMS.hasOwnProperty(name)) {
      transform = SAVED_TRANSFORMS[name];
    } else if (AVAILABLE_TRANSFORMS.hasOwnProperty(name)) {
      transform = new AVAILABLE_TRANSFORMS[name](
        data,
        function () { // callback
          TRANSFORM_SELECT.put_controls();
          LEFT_VIEW.put_controls();
          RIGHT_VIEW.put_controls();
        }
      );
      SAVED_TRANSFORMS[name] = transform;
    } else {
      console.warn("Request for unknown transformation type '" + name + "'.");
    }
    return transform;
  }

  /*
   * Setup functions
   */

  // Called after data is loaded
  function populate_data(data) {
    var mk = missing_keys(data);
    if (mk.length > 0) {
      LEFT_WINDOW.select("#left_placeholder")
        .text("Invalid data file. Did you run the preprocessor? (see console)");
      console.error("Invalid data file. Missing keys:");
      console.error(mk);
      console.error("Data object:");
      console.error(data);
      return;
    }

    // Names of each data property:
    var inames = index_names(data);

    // right window mode select
    if (RIGHT_SELECT != undefined) {
      RIGHT_SELECT.help.remove();
      RIGHT_SELECT.remove();
    }
    RIGHT_SELECT = new SelectWidget(
      "Right pane mode: ",
      ["histogram", "matrix"],
      "histogram",
      function (selected) {
        set_right_mode(data, selected);
      }
    );

    RIGHT_SELECT.put_controls(select("#top_panel"));
    RIGHT_SELECT.help = new HelpWidget(
      "Use this to select which graph mode will be used for the right-hand "
    + "viewing pane. Options will be saved when switching modes. 'Histogram' "
    + "mode is useful to quickly view the data, while 'matrix' mode can be "
    + "used to make detailed comparisons between multiple categories."
    );
    RIGHT_SELECT.node.append("span").text(NBSP);
    RIGHT_SELECT.help.put_controls(RIGHT_SELECT.node);

    // the lens toggle
    if (LENS_TOGGLE != undefined) {
      LENS_TOGGLE.help.remove();
      LENS_TOGGLE.remove();
    }
    LENS_TOGGLE = new ToggleWidget(
      "Select all",
      true,
      function (ignore) {
        IGNORE_SELECTION = ignore;
        update_selection(data);
      }
    );
    LENS_TOGGLE.put_controls(select("#selcount"));
    LENS_TOGGLE.node.append("span").text(NBSP);
    LENS_TOGGLE.help = new HelpWidget(
      "Toggle this to ignore the selection circle from the left-hand view and "
    + "count all records as selected. The numbers below show how many records "
    + "are currently selected, and how many of those pass the specified "
    + "filter(s)."
    );
    LENS_TOGGLE.help.put_controls(LENS_TOGGLE.node);

    // transforms
    let trf = select("#transform");
    trf.selectAll("*").remove();
    trf.classed("collapsed", true);
    let thead = trf.append("div").attr("class", "controls_row");
    let tcollapse = thead.append("a");
    tcollapse.attr("class", "black_button button")
      .text("▾")
      .on("click touchend", function () {
        if (tcollapse.node().innerText == "▾") {
          tcollapse.text("–");
          trf.classed("collapsed", false);
        } else {
          tcollapse.text("▾");
          trf.classed("collapsed", true);
        }
      });
    thead.append("span").attr("class", "label").text("Transform:");
    var thelp = new HelpWidget(
      "Expand this panel to access data transformation options. "
    + "Select a transformation type and the settings for that type will appear "
    + "along with specific help for that type. When applied, each transform "
    + "will make new data fields available for selection in all of the places "
    + "that a data field can be used. Some transforms may take a bit of time "
    + "to complete depending on the size of the dataset."
    );
    thelp.put_controls(thead);
    let tbody = undefined;

    if (TRANSFORM_SELECT != undefined) {
      TRANSFORM_SELECT.remove();
    }
    let tfoptions = Array.from(Object.keys(AVAILABLE_TRANSFORMS));
    TRANSFORM_SELECT = new TextSelectWidget(
      "Transformation: ",
      tfoptions, // options
      tfoptions[0], // default
      function (selected) {
        if (CURRENT_TRANSFORM) {
          CURRENT_TRANSFORM.remove();
        }
        CURRENT_TRANSFORM = transform_named(data, selected);
        // tbody.selectAll("*").remove();
        CURRENT_TRANSFORM.put_controls(tbody);
      }
    );
    TRANSFORM_SELECT.put_controls(trf);
    tbody = trf.append("div");
    CURRENT_TRANSFORM = transform_named(
      data,
      Object.keys(AVAILABLE_TRANSFORMS)[0]
    );
    CURRENT_TRANSFORM.put_controls(tbody);

    let flt = select("#filters");
    flt.attr("class", "control_panel collapsed");
    let fhead = flt.append("div").attr("class", "controls_row");
    let fcollapse = fhead.append("a");
    fcollapse.attr("class", "black_button button")
      .text("▾")
      .on("click touchend", function () {
        if (fcollapse.node().innerText == "▾") {
          fcollapse.text("–");
          flt.attr("class", "control_panel");
        } else {
          fcollapse.text("▾");
          flt.attr("class", "control_panel collapsed");
        }
      });
    fhead.append("span").attr("class", "label").text("Filter:");
    var fhelp = new HelpWidget(
      "Expand this panel to access data filtering options. The selected "
    + "filters will be applied to the data from the left-hand graph before "
    + "it is displayed in the right-hand graph. The filter will be applied to "
    + "selected items, and the number of selected and filtered items is shown "
    + "above."
    );
    fhelp.put_controls(fhead);

    // filters
    if (FILTER != undefined) {
      FILTER.remove();
    }
    FILTER = new MultiFilterControls(
      data,
      function () { update_selection(data); }
    );

    FILTER.put_controls(flt);

    // left view
    if (LEFT_VIEW != undefined) {
      select("#left_controls").selectAll("*").remove();
    }
    LEFT_VIEW = new LensView(
      "left",
      data,
      nth_of_kind(data, "number", 0),
      nth_of_kind(data, "number", 1),
    );
    LEFT_VIEW.bind_frame(LEFT_FRAME);
    LEFT_VIEW.put_controls(LEFT_CONTROLS);
    LEFT_WINDOW.select("#left_placeholder").style("display", "none");
    LEFT_VIEW.draw();

    // right view
    var hdefault = nth_of_kind(data, "map", 0);
    if (hdefault === undefined) {
      hdefault = nth_of_kind(data, "string", 0);
    }
    if (hdefault === undefined) {
      hdefault = nth_of_kind(data, "number", 2);
    }
    if (hdefault === undefined) {
      hdefault = data.indices[0];
    }
    if (RIGHT_VIEW != undefined) {
      select("#right_controls").selectAll("*").remove();
    }

    set_right_mode(data, "histogram");

    update_selection(data);

    // hook view together
    LEFT_VIEW.subscribe_to_selection(function (items) {
      update_selection(data);
    });
  }

  // Main setup
  function do_viz() {
    var upload_help = new HelpWidget(
      "The preprocessor can accept CSV and TSV files, but the visualizer needs "
    + "extra information about data fileds and types. Upload a file there "
    + "first and download the result to upload here. Note that all processing "
    + "and visualization is handled locally in your browser; neither page "
    + "connects to an external server."
    );
    upload_help.put_controls(select("#top_controls_row"));
    LEFT_WINDOW = select("#left_window");
    var lw = get_width(LEFT_WINDOW);
    var lhm = lw * MARGIN;
    var lh = get_height(LEFT_WINDOW);
    var lvm = lh * MARGIN;
    LEFT_FRAME = LEFT_WINDOW.append("g")
      .attr("class", "frame")
      .attr("transform", "translate(" + lhm + "," + lvm + ")")
      .attr("width", lw - 2*lhm)
      .attr("height", lh - 2*lvm);
    RIGHT_WINDOW = select("#right_window");
    var rw = get_width(RIGHT_WINDOW);
    var rhm = lw * MARGIN;
    var rh = get_height(RIGHT_WINDOW);
    var rvm = lh * MARGIN;
    RIGHT_FRAME = RIGHT_WINDOW.append("g")
      .attr("class", "frame")
      .attr("transform", "translate(" + rhm + "," + rvm + ")")
      .attr("width", rw - 2*rhm)
      .attr("height", rh - 2*rvm);
    LEFT_CONTROLS = select("#left_controls");
    RIGHT_CONTROLS = select("#right_controls");

    // Placeholder text
    LEFT_WINDOW.append("text")
      .attr("id", "left_placeholder")
      .attr("class", "label")
      .attr("x", get_width(LEFT_WINDOW)/2)
      .attr("y", get_height(LEFT_WINDOW)/2)
      .style("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .text("No data (choose a file to analyze above)");

    RIGHT_WINDOW.append("text")
      .attr("id", "right_placeholder")
      .attr("class", "label")
      .attr("x", get_width(LEFT_WINDOW)/2)
      .attr("y", get_height(LEFT_WINDOW)/2)
      .style("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .text("No data (waiting on main frame)");

    // resize event:
    select(window).on("resize", resize);

    // data file selected:
    select("#data_file")
      .on("change", file_chosen)
      .on(
        "click touchstart",
        function () { select(this).attr("value", ""); }
      );
  }

  do_viz();

}());

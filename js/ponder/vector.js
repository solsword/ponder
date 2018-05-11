define(
[],
function () {

  function origin(N) { // origin in N dimensions
    var result = [];
    for (let i = 0; i < N; ++i) {
      result.push(0);
    }
    return result;
  }

  function add(a, b) {
    var result = [];
    for (let i = 0; i < a.length; ++i) {
      result.push(a[i] + b[i]);
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

  function sub_from(a, b) {
    for (let i = 0; i < a.length; ++i) {
      a[i] -= b[i];
    }
  }
  
  function scale(a, S) {
    var result = [];
    for (let i = 0; i < a.length; ++i) {
      result.push(a[i] * S);
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

  function proj(a, b) { // a onto b
    let mb = mag(b);
    if (mb == 0) {
      return origin(a.length);
    }
    let sc = dot(a, b)/mb; // scalar projection
    return scale(b, sc/mb); // multiply by unit vector in direction b
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

  function norm(a) { // norm of a vector
    return scale(a, 1/mag(a));
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

  return {
    "origin": origin,
    "add": add,
    "add_into": add_into,
    "sub": sub,
    "sub_from": sub_from,
    "scale_by": scale_by,
    "dot": dot,
    "mag": mag,
    "proj": proj,
    "pmag": pmag,
    "ldist": ldist,
    "norm": norm,
    "softnorm": softnorm,
  };
});

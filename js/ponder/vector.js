// Default precision for vector representations:
var DEFAULT_REPR_PRECISION = 3;

// Returns the total dimension of a tensor
export function tensor_total_dimension(t) {
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
export function get_flat(t, i) {
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
export function flatten(t) {
  let td = tensor_total_dimension(t);
  let result = [];
  for (let i = 0; i < td; ++i) {
    result.push(get_flat(t, i));
  }
  return result;
}

export function origin(N) { // origin in N dimensions
  var result = [];
  for (let i = 0; i < N; ++i) {
    result.push(0);
  }
  return result;
}

export function add(a, b) {
  var result = [];
  for (let i = 0; i < a.length; ++i) {
    result.push(a[i] + b[i]);
  }
  return result;
}

// Recursively adds two tensors. Doesn't check b's type or dimensions.
export function add_tensors(t, s) {
  if (Array.isArray(t)) {
    let result = [];
    for (let i = 0; i < t.length; ++i) {
      result.push(add_tensors(t[i], s[i]));
    }
    return result;
  } else {
    return t + s;
  }
}

export function add_into(a, b) {
  for (let i = 0; i < a.length; ++i) {
    a[i] += b[i];
  }
}

export function sub(a, b) { // a - b
  var result = [];
  for (let i = 0; i < a.length; ++i) {
    result.push(a[i] - b[i]);
  }
  return result;
}

export function sub_from(a, b) {
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

export function scale_by(a, S) {
  for (let i = 0; i < a.length; ++i) {
    a[i] *= S;
  }
}

// Recursively scales each entry of an arbitrarily-nested tensor.
export function scale_tensor(t, S) {
  if (Array.isArray(t)) {
    let result = [];
    for (let i = 0; i < t.length; ++t) {
      result.push(scale_tensor(t[i], S));
    }
    return result;
  } else {
    return t * S;
  }
}

export function dot(a, b) {
  var result = 0;
  for (let i = 0; i < a.length; ++i) {
    result += a[i] * b[i];
  }
  return result;
}

export function mag(a) {
  var result = 0;
  for (let i = 0; i < a.length; ++i) {
    let x = a[i];
    result += x*x;
  }
  return Math.sqrt(result);
}

export function proj(a, b) { // a onto b
  let mb = mag(b);
  if (mb == 0) {
    return origin(a.length);
  }
  let sc = dot(a, b)/mb; // scalar projection
  return scale(b, sc/mb); // multiply by unit vector in direction b
}

export function pmag(a, b) { // magnitude of the projection of a onto b
  let mb = mag(b);
  if (mb == 0) {
    return 0;
  } else {
    return dot(a, b)/mb; // scalar projection
  }
}

export function ldist(a, b) { // distance from point a to line b
  let mb = mag(b);
  if (mb == 0) { // distance to point
    return mag(sub(a, b));
  }
  let ma = mag(a);
  let sc = dot(a, b)/mb; // scalar projection
  return Math.sqrt(ma*ma - sc*sc);
}

export function norm(a) { // norm of a vector
  return scale(a, 1/mag(a));
}

export function softnorm(a) { // scales so that the longest component is 1
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
  let result = [];
  for (let i = 0; i < a.length; ++i) {
    result[i] = a[i] / max;
  }
  return result;
}

export function repr(t, precision) {
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

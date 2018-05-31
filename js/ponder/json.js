define([], function () {
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
  }

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

  ParseState.prototype.error = function(m) {
    this.error = m;
    throw {
      name: "SyntaxError",
      message: m,
      at: this.at,
      text: this.text
    };
  }

  ParseState.prototype.next = function() {
    this.at += 1;
    this.ch = this.text.charAt(this.at);
    return this.ch;
  }

  ParseState.prototype.check = function (c) {
    if (c !== this.ch) {
      error("Expected '" + c + "' instead of '" + this.ch + "'");
    }
    this.next();
  }

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
  }

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
    this.error("Bad string");
  }

  ParseState.prototype.white = function () { // Skip whitespace.
    while (this.ch && this.ch <= ' ') {
      this.next();
    }
  }

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
    this.error("Unexpected '" + this.ch + "'");
  }

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
    this.error("Bad array");
  }

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
          this.error('Duplicate key "' + key + '"');
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
    this.error("Bad object");
  }

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
  }

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
      error("Syntax error");
    }
    if (typeof reviver === "function") {
      return walk({'': result}, '', reviver);
    } else {
      return result;
    }
  }
  
  // TODO: Implement NaN/Infinity-preserving stringify?

  return {
    "ParseState": ParseState,
    "walk": walk,
    "parse": parse,
  };

});

"use strict";

const spec = require("../spec.json");
const typeOf = require("../util/type-of");

// # util

const create = Object.create;
const define = Object.defineProperty;

// # descriptors

const f = function(value) { // frozen
  return { value, enumerable: false, configurable: false, writable: false };
};

const e = function(value) { // enum
  return { value, enumerable: true, configurable: false, writable: false };
};

const ecw = function(value) { // enum, config, write
  return { value, enumerable: true, configurable: true, writable: true };
};

const cw = function(value) { // config, write
  return { value, enumerable: false, configurable: true, writable: true };
};

const w = function(value) { // write
  return { value, enumerable: false, configurable: false, writable: true };
};

const gc = function(value) { // get, config
  return { get: value, enumerable: false, configurable: true };
};

// # inherits walk

const instanceOf = function(type, test) {
  if (type === test) return true;

  const description = spec[type];
  const inherits = description.inherits;

  if (inherits) for (let i = 0; i < inherits.length; i++) {
    const name = inherits[i];
    if (instanceOf(name, test)) return true;
  }

  return false;
};

const combinedKeys = function(type) {
  const description = spec[type];
  const inherits = description.inherits;

  let keys = {}, k;

  if (inherits) for (let i = 0; i < inherits.length; i++) {
    const superKeys = combinedKeys(inherits[i]);
    for (k in superKeys) keys[k] = superKeys[k];
  }

  const selfKeys = description.keys;

  if (selfKeys) for (k in selfKeys) keys[k] = selfKeys[k];

  return keys;
};

const kindOf = function(type) {
  const description = spec[type];

  if (description.kind) return description.kind;

  const inherits = description.inherits;

  var kind;

  if (inherits) for (let l = inherits.length; l--; l) {
    kind = kindOf(inherits[l]);
    if (kind) return kind;
  }

  return null;
};

// # collections

const types = create(null);
const lists = create(null);
const syntax = create(null);

// # validators

const validators = create(null);

const validatorName = function(accepts) {
  return accepts.map(name => (name === null ? "Null" : name)).join("|");
};

const createNodeValidator = function(accepts) {

  const name = validatorName(accepts);

  return validators[name] || (validators[name] = function(node) {
    if (node === undefined) return !!~accepts.indexOf(undefined);
    if (node === null) return !!~accepts.indexOf(null);

    if (!node.isNode) return false;

    const nodeType = node.type;

    for (let i = 0; i < accepts.length; i++) {
      var type = accepts[i];
      if (instanceOf(nodeType, type)) return true;
    }

    return false;
  });
};

const createStrictValidator = function(accepts) {

  const name = validatorName(accepts);

  return validators[name] || (validators[name] = function(match) {
    for (let i = 0; i < accepts.length; i++) {
      const value = accepts[i];
      if (match === value) return true;
    }

    return false;
  });
};

const createNativeValidator = function(accepts) {

  const name = validatorName(accepts);

  return validators[name] || (validators[name] = function(match) {
    const matchType = typeOf(match);

    for (let i = 0; i < accepts.length; i++) {
      const type = accepts[i];
      if (type === null && matchType === "Null") return true;
      else if (matchType === type) return true;
    }

    return false;
  });
};

// accessors

const createAccessorDescriptor = function(key, validate, defaultValue) {
  const privateName = "@" + key;

  return {
    enumerable: true,
    configurable: false,

    get() {
      return this[privateName] !== undefined ? this[privateName] : defaultValue;
    },

    set(value) {
      //if (value !== undefined && !validate(value)) throw new TypeError("invalid value (" + value + ") for " + key + " in " + this.type);
      const previous = this[privateName];
      if (previous && (previous.isNode || previous.isList)) previous.parentNode = undefined;
      if (value && (value.isNode || value.isList)) {
        var parentNode = value.parentNode;
        if (parentNode) parentNode.removeChild(value);
        value.parentNode = this;
      }

      return this[privateName] = value;
    }

  };
};

const createNodeAccessor = function(proto, key, accepts) {
  const validate = createNodeValidator(accepts);

  let defaultValue;
  if (~accepts.indexOf(null)) defaultValue = null;

  define(proto, key, createAccessorDescriptor(key, validate, defaultValue));
};

const createNativeAccessor = function(proto, key, accepts) {
  const validate = createNativeValidator(accepts);

  let defaultValue;
  if (~accepts.indexOf(null)) defaultValue = null;

  else if (validatorName(accepts) === "Boolean") defaultValue = false;

  define(proto, key, createAccessorDescriptor(key, validate, defaultValue));
};

const createStrictAccessor = function(proto, key, accepts) {
  const validate = createStrictValidator(accepts);
  define(proto, key, createAccessorDescriptor(key, validate));
};

// # Base Classes

const rootGetter = gc(function() {
  let parent = this.parentNode;

  while (parent) {
    const ancestor = parent.parentNode;
    if (!ancestor) return parent;
    parent = ancestor;
  }
});

// # Node

let UID = 0;

function Node() {
  define(this, "uid", f((UID++).toString(36)));
  define(this, "parentNode", w(undefined));
}

Node.prototype = create({}, {

  constructor: f(Node),
  isNode: f(true),

  instanceOf: cw(function(NodeClass) {
    const type = NodeClass.prototype.type;
    const thisType = this.type;

    return instanceOf(thisType, type);
  }),

  removeChild: cw(function(child) {
    const key = this.indexOf(child);
    if (key != null) this[key] = undefined;
    return this;
  }),

  replaceChild: cw(function(child, value) {
    const key = this.indexOf(child);
    if (key != null) this[key] = value;
    return this;
  }),

  indexOf: cw(function(value) {
    for (const key in this) {
      if (this[key] === value) return key;
    }
    return null;
  }),

  toJSON: cw(function() {
    const object = {};

    for (const key in this) {
      let value = this[key];
      if (value && value.toJSON) value = value.toJSON();
      if (value !== undefined) object[key] = value;
    }

    return object;
  }),

  toString: cw(function() {
    return JSON.stringify(this, null, 2);
  }),

  traverse: cw(function(visitor, deep) {
    let found, skip = {};

    const keys = this.constructor.keys;

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];

      const value = this[key];

      found = visitor.call(this, value, key, skip);
      if (found === skip) continue;
      if (found !== undefined) break;
      if (deep && value && (value.isNode || value.isList)) {
        found = value.traverse(visitor, deep);
        if (found !== undefined) break;
      }
    }

    return found;
  }),

  root: rootGetter

});

// # BaseList

function BaseList() {
  define(this, "length", w(0));
}

BaseList.prototype = create(Array.prototype, {

  constructor: f(BaseList),
  isList: f(true),

  removeChild: cw(function(child) {
    const io = this.indexOf(child);
    if (io > -1) this.splice(io, 1);
    return this;
  }),

  replaceChild: cw(function(child, value) {
    const io = this.indexOf(child);
    if (io > -1) this.splice(io, 1, value);
    return this;
  }),

  toJSON: cw(function() {
    const array = [];
    for (let i = 0; i < this.length; i++) {
      let value = this[i];
      if (value && value.toJSON) value = value.toJSON();
      array.push(value);
    }
    return array;
  }),

  empty: cw(function() {
    return this.splice(0, this.length);
  }),

  toString: cw(function() {
    return JSON.stringify(this, null, 2);
  }),

  traverse: cw(function(visitor, deep) {
    let found, skip = {};

    for (let i = 0; i < this.length; i++) {
      const node = this[i];
      found = visitor.call(this, node, i, skip);
      if (found === skip) continue;
      if (found !== void 0) break;
      if (deep && node && node.traverse) {
        found = node.traverse(visitor, deep);
        if (found !== void 0) break;
      }
    }

    return found;
  }),

  forEachRight: cw(function(visitor, ctx) {
    for (let i = this.length; i--; i) {
      visitor.call(ctx, this[i], i, this);
    }
  }),

  slice: cw(function() {
    const list = new BaseList;
    for (let i = 0; i < this.length; i++) list.push(this[i]);
    return list;
  }),

  filter: cw(function(method, ctx) {
    const list = new BaseList;
    for (let i = 0; i < this.length; i++) {
      const value = this[i];
      if (method.call(ctx, value, i, this)) list.push(value);
    }
    return list;
  }),

  append: cw(function(array) {
    this.push.apply(this, array);
    return this;
  }),

  root: rootGetter

});

// # List

function setNodeList(list, node) {

// TODO: re-enable list validation after fixing the spec.json
//  if (!list.validate(node)) {
//    throw new TypeError("invalid list item (" + node + ") on " + list.type);
//  }

  // lists only accept Nodes and NULL, always.
  if (node) {
    const parentNode = node.parentNode;
    if (parentNode) parentNode.removeChild(node);
    node.parentNode = list;
  }

  return node;
}

function unsetNodeList(node) {
  if (node) node.parentNode = undefined;
  return node;
}

function List(parentNode) {
  define(this, "parentNode", f(parentNode));
  define(this, "uid", f((UID++).toString(36)));
  BaseList.call(this);
}

List.prototype = create(BaseList.prototype, {

  constructor: f(List),

  splice: cw(function(index, howMany) {
    if (index > this.length) return [];

    let nodes = [], node;

    for (let i = 2; i < arguments.length; i++) {
      node = setNodeList(this, arguments[i]);
      nodes.push(node);
    }

    for (let j = index; j < howMany; j++) unsetNodeList(this[j]);

    return Array.prototype.splice.apply(this, [index, howMany].concat(nodes));
  }),

  push: cw(function() {
    const nodes = [];
    for (let i = 0; i < arguments.length; i++) nodes.push(setNodeList(this, arguments[i]));
    return Array.prototype.push.apply(this, nodes);
  }),

  pop: cw(function() {
    return unsetNodeList(Array.prototype.pop.call(this));
  }),

  shift: cw(function() {
    return unsetNodeList(Array.prototype.shift.call(this));
  }),

  unshift: cw(function() {
    const nodes = [];
    for (let i = 0; i < arguments.length; i++) nodes.push(setNodeList(this, arguments[i]));
    return Array.prototype.unshift.apply(this, nodes);
  })

});

// #defineNodeList

const listName = function(type, key) {
  return type + key.replace(/^\w/, f => f.toUpperCase());
};

const defineNodeList = function(type, key, accepts) {
  const name = listName(type, key);

  const validate = createNodeValidator(accepts);

  const SubList = function () {
    List.apply(this, arguments);
  }
  Object.defineProperty(SubList, "name", { writable: true });
  SubList.name = name;

  SubList.prototype = create(List.prototype, {
    constructor: f(SubList),
    type: f(name),
    validate: cw(validate)
  });

  define(lists, name, ecw(SubList));

  return SubList;
};

// # defineNode

function defineNode(type) {

  const keys = combinedKeys(type);

  const constructor = function(init) {
    if (!init) init = {};

    let key;

    // custom keys
    for (key in init) {
      if (key in keys) continue;
      this[key] = init[key];
    }

    for (key in keys) {
      const desc = keys[key];
      const value = init[key];

      switch (desc.kind) {
        case "list":
          const list = new (lists[listName(type, key)])(this);
          define(this, key, e(list));
          if (value !== undefined) list.push.apply(list, value);
        break;
        default: // native, strict, node
          define(this, "@" + key, w(undefined));
          if (value !== undefined) this[key] = value;
        break;
      }
    }

    Node.call(this);
  };

  var SubNode = function () {
    constructor.apply(this, arguments);
  }
  Object.defineProperty(SubNode, "name", { writable: true });
  SubNode.name = type;

  define(SubNode, "keys", f(Object.keys(keys)));

  const proto = SubNode.prototype = create(Node.prototype, {
    constructor: f(SubNode),
    type: e(type)
  });

  define(types, type, ecw(SubNode));

  for (const key in keys) {
    const desc = keys[key];
    const accepts = desc.accepts;

    switch (desc.kind) {
      case "list":
        defineNodeList(type, key, accepts);
      break;
      case "node":
        createNodeAccessor(proto, key, accepts);
      break;
      case "native":
        createNativeAccessor(proto, key, accepts);
      break;
      case "strict":
        createStrictAccessor(proto, key, accepts);
      break;
    }
  }

  return SubNode;
}


for (var type in spec) {
  defineNode(type);
  define(syntax, type, e(type));
}

exports.instanceOf = function(node, NodeClass) {
  if (!node || !node.isNode) return false;
  return node.instanceOf(NodeClass);
};

exports.Node = Node;
exports.BaseList = BaseList;
exports.List = List;

exports.syntax = syntax;

exports.types = types;
exports.lists = lists;

"use strict";

const factory = require("./factory");
const typeOf = require("../util/type-of");

const types = factory.types;

function build(ast) {
  if (ast == null) return ast;

  const type = ast.type;

  const NodeClass = types[type];
  if (!NodeClass) throw new Error("missing type (" + type + ")");

  const keys = NodeClass.keys;

  const init = {};

  for (const key in ast) {
    if (key === "type") continue;

    const value = ast[key];

    if (!~keys.indexOf(key)) {
      init[key] = value;
      continue;
    }

    switch (typeOf(value)) {
      case "Array":
        init[key] = value.map(build);
        break;
      case "Object":
        init[key] = build(value);
        break;
      default:
        init[key] = value;
    }
  }

  return new NodeClass(init);
}

module.exports = build;

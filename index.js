"use strict";

const factory = require("./lib/factory");
const build = require("./lib/build");

require("./lib/finder");

exports.build = build;
exports.syntax = factory.syntax;
exports.types = factory.types;
exports.instanceOf = factory.instanceOf;

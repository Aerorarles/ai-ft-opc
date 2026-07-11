"use strict";

const fs = require("node:fs");
const path = require("node:path");

const file = path.resolve(__dirname, "..", "..", ".project-control", "NEXT-ACTION.yaml");
const text = fs.readFileSync(file, "utf8");
const field = (name) => (text.match(new RegExp(`^\\s*${name}:\\s*(.+)$`, "m")) || [])[1] || "unknown";

console.log(`type=${field("type")}`);
console.log(`target=${field("target")}`);
console.log(`required_actor=${field("required_actor")}`);
console.log(`blocking=${field("blocking")}`);

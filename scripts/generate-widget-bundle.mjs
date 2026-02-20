#!/usr/bin/env node
import { copyFile } from "node:fs/promises";
import path from "node:path";

const source = path.join(process.cwd(), "public", "widget-runtime", "widget.js");
const destination = path.join(process.cwd(), ".next", "static", "widget.js");

await copyFile(source, destination).catch(() => console.warn("Widget runtime not generated yet."));
console.log("Widget bundle staged.");

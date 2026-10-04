/**
 * Load static prompt files once. Paths are based on this file's directory,
 * so resolution does not depend on the process working directory.
 *
 * Section markers look like: <!-- section:name -->
 * Only the section body is returned. Markers are not sent to the model.
 */

const fs = require("fs");
const path = require("path");

const PROMPTS_DIR = path.join(__dirname, "prompts");
const fileCache = new Map();
const sectionCache = new Map();

function readPromptFile(filename) {
  if (!fileCache.has(filename)) {
    const filePath = path.join(PROMPTS_DIR, filename);
    const text = fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
    fileCache.set(filename, text);
  }
  return fileCache.get(filename);
}

function getPromptSection(filename, section) {
  const key = filename + "\0" + section;
  if (sectionCache.has(key)) return sectionCache.get(key);
  const text = readPromptFile(filename);
  const marker = "<!-- section:" + section + " -->";
  const start = text.indexOf(marker);
  if (start === -1) {
    throw new Error("Missing prompt section " + section + " in " + filename);
  }
  let bodyStart = start + marker.length;
  if (text.charAt(bodyStart) === "\n") bodyStart += 1;
  const rest = text.slice(bodyStart);
  const next = rest.search(/\n<!-- section:/);
  const body = (next === -1 ? rest : rest.slice(0, next)).replace(/\s+$/, "");
  sectionCache.set(key, body);
  return body;
}

module.exports = {
  PROMPTS_DIR,
  getPromptSection,
};

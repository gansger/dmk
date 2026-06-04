const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = `<!DOCTYPE html><html><body></body></html>`;
const dom = new JSDOM(html, { runScripts: "dangerously", url: "http://localhost/" });

const siteJsCode = fs.readFileSync('public/site.js', 'utf8');

try {
  dom.window.eval(siteJsCode);
  console.log("No top-level throw.");
} catch (e) {
  console.error("Error during load:", e);
}

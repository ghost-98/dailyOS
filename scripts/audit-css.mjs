import fs from 'node:fs';
import postcss from 'postcss';
import ts from 'typescript';
const sources = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = dir + '/' + entry.name;
    if (entry.isDirectory()) walk(file);
    else if (/\.tsx?$/.test(file)) sources.push(fs.readFileSync(file, 'utf8'));
  }
}
walk('src');
const text = sources.join('\n');
const dynamicPrefixes = new Set();
for (const source of sources) {
  const parsed = ts.createSourceFile('source.tsx', source, ts.ScriptTarget.Latest, true);
  function visit(node) {
    if (ts.isTemplateExpression(node)) {
      const segments = [node.head.text, ...node.templateSpans.map(span => span.literal.text)];
      for (const segment of segments) {
        const last = segment.match(/([a-z][a-z0-9_-]*-)$/i);
        if (last && last[1].includes('--')) dynamicPrefixes.add(last[1]);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
}
const unused = {};
for (const name of fs.readdirSync('src/app/styles').filter(name => name.endsWith('.css'))) {
  const file = 'src/app/styles/' + name;
  const root = postcss.parse(fs.readFileSync(file, 'utf8'));
  const names = new Set();
  root.walkRules(rule => {
    for (const match of rule.selector.matchAll(/\.([a-zA-Z_][\w-]*)/g)) {
      const name = match[1];
      if (!text.includes(name) && ![...dynamicPrefixes].some(prefix => name.startsWith(prefix))) names.add(name);
    }
  });
  if (names.size) unused[file] = [...names];
}
console.log(JSON.stringify({ dynamicPrefixes: [...dynamicPrefixes], unused }, null, 2));

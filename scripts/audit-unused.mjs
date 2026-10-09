import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name).replaceAll('\\', '/');
    if (entry.isDirectory()) walk(file);
    else if (/\.tsx?$/.test(file)) files.push(file);
  }
}
walk('src');
const graph = new Map();
const exportedNames = [];
const references = new Map();
for (const file of files) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const imports = [];
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const specifier = node.moduleSpecifier.text;
      const base = specifier.startsWith('@/') ? 'src/' + specifier.slice(2) : specifier.startsWith('.') ? path.join(path.dirname(file), specifier).replaceAll('\\', '/') : null;
      if (base) {
        const target = [base + '.ts', base + '.tsx', base + '/index.ts', base + '/index.tsx'].find(candidate => files.includes(candidate));
        if (target) {
          imports.push(target);
          if (node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
            for (const item of node.importClause.namedBindings.elements) {
              const key = target + ':' + (item.propertyName ?? item.name).text;
              references.set(key, (references.get(key) ?? 0) + 1);
            }
          }
        }
      }
    }
    if (node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword) && node.name && ts.isIdentifier(node.name)) exportedNames.push([file, node.name.text]);
    if (ts.isVariableStatement(node) && node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      for (const declaration of node.declarationList.declarations) if (ts.isIdentifier(declaration.name)) exportedNames.push([file, declaration.name.text]);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  graph.set(file, imports);
}
const reachable = new Set();
function mark(file) {
  if (reachable.has(file)) return;
  reachable.add(file);
  for (const imported of graph.get(file) ?? []) mark(imported);
}
for (const file of files.filter(file => /^src\/app\/(?:.*\/)?(page|layout|route|loading|error|not-found)\.tsx?$/.test(file))) mark(file);
console.log('Unreachable modules:', files.filter(file => !reachable.has(file)));
console.log('Exports without named imports (inspect before deleting):', exportedNames.filter(([file, name]) => !references.has(file + ':' + name) && !file.startsWith('src/app/')));

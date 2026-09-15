import { readFileSync, existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = new URL('../', import.meta.url);

// Render real React components in Node without a browser build. Modal portals
// mount only after hydration, so this harness exposes their content explicitly.
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('@/'))
      specifier = new URL(specifier.slice(2), root).href;
    if (
      (specifier.startsWith('.') || specifier.startsWith('file:')) &&
      context.parentURL?.startsWith('file:')
    ) {
      const path = fileURLToPath(new URL(specifier, context.parentURL));
      if (!extname(path)) {
        for (const suffix of ['.ts', '.tsx', '.js'])
          if (existsSync(path + suffix))
            return next(pathToFileURL(path + suffix).href, context);
      }
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (
      url.startsWith(root.href) &&
      /\.tsx?$/.test(url) &&
      !url.includes('/node_modules/')
    ) {
      let source = readFileSync(fileURLToPath(url), 'utf8');
      if (url.endsWith('/components/stride-ui.tsx')) {
        const start = source.indexOf('export function Modal(');
        const end = source.indexOf('export function Choice(');
        source =
          source.slice(0, start) +
          `export function Modal({ title, description, children }) {
            return <section><h1>{title}</h1><p>{description}</p>{children}</section>;
          }\n` +
          source.slice(end);
      }
      return {
        format: 'module',
        source: ts.transpileModule(source, {
          compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ESNext,
            jsx: ts.JsxEmit.ReactJSX,
          },
        }).outputText,
        shortCircuit: true,
      };
    }
    return next(url, context);
  },
});

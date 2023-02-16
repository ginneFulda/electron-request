import { readFileSync } from 'fs';
import dts from 'rollup-plugin-dts';
import external from 'is-builtin-module';
import typescript from 'rollup-plugin-typescript2';
import { getBabelOutputPlugin } from '@rollup/plugin-babel';
import { typescriptPaths } from 'rollup-plugin-typescript-paths';

const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
);

const resolveTypescriptPaths = () =>
  typescriptPaths({
    preserveExtensions: true,
  });

const getBabelPlugin = () =>
  getBabelOutputPlugin({
    presets: [
      [
        '@babel/preset-env',
        {
          modules: false,
          targets: 'defaults',
        },
      ],
    ],
  });

export default [
  {
    input: 'src/index.ts',
    plugins: [resolveTypescriptPaths(), typescript(), getBabelPlugin()],
    output: [
      { file: pkg.module, format: 'es' },
      { file: pkg.main, format: 'cjs', exports: 'auto' },
    ],
    external,
  },
  {
    input: 'src/index.ts',
    plugins: [
      resolveTypescriptPaths(),
      dts({
        respectExternal: true,
        compilerOptions: {
          removeComments: false,
        },
      }),
    ],
    output: [{ file: pkg.types, format: 'es' }],
    external,
  },
];

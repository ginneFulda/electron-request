import isBuiltin from 'is-builtin-module';
import typescript from 'rollup-plugin-typescript2';
import typescriptPaths from 'rollup-plugin-typescript-paths';
import dts from 'rollup-plugin-dts';
import pkgConfig from './package.json';

const resolveTypescriptPaths = () =>
  typescriptPaths({
    preserveExtensions: true,
  });

const external = (id) => {
  if (isBuiltin(id)) {
    return true;
  }
  return Reflect.has(pkgConfig.dependencies || {}, id);
};

export default [
  {
    input: 'src/index.ts',
    plugins: [resolveTypescriptPaths(), typescript()],
    output: [
      { file: pkgConfig.module, format: 'es' },
      { file: pkgConfig.main, format: 'cjs', exports: 'auto' },
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
    output: [{ file: pkgConfig.types, format: 'es' }],
    external: (id) => isBuiltin(id),
  },
];

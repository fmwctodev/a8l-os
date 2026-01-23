import typescript from '@rollup/plugin-typescript';
import { terser } from 'rollup-plugin-terser';

export default [
  {
    input: 'src/widget.ts',
    output: {
      file: 'dist/widget.js',
      format: 'iife',
      name: 'WebchatWidget',
      sourcemap: true,
    },
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
      }),
      terser(),
    ],
  },
  {
    input: 'src/widget.ts',
    output: {
      file: 'dist/widget.esm.js',
      format: 'esm',
      sourcemap: true,
    },
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationDir: 'dist',
      }),
    ],
  },
];

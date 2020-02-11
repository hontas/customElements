import resolve from '@rollup/plugin-node-resolve';
import importCss from '@atomico/rollup-plugin-import-css';
import url from '@rollup/plugin-url';

export default {
  input: 'src/main.js',
  output: {
    file: 'public/bundle.js',
    format: 'esm'
  },
  plugins: [resolve(), url(), importCss()]
};

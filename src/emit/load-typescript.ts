import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');

export default ts;

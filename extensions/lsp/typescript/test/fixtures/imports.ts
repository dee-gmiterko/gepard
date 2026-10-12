import { foo } from './imports-target';
import main from './imports-target';
import * as ns from './imports-target';
import type { T } from './imports-target';
import './module';

const lazyModule = import('./imports-target');

export const used = [foo, main, ns, lazyModule];
export type Used = T;

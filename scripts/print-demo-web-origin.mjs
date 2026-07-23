#!/usr/bin/env node
import { resolveDemoWebOrigin } from './demo-web-origin.mjs'

console.log(await resolveDemoWebOrigin())

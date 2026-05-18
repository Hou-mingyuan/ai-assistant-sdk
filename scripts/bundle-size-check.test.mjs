import test from "node:test";
import assert from "node:assert/strict";

import { groupBundleEntries } from "./bundle-size-check.mjs";

test("groupBundleEntries catches main, wc, secondary, and shared chunk growth separately", () => {
    const groups = groupBundleEntries([
        { relative: "ai-assistant.mjs", gzip: 100 },
        { relative: "style.css", gzip: 40 },
        { relative: "ai-assistant-wc.umd.cjs", gzip: 200 },
        { relative: "vue.runtime.esm-bundler-abc.js", gzip: 90 },
        { relative: "plugin.mjs", gzip: 10 },
        { relative: "assets/markdownHljs.worker-abc.js", gzip: 5 },
    ]);

    assert.deepEqual(groups, {
        main: { files: 2, gzip: 140 },
        wc: { files: 2, gzip: 290 },
        secondary: { files: 1, gzip: 10 },
        chunks: { files: 1, gzip: 5 },
    });
});

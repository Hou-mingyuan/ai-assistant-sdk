import test from "node:test";
import assert from "node:assert/strict";

import { groupBundleEntries, summarizeBaselineChanges } from "./bundle-size-check.mjs";

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

test("summarizeBaselineChanges highlights added, removed, grown, and shrunk files", () => {
    const summary = summarizeBaselineChanges(
        [
            { relative: "ai-assistant.mjs", gzip: 130 },
            { relative: "new-feature.js", gzip: 20 },
            { relative: "style.css", gzip: 70 },
            { relative: "shrunk.js", gzip: 20 },
        ],
        {
            files: {
                "ai-assistant.mjs": { gzip: 100 },
                "removed.js": { gzip: 12 },
                "style.css": { gzip: 60 },
                "shrunk.js": { gzip: 30 },
            },
        },
        10,
    );

    assert.deepEqual(summary.added.map((entry) => entry.relative), ["new-feature.js"]);
    assert.deepEqual(summary.removed.map((entry) => entry.relative), ["removed.js"]);
    assert.deepEqual(summary.grown.map((entry) => entry.relative), [
        "ai-assistant.mjs",
        "style.css",
    ]);
    assert.deepEqual(summary.shrunk.map((entry) => entry.relative), ["shrunk.js"]);
});

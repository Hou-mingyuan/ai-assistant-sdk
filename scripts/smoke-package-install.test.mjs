import test from "node:test";
import assert from "node:assert/strict";

import { buildConsumerProbe } from "./smoke-package-install.mjs";

test("buildConsumerProbe resolves every published package entry from a consumer project", () => {
    const probe = buildConsumerProbe("@ai-assistant/vue");

    assert.match(probe, /import\.meta\.resolve\('@ai-assistant\/vue'\)/);
    assert.match(
        probe,
        /import\.meta\.resolve\('@ai-assistant\/vue\/plugin'\)/,
    );
    assert.match(probe, /require\.resolve\('@ai-assistant\/vue\/wc'\)/);
    assert.match(
        probe,
        /require\.resolve\('@ai-assistant\/vue\/dist\/style.css'\)/,
    );
});

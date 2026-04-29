package com.aiassistant.tool;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class ToolRegistryTest {

    private static final ObjectMapper mapper = new ObjectMapper();

    private ToolDefinition dummyTool(String name) {
        return new ToolDefinition() {
            @Override
            public String name() {
                return name;
            }

            @Override
            public String description() {
                return "Test tool: " + name;
            }

            @Override
            public JsonNode parametersSchema() {
                return mapper.createObjectNode().put("type", "object");
            }

            @Override
            public String execute(JsonNode arguments) {
                return "{\"ok\":true}";
            }
        };
    }

    @Test
    void registerAndRetrieve() {
        ToolRegistry registry = new ToolRegistry(List.of());
        registry.register(dummyTool("alpha"));
        assertNotNull(registry.get("alpha"));
        assertNull(registry.get("beta"));
        assertFalse(registry.isEmpty());
    }

    @Test
    void unregisterByName() {
        ToolRegistry registry = new ToolRegistry(List.of(dummyTool("a"), dummyTool("b")));
        assertTrue(registry.unregister("a"));
        assertNull(registry.get("a"));
        assertNotNull(registry.get("b"));
        assertFalse(registry.unregister("nonexistent"));
    }

    @Test
    void unregisterByPrefix() {
        ToolRegistry registry = new ToolRegistry(List.of());
        registry.register(dummyTool("erp_list_modules"));
        registry.register(dummyTool("erp_get_schema"));
        registry.register(dummyTool("erp_query_data"));
        registry.register(dummyTool("api_list_modules"));

        int removed = registry.unregisterByPrefix("erp_");
        assertEquals(3, removed);
        assertNull(registry.get("erp_list_modules"));
        assertNotNull(registry.get("api_list_modules"));
    }

    @Test
    void toOpenAiToolsArrayIsCachedAndInvalidated() {
        ToolRegistry registry = new ToolRegistry(List.of(dummyTool("tool1")));
        ArrayNode arr1 = registry.toOpenAiToolsArray();
        ArrayNode arr2 = registry.toOpenAiToolsArray();
        assertSame(arr1, arr2);

        registry.register(dummyTool("tool2"));
        ArrayNode arr3 = registry.toOpenAiToolsArray();
        assertNotSame(arr1, arr3);
        assertEquals(2, arr3.size());
    }

    @Test
    void cacheInvalidatedOnUnregister() {
        ToolRegistry registry = new ToolRegistry(List.of(dummyTool("x"), dummyTool("y")));
        ArrayNode before = registry.toOpenAiToolsArray();
        assertEquals(2, before.size());

        registry.unregister("x");
        ArrayNode after = registry.toOpenAiToolsArray();
        assertEquals(1, after.size());
        assertNotSame(before, after);
    }

    @Test
    void executeLogsAndReturnsResult() throws Exception {
        ToolRegistry registry = new ToolRegistry(List.of(dummyTool("calc")));
        String result = registry.execute("calc", null);
        assertEquals("{\"ok\":true}", result);
    }

    @Test
    void executeThrowsForUnknownTool() {
        ToolRegistry registry = new ToolRegistry(List.of());
        assertThrows(IllegalArgumentException.class, () -> registry.execute("missing", null));
    }

    @Test
    void concurrentRegisterAndRead() throws Exception {
        ToolRegistry registry = new ToolRegistry(List.of());
        int threadCount = 10;
        int toolsPerThread = 50;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch latch = new CountDownLatch(threadCount);
        AtomicInteger errors = new AtomicInteger(0);

        for (int t = 0; t < threadCount; t++) {
            final int threadId = t;
            executor.submit(
                    () -> {
                        try {
                            for (int i = 0; i < toolsPerThread; i++) {
                                registry.register(dummyTool("t" + threadId + "_tool" + i));
                                registry.toOpenAiToolsArray();
                            }
                        } catch (Exception e) {
                            errors.incrementAndGet();
                        } finally {
                            latch.countDown();
                        }
                    });
        }

        latch.await();
        executor.shutdown();
        assertEquals(0, errors.get(), "No concurrent modification errors should occur");
        assertEquals(threadCount * toolsPerThread, registry.all().size());
    }

    @Test
    void allReturnsUnmodifiableView() {
        ToolRegistry registry = new ToolRegistry(List.of(dummyTool("z")));
        assertThrows(
                UnsupportedOperationException.class,
                () -> registry.all().put("hack", dummyTool("hack")));
    }
}

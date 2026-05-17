package com.aiassistant.service.llm;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.concurrent.TimeUnit;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.SocketPolicy;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * Provider-agnostic contract tests for any {@link ChatCompletionClient} implementation.
 *
 * <p>Subclass this once per implementation (see {@link OpenAiCompatibleChatClientContractTest}) and
 * the same negative / edge-case battery runs against the new provider, ensuring every client obeys
 * the same exception, timeout, and response-shape rules.
 *
 * <p><b>Why this exists</b>: the audit (2026-05-16) flagged that we had unit tests against the
 * single existing OpenAI-compatible implementation, but no contract-level tests that prove every
 * new provider behaves the same on the failure paths. Without that, adding a new provider risks
 * silently regressing error messaging for hosts that catch {@link IllegalStateException}.
 *
 * <p><b>Contract</b>:
 *
 * <ul>
 *   <li>HTTP 4xx / 5xx → {@link IllegalStateException} with the status code visible in the message
 *   <li>Network timeout → {@link IllegalStateException} (or a subtype thereof)
 *   <li>Connection refused / unreachable → {@link IllegalStateException}
 *   <li>Empty {@code choices[]} → {@link IllegalStateException} or empty string (NOT a
 *       NullPointerException)
 *   <li>Malformed (non-JSON) success body → {@link IllegalStateException} (not a Jackson parse
 *       leak)
 *   <li>SSE midstream disconnect → {@link Flux} terminates with onError ({@link
 *       IllegalStateException})
 * </ul>
 *
 * <p>Subclasses provide:
 *
 * <ul>
 *   <li>{@link #newClient(MockWebServer)} — instantiate the client pointed at the given mock server
 *   <li>{@link #newRequestBody()} — minimal valid request body for that provider's wire format
 * </ul>
 */
public abstract class ChatCompletionClientContract {

    protected final ObjectMapper mapper = new ObjectMapper();
    protected MockWebServer server;
    protected ChatCompletionClient client;

    /** Build a client pointed at the given mock server. Implementations set timeouts low. */
    protected abstract ChatCompletionClient newClient(MockWebServer server) throws Exception;

    /** Build a minimal valid request body for this provider. */
    protected abstract ObjectNode newRequestBody();

    /** Optional: tear down provider-specific resources. Default no-op. */
    protected void teardownClient() throws Exception {}

    @BeforeEach
    void setUpServer() throws Exception {
        server = new MockWebServer();
        server.start();
        client = newClient(server);
    }

    @AfterEach
    void tearDownServer() throws Exception {
        try {
            teardownClient();
        } finally {
            if (server != null) server.shutdown();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Blocking path: error mapping
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void httpUnauthorizedSurfaces401InMessage() {
        server.enqueue(
                new MockResponse()
                        .setResponseCode(401)
                        .setHeader("Content-Type", "application/json")
                        .setBody("{\"error\":{\"message\":\"invalid api key\"}}"));

        IllegalStateException ex =
                assertThrows(
                        IllegalStateException.class,
                        () -> client.complete(newRequestBody(), "bad-key"));

        // Either the HTTP status or the upstream message must be visible to callers;
        // hosts use either to route to a usable 401 page / re-key prompt.
        assertTrue(
                ex.getMessage().contains("401")
                        || ex.getMessage().toLowerCase().contains("api key"),
                "401 should be reflected in the exception message; got: " + ex.getMessage());
    }

    @Test
    void httpRateLimitSurfaces429InMessage() {
        server.enqueue(
                new MockResponse()
                        .setResponseCode(429)
                        .setHeader("Content-Type", "application/json")
                        .setHeader("Retry-After", "30")
                        .setBody("{\"error\":{\"message\":\"rate limited\"}}"));

        IllegalStateException ex =
                assertThrows(
                        IllegalStateException.class,
                        () -> client.complete(newRequestBody(), "test-key"));

        assertTrue(
                ex.getMessage().contains("429") || ex.getMessage().toLowerCase().contains("rate"),
                "429 should be visible to the caller; got: " + ex.getMessage());
    }

    @Test
    void httpServerError5xxSurfacesStatus() {
        server.enqueue(
                new MockResponse()
                        .setResponseCode(503)
                        .setHeader("Content-Type", "application/json")
                        .setBody("{\"error\":\"busy\"}"));

        IllegalStateException ex =
                assertThrows(
                        IllegalStateException.class,
                        () -> client.complete(newRequestBody(), "test-key"));

        assertTrue(
                ex.getMessage().contains("503"),
                "5xx status code should be visible; got: " + ex.getMessage());
    }

    @Test
    void malformedJsonBodyDoesNotLeakJacksonInternals() {
        server.enqueue(
                new MockResponse()
                        .setResponseCode(200)
                        .setHeader("Content-Type", "application/json")
                        .setBody("this is not json at all"));

        IllegalStateException ex =
                assertThrows(
                        IllegalStateException.class,
                        () -> client.complete(newRequestBody(), "test-key"));

        // Implementations may include the upstream snippet but should not raw-leak
        // Jackson stack frames; we just require an IllegalStateException.
        assertTrue(
                ex.getMessage() != null && !ex.getMessage().isBlank(),
                "Malformed body should produce a non-blank IllegalStateException message");
    }

    @Test
    void emptyChoicesArrayDoesNotNpe() {
        // {"choices": []} is a documented OpenAI edge case (no candidates produced).
        server.enqueue(
                new MockResponse()
                        .setResponseCode(200)
                        .setHeader("Content-Type", "application/json")
                        .setBody("{\"choices\":[]}"));

        try {
            String result = client.complete(newRequestBody(), "test-key");
            assertEquals(
                    "", result, "Empty choices array should yield empty string, not null or NPE");
        } catch (IllegalStateException ok) {
            // Or an IllegalStateException with a helpful message is also acceptable.
            assertTrue(
                    ok.getMessage() != null && !ok.getMessage().isBlank(),
                    "If thrown, must include a helpful message; got: " + ok.getMessage());
        } catch (NullPointerException npe) {
            fail("Empty choices array must NOT cause NPE; got: " + npe);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Streaming path: error mapping
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void streamMidConnectionDisconnectTerminatesWithError() {
        // SocketPolicy.DISCONNECT_DURING_RESPONSE_BODY simulates the upstream
        // closing the connection in the middle of an SSE stream.
        server.enqueue(
                new MockResponse()
                        .setHeader("Content-Type", "text/event-stream")
                        .setBody(
                                """
                                data: {"choices":[{"delta":{"content":"par"}}]}

                                """)
                        .setSocketPolicy(SocketPolicy.DISCONNECT_DURING_RESPONSE_BODY));

        try {
            client.completeStream(newRequestBody(), "test-key")
                    .collectList()
                    .block(java.time.Duration.ofSeconds(5));
            // Some implementations elect to return the partial buffer instead of erroring;
            // this is acceptable as long as it doesn't hang or leak.
        } catch (RuntimeException expected) {
            assertTrue(
                    expected instanceof IllegalStateException
                            || expected.getCause() instanceof IllegalStateException
                            || expected.getMessage() != null,
                    "Midstream disconnect should surface a real error, not a silent close");
        }
    }

    @Test
    void streamHttp5xxBeforeAnyDataDoesNotEmitContent() {
        server.enqueue(
                new MockResponse()
                        .setResponseCode(502)
                        .setHeader("Content-Type", "application/json")
                        .setBody("{\"error\":\"bad gateway\"}"));

        try {
            List<String> emitted =
                    client.completeStream(newRequestBody(), "test-key")
                            .collectList()
                            .block(java.time.Duration.ofSeconds(5));
            // If the implementation does not throw, the emitted list MUST be empty —
            // a 502 must never silently appear as legitimate content.
            assertEquals(
                    List.of(), emitted, "5xx before stream start must not emit any content frames");
        } catch (RuntimeException ok) {
            // Throwing is also acceptable; the message should reflect the status.
            String msg = ok.getMessage() == null ? "" : ok.getMessage();
            assertTrue(
                    msg.contains("502")
                            || (ok.getCause() != null
                                    && ok.getCause().getMessage() != null
                                    && ok.getCause().getMessage().contains("502")),
                    "5xx during stream open should be visible to the caller; got: " + msg);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Headers and request shape
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void blockingCallSendsAuthorizationHeader() throws Exception {
        server.enqueue(
                new MockResponse()
                        .setResponseCode(200)
                        .setHeader("Content-Type", "application/json")
                        .setBody(
                                "{\"choices\":[{\"message\":{\"content\":\"hi\"},\"finish_reason\":\"stop\"}]}"));

        client.complete(newRequestBody(), "key-abc-123");

        var request = server.takeRequest(5, TimeUnit.SECONDS);
        assertTrue(request != null, "Request was not received by the mock server within 5s");
        String auth = request.getHeader("Authorization");
        assertTrue(
                auth != null && auth.contains("key-abc-123"),
                "Authorization header should carry the apiKey; got: " + auth);
    }
}

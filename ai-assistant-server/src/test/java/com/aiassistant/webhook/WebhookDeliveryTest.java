package com.aiassistant.webhook;

import static org.junit.jupiter.api.Assertions.assertFalse;

import com.aiassistant.config.AiAssistantProperties;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;

class WebhookDeliveryTest {

    @Test
    void rejectsUnsafeWebhookUrlBeforeRetrying() throws Exception {
        WebhookDelivery delivery = new WebhookDelivery(new AiAssistantProperties());
        try {
            boolean delivered =
                    delivery.deliver("http://127.0.0.1:8080/hook", "{}")
                            .get(200, TimeUnit.MILLISECONDS);

            assertFalse(delivered);
        } finally {
            delivery.shutdown();
        }
    }

    @Test
    void rejectsNonHttpWebhookUrlBeforeRetrying() throws Exception {
        WebhookDelivery delivery = new WebhookDelivery(new AiAssistantProperties());
        try {
            boolean delivered =
                    delivery.deliver("file:///tmp/hook", "{}").get(200, TimeUnit.MILLISECONDS);

            assertFalse(delivered);
        } finally {
            delivery.shutdown();
        }
    }
}

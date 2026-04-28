package com.aiassistant.aot;

import com.aiassistant.config.AiAssistantProperties;
import com.aiassistant.memory.ConversationMemory;
import com.aiassistant.model.ChatRequest;
import com.aiassistant.model.ChatResponse;
import com.aiassistant.spi.AssistantCapability;
import com.aiassistant.spi.ChatInterceptor;
import com.aiassistant.spi.ConversationMemoryProvider;
import com.aiassistant.spi.ModelProvider;
import org.springframework.aot.hint.MemberCategory;
import org.springframework.aot.hint.RuntimeHints;
import org.springframework.aot.hint.RuntimeHintsRegistrar;
import org.springframework.aot.hint.TypeReference;

/**
 * GraalVM Native Image runtime hints.
 * Registers reflection, resources, and proxy hints needed for native compilation.
 */
public class AiAssistantRuntimeHints implements RuntimeHintsRegistrar {

    @Override
    public void registerHints(RuntimeHints hints, ClassLoader classLoader) {
        hints.reflection()
                .registerType(AiAssistantProperties.class,
                        MemberCategory.INVOKE_PUBLIC_CONSTRUCTORS,
                        MemberCategory.INVOKE_PUBLIC_METHODS,
                        MemberCategory.DECLARED_FIELDS)
                .registerType(AiAssistantProperties.UrlFetchProperties.class,
                        MemberCategory.INVOKE_PUBLIC_CONSTRUCTORS,
                        MemberCategory.INVOKE_PUBLIC_METHODS)
                .registerType(AiAssistantProperties.ExportProperties.class,
                        MemberCategory.INVOKE_PUBLIC_CONSTRUCTORS,
                        MemberCategory.INVOKE_PUBLIC_METHODS)
                .registerType(AiAssistantProperties.ChatProperties.class,
                        MemberCategory.INVOKE_PUBLIC_CONSTRUCTORS,
                        MemberCategory.INVOKE_PUBLIC_METHODS)
                .registerType(ChatRequest.class,
                        MemberCategory.INVOKE_PUBLIC_CONSTRUCTORS,
                        MemberCategory.INVOKE_PUBLIC_METHODS,
                        MemberCategory.DECLARED_FIELDS)
                .registerType(ChatRequest.MessageItem.class,
                        MemberCategory.INVOKE_PUBLIC_CONSTRUCTORS,
                        MemberCategory.INVOKE_PUBLIC_METHODS)
                .registerType(ChatResponse.class,
                        MemberCategory.INVOKE_PUBLIC_CONSTRUCTORS,
                        MemberCategory.INVOKE_PUBLIC_METHODS)
                .registerType(ConversationMemory.class,
                        MemberCategory.INVOKE_PUBLIC_CONSTRUCTORS,
                        MemberCategory.INVOKE_PUBLIC_METHODS)
                .registerType(ConversationMemory.MemoryEntry.class,
                        MemberCategory.INVOKE_PUBLIC_CONSTRUCTORS,
                        MemberCategory.INVOKE_PUBLIC_METHODS);

        hints.proxies()
                .registerJdkProxy(TypeReference.of(AssistantCapability.class))
                .registerJdkProxy(TypeReference.of(ChatInterceptor.class))
                .registerJdkProxy(TypeReference.of(ConversationMemoryProvider.class))
                .registerJdkProxy(TypeReference.of(ModelProvider.class));

        hints.resources()
                .registerPattern("messages*.properties")
                .registerPattern("logback-spring.xml")
                .registerPattern("fonts/*");
    }
}

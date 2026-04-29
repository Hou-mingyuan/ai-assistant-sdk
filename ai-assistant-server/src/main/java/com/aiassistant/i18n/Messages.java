package com.aiassistant.i18n;

import java.util.Locale;
import org.springframework.context.MessageSource;
import org.springframework.context.i18n.LocaleContextHolder;

/** Thin wrapper around Spring's MessageSource for convenient access throughout the SDK. */
public class Messages {

    private final MessageSource messageSource;

    public Messages(MessageSource messageSource) {
        this.messageSource = messageSource;
    }

    public String get(String code, Object... args) {
        return messageSource.getMessage(code, args, code, locale());
    }

    public String get(String code, Locale locale, Object... args) {
        return messageSource.getMessage(code, args, code, locale);
    }

    private Locale locale() {
        return LocaleContextHolder.getLocale();
    }
}

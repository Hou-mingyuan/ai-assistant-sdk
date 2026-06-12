package com.aiassistant.service;

/**
 * Raised by a {@link SessionStore} write that cannot reach its backend, so the failure surfaces to
 * the caller (mapped to HTTP 503 by the REST layer) instead of silently losing the session.
 */
public class SessionStoreUnavailableException extends RuntimeException {

    public SessionStoreUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}

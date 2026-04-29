package com.aiassistant.connector;

/**
 * Marks an exception as retryable by the connector retry mechanism. Thrown on 5xx server errors;
 * 4xx client errors are NOT wrapped in this class.
 */
class RetryableException extends RuntimeException {

    RetryableException(String message) {
        super(message);
    }

    static boolean isRetryable(Throwable t) {
        if (t instanceof RetryableException) return true;
        String name = t.getClass().getName();
        return name.contains("ConnectException")
                || name.contains("SocketTimeoutException")
                || name.contains("WebClientRequestException");
    }
}

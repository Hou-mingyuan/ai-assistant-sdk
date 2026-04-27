package com.aiassistant.model;

/**
 * 统一 API 响应体：{@code success}=true 时结果在 {@code result}，否则错误信息在 {@code error}。
 */
public class ChatResponse {

    private boolean success;
    private String result;
    private String error;
    private String errorCode;

    public static ChatResponse ok(String result) {
        ChatResponse r = new ChatResponse();
        r.success = true;
        r.result = result;
        return r;
    }

    public static ChatResponse fail(String error) {
        ChatResponse r = new ChatResponse();
        r.success = false;
        r.error = error;
        return r;
    }

    public static ChatResponse fail(String errorCode, String error) {
        ChatResponse r = new ChatResponse();
        r.success = false;
        r.errorCode = errorCode;
        r.error = error;
        return r;
    }

    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }

    public String getResult() { return result; }
    public void setResult(String result) { this.result = result; }

    public String getError() { return error; }
    public void setError(String error) { this.error = error; }

    public String getErrorCode() { return errorCode; }
    public void setErrorCode(String errorCode) { this.errorCode = errorCode; }
}

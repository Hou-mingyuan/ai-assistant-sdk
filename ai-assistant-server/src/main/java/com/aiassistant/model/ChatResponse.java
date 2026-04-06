package com.aiassistant.model;

public class ChatResponse {

    private boolean success;
    private String result;
    private String error;

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

    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }

    public String getResult() { return result; }
    public void setResult(String result) { this.result = result; }

    public String getError() { return error; }
    public void setError(String error) { this.error = error; }
}

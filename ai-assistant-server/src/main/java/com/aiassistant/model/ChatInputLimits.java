package com.aiassistant.model;

import java.util.ArrayList;
import java.util.List;

public final class ChatInputLimits {

    private ChatInputLimits() {
    }

    /**
     * @return 超过上限时的错误文案；未超限返回 {@code null}
     */
    public static String validateTotalChars(ChatRequest request, int maxChars) {
        if (maxChars <= 0) {
            return null;
        }
        int total = len(request.getText());
        List<ChatRequest.MessageItem> history = request.getHistory();
        if (history != null) {
            for (ChatRequest.MessageItem item : history) {
                if (item != null) {
                    total += len(item.getContent());
                }
            }
        }
        if (total > maxChars) {
            return "Input too large: " + total + " characters (max " + maxChars + ")";
        }
        return null;
    }

    private static int len(String s) {
        return s == null ? 0 : s.length();
    }

    /**
     * 从末尾向前保留消息，使 content 总长不超过 {@code budgetChars}（单条超长且为首条时仍会保留该条）。
     */
    public static List<ChatRequest.MessageItem> tailHistoryWithinBudget(List<ChatRequest.MessageItem> history,
                                                                        int budgetChars) {
        if (history == null || history.isEmpty() || budgetChars <= 0) {
            return history;
        }
        int used = 0;
        int start = history.size();
        for (int i = history.size() - 1; i >= 0; i--) {
            ChatRequest.MessageItem item = history.get(i);
            int clen = (item != null && item.getContent() != null) ? item.getContent().length() : 0;
            if (used + clen > budgetChars && used > 0) {
                start = i + 1;
                break;
            }
            used += clen;
            start = i;
        }
        return new ArrayList<>(history.subList(start, history.size()));
    }
}

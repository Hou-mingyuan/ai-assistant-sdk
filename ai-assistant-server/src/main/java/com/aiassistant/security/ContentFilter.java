package com.aiassistant.security;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Content safety filter: PII detection/masking and prompt injection defense.
 * Applied to both input (user messages) and output (LLM responses).
 */
public class ContentFilter {

    private static final Logger log = LoggerFactory.getLogger(ContentFilter.class);

    private static final List<PiiRule> PII_RULES = List.of(
            new PiiRule("phone_cn", Pattern.compile("(?<!\\d)1[3-9]\\d{9}(?!\\d)"), "[手机号已脱敏]"),
            new PiiRule("id_card_cn", Pattern.compile("(?<!\\d)\\d{17}[\\dXx](?!\\d)"), "[身份证号已脱敏]"),
            new PiiRule("bank_card", Pattern.compile("(?<!\\d)\\d{16,19}(?!\\d)"), "[银行卡号已脱敏]"),
            new PiiRule("email", Pattern.compile("[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}"), "[邮箱已脱敏]"),
            new PiiRule("ip_address", Pattern.compile("(?<!\\d)(\\d{1,3}\\.){3}\\d{1,3}(?!\\d)"), "[IP已脱敏]")
    );

    private static final List<Pattern> INJECTION_PATTERNS = List.of(
            Pattern.compile("(?i)ignore\\s+(all\\s+)?previous\\s+instructions"),
            Pattern.compile("(?i)you\\s+are\\s+now\\s+(a|an)\\s+"),
            Pattern.compile("(?i)system\\s*prompt\\s*:"),
            Pattern.compile("(?i)jailbreak"),
            Pattern.compile("(?i)\\bDAN\\b.*\\bmode\\b")
    );

    private final boolean piiMaskingEnabled;
    private final boolean injectionDetectionEnabled;

    public ContentFilter(boolean piiMaskingEnabled, boolean injectionDetectionEnabled) {
        this.piiMaskingEnabled = piiMaskingEnabled;
        this.injectionDetectionEnabled = injectionDetectionEnabled;
    }

    public ContentFilter() {
        this(true, true);
    }

    /**
     * Filter input text: detect injection and optionally mask PII.
     */
    public FilterResult filterInput(String text) {
        if (text == null) return new FilterResult(null, List.of(), false);
        List<String> warnings = new ArrayList<>();

        if (injectionDetectionEnabled) {
            for (Pattern p : INJECTION_PATTERNS) {
                if (p.matcher(text).find()) {
                    warnings.add("Potential prompt injection detected");
                    log.warn("Prompt injection pattern detected in input (length={})", text.length());
                    break;
                }
            }
        }

        String filtered = piiMaskingEnabled ? maskPii(text) : text;
        return new FilterResult(filtered, warnings, !warnings.isEmpty());
    }

    /**
     * Filter output text: mask PII in LLM responses.
     */
    public String filterOutput(String text) {
        if (text == null) return null;
        return piiMaskingEnabled ? maskPii(text) : text;
    }

    /**
     * Mask PII patterns in text.
     */
    public String maskPii(String text) {
        String result = text;
        for (PiiRule rule : PII_RULES) {
            result = rule.pattern.matcher(result).replaceAll(rule.replacement);
        }
        return result;
    }

    /**
     * Detect PII without masking (for audit/logging).
     */
    public List<PiiDetection> detectPii(String text) {
        List<PiiDetection> detections = new ArrayList<>();
        for (PiiRule rule : PII_RULES) {
            Matcher m = rule.pattern.matcher(text);
            while (m.find()) {
                detections.add(new PiiDetection(rule.name, m.start(), m.end()));
            }
        }
        return detections;
    }

    public record FilterResult(String text, List<String> warnings, boolean hasWarnings) {}
    public record PiiDetection(String type, int start, int end) {}
    private record PiiRule(String name, Pattern pattern, String replacement) {}
}

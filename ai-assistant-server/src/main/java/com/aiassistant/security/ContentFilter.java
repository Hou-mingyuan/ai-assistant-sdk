package com.aiassistant.security;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Content safety filter: PII detection/masking and prompt injection defense. Applied to both input
 * (user messages) and output (LLM responses).
 */
public class ContentFilter {

    private static final Logger log = LoggerFactory.getLogger(ContentFilter.class);

    private static final List<PiiRule> PII_RULES =
            List.of(
                    new PiiRule(
                            "phone_cn", Pattern.compile("(?<!\\d)1[3-9]\\d{9}(?!\\d)"), "[手机号已脱敏]"),
                    new PiiRule(
                            "id_card_cn",
                            Pattern.compile("(?<!\\d)\\d{17}[\\dXx](?!\\d)"),
                            "[身份证号已脱敏]",
                            ContentFilter::isValidIdCard),
                    new PiiRule(
                            "bank_card",
                            Pattern.compile("(?<!\\d)\\d{16,19}(?!\\d)"),
                            "[银行卡号已脱敏]",
                            ContentFilter::passesLuhn),
                    new PiiRule(
                            "email",
                            Pattern.compile("[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}"),
                            "[邮箱已脱敏]"),
                    new PiiRule(
                            "ip_address",
                            Pattern.compile("(?<!\\d)(\\d{1,3}\\.){3}\\d{1,3}(?!\\d)"),
                            "[IP已脱敏]"));

    private static final List<Pattern> INJECTION_PATTERNS =
            List.of(
                    Pattern.compile("(?i)ignore\\s+(all\\s+)?previous\\s+instructions"),
                    Pattern.compile("(?i)you\\s+are\\s+now\\s+(a|an)\\s+"),
                    Pattern.compile("(?i)system\\s*prompt\\s*:"),
                    Pattern.compile("(?i)jailbreak"),
                    Pattern.compile("(?i)\\bDAN\\b.*\\bmode\\b"));

    private final boolean piiMaskingEnabled;
    private final boolean injectionDetectionEnabled;

    public ContentFilter(boolean piiMaskingEnabled, boolean injectionDetectionEnabled) {
        this.piiMaskingEnabled = piiMaskingEnabled;
        this.injectionDetectionEnabled = injectionDetectionEnabled;
    }

    public ContentFilter() {
        this(true, true);
    }

    /** Filter input text: detect injection and optionally mask PII. */
    public FilterResult filterInput(String text) {
        if (text == null) return new FilterResult(null, List.of(), false);
        List<String> warnings = new ArrayList<>();

        if (injectionDetectionEnabled) {
            for (Pattern p : INJECTION_PATTERNS) {
                if (p.matcher(text).find()) {
                    warnings.add("Potential prompt injection detected");
                    log.warn(
                            "Prompt injection pattern detected in input (length={})",
                            text.length());
                    break;
                }
            }
        }

        String filtered = piiMaskingEnabled ? maskPii(text) : text;
        return new FilterResult(filtered, warnings, !warnings.isEmpty());
    }

    /** Filter output text: mask PII in LLM responses. */
    public String filterOutput(String text) {
        if (text == null) return null;
        return piiMaskingEnabled ? maskPii(text) : text;
    }

    /** Mask PII patterns in text. */
    public String maskPii(String text) {
        String result = text;
        for (PiiRule rule : PII_RULES) {
            if (rule.validator == null) {
                result = rule.pattern.matcher(result).replaceAll(rule.replacement);
            } else {
                Matcher m = rule.pattern.matcher(result);
                StringBuilder sb = new StringBuilder();
                while (m.find()) {
                    String matched = m.group();
                    if (rule.validator.test(matched)) {
                        m.appendReplacement(sb, Matcher.quoteReplacement(rule.replacement));
                    }
                }
                m.appendTail(sb);
                result = sb.toString();
            }
        }
        return result;
    }

    static boolean passesLuhn(String number) {
        int sum = 0;
        boolean alternate = false;
        for (int i = number.length() - 1; i >= 0; i--) {
            int n = number.charAt(i) - '0';
            if (n < 0 || n > 9) return false;
            if (alternate) {
                n *= 2;
                if (n > 9) n -= 9;
            }
            sum += n;
            alternate = !alternate;
        }
        return sum % 10 == 0;
    }

    static boolean isValidIdCard(String id) {
        if (id.length() != 18) return false;
        int[] weights = {7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2};
        char[] checkChars = {'1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'};
        int sum = 0;
        for (int i = 0; i < 17; i++) {
            int digit = id.charAt(i) - '0';
            if (digit < 0 || digit > 9) return false;
            sum += digit * weights[i];
        }
        char expected = checkChars[sum % 11];
        char actual = Character.toUpperCase(id.charAt(17));
        return actual == expected;
    }

    /** Detect PII without masking (for audit/logging). */
    public List<PiiDetection> detectPii(String text) {
        List<PiiDetection> detections = new ArrayList<>();
        for (PiiRule rule : PII_RULES) {
            Matcher m = rule.pattern.matcher(text);
            while (m.find()) {
                if (rule.validator != null && !rule.validator.test(m.group())) continue;
                detections.add(new PiiDetection(rule.name, m.start(), m.end()));
            }
        }
        return detections;
    }

    public record FilterResult(String text, List<String> warnings, boolean hasWarnings) {}

    public record PiiDetection(String type, int start, int end) {}

    @FunctionalInterface
    interface StringPredicate {
        boolean test(String value);
    }

    private record PiiRule(String name, Pattern pattern, String replacement,
                           StringPredicate validator) {
        PiiRule(String name, Pattern pattern, String replacement) {
            this(name, pattern, replacement, null);
        }
    }
}

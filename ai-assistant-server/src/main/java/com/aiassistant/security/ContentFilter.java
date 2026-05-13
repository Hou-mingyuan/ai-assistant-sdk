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

    // Rule names are also used as regex named-capture groups, so they must match
    // [A-Za-z][A-Za-z0-9]* (no underscores, no leading digits) — do not switch back to
    // snake_case without also rewriting the COMBINED_SIMPLE_PII assembly below.
    private static final List<PiiRule> PII_RULES =
            List.of(
                    new PiiRule(
                            "phoneCn", Pattern.compile("(?<!\\d)1[3-9]\\d{9}(?!\\d)"), "[手机号已脱敏]"),
                    new PiiRule(
                            "idCardCn",
                            Pattern.compile("(?<!\\d)\\d{17}[\\dXx](?!\\d)"),
                            "[身份证号已脱敏]",
                            ContentFilter::isValidIdCard),
                    new PiiRule(
                            "bankCard",
                            Pattern.compile("(?<!\\d)\\d{16,19}(?!\\d)"),
                            "[银行卡号已脱敏]",
                            ContentFilter::passesLuhn),
                    new PiiRule(
                            "email",
                            Pattern.compile("[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}"),
                            "[邮箱已脱敏]"),
                    new PiiRule(
                            "ipAddress",
                            Pattern.compile("(?<!\\d)(\\d{1,3}\\.){3}\\d{1,3}(?!\\d)"),
                            "[IP已脱敏]"));

    private static final List<Pattern> INJECTION_PATTERNS =
            List.of(
                    // Role/instruction override
                    Pattern.compile(
                            "(?i)ignore\\s+(all\\s+)?previous\\s+(instructions|prompts|rules|context)"),
                    Pattern.compile(
                            "(?i)disregard\\s+(all\\s+)?(previous|above|prior|earlier)\\s+(instructions|prompts|rules)"),
                    Pattern.compile(
                            "(?i)forget\\s+(all\\s+)?(previous|above|prior|earlier|your)\\s+(instructions|prompts|rules|training)"),
                    Pattern.compile(
                            "(?i)override\\s+(all\\s+)?(previous|system|your)\\s+(instructions|prompts|rules)"),
                    // Identity manipulation
                    Pattern.compile("(?i)you\\s+are\\s+now\\s+(a|an)\\s+"),
                    Pattern.compile("(?i)act\\s+as\\s+(a|an|if|though)\\s+"),
                    Pattern.compile("(?i)pretend\\s+(you\\s+are|to\\s+be|you're)\\s+"),
                    Pattern.compile(
                            "(?i)from\\s+now\\s+on,?\\s+(you|your)\\s+(are|will|must|should)"),
                    Pattern.compile("(?i)switch\\s+to\\s+.{0,30}\\bmode\\b"),
                    // System prompt extraction
                    Pattern.compile("(?i)system\\s*prompt\\s*:"),
                    Pattern.compile(
                            "(?i)(show|reveal|display|repeat|print|output|tell\\s+me)\\s+(your\\s+)?(system|initial|original|hidden)\\s*(prompt|instructions|rules)"),
                    Pattern.compile(
                            "(?i)what\\s+(are|is|were)\\s+your\\s+(system|initial|original|hidden)\\s*(prompt|instructions|rules)"),
                    // Jailbreak techniques
                    Pattern.compile("(?i)\\bjailbreak\\b"),
                    Pattern.compile("(?i)\\bDAN\\b.*\\bmode\\b"),
                    Pattern.compile("(?i)\\bDAN\\b.*\\b(prompt|jailbreak|bypass)\\b"),
                    Pattern.compile("(?i)developer\\s+mode\\s+(enabled|activated|on)"),
                    Pattern.compile("(?i)\\b(STAN|DUDE|AIM)\\b.*\\b(mode|prompt)\\b"),
                    // Delimiter/format attacks
                    Pattern.compile("(?i)```\\s*(system|instructions?)\\b"),
                    Pattern.compile("(?i)<\\|?(system|im_start|endoftext|im_end)\\|?>"),
                    Pattern.compile("(?i)\\[INST\\]|\\[/INST\\]|<<SYS>>|<</SYS>>"),
                    // Constraint removal
                    Pattern.compile(
                            "(?i)(remove|disable|bypass|skip|drop)\\s+(all\\s+)?(safety|content|ethical|moderation)\\s*(filters?|restrictions?|guidelines?|guardrails?|checks?)"),
                    Pattern.compile(
                            "(?i)without\\s+(any\\s+)?(safety|ethical|content|moderation)\\s*(restrictions?|guidelines?|filters?|guardrails?)"),
                    // Token smuggling and encoding tricks
                    Pattern.compile("(?i)base64[:\\s]+decode"),
                    Pattern.compile("(?i)rot13[:\\s]+(decode|apply|use)"));

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

    private static final Pattern COMBINED_SIMPLE_PII;
    private static final java.util.Map<String, String> SIMPLE_REPLACEMENT_MAP;

    static {
        StringBuilder combined = new StringBuilder();
        java.util.Map<String, String> replacements = new java.util.LinkedHashMap<>();
        for (PiiRule rule : PII_RULES) {
            if (rule.validator == null) {
                if (!combined.isEmpty()) combined.append('|');
                combined.append("(?<")
                        .append(rule.name)
                        .append('>')
                        .append(rule.pattern.pattern())
                        .append(')');
                replacements.put(rule.name, rule.replacement);
            }
        }
        COMBINED_SIMPLE_PII = Pattern.compile(combined.toString());
        SIMPLE_REPLACEMENT_MAP = replacements;
    }

    /**
     * Masks PII in a single pass for simple rules (no validator), then applies validated rules
     * individually. Reduces scan passes from N to ~2.
     */
    public String maskPii(String text) {
        Matcher cm = COMBINED_SIMPLE_PII.matcher(text);
        StringBuilder sb = new StringBuilder();
        while (cm.find()) {
            String replacement = text;
            for (var entry : SIMPLE_REPLACEMENT_MAP.entrySet()) {
                try {
                    if (cm.group(entry.getKey()) != null) {
                        replacement = entry.getValue();
                        break;
                    }
                } catch (IllegalArgumentException ignored) {
                }
            }
            cm.appendReplacement(sb, Matcher.quoteReplacement(replacement));
        }
        cm.appendTail(sb);
        String result = sb.toString();

        for (PiiRule rule : PII_RULES) {
            if (rule.validator != null) {
                Matcher m = rule.pattern.matcher(result);
                StringBuilder vsb = new StringBuilder();
                while (m.find()) {
                    if (rule.validator.test(m.group())) {
                        m.appendReplacement(vsb, Matcher.quoteReplacement(rule.replacement));
                    }
                }
                m.appendTail(vsb);
                result = vsb.toString();
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

    private record PiiRule(
            String name, Pattern pattern, String replacement, StringPredicate validator) {
        PiiRule(String name, Pattern pattern, String replacement) {
            this(name, pattern, replacement, null);
        }
    }
}

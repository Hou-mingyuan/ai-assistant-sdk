# SSRF 防护与 Host Allowlist

服务端默认通过 `DefaultSsrfPolicy` 拦截出站 HTTP 请求中的私有 / 链路本地 / 元数据 / 回环地址，覆盖 SSRF 攻击面的基线。生产环境想进一步收紧，可叠加一个 host 白名单。

## 何时叠加 Allowlist

| 场景 | 是否需要 |
|------|---------|
| 服务对所有外网开放抓取 | 默认 `DefaultSsrfPolicy` 已足够基线防御 |
| 仅允许调几个已知 LLM 厂商 + 抓取允许域名 | 强烈推荐叠加 `AllowlistSsrfPolicy` |
| 多租户共享部署，担心 prompt 注入诱导外发 | 必须叠加（即使有 PII 脱敏） |
| 离线 / 内网环境 | 全黑名单即可，不需要 allowlist |

## 启用方式

在宿主 Spring 配置里替换默认 `SsrfPolicy` Bean：

```java
import com.aiassistant.config.AiAssistantProperties;
import com.aiassistant.security.AllowlistSsrfPolicy;
import com.aiassistant.security.DefaultSsrfPolicy;
import com.aiassistant.security.SsrfPolicy;
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SsrfHardeningConfig {

    @Bean
    SsrfPolicy ssrfPolicy() {
        return new AllowlistSsrfPolicy(
            DefaultSsrfPolicy.INSTANCE,
            List.of(
                "api.openai.com",
                "api.deepseek.com",
                "*.example.com",
                ".dashscope.aliyuncs.com"
            )
        );
    }
}
```

声明后所有出站抓取都需先通过 `DefaultSsrfPolicy`（屏蔽 RFC1918 等内网段），再通过 allowlist；任意一步失败都会被业务层拒绝。

## Allowlist 条目语法

| 写法 | 含义 | 示例 |
|------|------|------|
| `host.example.com` | 精确匹配 | `api.openai.com` |
| `*.example.com` | 仅匹配子域，**不含 apex** | `*.example.com` → `api.example.com` ✓ / `example.com` ✗ |
| `.example.com` | 匹配 apex + 所有子域 | `.example.com` → `example.com` ✓ / `foo.bar.example.com` ✓ |
| `1.2.3.4` | 精确 IP（同时仍受 `DefaultSsrfPolicy` 拦截内网段） | 一般不直接写 IP；如需，请慎重 |

注意：

- 匹配前会做 IDN 归一化和小写化，所以 `API.Example.COM` 与 `*.中文.example.com`（已 punycode）也能匹配。
- 不支持中间 `*` 或多段通配（如 `foo.*.bar.com` 会抛构造异常）。
- 空 allowlist 直接抛 `IllegalArgumentException`，避免无意中"放行所有"。

## 配置化加载

如果你想从 `application.yml` / 环境变量读 allowlist 而不是 hardcode，可以在 `AiAssistantProperties` 之外定义一个独立的 `SsrfAllowlistProperties`：

```java
@ConfigurationProperties(prefix = "ai-assistant.url-fetch.ssrf-allowlist")
@Getter @Setter
public class SsrfAllowlistProperties {
    private List<String> hosts = List.of();
}

@Bean
@ConditionalOnProperty(prefix = "ai-assistant.url-fetch.ssrf-allowlist", name = "hosts")
SsrfPolicy ssrfPolicy(SsrfAllowlistProperties props) {
    return new AllowlistSsrfPolicy(DefaultSsrfPolicy.INSTANCE, props.getHosts());
}
```

然后在 `application.yml`：

```yaml
ai-assistant:
  url-fetch:
    ssrf-allowlist:
      hosts:
        - api.openai.com
        - api.deepseek.com
        - "*.example.com"
```

## 验证

仓库内置 JUnit 单测覆盖了精确匹配 / 通配符 / apex / 基底叠加 / 大小写 / 无效条目等情况：

```bash
node scripts/project-health-check.mjs --ssrf
```

该命令仅跑 `AllowlistSsrfPolicyTest`，避免完整 `mvn test` 的几分钟耗时。

## DNS Rebinding 局限

`AllowlistSsrfPolicy` 在 URI 解析阶段比对 host 字符串，不防御 DNS rebinding（TOCTOU 攻击者短 TTL 切换 IP）。若你的威胁模型涵盖此场景，请：

1. 在 `HttpClient` 层重写 `SocketFactory`，连接时复用 URI 阶段已校验过的 IP；或
2. 把所有出站走专用代理（Squid / mitmproxy 风格），由代理统一做最终 IP 校验。

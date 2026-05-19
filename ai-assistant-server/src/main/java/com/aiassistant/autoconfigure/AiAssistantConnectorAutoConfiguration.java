package com.aiassistant.autoconfigure;

import com.aiassistant.config.AiAssistantProperties;
import com.aiassistant.config.ConnectorProperties;
import com.aiassistant.connector.DataConnector;
import com.aiassistant.connector.JdbcConnector;
import com.aiassistant.service.UrlFetchService;
import java.util.List;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 数据连接器与外部抓取装配：JDBC DataConnector、Headless（Playwright）抓取、URL 抓取与连接器健康调度器。
 *
 * <p>Refactor (T2)：从 {@link AiAssistantAutoConfiguration} 拆出。
 */
@Configuration(proxyBeanMethods = false)
public class AiAssistantConnectorAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    public UrlFetchService urlFetchService(
            AiAssistantProperties properties, com.aiassistant.security.SsrfPolicy ssrfPolicy) {
        return new UrlFetchService(properties, null, ssrfPolicy);
    }

    @Configuration(proxyBeanMethods = false)
    @ConditionalOnClass(name = "com.microsoft.playwright.Playwright")
    @ConditionalOnProperty(
            prefix = "ai-assistant",
            name = "headless-fetch-enabled",
            havingValue = "true")
    static class HeadlessFetchAutoConfiguration {
        @Bean
        @ConditionalOnMissingBean(name = "headlessFetchService")
        public com.aiassistant.service.HeadlessFetchService headlessFetchService(
                AiAssistantProperties properties, UrlFetchService urlFetchService) {
            var h = new com.aiassistant.service.HeadlessFetchService(properties);
            urlFetchService.setHeadlessFetchService(h);
            return h;
        }

        @Bean
        public ApplicationListener<ApplicationReadyEvent> headlessFetchWarmup(
                com.aiassistant.service.HeadlessFetchService headlessFetchService) {
            return event -> headlessFetchService.warmupInBackground();
        }
    }

    @Configuration(proxyBeanMethods = false)
    @ConditionalOnClass(name = "javax.sql.DataSource")
    static class JdbcConnectorAutoConfiguration {
        @Bean
        @ConditionalOnMissingBean(name = "jdbcDataConnector")
        public DataConnector jdbcDataConnector(
                ObjectProvider<javax.sql.DataSource> dataSourceProvider,
                AiAssistantProperties properties) {
            List<ConnectorProperties> cfgs = properties.getConnectors();
            if (cfgs == null) return null;
            ConnectorProperties jdbcCfg =
                    cfgs.stream()
                            .filter(c -> "jdbc".equalsIgnoreCase(c.getType()))
                            .findFirst()
                            .orElse(null);
            if (jdbcCfg == null) return null;
            javax.sql.DataSource ds = dataSourceProvider.getIfAvailable();
            if (ds == null) return null;
            return new JdbcConnector(
                    jdbcCfg.resolveId(),
                    jdbcCfg.resolveDisplayName(),
                    ds,
                    jdbcCfg.resolveAllowedTables(),
                    jdbcCfg.getSchema());
        }
    }

    @Bean(destroyMethod = "stop")
    @ConditionalOnMissingBean
    public com.aiassistant.connector.ConnectorHealthScheduler connectorHealthScheduler(
            ObjectProvider<List<DataConnector>> connectorProvider) {
        var sched =
                new com.aiassistant.connector.ConnectorHealthScheduler(
                        connectorProvider.getIfAvailable(), 60_000);
        sched.start();
        return sched;
    }
}

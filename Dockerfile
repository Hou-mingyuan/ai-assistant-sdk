FROM eclipse-temurin:17-jre-alpine AS runtime

LABEL maintainer="ai-assistant-sdk"
LABEL description="AI Assistant SDK - Embeddable AI assistant for Java applications"

RUN addgroup -S assistant && adduser -S assistant -G assistant

WORKDIR /app

COPY ai-assistant-server/target/ai-assistant-spring-boot-starter-*.jar app.jar

RUN chown -R assistant:assistant /app
USER assistant

EXPOSE 8080

ENV JAVA_OPTS="-Xms256m -Xmx512m -XX:+UseG1GC -XX:+UseStringDeduplication"

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:8080/ai-assistant/health || exit 1

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]

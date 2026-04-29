FROM maven:3.9.11-eclipse-temurin-17 AS build

WORKDIR /workspace

COPY ai-assistant-server/pom.xml ai-assistant-server/pom.xml
COPY ai-assistant-service/pom.xml ai-assistant-service/pom.xml
COPY ai-assistant-server/src ai-assistant-server/src
COPY ai-assistant-service/src ai-assistant-service/src

RUN mvn -q -f ai-assistant-server/pom.xml -DskipTests install \
    && mvn -q -f ai-assistant-service/pom.xml -DskipTests package

FROM eclipse-temurin:17-jre-alpine AS runtime

LABEL maintainer="ai-assistant-sdk"
LABEL description="Standalone AI Assistant service built from the embeddable SDK"

RUN addgroup -S assistant && adduser -S assistant -G assistant

WORKDIR /app

COPY --from=build /workspace/ai-assistant-service/target/ai-assistant-service-*.jar app.jar

RUN chown -R assistant:assistant /app
USER assistant

EXPOSE 8080

ENV JAVA_OPTS="-Xms256m -Xmx512m -XX:+UseG1GC -XX:+UseStringDeduplication"

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]

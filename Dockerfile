FROM maven:3.9.11-eclipse-temurin-17 AS build

WORKDIR /workspace

ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY
ARG http_proxy
ARG https_proxy
ARG no_proxy
ARG MAVEN_OPTS

ENV HTTP_PROXY=${HTTP_PROXY}
ENV HTTPS_PROXY=${HTTPS_PROXY}
ENV NO_PROXY=${NO_PROXY}
ENV http_proxy=${http_proxy}
ENV https_proxy=${https_proxy}
ENV no_proxy=${no_proxy}
ENV MAVEN_OPTS="${MAVEN_OPTS} -Dmaven.wagon.http.retryHandler.count=5 -Dmaven.wagon.http.retryHandler.requestSentEnabled=true -Dmaven.wagon.httpconnectionManager.ttlSeconds=25"

COPY ai-assistant-server/pom.xml ai-assistant-server/pom.xml
COPY ai-assistant-service/pom.xml ai-assistant-service/pom.xml
COPY ai-assistant-server/src ai-assistant-server/src

RUN --mount=type=cache,target=/root/.m2 \
    mvn -q -f ai-assistant-server/pom.xml \
        -DskipTests \
        -Dspotless.check.skip=true \
        -Dcheckstyle.skip=true \
        -Djacoco.skip=true \
        install \
    && mvn -q -f ai-assistant-service/pom.xml \
        -DskipTests \
        -DexcludeGroupIds=com.aiassistant \
        dependency:go-offline

COPY ai-assistant-service/src ai-assistant-service/src

RUN --mount=type=cache,target=/root/.m2 \
    mvn -q -f ai-assistant-service/pom.xml -DskipTests package

FROM eclipse-temurin:25-jre-alpine AS runtime

ARG APP_VERSION=1.0.0-SNAPSHOT
ARG VCS_REF=unknown
ARG BUILD_DATE=unknown

LABEL maintainer="ai-assistant-sdk"
LABEL description="Standalone AI Assistant service built from the embeddable SDK"
LABEL org.opencontainers.image.title="AI Assistant Service"
LABEL org.opencontainers.image.description="Standalone AI Assistant service built from the embeddable SDK"
LABEL org.opencontainers.image.version="${APP_VERSION}"
LABEL org.opencontainers.image.revision="${VCS_REF}"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
LABEL org.opencontainers.image.source="https://github.com/Hou-mingyuan/ai-assistant-sdk"

RUN addgroup -S assistant && adduser -S assistant -G assistant

WORKDIR /app

COPY --from=build /workspace/ai-assistant-service/target/ai-assistant-service-*.jar app.jar

RUN java -Djarmode=tools -jar app.jar extract --layers --launcher \
    && rm app.jar \
    && chown -R assistant:assistant /app
WORKDIR /app/app
USER assistant

EXPOSE 8080

ENV JAVA_OPTS="-Xms256m -Xmx512m -XX:+UseG1GC -XX:+UseStringDeduplication -XX:+ExitOnOutOfMemoryError"

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=20s \
  CMD wget -qO- "http://localhost:${SERVER_PORT:-8080}${AI_ASSISTANT_CONTEXT_PATH:-/ai-assistant}/health" || exit 1

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -cp \"application:application/BOOT-INF/classes:dependencies/BOOT-INF/lib/*:snapshot-dependencies/BOOT-INF/lib/*\" com.aiassistant.serviceapp.AiAssistantServiceApplication"]

FROM eclipse-temurin:17-jre-alpine

LABEL maintainer="ai-assistant-sdk"
LABEL description="AI Assistant Spring Boot Starter Demo"

WORKDIR /app

COPY ai-assistant-server/target/*.jar app.jar

EXPOSE 8080

ENV JAVA_OPTS="-Xms256m -Xmx512m"

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]

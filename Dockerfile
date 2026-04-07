# Multi-stage build: backend + frontend demo
FROM maven:3.9-eclipse-temurin-17 AS backend
WORKDIR /app
COPY ai-assistant-server/pom.xml ai-assistant-server/pom.xml
COPY ai-assistant-demo/pom.xml ai-assistant-demo/pom.xml
RUN cd ai-assistant-server && mvn -B dependency:go-offline -q || true
COPY ai-assistant-server ai-assistant-server
RUN cd ai-assistant-server && mvn -B install -DskipTests -q
COPY ai-assistant-demo ai-assistant-demo
RUN cd ai-assistant-demo && mvn -B package -DskipTests -q

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=backend /app/ai-assistant-demo/target/*.jar app.jar
EXPOSE 8080
ENV JAVA_OPTS="-Xmx256m"
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]

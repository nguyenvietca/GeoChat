# syntax=docker/dockerfile:1.7
FROM eclipse-temurin:21-jdk-jammy AS build
WORKDIR /workspace
COPY .mvn/ .mvn/
COPY mvnw mvnw.cmd pom.xml ./
COPY src/ src/
# CI runs the full test suite before image creation.
RUN --mount=type=cache,target=/root/.m2 chmod +x mvnw && ./mvnw -B -DskipTests package

FROM eclipse-temurin:21-jre-jammy AS runtime
RUN apt-get update \
    && apt-get install --no-install-recommends -y curl libssl3 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system geochat \
    && useradd --system --gid geochat --home-dir /app --create-home geochat
WORKDIR /app
COPY --from=build --chown=geochat:geochat /workspace/target/backend-*.jar app.jar
RUN mkdir -p /app/var/chat-images && chown -R geochat:geochat /app/var
USER geochat
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "/app/app.jar"]

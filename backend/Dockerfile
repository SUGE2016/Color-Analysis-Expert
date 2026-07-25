FROM maven:3.9-eclipse-temurin-17 AS build

WORKDIR /app
COPY docker/maven/settings.xml /root/.m2/settings.xml
COPY backend/pom.xml ./
COPY backend/src ./src

RUN --mount=type=cache,target=/root/.m2 \
    mvn -B package -DskipTests -T 1C -Dmaven.test.skip=true

FROM maven:3.9-eclipse-temurin-17

WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends fonts-wqy-zenhei \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /app/storage/logs

COPY --from=build /app/target/*.jar /app/app.jar

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]

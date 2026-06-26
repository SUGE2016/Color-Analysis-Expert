FROM maven:3.9-eclipse-temurin-17 AS build

WORKDIR /app
COPY docker/maven/settings.xml /root/.m2/settings.xml
COPY backend/pom.xml ./
COPY backend/src ./src

RUN mvn -B package -DskipTests -T 1C -Dmaven.test.skip=true

FROM eclipse-temurin:17-jre-jammy

WORKDIR /app
RUN mkdir -p /app/storage

COPY --from=build /app/target/*.jar /app/app.jar

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]

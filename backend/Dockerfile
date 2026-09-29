# ---------- Build stage ----------
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -q -B dependency:go-offline
COPY src ./src
RUN mvn -q -B package -DskipTests

# ---------- Runtime stage ----------
FROM eclipse-temurin:17-jre
WORKDIR /app
RUN useradd --system --uid 1001 cims \
    && mkdir -p /var/data/uploads \
    && chown -R cims /var/data
COPY --from=build /app/target/cims-backend.jar app.jar
USER cims

# All configuration comes from environment variables (see backend/.env.example).
ENV FILE_STORAGE_PATH=/var/data/uploads \
    JAVA_OPTS="-XX:MaxRAMPercentage=75"
EXPOSE 8080
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]

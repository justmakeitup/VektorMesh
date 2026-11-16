# ============================================================================
# VektorMesh Java Engine Dockerfile (Multi-stage Eclipse Temurin JDK 21 Alpine)
# ============================================================================

FROM maven:3.9-eclipse-temurin-21-jammy AS builder

WORKDIR /build

# Copy shared protobuf definitions
COPY proto/ /proto/

# Copy Maven POM and source
COPY engine-java/pom.xml .
RUN mvn dependency:go-offline -B || true

COPY engine-java/src ./src

# Compile protobufs and build fat JAR
RUN mvn clean package -DskipTests -B

# ----------------------------------------------------------------------------
# Runtime Stage
# ----------------------------------------------------------------------------
FROM eclipse-temurin:21-jre-jammy AS runner

WORKDIR /app

RUN addgroup -S vektormesh && adduser -S vektormesh -G vektormesh

COPY --from=builder /build/target/engine-java-*.jar /app/engine-java.jar

USER vektormesh

ENV JAVA_OPTS="-XX:+UseG1GC -XX:+ExitOnOutOfMemoryError -Djava.security.egd=file:/dev/./urandom" \
    SERVER_PORT=8080 \
    GRPC_SERVER_PORT=9090

EXPOSE 8080
EXPOSE 9090

HEALTHCHECK --interval=10s --timeout=3s --retries=5 --start-period=20s \
    CMD wget -qO- http://localhost:8080/actuator/health | grep '"status":"UP"' || exit 1

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /app/engine-java.jar"]

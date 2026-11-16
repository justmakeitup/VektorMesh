# ============================================================================
# VektorMesh Monorepo Makefile
# Multi-Service Canary & Anomaly Remediation Control Plane
# ============================================================================

.DEFAULT_GOAL := help

PROTO_SRC := proto/vektormesh.proto
PYTHON_PROTO_DIR := inference-python/app/proto
NODE_PROTO_DIR := gateway-node/src/proto
GATEWAY_DIR := gateway-node

.PHONY: help
help: ## Show this help message
	@echo "VektorMesh Build & Control Plane Automation"
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

.PHONY: protos
protos: protos-python protos-node ## Compile Protocol Buffers for all microservices

.PHONY: protos-python
protos-python: ## Compile gRPC stubs for Python Anomaly Inference Engine
	@echo "==> Compiling Protocol Buffers for Python..."
	@mkdir -p $(PYTHON_PROTO_DIR)
	python -m grpc_tools.protoc \
		-I./proto \
		--python_out=$(PYTHON_PROTO_DIR) \
		--grpc_python_out=$(PYTHON_PROTO_DIR) \
		--pyi_out=$(PYTHON_PROTO_DIR) \
		$(PROTO_SRC)
	@echo "Python stubs successfully generated in $(PYTHON_PROTO_DIR)"

.PHONY: protos-node
protos-node: ## Generate static TypeScript typings for Node.js Edge Gateway
	@echo "==> Generating Protocol Buffer typings for Node.js..."
	@mkdir -p $(NODE_PROTO_DIR)
	@if [ -f "$(GATEWAY_DIR)/node_modules/.bin/proto-loader-gen-types" ]; then \
		$(GATEWAY_DIR)/node_modules/.bin/proto-loader-gen-types \
			--longs=String \
			--enums=String \
			--defaults \
			--oneofs \
			--grpcLib=@grpc/grpc-js \
			--outDir=$(NODE_PROTO_DIR) \
			$(PROTO_SRC); \
	else \
		(cd $(GATEWAY_DIR) && npm run proto:generate); \
	fi
	@echo "Node.js typings successfully generated in $(NODE_PROTO_DIR)"

.PHONY: protos-java
protos-java: ## Compile gRPC stubs for Java Spring Boot Engine via Maven
	@echo "==> Compiling Protocol Buffers for Java..."
	@if [ -f "./.tools/apache-maven-3.9.9/bin/mvn" ]; then \
		(cd engine-java && ../.tools/apache-maven-3.9.9/bin/mvn compile); \
	else \
		(cd engine-java && mvn compile); \
	fi

.PHONY: build-java
build-java: ## Build the Java Spring Boot Engine fat JAR
	@echo "==> Building Java 21 Spring Boot fat JAR..."
	@if [ -f "./.tools/apache-maven-3.9.9/bin/mvn" ]; then \
		(cd engine-java && ../.tools/apache-maven-3.9.9/bin/mvn clean package -DskipTests); \
	else \
		(cd engine-java && mvn clean package -DskipTests); \
	fi

.PHONY: infra-up
infra-up: ## Start MySQL 8.0 infrastructure container with healthchecks
	docker compose -f docker-compose.infra.yml up -d

.PHONY: infra-down
infra-down: ## Stop and remove infrastructure containers
	docker compose -f docker-compose.infra.yml down

.PHONY: infra-logs
infra-logs: ## Stream MySQL container logs
	docker compose -f docker-compose.infra.yml logs -f vektormesh-mysql

.PHONY: infra-clean
infra-clean: ## Stop and destroy MySQL containers and data volumes
	docker compose -f docker-compose.infra.yml down -v

.PHONY: verify-ledger
verify-ledger: ## Execute cryptographic audit ledger verification query
	docker compose -f docker-compose.infra.yml exec -T vektormesh-mysql \
		mysql -uvektormesh -pvektormesh_secret vektormesh < db/verify-ledger.sql

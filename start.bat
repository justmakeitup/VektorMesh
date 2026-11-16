@echo off
title VektorMesh Orchestrator
cd /d "%~dp0"

echo ========================================================================
echo        VEKTORMESH: POLYGLOT CANARY ^& CONTROL PLANE LAUNCHER
echo ========================================================================
echo.

:: 1. Start Python Anomaly Inference Engine (:8000 HTTP / :50052 gRPC)
echo [1/4] Launching Python Anomaly Inference Engine (:8000 / :50052)...
start "VektorMesh - Python Engine (:8000 / :50052)" cmd /k "cd /d %~dp0inference-python && python -m uvicorn app.main:app --port 8000 --host 0.0.0.0"

:: Wait 2 seconds for Python server
timeout /t 2 /nobreak >nul

:: 2. Start Java Core Execution Engine (:8080 HTTP / :9090 gRPC)
echo [2/4] Launching Java 21 Spring Boot Engine (:8080 / :9090)...
start "VektorMesh - Java Engine (:8080 / :9090)" cmd /k "cd /d %~dp0engine-java && java -jar target\engine-java-1.0.0-SNAPSHOT.jar --spring.profiles.active=local"

:: Wait for Java engine to initialize
timeout /t 18 /nobreak >nul

:: 3. Start Node.js Edge Gateway (:4000)
echo [3/4] Launching Node.js Fastify Edge Gateway (:4000)...
start "VektorMesh - Node Gateway (:4000)" cmd /k "cd /d %~dp0gateway-node && npm start"

:: Wait 2 seconds for Gateway
timeout /t 2 /nobreak >nul

:: 4. Start React UI Dashboard (:3000)
echo [4/4] Launching React UI Dashboard (:3000)...
start "VektorMesh - React UI (:3000)" cmd /k "cd /d %~dp0ui-react && npm run dev"

:: Wait 2 seconds and open browser
timeout /t 2 /nobreak >nul
echo.
echo ========================================================================
echo   All 4 tiers launched! Opening http://localhost:3000 in your browser...
echo ========================================================================
start http://localhost:3000

echo.
echo To stop all services, run stop.bat or stop.ps1
echo.
pause

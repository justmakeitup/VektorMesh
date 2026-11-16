package com.vektormesh.engine.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.core.task.AsyncTaskExecutor;
import org.springframework.core.task.support.TaskExecutorAdapter;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Java 21 Virtual Threads Executor Configuration.
 * Provides virtual thread executors for high-throughput, non-blocking telemetry dispatch,
 * chaos injection scheduling, and gRPC streaming operations.
 */
@Configuration
public class VirtualThreadConfig {

    @Bean(name = "virtualThreadExecutor", destroyMethod = "close")
    @Primary
    public ExecutorService virtualThreadExecutor() {
        return Executors.newVirtualThreadPerTaskExecutor();
    }

    @Bean(name = "applicationTaskExecutor")
    public AsyncTaskExecutor applicationTaskExecutor(ExecutorService virtualThreadExecutor) {
        return new TaskExecutorAdapter(virtualThreadExecutor);
    }
}

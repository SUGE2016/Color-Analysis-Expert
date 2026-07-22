package com.coloranalysisbackend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class ColorAnalysisBackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(ColorAnalysisBackendApplication.class, args);
    }

}

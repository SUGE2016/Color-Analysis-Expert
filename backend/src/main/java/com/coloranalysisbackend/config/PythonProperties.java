package com.coloranalysisbackend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "python.service")
public class PythonProperties {
    /**
     * Base URL of the Python processing service (e.g. http://localhost:5000)
     */
    private String url;

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }
}
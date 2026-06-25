package com.coloranalysisbackend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.codec.ClientCodecConfigurer;
import org.springframework.web.reactive.function.client.ExchangeStrategies;
import org.springframework.web.reactive.function.client.WebClient;

@Configuration
public class WebClientConfig {
    /** 对齐/HSV 等接口返回整图 PNG，默认 256KB 缓冲不足 */
    private static final int MAX_IN_MEMORY_BYTES = 16 * 1024 * 1024;

    @Bean
    public WebClient.Builder webClientBuilder() {
        ExchangeStrategies strategies = ExchangeStrategies.builder()
                .codecs((ClientCodecConfigurer configurer) ->
                        configurer.defaultCodecs().maxInMemorySize(MAX_IN_MEMORY_BYTES))
                .build();
        return WebClient.builder().exchangeStrategies(strategies);
    }
}

package com.coloranalysisbackend.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.core.io.ByteArrayResource;

import java.util.Map;

@Service
public class PythonClientService {
    private final WebClient webClient;
        private final ObjectMapper objectMapper;

        public PythonClientService(WebClient.Builder builder,
                                                           com.coloranalysisbackend.config.PythonProperties props,
                                                           ObjectMapper objectMapper) {
        this.webClient = builder.baseUrl(props.getUrl()).build();
                this.objectMapper = objectMapper;
    }

    /**
     * 获取 canny 多边形区域 JSON
     */
    public Map<String, Object> detectCanny(byte[] imageBytes, Map<String,Object> config) {
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("image", namedResource(imageBytes, "image.png"));
        body.add("config", toJsonString(config));
        return webClient.post()
                .uri(uri -> uri.path("/canny").build())
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(BodyInserters.fromMultipartData(body))
                .retrieve()
                .bodyToMono(Map.class)
                .block();
    }

    /**
     * 角点检测
     */
    public Map<String, Object> detectPoints(byte[] imageBytes) {
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("image", namedResource(imageBytes, "image.png"));
        return webClient.post()
                .uri("/image/correction/points")
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(BodyInserters.fromMultipartData(body))
                .retrieve()
                .bodyToMono(Map.class)
                .block();
    }

    /**
     * 图像校正：传入模板和待校正图片，返回校正后的图片字节
     */
    public byte[] alignImage(byte[] modelBytes, byte[] imageBytes) {
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("model", namedResource(modelBytes, "model.png"));
        body.add("image", namedResource(imageBytes, "image.png"));
        return webClient.post()
                .uri("/image/correction/align")
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(BodyInserters.fromMultipartData(body))
                .retrieve()
                .bodyToMono(byte[].class)
                .block();
    }

    /**
     * HSV 掩膜处理，返回处理后的图像
     */
    public byte[] hsvProcess(byte[] imageBytes, byte[] maskBytes) {
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("image", namedResource(imageBytes, "image.png"));
        body.add("mask", namedResource(maskBytes, "mask.png"));
        return webClient.post()
                .uri("/hsv/process_image")
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(BodyInserters.fromMultipartData(body))
                .retrieve()
                .bodyToMono(byte[].class)
                .block();
    }

        /**
         * 执行项目分析流水线（批处理）
         */
        public Map<String, Object> runPipeline(Map<String, Object> payload) {
                return webClient.post()
                                .uri("/pipeline/run")
                                .contentType(MediaType.APPLICATION_JSON)
                                .bodyValue(payload)
                                .retrieve()
                                .bodyToMono(Map.class)
                                .block();
        }

        private ByteArrayResource namedResource(byte[] bytes, String fileName) {
                return new ByteArrayResource(bytes) {
                        @Override
                        public String getFilename() {
                                return fileName;
                        }
                };
        }

        private String toJsonString(Map<String, Object> config) {
                if (config == null || config.isEmpty()) {
                        return "{}";
                }
                try {
                        return objectMapper.writeValueAsString(config);
                } catch (JsonProcessingException e) {
                        return "{}";
                }
        }
}

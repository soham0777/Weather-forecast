package com.cims.support;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/** Boots the full application (H2) and offers small helpers for authenticated JSON calls. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public abstract class IntegrationTestBase {

    @Autowired
    protected MockMvc mvc;

    @Autowired
    protected ObjectMapper objectMapper;

    @Autowired
    protected TestData data;

    protected ResultActions getJson(String url, String token) throws Exception {
        return mvc.perform(auth(get(url), token));
    }

    /** GET with query parameters passed unencoded ({@code "q", "text with spaces"}); MockMvc encodes them. */
    protected ResultActions getWithParams(String url, String token, String... params) throws Exception {
        MockHttpServletRequestBuilder builder = get(url);
        for (int i = 0; i < params.length; i += 2) {
            builder.param(params[i], params[i + 1]);
        }
        return mvc.perform(auth(builder, token));
    }

    protected ResultActions postJson(String url, String token, Object body) throws Exception {
        return mvc.perform(auth(post(url), token).contentType(MediaType.APPLICATION_JSON).content(toJson(body)));
    }

    protected ResultActions putJson(String url, String token, Object body) throws Exception {
        return mvc.perform(auth(put(url), token).contentType(MediaType.APPLICATION_JSON).content(toJson(body)));
    }

    protected ResultActions patchJson(String url, String token, Object body) throws Exception {
        return mvc.perform(auth(patch(url), token).contentType(MediaType.APPLICATION_JSON).content(toJson(body)));
    }

    protected ResultActions deleteJson(String url, String token) throws Exception {
        return mvc.perform(auth(delete(url), token));
    }

    protected JsonNode json(ResultActions result) throws Exception {
        return objectMapper.readTree(result.andReturn().getResponse().getContentAsString());
    }

    private String toJson(Object body) throws Exception {
        return body instanceof String s ? s : objectMapper.writeValueAsString(body);
    }

    private static MockHttpServletRequestBuilder auth(MockHttpServletRequestBuilder builder, String token) {
        return token == null ? builder : builder.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
    }
}

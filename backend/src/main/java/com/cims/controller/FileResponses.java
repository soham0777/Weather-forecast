package com.cims.controller;

import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

/** Builds safe PDF download responses. */
final class FileResponses {

    private FileResponses() {
    }

    static ResponseEntity<Resource> pdf(Resource resource, String fileName) {
        ContentDisposition disposition = ContentDisposition.inline().filename(fileName).build();
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .header("X-Content-Type-Options", "nosniff")
                .body(resource);
    }
}

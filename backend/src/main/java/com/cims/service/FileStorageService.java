package com.cims.service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.LocalDate;
import java.util.Locale;
import java.util.UUID;
import java.util.stream.Stream;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.PathResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.cims.config.AppProperties;
import com.cims.entity.enums.AuditAction;
import com.cims.exception.ApiException;
import com.cims.exception.BadRequestException;
import com.cims.exception.NotFoundException;

import org.springframework.http.HttpStatus;

/**
 * Stores uploaded resumes on the file system under FILE_STORAGE_PATH. Files are saved under
 * random UUID names (never the user-supplied name) and every upload is checked for extension,
 * MIME type, PDF signature and the 5 MB size limit.
 */
@Service
public class FileStorageService {

    public static final long MAX_RESUME_BYTES = 5L * 1024 * 1024;
    public static final String RESUME_PREFIX = "resumes/";

    private static final Logger log = LoggerFactory.getLogger(FileStorageService.class);
    private static final byte[] PDF_SIGNATURE = {'%', 'P', 'D', 'F', '-'};

    private final Path root;
    private final AuditService auditService;

    public FileStorageService(AppProperties properties, AuditService auditService) throws IOException {
        this.root = Path.of(properties.storage().path()).toAbsolutePath().normalize();
        this.auditService = auditService;
        Files.createDirectories(root);
    }

    /** Validates and stores a resume PDF. Returns the storage key relative to the storage root. */
    public String storeResume(MultipartFile file) {
        validatePdf(file);
        String key = RESUME_PREFIX + LocalDate.now().getYear() + "/" + UUID.randomUUID() + ".pdf";
        Path target = resolve(key);
        try (InputStream in = file.getInputStream()) {
            Files.createDirectories(target.getParent());
            Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException ex) {
            log.error("Could not store resume", ex);
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "The file could not be saved. Please try again.");
        }
        return key;
    }

    /** Copies a stored file (e.g. the profile resume) to a new key for an application snapshot. */
    public String copyToApplicationSnapshot(String sourceKey) {
        Path source = resolve(sourceKey);
        if (!Files.exists(source)) {
            throw new BadRequestException("Your resume file could not be found. Please upload your resume again.");
        }
        String key = "applications/" + LocalDate.now().getYear() + "/" + UUID.randomUUID() + ".pdf";
        Path target = resolve(key);
        try {
            Files.createDirectories(target.getParent());
            Files.copy(source, target, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException ex) {
            log.error("Could not copy resume {}", sourceKey, ex);
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "The resume could not be attached. Please try again.");
        }
        return key;
    }

    public Resource load(String key) {
        Path path = resolve(key);
        if (!Files.isRegularFile(path)) {
            throw new NotFoundException("The requested file was not found.");
        }
        return new PathResource(path);
    }

    public void deleteQuietly(String key) {
        if (key == null) {
            return;
        }
        try {
            Files.deleteIfExists(resolve(key));
        } catch (IOException | RuntimeException ex) {
            log.warn("Could not delete stored file {}: {}", key, ex.getMessage());
        }
    }

    /** Total bytes used by stored files, for the system activity report. */
    public long totalStoredBytes() {
        if (!Files.exists(root)) {
            return 0;
        }
        try (Stream<Path> files = Files.walk(root)) {
            return files.filter(Files::isRegularFile).mapToLong(path -> {
                try {
                    return Files.size(path);
                } catch (IOException ex) {
                    return 0;
                }
            }).sum();
        } catch (IOException ex) {
            return 0;
        }
    }

    private void validatePdf(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw reject("Please choose a PDF file to upload.", "empty file");
        }
        if (file.getSize() > MAX_RESUME_BYTES) {
            auditService.logViolation(AuditAction.INVALID_FILE_UPLOAD, null, null, "File larger than 5 MB rejected");
            throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "The file is too large. The maximum allowed size is 5 MB.");
        }
        String name = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase(Locale.ROOT);
        if (!name.endsWith(".pdf")) {
            throw reject("Only PDF files are allowed. Please upload your resume as a .pdf file.", "extension: " + name);
        }
        String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
        if (!contentType.equals("application/pdf")) {
            throw reject("Only PDF files are allowed (the file type must be application/pdf).", "content type: " + contentType);
        }
        try (InputStream in = file.getInputStream()) {
            byte[] header = in.readNBytes(PDF_SIGNATURE.length);
            for (int i = 0; i < PDF_SIGNATURE.length; i++) {
                if (header.length < PDF_SIGNATURE.length || header[i] != PDF_SIGNATURE[i]) {
                    throw reject("The uploaded file is not a valid PDF document.", "missing %PDF signature");
                }
            }
        } catch (IOException ex) {
            throw reject("The uploaded file could not be read.", "unreadable file");
        }
    }

    private BadRequestException reject(String message, String detail) {
        auditService.logViolation(AuditAction.INVALID_FILE_UPLOAD, null, null, "Resume upload rejected (" + detail + ")");
        return new BadRequestException(message);
    }

    private Path resolve(String key) {
        Path path = root.resolve(key).normalize();
        if (!path.startsWith(root)) {
            throw new BadRequestException("Invalid file path.");
        }
        return path;
    }
}

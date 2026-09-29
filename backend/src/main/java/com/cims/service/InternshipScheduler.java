package com.cims.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Closes OPEN internships once their application deadline has passed (at startup and hourly). */
@Component
public class InternshipScheduler {

    private static final Logger log = LoggerFactory.getLogger(InternshipScheduler.class);

    private final InternshipService internshipService;

    public InternshipScheduler(InternshipService internshipService) {
        this.internshipService = internshipService;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onStartup() {
        closeExpired();
    }

    @Scheduled(cron = "0 5 * * * *", zone = "${app.timezone}")
    public void closeExpired() {
        int closed = internshipService.closeExpiredInternships();
        if (closed > 0) {
            log.info("Closed {} internship(s) whose application deadline has passed", closed);
        }
    }
}

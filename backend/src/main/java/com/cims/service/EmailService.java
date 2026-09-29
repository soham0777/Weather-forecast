package com.cims.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import com.cims.config.AppProperties;

/**
 * Sends transactional e-mails over SMTP. When MAIL_ENABLED=false (local development) the
 * message is written to the application log instead, so the flow can be tested without SMTP.
 */
@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    private final JavaMailSender mailSender;
    private final AppProperties properties;

    public EmailService(JavaMailSender mailSender, AppProperties properties) {
        this.mailSender = mailSender;
        this.properties = properties;
    }

    @Async
    public void sendVerificationEmail(String to, String name, String verificationLink) {
        String subject = "Verify your e-mail address - College Internship Management System";
        String body = """
                Hello %s,

                Please verify your e-mail address for the College Internship Management System by opening the link below:

                %s

                The link is valid for 24 hours. If you did not create an account, you can ignore this message.
                """.formatted(name, verificationLink);
        send(to, subject, body);
    }

    private void send(String to, String subject, String body) {
        if (!properties.mail().enabled()) {
            log.info("[MAIL DISABLED] E-mail to {} | {}\n{}", to, subject, body);
            return;
        }
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(properties.mail().from());
            message.setTo(to);
            message.setSubject(subject);
            message.setText(body);
            mailSender.send(message);
        } catch (MailException ex) {
            log.error("Failed to send e-mail to {}: {}", to, ex.getMessage());
        }
    }
}

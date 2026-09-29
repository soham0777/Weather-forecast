package com.cims.service;

import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.cims.dto.common.OptionDto;
import com.cims.dto.common.PageResponse;
import com.cims.dto.company.CompanyDetailDto;
import com.cims.dto.company.CompanyDto;
import com.cims.dto.company.CompanyRequest;
import com.cims.dto.internship.InternshipDto;
import com.cims.entity.Company;
import com.cims.entity.enums.AuditAction;
import com.cims.entity.enums.CompanyStatus;
import com.cims.entity.enums.InternshipStatus;
import com.cims.exception.ConflictException;
import com.cims.exception.NotFoundException;
import com.cims.repository.CompanyRepository;
import com.cims.repository.InternshipRepository;
import com.cims.repository.StudentFeedbackRepository;
import com.cims.security.UserPrincipal;
import com.cims.util.PageUtils;
import com.cims.util.TextUtils;

@Service
public class CompanyService {

    private static final Map<String, String> SORT_KEYS = Map.of(
            "name", "name", "location", "location", "createdAt", "createdAt", "status", "status");
    private static final EnumSet<InternshipStatus> ACTIVE_INTERNSHIP_STATUSES =
            EnumSet.of(InternshipStatus.PENDING, InternshipStatus.APPROVED, InternshipStatus.OPEN);

    private final CompanyRepository companyRepository;
    private final InternshipRepository internshipRepository;
    private final StudentFeedbackRepository studentFeedbackRepository;
    private final InternshipService internshipService;
    private final CurrentUserService currentUserService;
    private final AuditService auditService;

    public CompanyService(CompanyRepository companyRepository, InternshipRepository internshipRepository,
                          StudentFeedbackRepository studentFeedbackRepository, InternshipService internshipService,
                          CurrentUserService currentUserService, AuditService auditService) {
        this.companyRepository = companyRepository;
        this.internshipRepository = internshipRepository;
        this.studentFeedbackRepository = studentFeedbackRepository;
        this.internshipService = internshipService;
        this.currentUserService = currentUserService;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public PageResponse<CompanyDto> search(String q, String location, CompanyStatus status, Integer page, Integer size,
                                           String sort) {
        UserPrincipal principal = currentUserService.principal();
        CompanyStatus effectiveStatus = principal.isAdmin() ? status : CompanyStatus.ACTIVE;
        var pageable = PageUtils.of(page, size, sort, SORT_KEYS, Sort.by("name"));
        return PageResponse.of(companyRepository.search(TextUtils.likePattern(q), TextUtils.likePattern(location),
                effectiveStatus, pageable), c -> toDto(c, principal));
    }

    @Transactional(readOnly = true)
    public List<OptionDto> activeOptions() {
        return companyRepository.findByStatusOrderByNameAsc(CompanyStatus.ACTIVE).stream()
                .map(c -> new OptionDto(c.getId(), c.getName() + " – " + c.getLocation()))
                .toList();
    }

    @Transactional(readOnly = true)
    public CompanyDetailDto get(Long id) {
        UserPrincipal principal = currentUserService.principal();
        Company company = find(id);
        if (!principal.isAdmin() && company.getStatus() != CompanyStatus.ACTIVE) {
            throw NotFoundException.of("Company", id);
        }

        List<InternshipDto> internships = internshipRepository.findByCompanyIdOrderByCreatedAtDesc(id).stream()
                .filter(i -> !principal.isStudent() || InternshipService.STUDENT_BROWSABLE.contains(i.getStatus()))
                .map(i -> internshipService.get(i.getId()))
                .toList();

        var summary = studentFeedbackRepository.summaryForCompany(id);
        var ratings = new CompanyDetailDto.RatingSummary(summary.getFeedbackCount(), round(summary.getCompanyCulture()),
                round(summary.getMentorshipQuality()), round(summary.getTechnicalLearning()),
                round(summary.getWorkEnvironment()), round(summary.getOverallExperience()));

        boolean staff = !principal.isStudent();
        List<CompanyDetailDto.FeedbackEntry> feedback = studentFeedbackRepository
                .findRecentForCompany(id, PageRequest.of(0, 10)).stream()
                .map(f -> new CompanyDetailDto.FeedbackEntry(f.getId(), f.getApplication().getInternship().getTitle(),
                        staff ? f.getApplication().getStudent().getStudentName() : null, f.getOverallExperience(),
                        f.getComments(), f.getSuggestions(), f.getCreatedAt()))
                .toList();
        return new CompanyDetailDto(toDto(company, principal), internships, ratings, feedback);
    }

    @Transactional
    public CompanyDto create(CompanyRequest request) {
        String registrationNumber = normalizeRegistration(request.registrationNumber());
        if (companyRepository.existsByRegistrationNumber(registrationNumber)) {
            throw new ConflictException("A company with this registration number already exists.");
        }
        Company company = new Company();
        company.setStatus(CompanyStatus.ACTIVE);
        apply(company, request, registrationNumber);
        companyRepository.save(company);
        auditService.log(AuditAction.COMPANY_CREATED, "Company", company.getId(), company.getName());
        return toDto(company, currentUserService.principal());
    }

    @Transactional
    public CompanyDto update(Long id, CompanyRequest request) {
        Company company = find(id);
        String registrationNumber = normalizeRegistration(request.registrationNumber());
        if (companyRepository.existsByRegistrationNumberAndIdNot(registrationNumber, id)) {
            throw new ConflictException("A company with this registration number already exists.");
        }
        apply(company, request, registrationNumber);
        auditService.log(AuditAction.COMPANY_UPDATED, "Company", id, company.getName());
        return toDto(company, currentUserService.principal());
    }

    /**
     * Deletes a company that has never had internships; otherwise archives it (allowed only
     * once none of its internships are pending, approved or open).
     *
     * @return true if deleted, false if archived
     */
    @Transactional
    public boolean delete(Long id) {
        Company company = find(id);
        if (internshipRepository.countByCompanyId(id) == 0) {
            companyRepository.delete(company);
            auditService.log(AuditAction.COMPANY_ARCHIVED, "Company", id, "Deleted (no internships): " + company.getName());
            return true;
        }
        if (company.getStatus() == CompanyStatus.ARCHIVED) {
            throw new ConflictException("This company is already archived.");
        }
        if (internshipRepository.countByCompanyIdAndStatusIn(id, ACTIVE_INTERNSHIP_STATUSES) > 0) {
            throw new ConflictException("This company has pending, approved or open internships. Close or archive them before archiving the company.");
        }
        company.setStatus(CompanyStatus.ARCHIVED);
        auditService.log(AuditAction.COMPANY_ARCHIVED, "Company", id, company.getName());
        return false;
    }

    @Transactional
    public CompanyDto restore(Long id) {
        Company company = find(id);
        if (company.getStatus() == CompanyStatus.ACTIVE) {
            throw new ConflictException("This company is already active.");
        }
        company.setStatus(CompanyStatus.ACTIVE);
        auditService.log(AuditAction.COMPANY_RESTORED, "Company", id, company.getName());
        return toDto(company, currentUserService.principal());
    }

    private Company find(Long id) {
        return companyRepository.findById(id).orElseThrow(() -> NotFoundException.of("Company", id));
    }

    private CompanyDto toDto(Company company, UserPrincipal principal) {
        return CompanyDto.from(company, internshipRepository.countByCompanyId(company.getId()), !principal.isStudent());
    }

    private static void apply(Company company, CompanyRequest request, String registrationNumber) {
        company.setName(request.name().trim());
        company.setRegistrationNumber(registrationNumber);
        company.setLocation(request.location().trim());
        company.setContactPerson(request.contactPerson().trim());
        company.setContactEmail(TextUtils.normalizeEmail(request.contactEmail()));
        company.setContactPhone(request.contactPhone().trim());
    }

    private static String normalizeRegistration(String value) {
        return value.trim().toUpperCase(Locale.ROOT);
    }

    private static Double round(Double value) {
        return value == null ? null : Math.round(value * 100.0) / 100.0;
    }
}

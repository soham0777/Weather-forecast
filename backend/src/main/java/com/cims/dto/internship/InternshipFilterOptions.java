package com.cims.dto.internship;

import java.util.List;

import com.cims.dto.common.OptionDto;

/** Values for the internship search drop-downs (domain, company, location). */
public record InternshipFilterOptions(List<String> domains, List<OptionDto> companies, List<String> locations) {
}

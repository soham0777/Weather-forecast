package com.cims.entity;

/**
 * The six student-performance criteria shared by faculty evaluations and company feedback.
 */
public interface PerformanceRatings {

    void setTechnicalSkills(Integer value);

    void setSoftSkills(Integer value);

    void setPunctuality(Integer value);

    void setResponsibility(Integer value);

    void setTeamwork(Integer value);

    void setLearningAbility(Integer value);
}

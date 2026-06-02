package com.coloranalysisbackend.repository;

import com.coloranalysisbackend.model.Template;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TemplateRepository extends JpaRepository<Template, String> {
}

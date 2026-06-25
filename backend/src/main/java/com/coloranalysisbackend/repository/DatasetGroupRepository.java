package com.coloranalysisbackend.repository;

import com.coloranalysisbackend.model.DatasetGroup;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DatasetGroupRepository extends JpaRepository<DatasetGroup, String> {
    List<DatasetGroup> findByAcademicYear(Integer academicYear);
}

package com.coloranalysisbackend.repository;

import com.coloranalysisbackend.model.Dataset;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DatasetRepository extends JpaRepository<Dataset, String> {
	List<Dataset> findByGroupId(String groupId);

	List<Dataset> findByScene(String scene);

	List<Dataset> findByGroupIdAndScene(String groupId, String scene);

	boolean existsByGroupId(String groupId);
}

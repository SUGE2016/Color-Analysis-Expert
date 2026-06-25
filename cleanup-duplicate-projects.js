// 在浏览器控制台运行此脚本来清理重复项目
(function cleanupDuplicateProjects() {
  try {
    const savedProjects = JSON.parse(localStorage.getItem('incompleteAnalysisProjects') || '[]');
    const originalCount = savedProjects.length;
    
    if (savedProjects.length === 0) {
      console.log('没有找到未完成的项目');
      return;
    }
    
    console.log('原始项目数量:', originalCount);
    console.log('项目列表:', savedProjects.map(p => ({ id: p.id, name: p.name })));
    
    // 使用Map去重，保留最新的项目
    const projectMap = new Map();
    savedProjects.forEach(p => {
      if (p.id) {
        projectMap.set(p.id, p);
      }
    });
    
    const deduplicated = Array.from(projectMap.values());
    localStorage.setItem('incompleteAnalysisProjects', JSON.stringify(deduplicated));
    
    console.log(`清理完成：从 ${originalCount} 个项目减少到 ${deduplicated.length} 个项目`);
    console.log('删除了', originalCount - deduplicated.length, '个重复项目');
    console.log('清理后的项目列表:', deduplicated.map(p => ({ id: p.id, name: p.name })));
  } catch (e) {
    console.error('清理重复项目失败:', e);
  }
})();

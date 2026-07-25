export const getProjectCreateErrorMessage = (error) => {
  const status = error?.response?.status;
  const serverMessage = error?.response?.data?.message;

  if (status === 409) {
    if (serverMessage === 'running project cannot be edited') {
      return '项目正在执行，无法修改；请先取消当前任务或新建项目';
    }
    if (serverMessage && serverMessage !== 'project name already exists') {
      return serverMessage;
    }
    return '项目名称已存在，请更换名称，或从历史项目中继续编辑已有项目';
  }
  if (status === 422) {
    return serverMessage || '项目配置不完整，请检查数据集和模板后重试';
  }
  return serverMessage || '项目创建失败，请稍后重试';
};

import { getProjectCreateErrorMessage } from './projectCreateError';

test('explains how to resolve a duplicate project name conflict', () => {
  const error = {
    response: {
      status: 409,
      data: { message: 'project name already exists' },
    },
  };

  expect(getProjectCreateErrorMessage(error)).toBe(
    '项目名称已存在，请更换名称，或从历史项目中继续编辑已有项目'
  );
});

test('preserves a server validation message', () => {
  const error = {
    response: {
      status: 422,
      data: { message: 'template is required' },
    },
  };

  expect(getProjectCreateErrorMessage(error)).toBe('template is required');
});

test('distinguishes an active project conflict from a duplicate name', () => {
  const error = {
    response: {
      status: 409,
      data: { message: 'running project cannot be edited' },
    },
  };

  expect(getProjectCreateErrorMessage(error)).toBe(
    '项目正在执行，无法修改；请先取消当前任务或新建项目'
  );
});

test('falls back to a useful generic message for network failures', () => {
  expect(getProjectCreateErrorMessage(new Error('Network Error'))).toBe(
    '项目创建失败，请稍后重试'
  );
});

import { describe, expect, it } from 'vitest';
import { findRoleProfileByName, resolveRoleProfile } from '../server/roleProfiles.js';

describe('role profile presets', () => {
  it('recognizes 豆包 as a general AI assistant', () => {
    expect(findRoleProfileByName('豆包')).toMatchObject({
      key: 'general_ai_assistant',
      label: '通用 AI 助手',
    });
  });

  it('keeps automatic recognition when no custom description is selected', () => {
    expect(resolveRoleProfile({ roleLabel: '豆包' })).toMatchObject({
      key: 'general_ai_assistant',
      source: 'preset',
    });
  });

  it('keeps a user-written custom description', () => {
    expect(resolveRoleProfile({
      roleLabel: '内部助手',
      roleProfileKey: 'custom',
      roleProfileDescription: '负责向管理层汇报项目进展、风险和资源诉求。',
    })).toMatchObject({
      label: '自定义角色说明',
      source: 'custom',
    });
  });
});

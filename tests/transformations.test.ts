import { describe, expect, it } from 'vitest';
import { applyDeterministicRules } from '../server/services/transformationEngine.js';

describe('deterministic transformations', () => {
  it('renames fields and creates constants', () => {
    const result = applyDeterministicRules(
      { full_name: 'John Smith' },
      [
        { id:'1', type:'rename_field', source_field:'full_name', target_field:'name' },
        { id:'2', type:'constant_value', target_field:'source', value:'just-in-time-connector' }
      ]
    );
    expect(result).toEqual({ name:'John Smith', source:'just-in-time-connector' });
  });
});

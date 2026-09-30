import { familyFor } from '../components/Text';

describe('familyFor', () => {
  it('picks the Open Runde file for a font weight', () => {
    expect(familyFor(undefined)).toBe('OpenRunde-Regular');
    expect(familyFor('400')).toBe('OpenRunde-Regular');
    expect(familyFor('500')).toBe('OpenRunde-Medium');
    expect(familyFor('600')).toBe('OpenRunde-Semibold');
    expect(familyFor('700')).toBe('OpenRunde-Bold');
    expect(familyFor('bold')).toBe('OpenRunde-Bold');
  });

  it('uses Bold for the heavier weights, since there is no heavier file', () => {
    expect(familyFor('800')).toBe('OpenRunde-Bold');
    expect(familyFor('900')).toBe('OpenRunde-Bold');
  });
});

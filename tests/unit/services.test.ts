import { SERVICES, getServiceById } from '@/config/services';

test('exports exactly 4 services', () => {
  expect(SERVICES).toHaveLength(4);
});

test('each service has required fields', () => {
  for (const s of SERVICES) {
    expect(s.id).toBeTruthy();
    expect(s.label).toBeTruthy();
    expect(s.url).toMatch(/^https:\/\//);
  }
});

test('getServiceById returns matching service', () => {
  const s = getServiceById('species-trust');
  expect(s?.url).toBe('https://species-trust.fly.dev/mcp');
});

test('getServiceById returns undefined for unknown id', () => {
  expect(getServiceById('unknown')).toBeUndefined();
});

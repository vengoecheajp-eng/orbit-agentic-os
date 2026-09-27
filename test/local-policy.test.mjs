import { request } from 'node:http';
import { createHmac } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startIsolatedOrbit } from './isolated-server.mjs';

describe('local HTTP authority policy', () => {
  let orbit;
  let authority;
  let token;
  const publicOrigin = 'https://portal.example.invalid';
  const signingMaterial = 'synthetic-signature-fixture';
  const authorizedPhone = '15555550100';
  beforeAll(async () => {
    orbit = await startIsolatedOrbit({ ORBIT_PUBLIC_URL: publicOrigin, TWILIO_AUTH_TOKEN: signingMaterial, ORBIT_AUTHORIZED_PHONE: authorizedPhone, ORBIT_DEV_PORT: '5174' });
    authority = new URL(orbit.base).host;
    writeFileSync(join(orbit.dataDirectory, 'projects.json'), JSON.stringify([{ id: 'fixture', name: 'Fixture project', summary: 'Synthetic project only', tasks: [] }]));
    writeFileSync(join(orbit.dataDirectory, 'runs', 'foo.json'), JSON.stringify({ id: 'foo', projectId: 'fixture', status: 'awaiting_review' }));
    const link = await (await fetch(`${orbit.base}/api/projects/fixture/share-link`, { method: 'POST' })).json();
    token = new URL(link.path, orbit.base).searchParams.get('token');
  });
  afterAll(async () => { await orbit?.stop(); });
  function send(path, { method = 'GET', headers = {}, body = '' } = {}) {
    return new Promise((resolve, reject) => {
      const req = request(new URL(path, orbit.base), { method, headers }, res => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', chunk => { text += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, text }));
      });
      req.on('error', reject);
      req.end(body);
    });
  }
  it.each(['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT'])('rejects hostile authorities for %s before serving data or changing state', async method => {
    for (const host of ['attacker.invalid:8787', 'localhost.attacker.invalid:8787', '127.0.0.1.attacker.invalid:8787', '127.0.0.1:1', '[::1]:1']) {
      const response = await send(method === 'PUT' ? '/api/profile' : '/api/projects', { method, headers: { Host: host, 'Content-Type': 'application/json' }, body: ['POST', 'PUT'].includes(method) ? JSON.stringify({ name: 'Must not save' }) : '' });
      expect(response.status, `${method} ${host}`).toBe(403);
      expect(response.text).not.toContain('Fixture project');
    }
    expect((await send('/api/profile')).text).not.toContain('Must not save');
  });
  it('rejects duplicate Host fields and ignores forged forwarded authorities', async () => {
    expect((await send('/api/projects', { headers: ['Host', authority, 'Host', 'attacker.invalid'] })).status).toBe(403);
    expect((await send('/api/projects', { headers: { Host: 'attacker.invalid', 'X-Forwarded-Host': authority, Forwarded: `host=${authority}` } })).status).toBe(403);
    expect((await send('/api/projects', { headers: { Host: authority, 'X-Forwarded-Host': 'attacker.invalid' } })).status).toBe(200);
  });
  it('accepts loopback authorities, the configured dev proxy, and originless CLI mutations', async () => {
    const port = new URL(orbit.base).port;
    for (const host of [`localhost:${port}`, `127.0.0.1:${port}`, `[::1]:${port}`, 'localhost:5174']) {
      expect((await send('/api/projects', { headers: { Host: host } })).status).toBe(200);
    }
    const headers = { Host: 'localhost:5174', Origin: 'http://localhost:5174', 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json' };
    expect((await send('/api/profile', { method: 'PUT', headers, body: JSON.stringify({ name: 'Dev fixture' }) })).status).toBe(200);
    expect((await send('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'CLI fixture' }) })).status).toBe(200);
  });
  it('rejects hostile Origins and originless cross-site browser requests', async () => {
    for (const method of ['GET', 'POST']) {
      for (const headers of [{ Origin: 'https://attacker.invalid' }, { 'Sec-Fetch-Site': 'cross-site' }]) {
        const response = await send('/api/projects', { method, headers });
        expect(response.status).toBe(403);
      }
    }
    expect((await send('/api/profile', { method: 'POST', headers: { 'Sec-Fetch-Site': 'same-site' } })).status).toBe(403);
  });
  it('rejects malformed run IDs instead of aliasing a sanitized filename', async () => {
    expect((await send('/api/runs/foo')).status).toBe(200);
    expect((await send('/api/runs/foo!!')).status).toBe(404);
    expect((await send('/api/runs/foo%0A')).status).toBe(404);
  });
  it('limits public portal access to valid tokens and exact portal routes', async () => {
    const headers = { Host: 'portal.example.invalid', Origin: publicOrigin };
    const query = `?token=${encodeURIComponent(token)}`;
    expect((await send(`/api/share/fixture${query}`, { headers })).status).toBe(200);
    const page = await send(`/share/fixture${query}`, { headers });
    expect(page.status).toBe(200);
    const asset = page.text.match(/src="(\/assets\/[^" ]+\.js)"/)?.[1];
    expect(asset).toBeTruthy();
    expect((await send(asset, { headers })).status).toBe(200);
    expect((await send(`/api/share/fixture/infra${query}`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ invited: false, notes: 'Synthetic note' }) })).status).toBe(200);
    for (const path of ['/api/projects', '/api/runs', '/api/directories', '/api/projects/fixture/memory', '/api/share/fixture/extra']) {
      const response = await send(`${path}${query}`, { headers });
      expect(response.status).toBe(403);
      expect(response.text).not.toContain('Fixture project');
    }
    expect((await send('/api/share/fixture?token=invalid', { headers })).status).toBe(403);
    expect((await send(`/api/share/fixture${query}`, { headers: { Host: 'other.invalid' } })).status).toBe(403);
    expect((await send(`/api/share/fixture/infra${query}`, { method: 'POST', headers: { ...headers, Origin: 'https://attacker.invalid' } })).status).toBe(403);
  });
  it('allows only correctly authenticated configured webhook requests', async () => {
    const path = '/api/webhooks/twilio-whatsapp';
    // Empty Body intentionally stops at input validation, before any agent/provider call.
    const fields = { Body: '', From: `whatsapp:+${authorizedPhone}` };
    const signature = createHmac('sha1', signingMaterial).update(Object.keys(fields).sort().reduce((payload, key) => payload + key + fields[key], publicOrigin + path)).digest('base64');
    const headers = { Host: 'portal.example.invalid', 'Content-Type': 'application/x-www-form-urlencoded', 'X-Twilio-Signature': signature };
    const body = new URLSearchParams(fields).toString();
    expect((await send(path, { method: 'POST', headers, body })).status).toBe(400);
    expect((await send(path, { method: 'POST', headers: { ...headers, 'X-Twilio-Signature': 'invalid' }, body })).status).toBe(403);
    expect((await send('/api/projects', { method: 'POST', headers, body })).status).toBe(403);
  });
});

import { apiJson } from '../lib/httpClient';
import type { WallProjectState } from '../types';

export interface ProjectSummary {
  id: string;
  name: string;
  updated_at: string;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export function listProjects(): Promise<ProjectSummary[]> {
  return apiJson('/projects');
}

export function createProject(name: string): Promise<ProjectSummary> {
  return apiJson('/projects', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ name }) });
}

export function getProject(id: string): Promise<WallProjectState> {
  return apiJson(`/projects/${id}`);
}

export function putProject(id: string, state: WallProjectState): Promise<WallProjectState> {
  return apiJson(`/projects/${id}`, { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify(state) });
}

export function renameProject(id: string, name: string): Promise<ProjectSummary> {
  return apiJson(`/projects/${id}`, { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ name }) });
}

export function deleteProject(id: string): Promise<void> {
  return apiJson(`/projects/${id}`, { method: 'DELETE' });
}

export function exportProject(id: string): Promise<WallProjectState> {
  return apiJson(`/projects/${id}/export`, { method: 'POST' });
}

export function importProjects(body: unknown): Promise<{ project_ids: string[] }> {
  return apiJson('/projects/import', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) });
}

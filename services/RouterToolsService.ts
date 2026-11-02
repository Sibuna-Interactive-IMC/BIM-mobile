import { apiBaseUrl } from '@/constants/API';
import { apiFetch } from '@/helpers/api';
import type { RunRouterActionPayload } from '@/types';

function buildHeaders(token?: string) {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
	};
	if (token) headers.Authorization = `Bearer ${token}`;
	return headers;
}

/**
 * `POST /admin/router-console/diagnose` — connectivity, identity, version and
 * uptime for one router (or all of them). Small and bounded, so it answers in
 * the request instead of queueing a task.
 */
export async function diagnoseRouter(
	{ routerId, token }: { routerId: string; token?: string }
) {
	return apiFetch(`${apiBaseUrl || ''}/admin/router-console/diagnose`, {
		method: 'POST',
		headers: buildHeaders(token),
		body: JSON.stringify({ scope: 'one', router_id: routerId }),
	});
}

/**
 * `POST /admin/router-console/run` — queue a router action.
 *
 * Destructive actions need `confirmed` to equal the router's name; the server
 * refuses the queue otherwise.
 */
export async function runRouterAction(
	payload: RunRouterActionPayload,
	token?: string
) {
	return apiFetch(`${apiBaseUrl || ''}/admin/router-console/run`, {
		method: 'POST',
		headers: buildHeaders(token),
		body: JSON.stringify(payload),
	});
}

/**
 * `POST /admin/router-console/preview` — what an action would do, before
 * anything is queued. Returns the literal script, or the command invocation for
 * actions that carry router text.
 */
export async function previewRouterAction(
	{
		action,
		routerId,
		commandText,
		token,
	}: {
		action: string;
		routerId?: string;
		commandText?: string;
		token?: string;
	}
) {
	return apiFetch(`${apiBaseUrl || ''}/admin/router-console/preview`, {
		method: 'POST',
		headers: buildHeaders(token),
		body: JSON.stringify({
			action,
			...(routerId ? { router_id: routerId } : {}),
			...(commandText ? { command_text: commandText } : {}),
		}),
	});
}

/** `GET /admin/router-console/{task}` — one task's command and the router's reply. */
export async function fetchRouterTaskLog(taskId: number | string, token?: string) {
	return apiFetch(
		`${apiBaseUrl || ''}/admin/router-console/tasks/${encodeURIComponent(taskId)}`,
		{ method: 'GET', headers: buildHeaders(token) }
	);
}

export default {
	diagnoseRouter,
	runRouterAction,
	previewRouterAction,
	fetchRouterTaskLog,
};

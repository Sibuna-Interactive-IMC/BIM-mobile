import { apiFetch, registerAuthCallbacks, resetInterceptorState } from '@/helpers/api';

// Mock helpers to avoid expo-constants issues
jest.mock('@/helpers', () => ({
    ShowAlert: jest.fn(),
}));

// Mock API constant
jest.mock('@/constants/API', () => ({ apiBaseUrl: 'https://api.example' }));

describe('apiFetch Interceptor', () => {
    let mockFetch: jest.Mock;
    let onRefreshToken: jest.Mock;
    let onLogout: jest.Mock;

    beforeEach(() => {
        mockFetch = jest.fn();
        global.fetch = mockFetch;
        onRefreshToken = jest.fn();
        onLogout = jest.fn();
        registerAuthCallbacks({ onRefreshToken, onLogout });
        resetInterceptorState();
    });

    test('retries request on 401 if refresh succeeds', async () => {
        // First call returns 401
        mockFetch.mockResolvedValueOnce({
            status: 401,
            ok: false,
            json: async () => ({}),
            headers: new Map(),
        });
        // Second call (retry) returns 200
        mockFetch.mockResolvedValueOnce({
            status: 200,
            ok: true,
            json: async () => ({ success: true }),
            headers: new Map(),
        });

        onRefreshToken.mockResolvedValue('new-token');

        const res = await apiFetch('https://api.example/test');

        expect(onRefreshToken).toHaveBeenCalled();
        expect(mockFetch).toHaveBeenCalledTimes(2);
        
        // Check retry headers
        const retryCall = mockFetch.mock.calls[1];
        expect(retryCall[1].headers.Authorization).toBe('Bearer new-token');
        expect(res.status).toBe(200);
    });

    test('logs out on 401 if refresh fails', async () => {
        mockFetch.mockResolvedValueOnce({
            status: 401,
            ok: false,
            headers: new Map(),
        });

        onRefreshToken.mockResolvedValue(null);

        const res = await apiFetch('https://api.example/test');

        expect(onRefreshToken).toHaveBeenCalled();
        expect(onLogout).toHaveBeenCalled();
        expect(mockFetch).toHaveBeenCalledTimes(1); // No retry
        expect(res.status).toBe(401);
    });

    test('concurrent 401 responses wait for the in-flight refresh', async () => {
        let resolveRefresh: (token: string) => void = () => {};
        onRefreshToken.mockImplementation(
            () => new Promise<string>((resolve) => {
                resolveRefresh = resolve;
            })
        );
        mockFetch
            .mockResolvedValueOnce({ status: 401, ok: false, headers: new Map() })
            .mockResolvedValueOnce({ status: 401, ok: false, headers: new Map() })
            .mockResolvedValueOnce({ status: 200, ok: true, headers: new Map() })
            .mockResolvedValueOnce({ status: 200, ok: true, headers: new Map() });

        const firstRequest = apiFetch('https://api.example/first');
        const secondRequest = apiFetch('https://api.example/second');

        await Promise.resolve();
        await Promise.resolve();
        resolveRefresh('new-token');

        const responses = await Promise.all([firstRequest, secondRequest]);

        expect(onRefreshToken).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledTimes(4);
        expect(responses.map((response) => response.status)).toEqual([200, 200]);
    });
    
    test('skips interceptor if X-Skip-Interceptor is present', async () => {
        mockFetch.mockResolvedValueOnce({
            status: 401,
            ok: false,
            headers: new Map(),
        });

        await apiFetch('https://api.example/test', {
            headers: { 'X-Skip-Interceptor': 'true' }
        });

        expect(onRefreshToken).not.toHaveBeenCalled();
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });
});

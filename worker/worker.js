// Cloudflare Worker for Medication Tracker API

// CORS headers helper
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-ID',
};

// Helper function to handle CORS preflight
function handleCORS(request) {
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: corsHeaders,
        });
    }
    return null;
}

// Get user ID from request headers
function getUserId(request) {
    return request.headers.get('X-User-ID') || 'default-user';
}

// Format response with CORS headers
function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
        },
    });
}

// Error response
function errorResponse(message, status = 400) {
    return jsonResponse({ error: message }, status);
}

// Main request handler
export default {
    async fetch(request, env) {
        // Handle CORS preflight
        const corsResponse = handleCORS(request);
        if (corsResponse) return corsResponse;

        const url = new URL(request.url);
        const path = url.pathname;
        const userId = getUserId(request);

        try {
            // GET /api/data - Retrieve all medication data
            if (path === '/api/data' && request.method === 'GET') {
                const medicationsKey = `user:${userId}:medications`;
                
                // Get medications
                const medicationsData = await env.MEDICATION_KV.get(medicationsKey);
                const medications = medicationsData ? JSON.parse(medicationsData) : [];

                // Get all entry keys for this user
                const entries = {};
                const listResult = await env.MEDICATION_KV.list({ prefix: `user:${userId}:entries:` });
                
                if (listResult.keys) {
                    for (const key of listResult.keys) {
                        const date = key.name.replace(`user:${userId}:entries:`, '');
                        const entryData = await env.MEDICATION_KV.get(key.name);
                        if (entryData) {
                            entries[date] = JSON.parse(entryData);
                        }
                    }
                }

                return jsonResponse({
                    medications,
                    entries,
                });
            }

            // POST /api/medications - Save medication list
            if (path === '/api/medications' && request.method === 'POST') {
                const body = await request.json();
                const { medications } = body;

                if (!Array.isArray(medications)) {
                    return errorResponse('medications must be an array');
                }

                const medicationsKey = `user:${userId}:medications`;
                await env.MEDICATION_KV.put(medicationsKey, JSON.stringify(medications));

                return jsonResponse({ success: true, medications });
            }

            // POST /api/entry - Save medication entry
            if (path === '/api/entry' && request.method === 'POST') {
                const body = await request.json();
                const { date, medicationId, taken, timestamp, doseIndex } = body;

                if (!date || medicationId === undefined || taken === undefined) {
                    return errorResponse('date, medicationId, and taken are required');
                }

                const entryKey = `user:${userId}:entries:${date}`;
                const existingData = await env.MEDICATION_KV.get(entryKey);
                const entries = existingData ? JSON.parse(existingData) : {};

                if (!entries[medicationId]) {
                    entries[medicationId] = { doses: [] };
                }

                if (!entries[medicationId].doses) {
                    entries[medicationId].doses = [];
                }

                const doseIdx = doseIndex || 0;
                // Ensure doses array is large enough
                while (entries[medicationId].doses.length <= doseIdx) {
                    entries[medicationId].doses.push(null);
                }

                entries[medicationId].doses[doseIdx] = {
                    taken: Boolean(taken),
                    timestamp: timestamp || new Date().toISOString(),
                };

                await env.MEDICATION_KV.put(entryKey, JSON.stringify(entries));

                return jsonResponse({ success: true, entry: entries[medicationId] });
            }

            // PUT /api/entry - Update entry timestamp
            if (path === '/api/entry' && request.method === 'PUT') {
                const body = await request.json();
                const { date, medicationId, timestamp, doseIndex } = body;

                if (!date || !medicationId || !timestamp) {
                    return errorResponse('date, medicationId, and timestamp are required');
                }

                const entryKey = `user:${userId}:entries:${date}`;
                const existingData = await env.MEDICATION_KV.get(entryKey);
                
                if (!existingData) {
                    return errorResponse('Entry not found', 404);
                }

                const entries = JSON.parse(existingData);
                if (!entries[medicationId] || !entries[medicationId].doses) {
                    return errorResponse('Medication entry not found', 404);
                }

                const doseIdx = doseIndex || 0;
                if (!entries[medicationId].doses[doseIdx]) {
                    return errorResponse('Dose entry not found', 404);
                }

                entries[medicationId].doses[doseIdx].timestamp = timestamp;
                await env.MEDICATION_KV.put(entryKey, JSON.stringify(entries));

                return jsonResponse({ success: true, entry: entries[medicationId] });
            }

            // DELETE /api/medication/:id - Delete medication
            if (path.startsWith('/api/medication/') && request.method === 'DELETE') {
                const medicationId = path.split('/api/medication/')[1];

                if (!medicationId) {
                    return errorResponse('medicationId is required');
                }

                // Get medications
                const medicationsKey = `user:${userId}:medications`;
                const medicationsData = await env.MEDICATION_KV.get(medicationsKey);
                const medications = medicationsData ? JSON.parse(medicationsData) : [];

                // Remove medication
                const filtered = medications.filter(m => m.id !== medicationId);
                await env.MEDICATION_KV.put(medicationsKey, JSON.stringify(filtered));

                // Optionally clean up entries (or leave them for historical data)
                // For now, we'll leave entries to preserve history

                return jsonResponse({ success: true });
            }

            // DELETE /api/entry - Delete medication entry (clear status)
            if (path === '/api/entry' && request.method === 'DELETE') {
                const body = await request.json();
                const { date, medicationId, doseIndex } = body;

                if (!date || !medicationId || doseIndex === undefined) {
                    return errorResponse('date, medicationId, and doseIndex are required');
                }

                const entryKey = `user:${userId}:entries:${date}`;
                const existingData = await env.MEDICATION_KV.get(entryKey);
                
                if (!existingData) {
                    return jsonResponse({ success: true }); // Already deleted
                }

                const entries = JSON.parse(existingData);
                if (!entries[medicationId] || !entries[medicationId].doses) {
                    return jsonResponse({ success: true }); // Already deleted
                }

                // Remove the specific dose
                entries[medicationId].doses[doseIndex] = null;

                // Clean up if all doses are null
                const hasAnyDoses = entries[medicationId].doses.some(d => d !== null);
                if (!hasAnyDoses) {
                    delete entries[medicationId];
                }

                // If no medications left for this day, delete the entry
                if (Object.keys(entries).length === 0) {
                    await env.MEDICATION_KV.delete(entryKey);
                } else {
                    await env.MEDICATION_KV.put(entryKey, JSON.stringify(entries));
                }

                return jsonResponse({ success: true });
            }

            // 404 for unknown routes
            return errorResponse('Not found', 404);
        } catch (error) {
            console.error('Worker error:', error);
            return errorResponse('Internal server error', 500);
        }
    },
};

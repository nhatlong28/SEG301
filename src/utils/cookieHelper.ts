
/**
 * Utility to parse cookies in different formats
 */

export interface RawCookie {
    name: string;
    value: string;
    domain: string;
    path: string;
    secure: boolean;
    expires?: number;
    httpOnly?: boolean;
}

/**
 * Parses Netscape/Curl/wget format cookie file content
 * Format: domain  flag  path  secure  expiration  name  value
 */
export function parseNetscapeCookies(text: string): RawCookie[] {
    const cookies: RawCookie[] = [];
    if (!text) return cookies;

    const lines = text.split(/\r?\n/);

    for (const line of lines) {
        // Skip comments and empty lines
        if (line.startsWith('#') || !line.trim()) continue;

        const parts = line.split(/\s+/);
        if (parts.length >= 7) {
            // Netscape format: domain, isDomain(bool), path, secure(bool), expires, name, value
            const [domain, , path, secure, expiration, name, ...valueParts] = parts;
            const value = valueParts.join(' '); // Value might contain spaces in some formats

            cookies.push({
                domain: domain.trim(),
                path: path.trim(),
                secure: secure.trim().toUpperCase() === 'TRUE',
                expires: parseInt(expiration.trim()) || undefined,
                name: name.trim(),
                value: value.trim(),
            });
        }
    }

    return cookies;
}

/**
 * Intelligent cookie parser that handles:
 * 1. JSON (array of objects)
 * 2. Netscape format
 * 3. raw cookie strings (name=value; name2=value2)
 */
export function intelligentCookieParse(input: string): RawCookie[] {
    const trimmed = input.trim();
    if (!trimmed) return [];

    // Case 1: JSON
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) return parsed as RawCookie[];
        } catch (e) {
            // Fallback to other methods
        }
    }

    // Case 2: Netscape format (contains tabs and usually starts with #)
    if (trimmed.includes('\t') && (trimmed.includes('TRUE') || trimmed.includes('FALSE'))) {
        return parseNetscapeCookies(trimmed);
    }

    // Case 3: Raw cookie string (name=value; name2=value2)
    // This is harder to map to Puppeteer because domain/path are missing
    // We default them to the target site
    if (trimmed.includes('=') && (trimmed.includes(';') || trimmed.split('=').length > 2)) {
        const cookies: RawCookie[] = [];
        const pairs = trimmed.split(';');
        for (const pair of pairs) {
            const [name, value] = pair.split('=');
            if (name && value) {
                cookies.push({
                    name: name.trim(),
                    value: value.trim(),
                    domain: '.lazada.vn', // Default for Lazada
                    path: '/',
                    secure: true
                });
            }
        }
        return cookies;
    }

    return [];
}

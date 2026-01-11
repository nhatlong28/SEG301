import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const { pathname, search } = request.nextUrl;

    // Unified dashboard is at root, but admin subpages are allowed
    // No redirection needed here for now

    // Redirect /search to homepage (preserve query params)
    if (pathname === '/search') {
        return NextResponse.redirect(new URL(`/${search}`, request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/admin/:path*', '/search'],
};

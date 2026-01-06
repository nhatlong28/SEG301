import { NextRequest, NextResponse } from 'next/server';
import { getPriceAlertService } from '@/lib/priceAlerts';

/**
 * GET: Get user's price alerts
 */
export async function GET(request: NextRequest) {
    try {
        const userId = request.headers.get('x-user-id');

        if (!userId) {
            return NextResponse.json({ error: 'User ID required' }, { status: 401 });
        }

        const service = getPriceAlertService();
        const alerts = await service.getUserAlerts(userId);

        return NextResponse.json({ alerts });
    } catch (error) {
        console.error('Get alerts error:', error);
        return NextResponse.json({ error: 'Failed to get alerts' }, { status: 500 });
    }
}

/**
 * POST: Create a new price alert
 */
export async function POST(request: NextRequest) {
    try {
        const userId = request.headers.get('x-user-id');

        if (!userId) {
            return NextResponse.json({ error: 'User ID required' }, { status: 401 });
        }

        const body = await request.json();
        const { canonicalId, targetPrice, percentThreshold } = body;

        if (!canonicalId) {
            return NextResponse.json({ error: 'Product ID required' }, { status: 400 });
        }

        const service = getPriceAlertService();
        const alert = await service.createAlert(userId, canonicalId, {
            targetPrice,
            percentThreshold,
        });

        if (!alert) {
            return NextResponse.json({ error: 'Failed to create alert' }, { status: 500 });
        }

        return NextResponse.json({ alert, message: 'Alert created successfully' });
    } catch (error) {
        console.error('Create alert error:', error);
        return NextResponse.json({ error: 'Failed to create alert' }, { status: 500 });
    }
}

/**
 * DELETE: Delete a price alert
 */
export async function DELETE(request: NextRequest) {
    try {
        const userId = request.headers.get('x-user-id');

        if (!userId) {
            return NextResponse.json({ error: 'User ID required' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const alertId = searchParams.get('id');

        if (!alertId) {
            return NextResponse.json({ error: 'Alert ID required' }, { status: 400 });
        }

        const service = getPriceAlertService();
        const success = await service.deleteAlert(parseInt(alertId), userId);

        if (!success) {
            return NextResponse.json({ error: 'Failed to delete alert' }, { status: 500 });
        }

        return NextResponse.json({ message: 'Alert deleted successfully' });
    } catch (error) {
        console.error('Delete alert error:', error);
        return NextResponse.json({ error: 'Failed to delete alert' }, { status: 500 });
    }
}

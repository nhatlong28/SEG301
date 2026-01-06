import { CrawlerControl } from '@/components/admin/crawler-control';
import { CrawlHistory } from '@/components/admin/crawl-history';

export default function CrawlerPage() {
    return (
        <div className="flex-1 space-y-8 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Crawler Management</h2>
            </div>

            <div className="space-y-4">
                <CrawlerControl />
                <CrawlHistory />
            </div>
        </div>
    );
}

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { FileText, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LogFile {
    source: string;
    status: string;
    products: number;
    errors: number;
    startTime: string;
    endTime: string;
    savedAt: string;
    duration?: number;
}

export function CrawlHistory() {
    const [logs, setLogs] = useState<LogFile[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/crawl/history');
            const data = await res.json();
            if (data.logs) {
                setLogs(data.logs);
            }
        } catch (error) {
            console.error('Failed to fetch history', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Crawl History</CardTitle>
                <Button variant="ghost" size="sm" onClick={fetchHistory} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Source</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Products</TableHead>
                            <TableHead>Errors</TableHead>
                            <TableHead>Duration</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {logs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center text-muted-foreground">
                                    No history found
                                </TableCell>
                            </TableRow>
                        ) : (
                            logs.map((log, i) => (
                                <TableRow key={i}>
                                    <TableCell className="whitespace-nowrap">
                                        {format(new Date(log.savedAt), 'dd/MM/yyyy HH:mm')}
                                    </TableCell>
                                    <TableCell className="capitalize font-medium">
                                        <Badge variant="outline" className="text-slate-200 border-slate-700 bg-slate-800/50">{log.source}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={log.status === 'completed' ? 'secondary' : 'destructive'}>
                                            {log.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{log.products}</TableCell>
                                    <TableCell className={log.errors > 0 ? "text-red-500" : ""}>
                                        {log.errors}
                                    </TableCell>
                                    <TableCell>
                                        {log.duration ? `${Math.round(log.duration / 1000)}s` : '-'}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

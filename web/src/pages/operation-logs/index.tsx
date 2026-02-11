import React, { useEffect, useState } from 'react';
import { Table, Tag, Space, Card, Select, Button, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { PageHeader } from '../../components';
import { logsApi } from '../../api';
import dayjs from 'dayjs';

const { Text } = Typography;

interface LogItem {
    id: number;
    action: string;
    apiKeyName: string;
    email: string;
    requestIp: string;
    responseCode: number;
    responseTimeMs: number;
    createdAt: string;
}

const actionLabels: Record<string, string> = {
    'mail_new': 'Get Latest Email',
    'mail_all': 'Get All Emails',
    'process-mailbox': 'Clear Mailbox',
    'pool_stats': 'Pool Statistics',
    'pool_reset': 'Reset Pool',
    'emails': 'Get Email List',
};

const OperationLogsPage: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState<LogItem[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [actionFilter, setActionFilter] = useState<string | undefined>();

    useEffect(() => {
        fetchLogs();
    }, [page, pageSize, actionFilter]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const res: any = await logsApi.getList({ page, pageSize, action: actionFilter });
            if (res.code === 200) {
                setLogs(res.data.list);
                setTotal(res.data.total);
            }
        } catch (err) {
            console.error('Failed to fetch logs:', err);
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        {
            title: 'Time',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 170,
            render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm:ss'),
        },
        {
            title: 'API Key',
            dataIndex: 'apiKeyName',
            key: 'apiKeyName',
            width: 150,
            render: (name: string) => name === '-' ? <Text type="secondary">-</Text> : <Tag color="blue">{name}</Tag>,
        },
        {
            title: 'Action',
            dataIndex: 'action',
            key: 'action',
            width: 140,
            render: (action: string) => {
                const label = actionLabels[action] || action;
                const colors: Record<string, string> = {
                    'mail_new': 'processing',
                    'mail_all': 'processing',
                    'process-mailbox': 'error',
                    'pool_stats': 'default',
                    'pool_reset': 'warning',
                    'emails': 'default',
                };
                return <Tag color={colors[action] || 'default'}>{label}</Tag>;
            },
        },
        {
            title: 'Email',
            dataIndex: 'email',
            key: 'email',
            ellipsis: true,
            render: (email: string) => email === '-' ? <Text type="secondary">-</Text> : email,
        },
        {
            title: 'Status',
            dataIndex: 'responseCode',
            key: 'responseCode',
            width: 80,
            align: 'center' as const,
            render: (code: number) => (
                <Tag color={code === 200 ? 'success' : 'error'}>{code}</Tag>
            ),
        },
        {
            title: 'Duration',
            dataIndex: 'responseTimeMs',
            key: 'responseTimeMs',
            width: 100,
            align: 'right' as const,
            render: (ms: number) => `${ms} ms`,
        },
        {
            title: 'IP Address',
            dataIndex: 'requestIp',
            key: 'requestIp',
            width: 140,
        },
    ];

    const actionOptions = [
        { value: 'mail_new', label: 'Get Latest Email' },
        { value: 'mail_all', label: 'Get All Emails' },
        { value: 'process-mailbox', label: 'Clear Mailbox' },
        { value: 'pool_stats', label: 'Pool Statistics' },
        { value: 'pool_reset', label: 'Reset Pool' },
        { value: 'emails', label: 'Get Email List' },
    ];

    return (
        <div>
            <PageHeader
                title="API Call Logs"
                subtitle="Records all external calls via API Key"
                extra={
                    <Button icon={<ReloadOutlined />} onClick={fetchLogs}>
                        Refresh
                    </Button>
                }
            />

            <Card bordered={false}>
                <Space style={{ marginBottom: 16 }}>
                    <Select
                        placeholder="Filter by action"
                        style={{ width: 160 }}
                        allowClear
                        options={actionOptions}
                        onChange={(val) => setActionFilter(val)}
                    />
                    <Text type="secondary">
                        Note: Only API Key calls are logged
                    </Text>
                </Space>

                <Table
                    dataSource={logs}
                    columns={columns}
                    rowKey="id"
                    loading={loading}
                    pagination={{
                        current: page,
                        pageSize,
                        total,
                        showSizeChanger: true,
                        showQuickJumper: true,
                        showTotal: (t) => `Total ${t} items`,
                        onChange: (p, ps) => {
                            setPage(p);
                            setPageSize(ps);
                        },
                    }}
                    locale={{ emptyText: 'No API call logs' }}
                />
            </Card>
        </div>
    );
};

export default OperationLogsPage;

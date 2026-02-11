import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Table, Tag, Space, Typography, Spin, Progress } from 'antd';
import {
    MailOutlined,
    KeyOutlined,
    CheckCircleOutlined,
    WarningOutlined,
    ThunderboltOutlined,
    ApiOutlined,
} from '@ant-design/icons';
import { Line, Pie } from '@ant-design/charts';
import { StatCard, PageHeader } from '../../components';
import { dashboardApi, emailApi, apiKeyApi } from '../../api';
import dayjs from 'dayjs';

const { Text } = Typography;

interface Stats {
    apiKeys: {
        total: number;
        active: number;
        totalUsage: number;
        todayActive: number;
    };
    emails: {
        total: number;
        active: number;
        error: number;
    };
}

const DashboardPage: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<Stats | null>(null);
    const [recentEmails, setRecentEmails] = useState<any[]>([]);
    const [recentApiKeys, setRecentApiKeys] = useState<any[]>([]);
    const [apiTrend, setApiTrend] = useState<any[]>([]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [statsRes, emailsRes, apiKeysRes, trendRes]: any[] = await Promise.all([
                dashboardApi.getStats(),
                emailApi.getList({ page: 1, pageSize: 5 }),
                apiKeyApi.getList({ page: 1, pageSize: 5 }),
                dashboardApi.getApiTrend(7),
            ]);

            if (statsRes.code === 200) {
                setStats(statsRes.data);
            }
            if (emailsRes.code === 200) {
                setRecentEmails(emailsRes.data.list);
            }
            if (apiKeysRes.code === 200) {
                setRecentApiKeys(apiKeysRes.data.list);
            }
            if (trendRes.code === 200) {
                setApiTrend(trendRes.data);
            }
        } catch (err) {
            console.error('Failed to fetch data:', err);
        } finally {
            setLoading(false);
        }
    };

    const emailColumns = [
        {
            title: 'Email',
            dataIndex: 'email',
            key: 'email',
            ellipsis: true,
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            width: 80,
            render: (status: string) => {
                const config: Record<string, { color: string; text: string }> = {
                    ACTIVE: { color: 'success', text: 'Active' },
                    ERROR: { color: 'error', text: 'Error' },
                    DISABLED: { color: 'default', text: 'Disabled' },
                };
                return <Tag color={config[status]?.color}>{config[status]?.text}</Tag>;
            },
        },
        {
            title: 'Added',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 120,
            render: (val: string) => dayjs(val).format('MM-DD HH:mm'),
        },
    ];

    const apiKeyColumns = [
        {
            title: 'Name',
            dataIndex: 'name',
            key: 'name',
            ellipsis: true,
        },
        {
            title: 'Usage Count',
            dataIndex: 'usageCount',
            key: 'usageCount',
            width: 100,
            render: (val: number) => <Text strong>{(val || 0).toLocaleString()}</Text>,
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            width: 80,
            render: (status: string) => (
                <Tag color={status === 'ACTIVE' ? 'success' : 'default'}>
                    {status === 'ACTIVE' ? 'Active' : 'Disabled'}
                </Tag>
            ),
        },
    ];

    // 图表配置
    const lineConfig = {
        data: apiTrend,
        xField: 'date',
        yField: 'count',
        smooth: true,
        height: 280,
        point: { size: 4, shape: 'circle' },
        color: '#1890ff',
        areaStyle: {
            fill: 'l(270) 0:#ffffff 1:#1890ff20',
        },
        xAxis: {
            label: {
                formatter: (v: string) => dayjs(v).format('MM-DD'),
            },
        },
    };

    const pieData = stats ? [
        { type: 'Active', value: stats.emails.active },
        { type: 'Error', value: stats.emails.error },
        { type: 'Disabled', value: Math.max(0, stats.emails.total - stats.emails.active - stats.emails.error) },
    ].filter(d => d.value > 0) : [];

    const pieConfig = {
        data: pieData,
        angleField: 'value',
        colorField: 'type',
        height: 280,
        radius: 0.8,
        innerRadius: 0.6,
        color: ['#52c41a', '#ff4d4f', '#d9d9d9'],
        label: {
            type: 'inner',
            offset: '-50%',
            content: '{value}',
            style: { textAlign: 'center', fontSize: 14 },
        },
        statistic: {
            title: { content: 'Emails' },
            content: { content: stats?.emails.total?.toString() || '0' },
        },
    };

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: 100 }}>
                <Spin size="large" />
            </div>
        );
    }

    const totalEmails = stats?.emails.total || 0;
    const activeEmails = stats?.emails.active || 0;
    const emailHealthRate = totalEmails > 0 ? Math.round((activeEmails / totalEmails) * 100) : 0;

    return (
        <div>
            <PageHeader title="Dashboard" subtitle="Real-time system monitoring" />

            {/* Statistics Cards */}
            <Row gutter={[16, 16]}>
                <Col xs={12} sm={12} md={6}>
                    <StatCard
                        title="Total Emails"
                        value={stats?.emails.total || 0}
                        icon={<MailOutlined />}
                        iconBgColor="#1890ff"
                    />
                </Col>
                <Col xs={12} sm={12} md={6}>
                    <StatCard
                        title="Active Emails"
                        value={stats?.emails.active || 0}
                        icon={<CheckCircleOutlined />}
                        iconBgColor="#52c41a"
                        suffix={`/ ${stats?.emails.total || 0}`}
                    />
                </Col>
                <Col xs={12} sm={12} md={6}>
                    <StatCard
                        title="Total API Calls"
                        value={stats?.apiKeys.totalUsage || 0}
                        icon={<ApiOutlined />}
                        iconBgColor="#722ed1"
                    />
                </Col>
                <Col xs={12} sm={12} md={6}>
                    <StatCard
                        title="Active API Keys"
                        value={stats?.apiKeys.active || 0}
                        icon={<KeyOutlined />}
                        iconBgColor="#fa8c16"
                        suffix={`/ ${stats?.apiKeys.total || 0}`}
                    />
                </Col>
            </Row>

            {/* Charts Area */}
            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                <Col xs={24} md={16}>
                    <Card title="API Call Trend (Last 7 Days)" bordered={false}>
                        <Line {...lineConfig} />
                    </Card>
                </Col>
                <Col xs={24} md={8}>
                    <Card title="Email Status Distribution" bordered={false}>
                        {pieData.length > 0 ? (
                            <Pie {...pieConfig} />
                        ) : (
                            <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Text type="secondary">No data</Text>
                            </div>
                        )}
                    </Card>
                </Col>
            </Row>

            {/* Lists Area */}
            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                <Col xs={24} md={12}>
                    <Card
                        title="Recently Added Emails"
                        bordered={false}
                        bodyStyle={{ padding: 0 }}
                        extra={<a href="/emails">View All</a>}
                    >
                        <Table
                            dataSource={recentEmails}
                            columns={emailColumns}
                            rowKey="id"
                            pagination={false}
                            size="small"
                            locale={{ emptyText: 'No data' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} md={12}>
                    <Card
                        title="API Key Usage Ranking"
                        bordered={false}
                        bodyStyle={{ padding: 0 }}
                        extra={<a href="/api-keys">View All</a>}
                    >
                        <Table
                            dataSource={recentApiKeys}
                            columns={apiKeyColumns}
                            rowKey="id"
                            pagination={false}
                            size="small"
                            locale={{ emptyText: 'No data' }}
                        />
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default DashboardPage;

import React, { useEffect, useState } from 'react';
import {
    Table,
    Button,
    Space,
    Modal,
    Form,
    Input,
    Select,
    message,
    Popconfirm,
    Tag,
    Typography,
    Card,
    Tooltip,
    InputNumber,
    Progress,
    Statistic,
    Row,
    Col,
    Badge,
    Divider,
    DatePicker,
    Checkbox,
    Spin,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    ReloadOutlined,
    DatabaseOutlined,
    ThunderboltOutlined,
} from '@ant-design/icons';
import { apiKeyApi } from '../../api';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;

interface ApiKey {
    id: number;
    name: string;
    keyPrefix: string;
    rateLimit: number;
    status: 'ACTIVE' | 'DISABLED';
    expiresAt: string | null;
    lastUsedAt: string | null;
    usageCount: number;
    createdAt: string;
    createdByName: string;
}

interface PoolStats {
    total: number;
    used: number;
    remaining: number;
}

const ApiKeysPage: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<ApiKey[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [newKeyModalVisible, setNewKeyModalVisible] = useState(false);
    const [newKey, setNewKey] = useState('');
    const [poolModalVisible, setPoolModalVisible] = useState(false);
    const [poolStats, setPoolStats] = useState<PoolStats | null>(null);
    const [poolLoading, setPoolLoading] = useState(false);
    const [currentApiKey, setCurrentApiKey] = useState<ApiKey | null>(null);
    const [emailList, setEmailList] = useState<{ id: number; email: string; used: boolean }[]>([]);
    const [selectedEmails, setSelectedEmails] = useState<number[]>([]);
    const [emailModalVisible, setEmailModalVisible] = useState(false);
    const [emailLoading, setEmailLoading] = useState(false);
    const [savingEmails, setSavingEmails] = useState(false);
    const [form] = Form.useForm();

    useEffect(() => {
        fetchData();
    }, [page, pageSize]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res: any = await apiKeyApi.getList({ page, pageSize });
            if (res.code === 200) {
                setData(res.data.list);
                setTotal(res.data.total);
            }
        } catch (err) {
            message.error('Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = () => {
        setEditingId(null);
        form.resetFields();
        setModalVisible(true);
    };

    const handleEdit = (record: ApiKey) => {
        setEditingId(record.id);
        form.setFieldsValue({
            name: record.name,
            rateLimit: record.rateLimit,
            status: record.status,
            expiresAt: record.expiresAt ? dayjs(record.expiresAt) : null,
        });
        setModalVisible(true);
    };

    const handleDelete = async (id: number) => {
        try {
            const res: any = await apiKeyApi.delete(id);
            if (res.code === 200) {
                message.success('Deleted successfully');
                fetchData();
            } else {
                message.error(res.message);
            }
        } catch (err: any) {
            message.error(err.message || 'Delete failed');
        }
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            const submitData = {
                ...values,
                expiresAt: values.expiresAt ? values.expiresAt.toISOString() : null,
            };

            if (editingId) {
                const res: any = await apiKeyApi.update(editingId, submitData);
                if (res.code === 200) {
                    message.success('Updated successfully');
                    setModalVisible(false);
                    fetchData();
                } else {
                    message.error(res.message);
                }
            } else {
                const res: any = await apiKeyApi.create(submitData);
                if (res.code === 200) {
                    setModalVisible(false);
                    setNewKey(res.data.key);
                    setNewKeyModalVisible(true);
                    fetchData();
                } else {
                    message.error(res.message);
                }
            }
        } catch (err: any) {
            if (err.message) {
                message.error(err.message);
            }
        }
    };

    const handleViewPool = async (record: ApiKey) => {
        setCurrentApiKey(record);
        setPoolModalVisible(true);
        setPoolLoading(true);
        try {
            const res: any = await apiKeyApi.getUsage(record.id);
            if (res.code === 200) {
                setPoolStats(res.data);
            }
        } catch (err) {
            message.error('Failed to get pool data');
        } finally {
            setPoolLoading(false);
        }
    };

    const handleResetPool = async () => {
        if (!currentApiKey) return;
        try {
            const res: any = await apiKeyApi.resetPool(currentApiKey.id);
            if (res.code === 200) {
                message.success('Email pool has been reset');
                // Refresh statistics
                const statsRes: any = await apiKeyApi.getUsage(currentApiKey.id);
                if (statsRes.code === 200) {
                    setPoolStats(statsRes.data);
                }
            } else {
                message.error(res.message || 'Reset failed');
            }
        } catch (err) {
            message.error('Reset failed');
        }
    };

    // Open email management modal
    const handleManageEmails = async (record: ApiKey) => {
        setCurrentApiKey(record);
        setEmailModalVisible(true);
        setEmailLoading(true);
        try {
            const res: any = await apiKeyApi.getPoolEmails(record.id);
            if (res.code === 200) {
                setEmailList(res.data);
                setSelectedEmails(res.data.filter((e: any) => e.used).map((e: any) => e.id));
            }
        } catch (err) {
            message.error('Failed to get email list');
        } finally {
            setEmailLoading(false);
        }
    };

    // Save email selection
    const handleSaveEmails = async () => {
        if (!currentApiKey) return;
        setSavingEmails(true);
        try {
            const res: any = await apiKeyApi.updatePoolEmails(currentApiKey.id, selectedEmails);
            if (res.code === 200) {
                message.success(`Saved, total ${res.data.count} emails`);
                setEmailModalVisible(false);
                // Refresh statistics
                const statsRes: any = await apiKeyApi.getUsage(currentApiKey.id);
                if (statsRes.code === 200) {
                    setPoolStats(statsRes.data);
                }
            } else {
                message.error(res.message || 'Save failed');
            }
        } catch (err) {
            message.error('Save failed');
        } finally {
            setSavingEmails(false);
        }
    };

    const columns: ColumnsType<ApiKey> = [
        {
            title: 'Name',
            dataIndex: 'name',
            key: 'name',
            render: (name, record) => (
                <Space>
                    <Text strong>{name}</Text>
                    {record.status === 'DISABLED' && <Badge status="error" />}
                </Space>
            ),
        },
        {
            title: 'Key Prefix',
            dataIndex: 'keyPrefix',
            key: 'keyPrefix',
            width: 120,
            render: (text) => <Text code>{text}...</Text>,
        },
        {
            title: 'Rate Limit',
            dataIndex: 'rateLimit',
            key: 'rateLimit',
            width: 100,
            render: (val) => <Tag color="blue">{val}/min</Tag>,
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            width: 80,
            render: (status) => (
                <Tag color={status === 'ACTIVE' ? 'green' : 'red'}>
                    {status === 'ACTIVE' ? 'Active' : 'Disabled'}
                </Tag>
            ),
        },
        {
            title: 'Usage Count',
            dataIndex: 'usageCount',
            key: 'usageCount',
            width: 100,
            render: (val) => <Text type="secondary">{val?.toLocaleString() || 0}</Text>,
        },
        {
            title: 'Expires',
            dataIndex: 'expiresAt',
            key: 'expiresAt',
            width: 120,
            render: (val) => {
                if (!val) return <Text type="secondary">Never</Text>;
                const isExpired = dayjs(val).isBefore(dayjs());
                return (
                    <Text type={isExpired ? 'danger' : undefined}>
                        {dayjs(val).format('YYYY-MM-DD')}
                    </Text>
                );
            },
        },
        {
            title: 'Last Used',
            dataIndex: 'lastUsedAt',
            key: 'lastUsedAt',
            width: 140,
            render: (val) => val ? dayjs(val).format('MM-DD HH:mm') : <Text type="secondary">Never used</Text>,
        },
        {
            title: 'Actions',
            key: 'action',
            width: 180,
            render: (_, record) => (
                <Space size="small">
                    <Tooltip title="Email Pool">
                        <Button
                            type="text"
                            icon={<DatabaseOutlined />}
                            onClick={() => handleViewPool(record)}
                        />
                    </Tooltip>
                    <Tooltip title="Manage Emails">
                        <Button
                            type="text"
                            icon={<ThunderboltOutlined />}
                            onClick={() => handleManageEmails(record)}
                        />
                    </Tooltip>
                    <Tooltip title="Edit">
                        <Button
                            type="text"
                            icon={<EditOutlined />}
                            onClick={() => handleEdit(record)}
                        />
                    </Tooltip>
                    <Tooltip title="Delete">
                        <Popconfirm
                            title="Are you sure you want to delete this API Key?"
                            onConfirm={() => handleDelete(record.id)}
                        >
                            <Button type="text" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                    </Tooltip>
                </Space>
            ),
        },
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <Title level={4} style={{ margin: 0 }}>
                    API Key Management
                </Title>
                <Space>
                    <Button icon={<ReloadOutlined />} onClick={fetchData}>
                        Refresh
                    </Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                        Create API Key
                    </Button>
                </Space>
            </div>

            <Table
                columns={columns}
                dataSource={data}
                rowKey="id"
                loading={loading}
                pagination={{
                    current: page,
                    pageSize,
                    total,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total) => `Total ${total} items`,
                    onChange: (p, ps) => {
                        setPage(p);
                        setPageSize(ps);
                    },
                }}
            />

            {/* Create/Edit Modal */}
            <Modal
                title={editingId ? 'Edit API Key' : 'Create API Key'}
                open={modalVisible}
                onOk={handleSubmit}
                onCancel={() => setModalVisible(false)}
                width={500}
            >
                <Form form={form} layout="vertical">
                    <Form.Item
                        name="name"
                        label="Name"
                        rules={[{ required: true, message: 'Please enter name' }]}
                    >
                        <Input placeholder="e.g., Production, Testing" />
                    </Form.Item>
                    <Form.Item
                        name="rateLimit"
                        label="Rate Limit (requests per minute)"
                        initialValue={60}
                    >
                        <InputNumber min={1} max={10000} style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item
                        name="expiresAt"
                        label="Expiration Date (optional)"
                    >
                        <DatePicker
                            style={{ width: '100%' }}
                            placeholder="Leave empty for no expiration"
                            disabledDate={(current) => current && current < dayjs().startOf('day')}
                        />
                    </Form.Item>
                    {editingId && (
                        <Form.Item
                            name="status"
                            label="Status"
                        >
                            <Select>
                                <Select.Option value="ACTIVE">Active</Select.Option>
                                <Select.Option value="DISABLED">Disabled</Select.Option>
                            </Select>
                        </Form.Item>
                    )}
                </Form>
            </Modal>

            {/* New Key Display Modal */}
            <Modal
                title="API Key Created"
                open={newKeyModalVisible}
                onOk={() => setNewKeyModalVisible(false)}
                onCancel={() => setNewKeyModalVisible(false)}
                footer={[
                    <Button key="close" onClick={() => setNewKeyModalVisible(false)}>
                        Close
                    </Button>,
                ]}
            >
                <Card>
                    <Text type="warning" style={{ display: 'block', marginBottom: 16 }}>
                        Warning: Please copy and save this API Key immediately, it will not be shown again!
                    </Text>
                    <Paragraph
                        copyable={{
                            text: newKey,
                            onCopy: () => message.success('Copied'),
                        }}
                        code
                        style={{
                            wordBreak: 'break-all',
                            background: '#f5f5f5',
                            padding: 12,
                            borderRadius: 4,
                        }}
                    >
                        {newKey}
                    </Paragraph>
                </Card>
            </Modal>

            {/* Email Pool Modal */}
            <Modal
                title={
                    <Space>
                        <DatabaseOutlined />
                        <span>Email Pool Management - {currentApiKey?.name}</span>
                    </Space>
                }
                open={poolModalVisible}
                onCancel={() => setPoolModalVisible(false)}
                footer={null}
                width={500}
            >
                {poolLoading ? (
                    <div style={{ textAlign: 'center', padding: 40 }}>Loading...</div>
                ) : poolStats ? (
                    <div>
                        <Row gutter={16} style={{ marginBottom: 24 }}>
                            <Col span={8}>
                                <div className="stat-blue">
                                    <Statistic
                                        title="Total Emails"
                                        value={poolStats.total}
                                    />
                                </div>
                            </Col>
                            <Col span={8}>
                                <div className="stat-orange">
                                    <Statistic
                                        title="Used"
                                        value={poolStats.used}
                                    />
                                </div>
                            </Col>
                            <Col span={8}>
                                <div className={poolStats.remaining > 0 ? 'stat-green' : 'stat-red'}>
                                    <Statistic
                                        title="Remaining"
                                        value={poolStats.remaining}
                                    />
                                </div>
                            </Col>
                        </Row>
                        <style>{`
                            .stat-blue .ant-statistic-content-value { color: #1890ff; }
                            .stat-orange .ant-statistic-content-value { color: #faad14; }
                            .stat-green .ant-statistic-content-value { color: #52c41a; }
                            .stat-red .ant-statistic-content-value { color: #ff4d4f; }
                        `}</style>

                        <div style={{ marginBottom: 24 }}>
                            <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                                Usage Progress
                            </Text>
                            <Progress
                                percent={poolStats.total > 0 ? Math.round((poolStats.used / poolStats.total) * 100) : 0}
                                status={poolStats.remaining === 0 ? 'exception' : 'active'}
                                strokeColor={{
                                    '0%': '#108ee9',
                                    '100%': '#87d068',
                                }}
                            />
                        </div>

                        <Divider />

                        <div style={{ textAlign: 'center' }}>
                            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                                After reset, this API Key can reuse all emails
                            </Text>
                            <Popconfirm
                                title="Are you sure you want to reset the email pool?"
                                description="After reset, this API Key can reuse all emails"
                                onConfirm={handleResetPool}
                            >
                                <Button
                                    type="primary"
                                    danger
                                    icon={<ThunderboltOutlined />}
                                >
                                    Reset Email Pool
                                </Button>
                            </Popconfirm>
                        </div>
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                        No data
                    </div>
                )}
            </Modal>

            {/* Email Management Modal */}
            <Modal
                title={
                    <Space>
                        <ThunderboltOutlined />
                        <span>Manage Emails - {currentApiKey?.name}</span>
                    </Space>
                }
                open={emailModalVisible}
                onCancel={() => setEmailModalVisible(false)}
                onOk={handleSaveEmails}
                okText="Save"
                cancelText="Cancel"
                confirmLoading={savingEmails}
                width={600}
            >
                {emailLoading ? (
                    <div style={{ textAlign: 'center', padding: 40 }}>
                        <Spin />
                    </div>
                ) : (
                    <div>
                        <div style={{ marginBottom: 16 }}>
                            <Text type="secondary">
                                Checked emails indicate this API Key has used them (will not be auto-allocated again)
                            </Text>
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <Space>
                                <Button
                                    size="small"
                                    onClick={() => setSelectedEmails(emailList.map(e => e.id))}
                                >
                                    Select All
                                </Button>
                                <Button
                                    size="small"
                                    onClick={() => setSelectedEmails([])}
                                >
                                    Deselect All
                                </Button>
                                <Text type="secondary">
                                    Selected {selectedEmails.length} / {emailList.length}
                                </Text>
                            </Space>
                        </div>
                        <div style={{ maxHeight: 400, overflow: 'auto', border: '1px solid #f0f0f0', borderRadius: 4, padding: 12 }}>
                            <Checkbox.Group
                                value={selectedEmails}
                                onChange={(vals) => setSelectedEmails(vals as number[])}
                                style={{ width: '100%' }}
                            >
                                <Row>
                                    {emailList.map(email => (
                                        <Col span={12} key={email.id} style={{ marginBottom: 8 }}>
                                            <Checkbox value={email.id}>
                                                {email.email}
                                            </Checkbox>
                                        </Col>
                                    ))}
                                </Row>
                            </Checkbox.Group>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default ApiKeysPage;

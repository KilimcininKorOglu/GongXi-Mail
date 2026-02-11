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
    Upload,
    Tooltip,
    List,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    UploadOutlined,
    DownloadOutlined,
    InboxOutlined,
    SearchOutlined,
    MailOutlined,
} from '@ant-design/icons';
import { emailApi } from '../../api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Dragger } = Upload;

interface EmailAccount {
    id: number;
    email: string;
    clientId: string;
    status: 'ACTIVE' | 'ERROR' | 'DISABLED';
    lastCheckAt: string | null;
    errorMessage: string | null;
    createdAt: string;
}

const EmailsPage: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<EmailAccount[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [importModalVisible, setImportModalVisible] = useState(false);
    const [mailModalVisible, setMailModalVisible] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [keyword, setKeyword] = useState('');
    const [importContent, setImportContent] = useState('');
    const [separator, setSeparator] = useState('----');
    const [mailList, setMailList] = useState<any[]>([]);
    const [mailLoading, setMailLoading] = useState(false);
    const [currentEmail, setCurrentEmail] = useState<string>('');
    const [currentEmailId, setCurrentEmailId] = useState<number | null>(null);
    const [currentMailbox, setCurrentMailbox] = useState<string>('INBOX');
    const [emailDetailVisible, setEmailDetailVisible] = useState(false);
    const [emailDetailContent, setEmailDetailContent] = useState<string>('');
    const [emailDetailSubject, setEmailDetailSubject] = useState<string>('');
    const [form] = Form.useForm();

    useEffect(() => {
        fetchData();
    }, [page, pageSize, keyword]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res: any = await emailApi.getList({ page, pageSize, keyword });
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

    const handleEdit = async (record: EmailAccount) => {
        setEditingId(record.id);
        try {
            const res: any = await emailApi.getById(record.id, true);
            if (res.code === 200) {
                form.setFieldsValue({
                    email: res.data.email,
                    clientId: res.data.clientId,
                    refreshToken: res.data.refreshToken,
                    status: res.data.status,
                });
                setModalVisible(true);
            }
        } catch (err) {
            message.error('Failed to get details');
        }
    };

    const handleDelete = async (id: number) => {
        try {
            const res: any = await emailApi.delete(id);
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

    const handleBatchDelete = async () => {
        if (selectedRowKeys.length === 0) {
            message.warning('Please select emails to delete');
            return;
        }

        try {
            const res: any = await emailApi.batchDelete(selectedRowKeys as number[]);
            if (res.code === 200) {
                message.success(`Successfully deleted ${res.data.deleted} emails`);
                setSelectedRowKeys([]);
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

            if (editingId) {
                const res: any = await emailApi.update(editingId, values);
                if (res.code === 200) {
                    message.success('Updated successfully');
                    setModalVisible(false);
                    fetchData();
                } else {
                    message.error(res.message);
                }
            } else {
                const res: any = await emailApi.create(values);
                if (res.code === 200) {
                    message.success('Created successfully');
                    setModalVisible(false);
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

    const handleImport = async () => {
        if (!importContent.trim()) {
            message.warning('Please enter or paste email data');
            return;
        }

        try {
            const res: any = await emailApi.import(importContent, separator);
            if (res.code === 200) {
                message.success(res.message);
                setImportModalVisible(false);
                setImportContent('');
                fetchData();
            } else {
                message.error(res.message);
            }
        } catch (err: any) {
            message.error(err.message || 'Import failed');
        }
    };

    const handleExport = async () => {
        try {
            const ids = selectedRowKeys.length > 0 ? selectedRowKeys as number[] : undefined;
            const content = await emailApi.export(ids, separator);

            const blob = new Blob([content as any], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'email_accounts.txt';
            a.click();
            URL.revokeObjectURL(url);

            message.success('Export successful');
        } catch (err: any) {
            message.error(err.message || 'Export failed');
        }
    };

    const handleViewMails = async (record: EmailAccount, mailbox: string) => {
        setCurrentEmail(record.email);
        setCurrentEmailId(record.id);
        setCurrentMailbox(mailbox);
        setMailLoading(true);
        setMailModalVisible(true);
        try {
            const res: any = await emailApi.viewMails(record.id, mailbox);
            if (res.code === 200) {
                setMailList(res.data?.messages || []);
            } else {
                message.error(res.message || 'Failed to get emails');
            }
        } catch (err: any) {
            message.error(err.message || 'Failed to get emails');
        } finally {
            setMailLoading(false);
        }
    };

    const handleRefreshMails = async () => {
        if (!currentEmailId) return;
        setMailLoading(true);
        try {
            const res: any = await emailApi.viewMails(currentEmailId, currentMailbox);
            if (res.code === 200) {
                setMailList(res.data?.messages || []);
                message.success('Refreshed successfully');
            } else {
                message.error(res.message || 'Failed to get emails');
            }
        } catch (err: any) {
            message.error(err.message || 'Failed to get emails');
        } finally {
            setMailLoading(false);
        }
    };

    const handleClearMailbox = async () => {
        if (!currentEmailId) return;
        try {
            const res: any = await emailApi.clearMailbox(currentEmailId, currentMailbox);
            if (res.code === 200) {
                message.success(`Cleared ${res.data?.deleted || 0} emails`);
                setMailList([]);
            } else {
                message.error(res.message || 'Clear failed');
            }
        } catch (err: any) {
            message.error(err.message || 'Clear failed');
        }
    };

    const handleViewEmailDetail = (record: any) => {
        setEmailDetailSubject(record.subject || 'No Subject');
        setEmailDetailContent(record.html || record.text || 'No Content');
        setEmailDetailVisible(true);
    };

    const columns: ColumnsType<EmailAccount> = [
        {
            title: 'Email',
            dataIndex: 'email',
            key: 'email',
            ellipsis: true,
        },
        {
            title: 'Client ID',
            dataIndex: 'clientId',
            key: 'clientId',
            ellipsis: true,
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            width: 100,
            render: (status) => {
                const colors: Record<string, string> = {
                    ACTIVE: 'green',
                    ERROR: 'red',
                    DISABLED: 'default',
                };
                const labels: Record<string, string> = {
                    ACTIVE: 'Active',
                    ERROR: 'Error',
                    DISABLED: 'Disabled',
                };
                return <Tag color={colors[status]}>{labels[status]}</Tag>;
            },
        },
        {
            title: 'Last Check',
            dataIndex: 'lastCheckAt',
            key: 'lastCheckAt',
            width: 160,
            render: (val) => (val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '-'),
        },
        {
            title: 'Created',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 160,
            render: (val) => dayjs(val).format('YYYY-MM-DD HH:mm'),
        },
        {
            title: 'Actions',
            key: 'action',
            width: 240,
            render: (_, record) => (
                <Space>
                    <Tooltip title="Inbox">
                        <Button
                            type="text"
                            icon={<MailOutlined />}
                            onClick={() => handleViewMails(record, 'INBOX')}
                        />
                    </Tooltip>
                    <Tooltip title="Junk">
                        <Button
                            type="text"
                            icon={<DeleteOutlined style={{ color: '#faad14' }} />}
                            onClick={() => handleViewMails(record, 'Junk')}
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
                            title="Are you sure you want to delete this email?"
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
                    Email Management
                </Title>
                <Space>
                    <Input
                        placeholder="Search email"
                        prefix={<SearchOutlined />}
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                        style={{ width: 200 }}
                        allowClear
                    />
                    <Button icon={<UploadOutlined />} onClick={() => setImportModalVisible(true)}>
                        Import
                    </Button>
                    <Button icon={<DownloadOutlined />} onClick={handleExport}>
                        Export
                    </Button>
                    {selectedRowKeys.length > 0 && (
                        <Popconfirm
                            title={`Are you sure you want to delete ${selectedRowKeys.length} selected emails?`}
                            onConfirm={handleBatchDelete}
                        >
                            <Button danger>Batch Delete ({selectedRowKeys.length})</Button>
                        </Popconfirm>
                    )}
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                        Add Email
                    </Button>
                </Space>
            </div>

            <Table
                columns={columns}
                dataSource={data}
                rowKey="id"
                loading={loading}
                rowSelection={{
                    selectedRowKeys,
                    onChange: setSelectedRowKeys,
                }}
                pagination={{
                    current: page,
                    pageSize,
                    total,
                    showSizeChanger: true,
                    showTotal: (total) => `Total ${total} items`,
                    onChange: (p, ps) => {
                        setPage(p);
                        setPageSize(ps);
                    },
                }}
            />

            <Modal
                title={editingId ? 'Edit Email' : 'Add Email'}
                open={modalVisible}
                onOk={handleSubmit}
                onCancel={() => setModalVisible(false)}
                width={600}
            >
                <Form form={form} layout="vertical">
                    <Form.Item name="email" label="Email Address" rules={[{ required: true, message: 'Please enter email address' }, { type: 'email', message: 'Please enter a valid email address' }]}>
                        <Input placeholder="example@outlook.com" />
                    </Form.Item>
                    <Form.Item name="password" label="Password">
                        <Input.Password placeholder="Optional" />
                    </Form.Item>

                    <Form.Item
                        name="clientId"
                        label="Client ID"
                        rules={[{ required: true, message: 'Please enter Client ID' }]}
                    >
                        <Input placeholder="Azure AD Application ID" />
                    </Form.Item>
                    <Form.Item
                        name="refreshToken"
                        label="Refresh Token"
                        rules={[{ required: !editingId, message: 'Please enter Refresh Token' }]}
                    >
                        <TextArea rows={4} placeholder="OAuth2 Refresh Token" />
                    </Form.Item>
                    <Form.Item name="status" label="Status" initialValue="ACTIVE">
                        <Select>
                            <Select.Option value="ACTIVE">Active</Select.Option>
                            <Select.Option value="DISABLED">Disabled</Select.Option>
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title="Batch Import Emails"
                open={importModalVisible}
                onOk={handleImport}
                onCancel={() => setImportModalVisible(false)}
                width={700}
            >
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                    <div>
                        <Text type="secondary">
                            Upload file or paste content. Supports multiple formats, will try to auto-parse.
                            <br />
                            Recommended format: email{separator}password{separator}clientId{separator}refreshToken
                        </Text>
                    </div>
                    <Input
                        addonBefore="Separator"
                        value={separator}
                        onChange={(e) => setSeparator(e.target.value)}
                        style={{ width: 200 }}
                    />
                    <Dragger
                        beforeUpload={(file) => {
                            const reader = new FileReader();
                            reader.onload = (e) => {
                                const fileContent = e.target?.result as string;
                                if (fileContent) {
                                    // Handle special format: email----id----uuid----info----token
                                    // Target format: email----id----token
                                    const lines = fileContent.split(/\r?\n/).filter(line => line.trim());
                                    const processedLines = lines.map(line => {
                                        const parts = line.split(separator);
                                        // If 5 parts format (e.g.: email----id----uuid----info----token)
                                        if (parts.length >= 5) {
                                            // Extract part 1 (email), part 2 (clientId), part 5 (refreshToken)
                                            // Note: Original file format looks like: email----clientId----uuid----machineInfo----refreshToken
                                            return `${parts[0]}${separator}${parts[1]}${separator}${parts[4]}`;
                                        }
                                        return line; // Keep as is
                                    });

                                    setImportContent(processedLines.join('\n'));
                                    message.success(`File read successfully, parsed ${lines.length} lines`);
                                }
                            };
                            reader.readAsText(file);
                            return false; // Prevent auto upload
                        }}
                        showUploadList={false}
                        maxCount={1}
                        accept=".txt,.csv"
                    >
                        <p className="ant-upload-drag-icon">
                            <InboxOutlined />
                        </p>
                        <p className="ant-upload-text">Click or drag file to this area</p>
                        <p className="ant-upload-hint">Supports .txt or .csv files</p>
                    </Dragger>
                    <TextArea
                        rows={12}
                        value={importContent}
                        onChange={(e) => setImportContent(e.target.value)}
                        placeholder={`example@outlook.com${separator}client_id${separator}refresh_token`}
                    />
                </Space>
            </Modal>

            <Modal
                title={`${currentEmail} ${currentMailbox === 'INBOX' ? 'Inbox' : 'Junk'}`}
                open={mailModalVisible}
                onCancel={() => setMailModalVisible(false)}
                footer={null}
                width={1000}
                styles={{ body: { padding: '16px 24px' } }}
            >
                <Space style={{ marginBottom: 16 }}>
                    <Button type="primary" onClick={handleRefreshMails} loading={mailLoading}>
                        Fetch New Emails
                    </Button>
                    <Popconfirm
                        title={`Are you sure you want to clear all emails in ${currentMailbox === 'INBOX' ? 'Inbox' : 'Junk'}?`}
                        onConfirm={handleClearMailbox}
                    >
                        <Button danger>Clear</Button>
                    </Popconfirm>
                    <span style={{ marginLeft: 16, color: '#888' }}>
                        Total {mailList.length} emails
                    </span>
                </Space>
                <List
                    loading={mailLoading}
                    dataSource={mailList}
                    itemLayout="horizontal"
                    pagination={{
                        pageSize: 10,
                        showSizeChanger: true,
                        showQuickJumper: true,
                        showTotal: (total) => `Total ${total} items`,
                        style: { marginTop: 16 },
                    }}
                    style={{ maxHeight: 450, overflow: 'auto' }}
                    renderItem={(item: any) => (
                        <List.Item
                            key={item.id}
                            actions={[
                                <Button
                                    type="primary"
                                    size="small"
                                    onClick={() => handleViewEmailDetail(item)}
                                >
                                    View
                                </Button>
                            ]}
                        >
                            <List.Item.Meta
                                title={
                                    <Typography.Text ellipsis style={{ maxWidth: 600 }}>
                                        {item.subject || '(No Subject)'}
                                    </Typography.Text>
                                }
                                description={
                                    <Space size="large">
                                        <span style={{ color: '#1890ff' }}>{item.from || 'Unknown Sender'}</span>
                                        <span style={{ color: '#999' }}>
                                            {item.date ? dayjs(item.date).format('YYYY-MM-DD HH:mm') : '-'}
                                        </span>
                                    </Space>
                                }
                            />
                        </List.Item>
                    )}
                />
            </Modal>

            {/* 邮件详情弹窗 */}
            <Modal
                title={emailDetailSubject}
                open={emailDetailVisible}
                onCancel={() => setEmailDetailVisible(false)}
                footer={null}
                width={900}
                styles={{ body: { padding: '16px 24px' } }}
            >
                <iframe
                    title="email-content"
                    sandbox="allow-same-origin"
                    srcDoc={`
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <meta charset="utf-8">
                            <style>
                                body { 
                                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                                    font-size: 14px;
                                    line-height: 1.6;
                                    color: #333;
                                    margin: 0;
                                    padding: 16px;
                                    background: #fafafa;
                                }
                                img { max-width: 100%; height: auto; }
                                a { color: #1890ff; }
                            </style>
                        </head>
                        <body>${emailDetailContent}</body>
                        </html>
                    `}
                    style={{
                        width: '100%',
                        height: 'calc(100vh - 300px)',
                        border: '1px solid #eee',
                        borderRadius: '8px',
                        backgroundColor: '#fafafa',
                    }}
                />
            </Modal>
        </div>
    );
};

export default EmailsPage;


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
            message.error('获取数据失败');
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
            message.error('获取详情失败');
        }
    };

    const handleDelete = async (id: number) => {
        try {
            const res: any = await emailApi.delete(id);
            if (res.code === 200) {
                message.success('删除成功');
                fetchData();
            } else {
                message.error(res.message);
            }
        } catch (err: any) {
            message.error(err.message || '删除失败');
        }
    };

    const handleBatchDelete = async () => {
        if (selectedRowKeys.length === 0) {
            message.warning('请选择要删除的邮箱');
            return;
        }

        try {
            const res: any = await emailApi.batchDelete(selectedRowKeys as number[]);
            if (res.code === 200) {
                message.success(`成功删除 ${res.data.deleted} 个邮箱`);
                setSelectedRowKeys([]);
                fetchData();
            } else {
                message.error(res.message);
            }
        } catch (err: any) {
            message.error(err.message || '删除失败');
        }
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();

            if (editingId) {
                const res: any = await emailApi.update(editingId, values);
                if (res.code === 200) {
                    message.success('更新成功');
                    setModalVisible(false);
                    fetchData();
                } else {
                    message.error(res.message);
                }
            } else {
                const res: any = await emailApi.create(values);
                if (res.code === 200) {
                    message.success('创建成功');
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
            message.warning('请输入或粘贴邮箱数据');
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
            message.error(err.message || '导入失败');
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

            message.success('导出成功');
        } catch (err: any) {
            message.error(err.message || '导出失败');
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
                message.error(res.message || '获取邮件失败');
            }
        } catch (err: any) {
            message.error(err.message || '获取邮件失败');
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
                message.success('刷新成功');
            } else {
                message.error(res.message || '获取邮件失败');
            }
        } catch (err: any) {
            message.error(err.message || '获取邮件失败');
        } finally {
            setMailLoading(false);
        }
    };

    const handleClearMailbox = async () => {
        if (!currentEmailId) return;
        try {
            const res: any = await emailApi.clearMailbox(currentEmailId, currentMailbox);
            if (res.code === 200) {
                message.success(`已清空 ${res.data?.deleted || 0} 封邮件`);
                setMailList([]);
            } else {
                message.error(res.message || '清空失败');
            }
        } catch (err: any) {
            message.error(err.message || '清空失败');
        }
    };

    const handleViewEmailDetail = (record: any) => {
        setEmailDetailSubject(record.subject || '无主题');
        setEmailDetailContent(record.html || record.text || '无内容');
        setEmailDetailVisible(true);
    };

    const columns: ColumnsType<EmailAccount> = [
        {
            title: '邮箱',
            dataIndex: 'email',
            key: 'email',
            ellipsis: true,
        },
        {
            title: '客户端 ID',
            dataIndex: 'clientId',
            key: 'clientId',
            ellipsis: true,
        },
        {
            title: '状态',
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
                    ACTIVE: '正常',
                    ERROR: '异常',
                    DISABLED: '禁用',
                };
                return <Tag color={colors[status]}>{labels[status]}</Tag>;
            },
        },
        {
            title: '最后检查',
            dataIndex: 'lastCheckAt',
            key: 'lastCheckAt',
            width: 160,
            render: (val) => (val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '-'),
        },
        {
            title: '创建时间',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 160,
            render: (val) => dayjs(val).format('YYYY-MM-DD HH:mm'),
        },
        {
            title: '操作',
            key: 'action',
            width: 240,
            render: (_, record) => (
                <Space>
                    <Tooltip title="收件箱">
                        <Button
                            type="text"
                            icon={<MailOutlined />}
                            onClick={() => handleViewMails(record, 'INBOX')}
                        />
                    </Tooltip>
                    <Tooltip title="垃圾箱">
                        <Button
                            type="text"
                            icon={<DeleteOutlined style={{ color: '#faad14' }} />}
                            onClick={() => handleViewMails(record, 'Junk')}
                        />
                    </Tooltip>
                    <Tooltip title="编辑">
                        <Button
                            type="text"
                            icon={<EditOutlined />}
                            onClick={() => handleEdit(record)}
                        />
                    </Tooltip>
                    <Tooltip title="删除">
                        <Popconfirm
                            title="确定要删除此邮箱吗？"
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
                    邮箱管理
                </Title>
                <Space>
                    <Input
                        placeholder="搜索邮箱"
                        prefix={<SearchOutlined />}
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                        style={{ width: 200 }}
                        allowClear
                    />
                    <Button icon={<UploadOutlined />} onClick={() => setImportModalVisible(true)}>
                        导入
                    </Button>
                    <Button icon={<DownloadOutlined />} onClick={handleExport}>
                        导出
                    </Button>
                    {selectedRowKeys.length > 0 && (
                        <Popconfirm
                            title={`确定要删除选中的 ${selectedRowKeys.length} 个邮箱吗？`}
                            onConfirm={handleBatchDelete}
                        >
                            <Button danger>批量删除 ({selectedRowKeys.length})</Button>
                        </Popconfirm>
                    )}
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                        添加邮箱
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
                    showTotal: (total) => `共 ${total} 条`,
                    onChange: (p, ps) => {
                        setPage(p);
                        setPageSize(ps);
                    },
                }}
            />

            <Modal
                title={editingId ? '编辑邮箱' : '添加邮箱'}
                open={modalVisible}
                onOk={handleSubmit}
                onCancel={() => setModalVisible(false)}
                width={600}
            >
                <Form form={form} layout="vertical">
                    <Form.Item name="email" label="邮箱地址" rules={[{ required: true, message: '请输入邮箱地址' }, { type: 'email', message: '请输入有效的邮箱地址' }]}>
                        <Input placeholder="example@outlook.com" />
                    </Form.Item>
                    <Form.Item name="password" label="密码">
                        <Input.Password placeholder="可选" />
                    </Form.Item>

                    <Form.Item
                        name="clientId"
                        label="客户端 ID"
                        rules={[{ required: true, message: '请输入客户端 ID' }]}
                    >
                        <Input placeholder="Azure AD 应用程序 ID" />
                    </Form.Item>
                    <Form.Item
                        name="refreshToken"
                        label="刷新令牌"
                        rules={[{ required: !editingId, message: '请输入刷新令牌' }]}
                    >
                        <TextArea rows={4} placeholder="OAuth2 Refresh Token" />
                    </Form.Item>
                    <Form.Item name="status" label="状态" initialValue="ACTIVE">
                        <Select>
                            <Select.Option value="ACTIVE">正常</Select.Option>
                            <Select.Option value="DISABLED">禁用</Select.Option>
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title="批量导入邮箱"
                open={importModalVisible}
                onOk={handleImport}
                onCancel={() => setImportModalVisible(false)}
                width={700}
            >
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                    <div>
                        <Text type="secondary">
                            上传文件或粘贴内容。支持多种格式，将尝试自动解析。
                            <br />
                            推荐格式：邮箱{separator}密码{separator}客户端ID{separator}刷新令牌
                        </Text>
                    </div>
                    <Input
                        addonBefore="分隔符"
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
                                    // 处理特殊格式：email----id----uuid----info----token
                                    // 目标格式：email----id----token
                                    const lines = fileContent.split(/\r?\n/).filter(line => line.trim());
                                    const processedLines = lines.map(line => {
                                        const parts = line.split(separator);
                                        // 如果是 5 部分的格式 (例如: email----id----uuid----info----token)
                                        if (parts.length >= 5) {
                                            // 提取第1部分(email), 第2部分(clientId), 第5部分(refreshToken)
                                            // 注意：原文件格式看起来是：email----clientId----uuid----machineInfo----refreshToken
                                            return `${parts[0]}${separator}${parts[1]}${separator}${parts[4]}`;
                                        }
                                        return line; // 保持原样
                                    });

                                    setImportContent(processedLines.join('\n'));
                                    message.success(`文件读取成功，已解析 ${lines.length} 行数据`);
                                }
                            };
                            reader.readAsText(file);
                            return false; // 阻止自动上传
                        }}
                        showUploadList={false}
                        maxCount={1}
                        accept=".txt,.csv"
                    >
                        <p className="ant-upload-drag-icon">
                            <InboxOutlined />
                        </p>
                        <p className="ant-upload-text">点击或拖拽文件到此区域</p>
                        <p className="ant-upload-hint">支持 .txt 或 .csv 文件</p>
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
                title={`${currentEmail} 的${currentMailbox === 'INBOX' ? '收件箱' : '垃圾箱'}`}
                open={mailModalVisible}
                onCancel={() => setMailModalVisible(false)}
                footer={null}
                width={1000}
                styles={{ body: { padding: '16px 24px' } }}
            >
                <Space style={{ marginBottom: 16 }}>
                    <Button type="primary" onClick={handleRefreshMails} loading={mailLoading}>
                        收取新邮件
                    </Button>
                    <Popconfirm
                        title={`确定要清空${currentMailbox === 'INBOX' ? '收件箱' : '垃圾箱'}的所有邮件吗？`}
                        onConfirm={handleClearMailbox}
                    >
                        <Button danger>清空</Button>
                    </Popconfirm>
                    <span style={{ marginLeft: 16, color: '#888' }}>
                        共 {mailList.length} 封邮件
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
                        showTotal: (total) => `共 ${total} 条`,
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
                                    查看
                                </Button>
                            ]}
                        >
                            <List.Item.Meta
                                title={
                                    <Typography.Text ellipsis style={{ maxWidth: 600 }}>
                                        {item.subject || '(无主题)'}
                                    </Typography.Text>
                                }
                                description={
                                    <Space size="large">
                                        <span style={{ color: '#1890ff' }}>{item.from || '未知发件人'}</span>
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


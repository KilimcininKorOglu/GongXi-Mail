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
    Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { adminApi } from '../../api';
import { useAuthStore } from '../../stores/authStore';
import dayjs from 'dayjs';

const { Title } = Typography;

interface Admin {
    id: number;
    username: string;
    email: string | null;
    role: 'super_admin' | 'admin';
    status: 'active' | 'disabled';
    last_login_at: string | null;
    last_login_ip: string | null;
    created_at: string;
}

const AdminsPage: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<Admin[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [form] = Form.useForm();
    const { admin: currentAdmin } = useAuthStore();

    useEffect(() => {
        fetchData();
    }, [page, pageSize]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res: any = await adminApi.getList({ page, pageSize });
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

    const handleEdit = (record: Admin) => {
        setEditingId(record.id);
        form.setFieldsValue({
            username: record.username,
            email: record.email,
            role: record.role,
            status: record.status,
            password: '',
        });
        setModalVisible(true);
    };

    const handleDelete = async (id: number) => {
        try {
            const res: any = await adminApi.delete(id);
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

            if (editingId) {
                // If password is empty, don't update password
                if (!values.password) {
                    delete values.password;
                }
                const res: any = await adminApi.update(editingId, values);
                if (res.code === 200) {
                    message.success('Updated successfully');
                    setModalVisible(false);
                    fetchData();
                } else {
                    message.error(res.message);
                }
            } else {
                const res: any = await adminApi.create(values);
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

    const columns: ColumnsType<Admin> = [
        {
            title: 'Username',
            dataIndex: 'username',
            key: 'username',
        },
        {
            title: 'Email',
            dataIndex: 'email',
            key: 'email',
            render: (val) => val || '-',
        },
        {
            title: 'Role',
            dataIndex: 'role',
            key: 'role',
            render: (role) => (
                <Tag color={role === 'super_admin' ? 'gold' : 'blue'}>
                    {role === 'super_admin' ? 'Super Admin' : 'Admin'}
                </Tag>
            ),
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status) => (
                <Tag color={status === 'active' ? 'green' : 'red'}>
                    {status === 'active' ? 'Active' : 'Disabled'}
                </Tag>
            ),
        },
        {
            title: 'Last Login',
            dataIndex: 'last_login_at',
            key: 'last_login_at',
            render: (val, record) =>
                val ? (
                    <Tooltip title={`IP: ${record.last_login_ip || 'Unknown'}`}>
                        {dayjs(val).format('YYYY-MM-DD HH:mm')}
                    </Tooltip>
                ) : (
                    '-'
                ),
        },
        {
            title: 'Created',
            dataIndex: 'created_at',
            key: 'created_at',
            render: (val) => dayjs(val).format('YYYY-MM-DD HH:mm'),
        },
        {
            title: 'Actions',
            key: 'action',
            width: 120,
            render: (_, record) => (
                <Space>
                    <Tooltip title="Edit">
                        <Button
                            type="text"
                            icon={<EditOutlined />}
                            onClick={() => handleEdit(record)}
                        />
                    </Tooltip>
                    {record.id !== currentAdmin?.id && (
                        <Tooltip title="Delete">
                            <Popconfirm
                                title="Are you sure you want to delete this admin?"
                                onConfirm={() => handleDelete(record.id)}
                            >
                                <Button type="text" danger icon={<DeleteOutlined />} />
                            </Popconfirm>
                        </Tooltip>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <Title level={4} style={{ margin: 0 }}>
                    Admin Management
                </Title>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                    Add Admin
                </Button>
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
                    showTotal: (total) => `Total ${total} items`,
                    onChange: (p, ps) => {
                        setPage(p);
                        setPageSize(ps);
                    },
                }}
            />

            <Modal
                title={editingId ? 'Edit Admin' : 'Add Admin'}
                open={modalVisible}
                onOk={handleSubmit}
                onCancel={() => setModalVisible(false)}
            >
                <Form form={form} layout="vertical">
                    <Form.Item
                        name="username"
                        label="Username"
                        rules={[
                            { required: true, message: 'Please enter username' },
                            { min: 3, message: 'Username must be at least 3 characters' },
                        ]}
                    >
                        <Input placeholder="Enter username" />
                    </Form.Item>
                    <Form.Item
                        name="password"
                        label="Password"
                        rules={
                            editingId
                                ? []
                                : [
                                    { required: true, message: 'Please enter password' },
                                    { min: 6, message: 'Password must be at least 6 characters' },
                                ]
                        }
                    >
                        <Input.Password
                            placeholder={editingId ? 'Leave empty to keep current password' : 'Enter password'}
                        />
                    </Form.Item>
                    <Form.Item name="email" label="Email">
                        <Input placeholder="Optional" type="email" />
                    </Form.Item>
                    <Form.Item name="role" label="Role" initialValue="admin">
                        <Select>
                            <Select.Option value="admin">Admin</Select.Option>
                            <Select.Option value="super_admin">Super Admin</Select.Option>
                        </Select>
                    </Form.Item>
                    <Form.Item name="status" label="Status" initialValue="active">
                        <Select>
                            <Select.Option value="active">Active</Select.Option>
                            <Select.Option value="disabled">Disabled</Select.Option>
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default AdminsPage;

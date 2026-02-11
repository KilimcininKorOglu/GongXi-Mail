import React, { useState } from 'react';
import { Card, Form, Input, Button, message, Typography, Divider, Space } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { authApi } from '../../api';
import { useAuthStore } from '../../stores/authStore';

const { Title, Text } = Typography;

const SettingsPage: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [form] = Form.useForm();
    const { admin } = useAuthStore();

    const handleChangePassword = async (values: {
        oldPassword: string;
        newPassword: string;
        confirmPassword: string;
    }) => {
        if (values.newPassword !== values.confirmPassword) {
            message.error('Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            const res: any = await authApi.changePassword(values.oldPassword, values.newPassword);
            if (res.code === 200) {
                message.success('Password changed successfully');
                form.resetFields();
            } else {
                message.error(res.message);
            }
        } catch (err: any) {
            message.error(err.message || 'Failed to change password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <Title level={4}>Settings</Title>

            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Card title="Personal Information">
                    <div style={{ display: 'grid', gap: 16 }}>
                        <div>
                            <Text type="secondary">Username</Text>
                            <div style={{ fontSize: 16 }}>{admin?.username}</div>
                        </div>
                        <div>
                            <Text type="secondary">Role</Text>
                            <div style={{ fontSize: 16 }}>
                                {admin?.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                            </div>
                        </div>
                    </div>
                </Card>

                <Card title="Change Password">
                    <Form
                        form={form}
                        layout="vertical"
                        onFinish={handleChangePassword}
                        style={{ maxWidth: 400 }}
                    >
                        <Form.Item
                            name="oldPassword"
                            label="Current Password"
                            rules={[{ required: true, message: 'Please enter current password' }]}
                        >
                            <Input.Password prefix={<LockOutlined />} placeholder="Current password" />
                        </Form.Item>

                        <Form.Item
                            name="newPassword"
                            label="New Password"
                            rules={[
                                { required: true, message: 'Please enter new password' },
                                { min: 6, message: 'Password must be at least 6 characters' },
                            ]}
                        >
                            <Input.Password prefix={<LockOutlined />} placeholder="New password" />
                        </Form.Item>

                        <Form.Item
                            name="confirmPassword"
                            label="Confirm New Password"
                            rules={[
                                { required: true, message: 'Please confirm new password' },
                                ({ getFieldValue }) => ({
                                    validator(_, value) {
                                        if (!value || getFieldValue('newPassword') === value) {
                                            return Promise.resolve();
                                        }
                                        return Promise.reject(new Error('Passwords do not match'));
                                    },
                                }),
                            ]}
                        >
                            <Input.Password prefix={<LockOutlined />} placeholder="Confirm new password" />
                        </Form.Item>

                        <Form.Item>
                            <Button type="primary" htmlType="submit" loading={loading}>
                                Change Password
                            </Button>
                        </Form.Item>
                    </Form>
                </Card>

                <Card title="API Usage Guide">
                    <div style={{ marginBottom: 16 }}>
                        <Text strong>External API Call Methods</Text>
                    </div>

                    <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, marginBottom: 16 }}>
                        <Text code style={{ display: 'block', marginBottom: 8 }}>
                            # Pass API Key via Header
                        </Text>
                        <Text code style={{ display: 'block', wordBreak: 'break-all' }}>
                            curl -H "X-API-Key: your_api_key" https://your-domain.com/api/mail_all
                        </Text>
                    </div>

                    <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 8 }}>
                        <Text code style={{ display: 'block', marginBottom: 8 }}>
                            # Pass API Key via Query parameter
                        </Text>
                        <Text code style={{ display: 'block', wordBreak: 'break-all' }}>
                            curl "https://your-domain.com/api/mail_all?api_key=your_api_key&email=xxx@outlook.com&client_id=xxx&refresh_token=xxx"
                        </Text>
                    </div>
                </Card>
            </Space>
        </div>
    );
};

export default SettingsPage;

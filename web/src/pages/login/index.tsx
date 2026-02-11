import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { authApi } from '../../api';
import { useAuthStore } from '../../stores/authStore';

const { Title, Text } = Typography;

interface LoginForm {
    username: string;
    password: string;
}

const LoginPage: React.FC = () => {
    const navigate = useNavigate();
    const { setAuth } = useAuthStore();
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (values: LoginForm) => {
        setLoading(true);
        try {
            const res: any = await authApi.login(values.username, values.password);
            if (res.code === 200) {
                setAuth(res.data.token, res.data.admin);
                message.success('Login successful');
                navigate('/');
            } else {
                message.error(res.message || 'Login failed');
            }
        } catch (err: any) {
            message.error(err.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#f0f2f5',
            }}
        >
            <Card
                style={{
                    width: 380,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                }}
            >
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <Title level={3} style={{ margin: '0 0 8px 0' }}>
                        GongXi Mail
                    </Title>
                    <Text type="secondary">Admin Console</Text>
                </div>

                <Form
                    name="login"
                    onFinish={handleSubmit}
                    size="large"
                >
                    <Form.Item
                        name="username"
                        rules={[{ required: true, message: 'Please enter username' }]}
                    >
                        <Input
                            prefix={<UserOutlined />}
                            placeholder="Username"
                        />
                    </Form.Item>

                    <Form.Item
                        name="password"
                        rules={[{ required: true, message: 'Please enter password' }]}
                    >
                        <Input.Password
                            prefix={<LockOutlined />}
                            placeholder="Password"
                        />
                    </Form.Item>

                    <Form.Item style={{ marginBottom: 0 }}>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={loading}
                            block
                        >
                            Login
                        </Button>
                    </Form.Item>
                </Form>
            </Card>
        </div>
    );
};

export default LoginPage;

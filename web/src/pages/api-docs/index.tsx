import React from 'react';
import { Typography, Card, Tabs, Tag, Table, Divider, Alert, Row, Col } from 'antd';

const { Title, Text, Paragraph } = Typography;

const ApiDocsPage: React.FC = () => {
  const baseUrl = window.location.origin;

  const authMethods = [
    {
      method: 'Header (Recommended)',
      example: 'X-API-Key: sk_your_api_key',
      description: 'Pass API Key in request header',
    },
    {
      method: 'Bearer Token',
      example: 'Authorization: Bearer sk_your_api_key',
      description: 'Use Bearer Token format',
    },
    {
      method: 'Query Parameter',
      example: '?api_key=sk_your_api_key',
      description: 'URL parameter (not recommended, will be logged)',
    },
  ];

  const apiEndpoints = [
    {
      name: 'Get Email Address',
      method: 'GET/POST',
      path: '/api/get-email',
      description: 'Allocate an unused email address from the pool. After successful call, the email will be marked as used by your API Key (will not be allocated to you again via this endpoint).',
      params: [],
      example: `curl -X POST "${baseUrl}/api/get-email" \\
  -H "X-API-Key: sk_your_api_key"`,
      successResponse: `{
  "success": true,
  "data": {
    "email": "example@outlook.com",
    "id": 1
  }
}`,
      errorResponse: `{
  "success": false,
  "error": {
    "code": "NO_UNUSED_EMAIL",
    "message": "No unused emails available."
  }
}`,
    },
    {
      name: 'Get Latest Email',
      method: 'GET/POST',
      path: '/api/mail_new',
      description: 'Get the latest email from the specified mailbox. Can be accessed as long as the email address exists in the system.',
      params: [
        { name: 'email', type: 'string', required: true, desc: 'Email address' },
        { name: 'mailbox', type: 'string', required: false, desc: 'Mail folder, default inbox' },
        { name: 'socks5', type: 'string', required: false, desc: 'SOCKS5 proxy address' },
        { name: 'http', type: 'string', required: false, desc: 'HTTP proxy address' },
      ],
      example: `curl -X POST "${baseUrl}/api/mail_new" \\
  -H "X-API-Key: sk_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"email": "example@outlook.com"}'`,
      successResponse: `{
  "success": true,
  "data": {
    "id": "AAMk...",
    "subject": "Verification Code Email",
    "from": "noreply@example.com",
    "receivedDateTime": "2024-01-01T12:00:00Z",
    "bodyPreview": "Your verification code is 123456",
    "body": { "content": "..." }
  },
  "email": "example@outlook.com"
}`,
      errorResponse: `{
  "success": false,
  "error": {
    "code": "EMAIL_NOT_FOUND",
    "message": "Email account not found"
  }
}`,
    },
    {
      name: 'Get Email Text (Script)',
      method: 'GET/POST',
      path: '/api/mail_text',
      description: 'Lightweight endpoint designed for scripts, returns `text/plain` format. Supports regex extraction for verification codes.',
      params: [
        { name: 'email', type: 'string', required: true, desc: 'Email address' },
        { name: 'match', type: 'string', required: false, desc: 'Regular expression (e.g. `\\d{6}`)' },
      ],
      example: `# Get verification code
curl "${baseUrl}/api/mail_text?email=example@outlook.com&match=\\d{6}" \\
  -H "X-API-Key: sk_your_api_key"`,
      successResponse: `123456`,
      errorResponse: `Error: No match found`,
    },
    {
      name: 'Get All Emails',
      method: 'GET/POST',
      path: '/api/mail_all',
      description: 'Get all emails from the specified mailbox. Can be accessed as long as the email address exists in the system.',
      params: [
        { name: 'email', type: 'string', required: true, desc: 'Email address' },
        { name: 'mailbox', type: 'string', required: false, desc: 'Mail folder, default inbox' },
        { name: 'socks5', type: 'string', required: false, desc: 'SOCKS5 proxy address' },
        { name: 'http', type: 'string', required: false, desc: 'HTTP proxy address' },
      ],
      example: `curl "${baseUrl}/api/mail_all?email=example@outlook.com" \\
  -H "X-API-Key: sk_your_api_key"`,
      successResponse: `{
  "success": true,
  "data": [
    { "id": "...", "subject": "Email 1" },
    { "id": "...", "subject": "Email 2" }
  ],
  "email": "example@outlook.com"
}`,
      errorResponse: `{
  "success": false,
  "error": {
    "code": "EMAIL_NOT_FOUND",
    "message": "Email account not found"
  }
}`,
    },
    {
      name: 'Clear Mailbox',
      method: 'GET/POST',
      path: '/api/process-mailbox',
      description: 'Clear all emails from the specified mailbox.',
      params: [
        { name: 'email', type: 'string', required: true, desc: 'Email address' },
        { name: 'mailbox', type: 'string', required: false, desc: 'Mail folder, default inbox' },
        { name: 'socks5', type: 'string', required: false, desc: 'SOCKS5 proxy address' },
        { name: 'http', type: 'string', required: false, desc: 'HTTP proxy address' },
      ],
      example: `curl -X POST "${baseUrl}/api/process-mailbox" \\
  -H "X-API-Key: sk_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"email": "example@outlook.com"}'`,
      successResponse: `{
  "success": true,
  "data": {
    "deleted": 5,
    "message": "Deleted 5 emails"
  },
  "email": "example@outlook.com"
}`,
      errorResponse: `{
  "success": false,
  "error": {
    "code": "EMAIL_NOT_FOUND",
    "message": "Email account not found"
  }
}`,
    },
    {
      name: 'Get Available Email List',
      method: 'GET/POST',
      path: '/api/list-emails',
      description: 'Get list of all available email addresses in the system.',
      params: [],
      example: `curl "${baseUrl}/api/list-emails" \\
  -H "X-API-Key: sk_your_api_key"`,
      successResponse: `{
  "success": true,
  "data": {
    "total": 100,
    "emails": [
      { "email": "user1@outlook.com", "status": "ACTIVE" },
      { "email": "user2@outlook.com", "status": "ACTIVE" }
    ]
  }
}`,
      errorResponse: `{
  "success": false,
  "error": {
    "code": "AUTH_REQUIRED",
    "message": "API Key required"
  }
}`,
    },
    {
      name: 'Email Pool Statistics',
      method: 'GET/POST',
      path: '/api/pool-stats',
      description: 'Get allocation usage statistics for current API Key.',
      params: [],
      example: `curl "${baseUrl}/api/pool-stats" \\
  -H "X-API-Key: sk_your_api_key"`,
      successResponse: `{
  "success": true,
  "data": {
    "total": 100,
    "used": 3,
    "remaining": 97
  }
}`,
      errorResponse: `{
  "success": false,
  "error": {
    "code": "AUTH_REQUIRED",
    "message": "API Key required"
  }
}`,
    },
    {
      name: 'Reset Allocation Records',
      method: 'GET/POST',
      path: '/api/reset-pool',
      description: 'Reset allocation records for current API Key, making all emails available for allocation via `/get-email` again.',
      params: [],
      example: `curl -X POST "${baseUrl}/api/reset-pool" \\
  -H "X-API-Key: sk_your_api_key"`,
      successResponse: `{
  "success": true,
  "data": {
    "message": "Pool reset successfully"
  }
}`,
      errorResponse: `{
  "success": false,
  "error": {
    "code": "AUTH_REQUIRED",
    "message": "API Key required"
  }
}`,
    },
  ];

  const paramColumns = [
    { title: 'Parameter', dataIndex: 'name', key: 'name', render: (t: string) => <Text code>{t}</Text> },
    { title: 'Type', dataIndex: 'type', key: 'type' },
    { title: 'Required', dataIndex: 'required', key: 'required', render: (r: boolean) => r ? <Tag color="red">Yes</Tag> : <Tag>No</Tag> },
    { title: 'Description', dataIndex: 'desc', key: 'desc' },
  ];

  return (
    <div>
      <Title level={4}>API Documentation</Title>
      <Text type="secondary">Self-service email retrieval and management</Text>

      <Divider />

      <Alert
        message="API Description"
        description={
          <div>
            <p style={{ marginBottom: 8 }}>The system provides flexible email access methods:</p>
            <ul style={{ marginBottom: 8, paddingLeft: 20 }}>
              <li><strong>Direct Access</strong>: If you know the target email address, you can directly call <code>/api/mail_new</code> or <code>/api/mail_all</code> to get emails without any pre-allocation.</li>
              <li><strong>Auto Allocation</strong>: If you need a new, unused email, call <code>/api/get-email</code>. This will return a random email and mark it as used by you to avoid duplicates.</li>
              <li><strong>Text Speedup</strong>: For automation scripts, we recommend using <code>/api/mail_text</code> with regex matching to directly get verification codes and other key information.</li>
            </ul>
          </div>
        }
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Card title="Authentication Methods" style={{ marginBottom: 24 }}>
        <Alert
          message="All API requests require a valid API Key"
          description="Please create a key on the 'API Keys' page. The key is only shown once when created, please save it securely."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Table
          dataSource={authMethods}
          columns={[
            { title: 'Method', dataIndex: 'method', key: 'method' },
            { title: 'Example', dataIndex: 'example', key: 'example', render: (t: string) => <Text code copyable>{t}</Text> },
            { title: 'Description', dataIndex: 'description', key: 'description' },
          ]}
          pagination={false}
          size="small"
          rowKey="method"
        />
      </Card>

      <Card title="Endpoint List">
        <Tabs
          items={apiEndpoints.map((api, index) => ({
            key: String(index),
            label: api.name,
            children: (
              <div>
                <Paragraph>
                  <Tag color="blue">{api.method}</Tag>
                  <Text code copyable style={{ marginLeft: 8 }}>{baseUrl}{api.path}</Text>
                </Paragraph>
                <Paragraph type="secondary">{api.description}</Paragraph>

                {api.params.length > 0 && (
                  <>
                    <Title level={5} style={{ marginTop: 16 }}>Request Parameters</Title>
                    <Table
                      dataSource={api.params}
                      columns={paramColumns}
                      pagination={false}
                      size="small"
                      rowKey="name"
                    />
                  </>
                )}

                <Title level={5} style={{ marginTop: 24 }}>Example Call</Title>
                <Card size="small" style={{ background: '#f5f5f5' }}>
                  <Text code style={{ whiteSpace: 'pre-wrap' }}>
                    {api.example}
                  </Text>
                </Card>

                <Title level={5} style={{ marginTop: 24 }}>Response Examples</Title>
                <Row gutter={16}>
                  <Col span={12}>
                    <Text strong style={{ color: '#52c41a' }}>Success Response</Text>
                    <Card size="small" style={{ background: '#f6ffed', marginTop: 8 }}>
                      <Text code style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>
                        {api.successResponse}
                      </Text>
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Text strong style={{ color: '#ff4d4f' }}>Error Response</Text>
                    <Card size="small" style={{ background: '#fff2f0', marginTop: 8 }}>
                      <Text code style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>
                        {api.errorResponse}
                      </Text>
                    </Card>
                  </Col>
                </Row>
              </div>
            ),
          }))}
        />
      </Card>
    </div>
  );
};

export default ApiDocsPage;

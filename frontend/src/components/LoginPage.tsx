import React from 'react';
import { Button, Card, Space, Spin } from 'antd';
import { GoogleOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';

const LoginPage: React.FC = () => {
  const { login, loading, error } = useAuth();

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f0f2f5' }}>
      <Card style={{ width: 300, textAlign: 'center' }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <h1>AI Email Sorter</h1>
          {error && <div style={{ color: 'red' }}>{error}</div>}
          <Button 
            type="primary" 
            icon={<GoogleOutlined />} 
            size="large"
            onClick={login}
            style={{ width: '100%' }}
          >
            Sign in with Google
          </Button>
        </Space>
      </Card>
    </div>
  );
};

export default LoginPage;
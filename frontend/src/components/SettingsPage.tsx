import React, { useState, useEffect } from 'react';
import { Card, Button, List, Typography, Divider, Input, Modal, message } from 'antd';
import { PlusOutlined, DeleteOutlined, GoogleOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text } = Typography;

interface Category {
  id: string;
  name: string;
  description: string;
}

interface Account {
  id: string;
  email: string;
  provider: string;
}

interface SettingsPageProps {
  onCategoriesChanged?: () => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ onCategoriesChanged }) => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: '', description: '' });
  
  const API_URL = process.env.VITE_API_URL || 'http://localhost:4000';

  useEffect(() => {
    if (user) {
      fetchAccounts();
      fetchCategories();
    }
  }, [user]);

  const fetchAccounts = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/accounts`, { withCredentials: true });
      setAccounts(data);
    } catch (error) {
      message.error('Failed to fetch connected accounts');
    }
  };

  const fetchCategories = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/categories`, { withCredentials: true });
      setCategories(data);
    } catch (error) {
      message.error('Failed to fetch categories');
    }
  };

  const connectGmail = () => {
    window.location.href = `${API_URL}/auth/connect/google`;
  };

  const removeAccount = async (accountId: string) => {
    try {
      await axios.delete(`${API_URL}/api/accounts/${accountId}`, { withCredentials: true });
      message.success('Account removed successfully');
      fetchAccounts();
    } catch (error) {
      message.error('Failed to remove account');
    }
  };

  const handleAddCategory = async () => {
    try {
      await axios.post(`${API_URL}/api/categories`, newCategory, { withCredentials: true });
      message.success('Category added successfully');
      setIsModalVisible(false);
      setNewCategory({ name: '', description: '' });
      fetchCategories();
      // Notify parent (App) so sidebar updates
      if (onCategoriesChanged) onCategoriesChanged();
    } catch (error) {
      message.error('Failed to add category');
    }
  };

  const deleteCategory = async (categoryId: string) => {
    try {
      await axios.delete(`${API_URL}/api/categories/${categoryId}`, { withCredentials: true });
      message.success('Category deleted successfully');
      fetchCategories();
      if (onCategoriesChanged) onCategoriesChanged();
    } catch (error) {
      message.error('Failed to delete category');
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px' }}>
      <Card style={{ marginBottom: '24px' }}>
        <Title level={4}>Connected Gmail Accounts</Title>
        <List
          dataSource={accounts}
          renderItem={account => (
            <List.Item
              actions={[
                <Button
                  key="delete"
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => removeAccount(account.id)}
                >
                  Remove
                </Button>
              ]}
            >
              <List.Item.Meta
                title={account.email}
                description={`Connected via ${account.provider}`}
              />
            </List.Item>
          )}
        />
        <Button
          type="primary"
          icon={<GoogleOutlined />}
          onClick={connectGmail}
          style={{ marginTop: '16px' }}
        >
          Connect Another Gmail Account
        </Button>
      </Card>

      <Card>
        <Title level={4}>Email Categories</Title>
        <List
          dataSource={categories}
          renderItem={category => (
            <List.Item
              actions={[
                <Button
                  key="delete"
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => deleteCategory(category.id)}
                >
                  Delete
                </Button>
              ]}
            >
              <List.Item.Meta
                title={category.name}
                description={category.description}
              />
            </List.Item>
          )}
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setIsModalVisible(true)}
          style={{ marginTop: '16px' }}
        >
          Add New Category
        </Button>
      </Card>

      <Modal
        title="Add New Category"
        open={isModalVisible}
        onOk={handleAddCategory}
        onCancel={() => {
          setIsModalVisible(false);
          setNewCategory({ name: '', description: '' });
        }}
      >
        <div style={{ marginBottom: '16px' }}>
          <Text>Category Name</Text>
          <Input
            value={newCategory.name}
            onChange={e => setNewCategory(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Work, Personal, Shopping"
          />
        </div>
        <div>
          <Text>Description</Text>
          <Input.TextArea
            value={newCategory.description}
            onChange={e => setNewCategory(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Describe what kinds of emails belong in this category"
          />
        </div>
      </Modal>
    </div>
  );
};

export default SettingsPage;
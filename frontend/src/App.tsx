import React, { useState, useEffect } from 'react'
import { Layout, Menu, Button, Spin } from 'antd'
import { MailOutlined, PlusOutlined, LogoutOutlined, SettingOutlined } from '@ant-design/icons'
import CategoryView from './components/CategoryView'
import EmailList from './components/EmailList'
import SettingsPage from './components/SettingsPage'
import { useAuth } from './contexts/AuthContext'
import axios from 'axios'

const { Sider, Content, Header } = Layout

const API_URL = process.env.VITE_API_URL || 'http://localhost:4000';

const App: React.FC = () => {
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<'settings' | 'category'>('settings');
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const { user, loading, login, logout } = useAuth();

  const fetchCategories = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/categories`, { withCredentials: true });
      setCategories(data || []);
    } catch (err) {
      console.error('Failed to load categories for sidebar', err);
    }
  };

  useEffect(() => {
    if (user && (view === 'settings' || categories.length === 0)) fetchCategories();
    else if (!user) setCategories([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, view]);

  return (
    <Layout style={{ height: '100vh' }}>
      <Sider theme="light">
        <div style={{ padding: 16, textAlign: 'center', fontWeight: 'bold' }}>AI Email Sorter</div>
        <Menu mode="inline" selectedKeys={view === 'settings' ? ['settings'] : selected ? [selected] : []}>
          <Menu.Item
            key="settings"
            icon={<SettingOutlined />}
            onClick={() => {
              setSelected(null);
              setView('settings');
            }}
          >
            Settings
          </Menu.Item>

          {categories.map((cat) => (
            <Menu.Item
              key={cat.id}
              icon={<MailOutlined />}
              onClick={() => {
                setSelected(cat.id);
                setView('category');
              }}
            >
              {cat.name}
            </Menu.Item>
          ))}
        </Menu>
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', textAlign: 'right', paddingRight: 20 }}>
          {loading ? (
            <Spin />
          ) : user ? (
            <>
              <span style={{ marginRight: 12 }}>Hello, {user.name}</span>
              <Button icon={<LogoutOutlined />} onClick={() => logout()}>Sign out</Button>
            </>
          ) : (
            <Button onClick={() => login()}>Sign in with Google</Button>
          )}
        </Header>
        <Content style={{ padding: 24 }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <Spin size="large" />
            </div>
          ) : user ? (
            view === 'settings' ? (
              <SettingsPage onCategoriesChanged={fetchCategories} />
            ) : (
              selected ? <EmailList categoryId={selected} categoryName={categories.find(c => c.id === selected)?.name} /> : <CategoryView />
            )
          ) : (
            <div style={{ textAlign: 'center', marginTop: 48 }}>
              Please sign in to view your emails
            </div>
          )}
        </Content>
      </Layout>
    </Layout>
  )
}

export default App

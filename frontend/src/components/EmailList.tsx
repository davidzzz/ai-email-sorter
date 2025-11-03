import React, { useEffect, useState } from 'react';
import { List, Button, Typography, Table, message, Modal, Space, Tag, Descriptions, Empty } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DeleteOutlined, StopOutlined, ReloadOutlined, MailOutlined } from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';
import { HtmlRenderer } from './HtmlRenderer';

interface Props {
  categoryId: string;
  categoryName?: string;
}

interface Email {
  id: string;
  subject: string;
  fromEmail: string;
  toEmail: string;
  snippet: string;
  content?: string;
  aiSummary: string;
  archived: boolean;
  unsubscribeLinks: string[];
  createdAt: string;
}

const API_URL = process.env.VITE_API_URL || 'http://localhost:4000';

const EmailList: React.FC<Props> = ({ categoryId, categoryName }) => {
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [unsubscribeStatus, setUnsubscribeStatus] = useState<Record<string, 'pending' | 'success' | 'failed' | 'skipped'>>({});
  const [unsubscribeModalVisible, setUnsubscribeModalVisible] = useState(false);
  const [processingEmails, setProcessingEmails] = useState<string[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [emailContentModalVisible, setEmailContentModalVisible] = useState(false);
  const [emailContentLoading, setEmailContentLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [total, setTotal] = useState<number>(0);

  useEffect(() => {
    // reset paging when category changes
    setCurrentPage(1);
    fetchEmails(1, pageSize);
  }, [categoryId]);

  const fetchEmails = async (page = 1, size = pageSize) => {
    if (!categoryId) return;
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/categories/${categoryId}/emails?page=${page}&pageSize=${size}`, { 
        withCredentials: true 
      });
      setEmails(response.data.emails || []);
      setTotal(response.data.total || 0);
      setCurrentPage(response.data.page || page);
      setPageSize(response.data.pageSize || size);
    } catch (error) {
      message.error('Failed to fetch emails');
      console.error('Error fetching emails:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (emailIds: string[]) => {
    try {
      await axios.post(`${API_URL}/api/emails/delete`, { emailIds }, { withCredentials: true });
      message.success('Emails deleted successfully');
      fetchEmails(); // Refresh the list
      setSelectedEmails([]);
    } catch (error) {
      message.error('Failed to delete emails');
      console.error('Error deleting emails:', error);
    }
  };

  const fetchEmailContent = async (emailId: string) => {
    try {
      setEmailContentLoading(true);
      const { data } = await axios.get(`${API_URL}/api/emails/${emailId}`, {
        withCredentials: true
      });
      setSelectedEmail(data);
      setEmailContentModalVisible(true);
    } catch (error) {
      message.error('Failed to fetch email content');
      console.error('Error fetching email content:', error);
    } finally {
      setEmailContentLoading(false);
    }
  };

  const startUnsubscribe = async () => {
    setUnsubscribeModalVisible(true);
    for (const emailId of selectedEmails) {
      setUnsubscribeStatus(prev => ({ ...prev, [emailId]: 'pending' }));
      setProcessingEmails(prev => [...prev, emailId]);
      
      try {
        const resp = await axios.post(
          `${API_URL}/api/emails/${emailId}/unsubscribe`,
          {},
          { withCredentials: true }
        );

        if (resp?.data?.skipped) {
          // No unsubscribe links available for this email
          setUnsubscribeStatus(prev => ({ ...prev, [emailId]: 'skipped' }));
        } else {
          setUnsubscribeStatus(prev => ({ ...prev, [emailId]: 'success' }));
        }
      } catch (error) {
        console.error(`Failed to unsubscribe email ${emailId}:`, error);
        setUnsubscribeStatus(prev => ({ ...prev, [emailId]: 'failed' }));
      }
      
      setProcessingEmails(prev => prev.filter(id => id !== emailId));
    }
  };

  const columns: ColumnsType<Email> = [
    {
      title: 'Subject',
      dataIndex: 'subject',
      key: 'subject',
      render: (text, record) => (
        <div 
          style={{ cursor: 'pointer' }}
          onClick={() => fetchEmailContent(record.id)}
        >
          <div style={{ fontWeight: 'bold' }}>
            <MailOutlined style={{ marginRight: 8 }} />
            {text}
          </div>
          <div style={{ color: '#666' }}>From: {record.fromEmail}</div>
        </div>
      ),
    },
    {
      title: 'AI Summary',
      dataIndex: 'aiSummary',
      key: 'aiSummary',
      width: '40%',
    },
    {
      title: 'Status',
      key: 'status',
      width: 200,
      render: (_, record) => (
        <Space>
          {record.archived && <Tag color="blue">Archived</Tag>}
          {record.unsubscribeLinks?.length > 0 && (
            <Tag color="green">Unsubscribe Available</Tag>
          )}
          {unsubscribeStatus[record.id] === 'pending' && (
            <Tag icon={<ReloadOutlined spin />} color="processing">
              Unsubscribing...
            </Tag>
          )}
          {unsubscribeStatus[record.id] === 'success' && (
            <Tag color="success">Unsubscribed</Tag>
          )}
          {unsubscribeStatus[record.id] === 'skipped' && (
            <Tag color="warning">No Unsubscribe Links</Tag>
          )}
          {unsubscribeStatus[record.id] === 'failed' && (
            <Tag color="error">Unsubscribe Failed</Tag>
          )}
        </Space>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys: selectedEmails,
    onChange: (selectedRowKeys: React.Key[]) => {
      setSelectedEmails(selectedRowKeys as string[]);
    },
  };

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
  <Typography.Title level={4}>{categoryName || categoryId} Emails</Typography.Title>
        <Space>
          <Button
            type="primary"
            danger
            icon={<DeleteOutlined />}
            disabled={selectedEmails.length === 0}
            onClick={() => handleDelete(selectedEmails)}
          >
            Delete Selected
          </Button>
          <Button
            type="primary"
            icon={<StopOutlined />}
            disabled={selectedEmails.length === 0}
            onClick={startUnsubscribe}
          >
            Unsubscribe Selected
          </Button>
        </Space>
      </div>

      {(!loading && emails.length === 0) ? (
        <div style={{ padding: 48, textAlign: 'center' }}>
          <Empty description="No emails in this category" />
        </div>
      ) : (
        <Table
          rowSelection={rowSelection}
          columns={columns}
          dataSource={emails}
          rowKey="id"
          loading={loading}
          pagination={{
            current: currentPage,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100']
          }}
          onChange={(pagination) => {
            const p = (pagination as any).current || 1;
            const ps = (pagination as any).pageSize || pageSize;
            fetchEmails(p, ps);
          }}
        />
      )}

      <Modal
        title="Unsubscribe Progress"
        open={unsubscribeModalVisible}
        footer={null}
        closable={processingEmails.length === 0}
        maskClosable={false}
        onCancel={() => {
          if (processingEmails.length === 0) {
            setUnsubscribeModalVisible(false);
            setUnsubscribeStatus({});
            fetchEmails();
          }
        }}
      >
        <List
          dataSource={selectedEmails}
          renderItem={emailId => {
            const email = emails.find(e => e.id === emailId);
            return (
              <List.Item>
                <List.Item.Meta
                  title={email?.subject}
                  description={
                    processingEmails.includes(emailId) ? (
                      <Tag icon={<ReloadOutlined spin />} color="processing">
                        Processing...
                      </Tag>
                    ) : unsubscribeStatus[emailId] === 'success' ? (
                      <Tag color="success">Successfully unsubscribed</Tag>
                    ) : unsubscribeStatus[emailId] === 'skipped' ? (
                      <Tag color="warning">No unsubscribe links</Tag>
                    ) : unsubscribeStatus[emailId] === 'failed' ? (
                      <Tag color="error">Failed to unsubscribe</Tag>
                    ) : (
                      <Tag>Waiting...</Tag>
                    )
                  }
                />
              </List.Item>
            );
          }}
        />
      </Modal>

      <Modal
        title="Email Content"
        open={emailContentModalVisible}
        onCancel={() => {
          setEmailContentModalVisible(false);
          setSelectedEmail(null);
        }}
        footer={null}
        width={800}
      >
        {emailContentLoading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <Typography.Text>Loading email content...</Typography.Text>
          </div>
        ) : selectedEmail ? (
          <div>
            <Descriptions bordered column={1}>
              <Descriptions.Item label="Subject">{selectedEmail.subject}</Descriptions.Item>
              <Descriptions.Item label="From">{selectedEmail.fromEmail}</Descriptions.Item>
              <Descriptions.Item label="To">{selectedEmail.toEmail}</Descriptions.Item>
              <Descriptions.Item label="Date">
                {moment(selectedEmail.createdAt).format('MMMM D, YYYY h:mm A')}
              </Descriptions.Item>
              {selectedEmail.aiSummary && (
                <Descriptions.Item label="AI Summary">{selectedEmail.aiSummary}</Descriptions.Item>
              )}
            </Descriptions>
            <div style={{ 
              marginTop: 16, 
              padding: 16, 
              backgroundColor: '#f5f5f5', 
              borderRadius: 4,
              whiteSpace: 'pre-wrap',
              fontFamily: 'monospace'
            }}
            >
              <HtmlRenderer html={selectedEmail.content ?? ''} />
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <Typography.Text type="secondary">No email content available</Typography.Text>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default EmailList

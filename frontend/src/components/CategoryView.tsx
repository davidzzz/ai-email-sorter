import React from 'react'
import { Empty } from 'antd'

const CategoryView: React.FC = () => {
  return (
    <div style={{ textAlign: 'center', marginTop: '20%' }}>
      <Empty description="Select or create a category to begin sorting emails." />
    </div>
  )
}

export default CategoryView

import {
  Table,
  Column,
  Model,
  PrimaryKey,
  IsUUID,
  CreatedAt,
  UpdatedAt,
  DataType,
  ForeignKey,
  BelongsTo,
  Default,
} from 'sequelize-typescript';
import { Account } from './Account';
import { Category } from './Category';

interface EmailAttributes {
  id: string;
  accountId: string;
  gmailMessageId: string;
  threadId?: string;
  fromEmail: string;
  toEmail: string;
  subject: string;
  snippet?: string;
  storedHtmlLocation?: string;
  storedText?: string;
  importedAt?: Date;
  aiSummary?: string;
  aiCategoryId?: string;
  aiConfidence?: number;
  archived: boolean;
  unsubscribeLinks?: any;
  status?: any;
  createdAt: Date;
  updatedAt: Date;
}

@Table({ tableName: 'emails', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' })
export class Email extends Model<EmailAttributes, Omit<EmailAttributes, 'id' | 'createdAt' | 'updatedAt'>> {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID })
  id!: string;

  @ForeignKey(() => Account)
  @Column({ type: DataType.UUID, allowNull: false, field: 'account_id' })
  accountId!: string;

  @Column({ field: 'gmail_message_id', allowNull: false, type: DataType.TEXT })
  gmailMessageId!: string;

  @Column({ field: 'thread_id', allowNull: true, type: DataType.TEXT })
  threadId?: string | null;

  @Column({ field: 'from_email', allowNull: false, type: DataType.TEXT })
  fromEmail!: string;

  @Column({ field: 'to_email', allowNull: false, type: DataType.TEXT })
  toEmail!: string;

  @Column({ allowNull: false, type: DataType.TEXT })
  subject!: string;

  @Column({ allowNull: true, type: DataType.TEXT })
  snippet?: string | null;

  @Column({ field: 'stored_html_location', allowNull: true, type: DataType.TEXT })
  storedHtmlLocation?: string | null;

  @Column({ field: 'stored_text', allowNull: true, type: DataType.TEXT })
  storedText?: string | null;

  @Column({ field: 'imported_at', allowNull: true, type: DataType.DATE })
  importedAt?: Date | null;

  @Column({ field: 'ai_summary', allowNull: true, type: DataType.TEXT })
  aiSummary?: string | null;

  @ForeignKey(() => Category)
  @Column({ field: 'ai_category_id', type: DataType.UUID, allowNull: true })
  aiCategoryId?: string | null;

  @Column({ field: 'ai_confidence', type: DataType.FLOAT, allowNull: true })
  aiConfidence?: number | null;

  @Column({ allowNull: false, defaultValue: false })
  archived!: boolean;

  @Column({ field: 'unsubscribe_links', type: DataType.JSONB, allowNull: true })
  unsubscribeLinks?: any;

  @Column({ field: 'status', type: DataType.JSONB, allowNull: true })
  status?: any;

  @CreatedAt
  @Column({ field: 'created_at', type: DataType.DATE })
  createdAt!: Date;

  @UpdatedAt
  @Column({ field: 'updated_at', type: DataType.DATE })
  updatedAt!: Date;

  @BelongsTo(() => Account)
  account?: Account;

  @BelongsTo(() => Category)
  aiCategory?: Category;
}

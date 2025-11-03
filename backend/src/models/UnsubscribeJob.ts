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
import { Email } from './Email';

@Table({ tableName: 'unsubscribe_jobs', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' })
export class UnsubscribeJob extends Model<UnsubscribeJob> {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID })
  id!: string;

  @ForeignKey(() => Email)
  @Column({ field: 'email_id', type: DataType.UUID, allowNull: false })
  emailId!: string;

  @Column({ field: 'job_status', allowNull: true, type: DataType.TEXT })
  jobStatus?: string | null;

  @Column({ field: 'last_attempted_at', allowNull: true, type: DataType.DATE })
  lastAttemptedAt?: Date | null;

  @Column({ field: 'result', type: DataType.JSONB, allowNull: true })
  result?: any;

  @CreatedAt
  @Column({ field: 'created_at', type: DataType.DATE })
  createdAt!: Date;

  @UpdatedAt
  @Column({ field: 'updated_at', type: DataType.DATE })
  updatedAt!: Date;

  @BelongsTo(() => Email)
  email?: Email;
}

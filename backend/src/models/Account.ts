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
import { User } from './User';

interface AccountAttributes {
  id: string;
  userId: string;
  providerUserEmail: string | null;
  googleRefreshToken: string | null;
  googleAccessToken: string | null;
  tokenExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

@Table({ tableName: 'accounts', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' })
export class Account extends Model<AccountAttributes, Omit<AccountAttributes, 'id' | 'createdAt' | 'updatedAt'>> {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID })
  id!: string;

  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false, field: 'user_id' })
  userId!: string;

  @Column({ field: 'provider_user_email', allowNull: true, type: DataType.TEXT })
  providerUserEmail?: string | null;

  @Column({ field: 'google_refresh_token', allowNull: true, type: DataType.TEXT })
  googleRefreshToken?: string | null;

  @Column({ field: 'google_access_token', allowNull: true, type: DataType.TEXT })
  googleAccessToken?: string | null;

  @Column({ field: 'token_expires_at', allowNull: true, type: DataType.DATE })
  tokenExpiresAt?: Date | null;

  @CreatedAt
  @Column({ field: 'created_at', type: DataType.DATE })
  createdAt!: Date;

  @UpdatedAt
  @Column({ field: 'updated_at', type: DataType.DATE })
  updatedAt!: Date;

  @BelongsTo(() => User)
  user?: User;
}

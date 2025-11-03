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

interface CategoryAttributes {
  id: string;
  userId: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

@Table({ tableName: 'categories', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' })
export class Category extends Model<CategoryAttributes, Omit<CategoryAttributes, 'id' | 'createdAt' | 'updatedAt'>> {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID })
  id!: string;

  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false, field: 'user_id' })
  userId!: string;

  @Column({ allowNull: false, type: DataType.TEXT })
  name!: string;

  @Column({ allowNull: false, type: DataType.TEXT })
  description!: string;

  @CreatedAt
  @Column({ field: 'created_at', type: DataType.DATE })
  createdAt!: Date;

  @UpdatedAt
  @Column({ field: 'updated_at', type: DataType.DATE })
  updatedAt!: Date;

  @BelongsTo(() => User)
  user?: User;
}

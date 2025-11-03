import {
  Table,
  Column,
  Model,
  PrimaryKey,
  IsUUID,
  CreatedAt,
  UpdatedAt,
  DataType,
  HasMany,
  Default,
} from 'sequelize-typescript';
import { Account } from './Account';
import { Category } from './Category';
import { Optional } from 'sequelize';

interface UserAttributes {
  id: number
  name: string
  email: string
}

// Define which attributes are optional when creating
type UserCreationAttributes = Optional<UserAttributes, 'id'>

@Table({ tableName: 'users', timestamps: true })
export class User extends Model<UserAttributes, UserCreationAttributes> {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID })
  id!: string;

  @Column({ allowNull: false, type: DataType.TEXT })
  name!: string;

  @Column({ allowNull: false, unique: true, type: DataType.TEXT })
  email!: string;

  @CreatedAt
  @Column({ field: 'created_at', type: DataType.DATE })
  createdAt!: Date;

  @UpdatedAt
  @Column({ field: 'updated_at', type: DataType.DATE })
  updatedAt!: Date;

  @HasMany(() => Account)
  accounts?: Account[];

  @HasMany(() => Category)
  categories?: Category[];
}

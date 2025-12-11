import { Entity, ObjectIdColumn, Column, CreateDateColumn, Index, OneToMany } from 'typeorm';
import { ObjectId } from 'mongodb';
import { Message } from './message.entity';

@Entity('conversations')
export class Conversation {
  @ObjectIdColumn()
  _id: ObjectId;

  @Column()
  @Index({ unique: true })
  id: string; // UUID generated on client

  @Column()
  title: string;

  @Column()
  @Index()
  userId: string;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Message, (message) => message.conversation, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  messages: Message[];
}
